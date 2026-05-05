const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const run = async () => {
  try {
    const res = await pool.query("UPDATE users SET role = 'admin', is_super_admin = true");
    console.log(`Successfully promoted ${res.rowCount} users to Admin!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
