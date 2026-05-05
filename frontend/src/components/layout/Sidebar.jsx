import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Clock, List, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  const { isLoggedIn, user } = useAuth();

  const navItems = [
    { name: 'Home', path: '/', icon: <Home size={22} /> },
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
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
