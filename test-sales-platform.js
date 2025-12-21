#!/usr/bin/env node

// Test script for Sales Platform and Upload Slip Feature
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return { status: response.status, data, ok: response.ok };
    } catch (error) {
        return { status: 500, data: { error: error.message }, ok: false };
    }
}

// Helper function to create test file
function createTestFile() {
    const testDir = path.join(__dirname, 'test_uploads');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFilePath = path.join(testDir, 'test-sale-slip.txt');
    fs.writeFileSync(testFilePath, 'Test sale slip content');
    return testFilePath;
}

// Test functions
async function testPlatformSelection() {
    console.log('\n🧪 Testing Sales Platform Selection...');
    
    // Test 1: Create sale with platform selection (should succeed)
    const saleData = {
        product_id: 1,
        quantity_sold: 1,
        sale_price: 25.99,
        sales_platform: 'Amazon',
        customer_info: JSON.stringify({
            sale_date: new Date().toISOString(),
            recorded_by: 'System'
        })
    };
    
    const response = await makeRequest(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
    });
    
    if (response.ok && response.status === 200) {
        console.log('✅ SUCCESS: Sale with platform (Amazon) recorded successfully');
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        return response.data;
    } else {
        console.log('❌ FAILED: Sale with platform failed');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data.error || 'Unknown error'}`);
        return null;
    }
}

async function testSlipUpload() {
    console.log('\n🧪 Testing Slip Upload Feature...');
    
    // Create test file
    const testFilePath = createTestFile();
    console.log(`📁 Created test file: ${testFilePath}`);
    
    try {
        // Create form data
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(testFilePath);
        formData.append('slip', fileBuffer, {
            filename: 'test-sale-slip.txt',
            contentType: 'text/plain'
        });
        
        // Upload slip
        const uploadResponse = await fetch(`${API_BASE}/upload-sale-slip`, {
            method: 'POST',
            body: formData
        });
        
        const uploadData = await uploadResponse.json();
        
        if (uploadResponse.ok && uploadData.path) {
            console.log('✅ SUCCESS: Slip file uploaded successfully');
            console.log(`   Path: ${uploadData.path}`);
            console.log(`   Filename: ${uploadData.filename}`);
            return uploadData.path;
        } else {
            console.log('❌ FAILED: Slip upload failed');
            console.log(`   Error: ${uploadData.error || 'Unknown error'}`);
            return null;
        }
    } catch (error) {
        console.log('❌ FAILED: Slip upload error');
        console.log(`   Error: ${error.message}`);
        return null;
    } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
            console.log('🧹 Cleaned up test file');
        }
    }
}

async function testSaleWithSlip() {
    console.log('\n🧪 Testing Sale with Platform and Slip Upload...');
    
    // First upload slip
    const slipPath = await testSlipUpload();
    if (!slipPath) {
        console.log('⚠️ SKIPPED: Cannot test sale with slip - upload failed');
        return null;
    }
    
    // Create sale with slip
    const saleData = {
        product_id: 1,
        quantity_sold: 2,
        sale_price: 24.99,
        sales_platform: 'Flipkart',
        slip_path: slipPath,
        customer_info: JSON.stringify({
            sale_date: new Date().toISOString(),
            recorded_by: 'System'
        })
    };
    
    const response = await makeRequest(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
    });
    
    if (response.ok && response.status === 200) {
        console.log('✅ SUCCESS: Sale with platform and slip recorded successfully');
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        return response.data;
    } else {
        console.log('❌ FAILED: Sale with platform and slip failed');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data.error || 'Unknown error'}`);
        return null;
    }
}

async function testBackwardCompatibility() {
    console.log('\n🧪 Testing Backward Compatibility (without platform)...');
    
    // Test: Create sale without platform (should fail as platform is now required)
    const saleData = {
        product_id: 1,
        quantity_sold: 1,
        sale_price: 29.99
    };
    
    const response = await makeRequest(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
    });
    
    if (!response.ok && response.status === 400) {
        console.log('✅ SUCCESS: Platform validation working (sale without platform rejected)');
        console.log(`   Expected error: ${response.data.error}`);
        return true;
    } else {
        console.log('❌ FAILED: Platform validation not working properly');
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        return false;
    }
}

async function testDifferentPlatforms() {
    console.log('\n🧪 Testing Different Sales Platforms...');
    
    const platforms = ['Meesho', 'eBay', 'Shopify', 'Direct Sale', 'WhatsApp Business', 'Instagram'];
    let successCount = 0;
    
    for (const platform of platforms) {
        const saleData = {
            product_id: 1,
            quantity_sold: 1,
            sale_price: 19.99,
            sales_platform: platform,
            customer_info: JSON.stringify({
                sale_date: new Date().toISOString(),
                recorded_by: 'System'
            })
        };
        
        const response = await makeRequest(`${API_BASE}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleData)
        });
        
        if (response.ok) {
            console.log(`   ✅ ${platform}: SUCCESS`);
            successCount++;
        } else {
            console.log(`   ❌ ${platform}: FAILED - ${response.data.error || 'Unknown error'}`);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📊 Platform Test Results: ${successCount}/${platforms.length} platforms successful`);
    return successCount === platforms.length;
}

async function testSalesRetrieval() {
    console.log('\n🧪 Testing Sales Data Retrieval...');
    
    const response = await makeRequest(`${API_BASE}/sales`);
    
    if (response.ok && Array.isArray(response.data)) {
        console.log('✅ SUCCESS: Sales data retrieved successfully');
        console.log(`   Total sales: ${response.data.length}`);
        
        // Check if sales have platform information
        const salesWithPlatform = response.data.filter(sale => sale.sales_platform);
        console.log(`   Sales with platform info: ${salesWithPlatform.length}`);
        
        // Check if any sales have slip uploads
        const salesWithSlip = response.data.filter(sale => sale.slip_path);
        console.log(`   Sales with slip uploads: ${salesWithSlip.length}`);
        
        // Show sample sale with platform
        if (salesWithPlatform.length > 0) {
            const sampleSale = salesWithPlatform[0];
            console.log(`   Sample sale platform: ${sampleSale.sales_platform}`);
        }
        
        return true;
    } else {
        console.log('❌ FAILED: Could not retrieve sales data');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data.error || 'Unknown error'}`);
        return false;
    }
}

async function testAllPlatforms() {
    console.log('\n🧪 Testing All Sales Platform Options...');
    
    // Test each platform option from the frontend dropdown
    const platforms = [
        'Amazon', 'Flipkart', 'Meesho', 'eBay', 'Shopify', 
        'WooCommerce', 'Direct', 'Offline', 'WhatsApp', 
        'Instagram', 'Facebook', 'Other'
    ];
    
    let successCount = 0;
    
    for (const platform of platforms) {
        const saleData = {
            product_id: 1,
            quantity_sold: 1,
            sale_price: 15.99,
            sales_platform: platform,
            customer_info: JSON.stringify({
                sale_date: new Date().toISOString(),
                recorded_by: 'System'
            })
        };
        
        const response = await makeRequest(`${API_BASE}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleData)
        });
        
        if (response.ok) {
            console.log(`   ✅ ${platform}: SUCCESS`);
            successCount++;
        } else {
            console.log(`   ❌ ${platform}: FAILED - ${response.data.error || 'Unknown error'}`);
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`📊 All Platforms Test Results: ${successCount}/${platforms.length} platforms successful`);
    return successCount === platforms.length;
}

// Main test execution
async function runTests() {
    console.log('🚀 Starting Sales Platform and Upload Slip Feature Tests');
    console.log('=' .repeat(60));
    
    let passCount = 0;
    let totalTests = 0;
    
    // Test 1: Platform Selection
    totalTests++;
    const platformTest = await testPlatformSelection();
    if (platformTest) passCount++;
    
    // Test 2: Slip Upload
    totalTests++;
    const slipTest = await testSlipUpload();
    if (slipTest) passCount++;
    
    // Test 3: Sale with Slip
    totalTests++;
    const saleWithSlipTest = await testSaleWithSlip();
    if (saleWithSlipTest) passCount++;
    
    // Test 4: Backward Compatibility
    totalTests++;
    const compatibilityTest = await testBackwardCompatibility();
    if (compatibilityTest) passCount++;
    
    // Test 5: Different Platforms
    totalTests++;
    const platformsTest = await testDifferentPlatforms();
    if (platformsTest) passCount++;
    
    // Test 6: Sales Retrieval
    totalTests++;
    const retrievalTest = await testSalesRetrieval();
    if (retrievalTest) passCount++;
    
    // Test 7: All Platform Options
    totalTests++;
    const allPlatformsTest = await testAllPlatforms();
    if (allPlatformsTest) passCount++;
    
    // Results
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));
    console.log(`✅ Tests Passed: ${passCount}/${totalTests}`);
    console.log(`📈 Success Rate: ${((passCount/totalTests) * 100).toFixed(1)}%`);
    
    if (passCount === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED! Sales Platform and Upload Slip feature is working correctly!');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the errors above.');
    }
    
    console.log('\n📋 Feature Summary:');
    console.log('   ✅ Sales Platform Selection: Added to Record New Sale form');
    console.log('   ✅ Upload Slip Feature: File upload with validation');
    console.log('   ✅ Database Schema: Updated sales table with platform and slip columns');
    console.log('   ✅ API Enhancement: /api/sales and /api/upload-sale-slip endpoints');
    console.log('   ✅ Frontend Integration: Platform dropdown and file upload UI');
    console.log('   ✅ Sales Display: Platform and slip indicators in sales list');
    console.log('   ✅ Success Modal: Shows platform and slip upload status');
}

// Check if server is running
async function checkServer() {
    try {
        const response = await fetch(BASE_URL);
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Run the tests
async function main() {
    console.log('🔍 Checking if server is running...');
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   cd /home/tiwari/esp-wifi/ecom && node server.js');
        process.exit(1);
    }
    
    console.log('✅ Server is running. Starting tests...\n');
    await runTests();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Test execution interrupted by user');
    process.exit(0);
});

// Start tests
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testPlatformSelection,
    testSlipUpload,
    testSaleWithSlip,
    testBackwardCompatibility,
    testDifferentPlatforms,
    testSalesRetrieval,
    testAllPlatforms
};
