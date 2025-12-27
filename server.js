// Load environment variables
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Import utilities and middleware
const { phoneModelsCache, colorsCache, dashboardCache } = require('./utils/cache');
const { dbManager, transactionManager } = require('./utils/database');
const { AnalyticsEngine } = require('./utils/analytics-engine');
const {
    securityMiddleware,
    sanitizeInput,
    errorHandler,
    csrfProtection
} = require('./middleware/security');
const { authenticate, requireAdmin, getCurrentUser } = require('./middleware/auth');
const { ResponseFormatter, asyncHandler } = require('./middleware/response');

// Import modular routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const employeesRoutes = require('./routes/employees');
const returnsRoutes = require('./routes/returns');

// Configuration from environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configure Winston Logger
const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'mobile-cover-inventory' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
});

// Create Express app
const app = express();

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('.'));

// Rate Limiting Configuration
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);

// Security middleware
app.use(securityMiddleware);

// Apply input sanitization to all API routes
app.use('/api', sanitizeInput);

// CSRF protection temporarily disabled to resolve configuration issues
// app.use('/api', csrfProtection);

// Serve static files with security headers
app.use('/uploads', express.static('uploads', {
    setHeaders: (res, path) => {
        // Set security headers for file downloads
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
    }
}));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// ==================== MODULAR ROUTES ====================

// Authentication routes
app.use('/api/auth', authRoutes);

// Product management routes
app.use('/api/products', productsRoutes);

// Sales routes
app.use('/api/sales', salesRoutes);

// Employee management routes
app.use('/api/employees', employeesRoutes);

// Returns management routes
app.use('/api/returns', returnsRoutes);

// ==================== ENHANCED API ENDPOINTS ====================

// File upload endpoints (maintained for backward compatibility)
const multer = require('multer');
const { createSecureUpload } = require('./middleware/security');

// Configure secure multer for file uploads
const upload = createSecureUpload({
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
    }
});

// Upload product image
app.post('/api/upload', upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return ResponseFormatter.error(res, 'No file uploaded', 'Validation Error', 400);
    }
    
    ResponseFormatter.success(res, {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
    }, 'File uploaded successfully');
}));

// Upload return slip
app.post('/api/upload-return-slip', upload.single('slip'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return ResponseFormatter.error(res, 'No slip file uploaded', 'Validation Error', 400);
    }
    
    ResponseFormatter.success(res, {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        size: req.file.size
    }, 'Return slip uploaded successfully');
}));

// Upload sale slip
app.post('/api/upload-sale-slip', upload.single('slip'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return ResponseFormatter.error(res, 'No slip file uploaded', 'Validation Error', 400);
    }
    
    ResponseFormatter.success(res, {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        size: req.file.size
    }, 'Sale slip uploaded successfully');
}));

// ==================== ENHANCED ANALYTICS ENDPOINTS ====================

// Simple dashboard route for frontend compatibility
app.get('/api/dashboard', asyncHandler(async (req, res) => {
    try {
        const stats = await dashboardCache.getOrFetch('dashboard_stats', async () => {
            return await dbManager.get(`
                SELECT 
                    (SELECT COUNT(*) FROM products) as total_products,
                    (SELECT COUNT(*) FROM products WHERE quantity <= 10) as low_stock_count,
                    (SELECT COUNT(*) FROM products WHERE quantity = 0) as out_of_stock_count,
                    (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = DATE('now')) as today_sales,
                    (SELECT COUNT(*) FROM sales WHERE sale_date >= date('now', '-7 days')) as week_sales,
                    (SELECT COUNT(*) FROM sales WHERE sale_date >= date('now', '-30 days')) as month_sales,
                    (SELECT SUM(total_amount) FROM sales WHERE sale_date >= date('now', '-7 days')) as week_revenue,
                    (SELECT SUM(total_amount) FROM sales WHERE sale_date >= date('now', '-30 days')) as month_revenue,
                    (SELECT COUNT(*) FROM employees WHERE is_active = 1) as active_employees,
                    (SELECT COUNT(*) FROM employee_tasks WHERE status = 'in_progress') as active_tasks,
                    (SELECT COUNT(*) FROM returns WHERE return_status = 'pending') as pending_returns
            `);
        }, 2 * 60 * 1000); // Cache for 2 minutes
        
        ResponseFormatter.success(res, stats, 'Dashboard statistics retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching dashboard stats:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch dashboard statistics');
    }
}));

// Dashboard analytics with enhanced caching
app.get('/api/dashboard/enhanced', authenticate, asyncHandler(async (req, res) => {
    try {
        const stats = await dashboardCache.getOrFetch('enhanced_dashboard_stats', async () => {
            return await dbManager.get(`
                SELECT 
                    (SELECT COUNT(*) FROM products) as total_products,
                    (SELECT COUNT(*) FROM products WHERE quantity <= 10) as low_stock_count,
                    (SELECT COUNT(*) FROM products WHERE quantity = 0) as out_of_stock_count,
                    (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = DATE('now')) as today_sales,
                    (SELECT COUNT(*) FROM sales WHERE sale_date >= date('now', '-7 days')) as week_sales,
                    (SELECT COUNT(*) FROM sales WHERE sale_date >= date('now', '-30 days')) as month_sales,
                    (SELECT SUM(total_amount) FROM sales WHERE sale_date >= date('now', '-7 days')) as week_revenue,
                    (SELECT SUM(total_amount) FROM sales WHERE sale_date >= date('now', '-30 days')) as month_revenue,
                    (SELECT COUNT(*) FROM employees WHERE is_active = 1) as active_employees,
                    (SELECT COUNT(*) FROM employee_tasks WHERE status = 'in_progress') as active_tasks,
                    (SELECT COUNT(*) FROM returns WHERE return_status = 'pending') as pending_returns,
                    (SELECT SUM(refund_amount) FROM returns WHERE return_status = 'processed') as total_refunds,
                    (SELECT COUNT(*) FROM platform_listings WHERE listing_status = 'published') as published_listings,
                    (SELECT SUM(revenue) FROM platform_listings) as total_listing_revenue
            `);
        }, 2 * 60 * 1000); // Cache for 2 minutes
        
        ResponseFormatter.success(res, stats, 'Enhanced dashboard statistics retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching enhanced dashboard stats:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch enhanced dashboard statistics');
    }
}));

// Profit analysis with advanced filtering
app.get('/api/analytics/profit-analysis', authenticate, asyncHandler(async (req, res) => {
    const { 
        start_date = '', 
        end_date = '', 
        product_id = '', 
        sales_platform = '',
        group_by = 'product'
    } = req.query;
    
    try {
        let dateFilter = '';
        let params = [];
        
        if (start_date && end_date) {
            dateFilter = 'AND s.sale_date BETWEEN ? AND ?';
            params = [start_date, end_date];
        }
        
        let productFilter = '';
        if (product_id) {
            productFilter = 'AND s.product_id = ?';
            params.push(product_id);
        }
        
        let platformFilter = '';
        if (sales_platform) {
            platformFilter = 'AND s.sales_platform = ?';
            params.push(sales_platform);
        }
        
        let groupByClause = '';
        switch (group_by) {
            case 'product':
                groupByClause = 'p.name as group_name, p.id as group_id';
                break;
            case 'platform':
                groupByClause = 's.sales_platform as group_name';
                break;
            case 'brand':
                groupByClause = 'p.brand as group_name';
                break;
            case 'month':
                groupByClause = "strftime('%Y-%m', s.sale_date) as group_name";
                break;
            default:
                groupByClause = 'p.name as group_name, p.id as group_id';
        }
        
        const sql = `
            SELECT 
                ${groupByClause},
                SUM(s.quantity_sold) as total_sold,
                SUM(s.total_amount) as total_revenue,
                SUM(s.quantity_sold * p.cost_price) as total_cost,
                SUM(s.total_amount - (s.quantity_sold * p.cost_price)) as total_profit,
                AVG(s.total_amount) as avg_sale_amount,
                COUNT(s.id) as transaction_count,
                ROUND(
                    ((SUM(s.total_amount) - SUM(s.quantity_sold * p.cost_price)) / 
                     SUM(s.quantity_sold * p.cost_price)) * 100, 2
                ) as profit_margin_percentage
            FROM sales s
            LEFT JOIN products p ON s.product_id = p.id
            WHERE 1=1 ${dateFilter} ${productFilter} ${platformFilter}
            GROUP BY ${groupByClause}
            ORDER BY total_profit DESC
        `;
        
        const results = await dbManager.all(sql, params);
        
        ResponseFormatter.success(res, results, 'Profit analysis retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching profit analysis:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch profit analysis');
    }
}));

// Inventory valuation report
app.get('/api/analytics/inventory-valuation', authenticate, asyncHandler(async (req, res) => {
    try {
        const valuation = await dbManager.get(`
            SELECT 
                SUM(p.quantity * p.cost_price) as total_cost_value,
                SUM(p.quantity * p.selling_price) as total_selling_value,
                SUM(p.quantity * (p.selling_price - p.cost_price)) as total_potential_profit,
                SUM(CASE WHEN p.quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_items,
                SUM(CASE WHEN p.quantity <= 10 AND p.quantity > 0 THEN 1 ELSE 0 END) as low_stock_items,
                SUM(CASE WHEN p.quantity > 10 THEN 1 ELSE 0 END) as well_stocked_items
            FROM products p
        `);
        
        // Get valuation by category
        const categoryValuation = await dbManager.all(`
            SELECT 
                COALESCE(p.brand, 'Unknown') as category,
                COUNT(p.id) as item_count,
                SUM(p.quantity) as total_quantity,
                SUM(p.quantity * p.cost_price) as cost_value,
                SUM(p.quantity * p.selling_price) as selling_value,
                SUM(p.quantity * (p.selling_price - p.cost_price)) as potential_profit,
                ROUND(AVG(p.selling_price), 2) as avg_selling_price
            FROM products p
            GROUP BY p.brand
            ORDER BY cost_value DESC
        `);
        
        ResponseFormatter.success(res, {
            overall_valuation: valuation,
            category_breakdown: categoryValuation
        }, 'Inventory valuation retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching inventory valuation:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch inventory valuation');
    }
}));

// Employee productivity analysis
app.get('/api/analytics/employee-productivity', authenticate, asyncHandler(async (req, res) => {
    const { 
        start_date = '', 
        end_date = '', 
        employee_id = '' 
    } = req.query;
    
    try {
        let dateFilter = '';
        let params = [];
        
        if (start_date && end_date) {
            dateFilter = 'AND ta.activity_date BETWEEN ? AND ?';
            params = [start_date, end_date];
        }
        
        let employeeFilter = '';
        if (employee_id) {
            employeeFilter = 'AND e.id = ?';
            params.push(employee_id);
        }
        
        const productivity = await dbManager.all(`
            SELECT 
                e.id,
                e.name,
                e.role,
                COUNT(DISTINCT et.id) as total_tasks_assigned,
                COUNT(CASE WHEN et.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN et.status = 'in_progress' THEN 1 END) as active_tasks,
                COUNT(CASE WHEN et.status = 'pending' THEN 1 END) as pending_tasks,
                SUM(ta.hours_worked) as total_hours_worked,
                COUNT(ta.id) as total_activities,
                COALESCE(SUM(pl.sales_count), 0) as total_sales_made,
                COALESCE(SUM(pl.revenue), 0) as total_revenue_generated,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT et.id) > 0 
                        THEN (COUNT(CASE WHEN et.status = 'completed' THEN 1 END) * 100.0 / COUNT(DISTINCT et.id))
                        ELSE 0 
                    END, 2
                ) as task_completion_rate,
                ROUND(
                    CASE 
                        WHEN SUM(ta.hours_worked) > 0 
                        THEN COALESCE(SUM(pl.revenue), 0) / SUM(ta.hours_worked)
                        ELSE 0 
                    END, 2
                ) as revenue_per_hour
            FROM employees e
            LEFT JOIN employee_tasks et ON e.id = et.employee_id
            LEFT JOIN task_activities ta ON e.id = ta.employee_id
            LEFT JOIN platform_listings pl ON e.id = pl.employee_id
            WHERE e.is_active = 1 ${employeeFilter}
            GROUP BY e.id, e.name, e.role
            ORDER BY completed_tasks DESC, revenue_per_hour DESC
        `, params);
        
        ResponseFormatter.success(res, productivity, 'Employee productivity analysis retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching employee productivity:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch employee productivity analysis');
    }
}));

// Platform performance comparison
app.get('/api/analytics/platform-comparison', authenticate, asyncHandler(async (req, res) => {
    const { 
        start_date = '', 
        end_date = '' 
    } = req.query;
    
    try {
        let dateFilter = '';
        let params = [];
        
        if (start_date && end_date) {
            dateFilter = 'WHERE pl.last_updated BETWEEN ? AND ?';
            params = [start_date, end_date];
        }
        
        const platformStats = await dbManager.all(`
            SELECT 
                pl.platform,
                COUNT(*) as total_listings,
                COUNT(CASE WHEN pl.listing_status = 'published' THEN 1 END) as published_listings,
                COUNT(CASE WHEN pl.listing_status = 'draft' THEN 1 END) as draft_listings,
                SUM(pl.sales_count) as total_sales,
                SUM(pl.revenue) as total_revenue,
                SUM(pl.views_count) as total_views,
                ROUND(AVG(pl.sales_count), 2) as avg_sales_per_listing,
                ROUND(AVG(pl.revenue), 2) as avg_revenue_per_listing,
                ROUND(AVG(pl.views_count), 2) as avg_views_per_listing,
                COUNT(DISTINCT pl.employee_id) as active_employees,
                ROUND(
                    CASE 
                        WHEN COUNT(*) > 0 
                        THEN (COUNT(CASE WHEN pl.listing_status = 'published' THEN 1 END) * 100.0 / COUNT(*))
                        ELSE 0 
                    END, 2
                ) as publication_rate
            FROM platform_listings pl
            ${dateFilter}
            GROUP BY pl.platform
            ORDER BY total_revenue DESC
        `, params);
        
        // Get sales comparison by platform
        const salesByPlatform = await dbManager.all(`
            SELECT 
                s.sales_platform as platform,
                COUNT(*) as total_sales,
                SUM(s.total_amount) as total_revenue,
                SUM(s.quantity_sold) as total_quantity_sold,
                ROUND(AVG(s.total_amount), 2) as avg_sale_amount,
                ROUND(AVG(s.sale_price), 2) as avg_unit_price
            FROM sales s
            WHERE s.sales_platform IS NOT NULL AND s.sales_platform != ''
            GROUP BY s.sales_platform
            ORDER BY total_revenue DESC
        `);
        
        ResponseFormatter.success(res, {
            platform_listing_performance: platformStats,
            sales_by_platform: salesByPlatform
        }, 'Platform performance comparison retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching platform comparison:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch platform performance comparison');
    }
}));

// ==================== REAL-TIME DATA ENDPOINTS ====================

// Real-time stock alerts
app.get('/api/alerts/stock', authenticate, asyncHandler(async (req, res) => {
    const { threshold = 10 } = req.query;
    
    try {
        const stockAlerts = await dbManager.all(`
            SELECT 
                id, name, brand, model, color, quantity, 
                CASE 
                    WHEN quantity = 0 THEN 'out_of_stock'
                    WHEN quantity <= ? THEN 'low_stock'
                    ELSE 'normal'
                END as alert_level
            FROM products
            WHERE quantity <= ?
            ORDER BY quantity ASC
        `, [threshold, threshold]);
        
        // Group alerts by level
        const alerts = {
            out_of_stock: stockAlerts.filter(item => item.alert_level === 'out_of_stock'),
            low_stock: stockAlerts.filter(item => item.alert_level === 'low_stock')
        };
        
        ResponseFormatter.success(res, alerts, 'Stock alerts retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching stock alerts:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch stock alerts');
    }
}));

// System health check
app.get('/api/health', asyncHandler(async (req, res) => {
    try {
        const dbHealth = await dbManager.healthCheck();
        const cacheStats = dashboardCache.getStats();
        
        const health = {
            status: dbHealth ? 'healthy' : 'unhealthy',
            database: dbHealth ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            cache: {
                size: cacheStats.size,
                hitRate: cacheStats.hitRate,
                hitCount: cacheStats.hitCount,
                missCount: cacheStats.missCount
            },
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        };
        
        const statusCode = dbHealth ? 200 : 503;
        ResponseFormatter.success(res, health, 'System health status', statusCode);
        
    } catch (error) {
        logger.error('Health check error:', error);
        ResponseFormatter.serverError(res, 'Health check failed', 'System Error', 503);
    }
}));

// ==================== UTILITY ENDPOINTS ====================

// Cache management endpoints (admin only)
app.post('/api/admin/cache/clear', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { cache_type = 'all' } = req.body;
    
    try {
        switch (cache_type) {
            case 'phone_models':
                phoneModelsCache.clear();
                break;
            case 'colors':
                colorsCache.clear();
                break;
            case 'dashboard':
                dashboardCache.clear();
                break;
            case 'all':
                phoneModelsCache.clear();
                colorsCache.clear();
                dashboardCache.clear();
                break;
            default:
                return ResponseFormatter.error(res, 'Invalid cache type', 'Validation Error', 400);
        }
        
        ResponseFormatter.success(res, { cache_type }, 'Cache cleared successfully');
        
    } catch (error) {
        logger.error('Error clearing cache:', error);
        ResponseFormatter.serverError(res, 'Failed to clear cache');
    }
}));

// Get cache statistics (admin only)
app.get('/api/admin/cache/stats', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    try {
        const stats = {
            phone_models_cache: phoneModelsCache.getStats(),
            colors_cache: colorsCache.getStats(),
            dashboard_cache: dashboardCache.getStats()
        };
        
        ResponseFormatter.success(res, stats, 'Cache statistics retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching cache stats:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch cache statistics');
    }
}));

// Database information (admin only)
app.get('/api/admin/database/info', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    try {
        const dbInfo = await dbManager.getStats();
        
        ResponseFormatter.success(res, dbInfo, 'Database information retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching database info:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch database information');
    }
}));

// ==================== SERVE FRONTEND ====================

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve specific HTML files
app.get('/products', (req, res) => {
    res.sendFile(path.join(__dirname, 'products.html'));
});

app.get('/sales', (req, res) => {
    res.sendFile(path.join(__dirname, 'sales.html'));
});

app.get('/employees', (req, res) => {
    res.sendFile(path.join(__dirname, 'employees.html'));
});

app.get('/work-tracker', (req, res) => {
    res.sendFile(path.join(__dirname, 'work-tracker.html'));
});

app.get('/employee-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'employee-dashboard.html'));
});

app.get('/task-assignment', (req, res) => {
    res.sendFile(path.join(__dirname, 'task-assignment.html'));
});

app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'reports.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ==================== ERROR HANDLING ====================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    ResponseFormatter.notFound(res, 'API endpoint not found');
});

// Global error handling middleware
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

// Start server
const server = app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Log Level: ${LOG_LEVEL}`);
});

// ==================== GRACEFUL SHUTDOWN ====================

// Graceful shutdown
const gracefulShutdown = () => {
    logger.info('Starting graceful shutdown...');
    
    // Check if server is actually running
    if (!server.listening) {
        logger.info('Server is not running, skipping shutdown');
        process.exit(0);
    }
    
    server.close(async (err) => {
        if (err) {
            logger.error('Error during server shutdown:', err);
            process.exit(1);
        }
        
        try {
            await dbManager.close();
            logger.info('Database connection closed.');
            
            // Stop cache cleanup timers
            phoneModelsCache.stopCleanupTimer();
            colorsCache.stopCleanupTimer();
            dashboardCache.stopCleanupTimer();
            
            logger.info('Cache cleanup timers stopped.');
            logger.info('Graceful shutdown completed.');
            process.exit(0);
            
        } catch (dbError) {
            logger.error('Error closing database connection:', dbError);
            process.exit(1);
        }
    });
};

// Handle different shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown();
});

// ==================== EXPORTS FOR TESTING ====================

// Export app and utilities for testing
module.exports = {
    app,
    dbManager,
    transactionManager,
    phoneModelsCache,
    colorsCache,
    dashboardCache,
    logger
};
