import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Clock, List, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/apiBase';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  const { isLoggedIn, user } = useAuth();
  const [hasUnreadHub, setHasUnreadHub] = useState(false);

  useEffect(() => {
    const checkUnreadHub = async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/hub/unread-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.latest_admin_post_at) {
            const adminTime = new Date(data.latest_admin_post_at).getTime();
            const lastSeen = localStorage.getItem('aura_hub_last_seen');
            if (!lastSeen || adminTime > parseInt(lastSeen, 10)) {
              setHasUnreadHub(true);
              return;
            }
          }
        }
        setHasUnreadHub(false);
      } catch (e) {
        // ignore
      }
    };

    checkUnreadHub();
    const interval = setInterval(checkUnreadHub, 30000);

    const onSeen = () => setHasUnreadHub(false);
    window.addEventListener('aura_hub_seen', onSeen);

    return () => {
      clearInterval(interval);
      window.removeEventListener('aura_hub_seen', onSeen);
    };
  }, []);

  const navItems = [
    { name: 'Home', path: '/', icon: <Home size={22} /> },
    { name: 'Aura Hub', path: '/hub', icon: <Sparkles size={22} /> },
    { name: 'Watch History', path: '/history', icon: <Clock size={22} /> },
    { name: 'My List', path: '/list', icon: <List size={22} /> },
  ];

  const canAccessAdmin = isLoggedIn && (user?.role === 'admin' || user?.role === 'moderator');
  if (canAccessAdmin) {
    navItems.push({ name: 'Admin Dashboard', path: '/admin', icon: <ShieldAlert size={22} /> });
  }

  return (
    <aside className={`${styles.sidebar} sidebar`}>
      <nav className={styles.navSection}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => 
              `${styles.navItem} navItem ${isActive ? styles.active : ''}`
            }
          >
            <div className={styles.iconWrapper}>
              {item.icon}
              {item.path === '/hub' && hasUnreadHub && (
                <span className={styles.hubBlinkDot} />
              )}
            </div>
            <span className={styles.navLabel}>{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
