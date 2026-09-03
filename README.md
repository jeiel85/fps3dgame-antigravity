# 🎮 CYBERSHOCK 3D - Three.js Web FPS Game

> **Three.js**와 **cannon-es** 물리 엔진을 기반으로 구현된 고품질 브라우저 3D FPS 웹 게임입니다.  
> 별도의 설치 없이 웹 브라우저에서 마우스와 키보드로 즉시 플레이할 수 있습니다.

🔗 **라이브 데모 (Live Demo)**: [https://jeiel85.github.io/fps3dgame-antigravity/](https://jeiel85.github.io/fps3dgame-antigravity/)

---

## ✨ 주요 특징 (Features)

1. **실시간 Rigid-Body 3D 물리 엔진 (`cannon-es`)**
   - 중력, 관성, 탄성, 마찰력 적용
   - 물리 인터랙션 오브젝트: 이동 및 사격 충격량(Impulse)으로 밀려나는 화물 상자(Crates)
   - 폭발성 드럼통(Explosive Barrels): 총격 시 폭발하며 반경 내 오브젝트와 봇을 날려버리는 물리 폭풍(Explosion Impulse)
   - 슈퍼 점프대(Jump Pad): 밟으면 수직으로 높이 솟아오르는 물리 부스트

2. **지능형 AI 컴뱃 봇 (Intelligent Bot AI)**
   - 상태 머신 (Patrol -> Alert/Chase -> Attack -> Strafe)
   - 시야각(FOV) 및 장애물 레이캐스팅을 통한 엄폐물 뒤 감지 차단
   - 플라즈마 투사체 사격 (플레이어가 보고 회피 가능)
   - 3D 실시간 체력바 표시 및 피격 넉백/파티클 분해 효과

3. **1인칭 무기 시스템 & 뷰모델 (Viewmodels)**
   - 3가지 무기: **Cyber Pistol** (권총), **Pulse Rifle** (연사 소총), **Scatter Cannon** (샷건)
   - 정조준(ADS - Aim Down Sights) 카메라 FOV 줌인
   - 절차적 무기 밥빙(Bobbing), 반동(Recoil Kick), 총구 화염(Muzzle Flash), 탄피 배출(Shell Ejection)
   - 탄도 빔(Tracer) 및 금속/봇 스파크 이펙트

4. **100% 절차적 사운드 엔진 (Web Audio API)**
   - 외부 오디오 파일 다운로드 없이 브라우저 Web Audio API로 사운드 합성
   - 사격음, 재장전 메커니즘 사운드, 피격 히트마커 핑, 점프대 징, 폭발음, 발소리

5. **사이버펑크 아레나 & HUD**
   - 미니맵 레이더(Radar Canvas), 체력/쉴드 자동 재생 바, 크로스헤어, 히트마커, 피격 인디케이터
   - 웨이브 시스템 및 실시간 스코어보드

---

## 🕹️ 조작법 (Controls)

| 키 (Key) | 기능 (Action) |
| :--- | :--- |
| **W, A, S, D** | 전/후/좌/우 이동 (Move) |
| **Mouse 이동** | 1인칭 시점 회전 (Aim / Look) |
| **마우스 좌클릭** | 무기 발사 (Fire) |
| **마우스 우클릭** | 정조준 줌인 (Aim Down Sights - ADS) |
| **Space** | 점프 (Jump) |
| **Shift** | 전력 질주 (Sprint) |
| **R** | 탄약 재장전 (Reload) |
| **1, 2, 3** / **휠 스크롤** | 무기 교체 (Pistol, Rifle, Shotgun) |

---

## 🛠️ 기술 스택 (Tech Stack)

- **Engine & Graphics**: Three.js
- **Physics**: cannon-es
- **Sound**: Web Audio API Procedural Synth
- **Bundler**: Vite
- **Deployment**: GitHub Pages & GitHub Actions
