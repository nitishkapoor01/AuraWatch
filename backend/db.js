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
        is_super_admin BOOLEAN DEFAULT FALSE,
        admin_permissions JSONB DEFAULT '{"all": true}',
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

      CREATE TABLE IF NOT EXISTS ai_search_cache (
        id SERIAL PRIMARY KEY,
        query TEXT UNIQUE NOT NULL,
        results JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS liked_searches (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        visitor_id TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_liked_searches_user_query ON liked_searches (user_id, query) WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_liked_searches_visitor_query ON liked_searches (visitor_id, query) WHERE visitor_id IS NOT NULL AND user_id IS NULL;

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

      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_type TEXT NOT NULL,
        name TEXT DEFAULT 'Anonymous',
        message TEXT,
        title TEXT,
        description TEXT,
        issue_type TEXT,
        status TEXT DEFAULT 'open',
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
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='is_super_admin') THEN
          ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='admin_permissions') THEN
          ALTER TABLE users ADD COLUMN admin_permissions JSONB DEFAULT '{"all": false}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='ui_preferences') THEN
          ALTER TABLE users ADD COLUMN ui_preferences JSONB DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='search_logs' AND COLUMN_NAME='user_id') THEN
          ALTER TABLE search_logs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='search_logs' AND COLUMN_NAME='success') THEN
          ALTER TABLE search_logs ADD COLUMN success BOOLEAN DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='search_logs' AND COLUMN_NAME='has_results') THEN
          ALTER TABLE search_logs ADD COLUMN has_results BOOLEAN DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='support_tickets' AND COLUMN_NAME='user_id') THEN
          ALTER TABLE support_tickets ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='support_tickets' AND COLUMN_NAME='visitor_id') THEN
          ALTER TABLE support_tickets ADD COLUMN visitor_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='support_tickets' AND COLUMN_NAME='admin_reply') THEN
          ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='support_tickets' AND COLUMN_NAME='replied_at') THEN
          ALTER TABLE support_tickets ADD COLUMN replied_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='support_tickets' AND COLUMN_NAME='replied_by') THEN
          ALTER TABLE support_tickets ADD COLUMN replied_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='support_tickets' AND COLUMN_NAME='is_read') THEN
          ALTER TABLE support_tickets ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='unique_visitors' AND COLUMN_NAME='country_code') THEN
          ALTER TABLE unique_visitors ADD COLUMN country_code TEXT DEFAULT 'XX';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='unique_visitors' AND COLUMN_NAME='country_name') THEN
          ALTER TABLE unique_visitors ADD COLUMN country_name TEXT DEFAULT 'Unknown';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='platform_visits' AND COLUMN_NAME='country_code') THEN
          ALTER TABLE platform_visits ADD COLUMN country_code TEXT DEFAULT 'XX';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='platform_visits' AND COLUMN_NAME='country_name') THEN
          ALTER TABLE platform_visits ADD COLUMN country_name TEXT DEFAULT 'Unknown';
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_visitor ON support_tickets(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_unique_visitors_country ON unique_visitors(country_code);
      CREATE INDEX IF NOT EXISTS idx_platform_visits_country ON platform_visits(country_code);

      CREATE TABLE IF NOT EXISTS ad_impressions (
        id SERIAL PRIMARY KEY,
        slot TEXT NOT NULL,
        visitor_id TEXT,
        session_id TEXT,
        device_type TEXT DEFAULT 'desktop',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ad_impressions_slot_date ON ad_impressions(slot, created_at);
      CREATE INDEX IF NOT EXISTS idx_ad_impressions_date ON ad_impressions(created_at);

      -- Seed default ads_config if it does not exist
      INSERT INTO settings (key, value)
      VALUES (
        'ads_config',
        '{"enabled":true,"download_modal":{"enabled":true,"timer_seconds":30,"format":"iframe","key":"8e9991a7d4aa3fef2ca28a617f3c1844","script_url":"//heavenlysuspicious.com/8e9991a7d4aa3fef2ca28a617f3c1844/invoke.js","width":300,"height":250},"movie_detail":{"enabled":true,"format":"iframe","key":"8e9991a7d4aa3fef2ca28a617f3c1844","script_url":"//heavenlysuspicious.com/8e9991a7d4aa3fef2ca28a617f3c1844/invoke.js","width":728,"height":90},"social_bar":{"enabled":true,"script_url":"https://pl31260175.profitableratecpmnetwork.com/b4/2e/27/b42e272664d703c5177e5d684f92dc85.js"}}'
      )
      ON CONFLICT (key) DO NOTHING;

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
