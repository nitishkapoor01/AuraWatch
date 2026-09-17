const db = require('../db');

async function cleanBotAnalytics() {
  console.log('[CLEANUP] Starting cleanup of automated crawler bot records...');

  try {
    // 1. Count bots in unique_visitors
    const countBefore = await db.query(`
      SELECT COUNT(*) as count 
      FROM unique_visitors 
      WHERE last_ip LIKE '57.141.%' 
         OR last_ip LIKE '69.63.%' 
         OR last_ip LIKE '66.220.%'
    `);
    console.log(`[CLEANUP] Found ${countBefore.rows[0].count} bot records in unique_visitors`);

    // 2. Delete from platform_visits where visitor is a bot
    const deletedPv = await db.query(`
      DELETE FROM platform_visits 
      WHERE visitor_id IN (
        SELECT visitor_id 
        FROM unique_visitors 
        WHERE last_ip LIKE '57.141.%' 
           OR last_ip LIKE '69.63.%' 
           OR last_ip LIKE '66.220.%'
      )
    `);
    console.log(`[CLEANUP] Deleted ${deletedPv.rowCount} bot records from platform_visits`);

    // 3. Delete from unique_visitors
    const deletedUv = await db.query(`
      DELETE FROM unique_visitors 
      WHERE last_ip LIKE '57.141.%' 
         OR last_ip LIKE '69.63.%' 
         OR last_ip LIKE '66.220.%'
    `);
    console.log(`[CLEANUP] Deleted ${deletedUv.rowCount} bot records from unique_visitors`);

    // 4. Verify new country breakdown
    const verify = await db.query(`
      SELECT 
        country_code, 
        country_name, 
        COUNT(*) as unique_visitors 
      FROM unique_visitors 
      WHERE country_code != 'XX' 
      GROUP BY country_code, country_name 
      ORDER BY unique_visitors DESC 
      LIMIT 10
    `);

    console.log('\n=== UPDATED REAL AUDIENCE BREAKDOWN (TOP 10) ===');
    console.table(verify.rows);

    const todayVerify = await db.query(`
      SELECT 
        country_code, 
        country_name, 
        COUNT(*) as visits 
      FROM platform_visits 
      WHERE date = CURRENT_DATE 
        AND country_code != 'XX' 
      GROUP BY country_code, country_name 
      ORDER BY visits DESC 
      LIMIT 10
    `);

    console.log('\n=== TODAY REAL AUDIENCE (TOP 10) ===');
    console.table(todayVerify.rows);

    console.log('\n[CLEANUP] Cleanup completed successfully!');
  } catch (error) {
    console.error('[CLEANUP] Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanBotAnalytics();
