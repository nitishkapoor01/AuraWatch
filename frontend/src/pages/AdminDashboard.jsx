import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Trash2, ShieldAlert, Film, Clock, BarChart3, AlertCircle, 
  Activity, Calendar, CalendarDays, CalendarCheck, Info, AlertTriangle, 
  X, LayoutDashboard, Shield, BarChart, Zap, Search as SearchIcon,
  Ban, ShieldCheck, UserCog, History, MessageSquare, CheckCircle, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const { token, isLoggedIn, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data States
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Live Feed & Security States
  const [liveStats, setLiveStats] = useState(null);
  const [searchLogs, setSearchLogs] = useState({ recent: [], topKeywords: [], noResults: [] });
  const [loginLogs, setLoginLogs] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);
  const [tempPerms, setTempPerms] = useState({ read: true, write: false });
  const [mostWatched, setMostWatched] = useState([]);
  const [visitors, setVisitors] = useState([]);
  
  // Support States
  const [supportTickets, setSupportTickets] = useState([]);
  const [resolvingTicket, setResolvingTicket] = useState(false);
  
  // Control States
  const [announcement, setAnnouncement] = useState({ active: false, message: '', type: 'info' });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ skip_ads_timer: false });
  const [buttonWarnings, setButtonWarnings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [newBlockIp, setNewBlockIp] = useState({ ip: '', reason: '' });

  const fetchLiveStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/tracking/live-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveStats(data);
      }
    } catch (e) { console.error('Failed to fetch live stats', e); }
  };

  const fetchAdminData = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

      const [statsRes, usersRes, settingsRes, announcementRes] = await Promise.all([
        fetch(`${baseUrl}/admin/stats`, { headers }),
        fetch(`${baseUrl}/admin/users`, { headers }),
        fetch(`${baseUrl}/admin/settings`, { headers }),
        fetch(`${baseUrl}/admin/announcement`, { headers })
      ]);

      if (!statsRes.ok || !usersRes.ok) {
        if (statsRes.status === 403) throw new Error('Access Denied. Administrator privileges required.');
        throw new Error('Failed to fetch admin data');
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
      
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setGlobalSettings(prev => ({ ...prev, ...settings }));
        if (settings.button_warnings) {
          setButtonWarnings(settings.button_warnings);
        }
      }
      
      if (announcementRes.ok) {
        const announcementData = await announcementRes.json();
        if (announcementData) setAnnouncement(announcementData);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const fetchTabSpecificData = async (tab) => {
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

    if (tab === 'security') {
      const [blockedRes, loginRes] = await Promise.all([
        fetch(`${baseUrl}/admin/security/blocked-ips`, { headers }),
        fetch(`${baseUrl}/admin/security/login-logs`, { headers })
      ]);
      if (blockedRes.ok) setBlockedIps(await blockedRes.json());
      if (loginRes.ok) setLoginLogs(await loginRes.json());
    } else if (tab === 'analytics') {
      const [searchRes, watchedRes] = await Promise.all([
        fetch(`${baseUrl}/admin/search-logs`, { headers }),
        fetch(`${baseUrl}/admin/analytics/most-watched`, { headers })
      ]);
      if (searchRes.ok) setSearchLogs(await searchRes.json());
      if (watchedRes.ok) setMostWatched(await watchedRes.json());
    } else if (tab === 'users') {
      const visitorsRes = await fetch(`${baseUrl}/admin/visitors`, { headers });
      if (visitorsRes.ok) setVisitors(await visitorsRes.json());
    } else if (tab === 'support') {
      const supportRes = await fetch(`${baseUrl}/support`, { headers });
      if (supportRes.ok) setSupportTickets(await supportRes.json());
    }
  };

  useEffect(() => {
    if (!isLoggedIn) { navigate('/login'); return; }
    fetchAdminData(true);
    fetchLiveStats();
    
    // Auto-refresh logic
    const liveInterval = setInterval(fetchLiveStats, 10000);
    const statsInterval = setInterval(() => fetchAdminData(false), 30000);
    
    return () => { clearInterval(liveInterval); clearInterval(statsInterval); };
  }, [isLoggedIn]);

  useEffect(() => {
    fetchTabSpecificData(activeTab);
  }, [activeTab]);

  // Actions
  const handleUpdateRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update role');
      }
    } catch (e) { alert('Error updating role'); }
  };

  const handleToggleBan = async (id, currentStatus) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_banned: !currentStatus })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === id ? { ...u, is_banned: !currentStatus } : u));
      } else {
        const data = await res.json();
        alert(data.message || 'Action failed');
      }
    } catch (e) { alert('Error updating ban status'); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('ARE YOU SURE? This will permanently delete this user and all their data from the database. This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete user');
      }
    } catch (e) { alert('Error deleting user'); }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUserForPerms) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${selectedUserForPerms.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: tempPerms })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === selectedUserForPerms.id ? { ...u, admin_permissions: tempPerms } : u));
        setIsPermissionModalOpen(false);
      } else {
        const data = await res.json();
        alert(data.message || 'Update failed');
      }
    } catch (e) { alert('Error updating permissions'); }
  };

  const openPermissionModal = (user) => {
    setSelectedUserForPerms(user);
    setTempPerms(user.admin_permissions || { read: true, write: false });
    setIsPermissionModalOpen(true);
  };

  const handleBlockIp = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/security/block-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ip_address: newBlockIp.ip, reason: newBlockIp.reason })
      });
      if (res.ok) {
        setNewBlockIp({ ip: '', reason: '' });
        fetchTabSpecificData('security');
      }
    } catch (e) { alert('Error blocking IP'); }
  };

  const handleUnblockIp = async (ip) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/security/block-ip/${ip}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTabSpecificData('security');
    } catch (e) { alert('Error unblocking IP'); }
  };

  const handleSaveAnnouncement = async () => {
    try {
      setSavingAnnouncement(true);
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/announcement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(announcement)
      });
      alert('Announcement updated!');
    } catch (e) { alert('Failed to save announcement'); }
    finally { setSavingAnnouncement(false); }
  };

  const handleUpdateButtonWarnings = async (key, value) => {
    try {
      const newWarnings = { ...buttonWarnings, [key]: value };
      setButtonWarnings(newWarnings);
      setSavingSettings(true);
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: 'button_warnings', value: newWarnings })
      });
    } catch (e) { alert('Failed to update button warnings'); }
    finally { setSavingSettings(false); }
  };

  const handleUpdateSetting = async (key, value) => {
    try {
      setSavingSettings(true);
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, value })
      });
      setGlobalSettings(prev => ({ ...prev, [key]: value }));
    } catch (e) { alert('Failed to update setting'); }
    finally { setSavingSettings(false); }
  };

  const handleResolveTicket = async (id, currentStatus) => {
    try {
      setResolvingTicket(true);
      const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const res = await fetch(`${baseUrl}/support/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSupportTickets(supportTickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }
    } catch (e) { alert('Failed to update ticket'); }
    finally { setResolvingTicket(false); }
  };

  if (loading) return <div className={styles.adminPage}><div className={styles.loader}></div></div>;
  if (error) return (
    <div className={styles.adminPage}>
      <div className={styles.errorState}>
        <ShieldAlert size={64} color="#e50914" />
        <h2>Access Restricted</h2>
        <p>{error}</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>Return to Home</button>
      </div>
    </div>
  );

  return (
    <div className={styles.adminPage}>
      <div className={styles.header}>
        <h1>Admin Control Panel</h1>
        <p>Comprehensive observability and platform management</p>
      </div>

      <div className={styles.tabsNav}>
        <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTab : ''}`} onClick={() => setActiveTab('overview')}>
          <LayoutDashboard size={18} /> Overview
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'users' ? styles.activeTab : ''}`} onClick={() => setActiveTab('users')}>
          <Users size={18} /> Users
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'security' ? styles.activeTab : ''}`} onClick={() => setActiveTab('security')}>
          <Shield size={18} /> Security
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.activeTab : ''}`} onClick={() => setActiveTab('analytics')}>
          <BarChart size={18} /> Analytics
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'support' ? styles.activeTab : ''}`} onClick={() => setActiveTab('support')}>
          <MessageSquare size={18} /> Support
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'live' ? styles.activeTab : ''}`} onClick={() => setActiveTab('live')}>
          <Zap size={18} /> Live Feed
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && stats && (
        <div className={styles.tabContent}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(229, 9, 20, 0.15)', color: '#e50914' }}><Users size={28} /></div>
              <div className={styles.statInfo}><h3>{stats.uniqueVisitorsToday}</h3><p>Unique Visitors Today</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}><Zap size={28} /></div>
              <div className={styles.statInfo}><h3>{liveStats?.total || 0}</h3><p>Users Online Now</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(39, 174, 96, 0.15)', color: '#27ae60' }}><CheckCircle size={28} /></div>
              <div className={styles.statInfo}><h3>{stats.totalWatches}</h3><p>Completed Watches</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.15)', color: '#0071eb' }}><Activity size={28} /></div>
              <div className={styles.statInfo}><h3>{stats.totalAttempts}</h3><p>Total Clicks</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6' }}><Clock size={28} /></div>
              <div className={styles.statInfo}><h3>{Math.round(stats.totalWatchTimeHours)}h</h3><p>Total Watch Time</p></div>
            </div>
          </div>

          <div className={styles.analyticsSection}>
            <div className={styles.sectionHeader}><h2>Announcements & Broadcasts</h2></div>
            <div className={styles.announcementPanel}>
              <div className={styles.announcementControls}>
                <textarea 
                  value={announcement.message}
                  onChange={(e) => setAnnouncement({...announcement, message: e.target.value})}
                  placeholder="Broadcast message to all users..."
                  className={styles.textArea}
                  rows="2"
                />
                <div className={styles.controlGrid}>
                  <div className={styles.inputGroup}>
                    <label>Theme</label>
                    <div className={styles.themeSelector}>
                      {['info', 'warning', 'alert'].map(t => (
                        <button key={t} className={`${styles.themeOption} ${announcement.type === t ? styles.selected : ''} ${styles[t]}`} onClick={() => setAnnouncement({...announcement, type: t})}>
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.toggleGroup}>
                    <label>Status</label>
                    <button className={`${styles.statusBtn} ${announcement.active ? styles.active : ''}`} onClick={() => setAnnouncement({...announcement, active: !announcement.active})}>
                      {announcement.active ? 'PUBLISHED' : 'DRAFT'}
                    </button>
                  </div>
                </div>
                <button 
                  className={styles.saveAnnouncementBtn} 
                  onClick={handleSaveAnnouncement} 
                  disabled={savingAnnouncement || currentUser.role !== 'admin'}
                >
                  {savingAnnouncement ? 'UPDATING...' : 'PUSH TO ALL DEVICES'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.analyticsSection} style={{ marginTop: '40px' }}>
            <div className={styles.sectionHeader}><h2>Feature Controls</h2></div>
            <div className={styles.settingsGrid}>
              <div className={styles.settingCard}>
                <div className={styles.settingInfo}><h3>Skip Download Timer</h3><p>Users bypass the 30s wait when enabled.</p></div>
                <button 
                  className={`${styles.toggleBtn} ${globalSettings.skip_ads_timer ? styles.active : ''}`} 
                  onClick={() => handleUpdateSetting('skip_ads_timer', !globalSettings.skip_ads_timer)} 
                  disabled={savingSettings || currentUser.role !== 'admin'}
                >
                  <div className={styles.toggleThumb}></div>
                </button>
              </div>
            </div>
            
            <div className={styles.sectionHeader} style={{ marginTop: '30px' }}><h2>Button Warnings & Tooltips</h2></div>
            <div className={styles.settingsGrid}>
              {[
                { id: 'play_movie', label: 'Play Now (Movie Detail)' },
                { id: 'download_movie', label: 'Download (Movie Detail)' },
                { id: 'watch_trailer', label: 'Watch Trailer (Movie Detail)' },
                { id: 'add_to_list', label: 'Add to List (Movie Detail)' },
                { id: 'customize_ui', label: 'Customize UI (Top Nav)' }
              ].map(btn => (
                <div key={btn.id} className={styles.settingCard} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                  <div className={styles.settingInfo}>
                    <h3>{btn.label}</h3>
                    <p>Leave empty for no warning. Any text here will show as a badge/tooltip.</p>
                  </div>
                  <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
                    <input 
                      type="text" 
                      placeholder="e.g. Currently in development" 
                      className={styles.inputField} 
                      value={buttonWarnings[btn.id] || ''} 
                      onChange={e => setButtonWarnings({...buttonWarnings, [btn.id]: e.target.value})}
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button 
                      className={styles.primaryBtn} 
                      onClick={() => handleUpdateButtonWarnings(btn.id, buttonWarnings[btn.id])}
                      disabled={savingSettings || currentUser.role !== 'admin'}
                      style={{ padding: '0 16px' }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className={styles.tabContent}>
          <div className={styles.usersSection}>
            <div className={styles.sectionHeader}><h2>Registered Users</h2><span className={styles.userCount}>{users.length} Users</span></div>
            <div className={styles.tableContainer}>
              <table className={styles.usersTable}>
                <thead>
                  <tr><th>User</th><th>Role</th><th>Joined</th><th>Last Active</th><th>Security</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className={styles.userInfo}>
                          <img src={u.avatar?.startsWith('http') ? u.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.avatar || 'red'}`} className={styles.userAvatar} />
                          <div>
                            <div className={styles.userName}>
                              {u.name}
                              {u.is_super_admin && <span className={styles.superAdminBadge}>SUPER ADMIN</span>}
                            </div>
                            <div className={styles.userEmail}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select className={styles.roleSelect} value={u.role} onChange={(e) => handleUpdateRole(u.id, e.target.value)} disabled={u.id === currentUser.id || u.is_super_admin || currentUser.role !== 'admin'}>
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ fontSize: '12px' }}>
                        {u.last_seen ? new Date(u.last_seen).toLocaleString() : 'Never'}
                      </td>
                      <td>
                        {u.failed_login_attempts > 0 && <span className={styles.logFailure}><AlertTriangle size={14} /> {u.failed_login_attempts}</span>}
                      </td>
                      <td>
                        <div className={styles.userActionBtns}>
                          {currentUser.is_super_admin && u.role === 'admin' && !u.is_super_admin && (
                            <button className={styles.permBtn} onClick={() => openPermissionModal(u)} title="Admin Permissions">
                              <Shield size={18} />
                            </button>
                          )}
                          <button 
                            className={u.is_banned ? styles.unbanBtn : styles.banBtn} 
                            onClick={() => handleToggleBan(u.id, u.is_banned)} 
                            disabled={u.id === currentUser.id || u.is_super_admin || currentUser.role !== 'admin'}
                          >
                            {u.is_banned ? <ShieldCheck size={18} /> : <Ban size={18} />}
                          </button>
                          <button 
                            className={styles.banBtn} 
                            style={{ background: 'rgba(229, 9, 20, 0.05)', borderColor: 'rgba(229, 9, 20, 0.1)' }}
                            onClick={() => handleDeleteUser(u.id)} 
                            disabled={u.id === currentUser.id || u.is_super_admin || currentUser.role !== 'admin'}
                            title="Delete User Permanently"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.usersSection} style={{ marginTop: '40px' }}>
            <div className={styles.sectionHeader}>
              <h2>Active Guest Sessions</h2>
              <span className={styles.userCount} style={{ background: 'rgba(0, 113, 235, 0.15)', color: '#0071eb' }}>
                {liveStats?.sessions.filter(s => s.isGuest).length || 0} Guests
              </span>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.usersTable}>
                <thead>
                  <tr><th>Guest ID</th><th>Last Action</th><th>Current Path</th><th>Last Seen</th></tr>
                </thead>
                <tbody>
                  {(liveStats?.sessions.filter(s => s.isGuest) || []).map(guest => (
                    <tr key={guest.id}>
                      <td>
                        <div className={styles.userInfo}>
                          <div className={styles.userAvatar} style={{ background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={16} color="#666" />
                          </div>
                          <div>
                            <div className={styles.userName}>Guest #{guest.id.substring(0, 8)}</div>
                            <div className={styles.userEmail}>Visitor ID: {guest.visitorId?.substring(0, 12) || 'Anonymous'}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.actionBadge} style={{ fontSize: '10px' }}>{guest.action || 'Browsing'}</span>
                      </td>
                      <td style={{ fontSize: '11px', color: '#888' }}>{guest.path}</td>
                      <td>{Math.round((Date.now() - guest.lastSeen) / 1000)}s ago</td>
                    </tr>
                  ))}
                  {(!liveStats || liveStats.sessions.filter(s => s.isGuest).length === 0) && (
                    <tr><td colSpan="4" className={styles.emptyTable}>No guests active right now.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.usersSection} style={{ marginTop: '40px' }}>
            <div className={styles.sectionHeader}>
              <h2>Historical Unique Visitors</h2>
              <span className={styles.userCount} style={{ background: 'rgba(233, 30, 99, 0.15)', color: '#e91e63' }}>
                {visitors.length} Unique People
              </span>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.usersTable}>
                <thead>
                  <tr><th>Visitor</th><th>Status</th><th>Last IP</th><th>First Seen</th><th>Last Active</th></tr>
                </thead>
                <tbody>
                  {visitors.map(v => (
                    <tr key={v.visitor_id}>
                      <td>
                        <div className={styles.userInfo}>
                          <div className={styles.userAvatar} style={{ background: v.is_registered ? '#e50914' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {v.is_registered ? <ShieldCheck size={16} /> : <Users size={16} />}
                          </div>
                          <div>
                            <div className={styles.userName}>{v.user_name || `Visitor #${v.visitor_id.substring(0, 6)}`}</div>
                            <div className={styles.userEmail}>{v.visitor_id.substring(0, 20)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.roleBadge} ${v.is_registered ? styles.roleAdmin : styles.roleUser}`} style={{ background: v.is_registered ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.05)', color: v.is_registered ? '#2ecc71' : '#777', borderColor: 'transparent' }}>
                          {v.is_registered ? 'REGISTERED' : 'GUEST'}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', opacity: 0.7 }}>{v.last_ip}</td>
                      <td style={{ fontSize: '12px' }}>{new Date(v.first_seen).toLocaleDateString()}</td>
                      <td style={{ fontSize: '12px' }}>{new Date(v.last_seen).toLocaleString()}</td>
                    </tr>
                  ))}
                  {visitors.length === 0 && <tr><td colSpan="5" className={styles.emptyTable}>No historical records found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'security' && (
        <div className={styles.tabContent}>
          <div className={styles.securityControls}>
            <div className={styles.blockIpSection}>
              <h3>Block IP Address</h3>
              <form onSubmit={handleBlockIp} className={styles.blockIpForm}>
                <input type="text" placeholder="IP Address (e.g. 1.2.3.4)" className={styles.inputField} value={newBlockIp.ip} onChange={e => setNewBlockIp({...newBlockIp, ip: e.target.value})} required />
                <input type="text" placeholder="Reason for blocking" className={styles.inputField} value={newBlockIp.reason} onChange={e => setNewBlockIp({...newBlockIp, reason: e.target.value})} />
                <button type="submit" className={styles.primaryBtn} disabled={currentUser.role !== 'admin'}>Block IP</button>
              </form>
              
              <h3 style={{ marginTop: '30px' }}>Blocked IPs</h3>
              <div className={styles.tableContainer}>
                <table className={styles.logTable}>
                  <thead><tr><th>IP</th><th>Reason</th><th>Action</th></tr></thead>
                  <tbody>
                    {blockedIps.map(item => (
                      <tr key={item.ip_address}>
                        <td>{item.ip_address}</td>
                        <td>{item.reason}</td>
                        <td><button className={styles.unblockBtn} onClick={() => handleUnblockIp(item.ip_address)} disabled={currentUser.role !== 'admin'}>Unblock</button></td>
                      </tr>
                    ))}
                    {blockedIps.length === 0 && <tr><td colSpan="3">No blocked IPs</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.loginLogsSection}>
              <h3>Recent Login Attempts</h3>
              <div className={styles.tableContainer}>
                <table className={styles.logTable}>
                  <thead><tr><th>User</th><th>IP</th><th>Status</th><th>Time</th></tr></thead>
                  <tbody>
                    {loginLogs.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.name || 'Unknown'}</td>
                        <td>{log.ip_address}</td>
                        <td className={log.success ? styles.logSuccess : styles.logFailure}>{log.success ? 'Success' : 'Failed'}</td>
                        <td className={styles.feedTime}>{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className={styles.tabContent}>
          <div className={styles.analyticsGrid}>
            <div className={styles.analyticsCard}>
              <h3><SearchIcon size={18} /> Top Search Keywords</h3>
              <div className={styles.keywordList}>
                {searchLogs.topKeywords.map((k, idx) => (
                  <div key={idx} className={styles.keywordItem}>
                    <span className={styles.keywordText}>{k.query}</span>
                    <span className={styles.keywordCount}>{k.count} searches</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={styles.analyticsCard}>
              <h3><Film size={18} /> Most Watched (Engagement)</h3>
              <div className={styles.keywordList}>
                {mostWatched.map((m, idx) => (
                  <div key={idx} className={styles.keywordItem}>
                    <span className={styles.keywordText}>{m.title} <span style={{fontSize: '10px', color: '#555'}}>{m.movie_type}</span></span>
                    <span className={styles.keywordCount}>{m.watches} views</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.analyticsCard}>
              <h3><AlertTriangle size={18} /> Searches with No Results</h3>
              <div className={styles.keywordList}>
                {searchLogs.noResults.map((k, idx) => (
                  <div key={idx} className={styles.keywordItem}>
                    <span className={styles.keywordText} style={{color: '#e50914'}}>{k.query}</span>
                    <span className={styles.keywordCount}>{k.count} failures</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE FEED TAB */}
      {activeTab === 'live' && liveStats && (
        <div className={styles.tabContent}>
          <div className={styles.liveFeedList}>
            {liveStats.sessions.map(session => (
              <div key={session.id} className={styles.feedItem}>
                <div className={styles.feedUser}>
                  <div className={styles.feedAvatar} style={{background: session.isGuest ? '#333' : '#e50914'}}></div>
                  <div className={styles.feedInfo}>
                    <h4>{session.isGuest ? `Guest #${session.id.substring(0, 4)}` : (session.name || `User #${session.userId}`)}</h4>
                    <p>{session.path}</p>
                  </div>
                </div>
                <div className={styles.feedAction}>
                  <span className={styles.actionBadge}>{session.action || 'Browsing'}</span>
                  <span className={styles.feedTime}>{Math.round((Date.now() - session.lastSeen) / 1000)}s ago</span>
                </div>
              </div>
            ))}
            {liveStats.sessions.length === 0 && <div className={styles.emptyTable}>No active users in the last 5 minutes.</div>}
          </div>
        </div>
      )}

      {/* SUPPORT TAB */}
      {activeTab === 'support' && (
        <div className={styles.tabContent}>
          <div className={styles.usersSection}>
            <div className={styles.sectionHeader}>
              <h2>Support Tickets</h2>
              <span className={styles.userCount} style={{ background: 'rgba(243, 156, 18, 0.15)', color: '#f39c12' }}>
                {supportTickets.filter(t => t.status === 'open').length} Open
              </span>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.usersTable}>
                <thead>
                  <tr><th>Type</th><th>From</th><th>Details</th><th>Date</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {supportTickets.map(ticket => (
                    <tr key={ticket.id} style={{ opacity: ticket.status === 'resolved' ? 0.6 : 1 }}>
                      <td>
                        <span className={styles.roleBadge} style={{ 
                          background: ticket.ticket_type === 'feedback' ? 'rgba(0, 113, 235, 0.1)' : ticket.ticket_type === 'feature_request' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(229, 9, 20, 0.1)', 
                          color: ticket.ticket_type === 'feedback' ? '#0071eb' : ticket.ticket_type === 'feature_request' ? '#2ecc71' : '#e50914',
                          borderColor: 'transparent'
                        }}>
                          {ticket.ticket_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className={styles.userName}>{ticket.name}</div>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        {ticket.ticket_type === 'feature_request' && <strong>{ticket.title}<br/></strong>}
                        {ticket.ticket_type === 'report_issue' && <strong>Issue: {ticket.issue_type?.replace(/_/g, ' ')}<br/></strong>}
                        <div style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
                          {ticket.message || ticket.description}
                        </div>
                      </td>
                      <td style={{ fontSize: '12px' }}>{new Date(ticket.created_at).toLocaleString()}</td>
                      <td>
                        <span style={{ 
                          color: ticket.status === 'resolved' ? '#2ecc71' : '#f39c12',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>
                          {ticket.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button 
                          className={ticket.status === 'resolved' ? styles.banBtn : styles.unbanBtn}
                          onClick={() => handleResolveTicket(ticket.id, ticket.status)}
                          disabled={resolvingTicket || currentUser.role !== 'admin'}
                          title={ticket.status === 'resolved' ? "Reopen" : "Mark Resolved"}
                        >
                          {ticket.status === 'resolved' ? <HelpCircle size={16} /> : <CheckCircle size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {supportTickets.length === 0 && (
                    <tr><td colSpan="6" className={styles.emptyTable}>No support tickets found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PERMISSION MODAL */}
      {isPermissionModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.permModal}>
            <div className={styles.modalHeader}>
              <h3>Manage Admin Permissions</h3>
              <button className={styles.closeBtn} onClick={() => setIsPermissionModalOpen(false)}><X size={20} /></button>
            </div>
            <p className={styles.modalSubtitle}>Setting access for: {selectedUserForPerms?.name}</p>
            
            <div className={styles.permGrid}>
              <div className={styles.permItem}>
                <div className={styles.permInfo}>
                  <strong>Read Access</strong>
                  <span>Can view stats, users, and logs.</span>
                </div>
                <label className={styles.switch}>
                  <input type="checkbox" checked={tempPerms.read} onChange={e => setTempPerms({...tempPerms, read: e.target.checked})} />
                  <span className={styles.slider}></span>
                </label>
              </div>
              
              <div className={styles.permItem}>
                <div className={styles.permInfo}>
                  <strong>Write Access</strong>
                  <span>Can ban users, change announcements, and block IPs.</span>
                </div>
                <label className={styles.switch}>
                  <input type="checkbox" checked={tempPerms.write} onChange={e => setTempPerms({...tempPerms, write: e.target.checked})} />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsPermissionModalOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleUpdatePermissions}>Save Permissions</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
