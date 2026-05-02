export const fetchWithCache = async (url, onRevalidate = null) => {
  // Strip API key from URL so cache hits even when rotating keys
  const cleanUrl = url.split('api_key=')[0];
  const cacheKey = `aurawatch_v5_${cleanUrl}`; // Bumped version for localStorage
  
  let cachedData = null;

  // Try to get from localStorage cache first
  try {
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      cachedData = JSON.parse(cachedStr);
    }
  } catch (e) {
    console.warn("Cache read error", e);
  }

  // Network fetch promise
  const fetchPromise = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      
      // Save to cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("Cache write error", e);
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
