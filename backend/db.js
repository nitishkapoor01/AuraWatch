const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'aurawatch.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    avatar TEXT DEFAULT 'red',
    role TEXT DEFAULT 'user',
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL,
    movie_type TEXT NOT NULL DEFAULT 'movie',
    title TEXT NOT NULL,
    poster TEXT,
    backdrop TEXT,
    overview TEXT,
    rating TEXT,
    year TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, movie_id, movie_type)
  );

  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
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
    last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, movie_id, movie_type, season, episode)
  );

  CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);

  CREATE TABLE IF NOT EXISTS user_activity (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS platform_visits (
    session_id TEXT NOT NULL,
    date TEXT NOT NULL,
    PRIMARY KEY (session_id, date)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

console.log('[DB] SQLite database initialized');

module.exports = db;
