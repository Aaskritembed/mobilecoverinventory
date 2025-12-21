
class WorkTrackerManager {
    constructor() {
        this.apiBase = '/api';
        this.employees = [];
        this.tasks = [];
        this.activities = [];
        this.currentActivity = null;
        this.selectedEmployee = '';
        this.selectedDate = '';
        
        this.init();
    }

    async init() {
        await this.loadEmployees();
        await this.loadTasks();
        this.setupDatePicker();
        this.setupEventListeners();
        this.loadDefaultData();
    }

    setupDatePicker() {
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('activityDate').value = today;
        this.selectedDate = today;
        
        // Set date pickers for modals
        document.getElementById('editActivityDate').value = today;
    }

    setupEventListeners() {
        // Quick Activity Form
        document.getElementById('quickActivityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.logQuickActivity();
        });

        // Edit Activity Form
        document.getElementById('editActivityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateActivity();
        });

        // Employee and Date filters
        document.getElementById('employeeSelect').addEventListener('change', (e) => {
            this.selectedEmployee = e.target.value;
            this.updateQuickTaskFilter();
            this.loadActivities();
        });

        document.getElementById('activityDate').addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this.loadActivities();
        });

        // Quick form employee change
        document.getElementById('quickEmployee').addEventListener('change', () => {
            this.updateQuickTaskFilter();
        });

        // Activity details modal buttons
        document.getElementById('editActivityBtn').addEventListener('click', () => {
            if (this.currentActivity) {
                this.openEditActivityModal();
            }
        });

        document.getElementById('deleteActivityBtn').addEventListener('click', () => {
            if (this.currentActivity) {
                this.deleteActivity();
            }
        });
    }

    loadDefaultData() {
        // Set default employee if only one active employee
        if (this.employees.length === 1) {
            const employeeId = this.employees[0].id;
            document.getElementById('employeeSelect').value = employeeId;
            document.getElementById('quickEmployee').value = employeeId;
            this.selectedEmployee = employeeId.toString();
            this.updateQuickTaskFilter();
        }
        
        this.loadActivities();
    }

    async loadEmployees() {
        try {
            const response = await fetch(`${this.apiBase}/employees`);
            if (response.ok) {
                this.employees = await response.json();
                this.populateEmployeeSelects();
            }
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }

    async loadTasks() {
        try {
            const response = await fetch(`${this.apiBase}/employee-tasks`);
            if (response.ok) {
                this.tasks = await response.json();
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    populateEmployeeSelects() {
        const selects = ['employeeSelect', 'quickEmployee'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Employee</option>';
                this.employees.forEach(employee => {
                    if (employee.is_active) {
                        const option = document.createElement('option');
                        option.value = employee.id;
                        option.textContent = employee.name;
                        select.appendChild(option);
                    }
                });
            }
        });
    }

    updateQuickTaskFilter() {
        const quickTaskSelect = document.getElementById('quickTask');
        if (quickTaskSelect && this.selectedEmployee) {
            // Filter tasks for selected employee
            const employeeTasks = this.tasks.filter(task => 
                task.employee_id.toString() === this.selectedEmployee && 
                (task.status === 'pending' || task.status === 'in_progress')
            );
            
            quickTaskSelect.innerHTML = '<option value="">Select Task (Optional)</option>';
            employeeTasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.id;
                option.textContent = `${task.product_name || 'N/A'} - ${task.platform || 'No Platform'}`;
                quickTaskSelect.appendChild(option);
            });
        }
    }

    async loadActivities() {
        if (!this.selectedEmployee || !this.selectedDate) {
            this.showError('Please select an employee and date');
            return;
        }

        try {
            const response = await fetch(
                `${this.apiBase}/task-activities?employee_id=${this.selectedEmployee}&date=${this.selectedDate}`
            );
            if (response.ok) {
                this.activities = await response.json();
                this.renderActivityTimeline();
                this.updateTodayStats();
                this.loadActiveTasks();
                this.loadWeeklySummary();
            } else {
                throw new Error('Failed to load activities');
            }
        } catch (error) {
            console.error('Error loading activities:', error);
            this.showError('Failed to load activities');
        }
    }

    updateTodayStats() {
        const totalHours = this.activities.reduce((sum, activity) => sum + (activity.hours_worked || 0), 0);
        const totalActivities = this.activities.length;
        const completedTasks = this.activities.filter(activity => activity.status_update === 'completed').length;
        const avgHoursPerTask = totalActivities > 0 ? totalHours / totalActivities : 0;

        document.getElementById('total-hours-today').textContent = `${totalHours.toFixed(1)}h`;
        document.getElementById('activities-today').textContent = totalActivities;
        document.getElementById('tasks-completed').textContent = completedTasks;
        document.getElementById('avg-hours-task').textContent = `${avgHoursPerTask.toFixed(1)}h`;
    }

    renderActivityTimeline() {
        const timeline = document.getElementById('activityTimeline');
        
        if (this.activities.length === 0) {
            timeline.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-clock fa-3x text-muted mb-3 d-block"></i>
                    <h5 class="text-muted">No activities logged for this day</h5>
                    <p class="text-muted">Add your first activity using the form above</p>
                </div>
            `;
            return;
        }

        // Sort activities by time (newest first)
        const sortedActivities = [...this.activities].sort((a, b) => 
            new Date(b.activity_date) - new Date(a.activity_date)
        );

        timeline.innerHTML = sortedActivities.map(activity => `
            <div class="timeline-item" style="position: relative; padding-left: 30px; margin-bottom: 20px;">
                <div class="timeline-marker" style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; border-radius: 50%; background: ${this.getActivityColor(activity)}; border: 2px solid white; box-shadow: 0 0 0 2px ${this.getActivityColor(activity)};"></div>
                <div class="timeline-content">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">${activity.product_name || 'General Activity'}</h6>
                        <div class="d-flex align-items-center gap-2">
                            ${activity.hours_worked ? `<span class="badge bg-info">${activity.hours_worked}h</span>` : ''}
                            <small class="text-muted">${this.formatTime(activity.activity_date)}</small>
                            <button class="btn btn-sm btn-outline-primary" onclick="workTrackerManager.showActivityDetails(${activity.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-2 text-muted">${activity.description}</p>
                    <div class="d-flex gap-2 align-items-center">
                        ${activity.status_update ? `<span class="badge ${this.getStatusBadgeClass(activity.status_update)}">${this.formatStatus(activity.status_update)}</span>` : ''}
                        <span class="badge bg-secondary">${activity.platform || 'No Platform'}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add timeline line
        if (this.activities.length > 0) {
            timeline.innerHTML = `
                <div style="position: absolute; left: 6px; top: 0; bottom: 0; width: 2px; background: #e9ecef;"></div>
                ${timeline.innerHTML}
            `;
        }
    }

    getActivityColor(activity) {
        if (activity.status_update === 'completed') return '#28a745';
        if (activity.status_update === 'in_progress') return '#ffc107';
        return '#6c757d';
    }

    loadActiveTasks() {
        const activeTasksList = document.getElementById('activeTasksList');
        
        if (!this.selectedEmployee) {
            activeTasksList.innerHTML = '<p class="text-muted text-center">Select an employee to view active tasks</p>';
            return;
        }

        const activeTasks = this.tasks.filter(task => 
            task.employee_id.toString() === this.selectedEmployee && 
            (task.status === 'pending' || task.status === 'in_progress')
        );

        if (activeTasks.length === 0) {
            activeTasksList.innerHTML = `
                <div class="text-center p-3">
                    <i class="fas fa-tasks fa-2x text-muted mb-2 d-block"></i>
                    <small class="text-muted">No active tasks</small>
                </div>
            `;
            return;
        }

        activeTasksList.innerHTML = activeTasks.map(task => `
            <div class="task-item mb-3 p-2 border rounded">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${task.product_name || 'N/A'}</h6>
                        <small class="text-muted">${task.platform || 'No Platform'}</small>
                    </div>
                    <span class="badge ${this.getStatusBadgeClass(task.status)}">${this.formatStatus(task.status)}</span>
                </div>
                <div class="mt-2">
                    <small class="text-muted">
                        Progress: ${task.completed_hours || 0}/${task.estimated_hours || 0}h
                    </small>
                    <div class="progress mt-1" style="height: 4px;">
                        <div class="progress-bar ${this.getProgressBarClass(task.status)}" 
                             style="width: ${this.calculateProgress(task)}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadWeeklySummary() {
        if (!this.selectedEmployee) return;

        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);

            const response = await fetch(
                `${this.apiBase}/task-activities?employee_id=${this.selectedEmployee}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
            );
            if (response.ok) {
                const weeklyActivities = await response.json();
                
                const weeklyHours = weeklyActivities.reduce((sum, activity) => sum + (activity.hours_worked || 0), 0);
                const weeklyProgress = Math.min((weeklyHours / 40) * 100, 100); // Assuming 40-hour goal

                document.getElementById('weekly-hours').textContent = `${weeklyHours.toFixed(1)}h`;
                document.getElementById('weekly-activities').textContent = weeklyActivities.length;
                document.getElementById('weekly-progress').style.width = `${weeklyProgress}%`;
            }
        } catch (error) {
            console.error('Error loading weekly summary:', error);
        }
    }

    async logQuickActivity() {
        const activityData = {
            employee_id: parseInt(document.getElementById('quickEmployee').value),
            task_id: document.getElementById('quickTask').value ? parseInt(document.getElementById('quickTask').value) : null,
            activity_date: this.selectedDate,
            hours_worked: parseFloat(document.getElementById('quickHours').value) || 0,
            status_update: document.getElementById('quickStatus').value,
            description: document.getElementById('quickDescription').value
        };

        try {
            const response = await fetch(`${this.apiBase}/task-activities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(activityData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('Activity logged successfully');
                this.resetQuickForm();
                this.loadActivities();
            } else {
                this.showError(result.error || 'Failed to log activity');
            }
        } catch (error) {
            console.error('Error logging activity:', error);
            this.showError('Failed to log activity');
        }
    }

    async showActivityDetails(activityId) {
        try {
            const response = await fetch(`${this.apiBase}/task-activities/${activityId}`);
            if (response.ok) {
                const activity = await response.json();
                this.currentActivity = activity;
                this.renderActivityDetails(activity);
                new bootstrap.Modal(document.getElementById('activityDetailsModal')).show();
            } else {
                this.showError('Failed to load activity details');
            }
        } catch (error) {
            console.error('Error loading activity:', error);
            this.showError('Failed to load activity details');
        }
    }

    renderActivityDetails(activity) {
        const content = document.getElementById('activityDetailsContent');
        content.innerHTML = `
            <div class="row">
                <div class="col-12">
                    <h6 class="text-primary">Activity Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Employee:</strong></td><td>${activity.employee_name}</td></tr>
                        <tr><td><strong>Date:</strong></td><td>${this.formatDateTime(activity.activity_date)}</td></tr>
                        <tr><td><strong>Hours Worked:</strong></td><td>${activity.hours_worked || 0}h</td></tr>
                        <tr><td><strong>Task:</strong></td><td>${activity.product_name || 'N/A'}</td></tr>
                        <tr><td><strong>Platform:</strong></td><td>${activity.platform || 'N/A'}</td></tr>
                        <tr><td><strong>Status Update:</strong></td><td>${activity.status_update ? `<span class="badge ${this.getStatusBadgeClass(activity.status_update)}">${this.formatStatus(activity.status_update)}</span>` : 'No change'}</td></tr>
                    </table>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="text-primary">Description</h6>
                    <div class="border rounded p-3">
                        ${activity.description}
                    </div>
                </div>
            </div>
        `;
    }

    openEditActivityModal() {
        document.getElementById('editActivityId').value = this.currentActivity.id;
        document.getElementById('editActivityDate').value = this.currentActivity.activity_date.split('T')[0];
        document.getElementById('editActivityHours').value = this.currentActivity.hours_worked || 0;
        document.getElementById('editActivityStatus').value = this.currentActivity.status_update || '';
        document.getElementById('editActivityDescription').value = this.currentActivity.description;
        
        new bootstrap.Modal(document.getElementById('editActivityModal')).show();
    }

    async updateActivity() {
        const activityId = document.getElementById('editActivityId').value;
        
        const activityData = {
            activity_date: document.getElementById('editActivityDate').value,
            hours_worked: parseFloat(document.getElementById('editActivityHours').value) || 0,
            status_update: document.getElementById('editActivityStatus').value,
            description: document.getElementById('editActivityDescription').value
        };

        try {
            const response = await fetch(`${this.apiBase}/task-activities/${activityId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(activityData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('Activity updated successfully');
                bootstrap.Modal.getInstance(document.getElementById('editActivityModal')).hide();
                this.loadActivities();
            } else {
                this.showError(result.error || 'Failed to update activity');
            }
        } catch (error) {
            console.error('Error updating activity:', error);
            this.showError('Failed to update activity');
        }
    }

    async deleteActivity() {
        if (!this.currentActivity) return;

        if (confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
            try {
                const response = await fetch(`${this.apiBase}/task-activities/${this.currentActivity.id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.showSuccess('Activity deleted successfully');
                    bootstrap.Modal.getInstance(document.getElementById('activityDetailsModal')).hide();
                    this.loadActivities();
                } else {
                    const result = await response.json();
                    this.showError(result.error || 'Failed to delete activity');
                }
            } catch (error) {
                console.error('Error deleting activity:', error);
                this.showError('Failed to delete activity');
            }
        }
    }

    resetQuickForm() {
        document.getElementById('quickActivityForm').reset();
        // Reset date to current selected date
        document.getElementById('activityDate').value = this.selectedDate;
        // Keep the same employee selected
        if (this.selectedEmployee) {
            document.getElementById('quickEmployee').value = this.selectedEmployee;
            this.updateQuickTaskFilter();
        }
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

    getProgressBarClass(status) {
        const classes = {
            'pending': 'bg-secondary',
            'in_progress': 'bg-warning',
            'completed': 'bg-success'
        };
        return classes[status] || 'bg-secondary';
    }

    calculateProgress(task) {
        if (!task.estimated_hours || task.estimated_hours === 0) {
            return task.status === 'completed' ? 100 : 0;
        }
        const progress = (task.completed_hours / task.estimated_hours) * 100;
        return Math.min(Math.max(progress, 0), 100);
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString() + ' ' + 
               new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    formatTime(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
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
    window.workTrackerManager = new WorkTrackerManager();
});

