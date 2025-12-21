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
        console.log('Connected to SQLite database for employee tracker migration');
        createEmployeeTrackerTables();
    }
});

function createEmployeeTrackerTables() {
    console.log('Creating employee tracker tables...');
    
    // Create employees table
    db.run(`
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            role TEXT DEFAULT 'employee',
            hire_date DATE,
            salary REAL,
            performance_rating REAL DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating employees table:', err.message);
        } else {
            console.log('✓ Employees table created');
        }
    });

    // Create employee_tasks table
    db.run(`
        CREATE TABLE IF NOT EXISTS employee_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            product_id INTEGER,
            platform TEXT NOT NULL,
            product_url TEXT,
            color TEXT,
            assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            due_date DATE,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'medium',
            notes TEXT,
            estimated_hours REAL DEFAULT 0,
            completed_hours REAL DEFAULT 0,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating employee_tasks table:', err.message);
        } else {
            console.log('✓ Employee tasks table created');
        }
    });

    // Create task_activities table
    db.run(`
        CREATE TABLE IF NOT EXISTS task_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            employee_id INTEGER,
            activity_date DATE,
            hours_worked REAL DEFAULT 0,
            status_update TEXT,
            description TEXT,
            created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES employee_tasks (id),
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating task_activities table:', err.message);
        } else {
            console.log('✓ Task activities table created');
        }
    });

    // Create platform_listings table
    db.run(`
        CREATE TABLE IF NOT EXISTS platform_listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            employee_id INTEGER,
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
            console.error('Error creating platform_listings table:', err.message);
        } else {
            console.log('✓ Platform listings table created');
        }
    });

    // Insert sample data for testing
    setTimeout(() => {
        insertSampleData();
    }, 1000);
}

function insertSampleData() {
    console.log('Inserting sample employee data...');
    
    // Insert sample employees
    const sampleEmployees = [
        {
            name: 'John Smith',
            email: 'john.smith@company.com',
            phone: '+1-555-0101',
            role: 'senior_employee',
            hire_date: '2023-01-15',
            salary: 45000,
            performance_rating: 4.2
        },
        {
            name: 'Sarah Johnson',
            email: 'sarah.johnson@company.com',
            phone: '+1-555-0102',
            role: 'employee',
            hire_date: '2023-03-20',
            salary: 35000,
            performance_rating: 3.8
        },
        {
            name: 'Mike Wilson',
            email: 'mike.wilson@company.com',
            phone: '+1-555-0103',
            role: 'employee',
            hire_date: '2023-05-10',
            salary: 32000,
            performance_rating: 4.0
        },
        {
            name: 'Emily Davis',
            email: 'emily.davis@company.com',
            phone: '+1-555-0104',
            role: 'team_lead',
            hire_date: '2022-11-01',
            salary: 55000,
            performance_rating: 4.5
        }
    ];

    sampleEmployees.forEach(employee => {
        db.run(`
            INSERT OR IGNORE INTO employees (name, email, phone, role, hire_date, salary, performance_rating) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [employee.name, employee.email, employee.phone, employee.role, employee.hire_date, employee.salary, employee.performance_rating], (err) => {
            if (err) {
                console.error('Error inserting sample employee:', err.message);
            } else {
                console.log(`✓ Sample employee created: ${employee.name}`);
            }
        });
    });

    // Insert sample tasks after employees are created
    setTimeout(() => {
        insertSampleTasks();
    }, 2000);
}

function insertSampleTasks() {
    console.log('Inserting sample tasks...');
    
    // Get employee IDs first
    db.all('SELECT id, name FROM employees', (err, employees) => {
        if (err) {
            console.error('Error fetching employees for sample tasks:', err.message);
            return;
        }

        // Get product IDs
        db.all('SELECT id, name FROM products LIMIT 5', (err, products) => {
            if (err) {
                console.error('Error fetching products for sample tasks:', err.message);
                return;
            }

            if (employees.length === 0 || products.length === 0) {
                console.log('No employees or products found for sample tasks');
                closeDatabase();
                return;
            }

            const sampleTasks = [
                {
                    employee_id: employees[0].id,
                    product_id: products[0].id,
                    platform: 'amazon',
                    product_url: 'https://amazon.com/example-product-1',
                    color: 'Black',
                    due_date: '2024-01-25',
                    status: 'in_progress',
                    priority: 'high',
                    notes: 'Create compelling product listing with high-quality images',
                    estimated_hours: 4
                },
                {
                    employee_id: employees[1].id,
                    product_id: products[1].id,
                    platform: 'flipkart',
                    product_url: 'https://flipkart.com/example-product-2',
                    color: 'Blue',
                    due_date: '2024-01-28',
                    status: 'pending',
                    priority: 'medium',
                    notes: 'Optimize for mobile viewers',
                    estimated_hours: 3
                },
                {
                    employee_id: employees[2].id,
                    product_id: products[2].id,
                    platform: 'meesho',
                    product_url: 'https://meesho.com/example-product-3',
                    color: 'Red',
                    due_date: '2024-01-30',
                    status: 'completed',
                    priority: 'low',
                    notes: 'Listing completed successfully',
                    estimated_hours: 2,
                    completed_hours: 2.5
                },
                {
                    employee_id: employees[3].id,
                    product_id: products[3].id,
                    platform: 'amazon',
                    product_url: 'https://amazon.com/example-product-4',
                    color: 'Clear',
                    due_date: '2024-02-01',
                    status: 'in_progress',
                    priority: 'high',
                    notes: 'Focus on competitive pricing',
                    estimated_hours: 5
                }
            ];

            sampleTasks.forEach(task => {
                db.run(`
                    INSERT INTO employee_tasks (employee_id, product_id, platform, product_url, color, due_date, status, priority, notes, estimated_hours, completed_hours) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [task.employee_id, task.product_id, task.platform, task.product_url, task.color, task.due_date, task.status, task.priority, task.notes, task.estimated_hours, task.completed_hours || 0], (err) => {
                    if (err) {
                        console.error('Error inserting sample task:', err.message);
                    } else {
                        console.log(`✓ Sample task created: ${task.platform} listing`);
                    }
                });
            });

            setTimeout(() => {
                insertSampleActivities(employees, sampleTasks);
            }, 1500);
        });
    });
}

function insertSampleActivities(employees, tasks) {
    console.log('Inserting sample activities...');
    
    // Insert sample activities for recent days
    const today = new Date();
    const sampleActivities = [];

    // Create activities for the last 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        employees.forEach((employee, empIndex) => {
            if (Math.random() > 0.4) { // 60% chance employee worked each day
                const hoursWorked = Math.random() * 6 + 2; // 2-8 hours
                const activities = [
                    'Updated product listings with new images',
                    'Optimized product descriptions for SEO',
                    'Responded to customer queries',
                    'Updated pricing and availability',
                    'Created promotional content',
                    'Reviewed competitor listings',
                    'Enhanced product titles and keywords'
                ];

                const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                const randomStatus = ['in_progress', 'completed', 'review'][Math.floor(Math.random() * 3)];

                sampleActivities.push({
                    task_id: tasks[empIndex]?.id || 1,
                    employee_id: employee.id,
                    activity_date: dateStr,
                    hours_worked: Math.round(hoursWorked * 100) / 100,
                    status_update: randomStatus,
                    description: randomActivity
                });
            }
        });
    }

    sampleActivities.forEach(activity => {
        db.run(`
            INSERT INTO task_activities (task_id, employee_id, activity_date, hours_worked, status_update, description) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [activity.task_id, activity.employee_id, activity.activity_date, activity.hours_worked, activity.status_update, activity.description], (err) => {
            if (err) {
                console.error('Error inserting sample activity:', err.message);
            }
        });
    });

    setTimeout(() => {
        insertSampleListings(employees, tasks);
    }, 1000);
}

function insertSampleListings(employees, tasks) {
    console.log('Inserting sample platform listings...');
    
    const sampleListings = [
        {
            task_id: tasks[0].id,
            employee_id: employees[0].id,
            platform: 'amazon',
            listing_url: 'https://amazon.com/dp/B123456789',
            listing_status: 'published',
            sales_count: 25,
            revenue: 1250.00,
            views_count: 1250
        },
        {
            task_id: tasks[1].id,
            employee_id: employees[1].id,
            platform: 'flipkart',
            listing_url: 'https://flipkart.com/p/abcd1234',
            listing_status: 'pending_approval',
            sales_count: 0,
            revenue: 0,
            views_count: 45
        },
        {
            task_id: tasks[2].id,
            employee_id: employees[2].id,
            platform: 'meesho',
            listing_url: 'https://meesho.com/s/pqrs5678',
            listing_status: 'published',
            sales_count: 15,
            revenue: 675.00,
            views_count: 890
        },
        {
            task_id: tasks[3].id,
            employee_id: employees[3].id,
            platform: 'amazon',
            listing_url: 'https://amazon.com/dp/B987654321',
            listing_status: 'draft',
            sales_count: 0,
            revenue: 0,
            views_count: 12
        }
    ];

    sampleListings.forEach(listing => {
        db.run(`
            INSERT INTO platform_listings (task_id, employee_id, platform, listing_url, listing_status, sales_count, revenue, views_count) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [listing.task_id, listing.employee_id, listing.platform, listing.listing_url, listing.listing_status, listing.sales_count, listing.revenue, listing.views_count], (err) => {
            if (err) {
                console.error('Error inserting sample listing:', err.message);
            }
        });
    });

    setTimeout(() => {
        console.log('✓ Employee tracker migration completed successfully!');
        closeDatabase();
    }, 1000);
}

function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed successfully');
            process.exit(0);
        }
    });
}

// Handle process termination
process.on('SIGINT', () => {
    closeDatabase();
});
