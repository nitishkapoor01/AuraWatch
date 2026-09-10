/**
 * Standardized API Base URL resolver
 * Ensures localhost, 127.0.0.1, and local IP addresses resolve to local backend (default port 10000).
 */
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocal = (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local')
  );

  if (isLocal) {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
      return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
    }
    // Default to port 10000 which matches backend/server.js PORT
    return `http://${hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost'}:10000/api`;
  }

  return 'https://aurawatch-1.onrender.com/api';
};
