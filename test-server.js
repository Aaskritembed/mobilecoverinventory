#!/usr/bin/env node

// Simple test script to verify server startup
const { spawn } = require('child_process');

console.log('Starting server test...');

const serverProcess = spawn('node', ['server.js'], {
    stdio: ['inherit', 'pipe', 'pipe']
});

let serverOutput = '';
let serverError = '';

serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Server stdout:', output);
    serverOutput += output;
    
    // Check if server started successfully
    if (output.includes('Server is running on http://localhost:3000')) {
        console.log('✅ Server started successfully!');
        
        // Test basic endpoints
        setTimeout(async () => {
            try {
                const response = await fetch('http://localhost:3000/api/health');
                const data = await response.json();
                console.log('✅ Health endpoint working:', data.status);
                
                // Test CSRF endpoint
                const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf-token');
                const csrfData = await csrfResponse.json();
                console.log('✅ CSRF endpoint working');
                
                console.log('🎉 All tests passed! Server is working correctly.');
                
                // Graceful shutdown
                serverProcess.kill('SIGTERM');
                process.exit(0);
                
            } catch (error) {
                console.error('❌ Test failed:', error.message);
                serverProcess.kill('SIGTERM');
                process.exit(1);
            }
        }, 2000);
    }
});

serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.error('Server stderr:', error);
    serverError += error;
});

serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0) {
        console.error('Server startup failed:', serverError);
        process.exit(1);
    }
});

serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('Test timeout reached, killing server');
    serverProcess.kill('SIGTERM');
    process.exit(1);
}, 30000);
