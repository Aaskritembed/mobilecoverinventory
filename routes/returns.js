/**
 * Returns Routes
 * Handles return processing, refunds, and return analytics
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateReturn, validateReturnReason } = require('../middleware/security');
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
    defaultMeta: { service: 'mobile-cover-inventory-returns' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});

// Get all returns with pagination and filtering
router.get('/', asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 20, 
        status = '',
        start_date = '',
        end_date = '',
        customer_name = '',
        sales_platform = '',
        sort = 'created_date',
        order = 'DESC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (status) {
            whereClause += ' AND r.return_status = ?';
            params.push(status);
        }
        
        if (start_date) {
            whereClause += ' AND r.created_date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            whereClause += ' AND r.created_date <= ?';
            params.push(end_date + ' 23:59:59');
        }
        
        if (customer_name) {
            whereClause += ' AND r.customer_name LIKE ?';
            const searchPattern = `%${customer_name}%`;
            params.push(searchPattern);
        }
        
        if (sales_platform) {
            whereClause += ' AND r.sales_platform = ?';
            params.push(sales_platform);
        }
        
        // Validate sort parameters
        const validSortFields = ['created_date', 'return_status', 'customer_name', 'quantity', 'refund_amount'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_date';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM returns r
            ${whereClause}
        `;
        const countResult = await dbManager.get(countQuery, params);
        
        // Get returns with pagination
        const returnsQuery = `
            SELECT 
                r.*,
                u.first_name as processed_by_first_name, u.last_name as processed_by_last_name,
                p.name as product_name, p.brand, p.model, p.color
            FROM returns r
            LEFT JOIN users u ON r.processed_by = u.id
            LEFT JOIN products p ON r.product_id = p.id
            ${whereClause}
            ORDER BY r.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const returns = await dbManager.all(returnsQuery, [...params, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, returns, pagination, 'Returns retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching returns:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch returns');
    }
}));

// Get return by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const returnRecord = await dbManager.get(
        `SELECT 
            r.*,
            u.first_name as processed_by_first_name, u.last_name as processed_by_last_name,
            p.name as product_name, p.brand, p.model, p.color
         FROM returns r
         LEFT JOIN users u ON r.processed_by = u.id
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.id = ?`, 
        [id]
    );
    
    if (!returnRecord) {
        return ResponseFormatter.notFound(res, 'Return not found');
    }
    
    // Get return activities
    const activities = await dbManager.all(`
        SELECT 
            ra.*,
            u.first_name as performed_by_first_name, u.last_name as performed_by_last_name
        FROM return_activities ra
        LEFT JOIN users u ON ra.performed_by = u.id
        WHERE ra.return_id = ?
        ORDER BY ra.activity_date DESC
    `, [id]);
    
    ResponseFormatter.success(res, { ...returnRecord, activities }, 'Return retrieved successfully');
}));

// Create new return
router.post('/', authenticate, validateReturn, asyncHandler(async (req, res) => {
    const { 
        customer_name, customer_email, customer_phone, product_name, 
        quantity, return_reason, return_condition, sales_platform, notes 
    } = req.body;
    
    try {
        // Find matching product if possible
        let product_id = null;
        const product = await dbManager.get(
            'SELECT id FROM products WHERE name LIKE ? LIMIT 1',
            [`%${product_name}%`]
        );
        if (product) {
            product_id = product.id;
        }
        
        const result = await dbManager.run(
            `INSERT INTO returns (
                customer_name, customer_email, customer_phone, product_name, 
                product_id, quantity, return_reason, return_condition, 
                sales_platform, notes, created_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [customer_name, customer_email, customer_phone, product_name, 
             product_id, quantity, return_reason, return_condition, sales_platform, notes]
        );
        
        // Add initial activity log
        await dbManager.run(
            `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by)
             VALUES (?, ?, ?, ?)`,
            [result.lastID, 'created', `Return created for ${quantity} x ${product_name}`, req.user.id]
        );
        
        const newReturn = await dbManager.get('SELECT * FROM returns WHERE id = ?', [result.lastID]);
        
        ResponseFormatter.created(res, newReturn, 'Return created successfully');
        
    } catch (error) {
        logger.error('Error creating return:', error);
        ResponseFormatter.serverError(res, 'Failed to create return');
    }
}));

// Cancel return
router.post('/:id/cancel', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        // Update status to 'cancelled' instead of deleting
        const result = await dbManager.run(
            'UPDATE returns SET return_status = "cancelled", updated_date = CURRENT_TIMESTAMP WHERE id = ?', 
            [id]
        );
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Return not found');
        }
        
        // Add cancellation activity
        await dbManager.run(
            `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by)
             VALUES (?, ?, ?, ?)`,
            [id, 'cancelled', 'Return cancelled by administrator', req.user.id]
        );
        
        ResponseFormatter.success(res, null, 'Return cancelled successfully');
        
    } catch (error) {
        logger.error('Error cancelling return:', error);
        ResponseFormatter.serverError(res, 'Failed to cancel return');
    }
}));

// Approve return
router.post('/:id/approve', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    try {
        const result = await dbManager.run(
            `UPDATE returns 
             SET return_status = "approved", approved_by = ?, approved_date = CURRENT_TIMESTAMP,
                 updated_date = CURRENT_TIMESTAMP
             WHERE id = ? AND return_status = "pending"`,
            [req.user.id, id]
        );
        
        if (result.changes === 0) {
            return ResponseFormatter.error(res, 'Return not found or not in pending status', 'Invalid State', 400);
        }
        
        // Add approval activity
        await dbManager.run(
            `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [id, 'approved', 'Return approved for processing', req.user.id, notes]
        );
        
        ResponseFormatter.success(res, null, 'Return approved successfully');
        
    } catch (error) {
        logger.error('Error approving return:', error);
        ResponseFormatter.serverError(res, 'Failed to approve return');
    }
}));

// Reject return
router.post('/:id/reject', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason, notes } = req.body;
    
    if (!reason) {
        return ResponseFormatter.error(res, 'Rejection reason is required', 'Validation Error', 400);
    }
    
    try {
        const result = await dbManager.run(
            `UPDATE returns 
             SET return_status = "rejected", rejected_by = ?, rejected_date = CURRENT_TIMESTAMP,
                 rejection_reason = ?, updated_date = CURRENT_TIMESTAMP
             WHERE id = ? AND return_status = "pending"`,
            [req.user.id, reason, id]
        );
        
        if (result.changes === 0) {
            return ResponseFormatter.error(res, 'Return not found or not in pending status', 'Invalid State', 400);
        }
        
        // Add rejection activity
        await dbManager.run(
            `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [id, 'rejected', `Return rejected: ${reason}`, req.user.id, notes]
        );
        
        ResponseFormatter.success(res, null, 'Return rejected successfully');
        
    } catch (error) {
        logger.error('Error rejecting return:', error);
        ResponseFormatter.serverError(res, 'Failed to reject return');
    }
}));

// Process return with refund and restocking
router.post('/:id/process', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        refund_amount, refund_method, restock_quantity = 0, notes 
    } = req.body;
    
    if (!refund_amount || !refund_method) {
        return ResponseFormatter.error(res, 'Refund amount and method are required', 'Validation Error', 400);
    }
    
    try {
        const result = await dbManager.transaction(async (db) => {
            // Get return details
            const returnRecord = await db.get('SELECT * FROM returns WHERE id = ?', [id]);
            if (!returnRecord) {
                throw new Error('Return not found');
            }
            
            if (returnRecord.return_status !== 'approved') {
                throw new Error('Return must be approved before processing');
            }
            
            // Process return using transaction manager
            const processResult = await transactionManager.processReturn({
                return_id: id,
                processed_by: req.user.id,
                refund_amount: parseFloat(refund_amount),
                refund_method,
                restock_quantity: parseInt(restock_quantity),
                product_id: returnRecord.product_id
            });
            
            // Add processing activity
            await db.run(
                `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by, notes)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, 'processed', `Return processed with $${refund_amount} refund via ${refund_method}`, req.user.id, notes]
            );
            
            return processResult;
        });
        
        // Clear dashboard cache
        dashboardCache.delete('dashboard_stats');
        
        ResponseFormatter.success(res, result, 'Return processed successfully');
        
    } catch (error) {
        logger.error('Error processing return:', error);
        
        if (error.message === 'Return not found') {
            return ResponseFormatter.notFound(res, error.message);
        }
        
        if (error.message === 'Return must be approved before processing') {
            return ResponseFormatter.error(res, error.message, 'Invalid State', 400);
        }
        
        ResponseFormatter.serverError(res, 'Failed to process return');
    }
}));

// Update return
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        customer_name, customer_email, customer_phone, product_name,
        quantity, return_reason, return_condition, sales_platform, notes 
    } = req.body;
    
    try {
        // Build dynamic update query
        const updateFields = [];
        const updateParams = [];
        
        if (customer_name !== undefined) {
            updateFields.push('customer_name = ?');
            updateParams.push(customer_name);
        }
        
        if (customer_email !== undefined) {
            updateFields.push('customer_email = ?');
            updateParams.push(customer_email);
        }
        
        if (customer_phone !== undefined) {
            updateFields.push('customer_phone = ?');
            updateParams.push(customer_phone);
        }
        
        if (product_name !== undefined) {
            updateFields.push('product_name = ?');
            updateParams.push(product_name);
        }
        
        if (quantity !== undefined) {
            updateFields.push('quantity = ?');
            updateParams.push(parseInt(quantity));
        }
        
        if (return_reason !== undefined) {
            updateFields.push('return_reason = ?');
            updateParams.push(return_reason);
        }
        
        if (return_condition !== undefined) {
            updateFields.push('return_condition = ?');
            updateParams.push(return_condition);
        }
        
        if (sales_platform !== undefined) {
            updateFields.push('sales_platform = ?');
            updateParams.push(sales_platform);
        }
        
        if (notes !== undefined) {
            updateFields.push('notes = ?');
            updateParams.push(notes);
        }
        
        if (updateFields.length === 0) {
            return ResponseFormatter.error(res, 'No fields to update', 'Validation Error', 400);
        }
        
        updateFields.push('updated_date = CURRENT_TIMESTAMP');
        updateParams.push(id);
        
        const updateQuery = `UPDATE returns SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await dbManager.run(updateQuery, updateParams);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Return not found');
        }
        
        // Add update activity
        await dbManager.run(
            `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by)
             VALUES (?, ?, ?, ?)`,
            [id, 'updated', 'Return details updated', req.user.id]
        );
        
        ResponseFormatter.success(res, null, 'Return updated successfully');
        
    } catch (error) {
        logger.error('Error updating return:', error);
        ResponseFormatter.serverError(res, 'Failed to update return');
    }
}));

// Delete return (admin only)
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await dbManager.transaction(async (db) => {
            // Check if return can be deleted (not processed)
            const returnRecord = await db.get('SELECT return_status FROM returns WHERE id = ?', [id]);
            if (!returnRecord) {
                throw new Error('Return not found');
            }
            
            if (returnRecord.return_status === 'processed') {
                throw new Error('Cannot delete processed return');
            }
            
            // Delete activities first
            await db.run('DELETE FROM return_activities WHERE return_id = ?', [id]);
            
            // Delete return
            const deleteResult = await db.run('DELETE FROM returns WHERE id = ?', [id]);
            
            return deleteResult.changes > 0;
        });
        
        ResponseFormatter.noContent(res, 'Return deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting return:', error);
        
        if (error.message === 'Return not found') {
            return ResponseFormatter.notFound(res, error.message);
        }
        
        if (error.message === 'Cannot delete processed return') {
            return ResponseFormatter.error(res, error.message, 'Invalid State', 400);
        }
        
        ResponseFormatter.serverError(res, 'Failed to delete return');
    }
}));

// Get returns analytics
router.get('/analytics/summary', authenticate, asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    
    try {
        let dateFilter = '';
        let params = [];
        
        switch (period) {
            case '7d':
                dateFilter = "AND r.created_date >= date('now', '-7 days')";
                break;
            case '30d':
                dateFilter = "AND r.created_date >= date('now', '-30 days')";
                break;
            case '90d':
                dateFilter = "AND r.created_date >= date('now', '-90 days')";
                break;
            case '1y':
                dateFilter = "AND r.created_date >= date('now', '-1 year')";
                break;
            default:
                dateFilter = "AND r.created_date >= date('now', '-30 days')";
        }
        
        // Get returns summary
        const returnsSummary = await dbManager.get(`
            SELECT 
                COUNT(*) as total_returns,
                SUM(CASE WHEN return_status = 'pending' THEN 1 ELSE 0 END) as pending_returns,
                SUM(CASE WHEN return_status = 'approved' THEN 1 ELSE 0 END) as approved_returns,
                SUM(CASE WHEN return_status = 'processed' THEN 1 ELSE 0 END) as processed_returns,
                SUM(CASE WHEN return_status = 'rejected' THEN 1 ELSE 0 END) as rejected_returns,
                SUM(refund_amount) as total_refund_amount,
                AVG(refund_amount) as avg_refund_amount,
                SUM(CASE WHEN restocked = 1 THEN quantity ELSE 0 END) as total_restocked_quantity
            FROM returns r
            WHERE 1=1 ${dateFilter}
        `, params);
        
        // Get return reasons breakdown
        const returnReasons = await dbManager.all(`
            SELECT 
                return_reason,
                COUNT(*) as count,
                SUM(quantity) as total_quantity,
                SUM(refund_amount) as total_refund_amount
            FROM returns
            WHERE 1=1 ${dateFilter}
            GROUP BY return_reason
            ORDER BY count DESC
            LIMIT 10
        `, params);
        
        // Get returns by platform
        const returnsByPlatform = await dbManager.all(`
            SELECT 
                sales_platform,
                COUNT(*) as total_returns,
                SUM(refund_amount) as total_refund_amount,
                AVG(refund_amount) as avg_refund_amount
            FROM returns
            WHERE 1=1 ${dateFilter}
            GROUP BY sales_platform
            ORDER BY total_returns DESC
        `, params);
        
        // Get daily returns trend
        const dailyReturns = await dbManager.all(`
            SELECT 
                DATE(created_date) as return_date,
                COUNT(*) as daily_returns,
                SUM(refund_amount) as daily_refund_amount,
                SUM(quantity) as daily_quantity
            FROM returns
            WHERE 1=1 ${dateFilter}
            GROUP BY DATE(created_date)
            ORDER BY return_date DESC
            LIMIT 30
        `, params);
        
        ResponseFormatter.success(res, {
            summary: returnsSummary,
            return_reasons: returnReasons,
            returns_by_platform: returnsByPlatform,
            daily_trend: dailyReturns,
            period
        }, 'Returns analytics retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching returns analytics:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch returns analytics');
    }
}));

// Get return reasons
router.get('/reasons', asyncHandler(async (req, res) => {
    try {
        const reasons = await dbManager.all(`
            SELECT * FROM return_reasons 
            ORDER BY reason_name
        `);
        
        ResponseFormatter.success(res, reasons, 'Return reasons retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching return reasons:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch return reasons');
    }
}));

// Add return reason (admin only)
router.post('/reasons', authenticate, requireAdmin, validateReturnReason, asyncHandler(async (req, res) => {
    const { reason_code, reason_name, reason_category } = req.body;
    
    try {
        const result = await dbManager.run(
            'INSERT INTO return_reasons (reason_code, reason_name, reason_category) VALUES (?, ?, ?)',
            [reason_code, reason_name, reason_category]
        );
        
        ResponseFormatter.created(res, {
            id: result.lastID,
            reason_code,
            reason_name,
            reason_category
        }, 'Return reason added successfully');
        
    } catch (error) {
        logger.error('Error adding return reason:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Return reason code already exists');
        }
        ResponseFormatter.serverError(res, 'Failed to add return reason');
    }
}));

// Delete return reason (admin only)
router.delete('/reasons/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if reason is used by any returns
        const returnCount = await dbManager.get(
            'SELECT COUNT(*) as count FROM returns WHERE return_reason = (SELECT reason_name FROM return_reasons WHERE id = ?)',
            [id]
        );
        
        if (returnCount.count > 0) {
            return ResponseFormatter.error(
                res,
                'Cannot delete return reason with associated returns',
                'Dependency Error',
                409
            );
        }
        
        const result = await dbManager.run('DELETE FROM return_reasons WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Return reason not found');
        }
        
        ResponseFormatter.noContent(res, 'Return reason deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting return reason:', error);
        ResponseFormatter.serverError(res, 'Failed to delete return reason');
    }
}));

// Get return activities
router.get('/:id/activities', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        page = 1, 
        limit = 20, 
        sort = 'activity_date',
        order = 'DESC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Validate sort parameters
        const validSortFields = ['activity_date', 'activity_type', 'performed_by_name'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'activity_date';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Get total count
        const countResult = await dbManager.get(
            'SELECT COUNT(*) as total FROM return_activities WHERE return_id = ?', 
            [id]
        );
        
        // Get activities with pagination
        const activitiesQuery = `
            SELECT 
                ra.*,
                u.first_name as performed_by_first_name, u.last_name as performed_by_last_name
            FROM return_activities ra
            LEFT JOIN users u ON ra.performed_by = u.id
            WHERE ra.return_id = ?
            ORDER BY ra.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const activities = await dbManager.all(activitiesQuery, [id, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, activities, pagination, 'Return activities retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching return activities:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch return activities');
    }
}));

// Manual activity entry
router.post('/:id/activities', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activity_type, activity_description, notes } = req.body;
    
    if (!activity_type || !activity_description) {
        return ResponseFormatter.error(res, 'Activity type and description are required', 'Validation Error', 400);
    }
    
    try {
        // Verify return exists
        const returnRecord = await dbManager.get('SELECT id FROM returns WHERE id = ?', [id]);
        if (!returnRecord) {
            return ResponseFormatter.notFound(res, 'Return not found');
        }
        
        const result = await dbManager.run(
            `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [id, activity_type, activity_description, req.user.id, notes]
        );
        
        const newActivity = await dbManager.get(
            'SELECT * FROM return_activities WHERE id = ?', 
            [result.lastID]
        );
        
        ResponseFormatter.created(res, newActivity, 'Return activity logged successfully');
        
    } catch (error) {
        logger.error('Error logging return activity:', error);
        ResponseFormatter.serverError(res, 'Failed to log return activity');
    }
}));

module.exports = router;
