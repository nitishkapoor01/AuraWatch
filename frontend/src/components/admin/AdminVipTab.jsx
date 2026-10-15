import React, { useState, useEffect } from 'react';
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
  DollarSign, 
  Gift, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  Settings,
  Loader2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './AdminVipTab.module.css';

const AdminVipTab = ({ token }) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState('requests'); // 'requests' | 'codes' | 'users' | 'settings'
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // 1. Payment Requests State
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestFilter, setRequestFilter] = useState('pending');
  const [reviewingId, setReviewingId] = useState(null);

  // 2. VIP Codes State
  const [codes, setCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [codeFilter, setCodeFilter] = useState('all');
  const [codeSearch, setCodeSearch] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [generateForm, setGenerateForm] = useState({
    count: 1,
    duration_days: 30,
    plan_name: 'VIP Ad-Free 1 Month',
    prefix: 'AURA'
  });
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // 3. User VIP Manager State
  const [vipUsers, setVipUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [editingUserId, setEditingUserId] = useState(null);
  const [grantDuration, setGrantDuration] = useState(30);

  // 4. Payment Info Settings State
  const [paymentSettings, setPaymentSettings] = useState({
    upi_id: 'aurawatch@upi',
    upi_name: 'AuraWatch VIP',
    qr_image_url: '',
    plans: []
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // 5. Ad-Pass Quest Configuration State
  const [adPassSettings, setAdPassSettings] = useState({
    enabled: true,
    target_ads: 5,
    reward_hours: 24
  });
  const [savingAdPass, setSavingAdPass] = useState(false);

  const API_BASE = `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api')}`;

  const fetchAdPassSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vip/ad-pass-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdPassSettings(data);
      }
    } catch (_) {}
  };

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

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/requests?status=${requestFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (_) {}
    setLoadingRequests(false);
  };

  const fetchCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/codes?filter=${codeFilter}&search=${encodeURIComponent(codeSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch (_) {}
    setLoadingCodes(false);
  };

  const fetchVipUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/users?filter=${userFilter}&search=${encodeURIComponent(userSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVipUsers(data.users || []);
      }
    } catch (_) {}
    setLoadingUsers(false);
  };

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vip/payment-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentSettings(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  useEffect(() => {
    if (subTab === 'requests') fetchRequests();
    if (subTab === 'codes') fetchCodes();
    if (subTab === 'users') fetchVipUsers();
    if (subTab === 'settings') {
      fetchPaymentSettings();
      fetchAdPassSettings();
    }
  }, [subTab, requestFilter, codeFilter, userFilter]);

  // Handle Review Request
  const handleReviewRequest = async (id, status) => {
    setReviewingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/requests/${id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        fetchRequests();
        fetchOverview();
      } else {
        showToast(data.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Network error while reviewing request', 'error');
    }
    setReviewingId(null);
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

  // Handle Save Payment Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vip/payment-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(paymentSettings)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('VIP payment configuration saved!', 'success');
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Network error saving settings', 'error');
    }
    setSavingSettings(false);
  };

  const handleCopyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Handle Save Ad-Pass Quest Settings
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
        showToast('Ad-Pass Quest configuration updated successfully!', 'success');
      } else {
        showToast('Failed to save Ad-Pass settings', 'error');
      }
    } catch (_) {
      showToast('Network error saving Ad-Pass settings', 'error');
    }
    setSavingAdPass(false);
  };

  // Quick 1-click copy for Telegram / Discord giveaway drops
  const handleCopyAllTelegramCodes = () => {
    const activeCodes = codes.filter(c => c.is_active);
    if (activeCodes.length === 0) {
      showToast('No active codes found in current list to copy.', 'error');
      return;
    }
    const text = `🎉 AURA VIP PASS GIVEAWAY! 🎉\nRedeem on AuraWatch to unlock 100% Ad-Free streaming:\n\n` +
      activeCodes.map(c => `🔑 ${c.code} (${c.duration_days} Days)`).join('\n') +
      `\n\n⚡ First come, first served! Enjoy 0s downloads & zero ads! 🔥`;
    navigator.clipboard.writeText(text);
    showToast(`Copied ${activeCodes.length} VIP keys for Telegram/Discord drop!`, 'success');
  };


  return (
    <div className={styles.container}>
      {/* Overview Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(255, 183, 3, 0.15)', color: '#ffb703' }}>
            <Crown size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.activeVipUsers ?? 0}</h3>
            <p>Active VIP Users</p>
            <span className={styles.statSub}>100% Zero Ads Active</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.pendingRequests ?? 0}</h3>
            <p>Pending UPI Verifications</p>
            <span className={styles.statSub}>Requires admin review</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <DollarSign size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>₹{overview?.totalRevenue?.toLocaleString() ?? 0}</h3>
            <p>Verified Revenue</p>
            <span className={styles.statSub}>From approved UPI requests</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Gift size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{overview?.activeCodes ?? 0}</h3>
            <p>Active Gift Codes</p>
            <span className={styles.statSub}>Ready for redemption</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTabBtn} ${subTab === 'requests' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('requests')}
        >
          <Clock size={16} />
          <span>Payment Requests</span>
          {overview?.pendingRequests > 0 && (
            <span className={styles.pendingBadge}>{overview.pendingRequests}</span>
          )}
        </button>

        <button
          className={`${styles.subTabBtn} ${subTab === 'codes' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('codes')}
        >
          <Gift size={16} />
          <span>Gift Codes Manager</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${subTab === 'users' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('users')}
        >
          <Users size={16} />
          <span>VIP Users Directory</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${subTab === 'settings' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('settings')}
        >
          <Settings size={16} />
          <span>UPI & QR Settings</span>
        </button>
      </div>

      {/* 1. PAYMENT REQUESTS SUBTAB */}
      {subTab === 'requests' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>UPI Payment Requests</h3>
              <p className={styles.sectionDesc}>Review and verify user-submitted UPI UTR reference numbers.</p>
            </div>
            <div className={styles.filterGroup}>
              <select
                className={styles.selectFilter}
                value={requestFilter}
                onChange={e => setRequestFilter(e.target.value)}
              >
                <option value="pending">Pending ({overview?.pendingRequests || 0})</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All Requests</option>
              </select>
              <button className={styles.refreshBtn} onClick={fetchRequests} title="Refresh">
                <RefreshCw size={14} className={loadingRequests ? styles.spinner : ''} />
              </button>
            </div>
          </div>

          {loadingRequests ? (
            <div className={styles.loadingState}>
              <Loader2 size={24} className={styles.spinner} />
              <span>Loading payment requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className={styles.emptyState}>No payment requests found for this filter.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>UTR / Ref Number</th>
                    <th>Amount</th>
                    <th>Duration</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div className={styles.userCell}>
                          <strong>{req.user_name}</strong>
                          <span className={styles.subText}>{req.user_email}</span>
                        </div>
                      </td>
                      <td>
                        <code className={styles.utrCode}>{req.utr_number}</code>
                        {req.screenshot_url && (
                          <a 
                            href={req.screenshot_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={styles.screenshotLink}
                          >
                            <ExternalLink size={12} /> View Proof
                          </a>
                        )}
                      </td>
                      <td><strong>₹{req.amount}</strong></td>
                      <td>{req.plan_duration_days} Days</td>
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`${styles.statusPill} ${styles[req.status]}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === 'pending' ? (
                          <div className={styles.actionBtns}>
                            <button
                              className={styles.approveBtn}
                              disabled={reviewingId === req.id}
                              onClick={() => handleReviewRequest(req.id, 'approved')}
                              title="Approve & Grant VIP"
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              className={styles.rejectBtn}
                              disabled={reviewingId === req.id}
                              onClick={() => handleReviewRequest(req.id, 'rejected')}
                              title="Reject Request"
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className={styles.reviewedBy}>
                            by {req.reviewer_name || 'Admin'}
                          </span>
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

      {/* 2. VIP GIFT CODES SUBTAB */}
      {subTab === 'codes' && (
        <div className={styles.subGrid}>
          {/* Generator Card */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Generate VIP Gift Codes</h3>
            <p className={styles.sectionDesc}>Create redeemable codes for giveaways, VIP members, or manual orders.</p>

            <form onSubmit={handleGenerateCodes} className={styles.generateForm}>
              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Quantity (1-50)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={generateForm.count}
                    onChange={e => setGenerateForm({ ...generateForm, count: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formCol}>
                  <label>Duration (Days)</label>
                  <select
                    value={generateForm.duration_days}
                    onChange={e => setGenerateForm({ ...generateForm, duration_days: e.target.value })}
                  >
                    <option value={7}>7 Days (1 Week)</option>
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={90}>90 Days (3 Months)</option>
                    <option value={180}>180 Days (6 Months)</option>
                    <option value={365}>365 Days (1 Year)</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Plan Label</label>
                  <input
                    type="text"
                    value={generateForm.plan_name}
                    onChange={e => setGenerateForm({ ...generateForm, plan_name: e.target.value })}
                    placeholder="VIP Ad-Free"
                  />
                </div>
                <div className={styles.formCol}>
                  <label>Code Prefix</label>
                  <input
                    type="text"
                    value={generateForm.prefix}
                    onChange={e => setGenerateForm({ ...generateForm, prefix: e.target.value.toUpperCase() })}
                    placeholder="AURA"
                    maxLength={8}
                  />
                </div>
              </div>

              <button
                type="submit"
                className={styles.generateBtn}
                disabled={generatingCodes}
              >
                {generatingCodes ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Generate Codes Now</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Existing Codes Table */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Existing VIP Codes</h3>
                <p className={styles.sectionDesc}>Manage generated codes and view redemption logs.</p>
              </div>
              <div className={styles.filterGroup}>
                <input
                  type="text"
                  placeholder="Search code..."
                  value={codeSearch}
                  onChange={e => setCodeSearch(e.target.value)}
                  className={styles.searchInput}
                  onKeyDown={e => e.key === 'Enter' && fetchCodes()}
                />
                <select
                  className={styles.selectFilter}
                  value={codeFilter}
                  onChange={e => setCodeFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active Only</option>
                  <option value="used">Redeemed</option>
                </select>
                <button
                  type="button"
                  className={styles.approveBtn}
                  onClick={handleCopyAllTelegramCodes}
                  title="Copy formatted list of all active codes for Telegram or Discord drops"
                  style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Copy size={13} />
                  <span>Copy for Telegram</span>
                </button>
                <button className={styles.refreshBtn} onClick={fetchCodes} title="Refresh">
                  <RefreshCw size={14} className={loadingCodes ? styles.spinner : ''} />
                </button>
              </div>
            </div>

            {loadingCodes ? (
              <div className={styles.loadingState}>
                <Loader2 size={24} className={styles.spinner} />
                <span>Loading codes...</span>
              </div>
            ) : codes.length === 0 ? (
              <div className={styles.emptyState}>No codes found matching criteria.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Duration</th>
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
                            <code>{c.code}</code>
                            <button
                              className={styles.iconCopyBtn}
                              onClick={() => handleCopyCode(c.code, c.id)}
                              title="Copy Code"
                            >
                              {copiedCodeId === c.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                        <td>{c.duration_days} Days</td>
                        <td>
                          <span className={`${styles.statusPill} ${c.is_active ? styles.approved : styles.rejected}`}>
                            {c.is_active ? 'Active' : 'Redeemed'}
                          </span>
                        </td>
                        <td>
                          {c.used_by_name ? (
                            <span className={styles.subText}>{c.used_by_name} ({c.used_by_email})</span>
                          ) : (
                            <span className={styles.dimText}>—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteCode(c.id)}
                            title="Delete Code"
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

      {/* 3. VIP USERS DIRECT MANAGER */}
      {subTab === 'users' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>User VIP Directory</h3>
              <p className={styles.sectionDesc}>Directly grant, extend, or revoke 100% ad-free VIP access for any user.</p>
            </div>
            <div className={styles.filterGroup}>
              <input
                type="text"
                placeholder="Search user name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className={styles.searchInput}
                onKeyDown={e => e.key === 'Enter' && fetchVipUsers()}
              />
              <select
                className={styles.selectFilter}
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="active">Active VIP Only</option>
                <option value="expired">Expired VIP</option>
                <option value="free">Free Users</option>
              </select>
              <button className={styles.refreshBtn} onClick={fetchVipUsers} title="Refresh">
                <RefreshCw size={14} className={loadingUsers ? styles.spinner : ''} />
              </button>
            </div>
          </div>

          {loadingUsers ? (
            <div className={styles.loadingState}>
              <Loader2 size={24} className={styles.spinner} />
              <span>Loading users...</span>
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
                    <th>Expires At</th>
                    <th>Plan / Activated Via</th>
                    <th>Manage Access</th>
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
                        <span className={`${styles.statusPill} ${u.is_premium ? styles.approved : styles.rejected}`}>
                          {u.is_premium ? '👑 VIP ACTIVE' : 'Free Tier'}
                        </span>
                      </td>
                      <td>
                        {u.premium_expires_at
                          ? new Date(u.premium_expires_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <span className={styles.subText}>
                          {u.premium_plan || 'free'} · {u.premium_activated_by || 'standard'}
                        </span>
                      </td>
                      <td>
                        {editingUserId === u.id ? (
                          <div className={styles.actionRowInline}>
                            <select
                              value={grantDuration}
                              onChange={e => setGrantDuration(parseInt(e.target.value))}
                              className={styles.miniSelect}
                            >
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

      {/* 4. SETTINGS SUBTAB */}
      {subTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Ad-Pass Quest Configuration */}
          <div className={styles.sectionCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Crown size={22} color="#ffb703" />
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Gamified Ad-Pass Quest Configuration</h3>
            </div>
            <p className={styles.sectionDesc}>
              Allow users and guests to unlock 100% Ad-Free VIP Pass by watching sponsor ads instead of paying.
            </p>

            <form onSubmit={handleSaveAdPassSettings} className={styles.settingsForm}>
              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Enable Ad-Pass Quest</label>
                  <select
                    value={adPassSettings.enabled ? 'true' : 'false'}
                    onChange={e => setAdPassSettings({ ...adPassSettings, enabled: e.target.value === 'true' })}
                  >
                    <option value="true">Active (Enabled across player and VIP modal)</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className={styles.formCol}>
                  <label>Target Ads Required</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={adPassSettings.target_ads}
                    onChange={e => setAdPassSettings({ ...adPassSettings, target_ads: e.target.value })}
                    required
                  />
                  <small style={{ color: '#888', marginTop: '4px' }}>Recommended: 5 to 10 ads for optimal monetization</small>
                </div>
                <div className={styles.formCol}>
                  <label>Reward Duration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={adPassSettings.reward_hours}
                    onChange={e => setAdPassSettings({ ...adPassSettings, reward_hours: e.target.value })}
                    required
                  />
                  <small style={{ color: '#888', marginTop: '4px' }}>24 Hours = 1 Day VIP Pass, 48 Hours = 2 Days</small>
                </div>
              </div>

              <button
                type="submit"
                className={styles.saveSettingsBtn}
                disabled={savingAdPass}
                style={{ background: 'linear-gradient(135deg, #ffb703, #ff7a00)', color: '#000', fontWeight: '700' }}
              >
                {savingAdPass ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>Saving Ad-Pass...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Save Ad-Pass Configuration</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* UPI & Payment Settings */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>UPI & Payment Configuration (Optional)</h3>
            <p className={styles.sectionDesc}>Customize the UPI receiver account, QR code image, and public pricing tiers.</p>

            <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Receiver UPI ID</label>
                  <input
                    type="text"
                    value={paymentSettings.upi_id}
                    onChange={e => setPaymentSettings({ ...paymentSettings, upi_id: e.target.value })}
                    placeholder="e.g. aurawatch@upi"
                    required
                  />
                </div>
                <div className={styles.formCol}>
                  <label>Payee Name / Title</label>
                  <input
                    type="text"
                    value={paymentSettings.upi_name}
                    onChange={e => setPaymentSettings({ ...paymentSettings, upi_name: e.target.value })}
                    placeholder="AuraWatch VIP"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Custom QR Code Image URL (Leave blank to auto-generate)</label>
                  <input
                    type="url"
                    value={paymentSettings.qr_image_url}
                    onChange={e => setPaymentSettings({ ...paymentSettings, qr_image_url: e.target.value })}
                    placeholder="https://.../my-qr.png"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={styles.saveSettingsBtn}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>Saving Configuration...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Save Payment Settings</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVipTab;
