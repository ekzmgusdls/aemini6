<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import ImgPopup from '../components/ImgPopup.vue'

const containerRef = ref(null)
let renderer, scene, camera, controls, model
let raycaster, mouse
let baseRotY = 0 // 모델 기본 Y 회전값 보관

onMounted(async () => {
  init()
  await loadModel()
  // 현재 카메라 각도 기준으로 좌우 ±10도만 회전 가능 + 수직 회전 잠금
  limitOrbitRange(20)
  // 슬라이드 데이터 구성

  animate()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (renderer) renderer.dispose()
  if (controls) controls.dispose()
  if (renderer && renderer.domElement) {
    renderer.domElement.removeEventListener('click', onCanvasClick)
  }
})

function init() {
  scene = new THREE.Scene()

  scene.background = new THREE.Color(0x000000)
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
  camera.position.set(0, 1.2, 2.5)
  camera.zoom = 1.3
  camera.updateProjectionMatrix()

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    precision: 'highp',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setSize(window.innerWidth, window.innerHeight)
  containerRef.value.appendChild(renderer.domElement)

  // Raycaster
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  renderer.domElement.addEventListener('click', onCanvasClick)

  // Lights
  // Ambient base light
  scene.add(new THREE.AmbientLight(0xffffff, 1.0))

  // Warm sky / cool ground fill
  const hemi = new THREE.HemisphereLight(0xfff4a0, 0x223355, 0.8)
  hemi.position.set(0, 5, 0)
  scene.add(hemi)

  // Key/Fill/Rim directional lights
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(2.5, 3.5, 5)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xffffff, 5)
  fill.position.set(-3, 2, -2)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffffff, 0.7)
  rim.position.set(0, 3, -5)
  scene.add(rim)

  // Point light near camera for specular highlights
  const point = new THREE.PointLight(0xffffff, 0.9, 0, 5)
  point.position.set(0, 1.5, 2.5)
  scene.add(point)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = true
  controls.enableZoom = true
}

async function loadModel() {
  const loader = new GLTFLoader()
  // public 폴더 기준 루트 경로 사용
  const gltf = await loader.loadAsync('/jacket.glb')
  model = gltf.scene

  // center model at origin and scale to a comfortable size
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  model.position.y -= size.y * 0.05
  model.position.sub(center)
  model.rotation.y += Math.PI
  model.rotation.x -= 0.17
  // 기본 Y 회전값 저장 (sway의 기준)
  baseRotY = model.rotation.y
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) {
    const scale = 2 / maxDim
    model.scale.setScalar(scale)
  }

  scene.add(model)

  // 줌 제한: 현재 거리 기준으로 최대 15%만 더 가까이, 더 멀어지는 줌은 불가
  setZoomLimit(0.15)
}

function onResize() {
  if (!renderer || !camera) return
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function animate() {
  requestAnimationFrame(animate)
  // 기타처럼 좌우로 살짝 까딱까딱 (Y축만 소폭 사인 파동)
  if (model) {
    const t = performance.now() * 0.001
    const amp = 0.1 // 약 2.9도
    const speed = 0.4
    model.rotation.y = baseRotY + Math.sin(t * speed) * amp
  }
  controls && controls.update()
  renderer.render(scene, camera)
}

// 현재 카메라-타깃 거리(D)를 기준으로
// - minDistance = D * (1 - percent)  // 더 가까이 허용 (예: 15%)
// - maxDistance = D                  // 기본보다 멀어지는 줌 불가
function setZoomLimit(percent = 0.15) {
  if (!controls || !camera) return
  const target = controls.target || new THREE.Vector3()
  const baseDist = camera.position.distanceTo(target)
  const minD = Math.max(0.001, baseDist * (1 - percent))
  controls.minDistance = minD
  controls.maxDistance = baseDist
}

// 캔버스 클릭 시 가장 먼저 맞은 메쉬의 이름을 콘솔에 출력
function onCanvasClick(event) {
  if (!renderer || !camera || !scene) return
  const rect = renderer.domElement.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  mouse.set(x, y)
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  if (hits.length > 0) {
    // 첫 번째로 맞은 메쉬를 찾음
    const hit = hits.find((h) => h.object && h.object.isMesh) || hits[0]
    let name = hit.object?.name || ''
    // 이름이 비어있으면 상위로 올라가며 이름 탐색
    if (!name) {
      let p = hit.object?.parent
      while (p && !name) {
        if (p.name) name = p.name
        p = p.parent
      }
    }

    if (name == 'badge07002') {
      const slide = slides.value.find((s) => s.id === '26')
      if (slide) {
        selectedSlide.value = slide
      }
    }
  }
}

// 수평(Y축) 궤도만 허용하고 현재 각도 기준 좌우 ±rangeDeg로 제한, 상하(Polar)는 고정
function limitOrbitRange(rangeDeg = 10) {
  if (!controls) return
  const az = controls.getAzimuthalAngle()
  const pol = controls.getPolarAngle()
  const r = THREE.MathUtils.degToRad(rangeDeg)
  controls.minAzimuthAngle = az - r
  controls.maxAzimuthAngle = az + r
  controls.minPolarAngle = pol
  controls.maxPolarAngle = pol
}
</script>

<template>
  <div class="vignetting-top"></div>
  <div class="vignetting-bottom"></div>
  <div class="jacket-view" ref="containerRef"></div>
  <Transition name="fade">
    <ImgPopup v-if="selectedSlide" :slide="selectedSlide" @close="selectedSlide = null" />
  </Transition>
</template>
<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>
