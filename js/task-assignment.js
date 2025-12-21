class TaskAssignmentManager {
    constructor() {
        this.apiBase = '/api';
        this.tasks = [];
        this.employees = [];
        this.products = [];
        this.currentTask = null;
        this.filteredTasks = [];
        this.customPlatforms = [];
        this.selectedPlatforms = new Set();
        
        this.init();
    }

    async init() {
        await this.loadEmployees();
        await this.loadProducts();
        await this.loadTasks();
        await this.loadCustomPlatforms();
        this.setupEventListeners();
        this.setupFilters();
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

    async loadProducts() {
        try {
            const response = await fetch(`${this.apiBase}/products`);
            if (response.ok) {
                this.products = await response.json();
                this.populateProductSelects();
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async loadCustomPlatforms() {
        // Load from localStorage for now (could be enhanced to load from API)
        const stored = localStorage.getItem('customPlatforms');
        if (stored) {
            this.customPlatforms = JSON.parse(stored);
        }
        this.renderCustomPlatforms();
    }

    saveCustomPlatforms() {
        localStorage.setItem('customPlatforms', JSON.stringify(this.customPlatforms));
    }

    populateEmployeeSelects() {
        const selects = ['taskEmployee', 'editTaskEmployee'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Employee</option>';
                this.employees.forEach(employee => {
                    if (employee.is_active) {
                        const option = document.createElement('option');
                        option.value = employee.id;
                        option.textContent = `${employee.name} (${this.formatRole(employee.role)})`;
                        select.appendChild(option);
                    }
                });
            }
        });

        // Update employee filter
        const employeeFilter = document.getElementById('employeeFilter');
        if (employeeFilter) {
            employeeFilter.innerHTML = '<option value="">All Employees</option>';
            this.employees.forEach(employee => {
                if (employee.is_active) {
                    const option = document.createElement('option');
                    option.value = employee.id;
                    option.textContent = employee.name;
                    employeeFilter.appendChild(option);
                }
            });
        }
    }

    populateProductSelects() {
        const selects = ['taskProduct', 'editTaskProduct'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Product (Optional)</option>';
                this.products.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = `${product.brand} ${product.model} (${product.color})`;
                    select.appendChild(option);
                });
            }
        });
    }

    async loadTasks() {
        try {
            const response = await fetch(`${this.apiBase}/employee-tasks`);
            if (response.ok) {
                this.tasks = await response.json();
                this.filteredTasks = [...this.tasks];
                this.renderTasks();
                this.updateTaskStats();
            } else {
                throw new Error('Failed to load tasks');
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showError('Failed to load tasks');
        }
    }

    updateTaskStats() {
        const total = this.tasks.length;
        const pending = this.tasks.filter(task => task.status === 'pending').length;
        const inProgress = this.tasks.filter(task => task.status === 'in_progress').length;
        const completed = this.tasks.filter(task => task.status === 'completed').length;

        document.getElementById('total-tasks').textContent = total;
        document.getElementById('pending-tasks').textContent = pending;
        document.getElementById('in-progress-tasks').textContent = inProgress;
        document.getElementById('completed-tasks').textContent = completed;
    }

    renderTasks() {
        const tbody = document.getElementById('tasksTableBody');
        
        if (this.filteredTasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted">
                        <i class="fas fa-tasks fa-2x mb-3 d-block"></i>
                        No tasks found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredTasks.map(task => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                            ${task.employee_name ? task.employee_name.charAt(0).toUpperCase() : 'N/A'}
                        </div>
                        <div>
                            <strong>${task.employee_name || 'Unassigned'}</strong>
                            <br><small class="text-muted">${task.employee_email || ''}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${task.product_name || 'N/A'}</strong>
                        <br><small class="text-muted">${task.brand || ''} ${task.model || ''}</small>
                    </div>
                </td>
                <td>
                    ${this.renderPlatformsDisplay(task.platform)}
                </td>
                <td>${task.color || 'N/A'}</td>
                <td>
                    <span class="badge ${this.getPriorityBadgeClass(task.priority)}">
                        ${this.formatPriority(task.priority)}
                    </span>
                </td>
                <td>
                    <span class="badge ${this.getStatusBadgeClass(task.status)}">
                        ${this.formatStatus(task.status)}
                    </span>
                </td>
                <td>${this.formatDate(task.due_date)}</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${this.getProgressBarClass(task.status)}" 
                             style="width: ${this.calculateProgress(task)}%">
                            ${this.calculateProgress(task)}%
                        </div>
                    </div>
                    <small class="text-muted">${task.completed_hours || 0}/${task.estimated_hours || 0}h</small>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm btn-info" onclick="taskManager.viewTask(${task.id})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-warning" onclick="taskManager.editTask(${task.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="taskManager.deleteTask(${task.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderPlatformsDisplay(platform) {
        // Handle both single platform (legacy) and multiple platforms
        const platforms = Array.isArray(platform) ? platform : [platform];
        
        return platforms.map(p => {
            const badgeClass = this.getPlatformBadgeClass(p);
            const icon = this.getPlatformIcon(p);
            const displayName = this.formatPlatform(p);
            return `<span class="badge ${badgeClass} me-1 mb-1"><i class="${icon} me-1"></i>${displayName}</span>`;
        }).join('');
    }

    getPlatformBadgeClass(platform) {
        const classes = {
            'amazon': 'bg-warning',
            'flipkart': 'bg-primary',
            'meesho': 'bg-success',
            'ebay': 'bg-info',
            'shopify': 'bg-success',
            'walmart': 'bg-primary',
            'other': 'bg-secondary'
        };
        return classes[platform] || 'bg-secondary';
    }

    getPlatformIcon(platform) {
        const icons = {
            'amazon': 'fab fa-amazon',
            'flipkart': 'fas fa-shopping-bag',
            'meesho': 'fas fa-store',
            'ebay': 'fas fa-gavel',
            'shopify': 'fab fa-shopify',
            'walmart': 'fas fa-store',
            'other': 'fas fa-globe'
        };
        return icons[platform] || 'fas fa-globe';
    }

    formatPlatform(platform) {
        return platform.charAt(0).toUpperCase() + platform.slice(1);
    }

    getPriorityBadgeClass(priority) {
        const classes = {
            'high': 'bg-danger',
            'medium': 'bg-warning',
            'low': 'bg-info'
        };
        return classes[priority] || 'bg-secondary';
    }

    formatPriority(priority) {
        return priority.charAt(0).toUpperCase() + priority.slice(1);
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

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    }

    formatRole(role) {
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    setupEventListeners() {
        // Assign Task Form
        document.getElementById('assignTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.assignTask();
        });

        // Edit Task Form
        document.getElementById('editTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateTask();
        });

        // Add Activity Form
        document.getElementById('addActivityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addActivity();
        });

        // Edit from details modal
        document.getElementById('editFromDetails').addEventListener('click', () => {
            if (this.currentTask) {
                this.editTask(this.currentTask.id);
            }
        });

        // Add activity from details modal
        document.getElementById('addActivityBtn').addEventListener('click', () => {
            if (this.currentTask) {
                this.openAddActivityModal();
            }
        });

        // Platform checkboxes
        document.querySelectorAll('.platform-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handlePlatformSelection(e));
        });

        document.querySelectorAll('.edit-platform-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleEditPlatformSelection(e));
        });

        // Custom platform functionality
        document.getElementById('platformCustom').addEventListener('change', (e) => {
            const section = document.getElementById('customPlatformSection');
            section.style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('editPlatformCustom').addEventListener('change', (e) => {
            const section = document.getElementById('editCustomPlatformSection');
            section.style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('addCustomPlatform').addEventListener('click', () => this.addCustomPlatform());
        document.getElementById('editAddCustomPlatform').addEventListener('click', () => this.editAddCustomPlatform());
    }

    handlePlatformSelection(e) {
        const platform = e.target.value;
        if (e.target.checked) {
            this.selectedPlatforms.add(platform);
        } else {
            this.selectedPlatforms.delete(platform);
        }
    }

    handleEditPlatformSelection(e) {
        // Handle edit form platform selection
        const platform = e.target.value;
        if (e.target.checked) {
            this.selectedPlatforms.add(platform);
        } else {
            this.selectedPlatforms.delete(platform);
        }
    }

    addCustomPlatform() {
        const input = document.getElementById('customPlatformName');
        const platformName = input.value.trim();
        
        if (!platformName) {
            this.showError('Please enter a platform name');
            return;
        }

        // Convert to lowercase and replace spaces with underscores for storage
        const platformKey = platformName.toLowerCase().replace(/\s+/g, '_');
        
        if (this.customPlatforms.some(p => p.key === platformKey)) {
            this.showError('Platform already exists');
            return;
        }

        const platform = {
            key: platformKey,
            name: platformName,
            icon: 'fas fa-globe',
            class: 'bg-secondary'
        };

        this.customPlatforms.push(platform);
        this.saveCustomPlatforms();
        this.renderCustomPlatforms();
        input.value = '';
        this.showSuccess('Custom platform added successfully');
    }

    editAddCustomPlatform() {
        const input = document.getElementById('editCustomPlatformName');
        const platformName = input.value.trim();
        
        if (!platformName) {
            this.showError('Please enter a platform name');
            return;
        }

        const platformKey = platformName.toLowerCase().replace(/\s+/g, '_');
        
        if (this.customPlatforms.some(p => p.key === platformKey)) {
            this.showError('Platform already exists');
            return;
        }

        const platform = {
            key: platformKey,
            name: platformName,
            icon: 'fas fa-globe',
            class: 'bg-secondary'
        };

        this.customPlatforms.push(platform);
        this.saveCustomPlatforms();
        this.renderCustomPlatforms();
        input.value = '';
        this.showSuccess('Custom platform added successfully');
    }

    renderCustomPlatforms() {
        const lists = ['customPlatformsList', 'editCustomPlatformsList'];
        
        lists.forEach(listId => {
            const list = document.getElementById(listId);
            if (list) {
                if (this.customPlatforms.length === 0) {
                    list.innerHTML = '<small class="text-muted">Added custom platforms will appear here</small>';
                } else {
                    list.innerHTML = this.customPlatforms.map(platform => `
                        <span class="badge ${platform.class} me-1 mb-1">
                            <i class="${platform.icon} me-1"></i>${platform.name}
                            <button type="button" class="btn-close btn-close-white ms-1" 
                                    onclick="taskManager.removeCustomPlatform('${platform.key}')" 
                                    style="font-size: 0.5em;"></button>
                        </span>
                    `).join('');
                }
            }
        });
    }

    removeCustomPlatform(platformKey) {
        this.customPlatforms = this.customPlatforms.filter(p => p.key !== platformKey);
        this.saveCustomPlatforms();
        this.renderCustomPlatforms();
        this.showSuccess('Custom platform removed');
    }

    setupFilters() {
        const filters = ['searchTasks', 'employeeFilter', 'statusFilter', 'platformFilter', 'priorityFilter'];
        filters.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('input', () => this.applyFilters());
                element.addEventListener('change', () => this.applyFilters());
            }
        });
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchTasks').value.toLowerCase();
        const employeeFilter = document.getElementById('employeeFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const platformFilter = document.getElementById('platformFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;

        this.filteredTasks = this.tasks.filter(task => {
            const matchesSearch = task.employee_name?.toLowerCase().includes(searchTerm) ||
                                task.product_name?.toLowerCase().includes(searchTerm) ||
                                task.platform?.toLowerCase().includes(searchTerm) ||
                                task.color?.toLowerCase().includes(searchTerm);
            
            const matchesEmployee = !employeeFilter || task.employee_id.toString() === employeeFilter;
            const matchesStatus = !statusFilter || task.status === statusFilter;
            const matchesPlatform = !platformFilter || 
                (Array.isArray(task.platform) ? task.platform.includes(platformFilter) : task.platform === platformFilter);
            const matchesPriority = !priorityFilter || task.priority === priorityFilter;

            return matchesSearch && matchesEmployee && matchesStatus && matchesPlatform && matchesPriority;
        });

        this.renderTasks();
    }

    getSelectedPlatforms() {
        const selected = [];
        document.querySelectorAll('.platform-checkbox:checked').forEach(checkbox => {
            selected.push(checkbox.value);
        });
        return selected;
    }

    getEditSelectedPlatforms() {
        const selected = [];
        document.querySelectorAll('.edit-platform-checkbox:checked').forEach(checkbox => {
            selected.push(checkbox.value);
        });
        return selected;
    }

    async assignTask() {
        const selectedPlatforms = this.getSelectedPlatforms();
        
        if (selectedPlatforms.length === 0) {
            this.showError('Please select at least one platform');
            return;
        }

        // Create tasks for each selected platform
        const employeeId = parseInt(document.getElementById('taskEmployee').value);
        const productId = document.getElementById('taskProduct').value ? parseInt(document.getElementById('taskProduct').value) : null;
        const color = document.getElementById('taskColor').value;
        const productUrl = document.getElementById('taskProductUrl').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const priority = document.getElementById('taskPriority').value;
        const notes = document.getElementById('taskNotes').value;
        const estimatedHours = parseFloat(document.getElementById('taskEstimatedHours').value) || 0;

        let successCount = 0;
        let errorCount = 0;

        for (const platform of selectedPlatforms) {
            const taskData = {
                employee_id: employeeId,
                product_id: productId,
                platform: platform,
                color: color,
                product_url: productUrl,
                due_date: dueDate,
                priority: priority,
                notes: notes,
                estimated_hours: estimatedHours
            };

            try {
                const response = await fetch(`${this.apiBase}/employee-tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(taskData)
                });

                const result = await response.json();

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to create task for ${platform}:`, result.error);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error creating task for ${platform}:`, error);
            }
        }

        if (successCount > 0) {
            this.showSuccess(`Successfully created ${successCount} task${successCount > 1 ? 's' : ''}`);
            this.loadTasks();
            this.resetForm('assignTaskForm');
            this.clearPlatformSelections();
            bootstrap.Modal.getInstance(document.getElementById('assignTaskModal')).hide();
        }

        if (errorCount > 0) {
            this.showError(`Failed to create ${errorCount} task${errorCount > 1 ? 's' : ''}`);
        }
    }

    clearPlatformSelections() {
        document.querySelectorAll('.platform-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedPlatforms.clear();
    }

    clearEditPlatformSelections() {
        document.querySelectorAll('.edit-platform-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedPlatforms.clear();
    }

    async editTask(id) {
        try {
            const response = await fetch(`${this.apiBase}/employee-tasks/${id}`);
            if (response.ok) {
                const task = await response.json();
                this.currentTask = task;
                this.populateEditForm(task);
                new bootstrap.Modal(document.getElementById('editTaskModal')).show();
            } else {
                this.showError('Failed to load task details');
            }
        } catch (error) {
            console.error('Error loading task:', error);
            this.showError('Failed to load task details');
        }
    }

    populateEditForm(task) {
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskEmployee').value = task.employee_id || '';
        document.getElementById('editTaskProduct').value = task.product_id || '';
        
        // Clear existing selections
        this.clearEditPlatformSelections();
        
        // Handle both single platform (legacy) and multiple platforms
        const platforms = Array.isArray(task.platform) ? task.platform : [task.platform];
        
        platforms.forEach(platform => {
            const checkbox = document.querySelector(`#editPlatform${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
            if (checkbox) {
                checkbox.checked = true;
                this.selectedPlatforms.add(platform);
            }
        });

        // Check if any selected platforms are custom
        const hasCustom = platforms.some(p => this.customPlatforms.some(cp => cp.key === p));
        if (hasCustom) {
            document.getElementById('editPlatformCustom').checked = true;
            document.getElementById('editCustomPlatformSection').style.display = 'block';
        }
        
        document.getElementById('editTaskColor').value = task.color || '';
        document.getElementById('editTaskProductUrl').value = task.product_url || '';
        document.getElementById('editTaskDueDate').value = task.due_date || '';
        document.getElementById('editTaskPriority').value = task.priority || 'medium';
        document.getElementById('editTaskStatus').value = task.status || 'pending';
        document.getElementById('editTaskEstimatedHours').value = task.estimated_hours || 0;
        document.getElementById('editTaskCompletedHours').value = task.completed_hours || 0;
        document.getElementById('editTaskNotes').value = task.notes || '';
    }

    async updateTask() {
        const taskId = document.getElementById('editTaskId').value;
        const selectedPlatforms = this.getEditSelectedPlatforms();
        
        if (selectedPlatforms.length === 0) {
            this.showError('Please select at least one platform');
            return;
        }

        const taskData = {
            employee_id: parseInt(document.getElementById('editTaskEmployee').value),
            product_id: document.getElementById('editTaskProduct').value ? parseInt(document.getElementById('editTaskProduct').value) : null,
            platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] : selectedPlatforms, // Single or array
            color: document.getElementById('editTaskColor').value,
            product_url: document.getElementById('editTaskProductUrl').value,
            due_date: document.getElementById('editTaskDueDate').value,
            status: document.getElementById('editTaskStatus').value,
            priority: document.getElementById('editTaskPriority').value,
            notes: document.getElementById('editTaskNotes').value,
            estimated_hours: parseFloat(document.getElementById('editTaskEstimatedHours').value) || 0,
            completed_hours: parseFloat(document.getElementById('editTaskCompletedHours').value) || 0
        };

        try {
            const response = await fetch(`${this.apiBase}/employee-tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('Task updated successfully');
                this.loadTasks();
                bootstrap.Modal.getInstance(document.getElementById('editTaskModal')).hide();
            } else {
                this.showError(result.error || 'Failed to update task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            this.showError('Failed to update task');
        }
    }

    async deleteTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        const confirmMessage = `Are you sure you want to delete the task "${task.product_name || 'Unknown Product'}" for ${task.employee_name || 'unassigned employee'}? This action cannot be undone.`;

        if (confirm(confirmMessage)) {
            try {
                const response = await fetch(`${this.apiBase}/employee-tasks/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.showSuccess('Task deleted successfully');
                    this.loadTasks();
                } else {
                    const result = await response.json();
                    this.showError(result.error || 'Failed to delete task');
                }
            } catch (error) {
                console.error('Error deleting task:', error);
                this.showError('Failed to delete task');
            }
        }
    }

    async viewTask(id) {
        try {
            const response = await fetch(`${this.apiBase}/employee-tasks/${id}`);
            if (response.ok) {
                const task = await response.json();
                this.currentTask = task;
                this.renderTaskDetails(task);
                new bootstrap.Modal(document.getElementById('taskDetailsModal')).show();
            } else {
                this.showError('Failed to load task details');
            }
        } catch (error) {
            console.error('Error loading task:', error);
            this.showError('Failed to load task details');
        }
    }

    async renderTaskDetails(task) {
        // Load task activities
        let activitiesHtml = '<p class="text-muted">No activities logged yet.</p>';
        try {
            const response = await fetch(`${this.apiBase}/task-activities?task_id=${task.id}`);
            if (response.ok) {
                const activities = await response.json();
                if (activities.length > 0) {
                    activitiesHtml = activities.map(activity => `
                        <div class="mb-3 pb-3 border-bottom">
                            <div class="d-flex justify-content-between">
                                <h6 class="mb-1">${activity.employee_name}</h6>
                                <small class="text-muted">${this.formatDate(activity.activity_date)}</small>
                            </div>
                            <p class="mb-1">${activity.description}</p>
                            <div class="d-flex gap-2">
                                ${activity.hours_worked ? `<span class="badge bg-info">${activity.hours_worked}h</span>` : ''}
                                ${activity.status_update ? `<span class="badge ${this.getStatusBadgeClass(activity.status_update)}">${this.formatStatus(activity.status_update)}</span>` : ''}
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading activities:', error);
        }

        const content = document.getElementById('taskDetailsContent');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="text-primary">Task Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Employee:</strong></td><td>${task.employee_name || 'Unassigned'}</td></tr>
                        <tr><td><strong>Product:</strong></td><td>${task.product_name || 'N/A'}</td></tr>
                        <tr><td><strong>Platform:</strong></td><td>${this.renderPlatformsDisplay(task.platform)}</td></tr>
                        <tr><td><strong>Color/Model:</strong></td><td>${task.color || 'N/A'}</td></tr>
                        <tr><td><strong>Priority:</strong></td><td><span class="badge ${this.getPriorityBadgeClass(task.priority)}">${this.formatPriority(task.priority)}</span></td></tr>
                        <tr><td><strong>Status:</strong></td><td><span class="badge ${this.getStatusBadgeClass(task.status)}">${this.formatStatus(task.status)}</span></td></tr>
                        <tr><td><strong>Due Date:</strong></td><td>${this.formatDate(task.due_date)}</td></tr>
                        <tr><td><strong>Assigned Date:</strong></td><td>${this.formatDate(task.assigned_date)}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="text-primary">Progress & Time</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Estimated Hours:</strong></td><td>${task.estimated_hours || 0}h</td></tr>
                        <tr><td><strong>Completed Hours:</strong></td><td>${task.completed_hours || 0}h</td></tr>
                        <tr><td><strong>Progress:</strong></td><td>
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar ${this.getProgressBarClass(task.status)}" 
                                     style="width: ${this.calculateProgress(task)}%">
                                    ${this.calculateProgress(task)}%
                                </div>
                            </div>
                        </td></tr>
                        <tr><td><strong>Product URL:</strong></td><td>${task.product_url ? `<a href="${task.product_url}" target="_blank" class="btn btn-sm btn-outline-primary">View Product</a>` : 'N/A'}</td></tr>
                    </table>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="text-primary">Notes</h6>
                    <div class="border rounded p-3">
                        ${task.notes ? task.notes : '<p class="text-muted">No notes provided</p>'}
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="text-primary">Activity Log</h6>
                    <div class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
                        ${activitiesHtml}
                    </div>
                </div>
            </div>
        `;
    }

    openAddActivityModal() {
        document.getElementById('activityTaskId').value = this.currentTask.id;
        document.getElementById('activityEmployeeId').value = this.currentTask.employee_id;
        document.getElementById('activityDate').value = new Date().toISOString().split('T')[0];
        
        new bootstrap.Modal(document.getElementById('addActivityModal')).show();
    }

    async addActivity() {
        const activityData = {
            task_id: parseInt(document.getElementById('activityTaskId').value),
            employee_id: parseInt(document.getElementById('activityEmployeeId').value),
            activity_date: document.getElementById('activityDate').value,
            hours_worked: parseFloat(document.getElementById('activityHours').value) || 0,
            status_update: document.getElementById('activityStatus').value,
            description: document.getElementById('activityDescription').value
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
                this.loadTasks(); // Reload to update progress
                
                // Close add activity modal
                bootstrap.Modal.getInstance(document.getElementById('addActivityModal')).hide();
                
                // Refresh task details if modal is open
                if (this.currentTask && document.getElementById('taskDetailsModal').classList.contains('show')) {
                    this.renderTaskDetails(this.currentTask);
                }
                
                this.resetForm('addActivityForm');
            } else {
                this.showError(result.error || 'Failed to log activity');
            }
        } catch (error) {
            console.error('Error adding activity:', error);
            this.showError('Failed to log activity');
        }
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
    window.taskManager = new TaskAssignmentManager();
});

