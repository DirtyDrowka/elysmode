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
import type { BackgroundRef } from '../novel/types';

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
    <!-- NOVEL MODE: фон, спрайт, капсулы — всё что относится к чтению -->
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

    <!-- LIST MODE: список историй с зелёной «новая история» -->
    <template v-else>
      <TitlePill title="Истории" />
      <StoryListView
        :stories="stories"
        @new="startNew"
        @open="openStory"
      />
    </template>

    <!-- TabBar общий для обоих режимов: вкладка «Читаю» остаётся активной -->
    <TabBar active="read" />
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
