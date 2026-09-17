const geoip = require('geoip-country');

// Comprehensive mapping of IANA timezones to 2-letter country codes (ISO 3166-1 alpha-2)
const TIMEZONE_TO_COUNTRY = {
  // South Asia
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP',
  'Asia/Katmandu': 'NP',
  'Asia/Colombo': 'LK',
  'Asia/Kabul': 'AF',
  'Asia/Thimphu': 'BT',
  'Indian/Maldives': 'MV',

  // Middle East & Gulf
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Muscat': 'OM',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Qatar': 'QA',
  'Asia/Amman': 'JO',
  'Asia/Baghdad': 'IQ',
  'Asia/Beirut': 'LB',
  'Asia/Damascus': 'SY',
  'Asia/Jerusalem': 'IL',
  'Asia/Tehran': 'IR',
  'Asia/Yemen': 'YE',

  // Southeast Asia & East Asia
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Manila': 'PH',
  'Asia/Bangkok': 'TH',
  'Asia/Saigon': 'VN',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Yangon': 'MM',
  'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA',
  'Asia/Brunei': 'BN',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',

  // Africa
  'Africa/Lagos': 'NG',
  'Africa/Cairo': 'EG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Nairobi': 'KE',
  'Africa/Accra': 'GH',
  'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Khartoum': 'SD',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Indian/Mauritius': 'MU',

  // Europe
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO',
  'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR',
  'Europe/Moscow': 'RU',
  'Europe/Kiev': 'UA',
  'Europe/Kyiv': 'UA',
  'Europe/Lisbon': 'PT',

  // North America
  'America/New_York': 'US',
  'America/Detroit': 'US',
  'America/Kentucky/Louisville': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',

  // South America & Oceania
  'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Santiago': 'CL',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Perth': 'AU',
  'Pacific/Auckland': 'NZ'
};

/**
 * Checks if incoming request is from an automated crawler/bot or scraping agent
 */
function isBot(req) {
  if (!req) return false;

  const ua = (req.headers && req.headers['user-agent']) ? req.headers['user-agent'].toLowerCase() : '';
  
  // 1. Common crawler/bot user-agent keywords
  const botPatterns = [
    'facebookexternalhit',
    'facebot',
    'meta-externalagent',
    'meta-externalfetcher',
    'meta-webindexer',
    'googlebot',
    'bingbot',
    'yandexbot',
    'baiduspider',
    'duckduckbot',
    'bytespider',
    'bytedance',
    'slurp',
    'headlesschrome',
    'phantomjs',
    'lighthouse',
    'ptst',
    'pingdom',
    'ahrefsbot',
    'semrushbot',
    'dotbot',
    'rogerbot',
    'exabot',
    'mj12bot',
    'screaming frog',
    'applebot',
    'twitterbot',
    'linkedinbot',
    'whatsapp',
    'telegrambot',
    'discordbot',
    'slackbot',
    'python-requests',
    'node-fetch',
    'axios',
    'curl',
    'wget',
    'postmanruntime',
    'crawler',
    'spider'
  ];

  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      return true;
    }
  }

  // 2. Check if client IP belongs to Meta/Facebook crawler subnets (AS32934 in Ashburn, VA)
  const clientIp = getClientIp(req);
  const cleanIp = cleanIpAddress(clientIp);

  if (isMetaBotIp(cleanIp)) {
    return true;
  }

  return false;
}

/**
 * Checks if IP belongs to Meta/Facebook scraping/crawling subnets
 */
function isMetaBotIp(ip) {
  if (!ip) return false;
  // Meta crawler subnets: 57.141.0.0/16, 69.63.176.0/20, 66.220.144.0/20, 157.240.0.0/16, 31.13.0.0/16
  if (ip.startsWith('57.141.')) return true;
  if (ip.startsWith('69.63.')) return true;
  if (ip.startsWith('66.220.')) return true;
  if (ip.startsWith('157.240.')) return true;
  if (ip.startsWith('31.13.')) return true;
  return false;
}

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
 * Extracts client IP from request headers safely with proxy precedence
 */
function getClientIp(req) {
  if (!req) return '127.0.0.1';

  // 1. Cloudflare edge real IP (authoritative when behind Cloudflare)
  if (req.headers['cf-connecting-ip']) {
    return cleanIpAddress(req.headers['cf-connecting-ip']);
  }

  // 2. Standard reverse proxy header
  if (req.headers['x-real-ip']) {
    return cleanIpAddress(req.headers['x-real-ip']);
  }

  // 3. X-Forwarded-For list (first entry is original client)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',');
    const firstIp = ips[0].trim();
    if (firstIp) return cleanIpAddress(firstIp);
  }

  // 4. Express req.ip (when trust proxy is enabled) or socket address
  const socketIp = req.ip || req.socket?.remoteAddress;
  if (socketIp) {
    return cleanIpAddress(socketIp);
  }

  return '127.0.0.1';
}

/**
 * Cleans IP address (removes IPv6 prefix for IPv4-mapped addresses, removes port)
 */
function cleanIpAddress(rawIp) {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  
  // Remove port if present (e.g. "1.2.3.4:5678" or "[2405:201::1]:5678")
  if (ip.startsWith('[') && ip.includes(']')) {
    const closingIdx = ip.indexOf(']');
    ip = ip.substring(1, closingIdx);
  } else if (!ip.includes(':') && ip.includes(':')) {
    ip = ip.split(':')[0];
  } else if (ip.includes('.') && ip.includes(':') && !ip.startsWith('::')) {
    // IPv4 with port like 1.2.3.4:5678
    ip = ip.split(':')[0];
  }

  // Strip IPv4 mapped to IPv6
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
 * Extracts country code from client locale (e.g., 'en-IN' -> 'IN', 'hi-IN' -> 'IN')
 */
function getCountryFromLocale(locale) {
  if (!locale || typeof locale !== 'string') return null;
  const parts = locale.trim().split(/[-_]/);
  if (parts.length >= 2) {
    const region = parts[parts.length - 1].toUpperCase();
    if (region.length === 2 && region !== 'XX') {
      return region;
    }
  }
  return null;
}

/**
 * Resolves country code and country name for an incoming HTTP request
 */
function resolveCountry(req, clientTimezone = null, clientLocale = null) {
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

  // 3. Fallback to client timezone (IANA format)
  const tz = clientTimezone || req.headers['x-timezone'];
  if (tz && TIMEZONE_TO_COUNTRY[tz]) {
    const code = TIMEZONE_TO_COUNTRY[tz];
    return {
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // 4. Fallback to client locale (e.g., 'en-IN' -> 'IN')
  const locale = clientLocale || req.headers['x-locale'];
  const localeCountry = getCountryFromLocale(locale);
  if (localeCountry) {
    return {
      countryCode: localeCountry,
      countryName: getCountryName(localeCountry),
      flag: getCountryFlag(localeCountry)
    };
  }

  // 5. Fallback to Accept-Language header
  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    const primaryLang = acceptLang.split(',')[0].split(';')[0];
    const acceptCountry = getCountryFromLocale(primaryLang);
    if (acceptCountry) {
      return {
        countryCode: acceptCountry,
        countryName: getCountryName(acceptCountry),
        flag: getCountryFlag(acceptCountry)
      };
    }
  }

  // 6. Default unknown
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
  cleanIpAddress,
  isBot,
  isMetaBotIp,
  TIMEZONE_TO_COUNTRY
};
