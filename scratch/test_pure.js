function getPureTitle(str) {
    if (!str) return '';
    // Clean string: remove special chars EXCEPT hyphens or dots if they are part of words, but for simplicity let's just replace everything non-alphanumeric with space.
    let clean = str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Find the first index of any metadata word.
    // Metadata words: 4k, 1080p, 720p, 480p, 360p, 2160p, s01, season, complete, dual, audio, hindi, english, bluray, web, dl, x264, x265, hevc
    // Also matching a standalone 4-digit year like 1999 or 2024.
    const metadataRegex = /\b(19\d{2}|20\d{2}|\d{3,4}p|4k|uhd|hd|sd|s\d+|e\d+|season|episode|complete|batch|pack|dual|audio|hindi|english|tamil|telugu|bluray|webrip|web|dl|x264|x265|hevc|aac|mkv|mp4|avi|rip|dvdrip|hdrip|extended|unrated|directors|cut|remastered|part|hdhub4u|vegamovies|katmoviehd|moviesverse)\b/i;
    
    const match = clean.match(metadataRegex);
    if (match) {
        clean = clean.substring(0, match.index).trim();
    }
    return clean;
}

const tests = [
    "The Boys (Season 1 - 4) Dual Audio HDHub4u",
    "Inception 2010 1080p BluRay",
    "Inception (2010) HDHub4u",
    "Alice in Borderland S01 1080p WEB-DL",
    "The Boys I've Loved Before",
    "Alice in Wonderland",
    "The Boys",
    "Batman Begins"
];

for (const t of tests) {
    console.log(`"${t}" => "${getPureTitle(t)}"`);
}
