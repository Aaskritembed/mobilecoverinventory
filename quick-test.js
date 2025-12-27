#!/usr/bin/env node

// Quick server test script
const http = require('http');

console.log('🧪 Testing Mobile Cover Inventory System...\n');

function testEndpoint(name, port, path) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: path,
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`✅ ${name}: ${res.statusCode} ${res.statusMessage}`);
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        console.log(`   Response: ${json.message || 'OK'}`);
                    } catch (e) {
                        console.log(`   Response: HTML Page`);
                    }
                }
                resolve(res.statusCode === 200);
            });
        });

        req.on('error', (err) => {
            console.log(`❌ ${name}: ${err.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            console.log(`⏰ ${name}: Timeout`);
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

async function runTests() {
    const tests = [
        { name: 'Health Check', path: '/api/health' },
        { name: 'Dashboard', path: '/api/dashboard' },
        { name: 'Products List', path: '/api/products' },
        { name: 'Sales List', path: '/api/sales' },
        { name: 'Main Page', path: '/' }
    ];

    let passed = 0;
    let total = tests.length;

    console.log('Testing endpoints...\n');

    for (const test of tests) {
        const result = await testEndpoint(test.name, 3000, test.path);
        if (result) passed++;
    }

    console.log(`\n📊 Results: ${passed}/${total} tests passed`);

    if (passed === total) {
        console.log('🎉 All systems operational!');
        console.log('🌐 Access the system at: http://localhost:3000');
    } else if (passed > 0) {
        console.log('⚠️  Some systems are working. Check server logs.');
    } else {
        console.log('❌ Server may not be running. Try: node server.js');
    }
}

runTests().catch(console.error);

