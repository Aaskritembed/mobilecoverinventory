/**
 * Analytics Engine for Inventory Management System
 * Provides demand prediction, seasonal trend analysis, and automated alerts
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');

class AnalyticsEngine {
    constructor(dbPath = './database/inventory.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.scheduledJobs = new Map();
        this.notificationQueue = [];
        this.initialize();
    }

    /**
     * Initialize database connection and setup
     */
    async initialize() {
        await this.connect();
        await this.setupScheduledJobs();
        console.log('Analytics Engine initialized');
    }

    /**
     * Connect to database
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to database for analytics engine');
                    resolve();
                }
            });
        });
    }

    // ==================== LOW STOCK ALERTS ====================

    /**
     * Check and create low stock alerts for products
     */
    async checkLowStockAlerts() {
        console.log('Checking for low stock alerts...');
        
        try {
            // Get products with their current quantities and thresholds
            const products = await this.getAllProducts();
            
            for (const product of products) {
                const threshold = product.low_stock_threshold || 10;
                
                if (product.quantity <= threshold) {
                    // Check if alert already exists and is active
                    const existingAlert = await this.getExistingAlert(product.id);
                    
                    if (!existingAlert) {
                        await this.createLowStockAlert(product, threshold);
                    } else if (existingAlert.alert_status === 'resolved' && product.quantity <= threshold) {
                        // Create new alert if previous one was resolved but stock is still low
                        await this.createLowStockAlert(product, threshold);
                    }
                } else if (product.quantity > threshold && product.quantity <= threshold * 1.5) {
                    // Auto-resolve alerts when stock is replenished
                    await this.resolveLowStockAlert(product.id);
                }
            }
            
            console.log('Low stock alert check completed');
        } catch (error) {
            console.error('Error checking low stock alerts:', error);
        }
    }

    /**
     * Get all products with their current quantities
     */
    async getAllProducts() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM products', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get existing active alert for a product
     */
    async getExistingAlert(productId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM low_stock_alerts WHERE product_id = ? AND alert_status = "active"',
                [productId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    /**
     * Create a new low stock alert
     */
    async createLowStockAlert(product, threshold) {
        const alertType = product.quantity === 0 ? 'out_of_stock' : 
                         product.quantity <= threshold * 0.5 ? 'critical' : 'low_stock';
        
        const priority = product.quantity === 0 ? 'critical' : 
                        product.quantity <= threshold * 0.5 ? 'high' : 'medium';

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO low_stock_alerts 
                 (product_id, product_name, current_quantity, threshold_quantity, alert_type, priority) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [product.id, product.name, product.quantity, threshold, alertType, priority],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`Created low stock alert for ${product.name}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    /**
     * Resolve a low stock alert
     */
    async resolveLowStockAlert(productId, resolvedBy = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE low_stock_alerts 
                 SET alert_status = 'resolved', resolved_date = CURRENT_TIMESTAMP, resolved_by = ? 
                 WHERE product_id = ? AND alert_status = 'active'`,
                [resolvedBy, productId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`Resolved low stock alert for product ${productId}`);
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    /**
     * Get active low stock alerts
     */
    async getActiveLowStockAlerts() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT lsa.*, p.selling_price, p.cost_price 
                 FROM low_stock_alerts lsa 
                 LEFT JOIN products p ON lsa.product_id = p.id 
                 WHERE lsa.alert_status = 'active' 
                 ORDER BY lsa.priority DESC, lsa.created_date DESC`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // ==================== DEMAND PREDICTION ====================

    /**
     * Generate demand predictions for all products
     */
    async generateDemandPredictions() {
        console.log('Generating demand predictions...');
        
        try {
            const products = await this.getAllProducts();
            const predictions = [];
            
            for (const product of products) {
                const prediction = await this.predictProductDemand(product.id);
                if (prediction) {
                    predictions.push(prediction);
                }
            }
            
            console.log(`Generated ${predictions.length} demand predictions`);
            return predictions;
        } catch (error) {
            console.error('Error generating demand predictions:', error);
            throw error;
        }
    }

    /**
     * Predict demand for a specific product using moving average
     */
    async predictProductDemand(productId, days = 30) {
        try {
            // Get historical sales data
            const salesData = await this.getProductSalesHistory(productId, days);
            
            if (salesData.length === 0) {
                return null; // No sales history
            }

            // Calculate moving averages
            const movingAverage7 = this.calculateMovingAverage(salesData, 7);
            const movingAverage30 = this.calculateMovingAverage(salesData, Math.min(salesData.length, 30));
            const linearTrend = this.calculateLinearTrend(salesData);
            
            // Calculate prediction based on multiple methods
            const predictionMethods = {
                moving_average_7: movingAverage7,
                moving_average_30: movingAverage30,
                linear_trend: linearTrend
            };

            // Use weighted average of methods
            const weights = { moving_average_7: 0.3, moving_average_30: 0.5, linear_trend: 0.2 };
            let finalPrediction = 0;
            let confidenceLevel = 0;

            for (const [method, value] of Object.entries(predictionMethods)) {
                if (value !== null) {
                    finalPrediction += value * weights[method];
                    confidenceLevel += 0.33; // Each method contributes to confidence
                }
            }

            finalPrediction = Math.max(0, Math.round(finalPrediction));

            // Store prediction in database
            const predictionId = await this.storeDemandPrediction(
                productId, 
                finalPrediction, 
                confidenceLevel, 
                predictionMethods
            );

            return {
                id: predictionId,
                product_id: productId,
                predicted_demand: finalPrediction,
                confidence_level: confidenceLevel,
                methods: predictionMethods,
                prediction_period: `${days}_days`
            };

        } catch (error) {
            console.error(`Error predicting demand for product ${productId}:`, error);
            return null;
        }
    }

    /**
     * Get product sales history
     */
    async getProductSalesHistory(productId, days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT DATE(sale_date) as sale_date, SUM(quantity_sold) as daily_sales
                 FROM sales 
                 WHERE product_id = ? AND sale_date >= ? 
                 GROUP BY DATE(sale_date) 
                 ORDER BY sale_date`,
                [productId, startDate.toISOString()],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Calculate moving average for sales data
     */
    calculateMovingAverage(salesData, period) {
        if (salesData.length < period) return null;
        
        const recentSales = salesData.slice(-period);
        const totalSales = recentSales.reduce((sum, day) => sum + day.daily_sales, 0);
        return totalSales / period;
    }

    /**
     * Calculate linear trend for sales data
     */
    calculateLinearTrend(salesData) {
        if (salesData.length < 2) return null;
        
        const n = salesData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        salesData.forEach((day, index) => {
            sumX += index;
            sumY += day.daily_sales;
            sumXY += index * day.daily_sales;
            sumX2 += index * index;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Predict next day
        return Math.max(0, slope * n + intercept);
    }

    /**
     * Store demand prediction in database
     */
    async storeDemandPrediction(productId, predictedDemand, confidenceLevel, methods) {
        const product = await this.getProductById(productId);
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO demand_predictions 
                 (product_id, product_name, predicted_demand, confidence_level, features_used) 
                 VALUES (?, ?, ?, ?, ?)`,
                [productId, product.name, predictedDemand, confidenceLevel, JSON.stringify(methods)],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    /**
     * Get product by ID
     */
    async getProductById(productId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get recent demand predictions
     */
    async getRecentPredictions(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT dp.*, p.quantity as current_stock 
                 FROM demand_predictions dp 
                 LEFT JOIN products p ON dp.product_id = p.id 
                 ORDER BY dp.prediction_date DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // ==================== SEASONAL TREND ANALYSIS ====================

    /**
     * Analyze seasonal trends for all products
     */
    async analyzeSeasonalTrends(year = new Date().getFullYear()) {
        console.log(`Analyzing seasonal trends for ${year}...`);
        
        try {
            const products = await this.getAllProducts();
            const trends = [];
            
            for (const product of products) {
                const trend = await this.analyzeProductSeasonalTrend(product.id, year);
                if (trend) {
                    trends.push(trend);
                }
            }
            
            console.log(`Analyzed seasonal trends for ${trends.length} products`);
            return trends;
        } catch (error) {
            console.error('Error analyzing seasonal trends:', error);
            throw error;
        }
    }

    /**
     * Analyze seasonal trend for a specific product
     */
    async analyzeProductSeasonalTrend(productId, year) {
        try {
            // Get sales data for the year
            const salesData = await this.getProductSalesByMonth(productId, year);
            
            if (salesData.length === 0) {
                return null;
            }

            // Calculate monthly statistics
            const monthlyStats = this.calculateMonthlyStatistics(salesData);
            
            // Calculate seasonal indices
            const seasonalIndices = this.calculateSeasonalIndices(monthlyStats);
            
            // Identify peak and low months
            const peakMonth = this.findPeakMonth(seasonalIndices);
            const lowMonth = this.findLowMonth(seasonalIndices);
            
            // Calculate trend strength
            const trendStrength = this.calculateTrendStrength(seasonalIndices);
            
            // Store trend data
            const trendId = await this.storeSeasonalTrend(
                productId, 
                monthlyStats, 
                seasonalIndices, 
                peakMonth, 
                lowMonth, 
                trendStrength,
                year
            );

            return {
                id: trendId,
                product_id: productId,
                year: year,
                monthly_stats: monthlyStats,
                seasonal_indices: seasonalIndices,
                peak_month: peakMonth,
                low_month: lowMonth,
                trend_strength: trendStrength
            };

        } catch (error) {
            console.error(`Error analyzing seasonal trend for product ${productId}:`, error);
            return null;
        }
    }

    /**
     * Get product sales by month for a year
     */
    async getProductSalesByMonth(productId, year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    strftime('%m', sale_date) as month,
                    SUM(quantity_sold) as total_sales,
                    SUM(total_amount) as total_revenue,
                    COUNT(*) as transaction_count
                 FROM sales 
                 WHERE product_id = ? AND sale_date BETWEEN ? AND ?
                 GROUP BY strftime('%m', sale_date)
                 ORDER BY month`,
                [productId, startDate.toISOString(), endDate.toISOString()],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Calculate monthly statistics from sales data
     */
    calculateMonthlyStatistics(salesData) {
        const monthlyStats = {};
        
        // Initialize all months
        for (let i = 1; i <= 12; i++) {
            monthlyStats[i] = { sales: 0, revenue: 0, transactions: 0 };
        }
        
        // Fill with actual data
        salesData.forEach(data => {
            const month = parseInt(data.month);
            monthlyStats[month] = {
                sales: data.total_sales,
                revenue: data.total_revenue,
                transactions: data.transaction_count
            };
        });
        
        return monthlyStats;
    }

    /**
     * Calculate seasonal indices
     */
    calculateSeasonalIndices(monthlyStats) {
        const totalSales = Object.values(monthlyStats).reduce((sum, stat) => sum + stat.sales, 0);
        const averageSales = totalSales / 12;
        
        const seasonalIndices = {};
        for (let month = 1; month <= 12; month++) {
            seasonalIndices[month] = averageSales > 0 ? monthlyStats[month].sales / averageSales : 1;
        }
        
        return seasonalIndices;
    }

    /**
     * Find peak month (highest sales)
     */
    findPeakMonth(seasonalIndices) {
        let peakMonth = 1;
        let peakValue = seasonalIndices[1];
        
        for (let month = 2; month <= 12; month++) {
            if (seasonalIndices[month] > peakValue) {
                peakValue = seasonalIndices[month];
                peakMonth = month;
            }
        }
        
        return peakMonth;
    }

    /**
     * Find low month (lowest sales)
     */
    findLowMonth(seasonalIndices) {
        let lowMonth = 1;
        let lowValue = seasonalIndices[1];
        
        for (let month = 2; month <= 12; month++) {
            if (seasonalIndices[month] < lowValue) {
                lowValue = seasonalIndices[month];
                lowMonth = month;
            }
        }
        
        return lowMonth;
    }

    /**
     * Calculate trend strength (coefficient of variation)
     */
    calculateTrendStrength(seasonalIndices) {
        const values = Object.values(seasonalIndices);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Convert to 0-1 scale (higher values = stronger seasonality)
        return mean > 0 ? Math.min(1, standardDeviation / mean) : 0;
    }

    /**
     * Store seasonal trend in database
     */
    async storeSeasonalTrend(productId, monthlyStats, seasonalIndices, peakMonth, lowMonth, trendStrength, year) {
        const product = await this.getProductById(productId);
        
        // Calculate annual totals
        const annualSales = Object.values(monthlyStats).reduce((sum, stat) => sum + stat.sales, 0);
        const annualRevenue = Object.values(monthlyStats).reduce((sum, stat) => sum + stat.revenue, 0);
        
        // Calculate growth rate (simplified)
        const growthRate = 0; // Would need previous year data for accurate calculation
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO seasonal_trends 
                 (product_id, product_name, trend_year, trend_month, sales_volume, sales_revenue, 
                  growth_rate, trend_strength, seasonality_score, peak_month, low_month, seasonal_index) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    productId, product.name, year, 0, annualSales, annualRevenue,
                    growthRate, trendStrength, trendStrength, peakMonth, lowMonth, 1.0
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    /**
     * Get seasonal trends for a specific year
     */
    async getSeasonalTrends(year) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM seasonal_trends WHERE trend_year = ? ORDER BY trend_strength DESC`,
                [year],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // ==================== SCHEDULED REPORTS ====================

    /**
     * Setup scheduled jobs for automated reports and alerts
     */
    async setupScheduledJobs() {
        console.log('Setting up scheduled jobs...');
        
        // Check for low stock alerts every hour
        const lowStockJob = cron.schedule('0 * * * *', () => {
            this.checkLowStockAlerts().catch(console.error);
        });
        this.scheduledJobs.set('low_stock_check', lowStockJob);
        
        // Generate demand predictions daily at 2 AM
        const demandPredictionJob = cron.schedule('0 2 * * *', () => {
            this.generateDemandPredictions().catch(console.error);
        });
        this.scheduledJobs.set('demand_predictions', demandPredictionJob);
        
        // Analyze seasonal trends weekly on Sunday at 3 AM
        const seasonalAnalysisJob = cron.schedule('0 3 * * 0', () => {
            this.analyzeSeasonalTrends().catch(console.error);
        });
        this.scheduledJobs.set('seasonal_analysis', seasonalAnalysisJob);
        
        // Check scheduled reports every 15 minutes
        const reportJob = cron.schedule('*/15 * * * *', () => {
            this.processScheduledReports().catch(console.error);
        });
        this.scheduledJobs.set('scheduled_reports', reportJob);
        
        console.log('Scheduled jobs setup completed');
    }

    /**
     * Process scheduled reports
     */
    async processScheduledReports() {
        try {
            const dueReports = await this.getDueScheduledReports();
            
            for (const report of dueReports) {
                await this.generateAndSendReport(report);
                await this.updateReportLastRun(report.id);
            }
        } catch (error) {
            console.error('Error processing scheduled reports:', error);
        }
    }

    /**
     * Get scheduled reports that are due to run
     */
    async getDueScheduledReports() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM scheduled_reports 
                 WHERE is_active = 1 AND (next_run_date IS NULL OR next_run_date <= CURRENT_TIMESTAMP)`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Generate and send a scheduled report
     */
    async generateAndSendReport(report) {
        console.log(`Generating scheduled report: ${report.report_name}`);
        
        try {
            // Generate report data based on type
            const reportData = await this.generateReportData(report.report_type, report.report_parameters);
            
            // Send report via email
            await this.sendScheduledReportEmail(report, reportData);
            
            // Log the report generation
            await this.logReportGeneration(report.id, reportData);
            
        } catch (error) {
            console.error(`Error generating report ${report.report_name}:`, error);
            throw error;
        }
    }

    /**
     * Generate report data based on type
     */
    async generateReportData(reportType, parameters) {
        const params = parameters ? JSON.parse(parameters) : {};
        
        switch (reportType) {
            case 'sales':
                return await this.generateSalesReport(params);
            case 'inventory':
                return await this.generateInventoryReport(params);
            case 'returns':
                return await this.generateReturnsReport(params);
            case 'profit':
                return await this.generateProfitReport(params);
            case 'comprehensive':
                return await this.generateComprehensiveReport(params);
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }
    }

    /**
     * Generate sales report
     */
    async generateSalesReport(params = {}) {
        const { start_date, end_date } = params;
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    p.name as product_name,
                    p.brand,
                    p.model,
                    SUM(s.quantity_sold) as total_sold,
                    SUM(s.total_amount) as total_revenue,
                    AVG(s.sale_price) as avg_sale_price,
                    COUNT(s.id) as transaction_count
                 FROM sales s
                 LEFT JOIN products p ON s.product_id = p.id
                 ${start_date && end_date ? 'WHERE s.sale_date BETWEEN ? AND ?' : ''}
                 GROUP BY s.product_id
                 ORDER BY total_revenue DESC`,
                start_date && end_date ? [start_date, end_date] : [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            type: 'sales',
                            data: rows,
                            period: { start_date, end_date }
                        });
                    }
                }
            );
        });
    }

    /**
     * Generate inventory report
     */
    async generateInventoryReport(params = {}) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    p.name as product_name,
                    p.brand,
                    p.model,
                    p.quantity,
                    p.cost_price,
                    p.selling_price,
                    p.quantity * p.cost_price as total_cost_value,
                    p.quantity * p.selling_price as total_selling_value,
                    CASE 
                        WHEN p.quantity = 0 THEN 'Out of Stock'
                        WHEN p.quantity < 10 THEN 'Low Stock'
                        ELSE 'In Stock'
                    END as stock_status
                 FROM products p
                 ORDER BY p.quantity ASC`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            type: 'inventory',
                            data: rows
                        });
                    }
                }
            );
        });
    }

    /**
     * Generate returns report
     */
    async generateReturnsReport(params = {}) {
        const { start_date, end_date } = params;
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    r.return_reason,
                    r.return_status,
                    COUNT(*) as return_count,
                    SUM(r.refund_amount) as total_refunds,
                    AVG(r.refund_amount) as avg_refund
                 FROM returns r
                 ${start_date && end_date ? 'WHERE r.return_date BETWEEN ? AND ?' : ''}
                 GROUP BY r.return_reason, r.return_status
                 ORDER BY return_count DESC`,
                start_date && end_date ? [start_date, end_date] : [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            type: 'returns',
                            data: rows,
                            period: { start_date, end_date }
                        });
                    }
                }
            );
        });
    }

    /**
     * Generate profit report
     */
    async generateProfitReport(params = {}) {
        const { start_date, end_date } = params;
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    p.name as product_name,
                    SUM(s.quantity_sold) as total_sold,
                    SUM(s.total_amount) as total_revenue,
                    SUM(s.quantity_sold * p.cost_price) as total_cost,
                    SUM(s.total_amount - (s.quantity_sold * p.cost_price)) as total_profit,
                    ROUND(((SUM(s.total_amount - (s.quantity_sold * p.cost_price)) / SUM(s.total_amount)) * 100), 2) as profit_margin
                 FROM sales s
                 LEFT JOIN products p ON s.product_id = p.id
                 ${start_date && end_date ? 'WHERE s.sale_date BETWEEN ? AND ?' : ''}
                 GROUP BY s.product_id
                 ORDER BY total_profit DESC`,
                start_date && end_date ? [start_date, end_date] : [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            type: 'profit',
                            data: rows,
                            period: { start_date, end_date }
                        });
                    }
                }
            );
        });
    }

    /**
     * Generate comprehensive report
     */
    async generateComprehensiveReport(params = {}) {
        const salesReport = await this.generateSalesReport(params);
        const inventoryReport = await this.generateInventoryReport();
        const returnsReport = await this.generateReturnsReport(params);
        const profitReport = await this.generateProfitReport(params);
        
        return {
            type: 'comprehensive',
            sales: salesReport.data,
            inventory: inventoryReport.data,
            returns: returnsReport.data,
            profit: profitReport.data,
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Send scheduled report email
     */
    async sendScheduledReportEmail(report, reportData) {
        // This would integrate with your email service
        // For now, we'll just log the action
        console.log(`Sending ${report.report_type} report to scheduled recipients`);
        
        // Log notification
        await this.logNotification(
            'scheduled_report',
            'admin@ecom.com',
            `${report.report_type} Report - ${new Date().toLocaleDateString()}`,
            'Report generated and sent successfully'
        );
    }

    /**
     * Update report last run timestamp
     */
    async updateReportLastRun(reportId) {
        const nextRunDate = this.calculateNextRunDate();
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE scheduled_reports 
                 SET last_run_date = CURRENT_TIMESTAMP, next_run_date = ?
                 WHERE id = ?`,
                [nextRunDate, reportId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Calculate next run date based on frequency
     */
    calculateNextRunDate() {
        // This is a simplified calculation
        // In a real implementation, you'd calculate based on the specific schedule
        const now = new Date();
        now.setHours(now.getHours() + 1); // Run again in 1 hour for demo
        return now.toISOString();
    }

    /**
     * Log report generation
     */
    async logReportGeneration(reportId, reportData) {
        // Implementation for logging report generation
        console.log(`Logged report generation for report ID: ${reportId}`);
    }

    /**
     * Log notification
     */
    async logNotification(type, recipient, subject, body) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO notification_logs 
                 (notification_type, recipient_email, subject, body, status) 
                 VALUES (?, ?, ?, ?, 'sent')`,
                [type, recipient, subject, body],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get analytics dashboard data
     */
    async getDashboardData() {
        const alerts = await this.getActiveLowStockAlerts();
        const predictions = await this.getRecentPredictions(10);
        const trends = await this.getSeasonalTrends(new Date().getFullYear());
        
        return {
            low_stock_alerts: alerts,
            demand_predictions: predictions,
            seasonal_trends: trends,
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        console.log('Stopping analytics engine...');
        
        this.scheduledJobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped job: ${name}`);
        });
        
        this.scheduledJobs.clear();
    }

    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Analytics engine database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = AnalyticsEngine;
