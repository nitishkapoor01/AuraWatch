const express = require('express');
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------
// Public Endpoint: Shared Playlist (Guest or Logged in)
// -------------------------------------------------------------
router.get('/public/:id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id, 10);
    if (isNaN(playlistId)) {
      return res.status(400).json({ message: 'Invalid playlist ID.' });
    }

    const playlistRes = await db.query(
      `SELECT p.*, u.name as owner_name 
       FROM playlists p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.id = $1`,
      [playlistId]
    );

    if (playlistRes.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    const playlist = playlistRes.rows[0];
    if (!playlist.is_public) {
      return res.status(403).json({ message: 'This playlist is private.' });
    }

    const itemsRes = await db.query(
      `SELECT * FROM playlist_items 
       WHERE playlist_id = $1 
       ORDER BY added_at DESC`,
      [playlistId]
    );

    res.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        is_public: playlist.is_public,
        created_at: playlist.created_at,
        owner_name: playlist.owner_name,
        user_id: playlist.user_id
      },
      items: itemsRes.rows
    });
  } catch (error) {
    console.error('[Playlists] Public fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch public playlist.' });
  }
});

// -------------------------------------------------------------
// Authenticated Endpoints
// -------------------------------------------------------------
router.use(authMiddleware);

// Get all playlists for current user
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         p.id,
         p.name,
         p.description,
         p.is_public,
         p.created_at,
         p.updated_at,
         COUNT(pi.id)::int AS item_count,
         COALESCE(
           JSON_AGG(pi.poster) FILTER (WHERE pi.poster IS NOT NULL AND pi.poster <> ''), 
           '[]'::json
         ) AS preview_posters
       FROM playlists p
       LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );

    // Clean up preview posters to max 4 unique items
    const playlists = result.rows.map(pl => ({
      ...pl,
      preview_posters: Array.isArray(pl.preview_posters) 
        ? [...new Set(pl.preview_posters)].slice(0, 4) 
        : []
    }));

    res.json(playlists);
  } catch (error) {
    console.error('[Playlists] Get all error:', error);
    res.status(500).json({ message: 'Failed to fetch playlists.' });
  }
});

// Check which playlists contain a specific movie
router.get('/check/:movieId', async (req, res) => {
  const movieId = parseInt(req.params.movieId, 10);
  const type = req.query.type || 'movie';

  if (isNaN(movieId)) {
    return res.status(400).json({ message: 'Invalid movie ID.' });
  }

  try {
    const result = await db.query(
      `SELECT 
         p.id, 
         p.name,
         p.is_public,
         COUNT(DISTINCT pi_all.id)::int AS item_count,
         CASE WHEN pi_target.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_in_playlist
       FROM playlists p
       LEFT JOIN playlist_items pi_all ON p.id = pi_all.playlist_id
       LEFT JOIN playlist_items pi_target 
         ON p.id = pi_target.playlist_id 
         AND pi_target.movie_id = $2 
         AND pi_target.movie_type = $3
       WHERE p.user_id = $1
       GROUP BY p.id, pi_target.id
       ORDER BY p.updated_at DESC, p.name ASC`,
      [req.user.id, movieId, type]
    );

    res.json({ playlists: result.rows });
  } catch (error) {
    console.error('[Playlists] Check error:', error);
    res.status(500).json({ message: 'Failed to check playlist status.' });
  }
});

// Create a new playlist
router.post('/', async (req, res) => {
  const { name, description = '', isPublic = true } = req.body;

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return res.status(400).json({ message: 'Playlist name is required.' });
  }

  if (trimmedName.length > 60) {
    return res.status(400).json({ message: 'Playlist name cannot exceed 60 characters.' });
  }

  try {
    // Check max playlists count per user (anti-abuse limit)
    const countRes = await db.query(
      'SELECT COUNT(*)::int AS count FROM playlists WHERE user_id = $1',
      [req.user.id]
    );

    if (countRes.rows[0].count >= 50) {
      return res.status(400).json({ message: 'Maximum limit of 50 playlists reached.' });
    }

    const insertRes = await db.query(
      `INSERT INTO playlists (user_id, name, description, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, trimmedName, description ? description.trim().slice(0, 200) : '', Boolean(isPublic)]
    );

    res.status(201).json({
      message: 'Playlist created successfully!',
      playlist: {
        ...insertRes.rows[0],
        item_count: 0,
        preview_posters: []
      }
    });
  } catch (error) {
    console.error('[Playlists] Create error:', error);
    res.status(500).json({ message: 'Failed to create playlist.' });
  }
});

// Get single playlist details and items
router.get('/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ message: 'Invalid playlist ID.' });
  }

  try {
    const playlistRes = await db.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [playlistId, req.user.id]
    );

    if (playlistRes.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    const itemsRes = await db.query(
      'SELECT * FROM playlist_items WHERE playlist_id = $1 ORDER BY added_at DESC',
      [playlistId]
    );

    res.json({
      playlist: playlistRes.rows[0],
      items: itemsRes.rows
    });
  } catch (error) {
    console.error('[Playlists] Get single error:', error);
    res.status(500).json({ message: 'Failed to fetch playlist items.' });
  }
});

// Update playlist (rename / change privacy)
router.put('/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { name, description, isPublic } = req.body;

  if (isNaN(playlistId)) {
    return res.status(400).json({ message: 'Invalid playlist ID.' });
  }

  const trimmedName = typeof name === 'string' ? name.trim() : undefined;
  if (trimmedName !== undefined && trimmedName.length === 0) {
    return res.status(400).json({ message: 'Playlist name cannot be empty.' });
  }
  if (trimmedName !== undefined && trimmedName.length > 60) {
    return res.status(400).json({ message: 'Playlist name cannot exceed 60 characters.' });
  }

  try {
    // Check IDOR / ownership
    const checkRes = await db.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [playlistId, req.user.id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found or access denied.' });
    }

    const updateRes = await db.query(
      `UPDATE playlists 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_public = COALESCE($3, is_public),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [
        trimmedName || null,
        description !== undefined ? description.trim().slice(0, 200) : null,
        isPublic !== undefined ? Boolean(isPublic) : null,
        playlistId,
        req.user.id
      ]
    );

    res.json({
      message: 'Playlist updated successfully!',
      playlist: updateRes.rows[0]
    });
  } catch (error) {
    console.error('[Playlists] Update error:', error);
    res.status(500).json({ message: 'Failed to update playlist.' });
  }
});

// Delete playlist
router.delete('/:id', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  if (isNaN(playlistId)) {
    return res.status(400).json({ message: 'Invalid playlist ID.' });
  }

  try {
    const delRes = await db.query(
      'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id',
      [playlistId, req.user.id]
    );

    if (delRes.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found or access denied.' });
    }

    res.json({ message: 'Playlist deleted successfully.' });
  } catch (error) {
    console.error('[Playlists] Delete error:', error);
    res.status(500).json({ message: 'Failed to delete playlist.' });
  }
});

// Add movie/show to playlist
router.post('/:id/items', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const { movieId, movieType, title, poster, backdrop, overview, rating, year } = req.body;

  if (isNaN(playlistId) || !movieId || !title) {
    return res.status(400).json({ message: 'Playlist ID, movie ID, and title are required.' });
  }

  try {
    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [playlistId, req.user.id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found or access denied.' });
    }

    // Insert item
    await db.query(
      `INSERT INTO playlist_items 
         (playlist_id, movie_id, movie_type, title, poster, backdrop, overview, rating, year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (playlist_id, movie_id, movie_type) DO NOTHING`,
      [
        playlistId,
        parseInt(movieId, 10),
        movieType || 'movie',
        title,
        poster || '',
        backdrop || '',
        overview || '',
        rating || '',
        year || ''
      ]
    );

    // Update updated_at of playlist
    await db.query(
      'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [playlistId]
    );

    res.status(201).json({ message: 'Added to playlist!' });
  } catch (error) {
    console.error('[Playlists] Add item error:', error);
    res.status(500).json({ message: 'Failed to add item to playlist.' });
  }
});

// Remove movie/show from playlist
router.delete('/:id/items/:movieId', async (req, res) => {
  const playlistId = parseInt(req.params.id, 10);
  const movieId = parseInt(req.params.movieId, 10);
  const type = req.query.type || 'movie';

  if (isNaN(playlistId) || isNaN(movieId)) {
    return res.status(400).json({ message: 'Valid playlist ID and movie ID are required.' });
  }

  try {
    // Verify ownership
    const ownerCheck = await db.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [playlistId, req.user.id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found or access denied.' });
    }

    await db.query(
      'DELETE FROM playlist_items WHERE playlist_id = $1 AND movie_id = $2 AND movie_type = $3',
      [playlistId, movieId, type]
    );

    await db.query(
      'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [playlistId]
    );

    res.json({ message: 'Removed from playlist.' });
  } catch (error) {
    console.error('[Playlists] Remove item error:', error);
    res.status(500).json({ message: 'Failed to remove item from playlist.' });
  }
});

module.exports = router;
