<template>
  <div id="lightning-container" ref="lightningContainer"></div>
  <!-- 화면 전체 번쩍임 효과 오버레이 -->
  <div
    id="brightness-overlay"
    ref="brightnessOverlay"
    :style="{
      opacity: brightnessOpacity,
      transition: 'opacity 0.1s ease-out',
    }"
  ></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineExpose } from 'vue'
import p5 from 'p5'

const lightningContainer = ref(null)
const brightnessOverlay = ref(null)
const brightnessOpacity = ref(0)
let p5Instance = null
let sketch = null

// 화면 번쩍임 효과 함수
const triggerBrightnessFlash = () => {
  // 즉시 밝게 (초록색 번개 효과)
  brightnessOpacity.value = 0.6

  // 50ms 후 첫 번째 감소
  setTimeout(() => {
    brightnessOpacity.value = 0.35
  }, 50)

  // 120ms 후 두 번째 감소
  setTimeout(() => {
    brightnessOpacity.value = 0.2
  }, 120)

  // 250ms 후 세 번째 감소
  setTimeout(() => {
    brightnessOpacity.value = 0.1
  }, 250)

  // 400ms 후 네 번째 감소
  setTimeout(() => {
    brightnessOpacity.value = 0.05
  }, 400)

  // 700ms 후 완전히 사라짐
  setTimeout(() => {
    brightnessOpacity.value = 0
  }, 700)
} // 외부에서 번개를 생성할 수 있는 함수
const createLightningAt = (x, y) => {
  if (sketch && sketch.createLightning) {
    sketch.createLightning(x, y)
    // 번개 생성과 동시에 화면 번쩍임 효과 트리거
    triggerBrightnessFlash()
  }
}

// 함수를 외부에 노출
defineExpose({
  createLightningAt,
})

onMounted(() => {
  sketch = (p) => {
    let canvasSize
    let center
    let effectSize
    let discharges
    let aspectRatio = window.innerWidth / window.innerHeight
    let maxsteps = aspectRatio < 1 ? 25 : Math.round((window.innerWidth / 1440) * 30)
    let lightningSequences = [] // 번개 시퀀스 관리
    let startPos = true // true: 클릭 위치에서만 생성, false: 랜덤 위치에서 생성

    // 번개 시퀀스 클래스
    function LightningSequence(originX, originY) {
      this.origin = p.createVector(originX, originY)
      this.timers = []
      this.isComplete = false

      // 3-5개의 번개를 시간차를 두고 생성할 타이머 설정
      let lightningCount = p.random(3, 6) // 3~5개 번개
      for (let i = 0; i < lightningCount; i++) {
        let delay = i * p.random(10, 200) // 10~200ms 간격

        // startPos에 따라 생성 위치 결정
        let spawnPos
        if (startPos) {
          // true: 클릭한 위치에서만 생성
          spawnPos = this.origin.copy()
        } else {
          // false: 클릭 위치 주변 랜덤 위치에서 생성
          let randomOffset = p5.Vector.random2D().mult(p.random(5, 25))
          spawnPos = p5.Vector.add(this.origin, randomOffset)
        }

        this.timers.push({
          delay: delay,
          spawnTime: p.millis() + delay,
          position: spawnPos,
          spawned: false,
        })
      }
    }

    LightningSequence.prototype.update = function () {
      let currentTime = p.millis()
      let allSpawned = true

      for (let timer of this.timers) {
        if (!timer.spawned && currentTime >= timer.spawnTime) {
          // 번개 생성
          let direction = p5.Vector.random2D()
          let d = new Discharge(timer.position.copy(), direction, 0.07)
          discharges.push(d)
          timer.spawned = true
        }
        if (!timer.spawned) {
          allSpawned = false
        }
      }

      this.isComplete = allSpawned
    }

    // 외부에서 번개를 생성할 수 있는 함수 추가 (시퀀스로 변경)
    sketch.createLightning = (x, y) => {
      let sequence = new LightningSequence(x, y)
      lightningSequences.push(sequence)
    }

    function Discharge(pos, v0, childrenSpawnProbability, parent = null) {
      this.v0 = v0
      this.pos = [pos.copy()]
      this.children = []
      this.childrenSpawnProbability = childrenSpawnProbability
      this.parent = parent // 부모 번개 참조
      this.isComplete = false // 번개가 완성되었는지 여부
      this.waitStartTime = 0 // 대기 시작 시간
      this.waitDuration = 2000 // 2초 대기 (잔상을 훨씬 더 오래 남기기)
      this.fadeStartDelay = 0.3 // 페이드 시작 지연 (30%)

      this.update = function (stepi) {
        // 번개가 완성되지 않았다면 계속 성장
        if (!this.isComplete) {
          let p0 = this.pos[this.pos.length - 1]

          for (let i = 0; i < stepi; ++i) {
            let angleOffset = p.random(-p.PI / 6, p.PI / 6) // 덜 꺾이게 각도 줄임 (PI/3 → PI/6)
            v0.rotate(angleOffset)
            v0.add(p5.Vector.random2D().mult(0.3)) // 랜덤 요소도 줄임 (0.6 → 0.3)
            v0.normalize()

            let p1 = p5.Vector.add(p0, p5.Vector.mult(v0, 15))
            this.pos.push(p1)
            p0 = p1

            let chSpawnProb =
              this.childrenSpawnProbability * (0.25 + (0.75 * this.pos.length) / maxsteps)
            if (p.random(0.0, 1.0) < chSpawnProb && this.children.length < 3) {
              let d = new Discharge(p0.copy(), p5.Vector.random2D(), chSpawnProb * 0.7, this) // 부모 참조 전달
              this.children.push(d)
            }
          }

          // 번개가 완성되었는지 확인
          if (this.pos.length >= maxsteps || this.isOutOfBounds()) {
            this.isComplete = true
            this.waitStartTime = p.millis() // 대기 시작 시간 기록
          }
        }

        for (let i = 0; i < this.children.length; ++i) {
          this.children[i].update(stepi)
        }
      }

      this.draw = function () {
        for (let i = 1; i < this.pos.length; ++i) {
          let p0 = this.pos[i - 1]
          let p1 = this.pos[i]

          let u = i / this.pos.length // 0 ~ 1 (앞쪽에서 끝쪽까지)

          // 번개 투명도 계산 (잔상 효과 개선) - 부모와 동기화
          let fadeAlpha = 1.0
          let rootParent = this.getRootParent() // 최상위 부모 찾기

          if (rootParent.isComplete) {
            let currentTime = p.millis()
            let timeElapsed = currentTime - rootParent.waitStartTime
            let fadeStartTime = rootParent.waitDuration * rootParent.fadeStartDelay
            if (timeElapsed > fadeStartTime) {
              // 페이드 시작 후 부드럽게 사라짐
              let fadeProgress =
                (timeElapsed - fadeStartTime) /
                (rootParent.waitDuration * (1 - rootParent.fadeStartDelay))
              // 4차 함수를 사용해서 훨씬 부드럽고 오래 지속되는 페이드
              fadeAlpha = Math.max(0, Math.pow(1 - fadeProgress, 4))
            }
          }

          // 번개 굵기 계산 - 시작점은 얇고, 중간에서 두꺼워졌다가 끝으로 갈수록 다시 얇아짐
          let thicknessMultiplier
          if (u < 0.5) {
            // 0 ~ 0.5: 얇은 시작점에서 중간까지 두꺼워짐 (0.3 → 0.6)
            thicknessMultiplier = 0.1 + u * 2 * 0.3 // 0.3 → 0.6
          } else {
            // 0.5 ~ 1: 중간에서 끝까지 다시 얇아짐 (0.6 → 0.2)
            thicknessMultiplier = 0.6 - (u - 0.5) * 2 * 0.4 // 0.6 → 0.2
          }

          // 화면 비율에 따른 두께 조정 (모바일에서 더 얇게)
          let screenRatio = window.innerWidth / window.innerHeight
          let thicknessScale = screenRatio < 1 ? 0.35 : 0.7 // 모바일에서 35% 두께로 조정

          // 색상 계산 - 중심부는 노란색, 바깥쪽은 초록색
          let baseWeight = 3 * thicknessMultiplier * fadeAlpha * thicknessScale

          // 블러 효과를 위한 추가 레이어들 (가장 아래에서부터)
          // 0. 매우 넓은 블러 베이스
          p.strokeWeight(baseWeight * 12)
          p.stroke(140, 60, 40, fadeAlpha * 0.15)
          p.line(p0.x, p0.y, p1.x, p1.y)

          // 1. 가장 바깥쪽 초록 글로우 (가장 두껍게) - 잔상 효과 강화
          p.strokeWeight(baseWeight * 8)
          p.stroke(160, 80, 60, fadeAlpha * 0.3) // 초록색으로 변경
          p.line(p0.x, p0.y, p1.x, p1.y)

          // 2. 중간 글로우 (연두색) - 잔상 효과
          p.strokeWeight(baseWeight * 5)
          p.stroke(120, 70, 80, fadeAlpha * 0.5) // 연두색으로 변경
          p.line(p0.x, p0.y, p1.x, p1.y)

          // 3. 번개 코어 주변 (밝은 연두색) - 잔상 효과
          p.strokeWeight(baseWeight * 3)
          p.stroke(100, 60, 95, fadeAlpha * 0.7) // 밝은 연두색으로 변경
          p.line(p0.x, p0.y, p1.x, p1.y)

          // 4. 번개 코어 (밝은 노란색/흰색)
          p.strokeWeight(baseWeight * 1.5)
          p.stroke(80, 30, 100, fadeAlpha) // 연한 노란색으로 조정
          p.line(p0.x, p0.y, p1.x, p1.y)

          // 5. 색수차 효과 - 초록색 채널 (약간 오프셋) - 잔상 효과
          p.strokeWeight(baseWeight * 0.6)
          p.stroke(140, 70, 80, fadeAlpha * 0.6) // 초록색으로 변경
          p.line(p0.x + 0.8, p0.y, p1.x + 0.8, p1.y)

          // 6. 색수차 효과 - 연두색 채널 (반대 오프셋) - 잔상 효과
          p.strokeWeight(baseWeight * 0.6)
          p.stroke(120, 70, 90, fadeAlpha * 0.6) // 연두색으로 변경
          p.line(p0.x - 0.8, p0.y, p1.x - 0.8, p1.y)

          // 7. 잔상 효과를 위한 추가 레이어 (매우 흐릿하게)
          if (fadeAlpha < 0.9) {
            // 페이드가 시작된 후에만
            p.strokeWeight(baseWeight * 10)
            p.stroke(130, 70, 70, fadeAlpha * 0.25) // 초록색 잔상
            p.line(p0.x, p0.y, p1.x, p1.y)
          }

          // 8. 초장시간 잔상 효과 (매우 약하게)
          if (fadeAlpha < 0.7) {
            p.strokeWeight(baseWeight * 15)
            p.stroke(140, 60, 60, fadeAlpha * 0.18) // 초록색 잔상
            p.line(p0.x, p0.y, p1.x, p1.y)
          }

          // 9. 극장시간 잔상 효과 (극히 약하게)
          if (fadeAlpha < 0.5) {
            p.strokeWeight(baseWeight * 20)
            p.stroke(150, 50, 50, fadeAlpha * 0.12) // 초록색 잔상
            p.line(p0.x, p0.y, p1.x, p1.y)
          }

          // 10. 최종 잔상 효과 (거의 보이지 않게)
          if (fadeAlpha < 0.3) {
            p.strokeWeight(baseWeight * 25)
            p.stroke(160, 40, 40, fadeAlpha * 0.08) // 초록색 잔상
            p.line(p0.x, p0.y, p1.x, p1.y)
          }

          // 11. 색상 변화 잔상 (청록색 계열)
          if (fadeAlpha < 0.8) {
            p.strokeWeight(baseWeight * 8)
            p.stroke(180, 60, 60, fadeAlpha * 0.2) // 청록색 잔상
            p.line(p0.x, p0.y, p1.x, p1.y)
          }

          // 12. 스펙트럼 잔상 (연두색 계열)
          if (fadeAlpha < 0.6) {
            p.strokeWeight(baseWeight * 12)
            p.stroke(110, 50, 50, fadeAlpha * 0.15) // 연두색 잔상
            p.line(p0.x, p0.y, p1.x, p1.y)
          }
        }

        for (let i = 0; i < this.children.length; ++i) {
          this.children[i].draw()
        }
      }

      // 화면 경계를 벗어났는지 확인
      this.isOutOfBounds = function () {
        let last = this.pos[this.pos.length - 1]
        return last.x < 0 || last.x > p.width || last.y < 0 || last.y > p.height
      }

      this.done = function () {
        // 최상위 부모 기준으로 완료 여부 판단
        let rootParent = this.getRootParent()
        if (rootParent.isComplete) {
          let currentTime = p.millis()
          return currentTime - rootParent.waitStartTime > rootParent.waitDuration
        }
        return false
      }

      // 최상위 부모를 찾는 함수
      this.getRootParent = function () {
        let current = this
        while (current.parent) {
          current = current.parent
        }
        return current
      }
    }

    p.setup = function () {
      canvasSize = p.createVector(window.innerWidth, window.innerHeight)
      center = p.createVector(p.width / 2, p.height / 3)
      effectSize = 500
      discharges = []
      lightningSequences = [] // 번개 시퀀스 배열 초기화

      let canvas = p.createCanvas(canvasSize.x, canvasSize.y)
      canvas.parent(lightningContainer.value)

      p.colorMode(p.HSB, 360, 100, 100, 1.0) // 알파 채널 포함
      p.clear() // 투명 배경
      p.smooth() // 블러 효과를 위해 스무딩 활성화
      p.strokeCap(p.SQUARE) // 선분이 자연스럽게 연결되도록
      p.strokeJoin(p.ROUND) // 부드러운 연결점으로 복원
    }

    function drawLightning() {
      p.clear() // 투명 배경 유지

      // 번개 시퀀스 업데이트 및 완료된 시퀀스 제거
      for (let i = lightningSequences.length - 1; i >= 0; i--) {
        lightningSequences[i].update()
        if (lightningSequences[i].isComplete) {
          lightningSequences.splice(i, 1)
        }
      }

      // 완료된 번개 제거
      discharges = discharges.filter((d) => !d.done())

      // 블렌드 모드 설정으로 글로우 효과 향상
      p.blendMode(p.ADD)

      for (let i = 0; i < discharges.length; ++i) {
        // 번개가 완성되지 않았으면 빠르게 그리기, 완성되었으면 정지
        let updateSpeed = discharges[i].isComplete ? 0 : Math.random() * 1 + 1.5 // 더 빠른 그리기 속도
        discharges[i].update(updateSpeed)
        discharges[i].draw()
      }

      // 블렌드 모드 리셋
      p.blendMode(p.BLEND)
    }

    p.draw = function () {
      drawLightning()
    }

    // ⚡️ mousePress 이벤트 제거 - Three.js 컨트롤을 방해하지 않도록
    // p.mousePressed = function () {
    //   if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
    //     let origin = p.createVector(p.mouseX, p.mouseY)
    //     let d = new Discharge(origin, p5.Vector.random2D(), 0.07)
    //     discharges.push(d)
    //   }
    // }

    // 윈도우 리사이즈 처리
    p.windowResized = function () {
      p.resizeCanvas(window.innerWidth, window.innerHeight)
      // 화면 크기 변경에 따라 maxsteps도 업데이트
      maxsteps = aspectRatio < 1 ? 25 : Math.round((window.innerWidth / 1440) * 30)
    }
  }

  p5Instance = new p5(sketch)
})

onUnmounted(() => {
  if (p5Instance) {
    p5Instance.remove()
  }
})
</script>

<style scoped>
#lightning-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

#brightness-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle,
    rgba(150, 255, 150, 1) 0%,
    rgba(100, 255, 200, 0.8) 30%,
    rgba(50, 200, 150, 0.6) 60%,
    rgba(255, 255, 255, 0.4) 100%
  );
  pointer-events: none;
  z-index: 999;
  opacity: 0;
}
</style>
