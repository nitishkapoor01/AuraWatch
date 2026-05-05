import React from 'react';
import { useTheme } from '../context/ThemeContext';

const BackgroundEffects = () => {
  const { preferences } = useTheme();
  const effect = preferences?.backgroundEffect || 'none';

  if (effect === 'none') return null;

  return (
    <>
      {effect === 'particles' && <ParticlesEffect accent={preferences.accentColor} />}
      {effect === 'gradient-mesh' && <GradientMeshEffect accent={preferences.accentColor} />}
      {effect === 'grain' && <GrainEffect />}
    </>
  );
};

/* ── Particles: floating CSS dots ─────────────────────── */
const ParticlesEffect = ({ accent }) => {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.3 + 0.05,
  }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes aura-float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-30vh) translateX(10vw); }
          50% { transform: translateY(-60vh) translateX(-5vw); }
          75% { transform: translateY(-30vh) translateX(-10vw); }
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: accent || '#e50914',
            opacity: p.opacity,
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: `aura-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
};

/* ── Gradient Mesh: animated blobs ────────────────────── */
const GradientMeshEffect = ({ accent }) => {
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const color = accent || '#e50914';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes aura-blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30vw, -20vh) scale(1.2); }
          66% { transform: translate(-10vw, 20vh) scale(0.8); }
        }
        @keyframes aura-blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-20vw, 30vh) scale(0.9); }
          66% { transform: translate(15vw, -15vh) scale(1.15); }
        }
        @keyframes aura-blob3 {
          0%, 100% { transform: translate(0, 0) scale(1.1); }
          33% { transform: translate(10vw, 25vh) scale(0.85); }
          66% { transform: translate(-25vw, -10vh) scale(1.05); }
        }
      `}</style>
      {[
        { anim: 'aura-blob1', x: '20%', y: '20%', size: '40vw', color: hexToRgba(color, 0.08), dur: '25s' },
        { anim: 'aura-blob2', x: '60%', y: '60%', size: '35vw', color: 'rgba(100, 100, 255, 0.06)', dur: '30s' },
        { anim: 'aura-blob3', x: '80%', y: '30%', size: '30vw', color: hexToRgba(color, 0.05), dur: '22s' },
      ].map((blob, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: blob.x,
            top: blob.y,
            width: blob.size,
            height: blob.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
            animation: `${blob.anim} ${blob.dur} ease-in-out infinite`,
            filter: 'blur(60px)',
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
};

/* ── Grain: noise overlay ─────────────────────────────── */
const GrainEffect = () => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
    opacity: 0.04,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
    backgroundSize: '128px 128px',
    mixBlendMode: 'overlay',
  }} />
);

export default BackgroundEffects;
