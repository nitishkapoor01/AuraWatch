import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Film } from 'lucide-react';
import styles from './Login.module.css';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}`;

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite movie?",
  "Custom Question..."
];

const Login = () => {
  // Mode: 'login', 'register', 'forgot_email', 'forgot_answer', 'forgot_reset'
  const [mode, setMode] = useState('login');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [resetToken, setResetToken] = useState('');

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  React.useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      // Clear state so message doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!name.trim()) throw new Error('Name is required');
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      if (securityAnswer.length < 2) throw new Error('Security answer must be at least 2 characters');
      
      const finalQuestion = securityQuestion === 'Custom Question...' ? customQuestion : securityQuestion;
      if (!finalQuestion.trim()) throw new Error('Security question is required');

      await register(name, email, password, confirmPassword, finalQuestion, securityAnswer);
      setSuccess('Registered successfully! Redirecting to home...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleForgotGetQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setSecurityQuestion(data.question);
      setMode('forgot_answer');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleForgotVerifyAnswer = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answer: securityAnswer })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setResetToken(data.resetToken);
      setMode('forgot_reset');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      
      const res = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: password, confirmPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setSuccess('Password reset successfully! You can now login.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const resetForm = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setSecurityAnswer('');
    setPassword('');
    setConfirmPassword('');
  };

  const renderForm = () => {
    switch (mode) {
      case 'register':
        return (
          <form onSubmit={handleRegister} className={styles.form}>
            <div className={styles.inputGroup}>
              <input type="text" id="name" placeholder=" " value={name} onChange={(e) => setName(e.target.value)} className={styles.input} required />
              <label htmlFor="name" className={styles.label}>Name</label>
            </div>
            <div className={styles.inputGroup}>
              <input type="email" id="email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} required />
              <label htmlFor="email" className={styles.label}>Email</label>
            </div>
            <div className={styles.inputGroup}>
              <input type={showPassword ? 'text' : 'password'} id="password" placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} required minLength={6} />
              <label htmlFor="password" className={styles.label}>Password</label>
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className={styles.inputGroup}>
              <input type={showPassword ? 'text' : 'password'} id="confirmPassword" placeholder=" " value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={styles.input} required />
              <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
            </div>
            
            <div className={styles.divider}>Security Question</div>
            
            <div className={styles.inputGroup}>
              <select 
                className={styles.select} 
                value={securityQuestion} 
                onChange={(e) => setSecurityQuestion(e.target.value)}
              >
                {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            {securityQuestion === 'Custom Question...' && (
              <div className={styles.inputGroup}>
                <input type="text" id="customQuestion" placeholder=" " value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} className={styles.input} required />
                <label htmlFor="customQuestion" className={styles.label}>Type your question</label>
              </div>
            )}
            <div className={styles.inputGroup}>
              <input type="text" id="securityAnswer" placeholder=" " value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} className={styles.input} required autoComplete="off" />
              <label htmlFor="securityAnswer" className={styles.label}>Answer (Case-insensitive)</label>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Sign Up'}
            </button>
          </form>
        );

      case 'forgot_email':
        return (
          <form onSubmit={handleForgotGetQuestion} className={styles.form}>
            <p className={styles.instructionText}>Enter your email to reset your password.</p>
            <div className={styles.inputGroup}>
              <input type="email" id="email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} required />
              <label htmlFor="email" className={styles.label}>Email Address</label>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Continue'}
            </button>
          </form>
        );

      case 'forgot_answer':
        return (
          <form onSubmit={handleForgotVerifyAnswer} className={styles.form}>
            <div className={styles.questionBox}>
              <strong>Security Question:</strong><br/>
              {securityQuestion}
            </div>
            <div className={styles.inputGroup}>
              <input type="text" id="securityAnswer" placeholder=" " value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} className={styles.input} required autoComplete="off" />
              <label htmlFor="securityAnswer" className={styles.label}>Your Answer</label>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Verify Answer'}
            </button>
          </form>
        );

      case 'forgot_reset':
        return (
          <form onSubmit={handleForgotResetPassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <input type={showPassword ? 'text' : 'password'} id="password" placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} required minLength={6} />
              <label htmlFor="password" className={styles.label}>New Password</label>
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className={styles.inputGroup}>
              <input type={showPassword ? 'text' : 'password'} id="confirmPassword" placeholder=" " value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={styles.input} required />
              <label htmlFor="confirmPassword" className={styles.label}>Confirm New Password</label>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Reset Password'}
            </button>
          </form>
        );

      default: // login
        return (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <input type="email" id="login-email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} required />
              <label htmlFor="login-email" className={styles.label}>Email</label>
            </div>
            <div className={styles.inputGroup}>
              <input type={showPassword ? 'text' : 'password'} id="login-password" placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} required />
              <label htmlFor="login-password" className={styles.label}>Password</label>
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Sign In'}
            </button>
            <div className={styles.forgotPassword}>
              <button type="button" onClick={() => resetForm('forgot_email')} className={styles.textBtn}>
                Forgot Password?
              </button>
            </div>
          </form>
        );
    }
  };

  const getTitle = () => {
    if (mode === 'register') return 'Create Account';
    if (mode === 'forgot_email') return 'Reset Password';
    if (mode === 'forgot_answer') return 'Security Check';
    if (mode === 'forgot_reset') return 'New Password';
    return 'Sign In';
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.bgOverlay}></div>
      <div className={styles.logo}>
        <img src="/AuraMovie_logo.png.png" alt="AuraWatch Logo" style={{ height: '70px', objectFit: 'contain' }} />
        <span style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '3px', marginLeft: '10px' }}>
          Aura<span style={{ color: '#fff' }}>Watch</span>
        </span>
      </div>

      <div className={styles.formCard}>
        <h1 className={styles.formTitle}>{getTitle()}</h1>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {renderForm()}

        {mode !== 'forgot_answer' && mode !== 'forgot_reset' && (
          <div className={styles.switchMode}>
            {mode === 'login' ? "New to AuraWatch?" : "Already have an account?"}{' '}
            <button className={styles.switchBtn} onClick={() => resetForm(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign Up Now' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
