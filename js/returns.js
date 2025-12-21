// Returns Management JavaScript Functions

// Global variables
let returnsData = [];
let currentFilter = {};

// Initialize returns management
document.addEventListener('DOMContentLoaded', function() {
    loadReturnsSummary();
    loadReturns();
    loadEmployees();
    setupEventListeners();
});

function setupEventListeners() {
    // Filter event listeners
    document.getElementById('statusFilter').addEventListener('change', filterReturns);
    document.getElementById('customerFilter').addEventListener('input', debounce(filterReturns, 500));
    document.getElementById('startDateFilter').addEventListener('change', filterReturns);
    document.getElementById('endDateFilter').addEventListener('change', filterReturns);
}

// Load returns summary statistics
async function loadReturnsSummary() {
    try {
        const response = await fetch('/api/returns-summary');
        if (response.ok) {
            const data = await response.json();
            updateReturnsStats(data);
        } else {
            console.error('Failed to load returns summary');
        }
    } catch (error) {
        console.error('Error loading returns summary:', error);
    }
}

// Update returns statistics in the UI
function updateReturnsStats(data) {
    document.getElementById('totalReturns').textContent = data.total_returns || 0;
    document.getElementById('pendingReturns').textContent = data.pending_returns || 0;
    document.getElementById('approvedReturns').textContent = data.approved_returns || 0;
    document.getElementById('totalRefunds').textContent = `$${(data.total_refund_amount || 0).toFixed(2)}`;
}

// Load all returns
async function loadReturns() {
    try {
        const response = await fetch('/api/returns');
        if (response.ok) {
            returnsData = await response.json();
            displayReturns(returnsData);
        } else {
            console.error('Failed to load returns');
            showError('Failed to load returns data');
        }
    } catch (error) {
        console.error('Error loading returns:', error);
        showError('Error loading returns: ' + error.message);
    }
}

// Display returns in the table
function displayReturns(returns) {
    const tbody = document.getElementById('returnsTableBody');
    tbody.innerHTML = '';
    
    if (returns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No returns found</td></tr>';
        return;
    }
    
    returns.forEach(returnItem => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${returnItem.return_number}</strong></td>
            <td>
                <div>
                    <strong>${returnItem.customer_name}</strong>
                    ${returnItem.customer_email ? `<br><small class="text-muted">${returnItem.customer_email}</small>` : ''}
                    ${returnItem.customer_phone ? `<br><small class="text-muted">${returnItem.customer_phone}</small>` : ''}
                </div>
            </td>
            <td>
                <div>
                    <strong>${returnItem.product_name || 'N/A'}</strong>
                    ${returnItem.product_brand ? `<br><small class="text-muted">${returnItem.product_brand} ${returnItem.product_model || ''}</small>` : ''}
                </div>
            </td>
            <td>${returnItem.return_reason}</td>
            <td>${returnItem.sales_platform || 'N/A'}</td>
            <td>${getStatusBadge(returnItem.return_status)}</td>
            <td>${returnItem.refund_amount ? `$${returnItem.refund_amount.toFixed(2)}` : '-'}</td>
            <td>${formatDate(returnItem.return_date)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-info" onclick="viewReturnDetails(${returnItem.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${returnItem.return_status === 'pending' ? `
                        <button class="btn btn-success" onclick="approveReturn(${returnItem.id})" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-danger" onclick="rejectReturn(${returnItem.id})" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    ${returnItem.return_status === 'approved' ? `
                        <button class="btn btn-warning" onclick="processRefund(${returnItem.id})" title="Process Refund">
                            <i class="fas fa-dollar-sign"></i>
                        </button>
                    ` : ''}
                    ${returnItem.return_status === 'refunded' && !returnItem.restocked ? `
                        <button class="btn btn-primary" onclick="restockItem(${returnItem.id})" title="Restock">
                            <i class="fas fa-box"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Get status badge HTML
function getStatusBadge(status) {
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

// Filter returns based on current filters
function filterReturns() {
    currentFilter = {
        status: document.getElementById('statusFilter').value,
        customer_name: document.getElementById('customerFilter').value,
        start_date: document.getElementById('startDateFilter').value,
        end_date: document.getElementById('endDateFilter').value
    };
    
    let filteredData = [...returnsData];
    
    if (currentFilter.status) {
        filteredData = filteredData.filter(item => item.return_status === currentFilter.status);
    }
    
    if (currentFilter.customer_name) {
        filteredData = filteredData.filter(item => 
            item.customer_name.toLowerCase().includes(currentFilter.customer_name.toLowerCase())
        );
    }
    
    if (currentFilter.start_date) {
        filteredData = filteredData.filter(item => item.return_date >= currentFilter.start_date);
    }
    
    if (currentFilter.end_date) {
        filteredData = filteredData.filter(item => item.return_date <= currentFilter.end_date);
    }
    
    displayReturns(filteredData);
}

// Load employees for dropdown
async function loadEmployees() {
    try {
        const response = await fetch('/api/employees');
        if (response.ok) {
            const employees = await response.json();
            const select = document.getElementById('processedBy');
            select.innerHTML = '<option value="">Select Employee</option>';
            
            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id;
                option.textContent = `${employee.name} (${employee.role})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

// Add new return
async function addReturn() {
    const form = document.getElementById('addReturnForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = {
        customer_name: document.getElementById('customerName').value,
        customer_email: document.getElementById('customerEmail').value,
        customer_phone: document.getElementById('customerPhone').value,
        quantity: parseInt(document.getElementById('quantity').value),
        return_reason: document.getElementById('returnReason').value,
        return_condition: document.getElementById('returnCondition').value,
        sales_platform: document.getElementById('salesPlatform').value,
        notes: document.getElementById('notes').value,
        processed_by: document.getElementById('processedBy').value || null
    };
    
    try {
        const response = await fetch('/api/returns', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess('Return request created successfully! Return #: ' + result.return_number);
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addReturnModal'));
            modal.hide();
            form.reset();
            
            // Reload data
            loadReturnsSummary();
            loadReturns();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to create return');
        }
    } catch (error) {
        console.error('Error creating return:', error);
        showError('Error creating return: ' + error.message);
    }
}

// View return details
async function viewReturnDetails(returnId) {
    try {
        const response = await fetch(`/api/returns/${returnId}`);
        if (response.ok) {
            const returnData = await response.json();
            const activitiesResponse = await fetch(`/api/return-activities?return_id=${returnId}`);
            const activities = activitiesResponse.ok ? await activitiesResponse.json() : [];
            
            displayReturnDetails(returnData, activities);
            const modal = new bootstrap.Modal(document.getElementById('returnDetailsModal'));
            modal.show();
        } else {
            showError('Failed to load return details');
        }
    } catch (error) {
        console.error('Error loading return details:', error);
        showError('Error loading return details: ' + error.message);
    }
}

// Display return details in modal
function displayReturnDetails(returnData, activities) {
    const body = document.getElementById('returnDetailsBody');
    body.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Return Information</h6>
                <table class="table table-sm">
                    <tr><td><strong>Return Number:</strong></td><td>${returnData.return_number}</td></tr>
                    <tr><td><strong>Status:</strong></td><td>${getStatusBadge(returnData.return_status)}</td></tr>
                    <tr><td><strong>Return Date:</strong></td><td>${formatDateTime(returnData.return_date)}</td></tr>
                    <tr><td><strong>Reason:</strong></td><td>${returnData.return_reason}</td></tr>
                    <tr><td><strong>Condition:</strong></td><td>${returnData.return_condition}</td></tr>
                    <tr><td><strong>Sales Platform:</strong></td><td>${returnData.sales_platform || 'Not specified'}</td></tr>
                    <tr><td><strong>Quantity:</strong></td><td>${returnData.quantity}</td></tr>
                    <tr><td><strong>Refund Amount:</strong></td><td>${returnData.refund_amount ? '$' + returnData.refund_amount.toFixed(2) : 'Not processed'}</td></tr>
                    <tr><td><strong>Refund Method:</strong></td><td>${returnData.refund_method || 'Not processed'}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Customer Information</h6>
                <table class="table table-sm">
                    <tr><td><strong>Name:</strong></td><td>${returnData.customer_name}</td></tr>
                    <tr><td><strong>Email:</strong></td><td>${returnData.customer_email || 'Not provided'}</td></tr>
                    <tr><td><strong>Phone:</strong></td><td>${returnData.customer_phone || 'Not provided'}</td></tr>
                    <tr><td><strong>Processed By:</strong></td><td>${returnData.processed_by_name || 'Not assigned'}</td></tr>
                    <tr><td><strong>Processed Date:</strong></td><td>${returnData.processed_date ? formatDateTime(returnData.processed_date) : 'Not processed'}</td></tr>
                    <tr><td><strong>Restocked:</strong></td><td>${returnData.restocked ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-warning">No</span>'}</td></tr>
                </table>
            </div>
        </div>
        ${returnData.notes ? `
            <div class="row">
                <div class="col-12">
                    <h6>Notes</h6>
                    <div class="alert alert-info">${returnData.notes}</div>
                </div>
            </div>
        ` : ''}
        <div class="row">
            <div class="col-12">
                <h6>Activity History</h6>
                <div class="timeline">
                    ${activities.length > 0 ? activities.map(activity => `
                        <div class="timeline-item">
                            <div class="timeline-marker ${getActivityMarkerColor(activity.activity_type)}"></div>
                            <div class="timeline-content">
                                <h6 class="timeline-title">${activity.activity_description}</h6>
                                <p class="timeline-description">
                                    ${activity.activity_type} - ${activity.performed_by_name || 'System'} 
                                    ${activity.activity_date ? `on ${formatDateTime(activity.activity_date)}` : ''}
                                </p>
                                ${activity.notes ? `<p class="timeline-notes"><small>${activity.notes}</small></p>` : ''}
                            </div>
                        </div>
                    `).join('') : '<p class="text-muted">No activity recorded</p>'}
                </div>
            </div>
        </div>
    `;
}

// Approve return
async function approveReturn(returnId) {
    if (!confirm('Are you sure you want to approve this return?')) {
        return;
    }
    
    const processedBy = prompt('Enter employee ID processing this return:');
    if (!processedBy) return;
    
    try {
        const response = await fetch(`/api/returns/${returnId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                processed_by: parseInt(processedBy),
                refund_amount: 0, // Will be set during refund processing
                refund_method: null,
                notes: 'Return approved'
            })
        });
        
        if (response.ok) {
            showSuccess('Return approved successfully');
            loadReturnsSummary();
            loadReturns();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to approve return');
        }
    } catch (error) {
        console.error('Error approving return:', error);
        showError('Error approving return: ' + error.message);
    }
}

// Reject return
async function rejectReturn(returnId) {
    if (!confirm('Are you sure you want to reject this return?')) {
        return;
    }
    
    const processedBy = prompt('Enter employee ID processing this return:');
    if (!processedBy) return;
    
    try {
        const response = await fetch(`/api/returns/${returnId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                processed_by: parseInt(processedBy),
                notes: 'Return rejected'
            })
        });
        
        if (response.ok) {
            showSuccess('Return rejected successfully');
            loadReturnsSummary();
            loadReturns();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to reject return');
        }
    } catch (error) {
        console.error('Error rejecting return:', error);
        showError('Error rejecting return: ' + error.message);
    }
}

// Process refund
async function processRefund(returnId) {
    const refundAmount = prompt('Enter refund amount:');
    if (!refundAmount || isNaN(refundAmount)) return;
    
    const refundMethod = prompt('Enter refund method (original_payment, store_credit, exchange):');
    if (!refundMethod) return;
    
    const processedBy = prompt('Enter employee ID processing this refund:');
    if (!processedBy) return;
    
    try {
        const response = await fetch(`/api/returns/${returnId}/refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refund_amount: parseFloat(refundAmount),
                refund_method: refundMethod,
                processed_by: parseInt(processedBy)
            })
        });
        
        if (response.ok) {
            showSuccess('Refund processed successfully');
            loadReturnsSummary();
            loadReturns();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to process refund');
        }
    } catch (error) {
        console.error('Error processing refund:', error);
        showError('Error processing refund: ' + error.message);
    }
}

// Restock item
async function restockItem(returnId) {
    if (!confirm('Are you sure you want to restock this item? This will update inventory.')) {
        return;
    }
    
    const processedBy = prompt('Enter employee ID processing this restock:');
    if (!processedBy) return;
    
    try {
        const response = await fetch(`/api/returns/${returnId}/restock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                processed_by: parseInt(processedBy)
            })
        });
        
        if (response.ok) {
            showSuccess('Item restocked successfully');
            loadReturnsSummary();
            loadReturns();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to restock item');
        }
    } catch (error) {
        console.error('Error restocking item:', error);
        showError('Error restocking item: ' + error.message);
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function getActivityMarkerColor(activityType) {
    const colors = {
        'created': 'bg-primary',
        'status_updated': 'bg-info',
        'approved': 'bg-success',
        'rejected': 'bg-danger',
        'refunded': 'bg-warning',
        'restocked': 'bg-secondary',
        'communication': 'bg-light'
    };
    return colors[activityType] || 'bg-light';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Toast notifications
function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

function showToast(message, type) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1055';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastElement = document.createElement('div');
    toastElement.id = toastId;
    toastElement.className = `toast ${type === 'error' ? 'toast-danger' : 'toast-success'}`;
    toastElement.setAttribute('role', 'alert');
    toastElement.innerHTML = `
        <div class="toast-header ${type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'}">
            <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle'} me-2"></i>
            <strong class="me-auto">${type === 'error' ? 'Error' : 'Success'}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    toastContainer.appendChild(toastElement);
    
    // Initialize and show toast
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
    toast.show();
    
    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// CSS for timeline
const timelineStyles = `
<style>
.timeline {
    position: relative;
    padding-left: 2rem;
}

.timeline::before {
    content: '';
    position: absolute;
    left: 0.5rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #dee2e6;
}

.timeline-item {
    position: relative;
    margin-bottom: 1.5rem;
}

.timeline-marker {
    position: absolute;
    left: -2rem;
    top: 0.25rem;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 2px solid #fff;
}

.timeline-content {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 0.375rem;
    border-left: 3px solid #dee2e6;
}

.timeline-title {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
}

.timeline-description {
    margin-bottom: 0.25rem;
    font-size: 0.8rem;
    color: #6c757d;
}

.timeline-notes {
    margin-bottom: 0;
    font-size: 0.75rem;
    color: #495057;
}
</style>
`;

// Add timeline styles to head
document.head.insertAdjacentHTML('beforeend', timelineStyles);

