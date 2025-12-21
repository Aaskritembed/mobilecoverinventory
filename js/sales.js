/**
 * Sales Management System
 * Handles all sales-related functionality including recording sales, tracking performance, and analytics
 */
class SalesManager {
    constructor() {
        this.apiBase = '/api';
        this.products = [];
        this.sales = [];
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.setupSaleForm();
        this.setupFilters();
        await this.loadSales();
        this.updateTodaysStats();
    }

    async loadProducts() {
        try {
            const response = await fetch(`${this.apiBase}/products`);
            if (response.ok) {
                this.products = await response.json();
                this.populateProductSelect();
            } else {
                throw new Error('Failed to load products');
            }
        } catch (error) {
            this.showError('Failed to load products');
        }
    }

    populateProductSelect() {
        const select = document.getElementById('saleProduct');
        if (!select) return;

        // Clear existing options
        select.innerHTML = '<option value="">Choose a product...</option>';

        // Add products with stock
        this.products
            .filter(product => product.quantity > 0)
            .forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (${product.quantity} in stock)`;
                option.dataset.price = product.selling_price;
                option.dataset.cost = product.cost_price;
                select.appendChild(option);
            });

        // Add out of stock products as disabled
        const outOfStockProducts = this.products.filter(product => product.quantity === 0);
        if (outOfStockProducts.length > 0) {
            const disabledGroup = document.createElement('optgroup');
            disabledGroup.label = 'Out of Stock';
            outOfStockProducts.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (Out of stock)`;
                option.disabled = true;
                disabledGroup.appendChild(option);
            });
            select.appendChild(disabledGroup);
        }
    }

    setupSaleForm() {
        const form = document.getElementById('quickSaleForm');
        const productSelect = document.getElementById('saleProduct');
        const quantityInput = document.getElementById('saleQuantity');
        const priceInput = document.getElementById('salePrice');
        const slipInput = document.getElementById('saleSlip');

        if (form) {
            form.addEventListener('submit', (e) => this.handleSale(e));
        }

        if (productSelect) {
            productSelect.addEventListener('change', () => this.handleProductSelect());
        }

        if (quantityInput) {
            quantityInput.addEventListener('input', () => this.calculateTotal());
        }

        if (priceInput) {
            priceInput.addEventListener('input', () => this.calculateTotal());
        }

        if (slipInput) {
            slipInput.addEventListener('change', (e) => this.handleSlipUpload(e));
        }
    }

    handleProductSelect() {
        const productSelect = document.getElementById('saleProduct');
        const productInfo = document.getElementById('productInfo');
        const quantityInput = document.getElementById('saleQuantity');
        const priceInput = document.getElementById('salePrice');

        if (!productSelect || !productInfo) return;

        const selectedOption = productSelect.options[productSelect.selectedIndex];
        
        if (selectedOption.value) {
            const product = this.products.find(p => p.id == selectedOption.value);
            if (product) {
                // Show product info
                document.getElementById('availableStock').textContent = product.quantity;
                document.getElementById('productPrice').textContent = product.selling_price.toFixed(2);
                document.getElementById('productCost').textContent = product.cost_price.toFixed(2);
                document.getElementById('productProfit').textContent = (product.selling_price - product.cost_price).toFixed(2);
                
                productInfo.style.display = 'block';

                // Auto-fill quantity (max available)
                quantityInput.max = product.quantity;
                if (parseInt(quantityInput.value) > product.quantity) {
                    quantityInput.value = product.quantity;
                }

                // Auto-fill price
                priceInput.value = product.selling_price;

                this.calculateTotal();
            }
        } else {
            productInfo.style.display = 'none';
            document.getElementById('saleTotal').style.display = 'none';
        }
    }

    calculateTotal() {
        const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
        const price = parseFloat(document.getElementById('salePrice').value) || 0;
        const total = quantity * price;

        if (quantity > 0 && price > 0) {
            document.getElementById('totalAmount').textContent = total.toFixed(2);
            document.getElementById('saleTotal').style.display = 'block';
        } else {
            document.getElementById('saleTotal').style.display = 'none';
        }
    }

    async handleSlipUpload(e) {
        const file = e.target.files[0];
        const fileInfo = document.getElementById('uploadedFileInfo');
        const fileNameSpan = document.getElementById('fileName');

        if (file) {
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(file.type)) {
                this.showError('Please select a valid file type (JPG, PNG, GIF, PDF, DOC, DOCX)');
                e.target.value = '';
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                this.showError('File size must be less than 5MB');
                e.target.value = '';
                return;
            }

            // Show file info
            fileNameSpan.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
            fileInfo.style.display = 'block';
        } else {
            fileInfo.style.display = 'none';
        }
    }

    async handleSale(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('recordSaleBtn');
        const originalText = submitBtn.innerHTML;
        let uploadedSlipPath = null;

        // Get form data
        const productId = document.getElementById('saleProduct').value;
        const quantity = parseInt(document.getElementById('saleQuantity').value);
        const price = parseFloat(document.getElementById('salePrice').value);
        const salesPlatform = document.getElementById('salePlatform').value;
        const slipFile = document.getElementById('saleSlip').files[0];

        if (!productId || !quantity || !price || !salesPlatform) {
            this.showError('Please fill in all required fields including sales platform');
            return;
        }

        // Check stock availability
        const product = this.products.find(p => p.id == productId);
        if (!product || product.quantity < quantity) {
            this.showError('Insufficient stock available');
            return;
        }

        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Recording...';
        submitBtn.disabled = true;

        try {
            // Upload slip file if provided
            if (slipFile) {
                const formData = new FormData();
                formData.append('slip', slipFile);

                const uploadResponse = await fetch(`${this.apiBase}/upload-sale-slip`, {
                    method: 'POST',
                    body: formData
                });

                if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    uploadedSlipPath = uploadResult.path;
                } else {
                    const uploadError = await uploadResponse.json();
                    throw new Error(`Slip upload failed: ${uploadError.error}`);
                }
            }

            // Record the sale
            const response = await fetch(`${this.apiBase}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product_id: parseInt(productId),
                    quantity_sold: quantity,
                    sale_price: price,
                    sales_platform: salesPlatform,
                    slip_path: uploadedSlipPath,
                    customer_info: JSON.stringify({
                        sale_date: new Date().toISOString(),
                        recorded_by: 'System'
                    })
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccessModal(result);
                form.reset();
                document.getElementById('productInfo').style.display = 'none';
                document.getElementById('saleTotal').style.display = 'none';
                document.getElementById('uploadedFileInfo').style.display = 'none';
                
                // Refresh data
                await this.loadProducts();
                await this.loadSales();
                await this.updateTodaysStats();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to record sale');
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    showSuccessModal(saleData) {
        const modal = document.getElementById('saleSuccessModal');
        const detailsContainer = document.getElementById('saleDetails');
        
        const product = this.products.find(p => p.id == saleData.product_id);
        const profit = (saleData.sale_price - (product?.cost_price || 0)) * saleData.quantity_sold;

        detailsContainer.innerHTML = `
            <div class="row">
                <div class="col-6"><strong>Product:</strong></div>
                <div class="col-6">${product?.name || 'Unknown'}</div>
            </div>
            <div class="row">
                <div class="col-6"><strong>Platform:</strong></div>
                <div class="col-6"><span class="badge bg-primary">${saleData.sales_platform || 'Direct'}</span></div>
            </div>
            <div class="row">
                <div class="col-6"><strong>Quantity:</strong></div>
                <div class="col-6">${saleData.quantity_sold}</div>
            </div>
            <div class="row">
                <div class="col-6"><strong>Price:</strong></div>
                <div class="col-6">$${saleData.sale_price.toFixed(2)}</div>
            </div>
            <div class="row">
                <div class="col-6"><strong>Total:</strong></div>
                <div class="col-6"><strong>$${saleData.total_amount.toFixed(2)}</strong></div>
            </div>
            <div class="row">
                <div class="col-6"><strong>Profit:</strong></div>
                <div class="col-6"><strong class="text-success">$${profit.toFixed(2)}</strong></div>
            </div>
            ${saleData.slip_path ? `
            <div class="row">
                <div class="col-6"><strong>Slip:</strong></div>
                <div class="col-6"><span class="badge bg-success"><i class="fas fa-upload me-1"></i>Uploaded</span></div>
            </div>
            ` : ''}
        `;

        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }

    setupFilters() {
        const filterSelect = document.getElementById('salesFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.filterSales());
        }
    }

    async loadSales() {
        try {
            const response = await fetch(`${this.apiBase}/sales`);
            if (response.ok) {
                this.sales = await response.json();
                this.displaySales();
            } else {
                throw new Error('Failed to load sales');
            }
        } catch (error) {
            this.showError('Failed to load sales');
        }
    }

    filterSales() {
        const filter = document.getElementById('salesFilter').value;
        const today = new Date();
        let filteredSales = [];

        switch (filter) {
            case 'today':
                filteredSales = this.sales.filter(sale => {
                    const saleDate = new Date(sale.sale_date);
                    return saleDate.toDateString() === today.toDateString();
                });
                break;
            case 'week':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredSales = this.sales.filter(sale => new Date(sale.sale_date) >= weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                filteredSales = this.sales.filter(sale => new Date(sale.sale_date) >= monthAgo);
                break;
            default:
                filteredSales = [...this.sales];
        }

        this.displayFilteredSales(filteredSales);
    }

    displaySales() {
        this.filterSales();
    }

    displayFilteredSales(sales) {
        const container = document.getElementById('salesList');
        if (!container) return;

        if (sales.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No sales found</h5>
                    <p class="text-muted">Start recording sales to see them here.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        sales.forEach(sale => {
            const saleDate = new Date(sale.sale_date);
            const product = this.products.find(p => p.id === sale.product_id);
            const profit = (sale.sale_price - (product?.cost_price || 0)) * sale.quantity_sold;

            html += `
                <div class="list-group-item">
                    <div class="row align-items-center">
                        <div class="col-md-3">
                            <h6 class="mb-1">${sale.product_name || 'Unknown Product'}</h6>
                            <small class="text-muted">${saleDate.toLocaleString()}</small>
                            ${sale.sales_platform ? `<br><span class="badge bg-primary">${sale.sales_platform}</span>` : ''}
                            ${sale.slip_path ? `<br><span class="badge bg-success"><i class="fas fa-upload"></i></span>` : ''}
                        </div>
                        <div class="col-md-2 text-center">
                            <strong>${sale.quantity_sold}</strong>
                            <br><small class="text-muted">Qty</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <strong>$${sale.sale_price.toFixed(2)}</strong>
                            <br><small class="text-muted">Price</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <strong class="text-success">$${sale.total_amount.toFixed(2)}</strong>
                            <br><small class="text-muted">Total</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <strong class="text-success">$${profit.toFixed(2)}</strong>
                            <br><small class="text-muted">Profit</small>
                        </div>
                        <div class="col-md-1 text-center">
                            ${sale.slip_path ? '<i class="fas fa-file-alt text-success" title="Slip uploaded"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    async updateTodaysStats() {
        try {
            const response = await fetch(`${this.apiBase}/dashboard`);
            if (response.ok) {
                const dashboardData = await response.json();
                
                // Calculate today's stats from sales data
                const today = new Date();
                const todaysSales = this.sales.filter(sale => {
                    const saleDate = new Date(sale.sale_date);
                    return saleDate.toDateString() === today.toDateString();
                });

                const totalSales = todaysSales.length;
                const totalRevenue = todaysSales.reduce((sum, sale) => sum + sale.total_amount, 0);
                const totalProfit = todaysSales.reduce((sum, sale) => {
                    const product = this.products.find(p => p.id === sale.product_id);
                    const profit = (sale.sale_price - (product?.cost_price || 0)) * sale.quantity_sold;
                    return sum + profit;
                }, 0);

                document.getElementById('todaySales').textContent = totalSales;
                document.getElementById('todayRevenue').textContent = this.formatCurrency(totalRevenue);
                document.getElementById('todayProfit').textContent = this.formatCurrency(totalProfit);
            }
        } catch (error) {
            // Handle silently for today stats
        }
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

// Global function for modal button
function recordAnotherSale() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('saleSuccessModal'));
    modal.hide();
    document.getElementById('saleProduct').focus();
}

// Initialize sales manager when page loads
let salesManager;
document.addEventListener('DOMContentLoaded', () => {
    salesManager = new SalesManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SalesManager;
}
