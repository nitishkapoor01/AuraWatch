require('dotenv').config();
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL.replace(/"/g, '');
console.log('Connecting to:', connStr);

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT id, email, role FROM users')
  .then(res => console.log('Users in DB:', res.rows))
  .catch(err => console.error('Error:', err.message))
  .finally(() => pool.end());
