const express = require('express');
const router = express.Router();

const API_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('TMDB_API_KEY_'))
  .map(key => process.env[key])
  .filter(Boolean);

if (API_KEYS.length === 0 && process.env.TMDB_API_KEY) {
  API_KEYS.push(process.env.TMDB_API_KEY);
}

let keyIndex = 0;
const getApiKey = () => {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
};

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.aurawatch.fun';

// Simple in-memory cache — regenerate every 6 hours
let sitemapCache = null;
let sitemapCachedAt = 0;
const SITEMAP_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const fetchPage = async (endpoint) => {
  const apiKey = getApiKey();
  if (!apiKey) return [];
  try {
    const res = await fetch(`${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    return [];
  }
};

router.get('/sitemap.xml', async (req, res) => {
  try {
    const now = Date.now();

    // Serve from cache if fresh
    if (sitemapCache && now - sitemapCachedAt < SITEMAP_CACHE_TTL) {
      res.header('Content-Type', 'application/xml');
      return res.send(sitemapCache);
    }

    // Fetch from many TMDB endpoints for maximum coverage
    const endpoints = [
      '/trending/all/day?page=1',
      '/trending/all/day?page=2',
      '/trending/all/day?page=3',
      '/trending/all/week?page=1',
      '/trending/all/week?page=2',
      '/movie/popular?page=1',
      '/movie/popular?page=2',
      '/movie/popular?page=3',
      '/movie/popular?page=4',
      '/tv/popular?page=1',
      '/tv/popular?page=2',
      '/tv/popular?page=3',
      '/movie/top_rated?page=1',
      '/movie/top_rated?page=2',
      '/movie/top_rated?page=3',
      '/tv/top_rated?page=1',
      '/tv/top_rated?page=2',
      '/movie/now_playing?page=1',
      '/movie/now_playing?page=2',
      '/movie/upcoming?page=1',
      '/movie/upcoming?page=2',
    ];

    const resultsArray = await Promise.all(endpoints.map(e => fetchPage(e)));
    const allItems = resultsArray.flat();

    // Deduplicate items
    const seen = new Set();
    const uniqueItems = [];

    for (const item of allItems) {
      const type = item.media_type === 'tv' ? 'tv' : (item.first_air_date ? 'tv' : 'movie');
      const key = `${type}-${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Trending items get higher priority
        const isTrending = item.popularity > 50;
        uniqueItems.push({ id: item.id, type, priority: isTrending ? '0.9' : '0.7' });
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // Static pages with highest priority
    const staticPages = [
      { loc: FRONTEND_URL, priority: '1.0', changefreq: 'daily' },
      { loc: `${FRONTEND_URL}/search`, priority: '0.8', changefreq: 'weekly' },
      { loc: `${FRONTEND_URL}/watch-history`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${FRONTEND_URL}/favorites`, priority: '0.5', changefreq: 'monthly' },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->`;

    for (const page of staticPages) {
      xml += `
  <url>
    <loc>${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }

    xml += `\n  <!-- Dynamic Movie & TV Show Pages -->`;

    for (const item of uniqueItems) {
      xml += `
  <url>
    <loc>${FRONTEND_URL}/movie/${item.id}?type=${item.type}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${item.priority}</priority>
  </url>`;
    }

    xml += `\n</urlset>`;

    // Cache it
    sitemapCache = xml;
    sitemapCachedAt = now;

    console.log(`[Sitemap] Dynamically generated with ${uniqueItems.length} movie/TV URLs + ${staticPages.length} static pages`);
    res.header('Content-Type', 'application/xml');
    res.send(xml);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt served from backend too (for Render URL)
router.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://aurawatch-1.onrender.com/sitemap.xml
Sitemap: https://www.aurawatch.fun/sitemap-index.xml
`);
});

module.exports = router;

