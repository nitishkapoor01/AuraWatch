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

  const hasRealProgress = progress !== null && progress !== undefined && progress > 0;
  const hasRealDuration = duration !== null && duration !== undefined && duration > 0;

  try {
    await db.query(`
      INSERT INTO watch_history (user_id, movie_id, movie_type, title, poster, backdrop, rating, year, progress, duration, season, episode, last_watched)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT(user_id, movie_id, movie_type, season, episode) 
      DO UPDATE SET 
        progress = CASE WHEN $9 IS NOT NULL AND $9 > 0 THEN $9 ELSE watch_history.progress END,
        duration = CASE WHEN $10 IS NOT NULL AND $10 > 0 THEN $10 ELSE watch_history.duration END,
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
      hasRealProgress ? progress : null,
      hasRealDuration ? duration : null,
      season || null,
      episode || null
    ]);

    res.status(201).json({ message: 'Watch history updated!' });
  } catch (error) {
    console.error('[WatchHistory] Add/Update error:', error);
    res.status(500).json({ message: 'Failed to update watch history.' });
  }
});

// Cleanup bad data: reset progress/duration=0 where they were set to dummy 10/100 values
router.post('/cleanup', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE watch_history SET progress = 0, duration = 0 
       WHERE user_id = $1 AND progress = 10 AND duration = 100`,
      [req.user.id]
    );
    res.json({ message: `Cleaned up ${result.rowCount} entries` });
  } catch (error) {
    console.error('[WatchHistory] Cleanup error:', error);
    res.status(500).json({ message: 'Cleanup failed.' });
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
