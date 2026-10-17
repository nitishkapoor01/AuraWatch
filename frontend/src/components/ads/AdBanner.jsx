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
  },
  pre_roll: {
    enabled: true,
    format: 'native',
    container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
    width: 300,
    height: 250,
    key: 'ccd684eb4f620dcc7303d2fce2577bae',
    script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js'
  }
};

const AdBanner = ({ slot = 'download_modal', customConfig = null }) => {
  const { user } = useAuth();
  const [adConfig, setAdConfig] = useState(customConfig || DEFAULT_CONFIGS[slot]);
  const [skipAds, setSkipAds] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const impressionLoggedRef = useRef(false);
  const bannerIdRef = useRef(`ad-banner-${slot}-${Math.random().toString(36).substring(2, 9)}`);

  // Check if admin or VIP bypass applies
  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);
  const isAdExempt = isAdmin || Boolean(user?.is_premium);

  useEffect(() => {
    let isMounted = true;
    const fetchAdConfig = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
        
        const token = localStorage.getItem('aurawatch_token');
        const visitorId = localStorage.getItem('trackingVisitorId') || '';
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        if (visitorId) headers['x-visitor-id'] = visitorId;

        const res = await fetch(`${baseUrl}/ads/config?visitor_id=${encodeURIComponent(visitorId)}`, { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.is_premium || data.skipAdsTimer) {
            setSkipAds(true);
          }
          if (data.is_premium || (data.config && data.config.enabled === false)) {
            setAdConfig(null);
          } else if (data.config && data.config[slot]) {
            setAdConfig(data.config[slot]);
          }
        }
      } catch (e) {
        // Fallback to default config on network error
      }
    };

    if (!customConfig) {
      fetchAdConfig();
    }

    const onVipUnlocked = () => {
      if (isMounted) {
        setSkipAds(true);
        setAdConfig(null);
      }
    };
    window.addEventListener('aurawatch_vip_unlocked', onVipUnlocked);

    return () => { 
      isMounted = false; 
      window.removeEventListener('aurawatch_vip_unlocked', onVipUnlocked);
    };
  }, [slot, customConfig, user]);

  // Listen for iframe content detection
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'AURA_AD_FILLED' && event.data?.bannerId === bannerIdRef.current) {
        setIsLoaded(true);
        logImpression();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [slot]);

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

  // Strictly hide ads from all administrators and VIP members
  if (isAdExempt || skipAds || !adConfig || adConfig.enabled === false) {
    return null;
  }

  // Adjust dimensions for mobile responsiveness if leaderboard
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isLeaderboard = adConfig.width === 728;
  const renderWidth = (isMobile && isLeaderboard) ? 300 : (adConfig.width || 300);
  const renderHeight = (isMobile && isLeaderboard) ? 250 : (adConfig.height || 250);
  const renderKey = (isMobile && isLeaderboard) ? '8e9991a7d4aa3fef2ca28a617f3c1844' : (adConfig.key || 'ccd684eb4f620dcc7303d2fce2577bae');

  const isNative = adConfig.format === 'native' || !!adConfig.container_id;
  const containerId = adConfig.container_id || 'container-ccd684eb4f620dcc7303d2fce2577bae';
  const scriptSrc = (adConfig.script_url || '').startsWith('//') 
    ? `https:${adConfig.script_url}` 
    : (adConfig.script_url || 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js');

  const bannerId = bannerIdRef.current;

  // Build clean HTML doc for iframe isolation with fill observer
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
        <script>
          (function() {
            var checks = 0;
            var timer = setInterval(function() {
              checks++;
              var el = document.getElementById('${containerId}');
              var filled = el && (
                el.children.length > 0 ||
                el.querySelector('img, a, iframe, div') ||
                el.innerText.trim().length > 0 ||
                el.offsetHeight > 20
              );
              if (filled) {
                clearInterval(timer);
                window.parent.postMessage({ type: 'AURA_AD_FILLED', bannerId: '${bannerId}' }, '*');
              }
              if (checks > 35) { clearInterval(timer); }
            }, 180);
          })();
        </script>
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
        <script>
          (function() {
            var checks = 0;
            var timer = setInterval(function() {
              checks++;
              var hasAd = document.querySelector('iframe, img, a');
              if (hasAd || document.body.children.length > 2) {
                clearInterval(timer);
                window.parent.postMessage({ type: 'AURA_AD_FILLED', bannerId: '${bannerId}' }, '*');
              }
              if (checks > 35) { clearInterval(timer); }
            }, 180);
          })();
        </script>
      </body>
    </html>
  `;

  return (
    <div 
      className={`${styles.adContainer} ${slot === 'download_modal' ? styles.downloadModalAd : slot === 'pre_roll' ? styles.preRollAd : styles.movieDetailAd}`}
      style={{ 
        width: `${renderWidth}px`,
        display: isLoaded ? 'flex' : 'none' // Zero empty black box: only display when ad actually rendered!
      }}
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
        onLoad={() => {
          // Fallback check after 2s: if iframe loaded without error and container has height
          setTimeout(() => {
            if (!isLoaded && impressionLoggedRef.current === false) {
              // Non-blocking ping
            }
          }, 2000);
        }}
      />
    </div>
  );
};

export default AdBanner;
