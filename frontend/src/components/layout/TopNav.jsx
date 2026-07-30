import React, { useState, useEffect, useRef } from 'react';
import { Search, LogOut, User, HelpCircle, Lock, Settings, Dices, Film, Tv, Sparkles, Clock, Heart, Trash2, X } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ProfileModal from '../profile/ProfileModal';
import HelpModal from '../profile/HelpModal';
import LoginPromptModal from '../profile/LoginPromptModal';
import CustomizeModal from '../profile/CustomizeModal';
import FilterBar from './FilterBar';
import styles from './TopNav.module.css';
import { useButtonWarnings } from '../../hooks/useButtonWarnings';
import { AlertTriangle } from 'lucide-react';

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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSurprisePicker, setShowSurprisePicker] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const surpriseRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchContainerRef = useRef(null);
  const buttonWarnings = useButtonWarnings();
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close surprise picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (surpriseRef.current && !surpriseRef.current.contains(e.target)) {
        setShowSurprisePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile search on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsMobileSearchOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, token, user, logout, loading, streak } = useAuth();
  const { showToast } = useToast();

  const [recentSearches, setRecentSearches] = useState([]);
  const [likedSearches, setLikedSearches] = useState([]);

  const fetchHistory = async () => {
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');
      
      const recentRes = await fetch(`${API_BASE}/movies/recent-searches?visitorId=${visitorId}`, { headers });
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setRecentSearches(recentData);
      }

      const likedRes = await fetch(`${API_BASE}/movies/liked-searches?visitorId=${visitorId}`, { headers });
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        setLikedSearches(likedData);
      }
    } catch (err) {
      console.error('Failed to fetch TopNav search history:', err);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchHistory();
    }
  }, [isFocused, isLoggedIn, token]);

  const handleLikeSearch = async (e, q, isAlreadyLiked) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      
      const endpoint = `${API_BASE}/movies/like-search`;
      const method = isAlreadyLiked ? 'DELETE' : 'POST';
      await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({ query: q, visitorId })
      });
      fetchHistory();
    } catch (err) {
      console.error('Failed to toggle like in TopNav:', err);
    }
  };

  const handleDeleteRecentSearch = async (e, q) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      
      await fetch(`${API_BASE}/movies/recent-searches`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ query: q, visitorId })
      });
      fetchHistory();
    } catch (err) {
      console.error('Failed to delete history in TopNav:', err);
    }
  };

  useEffect(() => {
    if (location.pathname === '/') {
      setQuery('');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (query.trim().length > 1) {
      const fetchSearch = async () => {
        try {
          const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');
          const res = await fetch(`${API_BASE}/movies/suggestions?query=${encodeURIComponent(query)}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setSuggestions(data.slice(0, 6));
          } else {
            setSuggestions([]);
          }
        } catch (error) {
          console.error("Error fetching suggestions:", error);
        }
      };
      
      const timerId = setTimeout(() => {
        fetchSearch();
      }, 200); // 200ms debounce — pehle se thoda fast
      
      return () => clearTimeout(timerId);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      setIsFocused(false);
      setSuggestions([]);
      setIsMobileSearchOpen(false);
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
    showToast('Logging out securely...', 'info');
    setTimeout(() => {
      logout();
      navigate('/');
      setTimeout(() => showToast('Logged out successfully', 'success'), 100);
    }, 600);
  };

  const isLoginPage = location.pathname === '/login';

  const handleSurpriseMe = async (category) => {
    setShowSurprisePicker(false);
    const labels = { movie: '🎬 Movie', tv: '📺 Series', anime: '✨ Anime' };
    showToast(`Finding a random ${labels[category]} for you...`, 'info');
    try {
      const base = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const randomPage = Math.floor(Math.random() * 5) + 1;
      let url;
      if (category === 'movie') {
        url = `${base}/movies/discover?type=movie&page=${randomPage}`;
      } else if (category === 'tv') {
        url = `${base}/movies/discover?type=tv&page=${randomPage}`;
      } else if (category === 'anime') {
        url = `${base}/movies/discover?type=tv&lang=anime&page=${randomPage}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        const pick = list[Math.floor(Math.random() * list.length)];
        const type = pick.type === 'Series' || pick.type === 'tv' ? 'tv' : 'movie';
        navigate(`/movie/${pick.id}?type=${type}`);
      } else {
        showToast('Could not find a title right now. Try again!', 'warning');
      }
    } catch (err) {
      console.error('Surprise Me error:', err);
      showToast('Something went wrong. Try again!', 'warning');
    }
  };

  const handleRestrictedAction = (action) => {
    setIsDropdownOpen(false);
    if (!isLoggedIn) {
      setIsLoginPromptOpen(true);
    } else if (action) {
      action();
    }
  };

  return (
    <header className={`${styles.topNav} topNav ${isMobileSearchOpen ? styles.searchActive : ''}`}>
      {!isLoginPage && (
        <Link to="/" className={styles.branding} style={{ textDecoration: 'none' }}>
          <img src="/AuraMovie_logo.png.png" alt="Logo" className={styles.brandLogo} />
          <span className={styles.brandName}>
            Aura<span className={styles.watchText}>Watch</span>
          </span>
        </Link>
      )}

      <div className={styles.navActions}>
        <div className={styles.searchContainer} ref={searchContainerRef}>
          <div className={styles.filterInline}>
            <FilterBar onFilterChange={handleFilterChange} />
          </div>
          
          <div className={styles.surpriseWrapper} ref={surpriseRef}>
            <button
              className={styles.surpriseBtn}
              onClick={() => setShowSurprisePicker(p => !p)}
              title="Surprise Me!"
            >
              <Dices size={18} />
            </button>

            {showSurprisePicker && (
              <div className={styles.surprisePicker}>
                <p className={styles.surprisePickerTitle}>What are you in the mood for?</p>
                <div className={styles.surpriseOptions}>
                  <button className={styles.surpriseOption} onClick={() => handleSurpriseMe('movie')}>
                    <Film size={22} />
                    <span>Movie</span>
                  </button>
                  <button className={styles.surpriseOption} onClick={() => handleSurpriseMe('tv')}>
                    <Tv size={22} />
                    <span>Series</span>
                  </button>
                  <button className={styles.surpriseOption} onClick={() => handleSurpriseMe('anime')}>
                    <Sparkles size={22} />
                    <span>Anime</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`${styles.searchBox} ${isMobileSearchOpen ? styles.expanded : ''}`}>
            <button 
              className={styles.mobileSearchBtn} 
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            >
              <Search size={18} />
            </button>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search movies, shows..." 
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { setIsFocused(true); setIsMobileSearchOpen(true); }}
              onBlur={() => setTimeout(() => setIsFocused(false), 400)}
              onKeyDown={handleKeyDown}
            />
          </div>
          
          {isFocused && suggestions.length > 0 && (
            <div className={styles.suggestionsContainer}>
              {suggestions.map(item => (
                <div 
                  key={item.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => {
                    navigate(`/movie/${item.id}?type=${item.type.toLowerCase()}`);
                    setIsFocused(false);
                    setIsMobileSearchOpen(false);
                    setQuery('');
                  }}
                  className={styles.suggestionItem}
                >
                  <img src={item.poster} alt={item.title} className={styles.suggestionImage} />
                  <div className={styles.suggestionInfo}>
                    <span className={styles.suggestionTitle}>{item.title}</span>
                    <span className={styles.suggestionMeta}>
                      {item.year} • {item.type} • ★ {item.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {isFocused && !query.trim() && (recentSearches.length > 0 || likedSearches.length > 0) && (
            <div className={styles.suggestionsContainer}>
              {likedSearches.length > 0 && (
                <div className={styles.dropdownSection}>
                  <div className={styles.dropdownSectionHeader}>
                    <Heart size={11} fill="#e50914" color="#e50914" />
                    <span>Liked Searches</span>
                  </div>
                  {likedSearches.slice(0, 5).map((item, idx) => (
                    <div
                      key={`liked-${idx}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.preventDefault()}
                      onClick={() => {
                        setIsFocused(false);
                        setIsMobileSearchOpen(false);
                        setQuery('');
                        if (isAiSearch) {
                          navigate(`/search?q=${encodeURIComponent(item.query)}&ai=1`);
                        } else {
                          navigate(`/search?q=${encodeURIComponent(item.query)}`);
                        }
                      }}
                      className={styles.dropdownHistoryItem}
                    >
                      <Clock size={12} className={styles.itemIcon} />
                      <span className={styles.historyText}>{item.query}</span>
                      <button
                        className={`${styles.dropdownActionBtn} ${styles.liked}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => handleLikeSearch(e, item.query, true)}
                      >
                        <Heart size={11} fill="#e50914" color="#e50914" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {recentSearches.length > 0 && (
                <div className={styles.dropdownSection}>
                  <div className={styles.dropdownSectionHeader}>
                    <Clock size={11} />
                    <span>Recent Searches</span>
                  </div>
                  {recentSearches.slice(0, 5).map((item, idx) => (
                    <div
                      key={`recent-${idx}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.preventDefault()}
                      onClick={() => {
                        setIsFocused(false);
                        setIsMobileSearchOpen(false);
                        setQuery('');
                        if (isAiSearch) {
                          navigate(`/search?q=${encodeURIComponent(item.query)}&ai=1`);
                        } else {
                          navigate(`/search?q=${encodeURIComponent(item.query)}`);
                        }
                      }}
                      className={styles.dropdownHistoryItem}
                    >
                      <Clock size={12} className={styles.itemIcon} />
                      <span className={styles.historyText}>{item.query}</span>
                      <div className={styles.dropdownItemActions}>
                        <button
                          className={`${styles.dropdownActionBtn} ${item.is_liked ? styles.liked : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => handleLikeSearch(e, item.query, item.is_liked)}
                        >
                          <Heart size={11} fill={item.is_liked ? '#e50914' : 'none'} color={item.is_liked ? '#e50914' : '#aaa'} />
                        </button>
                        <button
                          className={styles.dropdownActionBtn}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => handleDeleteRecentSearch(e, item.query)}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.userProfile}>
          {!loading && (
            <div className={styles.profileSection}>
              <div className={styles.profileDropdownContainer} ref={dropdownRef}>
                {isLoggedIn && user?.avatar?.startsWith('http') ? (
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
                      backgroundColor: isLoggedIn ? (AVATARS.find(a => a.id === user?.avatar)?.color || '#e50914') : '#333'
                    }}
                  >
                    {isLoggedIn ? (user?.name?.charAt(0).toUpperCase() || 'U') : <User size={20} color="#ccc" />}
                  </div>
                )}
                
                {isDropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    {/* Streak Badge — logged in */}
                    {isLoggedIn && streak.currentStreak > 0 && (
                      <div style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'linear-gradient(90deg, rgba(229,9,20,0.1), transparent)'
                      }}>
                        <span style={{ fontSize: '22px' }}>🔥</span>
                        <div>
                          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                            {streak.currentStreak} Day Streak!
                          </div>
                          <div style={{ color: '#aaa', fontSize: '11px' }}>
                            Best: {streak.longestStreak} days · {streak.totalDays} total days watched
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Streak Teaser — guests */}
                    {!isLoggedIn && (
                      <div
                        onClick={() => { navigate('/login'); setIsDropdownOpen(false); }}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'linear-gradient(90deg, rgba(229,9,20,0.08), transparent)',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <span style={{ fontSize: '22px' }}>🔥</span>
                        <div>
                          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
                            Start Your Streak!
                          </div>
                          <div style={{ color: '#e50914', fontSize: '11px', fontWeight: '600' }}>
                            Login to track daily watching →
                          </div>
                        </div>
                      </div>
                    )}
                    <button className={styles.dropdownItem} onClick={() => handleRestrictedAction(() => setIsProfileModalOpen(true))}>
                      <User size={16} /> Edit Profile
                      {!isLoggedIn && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                    </button>
                    <button 
                      className={styles.dropdownItem} 
                      onClick={(e) => { 
                        if (buttonWarnings.customize_ui) {
                          const hasBypass = user?.role === 'admin' || user?.role === 'moderator';
                          if (!hasBypass) {
                            e.preventDefault();
                            showToast(buttonWarnings.customize_ui, 'warning');
                            return;
                          } else {
                            showToast(`${user.role === 'admin' ? 'Admin' : 'Moderator'} Notice: ${buttonWarnings.customize_ui}`, 'info');
                          }
                        }
                        setIsCustomizeOpen(true); setIsDropdownOpen(false); 
                      }}
                      title={buttonWarnings.customize_ui || ''}
                    >
                      <Settings size={16} /> Customize UI
                      {buttonWarnings.customize_ui && <AlertTriangle size={14} color="#f39c12" style={{ marginLeft: 'auto' }} />}
                    </button>
                    <button className={styles.dropdownItem} onClick={() => { setIsHelpModalOpen(true); setIsDropdownOpen(false); }}>
                      <HelpCircle size={16} /> Help & Support
                    </button>
                    
                    {isLoggedIn ? (
                      <button className={styles.dropdownItem} onClick={() => { handleLogout(); setIsDropdownOpen(false); }}>
                        <LogOut size={16} /> Log Out
                      </button>
                    ) : (
                      <button className={styles.dropdownItem} onClick={() => handleRestrictedAction(null)}>
                        <LogOut size={16} /> Log Out
                        <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
      
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
      />
      
      <LoginPromptModal
        isOpen={isLoginPromptOpen}
        onClose={() => setIsLoginPromptOpen(false)}
      />

      <CustomizeModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
      />
    </header>
  );
};

export default TopNav;
