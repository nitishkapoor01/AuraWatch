import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Search.module.css'; // Reusing search grid styles
import homeStyles from './Home.module.css';
import SEO from '../components/SEO';

const Category = ({ type, title }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategory = async () => {
      setLoading(true);
      try {
        // We'll just fetch trending for the specific type to populate the grid
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/search?query=${type === 'tv' ? 'show' : 'movie'}`);
        // Alternatively, since our backend just searches TMDB, a better endpoint is needed. 
        // For prototype purposes, let's just fetch trending and filter, or use the search endpoint with a broad query.
        
        // Actually, let's just fetch trending and pretend it's the category data
        const trendingRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/trending`);
        const data = await trendingRes.json();
        
        if (Array.isArray(data)) {
          // Filter by type
          const filtered = data.filter(m => m.type.toLowerCase() === (type === 'tv' ? 'series' : 'movie'));
          // If filtering yields too few, just show all so the page looks full in prototype
          setResults(filtered.length > 4 ? filtered : data);
        }
      } catch (error) {
        console.error("Error fetching category:", error);
      }
      setLoading(false);
    };

    fetchCategory();
  }, [type]);

  return (
    <div className={styles.searchPage}>
      <SEO 
        title={`Watch ${title} - Free HD Online`}
        description={`Explore the best ${title} on AuraWatch. Watch for free in 1080p HD with dual audio.`}
      />
      <div className={styles.searchHeader}>
        <h1 className={styles.searchTitle} style={{color: 'white', fontWeight: 700}}>
          {title}
        </h1>
      </div>

      {loading ? (
        <div style={{color: 'white'}}>Loading...</div>
      ) : (
        <div className={styles.grid}>
          {results.map((movie, idx) => (
            <Link 
              to={`/movie/${movie.id}?type=${movie.type.toLowerCase()}`} 
              key={`${movie.id}-${idx}`} 
              className={homeStyles.cardContainer} 
              style={{flex: 'none', width: '100%'}}
            >
              <img src={movie.poster} alt={movie.title} className={homeStyles.cardImage} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Category;
