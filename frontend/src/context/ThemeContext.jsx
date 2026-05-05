import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const defaultPreferences = {
  // === APPEARANCE ===
  theme: 'classic',
  accentColor: '#e50914',
  blurIntensity: 10,
  transparency: 0.8,
  backgroundEffect: 'none',       // 'none' | 'particles' | 'gradient-mesh' | 'grain'
  glowEffects: false,

  // === LAYOUT & STRUCTURE ===
  layout: 'cinematic',            // 'cinematic' | 'grid' | 'minimal'
  heroSize: 'full',               // 'full' | 'half' | 'compact' | 'hidden'
  contentWidth: 'full',           // 'full' | 'contained' | 'narrow'
  navStyle: 'transparent',        // 'transparent' | 'solid' | 'glass' | 'hidden'
  sidebarPosition: 'left',        // 'left' | 'hidden'
  rowStyle: 'scroll',             // 'scroll' | 'wrap'

  // === CARDS ===
  cardStyle: 'poster',            // 'poster' | 'backdrop' | 'minimal' | 'rounded'
  cardSize: 'large',             // 'small' | 'medium' | 'large' | 'xlarge'
  cardHoverEffect: 'scale',       // 'scale' | 'glow' | 'lift' | 'flip' | 'none'

  // === TYPOGRAPHY ===
  fontFamily: "'Inter', sans-serif",
  headingFont: "'Inter', sans-serif",
  fontSize: 16,
  fontWeight: 'normal',
  lineHeight: 1.6,
  letterSpacing: 0,

  // === BUTTONS & CHROME ===
  buttonStyle: 'filled',          // 'filled' | 'outline' | 'ghost' | 'pill' | 'sharp'
  scrollbarStyle: 'thin',         // 'thin' | 'hidden' | 'default'

  // === ADVANCED ===
  density: 'comfortable',
  borderRadius: 12,
  shadowIntensity: 0.5,
  animations: true,
};

export const ThemeProvider = ({ children }) => {
  const { isLoggedIn, user, token } = useAuth();
  const [preferences, setPreferences] = useState(defaultPreferences);

  // Load preferences on mount or user change
  useEffect(() => {
    const loadPreferences = async () => {
      if (isLoggedIn && user) {
        // Try to use user.ui_preferences if they exist, otherwise fallback
        const userPrefs = user.ui_preferences && Object.keys(user.ui_preferences).length > 0 
          ? user.ui_preferences 
          : null;
        
        if (userPrefs) {
          setPreferences({ ...defaultPreferences, ...userPrefs });
        } else {
          // If no DB preferences, try to load local ones and save them
          const localPrefs = localStorage.getItem('aura_ui_prefs');
          if (localPrefs) {
            const parsed = JSON.parse(localPrefs);
            setPreferences({ ...defaultPreferences, ...parsed });
            // Upload to DB
            syncToDatabase({ ...defaultPreferences, ...parsed });
          }
        }
      } else {
        // Guest mode - load from localStorage
        const localPrefs = localStorage.getItem('aura_ui_prefs');
        if (localPrefs) {
          setPreferences({ ...defaultPreferences, ...JSON.parse(localPrefs) });
        }
      }
    };
    loadPreferences();
  }, [isLoggedIn, user]);

  // Apply preferences to DOM
  useEffect(() => {
    const root = document.documentElement;
    
    // === CSS Variables ===
    root.style.setProperty('--primary-color', preferences.accentColor);
    root.style.setProperty('--bg-blur', `${preferences.blurIntensity}px`);
    root.style.setProperty('--panel-bg-alpha', preferences.transparency);
    root.style.setProperty('--font-family-base', preferences.fontFamily);
    root.style.setProperty('--heading-font', preferences.headingFont);
    root.style.setProperty('--font-size-base', `${preferences.fontSize}px`);
    root.style.setProperty('--font-weight-base', preferences.fontWeight);
    root.style.setProperty('--border-radius-base', `${preferences.borderRadius}px`);
    root.style.setProperty('--shadow-intensity', preferences.shadowIntensity);
    root.style.setProperty('--line-height-base', preferences.lineHeight);
    root.style.setProperty('--letter-spacing-base', `${preferences.letterSpacing}px`);
    
    // Density scaling
    const paddingMap = { compact: '8px 12px', comfortable: '16px 24px' };
    root.style.setProperty('--density-padding', paddingMap[preferences.density] || paddingMap.comfortable);

    // Card size mapping
    const cardSizeMap = { small: '110px', medium: '150px', large: '190px', xlarge: '230px' };
    root.style.setProperty('--card-width', cardSizeMap[preferences.cardSize] || '150px');

    // === Body Classes ===
    // Collect all dynamic classes
    const classes = [
      `layout-${preferences.layout}`,
      `theme-${preferences.theme}`,
      preferences.animations ? 'animations-on' : 'animations-off',
      `hero-${preferences.heroSize}`,
      `cards-${preferences.cardStyle}`,
      `cards-${preferences.cardSize}`,
      `hover-${preferences.cardHoverEffect}`,
      `nav-${preferences.navStyle}`,
      `sidebar-${preferences.sidebarPosition}`,
      `btn-${preferences.buttonStyle}`,
      `rows-${preferences.rowStyle}`,
      `width-${preferences.contentWidth}`,
      `scrollbar-${preferences.scrollbarStyle}`,
      preferences.backgroundEffect !== 'none' ? `bg-${preferences.backgroundEffect}` : '',
      preferences.glowEffects ? 'glow-on' : '',
    ].filter(Boolean);

    document.body.className = classes.join(' ');
    
  }, [preferences]);

  const syncToDatabase = async (newPrefs) => {
    if (!isLoggedIn || !token) return;
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
      await fetch(`${baseUrl}/auth/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newPrefs)
      });
    } catch (e) {
      console.error('Failed to sync UI preferences to DB', e);
    }
  };

  const updatePreferences = (newSettings) => {
    const updated = { ...preferences, ...newSettings };
    setPreferences(updated);

    if (isLoggedIn) {
      syncToDatabase(updated);
    } else {
      localStorage.setItem('aura_ui_prefs', JSON.stringify(updated));
    }
  };

  return (
    <ThemeContext.Provider value={{ preferences, updatePreferences, defaultPreferences }}>
      {children}
    </ThemeContext.Provider>
  );
};
