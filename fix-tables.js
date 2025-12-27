const sqlite3 = require('sqlite3').verbose();

// Connect to database
const db = new sqlite3.Database('./database/inventory.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database');
        createMissingTables();
    }
});

function createMissingTables() {
    console.log('\n🔧 Creating missing database tables...\n');

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Create products table if missing
        db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT,
                brand TEXT,
                model TEXT,
                color TEXT,
                cost_price REAL DEFAULT 0,
                selling_price REAL DEFAULT 0,
                quantity INTEGER DEFAULT 0,
                description TEXT,
                image_path TEXT,
                is_active INTEGER DEFAULT 1,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating products table:', err.message);
            } else {
                console.log('✅ products table created/verified');
            }
        });

        // 2. Create sales table if missing
        db.run(`
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER,
                quantity_sold INTEGER NOT NULL,
                sale_price REAL NOT NULL,
                total_amount REAL NOT NULL,
                sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                sales_platform TEXT DEFAULT 'Direct',
                customer_info TEXT,
                payment_method TEXT,
                slip_path TEXT,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating sales table:', err.message);
            } else {
                console.log('✅ sales table created/verified');
            }
        });

        // 3. Create inventory_logs table if missing
        db.run(`
            CREATE TABLE IF NOT EXISTS inventory_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                previous_quantity INTEGER NOT NULL,
                new_quantity INTEGER NOT NULL,
                change_amount INTEGER NOT NULL,
                reason TEXT,
                user_id INTEGER,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Error creating inventory_logs table:', err.message);
            } else {
                console.log('✅ inventory_logs table created/verified');
            }
        });

        // 4. Insert sample products if products table is empty
        db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
            if (err) {
                console.error('❌ Error checking products table:', err.message);
            } else if (row.count === 0) {
                console.log('📦 Inserting sample products...');
                
                const sampleProducts = [
                    {
                        name: 'iPhone 15 Pro Max Case - Black',
                        category: 'iPhone',
                        brand: 'Apple',
                        model: 'iPhone 15 Pro Max',
                        color: 'Black',
                        cost_price: 15.00,
                        selling_price: 29.99,
                        quantity: 50,
                        description: 'Premium leather case for iPhone 15 Pro Max'
                    },
                    {
                        name: 'Samsung Galaxy S24 Ultra Case - Blue',
                        category: 'Samsung',
                        brand: 'Samsung',
                        model: 'Galaxy S24 Ultra',
                        color: 'Blue',
                        cost_price: 12.00,
                        selling_price: 24.99,
                        quantity: 35,
                        description: 'Durable case with card holder for Galaxy S24 Ultra'
                    },
                    {
                        name: 'iPhone 15 Pro Case - White',
                        category: 'iPhone',
                        brand: 'Apple',
                        model: 'iPhone 15 Pro',
                        color: 'White',
                        cost_price: 14.00,
                        selling_price: 27.99,
                        quantity: 40,
                        description: 'Clear case with MagSafe for iPhone 15 Pro'
                    },
                    {
                        name: 'Samsung Galaxy S24 Case - Black',
                        category: 'Samsung',
                        brand: 'Samsung',
                        model: 'Galaxy S24',
                        color: 'Black',
                        cost_price: 10.00,
                        selling_price: 19.99,
                        quantity: 45,
                        description: 'Slim case with protection for Galaxy S24'
                    },
                    {
                        name: 'iPhone 15 Case - Red',
                        category: 'iPhone',
                        brand: 'Apple',
                        model: 'iPhone 15',
                        color: 'Red',
                        cost_price: 13.00,
                        selling_price: 26.99,
                        quantity: 30,
                        description: 'Colorful case for iPhone 15'
                    }
                ];

                const insertProduct = db.prepare(`
                    INSERT INTO products (name, category, brand, model, color, cost_price, selling_price, quantity, description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                sampleProducts.forEach(product => {
                    insertProduct.run([
                        product.name, product.category, product.brand, product.model,
                        product.color, product.cost_price, product.selling_price,
                        product.quantity, product.description
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error inserting sample product:', err.message);
                        }
                    });
                });

                insertProduct.finalize(() => {
                    console.log('✅ Sample products inserted');
                });
            } else {
                console.log(`✅ Products table already contains ${row.count} products`);
            }
        });

        // 5. Insert sample sales if sales table is empty
        db.get('SELECT COUNT(*) as count FROM sales', (err, row) => {
            if (err) {
                console.error('❌ Error checking sales table:', err.message);
            } else if (row.count === 0) {
                console.log('📈 Inserting sample sales...');
                
                const sampleSales = [
                    {
                        product_id: 1,
                        quantity_sold: 2,
                        sale_price: 29.99,
                        sales_platform: 'Online Store',
                        customer_info: 'john.doe@email.com',
                        payment_method: 'Credit Card'
                    },
                    {
                        product_id: 2,
                        quantity_sold: 1,
                        sale_price: 24.99,
                        sales_platform: 'Amazon',
                        customer_info: 'jane.smith@email.com',
                        payment_method: 'PayPal'
                    },
                    {
                        product_id: 3,
                        quantity_sold: 3,
                        sale_price: 27.99,
                        sales_platform: 'Direct Sale',
                        customer_info: 'mike.johnson@email.com',
                        payment_method: 'Cash'
                    }
                ];

                const insertSale = db.prepare(`
                    INSERT INTO sales (product_id, quantity_sold, sale_price, total_amount, sales_platform, customer_info, payment_method) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                sampleSales.forEach(sale => {
                    const total_amount = sale.quantity_sold * sale.sale_price;
                    insertSale.run([
                        sale.product_id, sale.quantity_sold, sale.sale_price,
                        total_amount, sale.sales_platform, sale.customer_info, sale.payment_method
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error inserting sample sale:', err.message);
                        }
                    });
                });

                insertSale.finalize(() => {
                    console.log('✅ Sample sales inserted');
                });
            } else {
                console.log(`✅ Sales table already contains ${row.count} sales`);
            }
        });

        // Commit transaction
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('❌ Error committing transaction:', err.message);
            } else {
                console.log('\n✅ Missing tables created successfully!');
                
                // Verify tables exist
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                    if (err) {
                        console.error('❌ Error listing tables:', err.message);
                    } else {
                        console.log('\n📋 Current database tables:');
                        tables.forEach(table => console.log(`   - ${table.name}`));
                    }
                    
                    // Close database
                    db.close((err) => {
                        if (err) {
                            console.error('❌ Error closing database:', err.message);
                        } else {
                            console.log('\n✅ Database connection closed');
                            console.log('\n🎉 Database setup completed successfully!');
                            console.log('\nNext steps:');
                            console.log('1. Run: node server.js');
                            console.log('2. Test: node quick-test.js');
                            console.log('3. Open: http://localhost:3000');
                        }
                        process.exit(0);
                    });
                });
            }
        });
    });
}

