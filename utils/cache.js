/**
 * Enhanced in-memory caching utility with size limits and improved performance
 * Provides caching for frequently accessed data with proper eviction policies
 */

class Cache {
    constructor(options = {}) {
        this.cache = new Map();
        this.timestamps = new Map();
        this.accessCounts = new Map();
        this.defaultTTL = options.defaultTTL || 30 * 60 * 1000; // 30 minutes
        this.maxSize = options.maxSize || 1000; // Maximum entries
        this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes
        this.hitCount = 0;
        this.missCount = 0;
        
        // Start cleanup timer
        this.startCleanupTimer();
    }

    /**
     * Get value from cache with LRU tracking
     * @param {string} key - Cache key
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {any} Cached value or null if expired/not found
     */
    get(key, ttl = this.defaultTTL) {
        const timestamp = this.timestamps.get(key);
        
        // Check if key exists and hasn't expired
        if (timestamp && (Date.now() - timestamp) < ttl) {
            // Update access count for LRU
            this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);
            this.hitCount++;
            return this.cache.get(key);
        }
        
        // Remove expired entry
        if (timestamp) {
            this.delete(key);
        }
        
        this.missCount++;
        return null;
    }

    /**
     * Set value in cache with size management
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = this.defaultTTL) {
        // Check size limits before adding
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        
        // Remove old entry if exists
        if (this.cache.has(key)) {
            this.delete(key);
        }
        
        // Add new entry
        this.cache.set(key, value);
        this.timestamps.set(key, Date.now());
        this.accessCounts.set(key, 0);
    }

    /**
     * Delete entry from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        this.accessCounts.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.timestamps.clear();
        this.accessCounts.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        if (this.cache.size === 0) return;
        
        let leastUsedKey = null;
        let minAccessCount = Infinity;
        
        for (const [key, count] of this.accessCounts.entries()) {
            if (count < minAccessCount) {
                minAccessCount = count;
                leastUsedKey = key;
            }
        }
        
        if (leastUsedKey) {
            this.delete(leastUsedKey);
        }
    }

    /**
     * Start automatic cleanup timer
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, timestamp] of this.timestamps.entries()) {
            if (now - timestamp >= this.defaultTTL) {
                expiredKeys.push(key);
            }
        }
        
        // Remove all expired entries
        for (const key of expiredKeys) {
            this.delete(key);
        }
        
        // Reset stats if too many misses
        if (this.missCount > 1000) {
            this.hitCount = 0;
            this.missCount = 0;
        }
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Get cache statistics
     * @returns {object} Cache statistics
     */
    getStats() {
        const hitRate = this.hitCount + this.missCount > 0 ? 
            (this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(2) : 0;
            
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: `${hitRate}%`,
            cleanupInterval: this.cleanupInterval,
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
