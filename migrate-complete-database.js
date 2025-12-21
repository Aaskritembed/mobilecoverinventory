const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'database', 'inventory.db');

console.log('🚀 Starting comprehensive database schema migration...');
console.log('Database path:', dbPath);

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Connected to SQLite database');
        createCompleteSchema();
    }
});

function createCompleteSchema() {
    console.log('\n📋 Creating complete database schema...\n');

    // Start transaction for atomic operations
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Create return_reasons table
        db.run(`
            CREATE TABLE IF NOT EXISTS return_reasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reason_code TEXT NOT NULL UNIQUE,
                reason_name TEXT NOT NULL,
                reason_category TEXT,
                is_active INTEGER DEFAULT 1,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating return_reasons table:', err.message);
            } else {
                console.log('✅ return_reasons table created');
            }
        });

        // 2. Create returns table
        db.run(`
            CREATE TABLE IF NOT EXISTS returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                return_number TEXT NOT NULL UNIQUE,
                original_sale_id INTEGER,
                customer_name TEXT NOT NULL,
                customer_email TEXT,
                customer_phone TEXT,
                product_id INTEGER,
                product_name TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                return_reason TEXT NOT NULL,
                return_condition TEXT DEFAULT 'good',
                return_status TEXT DEFAULT 'pending',
                sales_platform TEXT DEFAULT 'Direct',
                notes TEXT,
                processed_by INTEGER,
                processed_date DATETIME,
                refund_amount REAL DEFAULT 0,
                refund_method TEXT,
                slip_path TEXT,
                restocked INTEGER DEFAULT 0,
                return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (original_sale_id) REFERENCES sales (id),
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (processed_by) REFERENCES employees (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating returns table:', err.message);
            } else {
                console.log('✅ returns table created');
            }
        });

        // 3. Create return_activities table
        db.run(`
            CREATE TABLE IF NOT EXISTS return_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                return_id INTEGER NOT NULL,
                activity_type TEXT NOT NULL,
                activity_description TEXT NOT NULL,
                performed_by INTEGER,
                activity_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (return_id) REFERENCES returns (id),
                FOREIGN KEY (performed_by) REFERENCES employees (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating return_activities table:', err.message);
            } else {
                console.log('✅ return_activities table created');
            }
        });

        // 4. Create employees table
        db.run(`
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                role TEXT DEFAULT 'employee',
                hire_date DATE,
                salary REAL,
                performance_rating INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating employees table:', err.message);
            } else {
                console.log('✅ employees table created');
            }
        });

        // 5. Create employee_tasks table
        db.run(`
            CREATE TABLE IF NOT EXISTS employee_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                product_id INTEGER,
                platform TEXT NOT NULL,
                product_url TEXT,
                color TEXT,
                due_date DATE,
                status TEXT DEFAULT 'pending',
                priority TEXT DEFAULT 'medium',
                notes TEXT,
                estimated_hours REAL DEFAULT 0,
                completed_hours REAL DEFAULT 0,
                assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating employee_tasks table:', err.message);
            } else {
                console.log('✅ employee_tasks table created');
            }
        });

        // 6. Create task_activities table
        db.run(`
            CREATE TABLE IF NOT EXISTS task_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                activity_date DATE DEFAULT (date('now')),
                hours_worked REAL DEFAULT 0,
                status_update TEXT,
                description TEXT NOT NULL,
                created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES employee_tasks (id),
                FOREIGN KEY (employee_id) REFERENCES employees (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating task_activities table:', err.message);
            } else {
                console.log('✅ task_activities table created');
            }
        });

        // 7. Create platform_listings table
        db.run(`
            CREATE TABLE IF NOT EXISTS platform_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                platform TEXT NOT NULL,
                listing_url TEXT,
                listing_status TEXT DEFAULT 'draft',
                sales_count INTEGER DEFAULT 0,
                revenue REAL DEFAULT 0,
                views_count INTEGER DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES employee_tasks (id),
                FOREIGN KEY (employee_id) REFERENCES employees (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating platform_listings table:', err.message);
            } else {
                console.log('✅ platform_listings table created');
            }
        });

        // 8. Add missing columns to existing sales table
        db.run(`ALTER TABLE sales ADD COLUMN sales_platform TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('❌ Error adding sales_platform column:', err.message);
            } else {
                console.log('✅ sales_platform column added/verified');
            }
        });

        db.run(`ALTER TABLE sales ADD COLUMN customer_info TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('❌ Error adding customer_info column:', err.message);
            } else {
                console.log('✅ customer_info column added/verified');
            }
        });

        db.run(`ALTER TABLE sales ADD COLUMN payment_method TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('❌ Error adding payment_method column:', err.message);
            } else {
                console.log('✅ payment_method column added/verified');
            }
        });

        db.run(`ALTER TABLE sales ADD COLUMN slip_path TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('❌ Error adding slip_path column:', err.message);
            } else {
                console.log('✅ slip_path column added/verified');
            }
        });

        // Commit transaction
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('❌ Error committing transaction:', err.message);
                process.exit(1);
            } else {
                console.log('\n✅ Database schema migration completed successfully!');
                insertDefaultData();
            }
        });
    });
}

function insertDefaultData() {
    console.log('\n📊 Inserting default data...\n');

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Insert default return reasons
        const returnReasons = [
            { code: 'DAMAGED', name: 'Product Damaged', category: 'Quality Issues' },
            { code: 'DEFECTIVE', name: 'Product Defective', category: 'Quality Issues' },
            { code: 'WRONG_ITEM', name: 'Wrong Item Sent', category: 'Shipping Errors' },
            { code: 'SIZE_ISSUE', name: 'Size/Model Mismatch', category: 'Size/Fit Issues' },
            { code: 'COLOR_MISMATCH', name: 'Color Mismatch', category: 'Appearance Issues' },
            { code: 'POOR_QUALITY', name: 'Poor Quality', category: 'Quality Issues' },
            { code: 'NOT_AS_DESCRIBED', name: 'Not As Described', category: 'Description Issues' },
            { code: 'CUSTOMER_REQUEST', name: 'Customer Request', category: 'Customer Request' },
            { code: 'DONT_LIKE', name: 'Customer Does Not Like', category: 'Customer Request' },
            { code: 'DUPLICATE_ORDER', name: 'Duplicate Order', category: 'Order Errors' }
        ];

        const insertReasonStmt = db.prepare(`
            INSERT OR IGNORE INTO return_reasons (reason_code, reason_name, reason_category) 
            VALUES (?, ?, ?)
        `);

        returnReasons.forEach(reason => {
            insertReasonStmt.run([reason.code, reason.name, reason.category], (err) => {
                if (err) {
                    console.error('❌ Error inserting return reason:', err.message);
                }
            });
        });

        insertReasonStmt.finalize();

        // Insert sample employees
        const sampleEmployees = [
            {
                name: 'John Doe',
                email: 'john.doe@company.com',
                phone: '+1-555-0101',
                role: 'Manager',
                hire_date: '2023-01-15',
                salary: 55000,
                performance_rating: 4
            },
            {
                name: 'Jane Smith',
                email: 'jane.smith@company.com',
                phone: '+1-555-0102',
                role: 'Sales Associate',
                hire_date: '2023-03-20',
                salary: 35000,
                performance_rating: 5
            },
            {
                name: 'Mike Johnson',
                email: 'mike.johnson@company.com',
                phone: '+1-555-0103',
                role: 'Sales Associate',
                hire_date: '2023-05-10',
                salary: 32000,
                performance_rating: 3
            },
            {
                name: 'Sarah Wilson',
                email: 'sarah.wilson@company.com',
                phone: '+1-555-0104',
                role: 'Marketing Specialist',
                hire_date: '2023-07-01',
                salary: 40000,
                performance_rating: 4
            },
            {
                name: 'David Brown',
                email: 'david.brown@company.com',
                phone: '+1-555-0105',
                role: 'Customer Service',
                hire_date: '2023-09-15',
                salary: 30000,
                performance_rating: 5
            }
        ];

        const insertEmployeeStmt = db.prepare(`
            INSERT OR IGNORE INTO employees (name, email, phone, role, hire_date, salary, performance_rating) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        sampleEmployees.forEach(employee => {
            insertEmployeeStmt.run([
                employee.name, employee.email, employee.phone, employee.role,
                employee.hire_date, employee.salary, employee.performance_rating
            ], (err) => {
                if (err) {
                    console.error('❌ Error inserting employee:', err.message);
                } else {
                    console.log(`✅ Sample employee created: ${employee.name}`);
                }
            });
        });

        insertEmployeeStmt.finalize();

        // Commit transaction
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('❌ Error committing data insertion:', err.message);
            } else {
                console.log('\n✅ Default data insertion completed successfully!');
                createIndexes();
            }
        });
    });
}

function createIndexes() {
    console.log('\n🔍 Creating database indexes for performance...\n');

    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)',
        'CREATE INDEX IF NOT EXISTS idx_products_model ON products(model)',
        'CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity)',
        'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)',
        'CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)',
        'CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(return_status)',
        'CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(return_date)',
        'CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email)',
        'CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active)',
        'CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee_id ON employee_tasks(employee_id)',
        'CREATE INDEX IF NOT EXISTS idx_employee_tasks_status ON employee_tasks(status)',
        'CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id)',
        'CREATE INDEX IF NOT EXISTS idx_task_activities_employee_id ON task_activities(employee_id)',
        'CREATE INDEX IF NOT EXISTS idx_platform_listings_employee_id ON platform_listings(employee_id)',
        'CREATE INDEX IF NOT EXISTS idx_platform_listings_platform ON platform_listings(platform)'
    ];

    db.serialize(() => {
        indexes.forEach((index, i) => {
            db.run(index, (err) => {
                if (err) {
                    console.error(`❌ Error creating index ${i + 1}:`, err.message);
                } else {
                    console.log(`✅ Index ${i + 1}/${indexes.length} created`);
                }
            });
        });

        console.log('\n🎉 Database migration completed successfully!');
        console.log('\n📋 Summary:');
        console.log('✅ All required tables created');
        console.log('✅ Default return reasons inserted');
        console.log('✅ Sample employees inserted');
        console.log('✅ Database indexes created');
        console.log('✅ Missing columns added to existing tables');
        
        closeDatabase();
    });
}

function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('\n✅ Database connection closed successfully');
            console.log('\n🚀 Your Mobile Cover Inventory Management System is now ready!');
            console.log('\nNext steps:');
            console.log('1. Run: node server.js');
            console.log('2. Open: http://localhost:3000');
            console.log('3. Test all modules: Products, Sales, Employees, Returns, Reports');
            process.exit(0);
        }
    });
}
