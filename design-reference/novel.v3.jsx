// elys mode — VN reader · V2 Capsule Stack, итерации
// Три развития одной идеи: имя-чип + glass-капсула с речью.

// ────────────────────────────────────────────────────────────────────────
// Контент
// ────────────────────────────────────────────────────────────────────────
const STORY = {
  narrator:
    'Дождь шёл всю ночь. К утру город пах мокрым асфальтом — и чем-то ещё, что Элис не могла вспомнить.',
  character: { name: 'ЭЛИС', initial: 'Э', line: 'Ты пришёл. Я не была уверена, что придёшь.' },
  choicesPrompt: 'Что ответить',
  choices: [
    'Я думал о тебе всю неделю',
    'Просто проходил мимо',
    'Молча подойти и обнять',
  ],
};

const W = 360;
const H = 780;
const ACCENT = '#d4ff00';
const ACCENT_GLOW = 'rgba(212,255,0,0.35)';

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const SF_MONO = '"SF Mono", ui-monospace, Menlo, Consolas, monospace';

// ────────────────────────────────────────────────────────────────────────
// Liquid glass styles
// ────────────────────────────────────────────────────────────────────────
const glass = (radius = 28, opacity = 0.10) => ({
  background: `rgba(255,255,255,${opacity})`,
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: radius,
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.22), ' +
    'inset 0 -1px 0 rgba(0,0,0,0.2), ' +
    '0 22px 60px rgba(0,0,0,0.6), ' +
    '0 6px 16px rgba(0,0,0,0.35)',
});

const GlassHighlight = () => (
  <div style={{
    position: 'absolute', top: 0, left: 14, right: 14, height: 1,
    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent)',
    borderRadius: 999, pointerEvents: 'none',
  }} />
);

// ────────────────────────────────────────────────────────────────────────
// Фон + персонаж
// ────────────────────────────────────────────────────────────────────────
const BgPlaceholder = () => {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 35%, #161821 0%, #000 78%)' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
        <defs>
          <pattern id="vn-bg-stripes" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="22" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#vn-bg-stripes)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.65) 100%)' }} />
      <div style={{
        position: 'absolute', left: 14, top: 50,
        fontFamily: SF_MONO, fontSize: 9,
        color: 'rgba(255,255,255,0.28)', letterSpacing: 0.4,
      }}>bg/street_night.png</div>
    </div>
  );
};

const CharPlaceholder = ({ dim = false, hidden = false, name = 'elys' }) => {
  if (hidden) return null;
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 0,
      transform: 'translateX(-50%)',
      width: '78%', height: '84%',
      pointerEvents: 'none',
      opacity: dim ? 0.2 : 1,
      transition: 'opacity .3s',
      filter: dim ? 'blur(0.5px)' : 'none',
    }}>
      <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="char-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.025)" />
          </linearGradient>
          <pattern id="char-stripes" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3.2" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <path d="M50,28 C40,28 35,34 34,44 L30,80 C26,95 25,112 27,140 L73,140 C75,112 74,95 70,80 L66,44 C65,34 60,28 50,28 Z"
              fill="url(#char-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
        <path d="M50,28 C40,28 35,34 34,44 L30,80 C26,95 25,112 27,140 L73,140 C75,112 74,95 70,80 L66,44 C65,34 60,28 50,28 Z"
              fill="url(#char-stripes)" />
        <rect x="46" y="22" width="8" height="7" fill="url(#char-grad)" />
        <ellipse cx="50" cy="15" rx="8.5" ry="9.5" fill="url(#char-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
      </svg>
      <div style={{
        position: 'absolute', bottom: 12, left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: SF_MONO, fontSize: 9,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 0.5, whiteSpace: 'nowrap',
      }}>{name}.png</div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Статус-бар, home indicator, chapter pill
// ────────────────────────────────────────────────────────────────────────
const StatusBar = () => (
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, height: 44,
    zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px',
    fontFamily: SF, fontSize: 14.5, fontWeight: 600,
    color: 'rgba(255,255,255,0.95)', pointerEvents: 'none',
    letterSpacing: -0.2,
  }}>
    <span>9:41</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="7" width="3" height="3" rx="0.5"/><rect x="4" y="5" width="3" height="5" rx="0.5"/><rect x="8" y="3" width="3" height="7" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
      <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="0.8">
        <rect x="0.5" y="0.5" width="18" height="10" rx="2.5"/>
        <rect x="2" y="2" width="13" height="7" fill="currentColor" stroke="none"/>
        <rect x="20" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" stroke="none"/>
      </svg>
    </div>
  </div>
);

const HomeIndicator = () => (
  <div style={{
    position: 'absolute', bottom: 8, left: '50%',
    transform: 'translateX(-50%)',
    width: 134, height: 5, borderRadius: 999,
    background: 'rgba(255,255,255,0.95)',
    zIndex: 12, pointerEvents: 'none',
  }} />
);

const ChapterPill = ({ chapter = 'Глава 1', progress = '004 / 128' }) => (
  <div style={{
    position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
    zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '6px 14px',
    ...glass(999, 0.1),
    fontFamily: SF, fontSize: 12, fontWeight: 500,
    color: 'rgba(255,255,255,0.88)', letterSpacing: -0.1,
  }}>
    <GlassHighlight />
    <span>{chapter}</span>
    <span style={{ opacity: 0.4 }}>·</span>
    <span style={{ fontFamily: SF_MONO, fontSize: 10.5, opacity: 0.7, letterSpacing: 0.4 }}>{progress}</span>
  </div>
);

// ────────────────────────────────────────────────────────────────────────
// Icons + Nav
// ────────────────────────────────────────────────────────────────────────
const Icon = ({ kind, size = 19, color = 'rgba(255,255,255,0.96)' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'menu': return (<svg {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>);
    case 'log': return (<svg {...props}><path d="M4 6h16v10H9l-4 4v-4H4z"/></svg>);
    case 'auto': return (<svg {...props}><path d="M5 4l8 8-8 8"/><path d="M13 4l8 8-8 8"/></svg>);
    case 'skip': return (<svg {...props}><path d="M4 5l8 7-8 7V5z" fill={color}/><path d="M14 5l8 7-8 7V5z" fill={color}/></svg>);
    case 'save': return (<svg {...props}><path d="M6 4h12v17l-6-4-6 4V4z"/></svg>);
    case 'close': return (<svg {...props}><path d="M6 6l12 12M18 6l-12 12"/></svg>);
    case 'arrow': return (<svg {...props}><path d="M6 12h12M13 7l5 5-5 5"/></svg>);
    default: return null;
  }
};

const NavButton = ({ icon, label, active = false }) => (
  <button style={{
    width: 44, height: 44, borderRadius: 22,
    border: 'none', cursor: 'pointer',
    background: active ? `linear-gradient(180deg, ${ACCENT} 0%, oklch(0.88 0.2 120) 100%)` : 'transparent',
    color: active ? '#000' : 'rgba(255,255,255,0.95)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: SF, transition: 'background .15s',
    boxShadow: active ? '0 4px 14px rgba(212,255,0,0.4), inset 0 1px 0 rgba(255,255,255,0.45)' : 'none',
    padding: 0,
  }} title={label}>
    <Icon kind={icon} color={active ? '#000' : 'rgba(255,255,255,0.95)'} />
  </button>
);

const FloatingNav = ({ split = false }) => {
  if (split) {
    return (
      <div style={{
        position: 'absolute', bottom: 32, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 8, zIndex: 11,
      }}>
        <div style={{ position: 'relative', display: 'flex', gap: 2, padding: 5, ...glass(24, 0.09) }}>
          <GlassHighlight />
          <NavButton icon="menu" label="меню" />
          <NavButton icon="log" label="лог" />
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 2, padding: 5, ...glass(24, 0.09) }}>
          <GlassHighlight />
          <NavButton icon="auto" label="авто" active />
          <NavButton icon="skip" label="скип" />
          <NavButton icon="save" label="сохранить" />
        </div>
      </div>
    );
  }
  return (
    <div style={{
      position: 'absolute', bottom: 32, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
      zIndex: 11,
    }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, padding: 5, ...glass(28, 0.09) }}>
        <GlassHighlight />
        <NavButton icon="menu" label="меню" />
        <NavButton icon="log" label="лог" />
        <NavButton icon="auto" label="авто" active />
        <NavButton icon="skip" label="скип" />
        <NavButton icon="save" label="сохранить" />
      </div>
    </div>
  );
};

const CornerGlass = ({ icon = 'close', side = 'right' }) => (
  <button style={{
    position: 'absolute', top: 100, [side]: 16, zIndex: 10,
    width: 40, height: 40, ...glass(20, 0.1),
    border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <Icon kind={icon} size={18} />
  </button>
);

// ────────────────────────────────────────────────────────────────────────
// Shell
// ────────────────────────────────────────────────────────────────────────
const Shell = ({ dim = false, hideChar = false, children, navSplit = false, showChapter = true }) => (
  <div style={{
    width: '100%', height: '100%',
    position: 'relative', overflow: 'hidden',
    background: '#000', color: '#fff',
    fontFamily: SF, WebkitFontSmoothing: 'antialiased',
  }}>
    <BgPlaceholder />
    <CharPlaceholder dim={dim} hidden={hideChar} />
    <StatusBar />
    {showChapter && <ChapterPill />}
    <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>{children}</div>
    <FloatingNav split={navSplit} />
    <HomeIndicator />
  </div>
);

// ────────────────────────────────────────────────────────────────────────
// A · POLISHED CLASSIC — V2 как есть, но дотянутый
// • Имя-чип над капсулой (как было)
// • Свежее: лайм-инициал вместо чёрного шарика
// • Тонкая лайм-граница сверху speech-капсулы как «подсвет»
// • Анимированный ▶ в кружке снизу-справа
// ────────────────────────────────────────────────────────────────────────
const VA = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell dim>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            position: 'relative', ...glass(999, 0.1),
            padding: '7px 14px', marginBottom: 10, marginLeft: 6,
            fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.85)',
          }}>
            <GlassHighlight />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
            НАРРАТОР
          </div>
          <div style={{
            position: 'relative', ...glass(32, 0.1),
            padding: '22px 22px 22px',
          }}>
            <GlassHighlight />
            <p style={{
              fontSize: 17, lineHeight: 1.5, margin: 0,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: -0.25, fontWeight: 400, textWrap: 'pretty',
              fontStyle: 'italic',
            }}>{STORY.narrator}</p>
            <div style={{
              marginTop: 14, display: 'flex', justifyContent: 'flex-end',
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                animation: 'vn-pulse 1.6s infinite',
              }}>
                <Icon kind="arrow" size={14} color="rgba(255,255,255,0.85)" />
              </span>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: ACCENT, color: '#000',
            borderRadius: 999, padding: '7px 14px 7px 6px',
            fontFamily: SF, fontSize: 11.5, letterSpacing: 0.8, fontWeight: 700,
            marginBottom: 10, marginLeft: 6,
            boxShadow: '0 8px 22px rgba(212,255,0,0.4), inset 0 1px 0 rgba(255,255,255,0.55)',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#000', color: ACCENT,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SF, fontSize: 11, fontWeight: 700, letterSpacing: 0,
            }}>{STORY.character.initial}</span>
            {STORY.character.name}
          </div>
          <div style={{
            position: 'relative', ...glass(32, 0.1),
            padding: '22px 22px',
            borderTop: `1px solid ${ACCENT_GLOW}`,
            boxShadow:
              'inset 0 1px 0 rgba(212,255,0,0.5), ' +
              'inset 0 -1px 0 rgba(0,0,0,0.2), ' +
              '0 22px 60px rgba(0,0,0,0.6), ' +
              '0 0 0 1px rgba(212,255,0,0.08)',
          }}>
            <p style={{
              fontSize: 18.5, lineHeight: 1.4, margin: 0, color: '#fff',
              letterSpacing: -0.4, fontWeight: 400, textWrap: 'pretty',
            }}>{STORY.character.line}</p>
            <div style={{
              marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: SF_MONO, fontSize: 10, opacity: 0.5, letterSpacing: 0.8 }}>тап чтобы продолжить</span>
              <span style={{
                width: 26, height: 26, borderRadius: '50%',
                background: ACCENT, color: '#000',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                animation: 'vn-pulse 1.6s infinite',
                boxShadow: '0 4px 12px rgba(212,255,0,0.5)',
              }}>
                <Icon kind="arrow" size={14} color="#000" />
              </span>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell dim navSplit>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 112,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2,
      }}>
        <div style={{
          display: 'inline-flex', position: 'relative', alignSelf: 'center', alignItems: 'center', gap: 8,
          ...glass(999, 0.1),
          padding: '7px 14px', marginBottom: 6,
          fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.85)',
        }}>
          <GlassHighlight />
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT_GLOW}` }} />
          {STORY.choicesPrompt.toUpperCase()}
        </div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', position: 'relative',
            padding: '18px 22px',
            ...glass(999, 0.1),
            color: '#fff', textAlign: 'left',
            fontFamily: SF, fontSize: 15.5, fontWeight: 500,
            letterSpacing: -0.3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <GlassHighlight />
            <span style={{
              width: 24, height: 24, borderRadius: 999,
              background: 'rgba(212,255,0,0.15)',
              border: `1px solid ${ACCENT_GLOW}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SF_MONO, fontSize: 10, color: ACCENT, fontWeight: 600,
              flex: '0 0 auto',
            }}>{i + 1}</span>
            <span style={{ flex: 1, textWrap: 'pretty' }}>{c}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// B · TUCKED — имя-чип «вкладывается» в угол speech-капсулы
// • Имя налезает на верхний-левый угол через negative margin
// • Speech-капсула становится единым «листом» с чипом
// • Ощущение глубины и iOS-слойности
// ────────────────────────────────────────────────────────────────────────
const VB = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell dim>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', top: -14, left: 16, zIndex: 2,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              ...glass(999, 0.15),
              padding: '7px 14px',
              fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 1.5,
              color: 'rgba(255,255,255,0.9)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
              НАРРАТОР
            </div>
            <div style={{
              position: 'relative', ...glass(32, 0.1),
              padding: '26px 22px 22px',
            }}>
              <GlassHighlight />
              <p style={{
                fontSize: 17, lineHeight: 1.5, margin: 0,
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: -0.25, fontWeight: 400, textWrap: 'pretty',
                fontStyle: 'italic',
              }}>{STORY.narrator}</p>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{ position: 'relative' }}>
            {/* tucked name chip */}
            <div style={{
              position: 'absolute', top: -16, left: 16, zIndex: 2,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: ACCENT, color: '#000',
              borderRadius: 999, padding: '7px 14px 7px 6px',
              fontFamily: SF, fontSize: 11.5, letterSpacing: 0.8, fontWeight: 700,
              boxShadow: '0 8px 22px rgba(212,255,0,0.45), inset 0 1px 0 rgba(255,255,255,0.55)',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: '#000', color: ACCENT,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SF, fontSize: 11, fontWeight: 700,
              }}>{STORY.character.initial}</span>
              {STORY.character.name}
            </div>
            <div style={{
              position: 'relative', ...glass(32, 0.1),
              padding: '28px 22px 22px',
            }}>
              <GlassHighlight />
              <p style={{
                fontSize: 18.5, lineHeight: 1.4, margin: 0, color: '#fff',
                letterSpacing: -0.4, fontWeight: 400, textWrap: 'pretty',
              }}>{STORY.character.line}</p>
              <div style={{
                marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontFamily: SF_MONO, fontSize: 10, opacity: 0.5, letterSpacing: 0.8 }}>далее</span>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: ACCENT, color: '#000',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'vn-pulse 1.6s infinite',
                  boxShadow: '0 4px 14px rgba(212,255,0,0.5)',
                }}>
                  <Icon kind="arrow" size={14} color="#000" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell dim navSplit>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 112,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2,
      }}>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <div style={{
            position: 'absolute', top: -14, left: 14, zIndex: 2,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            ...glass(999, 0.15),
            padding: '7px 14px',
            fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.9)',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT_GLOW}` }} />
            {STORY.choicesPrompt.toUpperCase()}
          </div>
          <div style={{ position: 'relative', ...glass(28, 0.08), paddingTop: 22, paddingBottom: 8, padding: '22px 8px 8px' }}>
            <GlassHighlight />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STORY.choices.map((c, i) => (
                <button key={i} style={{
                  width: '100%', position: 'relative',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  color: '#fff', textAlign: 'left',
                  fontFamily: SF, fontSize: 15.5, fontWeight: 500,
                  letterSpacing: -0.3, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: 'rgba(212,255,0,0.15)',
                    border: `1px solid ${ACCENT_GLOW}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SF_MONO, fontSize: 10, color: ACCENT, fontWeight: 600,
                    flex: '0 0 auto',
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, textWrap: 'pretty' }}>{c}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// C · BIG & SOFT — крупная типографика, мягкий ритм, минимум хрома
// • Имя-чип очень компактный (без аватарки), лайм-точка
// • Speech-капсула с большим радиусом и больше воздуха
// • Печатающаяся точка-каретка в конце текста
// • Выбор: высокие капсулы с тенью лайм-свечения у активного
// ────────────────────────────────────────────────────────────────────────
const VC = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell dim>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            position: 'relative', ...glass(999, 0.1),
            padding: '6px 14px', marginBottom: 12, marginLeft: 8,
            fontFamily: SF_MONO, fontSize: 10, letterSpacing: 2,
            color: 'rgba(255,255,255,0.7)',
          }}>
            <GlassHighlight />
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
            НАРРАТОР
          </div>
          <div style={{
            position: 'relative', ...glass(36, 0.08),
            padding: '26px 24px',
          }}>
            <GlassHighlight />
            <p style={{
              fontSize: 19, lineHeight: 1.45, margin: 0,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: -0.35, fontWeight: 400, textWrap: 'pretty',
              fontStyle: 'italic',
            }}>
              {STORY.narrator}
              <span style={{
                display: 'inline-block', width: 9, height: 19, marginLeft: 4,
                background: ACCENT, verticalAlign: -3,
                animation: 'vn-blink 1.1s infinite', borderRadius: 1,
              }} />
            </p>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: ACCENT, color: '#000',
            borderRadius: 999, padding: '7px 16px',
            fontFamily: SF, fontSize: 11.5, letterSpacing: 0.8, fontWeight: 700,
            marginBottom: 12, marginLeft: 8,
            boxShadow: '0 10px 24px rgba(212,255,0,0.45), inset 0 1px 0 rgba(255,255,255,0.55)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#000',
            }} />
            {STORY.character.name}
          </div>
          <div style={{
            position: 'relative', ...glass(36, 0.08),
            padding: '26px 24px',
          }}>
            <GlassHighlight />
            <p style={{
              fontSize: 21, lineHeight: 1.35, margin: 0, color: '#fff',
              letterSpacing: -0.5, fontWeight: 400, textWrap: 'pretty',
            }}>
              {STORY.character.line}
              <span style={{
                display: 'inline-block', width: 11, height: 21, marginLeft: 4,
                background: ACCENT, verticalAlign: -3,
                animation: 'vn-blink 1.1s infinite', borderRadius: 1,
                boxShadow: `0 0 12px ${ACCENT_GLOW}`,
              }} />
            </p>
          </div>
        </div>
      </Shell>
    );
  }
  // choices — высокие капсулы, активный с лайм-свечением
  return (
    <Shell dim navSplit>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 112,
        display: 'flex', flexDirection: 'column', gap: 12, zIndex: 2,
      }}>
        <div style={{
          fontFamily: SF, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
          color: 'rgba(255,255,255,0.75)', marginLeft: 8, marginBottom: 2,
        }}>{STORY.choicesPrompt}</div>
        {STORY.choices.map((c, i) => {
          const focused = i === 0;
          return (
            <button key={i} style={{
              width: '100%', position: 'relative',
              padding: '20px 22px',
              ...glass(999, 0.1),
              color: '#fff', textAlign: 'left',
              fontFamily: SF, fontSize: 16, fontWeight: 500,
              letterSpacing: -0.3, cursor: 'pointer',
              ...(focused ? {
                borderColor: ACCENT_GLOW,
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.25), ' +
                  'inset 0 -1px 0 rgba(0,0,0,0.2), ' +
                  '0 22px 60px rgba(0,0,0,0.6), ' +
                  `0 0 0 1px ${ACCENT_GLOW}, ` +
                  `0 8px 30px ${ACCENT_GLOW}`,
              } : {}),
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <GlassHighlight />
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: focused ? ACCENT : 'rgba(255,255,255,0.35)',
                boxShadow: focused ? `0 0 10px ${ACCENT_GLOW}` : 'none',
                flex: '0 0 auto',
              }} />
              <span style={{ flex: 1, textWrap: 'pretty' }}>{c}</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Канва
// ────────────────────────────────────────────────────────────────────────
const Section = ({ id, title, subtitle, Variant }) => (
  <DCSection id={id} title={title} subtitle={subtitle}>
    <DCArtboard id={`${id}-n`} label="нарратор" width={W} height={H}>
      <Variant state="narrator" />
    </DCArtboard>
    <DCArtboard id={`${id}-c`} label="реплика" width={W} height={H}>
      <Variant state="character" />
    </DCArtboard>
    <DCArtboard id={`${id}-ch`} label="выбор" width={W} height={H}>
      <Variant state="choices" />
    </DCArtboard>
  </DCSection>
);

const App = () => (
  <DesignCanvas>
    <Section
      id="vA"
      title="A · Polished Classic"
      subtitle="Базовый V2, дотянутый: имя-чип с лайм-инициалом, тонкая лайм-граница на капсуле реплики, ▶ внутри лайм-кружка."
      Variant={VA}
    />
    <Section
      id="vB"
      title="B · Tucked"
      subtitle="Имя-чип вкладывается в верхний левый угол капсулы (negative margin). Слойность, ощущение глубины."
      Variant={VB}
    />
    <Section
      id="vC"
      title="C · Big & Soft"
      subtitle="Крупный текст, больше радиус и воздух. Печатающаяся лайм-каретка. У активного выбора — лайм-свечение."
      Variant={VC}
    />
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
