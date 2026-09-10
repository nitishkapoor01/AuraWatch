import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './SuggestionAd.module.css';

const SuggestionAd = () => {
  const { user } = useAuth();
  const [adConfig, setAdConfig] = useState({
    enabled: true,
    key: '8e9991a7d4aa3fef2ca28a617f3c1844',
    script_url: 'https://heavenlysuspicious.com/8e9991a7d4aa3fef2ca28a617f3c1844/invoke.js',
    width: 300,
    height: 250
  });
  const impressionLoggedRef = useRef(false);

  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');

        const res = await fetch(`${baseUrl}/ads/config`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.config) {
            if (!data.config.enabled) {
              setAdConfig(null);
            } else if (data.config.search_grid) {
              setAdConfig(data.config.search_grid);
            }
          }
        }
      } catch (_) {}
    };

    fetchConfig();
    return () => { isMounted = false; };
  }, []);

  const logImpression = async () => {
    if (impressionLoggedRef.current) return;
    impressionLoggedRef.current = true;

    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const sessionId = sessionStorage.getItem('trackingSessionId') || '';
      const deviceType = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 
        (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api');

      await fetch(`${baseUrl}/ads/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot: 'search_grid',
          visitorId,
          sessionId,
          deviceType
        })
      });
    } catch (_) {}
  };

  // Strictly hide from admins and when disabled
  if (isAdmin || !adConfig || !adConfig.enabled) {
    return null;
  }

  const isNative = adConfig.format === 'native' || !!adConfig.container_id;
  const containerId = adConfig.container_id || 'container-ccd684eb4f620dcc7303d2fce2577bae';
  const scriptSrc = (adConfig.script_url || '').startsWith('//') 
    ? `https:${adConfig.script_url}` 
    : (adConfig.script_url || 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js');

  const iframeDoc = isNative ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            background: transparent; 
            overflow: hidden; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            width: 100%; 
            height: 100%; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #${containerId} {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div id="${containerId}"></div>
        <script async="async" data-cfasync="false" src="${scriptSrc}"></script>
      </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            background: transparent; 
            overflow: hidden; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            width: 300px; 
            height: 250px; 
          }
        </style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '${adConfig.key || '8e9991a7d4aa3fef2ca28a617f3c1844'}',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="${scriptSrc}"></script>
      </body>
    </html>
  `;

  return (
    <div 
      className={styles.suggestionAdItem} 
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      <div className={styles.adMeta}>
        <span className={styles.adBadge}>Ad</span>
        <span className={styles.adLabel}>Sponsored Recommendation</span>
      </div>
      <div className={styles.frameContainer}>
        <div className={styles.scaler}>
          <iframe
            title="Search Suggestion Ad"
            srcDoc={iframeDoc}
            width="300"
            height="250"
            className={styles.adFrame}
            scrolling="no"
            frameBorder="0"
            onLoad={logImpression}
          />
        </div>
      </div>
    </div>
  );
};

export default SuggestionAd;
