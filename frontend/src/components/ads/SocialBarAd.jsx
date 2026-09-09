import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

const SocialBarAd = () => {
  const { user } = useAuth();
  const scriptInjectedRef = useRef(false);

  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);

  useEffect(() => {
    if (isAdmin || scriptInjectedRef.current) return;

    let isMounted = true;
    const loadSocialBar = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

        const res = await fetch(`${baseUrl}/ads/config`);
        if (!res.ok || !isMounted) return;

        const data = await res.json();
        const config = data?.config;

        if (config?.enabled && config?.social_bar?.enabled && config?.social_bar?.script_url) {
          scriptInjectedRef.current = true;

          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.src = config.social_bar.script_url;
          script.async = true;

          script.onload = () => {
            // Log social_bar impression
            const visitorId = localStorage.getItem('trackingVisitorId') || '';
            const sessionId = sessionStorage.getItem('trackingSessionId') || '';
            const deviceType = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';

            fetch(`${baseUrl}/ads/impression`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slot: 'social_bar',
                visitorId,
                sessionId,
                deviceType
              })
            }).catch(() => {});
          };

          document.body.appendChild(script);
        }
      } catch (_) {
        // Non-blocking
      }
    };

    loadSocialBar();

    return () => { isMounted = false; };
  }, [isAdmin]);

  return null;
};

export default SocialBarAd;
