function getPureTitle(str) {
    if (!str) return '';
    let clean = str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // We only want to strip metadata if it appears AFTER some actual title words.
    // So we loop over the words. The first word that is a metadata word marks the end of the title.
    const words = clean.split(' ');
    const metadataRegex = /^(19\d{2}|20\d{2}|\d{3,4}p|4k|uhd|hd|sd|s\d+|e\d+|season|episode|complete|batch|pack|dual|audio|hindi|english|tamil|telugu|bluray|webrip|web|dl|x264|x265|hevc|aac|mkv|mp4|avi|rip|dvdrip|hdrip|extended|unrated|directors|cut|remastered|part|hdhub4u|vegamovies|katmoviehd|moviesverse)$/i;
    
    let pureWords = [];
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        // If the VERY FIRST word matches metadata (e.g. the movie "1917"), keep it!
        if (i === 0 || !metadataRegex.test(w)) {
            pureWords.push(w);
        } else {
            // As soon as we hit a metadata word (that isn't the first word), we stop.
            break;
        }
    }
    
    return pureWords.join(' ');
}

const tests = [
    "The Boys (Season 1 - 4) Dual Audio HDHub4u",
    "Inception 2010 1080p BluRay",
    "Inception (2010) HDHub4u",
    "Alice in Borderland S01 1080p WEB-DL",
    "The Boys I've Loved Before",
    "Alice in Wonderland",
    "The Boys",
    "Batman Begins",
    "1917 (2019) 1080p",
    "2012 (2009) HD",
    "Se7en 1995"
];

for (const t of tests) {
    console.log(`"${t}" => "${getPureTitle(t)}"`);
}
