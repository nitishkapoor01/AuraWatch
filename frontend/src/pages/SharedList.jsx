import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Film, User, Heart, Sparkles } from 'lucide-react';
import styles from './MyList.module.css';
import SEO from '../components/SEO';

const SharedList = () => {
  const { userId } = useParams();
  const [favorites, setFavorites] = useState([]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSharedList = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
        const res = await fetch(`${baseUrl}/favorites/shared/${userId}`);
        const data = await res.json();
        
        if (res.ok) {
          setFavorites(data.favorites);
          setUserName(data.userName);
        } else {
          setError(data.message || 'Failed to fetch the shared list.');
        }
      } catch (err) {
        console.error('Failed to fetch shared list:', err);
        setError('Something went wrong. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedList();
  }, [userId]);

  if (loading) {
    return (
      <div className={styles.myListPage}>
        <h1 className={styles.pageTitle}>Shared Watchlist</h1>
        <div className={styles.loadingGrid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.myListPage}>
        <div className={styles.emptyState}>
          <Film size={64} strokeWidth={1} />
          <h2>List Not Found</h2>
          <p>{error}</p>
          <Link to="/" className={styles.browseBtn}>Go Back Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.myListPage}>
      <SEO 
        title={`${userName}'s Watchlist - AuraWatch`}
        description={`Check out ${userName}'s favorite movies and TV shows on AuraWatch.`}
      />
      
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>{userName}'s Watchlist</h1>
          <p className={styles.subtitle}>{favorites.length} title{favorites.length !== 1 ? 's' : ''} shared</p>
        </div>
        <div className={styles.sharedBadge}>
          <User size={18} />
          <span>Shared by {userName}</span>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className={styles.emptyState}>
          <Film size={64} strokeWidth={1} />
          <h2>This list is empty</h2>
          <p>{userName} hasn't added any titles yet.</p>
          <Link to="/" className={styles.browseBtn}>Browse AuraWatch</Link>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {favorites.map((item) => (
              <div key={`${item.movie_id}-${item.movie_type}`} className={styles.card}>
                <Link
                  to={`/movie/${item.movie_id}?type=${item.movie_type}`}
                  className={styles.cardLink}
                >
                  <img
                    src={item.poster}
                    alt={item.title}
                    className={styles.cardImage}
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                  />
                  <div className={styles.cardOverlay}>
                    <span className={styles.cardTitle}>{item.title}</span>
                    <span className={styles.cardMeta}>
                      {item.year} · {item.movie_type === 'tv' || item.movie_type === 'series' ? 'TV Show' : 'Movie'}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          
          <div className={styles.promoScreen} style={{marginTop: '80px', minHeight: 'auto'}}>
            <div className={styles.promoContent} style={{padding: '40px'}}>
              <Heart size={40} color="#e50914" strokeWidth={1.5} />
              <h2 className={styles.promoTitle}>Inspired by {userName}?</h2>
              <p className={styles.promoDesc}>
                Create your own personal watchlist on AuraWatch and never miss a movie or show again.
              </p>
              <Link to="/login?tab=register" className={styles.promoCta}>
                Create My Own List
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SharedList;
