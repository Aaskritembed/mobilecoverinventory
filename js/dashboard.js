/**
 * Dashboard Management System
 * Handles all dashboard functionality including statistics, charts, and data visualization
 */
class Dashboard {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }

    async init() {
        await this.loadDashboardData();
        this.setupEventListeners();
    }

    async loadDashboardData() {
        try {
            // Load main dashboard data
            const response = await fetch(`${this.apiBase}/dashboard`);
            if (response.ok) {
                const data = await response.json();
                this.updateStatistics(data);
                this.displayLowStockProducts(data.low_stock_products || []);
                this.displayRecentSales(data.recent_sales || []);
            } else {
                this.showError('Failed to load dashboard data');
            }

            // Load employee statistics
            await this.loadEmployeeStats();
            
            // Load returns statistics
            await this.loadReturnsStats();
        } catch (error) {
            this.showError('Error loading dashboard data');
        }
    }

    async loadEmployeeStats() {
        try {
            // Load employee dashboard stats
            const employeeResponse = await fetch(`${this.apiBase}/employee-dashboard`);
            if (employeeResponse.ok) {
                const employeeData = await employeeResponse.json();
                this.updateEmployeeStats(employeeData);
            }

            // Load active tasks
            const tasksResponse = await fetch(`${this.apiBase}/employee-tasks?status=active`);
            if (tasksResponse.ok) {
                const activeTasks = await tasksResponse.json();
                document.getElementById('active-tasks').textContent = activeTasks.length;
                
                // Count pending tasks
                const pendingTasks = activeTasks.filter(task => task.status === 'pending').length;
                document.getElementById('pending-tasks').textContent = pendingTasks;
            }

            // Load weekly hours
            await this.loadWeeklyHours();
        } catch (error) {
            // Handle silently for employee stats
        }
    }

    async loadReturnsStats() {
        try {
            // Load returns summary stats
            const response = await fetch(`${this.apiBase}/returns-summary`);
            if (response.ok) {
                const data = await response.json();
                this.updateReturnsStats(data);
                this.displayRecentReturns(data.recent_returns || []);
            }
        } catch (error) {
            // Handle silently for returns stats
        }
    }

    async loadWeeklyHours() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);

            const response = await fetch(
                `${this.apiBase}/task-activities?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
            );
            if (response.ok) {
                const activities = await response.json();
                const weeklyHours = activities.reduce((sum, activity) => sum + (activity.hours_worked || 0), 0);
                document.getElementById('weekly-hours').textContent = Math.round(weeklyHours);
            }
        } catch (error) {
            // Handle silently for weekly hours
        }
    }

    updateStatistics(data) {
        // Update total products
        document.getElementById('total-products').textContent = data.total_products || 0;

        // Update total sales
        document.getElementById('total-sales').textContent = data.total_sales || 0;

        // Update total revenue
        const revenue = data.total_revenue || 0;
        document.getElementById('total-revenue').textContent = this.formatCurrency(revenue);

        // Update low stock count
        const lowStockCount = data.low_stock_products ? data.low_stock_products.length : 0;
        document.getElementById('low-stock-count').textContent = lowStockCount;
    }

    updateEmployeeStats(data) {
        // Update total employees
        document.getElementById('total-employees').textContent = data.total_employees || 0;
    }

    updateReturnsStats(data) {
        // Add returns statistics cards to the dashboard
        this.addReturnsStatsCards(data);
    }

    addReturnsStatsCards(data) {
        // Check if returns stats cards already exist
        let returnsSection = document.getElementById('returns-stats-section');
        if (!returnsSection) {
            // Create returns section after employee stats
            const employeeStatsRow = document.querySelector('.row.mb-4:last-of-type');
            if (employeeStatsRow) {
                returnsSection = document.createElement('div');
                returnsSection.id = 'returns-stats-section';
                returnsSection.className = 'row mb-4';
                
                returnsSection.innerHTML = `
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-left-primary shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">
                                            Total Returns
                                        </div>
                                        <div class="h5 mb-0 font-weight-bold text-gray-800" id="total-returns">${data.total_returns || 0}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-undo fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-left-warning shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">
                                            Pending Returns
                                        </div>
                                        <div class="h5 mb-0 font-weight-bold text-gray-800" id="pending-returns">${data.pending_returns || 0}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-clock fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-left-success shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs font-weight-bold text-success text-uppercase mb-1">
                                            Approved Returns
                                        </div>
                                        <div class="h5 mb-0 font-weight-bold text-gray-800" id="approved-returns">${data.approved_returns || 0}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-check fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-left-info shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs font-weight-bold text-info text-uppercase mb-1">
                                            Total Refunds
                                        </div>
                                        <div class="h5 mb-0 font-weight-bold text-gray-800" id="total-refunds">${this.formatCurrency(data.total_refund_amount || 0)}</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="fas fa-dollar-sign fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Insert after employee stats row
                employeeStatsRow.parentNode.insertBefore(returnsSection, employeeStatsRow.nextSibling);
            }
        } else {
            // Update existing cards
            document.getElementById('total-returns').textContent = data.total_returns || 0;
            document.getElementById('pending-returns').textContent = data.pending_returns || 0;
            document.getElementById('approved-returns').textContent = data.approved_returns || 0;
            document.getElementById('total-refunds').textContent = this.formatCurrency(data.total_refund_amount || 0);
        }
    }

    displayRecentReturns(returns) {
        // Add recent returns section to dashboard
        let recentReturnsSection = document.getElementById('recent-returns-section');
        if (!recentReturnsSection) {
            const recentSalesSection = document.getElementById('recent-sales');
            if (recentSalesSection) {
                recentReturnsSection = document.createElement('div');
                recentReturnsSection.id = 'recent-returns-section';
                recentReturnsSection.className = 'col-lg-6 mb-4';
                
                recentReturnsSection.innerHTML = `
                    <div class="card shadow">
                        <div class="card-header py-3">
                            <h6 class="m-0 font-weight-bold text-primary">
                                <i class="fas fa-undo me-2"></i>Recent Returns
                            </h6>
                        </div>
                        <div class="card-body">
                            <div id="recent-returns">
                                <div class="text-center py-3">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Insert next to recent sales
                const recentSalesCard = recentSalesSection.closest('.col-lg-6');
                recentSalesCard.parentNode.insertBefore(recentReturnsSection, recentSalesCard.nextSibling);
            }
        }
        
        // Update recent returns content
        const container = document.getElementById('recent-returns');
        if (container && returns.length > 0) {
            let html = '<div class="list-group list-group-flush">';
            returns.slice(0, 5).forEach(returnItem => {
                const returnDate = new Date(returnItem.return_date).toLocaleDateString();
                const statusBadge = this.getReturnStatusBadge(returnItem.return_status);
                html += `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${returnItem.customer_name}</h6>
                            <small class="text-muted">${returnDate}</small>
                            <div class="mt-1">${statusBadge}</div>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold">${returnItem.product_name || 'Unknown Product'}</div>
                            <small class="text-muted">${returnItem.return_reason}</small>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        }
    }

    getReturnStatusBadge(status) {
        const badges = {
            'pending': '<span class="badge bg-warning">Pending</span>',
            'approved': '<span class="badge bg-info">Approved</span>',
            'rejected': '<span class="badge bg-danger">Rejected</span>',
            'refunded': '<span class="badge bg-success">Refunded</span>',
            'processed': '<span class="badge bg-secondary">Processed</span>',
            'cancelled': '<span class="badge bg-dark">Cancelled</span>'
        };
        return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
    }

    displayLowStockProducts(products) {
        const container = document.getElementById('low-stock-products');
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="text-center py-3">
                    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <p class="text-muted">No low stock items!</p>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        products.forEach(product => {
            const stockClass = product.quantity === 0 ? 'danger' : 'warning';
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${product.name}</h6>
                        <small class="text-muted">${product.category || 'Uncategorized'}</small>
                    </div>
                    <span class="badge badge-${stockClass}">${product.quantity} left</span>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    displayRecentSales(sales) {
        const container = document.getElementById('recent-sales');
        
        if (sales.length === 0) {
            container.innerHTML = `
                <div class="text-center py-3">
                    <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No recent sales</p>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        sales.slice(0, 5).forEach(sale => {
            const saleDate = new Date(sale.sale_date).toLocaleDateString();
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${sale.product_name || 'Unknown Product'}</h6>
                        <small class="text-muted">${saleDate}</small>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold">${this.formatCurrency(sale.total_amount)}</div>
                        <small class="text-muted">Qty: ${sale.quantity_sold}</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    setupEventListeners() {
        // Auto-refresh dashboard every 30 seconds
        setInterval(() => {
            this.loadDashboardData();
        }, 30000);

        // Add click handlers for quick action buttons if needed
        const quickActionButtons = document.querySelectorAll('.quick-action');
        quickActionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    async handleQuickAction(action) {
        switch (action) {
            case 'add-product':
                window.location.href = 'add-product.html';
                break;
            case 'record-sale':
                window.location.href = 'sales.html';
                break;
            case 'view-products':
                window.location.href = 'products.html';
                break;
            case 'view-reports':
                window.location.href = 'reports.html';
                break;
            default:
                // Handle unknown action silently
                break;
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    showError(message) {
        // Create error alert
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Add to top of container
        const container = document.querySelector('.container-fluid');
        container.insertBefore(alertDiv, container.firstChild);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showSuccess(message) {
        // Create success alert
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="fas fa-check-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Add to top of container
        const container = document.querySelector('.container-fluid');
        container.insertBefore(alertDiv, container.firstChild);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
}
