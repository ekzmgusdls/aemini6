<script setup>
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
      playActiveVideo()
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
  videoEmbeds.value.forEach((_, idx) => {
    const id = `yt-iframe-${idx}`
    const el = document.getElementById(id)
    if (!el) return
    const player = new window.YT.Player(id, {
      events: {
        onReady: (e) => {
          if (swiperRef.value && swiperRef.value.activeIndex === idx) {
            safePlay(player)
          }
        },
      },
      playerVars: { modestbranding: 1, rel: 0, controls: 1 },
    })
    players.value.push(player)
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
function playActiveVideo() {
  if (!swiperRef.value) return
  const idx = swiperRef.value.activeIndex
  if (idx < videoEmbeds.value.length) {
    const p = players.value[idx]
    if (p) safePlay(p)
  }
}
function onSwiper(swiper) {
  swiperRef.value = swiper
}
function onSlideChange(swiper) {
  pauseAll()
  if (swiper.activeIndex < videoEmbeds.value.length) {
    const p = players.value[swiper.activeIndex]
    p && safePlay(p)
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
      <SwiperSlide v-for="(video, vIndex) in videoEmbeds" :key="'vid-' + vIndex">
        <div class="video-wrapper">
          <div class="ratio-16x9">
            <iframe
              :id="'yt-iframe-' + vIndex"
              :src="video"
              title="YouTube video"
              frameborder="0"
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </SwiperSlide>
      <SwiperSlide v-for="(image, index) in images" :key="'img-' + index">
        <img
          :src="image"
          :class="{ 'is-loaded': loaded[index] }"
          alt="Slide Image"
          loading="lazy"
          @load="onImgLoad(index)"
        />
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
        aspect-ratio: 16 / 9;
        background: #000;
        iframe {
          position: absolute;
          inset: 0;
          width: 100%;
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
</style>
