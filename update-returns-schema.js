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
        console.log('Connected to SQLite database for returns table schema update');
        updateReturnsTableSchema();
    }
});

function updateReturnsTableSchema() {
    console.log('Updating returns table schema...');
    
    // Check current columns in returns table
    db.all("PRAGMA table_info(returns)", (err, columns) => {
        if (err) {
            console.error('Error checking returns table structure:', err.message);
            return;
        }
        
        console.log('Current returns table columns:', columns.map(c => c.name));
        
        const existingColumns = columns.map(c => c.name);
        
        // List of columns that should exist in the returns table
        const requiredColumns = [
            'id',
            'return_number',
            'original_sale_id', 
            'customer_name',
            'customer_email',
            'customer_phone',
            'product_id',
            'product_name',
            'quantity',
            'return_reason',
            'return_condition',
            'return_date',
            'return_status',
            'refund_amount',
            'refund_method',
            'sales_platform',
            'notes',
            'processed_by',
            'processed_date',
            'restocked',
            'slip_path',
            'created_date',
            'updated_date'
        ];
        
        // Find missing columns
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length === 0) {
            console.log('✅ Returns table schema is already up to date');
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
                case 'return_number':
                case 'customer_name':
                case 'return_reason':
                    columnDefinition = 'TEXT NOT NULL';
                    break;
                case 'customer_email':
                case 'customer_phone':
                case 'product_name':
                case 'refund_method':
                case 'sales_platform':
                case 'notes':
                    columnDefinition = 'TEXT';
                    break;
                case 'original_sale_id':
                case 'product_id':
                case 'processed_by':
                    columnDefinition = 'INTEGER';
                    break;
                case 'quantity':
                    columnDefinition = 'INTEGER NOT NULL';
                    break;
                case 'refund_amount':
                    columnDefinition = 'REAL';
                    break;
                case 'return_condition':
                    columnDefinition = 'TEXT DEFAULT "good"';
                    break;
                case 'return_status':
                    columnDefinition = 'TEXT DEFAULT "pending"';
                    break;
                case 'return_date':
                case 'processed_date':
                case 'created_date':
                case 'updated_date':
                    columnDefinition = 'DATETIME DEFAULT CURRENT_TIMESTAMP';
                    break;
                case 'restocked':
                    columnDefinition = 'BOOLEAN DEFAULT 0';
                    break;
                case 'slip_path':
                    columnDefinition = 'TEXT';
                    break;
                default:
                    columnDefinition = 'TEXT';
            }
            
            // Special handling for return_number uniqueness
            if (column === 'return_number') {
                columnDefinition += ' UNIQUE';
            }
            
            const sql = `ALTER TABLE returns ADD COLUMN ${column} ${columnDefinition}`;
            
            console.log(`Adding column ${column}...`);
            
            db.run(sql, (err) => {
                completed++;
                
                if (err) {
                    console.error(`Error adding column ${column}:`, err.message);
                } else {
                    console.log(`✅ Successfully added column: ${column}`);
                }
                
                if (completed === totalColumns) {
                    console.log('\n✅ Returns table schema update completed!');
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
            console.log('\nReturns table schema is now ready for slip_path functionality!');
            process.exit(0);
        }
    });
}

// Handle process termination
process.on('SIGINT', () => {
    closeDatabase();
});
