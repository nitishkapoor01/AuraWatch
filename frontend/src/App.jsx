import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { usePlayer } from './context/PlayerContext';
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
import SharedList from './pages/SharedList';
import WatchHistory from './pages/WatchHistory';
import AdminDashboard from './pages/AdminDashboard';
import BackgroundEffects from './components/BackgroundEffects';
import GlobalPlayer from './components/GlobalPlayer';
import './App.css';

function App() {
  const { isLoggedIn, user } = useAuth();
  const { playerState } = usePlayer();
  const [announcement, setAnnouncement] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // Generate an anonymous session ID for this browser session
    let sessionId = sessionStorage.getItem('trackingSessionId');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('trackingSessionId', sessionId);
    }

    let visitorId = localStorage.getItem('trackingVisitorId');
    if (!visitorId) {
      visitorId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('trackingVisitorId', visitorId);
    }

    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/tracking/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            visitorId,
            isGuest: !isLoggedIn,
            userId: user ? user.id : null,
            name: user ? user.name : null,
            path: location.pathname + location.search,
            action: getActionFromPath(location.pathname)
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

    const handleMovieLoaded = () => {
      sendHeartbeat();
    };
    window.addEventListener('movieLoaded', handleMovieLoaded);

    return () => {
      clearInterval(interval);
      window.removeEventListener('movieLoaded', handleMovieLoaded);
    };
  }, [isLoggedIn, user, location.pathname, location.search, playerState?.isOpen, playerState?.movieData]);

  const getActionFromPath = (path) => {
    if (playerState?.isOpen && playerState?.movieData) {
      const title = playerState.movieData.title;
      const type = playerState.movieData.type === 'tv' || playerState.movieData.type === 'Series' ? 'TV' : 'Movie';
      return `Watching: ${title} (${type})`;
    }
    if (path === '/') return 'Browsing Home';
    if (path.startsWith('/search')) return 'Searching';
    if (path.startsWith('/movie/')) {
      const title = sessionStorage.getItem('currentViewingMovie');
      if (title) return `Viewing: ${title}`;
      return 'Viewing Movie Details';
    }
    if (path.startsWith('/play/')) {
      const searchParams = new URLSearchParams(location.search);
      const title = searchParams.get('title');
      if (title) return `Watching: ${title}`;
      return 'Watching Video';
    }
    if (path.startsWith('/tv')) return 'Browsing TV Shows';
    if (path.startsWith('/movies')) return 'Browsing Movies';
    if (path.startsWith('/login')) return 'At Login Page';
    if (path.startsWith('/list')) return 'Viewing My List';
    if (path.startsWith('/history')) return 'Viewing Watch History';
    if (path.startsWith('/admin')) return 'In Admin Dashboard';
    return 'Browsing Site';
  };

  return (
    <div className="appContainer">
      <BackgroundEffects />
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
            <Route path="/shared-list/:userId" element={<SharedList />} />
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
      <GlobalPlayer />
    </div>
  );
}

export default App;
