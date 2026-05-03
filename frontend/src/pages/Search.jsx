import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import styles from './Search.module.css';
import homeStyles from './Home.module.css'; // Reuse card styles

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const visitorId = localStorage.getItem('trackingVisitorId') || '';
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/search?query=${query}&visitorId=${visitorId}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error searching:", error);
        setResults([]);
      }
      setLoading(false);
    };

    if (query) {
      fetchResults();
    } else {
      setResults([]);
      setLoading(false);
    }
  }, [query]);

  return (
    <div className={styles.searchPage}>
      <div className={styles.searchHeader}>
        {query ? (
          <h1 className={styles.searchTitle}>
            Results for <span className={styles.query}>"{query}"</span>
          </h1>
        ) : (
          <h1 className={styles.searchTitle}>Type in the top bar to search</h1>
        )}
      </div>

      {loading ? (
        <div style={{color: 'white'}}>Searching...</div>
      ) : results.length > 0 ? (
        <div className={styles.grid}>
          {results.map((movie, idx) => (
            <Link to={`/movie/${movie.id}?type=${movie.type.toLowerCase()}`} key={`${movie.id}-${idx}`} className={homeStyles.cardContainer} style={{flex: 'none', width: '100%'}}>
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
