// elys mode — VN reader · iOS 26 liquid glass edition
// Пять направлений диалогового UI, единый язык: чёрный фон, #d4ff00 акцент,
// SF Pro, парящие glass-капсулы.

// ────────────────────────────────────────────────────────────────────────
// Контент
// ────────────────────────────────────────────────────────────────────────
const STORY = {
  narrator:
    'Дождь шёл всю ночь. К утру город пах мокрым асфальтом — и чем-то ещё, что Элис не могла вспомнить.',
  character: { name: 'ЭЛИС', line: 'Ты пришёл. Я не была уверена, что придёшь.' },
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

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const SF_MONO = '"SF Mono", ui-monospace, Menlo, Consolas, monospace';
const SF_ROUNDED = '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", system-ui, sans-serif';

// ────────────────────────────────────────────────────────────────────────
// Liquid glass — переиспользуемые стили
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

// Тонкая «refraction» подсветка сверху капсулы
const glassHighlight = {
  content: '""',
  position: 'absolute', top: 0, left: 12, right: 12, height: 1,
  background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.45), transparent)',
  borderRadius: 999,
};

// ────────────────────────────────────────────────────────────────────────
// Фон + персонаж (заглушки)
// ────────────────────────────────────────────────────────────────────────
const BgPlaceholder = ({ scene = 'street' }) => {
  const palettes = {
    street: { a: '#161821', b: '#000', label: 'bg/street_night.png' },
    room:   { a: '#1a1320', b: '#000', label: 'bg/room_dusk.png' },
  };
  const p = palettes[scene] || palettes.street;
  const id = `vn-stripes-${scene}`;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 80% at 50% 35%, ${p.a} 0%, ${p.b} 78%)` }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
        <defs>
          <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="22" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.65) 100%)' }} />
      <div style={{
        position: 'absolute', left: 14, top: 50,
        fontFamily: SF_MONO, fontSize: 9,
        color: 'rgba(255,255,255,0.28)', letterSpacing: 0.4,
      }}>{p.label}</div>
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
// Статус-бар и home indicator
// ────────────────────────────────────────────────────────────────────────
const StatusBar = () => (
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, height: 44,
    zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px',
    fontFamily: SF, fontSize: 14.5, fontWeight: 600,
    color: 'rgba(255,255,255,0.95)',
    pointerEvents: 'none',
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

// ────────────────────────────────────────────────────────────────────────
// Liquid glass icons (SF Symbol-ish стиль)
// ────────────────────────────────────────────────────────────────────────
const Icon = ({ kind, size = 20, color = 'rgba(255,255,255,0.96)' }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'menu': return (<svg {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>);
    case 'log': return (<svg {...props}><path d="M4 6h16v10H9l-4 4v-4H4z"/></svg>);
    case 'auto': return (<svg {...props}><path d="M5 4l8 8-8 8"/><path d="M13 4l8 8-8 8"/></svg>);
    case 'skip': return (<svg {...props}><path d="M4 5l8 7-8 7V5z" fill={color}/><path d="M14 5l8 7-8 7V5z" fill={color}/></svg>);
    case 'save': return (<svg {...props}><path d="M6 4h12v17l-6-4-6 4V4z"/></svg>);
    case 'close': return (<svg {...props}><path d="M6 6l12 12M18 6l-12 12"/></svg>);
    case 'play': return (<svg {...props}><path d="M7 4l13 8-13 8V4z" fill={color}/></svg>);
    case 'sound': return (<svg {...props}><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8"/></svg>);
    default: return null;
  }
};

// ────────────────────────────────────────────────────────────────────────
// Floating liquid glass nav bar (внизу)
// ────────────────────────────────────────────────────────────────────────
const NavButton = ({ icon, label, active = false, big = false }) => (
  <button style={{
    width: big ? 52 : 44, height: big ? 52 : 44,
    borderRadius: big ? 26 : 22,
    border: 'none', cursor: 'pointer',
    background: active ? `linear-gradient(180deg, ${ACCENT} 0%, oklch(0.88 0.2 120) 100%)` : 'transparent',
    color: active ? '#000' : 'rgba(255,255,255,0.95)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: SF, fontSize: 11, fontWeight: 600,
    transition: 'background .15s',
    boxShadow: active ? '0 4px 14px rgba(212,255,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)' : 'none',
    padding: 0,
  }} title={label}>
    <Icon kind={icon} size={big ? 22 : 19} color={active ? '#000' : 'rgba(255,255,255,0.95)'} />
  </button>
);

const FloatingNav = () => (
  <div style={{
    position: 'absolute', bottom: 32, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
    zIndex: 11,
  }}>
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 2,
      padding: 5,
      ...glass(28, 0.09),
    }}>
      <div style={{ ...glassHighlight, position: 'absolute' }} />
      <NavButton icon="menu" label="меню" />
      <NavButton icon="log" label="лог" />
      <NavButton icon="auto" label="авто" active />
      <NavButton icon="skip" label="скип" />
      <NavButton icon="save" label="сохранить" />
    </div>
  </div>
);

// Компактный «инлайн» вариант — короче, для V4
const FloatingNavCompact = () => (
  <div style={{
    position: 'absolute', bottom: 32, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', gap: 8, zIndex: 11,
  }}>
    <div style={{
      position: 'relative', display: 'flex', gap: 2, padding: 5,
      ...glass(24, 0.09),
    }}>
      <div style={{ ...glassHighlight, position: 'absolute' }} />
      <NavButton icon="menu" label="меню" />
      <NavButton icon="log" label="лог" />
    </div>
    <div style={{
      position: 'relative', display: 'flex', gap: 2, padding: 5,
      ...glass(24, 0.09),
    }}>
      <div style={{ ...glassHighlight, position: 'absolute' }} />
      <NavButton icon="auto" label="авто" active />
      <NavButton icon="skip" label="скип" />
      <NavButton icon="save" label="сохранить" />
    </div>
  </div>
);

// Маленькая glass-кнопка в углу (закрыть/настройки)
const CornerGlass = ({ icon = 'close', side = 'right' }) => (
  <button style={{
    position: 'absolute', top: 60, [side]: 16, zIndex: 10,
    width: 40, height: 40,
    ...glass(20, 0.1),
    border: '1px solid rgba(255,255,255,0.14)',
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <Icon kind={icon} size={18} />
  </button>
);

// ────────────────────────────────────────────────────────────────────────
// Шасси экрана
// ────────────────────────────────────────────────────────────────────────
const Shell = ({ bg = 'street', dim = false, hideChar = false, charName = 'elys', children, nav = 'full' }) => (
  <div style={{
    width: '100%', height: '100%',
    position: 'relative', overflow: 'hidden',
    background: '#000', color: '#fff',
    fontFamily: SF,
    WebkitFontSmoothing: 'antialiased',
  }}>
    <BgPlaceholder scene={bg} />
    <CharPlaceholder dim={dim} hidden={hideChar} name={charName} />
    <StatusBar />
    <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>{children}</div>
    {nav === 'full' && <FloatingNav />}
    {nav === 'compact' && <FloatingNavCompact />}
    <HomeIndicator />
  </div>
);

// ────────────────────────────────────────────────────────────────────────
// Карточка с именем персонажа — лайм-чип (единый язык)
// ────────────────────────────────────────────────────────────────────────
const NameChip = ({ name, size = 'm' }) => {
  const padding = size === 'l' ? '8px 14px 8px 11px' : '6px 12px 6px 9px';
  const fontSize = size === 'l' ? 12 : 11;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: ACCENT, color: '#000',
      borderRadius: 999, padding,
      fontFamily: SF, fontSize, letterSpacing: 0.8, fontWeight: 700,
      textTransform: 'uppercase',
      boxShadow: '0 8px 22px rgba(212,255,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
    }}>
      <span style={{
        width: size === 'l' ? 16 : 14, height: size === 'l' ? 16 : 14, borderRadius: '50%',
        background: 'linear-gradient(135deg, #2a2a2a, #000)',
        border: '1px solid rgba(0,0,0,0.2)',
      }} />
      {name}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V1 · GLASS SLAB — один большой стеклянный слиток (рекомендуемый дефолт)
// ────────────────────────────────────────────────────────────────────────
const V1 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 110, left: 14, right: 14 }}>
          <div style={{
            position: 'relative',
            ...glass(28, 0.1),
            padding: '20px 22px 22px',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              fontFamily: SF_MONO, fontSize: 10, letterSpacing: 1.5,
              color: 'rgba(255,255,255,0.55)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.45)' }} />
              НАРРАТОР
            </div>
            <p style={{
              fontSize: 17, lineHeight: 1.45, fontWeight: 400,
              margin: 0, color: 'rgba(255,255,255,0.96)',
              letterSpacing: -0.3, textWrap: 'pretty',
            }}>{STORY.narrator}</p>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="street">
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 110, left: 14, right: 14 }}>
          <div style={{ marginLeft: 8, marginBottom: -10, position: 'relative', zIndex: 2 }}>
            <NameChip name={STORY.character.name} />
          </div>
          <div style={{
            position: 'relative',
            ...glass(28, 0.1),
            padding: '22px 22px 22px',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <p style={{
              fontSize: 18, lineHeight: 1.4, fontWeight: 400,
              margin: 0, color: '#fff', letterSpacing: -0.4, textWrap: 'pretty',
            }}>{STORY.character.line}</p>
            <div style={{
              marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: SF_MONO, fontSize: 10, opacity: 0.5, letterSpacing: 0.8 }}>тап чтобы продолжить</span>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(255,255,255,0.16)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#fff', fontFamily: SF, fontWeight: 600,
                animation: 'vn-pulse 1.6s infinite',
              }}>›</span>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim nav="compact">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 112,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2,
      }}>
        <div style={{
          fontFamily: SF, fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
          color: 'rgba(255,255,255,0.65)', marginBottom: 4, marginLeft: 4,
        }}>{STORY.choicesPrompt}</div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', position: 'relative',
            padding: '18px 20px',
            ...glass(22, 0.1),
            color: '#fff', textAlign: 'left',
            fontFamily: SF, fontSize: 16, fontWeight: 500,
            letterSpacing: -0.3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <span style={{
              fontFamily: SF_MONO, fontSize: 11,
              color: ACCENT, letterSpacing: 0.8,
              flex: '0 0 auto', opacity: 0.85,
            }}>0{i + 1}</span>
            <span style={{ flex: 1, textWrap: 'pretty' }}>{c}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V2 · CAPSULE STACK — две капсулы: имя + речь раздельно
// ────────────────────────────────────────────────────────────────────────
const V2 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{
            display: 'inline-block', position: 'relative',
            ...glass(999, 0.1),
            padding: '7px 14px',
            marginBottom: 8, marginLeft: 8,
            fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.8)',
          }}>НАРРАТОР</div>
          <div style={{
            position: 'relative',
            ...glass(28, 0.1),
            padding: '20px 22px',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <p style={{
              fontSize: 17, lineHeight: 1.5, margin: 0,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: -0.25, fontWeight: 400, textWrap: 'pretty',
            }}>{STORY.narrator}</p>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="street">
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', bottom: 116, left: 14, right: 14 }}>
          <div style={{ marginBottom: 8, marginLeft: 8 }}>
            <NameChip name={STORY.character.name} />
          </div>
          <div style={{
            position: 'relative',
            ...glass(28, 0.1),
            padding: '20px 22px',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <p style={{
              fontSize: 18, lineHeight: 1.4, margin: 0, color: '#fff',
              letterSpacing: -0.4, fontWeight: 400, textWrap: 'pretty',
            }}>{STORY.character.line}</p>
            <div style={{
              marginTop: 14, fontFamily: SF_MONO, fontSize: 10,
              opacity: 0.5, letterSpacing: 0.8,
              animation: 'vn-blink 1.8s infinite',
            }}>тап ›</div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices — пилюли-капсулы
  return (
    <Shell bg="street" dim nav="compact">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 112,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2,
      }}>
        <div style={{
          display: 'inline-block', position: 'relative',
          alignSelf: 'center',
          ...glass(999, 0.1),
          padding: '7px 14px', marginBottom: 6,
          fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.85)',
        }}>{STORY.choicesPrompt.toUpperCase()}</div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', position: 'relative',
            padding: '18px 22px',
            ...glass(999, 0.1),
            color: '#fff', textAlign: 'left',
            fontFamily: SF, fontSize: 15.5, fontWeight: 500,
            letterSpacing: -0.3, cursor: 'pointer',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <span style={{ textWrap: 'pretty' }}>{c}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V3 · MAGAZINE — без карточки, типографика поверх + большой акцент имени
// ────────────────────────────────────────────────────────────────────────
const V3 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <CornerGlass icon="close" />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 100,
          padding: '0 28px',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginBottom: 14,
            fontFamily: SF_MONO, fontSize: 10, letterSpacing: 2.5,
            color: 'rgba(255,255,255,0.6)',
          }}>
            <span style={{ width: 22, height: 1, background: 'rgba(255,255,255,0.4)' }} />
            ОТ АВТОРА
          </div>
          <p style={{
            fontSize: 21, lineHeight: 1.35, fontWeight: 400,
            color: 'rgba(255,255,255,0.95)',
            margin: 0, letterSpacing: -0.5, textWrap: 'pretty',
            textShadow: '0 2px 22px rgba(0,0,0,0.8)',
          }}>{STORY.narrator}</p>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    const titleName = STORY.character.name.charAt(0) + STORY.character.name.slice(1).toLowerCase();
    return (
      <Shell bg="street">
        <CornerGlass icon="close" />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 100,
          padding: '0 28px',
        }}>
          <div style={{
            fontFamily: SF, fontSize: 44, fontWeight: 700, letterSpacing: -2,
            color: ACCENT, marginBottom: 6, lineHeight: 1,
            textShadow: '0 2px 30px rgba(212,255,0,0.35)',
          }}>{titleName}</div>
          <p style={{
            fontSize: 20, lineHeight: 1.35, fontWeight: 400,
            color: 'rgba(255,255,255,0.96)', margin: 0,
            letterSpacing: -0.45, textWrap: 'pretty',
            textShadow: '0 2px 22px rgba(0,0,0,0.85)',
          }}>{STORY.character.line}</p>
          <div style={{
            marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: SF_MONO, fontSize: 10, opacity: 0.6,
            letterSpacing: 1, color: '#fff',
          }}>
            <span style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.5)' }} />
            <span style={{ animation: 'vn-blink 1.6s infinite' }}>далее</span>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim nav="compact">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', inset: 0, padding: '0 22px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        paddingBottom: 112, zIndex: 2,
      }}>
        <div style={{
          fontFamily: SF_MONO, fontSize: 10, letterSpacing: 2.5,
          color: ACCENT, marginBottom: 22,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 22, height: 1, background: ACCENT }} />
          {STORY.choicesPrompt.toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {STORY.choices.map((c, i) => (
            <button key={i} style={{
              width: '100%', padding: 0,
              background: 'transparent', border: 'none',
              color: '#fff', textAlign: 'left',
              fontFamily: SF, cursor: 'pointer',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <span style={{
                fontFamily: SF_MONO, fontSize: 11, color: ACCENT,
                paddingTop: 6, letterSpacing: 0.8, flex: '0 0 auto',
              }}>0{i + 1}</span>
              <span style={{
                fontSize: 22, fontWeight: 500, letterSpacing: -0.6,
                lineHeight: 1.2, textWrap: 'pretty', flex: 1,
              }}>{c}</span>
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V4 · COMPACT TILE — маленький центрированный slab, больше арта видно
// ────────────────────────────────────────────────────────────────────────
const V4 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="room" dim nav="compact">
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 110 }}>
          <div style={{
            position: 'relative',
            ...glass(22, 0.09),
            padding: '14px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <div style={{
              flex: '0 0 auto',
              width: 32, height: 32, borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SF_MONO, fontSize: 10, color: 'rgba(255,255,255,0.6)',
              letterSpacing: 0.5,
            }}>NR</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: SF_MONO, fontSize: 9.5, letterSpacing: 1.5,
                color: 'rgba(255,255,255,0.55)', marginBottom: 4,
              }}>НАРРАТОР</div>
              <p style={{
                fontSize: 14.5, lineHeight: 1.45, margin: 0,
                color: 'rgba(255,255,255,0.94)',
                letterSpacing: -0.2, fontWeight: 400, textWrap: 'pretty',
              }}>{STORY.narrator}</p>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="room" nav="compact">
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 110 }}>
          <div style={{
            position: 'relative',
            ...glass(22, 0.09),
            padding: '14px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ ...glassHighlight, position: 'absolute' }} />
            <div style={{
              flex: '0 0 auto',
              width: 32, height: 32, borderRadius: 999,
              background: ACCENT,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SF, fontSize: 11, color: '#000',
              letterSpacing: 0.5, fontWeight: 700,
              boxShadow: '0 6px 16px rgba(212,255,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}>Э</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: SF, fontSize: 12, fontWeight: 700, letterSpacing: 0.6,
                color: ACCENT, marginBottom: 4, textTransform: 'uppercase',
              }}>{STORY.character.name}</div>
              <p style={{
                fontSize: 15.5, lineHeight: 1.4, margin: 0, color: '#fff',
                letterSpacing: -0.3, fontWeight: 400, textWrap: 'pretty',
              }}>{STORY.character.line}</p>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices — список со скруглёнными glass-строками, маленький
  return (
    <Shell bg="room" dim nav="compact">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} />
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 110,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2,
      }}>
        <div style={{
          fontFamily: SF, fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
          color: 'rgba(255,255,255,0.7)', marginLeft: 4, marginBottom: 4,
        }}>{STORY.choicesPrompt}</div>
        <div style={{
          position: 'relative',
          ...glass(22, 0.09),
          overflow: 'hidden',
        }}>
          <div style={{ ...glassHighlight, position: 'absolute' }} />
          {STORY.choices.map((c, i) => (
            <button key={i} style={{
              width: '100%', padding: '15px 16px',
              background: 'transparent', border: 'none',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              color: '#fff', textAlign: 'left',
              fontFamily: SF, fontSize: 15, fontWeight: 500,
              letterSpacing: -0.3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SF_MONO, fontSize: 10, color: ACCENT,
                flex: '0 0 auto',
              }}>{i + 1}</span>
              <span style={{ flex: 1, textWrap: 'pretty' }}>{c}</span>
              <span style={{ opacity: 0.35, fontSize: 14 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V5 · ASYMMETRIC — имя слева вертикально, glass-плитка справа
// ────────────────────────────────────────────────────────────────────────
const V5 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 110 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{
              flex: '0 0 auto', position: 'relative',
              ...glass(20, 0.1),
              padding: '14px 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontFamily: SF_MONO, fontSize: 10, letterSpacing: 2.5,
              color: 'rgba(255,255,255,0.75)',
            }}>НАРРАТОР</div>
            <div style={{
              flex: 1, position: 'relative',
              ...glass(20, 0.1),
              padding: '20px 22px',
            }}>
              <div style={{ ...glassHighlight, position: 'absolute' }} />
              <p style={{
                fontSize: 16, lineHeight: 1.45, margin: 0,
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: -0.25, fontWeight: 400, textWrap: 'pretty',
              }}>{STORY.narrator}</p>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="street">
        <CornerGlass icon="close" />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 110 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{
              flex: '0 0 auto', position: 'relative',
              background: ACCENT, color: '#000',
              borderRadius: 20,
              padding: '14px 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontFamily: SF, fontSize: 12, letterSpacing: 2.5,
              fontWeight: 700,
              boxShadow: '0 12px 30px rgba(212,255,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}>{STORY.character.name}</div>
            <div style={{
              flex: 1, position: 'relative',
              ...glass(20, 0.1),
              padding: '20px 22px',
            }}>
              <div style={{ ...glassHighlight, position: 'absolute' }} />
              <p style={{
                fontSize: 18, lineHeight: 1.4, margin: 0, color: '#fff',
                letterSpacing: -0.4, fontWeight: 400, textWrap: 'pretty',
              }}>{STORY.character.line}</p>
              <div style={{
                marginTop: 14, display: 'flex', justifyContent: 'flex-end',
                fontFamily: SF_MONO, fontSize: 10, opacity: 0.5,
                letterSpacing: 0.8,
                animation: 'vn-pulse 1.6s infinite',
              }}>тап ›</div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim nav="compact">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <CornerGlass icon="close" />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 110,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: SF_MONO, fontSize: 10, letterSpacing: 2.5,
          color: ACCENT, marginBottom: 4, marginLeft: 4,
        }}>
          <span style={{ width: 6, height: 6, background: ACCENT, borderRadius: 1 }} />
          {STORY.choicesPrompt.toUpperCase()}
        </div>
        {STORY.choices.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{
              flex: '0 0 auto', position: 'relative',
              background: i === 0 ? ACCENT : 'rgba(255,255,255,0.06)',
              border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(20px)',
              borderRadius: 16,
              padding: '0 10px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 30,
              fontFamily: SF_MONO, fontSize: 11, fontWeight: 700,
              color: i === 0 ? '#000' : ACCENT, letterSpacing: 0.5,
            }}>0{i + 1}</div>
            <button style={{
              flex: 1, position: 'relative',
              ...glass(16, 0.09),
              padding: '16px 18px',
              color: '#fff', textAlign: 'left',
              fontFamily: SF, fontSize: 15, fontWeight: 500,
              letterSpacing: -0.3, cursor: 'pointer',
            }}>
              <div style={{ ...glassHighlight, position: 'absolute' }} />
              <span style={{ textWrap: 'pretty' }}>{c}</span>
            </button>
          </div>
        ))}
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
    <DCArtboard id={`${id}-c`} label="реплика персонажа" width={W} height={H}>
      <Variant state="character" />
    </DCArtboard>
    <DCArtboard id={`${id}-ch`} label="экран выбора" width={W} height={H}>
      <Variant state="choices" />
    </DCArtboard>
  </DCSection>
);

const App = () => (
  <DesignCanvas>
    <Section
      id="v1"
      title="V1 · Glass Slab"
      subtitle="Большая стеклянная плита снизу с именем-чипом. Самый продуктовый, дефолтный."
      Variant={V1}
    />
    <Section
      id="v2"
      title="V2 · Capsule Stack"
      subtitle="Имя и реплика — две раздельные капсулы. Лёгкое, дышит, очень iOS."
      Variant={V2}
    />
    <Section
      id="v3"
      title="V3 · Magazine"
      subtitle="Без карточек. Имя — огромным акцентом, текст лежит прямо на сцене. Кинематографично."
      Variant={V3}
    />
    <Section
      id="v4"
      title="V4 · Compact Tile"
      subtitle="Маленькая плитка с аватаркой-инициалом. Меньше закрывает арт, плотнее."
      Variant={V4}
    />
    <Section
      id="v5"
      title="V5 · Asymmetric"
      subtitle="Вертикальная плашка с именем + стеклянная плитка с текстом. Необычный, графичный."
      Variant={V5}
    />
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
