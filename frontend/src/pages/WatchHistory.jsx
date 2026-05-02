import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Clock, Play, Film, Tv, BarChart3, Calendar, Filter, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './WatchHistory.module.css';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'older', label: 'Older' },
];

const WatchHistory = () => {
  const { isLoggedIn, token } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    fetchHistory();
  }, [isLoggedIn]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api')}/watch-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch watch history:', err);
    }
    setLoading(false);
  };

  const handleRemove = async (movieId, movieType) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api')}`}/watch-history/${movieId}?type=${movieType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(prev => prev.filter(f => !(f.movie_id === movieId && f.movie_type === movieType)));
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  const handleGetLink = async (item) => {
    try {
      const res = await fetch('http://localhost:3000/api/movie/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, year: item.year })
      });
      const data = await res.json();
      if (data.bestLink) {
        window.open(data.bestLink, '_blank');
      } else {
        alert(data.message || 'No link found');
      }
    } catch (err) {
      console.error('Failed to fetch link:', err);
    }
  };

  const parseDate = (dateStr) => {
    return new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  };

  // Process data once to determine categories and labels together
  const processedData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toDateString();

    const counts = { all: history.length, today: 0, yesterday: 0, week: 0, month: 0, older: 0 };
    
    const items = history.map(item => {
      const date = parseDate(item.last_watched);
      const dStr = date.toDateString();
      
      let category = 'older';
      let label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      if (dStr === todayStr) {
        category = 'today';
        label = 'Today';
      } else if (dStr === yestStr) {
        category = 'yesterday';
        label = 'Yesterday';
      } else {
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 7) category = 'week';
        else if (diffDays < 30) category = 'month';
      }
      
      counts[category]++;
      
      return {
        ...item,
        category,
        label,
        detailedTime: date.toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      };
    });

    const filtered = activeFilter === 'all' 
      ? items 
      : items.filter(item => item.category === activeFilter);

    return { counts, filteredList: filtered };
  }, [history, activeFilter]);

  if (loading) {
    return (
      <div className={styles.historyPage}>
        <h1 className={styles.pageTitle}>Watch History</h1>
        <div className={styles.loadingGrid}>
          {[...Array(8)].map((_, i) => <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>)}
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={styles.historyPage}>
        <div className={styles.emptyState}>
          <Clock size={64} strokeWidth={1} />
          <h2>Sign in to see history</h2>
          <Link to="/login" className={styles.browseBtn}>Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.historyPage}>
      <h1 className={styles.pageTitle}>Watch History</h1>
      <p className={styles.subtitle}>{history.length} titles in your journey</p>

      {/* Stats Dashboard */}
      {history.length > 0 && (
        <div className={styles.statsDashboard}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(229, 9, 20, 0.1)' }}><Film size={20} color="#e50914" /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{history.filter(h => h.movie_type === 'movie').length}</span>
              <span className={styles.statLabel}>Movies</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.1)' }}><Tv size={20} color="#0071eb" /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{history.filter(h => h.movie_type !== 'movie').length}</span>
              <span className={styles.statLabel}>Shows</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.1)' }}><BarChart3 size={20} color="#2ecc71" /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{history.length}</span>
              <span className={styles.statLabel}>Total</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {history.length > 0 && (
        <div className={styles.filterBar}>
          <Filter size={16} className={styles.filterIcon} />
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`${styles.filterBtn} ${activeFilter === opt.key ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveFilter(opt.key)}
            >
              {opt.label}
              {processedData.counts[opt.key] > 0 && <span className={styles.filterCount}>{processedData.counts[opt.key]}</span>}
            </button>
          ))}
        </div>
      )}

      {history.length === 0 ? (
        <div className={styles.emptyState}>
          <Clock size={64} strokeWidth={1} />
          <h2>Your history is empty</h2>
          <p>Movies and shows you watch will appear here.</p>
          <Link to="/" className={styles.browseBtn}>Start Watching</Link>
        </div>
      ) : processedData.filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <Calendar size={48} strokeWidth={1} />
          <h2>No results for {FILTER_OPTIONS.find(f => f.key === activeFilter)?.label}</h2>
          <p>Try a different filter above.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {processedData.filteredList.map((item) => (
            <div key={`${item.movie_id}-${item.movie_type}-${item.season || 0}-${item.episode || 0}`} className={styles.card}>
              <div className={styles.cardLinkContainer}>
                <Link to={`/movie/${item.movie_id}?type=${item.movie_type}`} className={styles.cardLink}>
                  <img src={item.poster} alt={item.title} className={styles.cardImage} referrerPolicy="no-referrer" />
                  
                  <div className={styles.dateBadge} data-title={item.detailedTime}>
                    <Clock size={11} />
                    <span>{item.label}</span>
                  </div>

                  <div className={styles.cardOverlay}>
                    <span className={styles.cardTitle}>{item.title}</span>
                    <span className={styles.cardMeta}>
                      {item.year} · {item.movie_type === 'movie' ? 'Movie' : 'TV Show'}
                      {item.season && ` · S${item.season}E${item.episode}`}
                    </span>
                  </div>
                  <div className={styles.watchedIndicator}></div>
                  <div className={styles.playOverlay}><Play size={32} fill="white" /></div>
                </Link>
                
                {/* Action Buttons */}
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => handleGetLink(item)} title="Get Download Link">
                    <ExternalLink size={16} />
                  </button>
                  <button className={styles.actionBtn} onClick={() => handleRemove(item.movie_id, item.movie_type)} title="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchHistory;
