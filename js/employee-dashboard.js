class EmployeeDashboardManager {
    constructor() {
        this.apiBase = '/api';
        this.charts = {};
        this.performanceData = [];
        this.taskAnalytics = [];
        this.platformData = [];
        this.recentActivities = [];
        
        this.init();
    }

    async init() {
        await this.refreshData();
        this.setupDateFilters();
        this.setupEventListeners();
    }

    setupDateFilters() {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        document.getElementById('startDate').value = lastMonth.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    }

    setupEventListeners() {
        // Date range change listeners
        document.getElementById('startDate').addEventListener('change', () => this.refreshData());
        document.getElementById('endDate').addEventListener('change', () => this.refreshData());
    }

    async refreshData() {
        try {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            await Promise.all([
                this.loadDashboardStats(),
                this.loadEmployeePerformance(startDate, endDate),
                this.loadTaskAnalytics(startDate, endDate),
                this.loadPlatformPerformance(startDate, endDate),
                this.loadRecentActivities()
            ]);

            this.updateOverviewStats();
            this.renderCharts();
            this.renderPerformanceTable();
            this.renderRecentActivities();
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh dashboard data');
        }
    }

    async loadDashboardStats() {
        try {
            const response = await fetch(`${this.apiBase}/employee-dashboard`);
            if (response.ok) {
                const data = await response.json();
                this.updateOverviewStats(data);
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    async loadEmployeePerformance(startDate, endDate) {
        try {
            let url = `${this.apiBase}/employee-performance`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (response.ok) {
                this.performanceData = await response.json();
            }
        } catch (error) {
            console.error('Error loading employee performance:', error);
        }
    }

    async loadTaskAnalytics(startDate, endDate) {
        try {
            let url = `${this.apiBase}/task-analytics`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (response.ok) {
                this.taskAnalytics = await response.json();
            }
        } catch (error) {
            console.error('Error loading task analytics:', error);
        }
    }

    async loadPlatformPerformance(startDate, endDate) {
        try {
            let url = `${this.apiBase}/platform-performance`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (response.ok) {
                this.platformData = await response.json();
            }
        } catch (error) {
            console.error('Error loading platform performance:', error);
        }
    }

    async loadRecentActivities() {
        try {
            const response = await fetch(`${this.apiBase}/task-activities?limit=10`);
            if (response.ok) {
                this.recentActivities = await response.json();
            }
        } catch (error) {
            console.error('Error loading recent activities:', error);
        }
    }

    updateOverviewStats(data) {
        if (data) {
            document.getElementById('total-employees').textContent = data.total_employees || 0;
            document.getElementById('active-tasks').textContent = data.active_tasks || 0;
            document.getElementById('completed-today').textContent = data.completed_today || 0;
            document.getElementById('total-revenue').textContent = `$${(data.total_revenue || 0).toFixed(2)}`;
        }

        // Calculate additional stats from performance data
        const totalHours = this.performanceData.reduce((sum, emp) => sum + (emp.total_hours_worked || 0), 0);
        const avgCompletionRate = this.performanceData.length > 0 
            ? this.performanceData.reduce((sum, emp) => sum + (emp.completion_rate || 0), 0) / this.performanceData.length
            : 0;

        document.getElementById('total-hours').textContent = Math.round(totalHours);
        document.getElementById('avg-completion').textContent = `${Math.round(avgCompletionRate)}%`;
    }

    renderCharts() {
        this.renderPerformanceChart();
        this.renderTaskStatusChart();
        this.renderPlatformChart();
        this.renderActivityChart();
    }

    renderPerformanceChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        if (this.charts.performanceChart) {
            this.charts.performanceChart.destroy();
        }

        this.charts.performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.performanceData.map(emp => emp.employee_name),
                datasets: [{
                    label: 'Completed Tasks',
                    data: this.performanceData.map(emp => emp.completed_tasks || 0),
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Revenue Generated',
                    data: this.performanceData.map(emp => emp.total_revenue || 0),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Completed Tasks'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Revenue ($)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    renderTaskStatusChart() {
        const ctx = document.getElementById('taskStatusChart').getContext('2d');
        
        if (this.charts.taskStatusChart) {
            this.charts.taskStatusChart.destroy();
        }

        // Aggregate task status data
        const statusCounts = {
            pending: 0,
            in_progress: 0,
            completed: 0
        };

        this.taskAnalytics.forEach(task => {
            statusCounts[task.status] = (statusCounts[task.status] || 0) + task.task_count;
        });

        this.charts.taskStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'In Progress', 'Completed'],
                datasets: [{
                    data: [statusCounts.pending, statusCounts.in_progress, statusCounts.completed],
                    backgroundColor: [
                        'rgba(108, 117, 125, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(40, 167, 69, 0.8)'
                    ],
                    borderColor: [
                        'rgba(108, 117, 125, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(40, 167, 69, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    renderPlatformChart() {
        const ctx = document.getElementById('platformChart').getContext('2d');
        
        if (this.charts.platformChart) {
            this.charts.platformChart.destroy();
        }

        this.charts.platformChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.platformData.map(platform => platform.platform || 'Unknown'),
                datasets: [{
                    label: 'Total Listings',
                    data: this.platformData.map(platform => platform.total_listings || 0),
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }, {
                    label: 'Published Listings',
                    data: this.platformData.map(platform => platform.published_listings || 0),
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderActivityChart() {
        const ctx = document.getElementById('activityChart').getContext('2d');
        
        if (this.charts.activityChart) {
            this.charts.activityChart.destroy();
        }

        // Generate weekly data from recent activities
        const weeklyData = this.generateWeeklyActivityData();

        this.charts.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    label: 'Activities',
                    data: weeklyData.activities,
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Hours Worked',
                    data: weeklyData.hours,
                    borderColor: 'rgb(255, 159, 64)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                }
            }
        });
    }

    generateWeeklyActivityData() {
        const weeks = [];
        const activities = [];
        const hours = [];
        
        // Generate last 8 weeks
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            weeks.push(`${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
            
            // Filter activities for this week
            const weekActivities = this.recentActivities.filter(activity => {
                const activityDate = new Date(activity.activity_date);
                return activityDate >= weekStart && activityDate <= weekEnd;
            });
            
            activities.push(weekActivities.length);
            hours.push(weekActivities.reduce((sum, activity) => sum + (activity.hours_worked || 0), 0));
        }
        
        return { labels: weeks, activities, hours };
    }

    renderPerformanceTable() {
        const tbody = document.getElementById('performanceTableBody');
        
        if (this.performanceData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted">
                        <i class="fas fa-chart-line fa-2x mb-3 d-block"></i>
                        No performance data available
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.performanceData.map(employee => `
            <tr onclick="dashboardManager.showEmployeeDetails(${employee.employee_id})" style="cursor: pointer;">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                            ${employee.employee_name.charAt(0).toUpperCase()}
                        </div>
                        <strong>${employee.employee_name}</strong>
                    </div>
                </td>
                <td>
                    <span class="badge ${this.getRoleBadgeClass(employee.role)}">
                        ${this.formatRole(employee.role)}
                    </span>
                </td>
                <td>
                    <span class="badge bg-secondary">${employee.total_tasks || 0}</span>
                </td>
                <td>
                    <span class="badge bg-success">${employee.completed_tasks || 0}</span>
                </td>
                <td>
                    <span class="badge bg-warning">${employee.active_tasks || 0}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress me-2" style="width: 60px; height: 20px;">
                            <div class="progress-bar bg-success" style="width: ${employee.completion_rate || 0}%"></div>
                        </div>
                        <small>${Math.round(employee.completion_rate || 0)}%</small>
                    </div>
                </td>
                <td>
                    <span class="badge bg-info">${Math.round(employee.total_hours_worked || 0)}h</span>
                </td>
                <td>
                    <span class="badge bg-primary">$${(employee.total_revenue || 0).toFixed(0)}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="stars me-2">
                            ${this.renderStars(employee.performance_rating)}
                        </div>
                        <small class="text-muted">${employee.performance_rating || 0}/5</small>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderRecentActivities() {
        const tbody = document.getElementById('recentActivitiesBody');
        
        if (this.recentActivities.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        <i class="fas fa-history fa-2x mb-3 d-block"></i>
                        No recent activities
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.recentActivities.map(activity => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                            ${activity.employee_name ? activity.employee_name.charAt(0).toUpperCase() : 'N/A'}
                        </div>
                        <div>
                            <strong>${activity.employee_name || 'Unknown'}</strong>
                            <br><small class="text-muted">${activity.platform || ''}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <small>${activity.product_name || 'N/A'}</small>
                </td>
                <td>
                    <div class="text-truncate" style="max-width: 200px;" title="${activity.description}">
                        ${activity.description}
                    </div>
                </td>
                <td>
                    ${activity.hours_worked ? `<span class="badge bg-info">${activity.hours_worked}h</span>` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    ${activity.status_update ? `<span class="badge ${this.getStatusBadgeClass(activity.status_update)}">${this.formatStatus(activity.status_update)}</span>` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    <small>${this.formatDateTime(activity.activity_date)}</small>
                </td>
            </tr>
        `).join('');
    }

    showEmployeeDetails(employeeId) {
        const employee = this.performanceData.find(emp => emp.employee_id === employeeId);
        if (!employee) return;

        const content = document.getElementById('employeeDetailsContent');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="text-primary">Performance Metrics</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Total Tasks:</strong></td><td>${employee.total_tasks || 0}</td></tr>
                        <tr><td><strong>Completed Tasks:</strong></td><td>${employee.completed_tasks || 0}</td></tr>
                        <tr><td><strong>Active Tasks:</strong></td><td>${employee.active_tasks || 0}</td></tr>
                        <tr><td><strong>Pending Tasks:</strong></td><td>${employee.pending_tasks || 0}</td></tr>
                        <tr><td><strong>Completion Rate:</strong></td><td>${Math.round(employee.completion_rate || 0)}%</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="text-primary">Time & Revenue</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Total Hours:</strong></td><td>${Math.round(employee.total_hours_worked || 0)}h</td></tr>
                        <tr><td><strong>Avg Daily Hours:</strong></td><td>${Math.round(employee.avg_daily_hours || 0)}h</td></tr>
                        <tr><td><strong>Total Activities:</strong></td><td>${employee.total_activities || 0}</td></tr>
                        <tr><td><strong>Total Revenue:</strong></td><td>$${(employee.total_revenue || 0).toFixed(2)}</td></tr>
                        <tr><td><strong>Revenue per Hour:</strong></td><td>$${(employee.revenue_per_hour || 0).toFixed(2)}</td></tr>
                    </table>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="text-primary">Performance Rating</h6>
                    <div class="text-center">
                        <div class="stars mb-2" style="font-size: 2rem;">
                            ${this.renderStars(employee.performance_rating)}
                        </div>
                        <p class="text-muted">${employee.performance_rating || 0} out of 5 stars</p>
                    </div>
                </div>
            </div>
        `;

        new bootstrap.Modal(document.getElementById('employeeDetailsModal')).show();
    }

    getRoleBadgeClass(role) {
        const classes = {
            'employee': 'bg-primary',
            'senior_employee': 'bg-info',
            'team_lead': 'bg-warning',
            'manager': 'bg-danger'
        };
        return classes[role] || 'bg-secondary';
    }

    formatRole(role) {
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    getStatusBadgeClass(status) {
        const classes = {
            'pending': 'bg-secondary',
            'in_progress': 'bg-warning',
            'completed': 'bg-success'
        };
        return classes[status] || 'bg-secondary';
    }

    formatStatus(status) {
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    renderStars(rating) {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        
        for (let i = 0; i < fullStars; i++) {
            stars.push('<i class="fas fa-star text-warning"></i>');
        }
        
        if (hasHalfStar) {
            stars.push('<i class="fas fa-star-half-alt text-warning"></i>');
        }
        
        const emptyStars = 5 - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            stars.push('<i class="far fa-star text-muted"></i>');
        }
        
        return stars.join('');
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString() + ' ' + 
               new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new EmployeeDashboardManager();
});

