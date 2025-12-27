/**
 * Product Routes
 * Handles product management, inventory tracking, and phone models
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateProduct } = require('../middleware/security');
const { ResponseFormatter, asyncHandler, createPaginationInfo } = require('../middleware/response');
const { phoneModelsCache, colorsCache } = require('../utils/cache');
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
    defaultMeta: { service: 'mobile-cover-inventory-products' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});

// Get all products with pagination and search
router.get('/', asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 20, 
        search = '', 
        brand = '', 
        model = '',
        sort = 'name',
        order = 'ASC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (search) {
            whereClause += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        
        if (brand) {
            whereClause += ' AND p.brand = ?';
            params.push(brand);
        }
        
        if (model) {
            whereClause += ' AND p.model = ?';
            params.push(model);
        }
        
        // Validate sort parameters
        const validSortFields = ['name', 'brand', 'model', 'quantity', 'cost_price', 'selling_price', 'created_date'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'name';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM products p 
            ${whereClause}
        `;
        const countResult = await dbManager.get(countQuery, params);
        
        // Get products with pagination
        const productsQuery = `
            SELECT 
                p.id, p.name, p.description, p.cost_price, p.selling_price, p.quantity,
                p.brand, p.model, p.color, p.image_path, p.created_date, p.updated_date,
                CASE 
                    WHEN p.quantity = 0 THEN 'out_of_stock'
                    WHEN p.quantity <= 10 THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status
            FROM products p
            ${whereClause}
            ORDER BY p.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const products = await dbManager.all(productsQuery, [...params, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, products, pagination, 'Products retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching products:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch products');
    }
}));

// Get product by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const product = await dbManager.get(
        `SELECT * FROM products WHERE id = ?`, 
        [id]
    );
    
    if (!product) {
        return ResponseFormatter.notFound(res, 'Product not found');
    }
    
    ResponseFormatter.success(res, product, 'Product retrieved successfully');
}));

// Create new product (admin only)
router.post('/', authenticate, requireAdmin, validateProduct, asyncHandler(async (req, res) => {
    const { 
        name, description, cost_price, selling_price, quantity = 0, 
        brand, model, color, image_path 
    } = req.body;
    
    try {
        const result = await dbManager.run(
            `INSERT INTO products (name, description, cost_price, selling_price, quantity, brand, model, color, image_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, cost_price, selling_price, quantity, brand, model, color, image_path]
        );
        
        const newProduct = await dbManager.get(
            'SELECT * FROM products WHERE id = ?', 
            [result.lastID]
        );
        
        ResponseFormatter.created(res, newProduct, 'Product created successfully');
        
    } catch (error) {
        logger.error('Error creating product:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Product already exists');
        }
        ResponseFormatter.serverError(res, 'Failed to create product');
    }
}));

// Update product (admin only)
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        name, description, cost_price, selling_price, quantity, 
        brand, model, color, image_path 
    } = req.body;
    
    try {
        // Build dynamic update query
        const updateFields = [];
        const updateParams = [];
        
        if (name !== undefined) {
            updateFields.push('name = ?');
            updateParams.push(name);
        }
        
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateParams.push(description);
        }
        
        if (cost_price !== undefined) {
            updateFields.push('cost_price = ?');
            updateParams.push(cost_price);
        }
        
        if (selling_price !== undefined) {
            updateFields.push('selling_price = ?');
            updateParams.push(selling_price);
        }
        
        if (quantity !== undefined) {
            updateFields.push('quantity = ?');
            updateParams.push(quantity);
        }
        
        if (brand !== undefined) {
            updateFields.push('brand = ?');
            updateParams.push(brand);
        }
        
        if (model !== undefined) {
            updateFields.push('model = ?');
            updateParams.push(model);
        }
        
        if (color !== undefined) {
            updateFields.push('color = ?');
            updateParams.push(color);
        }
        
        if (image_path !== undefined) {
            updateFields.push('image_path = ?');
            updateParams.push(image_path);
        }
        
        if (updateFields.length === 0) {
            return ResponseFormatter.error(res, 'No fields to update', 'Validation Error', 400);
        }
        
        updateFields.push('updated_date = CURRENT_TIMESTAMP');
        updateParams.push(id);
        
        const updateQuery = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await dbManager.run(updateQuery, updateParams);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Product not found');
        }
        
        ResponseFormatter.success(res, null, 'Product updated successfully');
        
    } catch (error) {
        logger.error('Error updating product:', error);
        ResponseFormatter.serverError(res, 'Failed to update product');
    }
}));

// Delete product (admin only)
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if product exists
        const product = await dbManager.get('SELECT name FROM products WHERE id = ?', [id]);
        if (!product) {
            return ResponseFormatter.notFound(res, 'Product not found');
        }
        
        // Check if product has associated sales
        const salesCount = await dbManager.get('SELECT COUNT(*) as count FROM sales WHERE product_id = ?', [id]);
        if (salesCount.count > 0) {
            return ResponseFormatter.error(
                res, 
                'Cannot delete product with associated sales', 
                'Dependency Error', 
                409
            );
        }
        
        const result = await dbManager.run('DELETE FROM products WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Product not found');
        }
        
        ResponseFormatter.noContent(res, 'Product deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting product:', error);
        ResponseFormatter.serverError(res, 'Failed to delete product');
    }
}));

// Get low stock products
router.get('/reports/low-stock', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { threshold = 10 } = req.query;
    
    try {
        const lowStockProducts = await dbManager.all(
            `SELECT * FROM products 
             WHERE quantity <= ? 
             ORDER BY quantity ASC`,
            [threshold]
        );
        
        ResponseFormatter.success(res, lowStockProducts, 'Low stock products retrieved');
        
    } catch (error) {
        logger.error('Error fetching low stock products:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch low stock products');
    }
}));

// Update product quantity
router.patch('/:id/quantity', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity_change, reason } = req.body;
    
    if (!quantity_change || typeof quantity_change !== 'number') {
        return ResponseFormatter.error(res, 'Quantity change must be a number', 'Validation Error', 400);
    }
    
    try {
        const result = await dbManager.transaction(async (db) => {
            // Get current product
            const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
            if (!product) {
                throw new Error('Product not found');
            }
            
            const newQuantity = product.quantity + quantity_change;
            if (newQuantity < 0) {
                throw new Error('Insufficient stock');
            }
            
            // Update quantity
            const updateResult = await db.run(
                'UPDATE products SET quantity = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
                [newQuantity, id]
            );
            
            // Log inventory change
            await db.run(
                'INSERT INTO inventory_logs (product_id, previous_quantity, new_quantity, change_amount, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)',
                [id, product.quantity, newQuantity, quantity_change, reason || 'manual_adjustment', req.user.id]
            );
            
            return {
                product: { ...product, quantity: newQuantity },
                change: quantity_change,
                new_quantity: newQuantity
            };
        });
        
        ResponseFormatter.success(res, result, 'Product quantity updated successfully');
        
    } catch (error) {
        logger.error('Error updating product quantity:', error);
        if (error.message === 'Product not found') {
            return ResponseFormatter.notFound(res, error.message);
        }
        if (error.message === 'Insufficient stock') {
            return ResponseFormatter.error(res, error.message, 'Insufficient Stock', 400);
        }
        ResponseFormatter.serverError(res, 'Failed to update product quantity');
    }
}));

// Get phone models (cached)
router.get('/phone-models/all', asyncHandler(async (req, res) => {
    try {
        const models = await phoneModelsCache.getOrFetch('all_models', async () => {
            return await dbManager.all('SELECT * FROM phone_models ORDER BY brand, model');
        });
        
        ResponseFormatter.success(res, models, 'Phone models retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching phone models:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch phone models');
    }
}));

// Add new phone model (admin only)
router.post('/phone-models', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { brand, model } = req.body;
    
    if (!brand || !model) {
        return ResponseFormatter.error(res, 'Brand and model are required', 'Validation Error', 400);
    }
    
    try {
        const result = await dbManager.run(
            'INSERT INTO phone_models (brand, model) VALUES (?, ?)',
            [brand, model]
        );
        
        // Clear cache to refresh data
        phoneModelsCache.delete('all_models');
        
        ResponseFormatter.created(res, {
            id: result.lastID,
            brand,
            model
        }, 'Phone model added successfully');
        
    } catch (error) {
        logger.error('Error adding phone model:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Phone model already exists');
        }
        ResponseFormatter.serverError(res, 'Failed to add phone model');
    }
}));

// Delete phone model (admin only)
router.delete('/phone-models/:brand/:model', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { brand, model } = req.params;
    
    try {
        // Check if model is used by any products
        const productCount = await dbManager.get(
            'SELECT COUNT(*) as count FROM products WHERE brand = ? AND model = ?',
            [brand, model]
        );
        
        if (productCount.count > 0) {
            return ResponseFormatter.error(
                res,
                'Cannot delete phone model with associated products',
                'Dependency Error',
                409
            );
        }
        
        const result = await dbManager.run(
            'DELETE FROM phone_models WHERE brand = ? AND model = ?',
            [brand, model]
        );
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Phone model not found');
        }
        
        // Clear cache to refresh data
        phoneModelsCache.delete('all_models');
        
        ResponseFormatter.noContent(res, 'Phone model deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting phone model:', error);
        ResponseFormatter.serverError(res, 'Failed to delete phone model');
    }
}));

// Get colors (cached)
router.get('/colors/all', asyncHandler(async (req, res) => {
    try {
        const colors = await colorsCache.getOrFetch('all_colors', async () => {
            return await dbManager.all('SELECT * FROM colors ORDER BY name');
        });
        
        ResponseFormatter.success(res, colors, 'Colors retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching colors:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch colors');
    }
}));

// Add new color (admin only)
router.post('/colors', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { name, hex_code } = req.body;
    
    if (!name) {
        return ResponseFormatter.error(res, 'Color name is required', 'Validation Error', 400);
    }
    
    try {
        const result = await dbManager.run(
            'INSERT INTO colors (name, hex_code) VALUES (?, ?)',
            [name, hex_code || null]
        );
        
        // Clear cache to refresh data
        colorsCache.delete('all_colors');
        
        ResponseFormatter.created(res, {
            id: result.lastID,
            name,
            hex_code
        }, 'Color added successfully');
        
    } catch (error) {
        logger.error('Error adding color:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Color already exists');
        }
        ResponseFormatter.serverError(res, 'Failed to add color');
    }
}));

// Delete color (admin only)
router.delete('/colors/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if color is used by any products
        const productCount = await dbManager.get(
            'SELECT COUNT(*) as count FROM products WHERE color = ?',
            [id]
        );
        
        if (productCount.count > 0) {
            return ResponseFormatter.error(
                res,
                'Cannot delete color with associated products',
                'Dependency Error',
                409
            );
        }
        
        const result = await dbManager.run('DELETE FROM colors WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Color not found');
        }
        
        // Clear cache to refresh data
        colorsCache.delete('all_colors');
        
        ResponseFormatter.noContent(res, 'Color deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting color:', error);
        ResponseFormatter.serverError(res, 'Failed to delete color');
    }
}));

module.exports = router;
