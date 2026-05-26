<template>
  <div class="landscape-blocker">
    <div class="icon">📱</div>
    <div class="text">Поверните устройство вертикально</div>
  </div>
</template>

<style scoped>
.landscape-blocker {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  color: #fff;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  font-size: 16px;
}
@media (orientation: landscape) and (max-height: 500px) {
  .landscape-blocker {
    display: flex;
  }
}
.icon {
  font-size: 48px;
}
</style>
