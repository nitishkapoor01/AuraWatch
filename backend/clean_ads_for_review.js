const db = require('./db');

async function cleanAds() {
  try {
    const r = await db.query("SELECT value FROM settings WHERE key = 'ads_config'");
    let cfg = {};
    if (r.rows.length > 0 && r.rows[0].value) {
      cfg = JSON.parse(r.rows[0].value);
    }
    
    // Disable banner slots so crawler sees a clean, compliant streaming site
    if (cfg.download_modal) cfg.download_modal.enabled = false;
    if (cfg.movie_detail) cfg.movie_detail.enabled = false;
    if (cfg.search_grid) cfg.search_grid.enabled = false;
    if (cfg.social_bar) cfg.social_bar.enabled = false;
    
    // Set single compliant pre-roll zone
    cfg.pre_roll = {
      enabled: true,
      type: 'vast',
      vast_url: 'https://s.magsrv.com/v1/vast.php?idz=6033024',
      timer_seconds: 5,
      fallback_banner: false
    };

    await db.query(
      "UPDATE settings SET value = $1 WHERE key = 'ads_config'",
      [JSON.stringify(cfg)]
    );

    console.log('✅ Successfully updated ads_config to Clean Review Mode:');
    console.log(JSON.stringify(cfg, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning ads:', err);
    process.exit(1);
  }
}

cleanAds();
