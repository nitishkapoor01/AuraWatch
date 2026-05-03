const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        security_question TEXT NOT NULL,
        security_answer_hash TEXT NOT NULL,
        avatar TEXT DEFAULT 'red',
        role TEXT DEFAULT 'user',
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER NOT NULL,
        movie_type TEXT NOT NULL DEFAULT 'movie',
        title TEXT NOT NULL,
        poster TEXT,
        backdrop TEXT,
        overview TEXT,
        rating TEXT,
        year TEXT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, movie_id, movie_type)
      );

      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

      CREATE TABLE IF NOT EXISTS watch_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER NOT NULL,
        movie_type TEXT NOT NULL DEFAULT 'movie',
        title TEXT NOT NULL,
        poster TEXT,
        backdrop TEXT,
        rating TEXT,
        year TEXT,
        progress INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        season INTEGER,
        episode INTEGER,
        last_watched TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, movie_id, movie_type, season, episode)
      );

      CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);

      CREATE TABLE IF NOT EXISTS user_activity (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        PRIMARY KEY (user_id, date)
      );

      CREATE TABLE IF NOT EXISTS platform_visits (
        session_id TEXT NOT NULL,
        date DATE NOT NULL,
        visitor_id TEXT,
        PRIMARY KEY (session_id, date)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS download_cache (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        year TEXT,
        cache_key TEXT UNIQUE NOT NULL,
        result JSONB NOT NULL,
        total_links INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS search_logs (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        success BOOLEAN DEFAULT TRUE,
        visitor_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        ip_address TEXT,
        success BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS blocked_ips (
        ip_address TEXT PRIMARY KEY,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS unique_visitors (
        visitor_id TEXT PRIMARY KEY,
        first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_ip TEXT,
        is_registered BOOLEAN DEFAULT FALSE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='is_banned') THEN
          ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_download_cache_key ON download_cache(cache_key);
    `);
    console.log('[DB] PostgreSQL database initialized');
  } catch (err) {
    console.error('[DB] Failed to initialize PostgreSQL:', err);
  }
};

initDB();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
