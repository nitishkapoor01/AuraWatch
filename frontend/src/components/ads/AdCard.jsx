import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './AdCard.module.css';

const DEFAULT_CONFIG = {
  enabled: true,
  format: 'native',
  container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
  key: 'ccd684eb4f620dcc7303d2fce2577bae',
  script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
  width: 300,
  height: 250
};

const AdCard = () => {
  const { user } = useAuth();
  const [adConfig, setAdConfig] = useState(DEFAULT_CONFIG);
  const [scale, setScale] = useState(0.6);
  const cardRef = useRef(null);
  const impressionLoggedRef = useRef(false);

  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

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

  // Compute responsive scale factor to fit 300px ad inside card width
  useEffect(() => {
    if (!cardRef.current) return;

    const updateScale = () => {
      if (cardRef.current) {
        const cardWidth = cardRef.current.offsetWidth;
        if (cardWidth > 0) {
          // Keep a small margin
          const newScale = Math.min(1, Math.max(0.45, (cardWidth - 10) / 300));
          setScale(newScale);
        }
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [adConfig]);

  const logImpression = async () => {
    if (impressionLoggedRef.current) return;
    impressionLoggedRef.current = true;

    try {
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const sessionId = sessionStorage.getItem('trackingSessionId') || '';
      const deviceType = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 
        (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

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

  // Strictly hide ads from all administrators
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
    <div ref={cardRef} className={styles.adCard}>
      <span className={styles.badge}>Ad</span>
      <div className={styles.frameWrapper}>
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          width: '300px',
          height: '250px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <iframe
            title="In-Feed Ad"
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

export default AdCard;
