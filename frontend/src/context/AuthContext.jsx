import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('aurawatch_token'));
  const [loading, setLoading] = useState(true);

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem('aurawatch_token');
      if (!savedToken) { setLoading(false); return; }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(savedToken);
        } else {
          // Token expired or invalid
          localStorage.removeItem('aurawatch_token');
          setToken(null);
        }
      } catch (err) {
        console.error('[Auth] Session restore failed:', err);
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    localStorage.setItem('aurawatch_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password, confirmPassword, securityQuestion, securityAnswer) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirmPassword, securityQuestion, securityAnswer })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    localStorage.setItem('aurawatch_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const updateAvatar = async (avatarStr) => {
    console.log('[Auth] Updating avatar to:', avatarStr);
    const res = await fetch(`${API_BASE}/auth/avatar`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ avatar: avatarStr })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    console.log('[Auth] Avatar updated successfully:', data.avatar);
    setUser(prev => ({ ...prev, avatar: data.avatar }));
    return data;
  };

  const uploadCustomAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatarFile', file);

    const res = await fetch(`${API_BASE}/auth/avatar-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, // FormData sets Content-Type automatically
      body: formData
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      // If the error is HTML, it's likely a 404 or 500 from the server configuration
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html>')) {
        throw new Error(`Server Error (${res.status}): The API endpoint was not found or failed. Please check if the backend is running.`);
      }
      try {
        const errData = JSON.parse(errorText);
        throw new Error(errData.message || 'Failed to upload avatar');
      } catch (e) {
        throw new Error(errorText || 'Failed to upload avatar');
      }
    }
    
    const data = await res.json();
    setUser(prev => ({ ...prev, avatar: data.avatar }));
    return data;
  };

  const getSecurityQuestion = async () => {
    const res = await fetch(`${API_BASE}/auth/my-security-question`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.question;
  };

  const updateName = async (newName, { password, securityAnswer }) => {
    const res = await fetch(`${API_BASE}/auth/update-name`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ newName, password, securityAnswer })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    setUser(prev => ({ ...prev, name: data.name }));
    return data;
  };

  const changePassword = async ({ currentPassword, securityAnswer, newPassword, confirmPassword }) => {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ currentPassword, securityAnswer, newPassword, confirmPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('aurawatch_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoggedIn: !!user,
      loading,
      login,
      register,
      logout,
      updateAvatar,
      uploadCustomAvatar,
      updateName,
      changePassword,
      getSecurityQuestion
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
