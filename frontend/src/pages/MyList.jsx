import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Film, Heart, BookmarkPlus, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './MyList.module.css';

const MyList = () => {
  const { isLoggedIn, token } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    fetchFavorites();
  }, [isLoggedIn]);

  // Show exciting promo screen for non-logged-in users
  if (!isLoggedIn) {
    return (
      <div className={styles.myListPage}>
        <div className={styles.promoScreen}>
          <div className={styles.promoGlow}></div>
          <div className={styles.promoContent}>
            <Heart size={56} color="#e50914" strokeWidth={1.5} />
            <h1 className={styles.promoTitle}>Your Personal Watchlist</h1>
            <p className={styles.promoDesc}>
              Save movies and shows you love. Build your perfect watchlist 
              and never miss a title you want to see.
            </p>

            <div className={styles.promoFeatures}>
              <div className={styles.promoFeature}>
                <BookmarkPlus size={28} color="#e50914" />
                <div>
                  <h3>Save Anything</h3>
                  <p>One click to add movies & shows</p>
                </div>
              </div>
              <div className={styles.promoFeature}>
                <Film size={28} color="#0071eb" />
                <div>
                  <h3>Organize Your Queue</h3>
                  <p>All your saved titles in one place</p>
                </div>
              </div>
              <div className={styles.promoFeature}>
                <Sparkles size={28} color="#e5b909" />
                <div>
                  <h3>Personalized</h3>
                  <p>Your list, your way — always synced</p>
                </div>
              </div>
            </div>

            <Link to="/login" className={styles.promoCta}>
              Sign In to Start Saving
            </Link>
            <p className={styles.promoSubtext}>Free to join · No credit card needed</p>
          </div>
        </div>
      </div>
    );
  }

  const fetchFavorites = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data);
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    }
    setLoading(false);
  };

  const handleRemove = async (movieId, movieType) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/favorites/${movieId}?type=${movieType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(prev => prev.filter(f => !(f.movie_id === movieId && f.movie_type === movieType)));
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  if (loading) {
    return (
      <div className={styles.myListPage}>
        <h1 className={styles.pageTitle}>My List</h1>
        <div className={styles.loadingGrid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.myListPage}>
      <h1 className={styles.pageTitle}>My List</h1>
      <p className={styles.subtitle}>{favorites.length} title{favorites.length !== 1 ? 's' : ''} saved</p>

      {favorites.length === 0 ? (
        <div className={styles.emptyState}>
          <Film size={64} strokeWidth={1} />
          <h2>Your list is empty</h2>
          <p>Movies and shows you add to your list will appear here.</p>
          <Link to="/" className={styles.browseBtn}>Browse Content</Link>
        </div>
      ) : (
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
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(item.movie_id, item.movie_type)}
                title="Remove from My List"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyList;
