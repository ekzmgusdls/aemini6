<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'

import ImgPopup from './ImgPopup.vue'

const canvasRef = ref(null)
let scene, camera, renderer, controls, guitar
let raycaster, mouse
let isLightningActive = false // 번개 활성 상태 추적
let lightningStartHandler, lightningEndHandler // 이벤트 핸들러 참조
let thunderRotate = false // 번개 생성 시 자동 회전 정지 여부 (true: 정지함, false: 계속 회전)
let activeLightningCount = 0 // 현재 진행 중인 번개 개수
const maxLightningCount = 3 // 최대 동시 번개 개수
const isLoading = ref(true) // 모델 로딩 상태
let myguitar = null

// slides: 각 폴더(예: 25, 26)의 이미지 URL 목록과 video.txt의 라인들을 담음
const slides = ref([])
let selectedSlide = ref(null)
// 빌드 타임에 src/slides/*/* 이미지를 수집하고, 각 폴더의 video.txt(raw)를 읽어 배열 구성
function buildSlides() {
  // 이미지 수집 (png/jpg/jpeg/gif/webp/avif), 값은 URL 문자열
  const imageMods = import.meta.glob('@/slides/*/*.{png,jpg,jpeg,gif,webp,avif}', {
    eager: true,
    import: 'default',
  })
  // video.txt를 raw 텍스트로 수집
  const videoMods = import.meta.glob('@/slides/*/video.txt', {
    eager: true,
    as: 'raw',
  })

  const byFolder = new Map()

  // 이미지들을 폴더별로 모으기
  for (const [path, url] of Object.entries(imageMods)) {
    const m = path.match(/slides\/([^/]+)\//)
    if (!m) continue
    const folder = m[1]
    const entry = byFolder.get(folder) || { id: folder, images: [], videos: [] }
    entry.images.push({ url, filename: path.split('/').pop() || '' })
    byFolder.set(folder, entry)
  }

  // 비디오 텍스트를 폴더별로 파싱하여 라인 배열로 저장
  for (const [path, raw] of Object.entries(videoMods)) {
    const m = path.match(/slides\/([^/]+)\//)
    if (!m) continue
    const folder = m[1]
    const entry = byFolder.get(folder) || { id: folder, images: [], videos: [] }
    const lines = String(raw)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    entry.videos = lines
    byFolder.set(folder, entry)
  }

  // 정렬: 폴더명 자연 정렬, 이미지 파일명도 정렬 후 URL 배열로 치환
  const arr = Array.from(byFolder.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  )
  arr.forEach((e) => {
    e.images.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }))
    e.images = e.images.map((i) => i.url)
  })
  return arr
}

onMounted(async () => {
  // TheGuitar가 활성화된 동안만 배경 적용
  const prevBg = document.body.style.backgroundImage
  const applyBg = () => {
    document.body.style.backgroundImage = "url('./background.jpg')"
  }
  applyBg()
  const resizeBgHandler = () => applyBg()
  window.addEventListener('resize', resizeBgHandler)

  await initThreeJS()
  await loadGuitar()
  animate()
  setupRaycaster()
  setupLightningListeners() // 번개 이벤트 리스너 설정
  linkBox()
  slides.value = buildSlides()
  // 언마운트 시 복원하도록 전역에 저장
  window.__theGuitarPrevBg = prevBg
  window.__theGuitarResizeBgHandler = resizeBgHandler
})

onUnmounted(() => {
  if (renderer) {
    renderer.dispose()
  }

  // 이벤트 리스너 제거
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('click', onCanvasClick)
  }
  window.removeEventListener('resize', handleResize)

  // 번개 이벤트 리스너 제거
  if (lightningStartHandler) {
    window.removeEventListener('createLightning', lightningStartHandler)
  }

  // 복제된 link-box 정리
  const clonedBox = document.querySelector('body .link-box-clone')
  if (clonedBox) {
    clonedBox.remove()
  }

  // 배경 원복 및 리스너 제거
  if (window.__theGuitarResizeBgHandler) {
    window.removeEventListener('resize', window.__theGuitarResizeBgHandler)
    window.__theGuitarResizeBgHandler = null
  }
  if (typeof window.__theGuitarPrevBg !== 'undefined') {
    document.body.style.backgroundImage = window.__theGuitarPrevBg || ''
    delete window.__theGuitarPrevBg
  } else {
    document.body.style.backgroundImage = ''
  }
})

// popup trigger
const popupTrigger = (index) => {
  // 팝업 로직 구현

  const indexStr = String(index)

  const slide = slides.value.find((s) => s.id == indexStr)
  if (slide) {
    selectedSlide.value = slide
  }
}

function linkBox() {
  let linkboxLeft = document.querySelector('.texts-mobile .link-box-left')
  let linkboxRight = document.querySelector('.texts-mobile .link-box-right')

  if (!linkboxLeft || !linkboxRight) return // linkbox가 없으면 종료

  let clonedBoxLeft = document.querySelector('body .link-box-clone.link-box-left')
  let clonedBoxRight = document.querySelector('body .link-box-clone.link-box-right')

  // 복제본이 없으면 새로 생성
  if (!clonedBoxLeft || !clonedBoxRight) {
    clonedBoxLeft = linkboxLeft.cloneNode(true)
    clonedBoxRight = linkboxRight.cloneNode(true)
    clonedBoxLeft.classList.add('link-box-clone')
    document.querySelector('main').appendChild(clonedBoxLeft)
    clonedBoxRight.classList.add('link-box-clone')
    document.querySelector('main').appendChild(clonedBoxRight)
  }

  // 클론된 오른쪽 박스에 popupTrigger(25) 클릭 바인딩 (중복 방지)
  if (clonedBoxRight && !clonedBoxRight.dataset.popupBound) {
    clonedBoxRight.addEventListener('click', () => popupTrigger(25))
    clonedBoxRight.dataset.popupBound = '1'
  }

  // linkbox 위치 계산
  const rectLeft = linkboxLeft.getBoundingClientRect()
  const rectRight = linkboxRight.getBoundingClientRect()

  // 개별 CSS 속성으로 설정 (동적 업데이트 가능)
  clonedBoxLeft.style.position = 'fixed'
  clonedBoxLeft.style.left = `${rectLeft.left}px`
  clonedBoxLeft.style.top = `${rectLeft.bottom - rectLeft.height}px`
  clonedBoxLeft.style.width = `${rectLeft.width}px`
  clonedBoxLeft.style.height = `${rectLeft.height}px`
  clonedBoxLeft.style.zIndex = '99'
  clonedBoxLeft.style.pointerEvents = 'auto'

  clonedBoxRight.style.position = 'fixed'
  clonedBoxRight.style.left = `${rectRight.left}px`
  clonedBoxRight.style.top = `${rectRight.bottom - rectRight.height}px`
  clonedBoxRight.style.width = `${rectRight.width}px`
  clonedBoxRight.style.height = `${rectRight.height}px`
  clonedBoxRight.style.zIndex = '99'
  clonedBoxRight.style.pointerEvents = 'auto'
}

const initThreeJS = async () => {
  // Scene 생성
  scene = new THREE.Scene()
  // scene.background = new THREE.Color(0x222222) // 배경 제거로 투명하게

  // Camera 생성
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000) // FOV를 50으로 줄여서 망원 효과
  camera.zoom = 2

  // 초기 화면 비율에 따른 카메라 위치 설정
  const initialAspectRatio = window.innerWidth / window.innerHeight

  if (initialAspectRatio < 1) {
    camera.zoom = 1.2
    camera.position.set(-0.37, 2, 0.3) // 더 가까운 위치로 이동

    // 모바일에서 카메라 aspect ratio를 실제 렌더러 크기에 맞춤
    const additionalHeight = window.innerWidth * 0.15
    const mobileHeight = window.innerHeight + additionalHeight
    camera.aspect = window.innerWidth / mobileHeight
  } else {
    camera.zoom = 2
    camera.position.set(0.15, 2, 0.3) // 더 가까운 위치로 이동
    camera.aspect = initialAspectRatio
  }

  camera.updateProjectionMatrix() // Renderer 생성
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true, // 투명 배경 활성화
    powerPreference: 'high-performance', // 고성능 GPU 사용
    precision: 'highp', // 높은 정밀도 사용
    logarithmicDepthBuffer: true, // 깊이 버퍼 정밀도 향상
  })
  renderer.setClearColor(0x000000, 0) // 완전 투명 배경 설정

  // 초기 화면 비율에 따른 렌더러 크기 설정
  if (initialAspectRatio < 1) {
    // 모바일: 높이를 15vw만큼 늘림
    const additionalHeight = window.innerWidth * 0.15
    const mobileHeight = window.innerHeight + additionalHeight
    renderer.setSize(window.innerWidth, mobileHeight)
  } else {
    // 데스크톱: 기본 크기
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // 픽셀 밀도 설정 (최대 2배)
  // renderer.shadowMap.enabled = true // 그림자 비활성화
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace // 색상 공간 설정
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 톤 매핑
  renderer.toneMappingExposure = 1.0 // 노출도
  // renderer.physicallyCorrectLights = true // 물리적으로 정확한 조명 비활성화

  // Controls 생성
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.autoRotate = false // 자동 회전 비활성화
  controls.autoRotateSpeed = 0.5 // 자동 회전 속도 조정
  controls.enableZoom = false
  controls.enablePan = false // 패닝(이동) 비활성화

  // 회전 중심점을 아래로 이동하여 기타가 화면 아래쪽에 보이도록 설정

  // 헬퍼 그리드 추가
  const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444)
  // scene.add(gridHelper)

  // 축 헬퍼 추가 (X축: 빨강, Y축: 초록, Z축: 파랑)
  const axesHelper = new THREE.AxesHelper(2)
  // scene.add(axesHelper)

  // 기본 조명 추가 (모델링이 보이도록)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6) // 환경광 조금 줄임
  scene.add(ambientLight)

  // Hemisphere Light 추가 - 노란끼가 있는 따뜻한 조명
  const hemisphereLight = new THREE.HemisphereLight(
    0xfff4a0, // 위쪽 빛 (따뜻한 노란색)
    0x443366, // 아래쪽 빛 (어두운 보라색)
    100, // 강도
  )
  hemisphereLight.position.set(0, 50, 0)
  scene.add(hemisphereLight)

  // 방향광 - 앞쪽에서
  const directionalLight1 = new THREE.DirectionalLight(0xfff8c0, 0.8)
  directionalLight1.position.set(0, 5, 10)
  scene.add(directionalLight1)

  // 방향광 - 뒤쪽에서
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight2.position.set(0, 5, -10)
  scene.add(directionalLight2)

  // 방향광 - 왼쪽에서
  const directionalLight3 = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight3.position.set(-10, 5, 0)
  scene.add(directionalLight3)

  // 방향광 - 오른쪽에서
  const directionalLight4 = new THREE.DirectionalLight(0xffffff, 0.7)
  directionalLight4.position.set(10, 5, 0)
  scene.add(directionalLight4)

  // 방향광 - 위쪽에서
  const directionalLight5 = new THREE.DirectionalLight(0xffffff, 0.5)
  directionalLight5.position.set(0, 15, 0)
  scene.add(directionalLight5)

  // 방향광 - 아래쪽에서
  const directionalLight6 = new THREE.DirectionalLight(0xffffff, 0.4)
  directionalLight6.position.set(0, -5, 0)
  scene.add(directionalLight6)

  // 방향광 - 아래 오른쪽에서
  const directionalLight7 = new THREE.DirectionalLight(0xffffff, 10)
  directionalLight7.position.set(5, -5, 5)
  scene.add(directionalLight7)

  // ===================== 조명 헬퍼들 (가이드) =====================
  // const directionalLight1Helper = new THREE.DirectionalLightHelper(directionalLight1, 1, 0xff0000)
  // scene.add(directionalLight1Helper)

  // const directionalLight2Helper = new THREE.DirectionalLightHelper(directionalLight2, 1, 0x00ff00)
  // scene.add(directionalLight2Helper)

  // const directionalLight3Helper = new THREE.DirectionalLightHelper(directionalLight3, 1, 0x0000ff)
  // scene.add(directionalLight3Helper)

  // const directionalLight4Helper = new THREE.DirectionalLightHelper(directionalLight4, 1, 0xffff00)
  // scene.add(directionalLight4Helper)

  // const directionalLight5Helper = new THREE.DirectionalLightHelper(directionalLight5, 1, 0xff00ff)
  // scene.add(directionalLight5Helper)

  // const directionalLight6Helper = new THREE.DirectionalLightHelper(directionalLight6, 1, 0x00ffff)
  // scene.add(directionalLight6Helper)

  // const directionalLight7Helper = new THREE.DirectionalLightHelper(directionalLight7, 1, 0xff8800)
  // scene.add(directionalLight7Helper)
}

const loadGuitar = async () => {
  const loader = new GLTFLoader()
  const exrLoader = new EXRLoader()

  // HDR 환경맵 로드 (에러 처리 포함)
  let envMapTexture = null
  try {
    envMapTexture = await new Promise((resolve, reject) => {
      exrLoader.load(
        './GSG_HC006_A001_GSGPROSTUDIOSMETAL001.exr',
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping
          resolve(texture)
        },
        (progress) => {},
        (error) => {
          reject(error)
        },
      )
    })

    // 씬에 환경맵 적용
    // scene.environment = envMapTexture
    scene.background = null // 배경은 투명하게 유지
  } catch (error) {
    console.warn('HDR 환경맵을 사용할 수 없습니다. 기본 조명을 사용합니다.')
    envMapTexture = null
  }

  try {
    const gltf = await loader.loadAsync('./guitar.glb')
    guitar = gltf.scene
    myguitar = guitar // 기타 모델을 전역 변수에 저장

    // 바운딩 박스 계산하여 중심점 맞추기 (GLTF viewer처럼)
    const box = new THREE.Box3().setFromObject(guitar)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // 기타를 원점으로 이동 (중심점 보정)
    guitar.position.x = -center.x
    guitar.position.y = -center.y
    guitar.position.z = -center.z

    guitar.position.set(-0.2, 0, 0.1) // 기타 위치 조정
    // guitar.position.z += 0.8

    // 모델 크기에 맞게 스케일 조정 (선택사항)
    const maxDimension = Math.max(size.x, size.y, size.z)
    if (maxDimension > 0) {
      const scale = 2 / maxDimension // 적당한 크기로 조정
      guitar.scale.setScalar(scale)
    }

    // 그림자 설정 및 재질 개선
    guitar.traverse((child) => {
      if (child.isMesh) {
        // child.castShadow = true // 그림자 비활성화
        // child.receiveShadow = true

        // 객체에 이름 부여 (Raycaster를 위해)
        if (!child.name) {
          child.name = `guitar_part_${Math.random().toString(36).substr(2, 9)}`
        }

        // 재질 개선 - 모델링 파일의 원본 재질 유지
        if (child.material) {
          // 원본 재질의 속성을 그대로 유지
          const material = child.material

          // metalness 속성 수정 (오타 수정)
          material.metalness = 1 // 금속성 조정
          // material.roughness = 0.3 // 거칠기 조정
          if (child.name == 'sub') {
            material.metalness = 5
            material.roughness = 1 // 거칠기 조정
            // material.roughness = 0.3 // 거칠기 조정
          } else if (child.name == 'Gold') {
            material.metalness = 5 // 금속성을 더 강하게
            material.roughness = 0.2 // 어둠이 머무를 수 있도록 거칠기 낮춤
            // material.color.set('#FFFACD') // 아주 약간 노란끼가 도는 색상 적용 (레몬색)
            // material.roughness = 2 // 거칠기 조정
          }
          // HDR 환경맵만 적용 (있는 경우)
          if (envMapTexture) {
            material.envMap = envMapTexture
            material.envMapIntensity = 1 // 낮은 강도로 설정
          }

          // 재질 업데이트
          material.needsUpdate = true
        }
      }
    })

    // 기타 전체에도 이름 부여
    guitar.name = 'guitar_main'

    scene.add(guitar)

    // 모델 로딩 완료
    isLoading.value = false
  } catch (error) {
    console.error('기타 모델 로딩 실패:', error)
    // 기타 모델이 없을 경우 기본 박스 생성
    isLoading.value = false // 에러가 나도 로딩은 완료로 처리
  }
}

const animate = () => {
  requestAnimationFrame(animate)

  // 기타 살짝씩 까딱까딱하는 애니메이션
  if (guitar) {
    const time = Date.now() * 0.001 // 시간을 초 단위로 변환

    // Y축 회전 (좌우로 살짝씩)
    guitar.rotation.y = Math.sin(time * 0.5) * 0.05 // 0.1 라디안 (약 6도) 범위로 좌우 흔들림

    // Z축 회전 (앞뒤로 살짝씩)
    guitar.rotation.z = Math.sin(time * 0.7) * 0.025 // 0.05 라디안 (약 3도) 범위로 앞뒤 흔들림

    // X축 회전 (위아래로 살짝씩)
    guitar.rotation.x = Math.sin(time * 0.3) * 0.015 // 0.03 라디안 (약 2도) 범위로 위아래 흔들림
  }

  controls.update()
  renderer.render(scene, camera)
}

// 윈도우 리사이즈 처리
const handleResize = () => {
  if (camera && renderer) {
    // 새로운 화면 크기 가져오기
    const newWidth = window.innerWidth
    const newHeight = window.innerHeight
    const newAspectRatio = newWidth / newHeight

    // 카메라 종횡비 업데이트
    camera.aspect = newAspectRatio

    camera.updateProjectionMatrix()

    // 모바일에서는 캔버스 높이가 늘어났으므로 렌더러 크기 조정
    if (newAspectRatio < 1) {
      // 15vw를 픽셀로 변환하여 높이 추가
      const additionalHeight = newWidth * 0.15 // 15vw
      const mobileHeight = newHeight + additionalHeight

      // 카메라 aspect ratio를 실제 렌더러 크기에 맞춤
      camera.aspect = newWidth / mobileHeight

      renderer.setSize(newWidth, mobileHeight)

      // 캔버스 요소의 크기도 직접 업데이트
      if (canvasRef.value) {
        canvasRef.value.style.width = newWidth + 'px'
        canvasRef.value.style.height = mobileHeight + 'px'
      }
    } else {
      // 데스크톱에서는 기본 크기
      camera.aspect = newAspectRatio
      renderer.setSize(newWidth, newHeight)

      // 캔버스 요소의 크기도 직접 업데이트
      if (canvasRef.value) {
        canvasRef.value.style.width = newWidth + 'px'
        canvasRef.value.style.height = newHeight + 'px'
      }
    }

    newAspectRatio < 1
      ? (camera.zoom = 1.2) // 세로가 더 긴 화면에서는 줌을 줄임
      : (camera.zoom = 1.7) // 가로가 더 긴 화면에서는 줌을 늘림
    camera.updateProjectionMatrix()
    renderer.render(scene, camera) // 화면 크기 변경 시 다시 렌더링

    linkBox()
  }
}

window.addEventListener('resize', handleResize)

// Raycaster 설정
const setupRaycaster = () => {
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  // 캔버스에 클릭 이벤트 추가
  canvasRef.value.addEventListener('click', onCanvasClick)
}

// 번개 이벤트 리스너 설정
const setupLightningListeners = () => {
  // 번개 시작 핸들러
  lightningStartHandler = () => {
    // 번개 개수 증가
    activeLightningCount++

    // 첫 번째 번개일 때만 상태 변경
    if (activeLightningCount === 1) {
      isLightningActive = true
      if (controls) {
        // thunderRotate가 true일 때만 모든 컨트롤 비활성화
        if (thunderRotate) {
          controls.enabled = false // 모든 컨트롤 비활성화 (드래그 회전 포함)
        } else {
          // thunderRotate가 false일 때는 아무것도 비활성화하지 않음
        }
      }
    }

    // 번개 종료 타이머
    setTimeout(() => {
      // 번개 개수 감소
      activeLightningCount--

      // 모든 번개가 끝났을 때만 상태 복원
      if (activeLightningCount <= 0) {
        activeLightningCount = 0 // 음수 방지
        isLightningActive = false
        if (controls) {
          // thunderRotate가 true일 때만 컨트롤 재활성화
          if (thunderRotate) {
            controls.enabled = true // 컨트롤 재활성화 (드래그 회전 포함)
          } else {
          }
        }
      }
    }, 2500) // 번개 지속시간(2초) + 여유시간(0.5초)
  }

  // 번개 시작 이벤트 리스너 등록
  window.addEventListener('createLightning', lightningStartHandler)
}

// 마우스 클릭 이벤트 핸들러
const onCanvasClick = (event) => {
  // 캔버스 좌표를 정규화된 좌표 (-1 ~ 1)로 변환
  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // Raycaster 설정
  raycaster.setFromCamera(mouse, camera)

  // 씬의 모든 객체와 교차점 계산
  const intersects = raycaster.intersectObjects(scene.children, true)

  if (intersects.length > 0) {
    // 헬퍼 객체인지 확인하는 함수
    const isHelper = (object) => {
      return (
        object.type === 'DirectionalLightHelper' ||
        object.type === 'PointLightHelper' ||
        object.type === 'GridHelper' ||
        object.type === 'AxesHelper' ||
        object.name.includes('Helper') ||
        object.name.includes('helper')
      )
    }

    // 첫 번째 객체가 헬퍼인 경우 다음 객체 찾기
    let targetObject = intersects[0].object
    let targetIndex = 0

    if (isHelper(targetObject) && intersects.length > 1) {
      // 헬퍼가 아닌 다음 객체 찾기
      for (let i = 1; i < intersects.length; i++) {
        if (!isHelper(intersects[i].object)) {
          targetObject = intersects[i].object
          targetIndex = i
          break
        }
      }
    }

    // Main-PBR 객체를 클릭했을 때 번개 생성 (조건을 더 넓게)
    if (
      targetObject.name === 'Neck_front' ||
      targetObject.name === 'Line' ||
      targetObject.name.includes('guitar') ||
      targetObject.parent?.name === 'guitar_main'
    ) {
      // 번개 개수 제한 확인
      if (activeLightningCount >= maxLightningCount) {
        return targetObject.name || 'unnamed'
      }

      // 부모 컴포넌트에 번개 생성 이벤트 전송
      // 클릭한 화면 좌표를 번개 생성 위치로 사용
      const lightningEvent = new CustomEvent('createLightning', {
        detail: {
          x: event.clientX,
          y: event.clientY,
        },
      })
      window.dispatchEvent(lightningEvent)
    } else {
    }

    // 객체 이름 반환 (콘솔과 함수 반환값 모두)
    return targetObject.name || 'unnamed'
  } else {
    return null
  }
}
</script>

<template>
  <!-- 로딩 화면 -->
  <div v-if="isLoading" class="loading-screen">
    <div class="loading-content">
      <p class="loading-text">Loading...</p>
    </div>
  </div>
  <div v-show="!isLoading" class="mobile">
    <div class="title">
      <img src="/title.png" alt="" />
    </div>
    <div class="texts-mobile">
      <a class="link-box link-box-left" href="https://aespa.lnk.to/RichMan" target="_blank"> </a>
      <img src="/texts-mobile-link.png" alt="" />
      <div class="link-box link-box-right" @click="popupTrigger(25)"></div>
    </div>
  </div>

  <!-- 메인 콘텐츠 -->
  <div v-show="!isLoading" class="guitar-container">
    <canvas ref="canvasRef" class="guitar-canvas"></canvas>
  </div>
  <div class="texts">
    <img src="/texts-link.png" alt="" />
  </div>
  <a
    class="link-box link-box-left link-box--pc"
    href="https://aespa.lnk.to/RichMan"
    target="_blank"
  >
  </a>
  <a class="link-box link-box-right link-box--pc" @click="popupTrigger(25)" target="_blank"> </a>

  <Transition name="fade">
    <ImgPopup v-if="selectedSlide" :slide="selectedSlide" @close="selectedSlide = null" />
  </Transition>
</template>

<style scoped lang="scss">
// 로딩 화면 스타일
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: black;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  font-size: 3vh;
}

.loading-content {
  text-align: center;
  color: #ffffff;
}
</style>
