import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Trash2, ShieldAlert, Film, Clock, BarChart3, AlertCircle, Activity, Calendar, CalendarDays, CalendarCheck, Info, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const { token, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveStats, setLiveStats] = useState(null);

  const [announcement, setAnnouncement] = useState({ active: false, message: '', type: 'info' });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const [globalSettings, setGlobalSettings] = useState({ skip_ads_timer: false });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchLiveStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/tracking/live-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch live stats', e);
    }
  };

  const fetchAnnouncement = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/admin/announcement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) setAnnouncement(data);
      }
    } catch (e) {
      console.error('Failed to fetch announcement', e);
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalSettings({
          skip_ads_timer: data.skip_ads_timer === 'true' || data.skip_ads_timer === true
        });
      }
    } catch (e) {
      console.error('Failed to fetch global settings', e);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    fetchAdminData(true);
    fetchLiveStats();
    fetchAnnouncement();
    fetchGlobalSettings();
    
    // Auto-refresh both live stats and platform stats every 10s
    const liveInterval = setInterval(fetchLiveStats, 10000);
    const statsInterval = setInterval(() => fetchAdminData(false), 10000);
    return () => {
      clearInterval(liveInterval);
      clearInterval(statsInterval);
    };
  }, [isLoggedIn]);

  const fetchAdminData = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, usersRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/admin/stats`, { headers }),
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/admin/users`, { headers })
      ]);

      if (!statsRes.ok || !usersRes.ok) {
        if (statsRes.status === 403) throw new Error('Access Denied. Administrator privileges required.');
        throw new Error('Failed to fetch admin data');
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();

      setStats(statsData);
      setUsers(usersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    try {
      setSavingAnnouncement(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/admin/announcement`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(announcement)
      });
      if (!res.ok) throw new Error('Failed to save announcement');
      alert('Announcement updated successfully! It will appear for all users within 30 seconds.');
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleUpdateSetting = async (key, value) => {
    try {
      setSavingSettings(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/admin/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ key, value })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update setting');
      }
      
      setGlobalSettings(prev => ({ ...prev, [key]: value }));
      alert(`Setting updated: ${key} is now ${value ? 'ON' : 'OFF'}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}`}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete user');
      }

      setUsers(users.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.loader}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.errorState}>
          <ShieldAlert size={64} color="#e50914" />
          <h2>Access Restricted</h2>
          <p>{error}</p>
          <button className={styles.backBtn} onClick={() => navigate('/')}>Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminPage}>
      <div className={styles.header}>
        <h1>Admin Control Panel</h1>
        <p>Monitor platform statistics and manage user accounts</p>
      </div>

      {liveStats && (
        <div className={styles.liveStatsBanner}>
          <div className={styles.liveIndicator}>
            <span className={styles.ping}></span>
            <span className={styles.dot}></span>
          </div>
          <div className={styles.liveStatsContent}>
            <h2>{liveStats.total} Active Users Right Now</h2>
            <p>{liveStats.loggedIn} Logged In • {liveStats.guests} Guests</p>
          </div>
        </div>
      )}

      <div className={styles.analyticsSection}>
        <div className={styles.sectionHeader}>
          <h2>Global Platform Settings</h2>
          <p className={styles.sectionSub}>Control premium features and monetization</p>
        </div>
        <div className={styles.settingsGrid}>
          <div className={styles.settingCard}>
            <div className={styles.settingInfo}>
              <h3>Skip 30s Download Wait</h3>
              <p>When enabled, users will bypass the 30-second countdown and see download links immediately.</p>
            </div>
            <button 
              className={`${styles.toggleBtn} ${globalSettings.skip_ads_timer ? styles.active : ''}`}
              onClick={() => handleUpdateSetting('skip_ads_timer', !globalSettings.skip_ads_timer)}
              disabled={savingSettings}
            >
              <div className={styles.toggleThumb}></div>
              <span>{globalSettings.skip_ads_timer ? 'BYPASS ACTIVE' : '30s TIMER ON'}</span>
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <>
          <div className={styles.analyticsSection}>
            <div className={styles.sectionHeader}>
              <h2>Site Traffic</h2>
              <p className={styles.sectionSub}>Total unique visitors (Guests + Logged In)</p>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'rgba(233, 30, 99, 0.15)', color: '#e91e63' }}>
                  <Activity size={28} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.totalVisitsToday}</h3>
                  <p>Visits Today</p>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'rgba(233, 30, 99, 0.15)', color: '#e91e63' }}>
                  <CalendarDays size={28} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.totalVisitsWeekly}</h3>
                  <p>Weekly Visits</p>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'rgba(233, 30, 99, 0.15)', color: '#e91e63' }}>
                  <Calendar size={28} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.totalVisitsMonthly}</h3>
                  <p>Monthly Visits</p>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'rgba(233, 30, 99, 0.15)', color: '#e91e63' }}>
                  <CalendarCheck size={28} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.totalVisitsYearly}</h3>
                  <p>Yearly Visits</p>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'rgba(233, 30, 99, 0.15)', color: '#e91e63' }}>
                  <Activity size={28} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.totalVisitsAllTime}</h3>
                  <p>All-Time Visits</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.analyticsSection}>
            <div className={styles.sectionHeader}>
              <h2>Push Announcements</h2>
              <p className={styles.sectionSub}>Broadcast a message to all active users</p>
            </div>
            <div className={styles.announcementPanel}>
              <div className={styles.announcementContent}>
                <div className={styles.previewContainer}>
                  <label className={styles.previewLabel}>Live Preview</label>
                  <div className={`${styles.previewBanner} ${styles[announcement.type]}`}>
                    <div className={styles.previewIcon}>
                      {announcement.type === 'alert' && <AlertCircle size={16} />}
                      {announcement.type === 'warning' && <AlertTriangle size={16} />}
                      {announcement.type === 'info' && <Info size={16} />}
                    </div>
                    <p className={styles.previewText}>{announcement.message || 'Announcement message preview...'}</p>
                    <div className={styles.previewClose}><X size={14} /></div>
                  </div>
                </div>

                <div className={styles.announcementControls}>
                  <div className={styles.inputGroup}>
                    <label>Broadcast Message</label>
                    <textarea 
                      value={announcement.message}
                      onChange={(e) => setAnnouncement({...announcement, message: e.target.value})}
                      placeholder="e.g. Server maintenance at 12 PM..."
                      className={styles.textArea}
                      rows="2"
                    />
                  </div>
                  
                  <div className={styles.controlGrid}>
                    <div className={styles.inputGroup}>
                      <label>Banner Theme</label>
                      <div className={styles.themeSelector}>
                        {['info', 'warning', 'alert'].map(t => (
                          <button 
                            key={t}
                            className={`${styles.themeOption} ${styles[t]} ${announcement.type === t ? styles.selected : ''}`}
                            onClick={() => setAnnouncement({...announcement, type: t})}
                          >
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.toggleGroup}>
                      <label>Status</label>
                      <div className={styles.statusToggleWrapper}>
                        <button 
                          className={`${styles.statusBtn} ${announcement.active ? styles.active : ''}`}
                          onClick={() => setAnnouncement({...announcement, active: !announcement.active})}
                        >
                          {announcement.active ? 'PUBLISHED' : 'DRAFT'}
                        </button>
                        <p className={styles.statusDesc}>
                          {announcement.active ? 'Visible to all users' : 'Hidden from site'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button 
                    className={styles.saveAnnouncementBtn}
                    onClick={handleSaveAnnouncement}
                    disabled={savingAnnouncement || (!announcement.message.trim() && announcement.active)}
                  >
                    {savingAnnouncement ? 'UPDATING...' : 'PUSH TO ALL DEVICES'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.analyticsSection}>
            <div className={styles.sectionHeader}>
              <h2>Engagement Analytics</h2>
              <p className={styles.sectionSub}>Unique active logged-in users over time</p>
            </div>
            <div className={styles.statsGrid}>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}>
                <Users size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{stats.dailyActive}</h3>
                <p>Daily Active (DAU)</p>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.15)', color: '#0071eb' }}>
                <CalendarDays size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{stats.weeklyActive}</h3>
                <p>Weekly Active (WAU)</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6' }}>
                <Calendar size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{stats.monthlyActive}</h3>
                <p>Monthly Active (MAU)</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(230, 126, 34, 0.15)', color: '#e67e22' }}>
                <CalendarCheck size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{stats.yearlyActive}</h3>
                <p>Yearly Active (YAU)</p>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {stats && (
        <div className={styles.platformStatsSection}>
          <div className={styles.sectionHeader}>
            <h2>Platform Totals</h2>
          </div>
          <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(229, 9, 20, 0.15)', color: '#e50914' }}>
              <Users size={28} />
            </div>
            <div className={styles.statInfo}>
              <h3>{stats.totalUsers}</h3>
              <p>Registered Users</p>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.15)', color: '#0071eb' }}>
              <Clock size={28} />
            </div>
            <div className={styles.statInfo}>
              <h3>{stats.totalWatchTimeHours} hrs</h3>
              <p>Total Watch Time</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}>
              <BarChart3 size={28} />
            </div>
            <div className={styles.statInfo}>
              <h3>{stats.totalWatches}</h3>
              <p>Sessions Logged</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(229, 185, 9, 0.15)', color: '#e5b909' }}>
              <Film size={28} />
            </div>
            <div className={styles.statInfo}>
              <h3>{stats.totalFavorites}</h3>
              <p>Titles Favorited</p>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className={styles.usersSection}>
        <div className={styles.sectionHeader}>
          <h2>User Management</h2>
          <span className={styles.userCount}>{users.length} Users</span>
        </div>
        
        <div className={styles.tableContainer}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined Date</th>
                <th>Failed Logins</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userInfo}>
                      <img 
                        src={user.avatar && user.avatar.startsWith('http') ? user.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar || 'red'}`} 
                        alt="avatar" 
                        className={styles.userAvatar}
                        style={user.avatar && user.avatar.startsWith('http') ? { objectFit: 'cover' } : {}}
                      />
                      <div>
                        <div className={styles.userName}>{user.name}</div>
                        <div className={styles.userEmail}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${user.role === 'admin' ? styles.roleAdmin : styles.roleUser}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    {user.failed_login_attempts > 0 ? (
                      <span className={styles.warningText}>
                        <AlertCircle size={14} /> {user.failed_login_attempts}
                      </span>
                    ) : '0'}
                  </td>
                  <td>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      disabled={user.role === 'admin'}
                      title={user.role === 'admin' ? "Cannot delete admins" : "Delete user"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.emptyTable}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
