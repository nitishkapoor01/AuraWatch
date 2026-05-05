import React, { useState, useEffect, createContext, useContext } from 'react';
import { AlertTriangle, Info, X, CheckCircle } from 'lucide-react';
import styles from './Toast.module.css';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map(toast => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <div className={styles.icon}>
              {toast.type === 'warning' && <AlertTriangle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              {toast.type === 'success' && <CheckCircle size={20} />}
            </div>
            <div className={styles.content}>
              <p>{toast.message}</p>
            </div>
            <button className={styles.closeBtn} onClick={() => removeToast(toast.id)}>
              <X size={16} />
            </button>
            <div className={styles.progressBar}></div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
