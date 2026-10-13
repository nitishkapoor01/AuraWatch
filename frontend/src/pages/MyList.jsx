import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Film, Heart, BookmarkPlus, Sparkles, Share2, Plus, Edit2, Globe, Lock, Bookmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './MyList.module.css';
import SEO from '../components/SEO';

const MyList = () => {
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('watchlist'); // 'watchlist' or playlist id
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [currentPlaylistItems, setCurrentPlaylistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Dialog States
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dialogName, setDialogName] = useState('');
  const [dialogIsPublic, setDialogIsPublic] = useState(true);
  const [dialogLoading, setDialogLoading] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    fetchInitialData();
  }, [isLoggedIn]);

  // When active tab changes to a custom playlist, fetch its items
  useEffect(() => {
    if (activeTab === 'watchlist' || !token) return;

    const fetchPlaylistData = async () => {
      setItemsLoading(true);
      try {
        const res = await fetch(`${baseUrl}/playlists/${activeTab}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentPlaylistItems(data.items || []);
        } else {
          showToast('Failed to load playlist items.', 'error');
        }
      } catch (err) {
        console.error('Fetch playlist items error:', err);
      } finally {
        setItemsLoading(false);
      }
    };

    fetchPlaylistData();
  }, [activeTab, token]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [favRes, plRes] = await Promise.all([
        fetch(`${baseUrl}/favorites`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${baseUrl}/playlists`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (favRes.ok) {
        const favData = await favRes.json();
        setFavorites(Array.isArray(favData) ? favData : []);
      }
      if (plRes.ok) {
        const plData = await plRes.json();
        setPlaylists(Array.isArray(plData) ? plData : []);
      }
    } catch (err) {
      console.error('Failed to fetch collections data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Remove item from Watchlist
  const handleRemoveFavorite = async (movieId, movieType) => {
    try {
      await fetch(`${baseUrl}/favorites/${movieId}?type=${movieType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(prev => prev.filter(f => !(f.movie_id === movieId && f.movie_type === movieType)));
      showToast('Removed from Watchlist.', 'info');
    } catch (err) {
      console.error('Failed to remove:', err);
      showToast('Failed to remove item.', 'error');
    }
  };

  // Remove item from Custom Playlist
  const handleRemovePlaylistItem = async (movieId, movieType) => {
    try {
      await fetch(`${baseUrl}/playlists/${activeTab}/items/${movieId}?type=${movieType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      setCurrentPlaylistItems(prev => prev.filter(f => !(f.movie_id === movieId && f.movie_type === movieType)));
      setPlaylists(prev =>
        prev.map(p => (p.id === activeTab ? { ...p, item_count: Math.max(0, (p.item_count || 1) - 1) } : p))
      );
      showToast('Removed from playlist.', 'info');
    } catch (err) {
      console.error('Failed to remove from playlist:', err);
      showToast('Failed to remove item.', 'error');
    }
  };

  // Share Watchlist
  const handleShareWatchlist = () => {
    if (!user?.id) return;
    const shareUrl = `${window.location.origin}/shared-list/${user.id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        showToast('Watchlist link copied to clipboard!', 'info');
      })
      .catch(() => {
        showToast('Failed to copy link. Please try again.', 'warning');
      });
  };

  // Share Custom Playlist
  const handleSharePlaylist = (playlist) => {
    if (!playlist?.id) return;
    if (!playlist.is_public) {
      showToast('This playlist is private. Make it public to share.', 'warning');
      return;
    }
    const shareUrl = `${window.location.origin}/shared-playlist/${playlist.id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        showToast(`Share link for "${playlist.name}" copied!`, 'info');
      })
      .catch(() => {
        showToast('Failed to copy link.', 'warning');
      });
  };

  // Create Playlist
  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    const name = dialogName.trim();
    if (!name) return;

    setDialogLoading(true);
    try {
      const res = await fetch(`${baseUrl}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          isPublic: dialogIsPublic
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to create playlist.', 'error');
        return;
      }

      setPlaylists(prev => [data.playlist, ...prev]);
      setActiveTab(data.playlist.id);
      setCurrentPlaylistItems([]);
      setShowCreateDialog(false);
      setDialogName('');
      showToast(`Created playlist "${name}"!`, 'success');
    } catch (err) {
      console.error('Create playlist error:', err);
      showToast('Error creating playlist.', 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  // Rename Playlist
  const handleRenamePlaylist = async (e) => {
    e.preventDefault();
    const name = dialogName.trim();
    if (!name) return;

    setDialogLoading(true);
    try {
      const res = await fetch(`${baseUrl}/playlists/${activeTab}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to rename playlist.', 'error');
        return;
      }

      setPlaylists(prev => prev.map(p => (p.id === activeTab ? { ...p, name: data.playlist.name } : p)));
      setShowRenameDialog(false);
      setDialogName('');
      showToast('Playlist renamed successfully!', 'success');
    } catch (err) {
      console.error('Rename playlist error:', err);
      showToast('Failed to rename playlist.', 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  // Delete Playlist
  const handleDeletePlaylist = async () => {
    setDialogLoading(true);
    try {
      const res = await fetch(`${baseUrl}/playlists/${activeTab}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        showToast('Failed to delete playlist.', 'error');
        return;
      }

      setPlaylists(prev => prev.filter(p => p.id !== activeTab));
      setActiveTab('watchlist');
      setShowDeleteDialog(false);
      showToast('Playlist deleted.', 'info');
    } catch (err) {
      console.error('Delete playlist error:', err);
      showToast('Error deleting playlist.', 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  // Show exciting promo screen for non-logged-in users
  if (!isLoggedIn) {
    return (
      <div className={styles.myListPage}>
        <div className={styles.promoScreen}>
          <div className={styles.promoGlow}></div>
          <div className={styles.promoContent}>
            <Heart size={56} color="#e50914" strokeWidth={1.5} />
            <h1 className={styles.promoTitle}>Your Personal Watchlist & Playlists</h1>
            <p className={styles.promoDesc}>
              Save movies and shows you love. Build custom playlists for binge nights, anime marathons, and watchlists with friends.
            </p>

            <div className={styles.promoFeatures}>
              <div className={styles.promoFeature}>
                <BookmarkPlus size={28} color="#e50914" />
                <div>
                  <h3>Custom Playlists</h3>
                  <p>Organize by mood, genre, or watch partners</p>
                </div>
              </div>
              <div className={styles.promoFeature}>
                <Film size={28} color="#0071eb" />
                <div>
                  <h3>Zero Clutter</h3>
                  <p>Keep your favorite titles cleanly categorized</p>
                </div>
              </div>
              <div className={styles.promoFeature}>
                <Sparkles size={28} color="#e5b909" />
                <div>
                  <h3>Shareable Collections</h3>
                  <p>Share your curated playlists with friends anywhere</p>
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

  if (loading) {
    return (
      <div className={styles.myListPage}>
        <h1 className={styles.pageTitle}>My Collections</h1>
        <div className={styles.loadingGrid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>
          ))}
        </div>
      </div>
    );
  }

  const currentCustomPlaylist = playlists.find(p => p.id === activeTab);
  const activeItems = activeTab === 'watchlist' ? favorites : currentPlaylistItems;
  const currentTitle = activeTab === 'watchlist' ? 'Watchlist' : (currentCustomPlaylist?.name || 'Playlist');

  return (
    <div className={styles.myListPage}>
      <SEO 
        title="My Playlists & Watchlist - AuraWatch"
        description="Organize your favorite movies and TV shows into custom playlists and watchlists on AuraWatch."
      />

      {/* Playlist Selector Tabs */}
      <div className={styles.playlistTabs}>
        <button
          className={`${styles.tabPill} ${activeTab === 'watchlist' ? styles.tabPillActive : ''}`}
          onClick={() => setActiveTab('watchlist')}
        >
          <Bookmark size={15} />
          <span>Watchlist</span>
          <span className={styles.tabBadge}>{favorites.length}</span>
        </button>

        {playlists.map(pl => (
          <button
            key={pl.id}
            className={`${styles.tabPill} ${activeTab === pl.id ? styles.tabPillActive : ''}`}
            onClick={() => setActiveTab(pl.id)}
          >
            {pl.is_public ? <Globe size={13} opacity={0.7} /> : <Lock size={13} opacity={0.7} />}
            <span>{pl.name}</span>
            <span className={styles.tabBadge}>{pl.item_count || 0}</span>
          </button>
        ))}

        <button
          className={styles.addPlaylistPill}
          onClick={() => {
            setDialogName('');
            setDialogIsPublic(true);
            setShowCreateDialog(true);
          }}
        >
          <Plus size={16} />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Active Collection Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>{currentTitle}</h1>
          <p className={styles.subtitle}>
            {activeItems.length} title{activeItems.length !== 1 ? 's' : ''} saved
            {activeTab !== 'watchlist' && currentCustomPlaylist && (
              <span> · {currentCustomPlaylist.is_public ? 'Public' : 'Private'}</span>
            )}
          </p>
        </div>

        <div className={styles.actionGroup}>
          {activeTab === 'watchlist' ? (
            favorites.length > 0 && (
              <button className={styles.shareBtn} onClick={handleShareWatchlist} title="Share Watchlist">
                <Share2 size={18} />
                <span>Share Watchlist</span>
              </button>
            )
          ) : (
            currentCustomPlaylist && (
              <>
                <button
                  className={styles.actionBtnSecondary}
                  onClick={() => {
                    setDialogName(currentCustomPlaylist.name);
                    setShowRenameDialog(true);
                  }}
                  title="Rename Playlist"
                >
                  <Edit2 size={16} />
                  <span>Rename</span>
                </button>

                {currentCustomPlaylist.is_public && (
                  <button
                    className={styles.actionBtnSecondary}
                    onClick={() => handleSharePlaylist(currentCustomPlaylist)}
                    title="Share Playlist"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                )}

                <button
                  className={styles.actionBtnDanger}
                  onClick={() => setShowDeleteDialog(true)}
                  title="Delete Playlist"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Items Grid */}
      {itemsLoading ? (
        <div className={styles.loadingGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>
          ))}
        </div>
      ) : activeItems.length === 0 ? (
        <div className={styles.emptyState}>
          <Film size={64} strokeWidth={1} />
          <h2>This collection is empty</h2>
          <p>
            {activeTab === 'watchlist' 
              ? 'Movies and shows you add to your watchlist will appear here.'
              : `Add movies to "${currentTitle}" from any movie detail page.`
            }
          </p>
          <Link to="/" className={styles.browseBtn}>Browse Content</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {activeItems.map((item) => (
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTab === 'watchlist') {
                    handleRemoveFavorite(item.movie_id, item.movie_type);
                  } else {
                    handleRemovePlaylistItem(item.movie_id, item.movie_type);
                  }
                }}
                title="Remove from this playlist"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Playlist Dialog Modal */}
      {showCreateDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowCreateDialog(false)}>
          <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Create New Playlist</h3>
            <p className={styles.dialogDesc}>Give your playlist a name to start grouping your favorite titles.</p>
            <form onSubmit={handleCreatePlaylist}>
              <input
                type="text"
                autoFocus
                placeholder="Playlist name (e.g. Anime Favorites)"
                maxLength={60}
                value={dialogName}
                onChange={e => setDialogName(e.target.value)}
                className={styles.dialogInput}
              />
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#ccc' }}>
                  <input
                    type="checkbox"
                    checked={dialogIsPublic}
                    onChange={e => setDialogIsPublic(e.target.checked)}
                  />
                  <span>Public playlist (share link with anyone)</span>
                </label>
              </div>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.actionBtnSecondary}
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!dialogName.trim() || dialogLoading}
                  className={styles.shareBtn}
                  style={{ background: '#e50914', borderColor: '#e50914' }}
                >
                  {dialogLoading ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Playlist Dialog Modal */}
      {showRenameDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowRenameDialog(false)}>
          <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Rename Playlist</h3>
            <p className={styles.dialogDesc}>Enter the new name for this playlist.</p>
            <form onSubmit={handleRenamePlaylist}>
              <input
                type="text"
                autoFocus
                placeholder="Playlist name"
                maxLength={60}
                value={dialogName}
                onChange={e => setDialogName(e.target.value)}
                className={styles.dialogInput}
              />
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.actionBtnSecondary}
                  onClick={() => setShowRenameDialog(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!dialogName.trim() || dialogLoading}
                  className={styles.shareBtn}
                  style={{ background: '#e50914', borderColor: '#e50914' }}
                >
                  {dialogLoading ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Playlist Confirmation Dialog */}
      {showDeleteDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowDeleteDialog(false)}>
          <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Delete "{currentTitle}"?</h3>
            <p className={styles.dialogDesc}>
              Are you sure you want to delete this playlist? This action cannot be undone. Titles in this playlist will not be removed from your Watchlist.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.actionBtnSecondary}
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={dialogLoading}
                onClick={handleDeletePlaylist}
                className={styles.actionBtnDanger}
                style={{ background: '#e50914', color: '#fff', borderColor: '#e50914' }}
              >
                {dialogLoading ? 'Deleting...' : 'Delete Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyList;
