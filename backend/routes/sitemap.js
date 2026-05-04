const express = require('express');
const router = express.Router();

const API_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('TMDB_API_KEY_'))
  .map(key => process.env[key])
  .filter(Boolean);

if (API_KEYS.length === 0 && process.env.TMDB_API_KEY) {
  API_KEYS.push(process.env.TMDB_API_KEY);
}

const getApiKey = () => {
  return API_KEYS.length > 0 ? API_KEYS[0] : null;
};

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.aurawatch.fun';

router.get('/sitemap.xml', async (req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).send('TMDB API Key missing');
    }

    // Fetch trending movies and TV shows for the sitemap
    const response = await fetch(`${TMDB_BASE_URL}/trending/all/day?api_key=${apiKey}&page=1`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.status_message || 'Failed to fetch from TMDB');
    }

    const items = data.results || [];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Pages -->
  <url>
    <loc>${FRONTEND_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${FRONTEND_URL}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${FRONTEND_URL}/mylist</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <!-- Trending Content -->`;

    items.forEach(item => {
      const type = item.media_type === 'tv' ? 'tv' : 'movie';
      const id = item.id;
      // Using today's date as lastmod for trending items
      const lastmod = new Date().toISOString().split('T')[0];
      
      xml += `
  <url>
    <loc>${FRONTEND_URL}/movie/${id}?type=${type}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
