import React, { useState, useEffect } from 'react';
import { 
  X, PlayCircle, BookOpen, MessageSquare, Lightbulb, AlertTriangle, 
  CheckCircle, ShieldAlert, Info, Clock, CheckCircle2, ShieldCheck, 
  Send, PlusCircle, RefreshCw, User
} from 'lucide-react';
import styles from './HelpModal.module.css';

const TABS = {
  MY_TICKETS: 'my_tickets',
  HOW_TO_USE: 'how_to_use',
  UPDATES: 'updates',
  PLAYER_GUIDE: 'player_guide',
  FEEDBACK: 'feedback',
  FEATURE_REQUEST: 'feature_request',
  REPORT_ISSUE: 'report_issue',
  DMCA: 'dmca'
};

const HelpModal = ({ isOpen, onClose, initialTab, prefillDescription, onRepliesRead }) => {
  const [activeTab, setActiveTab] = useState(initialTab || TABS.MY_TICKETS);
  const [platformUpdates, setPlatformUpdates] = useState('');
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [feedback, setFeedback] = useState({ name: '', message: '' });
  const [feature, setFeature] = useState({ title: '', description: '' });
  const [report, setReport] = useState({ type: 'video_not_playing', description: prefillDescription || '' });

  const fetchUpdates = async () => {
    try {
      setLoadingUpdates(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
      const res = await fetch(`${baseUrl}/settings/platform_updates`);
      if (res.ok) {
        const data = await res.json();
        setPlatformUpdates(data.value || '');
      }
    } catch (e) { 
      console.error('Failed to fetch updates', e); 
    } finally { 
      setLoadingUpdates(false); 
    }
  };

  const fetchMyTickets = async () => {
    try {
      setLoadingTickets(true);
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
      
      const res = await fetch(`${baseUrl}/support/my-tickets?visitorId=${encodeURIComponent(visitorId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMyTickets(data);

        // Mark any unread replies as read
        const unread = data.filter(t => t.admin_reply && !t.is_read);
        if (unread.length > 0) {
          for (const t of unread) {
            await fetch(`${baseUrl}/support/${t.id}/mark-read`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ visitorId })
            });
          }
          if (onRepliesRead) {
            onRepliesRead();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching my tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Sync initialTab and prefillDescription when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (prefillDescription) setReport(r => ({ ...r, description: prefillDescription }));
      fetchMyTickets();
      fetchUpdates();
    }
  }, [isOpen, initialTab, prefillDescription]);

  useEffect(() => {
    if (isOpen && activeTab === TABS.MY_TICKETS) {
      fetchMyTickets();
    }
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e, formType) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');

    const visitorId = localStorage.getItem('trackingVisitorId') || '';
    let payload = { visitorId };

    if (formType === 'feedback') {
      payload = { ...payload, ticketType: 'feedback', name: feedback.name, message: feedback.message };
    } else if (formType === 'feature') {
      payload = { ...payload, ticketType: 'feature_request', title: feature.title, description: feature.description };
    } else if (formType === 'report') {
      payload = { ...payload, ticketType: 'report_issue', issueType: report.type, description: report.description };
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/support`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setSuccessMessage('Successfully submitted! Check "Support Chat & Replies" for status and official responses.');
      
      // Reset form based on type
      if (formType === 'feedback') setFeedback({ name: '', message: '' });
      if (formType === 'feature') setFeature({ title: '', description: '' });
      if (formType === 'report') setReport({ type: 'video_not_playing', description: '' });

      // Refresh ticket list
      fetchMyTickets();

      // Automatically navigate to tickets chat view after 1.5 seconds
      setTimeout(() => {
        setSuccessMessage('');
        setActiveTab(TABS.MY_TICKETS);
      }, 1500);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit your request. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSuccessMessage('');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.MY_TICKETS:
        return (
          <div className={styles.section}>
            <div className={styles.chatHeaderBar}>
              <div>
                <h2 className={styles.contentTitle} style={{ margin: 0 }}>Support Inbox & Chat</h2>
                <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Permanent record of your inquiries, bug reports, and official AuraWatch responses.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className={styles.newTicketBtn} 
                  onClick={fetchMyTickets}
                  title="Refresh tickets"
                  style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc' }}
                >
                  <RefreshCw size={14} className={loadingTickets ? styles.pulseDot : ''} />
                </button>
                <button 
                  className={styles.newTicketBtn} 
                  onClick={() => handleTabChange(TABS.REPORT_ISSUE)}
                >
                  <PlusCircle size={15} /> New Report / Message
                </button>
              </div>
            </div>

            {loadingTickets && myTickets.length === 0 ? (
              <div className={styles.loadingUpdates}>
                <div className={styles.pulseDot} />
                <span>Loading your messages & replies...</span>
              </div>
            ) : myTickets.length === 0 ? (
              <div className={styles.emptyInbox}>
                <MessageSquare size={44} color="#444" />
                <p>No messages or reports yet. If you have an issue with video playback or want to request a feature, submit a ticket anytime.</p>
                <button className={styles.newTicketBtn} onClick={() => handleTabChange(TABS.REPORT_ISSUE)}>
                  <PlusCircle size={15} /> Submit an Issue or Feedback
                </button>
              </div>
            ) : (
              <div className={styles.threadsContainer}>
                {myTickets.map(ticket => {
                  const isResolved = ticket.status === 'resolved';
                  const badgeClass = ticket.ticket_type === 'feedback' 
                    ? styles.badgeFeedback 
                    : ticket.ticket_type === 'feature_request' 
                    ? styles.badgeFeature 
                    : styles.badgeReport;

                  return (
                    <div key={ticket.id} className={styles.threadCard}>
                      <div className={styles.threadHeader}>
                        <div className={styles.threadTags}>
                          <span className={`${styles.typeBadge} ${badgeClass}`}>
                            {ticket.ticket_type.replace('_', ' ')}
                          </span>
                          <span className={`${styles.statusChip} ${isResolved ? styles.statusResolved : styles.statusOpen}`}>
                            {isResolved ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {isResolved ? 'RESOLVED' : 'IN REVIEW'}
                          </span>
                        </div>
                        <span className={styles.threadDate}>
                          {new Date(ticket.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>

                      <div className={styles.chatMessages}>
                        {/* USER MESSAGE BUBBLE */}
                        <div className={styles.userBubbleWrapper}>
                          <div className={styles.userBubble}>
                            {ticket.title && (
                              <div className={styles.bubbleTitle}>{ticket.title}</div>
                            )}
                            {ticket.issue_type && (
                              <div className={styles.bubbleTitle} style={{ color: '#ff7675' }}>
                                Issue: {ticket.issue_type.replace(/_/g, ' ')}
                              </div>
                            )}
                            <div>{ticket.description || ticket.message}</div>
                          </div>
                          <div className={styles.userBubbleMeta}>
                            <User size={12} />
                            <span>You ({ticket.name || 'Visitor'})</span>
                          </div>
                        </div>

                        {/* OFFICIAL SUPPORT REPLY BUBBLE */}
                        {ticket.admin_reply ? (
                          <div className={styles.supportBubbleWrapper}>
                            <div className={styles.supportBubble}>
                              <div className={styles.officialHeader}>
                                <div className={styles.officialAvatar}>A</div>
                                <span className={styles.officialName}>
                                  AuraWatch Official Support
                                  <span className={styles.verifiedBadge} title="Verified AuraWatch Team">
                                    <ShieldCheck size={15} />
                                  </span>
                                </span>
                              </div>
                              <div className={styles.supportText}>
                                {ticket.admin_reply}
                              </div>
                            </div>
                            <div className={styles.supportBubbleMeta}>
                              <Clock size={12} />
                              <span>
                                {ticket.replied_at ? new Date(ticket.replied_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Official Team'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.pendingNotice}>
                            <Clock size={16} />
                            <span>
                              Ticket received. AuraWatch Support team is reviewing your report. Our official reply will appear here permanently.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case TABS.HOW_TO_USE:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>How to Use AuraWatch</h2>
            
            <h3>Searching for Movies & Shows</h3>
            <p>Use the search bar at the top of the screen to quickly find your favorite content. You can search by title, genre, or keywords.</p>
            <ul>
              <li>Type directly in the top search bar for instant suggestions.</li>
              <li>Press <span className={styles.highlight}>Enter</span> to view full search results.</li>
              <li>Use the <span className={styles.highlight}>Filter</span> options next to the search bar to narrow down by Genre, Type (Movie/Series), or Language.</li>
            </ul>

            <h3>Playing Content</h3>
            <p>Click on any movie or show poster to view its details. From there, click the <span className={styles.highlight}>Play</span> button to start watching instantly. If you're watching a TV series, you can select specific seasons and episodes from the list below the player.</p>

            <h3>Customizing Your UI</h3>
            <p>Make AuraWatch your own by customizing your profile.</p>
            <ul>
              <li>Click your profile icon in the top right and select <span className={styles.highlight}>Edit Profile</span>.</li>
              <li>Change your display name and update your password securely.</li>
              <li>Select a pre-defined color avatar or <span className={styles.highlight}>Upload your own photo</span> for a personalized touch.</li>
            </ul>
          </div>
        );

      case TABS.PLAYER_GUIDE:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>Video Player Guide</h2>
            
            <h3>A. How to Play</h3>
            <ul>
              <li>Click the large play button in the center to start the video.</li>
              <li>Use the controls at the bottom to pause, seek forward/backward, and toggle fullscreen mode.</li>
            </ul>

            <h3>B. Server Selection</h3>
            <p>Different servers provide different playback options. We aggregate links from various sources to give you the best experience.</p>
            <img src="/guide-image.png" className={styles.guideImage} alt="Player Server Selection Reference" />
            <ul>
              <li>Examples of servers include <span className={styles.highlight}>Strings</span>, <span className={styles.highlight}>Lofi</span>, and others.</li>
            </ul>
            <div className={styles.noteBox}>
              <p><strong>Pro Tip:</strong> If one server is slow or doesn't work, simply switch to another server using the buttons provided!</p>
            </div>

            <h3>C. Quality Selection</h3>
            <p>You can choose your preferred video quality based on your internet speed and device.</p>
            <ul>
              <li>Options usually range from <span className={styles.highlight}>360p</span> to <span className={styles.highlight}>1080p</span>.</li>
              <li><strong>Slow internet?</strong> Select 360p or 480p to prevent buffering.</li>
              <li><strong>Fast internet?</strong> Enjoy crisp 720p or 1080p HD quality.</li>
            </ul>
          </div>
        );

      case TABS.FEEDBACK:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>Feedback & Suggestions</h2>
            <p>We value your thoughts! Tell us what you like or what we can improve on AuraWatch.</p>
            
            <form className={styles.form} onSubmit={(e) => handleSubmit(e, 'feedback')}>
              <div className={styles.formGroup}>
                <label>Your Name (Optional)</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Anonymous or your username"
                  value={feedback.name}
                  onChange={(e) => setFeedback({...feedback, name: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Message *</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Share your experience, thoughts, or suggestions..." 
                  required
                  value={feedback.message}
                  onChange={(e) => setFeedback({...feedback, message: e.target.value})}
                ></textarea>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        );

      case TABS.FEATURE_REQUEST:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>Request a Feature</h2>
            <p>Have a great idea for AuraWatch? Let our development team know.</p>
            
            <form className={styles.form} onSubmit={(e) => handleSubmit(e, 'feature')}>
              <div className={styles.formGroup}>
                <label>Feature Title *</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="e.g. Watch Together, Custom Subtitles..." 
                  required
                  value={feature.title}
                  onChange={(e) => setFeature({...feature, title: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description *</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Explain why this feature would be useful and how you envision it working." 
                  required
                  value={feature.description}
                  onChange={(e) => setFeature({...feature, description: e.target.value})}
                ></textarea>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Feature Request'}
              </button>
            </form>
          </div>
        );

      case TABS.REPORT_ISSUE:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>Report an Issue</h2>
            <p>Found a bug or experiencing problems? Please report it so we can fix it.</p>
            
            <form className={styles.form} onSubmit={(e) => handleSubmit(e, 'report')}>
              <div className={styles.formGroup}>
                <label>Issue Type *</label>
                <select 
                  className={styles.select} 
                  value={report.type}
                  onChange={(e) => setReport({...report, type: e.target.value})}
                >
                  <option value="video_not_playing">Video not playing</option>
                  <option value="wrong_content">Wrong content</option>
                  <option value="bug">Website Bug / Error</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Description *</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Please describe the issue in detail. If it's about a specific movie/show, mention its name." 
                  required
                  value={report.description}
                  onChange={(e) => setReport({...report, description: e.target.value})}
                ></textarea>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        );

      case TABS.UPDATES:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>Platform Updates & Changelog</h2>
            <p>Stay informed about the latest features, bug fixes, and improvements we're making to AuraWatch.</p>
            
            {loadingUpdates ? (
              <div className={styles.loadingUpdates}>
                <div className={styles.pulseDot} />
                <span>Fetching latest updates...</span>
              </div>
            ) : (
              <div className={styles.updatesContainer}>
                {platformUpdates ? (
                  <div className={styles.updatesText}>
                    {platformUpdates.split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line.trim().startsWith('-') ? (
                          <li className={styles.updateItem}>{line.replace('-', '').trim()}</li>
                        ) : (
                          <p className={styles.updatePara}>{line}</p>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noUpdates}>
                    <Info size={40} color="#333" />
                    <p>No recent updates to show. We're working hard on something great!</p>
                  </div>
                )}
              </div>
            )}

            <div className={styles.noteBox} style={{marginTop: '30px'}}>
              <p><strong>Dev Note:</strong> Most updates are pushed automatically. If you encounter any bugs, please report them using the <strong>Report Issue</strong> tab.</p>
            </div>
          </div>
        );

      case TABS.DMCA:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>DMCA & Copyright Policy</h2>
            <p>AuraWatch <strong>does not host, store, or upload</strong> any video files, media, or movies on our servers.</p>
            <p>We simply act as a search engine and indexer, providing embedded players and links scraped from third-party websites across the internet. We have no direct control over the content hosted on these external servers.</p>
            <div className={styles.noteBox} style={{marginTop: '15px', marginBottom: '15px'}}>
              <p>We do not support or promote piracy. If you are a copyright owner and find your copyrighted material linked on our site, please feel free to ask us to remove the indexing.</p>
            </div>
            <h3>How to Request Removal</h3>
            <p>Since we do not host the actual files, removing a link from our site will not remove the video from the internet. To have the content permanently taken down, you must contact the external third-party video host directly.</p>
            <p>However, we respect copyright laws. If you want us to remove a specific embedded link from AuraWatch, please use the <strong>Report Issue</strong> tab or contact our admin team with proof of ownership.</p>
          </div>
        );

      default:
        return null;
    }
  };

  const unreadCount = myTickets.filter(t => t.admin_reply && !t.is_read).length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>

        <div className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>Help & Support</h2>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.MY_TICKETS ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.MY_TICKETS)}
            style={{ 
              background: activeTab === TABS.MY_TICKETS ? 'rgba(229, 9, 20, 0.15)' : 'transparent',
              color: activeTab === TABS.MY_TICKETS ? '#fff' : '#aaa'
            }}
          >
            <MessageSquare size={18} color={activeTab === TABS.MY_TICKETS ? '#e50914' : '#aaa'} /> 
            <span>Support & Chat</span>
            {unreadCount > 0 && <span className={styles.tabBadge}>{unreadCount}</span>}
          </button>

          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.HOW_TO_USE ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.HOW_TO_USE)}
          >
            <BookOpen size={18} /> How to Use
          </button>

          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.UPDATES ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.UPDATES)}
          >
            <Info size={18} /> Latest Updates
          </button>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.PLAYER_GUIDE ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.PLAYER_GUIDE)}
          >
            <PlayCircle size={18} /> Player Guide
          </button>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.FEEDBACK ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.FEEDBACK)}
          >
            <MessageSquare size={18} /> Feedback
          </button>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.FEATURE_REQUEST ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.FEATURE_REQUEST)}
          >
            <Lightbulb size={18} /> Feature Request
          </button>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.REPORT_ISSUE ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.REPORT_ISSUE)}
          >
            <AlertTriangle size={18} /> Report Issue
          </button>
          
          <button 
            className={`${styles.tabBtn} ${activeTab === TABS.DMCA ? styles.active : ''}`}
            onClick={() => handleTabChange(TABS.DMCA)}
          >
            <ShieldAlert size={18} /> DMCA / Copyright
          </button>
        </div>

        <div className={styles.contentArea}>
          {renderTabContent()}
          
          {successMessage && (
            <div className={styles.successMessage}>
              <CheckCircle size={20} />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default HelpModal;
