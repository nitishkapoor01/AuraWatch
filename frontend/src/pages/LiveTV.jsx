import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Search, Tv, Signal, Radio, X } from 'lucide-react';
import styles from './LiveTV.module.css';

const LiveTV = () => {
    const [channels, setChannels] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentChannel, setCurrentChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const searchRef = useRef(null);

    // Initial load
    useEffect(() => {
        fetchChannels('', '');
    }, []);

    // Debounced search
    useEffect(() => {
        if (!categories.length) return; // Don't run until first load done
        const tid = setTimeout(() => {
            fetchChannels(searchQuery, activeCategory);
        }, 150);
        return () => clearTimeout(tid);
    }, [searchQuery, activeCategory]);

    const fetchChannels = async (search = '', category = '') => {
        try {
            search ? setSearching(true) : setLoading(channels.length === 0);
            const base = import.meta.env.VITE_API_BASE_URL ||
                (window.location.hostname === 'localhost'
                    ? 'http://localhost:10000/api'
                    : 'https://aurawatch-1.onrender.com/api');

            const url = new URL(`${base}/livetv/channels`);
            url.searchParams.set('limit', '300');
            if (search) url.searchParams.set('search', search);
            if (category) url.searchParams.set('category', category);

            const res = await fetch(url.toString());
            const data = await res.json();

            setChannels(data.channels || []);
            if (!search && !category) setCategories(data.categories || []);

            // Auto-play first channel only on very first load
            setCurrentChannel(prev => {
                if (!prev && data.channels?.length > 0) return data.channels[0];
                return prev;
            });
        } catch (err) {
            setError('Could not load channels.');
            console.error(err);
        } finally {
            setLoading(false);
            setSearching(false);
        }
    };

    const [isBuffering, setIsBuffering] = useState(false);

    // HLS Player
    useEffect(() => {
        if (!currentChannel || !videoRef.current) return;
        const video = videoRef.current;
        if (hlsRef.current) hlsRef.current.destroy();

        setIsBuffering(true); // Start buffering state when channel changes

        if (Hls.isSupported()) {
            const hls = new Hls({ 
                startLevel: -1, 
                autoStartLoad: true,
                lowLatencyMode: true,
                maxBufferLength: 5,
                maxMaxBufferLength: 10,
                liveSyncDurationCount: 2,
                enableWorker: true
            });
            hlsRef.current = hls;
            hls.loadSource(currentChannel.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_, d) => {
                if (d.fatal) {
                    if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad();
                    } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        hls.destroy();
                        setIsBuffering(false);
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = currentChannel.url;
            video.play().catch(() => {});
        }
        return () => hlsRef.current?.destroy();
    }, [currentChannel]);

    if (loading) return (
        <div className={styles.splash}>
            <div className={styles.splashSpinner}></div>
            <p>Tuning in to Live TV...</p>
        </div>
    );

    if (error) return (
        <div className={styles.splash}>
            <Tv size={48} color="#e50914" />
            <p>{error}</p>
            <button onClick={() => fetchChannels()} className={styles.retryBtn}>Retry</button>
        </div>
    );

    return (
        <div className={styles.page}>
            {/* ── LEFT: VIDEO PLAYER ── */}
            <div className={styles.playerSide}>
                <div className={styles.videoBox}>
                    {currentChannel ? (
                        <>
                            <video 
                                ref={videoRef} 
                                controls 
                                autoPlay 
                                className={styles.video}
                                onWaiting={() => setIsBuffering(true)}
                                onPlaying={() => setIsBuffering(false)}
                                onCanPlay={() => setIsBuffering(false)}
                            />
                            {isBuffering && (
                                <div className={styles.bufferingOverlay}>
                                    <div className={styles.splashSpinner}></div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.noChannel}>
                            <Tv size={56} />
                            <p>Pick a channel →</p>
                        </div>
                    )}
                </div>

                {currentChannel && (
                    <div className={styles.nowPlaying}>
                        <span className={styles.liveDot}></span>
                        <span className={styles.liveLabel}>LIVE</span>
                        <span className={styles.channelName}>{currentChannel.name}</span>
                        <span className={styles.channelCat}>{currentChannel.category}</span>
                    </div>
                )}
            </div>

            {/* ── RIGHT: CHANNEL LIST ── */}
            <div className={styles.listSide}>
                {/* Header */}
                <div className={styles.listHeader}>
                    <Radio size={20} className={styles.radioIcon} />
                    <span>Channels</span>
                    {(searchQuery || activeCategory) && (
                        <button className={styles.clearBtn} onClick={() => { setSearchQuery(''); setActiveCategory(''); }}>
                            <X size={16} /> Clear
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className={styles.searchWrap}>
                    <Search size={16} className={styles.searchIco} />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search channels..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                    {searchQuery && (
                        <button className={styles.clearX} onClick={() => setSearchQuery('')}><X size={14} /></button>
                    )}
                </div>

                {/* Categories */}
                <div className={styles.cats}>
                    <button className={`${styles.cat} ${!activeCategory ? styles.catActive : ''}`} onClick={() => setActiveCategory('')}>All</button>
                    {categories.map(c => (
                        <button key={c} className={`${styles.cat} ${activeCategory === c ? styles.catActive : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
                    ))}
                </div>

                {/* List */}
                <div className={styles.list}>
                    {searching ? (
                        <div className={styles.searching}>
                            <div className={styles.miniSpinner}></div>
                            Searching...
                        </div>
                    ) : channels.length === 0 ? (
                        <div className={styles.noResult}>No channels found</div>
                    ) : (
                        channels.map(ch => {
                            const isActive = currentChannel?.url === ch.url;
                            return (
                                <div key={ch.id || ch.url} className={`${styles.item} ${isActive ? styles.itemActive : ''}`} onClick={() => setCurrentChannel(ch)}>
                                    {ch.logo ? (
                                        <img src={ch.logo} alt={ch.name} className={styles.logo} onError={e => e.target.style.display = 'none'} />
                                    ) : (
                                        <div className={styles.logoPlaceholder}><Tv size={18} /></div>
                                    )}
                                    <div className={styles.itemInfo}>
                                        <span className={styles.itemName}>{ch.name}</span>
                                        <span className={styles.itemCat}>{ch.category}</span>
                                    </div>
                                    {isActive && <Signal size={14} className={styles.activeSignal} />}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveTV;
