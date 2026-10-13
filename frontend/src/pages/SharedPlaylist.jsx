import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Film, User, FolderHeart, Sparkles } from 'lucide-react';
import styles from './MyList.module.css';
import SEO from '../components/SEO';

const SharedPlaylist = () => {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  useEffect(() => {
    const fetchSharedPlaylist = async () => {
      try {
        const res = await fetch(`${baseUrl}/playlists/public/${id}`);
        const data = await res.json();

        if (res.ok) {
          setPlaylist(data.playlist);
          setItems(data.items || []);
        } else {
          setError(data.message || 'Playlist not found or is private.');
        }
      } catch (err) {
        console.error('Failed to fetch shared playlist:', err);
        setError('Something went wrong. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedPlaylist();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.myListPage}>
        <h1 className={styles.pageTitle}>Shared Playlist</h1>
        <div className={styles.loadingGrid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className={styles.myListPage}>
        <div className={styles.emptyState}>
          <Film size={64} strokeWidth={1} />
          <h2>Playlist Unavailable</h2>
          <p>{error || 'This playlist is private or does not exist.'}</p>
          <Link to="/" className={styles.browseBtn}>Go Back Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.myListPage}>
      <SEO 
        title={`${playlist.name} - Curated by ${playlist.owner_name} | AuraWatch`}
        description={`Check out "${playlist.name}" curated by ${playlist.owner_name} on AuraWatch. Watch movies and TV shows online.`}
      />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>{playlist.name}</h1>
          <p className={styles.subtitle}>
            {items.length} title{items.length !== 1 ? 's' : ''} in collection
            {playlist.description ? ` · ${playlist.description}` : ''}
          </p>
        </div>
        <div className={styles.sharedBadge}>
          <User size={18} />
          <span>Curated by {playlist.owner_name}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <Film size={64} strokeWidth={1} />
          <h2>This playlist is empty</h2>
          <p>{playlist.owner_name} hasn't added any titles to this playlist yet.</p>
          <Link to="/" className={styles.browseBtn}>Browse AuraWatch</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
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
      )}
    </div>
  );
};

export default SharedPlaylist;
