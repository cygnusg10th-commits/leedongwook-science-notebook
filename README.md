# raindrop-shape — 사이트 배치 안내

「하늘에서 떨어지는 빗방울은 어떤 모양일까?」 한 편에 필요한 파일 전부입니다.
**폴더째 옮기면 그대로 동작합니다.** 파일명은 전부 ASCII 하이픈 슬러그라 URL 인코딩 문제가 없습니다.

## 놓을 위치

사이트가 `/learn/[슬러그]/` 패턴을 쓰므로 이 폴더를 통째로 넣으면 됩니다.

```
leedongwook-science-notebook/
└── learn/
    └── raindrop-shape/        ← 이 폴더를 그대로
        ├── index.html
        ├── video/ figures/ audio/ script/
```

→ 접속 주소 `…/learn/raindrop-shape/`

물리학 카테고리 목록(`/subjects/physics/`)에 아래 항목을 추가하세요.

```
하늘에서 떨어지는 빗방울은 어떤 모양일까?  →  /learn/raindrop-shape/
```

## 파일 구성

| 경로 | 용량 | 내용 |
|---|---|---|
| `index.html` | 13 KB | **본문 페이지.** 영상 임베드 + 물리 설명 + 도표. 자체 완결(외부 의존 없음) |
| `video/raindrop-shape.mp4` | 8.8 MB | **완성본** 60.8초 · 1080×1920 · H.264 · faststart · −14.6 LUFS |
| `video/raindrop-shape-poster.jpg` | 80 KB | 포스터 프레임 (og:image 겸용) |
| `video/clip-opening.mp4` | 3.5 MB | 오프닝 10초 (무음) |
| `video/clip-hero-drop.mp4` | 1.0 MB | 실사 물방울 히어로컷 6.5초 (무음) |
| `video/clip-oscillation-43hz.mp4` | 0.8 MB | 43 Hz 진동 5초 (무음) |
| `figures/drop-shapes-raytraced.png` | 630 KB | 지름별 실사 형상 비교 |
| `figures/physics-validation.png` | 200 KB | 물리 검증 시트 |
| `figures/refraction-inversion.png` | 220 KB | 굴절상 180° 반전 검증 |
| `figures/sound-layout.png` | 230 KB | 사운드 배치 (본문 미사용, 참고용) |
| `audio/narration.mp3` | 930 KB | 나레이션 스템 (모노 128k) |
| `audio/rain.mp3` | 930 KB | 빗소리 스템 (스테레오 128k) |
| `script/narration-script.html` | 23 KB | 나레이션 작업본 |

**합계 약 17 MB.**

## 기존 템플릿에 넣을 경우

`index.html`을 통째로 쓰지 않고 본문만 옮길 거라면, 영상 임베드는 이 조각만 있으면 됩니다.

```html
<div style="max-width:392px;margin:0 auto">
  <video controls preload="metadata" playsinline
         poster="/learn/raindrop-shape/video/raindrop-shape-poster.jpg"
         style="width:100%;border-radius:14px;background:#000">
    <source src="/learn/raindrop-shape/video/raindrop-shape.mp4" type="video/mp4">
  </video>
</div>
```

- `preload="metadata"` — 페이지 열자마자 8.8 MB를 받지 않습니다. 포스터만 보이고 재생 시 다운로드.
- `playsinline` — iOS에서 전체화면으로 튀지 않게. **빼면 모바일 경험이 나빠집니다.**
- 세로 영상이므로 `max-width`로 폭을 묶어야 데스크톱에서 화면을 다 잡아먹지 않습니다.

## 알아 두면 좋은 것

**저장소가 무거워지는 게 신경 쓰이면** 영상은 YouTube에 올리고 사이트에는 포스터만 두는 방법이 있습니다.
`<video>` 태그 자리에 iframe을 넣으면 됩니다. 다만 지금 크기(17 MB)는 GitHub Pages에서 문제되는 수준은 아닙니다.

**영상은 이미 웹용으로 최적화돼 있습니다.** `faststart` 플래그가 붙어 있어 메타데이터가 파일 앞에 있고,
전체를 받기 전에 재생이 시작됩니다. 재인코딩하면 이 이점이 사라질 수 있으니 그대로 쓰세요.

**용어와 색을 숏츠와 맞춰 뒀습니다.** 본문 페이지는 채널 팔레트(배경 `#10141e`, 네온그린 `#7fd88f`,
핑크 `#e878a8`, 시안 `#5fa8e0`)를 그대로 쓰고, 「축비」·「종횡비」·「등가구 지름」 같은 용어도
영상 자막과 동일합니다. 한쪽만 바꾸면 어긋납니다.

**소리 스템은 본문에서 안 씁니다.** 재편집하거나 다른 편에 재활용할 때를 위해 넣어 뒀습니다.
빗소리는 절차적 합성이라, 실제 녹음이 생기면 `audio/rain.mp3`만 갈아 끼우면 됩니다.
