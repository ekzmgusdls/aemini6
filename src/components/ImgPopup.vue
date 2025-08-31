<script setup>
const pageInput = ref(1)
import { computed } from 'vue'
// ...existing code...
// 전체 슬라이드 개수
const totalSlides = computed(() => images.value.length + videoEmbeds.value.length)

// 현재 활성화된 슬라이드 인덱스 (1-based)
const currentSlide = computed(() => {
  if (!swiperRef.value) return 1
  return swiperRef.value.activeIndex + 1
})

// 숫자 네비게이션 이동 함수
function goToSlide(idx) {
  if (swiperRef.value) {
    swiperRef.value.slideTo(idx)
    pageInput.value = swiperRef.value.activeIndex + 1
  }
}
import { ref, defineEmits, watch, nextTick, onUnmounted } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Keyboard } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

// import icon - close,next,prev
import IconClose from './icons/IconClose.vue'
import IconNext from './icons/IconNext.vue'
import IconPrev from './icons/IconPrev.vue'

const emit = defineEmits()

const props = defineProps({
  slide: {
    type: Object,
    required: true,
  },
})

const images = ref(props.slide.images || [])
const loaded = ref([])
const videoEmbeds = ref([])
const players = ref([]) // YouTube player instances matching videoEmbeds order
const swiperRef = ref(null)
const isNavOn = ref(false)
let ytApiPromise = null

// props.slide.images 변경 시 이미지와 로딩 상태 초기화
watch(
  () => props.slide?.images,
  (val) => {
    images.value = Array.isArray(val) ? val : []
    loaded.value = Array.from({ length: images.value.length }, () => false)
  },
  { immediate: true },
)

// 유튜브 링크를 iframe embed URL로 변환
function toYouTubeEmbed(url) {
  if (!url) return null
  url = url.trim()
  // 이미 embed 형태면 그대로
  if (/youtube\.com\/embed\//.test(url)) return appendYTParams(url)
  // youtu.be 단축
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)
  if (short) return appendYTParams(`https://www.youtube.com/embed/${short[1]}`)
  // watch?v=
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)
  if (watch) return appendYTParams(`https://www.youtube.com/embed/${watch[1]}`)
  // 그냥 ID로만 온 경우 (11자 기준) -> 허용
  if (/^[a-zA-Z0-9_-]{6,}$/.test(url)) return appendYTParams(`https://www.youtube.com/embed/${url}`)
  return null
}

function appendYTParams(base) {
  const params = new URLSearchParams({
    rel: '0',
    enablejsapi: '1',
    playsinline: '1',
    autoplay: '0', // 자동 재생 비활성화
  })
  return base.includes('?') ? `${base}&${params.toString()}` : `${base}?${params.toString()}`
}

function buildVideoEmbeds() {
  const list = []
  if (Array.isArray(props.slide?.videos)) {
    props.slide.videos.forEach((line) => {
      const embed = toYouTubeEmbed(line)
      if (embed) list.push(embed)
    })
  } else if (props.slide?.video) {
    const single = toYouTubeEmbed(props.slide.video)
    if (single) list.push(single)
  }
  videoEmbeds.value = list
}

watch(
  () => [props.slide?.videos, props.slide?.video],
  () => {
    buildVideoEmbeds()
    nextTick(async () => {
      await ensureYT()
      initPlayers()
      // playActiveVideo()
    })
  },
  { immediate: true },
)

function ensureYT() {
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev && prev()
      resolve()
    }
  })
  return ytApiPromise
}

function initPlayers() {
  // destroy previous
  players.value.forEach((p) => {
    try {
      p.destroy && p.destroy()
    } catch (e) {}
  })
  players.value = []
  let readyCount = 0
  nextTick(() => {
    videoEmbeds.value.forEach((_, idx) => {
      const id = `yt-iframe-${idx}`
      const el = document.getElementById(id)
      if (!el) return
      const player = new window.YT.Player(id, {
        events: {
          onReady: (e) => {
            players.value[idx] = player
            readyCount++
            // 모든 player가 준비되면 playActiveVideo 실행
            if (readyCount === videoEmbeds.value.length) {
              // playActiveVideo()
            }
          },
        },
        playerVars: { modestbranding: 1, rel: 0, controls: 1 },
      })
    })
  })
}

function safePlay(p) {
  try {
    p.unMute && p.unMute()
    p.playVideo && p.playVideo()
  } catch (e) {}
}

function pauseAll() {
  players.value.forEach((p) => {
    try {
      p.pauseVideo && p.pauseVideo()
    } catch (e) {}
  })
}

// 현재 슬라이드가 비디오인지 확인하는 함수
function isCurrentSlideVideo() {
  if (!swiperRef.value) return false
  // 이미지의 수를 구합니다
  const imageCount = images.value.length
  // 현재 활성화된 슬라이드의 인덱스
  const activeIndex = swiperRef.value.activeIndex

  // 활성화된 슬라이드의 인덱스가 이미지 수보다 크거나 같으면 비디오 슬라이드입니다
  // 현재 슬라이드가 비디오인 경우 videoIndex는 0부터 시작하는 비디오 배열 내 인덱스
  if (swiperRef.value.slides[activeIndex].classList.contains('video-slide')) {
    return activeIndex
  }

  return -1 // 비디오가 아닌 경우 -1 반환
}

function playActiveVideo() {
  const videoIndex = isCurrentSlideVideo()

  // 현재 슬라이드가 비디오가 아니면 재생하지 않음
  if (videoIndex === -1) return
  // YouTube Player가 iframe에 attach되기까지 약간의 지연이 있을 수 있으므로 nextTick으로 보장
  nextTick(() => {
    const player = players.value[videoIndex]
    if (player) safePlay(player)
    setTimeout(() => {
      if (player) safePlay(player)
    }, 1000) // 0.5초 후에 다시 시도
  })
}

function onSwiper(swiper) {
  swiperRef.value = swiper
  // 초기에 활성화된 슬라이드가 비디오일 경우 강제로 재생 시도
}

function onSlideChange(swiper) {
  // 모든 비디오 일시 정지
  pauseAll()
  // 현재 활성화된 슬라이드가 비디오인지 확인
  const videoIndex = isCurrentSlideVideo()
  // 페이지 인디케이터 및 숫자 네비게이션 동기화
  pageInput.value = swiper.activeIndex + 1
  // .num-btn active는 currentSlide computed가 자동 반영
  if (videoIndex !== -1) {
    const player = players.value[videoIndex]
    if (player) safePlay(player)
  }
}

onUnmounted(() => {
  pauseAll()
  players.value.forEach((p) => {
    try {
      p.destroy && p.destroy()
    } catch (e) {}
  })
})

function onImgLoad(index) {
  loaded.value[index] = true
}

const closePopup = () => {
  pauseAll()
  emit('close')
}
</script>
<template>
  <div class="img-popup">
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
    >
      <!-- 숫자 네비게이션 -->
      <div class="swiper-nav-toggler" @click="isNavOn = !isNavOn" :class="{ 'is-active': isNavOn }">
        Navigation
      </div>
      <div class="swiper-number-nav" :class="{ 'is-active': isNavOn }">
        <div
          v-for="n in totalSlides"
          :key="'num-nav-' + n"
          :class="['num-btn', { active: pageInput === n }]"
          @click="goToSlide(n - 1)"
        >
          {{ n }}
        </div>
      </div>
      <template v-for="(image, index) in images" :key="'img-3-' + index">
        <SwiperSlide v-if="index <= 2">
          <img
            :src="image"
            :class="{ 'is-loaded': loaded[index] }"
            alt="Slide Image"
            loading="lazy"
            @load="onImgLoad(index)"
          />
        </SwiperSlide>
      </template>
      <SwiperSlide class="video-slide">
        <div class="video-wrapper">
          <div class="ratio-16x9">
            <iframe
              :id="'yt-iframe-' + 0"
              :src="videoEmbeds[0]"
              title="YouTube video"
              frameborder="0"
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </SwiperSlide>
      <template v-for="(image, index) in images" :key="'img-2-' + index">
        <SwiperSlide v-if="index > 2">
          <img
            :src="image"
            :class="{ 'is-loaded': loaded[index] }"
            alt="Slide Image"
            loading="lazy"
            @load="onImgLoad(index)"
          />
        </SwiperSlide>
      </template>
      <SwiperSlide class="video-slide">
        <div class="video-wrapper">
          <div class="ratio-16x9">
            <iframe
              :id="'yt-iframe-' + 1"
              :src="videoEmbeds[1]"
              title="YouTube video"
              frameborder="0"
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </SwiperSlide>
    </Swiper>
    <div class="close" @click="closePopup"><IconClose /></div>
    <!-- 커스텀 네비게이션 버튼 -->
    <div class="swiper-button-prev-custom">
      <IconPrev />
    </div>
    <div class="swiper-button-next-custom">
      <IconNext />
    </div>
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
.images img {
  width: 150px;
  opacity: 0;
  transition: opacity 300ms ease;
}
.images img.is-loaded {
  opacity: 1;
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
    opacity: 0.5;
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
        iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          object-fit: contain;
          height: 100%;
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
