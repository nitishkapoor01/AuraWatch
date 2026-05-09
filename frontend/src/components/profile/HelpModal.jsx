import React, { useState } from 'react';
import { X, PlayCircle, BookOpen, MessageSquare, Lightbulb, AlertTriangle, CheckCircle, ShieldAlert, Info } from 'lucide-react';
import styles from './HelpModal.module.css';

const TABS = {
  HOW_TO_USE: 'how_to_use',
  UPDATES: 'updates',
  PLAYER_GUIDE: 'player_guide',
  FEEDBACK: 'feedback',
  FEATURE_REQUEST: 'feature_request',
  REPORT_ISSUE: 'report_issue',
  DMCA: 'dmca'
};

const HelpModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState(TABS.HOW_TO_USE);
  const [platformUpdates, setPlatformUpdates] = useState('');
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      fetchUpdates();
    }
  }, [isOpen]);

  const fetchUpdates = async () => {
    try {
      setLoadingUpdates(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
      const res = await fetch(`${baseUrl}/settings/platform_updates`);
      if (res.ok) {
        const data = await res.json();
        setPlatformUpdates(data.value || '');
      }
    } catch (e) { console.error('Failed to fetch updates', e); }
    finally { setLoadingUpdates(false); }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [feedback, setFeedback] = useState({ name: '', message: '' });
  const [feature, setFeature] = useState({ title: '', description: '' });
  const [report, setReport] = useState({ type: 'video_not_playing', description: '' });

  if (!isOpen) return null;

  const handleSubmit = async (e, formType) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');

    let payload = {};
    if (formType === 'feedback') {
      payload = { ticketType: 'feedback', name: feedback.name, message: feedback.message };
    } else if (formType === 'feature') {
      payload = { ticketType: 'feature_request', title: feature.title, description: feature.description };
    } else if (formType === 'report') {
      payload = { ticketType: 'report_issue', issueType: report.type, description: report.description };
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api');
      const response = await fetch(`${baseUrl}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setSuccessMessage('Successfully submitted! Thank you.');
      
      // Reset form based on type
      if (formType === 'feedback') setFeedback({ name: '', message: '' });
      if (formType === 'feature') setFeature({ title: '', description: '' });
      if (formType === 'report') setReport({ type: 'video_not_playing', description: '' });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
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

            <h3>D. Language Selection</h3>
            <p>Many videos support multiple audio tracks (e.g., Hindi, English).</p>
            <ul>
              <li>Select your preferred language from the available options.</li>
              <li><em>Note: Language availability may depend on the selected server.</em></li>
            </ul>

            <h3>E. Download System (Important)</h3>
            <p>There are TWO ways to download content to watch offline:</p>
            <ul>
              <li><strong>1. Player Download:</strong> Use the download button directly <em>inside</em> the video player. This will download the exact version (server, quality, language) currently playing.</li>
              <li><strong>2. External Download:</strong> Use the separate download buttons located <em>outside/below</em> the player. This lets you choose the exact quality and server before starting the download.</li>
            </ul>

            <h3>F. Troubleshooting</h3>
            <ul>
              <li><strong>Video not playing?</strong> Switch to a different server.</li>
              <li><strong>Constant buffering?</strong> Lower the video quality.</li>
              <li><strong>No audio?</strong> Check your device volume or try switching servers.</li>
            </ul>
          </div>
        );

      case TABS.FEEDBACK:
        return (
          <div className={styles.section}>
            <h2 className={styles.contentTitle}>Share Your Feedback</h2>
            <p>We'd love to hear what you think about AuraWatch! Your feedback helps us improve.</p>
            
            <form className={styles.form} onSubmit={(e) => handleSubmit(e, 'feedback')}>
              <div className={styles.formGroup}>
                <label>Name (Optional)</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="How should we call you?" 
                  value={feedback.name}
                  onChange={(e) => setFeedback({...feedback, name: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Message *</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Tell us what you love or what could be better..." 
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
            <p>Have a great idea for a new feature? Let us know!</p>
            
            <form className={styles.form} onSubmit={(e) => handleSubmit(e, 'feature')}>
              <div className={styles.formGroup}>
                <label>Feature Title *</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="E.g., Watch Party mode" 
                  required
                  value={feature.title}
                  onChange={(e) => setFeature({...feature, title: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description *</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Describe how the feature would work and why it would be useful..." 
                  required
                  value={feature.description}
                  onChange={(e) => setFeature({...feature, description: e.target.value})}
                ></textarea>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>

        <div className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>Help & Support</h2>
          
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
