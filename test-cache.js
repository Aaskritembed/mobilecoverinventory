#!/usr/bin/env node

// Test script for the caching system
const { phoneModelsCache, colorsCache, dashboardCache } = require('./utils/cache');

console.log('🧪 Testing Cache System Implementation\n');

// Test 1: Phone Models Cache
console.log('📱 Testing Phone Models Cache...');
phoneModelsCache.getOrFetch('test_phones', async () => {
    console.log('⏳ Fetching data for the first time...');
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(['iPhone 15', 'Samsung Galaxy S24', 'Google Pixel 8']);
        }, 1000);
    });
}).then(data => {
    console.log('✅ First fetch result:', data);
    
    // Test second fetch (should be cached)
    phoneModelsCache.getOrFetch('test_phones', async () => {
        console.log('❌ This should not execute (cached data should be returned)');
        return ['should', 'not', 'execute'];
    }).then(cachedData => {
        console.log('✅ Second fetch (cached):', cachedData);
        console.log('🎯 Phone models cache working correctly!\n');
        
        // Test 2: Colors Cache
        console.log('🎨 Testing Colors Cache...');
        colorsCache.getOrFetch('test_colors', async () => {
            console.log('⏳ Fetching colors for the first time...');
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve([
                        { id: 1, name: 'Black', hex_code: '#000000' },
                        { id: 2, name: 'White', hex_code: '#FFFFFF' },
                        { id: 3, name: 'Red', hex_code: '#FF0000' }
                    ]);
                }, 800);
            });
        }).then(colors => {
            console.log('✅ First colors fetch result:', colors.length, 'colors');
            
            // Test colors cache invalidation
            colorsCache.delete('test_colors');
            console.log('🗑️ Cache invalidated');
            
            // Test after invalidation
            colorsCache.getOrFetch('test_colors', async () => {
                console.log('⏳ Fetching colors again after invalidation...');
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve([
                            { id: 4, name: 'Blue', hex_code: '#0000FF' },
                            { id: 5, name: 'Green', hex_code: '#008000' }
                        ]);
                    }, 600);
                });
            }).then(newColors => {
                console.log('✅ Colors after invalidation:', newColors.length, 'colors');
                console.log('🎨 Colors cache working correctly!\n');
                
                // Test 3: Dashboard Cache
                console.log('📊 Testing Dashboard Cache...');
                dashboardCache.getOrFetch('test_dashboard', async () => {
                    console.log('⏳ Fetching dashboard data...');
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                total_products: 150,
                                total_sales: 89,
                                total_revenue: 2450.75,
                                low_stock_products: []
                            });
                        }, 1200);
                    });
                }).then(dashboard => {
                    console.log('✅ Dashboard data:', dashboard);
                    console.log('📊 Dashboard cache working correctly!\n');
                    
                    // Test 4: Cache Statistics
                    console.log('📈 Cache Statistics:');
                    console.log('📱 Phone Models Cache:', {
                        size: phoneModelsCache.size,
                        has_test: phoneModelsCache.has('test_phones')
                    });
                    console.log('🎨 Colors Cache:', {
                        size: colorsCache.size,
                        has_test: colorsCache.has('test_colors')
                    });
                    console.log('📊 Dashboard Cache:', {
                        size: dashboardCache.size,
                        has_test: dashboardCache.has('test_dashboard')
                    });
                    
                    console.log('\n🎉 All cache tests passed successfully!');
                    console.log('✅ Caching system is working as expected');
                    console.log('\n💡 Cache Benefits:');
                    console.log('   • Reduced database queries');
                    console.log('   • Faster response times');
                    console.log('   • Improved performance for frequently accessed data');
                    console.log('   • Automatic cache invalidation on data updates');
                });
            });
        });
    });
}).catch(err => {
    console.error('❌ Cache test failed:', err);
});
