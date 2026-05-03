import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import styles from './AnnouncementBanner.module.css';

const AnnouncementBanner = ({ announcement }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastMessage, setLastMessage] = useState('');

  useEffect(() => {
    if (announcement && announcement.active) {
      // If it's a completely new message, show it even if we dismissed the old one
      if (announcement.message !== lastMessage) {
        setIsVisible(true);
        setLastMessage(announcement.message);
      }
    } else {
      setIsVisible(false);
      setLastMessage('');
    }
  }, [announcement]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !announcement) return null;

  const typeClass = announcement.type || 'info';

  return (
    <div className={`${styles.bannerWrapper} ${styles[typeClass]}`}>
      <div className={styles.glassEffect}></div>
      <div className={styles.bannerContent}>
        <div className={styles.iconWrapper}>
          {announcement.type === 'alert' && <AlertCircle size={18} />}
          {announcement.type === 'warning' && <AlertTriangle size={18} />}
          {announcement.type === 'info' && <Info size={18} />}
        </div>
        <p className={styles.message}>{announcement.message}</p>
        <button className={styles.closeBtn} onClick={handleDismiss}>
          <X size={18} />
        </button>
      </div>
      <div className={styles.glowEffect}></div>
    </div>
  );
};

export default AnnouncementBanner;
