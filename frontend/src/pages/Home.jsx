import React, { useState, useEffect, useRef } from 'react';
import { Play, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithCache } from '../utils/api';
import styles from './Home.module.css';
import Row from '../components/Row';
import SEO from '../components/SEO';

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const navigate = useNavigate();
  const timerRef = useRef(null);

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
      {/* Dynamic Hero Section */}
      <div className={styles.heroSection}>
        {loading ? (
          <div className="skeleton" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
        ) : (
          heroMovie && (
            <img 
              src={backdropUrl} 
              alt={heroMovie.title} 
              className={styles.heroBg}
              referrerPolicy="no-referrer"
              style={{ 
                opacity: fade ? 1 : 0,
                visibility: 'visible',
                display: 'block'
              }}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';
              }}
            />
          )
        )}
        <div className={styles.heroOverlay} />

        {/* Content */}
        {!loading && heroMovie && (
          <div
            className={styles.heroContent}
            style={{ opacity: fade ? 1 : 0 }}
          >
            <div className={styles.heroSeries}>
              <span className={styles.nLogo}>N</span>{' '}
              {heroMovie.type === 'Series' ? 'SERIES' : 'FILM'}
            </div>

            <h1 className={styles.heroTitle}>
              {heroMovie.title}
            </h1>

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
              <button
                className={styles.playBtn}
                onClick={() => navigate(`/movie/${heroMovie.id}?type=${heroType}`)}
              >
                <Play fill="black" size={22} /> Play
              </button>
              <button
                className={styles.infoBtn}
                onClick={() => navigate(`/movie/${heroMovie.id}?type=${heroType}`)}
              >
                <Info size={22} /> More Info
              </button>
            </div>
          </div>
        )}



        <div className={styles.ageRatingBadge}>TV-14</div>
      </section>

      {/* Rows */}
      <div className={styles.sectionContainer}>
        <Row title="Netflix Originals" endpoint="originals" />
        <Row title="Trending Now" endpoint="trending" />
        <Row title="Popular on Netflix" endpoint="continue-watching" />
        <Row title="Top Rated Classics" endpoint="top-rated" />
        <Row title="Action & Adventure" endpoint="action" />
        <Row title="Sci-Fi & Fantasy" endpoint="genre/878" />
        <Row title="Laugh Out Loud" endpoint="comedy" />
        <Row title="Horror & Thrillers" endpoint="horror" />
        <Row title="Romantic Movies" endpoint="genre/10749" />
        <Row title="Magical Worlds" endpoint="genre/14" />
        <Row title="Animation" endpoint="genre/16" />
        <Row title="Documentaries" endpoint="genre/99" />
      </div>
    </div>
  );
};

export default Home;
