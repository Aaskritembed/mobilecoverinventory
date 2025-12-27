// Authentication Management System
class Auth {
    static API_BASE = '/api/auth';

    // Check if user is authenticated
    static isAuthenticated() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('currentUser');
        
        if (!token || !user) {
            return false;
        }

        try {
            // Check if token is expired (basic check)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (payload.exp && payload.exp < currentTime) {
                this.logout();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error checking authentication:', error);
            this.logout();
            return false;
        }
    }

    // Get current user data
    static getCurrentUser() {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (error) {
                console.error('Error parsing user data:', error);
                return null;
            }
        }
        return null;
    }

    // Login function
    static async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store authentication data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    // Logout function
    static async logout() {
        try {
            // Call logout endpoint if authenticated
            const token = localStorage.getItem('authToken');
            if (token) {
                await fetch(`${this.API_BASE}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage regardless of API call success
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            
            // Redirect to login page
            window.location.href = 'login.html';
        }
    }

    // Get authentication headers for API requests
    static getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Make authenticated API request
    static async apiRequest(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const defaultHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        const response = await fetch(endpoint, config);
        
        if (response.status === 401) {
            // Token expired or invalid
            this.logout();
            throw new Error('Authentication expired');
        }

        return response;
    }

    // Check if user has admin role
    static isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'admin';
    }

    // Require authentication - redirect to login if not authenticated
    static requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // Require admin role - redirect to login or show error if not admin
    static requireAdmin() {
        if (!this.requireAuth()) {
            return false;
        }

        if (!this.isAdmin()) {
            // Show access denied message or redirect to dashboard
            if (confirm('Admin access required. Continue to dashboard?')) {
                window.location.href = 'index.html';
            }
            return false;
        }
        return true;
    }

    // Refresh user data from server
    static async refreshUserData() {
        try {
            const response = await this.apiRequest(`${this.API_BASE}/me`);
            const userData = await response.json();
            
            localStorage.setItem('currentUser', JSON.stringify(userData));
            return userData;
        } catch (error) {
            console.error('Error refreshing user data:', error);
            return null;
        }
    }

    // Update user data in local storage
    static updateUserData(userData) {
        const currentUser = this.getCurrentUser();
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return updatedUser;
    }

    // Show loading state for authenticated pages
    static showLoading() {
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(element => {
            element.style.display = 'block';
        });
    }

    // Hide loading state for authenticated pages
    static hideLoading() {
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(element => {
            element.style.display = 'none';
        });
    }

    // Show user info in the header/navigation
    static updateUserInterface() {
        const user = this.getCurrentUser();
        if (!user) return;

        // Update user name in navigation
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(element => {
            element.textContent = `${user.first_name} ${user.last_name}`;
        });

        // Update user role in navigation
        const userRoleElements = document.querySelectorAll('.user-role');
        userRoleElements.forEach(element => {
            element.textContent = user.role;
        });

        // Show/hide admin-only elements
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        adminOnlyElements.forEach(element => {
            element.style.display = this.isAdmin() ? 'block' : 'none';
        });

        // Show/hide user-only elements
        const userOnlyElements = document.querySelectorAll('.user-only');
        userOnlyElements.forEach(element => {
            element.style.display = 'block'; // Show for both admin and user
        });
    }

    // Initialize authentication for authenticated pages
    static initializeAuthenticatedPage() {
        if (!this.requireAuth()) {
            return false;
        }

        // Update UI with user data
        this.updateUserInterface();

        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        return true;
    }

    // Handle API errors globally
    static handleApiError(error, errorMessage = 'An error occurred') {
        console.error('API Error:', error);
        
        if (error.message === 'Authentication expired') {
            this.logout();
            return;
        }

        // Show error message to user
        const errorElement = document.getElementById('errorMessage') || 
                           document.querySelector('.error-message') ||
                           document.createElement('div');
        
        if (!errorElement.id) {
            errorElement.className = 'error-message';
            document.body.appendChild(errorElement);
        }
        
        errorElement.textContent = error.message || errorMessage;
        errorElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    // Validate password strength on frontend
    static validatePassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        const errors = [];
        
        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }
        
        if (!hasUpperCase) {
            errors.push('Password must contain at least one uppercase letter');
        }
        
        if (!hasLowerCase) {
            errors.push('Password must contain at least one lowercase letter');
        }
        
        if (!hasNumbers) {
            errors.push('Password must contain at least one number');
        }
        
        if (!hasSpecialChar) {
            errors.push('Password must contain at least one special character');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Show password validation feedback
    static showPasswordValidation(passwordInput, validationResult) {
        const feedbackElement = passwordInput.parentNode.querySelector('.password-feedback') ||
                              document.createElement('div');
        
        feedbackElement.className = 'password-feedback';
        
        if (!passwordInput.parentNode.querySelector('.password-feedback')) {
            passwordInput.parentNode.appendChild(feedbackElement);
        }
        
        if (validationResult.isValid) {
            feedbackElement.innerHTML = '<span style="color: green;">✓ Password meets all requirements</span>';
            feedbackElement.style.display = 'block';
        } else {
            const errorList = validationResult.errors.map(error => `<li>${error}</li>`).join('');
            feedbackElement.innerHTML = `
                <div style="color: red; font-size: 12px;">
                    <strong>Password requirements:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">${errorList}</ul>
                </div>
            `;
            feedbackElement.style.display = 'block';
        }
    }
}

// Initialize authentication when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if this page requires authentication
    const requireAuth = document.body.getAttribute('data-require-auth') === 'true';
    const requireAdmin = document.body.getAttribute('data-require-admin') === 'true';
    
    if (requireAuth) {
        if (requireAdmin) {
            Auth.requireAdmin();
        } else {
            Auth.requireAuth();
        }
    }
    
    // Update user interface
    Auth.updateUserInterface();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
}
