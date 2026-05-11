import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Clock, Play, Film, Tv, BarChart3, Calendar, Filter, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './WatchHistory.module.css';
import SEO from '../components/SEO';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'watching', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'older', label: 'Older' },
];

const HistoryCard = ({ item, handleGetLink, handleRemove, handleMarkComplete }) => {
  const handleImageError = (e) => {
    const currentSrc = e.target.src;
    if (currentSrc.includes('image.tmdb.org')) {
      e.target.src = currentSrc.replace('image.tmdb.org', 'www.themoviedb.org');
    } else {
      e.target.src = 'https://picsum.photos/id/10/300/450'; 
    }
  };

  const progressPercent = item.duration ? Math.min(100, Math.max(0, (item.progress / item.duration) * 100)) : 0;
  const playUrl = `/movie/${item.movie_id}?type=${item.movie_type}&play=true${item.season ? `&s=${item.season}&e=${item.episode}` : ''}`;

  return (
    <div className={styles.card}>
      <div className={styles.cardLinkContainer}>
        <Link to={playUrl} className={styles.cardLink}>
          <img src={item.poster} alt={item.title} className={styles.cardImage} referrerPolicy="no-referrer" onError={handleImageError} />
          
          <div className={styles.dateBadge} data-title={item.detailedTime}>
            <Clock size={11} />
            <span>{item.label}</span>
          </div>

          {item.isDone && (
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: '#2ecc71', color: 'white', padding: '2px 8px',
              borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
              zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}>COMPLETED</div>
          )}

          <div className={styles.cardOverlay}>
            <span className={styles.cardTitle}>{item.title}</span>
            <span className={styles.cardMeta} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {item.year} · {item.movie_type === 'movie' ? 'Movie' : 'TV Show'}
                {item.season && ` · S${item.season}E${item.episode}`}
              </span>
              {progressPercent > 0 && <span style={{ color: '#e50914', fontSize: '10px', fontWeight: 'bold' }}>{Math.round(progressPercent)}%</span>}
            </span>
          </div>

          {progressPercent > 0 && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(0,0,0,0.5)', zIndex: 5 }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: '#e50914', transition: 'width 0.3s ease' }}></div>
            </div>
          )}

          <div className={styles.watchedIndicator}></div>
          <div className={styles.playOverlay}><Play size={32} fill="white" /></div>
        </Link>
        
        <div className={styles.cardActions}>
          {!item.isDone && (
            <button className={`${styles.actionBtn} ${styles.completeBtn}`} onClick={() => handleMarkComplete(item.movie_id, item.movie_type)} title="Mark as Completed">
              <Check size={16} />
            </button>
          )}
          <button className={styles.actionBtn} onClick={() => handleGetLink(item)} title="Get Download Link">
            <ExternalLink size={16} />
          </button>
          <button className={styles.actionBtn} onClick={() => handleRemove(item.movie_id, item.movie_type)} title="Remove">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const WatchHistory = () => {
  const { isLoggedIn, token, refreshStreak } = useAuth();
  const { showToast } = useToast();
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
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/watch-history`, {
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
      await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/watch-history/${movieId}?type=${movieType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(prev => prev.filter(f => !(f.movie_id === movieId && f.movie_type === movieType)));
      // Refresh global stats
      refreshStreak();
      showToast('Item removed from history', 'info');
    } catch (err) {
      console.error('Failed to remove:', err);
      showToast('Failed to remove item', 'error');
    }
  };

  const handleMarkComplete = async (movieId, movieType) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/watch-history/${movieId}/complete?type=${movieType}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Update local state to reflect change immediately
        setHistory(prev => prev.map(h => 
          (h.movie_id === movieId && h.movie_type === movieType) 
          ? { ...h, progress: h.duration || 3600, duration: h.duration || 3600, is_completed: true } 
          : h
        ));
        // Refresh global stats
        refreshStreak();
        showToast('Marked as completed!', 'success');
      }
    } catch (err) {
      console.error('Failed to mark complete:', err);
      showToast('Failed to mark as completed', 'error');
    }
  };

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

  const handleGetLink = async (item) => {
    try {
      const res = await fetch(`${API_BASE}/downloads/movie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

    const counts = { all: 0, watching: 0, completed: 0, today: 0, yesterday: 0, week: 0, month: 0, older: 0 };
    
    const items = history.map(item => {
      const date = parseDate(item.last_watched);
      const dStr = date.toDateString();
      const isDone = item.is_completed || (item.duration > 0 && item.progress >= (item.duration * 0.9));
      
      let category = 'older';
      if (dStr === todayStr) { category = 'today'; counts.today++; }
      else if (dStr === yestStr) { category = 'yesterday'; counts.yesterday++; }
      else if (now - date < 7 * 86400000) { category = 'week'; counts.week++; }
      else if (now - date < 30 * 86400000) { category = 'month'; counts.month++; }
      else { counts.older++; }

      if (isDone) counts.completed++;
      else counts.watching++;
      counts.all++;

      return {
        ...item,
        isDone,
        category,
        label: dStr === todayStr ? 'Today' : dStr === yestStr ? 'Yesterday' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        detailedTime: date.toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      };
    });

    const filtered = activeFilter === 'all' 
      ? items 
      : activeFilter === 'completed'
      ? items.filter(i => i.isDone)
      : activeFilter === 'watching'
      ? items.filter(i => !i.isDone)
      : items.filter(item => item.category === activeFilter);

    // Final deduplication for safety
    const seen = new Set();
    const deduped = filtered.filter(item => {
      const key = `${item.movie_id}-${item.movie_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { counts, filteredList: deduped };
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
      <SEO 
        title="Watch History - AuraWatch"
        description="View your watch history on AuraWatch."
      />
      <h1 className={styles.pageTitle}>Watch History</h1>
      <p className={styles.subtitle}>{history.filter(h => h.duration > 0 && h.progress >= (h.duration * 0.9)).length} titles completed in your journey</p>

      {/* Stats Dashboard */}
      {history.length > 0 && (
        <div className={styles.statsDashboard}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(229, 9, 20, 0.1)' }}><Film size={20} color="#e50914" /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{history.filter(h => h.movie_type === 'movie' && h.duration > 0 && h.progress >= (h.duration * 0.9)).length}</span>
              <span className={styles.statLabel}>Movies Done</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.1)' }}><Tv size={20} color="#0071eb" /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{history.filter(h => h.movie_type !== 'movie' && h.duration > 0 && h.progress >= (h.duration * 0.9)).length}</span>
              <span className={styles.statLabel}>Shows Done</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.1)' }}><BarChart3 size={20} color="#2ecc71" /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{history.filter(h => h.duration > 0 && h.progress >= (h.duration * 0.9)).length}</span>
              <span className={styles.statLabel}>Completed</span>
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
        <div className={styles.gridContainer}>
          {activeFilter === 'completed' ? (
            <>
              {/* Movies Group */}
              {processedData.filteredList.filter(i => i.movie_type === 'movie').length > 0 && (
                <div className={styles.groupSection}>
                  <h2 className={styles.groupTitle}><Film size={20} /> Movies Completed</h2>
                  <div className={styles.grid}>
                    {processedData.filteredList.filter(i => i.movie_type === 'movie').map((item) => (
                      <HistoryCard key={`${item.movie_id}-${item.movie_type}`} item={item} handleGetLink={handleGetLink} handleRemove={handleRemove} handleMarkComplete={handleMarkComplete} />
                    ))}
                  </div>
                </div>
              )}

              {/* Series Group */}
              {processedData.filteredList.filter(i => i.movie_type !== 'movie').length > 0 && (
                <div className={styles.groupSection} style={{ marginTop: '40px' }}>
                  <h2 className={styles.groupTitle}><Tv size={20} /> Shows Completed</h2>
                  <div className={styles.grid}>
                    {processedData.filteredList.filter(i => i.movie_type !== 'movie').map((item) => (
                      <HistoryCard key={`${item.movie_id}-${item.movie_type}`} item={item} handleGetLink={handleGetLink} handleRemove={handleRemove} handleMarkComplete={handleMarkComplete} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.grid}>
              {processedData.filteredList.map((item) => (
                <HistoryCard key={`${item.movie_id}-${item.movie_type}`} item={item} handleGetLink={handleGetLink} handleRemove={handleRemove} handleMarkComplete={handleMarkComplete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchHistory;
