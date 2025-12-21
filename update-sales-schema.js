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
        console.log('Connected to SQLite database for sales table schema update');
        updateSalesTableSchema();
    }
});

function updateSalesTableSchema() {
    console.log('Updating sales table schema...');
    
    // Check current columns in sales table
    db.all("PRAGMA table_info(sales)", (err, columns) => {
        if (err) {
            console.error('Error checking sales table structure:', err.message);
            return;
        }
        
        console.log('Current sales table columns:', columns.map(c => c.name));
        
        const existingColumns = columns.map(c => c.name);
        
        // List of columns that should exist in the sales table
        const requiredColumns = [
            'id',
            'product_id',
            'quantity_sold',
            'sale_price',
            'total_amount',
            'sale_date',
            'sales_platform',  // NEW: Platform where sale was made
            'slip_path',       // NEW: Path to uploaded slip file
            'customer_info',   // NEW: Customer information (JSON string)
            'payment_method',  // NEW: Payment method used
            'created_date',
            'updated_date'
        ];
        
        // Find missing columns
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length === 0) {
            console.log('✅ Sales table schema is already up to date');
            closeDatabase();
            return;
        }
        
        console.log('Missing columns to add:', missingColumns);
        
        // Add missing columns
        let completed = 0;
        const totalColumns = missingColumns.length;
        
        missingColumns.forEach(column => {
            let columnDefinition = '';
            
            switch (column) {
                case 'id':
                    columnDefinition = 'INTEGER PRIMARY KEY AUTOINCREMENT';
                    break;
                case 'product_id':
                case 'quantity_sold':
                    columnDefinition = 'INTEGER NOT NULL';
                    break;
                case 'sale_price':
                case 'total_amount':
                    columnDefinition = 'REAL NOT NULL';
                    break;
                case 'sales_platform':
                    columnDefinition = 'TEXT DEFAULT "Direct"';
                    break;
                case 'slip_path':
                    columnDefinition = 'TEXT';
                    break;
                case 'customer_info':
                    columnDefinition = 'TEXT';
                    break;
                case 'payment_method':
                    columnDefinition = 'TEXT';
                    break;
                case 'sale_date':
                case 'created_date':
                case 'updated_date':
                    columnDefinition = 'DATETIME DEFAULT CURRENT_TIMESTAMP';
                    break;
                default:
                    columnDefinition = 'TEXT';
            }
            
            const sql = `ALTER TABLE sales ADD COLUMN ${column} ${columnDefinition}`;
            
            console.log(`Adding column ${column}...`);
            
            db.run(sql, (err) => {
                completed++;
                
                if (err) {
                    console.error(`Error adding column ${column}:`, err.message);
                } else {
                    console.log(`✅ Successfully added column: ${column}`);
                }
                
                if (completed === totalColumns) {
                    console.log('\n✅ Sales table schema update completed!');
                    closeDatabase();
                }
            });
        });
    });
}

function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed successfully');
            console.log('\nSales table schema is now ready for platform and slip upload functionality!');
            process.exit(0);
        }
    });
}

// Handle process termination
process.on('SIGINT', () => {
    closeDatabase();
});
