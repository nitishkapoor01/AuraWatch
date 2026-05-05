import React from 'react';
import { X, Lock, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './LoginPromptModal.module.css';

const LoginPromptModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className={styles.iconContainer}>
          <Lock size={48} />
        </div>
        
        <h2 className={styles.title}>Login Required</h2>
        <p className={styles.message}>
          Please login to use this feature. Create an account or sign in to save your progress, customize your profile, and much more.
        </p>
        
        <Link to="/login" className={styles.loginBtn} onClick={onClose}>
          <LogIn size={20} />
          Go to Login
        </Link>
      </div>
    </div>
  );
};

export default LoginPromptModal;
