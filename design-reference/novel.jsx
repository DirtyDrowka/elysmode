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
  { text: 'Я думал о тебе всю неделю' },
  { text: 'Просто проходил мимо' },
  { text: 'Молча подойти и обнять', cost: 15 }]

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
  '0 6px 16px rgba(0,0,0,0.35)'
});

const GlassHighlight = () =>
<div style={{
  position: 'absolute', top: 0, left: 14, right: 14, height: 1,
  background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent)',
  borderRadius: 999, pointerEvents: 'none'
}} />;


// ────────────────────────────────────────────────────────────────────────
// Pressable — масштаб + блик в точке нажатия (как в iOS Telegram)
// ────────────────────────────────────────────────────────────────────────
const Pressable = ({ as = 'button', children, style, scaleTo = 1.025, shimmer = 0.25, shimmerSize = 270, noScale = false, ...rest }) => {
  const [pressed, setPressed] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 50, y: 50 });
  const pressedRef = React.useRef(false);

  const updatePos = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) ?? rect.left + rect.width / 2;
    const clientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY) ?? rect.top + rect.height / 2;
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    setPos({
      x: Math.max(0, Math.min(100, cx / rect.width * 100)),
      y: Math.max(0, Math.min(100, cy / rect.height * 100))
    });
  };

  const onDown = (e) => { pressedRef.current = true; updatePos(e); setPressed(true); };
  const onMove = (e) => { if (pressedRef.current) updatePos(e); };
  const onUp = () => { pressedRef.current = false; setPressed(false); };

  const Tag = as;
  return (
    <Tag
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      onTouchCancel={onUp}
      style={{
        position: 'relative',
        cursor: 'pointer',
        transform: !noScale && pressed ? `scale(${scaleTo})` : 'scale(1)',
        transition: 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        WebkitTapHighlightColor: 'transparent',
        ...style
      }}
      {...rest}>
      {children}
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        borderRadius: 'inherit',
        background: `radial-gradient(circle ${shimmerSize}px at ${pos.x}% ${pos.y}%, rgba(255,255,255,${shimmer}) 0%, rgba(255,255,255,0) 65%)`,
        opacity: pressed ? 1 : 0,
        transition: pressed ? 'opacity 0.12s ease, background 0s' : 'opacity 0.35s ease',
        pointerEvents: 'none',
        mixBlendMode: 'plus-lighter'
      }} />
    </Tag>);
};

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
        color: 'rgba(255,255,255,0.28)', letterSpacing: 0.4
      }}>bg/street_night.png</div>
    </div>);

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
      filter: dim ? 'blur(0.5px)' : 'none'
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
        letterSpacing: 0.5, whiteSpace: 'nowrap'
      }}>{name}.png</div>
    </div>);

};

// ────────────────────────────────────────────────────────────────────────
// Статус-бар, home indicator, chapter pill
// ────────────────────────────────────────────────────────────────────────
const StatusBar = () =>
<div style={{
  position: 'absolute', top: 0, left: 0, right: 0, height: 44,
  zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 24px',
  fontFamily: SF, fontSize: 14.5, fontWeight: 600,
  color: 'rgba(255,255,255,0.95)', pointerEvents: 'none',
  letterSpacing: -0.2
}}>
    <span>9:41</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="7" width="3" height="3" rx="0.5" /><rect x="4" y="5" width="3" height="5" rx="0.5" /><rect x="8" y="3" width="3" height="7" rx="0.5" /><rect x="12" y="0" width="3" height="10" rx="0.5" /></svg>
      <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="0.8">
        <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" />
        <rect x="2" y="2" width="13" height="7" fill="currentColor" stroke="none" />
        <rect x="20" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" stroke="none" />
      </svg>
    </div>
  </div>;


const HomeIndicator = () =>
<div style={{
  position: 'absolute', bottom: 8, left: '50%',
  transform: 'translateX(-50%)',
  width: 134, height: 5, borderRadius: 999,
  background: 'rgba(255,255,255,0.95)',
  zIndex: 12, pointerEvents: 'none'
}} />;


const TitlePill = ({ title = 'elys mode' }) =>
<div style={{
  position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
  zIndex: 10, display: 'inline-flex', alignItems: 'center',
  padding: '7px 18px',
  ...glass(999, 0.1),
  fontFamily: SF, fontSize: 13, fontWeight: 600,
  color: 'rgba(255,255,255,0.95)', letterSpacing: -0.2,
  maxWidth: 'calc(100% - 100px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
}}>
    <GlassHighlight />
    {title}
  </div>;


// ────────────────────────────────────────────────────────────────────────
// Icons + Nav
// ────────────────────────────────────────────────────────────────────────
const Icon = ({ kind, size = 22, color = 'rgba(255,255,255,0.96)', strokeWidth = 1.6 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'arrow':return <svg {...props}><path d="M6 12h12M13 7l5 5-5 5" /></svg>;
    case 'home':return <svg {...props}><path d="M3.5 11.5L12 4l8.5 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></svg>;
    case 'catalog':return <svg {...props}><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></svg>;
    case 'book':return <svg {...props}><path d="M12 6c-1.5-1.2-4-2-7-2v15c3 0 5.5.8 7 2" /><path d="M12 6c1.5-1.2 4-2 7-2v15c-3 0-5.5.8-7 2" /><path d="M12 6v15" /></svg>;
    case 'bookmark':return <svg {...props}><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>;
    case 'profile':return <svg {...props}><circle cx="12" cy="9" r="3.8" /><path d="M4.5 20.5a7.5 7.5 0 0115 0" /></svg>;
    case 'gem':return <svg width={size} height={size} viewBox="0 0 16 16" fill={color}><path d="M3 5.5l3-3.5h4l3 3.5-5 8.5-5-8.5z" stroke={color} strokeWidth="0.6" strokeLinejoin="round" /><path d="M3 5.5h10M6 2l2 3.5 2-3.5M8 5.5L8 14" stroke="rgba(0,0,0,0.28)" strokeWidth="0.5" fill="none" /></svg>;
    default:return null;
  }
};

// ────────────────────────────────────────────────────────────────────────
// iOS 26 liquid glass tab bar — full width, 5 вкладок с подписями
// ────────────────────────────────────────────────────────────────────────
const TABS = [
{ key: 'home', icon: 'home', label: 'Главная' },
{ key: 'catalog', icon: 'catalog', label: 'Каталог' },
{ key: 'read', icon: 'book', label: 'Читаю' },
{ key: 'saved', icon: 'bookmark', label: 'Сохранения' },
{ key: 'profile', icon: 'profile', label: 'Профиль' }];


const TabItem = ({ icon, label, active }) =>
<button
  style={{
    flex: '1 1 0', background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    fontFamily: SF, fontSize: 10, fontWeight: active ? 600 : 500,
    letterSpacing: -0.1, borderRadius: 14,
    color: active ? ACCENT : 'rgba(255,255,255,0.55)',
    padding: '4px 2px 0',
    position: 'relative',
    WebkitTapHighlightColor: 'transparent',
  }}>
  
    {active &&
  <div style={{
    position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
    width: 38, height: 38, borderRadius: 999,
    background: 'radial-gradient(circle, rgba(212,255,0,0.28) 0%, rgba(212,255,0,0) 70%)',
    zIndex: 0, pointerEvents: 'none'
  }} />
  }
    <div style={{ position: 'relative', zIndex: 1, lineHeight: 0 }}>
      <Icon kind={icon} size={24} color={active ? ACCENT : 'rgba(255,255,255,0.7)'} strokeWidth={active ? 2 : 1.6} />
    </div>
    <span style={{ position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>{label}</span>
  </button>;


const TabBar = ({ active = 'read' }) =>
<Pressable
  as="div"
  noScale
  shimmerSize={420}
  shimmer={0.22}
  style={{
    position: 'absolute', bottom: 26, left: 10, right: 10,
    zIndex: 11,
    ...glass(34, 0.09),
    padding: '8px 4px 10px',
    display: 'flex', alignItems: 'flex-start'
  }}>
    <GlassHighlight />
    {TABS.map((t) =>
  <TabItem key={t.key} icon={t.icon} label={t.label} active={t.key === active} />
  )}
  </Pressable>;


// Высота парящего таб-бара (для отступов контента). bottom 26 + ~62 = top edge ~88
const TAB_BAR_TOP = 92;

// ────────────────────────────────────────────────────────────────────────
// Shell
// ────────────────────────────────────────────────────────────────────────
const Shell = ({ dim = false, hideChar = false, children, showTitle = true }) =>
<div style={{
  width: '100%', height: '100%',
  position: 'relative', overflow: 'hidden',
  background: '#000', color: '#fff',
  fontFamily: SF, WebkitFontSmoothing: 'antialiased'
}}>
    <BgPlaceholder />
    <CharPlaceholder dim={dim} hidden={hideChar} />
    <StatusBar />
    {showTitle && <TitlePill />}
    <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>{children}</div>
    <TabBar />
    <HomeIndicator />
  </div>;


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
        <div style={{ position: 'absolute', bottom: 110, left: 14, right: 14 }}>
          <div style={{
            fontFamily: SF_MONO, fontSize: 10.5, letterSpacing: 2,
            color: 'rgba(255,255,255,0.55)',
            marginBottom: 12, marginLeft: 16,
          }}>НАРРАТОР</div>
          <Pressable as="div" style={{
            ...glass(32, 0.1),
            padding: '22px 22px 22px'
          }}>
            <GlassHighlight />
            <p style={{
              fontSize: 17, lineHeight: 1.5, margin: 0,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: -0.25, fontWeight: 400, textWrap: 'pretty',
              fontStyle: 'italic'
            }}>
              {STORY.narrator}
              <span style={{
                display: 'inline-block', width: 8, height: 17, marginLeft: 4,
                background: ACCENT, verticalAlign: -2,
                animation: 'vn-blink 1.1s infinite', borderRadius: 1,
                boxShadow: `0 0 10px ${ACCENT_GLOW}`
              }} />
            </p>
          </Pressable>
        </div>
      </Shell>);

  }
  if (state === 'character') {
    return (
      <Shell>
        <div style={{ position: 'absolute', bottom: 110, left: 14, right: 14 }}>
          <div style={{
            fontFamily: SF, fontSize: 13, fontWeight: 700, letterSpacing: 1.8,
            color: ACCENT,
            marginBottom: 12, marginLeft: 16,
            textShadow: `0 0 14px ${ACCENT_GLOW}`,
          }}>{STORY.character.name}</div>
          <Pressable as="div" style={{
            ...glass(32, 0.1),
            padding: '22px 22px',
            borderTop: `1px solid ${ACCENT_GLOW}`,
            boxShadow:
            'inset 0 1px 0 rgba(212,255,0,0.5), ' +
            'inset 0 -1px 0 rgba(0,0,0,0.2), ' +
            '0 22px 60px rgba(0,0,0,0.6), ' +
            '0 0 0 1px rgba(212,255,0,0.08)'
          }}>
            <p style={{
              fontSize: 18.5, lineHeight: 1.4, margin: 0, color: '#fff',
              letterSpacing: -0.4, fontWeight: 400, textWrap: 'pretty'
            }}>
              {STORY.character.line}
              <span style={{
                display: 'inline-block', width: 9, height: 18, marginLeft: 4,
                background: ACCENT, verticalAlign: -3,
                animation: 'vn-blink 1.1s infinite', borderRadius: 1,
                boxShadow: `0 0 12px ${ACCENT_GLOW}`
              }} />
            </p>
          </Pressable>
        </div>
      </Shell>);

  }
  // choices
  return (
    <Shell dim>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 110,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2
      }}>
        {STORY.choices.map((c, i) => {
          const paid = typeof c.cost === 'number';
          if (paid) {
            return (
              <Pressable as="button" key={i} style={{
                width: '100%',
                padding: '18px 22px',
                background: ACCENT,
                border: 'none', borderRadius: 999,
                color: '#000', textAlign: 'left',
                fontFamily: SF, fontSize: 15.5, fontWeight: 600,
                letterSpacing: -0.3,
                boxShadow:
                  '0 14px 40px rgba(212,255,0,0.45), ' +
                  '0 4px 12px rgba(212,255,0,0.35), ' +
                  'inset 0 1px 0 rgba(255,255,255,0.55), ' +
                  'inset 0 -1px 0 rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ flex: 1, textWrap: 'pretty' }}>{c.text}</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#000',
                  flex: '0 0 auto',
                }}>
                  <Icon kind="gem" size={15} color="#000" strokeWidth={0.6} />
                  {c.cost}
                </span>
              </Pressable>);
          }
          return (
            <Pressable as="button" key={i} style={{
              width: '100%',
              padding: '18px 22px',
              ...glass(999, 0.1),
              color: '#fff', textAlign: 'left',
              fontFamily: SF, fontSize: 15.5, fontWeight: 500,
              letterSpacing: -0.3,
              display: 'flex', alignItems: 'center',
            }}>
              <GlassHighlight />
              <span style={{ flex: 1, textWrap: 'pretty' }}>{c.text}</span>
            </Pressable>);
        })}
      </div>
    </Shell>);

};

// ────────────────────────────────────────────────────────────────────────
// Канва
// ────────────────────────────────────────────────────────────────────────
const Section = ({ id, title, subtitle, Variant }) =>
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
  </DCSection>;


const App = () =>
<DesignCanvas>
    <Section
    id="v"
    title="VN reader"
    subtitle="Liquid glass ридер: имя-чип, capsule с речью, печатающаяся лайм-каретка. Тап по капсуле — следующая реплика."
    Variant={VA} />
  
  </DesignCanvas>;


ReactDOM.createRoot(document.getElementById('root')).render(<App />);