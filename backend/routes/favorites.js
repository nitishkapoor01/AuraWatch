const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get user's favorites
router.get('/', (req, res) => {
  try {
    const favorites = db.prepare(
      'SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC'
    ).all(req.user.id);
    res.json(favorites);
  } catch (error) {
    console.error('[Favorites] Get error:', error);
    res.status(500).json({ message: 'Failed to fetch favorites.' });
  }
});

// Check if a movie is in favorites
router.get('/check/:movieId', (req, res) => {
  const { movieId } = req.params;
  const { type = 'movie' } = req.query;
  try {
    const fav = db.prepare(
      'SELECT id FROM favorites WHERE user_id = ? AND movie_id = ? AND movie_type = ?'
    ).get(req.user.id, parseInt(movieId), type);
    res.json({ isFavorite: !!fav });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check favorite status.' });
  }
});

// Add to favorites
router.post('/', (req, res) => {
  const { movieId, movieType, title, poster, backdrop, overview, rating, year } = req.body;

  if (!movieId || !title) {
    return res.status(400).json({ message: 'Movie ID and title are required.' });
  }

  try {
    db.prepare(
      `INSERT OR IGNORE INTO favorites (user_id, movie_id, movie_type, title, poster, backdrop, overview, rating, year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, movieId, movieType || 'movie', title, poster || '', backdrop || '', overview || '', rating || '', year || '');

    res.status(201).json({ message: 'Added to My List!' });
  } catch (error) {
    console.error('[Favorites] Add error:', error);
    res.status(500).json({ message: 'Failed to add to list.' });
  }
});

// Remove from favorites
router.delete('/:movieId', (req, res) => {
  const { movieId } = req.params;
  const { type = 'movie' } = req.query;

  try {
    db.prepare(
      'DELETE FROM favorites WHERE user_id = ? AND movie_id = ? AND movie_type = ?'
    ).run(req.user.id, parseInt(movieId), type);

    res.json({ message: 'Removed from My List.' });
  } catch (error) {
    console.error('[Favorites] Delete error:', error);
    res.status(500).json({ message: 'Failed to remove from list.' });
  }
});

module.exports = router;
