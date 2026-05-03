import React, { useState, useEffect, useRef } from 'react';
import { Search, LogOut, User } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProfileModal from '../profile/ProfileModal';
import FilterBar from './FilterBar';
import styles from './TopNav.module.css';

const AVATARS = [
  { id: 'red', color: '#e50914' },
  { id: 'blue', color: '#0071eb' },
  { id: 'green', color: '#0f7b0f' },
  { id: 'yellow', color: '#e5b909' },
  { id: 'purple', color: '#8e24aa' },
  { id: 'pink', color: '#e91e63' },
  { id: 'orange', color: '#f57c00' },
  { id: 'teal', color: '#009688' },
];

const TopNav = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout, loading } = useAuth();

  useEffect(() => {
    if (location.pathname === '/') {
      setQuery('');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (query.trim().length > 1) {
      const fetchSearch = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/search?query=${query}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setSuggestions(data.slice(0, 5));
          } else {
            setSuggestions([]);
          }
        } catch (error) {
          console.error("Error fetching search results:", error);
        }
      };
      
      const timerId = setTimeout(() => {
        fetchSearch();
      }, 300);
      
      return () => clearTimeout(timerId);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      setIsFocused(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleFilterChange = (filters) => {
    // If we change filters, go to search page with those filters
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    params.append('type', filters.type);
    params.append('genre', filters.genre);
    params.append('lang', filters.lang);
    navigate(`/search?${params.toString()}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { state: { message: 'Logged out successfully!' } });
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <header className={styles.topNav}>
      {!isLoginPage && (
        <Link to="/" className={styles.branding} style={{ textDecoration: 'none' }}>
          <img src="/AuraMovie_logo.png.png" alt="Logo" className={styles.brandLogo} />
          <span className={styles.brandName}>
            Aura<span className={styles.watchText}>Watch</span>
          </span>
        </Link>
      )}

      <div className={styles.navActions}>
        <div className={styles.searchContainer}>
          <div className={styles.filterInline}>
            <FilterBar onFilterChange={handleFilterChange} />
          </div>

          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search movies, shows..." 
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={handleKeyDown}
          />
          
          {isFocused && suggestions.length > 0 && (
            <div className={styles.suggestionsContainer}>
              {suggestions.map(item => (
                <Link 
                  to={`/movie/${item.id}?type=${item.type.toLowerCase()}`}
                  key={item.id} 
                  className={styles.suggestionItem}
                >
                  <img src={item.poster} alt={item.title} className={styles.suggestionImage} />
                  <div className={styles.suggestionInfo}>
                    <span className={styles.suggestionTitle}>{item.title}</span>
                    <span className={styles.suggestionMeta}>
                      {item.year} • {item.type} • ★ {item.rating}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className={styles.userProfile}>
          {!loading && (
            isLoggedIn ? (
              <div className={styles.profileSection}>
              <div className={styles.profileDropdownContainer} ref={dropdownRef}>
                {user?.avatar?.startsWith('http') ? (
                  <img 
                    src={user.avatar} 
                    alt="Profile" 
                    className={styles.avatarCircle} 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div 
                    className={styles.avatarCircle} 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    style={{
                      backgroundColor: AVATARS.find(a => a.id === user?.avatar)?.color || '#e50914'
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                
                {isDropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    <button className={styles.dropdownItem} onClick={() => { setIsProfileModalOpen(true); setIsDropdownOpen(false); }}>
                      <User size={16} /> Edit Profile
                    </button>
                    <button className={styles.dropdownItem} onClick={() => { handleLogout(); setIsDropdownOpen(false); }}>
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <Link to="/login" className={styles.loginBtn}>
                <User size={20} />
                <span>Login</span>
              </Link>
            )
          )}
        </div>
      </div>

      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </header>
  );
};

export default TopNav;
