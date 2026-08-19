import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Mic,
  Video,
  Bell,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Subtitles,
  Settings,
  Maximize,
  Minimize,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Download,
  Scissors,
  MoreHorizontal,
  Send,
  Camera,
  CameraOff,
  MicOff,
  Crown,
  Users,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  Wifi,
  X,
} from 'lucide-react';
import { InviteModal } from '../packages/ui/src/index.js';

interface Participant {
  id: string;
  name: string;
  role: 'HOST' | 'MEMBER';
  isSpeaking: boolean;
  isMuted: boolean;
  cameraOn: boolean;
  color: string;
  avatarUrl: string;
}

interface RecommendedVideo {
  id: string;
  title: string;
  channel: string;
  views: string;
  time: string;
  duration: string;
  thumbnailUrl: string;
  verified: boolean;
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(44);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isExtensionPopupOpen, setIsExtensionPopupOpen] = useState<boolean>(false);
  const [myMic, setMyMic] = useState<boolean>(true);
  const [myCamera, setMyCamera] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  const playerRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      id: '1',
      sender: 'Bhargava',
      role: 'HOST' as const,
      color: '#F2BB31',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      text: 'Starting Dune 2 trailer in 4K HDR! Sub-50ms sync locked in 🍿',
      time: '19:14',
      reactions: ['🔥 4', '🍿 3'],
    },
    {
      id: '2',
      sender: 'Dinesh',
      role: 'MEMBER' as const,
      color: '#06B6D4',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      text: 'Audio is crystal clear. The participants grid looks clean on the sidebar!',
      time: '19:15',
      reactions: ['🚀 2'],
    },
    {
      id: '3',
      sender: 'Elena',
      role: 'MEMBER' as const,
      color: '#EC4899',
      avatarUrl: '',
      text: 'Look at the sandworm scene coming up 👀',
      time: '19:15',
      reactions: ['❤️ 5'],
    },
  ]);
  const [inputText, setInputText] = useState('');

  // Participants list with high-fidelity gradients & colors
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: '1',
      name: 'Bhargava',
      role: 'HOST',
      isSpeaking: true,
      isMuted: false,
      cameraOn: true,
      color: '#F2BB31',
      avatarUrl: '',
    },
    {
      id: '2',
      name: 'Dinesh',
      role: 'MEMBER',
      isSpeaking: false,
      isMuted: false,
      cameraOn: true,
      color: '#06B6D4',
      avatarUrl: '',
    },
    {
      id: '3',
      name: 'Elena',
      role: 'MEMBER',
      isSpeaking: false,
      isMuted: true,
      cameraOn: false,
      color: '#EC4899',
      avatarUrl: '',
    },
    {
      id: '4',
      name: 'Alex',
      role: 'MEMBER',
      isSpeaking: false,
      isMuted: false,
      cameraOn: true,
      color: '#8B5CF6',
      avatarUrl: '',
    },
  ]);

  // Recommended videos with self-contained styling
  const recommendedVideos: RecommendedVideo[] = [
    {
      id: '1',
      title: 'Dune: Part Two - The Sandworm Ride Sequence in IMAX 4K',
      channel: 'Warner Bros. Pictures',
      views: '4.2M views',
      time: '2 weeks ago',
      duration: '08:42',
      thumbnailUrl: '',
      verified: true,
    },
    {
      id: '2',
      title: 'Hans Zimmer Live - Dune: Part Two Full Official Suite (4K)',
      channel: 'WaterTower Music',
      views: '6.1M views',
      time: '1 month ago',
      duration: '24:18',
      thumbnailUrl: '',
      verified: true,
    },
    {
      id: '3',
      title: 'Interstellar - The Docking Scene in 4K HDR 60FPS',
      channel: 'Movieclips Classic',
      views: '48M views',
      time: '3 years ago',
      duration: '05:22',
      thumbnailUrl: '',
      verified: true,
    },
    {
      id: '4',
      title: 'Cinematography Breakdown: Greig Fraser on Dune & Batman',
      channel: 'StudioBinder',
      views: '1.8M views',
      time: '5 months ago',
      duration: '14:05',
      thumbnailUrl: '',
      verified: false,
    },
    {
      id: '5',
      title: 'Oppenheimer - Can You Hear The Music (Official Audio)',
      channel: 'Ludwig Göransson',
      views: '22M views',
      time: '1 year ago',
      duration: '03:45',
      thumbnailUrl: '',
      verified: true,
    },
  ];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (playerRef.current?.requestFullscreen) {
        playerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(!isFullscreen);
        });
      } else {
        setIsFullscreen(!isFullscreen);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleMic = () => {
    const next = !myMic;
    setMyMic(next);
    setParticipants((prev) => prev.map((p) => (p.role === 'HOST' ? { ...p, isMuted: !next } : p)));
  };

  const toggleCamera = () => {
    const next = !myCamera;
    setMyCamera(next);
    setParticipants((prev) => prev.map((p) => (p.role === 'HOST' ? { ...p, cameraOn: next } : p)));
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const msg = {
      id: Date.now().toString(),
      sender: 'You',
      role: 'MEMBER' as const,
      color: '#F2BB31',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: [],
    };
    setChatMessages((prev) => [...prev, msg]);
    setInputText('');
  };

  const handleQuickReaction = (emoji: string) => {
    const id = Date.now();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 1800);

    const msg = {
      id: Date.now().toString(),
      sender: 'You',
      role: 'MEMBER' as const,
      color: '#F2BB31',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      text: emoji,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: [],
    };
    setChatMessages((prev) => [...prev, msg]);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText('https://huddly.app/join/hud-7k9p');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="ambient-glow-wrapper"
      style={{ minHeight: '100vh', backgroundColor: '#08080C', color: '#F8FAFC' }}
    >
      {/* 1. YouTube Top Navbar */}
      <header className="yt-navbar">
        <div className="yt-nav-left">
          <button className="yt-icon-btn" aria-label="Guide">
            <Menu style={{ width: 20, height: 20 }} />
          </button>
          <a href="#" className="yt-logo">
            <div
              style={{
                backgroundColor: '#FF0000',
                width: 28,
                height: 20,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(255, 0, 0, 0.4)',
              }}
            >
              <Play
                style={{ width: 10, height: 10, fill: '#FFFFFF', color: '#FFFFFF', marginLeft: 2 }}
              />
            </div>
            <span>YouTube</span>
            <span
              style={{
                fontSize: 10,
                color: '#94A3B8',
                alignSelf: 'flex-start',
                marginLeft: 2,
                fontWeight: 700,
              }}
            >
              IN
            </span>
          </a>
        </div>

        {/* Search Bar */}
        <div className="yt-nav-search">
          <div className="yt-search-box">
            <input
              type="text"
              placeholder="Search"
              defaultValue="Dune: Part Two Official Trailer 3"
              className="yt-search-input"
            />
          </div>
          <button className="yt-search-btn" title="Search">
            <Search style={{ width: 18, height: 18 }} />
          </button>
          <button
            className="yt-icon-btn"
            style={{ marginLeft: 8, background: '#161924' }}
            title="Search with voice"
          >
            <Mic style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Right Nav Icons + Huddly Extension Active Pill */}
        <div className="yt-nav-right">
          <div
            onClick={() => setIsExtensionPopupOpen(true)}
            className="huddly-nav-pill"
            title="Open Huddly Extension Popup (09. Active Room)"
          >
            <img
              src="/docs/design/brand/logo-16.svg"
              alt="Huddly"
              style={{ width: 15, height: 15 }}
            />
            <span>Room: Sci-Fi Night</span>
            <span className="huddly-pulse-dot" />
          </div>

          <button className="yt-icon-btn" title="Create">
            <Video style={{ width: 20, height: 20 }} />
          </button>
          <button className="yt-icon-btn" title="Notifications">
            <Bell style={{ width: 20, height: 20 }} />
          </button>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#BF7118',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #F2BB31',
              cursor: 'pointer',
            }}
          >
            B
          </div>
        </div>
      </header>

      {/* 2. Main Watch Page Layout */}
      <main className="yt-watch-layout">
        {/* Left Column: Video Player & Video Metadata */}
        <div>
          {/* Video Player Container */}
          <div
            ref={playerRef}
            className={`yt-player-container ${isFullscreen ? 'is-fullscreen' : ''}`}
          >
            {/* Cinematic Movie Backdrop with Ambient Contrast */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at center, rgba(191, 113, 24, 0.35) 0%, rgba(8, 10, 16, 0.96) 100%), #080A10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ textAlign: 'center', backdropFilter: 'blur(2px)' }}>
                <h2
                  style={{
                    fontSize: isFullscreen ? 40 : 28,
                    fontWeight: 800,
                    letterSpacing: '0.2em',
                    color: '#FAF3E4',
                    textTransform: 'uppercase',
                    textShadow: '0 4px 20px rgba(0,0,0,0.8)',
                  }}
                >
                  Dune: Part Two
                </h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: 'rgba(242, 187, 49, 0.2)',
                      color: '#F2BB31',
                      border: '1px solid rgba(242, 187, 49, 0.4)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    4K HDR 60FPS
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#F8FAFC',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    DOLBY ATMOS
                  </span>
                </div>
              </div>
            </div>

            {/* Minimal Sync Indicator Pill */}
            <div
              className="huddly-inplayer-pill"
              onClick={() => setIsExtensionPopupOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <span className="huddly-pulse-dot" />
              <img
                src="/docs/design/brand/logo-16.svg"
                alt="Huddly"
                style={{ width: 14, height: 14 }}
              />
              <span style={{ fontWeight: 700, fontSize: 12 }}>Sci-Fi Night</span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--huddly-butter)',
                  fontWeight: 700,
                  background: 'rgba(242, 187, 49, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                ⚡ Synced (0ms)
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                <Users style={{ width: 12, height: 12, display: 'inline', marginRight: 3 }} />4
                watching
              </span>
            </div>

            {/* Native YouTube Controls Bar */}
            <div className="yt-controls-bar">
              {/* Progress Scrubber */}
              <div
                className="yt-progress-container"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  setProgress(Math.round(pct));
                }}
              >
                <div className="yt-progress-buffer" style={{ width: '78%' }} />
                <div className="yt-progress-played" style={{ width: `${progress}%` }} />
                <div className="yt-progress-scrubber" style={{ left: `${progress}%` }} />
              </div>

              {/* Buttons Row */}
              <div className="yt-buttons-row">
                <div className="yt-left-controls">
                  <button
                    className="yt-icon-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Pause (k)' : 'Play (k)'}
                  >
                    {isPlaying ? (
                      <Pause style={{ width: 22, height: 22, fill: 'currentColor' }} />
                    ) : (
                      <Play style={{ width: 22, height: 22, fill: 'currentColor' }} />
                    )}
                  </button>

                  <button className="yt-icon-btn" title="Next (Shift+N)">
                    <SkipForward style={{ width: 20, height: 20 }} />
                  </button>

                  <button
                    className="yt-icon-btn"
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
                  >
                    {isMuted ? (
                      <VolumeX style={{ width: 20, height: 20 }} />
                    ) : (
                      <Volume2 style={{ width: 20, height: 20 }} />
                    )}
                  </button>

                  <span className="yt-time-display">1:44 / 3:15</span>
                </div>

                <div className="yt-right-controls">
                  <button className="yt-icon-btn" title="Subtitles/closed captions (c)">
                    <Subtitles style={{ width: 20, height: 20 }} />
                  </button>

                  <button className="yt-icon-btn" title="Settings">
                    <Settings style={{ width: 20, height: 20 }} />
                  </button>

                  <button
                    className="yt-icon-btn"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit Full screen (f)' : 'Full screen (f)'}
                  >
                    {isFullscreen ? (
                      <Minimize style={{ width: 19, height: 19 }} />
                    ) : (
                      <Maximize style={{ width: 19, height: 19 }} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Title & Metadata */}
          <div className="yt-video-info-section">
            <h1 className="yt-video-title">Dune: Part Two | Official Trailer 3</h1>

            {/* Channel Row & Actions */}
            <div className="yt-channel-row">
              <div className="yt-channel-meta">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#1E2330',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                    color: '#F8FAFC',
                  }}
                >
                  WB
                </div>
                <div>
                  <div className="yt-channel-name">
                    <span>Warner Bros. Pictures</span>
                    <CheckCircle2 style={{ width: 14, height: 14, color: '#94A3B8' }} />
                  </div>
                  <div className="yt-sub-count">11.8M subscribers</div>
                </div>
                <button className="yt-sub-btn">Subscribe</button>
              </div>

              <div className="yt-actions-group">
                <div
                  style={{
                    display: 'inline-flex',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    className="yt-pill-btn"
                    style={{ border: 'none', borderRadius: 0, paddingRight: 14 }}
                  >
                    <ThumbsUp style={{ width: 16, height: 16 }} /> 342K
                  </button>
                  <div style={{ width: 1, backgroundColor: 'var(--border-subtle)' }} />
                  <button
                    className="yt-pill-btn"
                    style={{ border: 'none', borderRadius: 0, paddingLeft: 14 }}
                  >
                    <ThumbsDown style={{ width: 16, height: 16 }} />
                  </button>
                </div>

                <button className="yt-pill-btn">
                  <Share2 style={{ width: 16, height: 16 }} /> Share
                </button>
                <button className="yt-pill-btn">
                  <Download style={{ width: 16, height: 16 }} /> Download
                </button>
                <button className="yt-pill-btn">
                  <Scissors style={{ width: 16, height: 16 }} /> Clip
                </button>
                <button className="yt-pill-btn" style={{ padding: '8px 12px' }}>
                  <MoreHorizontal style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            {/* Description Box */}
            <div className="yt-description-box">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                54,821,904 views • Premiered Dec 12, 2023 • #DuneMovie #Dune2
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>
                Paul Atreides unites with Chani and the Fremen while seeking revenge against the
                conspirators who destroyed his family. Facing a choice between the love of his life
                and the fate of the universe, he endeavors to prevent a terrible future only he can
                foresee.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Premium Huddly Social Hub (Videos + Chat) & YouTube Recommended */}
        <div className="right-sidebar-container">
          {/* Huddly Watch Party Hub */}
          <div className="huddly-party-box">
            {/* Header */}
            <div className="huddly-party-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src="/docs/design/brand/logo-mark.svg"
                  alt="Huddly"
                  style={{ width: 22, height: 22 }}
                />
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>
                  Watch Party
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'var(--huddly-butter)',
                    backgroundColor: 'rgba(242, 187, 49, 0.15)',
                    border: '1px solid rgba(242, 187, 49, 0.3)',
                    padding: '2px 7px',
                    borderRadius: 4,
                  }}
                >
                  LIVE
                </span>
              </div>

              {/* Quick Controls on Party Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={toggleMic}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: '#161924',
                    border: '1px solid var(--border-medium)',
                    color: myMic ? '#10B981' : '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title={myMic ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {myMic ? (
                    <Mic style={{ width: 14, height: 14 }} />
                  ) : (
                    <MicOff style={{ width: 14, height: 14 }} />
                  )}
                </button>

                <button
                  onClick={toggleCamera}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: '#161924',
                    border: '1px solid var(--border-medium)',
                    color: myCamera ? '#10B981' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title={myCamera ? 'Camera Off' : 'Camera On'}
                >
                  {myCamera ? (
                    <Camera style={{ width: 14, height: 14 }} />
                  ) : (
                    <CameraOff style={{ width: 14, height: 14 }} />
                  )}
                </button>

                <button
                  onClick={handleCopyCode}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#161924',
                    color: '#F8FAFC',
                    border: '1px solid var(--border-medium)',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? (
                    <Check style={{ width: 13, height: 13, color: '#10B981' }} />
                  ) : (
                    <Copy style={{ width: 13, height: 13 }} />
                  )}
                  {copied ? 'Copied' : 'Invite'}
                </button>
              </div>
            </div>

            {/* Participant Webcam Video Grid (Above Chat) with Live Equalizer */}
            <div className="huddly-sidebar-videos">
              {participants.map((p) => (
                <div key={p.id} className={`sidebar-cam-tile ${p.isSpeaking ? 'is-speaking' : ''}`}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: p.cameraOn
                        ? `radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08) 0%, #161924 100%)`
                        : '#10121A',
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        backgroundColor: '#1E2330',
                        border: `2px solid ${p.color}`,
                        color: p.color,
                        fontWeight: 800,
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: p.isSpeaking ? `0 0 16px ${p.color}44` : 'none',
                      }}
                    >
                      {p.name[0]}
                    </div>
                  </div>

                  <div className="sidebar-cam-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.role === 'HOST' && (
                        <Crown style={{ width: 10, height: 10, color: '#F2BB31' }} />
                      )}
                      <span>{p.name}</span>
                    </span>

                    {p.isSpeaking ? (
                      <div className="audio-equalizer">
                        <span className="audio-bar" />
                        <span className="audio-bar" />
                        <span className="audio-bar" />
                      </div>
                    ) : p.isMuted ? (
                      <MicOff style={{ width: 10, height: 10, color: '#EF4444' }} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Chat Stream */}
            <div className="huddly-chat-stream">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="huddly-chat-item">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: '#1E2330',
                      border: `1.5px solid ${msg.color}`,
                      color: msg.color,
                      fontWeight: 800,
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {msg.sender[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: msg.color }}>
                        {msg.sender}
                      </span>
                      {msg.role === 'HOST' && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            backgroundColor: 'rgba(242, 187, 49, 0.2)',
                            color: '#F2BB31',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}
                        >
                          HOST
                        </span>
                      )}
                      <span
                        style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}
                      >
                        {msg.time}
                      </span>
                    </div>

                    <div className="huddly-chat-bubble-yt">{msg.text}</div>

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {msg.reactions.map((r, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: 11,
                              background: '#161924',
                              border: '1px solid var(--border-subtle)',
                              padding: '2px 6px',
                              borderRadius: 10,
                              color: '#F8FAFC',
                            }}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Floating Emojis Physics Container */}
              {floatingEmojis.map((item) => (
                <div key={item.id} className="floating-emoji">
                  {item.emoji}
                </div>
              ))}
            </div>

            {/* Quick Reactions & Input */}
            <div className="huddly-chat-input-row">
              <div className="huddly-quick-reactions">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Quick:
                </span>
                {['🍿', '🔥', '🚀', '❤️', '😂', '👀'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleQuickReaction(emoji)}
                    className="huddly-reaction-chip"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleSendMessage}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Chat with room…"
                  className="huddly-input"
                  style={{
                    backgroundColor: '#10121A',
                    borderColor: 'var(--border-medium)',
                    borderRadius: 20,
                    padding: '8px 14px',
                    fontSize: 13,
                    width: '100%',
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: inputText.trim() ? '#F2BB31' : '#1E2330',
                    color: inputText.trim() ? '#08080C' : '#64748B',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: inputText.trim() ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    boxShadow: inputText.trim() ? '0 2px 10px rgba(242, 187, 49, 0.4)' : 'none',
                  }}
                >
                  <Send style={{ width: 14, height: 14 }} />
                </button>
              </form>
            </div>
          </div>

          {/* YouTube Recommended Videos */}
          <div className="yt-recs-section">
            <h3 className="yt-recs-heading">Recommended Videos</h3>
            {recommendedVideos.map((vid) => (
              <div key={vid.id} className="yt-rec-card">
                <div className="yt-rec-thumbnail-wrapper">
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #1E2332 0%, #10131C 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.5)',
                      fontWeight: 800,
                      fontSize: 12,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    IMAX 4K
                  </div>
                  <span className="yt-rec-duration">{vid.duration}</span>
                </div>

                <div className="yt-rec-info">
                  <h4 className="yt-rec-title">{vid.title}</h4>
                  <div
                    className="yt-rec-channel"
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>{vid.channel}</span>
                    {vid.verified && (
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#94A3B8' }} />
                    )}
                  </div>
                  <div className="yt-rec-meta">
                    {vid.views} • {vid.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 3. Authentic Chrome Extension Popup Modal (09. Active Room - Balanced) */}
      {isExtensionPopupOpen && (
        <div className="huddly-popup-overlay" onClick={() => setIsExtensionPopupOpen(false)}>
          <div className="huddly-extension-window" onClick={(e) => e.stopPropagation()}>
            <div className="ext-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src="/docs/design/brand/logo-16.svg"
                  alt="Huddly"
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontWeight: 800, fontSize: 14 }}>Huddly Extension</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  ACTIVE
                </span>
              </div>
              <button className="yt-icon-btn" onClick={() => setIsExtensionPopupOpen(false)}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div className="ext-body">
              {/* Room Code Stat Box */}
              <div className="ext-stat-card">
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    ROOM CODE
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#F2BB31',
                    }}
                  >
                    hud-7k9p-m2x4
                  </div>
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#202534',
                    border: '1px solid var(--border-medium)',
                    color: '#F8FAFC',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? (
                    <Check style={{ width: 14, height: 14, color: '#10B981' }} />
                  ) : (
                    <Copy style={{ width: 14, height: 14 }} />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Sync Health Meter */}
              <div
                style={{
                  background: '#161924',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Wifi style={{ width: 18, height: 18, color: '#10B981' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Playback Sync Locked</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Latency: 12ms • Drift: 0.00s
                    </div>
                  </div>
                </div>
                <Sparkles style={{ width: 16, height: 16, color: '#F2BB31' }} />
              </div>

              {/* Participants Roster in Extension */}
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}
                >
                  PARTICIPANTS (4)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {participants.map((p) => (
                    <div key={p.id} className="ext-participant-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            backgroundColor: '#202534',
                            border: `1.5px solid ${p.color}`,
                            color: p.color,
                            fontWeight: 800,
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {p.name[0]}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                        {p.role === 'HOST' && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: '#F2BB31',
                              background: 'rgba(242, 187, 49, 0.2)',
                              padding: '1px 4px',
                              borderRadius: 3,
                            }}
                          >
                            HOST
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.isMuted ? (
                          <MicOff style={{ width: 14, height: 14, color: '#EF4444' }} />
                        ) : (
                          <Mic style={{ width: 14, height: 14, color: '#10B981' }} />
                        )}
                        {p.cameraOn ? (
                          <Camera style={{ width: 14, height: 14, color: '#10B981' }} />
                        ) : (
                          <CameraOff style={{ width: 14, height: 14, color: '#64748B' }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomCode="hud-7k9p-m2x4"
        inviteUrl="https://huddly.app/join/hud-7k9p-m2x4"
      />
    </div>
  );
}
