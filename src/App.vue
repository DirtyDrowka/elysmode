<script setup lang="ts">
import { computed } from 'vue';
import NovelView from './views/NovelView.vue';
import AuthView from './views/AuthView.vue';
import LandscapeBlocker from './components/LandscapeBlocker.vue';
import { useAuth } from './composables/useAuth';

const { isAuthenticated, ready } = useAuth();
const showApp = computed(() => ready.value && isAuthenticated.value);
const showAuth = computed(() => ready.value && !isAuthenticated.value);
</script>

<template>
  <NovelView v-if="showApp" />
  <AuthView v-else-if="showAuth" />
  <div v-else class="boot-splash" />
  <LandscapeBlocker />
</template>

<style scoped>
.boot-splash {
  position: fixed;
  inset: 0;
  background: #000;
}
</style>
