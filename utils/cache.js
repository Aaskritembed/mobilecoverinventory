/**
 * Simple in-memory caching utility for static data
 * Improves performance by caching frequently accessed data like phone models, colors, etc.
 */

class Cache {
    constructor() {
        this.cache = new Map();
        this.timestamps = new Map();
        this.defaultTTL = 30 * 60 * 1000; // 30 minutes in milliseconds
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {any} Cached value or null if expired/not found
     */
    get(key, ttl = this.defaultTTL) {
        const timestamp = this.timestamps.get(key);
        
        // Check if key exists and hasn't expired
        if (timestamp && (Date.now() - timestamp) < ttl) {
            return this.cache.get(key);
        }
        
        // Remove expired entry
        if (timestamp) {
            this.cache.delete(key);
            this.timestamps.delete(key);
        }
        
        return null;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, value);
        this.timestamps.set(key, Date.now());
    }

    /**
     * Remove value from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }

    /**
     * Get cache statistics
     * @returns {object} Cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Check if key exists and is valid
     * @param {string} key - Cache key
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {boolean} True if key exists and is valid
     */
    has(key, ttl = this.defaultTTL) {
        return this.get(key, ttl) !== null;
    }

    /**
     * Get cached value or fetch fresh data
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch fresh data if cache miss
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {Promise<any>} Cached or fresh data
     */
    async getOrFetch(key, fetchFn, ttl = this.defaultTTL) {
        const cached = this.get(key, ttl);
        if (cached !== null) {
            return cached;
        }

        const fresh = await fetchFn();
        this.set(key, fresh, ttl);
        return fresh;
    }
}

// Create singleton instance
const cache = new Cache();

/**
 * Phone models cache with specific TTL for mobile models (they change less frequently)
 */
class PhoneModelsCache extends Cache {
    constructor() {
        super();
        this.defaultTTL = 60 * 60 * 1000; // 1 hour for phone models
    }
}

/**
 * Colors cache for product colors
 */
class ColorsCache extends Cache {
    constructor() {
        super();
        this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours for colors (very stable)
    }
}

/**
 * Dashboard data cache for frequently accessed statistics
 */
class DashboardCache extends Cache {
    constructor() {
        super();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes for dashboard data
    }
}

// Create specialized cache instances
const phoneModelsCache = new PhoneModelsCache();
const colorsCache = new ColorsCache();
const dashboardCache = new DashboardCache();

// Export all cache instances
module.exports = {
    cache,
    phoneModelsCache,
    colorsCache,
    dashboardCache,
    Cache
};

// Export for browser usage
if (typeof window !== 'undefined') {
    window.Cache = Cache;
    window.cache = cache;
    window.phoneModelsCache = phoneModelsCache;
    window.colorsCache = colorsCache;
    window.dashboardCache = dashboardCache;
}
