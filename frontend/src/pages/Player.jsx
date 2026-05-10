import React, { useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PictureInPicture } from 'lucide-react';
import styles from './Player.module.css';

const Player = () => {
  const [searchParams] = useSearchParams();
  const title = searchParams.get('title') || 'Video';
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const handlePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Failed to enter PiP:', error);
    }
  };

  return (
    <div className={styles.playerPage}>
      <div className={styles.videoContainer}>
        {/* Placeholder for actual video player */}
        <video 
          className={styles.mockVideo} 
          controls 
          autoPlay 
          src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          ref={videoRef}
        >
          Your browser does not support the video tag.
        </video>

        <div className={styles.overlay}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={32} />
          </button>
          <span className={styles.title}>{title}</span>
          <button className={styles.pipBtn} onClick={handlePiP} title="Picture in Picture">
            <PictureInPicture size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Player;
