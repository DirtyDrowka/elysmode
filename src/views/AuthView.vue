<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { useAuth } from '../composables/useAuth';
import Pressable from '../components/Pressable.vue';
import TextField from '../components/TextField.vue';

const { initBotLogin, pollBotStatus, inflight } = useAuth();

type Step = 'username' | 'waiting' | 'done';
const step = ref<Step>('username');

const username = ref('');
const sessionId = ref('');
const botLink = ref('');
const botUsername = ref('');
const error = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;
function cleanupPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
onBeforeUnmount(cleanupPoll);

async function submitUsername() {
  error.value = null;
  const u = username.value.trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(u)) {
    error.value = 'Username должен быть 3-32 символа: a-z, 0-9, _';
    return;
  }
  try {
    const r = await initBotLogin(u);
    sessionId.value = r.sessionId;
    botLink.value = r.botLink;
    botUsername.value = r.botUsername;
    step.value = 'waiting';

    // Поллинг каждую секунду. Когда бэк отдаст 'consumed' + токен —
    // useAuth.pollBotStatus сам залогинит юзера (user.value заполнится),
    // App.vue переключит на NovelView. Этот компонент просто чистит таймер.
    pollTimer = setInterval(async () => {
      const s = await pollBotStatus(sessionId.value);
      if (s === 'consumed') {
        step.value = 'done';
        cleanupPoll();
      } else if (s === 'expired') {
        cleanupPoll();
        error.value = 'Сессия истекла. Попробуй снова.';
        step.value = 'username';
      }
    }, 1000);
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Не удалось получить ссылку на бота';
  }
}

function backToUsername() {
  cleanupPoll();
  step.value = 'username';
  sessionId.value = '';
  botLink.value = '';
  error.value = null;
}
</script>

<template>
  <div class="auth-frame">
    <div class="card">
      <div class="brand">elys mode</div>

      <!-- STEP 1: username -->
      <template v-if="step === 'username'">
        <p class="lead">Войди через Telegram чтобы продолжить читать.</p>

        <form class="form" @submit.prevent="submitUsername">
          <TextField
            v-model="username"
            label="Твой Telegram-username"
            placeholder="@username"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :disabled="inflight"
          />

          <Pressable
            as="button"
            type="submit"
            class="primary-btn"
            :disabled="inflight"
            @press="submitUsername"
          >
            <span>{{ inflight ? 'Получаю ссылку…' : 'Продолжить' }}</span>
          </Pressable>

          <div v-if="error" class="error">{{ error }}</div>
        </form>
      </template>

      <!-- STEP 2: ссылка на бота + ожидание /start -->
      <template v-else-if="step === 'waiting'">
        <p class="lead">
          Открой бот и нажми <b>Старт</b> — мы сами завершим вход.
        </p>

        <a :href="botLink" class="bot-link" target="_blank" rel="noopener">
          <span class="bot-link-label">Открыть @{{ botUsername }}</span>
          <span class="bot-link-arrow">→</span>
        </a>

        <div class="status">
          <span class="dot dot-on" />
          <span>Ждём подтверждения из бота…</span>
        </div>

        <button type="button" class="back" @click="backToUsername">
          ← Назад к username
        </button>

        <div v-if="error" class="error">{{ error }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.auth-frame {
  position: relative;
  width: 100%;
  max-width: 430px;
  height: 100dvh;
  margin: 0 auto;
  background: radial-gradient(120% 80% at 50% 35%, #161821 0%, #000 78%);
  color: #fff;
  font-family: var(--font-sans);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: stretch;
  text-align: center;
}

.brand {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--accent);
  text-shadow: 0 0 24px var(--accent-glow);
  margin-bottom: 6px;
}

.lead {
  font-size: 15px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}
.primary-btn {
  background: var(--accent);
  color: #000;
  font-family: var(--font-sans);
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: -0.3px;
  padding: 16px;
  border-radius: var(--radius-pill);
  border: none;
  box-shadow:
    0 14px 40px rgba(212, 255, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.15);
}
.primary-btn:disabled {
  opacity: 0.55;
  box-shadow: none;
}

.ghost-btn {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid var(--glass-border);
  padding: 14px 22px;
  border-radius: var(--radius-pill);
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.2px;
  isolation: isolate;
}

.bot-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: rgba(36, 161, 222, 0.12);
  border: 1px solid rgba(36, 161, 222, 0.35);
  border-radius: 14px;
  color: rgb(108, 195, 240);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: background 200ms ease;
}
.bot-link:active {
  background: rgba(36, 161, 222, 0.2);
}
.bot-link-arrow {
  font-size: 18px;
  opacity: 0.7;
}

.status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--accent);
  padding: 4px 6px;
  text-align: left;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
.dot-on {
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
  animation: vn-pulse 1.4s ease-in-out infinite;
}

.sep {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 2px;
}
.sep::before,
.sep::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.back {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  padding: 8px;
  cursor: pointer;
  font-family: inherit;
}

.error {
  color: rgba(255, 120, 120, 0.92);
  font-size: 13px;
  text-align: center;
  padding: 6px;
}
</style>
