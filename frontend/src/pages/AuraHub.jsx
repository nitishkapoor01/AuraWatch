import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  Heart, 
  Send, 
  Trash2, 
  BarChart2, 
  Check, 
  Plus, 
  X, 
  Crown,
  MessageCircle,
  Clock,
  Pin
} from 'lucide-react';
import SEO from '../components/SEO';
import { getApiBaseUrl } from '../utils/apiBase';
import styles from './AuraHub.module.css';

const AuraHub = () => {
  const { user, isLoggedIn, token } = useAuth();
  
  // Instant 0ms cache loading: render previously cached posts immediately
  const [posts, setPosts] = useState(() => {
    try {
      const cached = localStorage.getItem('aurawatch_hub_cached_posts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('aurawatch_hub_cached_posts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (e) {}
    return true;
  });
  
  // Post Creator State
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [postMode, setPostMode] = useState('text'); // 'text' | 'poll'
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isAdmin = isLoggedIn && (user?.role === 'admin' || user?.is_super_admin);

  const getVisitorId = () => {
    let vid = localStorage.getItem('trackingVisitorId');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('trackingVisitorId', vid);
    }
    return vid;
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const markHubSeen = (adminTimestamp) => {
    const timeToStore = adminTimestamp ? new Date(adminTimestamp).getTime() : Date.now();
    localStorage.setItem('aura_hub_last_seen', timeToStore.toString());
    window.dispatchEvent(new Event('aura_hub_seen'));
  };

  const fetchPosts = useCallback(async () => {
    try {
      const vid = getVisitorId();
      const API_BASE = getApiBaseUrl();
      
      const headers = {};
      if (isLoggedIn && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/hub?visitorId=${vid}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const incomingPosts = data.posts || [];
        setPosts(incomingPosts);
        try {
          localStorage.setItem('aurawatch_hub_cached_posts', JSON.stringify(incomingPosts));
        } catch (e) {}

        if (data.latest_admin_post_at) {
          markHubSeen(data.latest_admin_post_at);
        } else {
          markHubSeen();
        }
      }
    } catch (err) {
      console.error('Failed to fetch hub posts:', err);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const [inFlightLikes, setInFlightLikes] = useState({});

  // Handle Like Toggle
  const handleLike = async (postId) => {
    if (inFlightLikes[postId]) return; // prevent spamming while in-flight

    setInFlightLikes(prev => ({ ...prev, [postId]: true }));
    const vid = getVisitorId();
    const API_BASE = getApiBaseUrl();

    // Optimistic UI update
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const nextLiked = !p.has_liked;
          const nextLikes = nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1);
          return { ...p, has_liked: nextLiked, likes: nextLikes };
        }
        return p;
      })
    );

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (isLoggedIn && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/hub/${postId}/like`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ visitorId: vid })
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, likes: data.likes, has_liked: data.liked } : p)
        );
      } else {
        fetchPosts();
      }
    } catch (err) {
      console.error('Like error:', err);
      fetchPosts();
    } finally {
      setInFlightLikes(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Handle Poll Vote (Instant Optimistic UI)
  const handlePollVote = async (postId, optionId) => {
    // 1. Instant 0ms Optimistic UI Update
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          if (p.user_poll_vote) return p; // already voted
          const updatedOptions = (p.poll_options || []).map(opt =>
            opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
          );
          return { ...p, poll_options: updatedOptions, user_poll_vote: optionId };
        }
        return p;
      })
    );

    const vid = getVisitorId();
    const API_BASE = getApiBaseUrl();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (isLoggedIn && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/hub/${postId}/poll-vote`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ optionId, visitorId: vid })
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, poll_options: data.poll_options, user_poll_vote: data.user_poll_vote } : p)
        );
        showToast('Vote recorded!');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Already voted');
        fetchPosts(); // Rollback on error
      }
    } catch (err) {
      console.error('Vote error:', err);
      showToast('Error casting vote');
      fetchPosts(); // Rollback on network failure
    }
  };

  // Handle Post Creation
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Please type something to post.');
      return;
    }

    if (isAdmin && postMode === 'poll') {
      const validOptions = pollOptions.filter(o => o.trim().length > 0);
      if (validOptions.length < 2) {
        showToast('Poll must have at least 2 options.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const vid = getVisitorId();
      const API_BASE = getApiBaseUrl();

      let endpoint = `${API_BASE}/hub`;
      let bodyPayload = {
        content: content.trim(),
        authorName: authorName.trim() || (user ? user.name : 'Anonymous'),
        visitorId: vid
      };

      // All posts created by Admin go to /hub/admin so they get AuraWatch Official branding & verified gradient
      if (isAdmin) {
        endpoint = `${API_BASE}/hub/admin`;
        bodyPayload = {
          content: content.trim(),
          postType: postMode === 'poll' ? 'poll' : 'text',
          pollOptions: postMode === 'poll' ? pollOptions.filter(o => o.trim().length > 0) : []
        };
      }

      const headers = { 'Content-Type': 'application/json' };
      if (isLoggedIn && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload)
      });

      if (res.ok) {
        const newPost = await res.json();
        setPosts(prev => {
          const updated = [newPost, ...prev];
          return [...updated].sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at) - new Date(a.created_at);
          });
        });
        setContent('');
        setPollOptions(['', '']);
        setPostMode('text');
        showToast('Posted to Aura Hub!');
        if (isAdmin) {
          markHubSeen(newPost.created_at);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to publish post');
      }
    } catch (err) {
      console.error('Submit error:', err);
      showToast('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Pin / Unpin Post (Admin Only)
  const handleTogglePin = async (postId) => {
    if (!isAdmin) return;
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/hub/${postId}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => {
          const updated = prev.map(p => 
            p.id === postId ? { ...p, is_pinned: data.is_pinned, pinned_at: data.pinned_at } : p
          );
          return [...updated].sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at) - new Date(a.created_at);
          });
        });
        showToast(data.message || 'Pin updated');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update pin');
      }
    } catch (err) {
      showToast('Network error');
    }
  };

  // Handle Delete Post (Admin deletes any; users delete own only)
  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      const vid = getVisitorId();
      const API_BASE = getApiBaseUrl();
      
      const headers = { 'Content-Type': 'application/json' };
      if (isLoggedIn && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/hub/${postId}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ visitorId: vid })
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        showToast('Post deleted');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Unauthorized to delete post');
      }
    } catch (err) {
      showToast('Failed to delete');
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    let iso = typeof dateStr === 'string' ? dateStr.trim() : dateStr;
    if (typeof iso === 'string' && !iso.endsWith('Z') && !iso.includes('+') && !iso.includes('-', 10)) {
      iso += 'Z';
    }
    const d = new Date(iso);
    const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className={styles.hubContainer}>
      <SEO 
        title="Aura Hub | Community Feed & Polls" 
        description="Share posts, request movies, participate in official admin polls, and like community updates on AuraWatch." 
      />

      {/* Header */}
      <div className={styles.headerWrap}>
        <div className={styles.headerBadge}>
          <Sparkles size={14} className={styles.badgeSparkle} />
          <span>COMMUNITY FEED</span>
        </div>
        <h1 className={styles.mainTitle}>
          Aura <span>Hub</span>
        </h1>
        <p className={styles.subTitle}>
          Post your thoughts, requests, or questions. Vote on official polls and connect with the community.
        </p>
      </div>

      {/* Post Composer Card */}
      <div className={styles.composerCard}>
        <div className={styles.composerHeader}>
          <div className={styles.authorIdentity}>
            <div className={`
              ${styles.authorAvatar} 
              ${isAdmin ? styles.officialAvatarRing : isLoggedIn ? styles.memberAvatarRing : styles.guestAvatarRing}
            `}>
              {isAdmin ? '👑' : isLoggedIn ? (user?.name?.charAt(0).toUpperCase() || '👤') : '🎭'}
            </div>
            <div className={styles.authorMeta}>
              <span className={`${styles.authorDisplayName} ${isAdmin ? styles.officialAuthorName : ''}`}>
                {isAdmin ? 'AuraWatch Official' : isLoggedIn ? user.name : (authorName.trim() || 'Guest Member')}
              </span>
              {isAdmin ? (
                <span className={styles.officialBadge}><Crown size={11} /> OFFICIAL</span>
              ) : isLoggedIn ? (
                <span className={styles.memberBadge}>✨ Member</span>
              ) : (
                <span className={styles.guestBadge}>🎭 Guest</span>
              )}
            </div>
          </div>

          {/* Admin Mode Switcher */}
          {isAdmin && (
            <div className={styles.adminModeDeck}>
              <button
                type="button"
                className={`${styles.modeBtn} ${postMode === 'text' ? styles.modeActive : ''}`}
                onClick={() => setPostMode('text')}
              >
                Text
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${postMode === 'poll' ? styles.modeActive : ''}`}
                onClick={() => setPostMode('poll')}
              >
                <BarChart2 size={14} /> Create Poll
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleCreatePost} className={styles.composerForm}>
          <textarea
            className={styles.postTextarea}
            placeholder={
              postMode === 'poll' 
                ? "Ask a question for the community to vote on..." 
                : "What's on your mind? Drop a request, feedback, or thought..."
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={2000}
            required
          />

          {/* Poll Options builder (Only when Admin chooses Poll mode) */}
          {isAdmin && postMode === 'poll' && (
            <div className={styles.pollBuilder}>
              <span className={styles.pollBuilderLabel}>Poll Options:</span>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className={styles.pollOptionInputRow}>
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[idx] = e.target.value;
                      setPollOptions(updated);
                    }}
                    className={styles.optionInputField}
                    maxLength={80}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      className={styles.removeOptBtn}
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}

              {pollOptions.length < 5 && (
                <button
                  type="button"
                  className={styles.addOptBtn}
                  onClick={() => setPollOptions([...pollOptions, ''])}
                >
                  <Plus size={14} /> Add Option
                </button>
              )}
            </div>
          )}

          {/* Bottom Bar */}
          <div className={styles.composerFooter}>
            {!isLoggedIn && (
              <input
                type="text"
                placeholder="Name / Handle (optional)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={40}
                className={styles.handleInput}
              />
            )}

            <button 
              type="submit" 
              className={styles.btnPublish}
              disabled={submitting || !content.trim()}
            >
              <Send size={15} />
              <span>{submitting ? 'Posting...' : 'Post'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Feed Stream */}
      <div className={styles.feedStream}>
        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner}></div>
            <p>Loading Aura Hub posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyFeed}>
            <Sparkles size={36} className={styles.emptyIcon} />
            <h3>No posts yet</h3>
            <p>Be the first one to post something in Aura Hub!</p>
          </div>
        ) : (
          posts.map(post => {
            const isPoll = post.post_type === 'poll';
            const totalPollVotes = isPoll && Array.isArray(post.poll_options) 
              ? post.poll_options.reduce((sum, o) => sum + (o.votes || 0), 0) 
              : 0;

            const currentVid = getVisitorId();
            // Admin can delete ANY post
            // Logged-in user can delete ONLY their own post
            // Guest can delete ONLY their own guest post
            const canDelete = isAdmin 
              ? true 
              : isLoggedIn 
                ? (user?.id && post.user_id === user.id) 
                : (!post.user_id && post.visitor_id && post.visitor_id === currentVid);

            return (
              <article 
                key={post.id} 
                className={`
                  ${styles.postCard} 
                  ${post.is_admin ? styles.adminHighlightCard : ''}
                  ${post.is_pinned ? styles.pinnedPostCard : ''}
                `}
              >
                {/* Pinned Ribbon */}
                {post.is_pinned && (
                  <div className={styles.pinnedRibbon}>
                    <Pin size={13} /> Pinned by Admin
                  </div>
                )}

                {/* Post Top Row */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardAuthorInfo}>
                    <div className={`
                      ${styles.cardAvatar} 
                      ${post.is_admin ? styles.officialAvatarRing : post.user_id ? styles.memberAvatarRing : styles.guestAvatarRing}
                    `}>
                      {post.is_admin ? '👑' : post.user_id ? (post.author_name?.charAt(0).toUpperCase() || '👤') : '🎭'}
                    </div>
                    <div>
                      <div className={styles.authorNameRow}>
                        <span className={`${styles.cardAuthorName} ${post.is_admin ? styles.officialAuthorName : ''}`}>
                          {post.is_admin ? (post.author_name || 'AuraWatch Official') : (post.author_name || (post.user_id ? 'Member' : 'Anonymous Guest'))}
                        </span>
                        {post.is_admin ? (
                          <span className={styles.officialBadge}>
                            <Crown size={11} /> OFFICIAL
                          </span>
                        ) : post.user_id ? (
                          <span className={styles.memberBadge}>
                            ✨ Member
                          </span>
                        ) : (
                          <span className={styles.guestBadge}>
                            🎭 Guest
                          </span>
                        )}
                      </div>
                      <div className={styles.cardTimestamp}>
                        <Clock size={11} />
                        <span>{formatRelativeTime(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    {isAdmin && (
                      <button
                        type="button"
                        className={`${styles.pinBtn} ${post.is_pinned ? styles.pinnedActive : ''}`}
                        onClick={() => handleTogglePin(post.id)}
                        title={post.is_pinned ? "Unpin post" : "Pin post to top"}
                      >
                        <Pin size={13} />
                        <span>{post.is_pinned ? 'Pinned' : 'Pin'}</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        className={styles.deletePostBtn}
                        onClick={() => handleDelete(post.id)}
                        title={isAdmin && post.user_id !== user?.id ? "Delete post (Admin)" : "Delete post"}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Text Content */}
                <p className={styles.cardContent}>{post.content}</p>

                {/* Poll Rendering */}
                {isPoll && Array.isArray(post.poll_options) && (
                  <div className={styles.pollContainer}>
                    <div className={styles.pollMeta}>
                      <span className={styles.pollTotalVotes}>{totalPollVotes} total votes</span>
                      {post.user_poll_vote && <span className={styles.votedNotice}>✓ You voted</span>}
                    </div>

                    <div className={styles.pollOptionsList}>
                      {post.poll_options.map(opt => {
                        const optVotes = opt.votes || 0;
                        const pct = totalPollVotes > 0 ? Math.round((optVotes / totalPollVotes) * 100) : 0;
                        const isUserChoice = String(post.user_poll_vote) === String(opt.id);

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`${styles.pollOptionBar} ${isUserChoice ? styles.pollSelectedBar : ''}`}
                            onClick={() => !post.user_poll_vote && handlePollVote(post.id, opt.id)}
                            disabled={!!post.user_poll_vote}
                          >
                            {/* Fill percentage background */}
                            <div 
                              className={styles.pollFill} 
                              style={{ width: `${pct}%` }} 
                            />
                            <div className={styles.pollOptionContent}>
                              <span className={styles.pollOptionText}>
                                {isUserChoice && <Check size={14} className={styles.choiceIcon} />}
                                {opt.text}
                              </span>
                              <span className={styles.pollOptionPct}>{pct}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Bar (Like Heart) */}
                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={`${styles.likeBtn} ${post.has_liked ? styles.likeActive : ''}`}
                    onClick={() => handleLike(post.id)}
                    title={post.has_liked ? "Unlike" : "Like"}
                  >
                    <Heart 
                      size={18} 
                      className={styles.heartIcon} 
                      fill={post.has_liked ? "#e50914" : "none"} 
                    />
                    <span className={styles.likeCount}>{post.likes || 0}</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className={styles.toast}>
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default AuraHub;
