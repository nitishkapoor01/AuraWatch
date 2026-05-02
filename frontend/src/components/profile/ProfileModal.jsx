import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Pencil, Check, Eye, EyeOff, Lock, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './ProfileModal.module.css';

const AVATARS = [
  { id: 'red', color: '#e50914' },
  { id: 'blue', color: '#0071eb' },
  { id: 'green', color: '#0f7b0f' },
  { id: 'yellow', color: '#e5b909' },
  { id: 'purple', color: '#8e24aa' },
  { id: 'pink', color: '#e91e63' },
  { id: 'orange', color: '#f57c00' },
  { id: 'teal', color: '#009688' },
];

const ProfileModal = ({ isOpen, onClose }) => {
  const [updating, setUpdating] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  
  // Name edit state
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [namePassword, setNamePassword] = useState('');
  const [nameSecurityAnswer, setNameSecurityAnswer] = useState('');
  const [useSecurityForName, setUseSecurityForName] = useState(false);
  const [showNamePassword, setShowNamePassword] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  
  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [passSecurityAnswer, setPassSecurityAnswer] = useState('');
  const [useSecurityForPass, setUseSecurityForPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  const { user, updateAvatar, uploadCustomAvatar, updateName, changePassword, getSecurityQuestion } = useAuth();
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && (useSecurityForName || useSecurityForPass) && !securityQuestion) {
      const fetchQuestion = async () => {
        try {
          const q = await getSecurityQuestion();
          setSecurityQuestion(q);
        } catch (error) {
          console.error('Failed to get security question:', error);
        }
      };
      fetchQuestion();
    }
  }, [isOpen, useSecurityForName, useSecurityForPass, getSecurityQuestion, securityQuestion]);

  if (!isOpen || !user) return null;

  const handleSelect = async (colorId) => {
    if (updating) return;
    setUpdating(true);
    try {
      await updateAvatar(colorId);
      setTimeout(() => {
        setUpdating(false);
        onClose();
      }, 400);
    } catch (err) {
      setUpdating(false);
      alert('Failed to update profile icon. Please try again.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit.');
      return;
    }
    setUpdating(true);
    try {
      await uploadCustomAvatar(file);
      setTimeout(() => { setUpdating(false); onClose(); }, 400);
    } catch (err) {
      setUpdating(false);
      alert(err.message || 'Failed to upload photo.');
    }
  };

  // --- Name Edit Handlers ---
  const handleNameEdit = () => {
    setEditingName(true);
    setNewName(user.name);
    setNamePassword('');
    setNameSecurityAnswer('');
    setNameError('');
    setNameSuccess('');
    setUseSecurityForName(false);
  };

  const handleNameCancel = () => {
    setEditingName(false);
    setNewName('');
    setNamePassword('');
    setNameSecurityAnswer('');
    setNameError('');
    setNameSuccess('');
    setUseSecurityForName(false);
  };

  const handleNameSave = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    if (!useSecurityForName && !namePassword) {
      setNameError('Password is required to change name.');
      return;
    }
    if (useSecurityForName && !nameSecurityAnswer) {
      setNameError('Security answer is required.');
      return;
    }

    setUpdating(true);
    setNameError('');
    try {
      await updateName(newName.trim(), { 
        password: useSecurityForName ? undefined : namePassword,
        securityAnswer: useSecurityForName ? nameSecurityAnswer : undefined
      });
      setNameSuccess('Name updated!');
      setTimeout(() => { 
        setEditingName(false); 
        setNameSuccess(''); 
        setUpdating(false); 
        setNamePassword(''); 
        setNameSecurityAnswer('');
      }, 1200);
    } catch (err) {
      setNameError(err.message || 'Failed to update name.');
      setUpdating(false);
    }
  };

  // --- Password Change Handlers ---
  const handlePasswordToggle = () => {
    setChangingPassword(!changingPassword);
    setCurrentPass('');
    setPassSecurityAnswer('');
    setNewPass('');
    setConfirmPass('');
    setPassError('');
    setPassSuccess('');
    setUseSecurityForPass(false);
  };

  const handlePasswordSave = async () => {
    if ((!useSecurityForPass && !currentPass) || (useSecurityForPass && !passSecurityAnswer) || !newPass || !confirmPass) {
      setPassError('All required fields must be filled.');
      return;
    }
    if (newPass.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.');
      return;
    }
    setUpdating(true);
    setPassError('');
    try {
      await changePassword({
        currentPassword: useSecurityForPass ? undefined : currentPass,
        securityAnswer: useSecurityForPass ? passSecurityAnswer : undefined,
        newPassword: newPass,
        confirmPassword: confirmPass
      });
      setPassSuccess('Password changed successfully!');
      setTimeout(() => { setChangingPassword(false); setPassSuccess(''); setUpdating(false); }, 1500);
    } catch (err) {
      setPassError(err.message || 'Failed to change password.');
      setUpdating(false);
    }
  };

  const isCustomAvatar = user.avatar && user.avatar.startsWith('http');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>
        
        <h2 className={styles.title}>Edit Profile</h2>

        {/* Profile Header */}
        <div className={styles.profileHeader}>
          {isCustomAvatar ? (
            <img src={user.avatar} alt="Profile" className={styles.currentAvatarImage} />
          ) : (
            <div 
              className={styles.currentAvatar}
              style={{ backgroundColor: AVATARS.find(a => a.id === user.avatar)?.color || '#e50914' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.userInfo}>
            {!editingName ? (
              <div className={styles.nameRow}>
                <h3>{user.name}</h3>
                <button className={styles.editNameBtn} onClick={handleNameEdit} title="Edit Name">
                  <Pencil size={14} />
                </button>
              </div>
            ) : (
              <div className={styles.nameEditForm}>
                <input 
                  type="text"
                  className={styles.nameInput}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New name"
                  autoFocus
                />
                
                {useSecurityForName ? (
                  <div className={styles.securityQuestionBox}>
                    <p className={styles.securityQuestionLabel}>Security Question:</p>
                    <p className={styles.securityQuestionText}>{securityQuestion || 'Loading...'}</p>
                    <input 
                      type="text"
                      className={styles.nameInput}
                      value={nameSecurityAnswer}
                      onChange={e => setNameSecurityAnswer(e.target.value)}
                      placeholder="Your Answer"
                      onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                    />
                  </div>
                ) : (
                  <div className={styles.passwordInputWrapper}>
                    <input 
                      type={showNamePassword ? 'text' : 'password'}
                      className={styles.passwordInput}
                      value={namePassword}
                      onChange={e => setNamePassword(e.target.value)}
                      placeholder="Enter password to confirm"
                      onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                    />
                    <button className={styles.togglePasswordBtn} onClick={() => setShowNamePassword(!showNamePassword)} type="button">
                      {showNamePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )}
                
                <button 
                  type="button" 
                  className={styles.useSecurityBtn} 
                  onClick={() => {
                    setUseSecurityForName(!useSecurityForName);
                    setNameError('');
                  }}
                >
                  <HelpCircle size={12} />
                  {useSecurityForName ? 'Use Password instead' : 'Forgot Password? Use Security Question'}
                </button>

                {nameError && <p className={styles.nameError}>{nameError}</p>}
                {nameSuccess && <p className={styles.nameSuccess}>{nameSuccess}</p>}
                
                <div className={styles.nameActions}>
                  <button className={styles.saveNameBtn} onClick={handleNameSave} disabled={updating}>
                    <Check size={14} /> {updating ? 'Saving...' : 'Save'}
                  </button>
                  <button className={styles.cancelNameBtn} onClick={handleNameCancel}>Cancel</button>
                </div>
              </div>
            )}
            <p>{user.email}</p>
          </div>
        </div>

        {/* Change Password Section */}
        <div className={styles.passwordSection}>
          <button className={styles.changePasswordToggle} onClick={handlePasswordToggle}>
            <Lock size={16} />
            {changingPassword ? 'Cancel Password Change' : 'Change Password'}
          </button>

          {changingPassword && (
            <div className={styles.passwordForm}>
              
              {useSecurityForPass ? (
                  <div className={styles.securityQuestionBox}>
                    <p className={styles.securityQuestionLabel}>Security Question:</p>
                    <p className={styles.securityQuestionText}>{securityQuestion || 'Loading...'}</p>
                    <input 
                      type="text"
                      className={styles.nameInput}
                      value={passSecurityAnswer}
                      onChange={e => setPassSecurityAnswer(e.target.value)}
                      placeholder="Your Answer"
                    />
                  </div>
              ) : (
                <div className={styles.passwordInputWrapper}>
                  <input 
                    type={showCurrentPass ? 'text' : 'password'}
                    className={styles.passwordInput}
                    value={currentPass}
                    onChange={e => setCurrentPass(e.target.value)}
                    placeholder="Current password"
                  />
                  <button className={styles.togglePasswordBtn} onClick={() => setShowCurrentPass(!showCurrentPass)} type="button">
                    {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}

              <button 
                  type="button" 
                  className={styles.useSecurityBtn} 
                  onClick={() => {
                    setUseSecurityForPass(!useSecurityForPass);
                    setPassError('');
                  }}
              >
                  <HelpCircle size={12} />
                  {useSecurityForPass ? 'Use Current Password instead' : 'Forgot Password? Use Security Question'}
              </button>

              <div className={styles.passwordInputWrapper}>
                <input 
                  type={showNewPass ? 'text' : 'password'}
                  className={styles.passwordInput}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="New password (min 6 chars)"
                />
                <button className={styles.togglePasswordBtn} onClick={() => setShowNewPass(!showNewPass)} type="button">
                  {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input 
                type="password"
                className={styles.passwordInput}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Confirm new password"
                onKeyDown={e => e.key === 'Enter' && handlePasswordSave()}
              />
              
              {passError && <p className={styles.nameError}>{passError}</p>}
              {passSuccess && <p className={styles.nameSuccess}>{passSuccess}</p>}
              
              <button className={styles.saveNameBtn} onClick={handlePasswordSave} disabled={updating} style={{ marginTop: '4px' }}>
                <Check size={14} /> {updating ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          )}
        </div>

        {/* Avatar Section */}
        <div className={styles.avatarSection}>
          <h4 className={styles.sectionTitle}>Choose an Icon or Photo</h4>
          <div className={styles.grid}>
            <button
              className={`${styles.avatarOption} ${styles.uploadOption}`}
              onClick={() => fileInputRef.current.click()}
              disabled={updating}
            >
              <Upload size={20} />
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} />
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                className={`${styles.avatarOption} ${user.avatar === avatar.id ? styles.selected : ''}`}
                style={{ backgroundColor: avatar.color }}
                onClick={() => handleSelect(avatar.id)}
                disabled={updating}
              >
                {user.name.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
