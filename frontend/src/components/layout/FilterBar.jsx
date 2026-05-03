import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, ChevronDown, Check } from 'lucide-react';
import styles from './FilterBar.module.css';

const GENRES = [
  { id: 'all', name: 'All Moods' },
  { id: '28', name: 'Action' },
  { id: '35', name: 'Comedy' },
  { id: '27', name: 'Horror' },
  { id: '10749', name: 'Romance' },
  { id: '878', name: 'Sci-Fi' },
  { id: '53', name: 'Thriller' },
  { id: '16', name: 'Animation' },
];

const INDUSTRIES = [
  { id: 'all', name: 'All Industries' },
  { id: 'hollywood', name: 'Hollywood (English)' },
  { id: 'bollywood', name: 'Bollywood (Hindi)' },
  { id: 'south', name: 'South Indian' },
  { id: 'anime', name: 'Anime' },
];

const TYPES = [
  { id: 'Movie', name: 'Movies' },
  { id: 'Series', name: 'TV Series' },
];

const FilterBar = ({ onFilterChange }) => {
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    type: searchParams.get('type') || 'Movie',
    genre: searchParams.get('genre') || 'all',
    lang: searchParams.get('lang') || 'all'
  });

  // Keep filters in sync if URL changes externally
  useEffect(() => {
    setActiveFilters({
      type: searchParams.get('type') || 'Movie',
      genre: searchParams.get('genre') || 'all',
      lang: searchParams.get('lang') || 'all'
    });
  }, [searchParams]);

  const handleSelect = (key, val) => {
    const newFilters = { ...activeFilters, [key]: val };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className={styles.filterWrapper}>
      <button 
        className={`${styles.filterToggle} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Filter Movies & Series"
      >
        <Filter size={18} />
      </button>

      {isOpen && (
        <div className={styles.filterMenu}>
          <div className={styles.filterSection}>
            <label>Content Type</label>
            <div className={styles.chipGroup}>
              {TYPES.map(t => (
                <button 
                  key={t.id} 
                  className={`${styles.chip} ${activeFilters.type === t.id ? styles.chipActive : ''}`}
                  onClick={() => handleSelect('type', t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <label>Mood / Genre</label>
            <div className={styles.chipGroup}>
              {GENRES.map(g => (
                <button 
                  key={g.id} 
                  className={`${styles.chip} ${activeFilters.genre === g.id ? styles.chipActive : ''}`}
                  onClick={() => handleSelect('genre', g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <label>Industry</label>
            <div className={styles.chipGroup}>
              {INDUSTRIES.map(i => (
                <button 
                  key={i.id} 
                  className={`${styles.chip} ${activeFilters.lang === i.id ? styles.chipActive : ''}`}
                  onClick={() => handleSelect('lang', i.id)}
                >
                  {i.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
