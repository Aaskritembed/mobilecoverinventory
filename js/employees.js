class EmployeeManager {
    constructor() {
        this.apiBase = '/api';
        this.employees = [];
        this.currentEmployee = null;
        this.filteredEmployees = [];
        
        this.init();
    }

    async init() {
        await this.loadEmployeeDashboard();
        await this.loadEmployees();
        this.setupEventListeners();
        this.setupFilters();
    }

    async loadEmployeeDashboard() {
        try {
            const response = await fetch(`${this.apiBase}/employee-dashboard`);
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardStats(data);
            }
        } catch (error) {
            console.error('Error loading employee dashboard:', error);
        }
    }

    updateDashboardStats(data) {
        document.getElementById('total-employees').textContent = data.total_employees || 0;
        document.getElementById('active-tasks').textContent = data.active_tasks || 0;
        document.getElementById('completed-today').textContent = data.completed_today || 0;
        document.getElementById('total-revenue').textContent = `$${(data.total_revenue || 0).toFixed(2)}`;
    }

    async loadEmployees() {
        try {
            const response = await fetch(`${this.apiBase}/employees`);
            if (response.ok) {
                this.employees = await response.json();
                this.filteredEmployees = [...this.employees];
                this.renderEmployees();
            } else {
                throw new Error('Failed to load employees');
            }
        } catch (error) {
            console.error('Error loading employees:', error);
            this.showError('Failed to load employees');
        }
    }

    renderEmployees() {
        const tbody = document.getElementById('employeesTableBody');
        
        if (this.filteredEmployees.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-muted">
                        <i class="fas fa-users fa-2x mb-3 d-block"></i>
                        No employees found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredEmployees.map(employee => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                            ${employee.name.charAt(0).toUpperCase()}
                        </div>
                        <strong>${employee.name}</strong>
                    </div>
                </td>
                <td>${employee.email}</td>
                <td>${employee.phone || 'N/A'}</td>
                <td>
                    <span class="badge ${this.getRoleBadgeClass(employee.role)}">
                        ${this.formatRole(employee.role)}
                    </span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="stars me-2">
                            ${this.renderStars(employee.performance_rating)}
                        </div>
                        <small class="text-muted">${employee.performance_rating || 0}/5</small>
                    </div>
                </td>
                <td>
                    <span class="badge bg-secondary">${employee.total_tasks || 0}</span>
                </td>
                <td>
                    <span class="badge bg-warning">${employee.active_tasks || 0}</span>
                </td>
                <td>
                    <span class="badge bg-success">${employee.completed_tasks || 0}</span>
                </td>
                <td>${this.formatDate(employee.hire_date)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm btn-info" onclick="employeeManager.viewEmployee(${employee.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-warning" onclick="employeeManager.editEmployee(${employee.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="employeeManager.deleteEmployee(${employee.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
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

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    }

    setupEventListeners() {
        // Add Employee Form
        document.getElementById('addEmployeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addEmployee();
        });

        // Edit Employee Form
        document.getElementById('editEmployeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateEmployee();
        });

        // Edit from details modal
        document.getElementById('editFromDetails').addEventListener('click', () => {
            if (this.currentEmployee) {
                this.editEmployee(this.currentEmployee.id);
            }
        });
    }

    setupFilters() {
        const searchInput = document.getElementById('searchEmployees');
        const roleFilter = document.getElementById('roleFilter');
        const statusFilter = document.getElementById('statusFilter');

        searchInput.addEventListener('input', () => this.applyFilters());
        roleFilter.addEventListener('change', () => this.applyFilters());
        statusFilter.addEventListener('change', () => this.applyFilters());
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchEmployees').value.toLowerCase();
        const roleFilter = document.getElementById('roleFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredEmployees = this.employees.filter(employee => {
            const matchesSearch = employee.name.toLowerCase().includes(searchTerm) ||
                                employee.email.toLowerCase().includes(searchTerm) ||
                                (employee.phone && employee.phone.toLowerCase().includes(searchTerm));
            
            const matchesRole = !roleFilter || employee.role === roleFilter;
            const matchesStatus = !statusFilter || employee.is_active.toString() === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });

        this.renderEmployees();
    }

    async addEmployee() {
        const form = document.getElementById('addEmployeeForm');
        const formData = new FormData(form);
        
        const employeeData = {
            name: document.getElementById('employeeName').value,
            email: document.getElementById('employeeEmail').value,
            phone: document.getElementById('employeePhone').value,
            role: document.getElementById('employeeRole').value,
            hire_date: document.getElementById('hireDate').value,
            salary: parseFloat(document.getElementById('salary').value) || null,
            performance_rating: parseFloat(document.getElementById('performanceRating').value) || 0
        };

        try {
            const response = await fetch(`${this.apiBase}/employees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(employeeData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('Employee added successfully');
                this.loadEmployees();
                this.loadEmployeeDashboard();
                this.resetForm('addEmployeeForm');
                bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal')).hide();
            } else {
                this.showError(result.error || 'Failed to add employee');
            }
        } catch (error) {
            console.error('Error adding employee:', error);
            this.showError('Failed to add employee');
        }
    }

    async editEmployee(id) {
        try {
            const response = await fetch(`${this.apiBase}/employees/${id}`);
            if (response.ok) {
                const employee = await response.json();
                this.currentEmployee = employee;
                this.populateEditForm(employee);
                new bootstrap.Modal(document.getElementById('editEmployeeModal')).show();
            } else {
                this.showError('Failed to load employee details');
            }
        } catch (error) {
            console.error('Error loading employee:', error);
            this.showError('Failed to load employee details');
        }
    }

    populateEditForm(employee) {
        document.getElementById('editEmployeeId').value = employee.id;
        document.getElementById('editEmployeeName').value = employee.name;
        document.getElementById('editEmployeeEmail').value = employee.email;
        document.getElementById('editEmployeePhone').value = employee.phone || '';
        document.getElementById('editEmployeeRole').value = employee.role;
        document.getElementById('editHireDate').value = employee.hire_date || '';
        document.getElementById('editSalary').value = employee.salary || '';
        document.getElementById('editPerformanceRating').value = employee.performance_rating || 0;
        document.getElementById('editIsActive').value = employee.is_active ? '1' : '0';
    }

    async updateEmployee() {
        const employeeId = document.getElementById('editEmployeeId').value;
        
        const employeeData = {
            name: document.getElementById('editEmployeeName').value,
            email: document.getElementById('editEmployeeEmail').value,
            phone: document.getElementById('editEmployeePhone').value,
            role: document.getElementById('editEmployeeRole').value,
            hire_date: document.getElementById('editHireDate').value,
            salary: parseFloat(document.getElementById('editSalary').value) || null,
            performance_rating: parseFloat(document.getElementById('editPerformanceRating').value) || 0,
            is_active: document.getElementById('editIsActive').value === '1'
        };

        try {
            const response = await fetch(`${this.apiBase}/employees/${employeeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(employeeData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('Employee updated successfully');
                this.loadEmployees();
                this.loadEmployeeDashboard();
                bootstrap.Modal.getInstance(document.getElementById('editEmployeeModal')).hide();
            } else {
                this.showError(result.error || 'Failed to update employee');
            }
        } catch (error) {
            console.error('Error updating employee:', error);
            this.showError('Failed to update employee');
        }
    }

    async deleteEmployee(id) {
        const employee = this.employees.find(emp => emp.id === id);
        if (!employee) return;

        if (confirm(`Are you sure you want to delete ${employee.name}? This action cannot be undone.`)) {
            try {
                const response = await fetch(`${this.apiBase}/employees/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.showSuccess('Employee deleted successfully');
                    this.loadEmployees();
                    this.loadEmployeeDashboard();
                } else {
                    const result = await response.json();
                    this.showError(result.error || 'Failed to delete employee');
                }
            } catch (error) {
                console.error('Error deleting employee:', error);
                this.showError('Failed to delete employee');
            }
        }
    }

    async viewEmployee(id) {
        try {
            const response = await fetch(`${this.apiBase}/employees/${id}`);
            if (response.ok) {
                const employee = await response.json();
                this.currentEmployee = employee;
                this.renderEmployeeDetails(employee);
                new bootstrap.Modal(document.getElementById('employeeDetailsModal')).show();
            } else {
                this.showError('Failed to load employee details');
            }
        } catch (error) {
            console.error('Error loading employee:', error);
            this.showError('Failed to load employee details');
        }
    }

    renderEmployeeDetails(employee) {
        const content = document.getElementById('employeeDetailsContent');
        
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="text-primary">Personal Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Name:</strong></td><td>${employee.name}</td></tr>
                        <tr><td><strong>Email:</strong></td><td>${employee.email}</td></tr>
                        <tr><td><strong>Phone:</strong></td><td>${employee.phone || 'N/A'}</td></tr>
                        <tr><td><strong>Role:</strong></td><td><span class="badge ${this.getRoleBadgeClass(employee.role)}">${this.formatRole(employee.role)}</span></td></tr>
                        <tr><td><strong>Hire Date:</strong></td><td>${this.formatDate(employee.hire_date)}</td></tr>
                        <tr><td><strong>Status:</strong></td><td><span class="badge ${employee.is_active ? 'bg-success' : 'bg-danger'}">${employee.is_active ? 'Active' : 'Inactive'}</span></td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="text-primary">Performance & Salary</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Salary:</strong></td><td>${employee.salary ? `$${employee.salary.toLocaleString()}` : 'N/A'}</td></tr>
                        <tr><td><strong>Performance Rating:</strong></td><td><div class="d-flex align-items-center">${this.renderStars(employee.performance_rating)} <span class="ms-2">${employee.performance_rating || 0}/5</span></div></td></tr>
                        <tr><td><strong>Total Tasks:</strong></td><td><span class="badge bg-secondary">${employee.total_tasks || 0}</span></td></tr>
                        <tr><td><strong>Active Tasks:</strong></td><td><span class="badge bg-warning">${employee.active_tasks || 0}</span></td></tr>
                        <tr><td><strong>Completed Tasks:</strong></td><td><span class="badge bg-success">${employee.completed_tasks || 0}</span></td></tr>
                    </table>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="text-primary">Recent Activity</h6>
                    <div class="border rounded p-3" style="max-height: 200px; overflow-y: auto;">
                        ${employee.recent_activities && employee.recent_activities.length > 0 
                            ? employee.recent_activities.map(activity => `
                                <div class="mb-2 pb-2 border-bottom">
                                    <small class="text-muted">${new Date(activity.created_time).toLocaleString()}</small>
                                    <div>${activity.description}</div>
                                </div>
                            `).join('')
                            : '<p class="text-muted">No recent activity</p>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    resetForm(formId) {
        document.getElementById(formId).reset();
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
    window.employeeManager = new EmployeeManager();
});
