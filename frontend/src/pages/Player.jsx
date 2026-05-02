import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import styles from './Player.module.css';

const Player = () => {
  const [searchParams] = useSearchParams();
  const title = searchParams.get('title') || 'Video';
  const navigate = useNavigate();

  return (
    <div className={styles.playerPage}>
      <div className={styles.videoContainer}>
        {/* Placeholder for actual video player */}
        <video 
          className={styles.mockVideo} 
          controls 
          autoPlay 
          src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        >
          Your browser does not support the video tag.
        </video>

        <div className={styles.overlay}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={32} />
          </button>
          <span className={styles.title}>{title}</span>
        </div>
      </div>
    </div>
  );
};

export default Player;
