/**
 * Authentication Routes
 * Handles user authentication, registration, and user management
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validatePassword, validateEmail } = require('../middleware/auth');
const { ResponseFormatter, asyncHandler } = require('../middleware/response');
const { phoneModelsCache, colorsCache, dashboardCache } = require('../utils/cache');
const { dbManager } = require('../utils/database');
const winston = require('winston');

const router = express.Router();

// Logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'mobile-cover-inventory-auth' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});

// CSRF token endpoint (no authentication required)
router.get('/csrf-token', (req, res) => {
    try {
        ResponseFormatter.success(res, {
            csrfToken: req.csrfToken()
        }, 'CSRF token generated');
    } catch (error) {
        logger.error('CSRF token generation error:', error);
        ResponseFormatter.serverError(res, 'Failed to generate CSRF token');
    }
});

// Login endpoint with enhanced security
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return ResponseFormatter.error(res, 'Email and password are required', 'Validation Error', 400);
    }
    
    try {
        // Check login attempts before proceeding
        const attemptCheck = await dbManager.checkLoginAttempts(email);
        if (!attemptCheck.allowed) {
            logger.warn(`Login attempt blocked for ${email}: Too many attempts`);
            return ResponseFormatter.error(res, 'Too many login attempts', 'Rate Limited', 429, {
                remainingTime: attemptCheck.remainingTime
            });
        }
        
        // Get user from database
        const user = await dbManager.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
        
        if (!user) {
            logger.warn(`Invalid login attempt for non-existent user: ${email}`);
            await dbManager.recordLoginAttempt(email, false);
            return ResponseFormatter.error(res, 'Invalid credentials', 'Authentication Failed', 401);
        }
        
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            logger.warn(`Login attempt on locked account: ${email}`);
            return ResponseFormatter.error(res, 'Account is temporarily locked', 'Account Locked', 423, {
                lockedUntil: user.locked_until
            });
        }
        
        // Verify password
        const { comparePassword } = require('../middleware/auth');
        const isValidPassword = await comparePassword(password, user.password_hash);
        
        if (!isValidPassword) {
            logger.warn(`Invalid password for user: ${email}`);
            const result = await dbManager.recordLoginAttempt(email, false);
            if (result.locked) {
                logger.warn(`Account locked for user: ${email} after ${result.attempts} attempts`);
            }
            return ResponseFormatter.error(res, 'Invalid credentials', 'Authentication Failed', 401);
        }
        
        // Successful login - reset attempts and update last login
        logger.info(`Successful login for user: ${email}`);
        await dbManager.recordLoginAttempt(email, true);
        await dbManager.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        // Generate JWT token
        const { generateToken } = require('../middleware/auth');
        const token = generateToken(user);
        
        ResponseFormatter.success(res, {
            token: token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role
            }
        }, 'Login successful');
        
    } catch (error) {
        logger.error('Login error:', error);
        try {
            await dbManager.recordLoginAttempt(email, false);
        } catch (recordError) {
            logger.error('Error recording failed login attempt:', recordError);
        }
        ResponseFormatter.serverError(res, 'Internal server error');
    }
}));

// Get current user endpoint
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const user = await dbManager.get(
        'SELECT id, email, first_name, last_name, role, last_login, created_date FROM users WHERE id = ?', 
        [req.user.id]
    );
    
    if (!user) {
        return ResponseFormatter.notFound(res, 'User not found');
    }
    
    ResponseFormatter.success(res, user, 'User profile retrieved');
}));

// Logout endpoint
router.post('/logout', authenticate, (req, res) => {
    // In a production environment, you might want to add the token to a blacklist
    ResponseFormatter.success(res, null, 'Logout successful');
});

// Register new user (admin only)
router.post('/register', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { email, password, first_name, last_name, role = 'user' } = req.body;
    
    if (!email || !password || !first_name || !last_name) {
        return ResponseFormatter.error(res, 'Email, password, first name, and last name are required', 'Validation Error', 400);
    }
    
    // Validate email format
    if (!validateEmail(email)) {
        return ResponseFormatter.error(res, 'Invalid email format', 'Validation Error', 400);
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        return ResponseFormatter.error(res, 'Password does not meet requirements', 'Validation Error', 400, {
            errors: passwordValidation.errors
        });
    }
    
    // Validate role
    if (!['admin', 'user'].includes(role)) {
        return ResponseFormatter.error(res, 'Invalid role', 'Validation Error', 400);
    }
    
    try {
        const { hashPassword } = require('../middleware/auth');
        const password_hash = await hashPassword(password);
        
        const result = await dbManager.run(
            'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
            [email, password_hash, first_name, last_name, role]
        );
        
        ResponseFormatter.created(res, {
            id: result.lastID,
            email,
            first_name,
            last_name,
            role
        }, 'User created successfully');
        
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Email already exists');
        }
        logger.error('Registration error:', error);
        ResponseFormatter.serverError(res, 'Internal server error');
    }
}));

// Get all users (admin only)
router.get('/users', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (search) {
        whereClause += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (role) {
        whereClause += ' AND role = ?';
        params.push(role);
    }
    
    const countResult = await dbManager.get(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const users = await dbManager.all(
        `SELECT id, email, first_name, last_name, role, is_active, created_date, last_login, login_attempts 
         FROM users ${whereClause} 
         ORDER BY created_date DESC 
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
    );
    
    const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
    };
    
    ResponseFormatter.paginated(res, users, pagination, 'Users retrieved successfully');
}));

// Update user (admin only)
router.put('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, role, is_active, password } = req.body;
    
    try {
        // If password is being updated, hash it
        let password_hash = null;
        if (password) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                return ResponseFormatter.error(res, 'Password does not meet requirements', 'Validation Error', 400, {
                    errors: passwordValidation.errors
                });
            }
            const { hashPassword } = require('../middleware/auth');
            password_hash = await hashPassword(password);
        }
        
        // Build update query dynamically
        const updateFields = [];
        const updateParams = [];
        
        if (first_name) {
            updateFields.push('first_name = ?');
            updateParams.push(first_name);
        }
        
        if (last_name) {
            updateFields.push('last_name = ?');
            updateParams.push(last_name);
        }
        
        if (role && ['admin', 'user'].includes(role)) {
            updateFields.push('role = ?');
            updateParams.push(role);
        }
        
        if (typeof is_active === 'boolean') {
            updateFields.push('is_active = ?');
            updateParams.push(is_active ? 1 : 0);
        }
        
        if (password_hash) {
            updateFields.push('password_hash = ?');
            updateParams.push(password_hash);
            updateFields.push('login_attempts = 0');
            updateFields.push('locked_until = NULL');
        }
        
        if (updateFields.length === 0) {
            return ResponseFormatter.error(res, 'No fields to update', 'Validation Error', 400);
        }
        
        updateFields.push('updated_date = CURRENT_TIMESTAMP');
        updateParams.push(id);
        
        const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await dbManager.run(updateQuery, updateParams);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'User not found');
        }
        
        ResponseFormatter.success(res, null, 'User updated successfully');
        
    } catch (error) {
        logger.error('User update error:', error);
        ResponseFormatter.serverError(res, 'Internal server error');
    }
}));

// Delete user (admin only)
router.delete('/users/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Prevent deleting the current admin user
    if (parseInt(id) === req.user.id) {
        return ResponseFormatter.error(res, 'Cannot delete your own account', 'Validation Error', 400);
    }
    
    const result = await dbManager.run('DELETE FROM users WHERE id = ?', [id]);
    
    if (result.changes === 0) {
        return ResponseFormatter.notFound(res, 'User not found');
    }
    
    ResponseFormatter.noContent(res, 'User deleted successfully');
}));

module.exports = router;
