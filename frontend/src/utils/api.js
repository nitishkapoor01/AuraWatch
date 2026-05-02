const CACHE_VERSION = 'aurawatch_v6';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — matches backend TTL

export const fetchWithCache = async (url, onRevalidate = null) => {
  // Strip API key from URL so cache hits even when rotating keys
  const cleanUrl = url.split('api_key=')[0];
  const cacheKey = `${CACHE_VERSION}_${cleanUrl}`;
  
  let cachedData = null;

  // Try to get from localStorage cache first
  try {
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      // Check if cache is still valid (within TTL)
      if (parsed._ts && Date.now() - parsed._ts < CACHE_TTL) {
        cachedData = parsed.data;
      } else if (parsed._ts) {
        // Stale but usable — use it but revalidate
        cachedData = parsed.data;
      } else {
        // Old format cache (no timestamp) — still usable
        cachedData = parsed;
      }
    }
  } catch (e) {
    console.warn("Cache read error", e);
  }

  // Network fetch promise
  const fetchPromise = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      
      // Save to cache with timestamp
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data, _ts: Date.now() }));
      } catch (e) {
        // localStorage full — clear old entries and retry
        clearOldCache();
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data, _ts: Date.now() }));
        } catch (e2) {
          console.warn("Cache write error after cleanup", e2);
        }
      }
      
      // Call revalidate callback if provided, meaning fresh data arrived
      if (onRevalidate) {
        onRevalidate(data);
      }
      
      return data;
    })
    .catch((error) => {
      console.error("Fetch error:", error);
      return []; 
    });

  // Stale-While-Revalidate: Return cache immediately if available, 
  // letting fetch finish in the background.
  if (cachedData) {
    return cachedData;
  }

  // If no cache, wait for the network response
  return fetchPromise;
};

// Clean up expired cache entries to free localStorage space
function clearOldCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('aurawatch_')) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val._ts && Date.now() - val._ts > 24 * 60 * 60 * 1000) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}
