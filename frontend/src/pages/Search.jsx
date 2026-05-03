import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import styles from './Search.module.css';
import homeStyles from './Home.module.css';
import FilterBar from '../components/layout/FilterBar';

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'Movie',
    genre: 'all',
    lang: 'all'
  });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const visitorId = localStorage.getItem('trackingVisitorId') || '';
        
        let endpoint = '';
        if (query.trim()) {
          // If keyword exists, use search
          endpoint = `${API_BASE}/movies/search?query=${query}&visitorId=${visitorId}`;
        } else {
          // If no keyword, use discover with filters
          endpoint = `${API_BASE}/movies/discover?type=${filters.type}&genre=${filters.genre}&lang=${filters.lang}`;
        }

        const res = await fetch(endpoint);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error searching:", error);
        setResults([]);
      }
      setLoading(false);
    };

    fetchResults();
  }, [query, filters]);

  return (
    <div className={styles.searchPage}>
      <div className={styles.searchHeader}>
        <FilterBar onFilterChange={(newFilters) => setFilters(newFilters)} />
        
        {query ? (
          <h1 className={styles.searchTitle}>
            Results for <span className={styles.query}>"{query}"</span>
          </h1>
        ) : (
          <h1 className={styles.searchTitle}>
            Exploring <span className={styles.query}>{filters.type === 'Movie' ? 'Movies' : 'TV Series'}</span>
          </h1>
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
