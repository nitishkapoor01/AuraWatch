import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Play, X, ChevronDown, Plus, Check, Star, Download, Loader2, AlertTriangle, Flag } from 'lucide-react';
import styles from './MovieDetail.module.css';
import Row from '../components/Row';
import SEO from '../components/SEO';
import { fetchWithCache } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useButtonWarnings } from '../hooks/useButtonWarnings';
import { useToast } from '../context/ToastContext';
import { usePlayer } from '../context/PlayerContext';
import HelpModal from '../components/profile/HelpModal';

const isTVType = (type) => type === 'tv' || type === 'series';

const extractLanguage = (name) => {
  if (!name) return 'English';
  const n = name.toLowerCase();
  if (n.includes('hindi') || n.includes(' hin ') || n.includes('hin-eng')) return 'Hindi';
  if (n.includes('dual audio') || n.includes('dual-audio')) return 'Dual Audio';
  if (n.includes('tamil')) return 'Tamil';
  if (n.includes('telugu')) return 'Telugu';
  if (n.includes('malayalam')) return 'Malayalam';
  if (n.includes('korean')) return 'Korean';
  if (n.includes('japanese')) return 'Japanese';
  if (n.includes('english') || n.includes(' eng ')) return 'English';
  return 'Multi / Other';
};



const BannerAd = () => {
  const bannerRef = React.useRef(null);

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const conf = document.createElement('script');
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = "//heavenlysuspicious.com/8e9991a7d4aa3fef2ca28a617f3c1844/invoke.js";
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {
        'key' : '8e9991a7d4aa3fef2ca28a617f3c1844',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };`;
      bannerRef.current.append(conf);
      bannerRef.current.append(script);
    }
  }, []);

  return <div ref={bannerRef} style={{ width: '300px', height: '250px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}></div>;
};

const MovieDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'movie';
  const isTV = isTVType(type);
  const navigate = useNavigate();
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showLoginTeaser, setShowLoginTeaser] = useState(false);

  const { playerState, openPlayer, setSticky } = usePlayer();
  const { isOpen, movieData } = playerState;
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Check if THIS movie is currently playing globally
  const isThisMoviePlaying = isOpen && movieData && String(movieData.id) === String(id);

  useEffect(() => {
    const handleScroll = () => {
      if (isThisMoviePlaying) {
        setSticky(window.scrollY > 400);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isThisMoviePlaying, setSticky]);

  // Download Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadStep, setDownloadStep] = useState('ad'); // 'ad', 'options', 'error', 'not_found'
  const [adTimer, setAdTimer] = useState(30);
  const [parsedDownloads, setParsedDownloads] = useState({});
  const [selectedQuality, setSelectedQuality] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('episode'); // 'episode' or 'batch'
  const [downloadErrorMsg, setDownloadErrorMsg] = useState('');
  
  const buttonWarnings = useButtonWarnings();
  const [globalSkipAds, setGlobalSkipAds] = useState(false);

  const handleImageError = (e, isPoster = true) => {
    const currentSrc = e.target.src;
    if (currentSrc.includes('image.tmdb.org')) {
      e.target.src = currentSrc.replace('image.tmdb.org', 'www.themoviedb.org');
    } else {
      e.target.src = isPoster 
        ? 'https://picsum.photos/id/10/300/450' 
        : 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';
    }
  };

  // TV Specific
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => {
    const fetchMovie = async () => {
      setLoading(true);
      try {
        const onRevalidate = (data) => {
          if (data && data.id) setMovie(data);
          else setMovie(null);
          setLoading(false);
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}?type=${type}`, onRevalidate);
        if (data && data.id) setMovie(data);
        else setMovie(null);
      } catch (error) {
        console.error('Error fetching details:', error);
        setMovie(null);
      }
      setLoading(false);
    };

    const fetchGlobalSettings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/settings/skip_ads_timer`);
        if (res.ok) {
          const data = await res.json();
          setGlobalSkipAds(data.value === 'true' || data.value === true);
        }
      } catch (e) {
        console.error('Failed to fetch global settings', e);
      }
    };

    fetchMovie();
    fetchGlobalSettings();
    fetchGlobalSettings();
    setShowTrailer(false);
    setTrailerKey(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(1);
  }, [id, type]);

  // Set current viewing movie for live feed tracking
  useEffect(() => {
    if (movie && movie.title) {
      sessionStorage.setItem('currentViewingMovie', movie.title);
      window.dispatchEvent(new Event('movieLoaded'));
    }
    return () => {
      sessionStorage.removeItem('currentViewingMovie');
    };
  }, [movie]);

  const hasAutoPlayed = React.useRef(false);

  // Auto-play from Continue Watching
  useEffect(() => {
    if (movie && !loading && !hasAutoPlayed.current) {
      const autoPlay = searchParams.get('play') === 'true';
      if (autoPlay) {
        hasAutoPlayed.current = true;
        const s = parseInt(searchParams.get('s')) || 1;
        const e = parseInt(searchParams.get('e')) || 1;
        
        const playerPayload = { 
          id: movie.id, 
          type, 
          title: movie.title, 
          poster: movie.poster, 
          backdrop: movie.backdrop, 
          rating: movie.rating, 
          year: movie.year,
          runtime: movie.runtime
        };

        if (isTVType(type)) {
          openPlayer({ ...playerPayload, season: s, episode: e });
        } else {
          openPlayer(playerPayload);
        }
      }
    }
  }, [movie, loading, searchParams, type, openPlayer]);

  // Check if favorite
  useEffect(() => {
    if (!isLoggedIn || !id) return;
    const checkFavorite = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/favorites/check/${id}?type=${type}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setIsFavorite(data.isFavorite);
        }
      } catch (err) {
        console.error('Failed to check favorite:', err);
      }
    };
    checkFavorite();
  }, [id, type, isLoggedIn, token]);

  // Fetch seasons for TV
  useEffect(() => {
    if (!isTV) return;
    const fetchSeasons = async () => {
      try {
        const onRevalidate = (data) => {
          if (Array.isArray(data)) {
            setSeasons(data);
            setSelectedSeason(prev => prev || data[0]?.number || 1);
          }
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}/seasons`, onRevalidate);
        if (Array.isArray(data)) {
          setSeasons(data);
          setSelectedSeason(data[0]?.number || 1);
        }
      } catch (e) { console.error('Error fetching seasons:', e); }
    };
    fetchSeasons();
  }, [id, isTV]);

  // Ensure user waits 30s even if links are fetched earlier
  useEffect(() => {
    if (downloadStep === 'ad' && adTimer <= 0 && Object.keys(parsedDownloads).length > 0) {
      setDownloadStep('options');
    }
  }, [adTimer, downloadStep, parsedDownloads]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (!isTV) return;
    const fetchEpisodes = async () => {
      try {
        const onRevalidate = (data) => {
          if (Array.isArray(data)) {
            setEpisodes(data);
            // Don't reset selectedEpisode on revalidate if it's already set
          }
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}/season/${selectedSeason}`, onRevalidate);
        if (Array.isArray(data)) {
          setEpisodes(data);
          setSelectedEpisode(1);
        }
      } catch (e) { console.error('Error fetching episodes:', e); }
    };
    fetchEpisodes();
  }, [id, selectedSeason, isTV]);

  const handleWatchTrailer = async () => {
    if (trailerKey) { setShowTrailer(true); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}/videos?type=${type}`);
      const data = await res.json();
      if (data.key) { setTrailerKey(data.key); setShowTrailer(true); }
      else alert('Trailer not available');
    } catch (error) { console.error('Error fetching trailer:', error); }
  };

  const handlePlayEpisode = (season, episode, epName = '') => {
    openPlayer({
      id: movie.id,
      type,
      title: movie.title,
      season,
      episode,
      epName
    });
    trackWatch(season, episode);
  };

  // Helper to resolve URLs that need backend proxy
  const getDownloadUrl = (link) => {
    if (link.proxyRequired) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 
        (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      return `${baseUrl}/downloads/proxy?url=${encodeURIComponent(link.url)}`;
    }
    return link.url;
  };

  const handleDownload = async (forceRefresh = false) => {
    // Prevent React synthetic event objects from being treated as true
    const isForceRefresh = typeof forceRefresh === 'boolean' ? forceRefresh : false;
    
    if (!movie || isDownloading) return;
    setIsDownloading(true);
    setShowDownloadModal(true);
    
    const isAdmin = user?.role === 'admin';
    const shouldSkipTimer = isAdmin || globalSkipAds;
    setDownloadStep('ad');
    setAdTimer(shouldSkipTimer ? 0 : 30);
    setParsedDownloads({});
    setDownloadErrorMsg('');
    
    // Start Ad Timer (only if not bypassed)
    let timerInterval = null;
    if (!shouldSkipTimer) {
      timerInterval = setInterval(() => {
        setAdTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/downloads/movie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: movie.title, 
          year: movie.year,
          type: movie.type,
          season: isTV ? selectedSeason : null,
          episode: isTV ? selectedEpisode : null,
          tmdbId: id,
          forceRefresh: isForceRefresh,
          visitorId
        })
      });
      const data = await res.json();
      
      if (data.status === 'success' && data.qualities && data.qualities.length > 0) {
        // Parse and Group Links
        const grouped = {};
        for (const q of data.qualities) {
          const directLinks = q.links.filter(l => l.type === 'direct');
          if (directLinks.length === 0) continue;
          
          grouped[q.quality] = {};
          for (const link of directLinks) {
            const cat = link.category || 'episode';
            const lang = extractLanguage(link.name);
            
            if (!grouped[q.quality][cat]) grouped[q.quality][cat] = {};
            if (!grouped[q.quality][cat][lang]) grouped[q.quality][cat][lang] = [];
            grouped[q.quality][cat][lang].push(link);
          }
        }
        
        const availableQualities = Object.keys(grouped);
        if (availableQualities.length > 0) {
          setParsedDownloads(grouped);
          const firstQ = availableQualities[0];
          setSelectedQuality(firstQ);
          
          // Find first available category in this quality
          const firstCat = grouped[firstQ]['batch'] ? 'batch' : 'episode';
          setSelectedCategory(firstCat);
          
          const firstLang = Object.keys(grouped[firstQ][firstCat] || {})[0];
          setSelectedLanguage(firstLang);
          
          if (shouldSkipTimer) {
            if (timerInterval) clearInterval(timerInterval);
            setDownloadStep('options');
          }
          // If not skipping, the useEffect above will trigger setDownloadStep('options')
          // when adTimer reaches 0 and parsedDownloads is populated.
        } else {
          setDownloadErrorMsg('No direct download links found. (Only torrents/magnets available)');
          setDownloadStep('error');
          if (timerInterval) clearInterval(timerInterval);
        }
      } else {
        setDownloadStep('not_found');
        if (timerInterval) clearInterval(timerInterval);
      }
    } catch (err) {
      console.error(err);
      setDownloadErrorMsg(`Failed to search for download links. Error: ${err.message || 'Network Error'}`);
      setDownloadStep('error');
      if (timerInterval) clearInterval(timerInterval);
    } finally {
      setIsDownloading(false);
    }
  };

  // Track watch history
  const trackWatch = async (season = null, episode = null, progressVal = null, durationVal = null) => {
    if (!isLoggedIn || !movie) return;
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/watch-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          movieId: id,
          movieType: type,
          title: movie.title,
          poster: movie.poster,
          backdrop: movie.backdrop,
          rating: movie.rating,
          year: movie.year,
          progress: progressVal,
          duration: durationVal,
          season,
          episode
        })
      });
    } catch (err) {
      console.error('Failed to track watch:', err);
    }
  };

  // Self-contained elapsed-time progress tracker moved to GlobalPlayer

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (showTrailer) setShowTrailer(false);
      }
      
      // N = Next Episode, P = Previous Episode (TV only)
      if (isTV && isThisMoviePlaying && movieData) {
        const pSeason = movieData.season;
        const pEpisode = movieData.episode;
        
        if (e.key === 'n' || e.key === 'N') {
          const nextEp = episodes?.find(ep => ep.number === pEpisode + 1);
          if (nextEp) {
            handlePlayEpisode(pSeason, pEpisode + 1, nextEp.name || '');
            showToast(`▶ Next: S${pSeason} E${pEpisode + 1}`, 'info');
          }
        }
        if (e.key === 'p' || e.key === 'P') {
          if (pEpisode > 1) {
            const prevEp = episodes?.find(ep => ep.number === pEpisode - 1);
            handlePlayEpisode(pSeason, pEpisode - 1, prevEp?.name || '');
            showToast(`◀ Previous: S${pSeason} E${pEpisode - 1}`, 'info');
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTrailer, isTV, isThisMoviePlaying, movieData, episodes]);

  const handleToggleFavorite = async () => {
    if (!isLoggedIn) {
      setShowLoginTeaser(true);
      return;
    }

    try {
      if (isFavorite) {
        await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/favorites/${id}?type=${type}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFavorite(false);
      } else {
        await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/favorites`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({
            movieId: id,
            movieType: type,
            title: movie.title,
            poster: movie.poster,
            backdrop: movie.backdrop,
            overview: movie.overview,
            rating: movie.rating,
            year: movie.year
          })
        });
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  if (loading) return <div style={{color:'white', padding:'100px', fontSize: '18px'}}>Loading...</div>;
  if (!movie) return <div style={{color:'white', padding:'100px', fontSize: '18px'}}>Movie not found!</div>;

  // Build aggressive SEO keyword list for all search intents
  const seoTitle = movie?.title || '';
  const seoYear = movie?.year || '';
  const seoGenres = movie?.genres?.map(g => g.name || g).join(', ') || '';
  const seoDirector = movie?.director || '';
  const seoCast = movie?.cast?.slice(0, 3).map(a => a.name).join(', ') || '';
  const mediaLabel = isTV ? 'TV Show' : 'Movie';
  const langVariants = ['Hindi Dubbed', 'English', 'Dual Audio', '480p', '720p', '1080p', '4K', 'BluRay'];

  const shortTailKeywords = [
    `${seoTitle}`, `${seoTitle} ${seoYear}`,
    `watch ${seoTitle} online`, `${seoTitle} full ${mediaLabel.toLowerCase()}`,
    `download ${seoTitle}`, `${seoTitle} free download`,
    `${seoTitle} aurawatch`, `aurawatch ${seoTitle}`,
    `${seoTitle} HD`, `${seoTitle} streaming`,
  ];

  const longTailKeywords = langVariants.flatMap(variant => [
    `${seoTitle} ${variant}`,
    `download ${seoTitle} ${variant}`,
    `watch ${seoTitle} ${variant} free`,
    `${seoTitle} ${seoYear} ${variant}`,
  ]);

  const siteKeywords = [
    `aurawatch ${seoTitle}`, `aurawatch fun ${seoTitle}`,
    `${seoTitle} on aurawatch`, `${seoTitle} aurawatch fun`,
    ...(seoGenres ? [`${seoTitle} ${seoGenres}`] : []),
    ...(seoDirector ? [`${seoTitle} ${seoDirector}`] : []),
    ...(seoCast ? [`${seoTitle} starring ${seoCast}`] : []),
    ...(isTV ? [
      `${seoTitle} all seasons download`,
      `${seoTitle} season 1 download`,
      `${seoTitle} episodes online`,
      `${seoTitle} web series download`,
    ] : [
      `${seoTitle} full movie download`,
      `${seoTitle} full movie watch online`,
    ]),
    'aurawatch', 'aurawatch fun', 'aurawatchfun',
    'free movies online', 'watch movies free', 'download movies hd',
    'dual audio movies', 'hindi dubbed movies', '1080p movies',
  ];

  const allKeywords = [...shortTailKeywords, ...longTailKeywords, ...siteKeywords].join(', ');

  const seoDescription = [
    `Watch and download ${seoTitle}${seoYear ? ` (${seoYear})` : ''} in Hindi Dubbed, Dual Audio, 480p, 720p, 1080p & 4K on AuraWatch Fun — totally free.`,
    movie?.overview ? `${movie.overview.substring(0, 120)}...` : '',
    `Available in: Hindi Dubbed, English, Dual Audio.`,
    `Stream ${seoTitle} online or download BluRay, WEB-DL, and HDRip quality on AuraWatch.`
  ].filter(Boolean).join(' ');

  const schema = {
    "@context": "https://schema.org",
    "@type": isTV ? "TVSeries" : "Movie",
    "name": seoTitle,
    "alternateName": `${seoTitle} Hindi Dubbed`,
    "url": typeof window !== 'undefined' ? window.location.href : '',
    "image": [movie?.poster, movie?.backdrop].filter(Boolean),
    "description": movie?.overview,
    "datePublished": seoYear,
    "inLanguage": ["en", "hi"],
    "genre": seoGenres ? seoGenres.split(', ') : undefined,
    ...(seoDirector ? { "director": { "@type": "Person", "name": seoDirector } } : {}),
    "aggregateRating": movie?.rating && movie.rating !== 'N/A' ? {
      "@type": "AggregateRating",
      "ratingValue": movie.rating,
      "bestRating": "10",
      "worstRating": "1",
      "ratingCount": "1000"
    } : undefined,
    "actor": movie?.cast?.map(a => ({
      "@type": "Person",
      "name": a.name
    })),
    "trailer": trailerKey ? {
      "@type": "VideoObject",
      "name": `${seoTitle} Official Trailer`,
      "embedUrl": `https://www.youtube.com/embed/${trailerKey}`,
    } : undefined,
  };

  return (
    <div className={styles.detailPage}>
      <SEO 
        title={`${seoTitle}${seoYear ? ` (${seoYear})` : ''} | Watch & Download Hindi Dubbed, Dual Audio HD on AuraWatch`}
        description={seoDescription}
        image={movie?.poster || movie?.backdrop}
        type={isTV ? "video.tv_show" : "video.movie"}
        schema={schema}
        keywords={allKeywords}
      />

      {/* Global Player Handles Embed Now */}

      {/* Trailer Modal */}
      {showTrailer && trailerKey && (
        <div className={styles.trailerModal}>
          <button className={styles.closeTrailerBtn} onClick={() => setShowTrailer(false)}>
            <X size={28} />
          </button>
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&modestbranding=1&rel=0`}
            title="Trailer"
            className={styles.trailerIframe}
            allow="autoplay; encrypted-media"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Backdrop */}
      <div className={styles.backdropContainer}>
        <img 
          src={movie.backdrop} 
          alt={movie.title} 
          className={styles.backdrop} 
          referrerPolicy="no-referrer" 
          onError={(e) => handleImageError(e, false)}
        />
        <div className={styles.overlay}></div>
      </div>

      {/* Main Info */}
      <div className={`${styles.content} content`}>
        <img 
          src={movie.poster} 
          alt={movie.title} 
          className={styles.poster} 
          referrerPolicy="no-referrer" 
          onError={(e) => handleImageError(e, true)}
        />
        <div className={styles.info}>
          <h1 className={styles.title}>{movie.title}</h1>
          <div className={styles.meta}>
            <div className={styles.ratingBadge}>
              <Star size={16} fill="#f5c518" color="#f5c518" />
              <span className={styles.ratingScore}>{movie.rating}</span>
              <span className={styles.ratingMax}>/10</span>
            </div>
            <span>{movie.year}</span>
            <span>{movie.type}</span>
            {isTV && seasons.length > 0 && (
              <span>{seasons.length} Season{seasons.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <p className={styles.overview}>{movie.overview}</p>

          {/* SEO-boosting semantic text - visually subtle but indexable */}
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '-8px', marginBottom: '8px', lineHeight: '1.4' }}>
            Watch {seoTitle}{seoYear ? ` (${seoYear})` : ''} in Hindi Dubbed, Dual Audio, 1080p, 720p, 480p, 4K on AuraWatch Fun.
            {seoCast && ` Starring ${seoCast}.`}
            {seoDirector && ` Directed by ${seoDirector}.`}
            {` Download ${seoTitle} full ${mediaLabel.toLowerCase()} free — BluRay, WEB-DL, HDRip.`}
          </p>

          <div className={styles.actions}>
            <button 
              className={`${styles.playBtn} playBtn`} 
              onClick={() => {
                if (buttonWarnings.play_movie) {
                  const hasBypass = user?.role === 'admin' || user?.role === 'moderator';
                  if (!hasBypass) {
                    showToast(buttonWarnings.play_movie, 'warning');
                    return;
                  } else {
                    showToast(`Admin Notice: ${buttonWarnings.play_movie}`, 'warning');
                  }
                }
                
                if (isTV) {
                  const ep = episodes.find(e => e.number === selectedEpisode);
                  handlePlayEpisode(selectedSeason, selectedEpisode, ep?.name || '');
                }
                else { openPlayer({ id: movie.id, type, title: movie.title, poster: movie.poster, backdrop: movie.backdrop, rating: movie.rating, year: movie.year, runtime: movie.runtime }); }
              }}
            >
              <Play fill="black" size={22} /> Play Now
              {buttonWarnings.play_movie && <span className={styles.warningBadge} />}
            </button>
            <button 
              className={`${styles.trailerBtnDetail} trailerBtnDetail`} 
              title={buttonWarnings.watch_trailer || ''}
              onClick={(e) => {
                if (buttonWarnings.watch_trailer) {
                  const hasBypass = user?.role === 'admin' || user?.role === 'moderator';
                  if (!hasBypass) {
                    e.preventDefault();
                    showToast(buttonWarnings.watch_trailer, 'warning');
                    return;
                  } else {
                    showToast(`Admin Notice: ${buttonWarnings.watch_trailer}`, 'warning');
                  }
                }
                handleWatchTrailer();
              }}
            >
              Watch Trailer
              {buttonWarnings.watch_trailer && <span className={styles.warningBadge} />}
            </button>
            <button 
              className={`${styles.listBtn} ${isFavorite ? styles.listBtnActive : ''}`} 
              onClick={(e) => {
                if (buttonWarnings.add_to_list) {
                  const hasBypass = user?.role === 'admin' || user?.role === 'moderator';
                  if (!hasBypass) {
                    e.preventDefault();
                    showToast(buttonWarnings.add_to_list, 'warning');
                    return;
                  } else {
                    showToast(`Admin Notice: ${buttonWarnings.add_to_list}`, 'warning');
                  }
                }
                handleToggleFavorite();
              }}
              data-title={buttonWarnings.add_to_list || (isLoggedIn ? (isFavorite ? 'Remove from My List' : 'Add to My List') : 'Login to save')}
            >
              <span className={isFavorite ? styles.iconActive : styles.iconInactive}>
                {isFavorite ? <Check size={22} /> : <Plus size={22} />}
              </span>
              {buttonWarnings.add_to_list && <span className={styles.warningBadge} style={{top: '-2px', right: '-2px'}} />}
            </button>
            <button 
              className={`${styles.listBtn} downloadBtn`}
              onClick={(e) => {
                if (buttonWarnings.download_movie) {
                  const hasBypass = user?.role === 'admin' || user?.role === 'moderator';
                  if (!hasBypass) {
                    e.preventDefault();
                    showToast(buttonWarnings.download_movie, 'warning');
                    return;
                  } else {
                    showToast(`Admin Notice: ${buttonWarnings.download_movie}`, 'warning');
                  }
                }
                handleDownload();
              }}
              data-title={buttonWarnings.download_movie || "Download Movie"}
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 size={22} className={styles.spinner} /> : <Download size={22} />}
              {buttonWarnings.download_movie && <span className={styles.warningBadge} />}
            </button>

            {/* Report Issue Button */}
            <button
              className={`${styles.listBtn} ${styles.reportBtn}`}
              onClick={() => setShowReportModal(true)}
              data-title="Report an Issue"
            >
              <Flag size={20} />
            </button>
          </div>

          {/* TV: Season + Episode Dropdowns */}
          {isTV && seasons.length > 0 && (
            <div className={styles.tvSelectors}>
              <div className={styles.selectorWrapper}>
                <label className={styles.selectorLabel}>Season</label>
                <div className={styles.seasonDropdownWrapper}>
                  <select
                    className={styles.seasonDropdown}
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  >
                    {seasons.map(s => (
                      <option key={s.number} value={s.number}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={styles.dropdownIcon} />
                </div>
              </div>

              <div className={styles.selectorWrapper}>
                <label className={styles.selectorLabel}>Episode</label>
                <div className={styles.seasonDropdownWrapper}>
                  <select
                    className={styles.seasonDropdown}
                    value={selectedEpisode}
                    onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                  >
                    {episodes.map(ep => (
                      <option key={ep.number} value={ep.number}>
                        Ep {ep.number}{ep.name ? ` — ${ep.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={styles.dropdownIcon} />
                </div>
              </div>
            </div>
          )}
          
          {/* Cast Section */}
          {movie.cast && movie.cast.length > 0 && (
            <div className={styles.castSection}>
              <h3 className={styles.castTitle}>Top Cast</h3>
              <div className={styles.castList}>
                {movie.cast.map(actor => (
                  <div key={actor.id} className={styles.castMember}>
                    {actor.profile ? (
                      <img src={actor.profile} alt={actor.name} className={styles.castImage} />
                    ) : (
                      <div className={styles.castImagePlaceholder}>{actor.name.charAt(0)}</div>
                    )}
                    <span className={styles.castName}>{actor.name}</span>
                    <span className={styles.castCharacter}>{actor.character}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episodes Section (Netflix Style) */}
      {isTV && seasons.length > 0 && (
        <div className={`${styles.seasonsSection} seasonsSection`}>
          <div className={styles.seasonHeader}>
            <h2 className={styles.episodesTitle}>Episodes</h2>
            <div className={styles.seasonDropdownWrapper}>
              <select
                className={styles.seasonDropdown}
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
              >
                {seasons.map(s => (
                  <option key={s.number} value={s.number}>{s.name || `Season ${s.number}`}</option>
                ))}
              </select>
              <ChevronDown size={14} className={styles.dropdownIcon} />
            </div>
          </div>
          
          <div className={styles.episodeList}>
            {episodes.map(ep => (
              <div 
                key={ep.number} 
                className={styles.episodeCard}
                onClick={() => handlePlayEpisode(selectedSeason, ep.number, ep.name)}
              >
                <div className={styles.episodeThumb}>
                  {ep.still ? (
                    <img src={ep.still} alt={ep.name} className={styles.episodeImg} referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.episodeNoThumb}>{ep.number}</div>
                  )}
                  <div className={styles.episodePlayOverlay}>
                    <Play fill="white" color="white" size={32} />
                  </div>
                </div>
                <div className={styles.episodeInfo}>
                  <div className={styles.episodeMeta}>
                    <span className={styles.episodeNum}>{ep.number}. {ep.name || `Episode ${ep.number}`}</span>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                      {ep.rating ? (
                        <span style={{display: 'flex', alignItems: 'center', gap: '4px', color: '#f5c518', fontSize: '13px', fontWeight: '600'}}>
                          <Star size={12} fill="#f5c518" />
                          {(ep.rating / 10).toFixed(1)}
                        </span>
                      ) : null}
                      {ep.runtime ? <span className={styles.episodeDuration}>{ep.runtime}m</span> : null}
                    </div>
                  </div>
                  <p className={styles.episodeOverview}>
                    {ep.overview || "No description available for this episode."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* More Like This */}
      <div className={`${styles.recommendations} recommendations`}>
        <Row title="More Like This" endpoint={`${id}/similar?type=${type}`} />
      </div>

      {/* Download Modal */}
      {showDownloadModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.downloadModal}>
            <button className={styles.closeModalBtn} onClick={() => {
              setShowDownloadModal(false);
              setIsDownloading(false);
            }}>
              <X size={24} />
            </button>

            {downloadStep === 'ad' && (
              <div className={styles.adPhase}>
                <h2>Generating Premium Links</h2>
                <p>Please wait while we securely fetch the best available download links for you.</p>
                
                {(!user || (user.role !== 'admin' && !user.is_super_admin)) && !globalSkipAds ? (
                  <>
                    {/* ADVERTISEMENT SCRIPT */}
                    <div className={styles.adPlaceholder} style={{ padding: 0, background: 'transparent', border: 'none' }}>
                      <BannerAd />
                    </div>
                    
                    <div className={styles.timerBox}>
                      <Loader2 size={24} className={styles.spinner} />
                      <span>Links ready in {adTimer} seconds...</span>
                    </div>
                  </>
                ) : (
                  <div className={styles.timerBox}>
                    <Loader2 size={24} className={styles.spinner} />
                    <span>Fetching links, please wait...</span>
                  </div>
                )}
              </div>
            )}

            {downloadStep === 'error' && (
              <div className={styles.errorPhase}>
                <h2 style={{color: '#e50914'}}>Oops!</h2>
                <p>{downloadErrorMsg}</p>
                <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px'}}>
                  <button className={`${styles.primaryBtn} primaryBtn`} onClick={() => setShowDownloadModal(false)}>Close</button>
                  <button className={`${styles.primaryBtn} primaryBtn`} style={{background: '#333'}} onClick={() => handleDownload(true)}>Try Again</button>
                </div>
              </div>
            )}

            {downloadStep === 'not_found' && (
              <div className={styles.errorPhase}>
                <h2>No Links Found</h2>
                <p>We couldn't find any direct download links for this title right now. Please check back later.</p>
                <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px'}}>
                  <button className={`${styles.primaryBtn} primaryBtn`} onClick={() => setShowDownloadModal(false)}>Close</button>
                  <button className={`${styles.primaryBtn} primaryBtn`} style={{background: '#333'}} onClick={() => handleDownload(true)}>Search Again</button>
                </div>
              </div>
            )}

            {downloadStep === 'options' && (
              <div className={styles.optionsPhase}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h2>Download Options</h2>
                  <button 
                    className={styles.refreshBtn} 
                    onClick={() => handleDownload(true)}
                    title="Clear cache and fetch fresh links"
                  >
                    Fetch Fresh Links
                  </button>
                </div>
                <p className={styles.optionsSubtitle}>{movie.title}</p>
                
                <div className={styles.qualityTabs}>
                  {Object.keys(parsedDownloads).map((q) => (
                    <button 
                      key={q} 
                      className={`${styles.tabBtn} ${selectedQuality === q ? styles.activeTab : ''}`}
                      onClick={() => {
                        setSelectedQuality(q);
                        const availableCats = Object.keys(parsedDownloads[q]);
                        const newCat = availableCats.includes(selectedCategory) ? selectedCategory : availableCats[0];
                        setSelectedCategory(newCat);
                        setSelectedLanguage(Object.keys(parsedDownloads[q][newCat])[0]);
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {isTV && selectedQuality && parsedDownloads[selectedQuality] && (
                  <div className={styles.categoryTabs}>
                    {Object.keys(parsedDownloads[selectedQuality]).map((cat) => (
                      <button
                        key={cat}
                        className={`${styles.catTabBtn} ${selectedCategory === cat ? styles.activeCatTab : ''}`}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setSelectedLanguage(Object.keys(parsedDownloads[selectedQuality][cat])[0]);
                        }}
                      >
                        {cat === 'batch' ? 'Season Batch / Packs' : 'Episode Wise'}
                      </button>
                    ))}
                  </div>
                )}

                {selectedQuality && selectedCategory && parsedDownloads[selectedQuality]?.[selectedCategory] && (
                  <div className={styles.languageTabs}>
                    {Object.keys(parsedDownloads[selectedQuality][selectedCategory]).map((lang) => (
                      <button
                        key={lang}
                        className={`${styles.langTabBtn} ${selectedLanguage === lang ? styles.activeLangTab : ''}`}
                        onClick={() => setSelectedLanguage(lang)}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.linksList}>
                  {selectedQuality && selectedCategory && selectedLanguage && parsedDownloads[selectedQuality]?.[selectedCategory]?.[selectedLanguage]?.map((link, idx) => (
                    <div key={idx} className={styles.linkCard}>
                      <div className={styles.linkInfo}>
                        <span className={styles.linkQuality}>{selectedQuality}</span>
                        <span className={styles.linkSize}>{link.size || 'Unknown Size'}</span>
                        <span className={styles.linkName} title={link.name}>
                          {link.name}
                        </span>
                      </div>
                      <button 
                        className={`${styles.primaryBtn} primaryBtn`}
                        onClick={() => window.open(getDownloadUrl(link), '_blank')}
                      >
                        <Download size={18} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Login Teaser Modal */}
      {showLoginTeaser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowLoginTeaser(false)}>
          <div style={{
            background: 'linear-gradient(145deg, #1a1a24, #0f0f16)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '40px', maxWidth: '400px', width: '100%',
            textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowLoginTeaser(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <div style={{ width: '64px', height: '64px', background: 'rgba(229,9,20,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Plus size={32} color="#e50914" />
            </div>
            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>Save to Your List</h2>
            <p style={{ color: '#aaa', fontSize: '15px', lineHeight: '1.5', marginBottom: '30px' }}>
              Create a free account to build your personal watchlist, track your watching history, and customize your AuraWatch experience.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => navigate('/login')}
                style={{ background: '#e50914', color: 'white', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
              >
                Log In to Save
              </button>
              <button 
                onClick={() => navigate('/login?tab=register')}
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
              >
                Create an Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal — pre-opens on Report Issue tab with movie name prefilled */}
      <HelpModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        initialTab="report_issue"
        prefillDescription={`Issue with: ${movie?.title || ''} (${type === 'tv' ? 'Series' : 'Movie'})\n\nDescribe the problem:`}
      />
    </div>
  );
};

export default MovieDetail;
