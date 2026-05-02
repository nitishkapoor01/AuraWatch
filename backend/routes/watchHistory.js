const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get user's watch history
router.get('/', (req, res) => {
  try {
    const history = db.prepare(
      'SELECT * FROM watch_history WHERE user_id = ? ORDER BY last_watched DESC'
    ).all(req.user.id);
    res.json(history);
  } catch (error) {
    console.error('[WatchHistory] Get error:', error);
    res.status(500).json({ message: 'Failed to fetch watch history.' });
  }
});

// Add or update watch history (upsert)
router.post('/', (req, res) => {
  const { movieId, movieType, title, poster, backdrop, rating, year, progress, duration, season, episode } = req.body;

  if (!movieId || !title) {
    return res.status(400).json({ message: 'Movie ID and title are required.' });
  }

  try {
    db.prepare(`
      INSERT INTO watch_history (user_id, movie_id, movie_type, title, poster, backdrop, rating, year, progress, duration, season, episode, last_watched)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, movie_id, movie_type, season, episode) 
      DO UPDATE SET 
        progress = excluded.progress,
        duration = excluded.duration,
        last_watched = datetime('now'),
        title = excluded.title,
        poster = excluded.poster,
        backdrop = excluded.backdrop
    `).run(
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
    );

    res.status(201).json({ message: 'Watch history updated!' });
  } catch (error) {
    console.error('[WatchHistory] Add/Update error:', error);
    res.status(500).json({ message: 'Failed to update watch history.' });
  }
});

// Delete from watch history
router.delete('/:movieId', (req, res) => {
  const { movieId } = req.params;
  const { type = 'movie' } = req.query;

  try {
    db.prepare(
      'DELETE FROM watch_history WHERE user_id = ? AND movie_id = ? AND movie_type = ?'
    ).run(req.user.id, parseInt(movieId), type);

    res.json({ message: 'Removed from watch history.' });
  } catch (error) {
    console.error('[WatchHistory] Delete error:', error);
    res.status(500).json({ message: 'Failed to remove from history.' });
  }
});

module.exports = router;
