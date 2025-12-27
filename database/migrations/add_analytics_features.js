/**
 * Database Migration: Add Analytics and Alert Features
 * Creates tables for low-stock alerts, demand predictions, seasonal trends, and scheduled reports
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AnalyticsMigration {
    constructor(dbPath = './database/inventory.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database for analytics migration');
                    resolve();
                }
            });
        });
    }

    async run() {
        await this.connect();
        
        try {
            await this.createLowStockAlertsTable();
            await this.createDemandPredictionsTable();
            await this.createSeasonalTrendsTable();
            await this.createScheduledReportsTable();
            await this.createEmailTemplatesTable();
            await this.createNotificationLogsTable();
            await this.createAnalyticsCacheTable();
            await this.insertDefaultEmailTemplates();
            
            console.log('Analytics migration completed successfully!');
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        } finally {
            await this.close();
        }
    }

    async createLowStockAlertsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS low_stock_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                current_quantity INTEGER NOT NULL,
                threshold_quantity INTEGER NOT NULL,
                alert_status TEXT DEFAULT 'active' CHECK (alert_status IN ('active', 'resolved', 'ignored')),
                alert_type TEXT DEFAULT 'low_stock' CHECK (alert_type IN ('low_stock', 'out_of_stock', 'critical')),
                priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_date DATETIME,
                resolved_by INTEGER,
                notes TEXT,
                auto_resolve BOOLEAN DEFAULT 0,
                notification_sent BOOLEAN DEFAULT 0,
                last_notification_date DATETIME,
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (resolved_by) REFERENCES users (id)
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created low_stock_alerts table');
                    resolve();
                }
            });
        });
    }

    async createDemandPredictionsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS demand_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                prediction_type TEXT DEFAULT 'moving_average' CHECK (prediction_type IN ('moving_average', 'linear_regression', 'seasonal')),
                prediction_period TEXT NOT NULL, -- '7_days', '30_days', '90_days'
                predicted_demand INTEGER NOT NULL,
                confidence_level REAL DEFAULT 0.75,
                prediction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                actual_demand INTEGER,
                accuracy_score REAL,
                model_version TEXT DEFAULT '1.0',
                features_used TEXT, -- JSON array of features used
                created_by INTEGER,
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created demand_predictions table');
                    resolve();
                }
            });
        });
    }

    async createSeasonalTrendsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS seasonal_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER,
                product_name TEXT,
                trend_year INTEGER NOT NULL,
                trend_month INTEGER NOT NULL CHECK (trend_month BETWEEN 1 AND 12),
                sales_volume INTEGER DEFAULT 0,
                sales_revenue REAL DEFAULT 0,
                growth_rate REAL DEFAULT 0,
                trend_strength REAL DEFAULT 0, -- 0-1 scale
                seasonality_score REAL DEFAULT 0, -- 0-1 scale
                peak_month INTEGER,
                low_month INTEGER,
                seasonal_index REAL DEFAULT 1.0,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created seasonal_trends table');
                    resolve();
                }
            });
        });
    }

    async createScheduledReportsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS scheduled_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_name TEXT NOT NULL,
                report_type TEXT NOT NULL CHECK (report_type IN ('sales', 'inventory', 'returns', 'profit', 'comprehensive')),
                schedule_frequency TEXT NOT NULL CHECK (schedule_frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
                schedule_time TIME NOT NULL, -- Time to run the report
                schedule_day INTEGER CHECK (schedule_day BETWEEN 1 AND 31), -- For monthly reports
                schedule_weekday INTEGER CHECK (schedule_weekday BETWEEN 0 AND 6), -- For weekly reports (0=Sunday)
                report_parameters TEXT, -- JSON object with report-specific parameters
                is_active BOOLEAN DEFAULT 1,
                last_run_date DATETIME,
                next_run_date DATETIME,
                created_by INTEGER,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created scheduled_reports table');
                    resolve();
                }
            });
        });
    }

    async createEmailTemplatesTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS email_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_name TEXT NOT NULL UNIQUE,
                template_type TEXT NOT NULL CHECK (template_type IN ('low_stock_alert', 'demand_prediction', 'scheduled_report', 'custom')),
                subject_template TEXT NOT NULL,
                body_template TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                variables TEXT -- JSON object with available variables
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created email_templates table');
                    resolve();
                }
            });
        });
    }

    async createNotificationLogsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS notification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notification_type TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                recipient_name TEXT,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                template_used INTEGER,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
                sent_date DATETIME,
                error_message TEXT,
                metadata TEXT, -- JSON object with additional data
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (template_used) REFERENCES email_templates (id)
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created notification_logs table');
                    resolve();
                }
            });
        });
    }

    async createAnalyticsCacheTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS analytics_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cache_key TEXT NOT NULL UNIQUE,
                cache_data TEXT NOT NULL, -- JSON data
                cache_type TEXT DEFAULT 'analytics' CHECK (cache_type IN ('analytics', 'prediction', 'trend')),
                expires_at DATETIME NOT NULL,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                access_count INTEGER DEFAULT 0,
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Created analytics_cache table');
                    resolve();
                }
            });
        });
    }

    async insertDefaultEmailTemplates() {
        const templates = [
            {
                template_name: 'low_stock_alert',
                template_type: 'low_stock_alert',
                subject_template: '⚠️ Low Stock Alert: {{product_name}}',
                body_template: `
                    <h2>Low Stock Alert</h2>
                    <p>Dear {{recipient_name}},</p>
                    <p>This is an automated notification that the following product is running low on stock:</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <strong>Product:</strong> {{product_name}}<br>
                        <strong>Current Stock:</strong> {{current_quantity}} units<br>
                        <strong>Alert Threshold:</strong> {{threshold_quantity}} units<br>
                        <strong>Alert Type:</strong> {{alert_type}}<br>
                        <strong>Priority:</strong> {{priority}}
                    </div>
                    
                    <p><strong>Recommended Actions:</strong></p>
                    <ul>
                        <li>Review current inventory levels</li>
                        <li>Check pending orders</li>
                        <li>Consider reordering from suppliers</li>
                        <li>Update product thresholds if needed</li>
                    </ul>
                    
                    <p>This alert was generated on {{alert_date}} at {{alert_time}}.</p>
                    
                    <p>Best regards,<br>
                    Inventory Management System</p>
                `,
                variables: JSON.stringify({
                    recipient_name: 'Recipient name',
                    product_name: 'Product name',
                    current_quantity: 'Current stock quantity',
                    threshold_quantity: 'Alert threshold',
                    alert_type: 'Type of alert',
                    priority: 'Alert priority',
                    alert_date: 'Alert generation date',
                    alert_time: 'Alert generation time'
                })
            },
            {
                template_name: 'demand_prediction_report',
                template_type: 'demand_prediction',
                subject_template: '📊 Demand Prediction Report - {{report_date}}',
                body_template: `
                    <h2>Demand Prediction Report</h2>
                    <p>Dear {{recipient_name}},</p>
                    
                    <p>Here is your automated demand prediction report for {{report_date}}:</p>
                    
                    <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <h3>Key Insights</h3>
                        <ul>
                            <li><strong>Products Analyzed:</strong> {{products_analyzed}}</li>
                            <li><strong>High-Demand Products:</strong> {{high_demand_count}}</li>
                            <li><strong>Prediction Accuracy:</strong> {{accuracy_rate}}%</li>
                        </ul>
                    </div>
                    
                    <h3>Top Predicted Items</h3>
                    {{top_predictions}}
                    
                    <h3>Seasonal Trends</h3>
                    {{seasonal_insights}}
                    
                    <p><strong>Recommendations:</strong></p>
                    <ul>
                        <li>Review inventory levels for high-demand predictions</li>
                        <li>Consider seasonal patterns for planning</li>
                        <li>Update stock thresholds based on predictions</li>
                    </ul>
                    
                    <p>Report generated on {{generation_time}}.</p>
                    
                    <p>Best regards,<br>
                    Analytics Engine</p>
                `,
                variables: JSON.stringify({
                    recipient_name: 'Recipient name',
                    report_date: 'Report date',
                    products_analyzed: 'Number of products analyzed',
                    high_demand_count: 'Count of high-demand products',
                    accuracy_rate: 'Prediction accuracy percentage',
                    top_predictions: 'HTML table of top predictions',
                    seasonal_insights: 'HTML content for seasonal insights',
                    generation_time: 'Report generation time'
                })
            },
            {
                template_name: 'scheduled_inventory_report',
                template_type: 'scheduled_report',
                subject_template: '📈 {{report_type}} Report - {{report_date}}',
                body_template: `
                    <h2>{{report_type}} Report</h2>
                    <p>Dear {{recipient_name}},</p>
                    
                    <p>Your scheduled {{report_type}} report for {{report_date}}:</p>
                    
                    <div style="background: #f0f8f0; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        {{report_summary}}
                    </div>
                    
                    <h3>Key Metrics</h3>
                    {{key_metrics}}
                    
                    <h3>Notable Items</h3>
                    {{notable_items}}
                    
                    <p><strong>Generated:</strong> {{generation_time}}</p>
                    <p><strong>Period:</strong> {{report_period}}</p>
                    
                    <p>Best regards,<br>
                    Inventory Management System</p>
                `,
                variables: JSON.stringify({
                    recipient_name: 'Recipient name',
                    report_type: 'Type of report',
                    report_date: 'Report date',
                    report_summary: 'HTML summary of report',
                    key_metrics: 'HTML table of key metrics',
                    notable_items: 'HTML list of notable items',
                    generation_time: 'Generation timestamp',
                    report_period: 'Period covered by report'
                })
            }
        ];

        for (const template of templates) {
            await new Promise((resolve, reject) => {
                this.db.run(
                    `INSERT OR IGNORE INTO email_templates 
                     (template_name, template_type, subject_template, body_template, variables) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [template.template_name, template.template_type, template.subject_template, template.body_template, template.variables],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        }

        console.log('Default email templates inserted');
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new AnalyticsMigration();
    migration.run()
        .then(() => {
            console.log('Analytics migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = AnalyticsMigration;
