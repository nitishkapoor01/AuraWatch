const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("UPDATE users SET is_super_admin = true, role = 'admin', admin_permissions = '{\"all\": true}' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1) RETURNING name, email");
    if (res.rowCount > 0) {
      console.log(`Promoted ${res.rows[0].name} (${res.rows[0].email}) to Super Admin`);
    } else {
      console.log('No users found to promote.');
    }
  } catch (e) {
    console.error('Promotion failed:', e);
  } finally {
    await pool.end();
  }
}

run();
