import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Trash2, Film, Heart, BookmarkPlus, Sparkles, Share2, 
  Plus, Edit2, Globe, Lock, Bookmark, FolderHeart, 
  Search, X, ArrowLeft, FolderPlus 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './MyList.module.css';
import SEO from '../components/SEO';

const MyList = () => {
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Navigation & View State
  const [mainView, setMainView] = useState('watchlist'); // 'watchlist' | 'playlists'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null); // null = overview grid, or playlist ID
  const [playlistSearch, setPlaylistSearch] = useState('');

  // Data State
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

  // When selected playlist changes, fetch its items
  useEffect(() => {
    if (!selectedPlaylistId || !token) return;

    const fetchPlaylistData = async () => {
      setItemsLoading(true);
      try {
        const res = await fetch(`${baseUrl}/playlists/${selectedPlaylistId}`, {
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
  }, [selectedPlaylistId, token]);

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
      await fetch(`${baseUrl}/playlists/${selectedPlaylistId}/items/${movieId}?type=${movieType}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      setCurrentPlaylistItems(prev => prev.filter(f => !(f.movie_id === movieId && f.movie_type === movieType)));
      setPlaylists(prev =>
        prev.map(p => (p.id === selectedPlaylistId ? { ...p, item_count: Math.max(0, (p.item_count || 1) - 1) } : p))
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
        showToast('Watchlist share link copied!', 'info');
      })
      .catch(() => {
        showToast('Failed to copy link.', 'warning');
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
      setMainView('playlists');
      setSelectedPlaylistId(data.playlist.id);
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
      const res = await fetch(`${baseUrl}/playlists/${selectedPlaylistId}`, {
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

      setPlaylists(prev => prev.map(p => (p.id === selectedPlaylistId ? { ...p, name: data.playlist.name } : p)));
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
      const res = await fetch(`${baseUrl}/playlists/${selectedPlaylistId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        showToast('Failed to delete playlist.', 'error');
        return;
      }

      setPlaylists(prev => prev.filter(p => p.id !== selectedPlaylistId));
      setSelectedPlaylistId(null);
      setShowDeleteDialog(false);
      showToast('Playlist deleted.', 'info');
    } catch (err) {
      console.error('Delete playlist error:', err);
      showToast('Error deleting playlist.', 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  // Show promo screen for guests
  if (!isLoggedIn) {
    return (
      <div className={styles.myListPage}>
        <div className={styles.promoScreen}>
          <div className={styles.promoGlow}></div>
          <div className={styles.promoContent}>
            <Heart size={56} color="#e50914" strokeWidth={1.5} />
            <h1 className={styles.promoTitle}>Your Watchlist & Playlists</h1>
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

  const currentCustomPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const filteredPlaylists = playlists.filter(p => 
    p.name.toLowerCase().includes(playlistSearch.toLowerCase().trim())
  );

  return (
    <div className={styles.myListPage}>
      <SEO 
        title="My Playlists & Watchlist - AuraWatch"
        description="Organize your favorite movies and TV shows into custom playlists and watchlists on AuraWatch."
      />

      {/* Primary Navigation Tabs */}
      <div className={styles.mainNavTabs}>
        <button
          className={`${styles.mainTabBtn} ${mainView === 'watchlist' ? styles.mainTabBtnActive : ''}`}
          onClick={() => {
            setMainView('watchlist');
            setSelectedPlaylistId(null);
          }}
        >
          <Bookmark size={18} />
          <span>Watchlist</span>
          <span className={styles.tabBadge}>{favorites.length}</span>
        </button>

        <button
          className={`${styles.mainTabBtn} ${mainView === 'playlists' ? styles.mainTabBtnActive : ''}`}
          onClick={() => setMainView('playlists')}
        >
          <FolderHeart size={18} />
          <span>My Playlists</span>
          <span className={styles.tabBadge}>{playlists.length}</span>
        </button>
      </div>

      {/* VIEW 1: WATCHLIST */}
      {mainView === 'watchlist' && (
        <>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.pageTitle}>My Watchlist</h1>
              <p className={styles.subtitle}>{favorites.length} title{favorites.length !== 1 ? 's' : ''} saved</p>
            </div>
            {favorites.length > 0 && (
              <button className={styles.shareBtn} onClick={handleShareWatchlist} title="Share Watchlist">
                <Share2 size={18} />
                <span>Share Watchlist</span>
              </button>
            )}
          </div>

          {favorites.length === 0 ? (
            <div className={styles.emptyState}>
              <Film size={64} strokeWidth={1} />
              <h2>Your Watchlist is empty</h2>
              <p>Movies and shows you quick-save will appear here.</p>
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
                    onClick={() => handleRemoveFavorite(item.movie_id, item.movie_type)}
                    title="Remove from Watchlist"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: PLAYLISTS HUB (OVERVIEW GRID) */}
      {mainView === 'playlists' && selectedPlaylistId === null && (
        <>
          <div className={styles.playlistsControlBar}>
            <div className={styles.playlistSearchBox}>
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                placeholder={`Search across ${playlists.length} playlists...`}
                value={playlistSearch}
                onChange={e => setPlaylistSearch(e.target.value)}
                className={styles.playlistSearchInput}
              />
              {playlistSearch && (
                <button className={styles.clearSearch} onClick={() => setPlaylistSearch('')}>
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              className={styles.createPlaylistBtn}
              onClick={() => {
                setDialogName('');
                setDialogIsPublic(true);
                setShowCreateDialog(true);
              }}
            >
              <Plus size={18} />
              <span>Create Playlist</span>
            </button>
          </div>

          {playlists.length === 0 ? (
            <div className={styles.emptyState}>
              <FolderPlus size={64} strokeWidth={1} />
              <h2>No playlists yet</h2>
              <p>Create your first custom playlist to group your favorite movies and shows cleanly.</p>
              <button
                className={styles.browseBtn}
                onClick={() => {
                  setDialogName('');
                  setDialogIsPublic(true);
                  setShowCreateDialog(true);
                }}
              >
                + Create Your First Playlist
              </button>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className={styles.emptyState}>
              <Search size={48} strokeWidth={1.5} opacity={0.5} />
              <h2>No playlists found</h2>
              <p>No playlist matched "{playlistSearch}".</p>
              <button
                className={styles.browseBtn}
                onClick={() => {
                  setDialogName(playlistSearch.trim());
                  setShowCreateDialog(true);
                }}
              >
                + Create "{playlistSearch.trim()}"
              </button>
            </div>
          ) : (
            <div className={styles.playlistsGrid}>
              {filteredPlaylists.map((pl) => {
                const posters = Array.isArray(pl.preview_posters) ? pl.preview_posters.slice(0, 4) : [];
                return (
                  <div
                    key={pl.id}
                    className={styles.playlistCard}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                  >
                    {/* 2x2 Collage Cover */}
                    <div className={styles.coverCollage}>
                      {posters.length > 0 ? (
                        <>
                          {posters.map((posterUrl, idx) => (
                            <img
                              key={idx}
                              src={posterUrl}
                              alt=""
                              className={styles.coverImg}
                              referrerPolicy="no-referrer"
                              onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                            />
                          ))}
                          {/* Fill remaining slots if < 4 */}
                          {[...Array(Math.max(0, 4 - posters.length))].map((_, i) => (
                            <div key={`filler-${i}`} style={{ background: '#1c1c1c' }} />
                          ))}
                        </>
                      ) : (
                        <div className={styles.emptyCollage}>
                          <Film size={32} opacity={0.3} />
                          <span style={{ fontSize: '11px', fontWeight: '600' }}>Empty Playlist</span>
                        </div>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className={styles.cardBody}>
                      <div className={styles.cardTopRow}>
                        <h3 className={styles.playlistCardTitle}>{pl.name}</h3>
                        <span className={styles.privacyBadge}>
                          {pl.is_public ? <Globe size={11} /> : <Lock size={11} />}
                          <span>{pl.is_public ? 'Public' : 'Private'}</span>
                        </span>
                      </div>
                      <div className={styles.playlistCardMeta}>
                        <span>{pl.item_count || 0} title{pl.item_count !== 1 ? 's' : ''}</span>
                        <span>Click to view →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 3: INSIDE A SPECIFIC PLAYLIST */}
      {mainView === 'playlists' && selectedPlaylistId !== null && currentCustomPlaylist && (
        <>
          {/* Breadcrumb Navigation */}
          <div className={styles.breadcrumbBar}>
            <button
              className={styles.backBtn}
              onClick={() => setSelectedPlaylistId(null)}
            >
              <ArrowLeft size={16} />
              <span>Back to All Playlists</span>
            </button>
          </div>

          {/* Active Playlist Header */}
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.pageTitle}>{currentCustomPlaylist.name}</h1>
              <p className={styles.subtitle}>
                {currentPlaylistItems.length} title{currentPlaylistItems.length !== 1 ? 's' : ''} saved · {currentCustomPlaylist.is_public ? 'Public' : 'Private'}
              </p>
            </div>

            <div className={styles.actionGroup}>
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
            </div>
          </div>

          {/* Items Grid */}
          {itemsLoading ? (
            <div className={styles.loadingGrid}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>
              ))}
            </div>
          ) : currentPlaylistItems.length === 0 ? (
            <div className={styles.emptyState}>
              <Film size={64} strokeWidth={1} />
              <h2>This playlist is empty</h2>
              <p>Add movies and shows to "{currentCustomPlaylist.name}" from any movie detail page.</p>
              <Link to="/" className={styles.browseBtn}>Browse Content</Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {currentPlaylistItems.map((item) => (
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
                    onClick={() => handleRemovePlaylistItem(item.movie_id, item.movie_type)}
                    title="Remove from this playlist"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
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
      {showDeleteDialog && currentCustomPlaylist && (
        <div className={styles.dialogOverlay} onClick={() => setShowDeleteDialog(false)}>
          <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Delete "{currentCustomPlaylist.name}"?</h3>
            <p className={styles.dialogDesc}>
              Are you sure you want to delete this playlist? This action cannot be undone. Titles in this playlist will remain safe in your Watchlist.
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
