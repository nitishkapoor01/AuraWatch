import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Clock, Heart, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Search.module.css';
import homeStyles from './Home.module.css';
import SEO from '../components/SEO';

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const filterType = searchParams.get('type') || 'Movie';
  const filterGenre = searchParams.get('genre') || 'all';
  const filterLang = searchParams.get('lang') || 'all';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const { isLoggedIn, token } = useAuth();
  const [recentSearches, setRecentSearches] = useState([]);
  const [likedSearches, setLikedSearches] = useState([]);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');

  const fetchHistory = async () => {
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const recentRes = await fetch(`${API_BASE}/movies/recent-searches?visitorId=${visitorId}`, { headers });
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setRecentSearches(recentData);
      }

      const likedRes = await fetch(`${API_BASE}/movies/liked-searches?visitorId=${visitorId}`, { headers });
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        setLikedSearches(likedData);
      }
    } catch (err) {
      console.error('Failed to fetch search history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [query, isLoggedIn, token]);

  const handleLikeSearch = async (e, q, isAlreadyLiked) => {
    e.stopPropagation();
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const endpoint = `${API_BASE}/movies/like-search`;
      const method = isAlreadyLiked ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({ query: q, visitorId })
      });

      if (res.ok) {
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to toggle like on search:', err);
    }
  };

  const handleDeleteRecentSearch = async (e, q) => {
    e.stopPropagation();
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`${API_BASE}/movies/recent-searches`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ query: q, visitorId })
      });

      if (res.ok) {
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to delete recent search:', err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your entire search history?')) return;
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`${API_BASE}/movies/recent-searches/clear`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ visitorId })
      });

      if (res.ok) {
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to clear search history:', err);
    }
  };

  const handleSearchClick = (q) => {
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Fetch search results
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const visitorId = localStorage.getItem('trackingVisitorId') || '';
        let endpoint = query.trim()
          ? `${API_BASE}/movies/search?query=${encodeURIComponent(query)}&visitorId=${visitorId}`
          : `${API_BASE}/movies/discover?type=${filterType}&genre=${filterGenre}&lang=${filterLang}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (error) {
        setResults([]);
      }
      setLoading(false);
    };
    fetchResults();
  }, [query, filterType, filterGenre, filterLang]);

  return (
    <div className={styles.searchPage}>
      <SEO
        title={query ? `Search results for "${query}"` : `Explore ${filterType === 'Movie' ? 'Movies' : 'TV Series'}`}
        description={`Find the best movies and TV shows on AuraWatch.`}
      />

      {/* Normal Search Header */}
      <div className={styles.searchHeader}>
        {query ? (
          <h1 className={styles.searchTitle}>
            Results for <span className={styles.query}>"{query}"</span>
          </h1>
        ) : (
          <h1 className={styles.searchTitle}>
            Exploring <span className={styles.query}>{filterType === 'Movie' ? 'Movies' : 'TV Series'}</span>
          </h1>
        )}
      </div>

      {/* History & Liked Searches Dashboard */}
      {!query && (recentSearches.length > 0 || likedSearches.length > 0) && (
        <div className={styles.historyDashboard}>
          {recentSearches.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.sectionHeader}>
                <h2><Clock size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Recent Searches</h2>
                <button className={styles.clearBtn} onClick={handleClearHistory}>
                  <Trash2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Clear History
                </button>
              </div>
              <div className={styles.chipList}>
                {recentSearches.map((item, idx) => (
                  <div
                    key={idx}
                    className={styles.searchChip}
                    onClick={() => handleSearchClick(item.query)}
                  >
                    <span className={styles.chipText}>{item.query}</span>
                    <div className={styles.chipActions}>
                      <button
                        className={`${styles.actionBtn} ${item.is_liked ? styles.liked : ''}`}
                        onClick={(e) => handleLikeSearch(e, item.query, item.is_liked)}
                        title={item.is_liked ? 'Unlike search' : 'Like search'}
                      >
                        <Heart size={13} fill={item.is_liked ? '#e50914' : 'none'} color={item.is_liked ? '#e50914' : '#aaa'} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => handleDeleteRecentSearch(e, item.query)}
                        title="Remove from history"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {likedSearches.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.sectionHeader}>
                <h2><Heart size={16} fill="#e50914" color="#e50914" style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Liked Searches</h2>
              </div>
              <div className={styles.chipList}>
                {likedSearches.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${styles.searchChip} ${styles.likedChip}`}
                    onClick={() => handleSearchClick(item.query)}
                  >
                    <span className={styles.chipText}>{item.query}</span>
                    <button
                      className={`${styles.actionBtn} ${styles.liked}`}
                      onClick={(e) => handleLikeSearch(e, item.query, true)}
                      title="Unlike search"
                    >
                      <Heart size={13} fill="#e50914" color="#e50914" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'white', textAlign: 'center', marginTop: '40px', fontSize: '18px' }}>Searching...</div>
      ) : results.length > 0 ? (
        <div className={styles.grid}>
          {results.map((movie, idx) => (
            <Link
              to={`/movie/${movie.id}?type=${movie.type.toLowerCase()}`}
              key={`${movie.id}-${idx}`}
              className={homeStyles.cardContainer}
              style={{ flex: 'none', width: '100%', display: 'block', touchAction: 'manipulation' }}
            >
              <img src={movie.poster} alt={movie.title} className={homeStyles.cardImage} />
            </Link>
          ))}
        </div>
      ) : (
        query && <div className={styles.noResults}>No results found for "{query}". Try a different keyword.</div>
      )}
    </div>
  );
};

export default Search;
