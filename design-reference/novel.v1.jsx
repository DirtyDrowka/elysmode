// elys mode — VN reader concepts
// 5 направлений × 3 экрана (нарратор / реплика / выбор)
// Один файл: общие хелперы + варианты, в DesignCanvas

// ────────────────────────────────────────────────────────────────────────
// Контент макета
// ────────────────────────────────────────────────────────────────────────
const STORY = {
  narrator:
    'Дождь шёл всю ночь. К утру город пах мокрым асфальтом — и чем-то ещё, что Элис не могла вспомнить.',
  character: {
    name: 'ЭЛИС',
    line: 'Ты пришёл. Я не была уверена, что придёшь.',
  },
  choicesPrompt: 'Что ответить',
  choices: [
    'Я думал о тебе всю неделю',
    'Просто проходил мимо',
    'Молча подойти и обнять',
  ],
};

const W = 360;
const H = 780;

// ────────────────────────────────────────────────────────────────────────
// Заглушки для арта (фон + персонаж)
// Реальные PNG / WebP подставите позже.
// ────────────────────────────────────────────────────────────────────────
const BgPlaceholder = ({ scene = 'street' }) => {
  const palettes = {
    street: { a: '#1a1d28', b: '#0a0b0f', label: '../bg/street_night_03.png' },
    room:   { a: '#1f1820', b: '#0c0a10', label: '../bg/room_dusk_02.png' },
  };
  const p = palettes[scene] || palettes.street;
  const id = `vn-stripes-${scene}`;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${p.a} 0%, ${p.b} 100%)` }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.45 }}>
        <defs>
          <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <line x1="0" y1="0" x2="0" y2="22" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      {/* мягкая виньетка */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 25%, transparent 35%, rgba(0,0,0,0.55) 100%)' }} />
      <div style={{
        position: 'absolute', left: 14, top: 50,
        fontFamily: '"Geist Mono", monospace',
        fontSize: 9, color: 'rgba(255,255,255,0.32)',
        letterSpacing: 0.4,
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
      width: '78%', height: '82%',
      pointerEvents: 'none',
      opacity: dim ? 0.22 : 1,
      transition: 'opacity .3s',
      filter: dim ? 'blur(0.5px)' : 'none',
    }}>
      <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="char-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.11)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.025)" />
          </linearGradient>
          <pattern id="char-stripes" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3.2" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
          </pattern>
        </defs>
        {/* плечи + торс */}
        <path d="M50,28 C40,28 35,34 34,44 L30,80 C26,95 25,112 27,140 L73,140 C75,112 74,95 70,80 L66,44 C65,34 60,28 50,28 Z"
              fill="url(#char-grad)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4" />
        <path d="M50,28 C40,28 35,34 34,44 L30,80 C26,95 25,112 27,140 L73,140 C75,112 74,95 70,80 L66,44 C65,34 60,28 50,28 Z"
              fill="url(#char-stripes)" />
        {/* шея */}
        <rect x="46" y="22" width="8" height="7" fill="url(#char-grad)" />
        {/* голова */}
        <ellipse cx="50" cy="15" rx="8.5" ry="9.5" fill="url(#char-grad)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4" />
      </svg>
      <div style={{
        position: 'absolute', bottom: 12, left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: '"Geist Mono", monospace',
        fontSize: 9, color: 'rgba(255,255,255,0.38)',
        letterSpacing: 0.5, whiteSpace: 'nowrap',
      }}>{name}.png</div>
    </div>
  );
};

// Статус-бар iOS-like, чтобы экран выглядел как реальный мобильный
const StatusBar = ({ light = true }) => (
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, height: 44,
    zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 22px',
    fontFamily: '"Geist", system-ui, sans-serif',
    fontSize: 13, fontWeight: 600,
    color: light ? 'rgba(255,255,255,0.95)' : 'rgba(10,10,11,0.9)',
    pointerEvents: 'none',
  }}>
    <span>9:41</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {/* signal */}
      <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="7" width="3" height="3" rx="0.5"/><rect x="4" y="5" width="3" height="5" rx="0.5"/><rect x="8" y="3" width="3" height="7" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
      {/* battery */}
      <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="0.8">
        <rect x="0.5" y="0.5" width="18" height="10" rx="2.5"/>
        <rect x="2" y="2" width="13" height="7" fill="currentColor" stroke="none"/>
        <rect x="20" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" stroke="none"/>
      </svg>
    </div>
  </div>
);

// Базовая оболочка телефона со сценой
const Shell = ({ bg = 'street', dim = false, hideChar = false, charName = 'elys', children }) => (
  <div style={{
    width: '100%', height: '100%',
    position: 'relative', overflow: 'hidden',
    background: '#0A0A0B', color: '#F4F4F5',
    fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  }}>
    <BgPlaceholder scene={bg} />
    <CharPlaceholder dim={dim} hidden={hideChar} name={charName} />
    <StatusBar />
    <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>{children}</div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────
// V1 · Editorial — чистая типографика, без рамок
// ────────────────────────────────────────────────────────────────────────
const V1 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
          padding: '0 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, letterSpacing: 3, opacity: 0.5, marginBottom: 22,
          }}>— ОТ АВТОРА —</div>
          <p style={{
            fontSize: 21, lineHeight: 1.4, fontWeight: 300,
            color: 'rgba(255,255,255,0.94)',
            margin: 0, textWrap: 'pretty',
            fontStyle: 'italic', letterSpacing: -0.4,
          }}>{STORY.narrator}</p>
          <div style={{
            marginTop: 32,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, opacity: 0.4, letterSpacing: 1.5,
            animation: 'vn-blink 1.8s infinite',
          }}>тап чтобы продолжить</div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="street">
        <div style={{
          position: 'absolute', bottom: 56, left: 0, right: 0,
          padding: '0 28px',
        }}>
          <div style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 11, letterSpacing: 3.5, marginBottom: 16,
            color: '#F4F4F5', fontWeight: 500,
          }}>{STORY.character.name}</div>
          <p style={{
            fontSize: 23, lineHeight: 1.3, fontWeight: 400,
            color: 'rgba(255,255,255,0.98)',
            margin: 0, textWrap: 'pretty', letterSpacing: -0.5,
          }}>{STORY.character.line}</p>
          <div style={{
            marginTop: 22,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, opacity: 0.45, letterSpacing: 1.5,
            animation: 'vn-pulse 1.6s infinite',
          }}>тап ›</div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(10,10,11,0.45)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        padding: '0 28px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 12, zIndex: 2,
      }}>
        <div style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 10, letterSpacing: 3, opacity: 0.55,
          marginBottom: 14, textAlign: 'center',
        }}>{STORY.choicesPrompt.toUpperCase()}</div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', padding: '18px 20px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.22)',
            color: '#F4F4F5', textAlign: 'left',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 400,
            letterSpacing: -0.2, cursor: 'pointer',
            borderRadius: 0,
          }}>{c}</button>
        ))}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V2 · Floating Glass — плавающая стеклянная карточка
// ────────────────────────────────────────────────────────────────────────
const V2 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <div style={{
          position: 'absolute', bottom: 36, left: 16, right: 16,
          background: 'rgba(20,20,24,0.55)',
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 24,
          padding: '22px 22px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
            <span style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: 10, letterSpacing: 2, opacity: 0.65,
            }}>НАРРАТОР</span>
          </div>
          <p style={{
            fontSize: 16, lineHeight: 1.5, fontWeight: 400,
            margin: 0, color: 'rgba(255,255,255,0.92)',
            fontStyle: 'italic', letterSpacing: -0.2,
          }}>{STORY.narrator}</p>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="street">
        <div style={{ position: 'absolute', bottom: 36, left: 16, right: 16 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(244,244,245,0.95)',
            color: '#0A0A0B',
            borderRadius: 100,
            padding: '7px 14px 7px 11px',
            fontFamily: '"Geist", sans-serif',
            fontSize: 11.5, letterSpacing: 0.8, fontWeight: 600,
            marginBottom: 10, marginLeft: 8,
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6b6b6b, #2a2a2a)',
            }} />
            {STORY.character.name}
          </div>
          <div style={{
            background: 'rgba(20,20,24,0.6)',
            backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 24, padding: '20px 22px 22px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}>
            <p style={{
              fontSize: 17.5, lineHeight: 1.4, fontWeight: 400,
              margin: 0, color: '#F4F4F5', letterSpacing: -0.3,
            }}>{STORY.character.line}</p>
            <div style={{
              marginTop: 16, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: 9.5, opacity: 0.45, letterSpacing: 0.8,
              }}>тап чтобы продолжить</span>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'rgba(255,255,255,0.7)',
              }}>›</span>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(10,10,11,0.5)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        padding: '0 16px 36px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        gap: 10, zIndex: 2,
      }}>
        <div style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 10, letterSpacing: 2, opacity: 0.65,
          marginBottom: 8, marginLeft: 12,
        }}>{STORY.choicesPrompt.toUpperCase()}</div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', padding: '18px 22px',
            background: 'rgba(20,20,24,0.6)',
            backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 18, color: '#F4F4F5',
            textAlign: 'left',
            fontFamily: 'inherit', fontSize: 15.5, fontWeight: 400,
            letterSpacing: -0.2, cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}>{c}</button>
        ))}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V3 · Cinematic — драматичная нижняя плашка во всю ширину
// ────────────────────────────────────────────────────────────────────────
const V3 = ({ state }) => {
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0) 100%)',
          padding: '60px 28px 40px',
        }}>
          <p style={{
            fontSize: 18, lineHeight: 1.55, fontWeight: 400,
            color: 'rgba(255,255,255,0.92)',
            margin: 0, letterSpacing: -0.2,
            fontStyle: 'italic', textWrap: 'pretty',
          }}>{STORY.narrator}</p>
          <div style={{
            marginTop: 18, display: 'flex',
            alignItems: 'center', gap: 8,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, opacity: 0.5, letterSpacing: 1,
          }}>
            <span style={{
              display: 'inline-block', width: 18, height: 1,
              background: 'rgba(255,255,255,0.5)',
            }} />
            <span>тап ›</span>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    const titleName = STORY.character.name.charAt(0) + STORY.character.name.slice(1).toLowerCase();
    return (
      <Shell bg="street">
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0) 100%)',
          padding: '70px 28px 40px',
        }}>
          <div style={{
            fontSize: 30, fontWeight: 600, letterSpacing: -1,
            color: '#F4F4F5', marginBottom: 10,
            lineHeight: 1,
          }}>{titleName}</div>
          <p style={{
            fontSize: 19, lineHeight: 1.4, fontWeight: 400,
            color: 'rgba(255,255,255,0.92)', margin: 0,
            letterSpacing: -0.35, textWrap: 'pretty',
          }}>{STORY.character.line}</p>
          <div style={{
            marginTop: 20, display: 'flex',
            alignItems: 'center', gap: 8,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, opacity: 0.55, letterSpacing: 1,
          }}>
            <span style={{
              display: 'inline-block', width: 18, height: 1,
              background: 'rgba(255,255,255,0.5)',
            }} />
            <span style={{ animation: 'vn-blink 1.6s infinite' }}>далее</span>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        zIndex: 2,
      }}>
        <div style={{
          padding: '24px 28px 14px',
          fontFamily: '"Geist Mono", monospace',
          fontSize: 10, letterSpacing: 3, opacity: 0.6,
        }}>{STORY.choicesPrompt.toUpperCase()}</div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', padding: '22px 28px',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            color: '#F4F4F5', textAlign: 'left',
            fontFamily: 'inherit', fontSize: 17, fontWeight: 400,
            letterSpacing: -0.3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: i === STORY.choices.length - 1 ? '1px solid rgba(255,255,255,0.14)' : 'none',
          }}>
            <span style={{ textWrap: 'pretty' }}>{c}</span>
            <span style={{ opacity: 0.45, fontSize: 14, marginLeft: 14 }}>→</span>
          </button>
        ))}
        <div style={{ height: 28 }} />
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V4 · Brutalist — острые рамки, моно, нумерация
// ────────────────────────────────────────────────────────────────────────
const V4 = ({ state }) => {
  const accent = 'oklch(0.82 0.17 130)'; // свежий лайм
  if (state === 'narrator') {
    return (
      <Shell bg="room" dim>
        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 32,
          background: '#0c0c0e',
          border: '1px solid rgba(255,255,255,0.2)',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', justifyContent: 'space-between',
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, letterSpacing: 1.5,
          }}>
            <span style={{ color: accent }}>[ NARR ]</span>
            <span style={{ opacity: 0.55 }}>003 / 128</span>
          </div>
          <div style={{ padding: '20px 18px 22px' }}>
            <p style={{
              fontSize: 15.5, lineHeight: 1.5, fontWeight: 400,
              color: 'rgba(255,255,255,0.95)',
              margin: 0, letterSpacing: -0.15, textWrap: 'pretty',
            }}>{STORY.narrator}</p>
          </div>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="room">
        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 32,
          background: '#0c0c0e',
          border: '1px solid rgba(255,255,255,0.2)',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, letterSpacing: 1.5,
          }}>
            <span style={{ color: accent, fontWeight: 600 }}>[ {STORY.character.name} ]</span>
            <span style={{ opacity: 0.55 }}>004 / 128</span>
          </div>
          <div style={{ padding: '20px 18px 22px' }}>
            <p style={{
              fontSize: 16.5, lineHeight: 1.45, fontWeight: 400,
              color: '#F4F4F5',
              margin: 0, letterSpacing: -0.2, textWrap: 'pretty',
            }}>{STORY.character.line}</p>
            <div style={{
              marginTop: 14, display: 'flex', justifyContent: 'flex-end',
              fontFamily: '"Geist Mono", monospace',
              fontSize: 10, opacity: 0.45, letterSpacing: 1,
            }}>
              <span style={{ animation: 'vn-blink 1.6s infinite' }}>▶</span>
            </div>
          </div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="room" dim>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', left: 14, right: 14, top: 70, bottom: 32,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2,
      }}>
        <div style={{
          padding: '12px 16px',
          background: '#0c0c0e',
          border: '1px solid rgba(255,255,255,0.2)',
          fontFamily: '"Geist Mono", monospace',
          fontSize: 10, letterSpacing: 1.5,
          color: accent, marginBottom: 4,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>[ CHOICE ]</span>
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>{STORY.choicesPrompt.toLowerCase()}</span>
        </div>
        {STORY.choices.map((c, i) => (
          <button key={i} style={{
            width: '100%', padding: '18px 16px',
            background: '#0c0c0e',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#F4F4F5', textAlign: 'left',
            fontFamily: 'inherit', fontSize: 15,
            cursor: 'pointer', borderRadius: 0,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <span style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: 11, color: accent,
              marginTop: 2, letterSpacing: 1, flex: '0 0 auto',
            }}>0{i + 1}</span>
            <span style={{ letterSpacing: -0.2, textWrap: 'pretty', flex: 1 }}>{c}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────────
// V5 · Side Accent — вертикальная цветная полоса вместо рамки (blockquote)
// ────────────────────────────────────────────────────────────────────────
const V5 = ({ state }) => {
  const accent = 'oklch(0.78 0.15 305)'; // мягкий виолет
  if (state === 'narrator') {
    return (
      <Shell bg="street" dim>
        <div style={{
          position: 'absolute', left: 24, right: 24, bottom: 44,
          paddingLeft: 18,
          borderLeft: '2px solid rgba(255,255,255,0.4)',
        }}>
          <div style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 9.5, letterSpacing: 2.5, opacity: 0.6,
            marginBottom: 10, textTransform: 'uppercase',
          }}>от автора</div>
          <p style={{
            fontSize: 17, lineHeight: 1.5, fontWeight: 300,
            color: 'rgba(255,255,255,0.92)',
            margin: 0, letterSpacing: -0.2,
            fontStyle: 'italic', textWrap: 'pretty',
          }}>{STORY.narrator}</p>
        </div>
      </Shell>
    );
  }
  if (state === 'character') {
    return (
      <Shell bg="street">
        <div style={{
          position: 'absolute', left: 24, right: 24, bottom: 44,
          paddingLeft: 18,
          borderLeft: `2px solid ${accent}`,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, letterSpacing: 2.5,
            color: accent, marginBottom: 10,
          }}>{STORY.character.name}</div>
          <p style={{
            fontSize: 18, lineHeight: 1.4, fontWeight: 400,
            color: '#F4F4F5', margin: 0, letterSpacing: -0.3,
            textWrap: 'pretty',
          }}>{STORY.character.line}</p>
          <div style={{
            marginTop: 16,
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, opacity: 0.45, letterSpacing: 1.5,
            animation: 'vn-pulse 1.6s infinite',
          }}>тап ›</div>
        </div>
      </Shell>
    );
  }
  // choices
  return (
    <Shell bg="street" dim>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,11,0.6)' }} />
      <div style={{
        position: 'absolute', inset: 0, padding: '0 20px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 10, zIndex: 2,
      }}>
        <div style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 9.5, letterSpacing: 2.5, opacity: 0.6,
          marginBottom: 6, paddingLeft: 18, textTransform: 'uppercase',
        }}>{STORY.choicesPrompt}</div>
        {STORY.choices.map((c, i) => (
          <div key={i} style={{
            width: '100%', padding: '18px 18px',
            background: 'rgba(255,255,255,0.045)',
            borderLeft: `2px solid ${i === 0 ? accent : 'rgba(255,255,255,0.3)'}`,
            color: '#F4F4F5', textAlign: 'left',
            fontFamily: 'inherit', fontSize: 15.5, fontWeight: 400,
            letterSpacing: -0.2, cursor: 'pointer',
            textWrap: 'pretty',
          }}>{c}</div>
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
      title="V1 · Editorial"
      subtitle="Без рамок. Текст живёт прямо на сцене — типографика и пустота."
      Variant={V1}
    />
    <Section
      id="v2"
      title="V2 · Floating Glass"
      subtitle="Скруглённая карточка с блюром, имя — чип над ней. Самое «продуктовое»."
      Variant={V2}
    />
    <Section
      id="v3"
      title="V3 · Cinematic"
      subtitle="Полноширинный градиент-плашка снизу, имя — киношный титр."
      Variant={V3}
    />
    <Section
      id="v4"
      title="V4 · Brutalist"
      subtitle="Острые рамки, моно-метки, нумерация. Системный, читаемый, индастриал."
      Variant={V4}
    />
    <Section
      id="v5"
      title="V5 · Side Accent"
      subtitle="Вертикальная полоса вместо рамки. Лёгкое, минималистичное, цитатное."
      Variant={V5}
    />
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
