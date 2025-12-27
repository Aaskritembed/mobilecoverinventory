// Input validation and security middleware
const { body, validationResult } = require('express-validator');
const multer = require('multer');

// Custom validation middleware factory
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }
        next();
    };
};

// Product validation rules
const validateProduct = validate([
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Product name must be between 2 and 100 characters')
        .escape(),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters')
        .escape(),
    
    body('cost_price')
        .isFloat({ min: 0 })
        .withMessage('Cost price must be a positive number'),
    
    body('selling_price')
        .isFloat({ min: 0 })
        .withMessage('Selling price must be a positive number'),
    
    body('quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Quantity must be a non-negative integer'),
    
    body('brand')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Brand must not exceed 50 characters')
        .escape(),
    
    body('model')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Model must not exceed 100 characters')
        .escape(),
    
    body('color')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Color must not exceed 50 characters')
        .escape()
]);

// Sales validation rules
const validateSale = validate([
    body('product_id')
        .isInt({ min: 1 })
        .withMessage('Valid product ID is required'),
    
    body('quantity_sold')
        .isInt({ min: 1 })
        .withMessage('Quantity sold must be at least 1'),
    
    body('sale_price')
        .isFloat({ min: 0 })
        .withMessage('Sale price must be a positive number'),
    
    body('sales_platform')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Sales platform must be between 1 and 100 characters')
        .escape(),
    
    body('customer_info')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Customer info must not exceed 500 characters')
        .escape(),
    
    body('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Payment method must not exceed 50 characters')
        .escape()
]);

// Employee validation rules
const validateEmployee = validate([
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .escape(),
    
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email address is required'),
    
    body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Valid phone number is required'),
    
    body('role')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Role must not exceed 50 characters')
        .escape(),
    
    body('salary')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Salary must be a positive number'),
    
    body('performance_rating')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Performance rating must be between 1 and 5')
]);

// Employee task validation rules
const validateEmployeeTask = validate([
    body('employee_id')
        .isInt({ min: 1 })
        .withMessage('Valid employee ID is required'),
    
    body('platform')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Platform must be between 1 and 100 characters')
        .escape(),
    
    body('product_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Valid product ID is required'),
    
    body('product_url')
        .optional()
        .isURL()
        .withMessage('Valid product URL is required'),
    
    body('color')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Color must not exceed 50 characters')
        .escape(),
    
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be low, medium, or high'),
    
    body('estimated_hours')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Estimated hours must be a positive number')
]);

// Return validation rules
const validateReturn = validate([
    body('customer_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Customer name must be between 2 and 100 characters')
        .escape(),
    
    body('customer_email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid customer email is required'),
    
    body('customer_phone')
        .optional()
        .isMobilePhone()
        .withMessage('Valid customer phone is required'),
    
    body('product_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Product name must be between 2 and 100 characters')
        .escape(),
    
    body('quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
    
    body('return_reason')
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Return reason must be between 2 and 200 characters')
        .escape(),
    
    body('return_condition')
        .optional()
        .isIn(['excellent', 'good', 'fair', 'damaged'])
        .withMessage('Return condition must be excellent, good, fair, or damaged'),
    
    body('sales_platform')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Sales platform must not exceed 100 characters')
        .escape(),
    
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes must not exceed 1000 characters')
        .escape()
]);

// Return reason validation rules
const validateReturnReason = validate([
    body('reason_code')
        .trim()
        .isLength({ min: 2, max: 20 })
        .withMessage('Reason code must be between 2 and 20 characters')
        .matches(/^[A-Z0-9_]+$/)
        .withMessage('Reason code must contain only uppercase letters, numbers, and underscores')
        .escape(),
    
    body('reason_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Reason name must be between 2 and 100 characters')
        .escape(),
    
    body('reason_category')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Reason category must not exceed 50 characters')
        .escape()
]);

// Task activity validation rules
const validateTaskActivity = validate([
    body('task_id')
        .isInt({ min: 1 })
        .withMessage('Valid task ID is required'),
    
    body('employee_id')
        .isInt({ min: 1 })
        .withMessage('Valid employee ID is required'),
    
    body('description')
        .trim()
        .isLength({ min: 2, max: 500 })
        .withMessage('Description must be between 2 and 500 characters')
        .escape(),
    
    body('hours_worked')
        .optional()
        .isFloat({ min: 0, max: 24 })
        .withMessage('Hours worked must be between 0 and 24'),
    
    body('activity_date')
        .optional()
        .isISO8601()
        .withMessage('Valid activity date is required')
]);

// Phone model validation rules
const validatePhoneModel = validate([
    body('brand')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Brand must be between 2 and 50 characters')
        .escape(),
    
    body('model')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Model must be between 2 and 100 characters')
        .escape()
]);

// Color validation rules
const validateColor = validate([
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Color name must be between 2 and 50 characters')
        .escape(),
    
    body('hex_code')
        .optional()
        .matches(/^#[0-9A-Fa-f]{6}$/)
        .withMessage('Hex code must be in format #RRGGBB')
]);

// File upload configuration with security restrictions
const createSecureUpload = (options = {}) => {
    const defaultOptions = {
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
            files: 1
        },
        fileFilter: (req, file, cb) => {
            const allowedTypes = {
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/png': '.png',
                'image/gif': '.gif'
            };
            
            if (allowedTypes[file.mimetype]) {
                cb(null, true);
            } else {
                cb(new Error('Only JPEG, PNG, and GIF images are allowed!'), false);
            }
        }
    };
    
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
            // Generate secure filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const extension = file.mimetype.split('/')[1];
            cb(null, `upload-${uniqueSuffix}.${extension}`);
        }
    });
    
    return multer({
        storage,
        limits: { ...defaultOptions.limits, ...options.limits },
        fileFilter: options.fileFilter || defaultOptions.fileFilter
    });
};

// CSRF Protection Middleware
const csrf = require('csurf');
const crypto = require('crypto');

// CSRF Protection setup
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

// Generate CSRF token
const generateCSRFToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Security middleware
const securityMiddleware = (req, res, next) => {
    // Remove potentially dangerous headers
    res.removeHeader('X-Powered-By');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Add HSTS header for production
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Remove server information
    res.setHeader('Server', 'Inventory-Server');
    
    next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Recursively sanitize object properties
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.trim().replace(/[<>]/g, '');
        } else if (Array.isArray(obj)) {
            return obj.map(sanitize);
        } else if (obj !== null && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }
        return obj;
    };
    
    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    req.params = sanitize(req.params);
    
    next();
};

// SQL injection protection helper
const sanitizeSqlInput = (input) => {
    if (typeof input === 'string') {
        return input.replace(/['";]/g, '');
    }
    return input;
};

// Parameterized query helper
const createParameterizedQuery = (query, params = []) => {
    const paramPlaceholders = params.map((_, index) => `$${index + 1}`).join(', ');
    return {
        query: query.replace(/\?/g, () => paramPlaceholders.shift() || '?'),
        params
    };
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Server Error:', err);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    }
    
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({
            error: 'Database Constraint Error',
            message: 'Data violates database constraints'
        });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File Too Large',
            message: 'File size exceeds the maximum limit'
        });
    }
    
    // Generic error response
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : err.message
    });
};

module.exports = {
    validate,
    validateProduct,
    validateSale,
    validateEmployee,
    validateEmployeeTask,
    validateReturn,
    validateReturnReason,
    validateTaskActivity,
    validatePhoneModel,
    validateColor,
    createSecureUpload,
    csrfProtection,
    generateCSRFToken,
    securityMiddleware,
    sanitizeInput,
    sanitizeSqlInput,
    createParameterizedQuery,
    errorHandler
};
