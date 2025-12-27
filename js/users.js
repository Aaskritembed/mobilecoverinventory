// User Management System
class UserManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.currentSearch = '';
        this.currentRole = '';
        this.users = [];
        this.currentUserId = null;
        this.init();
    }

    async init() {
        if (!Auth.requireAdmin()) {
            return;
        }

        this.setupEventListeners();
        await this.loadUsers();
    }

    setupEventListeners() {
        // Add User Form
        document.getElementById('addUserForm').addEventListener('submit', (e) => this.handleAddUser(e));
        
        // Edit User Form
        document.getElementById('editUserForm').addEventListener('submit', (e) => this.handleEditUser(e));
        
        // Delete User Button
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDeleteUser());
        
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.debounceSearch();
        });
        
        // Password validation
        document.getElementById('password').addEventListener('input', (e) => {
            this.validatePassword(e.target.value);
        });
        
        document.getElementById('newPassword').addEventListener('input', (e) => {
            this.validateEditPassword(e.target.value);
        });

        // Password confirmation
        document.getElementById('confirmPassword').addEventListener('input', (e) => {
            this.validatePasswordMatch('password', 'confirmPassword');
        });
        
        document.getElementById('confirmNewPassword').addEventListener('input', (e) => {
            this.validatePasswordMatch('newPassword', 'confirmNewPassword');
        });
    }

    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.currentPage = 1;
            this.loadUsers();
        }, 500);
    }

    async loadUsers() {
        try {
            this.showLoading(true);
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize,
                search: this.currentSearch,
                role: this.currentRole
            });

            const response = await Auth.apiRequest(`/api/auth/users?${params}`);
            const data = await response.json();
            
            if (response.ok) {
                this.users = data.users;
                this.renderUsers(data.users);
                this.renderPagination(data.pagination);
            } else {
                this.showError(data.error || 'Failed to load users');
            }
        } catch (error) {
            Auth.handleApiError(error, 'Failed to load users');
        } finally {
            this.showLoading(false);
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        <i class="fas fa-users fa-3x mb-3 d-block"></i>
                        No users found
                    </td>
                </tr>
            `;
            return;
        }

        const currentUser = Auth.getCurrentUser();
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar bg-primary rounded-circle me-3">
                            <i class="fas fa-user text-white"></i>
                        </div>
                        <div>
                            <strong>${user.first_name} ${user.last_name}</strong>
                            ${user.id === currentUser.id ? '<span class="badge bg-info ms-2">You</span>' : ''}
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">
                        ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.is_active ? 'bg-success' : 'bg-secondary'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td>${new Date(user.created_date).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm btn-outline-primary" 
                                onclick="userManager.editUser(${user.id})" 
                                ${user.id === currentUser.id ? 'disabled' : ''}>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" 
                                onclick="userManager.deleteUser(${user.id}, '${user.first_name} ${user.last_name}')" 
                                ${user.id === currentUser.id ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationElement = document.getElementById('pagination');
        const { page, pages, total } = pagination;
        
        if (pages <= 1) {
            paginationElement.innerHTML = '';
            return;
        }

        let paginationHtml = '';
        
        // Previous button
        paginationHtml += `
            <li class="page-item ${page === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="userManager.changePage(${page - 1})">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Page numbers
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(pages, page + 2);

        if (startPage > 1) {
            paginationHtml += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="userManager.changePage(1)">1</a>
                </li>
            `;
            if (startPage > 2) {
                paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === page ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="userManager.changePage(${i})">${i}</a>
                </li>
            `;
        }

        if (endPage < pages) {
            if (endPage < pages - 1) {
                paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
            paginationHtml += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="userManager.changePage(${pages})">${pages}</a>
                </li>
            `;
        }

        // Next button
        paginationHtml += `
            <li class="page-item ${page === pages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="userManager.changePage(${page + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        paginationElement.innerHTML = paginationHtml;
    }

    changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        
        this.currentPage = page;
        this.loadUsers();
    }

    async handleAddUser(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = document.getElementById('role').value;

        // Validation
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        const passwordValidation = Auth.validatePassword(password);
        if (!passwordValidation.isValid) {
            this.showError('Password does not meet security requirements');
            return;
        }

        try {
            this.setFormLoading('addUserBtn', true);
            
            const response = await Auth.apiRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    password: password,
                    role: role
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showSuccess('User created successfully');
                this.resetAddUserForm();
                bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
                await this.loadUsers();
            } else {
                this.showError(data.error || 'Failed to create user');
            }
        } catch (error) {
            Auth.handleApiError(error, 'Failed to create user');
        } finally {
            this.setFormLoading('addUserBtn', false);
        }
    }

    async editUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Populate edit form
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editFirstName').value = user.first_name;
        document.getElementById('editLastName').value = user.last_name;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editRole').value = user.role;
        document.getElementById('editIsActive').checked = user.is_active === 1;
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        modal.show();
    }

    async handleEditUser(e) {
        e.preventDefault();
        
        const userId = parseInt(document.getElementById('editUserId').value);
        const firstName = document.getElementById('editFirstName').value.trim();
        const lastName = document.getElementById('editLastName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const role = document.getElementById('editRole').value;
        const isActive = document.getElementById('editIsActive').checked;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        // Validation
        if (!firstName || !lastName || !email) {
            this.showError('Please fill in all required fields');
            return;
        }

        if (newPassword) {
            if (newPassword !== confirmNewPassword) {
                this.showError('New passwords do not match');
                return;
            }

            const passwordValidation = Auth.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                this.showError('New password does not meet security requirements');
                return;
            }
        }

        try {
            this.setFormLoading('editUserBtn', true);
            
            const updateData = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                role: role,
                is_active: isActive
            };

            if (newPassword) {
                updateData.password = newPassword;
            }

            const response = await Auth.apiRequest(`/api/auth/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showSuccess('User updated successfully');
                bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
                await this.loadUsers();
            } else {
                this.showError(data.error || 'Failed to update user');
            }
        } catch (error) {
            Auth.handleApiError(error, 'Failed to update user');
        } finally {
            this.setFormLoading('editUserBtn', false);
        }
    }

    deleteUser(userId, userName) {
        this.currentUserId = userId;
        document.getElementById('deleteUserName').textContent = userName;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
        modal.show();
    }

    async confirmDeleteUser() {
        if (!this.currentUserId) return;

        try {
            this.setFormLoading('confirmDeleteBtn', true);
            
            const response = await Auth.apiRequest(`/api/auth/users/${this.currentUserId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showSuccess('User deleted successfully');
                bootstrap.Modal.getInstance(document.getElementById('deleteUserModal')).hide();
                await this.loadUsers();
            } else {
                this.showError(data.error || 'Failed to delete user');
            }
        } catch (error) {
            Auth.handleApiError(error, 'Failed to delete user');
        } finally {
            this.setFormLoading('confirmDeleteBtn', false);
            this.currentUserId = null;
        }
    }

    validatePassword(password) {
        const validation = Auth.validatePassword(password);
        const feedback = document.getElementById('passwordFeedback');
        
        if (password.length === 0) {
            feedback.innerHTML = '';
            return;
        }

        if (validation.isValid) {
            feedback.innerHTML = '<div class="text-success"><i class="fas fa-check"></i> Password meets all requirements</div>';
        } else {
            const errors = validation.errors.map(error => `<li>${error}</li>`).join('');
            feedback.innerHTML = `
                <div class="text-danger">
                    <strong>Password requirements:</strong>
                    <ul style="font-size: 12px;">${errors}</ul>
                </div>
            `;
        }
    }

    validateEditPassword(password) {
        const feedback = document.getElementById('editPasswordFeedback');
        
        if (password.length === 0) {
            feedback.innerHTML = '<div class="form-text">Leave blank to keep current password</div>';
            return;
        }

        const validation = Auth.validatePassword(password);
        
        if (validation.isValid) {
            feedback.innerHTML = '<div class="text-success"><i class="fas fa-check"></i> Password meets all requirements</div>';
        } else {
            const errors = validation.errors.map(error => `<li>${error}</li>`).join('');
            feedback.innerHTML = `
                <div class="text-danger">
                    <strong>Password requirements:</strong>
                    <ul style="font-size: 12px;">${errors}</ul>
                </div>
            `;
        }
    }

    validatePasswordMatch(passwordField, confirmField) {
        const password = document.getElementById(passwordField).value;
        const confirm = document.getElementById(confirmField).value;
        const feedback = document.getElementById(passwordField === 'password' ? 'passwordFeedback' : 'editPasswordFeedback');
        
        if (confirm.length === 0) {
            feedback.innerHTML = '';
            return;
        }

        if (password === confirm) {
            feedback.innerHTML += '<div class="text-success"><i class="fas fa-check"></i> Passwords match</div>';
        } else {
            feedback.innerHTML += '<div class="text-danger"><i class="fas fa-times"></i> Passwords do not match</div>';
        }
    }

    resetAddUserForm() {
        document.getElementById('addUserForm').reset();
        document.getElementById('passwordFeedback').innerHTML = '';
    }

    setFormLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        const originalText = button.innerHTML;
        
        if (loading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        } else {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    showLoading(show) {
        const tbody = document.getElementById('usersTableBody');
        if (show) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    showSuccess(message) {
        const alertElement = document.getElementById('successMessage');
        const textElement = document.getElementById('successText');
        
        textElement.textContent = message;
        alertElement.style.display = 'block';
        alertElement.classList.add('show');
        
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => alertElement.style.display = 'none', 150);
        }, 5000);
    }

    showError(message) {
        const alertElement = document.getElementById('errorMessage');
        const textElement = document.getElementById('errorText');
        
        textElement.textContent = message;
        alertElement.style.display = 'block';
        alertElement.classList.add('show');
        
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => alertElement.style.display = 'none', 150);
        }, 5000);
    }
}

// Filter users by role
function filterUsers() {
    if (window.userManager) {
        window.userManager.currentRole = document.getElementById('roleFilter').value;
        window.userManager.currentPage = 1;
        window.userManager.loadUsers();
    }
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('roleFilter').value = '';
    
    if (window.userManager) {
        window.userManager.currentSearch = '';
        window.userManager.currentRole = '';
        window.userManager.currentPage = 1;
        window.userManager.loadUsers();
    }
}

// Initialize user manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.userManager = new UserManager();
});
