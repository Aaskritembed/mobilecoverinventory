/**
 * Sales Routes
 * Handles sales tracking, inventory updates, and sales analytics
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateSale } = require('../middleware/security');
const { ResponseFormatter, asyncHandler, createPaginationInfo } = require('../middleware/response');
const { dashboardCache } = require('../utils/cache');
const { dbManager, transactionManager } = require('../utils/database');
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
    defaultMeta: { service: 'mobile-cover-inventory-sales' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});

// Get all sales with pagination and filtering
router.get('/', asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 20, 
        start_date = '', 
        end_date = '',
        sales_platform = '',
        product_id = '',
        sort = 'sale_date',
        order = 'DESC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (start_date) {
            whereClause += ' AND s.sale_date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            whereClause += ' AND s.sale_date <= ?';
            params.push(end_date + ' 23:59:59');
        }
        
        if (sales_platform) {
            whereClause += ' AND s.sales_platform = ?';
            params.push(sales_platform);
        }
        
        if (product_id) {
            whereClause += ' AND s.product_id = ?';
            params.push(product_id);
        }
        
        // Validate sort parameters
        const validSortFields = ['sale_date', 'total_amount', 'quantity_sold', 'sales_platform', 'created_date'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'sale_date';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM sales s 
            ${whereClause}
        `;
        const countResult = await dbManager.get(countQuery, params);
        
        // Get sales with product information
        const salesQuery = `
            SELECT 
                s.id, s.product_id, s.quantity_sold, s.sale_price, s.total_amount,
                s.sales_platform, s.customer_info, s.payment_method, s.slip_path,
                s.sale_date, s.created_date,
                p.name as product_name, p.brand, p.model, p.color
            FROM sales s
            LEFT JOIN products p ON s.product_id = p.id
            ${whereClause}
            ORDER BY s.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const sales = await dbManager.all(salesQuery, [...params, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, sales, pagination, 'Sales retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching sales:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch sales');
    }
}));

// Get sale by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const sale = await dbManager.get(
        `SELECT 
            s.*, 
            p.name as product_name, p.brand, p.model, p.color,
            u.first_name as seller_first_name, u.last_name as seller_last_name
         FROM sales s
         LEFT JOIN products p ON s.product_id = p.id
         LEFT JOIN users u ON s.created_by = u.id
         WHERE s.id = ?`, 
        [id]
    );
    
    if (!sale) {
        return ResponseFormatter.notFound(res, 'Sale not found');
    }
    
    ResponseFormatter.success(res, sale, 'Sale retrieved successfully');
}));

// Record new sale with automatic inventory update
router.post('/', authenticate, validateSale, asyncHandler(async (req, res) => {
    const { 
        product_id, quantity_sold, sale_price, sales_platform, 
        customer_info, payment_method, slip_path 
    } = req.body;
    
    try {
        const saleData = {
            product_id: parseInt(product_id),
            quantity_sold: parseInt(quantity_sold),
            sale_price: parseFloat(sale_price),
            sales_platform,
            customer_info,
            payment_method,
            slip_path,
            created_by: req.user.id
        };
        
        const result = await transactionManager.recordSale(saleData);
        
        // Clear dashboard cache since sales data changed
        dashboardCache.delete('dashboard_stats');
        
        ResponseFormatter.created(res, {
            sale_id: result.sale_id,
            total_amount: result.total_amount,
            remaining_stock: result.remaining_stock,
            needs_restocking: result.needs_restocking
        }, 'Sale recorded successfully');
        
    } catch (error) {
        logger.error('Error recording sale:', error);
        
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Sale already exists');
        }
        
        if (error.message.includes('Insufficient stock')) {
            return ResponseFormatter.error(res, error.message, 'Insufficient Stock', 400);
        }
        
        if (error.message.includes('Product not found')) {
            return ResponseFormatter.notFound(res, error.message);
        }
        
        ResponseFormatter.serverError(res, 'Failed to record sale');
    }
}));

// Update sale (admin only)
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        quantity_sold, sale_price, sales_platform, 
        customer_info, payment_method, slip_path 
    } = req.body;
    
    try {
        // Get current sale
        const currentSale = await dbManager.get('SELECT * FROM sales WHERE id = ?', [id]);
        if (!currentSale) {
            return ResponseFormatter.notFound(res, 'Sale not found');
        }
        
        const result = await dbManager.transaction(async (db) => {
            // If quantity changed, update product inventory accordingly
            if (quantity_sold && quantity_sold !== currentSale.quantity_sold) {
                const quantityDiff = quantity_sold - currentSale.quantity_sold;
                
                // Update product quantity
                const updateResult = await db.run(
                    'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                    [quantityDiff, currentSale.product_id]
                );
                
                if (updateResult.changes === 0) {
                    throw new Error('Product not found or insufficient stock');
                }
            }
            
            // Update sale record
            const updateFields = [];
            const updateParams = [];
            
            if (quantity_sold !== undefined) {
                updateFields.push('quantity_sold = ?');
                updateParams.push(parseInt(quantity_sold));
            }
            
            if (sale_price !== undefined) {
                updateFields.push('sale_price = ?');
                updateParams.push(parseFloat(sale_price));
            }
            
            if (sales_platform !== undefined) {
                updateFields.push('sales_platform = ?');
                updateParams.push(sales_platform);
            }
            
            if (customer_info !== undefined) {
                updateFields.push('customer_info = ?');
                updateParams.push(customer_info);
            }
            
            if (payment_method !== undefined) {
                updateFields.push('payment_method = ?');
                updateParams.push(payment_method);
            }
            
            if (slip_path !== undefined) {
                updateFields.push('slip_path = ?');
                updateParams.push(slip_path);
            }
            
            // Recalculate total_amount if quantity or price changed
            if (quantity_sold !== undefined || sale_price !== undefined) {
                const newQuantity = quantity_sold || currentSale.quantity_sold;
                const newPrice = sale_price || currentSale.sale_price;
                updateFields.push('total_amount = ?');
                updateParams.push(newQuantity * newPrice);
            }
            
            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }
            
            updateFields.push('updated_date = CURRENT_TIMESTAMP');
            updateParams.push(id);
            
            const updateQuery = `UPDATE sales SET ${updateFields.join(', ')} WHERE id = ?`;
            const saleUpdateResult = await db.run(updateQuery, updateParams);
            
            return saleUpdateResult.changes > 0;
        });
        
        // Clear dashboard cache
        dashboardCache.delete('dashboard_stats');
        
        ResponseFormatter.success(res, null, 'Sale updated successfully');
        
    } catch (error) {
        logger.error('Error updating sale:', error);
        
        if (error.message === 'Sale not found') {
            return ResponseFormatter.notFound(res, error.message);
        }
        
        if (error.message === 'Product not found or insufficient stock') {
            return ResponseFormatter.error(res, error.message, 'Insufficient Stock', 400);
        }
        
        if (error.message === 'No fields to update') {
            return ResponseFormatter.error(res, error.message, 'Validation Error', 400);
        }
        
        ResponseFormatter.serverError(res, 'Failed to update sale');
    }
}));

// Delete sale (admin only)
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await dbManager.transaction(async (db) => {
            // Get sale details before deletion
            const sale = await db.get('SELECT * FROM sales WHERE id = ?', [id]);
            if (!sale) {
                throw new Error('Sale not found');
            }
            
            // Restore inventory
            await db.run(
                'UPDATE products SET quantity = quantity + ? WHERE id = ?',
                [sale.quantity_sold, sale.product_id]
            );
            
            // Delete sale
            const deleteResult = await db.run('DELETE FROM sales WHERE id = ?', [id]);
            
            return deleteResult.changes > 0;
        });
        
        // Clear dashboard cache
        dashboardCache.delete('dashboard_stats');
        
        ResponseFormatter.noContent(res, 'Sale deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting sale:', error);
        
        if (error.message === 'Sale not found') {
            return ResponseFormatter.notFound(res, error.message);
        }
        
        ResponseFormatter.serverError(res, 'Failed to delete sale');
    }
}));

// Get sales analytics
router.get('/analytics/summary', authenticate, asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    
    try {
        let dateFilter = '';
        let params = [];
        
        switch (period) {
            case '7d':
                dateFilter = "AND s.sale_date >= date('now', '-7 days')";
                break;
            case '30d':
                dateFilter = "AND s.sale_date >= date('now', '-30 days')";
                break;
            case '90d':
                dateFilter = "AND s.sale_date >= date('now', '-90 days')";
                break;
            case '1y':
                dateFilter = "AND s.sale_date >= date('now', '-1 year')";
                break;
            default:
                dateFilter = "AND s.sale_date >= date('now', '-30 days')";
        }
        
        // Get sales summary
        const salesSummary = await dbManager.get(`
            SELECT 
                COUNT(*) as total_sales,
                SUM(s.quantity_sold) as total_quantity,
                SUM(s.total_amount) as total_revenue,
                AVG(s.total_amount) as avg_sale_amount,
                MIN(s.total_amount) as min_sale_amount,
                MAX(s.total_amount) as max_sale_amount
            FROM sales s
            WHERE 1=1 ${dateFilter}
        `, params);
        
        // Get top selling products
        const topProducts = await dbManager.all(`
            SELECT 
                p.id, p.name, p.brand, p.model, p.color,
                SUM(s.quantity_sold) as total_sold,
                SUM(s.total_amount) as total_revenue
            FROM sales s
            JOIN products p ON s.product_id = p.id
            WHERE 1=1 ${dateFilter}
            GROUP BY p.id, p.name, p.brand, p.model, p.color
            ORDER BY total_sold DESC
            LIMIT 10
        `, params);
        
        // Get sales by platform
        const salesByPlatform = await dbManager.all(`
            SELECT 
                s.sales_platform,
                COUNT(*) as total_sales,
                SUM(s.total_amount) as total_revenue,
                SUM(s.quantity_sold) as total_quantity
            FROM sales s
            WHERE 1=1 ${dateFilter}
            GROUP BY s.sales_platform
            ORDER BY total_revenue DESC
        `, params);
        
        // Get daily sales trend
        const dailySales = await dbManager.all(`
            SELECT 
                DATE(s.sale_date) as sale_date,
                COUNT(*) as sales_count,
                SUM(s.total_amount) as daily_revenue,
                SUM(s.quantity_sold) as daily_quantity
            FROM sales s
            WHERE 1=1 ${dateFilter}
            GROUP BY DATE(s.sale_date)
            ORDER BY sale_date DESC
            LIMIT 30
        `, params);
        
        ResponseFormatter.success(res, {
            summary: salesSummary,
            top_products: topProducts,
            sales_by_platform: salesByPlatform,
            daily_trend: dailySales,
            period
        }, 'Sales analytics retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching sales analytics:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch sales analytics');
    }
}));

// Get sales platforms list
router.get('/platforms', asyncHandler(async (req, res) => {
    try {
        const platforms = await dbManager.all(`
            SELECT DISTINCT sales_platform as platform
            FROM sales
            WHERE sales_platform IS NOT NULL AND sales_platform != ''
            ORDER BY sales_platform
        `);
        
        ResponseFormatter.success(res, platforms.map(p => p.platform), 'Sales platforms retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching sales platforms:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch sales platforms');
    }
}));

// Get sales dashboard stats (cached)
router.get('/dashboard/stats', asyncHandler(async (req, res) => {
    try {
        const stats = await dashboardCache.getOrFetch('dashboard_stats', async () => {
            return await dbManager.get(`
                SELECT 
                    (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = DATE('now')) as today_sales,
                    (SELECT COUNT(*) FROM sales WHERE sale_date >= date('now', '-7 days')) as week_sales,
                    (SELECT COUNT(*) FROM sales WHERE sale_date >= date('now', '-30 days')) as month_sales,
                    (SELECT COUNT(*) FROM products WHERE quantity <= 10) as low_stock_count,
                    (SELECT SUM(total_amount) FROM sales WHERE sale_date >= date('now', '-7 days')) as week_revenue,
                    (SELECT SUM(total_amount) FROM sales WHERE sale_date >= date('now', '-30 days')) as month_revenue,
                    (SELECT COUNT(*) FROM products WHERE quantity > 0) as in_stock_products
            `);
        }, 5 * 60 * 1000); // Cache for 5 minutes
        
        ResponseFormatter.success(res, stats, 'Dashboard stats retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching dashboard stats:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch dashboard stats');
    }
}));

module.exports = router;
