import { useState, useEffect } from 'react';

export const useButtonWarnings = () => {
  const [warnings, setWarnings] = useState({});

  useEffect(() => {
    const fetchWarnings = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? 
            `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 
            'https://aurawatch-1.onrender.com/api');
            
        const response = await fetch(`${baseUrl}/settings/button_warnings`);
        if (response.ok) {
          const data = await response.json();
          if (data.value) {
            setWarnings(data.value);
          }
        }
      } catch (error) {
        console.error('Failed to fetch button warnings:', error);
      }
    };

    fetchWarnings();
  }, []);

  return warnings;
};
