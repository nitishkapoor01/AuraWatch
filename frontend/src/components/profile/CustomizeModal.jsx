import React, { useState } from 'react';
import { X, Palette, Layout, Type, Settings2, Check, Info } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import styles from './CustomizeModal.module.css';

// ---- DATA ----
const THEMES = [
  { id: 'liquid-glass', label: 'Liquid Glass', cls: styles.themeLiquidGlass },
  { id: 'dark', label: 'Dark', cls: styles.themeDark },
  { id: 'midnight', label: 'Midnight', cls: styles.themeMidnight },
  { id: 'light', label: 'Light', cls: styles.themeLight },
  { id: 'ocean', label: 'Ocean', cls: styles.themeOcean },
  { id: 'sunset', label: 'Sunset', cls: styles.themeSunset },
];

const LAYOUTS = [
  { id: 'cinematic', label: 'Cinematic', preview: 'hero' },
  { id: 'grid', label: 'Grid', preview: 'grid' },
  { id: 'minimal', label: 'Minimal', preview: 'minimal' },
];

const FONTS = [
  { id: "'Inter', sans-serif", label: 'Inter', preview: 'Modern' },
  { id: "'Georgia', serif", label: 'Georgia', preview: 'Classic' },
  { id: "'Roboto', sans-serif", label: 'Roboto', preview: 'Clean' },
  { id: "'Playfair Display', serif", label: 'Playfair', preview: 'Elegant' },
  { id: "'Space Grotesk', sans-serif", label: 'Space Grotesk', preview: 'Techy' },
];

const ACCENT_PRESETS = [
  '#e50914', '#0071eb', '#2ecc71', '#9b59b6',
  '#f39c12', '#e91e63', '#00bcd4', '#ff5722',
];

const SIDEBAR_ITEMS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

// ---- LAYOUT PREVIEW ----
const LayoutPreview = ({ type }) => (
  <div className={styles.layoutPreview}>
    {type === 'hero' && (
      <>
        <div className={styles.layoutPreviewHero} style={{ height: '14px' }} />
        <div className={styles.layoutPreviewRow}>
          <div className={styles.layoutPreviewCard} />
          <div className={styles.layoutPreviewCard} />
          <div className={styles.layoutPreviewCard} />
        </div>
      </>
    )}
    {type === 'grid' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px', flex: 1 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={styles.layoutPreviewCard} />
        ))}
      </div>
    )}
    {type === 'minimal' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        <div className={styles.layoutPreviewCard} style={{ height: '6px', width: '60%' }} />
        <div className={styles.layoutPreviewCard} style={{ height: '4px', width: '80%' }} />
        <div className={styles.layoutPreviewRow} style={{ marginTop: '4px' }}>
          <div className={styles.layoutPreviewCard} />
          <div className={styles.layoutPreviewCard} />
        </div>
      </div>
    )}
  </div>
);

// ---- MAIN COMPONENT ----
const CustomizeModal = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences, defaultPreferences } = useTheme();
  const { isLoggedIn } = useAuth();
  const [activeSection, setActiveSection] = useState('appearance');

  if (!isOpen) return null;

  const sectionTitles = {
    appearance: 'Appearance',
    layout: 'Layout',
    typography: 'Typography',
    advanced: 'Advanced',
  };

  const handleReset = () => {
    updatePreferences(defaultPreferences);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>

        {/* SIDEBAR */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Customize</h2>
            <p>Personalize AuraWatch</p>
          </div>
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeSection === item.id ? styles.active : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* MAIN CONTENT */}
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <h3>{sectionTitles[activeSection]}</h3>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {!isLoggedIn && (
            <div className={styles.guestBanner}>
              <Info size={14} />
              Login to save your preferences permanently
            </div>
          )}

          <div className={styles.scrollArea}>

            {/* ===== APPEARANCE ===== */}
            {activeSection === 'appearance' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Theme</h4>
                  <div className={styles.themeGrid}>
                    {THEMES.map(t => (
                      <div
                        key={t.id}
                        className={`${styles.themeCard} ${t.cls} ${preferences.theme === t.id ? styles.selected : ''}`}
                        onClick={() => updatePreferences({ theme: t.id })}
                      >
                        {preferences.theme === t.id && (
                          <div className={styles.checkmark}><Check size={10} color="white" /></div>
                        )}
                        <span className={styles.themeLabel}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Accent Color</h4>
                  <div className={styles.colorSection}>
                    <div className={styles.colorPresets}>
                      {ACCENT_PRESETS.map(color => (
                        <div
                          key={color}
                          className={`${styles.colorSwatch} ${preferences.accentColor === color ? styles.selectedColor : ''}`}
                          style={{ background: color }}
                          onClick={() => updatePreferences({ accentColor: color })}
                        />
                      ))}
                    </div>
                    <div className={styles.customColorRow}>
                      <span>Custom</span>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={preferences.accentColor}
                        onChange={e => updatePreferences({ accentColor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Glass Effect</h4>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Blur Intensity</span>
                      <span className={styles.controlValue}>{preferences.blurIntensity}px</span>
                    </div>
                    <input type="range" className={styles.slider} min="0" max="30" value={preferences.blurIntensity}
                      onChange={e => updatePreferences({ blurIntensity: Number(e.target.value) })} />
                  </div>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Transparency</span>
                      <span className={styles.controlValue}>{Math.round(preferences.transparency * 100)}%</span>
                    </div>
                    <input type="range" className={styles.slider} min="0.3" max="1" step="0.05" value={preferences.transparency}
                      onChange={e => updatePreferences({ transparency: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            )}

            {/* ===== LAYOUT ===== */}
            {activeSection === 'layout' && (
              <div className={styles.settingGroup}>
                <h4>Page Layout</h4>
                <div className={styles.layoutGrid}>
                  {LAYOUTS.map(l => (
                    <div
                      key={l.id}
                      className={`${styles.layoutCard} ${preferences.layout === l.id ? styles.selected : ''}`}
                      onClick={() => updatePreferences({ layout: l.id })}
                    >
                      <LayoutPreview type={l.preview} />
                      <span className={styles.layoutLabel}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== TYPOGRAPHY ===== */}
            {activeSection === 'typography' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Font Family</h4>
                  <div className={styles.fontGrid}>
                    {FONTS.map(f => (
                      <div
                        key={f.id}
                        className={`${styles.fontOption} ${preferences.fontFamily === f.id ? styles.selectedFont : ''}`}
                        style={{ fontFamily: f.id }}
                        onClick={() => updatePreferences({ fontFamily: f.id })}
                      >
                        <span className={styles.fontOptionLabel}>{f.label}</span>
                        <span className={styles.fontOptionPreview}>{f.preview}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Size</h4>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Font Size</span>
                      <span className={styles.controlValue}>{preferences.fontSize}px</span>
                    </div>
                    <input type="range" className={styles.slider} min="12" max="20" value={preferences.fontSize}
                      onChange={e => updatePreferences({ fontSize: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            )}

            {/* ===== ADVANCED ===== */}
            {activeSection === 'advanced' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Density</h4>
                  <div className={styles.layoutGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {['compact', 'comfortable'].map(d => (
                      <div
                        key={d}
                        className={`${styles.layoutCard} ${preferences.density === d ? styles.selected : ''}`}
                        onClick={() => updatePreferences({ density: d })}
                      >
                        <span className={styles.layoutLabel} style={{ textTransform: 'capitalize' }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Shape & Shadow</h4>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Border Radius</span>
                      <span className={styles.controlValue}>{preferences.borderRadius}px</span>
                    </div>
                    <input type="range" className={styles.slider} min="0" max="24" value={preferences.borderRadius}
                      onChange={e => updatePreferences({ borderRadius: Number(e.target.value) })} />
                  </div>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Shadow Intensity</span>
                      <span className={styles.controlValue}>{Math.round(preferences.shadowIntensity * 100)}%</span>
                    </div>
                    <input type="range" className={styles.slider} min="0" max="1" step="0.05" value={preferences.shadowIntensity}
                      onChange={e => updatePreferences({ shadowIntensity: Number(e.target.value) })} />
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Behavior</h4>
                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <strong>Animations</strong>
                      <span>Smooth transitions and micro-animations</span>
                    </div>
                    <button
                      className={`${styles.toggle} ${preferences.animations ? styles.on : ''}`}
                      onClick={() => updatePreferences({ animations: !preferences.animations })}
                    >
                      <div className={styles.toggleThumb} />
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>

          <div className={styles.footer}>
            <button className={styles.resetBtn} onClick={handleReset}>Reset to Defaults</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomizeModal;
