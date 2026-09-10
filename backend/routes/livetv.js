const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// IPTV playlist sources (only server-accessible URLs)
const M3U_URLS = [
    'http://127.0.0.1/jiotv/playlist.php',
    'https://raw.githubusercontent.com/FunctionError/PiratesTv/main/combined_playlist.m3u',
    'https://iptv-org.github.io/iptv/index.m3u',
];

let cachedChannels = [];
let cachedCategories = [];
let lastFetchTime = 0;
let isFetching = false;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const parseM3UText = (data, startId = 0) => {
    const lines = data.split('\n');
    const channels = [];
    let currentChannel = {};
    let idCounter = startId;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF') || line.startsWith('# EXTINF')) {
            const logoMatch = line.match(/tvg-logo="(.*?)"/);
            // Matches group-title attributes. Handle multiple group-title or malformed quotes.
            const groupMatch = line.match(/group-title="(.*?)"/);
            
            const commaIndex = line.lastIndexOf(',');
            const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown';

            currentChannel = {
                id: `ch-${idCounter++}`,
                name: name,
                logo: logoMatch ? logoMatch[1] : null,
                category: (groupMatch && groupMatch[1]) ? groupMatch[1].trim() : 'Uncategorized'
            };
        } else if (!line.startsWith('#')) {
            if (currentChannel.name) {
                currentChannel.url = line;
                channels.push(currentChannel);
                currentChannel = {};
            }
        }
    }
    return channels;
};

const fetchAndParseM3UStream = async (url, startId = 0) => {
    console.log(`Starting M3U parsing via fetch for ${url}...`);
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            }
        });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        
        const data = await response.text();
        const channels = parseM3UText(data, startId);
        
        console.log(`Parsed ${channels.length} channels from ${url} in ${Date.now() - startTime}ms`);
        return channels;
    } catch (err) {
        console.error('Fetch error:', err);
        throw err;
    }
};

// Background updater
const updateCacheInBackground = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
        let allChannels = [];

        // 1. Load local custom M3U first so they appear at the top/are fast
        const localPath = path.join(__dirname, '..', 'data', 'custom_channels.m3u');
        if (fs.existsSync(localPath)) {
            try {
                console.log('Loading local custom M3U channels...');
                const localData = fs.readFileSync(localPath, 'utf8');
                const localChannels = parseM3UText(localData, 0);
                allChannels = allChannels.concat(localChannels);
                console.log(`Loaded ${localChannels.length} custom channels from local file.`);
            } catch (localErr) {
                console.error('Failed to read local M3U file:', localErr);
            }
        }

        // 2. Fetch external URLs
        for (const url of M3U_URLS) {
            try {
                const channels = await fetchAndParseM3UStream(url, allChannels.length);
                allChannels = allChannels.concat(channels);
            } catch (err) {
                console.error(`Skipping ${url} due to error:`, err.message);
            }
        }
        
        cachedChannels = allChannels;
        
        // Pre-compute categories to save time during requests
        const catSet = new Set();
        for(let i=0; i<allChannels.length; i++) {
            if (allChannels[i].category) catSet.add(allChannels[i].category);
        }
        cachedCategories = Array.from(catSet).sort();
        lastFetchTime = Date.now();
    } catch (err) {
        console.error('Background fetch failed:', err);
    } finally {
        isFetching = false;
    }
};

// Initial load on server start so it doesn't block the first user
updateCacheInBackground();

router.get('/channels', async (req, res) => {
    try {
        const now = Date.now();
        
        // If cache is empty, we must wait. Otherwise, serve from cache and maybe update in bg.
        if (cachedChannels.length === 0) {
            if (!isFetching) updateCacheInBackground();
            
            // Wait up to 5 seconds for initial load
            let waitTime = 0;
            while(cachedChannels.length === 0 && waitTime < 5000) {
                await new Promise(r => setTimeout(r, 500));
                waitTime += 500;
            }
        } else if ((now - lastFetchTime) > CACHE_TTL) {
            // Cache expired, trigger background update but serve stale data immediately
            updateCacheInBackground();
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 300;
        const search = (req.query.search || '').toLowerCase();
        const category = req.query.category || '';

        let filtered = cachedChannels;

        // Quick filtering
        if (category) {
            filtered = filtered.filter(c => c.category === category);
        }
        if (search) {
            filtered = filtered.filter(c => c.name.toLowerCase().includes(search));
        }

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginated = filtered.slice(startIndex, endIndex);

        res.json({
            total: filtered.length,
            page,
            limit,
            channels: paginated,
            categories: cachedCategories
        });

    } catch (error) {
        console.error('Error serving Live TV:', error);
        res.status(500).json({ message: 'Failed to fetch Live TV channels' });
    }
});

module.exports = router;
