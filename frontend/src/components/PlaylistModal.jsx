import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Globe, Lock, Bookmark, FolderPlus, Loader2, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './PlaylistModal.module.css';

const PlaylistModal = ({ isOpen, onClose, movie, onFavoriteChange }) => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create new playlist form state
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creatingLoading, setCreatingLoading] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  useEffect(() => {
    if (!isOpen || !movie?.id || !token) return;

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const type = movie.type === 'tv' || movie.type === 'series' ? 'tv' : 'movie';

        // 1. Check default Watchlist (favorites)
        const favPromise = fetch(`${baseUrl}/favorites/check/${movie.id}?type=${type}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json());

        // 2. Check Custom Playlists
        const plPromise = fetch(`${baseUrl}/playlists/check/${movie.id}?type=${type}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json());

        const [favData, plData] = await Promise.all([favPromise, plPromise]);

        if (isMounted) {
          setIsInWatchlist(Boolean(favData?.isFavorite));
          setPlaylists(Array.isArray(plData?.playlists) ? plData.playlists : []);
        }
      } catch (err) {
        console.error('Failed to load playlists:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, movie?.id, token]);

  if (!isOpen || !movie) return null;

  const movieType = movie.type === 'tv' || movie.type === 'series' ? 'tv' : 'movie';

  // Toggle Default Watchlist (favorites)
  const handleToggleWatchlist = async () => {
    const nextState = !isInWatchlist;
    setIsInWatchlist(nextState); // optimistic

    try {
      if (nextState) {
        await fetch(`${baseUrl}/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            movieId: movie.id,
            movieType,
            title: movie.title,
            poster: movie.poster,
            backdrop: movie.backdrop,
            overview: movie.overview,
            rating: movie.rating,
            year: movie.year
          })
        });
        showToast('Added to Watchlist!', 'success');
      } else {
        await fetch(`${baseUrl}/favorites/${movie.id}?type=${movieType}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        showToast('Removed from Watchlist.', 'info');
      }

      if (onFavoriteChange) onFavoriteChange(nextState);
    } catch (err) {
      console.error('Watchlist toggle error:', err);
      setIsInWatchlist(!nextState); // rollback
      showToast('Action failed. Try again.', 'error');
    }
  };

  // Toggle Custom Playlist item
  const handleTogglePlaylist = async (pl) => {
    const nextInPlaylist = !pl.is_in_playlist;

    // Optimistic update
    setPlaylists(prev =>
      prev.map(p => {
        if (p.id === pl.id) {
          return {
            ...p,
            is_in_playlist: nextInPlaylist,
            item_count: nextInPlaylist ? (p.item_count || 0) + 1 : Math.max(0, (p.item_count || 1) - 1)
          };
        }
        return p;
      })
    );

    try {
      if (nextInPlaylist) {
        const res = await fetch(`${baseUrl}/playlists/${pl.id}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            movieId: movie.id,
            movieType,
            title: movie.title,
            poster: movie.poster,
            backdrop: movie.backdrop,
            overview: movie.overview,
            rating: movie.rating,
            year: movie.year
          })
        });
        if (!res.ok) throw new Error('Failed to add item');
        showToast(`Added to "${pl.name}"`, 'success');
      } else {
        const res = await fetch(`${baseUrl}/playlists/${pl.id}/items/${movie.id}?type=${movieType}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to remove item');
        showToast(`Removed from "${pl.name}"`, 'info');
      }
    } catch (err) {
      console.error('Playlist item toggle error:', err);
      // Rollback
      setPlaylists(prev =>
        prev.map(p => p.id === pl.id ? { ...p, is_in_playlist: !nextInPlaylist } : p)
      );
      showToast('Action failed. Please try again.', 'error');
    }
  };

  // Create new playlist & add movie directly
  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;

    setCreatingLoading(true);
    try {
      const createRes = await fetch(`${baseUrl}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          isPublic
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        showToast(createData.message || 'Failed to create playlist.', 'error');
        setCreatingLoading(false);
        return;
      }

      const newPl = createData.playlist;

      // Add movie to the new playlist right away
      await fetch(`${baseUrl}/playlists/${newPl.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          movieId: movie.id,
          movieType,
          title: movie.title,
          poster: movie.poster,
          backdrop: movie.backdrop,
          overview: movie.overview,
          rating: movie.rating,
          year: movie.year
        })
      });

      showToast(`Created "${name}" & added movie!`, 'success');

      // Update state
      setPlaylists(prev => [
        {
          ...newPl,
          is_in_playlist: true,
          item_count: 1
        },
        ...prev
      ]);

      setNewPlaylistName('');
      setIsCreating(false);
    } catch (err) {
      console.error('Create playlist error:', err);
      showToast('Failed to create playlist. Try again.', 'error');
    } finally {
      setCreatingLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <FolderPlus size={20} color="#e50914" />
            <h2 className={styles.title}>Save to Playlist</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Movie Mini Preview */}
        <div className={styles.movieMini}>
          <img 
            src={movie.poster} 
            alt={movie.title} 
            className={styles.miniPoster} 
            referrerPolicy="no-referrer"
            onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
          />
          <div className={styles.miniInfo}>
            <h3 className={styles.miniTitle}>{movie.title}</h3>
            <p className={styles.miniMeta}>{movie.year} · {movieType.toUpperCase()}</p>
          </div>
        </div>

        {/* Search Playlists Bar (shows if user has playlists or is searching) */}
        {playlists.length > 2 && (
          <div className={styles.searchBarWrapper}>
            <div className={styles.searchContainer}>
              <Search size={15} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                placeholder="Search playlists..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button 
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Playlists List */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingPlaceholder}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <p>Loading playlists...</p>
            </div>
          ) : (
            <>
              {/* Default Watchlist (always visible) */}
              <div 
                className={`${styles.playlistItem} ${isInWatchlist ? styles.playlistItemActive : ''}`}
                onClick={handleToggleWatchlist}
              >
                <div className={styles.playlistLeft}>
                  <div className={`${styles.checkboxBox} ${isInWatchlist ? styles.checkboxChecked : ''}`}>
                    {isInWatchlist && <Check size={14} strokeWidth={3} />}
                  </div>
                  <Bookmark size={16} color="#e50914" />
                  <span className={styles.playlistName}>Watchlist (Default)</span>
                </div>
                <div className={styles.playlistRight}>
                  <Globe size={14} title="Shareable" />
                </div>
              </div>

              {/* Filtered Custom Playlists */}
              {playlists
                .filter(pl => pl.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
                .map((pl) => (
                  <div 
                    key={pl.id} 
                    className={`${styles.playlistItem} ${pl.is_in_playlist ? styles.playlistItemActive : ''}`}
                    onClick={() => handleTogglePlaylist(pl)}
                  >
                    <div className={styles.playlistLeft}>
                      <div className={`${styles.checkboxBox} ${pl.is_in_playlist ? styles.checkboxChecked : ''}`}>
                        {pl.is_in_playlist && <Check size={14} strokeWidth={3} />}
                      </div>
                      <span className={styles.playlistName}>{pl.name}</span>
                      <span className={styles.playlistCount}>({pl.item_count || 0})</span>
                    </div>
                    <div className={styles.playlistRight}>
                      {pl.is_public ? (
                        <Globe size={14} title="Public Playlist" />
                      ) : (
                        <Lock size={14} title="Private Playlist" />
                      )}
                    </div>
                  </div>
                ))}

              {/* No match state */}
              {playlists.length > 0 && 
                playlists.filter(pl => pl.name.toLowerCase().includes(searchQuery.toLowerCase().trim())).length === 0 && (
                <div className={styles.noMatch}>
                  <p>No playlist named "{searchQuery}"</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPlaylistName(searchQuery.trim());
                      setIsCreating(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e50914',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '13px',
                      marginTop: '6px'
                    }}
                  >
                    + Create "{searchQuery.trim()}"
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: Create New Playlist */}
        <div className={styles.footer}>
          {!isCreating ? (
            <button 
              className={styles.createNewTrigger}
              onClick={() => setIsCreating(true)}
            >
              <Plus size={18} />
              <span>Create New Playlist</span>
            </button>
          ) : (
            <form onSubmit={handleCreatePlaylist} className={styles.newPlaylistForm}>
              <input
                type="text"
                autoFocus
                placeholder="Playlist name (e.g. Anime Favorites)"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                maxLength={60}
                className={styles.nameInput}
              />
              <div className={styles.formControls}>
                <label className={styles.privacyToggle}>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <span>Public (share link)</span>
                </label>
                <div className={styles.btnGroup}>
                  <button 
                    type="button" 
                    className={styles.cancelBtn} 
                    onClick={() => { setIsCreating(false); setNewPlaylistName(''); }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={!newPlaylistName.trim() || creatingLoading}
                    className={styles.createBtn}
                  >
                    {creatingLoading ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                    Create & Save
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistModal;
