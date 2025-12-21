const http = require('http');

// Test data with slip_path
const testData = {
    customer_name: "Test Customer with Slip",
    customer_email: "test@example.com",
    customer_phone: "+1-555-0123",
    product_name: "Test Product",
    quantity: 1,
    return_reason: "Quality Defect",
    return_condition: "good",
    sales_platform: "Amazon",
    notes: "Test return with slip path",
    slip_path: "/uploads/slip-test-12345.pdf"
};

// Convert to JSON
const postData = JSON.stringify(testData);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/returns',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('Testing POST /api/returns with slip_path...');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ SUCCESS: Returns API accepts slip_path field!');
        } else {
            console.log('❌ FAILED: Returns API does not accept slip_path field');
        }
    });
});

req.on('error', (e) => {
    console.error('❌ ERROR:', e.message);
});

req.write(postData);
req.end();
