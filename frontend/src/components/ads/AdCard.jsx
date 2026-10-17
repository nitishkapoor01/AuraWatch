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

const AdCard = ({ style, compact = false }) => {
  const { user } = useAuth();
  const [adConfig, setAdConfig] = useState(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scale, setScale] = useState(0.6);
  const cardRef = useRef(null);
  const impressionLoggedRef = useRef(false);
  const cardIdRef = useRef(`ad-card-${Math.random().toString(36).substring(2, 9)}`);

  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);
  const isAdExempt = isAdmin || Boolean(user?.is_premium);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
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
          if (data.is_premium || data.skipAdsTimer || (data.config && data.config.enabled === false)) {
            setAdConfig(null);
          } else if (data.config && data.config.search_grid) {
            setAdConfig(data.config.search_grid);
          }
        }
      } catch (_) {}
    };

    fetchConfig();

    const onVipUnlocked = () => {
      if (isMounted) setAdConfig(null);
    };
    window.addEventListener('aurawatch_vip_unlocked', onVipUnlocked);

    return () => { 
      isMounted = false; 
      window.removeEventListener('aurawatch_vip_unlocked', onVipUnlocked);
    };
  }, [user]);

  // Compute responsive scale factor to fit 300px ad inside card bounds
  useEffect(() => {
    if (!cardRef.current) return;

    const updateScale = () => {
      if (cardRef.current) {
        const cardWidth = cardRef.current.offsetWidth;
        const cardHeight = cardRef.current.offsetHeight;
        if (cardWidth > 0 && cardHeight > 0) {
          const scaleX = (cardWidth - 8) / 300;
          const scaleY = (cardHeight - 8) / 250;
          const newScale = Math.min(1, Math.max(0.35, Math.min(scaleX, scaleY)));
          setScale(newScale);
        } else if (cardWidth > 0) {
          const newScale = Math.min(1, Math.max(0.45, (cardWidth - 10) / 300));
          setScale(newScale);
        }
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [adConfig, compact]);

  // Listen for fill message from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'AURA_CARD_FILLED' && event.data?.cardId === cardIdRef.current) {
        setIsLoaded(true);
        logImpression();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  // Strictly hide ads from all administrators and VIP members
  if (isAdExempt || !adConfig || adConfig.enabled === false) {
    return null;
  }

  const isNative = adConfig.format === 'native' || !!adConfig.container_id;
  const containerId = adConfig.container_id || 'container-ccd684eb4f620dcc7303d2fce2577bae';
  const scriptSrc = (adConfig.script_url || '').startsWith('//') 
    ? `https:${adConfig.script_url}` 
    : (adConfig.script_url || 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js');

  const cardId = cardIdRef.current;

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
                window.parent.postMessage({ type: 'AURA_CARD_FILLED', cardId: '${cardId}' }, '*');
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
        <script>
          (function() {
            var checks = 0;
            var timer = setInterval(function() {
              checks++;
              var hasAd = document.querySelector('iframe, img, a');
              if (hasAd || document.body.children.length > 2) {
                clearInterval(timer);
                window.parent.postMessage({ type: 'AURA_CARD_FILLED', cardId: '${cardId}' }, '*');
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
      ref={cardRef} 
      className={`${styles.adCard} ${compact ? styles.compact : ''}`}
      style={{
        ...style,
        display: isLoaded ? 'flex' : 'none' // Zero empty black box: only display if ad actually filled!
      }}
    >
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
          />
        </div>
      </div>
    </div>
  );
};

export default AdCard;
