import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import styles from './AnnouncementBanner.module.css';

const AnnouncementBanner = ({ announcement }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (announcement && announcement.active) {
      const dismissedMessage = sessionStorage.getItem('dismissedAnnouncement');
      if (dismissedMessage !== announcement.message) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }
  }, [announcement]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (announcement) {
      sessionStorage.setItem('dismissedAnnouncement', announcement.message);
    }
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
