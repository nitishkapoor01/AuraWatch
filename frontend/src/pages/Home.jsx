import React, { useState, useEffect, useRef } from 'react';
import { Play, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithCache } from '../utils/api';
import styles from './Home.module.css';
import Row from '../components/Row';
import ContinueWatchingRow from '../components/ContinueWatchingRow';
import SEO from '../components/SEO';
import { useTheme } from '../context/ThemeContext';

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const { preferences } = useTheme();
  const layout = preferences?.layout || 'cinematic';
  const heroSize = preferences?.heroSize || 'full';
  const showHero = layout !== 'grid' && heroSize !== 'hidden';

  useEffect(() => {
    const fetchHero = async () => {
      try {
        const onRevalidate = (freshData) => {
          if (Array.isArray(freshData) && freshData.length > 0) {
            setTrending(freshData.slice(0, 10));
          }
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/trending`, onRevalidate);
        if (Array.isArray(data) && data.length > 0) {
          setTrending(data.slice(0, 10));
        } else {
          console.error("Trending data is not an array or empty:", data);
        }
      } catch (error) {
        console.error('Error fetching hero data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHero();
  }, []);

  useEffect(() => {
    if (trending.length <= 1) return;

    timerRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setHeroIndex(prev => (prev + 1) % trending.length);
        setFade(true);
      }, 800); 
    }, 8000);

    return () => clearInterval(timerRef.current);
  }, [trending]);

  const heroMovie = trending.length > 0 ? trending[heroIndex] : null;
  const heroType = heroMovie
    ? (heroMovie.type === 'Series' || heroMovie.type === 'tv' ? 'tv' : 'movie')
    : 'movie';

  // Fallback if image fails to load
  const backdropUrl = heroMovie?.backdrop || 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';

  return (
    <div className={styles.home}>
      <SEO />

      {/* Hero Section — only shown in Cinematic layout */}
      {showHero && (
        <section className={`${styles.hero} hero`}>
          {loading ? (
            <div className="skeleton" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
          ) : (
            heroMovie && (
              <img
                src={backdropUrl}
                alt={heroMovie.title}
                className={styles.heroBg}
                referrerPolicy="no-referrer"
                style={{ opacity: fade ? 1 : 0, visibility: 'visible', display: 'block' }}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop'; }}
              />
            )
          )}
          <div className={styles.heroOverlay} />

          {!loading && heroMovie && (
            <div className={styles.heroContent} style={{ opacity: fade ? 1 : 0 }}>
              <div className={styles.heroSeries}>
                <span className={styles.nLogo}>N</span>{' '}
                {heroMovie.type === 'Series' ? 'SERIES' : 'FILM'}
              </div>
              <h1 className={styles.heroTitle}>{heroMovie.title}</h1>
              <div className={styles.top10Badge}>
                <span className={styles.top10Icon}>
                  <span style={{ fontSize: '8px' }}>TOP</span>
                  <span>10</span>
                </span>
                #1 in {heroMovie.type === 'Series' ? 'TV Shows' : 'Movies'} Today
              </div>
              <p className={styles.heroDesc}>
                {heroMovie.overview ? heroMovie.overview.slice(0, 200) + '...' : ''}
              </p>
              <div className={styles.heroButtons}>
                <button className={`${styles.playBtn} playBtn`} onClick={() => navigate(`/movie/${heroMovie.id}?type=${heroType}`)}>
                  <Play fill="black" size={22} /> Play
                </button>
                <button className={`${styles.infoBtn} infoBtn`} onClick={() => navigate(`/movie/${heroMovie.id}?type=${heroType}`)}>
                  <Info size={22} /> More Info
                </button>
              </div>
            </div>
          )}
          <div className={styles.ageRatingBadge}>TV-14</div>
        </section>
      )}

      {/* Content Rows — layout-aware */}
      <div
        className={`${styles.sectionContainer} sectionContainer`}
        style={{
          marginTop: showHero ? undefined : '80px',
          paddingLeft: layout === 'minimal' ? '120px' : undefined,
          paddingRight: layout === 'minimal' ? '120px' : undefined,
        }}
      >
        <ContinueWatchingRow compact={layout === 'grid'} />
        <Row title="Trending Now" endpoint="trending" compact={layout === 'grid'} />
        <Row title="Top 10 in India Today" endpoint="trending-india" compact={layout === 'grid'} />
        <Row title="New Releases This Week" endpoint="new-this-week" compact={layout === 'grid'} />

        {/* Seasonal Banner */}
        <div style={{
          margin: '60px 4% 60px 0',
          padding: '50px 40px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.4) 0%, rgba(0,0,0,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span style={{ 
              background: '#e50914', color: '#fff', padding: '4px 12px', 
              borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
              textTransform: 'uppercase', marginBottom: '16px', display: 'inline-block'
            }}>Seasonal Special</span>
            <h2 style={{ fontSize: '36px', color: '#fff', marginBottom: '12px', fontWeight: '900' }}>☀️ Summer Blockbusters 2026</h2>
            <p style={{ color: '#ccc', fontSize: '18px', maxWidth: '600px', lineHeight: '1.6' }}>
              The heat is on! Dive into our curated collection of the year's biggest Indian and global hits.
            </p>
          </div>
          <div style={{ 
            position: 'absolute', right: '-10%', top: '-20%', fontSize: '200px', 
            opacity: 0.1, pointerEvents: 'none', transform: 'rotate(15deg)'
          }}>🔥</div>
        </div>

        <Row title="Netflix Originals" endpoint="originals" compact={layout === 'grid'} />
        <Row title="Popular on Netflix" endpoint="continue-watching" compact={layout === 'grid'} />
        <Row title="Top Rated Classics" endpoint="top-rated" compact={layout === 'grid'} />
        <Row title="Action & Adventure" endpoint="action" compact={layout === 'grid'} />
        <Row title="Sci-Fi & Fantasy" endpoint="genre/878" compact={layout === 'grid'} />
        <Row title="Laugh Out Loud" endpoint="comedy" compact={layout === 'grid'} />
        <Row title="Horror & Thrillers" endpoint="horror" compact={layout === 'grid'} />
        <Row title="Romantic Movies" endpoint="genre/10749" compact={layout === 'grid'} />
        <Row title="Magical Worlds" endpoint="genre/14" compact={layout === 'grid'} />
        <Row title="Animation" endpoint="genre/16" compact={layout === 'grid'} />
        <Row title="Documentaries" endpoint="genre/99" compact={layout === 'grid'} />
      </div>
    </div>
  );
};

export default Home;
