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

    // Fetch from multiple TMDB endpoints in parallel to cover more content
    const endpoints = [
      '/trending/all/day?page=1',
      '/trending/all/day?page=2',
      '/trending/all/day?page=3',
      '/trending/all/week?page=1',
      '/movie/popular?page=1',
      '/movie/popular?page=2',
      '/tv/popular?page=1',
      '/tv/popular?page=2',
      '/movie/top_rated?page=1',
      '/tv/top_rated?page=1',
      '/movie/now_playing?page=1',
      '/movie/upcoming?page=1',
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
        uniqueItems.push({ id: item.id, type });
      }
    }

    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Dynamic Content -->`;

    for (const item of uniqueItems) {
      xml += `
  <url>
    <loc>${FRONTEND_URL}/movie/${item.id}?type=${item.type}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    xml += `\n</urlset>`;

    // Cache it
    sitemapCache = xml;
    sitemapCachedAt = now;

    console.log(`[Sitemap] Dynamically generated with ${uniqueItems.length} URLs`);
    res.header('Content-Type', 'application/xml');
    res.send(xml);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
