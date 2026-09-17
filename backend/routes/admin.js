const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, isAdmin, isModerator } = require('../middleware/auth');

// Apply auth check to all routes
router.use(authMiddleware);

// --- GET ROUTES (Moderator & Admin Access) ---

// Fetch Platform Stats
router.get('/stats', isModerator, async (req, res) => {
  try {
    const totalUsers = (await db.query('SELECT COUNT(*) as count FROM users')).rows[0].count;
    const totalFavorites = (await db.query('SELECT COUNT(*) as count FROM favorites')).rows[0].count;
    
    // Completed watches (90%+)
    const totalWatches = (await db.query('SELECT COUNT(*) as count FROM watch_history WHERE progress >= (duration * 0.9) AND duration > 0')).rows[0].count;
    
    // Total click attempts
    const totalAttempts = (await db.query('SELECT COUNT(*) as count FROM watch_history')).rows[0].count;
    
    const totalProgressResult = await db.query('SELECT SUM(progress) as "totalProgress" FROM watch_history');
    const totalProgressSeconds = totalProgressResult.rows[0].totalProgress || 0;
    const totalWatchTimeHours = totalProgressSeconds / 3600; // progress is in seconds

    const dailyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date = CURRENT_DATE")).rows[0].count;
    const weeklyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '7 days'")).rows[0].count;
    const monthlyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '30 days'")).rows[0].count;
    const yearlyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '365 days'")).rows[0].count;
    
    const totalVisitsToday = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date = CURRENT_DATE")).rows[0].count;
    const totalVisitsWeekly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days'")).rows[0].count;
    const totalVisitsMonthly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '30 days'")).rows[0].count;
    const totalVisitsAllTime = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits")).rows[0].count;

    // Strictly deduplicated unique human visitors today (1 person = 1 count)
    const uniqueVisitorsToday = (await db.query(`
      SELECT COUNT(DISTINCT COALESCE(uv.user_id::text, pv.visitor_id)) as count 
      FROM platform_visits pv 
      LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id 
      WHERE pv.date = CURRENT_DATE AND pv.visitor_id IS NOT NULL
    `)).rows[0].count;
    const uniqueVisitorsWeekly = (await db.query("SELECT COUNT(DISTINCT COALESCE(uv.user_id::text, pv.visitor_id)) as count FROM platform_visits pv LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id WHERE pv.date >= CURRENT_DATE - INTERVAL '7 days' AND pv.visitor_id IS NOT NULL")).rows[0].count;
    const uniqueVisitorsMonthly = (await db.query("SELECT COUNT(DISTINCT COALESCE(uv.user_id::text, pv.visitor_id)) as count FROM platform_visits pv LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id WHERE pv.date >= CURRENT_DATE - INTERVAL '30 days' AND pv.visitor_id IS NOT NULL")).rows[0].count;

    // Unique Movie Stream Viewers Today & Plays
    const streamStats = (await db.query(`
      SELECT 
        COUNT(DISTINCT COALESCE(uv.user_id::text, pv.visitor_id)) as unique_stream_viewers,
        COUNT(CASE WHEN pv.watched_stream = TRUE THEN 1 END) as stream_plays
      FROM platform_visits pv
      LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id
      WHERE pv.date = CURRENT_DATE AND (pv.watched_stream = TRUE OR uv.stream_count > 0)
    `)).rows[0] || {};

    const allPlatformActiveSeconds = (await db.query(`
      SELECT COALESCE(SUM(active_seconds), 0) as total_active_seconds
      FROM platform_visits
      WHERE date = CURRENT_DATE
    `)).rows[0]?.total_active_seconds || 0;

    const totalActiveHoursToday = parseFloat((parseInt(allPlatformActiveSeconds, 10) / 3600).toFixed(1));
    const avgActiveMinutesToday = parseInt(uniqueVisitorsToday, 10) > 0 
      ? parseFloat(((parseInt(allPlatformActiveSeconds, 10) / 60) / parseInt(uniqueVisitorsToday, 10)).toFixed(1)) 
      : 0;

    res.json({
      totalUsers: parseInt(totalUsers),
      totalFavorites: parseInt(totalFavorites),
      totalWatches: parseInt(totalWatches),
      totalAttempts: parseInt(totalAttempts),
      totalWatchTimeHours: parseFloat(totalWatchTimeHours.toFixed(1)),
      dailyActive: parseInt(dailyActive),
      weeklyActive: parseInt(weeklyActive),
      monthlyActive: parseInt(monthlyActive),
      yearlyActive: parseInt(yearlyActive),
      totalVisitsToday: parseInt(totalVisitsToday),
      totalVisitsWeekly: parseInt(totalVisitsWeekly),
      totalVisitsMonthly: parseInt(totalVisitsMonthly),
      totalVisitsAllTime: parseInt(totalVisitsAllTime),
      uniqueVisitorsToday: parseInt(uniqueVisitorsToday),
      uniqueVisitorsWeekly: parseInt(uniqueVisitorsWeekly),
      uniqueVisitorsMonthly: parseInt(uniqueVisitorsMonthly),
      streamViewersToday: parseInt(streamStats.unique_stream_viewers || 0),
      streamPlaysToday: parseInt(streamStats.stream_plays || 0),
      totalActiveHoursToday,
      avgActiveMinutesToday
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch platform statistics.' });
  }
});

// Fetch all users with optional instant search and engagement metrics
router.get('/users', isModerator, async (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase();
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.is_super_admin, u.admin_permissions, u.avatar, u.created_at,
             COALESCE(v.total_visits, 1) as total_visits,
             COALESCE(v.total_active_seconds, 30) as total_active_seconds,
             COALESCE(v.stream_count, 0) as stream_count,
             (SELECT COUNT(DISTINCT pv.session_id) FROM platform_visits pv WHERE pv.visitor_id = v.visitor_id AND pv.date = CURRENT_DATE) as today_visits,
             v.last_seen
      FROM users u
      LEFT JOIN LATERAL (
        SELECT * FROM unique_visitors WHERE user_id = u.id ORDER BY last_seen DESC LIMIT 1
      ) v ON true
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR u.id::text = $1`;
    }
    query += ` ORDER BY u.created_at DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// Fetch Search Logs
router.get('/search-logs', isModerator, async (req, res) => {
  try {
    const recentSearches = await db.query('SELECT * FROM search_logs ORDER BY created_at DESC LIMIT 50');
    const topKeywords = await db.query('SELECT query, COUNT(*) as count FROM search_logs GROUP BY query ORDER BY count DESC LIMIT 10');
    res.json({ recent: recentSearches.rows, topKeywords: topKeywords.rows, noResults: [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch search logs.' });
  }
});

// Fetch All Settings
router.get('/settings', isModerator, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings');
    const settingsMap = {};
    result.rows.forEach(s => {
      try { settingsMap[s.key] = JSON.parse(s.value); } catch { settingsMap[s.key] = s.value; }
    });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch settings.' });
  }
});

// GET Announcement
router.get('/announcement', isModerator, async (req, res) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['announcement']);
    if (result.rows[0]) res.json(JSON.parse(result.rows[0].value));
    else res.json(null);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get announcement.' });
  }
});

const { getCountryFlag, getCountryName } = require('../utils/geo');

// GET Visitors with search, filter, sort, and server-side pagination (No 5000 limit)
router.get('/visitors', isModerator, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 25), 200);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().toLowerCase();
    const filter = ['all', 'today', 'registered', 'guest', 'streaming'].includes(req.query.filter) ? req.query.filter : 'all';
    const sortBy = req.query.sortBy || 'recent';

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      conditions.push(`(
        LOWER(uv.visitor_id) LIKE $${pIdx} OR 
        LOWER(COALESCE(uv.last_ip, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(uv.country_code, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(uv.country_name, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(u.name, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(u.email, '')) LIKE $${pIdx}
      )`);
    }

    if (filter === 'today') {
      conditions.push(`uv.last_seen >= CURRENT_DATE`);
    } else if (filter === 'registered') {
      conditions.push(`uv.is_registered = TRUE`);
    } else if (filter === 'guest') {
      conditions.push(`(uv.is_registered IS FALSE OR uv.is_registered IS NULL)`);
    } else if (filter === 'streaming') {
      conditions.push(`uv.stream_count > 0`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY uv.last_seen DESC';
    if (sortBy === 'visits') {
      orderClause = 'ORDER BY uv.total_visits DESC, uv.last_seen DESC';
    } else if (sortBy === 'active') {
      orderClause = 'ORDER BY uv.total_active_seconds DESC, uv.last_seen DESC';
    } else if (sortBy === 'streams') {
      orderClause = 'ORDER BY uv.stream_count DESC, uv.last_seen DESC';
    } else if (sortBy === 'first_seen') {
      orderClause = 'ORDER BY uv.first_seen DESC';
    }

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM unique_visitors uv
      LEFT JOIN users u ON uv.user_id = u.id
      ${whereClause}
    `, params);
    const totalCount = parseInt(countResult.rows[0].total, 10) || 0;

    const queryParams = [...params, limit, offset];
    const dataResult = await db.query(`
      SELECT 
        uv.*,
        u.name as user_name,
        u.email as user_email,
        COALESCE(uv.total_visits, 1) as total_visits,
        COALESCE(uv.total_active_seconds, 30) as total_active_seconds,
        COALESCE(uv.stream_count, 0) as stream_count,
        COALESCE(uv.total_watch_seconds, 0) as total_watch_seconds,
        (
          SELECT COUNT(DISTINCT pv.session_id) 
          FROM platform_visits pv 
          WHERE pv.visitor_id = uv.visitor_id AND pv.date = CURRENT_DATE
        ) as today_visits,
        (
          SELECT COALESCE(SUM(pv.active_seconds), 0) 
          FROM platform_visits pv 
          WHERE pv.visitor_id = uv.visitor_id AND pv.date = CURRENT_DATE
        ) as today_active_seconds
      FROM unique_visitors uv
      LEFT JOIN users u ON uv.user_id = u.id
      ${whereClause}
      ${orderClause}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    // Segment summary counts for quick UI filter badges
    const countsResult = await db.query(`
      SELECT 
        COUNT(*) as total_all,
        COUNT(CASE WHEN last_seen >= CURRENT_DATE THEN 1 END) as active_today,
        COUNT(CASE WHEN is_registered = TRUE THEN 1 END) as registered_count,
        COUNT(CASE WHEN is_registered IS FALSE OR is_registered IS NULL THEN 1 END) as guest_count,
        COUNT(CASE WHEN stream_count > 0 THEN 1 END) as stream_viewers_count
      FROM unique_visitors
    `);
    const counts = countsResult.rows[0] || {};

    const enriched = dataResult.rows.map(row => ({
      ...row,
      flag: getCountryFlag(row.country_code),
      country_name: (row.country_name && row.country_name !== 'Unknown') ? row.country_name : getCountryName(row.country_code)
    }));

    res.json({
      visitors: enriched,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      limit,
      counts: {
        all: parseInt(counts.total_all, 10) || 0,
        activeToday: parseInt(counts.active_today, 10) || 0,
        registered: parseInt(counts.registered_count, 10) || 0,
        guests: parseInt(counts.guest_count, 10) || 0,
        streamViewers: parseInt(counts.stream_viewers_count, 10) || 0
      }
    });
  } catch (error) {
    console.error('Failed to fetch visitors:', error);
    res.status(500).json({ message: 'Failed to fetch visitors.' });
  }
});

// GET Audience Countries Analytics
router.get('/analytics/countries', isModerator, async (req, res) => {
  try {
    const rawPeriod = req.query.period || 'all_time';
    const period = ['today', 'weekly', 'monthly', 'all_time'].includes(rawPeriod) ? rawPeriod : 'all_time';
    let queryText = '';

    if (period === 'today') {
      queryText = `
        SELECT 
          COALESCE(NULLIF(pv.country_code, 'XX'), NULLIF(uv.country_code, 'XX'), 'XX') as country_code,
          COALESCE(NULLIF(pv.country_name, 'Unknown'), NULLIF(uv.country_name, 'Unknown'), 'Unknown') as country_name,
          COUNT(DISTINCT COALESCE(pv.visitor_id, pv.session_id)) as unique_visitors,
          COUNT(DISTINCT pv.session_id) as total_visits
        FROM platform_visits pv
        LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id
        WHERE pv.date = CURRENT_DATE
          AND COALESCE(uv.last_ip, '') NOT LIKE '57.141.%'
        GROUP BY 1, 2
        ORDER BY unique_visitors DESC, total_visits DESC
      `;
    } else if (period === 'weekly') {
      queryText = `
        SELECT 
          COALESCE(NULLIF(pv.country_code, 'XX'), NULLIF(uv.country_code, 'XX'), 'XX') as country_code,
          COALESCE(NULLIF(pv.country_name, 'Unknown'), NULLIF(uv.country_name, 'Unknown'), 'Unknown') as country_name,
          COUNT(DISTINCT COALESCE(pv.visitor_id, pv.session_id)) as unique_visitors,
          COUNT(DISTINCT pv.session_id) as total_visits
        FROM platform_visits pv
        LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id
        WHERE pv.date >= CURRENT_DATE - INTERVAL '7 days'
          AND COALESCE(uv.last_ip, '') NOT LIKE '57.141.%'
        GROUP BY 1, 2
        ORDER BY unique_visitors DESC, total_visits DESC
      `;
    } else if (period === 'monthly') {
      queryText = `
        SELECT 
          COALESCE(NULLIF(pv.country_code, 'XX'), NULLIF(uv.country_code, 'XX'), 'XX') as country_code,
          COALESCE(NULLIF(pv.country_name, 'Unknown'), NULLIF(uv.country_name, 'Unknown'), 'Unknown') as country_name,
          COUNT(DISTINCT COALESCE(pv.visitor_id, pv.session_id)) as unique_visitors,
          COUNT(DISTINCT pv.session_id) as total_visits
        FROM platform_visits pv
        LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id
        WHERE pv.date >= CURRENT_DATE - INTERVAL '30 days'
          AND COALESCE(uv.last_ip, '') NOT LIKE '57.141.%'
        GROUP BY 1, 2
        ORDER BY unique_visitors DESC, total_visits DESC
      `;
    } else {
      // all_time - aggregate from unique_visitors excluding automated crawler bots
      queryText = `
        SELECT 
          COALESCE(NULLIF(country_code, ''), 'XX') as country_code,
          COALESCE(NULLIF(country_name, ''), 'Unknown') as country_name,
          COUNT(*) as unique_visitors,
          COUNT(*) as total_visits
        FROM unique_visitors
        WHERE COALESCE(last_ip, '') NOT LIKE '57.141.%'
        GROUP BY 1, 2
        ORDER BY unique_visitors DESC
      `;
    }

    const result = await db.query(queryText);
    const rawRows = result.rows;

    let totalVisitors = 0;
    let totalVisits = 0;
    let knownVisitors = 0;

    rawRows.forEach(r => { 
      const v = parseInt(r.unique_visitors || r.count || 0, 10);
      const s = parseInt(r.total_visits || r.unique_visitors || r.count || 0, 10);
      totalVisitors += v;
      totalVisits += s;
      if (r.country_code && r.country_code !== 'XX') {
        knownVisitors += v;
      }
    });

    const divisor = knownVisitors > 0 ? knownVisitors : (totalVisitors > 0 ? totalVisitors : 1);

    const countries = rawRows.map((row, index) => {
      const code = (row.country_code || 'XX').toUpperCase();
      const visitorCount = parseInt(row.unique_visitors || row.count || 0, 10);
      const visitCount = parseInt(row.total_visits || row.unique_visitors || row.count || 0, 10);
      const percentage = code === 'XX'
        ? (totalVisitors > 0 ? parseFloat(((visitorCount / totalVisitors) * 100).toFixed(1)) : 0)
        : parseFloat(((visitorCount / divisor) * 100).toFixed(1));
      const countryName = (row.country_name && row.country_name !== 'Unknown') 
        ? row.country_name 
        : getCountryName(code);

      return {
        rank: index + 1,
        countryCode: code,
        countryName,
        flag: getCountryFlag(code),
        count: visitorCount,
        uniqueVisitors: visitorCount,
        totalVisits: visitCount,
        percentage
      };
    });

    const knownCountries = countries.filter(c => c.countryCode !== 'XX');
    const topCountry = knownCountries.length > 0 ? knownCountries[0] : (countries[0] || null);
    const knownTraffic = knownCountries.reduce((acc, c) => acc + c.count, 0);
    const globalTrafficPercent = totalVisitors > 0 ? parseFloat(((knownTraffic / totalVisitors) * 100).toFixed(1)) : 0;

    res.json({
      period,
      totalTracked: totalVisitors,
      totalVisitors,
      totalVisits,
      knownVisitors,
      totalCountries: knownCountries.length,
      topCountry,
      globalTrafficPercent,
      countries
    });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch country analytics:', error);
    res.status(500).json({ message: 'Failed to fetch country statistics.' });
  }
});

router.get('/analytics/most-watched', isModerator, async (req, res) => {
  const result = await db.query('SELECT title, movie_type, COUNT(*) as watches FROM watch_history GROUP BY title, movie_type ORDER BY watches DESC LIMIT 10');
  res.json(result.rows);
});

// GET Retention & Returning Users Analytics
router.get('/analytics/retention', isModerator, async (req, res) => {
  try {
    const rawPeriod = req.query.period || 'all_time';
    const period = ['today', 'weekly', 'monthly', 'all_time'].includes(rawPeriod) ? rawPeriod : 'all_time';
    const search = (req.query.search || '').trim().toLowerCase();
    const filter = ['all', 'registered', 'guest'].includes(req.query.filter) ? req.query.filter : 'all';
    const sort = req.query.sort || 'sessions_desc';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let dateFilter = '';
    let returningCondition = '';

    if (period === 'today') {
      dateFilter = 'WHERE pv.date = CURRENT_DATE';
      returningCondition = '(ats.all_time_sessions > 1 OR ats.all_time_days > 1 OR uv.first_seen < CURRENT_DATE)';
    } else if (period === 'weekly') {
      dateFilter = "WHERE pv.date >= CURRENT_DATE - INTERVAL '7 days'";
      returningCondition = "(ats.all_time_sessions > 1 OR ats.all_time_days > 1 OR uv.first_seen < CURRENT_DATE - INTERVAL '7 days')";
    } else if (period === 'monthly') {
      dateFilter = "WHERE pv.date >= CURRENT_DATE - INTERVAL '30 days'";
      returningCondition = "(ats.all_time_sessions > 1 OR ats.all_time_days > 1 OR uv.first_seen < CURRENT_DATE - INTERVAL '30 days')";
    } else {
      returningCondition = '(ats.all_time_sessions > 1 OR ats.all_time_days > 1)';
    }

    // 1. Retention KPI Summary Query
    const summaryQuery = `
      WITH period_visitors AS (
        SELECT 
          pv.visitor_id,
          COUNT(DISTINCT pv.session_id) as period_sessions,
          COUNT(DISTINCT pv.date) as period_days
        FROM platform_visits pv
        ${dateFilter}
        ${dateFilter ? 'AND pv.visitor_id IS NOT NULL' : 'WHERE pv.visitor_id IS NOT NULL'}
        GROUP BY pv.visitor_id
      ),
      all_time_stats AS (
        SELECT 
          pv.visitor_id,
          COUNT(DISTINCT pv.session_id) as all_time_sessions,
          COUNT(DISTINCT pv.date) as all_time_days
        FROM platform_visits pv
        WHERE pv.visitor_id IS NOT NULL
        GROUP BY pv.visitor_id
      )
      SELECT 
        COUNT(pv.visitor_id) as total_visitors,
        COUNT(CASE WHEN ${returningCondition} THEN 1 END) as returning_visitors,
        COUNT(CASE WHEN NOT (${returningCondition}) THEN 1 END) as new_visitors,
        COUNT(CASE WHEN (${returningCondition}) AND uv.is_registered = TRUE THEN 1 END) as registered_returning,
        COUNT(CASE WHEN (${returningCondition}) AND (uv.is_registered IS FALSE OR uv.is_registered IS NULL) THEN 1 END) as guest_returning,
        ROUND(COALESCE(AVG(CASE WHEN ${returningCondition} THEN ats.all_time_sessions END), 0)::numeric, 1) as avg_returning_sessions,
        COUNT(CASE WHEN ats.all_time_sessions = 1 AND ats.all_time_days = 1 THEN 1 END) as single_visit,
        COUNT(CASE WHEN ats.all_time_sessions BETWEEN 2 AND 3 THEN 1 END) as cohort_2_3,
        COUNT(CASE WHEN ats.all_time_sessions BETWEEN 4 AND 9 THEN 1 END) as cohort_4_9,
        COUNT(CASE WHEN ats.all_time_sessions >= 10 THEN 1 END) as cohort_10_plus
      FROM period_visitors pv
      LEFT JOIN all_time_stats ats ON pv.visitor_id = ats.visitor_id
      LEFT JOIN unique_visitors uv ON pv.visitor_id = uv.visitor_id;
    `;

    // 2. Churn Risk: active > 30 days ago, not seen in last 30 days
    const churnQuery = `
      SELECT COUNT(*) as churn_count
      FROM unique_visitors
      WHERE first_seen <= CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND last_seen < CURRENT_TIMESTAMP - INTERVAL '30 days';
    `;

    // 3. User Longevity Breakdown (Difference between first_seen and last_seen for returning visitors)
    const longevityQuery = `
      SELECT 
        COUNT(CASE WHEN EXTRACT(EPOCH FROM (last_seen - first_seen)) < 86400 THEN 1 END) as same_day,
        COUNT(CASE WHEN EXTRACT(EPOCH FROM (last_seen - first_seen)) >= 86400 AND EXTRACT(EPOCH FROM (last_seen - first_seen)) < 7 * 86400 THEN 1 END) as one_to_seven_days,
        COUNT(CASE WHEN EXTRACT(EPOCH FROM (last_seen - first_seen)) >= 7 * 86400 AND EXTRACT(EPOCH FROM (last_seen - first_seen)) < 30 * 86400 THEN 1 END) as eight_to_thirty_days,
        COUNT(CASE WHEN EXTRACT(EPOCH FROM (last_seen - first_seen)) >= 30 * 86400 THEN 1 END) as over_thirty_days
      FROM unique_visitors
      WHERE last_seen > first_seen;
    `;

    // 4. Hourly Peak Traffic Activity (24 Hours distribution based on last_seen)
    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM last_seen)::integer as hour,
        COUNT(*) as count
      FROM unique_visitors
      WHERE last_seen IS NOT NULL
      GROUP BY hour
      ORDER BY hour ASC;
    `;

    // 5. Returning Users List (Filtered, Sorted & Paginated)
    let sortClause = 'ORDER BY ats.all_time_sessions DESC, ats.all_time_days DESC';
    if (sort === 'days_desc') sortClause = 'ORDER BY ats.all_time_days DESC, ats.all_time_sessions DESC';
    if (sort === 'last_seen_desc') sortClause = 'ORDER BY uv.last_seen DESC NULLS LAST';
    if (sort === 'first_seen_desc') sortClause = 'ORDER BY uv.first_seen DESC NULLS LAST';

    const listQuery = `
      WITH all_time_stats AS (
        SELECT 
          pv.visitor_id,
          COUNT(DISTINCT pv.session_id) as all_time_sessions,
          COUNT(DISTINCT pv.date) as all_time_days,
          MIN(pv.date) as first_visit,
          MAX(pv.date) as last_visit
        FROM platform_visits pv
        WHERE pv.visitor_id IS NOT NULL
        GROUP BY pv.visitor_id
        HAVING COUNT(DISTINCT pv.session_id) > 1 OR COUNT(DISTINCT pv.date) > 1
      )
      SELECT 
        ats.visitor_id,
        ats.all_time_sessions,
        ats.all_time_days,
        ats.first_visit,
        ats.last_visit,
        uv.last_seen,
        uv.first_seen,
        uv.last_ip,
        COALESCE(NULLIF(uv.country_code, ''), 'XX') as country_code,
        COALESCE(NULLIF(uv.country_name, ''), 'Unknown') as country_name,
        COALESCE(uv.is_registered, FALSE) as is_registered,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.avatar as user_avatar,
        u.role as user_role,
        (SELECT COUNT(*) FROM watch_history wh WHERE wh.user_id = u.id) as watch_count
      FROM all_time_stats ats
      LEFT JOIN unique_visitors uv ON ats.visitor_id = uv.visitor_id
      LEFT JOIN users u ON uv.user_id = u.id
      WHERE 1=1
        ${filter === 'registered' ? 'AND uv.is_registered = TRUE' : ''}
        ${filter === 'guest' ? 'AND (uv.is_registered IS FALSE OR uv.is_registered IS NULL)' : ''}
        ${search ? `AND (
          LOWER(ats.visitor_id) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(u.name, '')) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(u.email, '')) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(uv.country_name, '')) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(uv.country_code, '')) LIKE '%' || $1 || '%'
        )` : ''}
      ${sortClause}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const countListQuery = `
      WITH all_time_stats AS (
        SELECT 
          pv.visitor_id,
          COUNT(DISTINCT pv.session_id) as all_time_sessions,
          COUNT(DISTINCT pv.date) as all_time_days
        FROM platform_visits pv
        WHERE pv.visitor_id IS NOT NULL
        GROUP BY pv.visitor_id
        HAVING COUNT(DISTINCT pv.session_id) > 1 OR COUNT(DISTINCT pv.date) > 1
      )
      SELECT COUNT(*) as total_matching
      FROM all_time_stats ats
      LEFT JOIN unique_visitors uv ON ats.visitor_id = uv.visitor_id
      LEFT JOIN users u ON uv.user_id = u.id
      WHERE 1=1
        ${filter === 'registered' ? 'AND uv.is_registered = TRUE' : ''}
        ${filter === 'guest' ? 'AND (uv.is_registered IS FALSE OR uv.is_registered IS NULL)' : ''}
        ${search ? `AND (
          LOWER(ats.visitor_id) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(u.name, '')) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(u.email, '')) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(uv.country_name, '')) LIKE '%' || $1 || '%' OR
          LOWER(COALESCE(uv.country_code, '')) LIKE '%' || $1 || '%'
        )` : ''};
    `;

    const queryParams = search ? [search] : [];

    const [summaryRes, churnRes, longevityRes, hourlyRes, listRes, countRes] = await Promise.all([
      db.query(summaryQuery),
      db.query(churnQuery),
      db.query(longevityQuery),
      db.query(hourlyQuery),
      db.query(listQuery, queryParams),
      db.query(countListQuery, queryParams)
    ]);

    const summary = summaryRes.rows[0] || {};
    const totalVisitors = parseInt(summary.total_visitors || 0, 10);
    const returningVisitors = parseInt(summary.returning_visitors || 0, 10);
    const newVisitors = parseInt(summary.new_visitors || 0, 10);
    const retentionRate = totalVisitors > 0 ? parseFloat(((returningVisitors / totalVisitors) * 100).toFixed(1)) : 0;
    const registeredReturning = parseInt(summary.registered_returning || 0, 10);
    const guestReturning = parseInt(summary.guest_returning || 0, 10);
    const avgReturningSessions = parseFloat(summary.avg_returning_sessions || 0);

    const churnRisk = parseInt(churnRes.rows[0]?.churn_count || 0, 10);

    const longevityRaw = longevityRes.rows[0] || {};
    const longevity = {
      sameDay: parseInt(longevityRaw.same_day || 0, 10),
      oneToSevenDays: parseInt(longevityRaw.one_to_seven_days || 0, 10),
      eightToThirtyDays: parseInt(longevityRaw.eight_to_thirty_days || 0, 10),
      overThirtyDays: parseInt(longevityRaw.over_thirty_days || 0, 10)
    };

    // Build 24h map
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
    hourlyRes.rows.forEach(r => {
      if (r.hour !== null && r.hour !== undefined) {
        hourlyMap[parseInt(r.hour, 10)] = parseInt(r.count, 10);
      }
    });
    const hourlyActivity = Object.entries(hourlyMap).map(([hour, count]) => ({
      hour: parseInt(hour, 10),
      label: `${String(hour).padStart(2, '0')}:00`,
      count
    }));

    // Enrich returning users list
    const returningUsers = listRes.rows.map(row => {
      const sessions = parseInt(row.all_time_sessions || 0, 10);
      const code = (row.country_code || 'XX').toUpperCase();
      let loyaltyTier = 'Returning';
      if (sessions >= 10) loyaltyTier = 'VIP';
      else if (sessions >= 4) loyaltyTier = 'Frequent';

      return {
        visitorId: row.visitor_id,
        userId: row.user_id,
        userName: row.user_name || null,
        userEmail: row.user_email || null,
        userAvatar: row.user_avatar || null,
        userRole: row.user_role || 'user',
        isRegistered: !!row.is_registered,
        countryCode: code,
        countryName: (row.country_name && row.country_name !== 'Unknown') ? row.country_name : getCountryName(code),
        flag: getCountryFlag(code),
        totalSessions: sessions,
        activeDays: parseInt(row.all_time_days || 0, 10),
        firstVisit: row.first_visit,
        lastVisit: row.last_visit,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        watchCount: parseInt(row.watch_count || 0, 10),
        loyaltyTier
      };
    });

    const totalMatching = parseInt(countRes.rows[0]?.total_matching || 0, 10);

    res.json({
      period,
      totalVisitors,
      returningVisitors,
      newVisitors,
      retentionRate,
      registeredReturning,
      guestReturning,
      avgReturningSessions,
      cohorts: {
        single: parseInt(summary.single_visit || 0, 10),
        cohort_2_3: parseInt(summary.cohort_2_3 || 0, 10),
        cohort_4_9: parseInt(summary.cohort_4_9 || 0, 10),
        cohort_10_plus: parseInt(summary.cohort_10_plus || 0, 10)
      },
      longevity,
      churnRisk,
      hourlyActivity,
      returningUsers,
      totalMatching,
      limit,
      offset
    });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch retention analytics:', error);
    res.status(500).json({ message: 'Failed to fetch retention analytics.' });
  }
});

// GET Platform Insights (Devices, Funnel, Top Re-watched, Content Gaps)
router.get('/analytics/platform-insights', isModerator, async (req, res) => {
  try {
    // 1. Device breakdown from ad_impressions
    const deviceRes = await db.query(`
      SELECT 
        COALESCE(NULLIF(device_type, ''), 'desktop') as device,
        COUNT(*) as count
      FROM ad_impressions
      GROUP BY 1
      ORDER BY count DESC
    `);
    let totalImpressions = 0;
    deviceRes.rows.forEach(r => totalImpressions += parseInt(r.count, 10));
    const deviceBreakdown = deviceRes.rows.map(r => {
      const count = parseInt(r.count, 10);
      return {
        device: r.device,
        count,
        percentage: totalImpressions > 0 ? parseFloat(((count / totalImpressions) * 100).toFixed(1)) : 0
      };
    });

    // 2. Streaming Funnel
    const visitsTotalRes = await db.query('SELECT COUNT(DISTINCT session_id) as count FROM platform_visits');
    const attemptsRes = await db.query('SELECT COUNT(*) as count FROM watch_history');
    const completedRes = await db.query('SELECT COUNT(*) as count FROM watch_history WHERE progress >= (duration * 0.9) AND duration > 0');
    
    const totalVisits = parseInt(visitsTotalRes.rows[0]?.count || 0, 10);
    const totalAttempts = parseInt(attemptsRes.rows[0]?.count || 0, 10);
    const completedWatches = parseInt(completedRes.rows[0]?.count || 0, 10);
    
    const clickThroughRate = totalVisits > 0 ? parseFloat(((totalAttempts / totalVisits) * 100).toFixed(1)) : 0;
    const completionRate = totalAttempts > 0 ? parseFloat(((completedWatches / totalAttempts) * 100).toFixed(1)) : 0;

    // 3. Top Re-watched / High Loyalty Titles (watched by multiple viewers or repeatedly)
    const rewatchedRes = await db.query(`
      SELECT 
        title, 
        movie_type, 
        COUNT(*) as total_watches,
        COUNT(DISTINCT user_id) as unique_viewers
      FROM watch_history
      GROUP BY title, movie_type
      ORDER BY total_watches DESC
      LIMIT 8
    `);

    // 4. Content Gaps: Top searches with 0 results or failed searches
    const contentGapsRes = await db.query(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE success = FALSE OR has_results = FALSE
      GROUP BY query
      ORDER BY count DESC
      LIMIT 8
    `);

    res.json({
      deviceBreakdown,
      streamingFunnel: {
        totalVisits,
        totalAttempts,
        completedWatches,
        clickThroughRate,
        completionRate
      },
      topReWatched: rewatchedRes.rows,
      contentGaps: contentGapsRes.rows
    });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch platform insights:', error);
    res.status(500).json({ message: 'Failed to fetch platform insights.' });
  }
});
router.get('/security/login-logs', isModerator, async (req, res) => {
  const result = await db.query('SELECT l.*, u.name, u.email FROM login_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 50');
  res.json(result.rows);
});
router.get('/security/blocked-ips', isModerator, async (req, res) => {
  const result = await db.query('SELECT * FROM blocked_ips ORDER BY blocked_at DESC');
  res.json(result.rows);
});


// --- WRITE ROUTES (Admin Only) ---

// Update Announcement
router.post('/announcement', isAdmin, async (req, res) => {
  try {
    const valueStr = JSON.stringify(req.body);
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', ['announcement', valueStr]);
    res.json({ message: 'Announcement updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update announcement.' });
  }
});

// Update Setting
router.post('/settings', isAdmin, async (req, res) => {
  const { key, value } = req.body;
  try {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', [key, valueStr]);
    res.json({ message: `Setting ${key} updated successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update setting.' });
  }
});

// Update User Role
router.put('/users/:id/role', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'moderator', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'You cannot change your own role.' });

  const target = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [id]);
  if (target.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super Admins cannot be modified.' });

  await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
  res.json({ message: `User role updated to ${role}` });
});

// Delete User Permanently
router.delete('/users/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'You cannot delete yourself.' });
  
  try {
    const target = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [id]);
    if (target.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super Admins cannot be deleted.' });

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted permanently.' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// Update Admin Permissions
router.put('/users/:id/permissions', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  const currentUser = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
  if (!currentUser.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Only Super Admin can manage permissions.' });
  await db.query('UPDATE users SET admin_permissions = $1 WHERE id = $2', [JSON.stringify(permissions), id]);
  res.json({ message: 'Permissions updated.' });
});

// Ban/Unban User
router.put('/users/:id/ban', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_banned } = req.body;
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'You cannot ban yourself.' });
  const target = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [id]);
  if (target.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super Admins cannot be banned.' });
  await db.query('UPDATE users SET is_banned = $1 WHERE id = $2', [is_banned, id]);
  res.json({ message: `User ${is_banned ? 'banned' : 'unbanned'}` });
});

// Block/Unblock IP
router.post('/security/block-ip', isAdmin, async (req, res) => {
  const { ip_address, reason } = req.body;
  await db.query('INSERT INTO blocked_ips (ip_address, reason) VALUES ($1, $2) ON CONFLICT (ip_address) DO UPDATE SET reason = EXCLUDED.reason', [ip_address, reason || 'Banned by admin']);
  res.json({ message: `IP ${ip_address} blocked` });
});
router.delete('/security/block-ip/:ip', isAdmin, async (req, res) => {
  await db.query('DELETE FROM blocked_ips WHERE ip_address = $1', [req.params.ip]);
  res.json({ message: 'IP unblocked' });
});

// --- ADS & MONETIZATION MANAGEMENT ---

// Get Ad Impressions & Performance Stats
router.get('/ads/stats', isModerator, async (req, res) => {
  try {
    const todayResult = await db.query("SELECT COUNT(*) as count FROM ad_impressions WHERE created_at >= CURRENT_DATE");
    const totalResult = await db.query("SELECT COUNT(*) as count FROM ad_impressions");
    const uniqueViewersToday = await db.query("SELECT COUNT(DISTINCT COALESCE(visitor_id, session_id)) as count FROM ad_impressions WHERE created_at >= CURRENT_DATE");
    const uniqueViewersTotal = await db.query("SELECT COUNT(DISTINCT COALESCE(visitor_id, session_id)) as count FROM ad_impressions");

    const slotBreakdown = await db.query(`
      SELECT 
        slot, 
        COUNT(*) as impressions,
        COUNT(DISTINCT COALESCE(visitor_id, session_id)) as unique_visitors
      FROM ad_impressions 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY slot
      ORDER BY impressions DESC
    `);

    const dailyTrend = await db.query(`
      SELECT 
        TO_CHAR(d.day, 'YYYY-MM-DD') as date_str, 
        COUNT(a.id)::int as count 
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
      LEFT JOIN ad_impressions a 
        ON DATE(a.created_at) = DATE(d.day)
      GROUP BY d.day 
      ORDER BY d.day ASC
    `);

    // Get current ads_config
    const configRow = await db.query("SELECT value FROM settings WHERE key = 'ads_config'");
    let config = null;
    if (configRow.rows[0]?.value) {
      try { config = JSON.parse(configRow.rows[0].value); } catch (_) { config = configRow.rows[0].value; }
    }

    res.json({
      todayImpressions: parseInt(todayResult.rows[0].count) || 0,
      totalImpressions: parseInt(totalResult.rows[0].count) || 0,
      uniqueViewersToday: parseInt(uniqueViewersToday.rows[0].count) || 0,
      uniqueViewersTotal: parseInt(uniqueViewersTotal.rows[0].count) || 0,
      slotBreakdown: slotBreakdown.rows.map(r => ({
        slot: r.slot,
        impressions: parseInt(r.impressions) || 0,
        unique_visitors: parseInt(r.unique_visitors) || 0
      })),
      dailyTrend: dailyTrend.rows.map(r => ({
        date: r.date_str,
        count: parseInt(r.count) || 0
      })),
      config
    });
  } catch (error) {
    console.error('Failed to fetch ad statistics:', error);
    res.status(500).json({ message: 'Failed to fetch ad statistics.' });
  }
});

// Update Ad Configurations
router.post('/ads/config', isAdmin, async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ message: 'Invalid configuration data' });
    }

    await db.query(`
      INSERT INTO settings (key, value)
      VALUES ('ads_config', $1)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
    `, [JSON.stringify(config)]);

    res.json({ success: true, message: 'Ads configuration saved successfully.' });
  } catch (error) {
    console.error('Failed to update ads config:', error);
    res.status(500).json({ message: 'Failed to save ads configuration.' });
  }
});

module.exports = router;
