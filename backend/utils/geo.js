const geoip = require('geoip-country');

// Mapping of common timezones to country codes (for localhost/dev environments where IP is 127.0.0.1)
const TIMEZONE_TO_COUNTRY = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Chicago': 'US',
  'America/Toronto': 'CA',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Australia/Sydney': 'AU',
  'Asia/Dubai': 'AE',
  'Asia/Singapore': 'SG',
  'Asia/Tokyo': 'JP'
};

/**
 * Converts 2-letter country code to Unicode Flag emoji
 * e.g., 'IN' -> '🇮🇳', 'US' -> '🇺🇸'
 */
function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2 || countryCode === 'XX') {
    return '🌐';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '🌐';
  }
}

/**
 * Returns full country name from 2-letter country code
 */
function getCountryName(countryCode) {
  if (!countryCode || countryCode.length !== 2 || countryCode === 'XX') {
    return 'Unknown Location';
  }
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = regionNames.of(countryCode.toUpperCase());
    return name || 'Unknown Location';
  } catch (e) {
    return 'Unknown Location';
  }
}

/**
 * Extracts client IP from request headers safely
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',');
    const firstIp = ips[0].trim();
    if (firstIp) return firstIp;
  }
  return req.headers['x-real-ip'] || 
         req.headers['cf-connecting-ip'] || 
         req.socket?.remoteAddress || 
         req.ip || 
         '127.0.0.1';
}

/**
 * Cleans IP address (removes IPv6 prefix for IPv4-mapped addresses)
 */
function cleanIpAddress(rawIp) {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Determines if IP is a local/private IP
 */
function isPrivateIp(ip) {
  if (!ip) return true;
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip === 'localhost' ||
         ip.startsWith('10.') || 
         ip.startsWith('192.168.') || 
         ip.startsWith('172.16.') ||
         ip.startsWith('172.17.') ||
         ip.startsWith('172.18.') ||
         ip.startsWith('172.19.') ||
         ip.startsWith('172.2') ||
         ip.startsWith('172.3');
}

/**
 * Resolves country code and country name for an incoming HTTP request
 */
function resolveCountry(req, clientTimezone = null) {
  // 1. Check Cloudflare or reverse-proxy header (highest fidelity in production)
  const cfCountry = req.headers['cf-ipcountry'] || req.headers['x-country-code'];
  if (cfCountry && cfCountry.length === 2 && cfCountry !== 'XX' && cfCountry !== 'T1') {
    const code = cfCountry.toUpperCase();
    return {
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // 2. Perform GeoIP lookup on the extracted client IP
  const rawIp = getClientIp(req);
  const cleanIp = cleanIpAddress(rawIp);

  if (!isPrivateIp(cleanIp)) {
    try {
      const geo = geoip.lookup(cleanIp);
      if (geo && geo.country) {
        const code = geo.country.toUpperCase();
        return {
          countryCode: code,
          countryName: geo.name || getCountryName(code),
          flag: getCountryFlag(code)
        };
      }
    } catch (e) {
      console.error('[GEO] Error looking up IP:', e);
    }
  }

  // 3. Fallback for localhost / private IP during development or testing
  if (clientTimezone && TIMEZONE_TO_COUNTRY[clientTimezone]) {
    const code = TIMEZONE_TO_COUNTRY[clientTimezone];
    return {
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // Also check if client header has timezone
  const tzHeader = req.headers['x-timezone'];
  if (tzHeader && TIMEZONE_TO_COUNTRY[tzHeader]) {
    const code = TIMEZONE_TO_COUNTRY[tzHeader];
    return {
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // 4. Default unknown
  return {
    countryCode: 'XX',
    countryName: 'Unknown',
    flag: '🌐'
  };
}

module.exports = {
  resolveCountry,
  getCountryFlag,
  getCountryName,
  getClientIp,
  cleanIpAddress
};
