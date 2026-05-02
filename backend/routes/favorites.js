const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get user's favorites
router.get('/', async (req, res) => {
  try {
    const favorites = await db.query(
      'SELECT * FROM favorites WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.id]
    );
    res.json(favorites.rows);
  } catch (error) {
    console.error('[Favorites] Get error:', error);
    res.status(500).json({ message: 'Failed to fetch favorites.' });
  }
});

// Check if a movie is in favorites
router.get('/check/:movieId', async (req, res) => {
  const { movieId } = req.params;
  const { type = 'movie' } = req.query;
  try {
    const fav = await db.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND movie_id = $2 AND movie_type = $3',
      [req.user.id, parseInt(movieId), type]
    );
    res.json({ isFavorite: fav.rows.length > 0 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check favorite status.' });
  }
});

// Add to favorites
router.post('/', async (req, res) => {
  const { movieId, movieType, title, poster, backdrop, overview, rating, year } = req.body;

  if (!movieId || !title) {
    return res.status(400).json({ message: 'Movie ID and title are required.' });
  }

  try {
    await db.query(
      `INSERT INTO favorites (user_id, movie_id, movie_type, title, poster, backdrop, overview, rating, year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
       [req.user.id, movieId, movieType || 'movie', title, poster || '', backdrop || '', overview || '', rating || '', year || '']
    );

    res.status(201).json({ message: 'Added to My List!' });
  } catch (error) {
    console.error('[Favorites] Add error:', error);
    res.status(500).json({ message: 'Failed to add to list.' });
  }
});

// Remove from favorites
router.delete('/:movieId', async (req, res) => {
  const { movieId } = req.params;
  const { type = 'movie' } = req.query;

  try {
    await db.query(
      'DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2 AND movie_type = $3',
      [req.user.id, parseInt(movieId), type]
    );

    res.json({ message: 'Removed from My List.' });
  } catch (error) {
    console.error('[Favorites] Delete error:', error);
    res.status(500).json({ message: 'Failed to remove from list.' });
  }
});

module.exports = router;
