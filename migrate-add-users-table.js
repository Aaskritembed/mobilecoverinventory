const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'database.db');

// Create database connection
const db = new sqlite3.Database(dbPath);

console.log('Starting migration to add users table...');

// Create users table
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        is_active INTEGER DEFAULT 1,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME
    )
`, (err) => {
    if (err) {
        console.error('Error creating users table:', err.message);
        return;
    }
    
    console.log('Users table created successfully');
    
    // Check if admin user already exists
    db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
        if (err) {
            console.error('Error checking users table:', err.message);
            return;
        }
        
        if (row.count === 0) {
            console.log('Creating default admin user...');
            
            try {
                // Hash the default admin password
                const adminPassword = await bcrypt.hash('Admin123!', 12);
                
                // Insert default admin user
                db.run(
                    'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
                    ['admin@ecom.com', adminPassword, 'Admin', 'User', 'admin'],
                    function(err) {
                        if (err) {
                            console.error('Error creating default admin:', err.message);
                        } else {
                            console.log('Default admin user created successfully!');
                            console.log('Login credentials:');
                            console.log('  Email: admin@ecom.com');
                            console.log('  Password: Admin123!');
                        }
                        
                        // Also create a demo user
                        createDemoUser();
                    }
                );
            } catch (error) {
                console.error('Error hashing password:', error);
            }
        } else {
            console.log(`Users table already has ${row.count} users`);
        }
    });
});

function createDemoUser() {
    const demoPassword = bcrypt.hash('User123!', 12)
        .then(passwordHash => {
            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
                    ['user@ecom.com', passwordHash, 'Demo', 'User', 'user'],
                    function(err) {
                        if (err) {
                            console.error('Error creating demo user:', err.message);
                        } else {
                            console.log('Demo user created successfully!');
                            console.log('Login credentials:');
                            console.log('  Email: user@ecom.com');
                            console.log('  Password: User123!');
                        }
                        
                        // Close database connection
                        db.close((err) => {
                            if (err) {
                                console.error('Error closing database:', err.message);
                            } else {
                                console.log('Database connection closed');
                                console.log('Migration completed successfully!');
                            }
                        });
                    }
                );
            });
        })
        .catch(error => {
            console.error('Error creating demo user:', error);
        });
}

// Handle database errors
db.on('error', (err) => {
    console.error('Database error:', err.message);
});
