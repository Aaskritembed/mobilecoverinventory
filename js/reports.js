// Reports and Analytics JavaScript functionality
class ReportsManager {
    constructor() {
        this.apiBase = '/api';
        this.products = [];
        this.sales = [];
        this.profitData = [];
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupFilters();
        this.loadAllReports();
    }

    async loadData() {
        try {
            // Load products and sales data
            const [productsResponse, salesResponse] = await Promise.all([
                fetch(`${this.apiBase}/products`),
                fetch(`${this.apiBase}/sales`)
            ]);

            if (productsResponse.ok) {
                this.products = await productsResponse.json();
            }

            if (salesResponse.ok) {
                this.sales = await salesResponse.json();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load report data');
        }
    }

    setupFilters() {
        const form = document.getElementById('reportFilterForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyDateFilter();
            });
        }

        // Set default date range to current month
        this.setDefaultDateRange();
    }

    setDefaultDateRange() {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        document.getElementById('startDate').value = firstDayOfMonth.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
        
        this.updateReportPeriod();
    }

    setDateRange(range) {
        const today = new Date();
        let startDate, endDate = today;

        switch (range) {
            case 'today':
                startDate = today;
                break;
            case 'week':
                startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'all':
                startDate = null;
                endDate = null;
                break;
        }

        if (startDate) {
            document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
            document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
        } else {
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
        }

        this.updateReportPeriod();
        this.loadAllReports();
    }

    async applyDateFilter() {
        this.updateReportPeriod();
        await this.loadAllReports();
    }

    updateReportPeriod() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const periodElement = document.getElementById('reportPeriod');
        const rangeElement = document.getElementById('reportDateRange');

        if (!startDate && !endDate) {
            periodElement.textContent = 'All Time';
            rangeElement.textContent = 'No date filter applied';
        } else if (startDate && endDate) {
            const start = new Date(startDate).toLocaleDateString();
            const end = new Date(endDate).toLocaleDateString();
            periodElement.textContent = 'Custom Range';
            rangeElement.textContent = `${start} - ${end}`;
        } else if (startDate) {
            const start = new Date(startDate).toLocaleDateString();
            periodElement.textContent = 'From Date';
            rangeElement.textContent = `From ${start}`;
        } else if (endDate) {
            const end = new Date(endDate).toLocaleDateString();
            periodElement.textContent = 'Until Date';
            rangeElement.textContent = `Until ${end}`;
        }
    }

    async loadAllReports() {
        await Promise.all([
            this.loadProfitReport(),
            this.updateSummaryStats(),
            this.displayProductPerformance(),
            this.displayCategoryAnalysis(),
            this.displayInventoryStatus()
        ]);
    }

    getFilteredSales() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!startDate && !endDate) {
            return [...this.sales];
        }

        return this.sales.filter(sale => {
            const saleDate = new Date(sale.sale_date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && saleDate < start) return false;
            if (end && saleDate > end) return false;
            return true;
        });
    }

    async loadProfitReport() {
        try {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            let url = `${this.apiBase}/profit-report`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (response.ok) {
                this.profitData = await response.json();
                this.displayProfitReport();
            } else {
                throw new Error('Failed to load profit report');
            }
        } catch (error) {
            console.error('Error loading profit report:', error);
            this.showError('Failed to load profit report');
            this.displayProfitReport(); // Display empty state
        }
    }

    displayProfitReport() {
        const container = document.getElementById('profitReport');
        if (!container) return;

        if (this.profitData.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-chart-line fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No profit data found</h5>
                    <p class="text-muted">Sales data will appear here once you start recording transactions.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Units Sold</th>
                            <th>Total Revenue</th>
                            <th>Total Cost</th>
                            <th>Total Profit</th>
                            <th>Profit Margin</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.profitData.forEach(item => {
            const profitMargin = item.total_revenue > 0 ? ((item.total_profit / item.total_revenue) * 100).toFixed(1) : '0';
            
            html += `
                <tr>
                    <td>
                        <strong>${item.product_name || 'Unknown Product'}</strong>
                    </td>
                    <td>
                        <span class="badge badge-info">${item.total_sold || 0}</span>
                    </td>
                    <td>
                        <strong class="text-success">$${(item.total_revenue || 0).toFixed(2)}</strong>
                    </td>
                    <td>
                        $${(item.total_cost || 0).toFixed(2)}
                    </td>
                    <td>
                        <strong class="text-success">$${(item.total_profit || 0).toFixed(2)}</strong>
                    </td>
                    <td>
                        <span class="badge ${profitMargin > 30 ? 'badge-success' : profitMargin > 15 ? 'badge-warning' : 'badge-danger'}">
                            ${profitMargin}%
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    async updateSummaryStats() {
        const filteredSales = this.getFilteredSales();
        
        // Calculate totals
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0);
        const totalUnits = filteredSales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
        
        // Calculate profit
        let totalCost = 0;
        let totalProfit = 0;
        
        filteredSales.forEach(sale => {
            const product = this.products.find(p => p.id === sale.product_id);
            if (product) {
                const cost = product.cost_price * sale.quantity_sold;
                totalCost += cost;
                totalProfit += sale.total_amount - cost;
            }
        });

        // Calculate average profit margin
        const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;

        // Update DOM
        document.getElementById('totalRevenue').textContent = this.formatCurrency(totalRevenue);
        document.getElementById('totalProfit').textContent = this.formatCurrency(totalProfit);
        document.getElementById('totalUnits').textContent = totalUnits;
        document.getElementById('avgMargin').textContent = `${avgMargin.toFixed(1)}%`;
    }

    displayProductPerformance() {
        const container = document.getElementById('productPerformance');
        if (!container) return;

        const filteredSales = this.getFilteredSales();
        
        // Group sales by product
        const productSales = {};
        filteredSales.forEach(sale => {
            if (!productSales[sale.product_id]) {
                productSales[sale.product_id] = {
                    product_name: sale.product_name,
                    total_quantity: 0,
                    total_revenue: 0,
                    total_profit: 0
                };
            }
            
            const product = this.products.find(p => p.id === sale.product_id);
            const profit = product ? (sale.sale_price - product.cost_price) * sale.quantity_sold : 0;
            
            productSales[sale.product_id].total_quantity += sale.quantity_sold;
            productSales[sale.product_id].total_revenue += sale.total_amount;
            productSales[sale.product_id].total_profit += profit;
        });

        // Sort by total revenue
        const sortedProducts = Object.values(productSales)
            .sort((a, b) => b.total_revenue - a.total_revenue)
            .slice(0, 10);

        if (sortedProducts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-trophy fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No sales data</h5>
                    <p class="text-muted">Product performance will appear here once you start selling.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        sortedProducts.forEach((product, index) => {
            const rankClass = index === 0 ? 'text-warning' : index === 1 ? 'text-secondary' : index === 2 ? 'text-bronze' : 'text-muted';
            const rankIcon = index === 0 ? 'fa-trophy' : index === 1 ? 'fa-medal' : index === 2 ? 'fa-award' : 'fa-star';
            
            html += `
                <div class="list-group-item">
                    <div class="row align-items-center">
                        <div class="col-1 text-center">
                            <i class="fas ${rankIcon} ${rankClass}"></i>
                        </div>
                        <div class="col-4">
                            <h6 class="mb-1">${product.product_name}</h6>
                            <small class="text-muted">${product.total_quantity} units sold</small>
                        </div>
                        <div class="col-3 text-center">
                            <strong class="text-success">$${product.total_revenue.toFixed(2)}</strong>
                            <br><small class="text-muted">Revenue</small>
                        </div>
                        <div class="col-2 text-center">
                            <strong class="text-success">$${product.total_profit.toFixed(2)}</strong>
                            <br><small class="text-muted">Profit</small>
                        </div>
                        <div class="col-2 text-center">
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar bg-success" style="width: ${(product.total_revenue / sortedProducts[0].total_revenue) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    displayCategoryAnalysis() {
        const container = document.getElementById('categoryAnalysis');
        if (!container) return;

        const filteredSales = this.getFilteredSales();
        
        // Group by category
        const categoryData = {};
        filteredSales.forEach(sale => {
            const product = this.products.find(p => p.id === sale.product_id);
            const category = product?.category || 'Uncategorized';
            
            if (!categoryData[category]) {
                categoryData[category] = { revenue: 0, count: 0 };
            }
            
            categoryData[category].revenue += sale.total_amount;
            categoryData[category].count += sale.quantity_sold;
        });

        const totalRevenue = Object.values(categoryData).reduce((sum, cat) => sum + cat.revenue, 0);

        if (Object.keys(categoryData).length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-chart-pie fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No category data</h5>
                    <p class="text-muted">Sales by category will appear here.</p>
                </div>
            `;
            return;
        }

        let html = '';
        Object.entries(categoryData)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([category, data]) => {
                const percentage = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : '0';
                const colors = ['primary', 'success', 'info', 'warning', 'danger'];
                const colorClass = colors[Math.floor(Math.random() * colors.length)];
                
                html += `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="small fw-bold">${category}</span>
                            <span class="small text-muted">${percentage}%</span>
                        </div>
                        <div class="progress mb-1" style="height: 8px;">
                            <div class="progress-bar bg-${colorClass}" style="width: ${percentage}%"></div>
                        </div>
                        <div class="d-flex justify-content-between">
                            <small class="text-success fw-bold">$${data.revenue.toFixed(2)}</small>
                            <small class="text-muted">${data.count} units</small>
                        </div>
                    </div>
                `;
            });

        container.innerHTML = html;
    }

    displayInventoryStatus() {
        const container = document.getElementById('inventoryStatus');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-warehouse fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No inventory data</h5>
                    <p class="text-muted">Add products to see inventory status.</p>
                </div>
            `;
            return;
        }

        // Categorize products by stock level
        const inStock = this.products.filter(p => p.quantity > 10);
        const lowStock = this.products.filter(p => p.quantity > 0 && p.quantity <= 10);
        const outOfStock = this.products.filter(p => p.quantity === 0);

        // Calculate inventory value
        const totalValue = this.products.reduce((sum, product) => sum + (product.quantity * product.cost_price), 0);
        const totalRetailValue = this.products.reduce((sum, product) => sum + (product.quantity * product.selling_price), 0);

        let html = `
            <div class="row">
                <div class="col-md-3 text-center mb-3">
                    <div class="card border-success">
                        <div class="card-body">
                            <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                            <h4 class="text-success">${inStock.length}</h4>
                            <small class="text-muted">In Stock (>10)</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 text-center mb-3">
                    <div class="card border-warning">
                        <div class="card-body">
                            <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                            <h4 class="text-warning">${lowStock.length}</h4>
                            <small class="text-muted">Low Stock (1-10)</small>
                    </div>
                        </div>
                </div>
                <div class="col-md-3 text-center mb-3">
                    <div class="card border-danger">
                        <div class="card-body">
                            <i class="fas fa-times-circle fa-2x text-danger mb-2"></i>
                            <h4 class="text-danger">${outOfStock.length}</h4>
                            <small class="text-muted">Out of Stock</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 text-center mb-3">
                    <div class="card border-info">
                        <div class="card-body">
                            <i class="fas fa-boxes fa-2x text-info mb-2"></i>
                            <h4 class="text-info">${this.products.length}</h4>
                            <small class="text-muted">Total Products</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-md-6">
                    <h6><i class="fas fa-dollar-sign text-success me-2"></i>Inventory Value</h6>
                    <div class="row">
                        <div class="col-6">
                            <small class="text-muted">Cost Value:</small>
                            <br><strong>$${totalValue.toFixed(2)}</strong>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">Retail Value:</small>
                            <br><strong>$${totalRetailValue.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <h6><i class="fas fa-chart-line text-info me-2"></i>Potential Profit</h6>
                    <div class="text-center">
                        <strong class="text-success h5">$${(totalRetailValue - totalValue).toFixed(2)}</strong>
                        <br><small class="text-muted">If all inventory sold</small>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${type === 'danger' ? '<i class="fas fa-exclamation-triangle me-2"></i>' : '<i class="fas fa-check-circle me-2"></i>'}
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container-fluid');
        container.insertBefore(alertDiv, container.firstChild);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, type === 'danger' ? 5000 : 3000);
    }
}

// Global function for export
function exportReport() {
    // Simple CSV export functionality
    const table = document.querySelector('#profitReport table');
    if (!table) {
        alert('No data to export');
        return;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    for (let row of rows) {
        const cols = row.querySelectorAll('td, th');
        const csvRow = [];
        for (let col of cols) {
            csvRow.push('"' + col.textContent.replace(/"/g, '""') + '"');
        }
        csv.push(csvRow.join(','));
    }

    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Initialize reports manager when page loads
let reportsManager;
document.addEventListener('DOMContentLoaded', () => {
    reportsManager = new ReportsManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsManager;
}

