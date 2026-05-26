<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDynamicEngine } from '../novel/dynamicEngine';
import SceneBackground from '../components/SceneBackground.vue';
import SceneCharacters from '../components/SceneCharacters.vue';
import DialoguePanel from '../components/DialoguePanel.vue';
import TapOverlay from '../components/TapOverlay.vue';
import TitlePill from '../components/TitlePill.vue';
import TabBar from '../components/TabBar.vue';
import StoryListView from './StoryListView.vue';
import ProfileView from './ProfileView.vue';
import type { BackgroundRef } from '../novel/types';

type TabKey = 'home' | 'catalog' | 'read' | 'saved' | 'profile';

const engine = useDynamicEngine();
const {
  currentBlock,
  currentCharacter,
  displayedText,
  isTyping,
  isLoading,
  isChoice,
  error,
  characters,
  displayedBgUrl,
  sceneCharacters,
  currentIdx,
  title,
  summary,
  history,
  tap,
  selectChoice,
  goBack,
  retry,
  startNewStory,
} = engine;

const canGoBack = computed(() => currentIdx.value > 0);
const defaultBg: BackgroundRef = { kind: 'preset', value: 'street_night' };

// Активная вкладка TabBar. По умолчанию «Читаю». Другие вкладки кроме
// 'profile' пока no-op — открываются как list-view вкладки «Читаю».
const currentTab = ref<TabKey>('read');
function selectTab(t: TabKey) {
  currentTab.value = t;
}

// View mode внутри вкладки «Читаю»: novel (читаем сцену) или list (выбор истории).
// На старте всегда list — пользователь выбирает что открыть или жмёт «Новая история».
type ViewMode = 'novel' | 'list';
const viewMode = ref<ViewMode>('list');

function openList() {
  viewMode.value = 'list';
}

function startNew() {
  // Полный сброс engine + запуск свежей генерации.
  startNewStory();
  viewMode.value = 'novel';
}

function openStory(_id: string) {
  // TODO: загрузить конкретную dialog по id.
  viewMode.value = 'novel';
}

// Карточки историй для list-view. Пока — текущая активная dialog (если есть).
const stories = computed(() => {
  if (!title.value && !summary.value && history.value.length === 0) return [];
  return [
    {
      id: 'current',
      title: title.value || 'Без названия',
      summary: summary.value,
      choiceCount: history.value.length,
    },
  ];
});
</script>

<template>
  <div class="phone-frame">
    <!-- Вкладка ЧИТАЮ — текущий контент: новелла или список историй -->
    <template v-if="currentTab === 'read'">
      <template v-if="viewMode === 'novel'">
        <SceneBackground :background="defaultBg" :image-url="displayedBgUrl" />
        <SceneCharacters :characters="sceneCharacters" />

        <TapOverlay :enabled="!isChoice && !error" @tap="tap" />

        <TitlePill :title="title || 'elys mode'" />

        <DialoguePanel
          :block="currentBlock"
          :character="currentCharacter"
          :characters="characters"
          :displayed-text="displayedText"
          :is-typing="isTyping"
          :is-loading="isLoading"
          :error="error"
          :can-go-back="canGoBack"
          @choose="selectChoice"
          @advance="tap"
          @retry="retry"
          @back="goBack"
          @close="openList"
        />
      </template>

      <template v-else>
        <TitlePill title="Истории" />
        <StoryListView
          :stories="stories"
          @new="startNew"
          @open="openStory"
        />
      </template>
    </template>

    <!-- Вкладка ПРОФИЛЬ — редактирование своего персонажа -->
    <template v-else-if="currentTab === 'profile'">
      <ProfileView />
    </template>

    <!-- Остальные вкладки пока никуда не ведут — показываем общий placeholder
         (тот же list-view) чтобы не было пустого экрана. -->
    <template v-else>
      <TitlePill title="Скоро" />
      <StoryListView
        :stories="stories"
        @new="startNew"
        @open="openStory"
      />
    </template>

    <!-- TabBar общий для всех режимов -->
    <TabBar :active="currentTab" @select="selectTab" />
  </div>
</template>

<style scoped>
.phone-frame {
  position: relative;
  width: 100%;
  max-width: 430px;
  height: 100dvh;
  margin: 0 auto;
  overflow: hidden;
  background: #000;
  color: #fff;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
</style>
