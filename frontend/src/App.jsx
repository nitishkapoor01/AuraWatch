import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import TopNav from './components/layout/TopNav';
import AnnouncementBanner from './components/layout/AnnouncementBanner';
import Home from './pages/Home';
import Search from './pages/Search';
import MovieDetail from './pages/MovieDetail';
import Player from './pages/Player';
import Category from './pages/Category';
import Login from './pages/Login';
import MyList from './pages/MyList';
import WatchHistory from './pages/WatchHistory';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function App() {
  const { isLoggedIn, user } = useAuth();
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    // Generate an anonymous session ID for this browser session
    let sessionId = sessionStorage.getItem('trackingSessionId');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('trackingSessionId', sessionId);
    }

    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://aurawatch-1.onrender.com/api')}/tracking/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            isGuest: !isLoggedIn,
            userId: user ? user.id : null
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.announcement !== undefined) {
            setAnnouncement(data.announcement);
          }
        }
      } catch (e) {
        // silently fail tracking ping
      }
    };

    // Send immediately on load
    sendHeartbeat();

    // Send every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, user]);

  return (
    <div className="appContainer">
      <AnnouncementBanner announcement={announcement} />
      <Sidebar />
      <div className="mainContent">
        <TopNav />
        <main className="pageContent">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/tv" element={<Category type="tv" title="TV Shows" />} />
            <Route path="/movies" element={<Category type="movie" title="Movies" />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/play/:id" element={<Player />} />
            <Route path="/login" element={<Login />} />
            <Route path="/list" element={<MyList />} />
            <Route path="/history" element={<WatchHistory />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={
              <div style={{color:'white', padding:'100px', textAlign:'center'}}>
                <h2>Page Not Found</h2>
                <p>The feature you clicked is not yet implemented in this prototype.</p>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
