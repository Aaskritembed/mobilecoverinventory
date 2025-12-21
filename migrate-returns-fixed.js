
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'database', 'inventory.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database for returns management migration');
        createReturnsTables();
    }
});

function createReturnsTables() {
    console.log('Creating returns management tables...');
    
    // Create return_reasons table
    db.run(`
        CREATE TABLE IF NOT EXISTS return_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reason_code TEXT UNIQUE NOT NULL,
            reason_name TEXT NOT NULL,
            reason_category TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating return_reasons table:', err.message);
        } else {
            console.log('✓ Return reasons table created');
        }
    });

    // Create returns table
    db.run(`
        CREATE TABLE IF NOT EXISTS returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT UNIQUE NOT NULL,
            original_sale_id INTEGER,
            customer_name TEXT NOT NULL,
            customer_email TEXT,
            customer_phone TEXT,
            product_id INTEGER,
            product_name TEXT,
            quantity INTEGER NOT NULL,
            return_reason TEXT NOT NULL,
            return_condition TEXT DEFAULT 'good',
            return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            return_status TEXT DEFAULT 'pending',
            refund_amount REAL,
            refund_method TEXT,
            sales_platform TEXT DEFAULT 'Direct',
            notes TEXT,
            processed_by INTEGER,
            processed_date DATETIME,
            restocked BOOLEAN DEFAULT 0,
            slip_path TEXT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_sale_id) REFERENCES sales (id),
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (processed_by) REFERENCES employees (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating returns table:', err.message);
        } else {
            console.log('✓ Returns table created');
        }
    });

    // Create return_activities table
    db.run(`
        CREATE TABLE IF NOT EXISTS return_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER,
            activity_type TEXT NOT NULL,
            activity_description TEXT NOT NULL,
            activity_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            performed_by INTEGER,
            notes TEXT,
            FOREIGN KEY (return_id) REFERENCES returns (id),
            FOREIGN KEY (performed_by) REFERENCES employees (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating return_activities table:', err.message);
        } else {
            console.log('✓ Return activities table created');
        }
    });

    // Insert sample data for testing
    setTimeout(() => {
        insertReturnReasons();
    }, 1000);
}

function insertReturnReasons() {
    console.log('Inserting return reasons...');
    
    const returnReasons = [
        { reason_code: 'QUAL_DEF', reason_name: 'Quality Defect', reason_category: 'quality' },
        { reason_code: 'WRONG_ITEM', reason_name: 'Wrong Item Received', reason_category: 'wrong_item' },
        { reason_code: 'DAMAGED', reason_name: 'Item Damaged in Transit', reason_category: 'damaged' },
        { reason_code: 'SIZE_FIT', reason_name: 'Size/Fit Issues', reason_category: 'quality' },
        { reason_code: 'COLOR_MISMATCH', reason_name: 'Color Mismatch', reason_category: 'quality' },
        { reason_code: 'CUSTOMER_CHANGE', reason_name: 'Customer Changed Mind', reason_category: 'customer_change' },
        { reason_code: 'NOT_AS_DESCRIBED', reason_name: 'Not as Described', reason_category: 'quality' },
        { reason_code: 'DUPLICATE_ORDER', reason_name: 'Duplicate Order', reason_category: 'customer_change' },
        { reason_code: 'LATE_DELIVERY', reason_name: 'Late Delivery', reason_category: 'service' },
        { reason_code: 'OTHER', reason_name: 'Other', reason_category: 'other' }
    ];

    returnReasons.forEach(reason => {
        db.run(`
            INSERT OR IGNORE INTO return_reasons (reason_code, reason_name, reason_category) 
            VALUES (?, ?, ?)
        `, [reason.reason_code, reason.reason_name, reason.reason_category], (err) => {
            if (err) {
                console.error('Error inserting return reason:', err.message);
            } else {
                console.log(`✓ Return reason created: ${reason.reason_name}`);
            }
        });
    });

    setTimeout(() => {
        insertSampleReturns();
    }, 1500);
}

function insertSampleReturns() {
    console.log('Inserting sample returns...');
    
    // Get sample sales and products
    db.all('SELECT id, product_id, quantity_sold, sale_price, total_amount FROM sales LIMIT 5', (err, sales) => {
        if (err) {
            console.error('Error fetching sales for sample returns:', err.message);
            return;
        }

        db.all('SELECT id, name FROM products LIMIT 5', (err, products) => {
            if (err) {
                console.error('Error fetching products for sample returns:', err.message);
                return;
            }

            if (sales.length === 0 || products.length === 0) {
                console.log('No sales or products found for sample returns');
                return;
            }

            const sampleReturns = [
                {
                    return_number: 'RET-2024-001',
                    original_sale_id: sales[0]?.id,
                    customer_name: 'Alice Johnson',
                    customer_email: 'alice.johnson@email.com',
                    customer_phone: '+1-555-0201',
                    product_id: products[0]?.id,
                    product_name: products[0]?.name,
                    quantity: 1,
                    return_reason: 'Quality Defect',
                    return_condition: 'damaged',
                    return_status: 'approved',
                    refund_amount: 29.99,
                    refund_method: 'original_payment',
                    sales_platform: 'Amazon',
                    notes: 'Case had manufacturing defect - crack in corner',
                    processed_by: 1,
                    processed_date: '2024-01-20 10:30:00',
                    restocked: 0
                },
                {
                    return_number: 'RET-2024-002',
                    original_sale_id: sales[1]?.id,
                    customer_name: 'Bob Smith',
                    customer_email: 'bob.smith@email.com',
                    customer_phone: '+1-555-0202',
                    product_id: products[1]?.id,
                    product_name: products[1]?.name,
                    quantity: 1,
                    return_reason: 'Wrong Item Received',
                    return_condition: 'excellent',
                    return_status: 'processed',
                    refund_amount: 24.99,
                    refund_method: 'store_credit',
                    sales_platform: 'Flipkart',
                    notes: 'Customer received blue case instead of black',
                    processed_by: 2,
                    processed_date: '2024-01-19 14:15:00',
                    restocked: 1
                },
                {
                    return_number: 'RET-2024-003',
                    original_sale_id: sales[2]?.id,
                    customer_name: 'Carol Davis',
                    customer_email: 'carol.davis@email.com',
                    customer_phone: '+1-555-0203',
                    product_id: products[2]?.id,
                    product_name: products[2]?.name,
                    quantity: 2,
                    return_reason: 'Customer Changed Mind',
                    return_condition: 'good',
                    return_status: 'pending',
                    refund_amount: 69.98,
                    refund_method: 'original_payment',
                    sales_platform: 'Meesho',
                    notes: 'Customer decided to buy different style',
                    processed_by: null,
                    processed_date: null,
                    restocked: 0
                },
                {
                    return_number: 'RET-2024-004',
                    original_sale_id: sales[3]?.id,
                    customer_name: 'David Wilson',
                    customer_email: 'david.wilson@email.com',
                    customer_phone: '+1-555-0204',
                    product_id: products[3]?.id,
                    product_name: products[3]?.name,
                    quantity: 1,
                    return_reason: 'Item Damaged in Transit',
                    return_condition: 'damaged',
                    return_status: 'refunded',
                    refund_amount: 34.99,
                    refund_method: 'original_payment',
                    sales_platform: 'Amazon',
                    notes: 'Case arrived with significant scratch',
                    processed_by: 3,
                    processed_date: '2024-01-18 09:45:00',
                    restocked: 0
                },
                {
                    return_number: 'RET-2024-005',
                    original_sale_id: sales[4]?.id,
                    customer_name: 'Eva Brown',
                    customer_email: 'eva.brown@email.com',
                    customer_phone: '+1-555-0205',
                    product_id: products[4]?.id || products[0]?.id,
                    product_name: products[4]?.name || products[0]?.name,
                    quantity: 1,
                    return_reason: 'Size/Fit Issues',
                    return_condition: 'fair',
                    return_status: 'rejected',
                    refund_amount: 0,
                    refund_method: null,
                    sales_platform: 'Direct',
                    notes: 'Case does not fit properly - customer measurement error',
                    processed_by: 4,
                    processed_date: '2024-01-17 16:20:00',
                    restocked: 0
                }
            ];

            sampleReturns.forEach(returnItem => {
                db.run(`
                    INSERT INTO returns (
                        return_number, original_sale_id, customer_name, customer_email, customer_phone,
                        product_id, product_name, quantity, return_reason, return_condition,
                        return_status, refund_amount, refund_method, notes, processed_by, processed_date, restocked
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    returnItem.return_number, returnItem.original_sale_id, returnItem.customer_name,
                    returnItem.customer_email, returnItem.customer_phone, returnItem.product_id,
                    returnItem.product_name, returnItem.quantity, returnItem.return_reason,
                    returnItem.return_condition, returnItem.return_status, returnItem.refund_amount,
                    returnItem.refund_method, returnItem.notes, returnItem.processed_by,
                    returnItem.processed_date, returnItem.restocked
                ], (err) => {
                    if (err) {
                        console.error('Error inserting sample return:', err.message);
                    } else {
                        console.log(`✓ Sample return created: ${returnItem.return_number}`);
                    }
                });
            });

            setTimeout(() => {
                insertReturnActivities();
            }, 2000);
        });
    });
}

function insertReturnActivities() {
    console.log('Inserting sample return activities...');
    
    // Get the inserted returns to get their IDs
    db.all('SELECT id, return_number, processed_by FROM returns', (err, returns) => {
        if (err) {
            console.error('Error fetching returns for activities:', err.message);
            return;
        }

        const activities = [
            {
                return_id: returns[0]?.id,
                activity_type: 'status_updated',
                activity_description: 'Return approved - refund processed',
                performed_by: returns[0]?.processed_by,
                notes: 'Quality issue confirmed'
            },
            {
                return_id: returns[0]?.id,
                activity_type: 'refunded',
                activity_description: 'Refund of $29.99 processed to original payment method',
                performed_by: returns[0]?.processed_by,
                notes: 'Refund completed'
            },
            {
                return_id: returns[1]?.id,
                activity_type: 'status_updated',
                activity_description: 'Return processed - store credit issued',
                performed_by: returns[1]?.processed_by,
                notes: 'Customer accepted store credit'
            },
            {
                return_id: returns[1]?.id,
                activity_type: 'restocked',
                activity_description: 'Item restocked to inventory',
                performed_by: returns[1]?.processed_by,
                notes: 'Item in excellent condition'
            },
            {
                return_id: returns[2]?.id,
                activity_type: 'communication',
                activity_description: 'Customer contacted for return shipping instructions',
                performed_by: 2,
                notes: 'Awaiting return package'
            },
            {
                return_id: returns[3]?.id,
                activity_type: 'status_updated',
                activity_description: 'Return approved - damaged item',
                performed_by: returns[3]?.processed_by,
                notes: 'Shipping damage confirmed'
            },
            {
                return_id: returns[3]?.id,
                activity_type: 'refunded',
                activity_description: 'Refund of $34.99 processed to original payment method',
                performed_by: returns[3]?.processed_by,
                notes: 'Full refund approved'
            },
            {
                return_id: returns[4]?.id,
                activity_type: 'status_updated',
                activity_description: 'Return rejected - customer error',
                performed_by: returns[4]?.processed_by,
                notes: 'Item fits as specified'
            },
            {
                return_id: returns[4]?.id,
                activity_type: 'communication',
                activity_description: 'Customer notified of rejection with explanation',
                performed_by: returns[4]?.processed_by,
                notes: 'Customer understanding provided'
            }
        ];

        activities.forEach(activity => {
            db.run(`
                INSERT INTO return_activities (return_id, activity_type, activity_description, performed_by, notes) 
                VALUES (?, ?, ?, ?, ?)
            `, [activity.return_id, activity.activity_type, activity.activity_description, activity.performed_by, activity.notes], (err) => {
                if (err) {
                    console.error('Error inserting sample activity:', err.message);
                }
            });
        });

        setTimeout(() => {
            console.log('✓ Returns management migration completed successfully!');
            closeDatabase();
        }, 1000);
    });
}

function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed successfully');
            console.log('\nReturns Management System Ready!');
            console.log('Database tables created:');
            console.log('- return_reasons');
            console.log('- returns'); 
            console.log('- return_activities');
            console.log('\nSample data inserted:');
            console.log('- 10 return reasons');
            console.log('- 5 sample returns');
            console.log('- 9 return activities');
            process.exit(0);
        }
    });
}

// Handle process termination
process.on('SIGINT', () => {
    closeDatabase();
});

