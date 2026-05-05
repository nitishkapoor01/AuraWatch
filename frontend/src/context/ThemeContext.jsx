import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const defaultPreferences = {
  theme: 'liquid-glass',
  accentColor: '#e50914',
  blurIntensity: 10,
  transparency: 0.8,
  layout: 'cinematic',
  fontFamily: "'Inter', sans-serif",
  fontSize: 16,
  fontWeight: 'normal',
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
    
    // Apply CSS Variables
    root.style.setProperty('--primary-color', preferences.accentColor);
    root.style.setProperty('--bg-blur', `${preferences.blurIntensity}px`);
    root.style.setProperty('--panel-bg-alpha', preferences.transparency);
    root.style.setProperty('--font-family-base', preferences.fontFamily);
    root.style.setProperty('--font-size-base', `${preferences.fontSize}px`);
    root.style.setProperty('--font-weight-base', preferences.fontWeight);
    root.style.setProperty('--border-radius-base', `${preferences.borderRadius}px`);
    root.style.setProperty('--shadow-intensity', preferences.shadowIntensity);
    
    // Density scaling
    const paddingMap = { compact: '8px 12px', comfortable: '16px 24px' };
    root.style.setProperty('--density-padding', paddingMap[preferences.density] || paddingMap.comfortable);

    // Apply layout classes to body
    document.body.className = `layout-${preferences.layout} theme-${preferences.theme} ${preferences.animations ? 'animations-on' : 'animations-off'}`;
    
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
