require('dotenv').config();
const express = require('express');
const cors = require('cors');
const movieRoutes = require('./routes/movies');
const authRoutes = require('./routes/auth');
const favoritesRoutes = require('./routes/favorites');
const watchHistoryRoutes = require('./routes/watchHistory');
const adminRoutes = require('./routes/admin');
const trackingRoutes = require('./routes/tracking');
const settingsRoutes = require('./routes/settings');
const downloadsRoutes = require('./routes/downloads');

// Initialize database
require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

const path = require('path');

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/movies', movieRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/watch-history', watchHistoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/downloads', downloadsRoutes);

app.get('/', (req, res) => {
  res.send('AuraWatch API is running');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
