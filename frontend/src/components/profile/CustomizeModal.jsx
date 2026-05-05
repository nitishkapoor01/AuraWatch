import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Palette, Layout, Type, Settings2, Check, Info, MousePointer2, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import styles from './CustomizeModal.module.css';

// ---- DATA ----
const THEMES = [
  { id: 'classic', label: 'Netflix Classic', cls: styles.themeClassic },
  { id: 'liquid-glass', label: 'Liquid Glass', cls: styles.themeLiquidGlass },
  { id: 'dark', label: 'Dark', cls: styles.themeDark },
  { id: 'midnight', label: 'Midnight', cls: styles.themeMidnight },
  { id: 'light', label: 'Light', cls: styles.themeLight },
  { id: 'ocean', label: 'Ocean', cls: styles.themeOcean },
  { id: 'sunset', label: 'Sunset', cls: styles.themeSunset },
];

const LAYOUTS = [
  { id: 'cinematic', label: 'Cinematic', desc: 'Hero + scroll rows' },
  { id: 'grid', label: 'Grid', desc: 'Dense card grid' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean & centered' },
];

const HERO_SIZES = [
  { id: 'full', label: 'Full Screen' },
  { id: 'half', label: 'Half Screen' },
  { id: 'compact', label: 'Compact' },
  { id: 'hidden', label: 'Hidden' },
];

const CONTENT_WIDTHS = [
  { id: 'full', label: 'Full Width' },
  { id: 'contained', label: 'Contained' },
  { id: 'narrow', label: 'Narrow' },
];

const NAV_STYLES = [
  { id: 'transparent', label: 'Transparent' },
  { id: 'solid', label: 'Solid' },
  { id: 'glass', label: 'Glass' },
  { id: 'hidden', label: 'Auto-Hide' },
];

const ROW_STYLES = [
  { id: 'scroll', label: 'Horizontal Scroll' },
  { id: 'wrap', label: 'Wrapping Grid' },
];

const CARD_STYLES = [
  { id: 'poster', label: 'Poster', desc: '2:3 portrait' },
  { id: 'backdrop', label: 'Backdrop', desc: '16:9 landscape' },
  { id: 'minimal', label: 'Minimal', desc: 'No shadows' },
  { id: 'rounded', label: 'Circle', desc: '1:1 circle' },
];

const CARD_SIZES = [
  { id: 'small', label: 'S' },
  { id: 'medium', label: 'M' },
  { id: 'large', label: 'L' },
  { id: 'xlarge', label: 'XL' },
];

const HOVER_EFFECTS = [
  { id: 'scale', label: 'Scale Up' },
  { id: 'glow', label: 'Neon Glow' },
  { id: 'lift', label: 'Lift' },
  { id: 'flip', label: '3D Tilt' },
  { id: 'none', label: 'None' },
];

const FONTS = [
  { id: "'Inter', sans-serif", label: 'Inter', preview: 'Modern' },
  { id: "'Georgia', serif", label: 'Georgia', preview: 'Classic' },
  { id: "'Roboto', sans-serif", label: 'Roboto', preview: 'Clean' },
  { id: "'Playfair Display', serif", label: 'Playfair', preview: 'Elegant' },
  { id: "'Space Grotesk', sans-serif", label: 'Space Grotesk', preview: 'Techy' },
  { id: "'Outfit', sans-serif", label: 'Outfit', preview: 'Sleek' },
  { id: "'JetBrains Mono', monospace", label: 'JetBrains', preview: 'Code' },
];

const BUTTON_STYLES = [
  { id: 'filled', label: 'Filled', desc: 'Solid background' },
  { id: 'outline', label: 'Outline', desc: 'Border only' },
  { id: 'ghost', label: 'Ghost', desc: 'Transparent' },
  { id: 'pill', label: 'Pill', desc: 'Rounded ends' },
  { id: 'sharp', label: 'Sharp', desc: 'No radius' },
];

const SCROLLBAR_STYLES = [
  { id: 'thin', label: 'Thin' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'default', label: 'Default' },
];

const BG_EFFECTS = [
  { id: 'none', label: 'None' },
  { id: 'particles', label: 'Particles' },
  { id: 'gradient-mesh', label: 'Gradient Mesh' },
  { id: 'grain', label: 'Film Grain' },
];

const ACCENT_PRESETS = [
  '#e50914', '#0071eb', '#2ecc71', '#9b59b6',
  '#f39c12', '#e91e63', '#00bcd4', '#ff5722',
];

const SIDEBAR_ITEMS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'cards', label: 'Cards', icon: Sparkles },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'buttons', label: 'Buttons & Nav', icon: MousePointer2 },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

// ---- CHIP SELECTOR ----
const ChipSelector = ({ options, value, onChange, style }) => (
  <div className={styles.chipGrid} style={style}>
    {options.map(opt => (
      <button
        key={opt.id}
        className={`${styles.chip} ${value === opt.id ? styles.chipActive : ''}`}
        onClick={() => onChange(opt.id)}
      >
        <span className={styles.chipLabel}>{opt.label}</span>
        {opt.desc && <span className={styles.chipDesc}>{opt.desc}</span>}
      </button>
    ))}
  </div>
);

// ---- MINI CARD PREVIEW ----
const CardStylePreview = ({ type }) => {
  const aspectMap = { poster: '2/3', backdrop: '16/9', minimal: '2/3', rounded: '1/1' };
  return (
    <div
      className={styles.cardPreviewBox}
      style={{
        aspectRatio: aspectMap[type] || '2/3',
        borderRadius: type === 'rounded' ? '50%' : type === 'minimal' ? '0' : '6px',
        boxShadow: type === 'minimal' ? 'none' : undefined,
        border: type === 'minimal' ? '1px solid rgba(255,255,255,0.15)' : undefined,
      }}
    />
  );
};

// ---- MAIN COMPONENT ----
const CustomizeModal = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences, defaultPreferences } = useTheme();
  const { isLoggedIn } = useAuth();
  const [activeSection, setActiveSection] = useState('appearance');

  if (!isOpen) return null;

  const sectionTitles = {
    appearance: 'Appearance',
    layout: 'Layout',
    cards: 'Cards',
    typography: 'Typography',
    buttons: 'Buttons & Nav',
    advanced: 'Advanced',
  };

  const handleReset = () => {
    updatePreferences(defaultPreferences);
  };

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>

        {/* SIDEBAR */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Customize</h2>
            <p>Your AuraWatch</p>
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
                          className={`${styles.colorSwatch} colorSwatch ${preferences.accentColor === color ? styles.selectedColor : ''}`}
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

                <div className={styles.settingGroup}>
                  <h4>Background Effect</h4>
                  <ChipSelector
                    options={BG_EFFECTS}
                    value={preferences.backgroundEffect}
                    onChange={v => updatePreferences({ backgroundEffect: v })}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <strong>Neon Glow</strong>
                      <span>Glow effect on accent elements</span>
                    </div>
                    <button
                      className={`${styles.toggle} ${preferences.glowEffects ? styles.on : ''}`}
                      onClick={() => updatePreferences({ glowEffects: !preferences.glowEffects })}
                    >
                      <div className={styles.toggleThumb} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ===== LAYOUT ===== */}
            {activeSection === 'layout' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Page Layout</h4>
                  <ChipSelector
                    options={LAYOUTS}
                    value={preferences.layout}
                    onChange={v => updatePreferences({ layout: v })}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <h4>Hero Section Size</h4>
                  <ChipSelector
                    options={HERO_SIZES}
                    value={preferences.heroSize}
                    onChange={v => updatePreferences({ heroSize: v })}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <h4>Content Width</h4>
                  <ChipSelector
                    options={CONTENT_WIDTHS}
                    value={preferences.contentWidth}
                    onChange={v => updatePreferences({ contentWidth: v })}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <h4>Row Style</h4>
                  <ChipSelector
                    options={ROW_STYLES}
                    value={preferences.rowStyle}
                    onChange={v => updatePreferences({ rowStyle: v })}
                    style={{ gridTemplateColumns: '1fr 1fr' }}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <h4>Sidebar</h4>
                  <ChipSelector
                    options={[
                      { id: 'left', label: 'Visible' },
                      { id: 'hidden', label: 'Hidden' },
                    ]}
                    value={preferences.sidebarPosition}
                    onChange={v => updatePreferences({ sidebarPosition: v })}
                    style={{ gridTemplateColumns: '1fr 1fr' }}
                  />
                </div>
              </>
            )}

            {/* ===== CARDS ===== */}
            {activeSection === 'cards' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Card Shape</h4>
                  <div className={styles.cardStyleGrid}>
                    {CARD_STYLES.map(cs => (
                      <div
                        key={cs.id}
                        className={`${styles.cardStyleOption} ${preferences.cardStyle === cs.id ? styles.cardStyleActive : ''}`}
                        onClick={() => updatePreferences({ cardStyle: cs.id })}
                      >
                        <CardStylePreview type={cs.id} />
                        <span className={styles.cardStyleLabel}>{cs.label}</span>
                        <span className={styles.cardStyleDesc}>{cs.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Card Size</h4>
                  <div className={styles.sizeSelector}>
                    {CARD_SIZES.map(s => (
                      <button
                        key={s.id}
                        className={`${styles.sizeBtn} ${preferences.cardSize === s.id ? styles.sizeBtnActive : ''}`}
                        onClick={() => updatePreferences({ cardSize: s.id })}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Hover Effect</h4>
                  <ChipSelector
                    options={HOVER_EFFECTS}
                    value={preferences.cardHoverEffect}
                    onChange={v => updatePreferences({ cardHoverEffect: v })}
                  />
                </div>
              </>
            )}

            {/* ===== TYPOGRAPHY ===== */}
            {activeSection === 'typography' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Body Font</h4>
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
                  <h4>Heading Font</h4>
                  <div className={styles.fontGrid}>
                    {FONTS.map(f => (
                      <div
                        key={f.id}
                        className={`${styles.fontOption} ${preferences.headingFont === f.id ? styles.selectedFont : ''}`}
                        style={{ fontFamily: f.id }}
                        onClick={() => updatePreferences({ headingFont: f.id })}
                      >
                        <span className={styles.fontOptionLabel}>{f.label}</span>
                        <span className={styles.fontOptionPreview}>{f.preview}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Size & Spacing</h4>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Font Size</span>
                      <span className={styles.controlValue}>{preferences.fontSize}px</span>
                    </div>
                    <input type="range" className={styles.slider} min="12" max="22" value={preferences.fontSize}
                      onChange={e => updatePreferences({ fontSize: Number(e.target.value) })} />
                  </div>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Line Height</span>
                      <span className={styles.controlValue}>{preferences.lineHeight}</span>
                    </div>
                    <input type="range" className={styles.slider} min="1.2" max="2.0" step="0.1" value={preferences.lineHeight}
                      onChange={e => updatePreferences({ lineHeight: Number(e.target.value) })} />
                  </div>
                  <div className={styles.controlRow}>
                    <div className={styles.controlLabel}>
                      <span>Letter Spacing</span>
                      <span className={styles.controlValue}>{preferences.letterSpacing}px</span>
                    </div>
                    <input type="range" className={styles.slider} min="-1" max="4" step="0.5" value={preferences.letterSpacing}
                      onChange={e => updatePreferences({ letterSpacing: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            )}

            {/* ===== BUTTONS & NAV ===== */}
            {activeSection === 'buttons' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Button Style</h4>
                  <div className={styles.btnStyleGrid}>
                    {BUTTON_STYLES.map(bs => (
                      <button
                        key={bs.id}
                        className={`${styles.btnStyleOption} ${preferences.buttonStyle === bs.id ? styles.btnStyleActive : ''}`}
                        onClick={() => updatePreferences({ buttonStyle: bs.id })}
                        style={{
                          borderRadius: bs.id === 'pill' ? '50px' : bs.id === 'sharp' ? '0' : '6px',
                          background: bs.id === 'filled' ? 'var(--primary-color)' :
                            bs.id === 'ghost' ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: bs.id === 'outline' ? '2px solid var(--primary-color)' : 
                            bs.id === 'ghost' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          color: bs.id === 'outline' ? 'var(--primary-color)' : '#fff',
                        }}
                      >
                        <span>{bs.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.settingGroup}>
                  <h4>Navbar Style</h4>
                  <ChipSelector
                    options={NAV_STYLES}
                    value={preferences.navStyle}
                    onChange={v => updatePreferences({ navStyle: v })}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <h4>Scrollbar</h4>
                  <ChipSelector
                    options={SCROLLBAR_STYLES}
                    value={preferences.scrollbarStyle}
                    onChange={v => updatePreferences({ scrollbarStyle: v })}
                  />
                </div>
              </>
            )}

            {/* ===== ADVANCED ===== */}
            {activeSection === 'advanced' && (
              <>
                <div className={styles.settingGroup}>
                  <h4>Density</h4>
                  <ChipSelector
                    options={[
                      { id: 'compact', label: 'Compact' },
                      { id: 'comfortable', label: 'Comfortable' },
                    ]}
                    value={preferences.density}
                    onChange={v => updatePreferences({ density: v })}
                    style={{ gridTemplateColumns: '1fr 1fr' }}
                  />
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
            <button className={styles.resetBtn} onClick={handleReset}>Reset to Netflix Classic</button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default CustomizeModal;
