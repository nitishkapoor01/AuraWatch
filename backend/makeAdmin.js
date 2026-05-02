require('dotenv').config();
const { Pool } = require('pg');

const email = process.argv[2];
if (!email) {
  console.log('Error: Please provide your email.');
  console.log('Usage: node makeAdmin.js your@email.com');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function makeAdmin() {
  try {
    const res = await pool.query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING *", [email]);
    if (res.rowCount === 0) {
      console.log(`❌ User with email "${email}" not found in database.`);
      console.log('Please make sure you have registered this account on the website first.');
    } else {
      console.log(`✅ Success! "${email}" has been upgraded to an ADMIN.`);
    }
  } catch (err) {
    console.error('Database Error:', err.message);
  } finally {
    pool.end();
  }
}

makeAdmin();
