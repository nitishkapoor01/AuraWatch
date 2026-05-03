const express = require('express');
const router = express.Router();
const db = require('../db');

const API_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('TMDB_API_KEY_'))
  .map(key => process.env[key])
  .filter(Boolean);

// Fallback to old key name if new ones aren't found
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
      if (response.status === 429) { // Rate limited
        const retryAfter = response.headers.get('retry-after') || 1;
        await new Promise(res => setTimeout(res, retryAfter * 1000));
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`[TMDB] Connection reset, retrying in ${500 * (i+1)}ms...`);
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

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes fresh (TMDB data doesn't change often)
const CACHE_HARD_TTL = 24 * 60 * 60 * 1000; // 24 hours fallback

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

  // 1. FRESH HIT: Return immediately
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  // 2. STALE HIT (SWR): Return stale data immediately, but fetch in background
  if (cached && now < cached.hardExpiresAt) {
    // Trigger background fetch (don't await)
    revalidate(url, forceType, cacheKey).catch(err => console.error(`[SWR] Background refresh failed:`, err.message));
    return cached.data;
  }

  // 3. MISS or HARD EXPIRED: Must fetch now
  return await revalidate(url, forceType, cacheKey);
};

const revalidate = async (url, forceType, cacheKey) => {
  // REQUEST COALESCING: Check if someone is already fetching this exact URL
  let promise = pendingRequests.get(cacheKey);
  if (promise) {
    return await promise;
  }

  const fetchPromise = (async () => {
    try {
      console.log(`[Backend] Fetching from TMDB: ${url}`);
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.status_message || 'TMDB API Error');
      
      let results;
      if (Array.isArray(data.results)) {
        results = data.results.map(m => formatMovie(m, forceType));
      } else {
        results = formatMovie(data, forceType);
      }
      
      cache.set(cacheKey, {
        data: results,
        expiresAt: Date.now() + CACHE_TTL,
        hardExpiresAt: Date.now() + CACHE_HARD_TTL
      });
      
      return results;
    } catch (error) {
      const expired = cache.get(cacheKey);
      if (expired) {
        console.warn(`[Fallback] Network error, serving expired cache for ${cacheKey}`);
        return expired.data;
      }
      throw error;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return await fetchPromise;
};

// Trending
router.get('/trending', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/trending/all/day?api_key=${getApiKey()}&page=${page}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Continue Watching (Using Popular)
router.get('/continue-watching', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/movie/popular?api_key=${getApiKey()}&page=${page}`, 'movie');
    const formatted = data.map(m => ({ ...m, timeLeft: Math.floor(Math.random() * 2) + 1 + 'h ' + Math.floor(Math.random() * 60) + 'm left' }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Top Rated
router.get('/top-rated', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/movie/top_rated?api_key=${getApiKey()}&page=${page}`, 'movie');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Action Movies
router.get('/action', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=28&page=${page}`, 'movie');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Comedy Movies
router.get('/comedy', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=35&page=${page}`, 'movie');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Horror Movies
router.get('/horror', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=27&page=${page}`, 'movie');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Netflix Originals
router.get('/originals', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/discover/tv?api_key=${getApiKey()}&with_networks=213&page=${page}`, 'tv');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Dynamic Genre
router.get('/genre/:id', async (req, res) => {
  const { id } = req.params;
  const page = req.query.page || 1;
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/discover/movie?api_key=${getApiKey()}&with_genres=${id}&page=${page}`, 'movie');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Search movies
router.get('/search', async (req, res) => {
  const { query, visitorId } = req.query;
  try {
    const url = query 
      ? `${TMDB_BASE_URL}/search/multi?api_key=${getApiKey()}&query=${encodeURIComponent(query)}`
      : `${TMDB_BASE_URL}/trending/all/day?api_key=${getApiKey()}`;
    const data = await fetchAndFormat(url);
    
    // Log the search if it's a real query
    if (query && query.trim() !== '') {
      try {
        const hasResults = data && data.length > 0;
        await db.query(
          "INSERT INTO search_logs (query, has_results, visitor_id) VALUES ($1, $2, $3)",
          [query.trim().toLowerCase(), hasResults, visitorId || null]
        );
      } catch (logError) {
        console.error('Failed to log search query:', logError);
      }
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search' });
  }
});

router.get('/:id/videos', async (req, res) => {
  const { id } = req.params;
  const { type = 'movie' } = req.query;
  const mediaType = type.toLowerCase() === 'series' || type.toLowerCase() === 'tv' ? 'tv' : 'movie';
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/${mediaType}/${id}/videos?api_key=${getApiKey()}`);
    const data = await response.json();
    const trailer = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube') || (data.results || [])[0];
    res.json(trailer || { key: null });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
});

// TV Seasons list
router.get('/:id/seasons', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/tv/${id}?api_key=${getApiKey()}`);
    const data = await response.json();
    const seasons = (data.seasons || [])
      .filter(s => s.season_number > 0)
      .map(s => ({
        id: s.id,
        number: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null,
        airDate: s.air_date,
      }));
    res.json(seasons);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch seasons' });
  }
});

// TV Season episodes
router.get('/:id/season/:num', async (req, res) => {
  const { id, num } = req.params;
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/tv/${id}/season/${num}?api_key=${getApiKey()}`);
    const data = await response.json();
    const episodes = (data.episodes || []).map(e => ({
      id: e.id,
      number: e.episode_number,
      name: e.name,
      overview: e.overview,
      runtime: e.runtime,
      airDate: e.air_date,
      still: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null,
      rating: e.vote_average ? Math.round(e.vote_average * 10) : null,
    }));
    res.json(episodes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch episodes' });
  }
});

router.get('/:id/similar', async (req, res) => {
  const { id } = req.params;
  const { type = 'movie' } = req.query;
  const mediaType = type.toLowerCase() === 'series' || type.toLowerCase() === 'tv' ? 'tv' : 'movie';
  try {
    const data = await fetchAndFormat(`${TMDB_BASE_URL}/${mediaType}/${id}/recommendations?api_key=${getApiKey()}`, mediaType);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recommendations' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  let { type = 'movie' } = req.query;
  
  const mediaType = type.toLowerCase() === 'series' || type.toLowerCase() === 'tv' ? 'tv' : 'movie';
  const url = `${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${getApiKey()}&append_to_response=credits`;
  
  try {
    const data = await fetchAndFormat(url, mediaType);
    if (data && data.id) {
      res.json(data);
    } else {
      res.status(404).json({ message: 'Movie not found' });
    }
  } catch (error) {
    console.error(`[Backend] Error: ${error.message}`);
    res.status(500).json({ message: 'Failed to fetch details' });
  }
});

module.exports = router;
