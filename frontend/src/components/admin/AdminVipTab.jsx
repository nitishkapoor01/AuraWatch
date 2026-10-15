import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, 
  Check, 
  X, 
  Copy, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Users, 
  Clock, 
  Gift, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Settings,
  Loader2,
  Sparkles,
  Flame,
  Award
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './AdminVipTab.module.css';

const DEFAULT_TIERS = [
  { id: '1_day', name: 'Daily Pass', target_ads: 5, reward_hours: 24, label: '24 Hours (1 Day)' },
  { id: '2_days', name: '2-Day Pass', target_ads: 10, reward_hours: 48, label: '48 Hours (2 Days)' },
  { id: '5_days', name: '5-Day Pass', target_ads: 20, reward_hours: 120, label: '120 Hours (5 Days)' }
];

const AdminVipTab = ({ token }) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState('ad_pass'); // 'ad_pass' | 'codes' | 'users'
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // 1. Ad-Pass Quest Configuration State
  const [adPassSettings, setAdPassSettings] = useState({
    enabled: true,
    target_ads: 5,
    reward_hours: 24,
    tiers: DEFAULT_TIERS
  });
  const [savingAdPass, setSavingAdPass] = useState(false);

  // 2. VIP Codes State
  const [codes, setCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [codeFilter, setCodeFilter] = useState('all');
  const [codeSearch, setCodeSearch] = useState('');
  const [debouncedCodeSearch, setDebouncedCodeSearch] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [generateForm, setGenerateForm] = useState({
    count: 10,
    duration_days: 30,
    plan_name: 'VIP Ad-Free 1 Month',
    prefix: 'AURA'
  });
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // 3. User VIP Manager State
  const [vipUsers, setVipUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [editingUserId, setEditingUserId] = useState(null);
  const [grantDuration, setGrantDuration] = useState(30);

  // 4. Live Ad-Pass Quests & Viewers Activity State
  const [quests, setQuests] = useState([]);
  const [questSummary, setQuestSummary] = useState(null);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [questFilter, setQuestFilter] = useState('all');
  const [questSearch, setQuestSearch] = useState('');
  const [debouncedQuestSearch, setDebouncedQuestSearch] = useState('');

  const API_BASE = `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api')}`;

  // Debounce search inputs to eliminate typing lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCodeSearch(codeSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [codeSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuestSearch(questSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [questSearch]);

  // Fetch Overview Stats
  const fetchOverview = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vip/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (_) {}
    setLoadingOverview(false);
  };

  // Fetch Ad-Pass Configuration
  const fetchAdPassSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vip/ad-pass-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdPassSettings({
          ...data,
          tiers: data.tiers?.length ? data.tiers : DEFAULT_TIERS
        });
      }
    } catch (_) {}
  };

  // Fetch Live Ad-Pass Viewer Quests
  const fetchQuests = async () => {
    setLoadingQuests(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/ad-pass/quests?filter=${questFilter}&search=${encodeURIComponent(debouncedQuestSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuests(data.quests || []);
        if (data.summary) setQuestSummary(data.summary);
      }
    } catch (_) {}
    setLoadingQuests(false);
  };

  // Reset or Delete Ad-Pass Quest
  const handleDeleteQuest = async (id) => {
    if (!window.confirm('Reset this viewer quest record?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/vip/ad-pass/quests/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Ad-Pass quest record reset successfully.', 'success');
        fetchQuests();
        fetchOverview();
      } else {
        showToast('Failed to reset quest record.', 'error');
      }
    } catch (_) {
      showToast('Network error resetting quest.', 'error');
    }
  };

  // Fetch Codes
  const fetchCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/codes?filter=${codeFilter}&search=${encodeURIComponent(debouncedCodeSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch (_) {}
    setLoadingCodes(false);
  };

  // Fetch VIP Users
  const fetchVipUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/users?filter=${userFilter}&search=${encodeURIComponent(debouncedUserSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVipUsers(data.users || []);
      }
    } catch (_) {}
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  useEffect(() => {
    if (subTab === 'ad_pass') {
      fetchAdPassSettings();
      fetchQuests();
    }
    if (subTab === 'codes') fetchCodes();
    if (subTab === 'users') fetchVipUsers();
  }, [subTab]);

  useEffect(() => {
    if (subTab === 'ad_pass') fetchQuests();
  }, [questFilter, debouncedQuestSearch]);

  useEffect(() => {
    if (subTab === 'codes') fetchCodes();
  }, [codeFilter, debouncedCodeSearch]);

  useEffect(() => {
    if (subTab === 'users') fetchVipUsers();
  }, [userFilter, debouncedUserSearch]);

  // Handle Save Ad-Pass Settings
  const handleSaveAdPassSettings = async (e) => {
    e.preventDefault();
    setSavingAdPass(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/ad-pass-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(adPassSettings)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Ad-Pass Quest configuration updated successfully.', 'success');
        fetchOverview();
      } else {
        showToast(data.message || 'Failed to update Ad-Pass configuration.', 'error');
      }
    } catch (_) {
      showToast('Network error saving Ad-Pass configuration.', 'error');
    }
    setSavingAdPass(false);
  };

  // Handle Tier Change
  const handleTierChange = (index, field, value) => {
    const updatedTiers = [...(adPassSettings.tiers || DEFAULT_TIERS)];
    updatedTiers[index] = {
      ...updatedTiers[index],
      [field]: field === 'target_ads' || field === 'reward_hours' ? parseInt(value, 10) || 0 : value
    };
    setAdPassSettings({
      ...adPassSettings,
      tiers: updatedTiers
    });
  };

  // Handle Generate Codes
  const handleGenerateCodes = async (e) => {
    e.preventDefault();
    setGeneratingCodes(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/codes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(generateForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        fetchCodes();
        fetchOverview();
      } else {
        showToast(data.message || 'Failed to generate codes', 'error');
      }
    } catch (err) {
      showToast('Network error while generating codes', 'error');
    }
    setGeneratingCodes(false);
  };

  // Handle Delete Code
  const handleDeleteCode = async (id) => {
    if (!window.confirm('Are you sure you want to delete this VIP code?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/vip/codes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('VIP code deleted.', 'success');
        fetchCodes();
        fetchOverview();
      }
    } catch (_) {}
  };

  // Handle Grant/Revoke User VIP
  const handleModifyUserVip = async (userId, grant) => {
    try {
      const res = await fetch(`${API_BASE}/admin/vip/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          is_premium: grant,
          duration_days: grantDuration,
          plan_name: `VIP Ad-Free (${grantDuration} Days)`
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setEditingUserId(null);
        fetchVipUsers();
        fetchOverview();
      } else {
        showToast(data.message || 'Failed to update user VIP', 'error');
      }
    } catch (err) {
      showToast('Network error updating user VIP', 'error');
    }
  };

  const handleCopyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Clean 1-click export/copy for community drops (Zero Emojis!)
  const handleCopyAllCodes = () => {
    const activeCodes = codes.filter(c => c.is_active);
    if (activeCodes.length === 0) {
      showToast('No active keys found in current list to copy.', 'error');
      return;
    }
    const text = `AURA VIP PASS GIVEAWAY KEYS\n` +
      `Redeem on AuraWatch for 100% Ad-Free Streaming:\n\n` +
      activeCodes.map(c => `${c.code} [${c.duration_days} Days]`).join('\n') +
      `\n\nInstant zero-second downloads and zero ads.`;
    navigator.clipboard.writeText(text);
    showToast(`Copied ${activeCodes.length} VIP keys to clipboard.`, 'success');
  };

  return (
    <div className={styles.container}>
      {/* Overview Metric Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(255, 183, 3, 0.15)', color: '#ffb703' }}>
            <Crown size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.activeVipUsers ?? 0}</h3>
            <p>Active VIP Users</p>
            <span className={styles.statSub}>100% Ad-Free active</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(255, 122, 0, 0.15)', color: '#ff7a00' }}>
            <Sparkles size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.activeAdQuests ?? 0}</h3>
            <p>Active Ad-Pass Quests</p>
            <span className={styles.statSub}>Watch-unlocked viewers</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Gift size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.activeCodes ?? 0}</h3>
            <p>Active Gift Codes</p>
            <span className={styles.statSub}>Ready for redemption</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#aaa' }}>
            <Clock size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.expiredVipUsers ?? 0}</h3>
            <p>Expired VIP Users</p>
            <span className={styles.statSub}>Past subscription history</span>
          </div>
        </div>
      </div>

      {/* Clean Navigation Subtabs */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTabBtn} ${subTab === 'ad_pass' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('ad_pass')}
        >
          <Sparkles size={16} />
          <span>Ad-Pass Quests & Tiers</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${subTab === 'codes' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('codes')}
        >
          <Gift size={16} />
          <span>VIP Giveaway Keys</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${subTab === 'users' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('users')}
        >
          <Users size={16} />
          <span>VIP Users Directory</span>
        </button>
      </div>

      {/* 1. AD-PASS QUESTS & TIERS SUBTAB */}
      {subTab === 'ad_pass' && (
        <>
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>Gamified Ad-Pass Milestone Configuration</h3>
              <p className={styles.sectionDesc}>
                Configure multi-tier ad watch quests so visitors earn temporary VIP passes by watching sponsor ads.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAdPassSettings} className={styles.settingsForm}>
            <div className={styles.formRow}>
              <div className={styles.formCol}>
                <label>Ad-Pass Quest Status</label>
                <select
                  value={adPassSettings.enabled ? 'true' : 'false'}
                  onChange={e => setAdPassSettings({ ...adPassSettings, enabled: e.target.value === 'true' })}
                >
                  <option value="true">Enabled (Active across Player and VIP modal)</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'block', marginBottom: '8px' }}>
                Milestone Tiers (Ads Required & Reward Duration)
              </label>

              <div className={styles.tiersList}>
                {(adPassSettings.tiers || DEFAULT_TIERS).map((tier, idx) => (
                  <div key={tier.id || idx} className={styles.tierEditorCard}>
                    <div className={styles.tierEditorHeader}>
                      <span>Tier {idx + 1}: {tier.name}</span>
                      <span style={{ fontSize: '12px', color: '#888' }}>Milestone ID: {tier.id}</span>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formCol}>
                        <label>Tier Name</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={e => handleTierChange(idx, 'name', e.target.value)}
                          placeholder="e.g. Daily Pass"
                          required
                        />
                      </div>

                      <div className={styles.formCol}>
                        <label>Target Ads Required</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={tier.target_ads}
                          onChange={e => handleTierChange(idx, 'target_ads', e.target.value)}
                          required
                        />
                      </div>

                      <div className={styles.formCol}>
                        <label>Reward Duration (Hours)</label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={tier.reward_hours}
                          onChange={e => handleTierChange(idx, 'reward_hours', e.target.value)}
                          required
                        />
                      </div>

                      <div className={styles.formCol}>
                        <label>Display Label</label>
                        <input
                          type="text"
                          value={tier.label || `${tier.reward_hours} Hours Pass`}
                          onChange={e => handleTierChange(idx, 'label', e.target.value)}
                          placeholder="e.g. 24 Hours (1 Day)"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className={styles.saveSettingsBtn}
              disabled={savingAdPass}
              style={{ background: 'linear-gradient(135deg, #ffb703, #ff7a00)', color: '#000', fontWeight: '700', marginTop: '16px' }}
            >
              {savingAdPass ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  <span>Saving Configuration...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Save Ad-Pass Milestone Settings</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Ad-Pass Viewers & Claim Activity Section */}
        <div className={styles.sectionCard} style={{ marginTop: '20px' }}>
          <div className={styles.sectionHeader} style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 className={styles.sectionTitle}>Live Ad-Pass Viewers & Claim Activity</h3>
              <p className={styles.sectionDesc}>
                Real-time monitor of visitors and registered users watching sponsor ads, claim counts, and active VIP pass durations.
              </p>
            </div>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={fetchQuests}
              disabled={loadingQuests}
              title="Refresh quest activity"
            >
              <RefreshCw size={14} className={loadingQuests ? styles.spinner : ''} />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255, 183, 3, 0.08)', border: '1px solid rgba(255, 183, 3, 0.25)', borderRadius: '8px', padding: '8px 14px', flex: '1 1 140px' }}>
              <div style={{ fontSize: '11px', color: '#ffb703', fontWeight: '700', textTransform: 'uppercase' }}>Active VIP Passes</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{questSummary?.active_passes ?? 0}</div>
            </div>
            <div style={{ background: 'rgba(0, 113, 235, 0.08)', border: '1px solid rgba(0, 113, 235, 0.25)', borderRadius: '8px', padding: '8px 14px', flex: '1 1 140px' }}>
              <div style={{ fontSize: '11px', color: '#24a1de', fontWeight: '700', textTransform: 'uppercase' }}>Total Ads Watched</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{questSummary?.total_ads_watched ?? 0}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '8px 14px', flex: '1 1 140px' }}>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>Total Quests Started</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{questSummary?.total_quests ?? 0}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '8px 14px', flex: '1 1 140px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '700', textTransform: 'uppercase' }}>Guests vs Users</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                {questSummary?.guest_quests ?? 0} Guests / {questSummary?.user_quests ?? 0} Users
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Viewers' },
                { id: 'active', label: 'Active Passes' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'guests', label: 'Guests Only' },
                { id: 'users', label: 'Registered Users' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  style={{
                    background: questFilter === f.id ? 'rgba(255, 183, 3, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: questFilter === f.id ? '1px solid #ffb703' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: questFilter === f.id ? '#ffb703' : '#aaa',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  onClick={() => setQuestFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ minWidth: '240px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#777' }} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search user, email, or visitor ID..."
                value={questSearch}
                onChange={e => setQuestSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Data Table */}
          {loadingQuests ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
              <Loader2 size={24} className={styles.spinner} style={{ margin: '0 auto 8px' }} />
              <div>Loading viewer quests...</div>
            </div>
          ) : quests.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#888', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              No ad-pass viewer activity found matching current filter.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Viewer</th>
                    <th>Ads Claimed</th>
                    <th>VIP Status</th>
                    <th>Last Ad Watched</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quests.map(q => {
                    const isUnlocked = q.is_unlocked;
                    const target = q.target_count || 5;
                    const pct = Math.min(100, Math.round(((q.current_count || 0) / target) * 100));

                    return (
                      <tr key={q.id}>
                        <td>
                          {q.user_name ? (
                            <div className={styles.userCell}>
                              <div style={{ fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{q.user_name}</span>
                                <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                                  User #{q.user_id}
                                </span>
                              </div>
                              <span className={styles.subText}>{q.user_email}</span>
                            </div>
                          ) : (
                            <div className={styles.userCell}>
                              <div style={{ fontWeight: '700', color: '#ffb703', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', background: 'rgba(255, 183, 3, 0.15)', border: '1px solid rgba(255, 183, 3, 0.3)', padding: '1px 6px', borderRadius: '4px', color: '#ffb703' }}>
                                  Guest Visitor
                                </span>
                                <code style={{ fontSize: '12px', color: '#ccc' }}>
                                  {q.visitor_id ? `${q.visitor_id.slice(0, 12)}...` : 'Anonymous'}
                                </code>
                              </div>
                              <span className={styles.subText} title={q.visitor_id}>
                                Device ID: {q.visitor_id || 'N/A'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td style={{ minWidth: '150px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                              <span style={{ color: '#ffb703' }}>{q.current_count || 0} Ads</span>
                              <span style={{ color: '#888' }}>Target: {target}</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: isUnlocked ? '#10b981' : '#ffb703', borderRadius: '3px' }} />
                            </div>
                          </div>
                        </td>

                        <td>
                          {isUnlocked ? (
                            <span className={`${styles.statusPill} ${styles.approved}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={11} />
                              <span>Active ({q.hours_remaining}h left)</span>
                            </span>
                          ) : (q.current_count > 0) ? (
                            <span className={`${styles.statusPill} ${styles.pending}`}>
                              In Progress ({q.current_count}/{target})
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#777', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
                              Expired / Not Started
                            </span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: '12px', color: '#ccc' }}>
                            {q.last_ad_completed_at ? new Date(q.last_ad_completed_at).toLocaleString() : 'N/A'}
                          </div>
                          <div className={styles.subText}>
                            Created: {new Date(q.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteQuest(q.id)}
                            title="Reset this quest record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}

      {/* 2. VIP GIVEAWAY KEYS MANAGER */}
      {subTab === 'codes' && (
        <div className={styles.subGrid}>
          {/* Generator Form */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Generate VIP Keys</h3>
                <p className={styles.sectionDesc}>Batch-generate giveaway redemption keys.</p>
              </div>
            </div>

            <form onSubmit={handleGenerateCodes} className={styles.generateForm}>
              <div className={styles.formCol}>
                <label>Number of Keys to Generate</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={generateForm.count}
                  onChange={e => setGenerateForm({ ...generateForm, count: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>

              <div className={styles.formCol}>
                <label>Pass Duration (Days)</label>
                <select
                  value={generateForm.duration_days}
                  onChange={e => setGenerateForm({ 
                    ...generateForm, 
                    duration_days: parseInt(e.target.value),
                    plan_name: `VIP Ad-Free ${e.target.value} Days`
                  })}
                >
                  <option value={1}>1 Day (24 Hours)</option>
                  <option value={2}>2 Days (48 Hours)</option>
                  <option value={7}>7 Days (1 Week)</option>
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                </select>
              </div>

              <div className={styles.formCol}>
                <label>Key Prefix</label>
                <input
                  type="text"
                  maxLength={8}
                  value={generateForm.prefix}
                  onChange={e => setGenerateForm({ ...generateForm, prefix: e.target.value.toUpperCase() })}
                  placeholder="AURA"
                  required
                />
              </div>

              <button
                type="submit"
                className={styles.generateBtn}
                disabled={generatingCodes}
              >
                {generatingCodes ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>Generating Keys...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Generate {generateForm.count} Keys</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Keys List */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Redemption Keys Directory</h3>
                <p className={styles.sectionDesc}>Manage generated keys.</p>
              </div>

              <div className={styles.filterGroup}>
                <button
                  className={styles.exportBtn}
                  onClick={handleCopyAllCodes}
                  title="Copy all active keys to clipboard"
                >
                  <Copy size={13} /> Copy Active Keys
                </button>

                <div className={styles.searchWrapper}>
                  <Search size={14} className={styles.searchIcon} />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search key code..."
                    value={codeSearch}
                    onChange={e => setCodeSearch(e.target.value)}
                  />
                </div>

                <select
                  className={styles.selectFilter}
                  value={codeFilter}
                  onChange={e => setCodeFilter(e.target.value)}
                >
                  <option value="all">All Keys</option>
                  <option value="active">Active Only</option>
                  <option value="used">Redeemed</option>
                </select>

                <button className={styles.refreshBtn} onClick={fetchCodes} title="Refresh">
                  <RefreshCw size={14} className={loadingCodes ? styles.spinner : ''} />
                </button>
              </div>
            </div>

            {loadingCodes ? (
              <div className={styles.loadingState}>
                <Loader2 size={24} className={styles.spinner} />
                <span>Loading VIP keys...</span>
              </div>
            ) : codes.length === 0 ? (
              <div className={styles.emptyState}>No VIP keys match your query.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Redemption Key</th>
                      <th>Duration</th>
                      <th>Plan Name</th>
                      <th>Status</th>
                      <th>Redeemed By</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className={styles.codeCell}>
                            <code className={styles.keyString}>{c.code}</code>
                            <button
                              className={styles.miniCopyBtn}
                              onClick={() => handleCopyCode(c.code, c.id)}
                              title="Copy Key"
                            >
                              {copiedCodeId === c.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                        <td>{c.duration_days} Days</td>
                        <td>{c.plan_name || 'VIP Ad-Free'}</td>
                        <td>
                          <span className={`${styles.statusPill} ${c.is_active ? styles.active : styles.used}`}>
                            {c.is_active ? 'Active' : 'Redeemed'}
                          </span>
                        </td>
                        <td>
                          {c.used_by_email ? (
                            <span className={styles.subText}>{c.used_by_email}</span>
                          ) : c.used_at ? (
                            <span className={styles.subText}>Guest Visitor</span>
                          ) : (
                            <span className={styles.mutedText}>Unused</span>
                          )}
                        </td>
                        <td>
                          <button
                            className={styles.deleteIconBtn}
                            onClick={() => handleDeleteCode(c.id)}
                            title="Delete Key"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. VIP USERS DIRECTORY SUBTAB */}
      {subTab === 'users' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>VIP User Membership Directory</h3>
              <p className={styles.sectionDesc}>Directly grant or revoke VIP membership for registered users.</p>
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.searchWrapper}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>

              <select
                className={styles.selectFilter}
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
              >
                <option value="all">All Registered Users</option>
                <option value="active">Active VIP Only</option>
                <option value="expired">Expired VIP</option>
                <option value="free">Standard Free</option>
              </select>

              <button className={styles.refreshBtn} onClick={fetchVipUsers} title="Refresh">
                <RefreshCw size={14} className={loadingUsers ? styles.spinner : ''} />
              </button>
            </div>
          </div>

          {loadingUsers ? (
            <div className={styles.loadingState}>
              <Loader2 size={24} className={styles.spinner} />
              <span>Loading user directory...</span>
            </div>
          ) : vipUsers.length === 0 ? (
            <div className={styles.emptyState}>No users found.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>VIP Status</th>
                    <th>Plan</th>
                    <th>Expires On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vipUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className={styles.userCell}>
                          <strong>{u.name}</strong>
                          <span className={styles.subText}>{u.email}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${u.is_premium ? styles.active : styles.free}`}>
                          {u.is_premium ? 'VIP Active' : 'Free Tier'}
                        </span>
                      </td>
                      <td>{u.premium_plan || 'Standard'}</td>
                      <td>
                        {u.premium_expires_at ? (
                          new Date(u.premium_expires_at).toLocaleDateString()
                        ) : u.is_premium ? (
                          'Lifetime'
                        ) : (
                          <span className={styles.mutedText}>None</span>
                        )}
                      </td>
                      <td>
                        {editingUserId === u.id ? (
                          <div className={styles.actionRowInline}>
                            <select
                              value={grantDuration}
                              onChange={e => setGrantDuration(parseInt(e.target.value))}
                              className={styles.miniSelect}
                            >
                              <option value={1}>1 Day</option>
                              <option value={2}>2 Days</option>
                              <option value={7}>7 Days</option>
                              <option value={30}>30 Days</option>
                              <option value={90}>90 Days</option>
                              <option value={365}>365 Days</option>
                            </select>
                            <button
                              className={styles.approveBtn}
                              onClick={() => handleModifyUserVip(u.id, true)}
                            >
                              Grant VIP
                            </button>
                            {u.is_premium && (
                              <button
                                className={styles.rejectBtn}
                                onClick={() => handleModifyUserVip(u.id, false)}
                              >
                                Revoke
                              </button>
                            )}
                            <button
                              className={styles.cancelBtn}
                              onClick={() => setEditingUserId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className={styles.editBtn}
                            onClick={() => setEditingUserId(u.id)}
                          >
                            Edit VIP Status
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminVipTab;
