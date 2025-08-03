<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { ref, onMounted, onUnmounted } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import LightningEffect from './components/LightningEffect.vue'
import { Vue3Marquee } from 'vue3-marquee'

const lightningRef = ref(null)
const audioRef = ref(null)

// 오디오 재생 함수
const playAudio = () => {
  if (audioRef.value) {
    try {
      // 현재 재생 중이면 처음부터 다시 재생
      audioRef.value.currentTime = 0
      audioRef.value.play()
      console.log('오디오 재생 시작')
    } catch (error) {
      console.error('오디오 재생 실패:', error)
    }
  }
}

// 번개 생성 이벤트 리스너
const handleCreateLightning = (event) => {
  if (lightningRef.value) {
    lightningRef.value.createLightningAt(event.detail.x, event.detail.y)
    // 번개와 함께 오디오 재생
    playAudio()
  }
}

onMounted(() => {
  window.addEventListener('createLightning', handleCreateLightning)
})

onUnmounted(() => {
  window.removeEventListener('createLightning', handleCreateLightning)
})
</script>

<template>
  <header>
    <Vue3Marquee :direction="'left'" :duration="300" class="marquee" gap="10">
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
      <span>I AM ENOUGH AS I AM. I AM A RICH MAN. </span>
    </Vue3Marquee>
  </header>
  <RouterView />
  <LightningEffect ref="lightningRef" />

  <!-- 숨겨진 오디오 태그 -->
  <audio ref="audioRef" preload="auto" style="display: none">
    <source src="/src/assets/richman.wav" type="audio/wav" />
    브라우저가 오디오를 지원하지 않습니다.
  </audio>
  <div class="texts">
    <img src="/texts.png" alt="" />
  </div>
</template>

<style>
body {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
  background-attachment: fixed;
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

html {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}
</style>
