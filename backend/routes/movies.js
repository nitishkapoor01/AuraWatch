const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const API_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('TMDB_API_KEY_'))
  .map(key => process.env[key])
  .filter(Boolean);

if (API_KEYS.length === 0 && process.env.TMDB_API_KEY) {
  API_KEYS.push(process.env.TMDB_API_KEY);
}

let currentKeyIndex = 0;

const getApiKey = () => {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
};

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const fetchWithRetry = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 1;
        await new Promise(res => setTimeout(res, retryAfter * 1000));
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, 500 * (i + 1)));
    }
  }
};

const formatMovie = (m, forceType = null) => {
  const mediaType = forceType || m.media_type || (m.first_air_date ? 'tv' : 'movie');
  let cast = [];
  if (m.credits && m.credits.cast) {
    cast = m.credits.cast.slice(0, 10).map(actor => ({
      id: actor.id,
      name: actor.name,
      character: actor.character,
      profile: actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : null
    }));
  }
  return {
    id: m.id,
    title: m.title || m.name,
    poster: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://picsum.photos/id/10/300/450',
    backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : 'https://picsum.photos/id/20/1200/500',
    type: mediaType === 'tv' ? 'Series' : 'Movie',
    rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
    year: (m.release_date || m.first_air_date || '').split('-')[0],
    overview: m.overview,
    cast: cast
  };
};

const cache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_HARD_TTL = 24 * 60 * 60 * 1000;

const getCacheKey = (url) => {
  try {
    const u = new URL(url);
    u.searchParams.delete('api_key');
    return u.toString();
  } catch (e) {
    return url.split('api_key=')[0];
  }
};

const fetchAndFormat = async (url, forceType = null) => {
  const now = Date.now();
  const cacheKey = getCacheKey(url);
  const cached = cache.get(cacheKey);
  if (cached && now < cached.expiresAt) return cached.data;
  if (cached && now < cached.hardExpiresAt) {
    revalidate(url, forceType, cacheKey).catch(err => console.error(`[SWR] Error:`, err.message));
    return cached.data;
  }
  return await revalidate(url, forceType, cacheKey);
};

const revalidate = async (url, forceType, cacheKey) => {
  let promise = pendingRequests.get(cacheKey);
  if (promise) return await promise;
  const fetchPromise = (async () => {
    try {
      const response = await fetchWithRetry(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.status_message || 'TMDB API Error');
      let results = Array.isArray(data.results) ? data.results.map(m => formatMovie(m, forceType)) : formatMovie(data, forceType);
      cache.set(cacheKey, { data: results, expiresAt: Date.now() + CACHE_TTL, hardExpiresAt: Date.now() + CACHE_HARD_TTL });
      return results;
    } catch (error) {
      const expired = cache.get(cacheKey);
      if (expired) return expired.data;
      throw error;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  pendingRequests.set(cacheKey, fetchPromise);
  return await fetchPromise;
};

const fetchMultiPages = async (urlBuilder, forceType, maxPages = 4) => {
  const promises = [];
  for (let i = 1; i <= maxPages; i++) {
    promises.push(fetchAndFormat(urlBuilder(i), forceType).catch(() => []));
  }
  const results = await Promise.all(promises);
  const combined = results.flat();
  // Deduplicate by ID
  const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
  return unique;
};

// --- CORE ROUTES ---
router.get('/trending', async (req, res) => {
  try {
    const urlBuilder = (page) => `${TMDB_BASE_URL}/trending/all/day?api_key=${getApiKey()}&page=${page}`;
    res.json(await fetchMultiPages(urlBuilder, null, 4));
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

router.get('/trending-india', async (req, res) => {
  try {
    const urlBuilder = (page) => `${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&region=IN&with_origin_country=IN&sort_by=popularity.desc&page=${page}&with_release_type=3|2`;
    res.json(await fetchMultiPages(urlBuilder, 'movie', 2));
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

router.get('/new-this-week', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const urlBuilder = (page) => `${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&primary_release_date.gte=${lastWeek}&primary_release_date.lte=${today}&sort_by=popularity.desc&page=${page}`;
    res.json(await fetchMultiPages(urlBuilder, 'movie', 2));
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// Fast suggestions endpoint — sirf 1 page, navbar ke liye
router.get('/suggestions', async (req, res) => {
  const { query } = req.query;
  if (!query || !query.trim()) return res.json([]);
  try {
    const url = `${TMDB_BASE_URL}/search/multi?api_key=${getApiKey()}&query=${encodeURIComponent(query)}&page=1`;
    const data = await fetchAndFormat(url, null);
    res.json(Array.isArray(data) ? data.slice(0, 6) : []);
  } catch (e) { res.status(500).json([]); }
});

router.get('/search', optionalAuth, async (req, res) => {
  const { query, visitorId } = req.query;
  const userId = req.user ? req.user.id : null;
  try {
    let data = [];
    if (query && query.trim()) {
      const urlBuilder = (page) => `${TMDB_BASE_URL}/search/multi?api_key=${getApiKey()}&query=${encodeURIComponent(query)}&page=${page}`;
      data = await fetchMultiPages(urlBuilder, null, 4);
      try {
        await db.query(
          "INSERT INTO search_logs (query, success, has_results, visitor_id, user_id) VALUES ($1, $2, $3, $4, $5)",
          [query.trim().toLowerCase(), data.length > 0, data.length > 0, visitorId || null, userId]
        );
      } catch (l) {
        console.error('[Search Logging Failed]:', l);
      }
    } else {
      const urlBuilder = (page) => `${TMDB_BASE_URL}/trending/all/day?api_key=${getApiKey()}&page=${page}`;
      data = await fetchMultiPages(urlBuilder, null, 4);
    }
    res.json(data);
  } catch (error) { res.status(500).json({ message: 'Error' }); }
});


router.get('/discover', async (req, res) => {
  const { type, genre, lang } = req.query;
  const langMap = { 'hollywood': 'en', 'bollywood': 'hi', 'south': 'te|ta|kn|ml', 'anime': 'ja' };
  const mediaType = (type === 'Series' || type === 'tv') ? 'tv' : 'movie';
  const tmdbLang = langMap[lang] || '';
  
  try {
    const urlBuilder = (page) => {
      let url = `${TMDB_BASE_URL}/discover/${mediaType}?api_key=${getApiKey()}&page=${page}&sort_by=popularity.desc`;
      if (genre && genre !== 'all') url += `&with_genres=${genre}`;
      if (tmdbLang) url += `&with_original_language=${tmdbLang}`;
      return url;
    };
    res.json(await fetchMultiPages(urlBuilder, mediaType, 4));
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// --- HOME PAGE ENDPOINTS ---
router.get('/originals', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/discover/tv?api_key=${getApiKey()}&with_networks=213&page=${req.query.page || 1}`, 'tv')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/continue-watching', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/movie/popular?api_key=${getApiKey()}&page=${req.query.page || 1}`, 'movie')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/top-rated', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/movie/top_rated?api_key=${getApiKey()}&page=${req.query.page || 1}`, 'movie')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/action', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=28&page=${req.query.page || 1}`, 'movie')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/comedy', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=35&page=${req.query.page || 1}`, 'movie')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/horror', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=27&page=${req.query.page || 1}`, 'movie')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/genre/:id', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=${req.params.id}&page=${req.query.page || 1}`, 'movie')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});
router.get('/k-drama', async (req, res) => {
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/discover/tv?api_key=${getApiKey()}&with_original_language=ko&sort_by=popularity.desc&page=${req.query.page || 1}`, 'tv')); } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// --- SEARCH HISTORY & LIKED SEARCHES ENDPOINTS ---
// IMPORTANT: These must be defined BEFORE the /:id catch-all route

router.get('/recent-searches', optionalAuth, async (req, res) => {
  const visitorId = req.query.visitorId || null;
  const userId = req.user ? req.user.id : null;

  if (!visitorId && !userId) {
    return res.json([]);
  }

  try {
    const result = await db.query(
      `SELECT query, MAX(created_at) as last_searched
       FROM search_logs
       WHERE visitor_id = $1 OR (user_id = $2 AND user_id IS NOT NULL)
       GROUP BY query
       ORDER BY last_searched DESC`,
      [visitorId, userId]
    );

    const likedRes = await db.query(
      `SELECT query FROM liked_searches
       WHERE visitor_id = $1 OR (user_id = $2 AND user_id IS NOT NULL)`,
      [visitorId, userId]
    );
    const likedQueries = new Set(likedRes.rows.map(r => r.query.toLowerCase().trim()));

    const recentMap = new Map();
    for (const row of result.rows) {
      const cleanQ = row.query.replace(/^\[AI (Cache|Groq|Search Error|Groq Error)\]\s*/i, '').trim();
      if (cleanQ && !recentMap.has(cleanQ)) {
        recentMap.set(cleanQ, row.last_searched);
      }
    }

    const recentSearches = Array.from(recentMap.entries()).map(([query, last_searched]) => ({
      query,
      last_searched,
      is_liked: likedQueries.has(query.toLowerCase().trim())
    })).slice(0, 10);

    res.json(recentSearches);
  } catch (error) {
    console.error('[Get Recent Searches Error]:', error);
    res.status(500).json({ error: 'Failed to fetch recent searches' });
  }
});

router.get('/liked-searches', optionalAuth, async (req, res) => {
  const visitorId = req.query.visitorId || null;
  const userId = req.user ? req.user.id : null;

  if (!visitorId && !userId) {
    return res.json([]);
  }

  try {
    const result = await db.query(
      `SELECT DISTINCT query, created_at
       FROM liked_searches
       WHERE visitor_id = $1 OR (user_id = $2 AND user_id IS NOT NULL)
       ORDER BY created_at DESC`,
      [visitorId, userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[Get Liked Searches Error]:', error);
    res.status(500).json({ error: 'Failed to fetch liked searches' });
  }
});

router.post('/like-search', optionalAuth, async (req, res) => {
  const { query, visitorId } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }
  const cleanQ = query.trim().toLowerCase();

  try {
    const checkRes = await db.query(
      'SELECT id FROM liked_searches WHERE LOWER(query) = $1 AND (visitor_id = $2 OR (user_id = $3 AND user_id IS NOT NULL))',
      [cleanQ, visitorId || null, userId]
    );

    if (checkRes.rows.length === 0) {
      await db.query(
        'INSERT INTO liked_searches (query, visitor_id, user_id) VALUES ($1, $2, $3)',
        [query.trim(), visitorId || null, userId]
      );
    } else if (userId) {
      await db.query(
        'UPDATE liked_searches SET user_id = $1 WHERE LOWER(query) = $2 AND (visitor_id = $3 OR user_id = $1)',
        [userId, cleanQ, visitorId || null]
      );
    }

    res.status(201).json({ success: true, message: 'Search liked!' });
  } catch (error) {
    console.error('[Like Search Error]:', error);
    res.status(500).json({ error: 'Failed to like search' });
  }
});

router.delete('/like-search', optionalAuth, async (req, res) => {
  const { query, visitorId } = req.body;
  const userId = req.user ? req.user.id : null;
  const queryToUse = query || req.query.query;
  const visitorIdToUse = visitorId || req.query.visitorId;

  if (!queryToUse || !queryToUse.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }
  const cleanQ = queryToUse.trim().toLowerCase();

  try {
    await db.query(
      'DELETE FROM liked_searches WHERE LOWER(query) = $1 AND (visitor_id = $2 OR (user_id = $3 AND user_id IS NOT NULL))',
      [cleanQ, visitorIdToUse || null, userId]
    );
    res.json({ success: true, message: 'Search unliked' });
  } catch (error) {
    console.error('[Unlike Search Error]:', error);
    res.status(500).json({ error: 'Failed to unlike search' });
  }
});

router.delete('/recent-searches/clear', optionalAuth, async (req, res) => {
  const visitorId = req.body.visitorId || req.query.visitorId;
  const userId = req.user ? req.user.id : null;

  if (!visitorId && !userId) {
    return res.status(400).json({ error: 'VisitorId or Auth Token is required' });
  }

  try {
    await db.query(
      'DELETE FROM search_logs WHERE visitor_id = $1 OR (user_id = $2 AND user_id IS NOT NULL)',
      [visitorId || null, userId]
    );
    res.json({ success: true, message: 'Search history cleared' });
  } catch (error) {
    console.error('[Clear Recent Searches Error]:', error);
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

router.delete('/recent-searches', optionalAuth, async (req, res) => {
  const { query, visitorId } = req.body;
  const userId = req.user ? req.user.id : null;
  const queryToUse = query || req.query.query;
  const visitorIdToUse = visitorId || req.query.visitorId;

  if (!queryToUse || !queryToUse.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }
  const cleanQ = queryToUse.trim().toLowerCase();

  try {
    await db.query(
      `DELETE FROM search_logs
       WHERE (LOWER(query) = $1
              OR LOWER(query) = '[ai cache] ' || $1
              OR LOWER(query) = '[ai groq] ' || $1
              OR LOWER(query) = '[ai search error] ' || $1
              OR LOWER(query) = '[ai groq error] ' || $1)
       AND (visitor_id = $2 OR (user_id = $3 AND user_id IS NOT NULL))`,
      [cleanQ, visitorIdToUse || null, userId]
    );
    res.json({ success: true, message: 'Recent search deleted' });
  } catch (error) {
    console.error('[Delete Recent Search Error]:', error);
    res.status(500).json({ error: 'Failed to delete recent search' });
  }
});

// --- DETAILS & TV ENDPOINTS ---
router.get('/:id/videos', async (req, res) => {
  const { id } = req.params;
  const type = (req.query.type || '').toLowerCase();
  const mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
  try {
    const r = await fetchWithRetry(`${TMDB_BASE_URL}/${mediaType}/${id}/videos?api_key=${getApiKey()}`);
    const d = await r.json();
    const trailer = (d.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube') || (d.results || [])[0];
    res.json(trailer || { key: null });
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

router.get('/:id/seasons', async (req, res) => {
  try {
    const r = await fetchWithRetry(`${TMDB_BASE_URL}/tv/${req.params.id}?api_key=${getApiKey()}`);
    const d = await r.json();
    res.json((d.seasons || []).filter(s => s.season_number > 0).map(s => ({ id: s.id, number: s.season_number, name: s.name, episodeCount: s.episode_count, poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null })));
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

router.get('/:id/season/:num', async (req, res) => {
  try {
    const r = await fetchWithRetry(`${TMDB_BASE_URL}/tv/${req.params.id}/season/${req.params.num}?api_key=${getApiKey()}`);
    const d = await r.json();
    res.json((d.episodes || []).map(e => ({ id: e.id, number: e.episode_number, name: e.name, overview: e.overview, runtime: e.runtime, still: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null, rating: e.vote_average ? Math.round(e.vote_average * 10) : null })));
  } catch (e) { res.status(500).json({ message: 'Error' }); }
});

router.get('/:id/similar', async (req, res) => {
  const type = (req.query.type || '').toLowerCase();
  const mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/${mediaType}/${req.params.id}/recommendations?api_key=${getApiKey()}`, mediaType)); } catch (e) { res.status(500).json({ message: 'Error' }); }
});

router.get('/:id', async (req, res) => {
  const type = (req.query.type || '').toLowerCase();
  const mediaType = (type === 'series' || type === 'tv') ? 'tv' : 'movie';
  try { res.json(await fetchAndFormat(`${TMDB_BASE_URL}/${mediaType}/${req.params.id}?api_key=${getApiKey()}&append_to_response=credits`, mediaType)); } catch (e) { res.status(500).json({ message: 'Error' }); }
});

module.exports = router;
