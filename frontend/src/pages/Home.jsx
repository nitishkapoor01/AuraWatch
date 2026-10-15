import React, { useState, useEffect, useRef } from 'react';
import { Play, Info, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithCache } from '../utils/api';
import styles from './Home.module.css';
import Row from '../components/Row';
import ContinueWatchingRow from '../components/ContinueWatchingRow';
import SEO from '../components/SEO';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
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
        <Row title="Trending Now" endpoint="trending" compact={layout === 'grid'} rowIndex={0} />
        <Row title="Top 10 in India Today" endpoint="trending-india" compact={layout === 'grid'} rowIndex={1} />
        <Row title="New Releases This Week" endpoint="new-this-week" compact={layout === 'grid'} rowIndex={2} />

        {/* Native VIP Ad-Pass Promotional Banner */}
        {!user?.is_premium && (
          <div 
            className={styles.vipPromoBanner}
            onClick={() => window.dispatchEvent(new CustomEvent('aurawatch_open_vip_modal'))}
            role="button"
            tabIndex={0}
            title="Click to unlock Free VIP Pass"
          >
            <div className={styles.vipPromoLeft}>
              <div className={styles.vipPromoBadge}>
                <Crown size={15} color="#ffb703" />
                <span>AuraWatch VIP Pass</span>
              </div>
              <h3 className={styles.vipPromoTitle}>Stream All Movies & Series 100% Ad-Free</h3>
              <p className={styles.vipPromoDesc}>
                Say goodbye to server redirects and sponsor popups. Complete a quick sponsor quest to activate your free VIP streaming pass today.
              </p>
            </div>
            <div className={styles.vipPromoRight}>
              <button type="button" className={styles.vipPromoBtn}>
                Start Free Quest
              </button>
            </div>
          </div>
        )}

        <Row title="Netflix Originals" endpoint="originals" compact={layout === 'grid'} rowIndex={3} />
        <Row title="Popular K-Dramas" endpoint="k-drama" compact={layout === 'grid'} rowIndex={4} />
        <Row title="Popular on Netflix" endpoint="continue-watching" compact={layout === 'grid'} rowIndex={5} />
        <Row title="Top Rated Classics" endpoint="top-rated" compact={layout === 'grid'} rowIndex={6} />
        <Row title="Action & Adventure" endpoint="action" compact={layout === 'grid'} rowIndex={7} />
        <Row title="Sci-Fi & Fantasy" endpoint="genre/878" compact={layout === 'grid'} rowIndex={8} />
        <Row title="Laugh Out Loud" endpoint="comedy" compact={layout === 'grid'} rowIndex={9} />
        <Row title="Horror & Thrillers" endpoint="horror" compact={layout === 'grid'} rowIndex={10} />
        <Row title="Romantic Movies" endpoint="genre/10749" compact={layout === 'grid'} rowIndex={11} />
        <Row title="Magical Worlds" endpoint="genre/14" compact={layout === 'grid'} rowIndex={12} />
        <Row title="Animation" endpoint="genre/16" compact={layout === 'grid'} rowIndex={13} />
        <Row title="Documentaries" endpoint="genre/99" compact={layout === 'grid'} rowIndex={14} />
      </div>
    </div>
  );
};

export default Home;
