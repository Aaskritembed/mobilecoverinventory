/**
 * Product Management System
 * Handles all product-related functionality including CRUD operations, filtering, and validation
 */
class ProductManager {
    constructor() {
        this.apiBase = '/api';
        this.products = [];
        this.filteredProducts = [];
        this.currentView = 'grid';
        this.init();
    }

    async init() {
        // Check which page we're on and initialize accordingly
        if (window.location.pathname.includes('add-product.html')) {
            await this.initAddProduct();
        } else if (window.location.pathname.includes('products.html')) {
            await this.initProductsList();
        }
    }

    // Add Product Page Initialization
    async initAddProduct() {
        this.setupAddProductForm();
        this.setupImageUpload();
        await this.loadColors(); // Load colors
        this.loadRecentProducts();
        this.calculateProfitMargin();
    }

    setupAddProductForm() {
        const form = document.getElementById('addProductForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleAddProduct(e));
        }

        // Real-time profit calculation
        const costPriceInput = document.getElementById('costPrice');
        const sellingPriceInput = document.getElementById('sellingPrice');
        
        if (costPriceInput && sellingPriceInput) {
            costPriceInput.addEventListener('input', () => this.calculateProfitMargin());
            sellingPriceInput.addEventListener('input', () => this.calculateProfitMargin());
        }

        // Brand selection handler
        const brandSelect = document.getElementById('productBrand');
        const customBrandContainer = document.getElementById('customBrandContainer');
        const customBrandInput = document.getElementById('customBrand');
        const modelRow = document.getElementById('modelRow');
        const modelSelect = document.getElementById('productModel');
        const addNewModelBtn = document.getElementById('addNewModelBtn');

        if (brandSelect) {
            brandSelect.addEventListener('change', () => this.handleBrandChange());
        }

        if (customBrandInput) {
            customBrandInput.addEventListener('input', () => {
                this.handleBrandChange(); // Refresh models when custom brand is entered
            });
        }

        if (modelSelect) {
            modelSelect.addEventListener('change', () => this.handleModelChange());
        }

        if (addNewModelBtn) {
            addNewModelBtn.addEventListener('click', () => this.showAddModelModal());
        }

        // Color selection handler
        const colorSelect = document.getElementById('productColor');
        const addNewColorBtn = document.getElementById('addNewColorBtn');
        const colorPicker = document.getElementById('colorPicker');
        const newColorHex = document.getElementById('newColorHex');

        if (colorSelect) {
            colorSelect.addEventListener('change', () => this.handleColorChange());
        }

        if (addNewColorBtn) {
            addNewColorBtn.addEventListener('click', () => this.showAddColorModal());
        }

        if (colorPicker) {
            colorPicker.addEventListener('change', () => {
                if (newColorHex) {
                    newColorHex.value = colorPicker.value;
                }
            });
        }

        if (newColorHex) {
            newColorHex.addEventListener('input', () => {
                if (colorPicker && this.isValidHex(newColorHex.value)) {
                    colorPicker.value = newColorHex.value;
                }
            });
        }

        // Setup Add Model Form
        const addModelForm = document.getElementById('addModelForm');
        if (addModelForm) {
            addModelForm.addEventListener('submit', (e) => this.handleAddModel(e));
        }

        // Setup Add Color Form
        const addColorForm = document.getElementById('addColorForm');
        if (addColorForm) {
            addColorForm.addEventListener('submit', (e) => this.handleAddColor(e));
        }
    }

    setupImageUpload() {
        const fileInput = document.getElementById('productImage');
        const previewContainer = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');

        if (fileInput && previewContainer && previewImg) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        previewImg.src = e.target.result;
                        previewContainer.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    previewContainer.style.display = 'none';
                }
            });
        }
    }

    calculateProfitMargin() {
        const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
        const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
        const profitAnalysis = document.getElementById('profitAnalysis');

        if (costPrice > 0 && sellingPrice > 0) {
            const profit = sellingPrice - costPrice;
            const margin = (profit / costPrice) * 100;
            const markup = (profit / sellingPrice) * 100;

            let colorClass = 'text-success';
            let status = 'Excellent';
            
            if (margin < 20) {
                colorClass = 'text-danger';
                status = 'Low';
            } else if (margin < 40) {
                colorClass = 'text-warning';
                status = 'Good';
            }

            profitAnalysis.innerHTML = `
                <span class="${colorClass}">
                    Profit: $${profit.toFixed(2)} | Margin: ${margin.toFixed(1)}% | Status: ${status}
                </span>
            `;
        } else {
            profitAnalysis.textContent = 'Enter prices to see profit margin';
        }
    }

    async handleBrandChange() {
        const brandSelect = document.getElementById('productBrand');
        const customBrandContainer = document.getElementById('customBrandContainer');
        const customBrandInput = document.getElementById('customBrand');
        const modelRow = document.getElementById('modelRow');
        const modelSelect = document.getElementById('productModel');

        if (!brandSelect) return;

        const selectedBrand = brandSelect.value;
        
        // Show/hide custom brand input
        if (selectedBrand === 'Other') {
            customBrandContainer.style.display = 'block';
            customBrandInput.required = true;
            modelRow.style.display = 'none';
            modelSelect.innerHTML = '<option value="">Select Model</option>';
        } else if (selectedBrand) {
            customBrandContainer.style.display = 'none';
            customBrandInput.required = false;
            customBrandInput.value = '';
            
            // Show model row and load models for selected brand
            modelRow.style.display = 'block';
            await this.loadPhoneModels(selectedBrand);
        } else {
            customBrandContainer.style.display = 'none';
            customBrandInput.required = false;
            modelRow.style.display = 'none';
            modelSelect.innerHTML = '<option value="">Select Model</option>';
        }
    }

    async handleModelChange() {
        const modelSelect = document.getElementById('productModel');
        const customModelRow = document.getElementById('customModelRow');
        const customModelInput = document.getElementById('customModel');

        if (!modelSelect) return;

        const selectedModel = modelSelect.value;
        
        if (selectedModel === '__ADD_NEW_MODEL__') {
            this.showAddModelModal();
            // Reset the selection after showing modal
            modelSelect.value = '';
        }
    }

    showAddModelModal() {
        const brandSelect = document.getElementById('productBrand');
        const customBrandInput = document.getElementById('customBrand');
        const modelBrandInput = document.getElementById('newModelBrand');
        
        let brandName = '';
        
        // Get the current brand name
        if (brandSelect && brandSelect.value && brandSelect.value !== 'Other') {
            brandName = brandSelect.value;
        } else if (customBrandInput && customBrandInput.value) {
            brandName = customBrandInput.value;
        }

        if (!brandName) {
            this.showError('Please select a brand first');
            return;
        }

        // Set the brand in the modal
        modelBrandInput.value = brandName;
        
        // Clear and focus on the model name input
        document.getElementById('newModelName').value = '';
        document.getElementById('newModelName').focus();

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addModelModal'));
        modal.show();
    }

    async handleAddModel(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('addModelBtn');
        const originalText = submitBtn.innerHTML;
        const modelBrand = document.getElementById('newModelBrand').value;
        const modelName = document.getElementById('newModelName').value.trim();

        if (!modelName) {
            this.showError('Please enter a phone model name');
            return;
        }

        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    brand: modelBrand,
                    model: modelName
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                // Close the modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addModelModal'));
                modal.hide();

                // Reload models for the current brand to include the new one
                await this.loadPhoneModels(modelBrand);
                
                // Select the newly added model
                const modelSelect = document.getElementById('productModel');
                if (modelSelect) {
                    modelSelect.value = modelName;
                }

                this.showSuccess(`Phone model "${modelName}" added successfully for ${modelBrand}!`);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add model');
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async loadColors() {
        try {
            const response = await fetch(`${this.apiBase}/colors`);
            if (response.ok) {
                const colors = await response.json();
                this.populateColorSelect(colors);
            } else {
                // Handle silently for colors
            }
        } catch (error) {
            // Handle silently for colors
        }
    }

    populateColorSelect(colors) {
        const colorSelect = document.getElementById('productColor');
        if (!colorSelect) return;

        // Clear existing options except the first two
        colorSelect.innerHTML = '<option value="">Select Color</option><option value="__ADD_NEW_COLOR__">+ Add New Color</option>';
        
        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color.name;
            option.textContent = color.name;
            if (color.hex_code) {
                option.style.backgroundColor = color.hex_code;
                option.style.color = this.getContrastColor(color.hex_code);
            }
            colorSelect.appendChild(option);
        });
    }

    async handleColorChange() {
        const colorSelect = document.getElementById('productColor');
        if (!colorSelect) return;

        const selectedColor = colorSelect.value;
        
        if (selectedColor === '__ADD_NEW_COLOR__') {
            this.showAddColorModal();
            // Reset the selection after showing modal
            colorSelect.value = '';
        }
    }

    showAddColorModal() {
        // Clear and focus on the color name input
        document.getElementById('newColorName').value = '';
        document.getElementById('newColorHex').value = '#000000';
        document.getElementById('colorPicker').value = '#000000';
        document.getElementById('newColorName').focus();

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addColorModal'));
        modal.show();
    }

    async handleAddColor(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('addColorBtn');
        const originalText = submitBtn.innerHTML;
        const colorName = document.getElementById('newColorName').value.trim();
        const colorHex = document.getElementById('newColorHex').value.trim();

        if (!colorName) {
            this.showError('Please enter a color name');
            return;
        }

        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/colors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: colorName,
                    hex_code: colorHex || null
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                // Close the modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addColorModal'));
                modal.hide();

                // Reload colors to include the new one
                await this.loadColors();
                
                // Select the newly added color
                const colorSelect = document.getElementById('productColor');
                if (colorSelect) {
                    colorSelect.value = colorName;
                }

                this.showSuccess(`Color "${colorName}" added successfully!`);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add color');
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    isValidHex(hex) {
        return /^#[0-9A-F]{6}$/i.test(hex);
    }

    getContrastColor(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }

    async loadPhoneModels(brand) {
        try {
            const response = await fetch(`${this.apiBase}/models/${encodeURIComponent(brand)}`);
            if (response.ok) {
                const models = await response.json();
                this.populateModelSelect(models);
            } else {
                // Handle silently for models
            }
        } catch (error) {
            // Handle silently for models
        }
    }

    populateModelSelect(models) {
        const modelSelect = document.getElementById('productModel');
        if (!modelSelect) return;

        modelSelect.innerHTML = '<option value="">Select Model</option>';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });

        // Add "Add New Model" option
        const addNewOption = document.createElement('option');
        addNewOption.value = '__ADD_NEW_MODEL__';
        addNewOption.textContent = '+ Add New Model';
        modelSelect.appendChild(addNewOption);
    }

    async handleAddProduct(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;

        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(form);
            
            // Handle custom brand and model data
            const brandSelect = document.getElementById('productBrand');
            const customBrandInput = document.getElementById('customBrand');
            const modelSelect = document.getElementById('productModel');
            const customModelInput = document.getElementById('customModel');
            const colorSelect = document.getElementById('productColor');
            const customColorInput = document.getElementById('customColor');
            
            let brand = brandSelect.value;
            let model = modelSelect ? modelSelect.value : '';
            let color = colorSelect ? colorSelect.value : '';
            
            // If "Other" brand selected, use custom brand input
            if (brand === 'Other') {
                brand = customBrandInput.value;
            }
            
            // Handle custom model input
            if (modelSelect && modelSelect.value === '__ADD_NEW_MODEL__') {
                model = customModelInput ? customModelInput.value : '';
            }
            
            // Handle custom color input
            if (colorSelect && colorSelect.value === '__ADD_NEW_COLOR__') {
                color = customColorInput ? customColorInput.value : '';
            }
            
            // Remove the old category field and add brand/model/color
            formData.delete('category');
            formData.delete('custom_brand');
            formData.delete('custom_model');
            formData.delete('custom_color');
            formData.append('brand', brand);
            formData.append('model', model);
            formData.append('color', color);
            
            // Add product data
            const response = await fetch(`${this.apiBase}/products`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccessModal();
                form.reset();
                document.getElementById('imagePreview').style.display = 'none';
                this.calculateProfitMargin();
                this.loadRecentProducts();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add product');
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    showSuccessModal() {
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
        modal.show();
    }

    async loadRecentProducts() {
        try {
            const response = await fetch(`${this.apiBase}/products`);
            if (response.ok) {
                const products = await response.json();
                this.displayRecentProducts(products.slice(0, 5));
            }
        } catch (error) {
            // Handle silently for recent products
        }
    }

    displayRecentProducts(products) {
        const container = document.getElementById('recentProducts');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No products yet</p>';
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        products.forEach(product => {
            const profit = product.selling_price - product.cost_price;
            const margin = product.cost_price > 0 ? ((profit / product.cost_price) * 100).toFixed(1) : '0';
            
            const brandModel = product.brand && product.model ? `${product.brand} ${product.model}` : (product.brand || product.model || 'Uncategorized');
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${product.name}</h6>
                            <small class="text-muted">${brandModel}</small>
                            <br>
                            <small class="text-success">$${profit.toFixed(2)} profit (${margin}%)</small>
                        </div>
                        <span class="badge ${product.quantity > 10 ? 'badge-success' : product.quantity > 0 ? 'badge-warning' : 'badge-danger'}">
                            ${product.quantity}
                        </span>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    // Products List Page Initialization
    async initProductsList() {
        await this.loadProducts();
        this.setupFilters();
        this.setupViewToggle();
        this.setupModalHandlers();
    }

    async loadProducts() {
        try {
            const response = await fetch(`${this.apiBase}/products`);
            if (response.ok) {
                this.products = await response.json();
                this.filteredProducts = [...this.products];
                this.displayProducts();
                this.updateTotalCount();
            } else {
                throw new Error('Failed to load products');
            }
        } catch (error) {
            this.showError('Failed to load products');
        }
    }

    setupFilters() {
        const searchInput = document.getElementById('searchInput');
        const brandFilter = document.getElementById('brandFilter');
        const stockFilter = document.getElementById('stockFilter');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
        }
        if (brandFilter) {
            brandFilter.addEventListener('change', () => this.applyFilters());
        }
        if (stockFilter) {
            stockFilter.addEventListener('change', () => this.applyFilters());
        }
    }

    setupViewToggle() {
        const gridBtn = document.getElementById('gridViewBtn');
        const listBtn = document.getElementById('listViewBtn');

        if (gridBtn) {
            gridBtn.addEventListener('click', () => this.setView('grid'));
        }
        if (listBtn) {
            listBtn.addEventListener('click', () => this.setView('list'));
        }
    }

    setView(view) {
        this.currentView = view;
        this.displayProducts();
        
        // Update button states
        const gridBtn = document.getElementById('gridViewBtn');
        const listBtn = document.getElementById('listViewBtn');
        
        if (gridBtn && listBtn) {
            gridBtn.classList.toggle('active', view === 'grid');
            listBtn.classList.toggle('active', view === 'list');
        }
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const brand = document.getElementById('brandFilter')?.value || '';
        const stockStatus = document.getElementById('stockFilter')?.value || '';

        this.filteredProducts = this.products.filter(product => {
            const matchesSearch = !searchTerm || 
                product.name.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm)) ||
                (product.brand && product.brand.toLowerCase().includes(searchTerm)) ||
                (product.model && product.model.toLowerCase().includes(searchTerm));

            const matchesBrand = !brand || product.brand === brand;

            const matchesStock = !stockStatus || 
                (stockStatus === 'in-stock' && product.quantity > 10) ||
                (stockStatus === 'low-stock' && product.quantity > 0 && product.quantity <= 10) ||
                (stockStatus === 'out-of-stock' && product.quantity === 0);

            return matchesSearch && matchesBrand && matchesStock;
        });

        this.displayProducts();
        this.updateTotalCount();
    }

    displayProducts() {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (this.filteredProducts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No products found</h5>
                    <p class="text-muted">Try adjusting your filters or add a new product.</p>
                    <a href="add-product.html" class="btn btn-primary">
                        <i class="fas fa-plus me-1"></i>Add Product
                    </a>
                </div>
            `;
            return;
        }

        if (this.currentView === 'grid') {
            this.displayGridView();
        } else {
            this.displayListView();
        }
    }

    displayGridView() {
        const container = document.getElementById('productsContainer');
        let html = '<div class="row">';

        this.filteredProducts.forEach(product => {
            const profit = product.selling_price - product.cost_price;
            const margin = product.cost_price > 0 ? ((profit / product.cost_price) * 100).toFixed(1) : '0';
            const stockClass = product.quantity > 10 ? 'success' : product.quantity > 0 ? 'warning' : 'danger';
            const stockText = product.quantity > 10 ? 'In Stock' : product.quantity > 0 ? 'Low Stock' : 'Out of Stock';

            html += `
                <div class="col-lg-4 col-md-6 mb-4">
                    <div class="card product-card h-100">
                        ${product.image_path ? `
                            <img src="${product.image_path}" alt="${product.name}" class="product-image">
                        ` : `
                            <div class="product-image d-flex align-items-center justify-content-center bg-light">
                                <i class="fas fa-image fa-3x text-muted"></i>
                            </div>
                        `}
                        <div class="card-body d-flex flex-column">
                            <h5 class="product-title">${product.name}</h5>
                            <p class="text-muted small mb-2">${product.brand && product.model ? `${product.brand} ${product.model}` : (product.brand || product.model || 'Uncategorized')}</p>
                            <p class="product-price mb-2">$${product.selling_price.toFixed(2)}</p>
                            <p class="product-cost small mb-3">Cost: $${product.cost_price.toFixed(2)} | Profit: $${profit.toFixed(2)} (${margin}%)</p>
                            <div class="mt-auto">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="badge badge-${stockClass}">${stockText}</span>
                                    <span class="product-quantity">${product.quantity} units</span>
                                </div>
                                <div class="btn-group w-100" role="group">
                                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="productManager.editProduct(${product.id})">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="productManager.deleteProduct(${product.id}, '${product.name}')">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    displayListView() {
        const container = document.getElementById('productsContainer');
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Brand & Model</th>
                            <th>Cost Price</th>
                            <th>Selling Price</th>
                            <th>Profit</th>
                            <th>Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.filteredProducts.forEach(product => {
            const profit = product.selling_price - product.cost_price;
            const margin = product.cost_price > 0 ? ((profit / product.cost_price) * 100).toFixed(1) : '0';
            const stockClass = product.quantity > 10 ? 'success' : product.quantity > 0 ? 'warning' : 'danger';
            const stockText = product.quantity > 10 ? 'In Stock' : product.quantity > 0 ? 'Low Stock' : 'Out of Stock';

            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            ${product.image_path ? `
                                <img src="${product.image_path}" alt="${product.name}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">
                            ` : `
                                <div class="bg-light rounded me-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                    <i class="fas fa-image text-muted"></i>
                                </div>
                            `}
                            <div>
                                <strong>${product.name}</strong>
                                <br><small class="text-muted">${product.brand && product.model ? `${product.brand} ${product.model}` : (product.brand || product.model || 'Uncategorized')}</small>
                                ${product.description ? `<br><small class="text-muted">${product.description.substring(0, 50)}...</small>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>${product.brand && product.model ? `${product.brand} ${product.model}` : (product.brand || product.model || 'Uncategorized')}</td>
                    <td>$${product.cost_price.toFixed(2)}</td>
                    <td>$${product.selling_price.toFixed(2)}</td>
                    <td>
                        <span class="text-success">$${profit.toFixed(2)}</span>
                        <br><small class="text-muted">${margin}%</small>
                    </td>
                    <td>
                        <span class="badge badge-${stockClass}">${stockText}</span>
                        <br><small>${product.quantity} units</small>
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="productManager.editProduct(${product.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" onclick="productManager.deleteProduct(${product.id}, '${product.name}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
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

    updateTotalCount() {
        const totalCountElement = document.getElementById('totalProductsCount');
        if (totalCountElement) {
            totalCountElement.textContent = this.filteredProducts.length;
        }
    }

    setupModalHandlers() {
        // Edit product modal
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => this.saveProductEdit());
        }

        // Delete product modal
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteProduct());
        }
    }

    async editProduct(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`);
            if (response.ok) {
                const product = await response.json();
                this.populateEditModal(product);
                const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
                modal.show();
            } else {
                throw new Error('Failed to load product details');
            }
        } catch (error) {
            this.showError('Failed to load product details');
        }
    }

    populateEditModal(product) {
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductBrand').value = product.brand || '';
        document.getElementById('editProductModel').value = product.model || '';
        document.getElementById('editProductDescription').value = product.description || '';
        document.getElementById('editCostPrice').value = product.cost_price;
        document.getElementById('editSellingPrice').value = product.selling_price;
        document.getElementById('editQuantity').value = product.quantity;
    }

    async saveProductEdit() {
        const form = document.getElementById('editProductForm');
        const formData = new FormData(form);
        const productId = formData.get('id');

        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.get('name'),
                    brand: formData.get('brand'),
                    model: formData.get('model'),
                    description: formData.get('description'),
                    cost_price: parseFloat(formData.get('cost_price')),
                    selling_price: parseFloat(formData.get('selling_price')),
                    quantity: parseInt(formData.get('quantity'))
                })
            });

            if (response.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
                modal.hide();
                this.showSuccess('Product updated successfully');
                await this.loadProducts();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update product');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    deleteProduct(productId, productName) {
        this.productToDelete = { id: productId, name: productName };
        document.getElementById('deleteProductName').textContent = productName;
        const modal = new bootstrap.Modal(document.getElementById('deleteProductModal'));
        modal.show();
    }

    async confirmDeleteProduct() {
        if (!this.productToDelete) return;

        try {
            const response = await fetch(`${this.apiBase}/products/${this.productToDelete.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteProductModal'));
                modal.hide();
                this.showSuccess('Product deleted successfully');
                await this.loadProducts();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete product');
            }
        } catch (error) {
            this.showError(error.message);
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

// Global functions for HTML onclick events
function resetForm() {
    document.getElementById('addProductForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
}

function addAnother() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('successModal'));
    modal.hide();
    document.getElementById('productName').focus();
}

// Initialize product manager when page loads
let productManager;
document.addEventListener('DOMContentLoaded', () => {
    productManager = new ProductManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductManager;
}
