const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Load environment variables
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOGIN_LOCKOUT_TIME = parseInt(process.env.LOGIN_LOCKOUT_TIME) || 30 * 60 * 1000; // 30 minutes

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

// JWT Token Generation
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

// JWT Token Verification
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Password Hashing
const hashPassword = async (password) => {
    return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

// Password Comparison
const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

// Authentication Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = decoded;
    next();
};

// Admin Authorization Middleware
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
};

// Session Check Middleware
const checkSession = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
};

// Get Current User
const getCurrentUser = (req) => {
    return req.user;
};

// Validate Password Strength
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
    }
    
    if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!hasNumbers) {
        errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// Validate Email
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Initialize database connection for login tracking
const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

// Database-backed Rate Limiting for Login Attempts
const checkLoginAttempts = async (email) => {
    return new Promise((resolve, reject) => {
        const now = new Date();
        
        // First check if user exists
        db.get('SELECT id, locked_until, login_attempts FROM users WHERE email = ?', [email], (err, user) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!user) {
                // User doesn't exist, allow attempt but record it
                resolve({ allowed: true, attempts: 0, userExists: false });
                return;
            }
            
            // Check if account is locked
            if (user.locked_until && new Date(user.locked_until) > now) {
                const remainingTime = Math.ceil((new Date(user.locked_until) - now) / 1000);
                resolve({ 
                    allowed: false, 
                    attempts: user.login_attempts, 
                    remainingTime,
                    userExists: true 
                });
                return;
            }
            
            resolve({ 
                allowed: true, 
                attempts: user.login_attempts,
                userExists: true 
            });
        });
    });
};

const recordLoginAttempt = async (email, success) => {
    return new Promise((resolve, reject) => {
        if (success) {
            // Reset attempts on successful login
            db.run(
                'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE email = ?', 
                [email], 
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
            return;
        }
        
        // Increment failed attempts
        db.get('SELECT login_attempts FROM users WHERE email = ?', [email], (err, user) => {
            if (err) {
                reject(err);
                return;
            }
            
            const currentAttempts = user ? user.login_attempts + 1 : 1;
            
            // Check if we should lock the account
            let lockUntil = null;
            if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
                lockUntil = new Date(Date.now() + LOGIN_LOCKOUT_TIME);
            }
            
            db.run(
                'UPDATE users SET login_attempts = ?, locked_until = ? WHERE email = ?',
                [currentAttempts, lockUntil, email],
                function(err) {
                    if (err) reject(err);
                    else resolve({ attempts: currentAttempts, locked: !!lockUntil });
                }
            );
        });
    });
};

module.exports = {
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,
    authenticate,
    requireAdmin,
    checkSession,
    getCurrentUser,
    validatePassword,
    validateEmail,
    checkLoginAttempts,
    recordLoginAttempt
};
