<script setup>
import { ref, defineEmits, watch } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Keyboard } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

const emit = defineEmits()

const closePopup = () => {
  // Emit an event to close the popup
  emit('close')
}

const props = defineProps({
  slide: {
    type: Object,
    required: true,
  },
})

const images = ref(props.slide.images || [])
const loaded = ref([])

// props.slide.images 변경 시 이미지와 로딩 상태 초기화
watch(
  () => props.slide?.images,
  (val) => {
    images.value = Array.isArray(val) ? val : []
    loaded.value = Array.from({ length: images.value.length }, () => false)
  },
  { immediate: true },
)

function onImgLoad(index) {
  loaded.value[index] = true
}
</script>
<template>
  <div class="img-popup">
    <Swiper
      class="images"
      :modules="[Navigation, Pagination, Keyboard]"
      :slides-per-view="1"
      :navigation="true"
      :keyboard="{ enabled: true }"
    >
      <SwiperSlide v-for="(image, index) in images" :key="index">
        <img
          :src="image"
          :class="{ 'is-loaded': loaded[index] }"
          alt="Slide Image"
          loading="lazy"
          @load="onImgLoad(index)"
        />
      </SwiperSlide>
    </Swiper>
    <div class="close" @click="closePopup">CLOSE</div>
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
  z-index: 9;
  backdrop-filter: blur(5px);
  .close {
    position: fixed;
    top: 20px;
    right: 20px;
    font-size: 20px;
    color: white;
    line-height: 1;
    cursor: pointer;
    z-index: 999;
  }

  .swiper {
    height: 100%;
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 15px;
    }
  }
  /* Style Swiper built-in navigation buttons (scoped safe) */
  :deep(.swiper-button-next),
  :deep(.swiper-button-prev) {
    color: white;
    border-radius: 50%;
    /* center default ::after arrow */
    display: flex;
    align-items: center;
    font-size: 20px;
    justify-content: center;
    &::before,
    &::after {
      content: '';
    }
  }

  :deep(.swiper-button-next) {
    &::before {
      content: 'NEXT';
    }
  }
  :deep(.swiper-button-prev) {
    &::before {
      content: 'PREV';
    }
  }
}
</style>
