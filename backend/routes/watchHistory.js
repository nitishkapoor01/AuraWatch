const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get user's watch history
router.get('/', async (req, res) => {
  try {
    const history = await db.query(
      `SELECT * FROM (
        SELECT DISTINCT ON (movie_id, movie_type) * 
        FROM watch_history 
        WHERE user_id = $1 
        ORDER BY movie_id, movie_type, last_watched DESC
      ) sub
      ORDER BY last_watched DESC`,
      [req.user.id]
    );
    res.json(history.rows);
  } catch (error) {
    console.error('[WatchHistory] Get error:', error);
    res.status(500).json({ message: 'Failed to fetch watch history.' });
  }
});

// Add or update watch history (upsert)
router.post('/', async (req, res) => {
  const { movieId, movieType, title, poster, backdrop, rating, year, progress, duration, season, episode } = req.body;

  if (!movieId || !title) {
    return res.status(400).json({ message: 'Movie ID and title are required.' });
  }

  try {
    await db.query(`
      INSERT INTO watch_history (user_id, movie_id, movie_type, title, poster, backdrop, rating, year, progress, duration, season, episode, last_watched)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT(user_id, movie_id, movie_type, season, episode) 
      DO UPDATE SET 
        progress = EXCLUDED.progress,
        duration = EXCLUDED.duration,
        last_watched = NOW(),
        title = EXCLUDED.title,
        poster = EXCLUDED.poster,
        backdrop = EXCLUDED.backdrop
    `, [
      req.user.id,
      movieId,
      movieType || 'movie',
      title,
      poster || '',
      backdrop || '',
      rating || '',
      year || '',
      progress || 0,
      duration || 0,
      season || null,
      episode || null
    ]);

    res.status(201).json({ message: 'Watch history updated!' });
  } catch (error) {
    console.error('[WatchHistory] Add/Update error:', error);
    res.status(500).json({ message: 'Failed to update watch history.' });
  }
});

// Delete from watch history
router.delete('/:movieId', async (req, res) => {
  const { movieId } = req.params;
  const { type = 'movie' } = req.query;

  try {
    await db.query(
      'DELETE FROM watch_history WHERE user_id = $1 AND movie_id = $2 AND movie_type = $3',
      [req.user.id, parseInt(movieId), type]
    );

    res.json({ message: 'Removed from watch history.' });
  } catch (error) {
    console.error('[WatchHistory] Delete error:', error);
    res.status(500).json({ message: 'Failed to remove from history.' });
  }
});

module.exports = router;
