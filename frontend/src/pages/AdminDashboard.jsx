import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Trash2, ShieldAlert, Film, Clock, BarChart3, AlertCircle, 
  Activity, Calendar, CalendarDays, CalendarCheck, Info, AlertTriangle, 
  X, LayoutDashboard, Shield, BarChart, Zap, Search as SearchIcon,
  Ban, ShieldCheck, UserCog, History, MessageSquare, CheckCircle, HelpCircle,
  Download, List, Palette, Play, Loader2, DollarSign, Eye, TrendingUp, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const { token, isLoggedIn, user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data States
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Audience Country Analytics States
  const [countryStats, setCountryStats] = useState({ countries: [], totalTracked: 0, totalCountries: 0, topCountry: null, period: 'all_time' });
  const [countryPeriod, setCountryPeriod] = useState('all_time');
  const [loadingCountries, setLoadingCountries] = useState(false);
  
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
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedTicketForReply, setSelectedTicketForReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // Control States
  const [announcement, setAnnouncement] = useState({ active: false, message: '', type: 'info' });
  const [platformUpdates, setPlatformUpdates] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ skip_ads_timer: false });
  const [buttonWarnings, setButtonWarnings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [newBlockIp, setNewBlockIp] = useState({ ip: '', reason: '' });

  // Ads & Monetization States
  const [adStats, setAdStats] = useState(null);
  const [adsConfig, setAdsConfig] = useState({
    enabled: true,
    download_modal: {
      enabled: true,
      timer_seconds: 30,
      format: 'native',
      container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
      key: 'ccd684eb4f620dcc7303d2fce2577bae',
      script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
      width: 300,
      height: 250
    },
    movie_detail: {
      enabled: true,
      format: 'native',
      container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
      key: 'ccd684eb4f620dcc7303d2fce2577bae',
      script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
      width: 728,
      height: 180
    },
    search_grid: {
      enabled: true,
      format: 'native',
      container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
      key: 'ccd684eb4f620dcc7303d2fce2577bae',
      script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
      width: 300,
      height: 250
    },
    social_bar: {
      enabled: false,
      script_url: ''
    }
  });
  const [savingAdsConfig, setSavingAdsConfig] = useState(false);

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
        if (settings.platform_updates) {
          setPlatformUpdates(settings.platform_updates);
        }
      }
      
      if (announcementRes.ok) {
        const announcementData = await announcementRes.json();
        if (announcementData) setAnnouncement(announcementData);
      }
      
      // Preload audience countries for summary
      fetchCountryAnalytics('all_time');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const fetchCountryAnalytics = async (period = countryPeriod) => {
    try {
      setLoadingCountries(true);
      const headers = { Authorization: `Bearer ${token}` };
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const res = await fetch(`${baseUrl}/admin/analytics/countries?period=${period}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCountryStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch country analytics', e);
    } finally {
      setLoadingCountries(false);
    }
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
      fetchCountryAnalytics(countryPeriod);
    } else if (tab === 'users') {
      const visitorsRes = await fetch(`${baseUrl}/admin/visitors`, { headers });
      if (visitorsRes.ok) setVisitors(await visitorsRes.json());
    } else if (tab === 'support') {
      const supportRes = await fetch(`${baseUrl}/support`, { headers });
      if (supportRes.ok) setSupportTickets(await supportRes.json());
    } else if (tab === 'ads') {
      const adsRes = await fetch(`${baseUrl}/admin/ads/stats`, { headers });
      if (adsRes.ok) {
        const data = await adsRes.json();
        setAdStats(data);
        if (data.config) {
          setAdsConfig(prev => ({ ...prev, ...data.config }));
        }
      }
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
      showToast('Announcement updated successfully!', 'success');
    } catch (e) { 
      console.error(e);
      showToast('Failed to save announcement', 'error');
    }
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
      if (value) {
        showToast('Button warning saved!', 'success');
      } else {
        showToast('Warning removed!', 'info');
      }
    } catch (e) { 
      console.error(e);
      showToast('Failed to update button warnings', 'error');
    }
    finally { setSavingSettings(false); }
  };

  const handleSaveUpdates = async () => {
    try {
      setSavingUpdates(true);
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: 'platform_updates', value: platformUpdates })
      });
      showToast('Platform updates saved!', 'success');
    } catch (e) { 
      console.error(e);
      showToast('Failed to save updates', 'error');
    }
    finally { setSavingUpdates(false); }
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
      showToast(`Setting ${key} updated!`, 'info');
    } catch (e) { 
      console.error(e);
      showToast('Failed to update setting', 'error');
    }
    finally { setSavingSettings(false); }
  };

  const handleSaveAdsConfig = async () => {
    try {
      setSavingAdsConfig(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const res = await fetch(`${baseUrl}/admin/ads/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config: adsConfig })
      });
      if (res.ok) {
        showToast('Ads configuration saved successfully!', 'success');
        fetchTabSpecificData('ads');
      } else {
        showToast('Failed to save ads config', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error saving ads configuration', 'error');
    } finally {
      setSavingAdsConfig(false);
    }
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

  const handleSendReply = async () => {
    if (!selectedTicketForReply || !replyText.trim()) {
      showToast('Please enter a reply message', 'warning');
      return;
    }
    try {
      setSendingReply(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const res = await fetch(`${baseUrl}/support/${selectedTicketForReply.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_reply: replyText.trim() })
      });
      if (res.ok) {
        const updated = await res.json();
        setSupportTickets(supportTickets.map(t => t.id === updated.id ? updated : t));
        showToast('Reply sent as AuraWatch Official Support!', 'success');
        setReplyModalOpen(false);
        setSelectedTicketForReply(null);
        setReplyText('');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.msg || 'Failed to send reply', 'error');
      }
    } catch (e) {
      console.error('Failed to send reply', e);
      showToast('Error sending reply', 'error');
    } finally {
      setSendingReply(false);
    }
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
        <button className={`${styles.tabBtn} ${activeTab === 'ads' ? styles.activeTab : ''}`} onClick={() => setActiveTab('ads')}>
          <DollarSign size={18} /> Ads & Monetization
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && stats && (
        <div className={styles.tabContent}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(229, 9, 20, 0.15)', color: '#e50914' }}><Users size={28} /></div>
              <div className={styles.statInfo}><h3>{stats?.uniqueVisitorsToday}</h3><p>Unique Visitors Today</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}><Zap size={28} /></div>
              <div className={styles.statInfo}><h3>{liveStats?.total || 0}</h3><p>Users Online Now</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(39, 174, 96, 0.15)', color: '#27ae60' }}><CheckCircle size={28} /></div>
              <div className={styles.statInfo}><h3>{stats?.totalWatches || 0}</h3><p>Completed Watches</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.15)', color: '#0071eb' }}><Activity size={28} /></div>
              <div className={styles.statInfo}><h3>{stats?.totalAttempts || 0}</h3><p>Total Clicks</p></div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6' }}><Clock size={28} /></div>
              <div className={styles.statInfo}><h3>{Math.round(stats?.totalWatchTimeHours || 0)}h</h3><p>Total Watch Time</p></div>
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
            <div className={styles.sectionHeader}><h2><Shield size={20} style={{marginRight: '10px'}}/> Feature Controls</h2></div>
            <div className={styles.settingsGrid}>
              <div className={styles.settingCard}>
                <div className={styles.settingInfo}>
                  <h3><Zap size={18} color="#2ecc71" /> Skip Download Timer</h3>
                  <p>Users bypass the 30s wait when enabled. Best for premium UX.</p>
                </div>
                <button 
                  className={`${styles.toggleBtn} ${globalSettings.skip_ads_timer ? styles.active : ''}`} 
                  onClick={() => handleUpdateSetting('skip_ads_timer', !globalSettings.skip_ads_timer)} 
                  disabled={savingSettings || currentUser.role !== 'admin'}
                >
                  <div className={styles.toggleThumb}></div>
                </button>
              </div>
            </div>
            
            <div className={styles.sectionHeader} style={{ marginTop: '40px' }}><h2><BarChart3 size={20} style={{marginRight: '10px'}}/> Button Warnings & Tooltips</h2></div>
            <div className={styles.settingsGrid}>
              {[
                { id: 'play_movie', label: 'Play Now Button', icon: <Play size={16} /> },
                { id: 'download_movie', label: 'Download Button', icon: <Download size={16} /> },
                { id: 'watch_trailer', label: 'Watch Trailer', icon: <Film size={16} /> },
                { id: 'add_to_list', label: 'Add to List', icon: <List size={16} /> },
                { id: 'customize_ui', label: 'Customize UI', icon: <Palette size={16} /> }
              ].map(btn => (
                <div key={btn.id} className={styles.settingCard} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '20px' }}>
                  <div className={styles.settingInfo}>
                    <h3>{btn.icon} {btn.label}</h3>
                    <p>Enter warning text to show a badge/tooltip. Clear it to remove.</p>
                  </div>
                  <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="e.g. Server maintenance tonight" 
                      className={styles.inputField} 
                      value={buttonWarnings[btn.id] || ''} 
                      onChange={e => setButtonWarnings({...buttonWarnings, [btn.id]: e.target.value})}
                    />
                    <button 
                      className={styles.primaryBtn} 
                      onClick={() => handleUpdateButtonWarnings(btn.id, buttonWarnings[btn.id])}
                      disabled={savingSettings || currentUser.role !== 'admin'}
                    >
                      <CheckCircle size={16} /> Save
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.sectionHeader} style={{ marginTop: '40px' }}><h2><MessageSquare size={20} style={{marginRight: '10px'}}/> Platform Updates Manager</h2></div>
            <div className={styles.announcementPanel}>
              <div className={styles.inputGroup}>
                <label>Update Log (Markdown/Text)</label>
                <textarea 
                  className={styles.textArea} 
                  rows={8} 
                  placeholder="e.g. 
- Fixed login bug
- Added Dark Mode
- Improved Search" 
                  value={platformUpdates} 
                  onChange={e => setPlatformUpdates(e.target.value)}
                />
              </div>
              <button 
                className={styles.primaryBtn} 
                style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                onClick={handleSaveUpdates}
                disabled={savingUpdates || currentUser.role !== 'admin'}
              >
                {savingUpdates ? <Loader2 size={18} className={styles.spinner} /> : <CheckCircle size={18} />} Save Updates
              </button>
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
                  <tr><th>Guest ID</th><th>Country</th><th>Last Action</th><th>Current Path</th><th>Last Seen</th></tr>
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
                        <span className={styles.countryTag}>
                          {guest.flag || '🌐'} {guest.countryName || 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.actionBadge} style={{ fontSize: '10px' }}>{guest.action || 'Browsing'}</span>
                      </td>
                      <td style={{ fontSize: '11px', color: '#888' }}>{guest.path}</td>
                      <td>{Math.round((Date.now() - guest.lastSeen) / 1000)}s ago</td>
                    </tr>
                  ))}
                  {(!liveStats || liveStats.sessions.filter(s => s.isGuest).length === 0) && (
                    <tr><td colSpan="5" className={styles.emptyTable}>No guests active right now.</td></tr>
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
                  <tr><th>Visitor</th><th>Country</th><th>Status</th><th>Last IP</th><th>First Seen</th><th>Last Active</th></tr>
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
                        <span className={styles.countryTag}>
                          {v.flag || '🌐'} {v.country_name || 'Unknown'}
                        </span>
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
                  {visitors.length === 0 && <tr><td colSpan="6" className={styles.emptyTable}>No historical records found.</td></tr>}
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

          {/* AUDIENCE BY COUNTRY (GEOGRAPHIC DISTRIBUTION) */}
          <div className={styles.analyticsSection} style={{ marginTop: '30px' }}>
            <div className={styles.countryHeader}>
              <div className={styles.countryTitleGroup}>
                <div className={styles.sectionIconBadge}>
                  <Globe size={22} />
                </div>
                <div>
                  <h2>Audience by Country (Geographic Distribution)</h2>
                  <p>Observability of where your platform traffic and viewers originate from</p>
                </div>
              </div>
              <div className={styles.timeframeFilter}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'weekly', label: 'Last 7 Days' },
                  { id: 'monthly', label: 'Last 30 Days' },
                  { id: 'all_time', label: 'All Time' }
                ].map(tf => (
                  <button
                    key={tf.id}
                    className={`${styles.timeframeBtn} ${countryPeriod === tf.id ? styles.timeframeBtnActive : ''}`}
                    onClick={() => {
                      setCountryPeriod(tf.id);
                      fetchCountryAnalytics(tf.id);
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stat Highlights */}
            <div className={styles.countryHighlights}>
              <div className={styles.countryHighlightCard}>
                <div className={styles.highlightLabel}>Top Audience Country</div>
                <div className={styles.highlightVal}>
                  {countryStats.topCountry ? (
                    <>
                      <span className={styles.highlightFlag}>{countryStats.topCountry.flag}</span>
                      <span>{countryStats.topCountry.countryName}</span>
                      <span className={styles.highlightPercent}>({countryStats.topCountry.percentage}%)</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '14px', color: '#666' }}>No data yet</span>
                  )}
                </div>
              </div>

              <div className={styles.countryHighlightCard}>
                <div className={styles.highlightLabel}>Countries Reached</div>
                <div className={styles.highlightVal}>
                  <Globe size={20} color="#0071eb" style={{ marginRight: '4px' }} />
                  {countryStats.totalCountries || 0} Countries
                </div>
              </div>

              <div className={styles.countryHighlightCard}>
                <div className={styles.highlightLabel}>Tracked Audience Count</div>
                <div className={styles.highlightVal}>
                  <Users size={20} color="#2ecc71" style={{ marginRight: '4px' }} />
                  {(countryStats.totalTracked || 0).toLocaleString()} Visitors
                </div>
              </div>
            </div>

            {/* Country Breakdown List */}
            <div className={styles.countryListContainer}>
              {loadingCountries ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: '#888' }}>
                  <Loader2 size={20} className={styles.spinner} /> Loading country statistics...
                </div>
              ) : countryStats.countries.length === 0 ? (
                <div className={styles.emptyTable}>No geographic visitor data recorded for this timeframe yet.</div>
              ) : (
                <div className={styles.countryGridList}>
                  {countryStats.countries.map((c, idx) => (
                    <div key={idx} className={styles.countryItemCard}>
                      <div className={styles.countryCardTop}>
                        <div className={styles.countryIdentity}>
                          <span className={styles.countryFlagIcon}>{c.flag}</span>
                          <div className={styles.countryNameBlock}>
                            <span className={styles.countryPrimaryName}>{c.countryName}</span>
                            <span className={styles.countryIsoBadge}>{c.countryCode}</span>
                          </div>
                        </div>
                        <div className={styles.countryNumbers}>
                          <span className={styles.countryCountText}>{c.count.toLocaleString()} visits / viewers</span>
                          <span className={styles.countryPercentBadge}>{c.percentage}%</span>
                        </div>
                      </div>
                      <div className={styles.countryProgressBarBg}>
                        <div 
                          className={styles.countryProgressBarFill} 
                          style={{ width: `${Math.max(c.percentage, 1.5)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIVE FEED TAB */}
      {activeTab === 'live' && liveStats && (
        <div className={styles.tabContent}>
          {liveStats.liveCountries && liveStats.liveCountries.length > 0 && (
            <div className={styles.liveCountryPills}>
              <span className={styles.liveCountryLabel}>
                <Globe size={15} /> Active Now by Country:
              </span>
              {liveStats.liveCountries.map((lc, idx) => (
                <span key={idx} className={styles.liveCountryPill}>
                  <span>{lc.flag}</span>
                  <span>{lc.name}</span>
                  <strong>{lc.count}</strong>
                </span>
              ))}
            </div>
          )}

          <div className={styles.liveFeedList}>
            {liveStats.sessions.map(session => (
              <div key={session.id} className={styles.feedItem}>
                <div className={styles.feedUser}>
                  <div className={styles.feedAvatar} style={{background: session.isGuest ? '#333' : '#e50914'}}></div>
                  <div className={styles.feedInfo}>
                    <h4>
                      {session.isGuest ? `Guest #${session.id.substring(0, 4)}` : (session.name || `User #${session.userId}`)}
                      <span className={styles.userCountryTag} title={session.countryName}>
                        {session.flag || '🌐'} {session.countryName || 'Unknown'}
                      </span>
                    </h4>
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
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>Details</th>
                    <th>Official Reply</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {supportTickets.map(ticket => (
                    <tr key={ticket.id} style={{ opacity: ticket.status === 'resolved' ? 0.75 : 1 }}>
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
                        {ticket.user_id && <span style={{ fontSize: '11px', color: '#888' }}>User #{ticket.user_id}</span>}
                        {ticket.visitor_id && !ticket.user_id && <span style={{ fontSize: '11px', color: '#666' }}>Guest</span>}
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        {ticket.ticket_type === 'feature_request' && <strong>{ticket.title}<br/></strong>}
                        {ticket.ticket_type === 'report_issue' && <strong>Issue: {ticket.issue_type?.replace(/_/g, ' ')}<br/></strong>}
                        <div style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
                          {ticket.message || ticket.description}
                        </div>
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        {ticket.admin_reply ? (
                          <div style={{ fontSize: '12px', color: '#eaeaea' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00d2ff', fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>
                              <ShieldCheck size={12} /> Official Reply:
                            </div>
                            <span style={{ color: '#ccc', fontStyle: 'italic' }}>
                              "{ticket.admin_reply.length > 70 ? ticket.admin_reply.slice(0, 70) + '...' : ticket.admin_reply}"
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#777', fontStyle: 'italic' }}>
                            Pending response
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px' }}>{new Date(ticket.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
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
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button 
                            className={styles.replyActionBtn}
                            onClick={() => {
                              setSelectedTicketForReply(ticket);
                              setReplyText(ticket.admin_reply || '');
                              setReplyModalOpen(true);
                            }}
                            title="Reply to user as AuraWatch Official Support"
                          >
                            <MessageSquare size={13} />
                            {ticket.admin_reply ? 'Edit' : 'Reply'}
                          </button>
                          <button 
                            className={ticket.status === 'resolved' ? styles.banBtn : styles.unbanBtn}
                            onClick={() => handleResolveTicket(ticket.id, ticket.status)}
                            disabled={resolvingTicket || currentUser.role !== 'admin'}
                            title={ticket.status === 'resolved' ? "Reopen" : "Mark Resolved"}
                          >
                            {ticket.status === 'resolved' ? <HelpCircle size={15} /> : <CheckCircle size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {supportTickets.length === 0 && (
                    <tr><td colSpan="7" className={styles.emptyTable}>No support tickets found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADS & MONETIZATION TAB */}
      {activeTab === 'ads' && (
        <div className={styles.tabContent}>
          {/* KPI CARDS */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(229, 9, 20, 0.15)', color: '#e50914' }}>
                <Eye size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{adStats?.todayImpressions?.toLocaleString() || 0}</h3>
                <p>Today's Ad Impressions</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}>
                <TrendingUp size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{adStats?.totalImpressions?.toLocaleString() || 0}</h3>
                <p>Total Ad Impressions</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(0, 113, 235, 0.15)', color: '#0071eb' }}>
                <Users size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{adStats?.uniqueViewersToday?.toLocaleString() || 0}</h3>
                <p>Unique Viewers Today</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6' }}>
                <Activity size={28} />
              </div>
              <div className={styles.statInfo}>
                <h3>{adStats?.uniqueViewersTotal?.toLocaleString() || 0}</h3>
                <p>All-Time Unique Viewers</p>
              </div>
            </div>
          </div>

          {/* PERFORMANCE & TRENDS */}
          <div className={styles.analyticsSection} style={{ marginTop: '30px' }}>
            <div className={styles.sectionHeader}>
              <h2><BarChart3 size={20} style={{ marginRight: '10px' }} /> 7-Day Performance & Slot Breakdown</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginTop: '20px' }}>
              {/* Daily Trend Chart */}
              <div className={styles.settingCard} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className={styles.settingInfo}>
                  <h3>Impressions Trend (Last 7 Days)</h3>
                  <p>Daily volume of ads rendered to visitors</p>
                </div>
                {adStats?.dailyTrend && adStats.dailyTrend.length > 0 ? (
                  <div className={styles.trendChart}>
                    {(() => {
                      const maxCount = Math.max(...adStats.dailyTrend.map(d => d.count), 1);
                      return adStats.dailyTrend.map((d, i) => {
                        const heightPct = Math.max((d.count / maxCount) * 100, 5);
                        const label = d.date.split('-').slice(1).join('/');
                        return (
                          <div key={i} className={styles.trendBarCol}>
                            <span className={styles.trendBarVal}>{d.count}</span>
                            <div className={styles.trendBar} style={{ height: `${heightPct}%` }}></div>
                            <span className={styles.trendBarDate}>{label}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#777' }}>
                    No impressions recorded in the last 7 days yet.
                  </div>
                )}
              </div>

              {/* Slot Breakdown */}
              <div className={styles.settingCard} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className={styles.settingInfo}>
                  <h3>Impressions by Ad Slot</h3>
                  <p>Performance comparison across active placements</p>
                </div>
                <div style={{ marginTop: '20px' }}>
                  {[
                    { id: 'download_modal', label: 'Download Modal (300x250)' },
                    { id: 'movie_detail', label: 'Movie Detail Banner (728x90)' },
                    { id: 'search_grid', label: 'Search & Category In-Feed Cards' }
                  ].map(slotItem => {
                    const found = adStats?.slotBreakdown?.find(s => s.slot === slotItem.id);
                    const impressions = found ? found.impressions : 0;
                    const visitors = found ? found.unique_visitors : 0;
                    const total = adStats?.totalImpressions || 1;
                    const pct = Math.min(Math.round((impressions / total) * 100), 100);

                    return (
                      <div key={slotItem.id} className={styles.slotProgressRow}>
                        <div className={styles.slotProgressHeader}>
                          <span>{slotItem.label}</span>
                          <span><strong>{impressions.toLocaleString()}</strong> views ({visitors} unique)</span>
                        </div>
                        <div className={styles.slotProgressBar}>
                          <div className={styles.slotProgressFill} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ADSTERRA CONFIGURATION & CONTROLS */}
          <div className={styles.analyticsSection} style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div className={styles.sectionHeader} style={{ margin: 0 }}>
                <h2><ShieldCheck size={20} style={{ marginRight: '10px' }} /> Adsterra Units & Placement Controls</h2>
                <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
                  Enable or disable individual ad formats, customize Adsterra script keys, and adjust countdown timer.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: adsConfig.enabled ? '#2ecc71' : '#e50914' }}>
                    Master Ads: {adsConfig.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <button 
                    className={`${styles.toggleBtn} ${adsConfig.enabled ? styles.active : ''}`}
                    onClick={() => setAdsConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  >
                    <div className={styles.toggleThumb}></div>
                  </button>
                </div>

                <button 
                  className={styles.primaryBtn} 
                  onClick={handleSaveAdsConfig}
                  disabled={savingAdsConfig || currentUser.role !== 'admin'}
                >
                  {savingAdsConfig ? (
                    <>
                      <Loader2 size={16} className={styles.spinner} /> SAVING...
                    </>
                  ) : (
                    'SAVE AD CONFIGURATION'
                  )}
                </button>
              </div>
            </div>

            <div className={styles.adsGrid}>
              {/* SLOT 1: DOWNLOAD MODAL */}
              <div className={styles.adSlotCard}>
                <div className={styles.adSlotHeader}>
                  <div className={styles.adSlotTitle}>
                    <Download size={20} color="#e50914" />
                    <div>
                      <h3>Download Modal Banner</h3>
                      <span style={{ fontSize: '12px', color: '#888' }}>300x250 Rectangle Ad</span>
                    </div>
                  </div>
                  <button 
                    className={`${styles.toggleBtn} ${adsConfig.download_modal?.enabled ? styles.active : ''}`}
                    onClick={() => setAdsConfig(prev => ({
                      ...prev,
                      download_modal: { ...prev.download_modal, enabled: !prev.download_modal?.enabled }
                    }))}
                  >
                    <div className={styles.toggleThumb}></div>
                  </button>
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Adsterra Unit Key</label>
                  <input 
                    type="text" 
                    className={styles.adInput}
                    value={adsConfig.download_modal?.key || ''} 
                    onChange={e => setAdsConfig(prev => ({
                      ...prev,
                      download_modal: { ...prev.download_modal, key: e.target.value.trim() }
                    }))}
                    placeholder="e.g. 8e9991a7d4aa3fef2ca28a617f3c1844"
                  />
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Script Invoke URL</label>
                  <input 
                    type="text" 
                    className={styles.adInput}
                    value={adsConfig.download_modal?.script_url || ''} 
                    onChange={e => setAdsConfig(prev => ({
                      ...prev,
                      download_modal: { ...prev.download_modal, script_url: e.target.value.trim() }
                    }))}
                    placeholder="//heavenlysuspicious.com/.../invoke.js"
                  />
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Download Wait Timer: {adsConfig.download_modal?.timer_seconds || 30}s</label>
                  <div className={styles.sliderRow}>
                    <input 
                      type="range" 
                      min="5" 
                      max="60" 
                      step="5"
                      className={styles.sliderInput}
                      value={adsConfig.download_modal?.timer_seconds || 30}
                      onChange={e => setAdsConfig(prev => ({
                        ...prev,
                        download_modal: { ...prev.download_modal, timer_seconds: Number(e.target.value) }
                      }))}
                    />
                    <span className={styles.sliderValue}>{adsConfig.download_modal?.timer_seconds || 30} sec</span>
                  </div>
                </div>
              </div>

              {/* SLOT 2: MOVIE DETAIL BANNER */}
              <div className={styles.adSlotCard}>
                <div className={styles.adSlotHeader}>
                  <div className={styles.adSlotTitle}>
                    <Film size={20} color="#0071eb" />
                    <div>
                      <h3>Movie Detail Banner</h3>
                      <span style={{ fontSize: '12px', color: '#888' }}>728x90 Leaderboard / Responsive</span>
                    </div>
                  </div>
                  <button 
                    className={`${styles.toggleBtn} ${adsConfig.movie_detail?.enabled ? styles.active : ''}`}
                    onClick={() => setAdsConfig(prev => ({
                      ...prev,
                      movie_detail: { ...prev.movie_detail, enabled: !prev.movie_detail?.enabled }
                    }))}
                  >
                    <div className={styles.toggleThumb}></div>
                  </button>
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Adsterra Unit Key</label>
                  <input 
                    type="text" 
                    className={styles.adInput}
                    value={adsConfig.movie_detail?.key || ''} 
                    onChange={e => setAdsConfig(prev => ({
                      ...prev,
                      movie_detail: { ...prev.movie_detail, key: e.target.value.trim() }
                    }))}
                    placeholder="e.g. 8e9991a7d4aa3fef2ca28a617f3c1844"
                  />
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Script Invoke URL</label>
                  <input 
                    type="text" 
                    className={styles.adInput}
                    value={adsConfig.movie_detail?.script_url || ''} 
                    onChange={e => setAdsConfig(prev => ({
                      ...prev,
                      movie_detail: { ...prev.movie_detail, script_url: e.target.value.trim() }
                    }))}
                    placeholder="//heavenlysuspicious.com/.../invoke.js"
                  />
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Placement Notes</label>
                  <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                    Appears cleanly above the "More Like This" recommendation section. Automatically adjusts on mobile view.
                  </p>
                </div>
              </div>

              {/* SLOT 3: SEARCH & CATEGORY IN-FEED CARDS */}
              <div className={styles.adSlotCard}>
                <div className={styles.adSlotHeader}>
                  <div className={styles.adSlotTitle}>
                    <LayoutDashboard size={20} color="#2ecc71" />
                    <div>
                      <h3>Search & Category In-Feed Cards</h3>
                      <span style={{ fontSize: '12px', color: '#888' }}>Native 2:3 Movie Card Format</span>
                    </div>
                  </div>
                  <button 
                    className={`${styles.toggleBtn} ${adsConfig.search_grid?.enabled ? styles.active : ''}`}
                    onClick={() => setAdsConfig(prev => ({
                      ...prev,
                      search_grid: { ...prev.search_grid, enabled: !prev.search_grid?.enabled }
                    }))}
                  >
                    <div className={styles.toggleThumb}></div>
                  </button>
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Adsterra Unit Key</label>
                  <input 
                    type="text" 
                    className={styles.adInput}
                    value={adsConfig.search_grid?.key || ''} 
                    onChange={e => setAdsConfig(prev => ({
                      ...prev,
                      search_grid: { ...prev.search_grid, key: e.target.value.trim() }
                    }))}
                    placeholder="e.g. 8e9991a7d4aa3fef2ca28a617f3c1844"
                  />
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Script Invoke URL</label>
                  <input 
                    type="text" 
                    className={styles.adInput}
                    value={adsConfig.search_grid?.script_url || ''} 
                    onChange={e => setAdsConfig(prev => ({
                      ...prev,
                      search_grid: { ...prev.search_grid, script_url: e.target.value.trim() }
                    }))}
                    placeholder="//heavenlysuspicious.com/.../invoke.js"
                  />
                </div>

                <div className={styles.adFieldGroup}>
                  <label>Placement Notes</label>
                  <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                    Appears naturally as a sponsored movie card inside Search results and Category explore grids after every 8th movie card. Zero interruption, 100% clean UX.
                  </p>
                </div>
              </div>
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

      {/* SUPPORT REPLY MODAL */}
      {replyModalOpen && selectedTicketForReply && (
        <div className={styles.replyModalOverlay} onClick={() => setReplyModalOpen(false)}>
          <div className={styles.replyModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} color="#e50914" />
                <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Reply as AuraWatch Official Support</h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setReplyModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Your response will appear permanently in the user's Support Inbox under <strong>AuraWatch Official Support</strong> with a verified badge.
            </p>

            <div className={styles.replyUserBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#e50914' }}>
                  {selectedTicketForReply.ticket_type?.toUpperCase().replace('_', ' ')}
                </span>
                <span style={{ fontSize: '11px', color: '#777' }}>
                  From: {selectedTicketForReply.name || 'Anonymous'}
                </span>
              </div>
              {selectedTicketForReply.title && (
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px', marginBottom: '4px' }}>
                  {selectedTicketForReply.title}
                </div>
              )}
              {selectedTicketForReply.issue_type && (
                <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '4px' }}>
                  Issue: {selectedTicketForReply.issue_type.replace(/_/g, ' ')}
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#ccc', whiteSpace: 'pre-wrap' }}>
                {selectedTicketForReply.description || selectedTicketForReply.message}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#aaa', marginBottom: '8px', textTransform: 'uppercase' }}>
                Official Reply Message
              </label>
              <textarea 
                className={styles.replyTextarea}
                placeholder="Type official response here (e.g. Hi, thank you for bringing this to our attention. We have updated the server source for this movie. Enjoy streaming!)..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />
            </div>

            <div className={styles.replyModalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setReplyModalOpen(false)}
                disabled={sendingReply}
              >
                Cancel
              </button>
              <button 
                className={styles.primaryBtn} 
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
              >
                {sendingReply ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} /> Sending...
                  </>
                ) : (
                  'Send as Official Support'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
