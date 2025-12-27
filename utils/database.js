/**
 * Enhanced Database Utility with Promise-based Transaction Management
 * Provides clean, readable, and maintainable database operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor(dbPath = './database/inventory.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.initialize();
    }

    /**
     * Initialize database connection
     */
    initialize() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.setupPragmas();
            }
        });
    }

    /**
     * Setup database performance pragmas
     */
    setupPragmas() {
        this.db.run(`
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = 1000;
            PRAGMA temp_store = memory;
            PRAGMA mmap_size = 268435456;
        `);
    }

    /**
     * Promisify database run operation
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Promisify database get operation
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Promisify database all operation
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Execute transaction with automatic rollback on error
     * @param {Function} transactionFn - Function containing database operations
     * @returns {Promise} - Resolves with transaction result
     */
    async transaction(transactionFn) {
        try {
            // Start transaction
            await this.run('BEGIN TRANSACTION');
            
            // Execute transaction function
            const result = await transactionFn(this);
            
            // Commit transaction
            await this.run('COMMIT');
            
            return result;
        } catch (error) {
            // Rollback on error
            try {
                await this.run('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
            
            throw error;
        }
    }

    /**
     * Execute multiple operations in a single transaction
     * @param {Array} operations - Array of {sql, params} objects
     * @returns {Promise} - Resolves with array of results
     */
    async batchTransaction(operations) {
        return this.transaction(async (db) => {
            const results = [];
            for (const operation of operations) {
                const result = await db.run(operation.sql, operation.params || []);
                results.push(result);
            }
            return results;
        });
    }

    /**
     * Check if database is healthy
     */
    async healthCheck() {
        try {
            const result = await this.get('SELECT 1 as health');
            return result.health === 1;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        try {
            const dbStats = await this.all(`
                SELECT name, sql FROM sqlite_master 
                WHERE type = 'table' 
                ORDER BY name
            `);
            
            const counts = {};
            for (const table of dbStats) {
                const countResult = await this.get(`SELECT COUNT(*) as count FROM ${table.name}`);
                counts[table.name] = countResult.count;
            }

            return {
                tables: dbStats,
                counts,
                health: await this.healthCheck()
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Close database connection
     */
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }
}

/**
 * Transaction Manager for complex operations
 */
class TransactionManager {
    constructor(dbManager) {
        this.db = dbManager;
    }

    /**
     * Record a sale with inventory update
     */
    async recordSale(saleData) {
        const { product_id, quantity_sold, sale_price, sales_platform, customer_info, payment_method, slip_path } = saleData;
        
        const total_amount = quantity_sold * sale_price;

        return this.db.transaction(async (db) => {
            // Insert sale record
            const saleResult = await db.run(
                `INSERT INTO sales (product_id, quantity_sold, sale_price, total_amount, sales_platform, customer_info, payment_method, slip_path) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [product_id, quantity_sold, sale_price, total_amount, sales_platform, customer_info, payment_method, slip_path]
            );

            // Update product quantity
            const updateResult = await db.run(
                'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                [quantity_sold, product_id]
            );

            // Check if product needs restocking alert
            const product = await db.get('SELECT quantity, name FROM products WHERE id = ?', [product_id]);
            
            return {
                sale_id: saleResult.lastID,
                total_amount,
                remaining_stock: product.quantity,
                needs_restocking: product.quantity < 10
            };
        });
    }

    /**
     * Process return with automatic restocking
     */
    async processReturn(returnData) {
        const { 
            return_id, processed_by, refund_amount, refund_method, 
            restock_quantity = 0, product_id 
        } = returnData;

        return this.db.transaction(async (db) => {
            // Update return status
            const returnResult = await db.run(
                `UPDATE returns 
                 SET return_status = 'processed', processed_by = ?, processed_date = CURRENT_TIMESTAMP,
                     refund_amount = ?, refund_method = ?, restocked = 1, updated_date = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [processed_by, refund_amount, refund_method, return_id]
            );

            // Restock inventory if product exists
            let restockResult = null;
            if (product_id && restock_quantity > 0) {
                restockResult = await db.run(
                    'UPDATE products SET quantity = quantity + ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
                    [restock_quantity, product_id]
                );
            }

            // Log return activity
            await db.run(
                `INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by, notes) 
                 VALUES (?, ?, ?, ?, ?)`,
                [return_id, 'refunded', `Refund of $${refund_amount} processed via ${refund_method}`, processed_by, 'Return processed successfully']
            );

            return {
                return_updated: returnResult.changes > 0,
                restocked: restockResult ? restockResult.changes > 0 : false,
                new_quantity: product_id ? (await db.get('SELECT quantity FROM products WHERE id = ?', [product_id])).quantity : null
            };
        });
    }

    /**
     * Bulk inventory update for multiple products
     */
    async bulkInventoryUpdate(updates) {
        return this.db.transaction(async (db) => {
            const results = [];
            
            for (const update of updates) {
                const { product_id, quantity_change, reason } = update;
                
                // Get current quantity
                const currentProduct = await db.get('SELECT quantity, name FROM products WHERE id = ?', [product_id]);
                if (!currentProduct) {
                    throw new Error(`Product ${product_id} not found`);
                }

                // Update quantity
                const newQuantity = currentProduct.quantity + quantity_change;
                if (newQuantity < 0) {
                    throw new Error(`Insufficient stock for product ${currentProduct.name}`);
                }

                const updateResult = await db.run(
                    'UPDATE products SET quantity = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
                    [newQuantity, product_id]
                );

                // Log inventory change
                await db.run(
                    `INSERT INTO inventory_logs (product_id, previous_quantity, new_quantity, change_amount, reason, user_id) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [product_id, currentProduct.quantity, newQuantity, quantity_change, reason || 'manual_adjustment', null]
                );

                results.push({
                    product_id,
                    product_name: currentProduct.name,
                    previous_quantity: currentProduct.quantity,
                    new_quantity: newQuantity,
                    change: quantity_change
                });
            }

            return results;
        });
    }
}

// Create singleton instances
const dbManager = new DatabaseManager();
const transactionManager = new TransactionManager(dbManager);

// Export for use in other modules
module.exports = {
    dbManager,
    transactionManager,
    DatabaseManager,
    TransactionManager
};

// Export for server.js
if (typeof global !== 'undefined') {
    global.dbManager = dbManager;
    global.transactionManager = transactionManager;
}
