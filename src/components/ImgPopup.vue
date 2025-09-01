<script setup>
import { ref, computed, defineEmits, onUnmounted, onMounted } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Keyboard } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

import IconClose from './icons/IconClose.vue'
import IconNext from './icons/IconNext.vue'
import IconPrev from './icons/IconPrev.vue'

const emit = defineEmits()

const props = defineProps({
  // slide가 "배열"일 수도, "단일 객체"일 수도 있다고 가정
  slide: { type: [Array, Object], required: true },
})

// (E) slide를 안전하게 배열화 + 역순
const r_slides = computed(() => {
  const arr = Array.isArray(props.slide) ? props.slide : [props.slide]
  return [...arr].reverse()
})

const swiperRef = ref(null)
const currentSwiperIndex = ref(0)
const isNavOn = ref(false)
const pageInput = ref(1)
const swiperSectionNumbers = ref([
  'BURST Film',
  'BURST GROUP',
  'HIGHLIGHT MEDLEY',
  'ENERGY GROUP',
  'ENERGY GISELLE',
  'ENERGY WINTER',
  'ENERGY KARINA',
  'ENERGY NINGNING',
  'Trailer',
])

// r_slides 의 마지막 슬라이드에서 우측버튼을 눌렀을경우
function firstSwiperPrev(e) {
  if (e.currentTarget.classList.contains('swiper-button-disabled') && currentSwiperIndex.value > 0)
    currentSwiperIndex.value--
}
function lastSwiperNext(e) {
  console.log(currentSwiperIndex.value, r_slides.value.length)
  if (
    e.currentTarget.classList.contains('swiper-button-disabled') &&
    currentSwiperIndex.value < r_slides.value.length - 1
  ) {
    currentSwiperIndex.value++
  }
}
// r_slides 기준 각 블록의 시작 인덱스
const rslideStartIndexes = computed(() => {
  const arr = r_slides.value
  if (!arr.length) return []
  const indexes = []
  let idx = 0
  for (const r of arr) {
    indexes.push(idx)
    idx += (r.images?.length || 0) + (r.videos?.length || 0)
  }
  return indexes
})

// (B) YT API 로더: 전역 1회만
let ytApiPromise = null
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      if (window.onYouTubeIframeAPIReady) {
        // 다른 곳에서 이미 세팅했을 수도 있음 → 바로 resolve
        // (YT가 로드되면 window.YT 존재. 방어적으로 콜백 유지)
        const prev = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
          prev?.()
          resolve()
        }
      } else {
        window.onYouTubeIframeAPIReady = () => resolve()
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return ytApiPromise
}

// (C) 활성 슬라이드에만 플레이어 생성/유지 (div 컨테이너 기반)
let currentPlayer = null
let currentVideoContainerId = null
let currentVideoId = null

function destroyCurrentPlayer() {
  if (currentPlayer) {
    try {
      currentPlayer.destroy()
    } catch {}
  }
  currentPlayer = null
  currentVideoContainerId = null
  currentVideoId = null
}

async function ensureActiveSlidePlayer() {
  if (!swiperRef.value) return
  const activeIndex = swiperRef.value.activeIndex
  const slideEl = swiperRef.value.slides[activeIndex]
  if (!slideEl || !slideEl.classList.contains('video-slide')) {
    destroyCurrentPlayer()
    return
  }

  const container = slideEl.querySelector('.yt-player')
  if (!container) return
  const videoId = container.dataset.videoId
  if (!videoId) return

  // 동일 컨테이너 & 플레이어 존재 → 재생만
  if (currentVideoContainerId === container.id && currentPlayer) {
    try {
      currentPlayer.playVideo()
    } catch {}
    return
  }

  // 기존 플레이어 제거 후 새로 생성
  destroyCurrentPlayer()
  await loadYouTubeAPI()
  currentVideoContainerId = container.id
  currentVideoId = videoId
  currentPlayer = new window.YT.Player(container.id, {
    videoId: videoId,
    playerVars: {
      playsinline: 1,
      enablejsapi: 1,
      modestbranding: 1,
      rel: 0,
      controls: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: (e) => {
        try {
          e.target.mute()
          e.target.playVideo()
        } catch {}
      },
    },
  })
}

function pauseActiveVideo() {
  if (currentPlayer) {
    try {
      currentPlayer.pauseVideo()
    } catch {}
  }
}

async function onSwiper(swiper) {
  swiperRef.value = swiper
  await loadYouTubeAPI()
  pauseActiveVideo()
  ensureActiveSlidePlayer()
}

function onSlideChange(swiper) {
  pageInput.value = swiper.activeIndex + 1
  pauseActiveVideo()
}

function onSlideChangeTransitionEnd() {
  ensureActiveSlidePlayer()
}

onUnmounted(() => {
  destroyCurrentPlayer()
})

// (A) ORIGIN: playerVars.origin 으로 사용 (직접 iframe src 생성 제거됨)
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

// (D) iOS 감지하여 blur 비활성화
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const closePopup = () => emit('close')

// 네비게이션 점프
function goToSlide(idx) {
  if (swiperRef.value) {
    swiperRef.value.slideTo(idx)
    pageInput.value = swiperRef.value.activeIndex + 1
  }
}

function r_slides_numbering() {
  // swiperSectionNumbers.value
  let sectionNumber = 0
  r_slides.value.forEach((rslide, index) => {
    if (index < r_slides.value.length - 1) {
      sectionNumber += Number(rslide.images.length) + Number(rslide.videos.length)
      swiperSectionNumbers.value.push(sectionNumber + 1)
    }
  })
}

onMounted(() => {
  // r_slides_numbering()
})
</script>

<template>
  <div class="img-popup" :class="{ 'no-blur': isIOS }">
    <template v-for="(r_slide, i) in r_slides" :key="'r_slides-' + i">
      <div class="swiper-container" v-if="i == currentSwiperIndex">
        <Swiper
          class="images"
          :modules="[Navigation, Pagination, Keyboard]"
          :slides-per-view="1"
          :navigation="{
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
          }"
          :keyboard="{ enabled: true }"
          @swiper="onSwiper"
          @slideChange="onSlideChange"
          @slideChangeTransitionEnd="onSlideChangeTransitionEnd"
        >
          <div
            class="swiper-nav-toggler"
            @click="isNavOn = !isNavOn"
            :class="{ 'is-active': isNavOn }"
          >
            Navigation
          </div>
          <div class="swiper-number-nav" :class="{ 'is-active': isNavOn }">
            <div
              v-for="(startIdx, i) in swiperSectionNumbers"
              :key="'rslide-nav-' + i"
              class="num-btn"
              :class="{ active: currentSwiperIndex === i }"
              @click="currentSwiperIndex = i"
            >
              {{ startIdx }}
            </div>
          </div>
          <template v-if="r_slide.videoType === 'first'">
            <!-- 비디오 먼저 -->
            <SwiperSlide
              class="video-slide"
              v-for="(video, index) in r_slide.videos"
              :key="'video-' + r_slide.id + index"
            >
              <div class="video-wrapper">
                <div class="ratio-16x9">
                  <div
                    class="yt-player"
                    :id="'yt-player-' + r_slide.id + '-' + index + '-first'"
                    :data-video-id="video"
                  ></div>
                </div>
              </div>
            </SwiperSlide>
            <SwiperSlide
              v-for="(image, index) in r_slide.images"
              :key="'image-' + r_slide.id + index"
            >
              <img :src="image" alt="Slide Image" loading="lazy" />
            </SwiperSlide>
          </template>
          <template v-else-if="r_slide.videoType === 'last'">
            <!-- 이미지 먼저 -->
            <SwiperSlide
              v-for="(image, index) in r_slide.images"
              :key="'image-' + r_slide.id + index"
            >
              <img :src="image" alt="Slide Image" loading="lazy" />
            </SwiperSlide>
            <SwiperSlide
              class="video-slide"
              v-for="(video, index) in r_slide.videos"
              :key="'video-' + r_slide.id + index"
            >
              <div class="video-wrapper">
                <div class="ratio-16x9">
                  <div
                    class="yt-player"
                    :id="'yt-player-' + r_slide.id + '-' + index + '-last'"
                    :data-video-id="video"
                  ></div>
                </div>
              </div>
            </SwiperSlide>
          </template>
          <template v-else-if="(r_slide.videos?.length || 0) < 1">
            <SwiperSlide
              v-for="(image, index) in r_slide.images"
              :key="'image-' + r_slide.id + index"
            >
              <img :src="image" alt="Slide Image" loading="lazy" />
            </SwiperSlide>
          </template>
          <template v-else-if="(r_slide.images?.length || 0) < 1">
            <SwiperSlide
              class="video-slide"
              v-for="(video, index) in r_slide.videos"
              :key="'video-' + r_slide.id + index"
            >
              <div class="video-wrapper">
                <div class="ratio-16x9">
                  <div
                    class="yt-player"
                    :id="'yt-player-' + r_slide.id + '-' + index + '-only'"
                    :data-video-id="video"
                  ></div>
                </div>
              </div>
            </SwiperSlide>
          </template>
        </Swiper>
        <div class="close" @click="closePopup"><IconClose /></div>
        <div class="swiper-button-prev-custom" @click="firstSwiperPrev"><IconPrev /></div>
        <div class="swiper-button-next-custom" @click="lastSwiperNext"><IconNext /></div>
      </div>
    </template>
  </div>
</template>
<style scoped lang="scss">
// 숫자 네비게이션 스타일
.swiper-number-nav {
  position: absolute;
  left: 50%;
  padding: 15px;
  transform: translateX(-50%) translateY(100%);
  display: flex;
  gap: 8px;
  z-index: 30;
  width: 100%;
  bottom: 0;
  overflow: scroll;
  transition: transform 0.2s;
  &.is-active {
    transform: translateX(-50%) translateY(0);
  }

  &::-webkit-scrollbar {
    display: none;
  }
  .num-btn {
    color: rgb(140, 140, 140);
    border: none;
    border-radius: 1px;
    padding: 3px;
    cursor: pointer;
    font-size: 15px;
    font-family: 'Acumin-variable', sans-serif;
    font-weight: 550;
    background: rgba(0, 0, 0, 1);
    &.active {
      background: white;
      color: black;
    }
  }
}

.swiper-page-indicator {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  padding: 2px 10px;
  font-size: 14px;
  z-index: 30;
}

.swiper-container {
  height: 100%;
}
.images img {
  width: 150px;
  opacity: 1;
  transition: opacity 300ms ease;
}
.img-popup :deep(.swiper) {
  width: 100%;
}
.img-popup :deep(.swiper-button-prev),
.img-popup :deep(.swiper-button-next) {
  color: #fff; /* arrow color */
  z-index: 20; /* ensure above image */
}
.img-popup :deep(.swiper-pagination-bullet) {
  background: rgba(255, 255, 255, 0.6);
}
.img-popup :deep(.swiper-pagination-bullet-active) {
  background: #fff;
}

.img-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 999;
  backdrop-filter: blur(5px);
  .close {
    position: fixed;
    top: 20px;
    right: 25px;
    cursor: pointer;
    z-index: 999;
    display: flex;
  }

  /* 커스텀 네비게이션 버튼 스타일 */
  .swiper-button-next-custom,
  .swiper-button-prev-custom {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 20;
    transition: background 0.3s;

    svg {
      color: white;
      width: 13px;
      height: auto;
      display: flex;
    }
  }

  .swiper-button-next-custom {
    right: 25px;
  }

  .swiper-button-prev-custom {
    left: 25px;
  }

  .swiper-button-disabled {
    // opacity: 0.5;
  }

  .swiper {
    height: 100%;
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 15px;
    }
    .video-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 15px;
      .ratio-16x9 {
        position: relative;
        width: 100%;
        background: transparent;
        aspect-ratio: 16 / 9;
        :deep(.yt-player) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
      }
    }
  }
  /* Style Swiper built-in navigation buttons (scoped safe) */
  /* 기존 기본 Swiper 버튼 스타일을 숨깁니다 */
  :deep(.swiper-button-next),
  :deep(.swiper-button-prev) {
    display: none;
  }
}

@media (aspect-ratio < 1/1) {
  .img-popup {
    .close {
      top: 20px;
      right: 20px;
      svg {
        width: 12px;
        height: auto;
      }
    }

    /* 모바일 화면에서 네비게이션 버튼 크기 조정 */
    .swiper-button-next-custom,
    .swiper-button-prev-custom {
      svg {
        width: 12px;
        height: auto;
      }
    }

    .swiper-button-next-custom {
      right: 20px;
    }

    .swiper-button-prev-custom {
      left: 20px;
    }

    .swiper {
      .video-wrapper {
        padding: 10px;
      }

      img {
        padding: 10px;
      }
    }
  }

  .swiper-number-nav {
    gap: 8px;
    .num-btn {
      font-size: 14px;
      padding: 2px 7px;
      white-space: nowrap;
    }
  }
}

.swiper-nav-toggler {
  position: fixed;
  bottom: 50px;
  left: 15px;
  z-index: 99;
  cursor: pointer;
  font-size: 18px;
  font-weight: 400;
  color: gray;
  &.is-active {
    color: white;
  }
}

@media (aspect-ratio > 16/9) {
  .img-popup {
    .swiper {
      .video-wrapper {
        .ratio-16x9 {
          height: 100%;
        }
      }
    }
  }
}
</style>
