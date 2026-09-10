import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './AdBanner.module.css';

const DEFAULT_CONFIGS = {
  download_modal: {
    enabled: true,
    format: 'native',
    container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
    width: 300,
    height: 250,
    key: 'ccd684eb4f620dcc7303d2fce2577bae',
    script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js'
  },
  movie_detail: {
    enabled: true,
    format: 'native',
    container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
    width: 728,
    height: 180,
    key: 'ccd684eb4f620dcc7303d2fce2577bae',
    script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js'
  }
};

const AdBanner = ({ slot = 'download_modal', customConfig = null }) => {
  const { user } = useAuth();
  const [adConfig, setAdConfig] = useState(customConfig || DEFAULT_CONFIGS[slot]);
  const [skipAds, setSkipAds] = useState(false);
  const impressionLoggedRef = useRef(false);

  // Check if admin bypass applies
  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);

  useEffect(() => {
    let isMounted = true;
    const fetchAdConfig = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
        
        const res = await fetch(`${baseUrl}/ads/config`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.skipAdsTimer && slot === 'download_modal') {
            setSkipAds(true);
          }
          if (data.config) {
            if (!data.config.enabled) {
              setAdConfig(null); // All ads disabled globally
            } else if (data.config[slot]) {
              setAdConfig(data.config[slot]);
            }
          }
        }
      } catch (e) {
        // Fallback to default config on network error
      }
    };

    if (!customConfig) {
      fetchAdConfig();
    }
    return () => { isMounted = false; };
  }, [slot, customConfig]);

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
          slot,
          visitorId,
          sessionId,
          deviceType
        })
      });
    } catch (_) {
      // Non-blocking
    }
  };

  // Strictly hide ads from all administrators
  if (isAdmin || skipAds || !adConfig || !adConfig.enabled) {
    return null;
  }

  // Adjust dimensions for mobile responsiveness if leaderboard
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isLeaderboard = adConfig.width === 728;
  const renderWidth = (isMobile && isLeaderboard) ? 300 : adConfig.width;
  const renderHeight = (isMobile && isLeaderboard) ? 250 : adConfig.height;
  const renderKey = (isMobile && isLeaderboard) ? '8e9991a7d4aa3fef2ca28a617f3c1844' : adConfig.key;

  const isNative = adConfig.format === 'native' || !!adConfig.container_id;
  const containerId = adConfig.container_id || 'container-ccd684eb4f620dcc7303d2fce2577bae';
  const scriptSrc = (adConfig.script_url || '').startsWith('//') 
    ? `https:${adConfig.script_url}` 
    : (adConfig.script_url || 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js');

  // Build clean HTML doc for iframe isolation
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
            width: ${renderWidth}px; 
            height: ${renderHeight}px; 
          }
        </style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '${renderKey}',
            'format' : 'iframe',
            'height' : ${renderHeight},
            'width' : ${renderWidth},
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="${scriptSrc}"></script>
      </body>
    </html>
  `;

  return (
    <div 
      className={`${styles.adContainer} ${slot === 'download_modal' ? styles.downloadModalAd : styles.movieDetailAd}`}
      style={{ width: `${renderWidth}px` }}
    >
      <div className={styles.adBadge}>Sponsored</div>
      <iframe
        title={`Ad-${slot}`}
        srcDoc={iframeDoc}
        width={renderWidth}
        height={renderHeight}
        className={styles.adFrame}
        scrolling="no"
        frameBorder="0"
        onLoad={logImpression}
      />
    </div>
  );
};

export default AdBanner;
