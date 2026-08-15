const cache = new Map();
const TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Gets data from memory cache if not expired.
 * @param {string} key 
 * @returns {*}
 */
export function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Sets data into memory cache with TTL.
 * @param {string} key 
 * @param {*} data 
 */
export function setCache(key, data) {
  const expiry = Date.now() + TTL;
  cache.set(key, { data, expiry });
  
  // Cleanup after TTL
  setTimeout(() => {
    const current = cache.get(key);
    if (current && Date.now() > current.expiry) {
      cache.delete(key);
    }
  }, TTL + 1000);
}

/**
 * Invalidates cache entry.
 * @param {string} key 
 */
export function invalidateCache(key) {
  cache.delete(key);
}
