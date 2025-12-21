const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const db = new sqlite3.Database('./database/inventory.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database for migration');
        performMigration();
    }
});

function performMigration() {
    console.log('Starting database migration...');
    
    let migrationSteps = 0;
    let completedSteps = 0;
    
    function checkMigrationComplete() {
        if (completedSteps >= migrationSteps) {
            migrateData();
        }
    }
    
    // Check if colors table exists
    db.all("PRAGMA table_info(colors)", (err, columns) => {
        if (err) {
            console.error('Error checking colors table:', err.message);
        }
        
        if (!columns || columns.length === 0) {
            migrationSteps++;
            db.run(`
                CREATE TABLE IF NOT EXISTS colors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    hex_code TEXT,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating colors table:', err.message);
                } else {
                    console.log('✓ Created colors table for mobile cover colors');
                    insertDefaultColors();
                }
                completedSteps++;
                checkMigrationComplete();
            });
        } else {
            console.log('✓ colors table already exists');
            completedSteps++;
            checkMigrationComplete();
        }
    });
    
    // Check if phone_models table exists
    db.all("PRAGMA table_info(phone_models)", (err, columns) => {
        if (err) {
            console.error('Error checking phone_models table:', err.message);
        }
        
        if (!columns || columns.length === 0) {
            migrationSteps++;
            db.run(`
                CREATE TABLE IF NOT EXISTS phone_models (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    brand TEXT NOT NULL,
                    model TEXT NOT NULL,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(brand, model)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating phone_models table:', err.message);
                } else {
                    console.log('✓ Created phone_models table for custom models');
                }
                completedSteps++;
                checkMigrationComplete();
            });
        } else {
            console.log('✓ phone_models table already exists');
            completedSteps++;
            checkMigrationComplete();
        }
    });
    
    // First check current schema
    db.all("PRAGMA table_info(products)", (err, columns) => {
        if (err) {
            console.error('Error getting table info:', err.message);
            process.exit(1);
        }
        
        const hasBrand = columns.some(col => col.name === 'brand');
        const hasModel = columns.some(col => col.name === 'model');
        const hasColor = columns.some(col => col.name === 'color');
        
        // Add brand column if it doesn't exist
        if (!hasBrand) {
            migrationSteps++;
            db.run('ALTER TABLE products ADD COLUMN brand TEXT', (err) => {
                if (err) {
                    console.error('Error adding brand column:', err.message);
                } else {
                    console.log('✓ Added brand column');
                }
                completedSteps++;
                checkMigrationComplete();
            });
        } else {
            console.log('✓ brand column already exists');
            completedSteps++;
            checkMigrationComplete();
        }
        
        // Add model column if it doesn't exist
        if (!hasModel) {
            migrationSteps++;
            db.run('ALTER TABLE products ADD COLUMN model TEXT', (err) => {
                if (err) {
                    console.error('Error adding model column:', err.message);
                } else {
                    console.log('✓ Added model column');
                }
                completedSteps++;
                checkMigrationComplete();
            });
        } else {
            console.log('✓ model column already exists');
            completedSteps++;
            checkMigrationComplete();
        }
        
        // Add color column if it doesn't exist
        if (!hasColor) {
            migrationSteps++;
            db.run('ALTER TABLE products ADD COLUMN color TEXT', (err) => {
                if (err) {
                    console.error('Error adding color column:', err.message);
                } else {
                    console.log('✓ Added color column');
                }
                completedSteps++;
                checkMigrationComplete();
            });
        } else {
            console.log('✓ color column already exists');
            completedSteps++;
            checkMigrationComplete();
        }
        
        // If no columns needed to be added, check for completion
        if (hasBrand && hasModel && hasColor) {
            checkMigrationComplete();
        }
    });
    
    function insertDefaultColors() {
        const defaultColors = [
            { name: 'Black', hex_code: '#000000' },
            { name: 'White', hex_code: '#FFFFFF' },
            { name: 'Red', hex_code: '#FF0000' },
            { name: 'Blue', hex_code: '#0000FF' },
            { name: 'Green', hex_code: '#008000' },
            { name: 'Yellow', hex_code: '#FFFF00' },
            { name: 'Purple', hex_code: '#800080' },
            { name: 'Orange', hex_code: '#FFA500' },
            { name: 'Pink', hex_code: '#FFC0CB' },
            { name: 'Brown', hex_code: '#A52A2A' },
            { name: 'Gray', hex_code: '#808080' },
            { name: 'Silver', hex_code: '#C0C0C0' },
            { name: 'Gold', hex_code: '#FFD700' },
            { name: 'Clear', hex_code: '#F0F8FF' },
            { name: 'Transparent', hex_code: '#E6F3FF' }
        ];

        defaultColors.forEach(color => {
            db.run(
                'INSERT OR IGNORE INTO colors (name, hex_code) VALUES (?, ?)',
                [color.name, color.hex_code]
            );
        });

        console.log('✓ Default colors inserted');
    }
    
    function migrateData() {
        // Migrate existing category data to brand field
        db.run(`
            UPDATE products 
            SET brand = CASE 
                WHEN category = 'iPhone' THEN 'Apple'
                ELSE category
            END
            WHERE (brand IS NULL OR brand = '') AND category IS NOT NULL
        `, (err) => {
            if (err) {
                console.error('Error migrating category to brand:', err.message);
            } else {
                console.log('✓ Migrated category data to brand field');
            }
            
            // Show migration results
            db.all('SELECT id, name, category, brand, model FROM products LIMIT 10', (err, rows) => {
                if (err) {
                    console.error('Error checking migration results:', err.message);
                } else {
                    console.log('\nMigration Results:');
                    console.log('ID | Name | Category | Brand | Model');
                    console.log('--|-----|----------|-------|-------');
                    rows.forEach(row => {
                        console.log(`${row.id} | ${row.name.substring(0, 20)}... | ${row.category || 'NULL'} | ${row.brand || 'NULL'} | ${row.model || 'NULL'}`);
                    });
                }
                
                // Check phone models
                db.all('SELECT COUNT(*) as count FROM phone_models', (err, rows) => {
                    if (err) {
                        console.error('Error checking phone_models table:', err.message);
                    } else {
                        console.log(`\n✓ phone_models table contains ${rows[0].count} custom models`);
                    }
                    
                    // Close database connection
                    db.close((err) => {
                        if (err) {
                            console.error('Error closing database:', err.message);
                        } else {
                            console.log('\n✓ Database connection closed');
                            console.log('Migration completed successfully!');
                            console.log('\nFeatures available:');
                            console.log('- Comprehensive phone model database (1000+ models)');
                            console.log('- Add custom phone models through UI');
                            console.log('- Enhanced brand/model filtering and search');
                            console.log('- Persistent storage for custom models');
                        }
                        process.exit(0);
                    });
                });
            });
        });
    }
}
