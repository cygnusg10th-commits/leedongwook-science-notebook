(function () {
  'use strict';

  const M = window.FelEuvModel;
  if (!M) return;

  const overview = document.getElementById('felOverview');
  const detail = document.getElementById('felDetail');
  if (!overview || !detail) return;

  // ── 색 규약 ───────────────────────────────────────────────
  const C = {
    bg: '#0f1420',
    pipe: '#2a3145',
    device: '#7a7f95',
    devDark: '#4c5468',
    cyan: '#5fa8e0',      // 흩어진 전자 · 낮은 에너지
    pink: '#e878a8',      // 줄 선 전자 · 높은 에너지
    violet: '#b39ddb',    // 빛 · EUV
    green: '#7fd88f',     // 강조
    text: '#c8ccd8',
    muted: '#7a7f95',
    dim: '#3a4257',
  };
  const FONT = '"Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

  const OW = 1020;
  const OH = 420;
  const DW = 660;
  const DH = 360;

  // ── 구간 정의 ─────────────────────────────────────────────
  const ZONES = [
    { id: 1, name: '광음극 전자총', en: 'Photoinjector', role: '전자 다발을 만든다' },
    { id: 2, name: '초전도 가속관', en: 'SRF Linac', role: '에너지를 쌓는다' },
    { id: 3, name: '번치 압축기', en: 'Bunch Compressor', role: '다발을 짧게 만든다' },
    { id: 4, name: '언듈레이터', en: 'Undulator', role: '빛을 만들고 줄 세운다' },
    { id: 5, name: '에너지 회수', en: 'Energy Recovery', role: '전기를 되돌려 받는다' },
    { id: 6, name: '빔 분배', en: 'Beam Distribution', role: '스캐너로 나눠 보낸다' },
  ];

  const state = {
    zone: 4,
    energyMeV: 660,
    periodCm: 3.0,
    fieldT: 0.357,
    compression: 20,
    repRateMHz: 10,
    recovery: true,
    t: 0,
    zoneT: 0,
  };

  let out = M.solve(state);

  // ── 캔버스 도우미 ─────────────────────────────────────────
  function fit(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || w;
    const scale = cssW / w;
    const pxW = Math.round(w * scale * dpr);
    const pxH = Math.round(h * scale * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    canvas.style.height = `${h * scale}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  function label(ctx, text, x, y, { size = 12, color = C.muted, align = 'center', weight = 400 } = {}) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function glowDot(ctx, x, y, r, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function mixColor(a, b, f) {
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = hex(a);
    const [r2, g2, b2] = hex(b);
    const k = Math.min(1, Math.max(0, f));
    return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(g1 + (g2 - g1) * k)},${Math.round(b1 + (b2 - b1) * k)})`;
  }

  function arrow(ctx, x, y, dir, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dir * size, y);
    ctx.lineTo(x - dir * size * 0.6, y - size * 0.62);
    ctx.lineTo(x - dir * size * 0.6, y + size * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════
  //  전체 장치 뷰
  // ══════════════════════════════════════════════════════════
  const LINE_Y = 190;
  const RET_Y = 340;
  const SPAN = {
    1: [60, 175],
    2: [185, 430],
    3: [440, 560],
    4: [570, 820],
  };
  const FAN_X = 900;
  const SCAN_X = 962;

  function beamColorAt(x) {
    if (x < SPAN[2][0]) return C.cyan;
    if (x > SPAN[4][0]) return C.pink;
    return C.cyan;
  }

  function pathPoint(p) {
    // p ∈ [0,1) 한 바퀴
    if (p < 0.60) {
      const x = 70 + ((820 - 70) * p) / 0.60;
      let y = LINE_Y;
      if (x > SPAN[4][0] && x < SPAN[4][1]) {
        const k = (x - SPAN[4][0]) / (state.periodCm * 1.2);
        y += Math.sin(k * 1.35) * 9;
      } else if (x > SPAN[3][0] && x < SPAN[3][1]) {
        const u = (x - SPAN[3][0]) / (SPAN[3][1] - SPAN[3][0]);
        y -= Math.sin(u * Math.PI) * 16;
      }
      return { x, y, leg: 'main' };
    }
    if (p < 0.68) {
      const u = (p - 0.60) / 0.08;
      return { x: quad(824, 878, 878, u), y: quad(LINE_Y, LINE_Y + 40, 268, u), leg: 'arc' };
    }
    if (p < 0.74) {
      const u = (p - 0.68) / 0.06;
      return { x: quad(878, 878, 806, u), y: quad(268, RET_Y, RET_Y, u), leg: 'arc' };
    }
    if (p < 0.92) {
      const u = (p - 0.74) / 0.18;
      return { x: 806 - (806 - 226) * u, y: RET_Y, leg: 'return' };
    }
    if (p < 0.97) {
      const u = (p - 0.92) / 0.05;
      return { x: quad(226, 146, 146, u), y: quad(RET_Y, RET_Y, 262, u), leg: 'arc' };
    }
    const u = (p - 0.97) / 0.03;
    return { x: quad(146, 146, 196, u), y: quad(262, LINE_Y, LINE_Y, u), leg: 'arc' };
  }

  function quad(a, b, c, t) {
    const s = 1 - t;
    return s * s * a + 2 * s * t * b + t * t * c;
  }

  function drawPipes(ctx) {
    ctx.save();
    ctx.strokeStyle = C.pipe;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(70, LINE_Y);
    ctx.lineTo(824, LINE_Y);
    ctx.stroke();

    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(824, LINE_Y);
    ctx.quadraticCurveTo(878, LINE_Y + 40, 878, 268);
    ctx.quadraticCurveTo(878, RET_Y, 806, RET_Y);
    ctx.lineTo(226, RET_Y);
    ctx.quadraticCurveTo(146, RET_Y, 146, 262);
    ctx.quadraticCurveTo(146, LINE_Y, 196, LINE_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawGun(ctx, t) {
    const [x0, x1] = SPAN[1];
    ctx.save();
    // 레이저
    const lp = (t * 0.55) % 1;
    ctx.strokeStyle = 'rgba(179,157,219,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + 4, LINE_Y - 42);
    ctx.lineTo(x0 + 40, LINE_Y - 4);
    ctx.stroke();
    const px = x0 + 4 + 36 * lp;
    const py = LINE_Y - 42 + 38 * lp;
    glowDot(ctx, px, py, 3, C.violet, 0.9);
    label(ctx, '레이저', x0 + 2, LINE_Y - 54, { size: 11, align: 'left', color: C.violet });

    // 광음극 + 전자총 공동
    ctx.fillStyle = C.devDark;
    roundRect(ctx, x0 + 34, LINE_Y - 21, 12, 42, 3);
    ctx.fill();
    ctx.fillStyle = C.device;
    for (let i = 0; i < 2; i += 1) {
      roundRect(ctx, x0 + 54 + i * 30, LINE_Y - 17, 24, 34, 8);
      ctx.fill();
    }
    ctx.restore();
    label(ctx, '전자총', (x0 + x1) / 2 + 6, LINE_Y + 34, { size: 12 });
  }

  function drawLinac(ctx) {
    const [x0, x1] = SPAN[2];
    ctx.save();
    ctx.fillStyle = C.device;
    const cells = 7;
    const w = (x1 - x0 - 10) / cells;
    for (let i = 0; i < cells; i += 1) {
      ctx.beginPath();
      ctx.ellipse(x0 + 6 + w * (i + 0.5), LINE_Y, w * 0.44, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(122,127,149,.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + 2, LINE_Y - 30, x1 - x0, 60);
    ctx.restore();
    label(ctx, '초전도 가속관', (x0 + x1) / 2, LINE_Y + 44, { size: 12 });
  }

  function drawChicane(ctx) {
    const [x0, x1] = SPAN[3];
    ctx.save();
    ctx.strokeStyle = 'rgba(95,168,224,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i += 1) {
      const u = i / 40;
      const x = x0 + (x1 - x0) * u;
      const y = LINE_Y - Math.sin(u * Math.PI) * 16;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = C.device;
    [0.06, 0.32, 0.68, 0.94].forEach(u => {
      const x = x0 + (x1 - x0) * u;
      const y = LINE_Y - Math.sin(u * Math.PI) * 16;
      roundRect(ctx, x - 7, y - 12, 14, 24, 3);
      ctx.fill();
    });
    ctx.restore();
    label(ctx, '번치 압축기', (x0 + x1) / 2, LINE_Y + 40, { size: 12 });
  }

  function drawUndulator(ctx) {
    const [x0, x1] = SPAN[4];
    const period = 26;
    const n = Math.floor((x1 - x0) / period);
    ctx.save();
    for (let i = 0; i < n; i += 1) {
      const x = x0 + i * period + 3;
      const up = i % 2 === 0;
      ctx.fillStyle = up ? C.device : C.devDark;
      roundRect(ctx, x, LINE_Y - 34, period - 6, 15, 3);
      ctx.fill();
      ctx.fillStyle = up ? C.devDark : C.device;
      roundRect(ctx, x, LINE_Y + 19, period - 6, 15, 3);
      ctx.fill();
    }
    ctx.restore();
    label(ctx, '언듈레이터', (x0 + x1) / 2, LINE_Y + 50, { size: 12 });
  }

  function drawDump(ctx) {
    ctx.save();
    ctx.strokeStyle = C.pipe;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(516, RET_Y);
    ctx.lineTo(516, RET_Y + 38);
    ctx.stroke();
    ctx.fillStyle = C.devDark;
    roundRect(ctx, 492, RET_Y + 36, 48, 20, 5);
    ctx.fill();
    ctx.restore();
    label(ctx, '빔 덤프', 516, RET_Y + 66, { size: 11 });
    label(ctx, '에너지 회수 구간 — 돌아온 전자가 가속관에 에너지를 반납합니다', 500, RET_Y - 22, { size: 12, color: state.recovery ? C.green : C.muted });
  }

  function drawEuvAndScanners(ctx, t) {
    const n = Math.max(1, Math.min(out.scanners, 12));
    ctx.save();
    // 언듈레이터 끝 → 분배점
    const grad = ctx.createLinearGradient(820, LINE_Y, FAN_X, LINE_Y);
    grad.addColorStop(0, 'rgba(179,157,219,0)');
    grad.addColorStop(0.25, 'rgba(179,157,219,.85)');
    grad.addColorStop(1, 'rgba(179,157,219,.85)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(806, LINE_Y);
    ctx.lineTo(FAN_X, LINE_Y);
    ctx.stroke();

    const top = 44;
    const bottom = 336;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(179,157,219,.5)';
    for (let i = 0; i < n; i += 1) {
      const y = n === 1 ? LINE_Y : top + ((bottom - top) * i) / (n - 1);
      ctx.beginPath();
      ctx.moveTo(FAN_X, LINE_Y);
      ctx.lineTo(SCAN_X - 4, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(179,157,219,.16)';
      ctx.strokeStyle = C.violet;
      roundRect(ctx, SCAN_X, y - 7, 34, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(179,157,219,.5)';
    }
    // 광자
    for (let i = 0; i < 6; i += 1) {
      const p = ((t * 0.9 + i / 6) % 1);
      glowDot(ctx, 806 + (FAN_X - 806) * p, LINE_Y, 2.4, C.violet, 0.8);
    }
    ctx.restore();
    label(ctx, `노광기 ${out.scanners}대`, SCAN_X + 17, 372, { size: 12, color: C.violet });
    if (out.scanners > 12) label(ctx, '(12대까지만 그림)', SCAN_X + 17, 390, { size: 10, color: C.muted });
    label(ctx, `EUV ${out.wavelengthNm.toFixed(1)} nm`, 858, LINE_Y - 22, { size: 12, color: C.violet });
  }

  function drawBunches(ctx, t) {
    const count = 7;
    for (let i = 0; i < count; i += 1) {
      const p = (t * 0.11 + i / count) % 1;
      const pt = pathPoint(p);
      const energyFrac = pt.leg === 'main'
        ? Math.min(1, Math.max(0, (pt.x - SPAN[2][0]) / (SPAN[2][1] - SPAN[2][0])))
        : 1;
      let color = C.cyan;
      let alpha = 0.5 + 0.5 * energyFrac;
      let r = 3.4;
      if (pt.leg === 'main' && pt.x > SPAN[4][0]) { color = C.pink; r = 3.8; }
      if (pt.leg === 'return' || pt.leg === 'arc') {
        if (p > 0.6) {
          const spent = state.recovery ? Math.min(1, (p - 0.6) / 0.3) : 0;
          color = C.cyan;
          alpha = 0.85 - 0.5 * spent;
          r = 3.4 - 1.1 * spent;
        }
      }
      // 점 하나 = 전자 다발 하나. 어느 구간에서도 개수를 바꾸지 않습니다.
      glowDot(ctx, pt.x, pt.y, r, color, alpha);
    }
    label(ctx, '● 하나 = 전자 다발 하나 · 전자 수는 처음부터 끝까지 그대로입니다',
      20, OH - 12, { size: 11, align: 'left' });
  }

  function drawZoneHighlight(ctx) {
    const z = state.zone;
    ctx.save();
    ctx.strokeStyle = 'rgba(127,216,143,.75)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.6;
    let box = null;
    if (SPAN[z]) box = [SPAN[z][0] - 8, LINE_Y - 56, SPAN[z][1] - SPAN[z][0] + 16, 112];
    if (z === 5) box = [130, RET_Y - 44, 764, 116];
    if (z === 6) box = [828, 30, 180, 320];
    if (box) {
      roundRect(ctx, box[0], box[1], box[2], box[3], 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverview(ctx, t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, OW, OH);
    drawPipes(ctx);
    drawGun(ctx, t);
    drawLinac(ctx);
    drawChicane(ctx);
    drawUndulator(ctx);
    drawDump(ctx);
    drawEuvAndScanners(ctx, t);
    drawBunches(ctx, t);
    drawZoneHighlight(ctx);

    // 구간 번호
    const marks = [
      [1, (SPAN[1][0] + SPAN[1][1]) / 2 + 6, LINE_Y - 62],
      [2, (SPAN[2][0] + SPAN[2][1]) / 2, LINE_Y - 62],
      [3, (SPAN[3][0] + SPAN[3][1]) / 2, LINE_Y - 62],
      [4, (SPAN[4][0] + SPAN[4][1]) / 2, LINE_Y - 62],
      [5, 500, RET_Y - 44],
      [6, 918, 22],
    ];
    marks.forEach(([id, x, y]) => {
      ctx.save();
      ctx.fillStyle = id === state.zone ? C.green : C.dim;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      label(ctx, String(id), x, y + 0.5, { size: 12, weight: 700, color: id === state.zone ? C.bg : C.text });
    });
  }

  // ══════════════════════════════════════════════════════════
  //  구간별 확대 뷰
  // ══════════════════════════════════════════════════════════
  function frame(ctx, title) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, DW, DH);
    label(ctx, title, 18, 20, { size: 12, align: 'left', color: C.muted });
  }

  function detail1(ctx, t) {
    frame(ctx, '① 레이저가 금속판을 때리면 전자가 튀어나옵니다');
    const cyc = (t * 0.45) % 1;
    const cathX = 190;

    ctx.save();
    ctx.strokeStyle = 'rgba(179,157,219,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 78);
    ctx.lineTo(cathX - 8, 150);
    ctx.stroke();
    ctx.restore();

    const lp = Math.min(1, cyc / 0.35);
    if (cyc < 0.36) {
      glowDot(ctx, 40 + (cathX - 48) * lp, 78 + 72 * lp, 5, C.violet, 1);
    }
    label(ctx, '레이저 펄스', 44, 62, { size: 12, align: 'left', color: C.violet });

    // 광음극
    ctx.save();
    ctx.fillStyle = C.devDark;
    roundRect(ctx, cathX - 10, 98, 14, 104, 3);
    ctx.fill();
    ctx.restore();
    label(ctx, '광음극', cathX - 3, 218, { size: 12 });

    // 가속 공동
    ctx.save();
    ctx.fillStyle = C.device;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cathX + 60 + i * 62, 150, 26, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    label(ctx, '전자총 공동 (RF)', cathX + 122, 218, { size: 12 });

    // 전자
    if (cyc > 0.3) {
      const u = (cyc - 0.3) / 0.7;
      const spread = 26 * (1 - u * 0.72);
      const x = cathX + 8 + (DW - 120 - cathX) * u;
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        glowDot(ctx, x + Math.cos(a) * spread * 0.5, 150 + Math.sin(a) * spread, 2.4, C.cyan, 0.9);
      }
      glowDot(ctx, x, 150, 2.6, C.cyan, 1);
    }
    arrow(ctx, DW - 74, 150, 1, 9, C.cyan);
    label(ctx, '전자 다발', DW - 96, 128, { size: 12, color: C.cyan });
    label(ctx, '한 다발 100 pC · 초당 1000만 발', DW - 20, DH - 24, { size: 12, align: 'right', color: C.text });
  }

  function detail2(ctx, t) {
    frame(ctx, '② 전자는 전기장의 파도를 탑니다');
    const y0 = 132;
    const amp = 42;
    const phase = t * 2.2;

    ctx.save();
    ctx.strokeStyle = 'rgba(122,127,149,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, y0);
    ctx.lineTo(DW - 150, y0);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(95,168,224,.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let x = 30; x <= DW - 150; x += 2) {
      const y = y0 - Math.sin((x / 62) - phase) * amp;
      if (x === 30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 마루 앞면을 타는 전자
    const surfX = 30 + ((phase * 62 + 96) % (DW - 210));
    const surfY = y0 - Math.sin((surfX / 62) - phase) * amp;
    glowDot(ctx, surfX, surfY, 4.4, C.pink, 1);
    label(ctx, '전자', surfX, surfY - 24, { size: 12, color: C.pink });
    label(ctx, '전기장 파도', 34, 44, { size: 12, align: 'left', color: C.cyan });

    // 게이지
    const gx = DW - 128;
    const climb = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.7));
    const gamma = M.lorentzGamma(80 + (state.energyMeV - 80) * climb);
    const oneMinus = M.oneMinusBeta(gamma);
    const gauges = [
      ['에너지', Math.min(1, gamma / M.lorentzGamma(1500)), C.pink, `${Math.round(gamma * M.ELECTRON_REST_MEV)} MeV`],
      ['속도', 1 - Math.min(0.32, Math.sqrt(oneMinus) * 12), C.cyan, `${(100 - oneMinus * 100).toFixed(5)} %c`],
    ];
    gauges.forEach(([name, frac, color, txt], i) => {
      const y = 74 + i * 74;
      label(ctx, name, gx, y - 14, { size: 12, align: 'left' });
      ctx.save();
      ctx.fillStyle = C.dim;
      roundRect(ctx, gx, y, 104, 13, 7);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, gx, y, Math.max(6, 104 * frac), 13, 7);
      ctx.fill();
      ctx.restore();
      label(ctx, txt, gx, y + 30, { size: 12, align: 'left', color: C.text });
    });
    label(ctx, '에너지는 계속 오르지만 속도는 빛의 속도 앞에서 멈춰 섭니다', DW / 2, DH - 24, { size: 12, color: C.text });
  }

  function detail3(ctx, t) {
    frame(ctx, '③ 기울기를 준 다음, 뒤가 앞을 따라잡게 합니다');
    const cyc = (t * 0.3) % 1;
    // 두 판 모두 가로축은 실제 위치입니다. 빔은 오른쪽으로 달리므로 오른쪽이 머리입니다.

    // ══ 윗판 — 왜 꼬리의 에너지가 더 높은가 ══════════════
    const fy = 92;                 // 전기장 곡선의 중심
    const fx0 = 56;
    const fx1 = 330;
    const field = x => Math.cos((x - fx0) / 58);
    ctx.save();
    ctx.strokeStyle = 'rgba(95,168,224,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = fx0; x <= fx1; x += 2) {
      const y = fy - field(x) * 26;
      if (x === fx0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    label(ctx, '가속 전기장', fx0, fy - 44, { size: 11, align: 'left', color: C.cyan });

    // 다발이 비탈에 걸쳐 있습니다 (오른쪽이 머리)
    const bx0 = 128;
    const bx1 = 214;
    for (let i = 0; i <= 6; i += 1) {
      const f = i / 6;
      const x = bx0 + (bx1 - bx0) * f;
      const strength = (field(x) + 1) / 2;              // 0~1
      glowDot(ctx, x, fy - field(x) * 26, 2.8, mixColor(C.cyan, C.pink, strength), 0.95);
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(122,127,149,.45)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    [[bx0, '꼬리가 받는 전기장'], [bx1, '머리가 받는 전기장']].forEach(([x]) => {
      ctx.beginPath();
      ctx.moveTo(x, fy - field(x) * 26);
      ctx.lineTo(fx1 + 26, fy - field(x) * 26);
      ctx.stroke();
    });
    ctx.restore();
    label(ctx, '꼬리 — 더 센 곳', fx1 + 32, fy - field(bx0) * 26, { size: 11, align: 'left', color: C.pink });
    label(ctx, '머리 — 더 약한 곳', fx1 + 32, fy - field(bx1) * 26, { size: 11, align: 'left', color: C.cyan });
    label(ctx, '꼬리', bx0, fy - field(bx0) * 26 - 22, { size: 11, color: C.pink });
    label(ctx, '머리', bx1, fy - field(bx1) * 26 + 22, { size: 11, color: C.cyan });
    arrow(ctx, 250, fy + 34, 1, 7, C.muted);
    label(ctx, '진행 방향', 262, fy + 34, { size: 11, align: 'left' });
    label(ctx, '다발을 전기장의 비탈에 걸치면 꼬리가 더 세게 밀립니다 (차이는 실제로 약 1 %)',
      DW / 2, 158, { size: 11 });

    ctx.save();
    ctx.strokeStyle = C.line || 'rgba(122,127,149,.25)';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(36, 176); ctx.lineTo(DW - 36, 176);
    ctx.stroke();
    ctx.restore();

    // ══ 아랫판 — 시케인 ═══════════════════════════════
    const x0 = 190;
    const x1 = 470;
    const yBase = 268;
    const ampLow = 40;
    const ampHigh = 18;
    const yOf = (u, amp) => yBase - Math.sin(u * Math.PI) * amp;

    ctx.save();
    ctx.strokeStyle = C.pipe;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(34, yBase); ctx.lineTo(x0, yBase);
    ctx.moveTo(x1, yBase); ctx.lineTo(DW - 34, yBase);
    ctx.stroke();
    ctx.restore();

    const paths = [
      { amp: ampLow, color: C.cyan, lag: 0 },      // 머리 · 에너지 낮음
      { amp: ampHigh, color: C.pink, lag: 0.1 },   // 꼬리 · 에너지 높음
    ];
    paths.forEach(pp => {
      ctx.save();
      ctx.strokeStyle = pp.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 70; i += 1) {
        const u = i / 70;
        const x = x0 + (x1 - x0) * u;
        const y = yOf(u, pp.amp);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });

    ctx.save();
    ctx.fillStyle = C.device;
    [0.1, 0.36, 0.64, 0.9].forEach(u => {
      const x = x0 + (x1 - x0) * u;
      const top = yOf(u, ampLow) - 13;
      const bottom = yOf(u, ampHigh) + 13;
      roundRect(ctx, x - 7, top, 14, bottom - top, 4);
      ctx.fill();
    });
    ctx.restore();
    label(ctx, '쌍극자 자석 네 개', (x0 + x1) / 2, yBase + 34, { size: 11 });

    // 입구 다발 — 에너지 기울기를 색으로 (왼쪽 꼬리 분홍, 오른쪽 머리 시안)
    const inLen = 74;
    const outLen = Math.max(5, inLen / state.compression);
    for (let i = 0; i <= 10; i += 1) {
      const f = i / 10;
      glowDot(ctx, 44 + f * inLen, yBase, 2.2, mixColor(C.pink, C.cyan, f), 0.9);
      glowDot(ctx, x1 + 70 + f * outLen, yBase, 2.2, mixColor(C.pink, C.cyan, f), 0.9);
    }
    label(ctx, '4 ps', 44 + inLen / 2, yBase + 22, { size: 11, color: C.text });
    label(ctx, '꼬리', 44, yBase - 18, { size: 11, color: C.pink });
    label(ctx, '머리', 44 + inLen, yBase - 18, { size: 11, color: C.cyan });
    label(ctx, `${out.bunchLengthFs.toFixed(0)} fs`, x1 + 70 + outLen / 2 + 16, yBase + 22, { size: 11, color: C.text });

    paths.forEach(pp => {
      if (cyc < pp.lag) return;
      const u = Math.min(1, (cyc - pp.lag) / 0.74);
      glowDot(ctx, x0 + (x1 - x0) * u, yOf(u, pp.amp), 3.4, pp.color, 1);
    });
    label(ctx, '머리는 에너지가 낮아 크게 휘어 먼 길', (x0 + x1) / 2, yOf(0.5, ampLow) - 20, { size: 11, color: C.cyan });
    label(ctx, '꼬리는 에너지가 높아 덜 휘어 지름길', (x0 + x1) / 2, yOf(0.5, ampHigh) + 20, { size: 11, color: C.pink });
    label(ctx, `전자 수는 그대로, 길이만 ${state.compression}분의 1 — 첨두 전류 ${out.peakCurrentA.toFixed(0)} A`,
      DW / 2, DH - 16, { size: 12, color: C.green });
  }

  function detail4(ctx, t) {
    const CYCLE = 12;
    const c = t % CYCLE;
    const stage = c < 3.4 ? 0 : c < 7.2 ? 1 : 2;
    frame(ctx, [
      '④ 제멋대로 흩어져 있으면 빛이 서로 상쇄됩니다',
      '④ 에너지를 잃은 전자는 느려지고, 얻은 전자는 빨라집니다',
      '④ 파장 간격으로 줄을 서면 밝기가 제곱으로 뜁니다',
    ][stage]);
    const bunching = stage === 0 ? 0 : stage === 1 ? (c - 3.4) / 3.8 : 1;

    const yAxis = 76;
    const x0 = 40;
    const x1 = DW - 40;
    const period = 34;   // 자석 한 칸
    const lam = 30;      // 확대 스트립에서 빛 한 파장

    // ── 언듈레이터 자석 ──
    ctx.save();
    for (let i = 0; x0 + i * period < x1; i += 1) {
      const x = x0 + i * period;
      const nUp = i % 2 === 0;
      ctx.fillStyle = nUp ? C.device : C.devDark;
      roundRect(ctx, x, yAxis - 42, period - 6, 16, 3);
      ctx.fill();
      ctx.fillStyle = nUp ? C.devDark : C.device;
      roundRect(ctx, x, yAxis + 26, period - 6, 16, 3);
      ctx.fill();
      if (i < 2) {
        label(ctx, nUp ? 'N' : 'S', x + 14, yAxis - 34, { size: 10, weight: 700, color: nUp ? C.bg : C.text });
        label(ctx, nUp ? 'S' : 'N', x + 14, yAxis + 34, { size: 10, weight: 700, color: nUp ? C.text : C.bg });
      }
    }
    ctx.restore();

    // ── 굽이치는 궤적과 전자 ──
    ctx.save();
    ctx.strokeStyle = 'rgba(95,168,224,.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 2) {
      const y = yAxis + Math.sin(((x - x0) / period) * Math.PI) * 12;
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 22; i += 1) {
      const x = x0 + ((t * 42 + (i * (x1 - x0)) / 22) % (x1 - x0));
      const y = yAxis + Math.sin(((x - x0) / period) * Math.PI) * 12;
      glowDot(ctx, x, y, 2.1, bunching > 0.6 ? C.pink : C.cyan, 0.5 + 0.4 * bunching);
    }
    label(ctx, '자기장은 방향만 바꿉니다. 방향이 바뀌는 것도 가속이라 빛이 납니다', 246, 140, { size: 11 });

    // ── 확대 스트립: 빛의 파동과 전자 위치 ──
    const sx0 = 40;
    const sx1 = 452;
    const boxTop = 158;
    const boxBot = 330;
    const waveY = 202;
    const dotY = 252;
    const denBase = 310;
    const drift = (t * 26) % lam;

    ctx.save();
    ctx.strokeStyle = 'rgba(122,127,149,.3)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(sx0, boxTop, sx1 - sx0, boxBot - boxTop);
    ctx.restore();
    label(ctx, '가까이서 본 전자 무리 — 다발의 3천분의 1 구간', sx0 + 8, boxTop + 13, { size: 11, align: 'left' });

    // 빛의 파동
    ctx.save();
    ctx.strokeStyle = 'rgba(179,157,219,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = sx0 + 2; x <= sx1 - 2; x += 2) {
      const y = waveY - Math.cos(((x - drift) / lam) * 2 * Math.PI) * 14;
      if (x === sx0 + 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    label(ctx, '빛', sx1 - 10, boxTop + 13, { size: 11, color: C.violet, align: 'right' });

    if (stage === 1) {
      label(ctx, '빛에게 에너지를 준 전자 → 느려져 뒤로', sx0 + 8, dotY - 24,
        { size: 10, align: 'left', color: C.cyan });
      label(ctx, '에너지를 받은 전자 → 빨라져 앞으로', sx1 - 8, dotY - 24,
        { size: 10, align: 'right', color: C.pink });
    }

    // 전자
    const N = 44;
    for (let i = 0; i < N; i += 1) {
      const base = ((i * 9.37 + t * 26) % (sx1 - sx0 - 12));
      const cell = Math.round((base - drift) / lam) * lam + drift;
      const need = cell - base;                       // + 면 앞으로, - 면 뒤로 가야 합니다
      const x = sx0 + 6 + base + need * bunching;
      if (x < sx0 + 4 || x > sx1 - 4) continue;
      const y = dotY + ((i % 3) - 1) * 5;
      // 앞으로 가야 하는 전자 = 에너지를 얻어 빨라진 쪽(분홍)
      // 뒤로 가야 하는 전자 = 에너지를 잃어 느려진 쪽(시안)
      const col = stage === 0 ? C.cyan : need >= 0 ? C.pink : C.cyan;
      glowDot(ctx, x, y, 2.1, col, 0.8);
      if (stage === 1 && Math.abs(need) > lam * 0.12 && i % 2 === 0) {
        arrow(ctx, x + (need > 0 ? 7 : -7), y, need > 0 ? 1 : -1, 4.5,
          need > 0 ? 'rgba(232,120,168,.9)' : 'rgba(95,168,224,.9)');
      }
    }

    // 밀도 곡선
    ctx.save();
    ctx.strokeStyle = bunching > 0.5 ? C.pink : C.cyan;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let x = sx0 + 2; x <= sx1 - 2; x += 2) {
      const d = 1 + bunching * Math.cos(((x - drift) / lam) * 2 * Math.PI);
      const y = denBase - d * 10;
      if (x === sx0 + 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    label(ctx, '전자 밀도', sx0 + 8, boxBot - 10, { size: 11, align: 'left' });
    label(ctx, `줄 간격 = 빛의 파장 ${out.wavelengthNm.toFixed(1)} nm`, sx1 - 10, boxBot - 10, { size: 11, align: 'right', color: C.violet });

    // ── 밝기 막대 ──
    const bx = 500;
    const barTop = 182;
    const barH = 100;
    const bars = [
      ['제멋대로', 0.1, C.cyan, '∝ N'],
      ['줄 섬', 0.1 + 0.9 * Math.pow(bunching, 1.5), C.pink, '∝ N²'],
    ];
    bars.forEach(([name, frac, color, sym], i) => {
      const x = bx + i * 74;
      const h = barH * frac;
      ctx.save();
      ctx.fillStyle = C.dim;
      roundRect(ctx, x, barTop, 52, barH, 5);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, x, barTop + barH - h, 52, h, 5);
      ctx.fill();
      ctx.restore();
      label(ctx, name, x + 26, barTop + barH + 16, { size: 11 });
      label(ctx, sym, x + 26, barTop + barH + 32, { size: 11, color: i === 1 && bunching > 0.6 ? C.green : C.muted });
    });
    label(ctx, '나오는 빛의 밝기', bx + 63, barTop - 18, { size: 11 });
    label(ctx, `번칭 인자 b = ${bunching.toFixed(2)}`, bx + 63, DH - 16, { size: 12, color: bunching > 0.6 ? C.green : C.text });
    label(ctx, '언듈레이터 안에서는 βz = 1 − (1+K²/2)/2γ² — 에너지가 곧 앞뒤 위치입니다',
      sx0 + 4, DH - 16, { size: 10, align: 'left' });
  }

  function detail5(ctx, t) {
    frame(ctx, '⑤ 돌아온 전자가 가속관에 에너지를 반납합니다');
    const y0 = 142;
    const amp = 40;
    const phase = t * 1.6;

    ctx.save();
    ctx.strokeStyle = 'rgba(95,168,224,.45)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = 40; x <= DW - 168; x += 2) {
      const y = y0 - Math.sin((x / 58) - phase) * amp;
      if (x === 40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    const span = DW - 236;
    const clampX = x => Math.min(DW - 200, Math.max(96, x));

    const accX = 40 + ((phase * 58 + 84) % span);
    const accY = y0 - Math.sin((accX / 58) - phase) * amp;
    glowDot(ctx, accX, accY, 4, C.pink, 1);
    label(ctx, '나갈 때 · 마루 앞면에서 가속', clampX(accX), accY - 26, { size: 12, color: C.pink });

    if (state.recovery) {
      const decX = 40 + ((phase * 58 + 84 + span / 2) % span);
      const decY = y0 - Math.sin((decX / 58) - phase + Math.PI) * amp;
      glowDot(ctx, decX, decY, 4, C.cyan, 1);
      label(ctx, '돌아올 때 · 반 파장 밀려 감속', clampX(decX), decY + 28, { size: 12, color: C.cyan });
    }

    // 벽면 전력 — 회수 켰을 때와 껐을 때
    const bx = DW - 168;
    const wallOn = M.wallPowerMW({ beamPowerW: out.beamPowerW, recovery: M.DESIGN.recoveryRatio });
    const wallOff = M.wallPowerMW({ beamPowerW: out.beamPowerW, recovery: 0 });
    const maxV = Math.max(wallOff, 0.5);
    const rows = [
      ['회수 켬', wallOn, C.green, state.recovery],
      ['회수 끔', wallOff, '#e08a5f', !state.recovery],
    ];
    label(ctx, '벽면에서 끌어오는 전력', bx, 56, { size: 12, align: 'left', color: C.text });
    rows.forEach(([name, v, color, active], i) => {
      const y = 84 + i * 62;
      label(ctx, name, bx, y - 12, { size: 12, align: 'left', color: active ? C.text : C.muted });
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.4;
      ctx.fillStyle = C.dim;
      roundRect(ctx, bx, y, 134, 14, 7);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, bx, y, Math.max(7, (134 * v) / maxV), 14, 7);
      ctx.fill();
      ctx.restore();
      label(ctx, `${v.toFixed(2)} MW`, bx, y + 32, { size: 12, align: 'left', color: active ? C.text : C.muted });
    });
    label(ctx, `빔에 실리는 전력은 ${(out.beamPowerW / 1e6).toFixed(2)} MW입니다`, 40, DH - 44, { size: 12, align: 'left' });
    label(ctx,
      state.recovery
        ? '한 번 만든 에너지를 다음 다발이 물려받습니다'
        : '회수를 끄면 빔 전력을 매번 새로 만들어야 합니다',
      40, DH - 22, { size: 13, align: 'left', color: state.recovery ? C.green : '#e08a5f' });
  }

  function detail6(ctx, t) {
    frame(ctx, '⑥ 광원 하나가 노광기 여러 대를 먹입니다');
    const n = Math.max(1, Math.min(out.scanners, 14));
    const srcX = 96;
    const srcY = 150;

    ctx.save();
    ctx.fillStyle = 'rgba(179,157,219,.18)';
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 1.6;
    roundRect(ctx, srcX - 44, srcY - 30, 62, 60, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    label(ctx, 'FEL 광원', srcX - 13, srcY + 48, { size: 12, color: C.violet });

    const cols = n > 7 ? 2 : 1;
    const per = Math.ceil(n / cols);
    ctx.save();
    for (let i = 0; i < n; i += 1) {
      const col = Math.floor(i / per);
      const idx = i % per;
      const x = 300 + col * 168;
      const y = per === 1 ? srcY : 52 + ((DH - 104) * idx) / (per - 1);
      ctx.strokeStyle = 'rgba(179,157,219,.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(srcX + 20, srcY);
      ctx.lineTo(x - 4, y);
      ctx.stroke();
      const p = (t * 0.8 + i * 0.13) % 1;
      glowDot(ctx, srcX + 20 + (x - 24 - srcX) * p, srcY + (y - srcY) * p, 2.1, C.violet, 0.75);
      ctx.fillStyle = 'rgba(179,157,219,.14)';
      ctx.strokeStyle = C.violet;
      roundRect(ctx, x, y - 9, 40, 18, 4);
      ctx.fill();
      ctx.stroke();
      if (i === 0) label(ctx, '노광기', x + 20, y - 20, { size: 11, color: C.violet });
    }
    ctx.restore();
    label(ctx, `노광기 ${out.scanners}대 · EUV ${(out.euvW / 1000).toFixed(2)} kW`, DW - 24, DH - 22, { size: 12, align: 'right', color: C.text });
    label(ctx, '거울·마스크·정렬 장치는 여전히 기존 노광기 몫입니다', 24, DH - 22, { size: 12, align: 'left', color: C.muted });
  }

  const DETAIL_DRAW = { 1: detail1, 2: detail2, 3: detail3, 4: detail4, 5: detail5, 6: detail6 };

  // ══════════════════════════════════════════════════════════
  //  설명 텍스트
  // ══════════════════════════════════════════════════════════
  const COPY = {
    1: {
      body: [
        '자외선 레이저 펄스가 금속판(광음극)을 때리면 광전효과로 전자가 튀어나옵니다. 이 전자를 곧바로 강한 고주파 전기장으로 밀어내 <b>한 덩어리의 다발</b>로 만듭니다.',
        '레이저 펄스 하나가 전자 다발 하나입니다. 그래서 레이저를 초당 몇 번 쏘느냐가 곧 광원의 반복률이 되고, 최종 출력을 좌우합니다.',
      ],
      points: [
        ['다발 전하', '한 다발에 100 pC — 전자로 세면 약 6 × 10⁸ 개입니다.'],
        ['왜 레이저인가', '전자가 나오는 시각과 위치를 레이저가 정해 주므로 다발의 모양을 원하는 대로 만들 수 있습니다.'],
      ],
    },
    2: {
      body: [
        '초전도 공동 안에는 마이크로파 전기장이 파도처럼 출렁입니다. 전자는 그 <b>마루의 앞면</b>에 올라타 계속 앞으로 밀립니다. 서핑과 같은 그림입니다.',
        '여기서 흔한 오해가 하나 갈립니다. 전자는 이미 몇 미터 만에 광속의 99.99 %에 도달합니다. 그 뒤로는 아무리 밀어도 <b>속도는 거의 그대로이고 에너지만 쌓입니다.</b> 쌓인 에너지는 γ(로렌츠 인자)로 나타납니다.',
      ],
      points: [
        ['속도의 한계', '660 MeV에서 광속의 99.99997 %입니다. 두 배로 가속해도 소수점 아래 자리만 바뀝니다.'],
        ['왜 초전도인가', '상온 구리 공동은 벽에서 전력을 태워 버립니다. 초전도 공동은 그 손실이 거의 없어 쉬지 않고 켜 둘 수 있습니다.'],
      ],
    },
    3: {
      body: [
        '먼저 <b>왜 뒤쪽 전자의 에너지가 더 높은가</b>부터입니다. 가속관의 전기장 파도에서 다발을 마루의 <b>앞면에 살짝 걸치게</b> 태우면, 같은 다발 안에서도 뒤쪽이 더 센 전기장을 받습니다. 그래서 뒤쪽 전자가 앞쪽보다 조금 높은 에너지를 안고 나옵니다. 이것을 에너지 기울기라고 합니다.',
        '이 상태로 자석 네 개가 만든 갈지자 통로(시케인)에 넣습니다.',
        '자석은 에너지가 낮은 전자를 더 크게 휘게 합니다. 그래서 앞쪽 전자는 먼 길, 뒤쪽 전자는 지름길을 갑니다. 통로를 빠져나올 때쯤 뒤가 앞을 따라잡아 <b>다발이 세로로 압축됩니다.</b>',
        '전하량은 그대로인데 길이만 줄었으니 첨두 전류가 그만큼 뜁니다. FEL의 이득은 이 첨두 전류에 크게 좌우됩니다.',
      ],
      points: [
        ['압축 전후', '4 ps → 200 fs. 전류로는 25 A → 500 A입니다.'],
        ['왜 필요한가', '전류가 낮으면 빛이 자라기 전에 언듈레이터가 끝나 버립니다.'],
        ['전자는 늘지 않습니다', '전하량 100 pC은 그대로입니다. 길이만 줄어서 같은 전자가 더 짧은 시간에 지나가고, 그래서 전류가 뜁니다.'],
      ],
    },
    4: {
      body: [
        'N극과 S극이 번갈아 놓인 자석 사이를 지나면 전자가 뱀처럼 굽이칩니다. <b>자기장은 전자의 속력을 바꾸지 않습니다</b>(일을 하지 않습니다). 바꾸는 것은 방향이고, 방향이 바뀌는 것도 가속입니다. 가속하는 전하는 반드시 빛을 냅니다.',
        '처음에는 전자가 제멋대로 흩어져 있어 각자 낸 빛의 위상이 어긋나고 서로 상쇄됩니다. 그런데 먼저 나간 빛이 뒤따라오는 전자 무리를 덮칩니다. 빛의 마루에 있는 전자는 밀리고 골에 있는 전자는 당겨집니다.',
        '여기서 한 단계가 더 있습니다. 언듈레이터 안에서 전자가 <b>앞으로 나아가는 속도는 에너지에 의존합니다</b>: $\\beta_z = 1-(1+K^2/2)/2\\gamma^2$. 그래서 에너지를 잃은 전자는 느려져 뒤로 처지고, 얻은 전자는 빨라져 앞으로 나갑니다. <b>에너지 차이가 위치 차이로 바뀌는 것</b>이 뭉침의 정체입니다.',
        '그 결과 전자들이 <b>빛의 파장과 똑같은 간격</b>으로 층층이 뭉칩니다. 이것이 마이크로번칭입니다. 같은 층의 전자들은 위상이 맞아 빛이 보강 간섭을 하고, 밝기가 전자 수 N이 아니라 <b>N²</b>로 뜁니다.',
      ],
      points: [
        ['공명 조건', 'λ = (λu / 2γ²)(1 + K²/2). 전자 에너지와 자석 주기가 파장을 정합니다.'],
        ['자기조직화', '누가 줄을 세우는 것이 아닙니다. 자기가 낸 빛이 자기를 줄 세웁니다.'],
        ['두 단계', '① 빛과 에너지를 주고받아 에너지가 갈린다 → ② 언듈레이터 안에서는 에너지가 곧 속도라 앞뒤로 갈라진다. 660 MeV 기준으로 반 파장만큼 밀리는 데 4.4 m가 걸리고, 이것이 포화 길이와 같은 크기입니다.'],
        ['N²의 의미', '전자 10억 개가 줄을 서면 밝기가 10억 배가 아니라 10억의 제곱만큼 뜁니다.'],
        ['동시가 아닙니다', '전자들이 같은 순간에 흔들릴 필요는 없습니다. 한 파장만큼 늦으면 빛의 한 주기만큼 늦는 것이라 마루가 다시 겹칩니다. 아래 「왜 동시에가 아니라 파장 간격일까」에서 확인하세요.'],
      ],
    },
    5: {
      body: [
        '빛을 만들고 난 전자는 여전히 원래 에너지의 대부분을 가지고 있습니다. 그냥 벽에 버리면 그 에너지가 전부 열이 되고, 발전소에서 다시 끌어와야 합니다.',
        '그래서 전자를 한 바퀴 돌려 <b>정확히 반 파장 늦게</b> 같은 가속관으로 되돌려 보냅니다. 이번에는 마루의 뒷면에 올라타므로 전자가 감속되고, 잃은 에너지는 <b>공동의 전자기장으로 되돌아갑니다.</b> 그 에너지가 다음 다발을 가속합니다.',
        '기존 LPP 방식은 주석 방울을 레이저로 때려 플라스마를 만드는데, 콘센트 전력의 0.1 % 남짓만 EUV로 바뀝니다. FEL의 매력은 이 낭비 구조를 통째로 바꾼다는 점입니다.',
      ],
      points: [
        ['회수율', '설계상 90 % 안팎을 되돌려 받는 것을 목표로 합니다.'],
        ['남은 것만 버린다', '회수하고 남은 저에너지 전자만 덤프로 갑니다. 방사화도 그만큼 줄어듭니다.'],
      ],
    },
    6: {
      body: [
        'LPP 광원은 노광기 한 대에 하나씩 붙습니다. FEL은 반대로 <b>큰 광원 하나가 여러 대를 먹입니다.</b> 나온 빛을 거울로 갈라 각 노광기로 보냅니다.',
        '보도된 구상은 광원 하나로 최대 20대까지입니다. 다만 여기에는 큰 단서가 붙습니다. <b>광원만 바뀌는 것이고, 축소 투영 광학계와 마스크, 정렬 장치는 그대로 ASML의 노광기 몫</b>입니다.',
      ],
      points: [
        ['묶어서 얻는 것', '광원 한 대의 고정 소비를 여러 노광기가 나눠 씁니다. 대수가 늘수록 대당 전력이 내려갑니다.'],
        ['묶어서 잃는 것', '광원이 서면 붙어 있는 노광기가 전부 섭니다. 공장 전체의 위험이 한 곳에 몰립니다.'],
      ],
      caution: '아직 아무도 만든 적이 없습니다. 선두 주자인 스타트업 xLight의 시제기 목표가 2028년이고, 머스크가 X에 남긴 것도 확정 발표가 아니라 관심 표명이었습니다.',
    },
  };

  // ══════════════════════════════════════════════════════════
  //  UI 연결
  // ══════════════════════════════════════════════════════════
  const zoneBar = document.getElementById('felZones');
  const detailHead = document.getElementById('felDetailHead');
  const detailBody = document.getElementById('felDetailBody');
  const detailPoints = document.getElementById('felDetailPoints');
  const detailCaution = document.getElementById('felDetailCaution');

  ZONES.forEach(z => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fel-zone';
    btn.setAttribute('aria-pressed', String(z.id === state.zone));
    btn.dataset.zone = String(z.id);
    btn.innerHTML = `<span class="num">${z.id}</span><span class="name">${z.name}</span><span class="role">${z.role}</span>`;
    btn.addEventListener('click', () => selectZone(z.id));
    zoneBar.appendChild(btn);
  });

  function selectZone(id) {
    state.zone = id;
    state.zoneT = 0;
    zoneBar.querySelectorAll('.fel-zone').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.zone) === id));
    });
    const z = ZONES.find(item => item.id === id);
    const copy = COPY[id];
    detailHead.innerHTML = `<h3>${z.id}. ${z.name}</h3><span class="en">${z.en}</span>`;
    detailBody.innerHTML = copy.body.map(p => `<p>${p}</p>`).join('');
    detailPoints.innerHTML = copy.points
      .map(([t, d]) => `<div class="fel-point"><b>${t}</b><span>${d}</span></div>`)
      .join('');
    if (copy.caution) {
      detailCaution.innerHTML = `<b>아직 시제기도 없습니다.</b> ${copy.caution}`;
      detailCaution.hidden = false;
    } else {
      detailCaution.hidden = true;
    }
  }

  overview.addEventListener('click', event => {
    const rect = overview.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * OW;
    const y = ((event.clientY - rect.top) / rect.height) * OH;
    let hit = null;
    [1, 2, 3, 4].forEach(id => {
      if (!hit && x >= SPAN[id][0] - 10 && x <= SPAN[id][1] + 10 && y > 120 && y < 260) hit = id;
    });
    if (!hit && x >= 828 && y < 300) hit = 6;
    if (!hit && y >= 280) hit = 5;
    if (hit) selectZone(hit);
  });

  // ── 조작부 ────────────────────────────────────────────────
  const controls = {
    energy: document.getElementById('felEnergy'),
    period: document.getElementById('felPeriod'),
    field: document.getElementById('felField'),
    compression: document.getElementById('felCompression'),
    rep: document.getElementById('felRep'),
    recovery: document.getElementById('felRecovery'),
  };

  function readControls() {
    state.energyMeV = Number(controls.energy.value);
    state.periodCm = Number(controls.period.value);
    state.fieldT = Number(controls.field.value);
    state.compression = Number(controls.compression.value);
    state.repRateMHz = Number(controls.rep.value);
    state.recovery = controls.recovery.checked;
    out = M.solve(state);
    paintReadout();
    if (typeof readTaper === 'function') readTaper();
  }

  Object.values(controls).forEach(el => {
    if (el) el.addEventListener('input', readControls);
  });

  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = JSON.parse(btn.dataset.preset);
      controls.energy.value = preset.energyMeV;
      controls.period.value = preset.periodCm;
      controls.field.value = preset.fieldT;
      controls.compression.value = preset.compression;
      controls.rep.value = preset.repRateMHz;
      if ('recovery' in preset) controls.recovery.checked = preset.recovery;
      readControls();
    });
  });

  const el = id => document.getElementById(id);

  function paintReadout() {
    el('felEnergyValue').textContent = `${state.energyMeV} MeV`;
    el('felPeriodValue').textContent = `${state.periodCm.toFixed(1)} cm`;
    el('felFieldValue').textContent = `${state.fieldT.toFixed(2)} T`;
    el('felCompressionValue').textContent = `× ${state.compression}`;
    el('felRepValue').textContent = `${state.repRateMHz} MHz`;

    const target = el('felTarget');
    el('felWavelength').textContent = out.wavelengthNm.toFixed(2);
    const off = out.wavelengthOffPercent;
    const pos = Math.min(97, Math.max(3, 50 + off * 1.6));
    el('felMarker').style.left = `${pos}%`;
    target.classList.toggle('hit', out.onTarget);
    target.classList.toggle('miss', !out.onTarget);
    el('felVerdict').textContent = out.onTarget
      ? '노광에 쓸 수 있는 파장입니다'
      : off > 0 ? `13.5 nm보다 ${off.toFixed(1)} % 깁니다 — 에너지를 올리거나 주기를 줄이세요`
        : `13.5 nm보다 ${Math.abs(off).toFixed(1)} % 짧습니다 — 에너지를 내리거나 주기를 늘리세요`;

    el('felGamma').textContent = out.gamma.toFixed(0);
    el('felBeta').textContent = `${(100 - out.oneMinusBeta * 100).toFixed(5)} %`;
    el('felK').textContent = out.K.toFixed(2);
    el('felCurrent').textContent = `${out.peakCurrentA.toFixed(0)} A`;
    el('felBunchLength').textContent = `${out.bunchLengthFs.toFixed(0)} fs`;
    el('felRho').textContent = `${(out.rho * 1000).toFixed(2)} × 10⁻³`;
    el('felGain').textContent = `${out.gainLengthM.toFixed(2)} m`;
    el('felSaturation').textContent = `${out.saturationLengthM.toFixed(0)} m`;
    el('felEuv').textContent = `${(out.euvW / 1000).toFixed(2)} kW`;
    el('felScanners').textContent = `${out.scanners} 대`;
    el('felBeamPower').textContent = `${(out.beamPowerW / 1e6).toFixed(2)} MW`;

    const maxMW = Math.max(out.lppWallMW, out.wallMW, 1);
    el('felBarFel').style.width = `${(out.wallMW / maxMW) * 100}%`;
    el('felBarLpp').style.width = `${(out.lppWallMW / maxMW) * 100}%`;
    el('felWall').textContent = `${out.wallMW.toFixed(2)} MW`;
    el('felLpp').textContent = `${out.lppWallMW.toFixed(1)} MW`;
    el('felRatio').textContent = out.wallMW > 0 ? `${(out.lppWallMW / out.wallMW).toFixed(1)}배` : '—';

    const micron = document.getElementById('felBunchMicron');
    const count = document.getElementById('felLambdaCount');
    if (micron) micron.textContent = (out.bunchLengthFs * 1e-15 * 299792458 * 1e6).toFixed(0);
    if (count) count.textContent = Math.round(out.wavelengthsInBunch).toLocaleString('ko-KR');

    el('felScannerBox').className = out.scanners >= 20 ? 'good' : '';
    el('felSatBox').className = out.saturationLengthM > 60 ? 'warn' : '';
  }

  // ── 애니메이션 루프 ───────────────────────────────────────
  let last = 0;
  let visible = true;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.target === overview) visible = e.isIntersecting; });
    }, { threshold: 0.02 });
    io.observe(overview);
  }

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onScreen(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > -80 && r.top < window.innerHeight + 80;
  }

  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!reduce) state.t += dt;
    if (visible || state.t < 0.2) {
      drawOverview(fit(overview, OW, OH), state.t);
      const fn = DETAIL_DRAW[state.zone];
      if (fn) fn(fit(detail, DW, DH), state.t);
    }
    if (onScreen(slipCanvas)) drawSlip(fit(slipCanvas, SLIP_W, SLIP_H), state.t);
    if (onScreen(pairCanvas)) drawPair(fit(pairCanvas, PAIR_W, PAIR_H), state.t);
    if (onScreen(ladderCanvas)) drawLadder(fit(ladderCanvas, LAD_W, LAD_H), state.t);
    if (onScreen(taperCanvas)) drawTaper(fit(taperCanvas, TAP_W, TAP_H));
    if (onScreen(limitCanvas)) drawLimit(fit(limitCanvas, LIM_W, LIM_H));
    requestAnimationFrame(loop);
  }

  // ══════════════════════════════════════════════════════════
  //  결맞음 설명 — 미끄러짐과 전자 두 개
  // ══════════════════════════════════════════════════════════
  const slipCanvas = document.getElementById('felSlip');
  const pairCanvas = document.getElementById('felPair');
  const gapInput = document.getElementById('felGap');
  const SLIP_W = 660;
  const SLIP_H = 250;
  const PAIR_W = 660;
  const PAIR_H = 360;
  let gap = 1;   // 전자 두 개의 간격 (파장 단위)

  // ── 미끄러짐 ──
  function drawSlip(ctx, t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SLIP_W, SLIP_H);
    const x0 = 76;
    const x1 = 566;
    const yAxis = 112;
    const p = Math.min(1, (t * 0.22) % 1.35);   // 1까지 진행한 뒤 잠시 멈춥니다
    const LAM_PX = 74;                          // 과장해 그린 한 파장

    // 언듈레이터 자석 한 주기 (N-S 한 쌍)
    ctx.save();
    [0, 1].forEach(i => {
      const bx = x0 + i * ((x1 - x0) / 2);
      const w = (x1 - x0) / 2 - 6;
      ctx.fillStyle = i === 0 ? C.device : C.devDark;
      roundRect(ctx, bx, 56, w, 14, 4); ctx.fill();
      ctx.fillStyle = i === 0 ? C.devDark : C.device;
      roundRect(ctx, bx, 154, w, 14, 4); ctx.fill();
      label(ctx, i === 0 ? 'N' : 'S', bx + 14, 63, { size: 10, weight: 700, color: i === 0 ? C.bg : C.text });
      label(ctx, i === 0 ? 'S' : 'N', bx + 14, 161, { size: 10, weight: 700, color: i === 0 ? C.text : C.bg });
    });
    ctx.restore();

    // 한 주기 치수선
    ctx.save();
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, 32); ctx.lineTo(x1, 32);
    ctx.moveTo(x0, 26); ctx.lineTo(x0, 38);
    ctx.moveTo(x1, 26); ctx.lineTo(x1, 38);
    ctx.stroke();
    ctx.restore();
    label(ctx, '언듈레이터 한 주기  λu = 3 cm', (x0 + x1) / 2, 18, { size: 11 });

    // 굽이치는 궤적
    ctx.save();
    ctx.strokeStyle = 'rgba(95,168,224,.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 2) {
      const y = yAxis + Math.sin(((x - x0) / (x1 - x0)) * 2 * Math.PI) * 14;
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 전자와 빛의 선두
    const ex = x0 + (x1 - x0 - LAM_PX) * p;
    const ey = yAxis + Math.sin(((ex - x0) / (x1 - x0)) * 2 * Math.PI) * 14;
    const lx = ex + LAM_PX * p;

    ctx.save();
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, 88); ctx.lineTo(lx, 140);
    ctx.stroke();
    ctx.restore();
    glowDot(ctx, ex, ey, 4, C.cyan, 1);
    label(ctx, '전자', ex, 82, { size: 11, color: C.cyan });
    if (p > 0.28) label(ctx, '빛의 선두', lx + 6, 82, { size: 11, color: C.violet, align: 'left' });

    // 벌어진 간격
    if (p > 0.06) {
      const done = p >= 0.999;
      ctx.save();
      ctx.strokeStyle = done ? C.green : C.muted;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ex, 192); ctx.lineTo(lx, 192);
      ctx.moveTo(ex, 186); ctx.lineTo(ex, 198);
      ctx.moveTo(lx, 186); ctx.lineTo(lx, 198);
      ctx.stroke();
      ctx.restore();
      label(ctx, done ? '정확히 한 파장  λ = 13.5 nm' : '빛이 앞선 거리',
        Math.min(SLIP_W - 90, Math.max(90, (ex + lx) / 2)), 210,
        { size: 12, color: done ? C.green : C.muted });
    }

    label(ctx, '실제 비율은 λ : λu = 1 : 220만입니다. 보이도록 크게 그렸습니다.',
      SLIP_W / 2, SLIP_H - 16, { size: 11 });
  }

  // ── 테이퍼링 ──
  const taperCanvas = document.getElementById('felTaper');
  const TAP_W = 660;
  const TAP_H = 330;
  let taperEta = 0.02;

  function drawTaper(ctx) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, TAP_W, TAP_H);
    const prof = M.taperProfile({ K0: out.K, periodCm: state.periodCm, extraction: taperEta });
    const px0 = 62;
    const px1 = 596;
    const axis = 106;

    // 간극이 벌어지는 자석 — 실제 변화를 20배 과장해 그립니다
    const g0 = prof.points[0].gapMm;
    const gLast = prof.points[prof.points.length - 1].gapMm;
    const gSpan = Number.isFinite(gLast) ? gLast - g0 : g0;
    const halfAt = z => {
      const p = prof.points[Math.round(z * (prof.points.length - 1))];
      const g = Number.isFinite(p.gapMm) ? p.gapMm : g0 * 3;
      // 변화폭이 아무리 작아도 눈에 보이도록 자동으로 늘려 그립니다
      return 14 + (gSpan > 1e-6 ? ((g - g0) / gSpan) * 30 : 0);
    };
    ctx.save();
    const n = 22;
    for (let i = 0; i < n; i += 1) {
      const z = i / n;
      const x = px0 + (px1 - px0) * z;
      const w = (px1 - px0) / n - 4;
      const h = halfAt(z);
      ctx.fillStyle = i % 2 === 0 ? C.device : C.devDark;
      roundRect(ctx, x, axis - h - 15, w, 15, 3);
      ctx.fill();
      ctx.fillStyle = i % 2 === 0 ? C.devDark : C.device;
      roundRect(ctx, x, axis + h, w, 15, 3);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(232,120,168,.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px0, axis);
    ctx.lineTo(px1, axis);
    ctx.stroke();
    ctx.restore();
    label(ctx, '자석 간극이 서서히 벌어집니다 (변화를 크게 그렸습니다)', (px0 + px1) / 2, 26, { size: 11 });
    label(ctx, `${prof.points[0].gapMm.toFixed(1)} mm`, px0 - 6, axis, { size: 10, align: 'right', color: C.text });
    const gEnd = prof.points[prof.points.length - 1].gapMm;
    label(ctx, Number.isFinite(gEnd) ? `${gEnd.toFixed(1)} mm` : '∞', px1 + 6, axis, { size: 10, align: 'left', color: C.text });

    // K(z) 와 γ(z)
    const cy0 = 196;
    const cy1 = 262;
    ctx.save();
    ctx.strokeStyle = C.dim;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(px0, cy0, px1 - px0, cy1 - cy0);
    ctx.restore();
    const K0 = prof.points[0].K || 1;
    // 두 곡선은 위아래 칸을 나눠 쓰고, 각자 변화폭에 맞춰 늘려 그립니다
    const drawCurve = (getter, color, laneTop, laneBottom, name) => {
      const vals = prof.points.map(getter);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const span = hi - lo;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      prof.points.forEach((p, i) => {
        const x = px0 + (px1 - px0) * p.z;
        const f = span > 1e-12 ? (getter(p) - lo) / span : 0.5;
        const y = laneBottom - 5 - f * (laneBottom - laneTop - 10);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
      label(ctx, name, px0 + 6, laneBottom - 7, { size: 10, align: 'left', color });
    };
    const mid = (cy0 + cy1) / 2;
    drawCurve(p => p.K, C.cyan, cy0, mid, '자석 세기 K');
    drawCurve(p => p.gammaRatio, C.pink, mid, cy1, '전자 에너지');
    ctx.save();
    ctx.strokeStyle = C.dim;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(px0, mid); ctx.lineTo(px1, mid); ctx.stroke();
    ctx.restore();
    label(ctx, '세로 눈금은 각 곡선의 변화폭에 맞춰 늘렸습니다', (px0 + px1) / 2, cy1 + 18, { size: 10 });
    label(ctx, `K  ${K0.toFixed(2)} → ${prof.points[prof.points.length - 1].K.toFixed(2)}`,
      px0 + 6, cy0 - 14, { size: 11, align: 'left', color: C.cyan });
    label(ctx, `전자 에너지  100 % → ${((1 - prof.extraction) * 100).toFixed(1)} %`,
      px1 - 6, cy0 - 14, { size: 11, align: 'right', color: C.pink });
    label(ctx, '입구', px0 + 2, cy1 + 18, { size: 10, align: 'left' });
    label(ctx, '출구', px1 - 2, cy1 + 18, { size: 10, align: 'right' });

    label(ctx, `(1 + K²/2) / γ² 을 일정하게 유지 → 공명 파장 ${out.wavelengthNm.toFixed(2)} nm 고정`,
      TAP_W / 2, TAP_H - 18, { size: 12, color: C.green });
  }

  const taperInput = document.getElementById('felTaperEta');

  function readTaper() {
    if (!taperInput) return;
    taperEta = Number(taperInput.value) / 100;
    const prof = M.taperProfile({ K0: out.K, periodCm: state.periodCm, extraction: taperEta });
    const euvW = prof.extraction * out.beamPowerW;
    const plainW = out.rho * out.beamPowerW;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('felTaperEtaValue', `${(prof.extraction * 100).toFixed(2)} %`);
    set('felTaperK', `${out.K.toFixed(2)} → ${prof.points[prof.points.length - 1].K.toFixed(2)}`);
    const gEnd = prof.points[prof.points.length - 1].gapMm;
    set('felTaperGap', Number.isFinite(gEnd)
      ? `${prof.points[0].gapMm.toFixed(1)} → ${gEnd.toFixed(1)} mm` : '한계 초과');
    set('felTaperEuv', `${(euvW / 1000).toFixed(2)} kW`);
    set('felTaperScanners', `${M.scannerCount({ euvW: Math.max(euvW, 1) })} 대`);
    set('felTaperGain', `${(prof.extraction / out.rho).toFixed(1)}배`);
    set('felTaperCap', `${(prof.cap * 100).toFixed(1)} %`);
    set('felTaperPlain', `${(plainW / 1000).toFixed(2)} kW`);
    const box = document.getElementById('felTaperScannerBox');
    if (box) box.className = M.scannerCount({ euvW: Math.max(euvW, 1) }) >= 20 ? 'good' : '';
  }

  if (taperInput) {
    taperInput.addEventListener('input', readTaper);
    readTaper();
  }

  // ── 진동수 사다리 ──
  const ladderCanvas = document.getElementById('felLadder');
  const LAD_W = 660;
  const LAD_H = 250;

  function fmtHz(hz) {
    if (hz >= 1e15) return `${(hz / 1e15).toFixed(1)} PHz`;
    if (hz >= 1e12) return `${(hz / 1e12).toFixed(1)} THz`;
    if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)} GHz`;
    return `${(hz / 1e6).toFixed(1)} MHz`;
  }
  function fmtLen(m) {
    if (m >= 1e-2) return `${(m * 100).toFixed(1)} cm`;
    if (m >= 1e-6) return `${(m * 1e6).toFixed(1)} µm`;
    return `${(m * 1e9).toFixed(2)} nm`;
  }

  function drawLadder(ctx, t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, LAD_W, LAD_H);
    const L = M.frequencyLadder({ periodCm: state.periodCm, gamma: out.gamma, K: out.K });
    const steps = [
      ['실험실에서 전자가 흔들림', L.wiggle, C.cyan, '마이크로파 영역'],
      ['전자가 보는 자석 · 전자가 냄', L.rest, C.pink, '적외선 영역'],
      ['실험실에서 나오는 빛', L.lab, C.violet, 'EUV 영역'],
    ];
    const bw = 170;
    const bh = 82;
    const by = 66;
    steps.forEach(([name, v, color, band], i) => {
      const x = 10 + i * 222;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.6;
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      roundRect(ctx, x, by, bw, bh, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      label(ctx, `${i + 1}`, x + 8, by - 12, { size: 12, weight: 700, color, align: 'left' });
      label(ctx, name, x + 24, by - 12, { size: 11, align: 'left' });
      label(ctx, fmtHz(v.hz), x + bw / 2, by + 30, { size: 19, weight: 700, color });
      label(ctx, `파장 ${fmtLen(v.wavelengthM)}`, x + bw / 2, by + 56, { size: 12, color: C.text });
      label(ctx, band, x + bw / 2, by + 72, { size: 10 });
    });

    // 곱하기 화살표
    const arrows = [
      [`× ${L.contractionFactor.toFixed(0)}`, '길이 수축', 206],
      [`× ${L.dopplerFactor.toFixed(0)}`, '도플러', 428],
    ];
    arrows.forEach(([mul, why, cx]) => {
      ctx.save();
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 12, by + bh / 2);
      ctx.lineTo(cx + 8, by + bh / 2);
      ctx.stroke();
      ctx.restore();
      arrow(ctx, cx + 12, by + bh / 2, 1, 6, C.green);
      label(ctx, mul, cx, by + bh + 18, { size: 13, weight: 700, color: C.green });
      label(ctx, why, cx, by + bh + 36, { size: 10 });
    });

    // 달리는 표시
    const p = (t * 0.35) % 3;
    const idx = Math.floor(p);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin((p % 1) * Math.PI);
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 2;
    roundRect(ctx, 18 + idx * 216 - 3, by - 3, bw + 6, bh + 6, 12);
    ctx.stroke();
    ctx.restore();

    label(ctx, `언듈레이터 주기 ${state.periodCm.toFixed(1)} cm · 전자 에너지 ${state.energyMeV} MeV · K ${out.K.toFixed(2)}`,
      LAD_W / 2, 26, { size: 12, color: C.text });
    label(ctx, `모두 곱하면 ${(L.totalFactor / 1e6).toFixed(2)} × 10⁶ 배 = 2γ² / (1 + K²/2)`,
      LAD_W / 2, LAD_H - 42, { size: 13, color: C.green });
    label(ctx, 'K를 그대로 두고 주기만 줄이면 ①과 ③이 나란히 오릅니다. 이 화면은 자석 세기가 고정이라 K도 함께 변합니다.',
      LAD_W / 2, LAD_H - 20, { size: 11 });
  }

  // ── 전자 두 개 ──
  function drawPair(ctx, t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, PAIR_W, PAIR_H);
    const LAM = 108;
    const phi = 2 * Math.PI * gap;
    const amp = 2 * Math.abs(Math.cos(Math.PI * gap));   // 합쳐진 진폭 (0~2)
    const drift = (t * 34) % LAM;

    // 전자 두 개
    const ax = 452;
    const bx = ax - gap * LAM;
    const ey = 74;
    ctx.save();
    ctx.strokeStyle = C.pipe;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(40, ey);
    ctx.lineTo(PAIR_W - 40, ey);
    ctx.stroke();
    ctx.restore();
    glowDot(ctx, ax, ey, 4, C.cyan, 1);
    glowDot(ctx, bx, ey, 4, C.pink, 1);
    label(ctx, '앞선 전자', ax + 6, ey - 22, { size: 11, color: C.cyan, align: 'left' });
    label(ctx, '뒤따르는 전자', bx - 6, ey - 22, { size: 11, color: C.pink, align: 'right' });
    arrow(ctx, PAIR_W - 48, ey, 1, 7, C.muted);

    // 간격 치수
    if (gap > 0.02) {
      ctx.save();
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(bx, ey + 20); ctx.lineTo(ax, ey + 20);
      ctx.moveTo(bx, ey + 14); ctx.lineTo(bx, ey + 26);
      ctx.moveTo(ax, ey + 14); ctx.lineTo(ax, ey + 26);
      ctx.stroke();
      ctx.restore();
      label(ctx, `d = ${gap.toFixed(2)} λ`, (ax + bx) / 2, ey + 38, { size: 11, color: C.green });
    }

    // 각자 내는 빛
    const wy = 178;
    label(ctx, '각자 내보내는 빛', 44, wy - 46, { size: 11, align: 'left' });
    label(ctx, gap < 0.02 || Math.abs(gap - 1) < 0.02 || Math.abs(gap - 2) < 0.02
      ? '두 파동이 완전히 겹칩니다' : '두 파동이 어긋나 있습니다',
      PAIR_W - 44, wy - 46, { size: 11, align: 'right', color: C.muted });
    const drawWave = (yc, a, shift, color, width, alpha, dash) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      for (let x = 44; x <= PAIR_W - 44; x += 2) {
        const y = yc - Math.cos(((x - drift) / LAM) * 2 * Math.PI + shift) * a;
        if (x === 44) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    drawWave(wy, 24, 0, C.cyan, 3, 0.85);                 // 앞선 전자
    drawWave(wy, 24, phi, C.pink, 2, 0.95, [7, 5]);        // 뒤따르는 전자 (파선)

    // 합친 빛 — 두 파동의 실제 합
    const sy = 286;
    label(ctx, '합친 빛', 44, sy - 60, { size: 11, align: 'left' });
    ctx.save();
    ctx.strokeStyle = 'rgba(122,127,149,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, sy); ctx.lineTo(PAIR_W - 44, sy);
    ctx.stroke();
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let x = 44; x <= PAIR_W - 44; x += 2) {
      const th = ((x - drift) / LAM) * 2 * Math.PI;
      const y = sy - (Math.cos(th) + Math.cos(th + phi)) * 20;
      if (x === 44) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 판정
    const inten = M.twoElectronIntensity(gap);
    const verdict = inten > 3.6 ? ['보강 — 전자 2개인데 세기 4', C.green]
      : inten < 0.4 ? ['상쇄 — 빛이 사라집니다', '#e08a5f']
        : ['어중간 — 남남인 것과 다를 바 없음', C.muted];
    label(ctx, verdict[0], PAIR_W - 44, sy - 60, { size: 12, align: 'right', color: verdict[1] });
    label(ctx, `합쳐진 세기 ${inten.toFixed(2)} (전자 하나 = 1)`, PAIR_W / 2, PAIR_H - 14, { size: 12, color: C.text });
  }

  function paintPairReadout() {
    const inten = M.twoElectronIntensity(gap);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('felGapValue', gap.toFixed(2));
    set('felPhase', `${(gap * 360).toFixed(0)}°`);
    set('felPairI', inten.toFixed(2));
    set('felPairVerdict', inten > 3.6 ? '보강 간섭' : inten < 0.4 ? '상쇄 간섭' : '어중간');
    const box = document.getElementById('felPairBox');
    if (box) box.className = inten > 3.6 ? 'good' : inten < 0.4 ? 'warn' : '';
  }

  if (gapInput) {
    gapInput.addEventListener('input', () => {
      gap = Number(gapInput.value);
      paintPairReadout();
    });
    paintPairReadout();
  }

  // ══════════════════════════════════════════════════════════
  //  한계 계산 — 파장을 어디까지 짧게 만들 수 있나
  // ══════════════════════════════════════════════════════════
  const limitCanvas = document.getElementById('felLimit');
  const LIM_W = 660;
  const LIM_H = 300;
  const limState = { energyMeV: 660, gapMm: 5, emittanceMmMrad: 0.25 };
  let limOut = M.shortestLasingWavelength(limState);

  const PLOT = { x0: 76, x1: 620, y0: 46, y1: 232, lamMin: 0.5, lamMax: 1000, puMin: 2, puMax: 40 };
  const yOfLam = nm => {
    const f = (Math.log10(Math.min(PLOT.lamMax, Math.max(PLOT.lamMin, nm))) - Math.log10(PLOT.lamMin))
      / (Math.log10(PLOT.lamMax) - Math.log10(PLOT.lamMin));
    return PLOT.y1 - f * (PLOT.y1 - PLOT.y0);
  };
  const xOfPu = mm => PLOT.x0 + ((mm - PLOT.puMin) / (PLOT.puMax - PLOT.puMin)) * (PLOT.x1 - PLOT.x0);

  function drawLimit(ctx) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, LIM_W, LIM_H);

    ctx.save();
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1;
    [0.5, 1, 10, 100, 1000].forEach(nm => {
      const y = yOfLam(nm);
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.moveTo(PLOT.x0, y); ctx.lineTo(PLOT.x1, y); ctx.stroke();
      ctx.globalAlpha = 1;
      label(ctx, String(nm), PLOT.x0 - 8, y, { size: 10, align: 'right' });
    });
    [2, 5, 10, 20, 30, 40].forEach(mm => {
      const x = xOfPu(mm);
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.moveTo(x, PLOT.y0); ctx.lineTo(x, PLOT.y1); ctx.stroke();
      ctx.globalAlpha = 1;
      label(ctx, String(mm), x, PLOT.y1 + 14, { size: 10 });
    });
    ctx.restore();
    label(ctx, '나오는 빛의 파장 [nm]', PLOT.x0 - 6, PLOT.y0 - 22, { size: 11, align: 'left' });
    label(ctx, '언듈레이터 주기 λu [mm]', (PLOT.x0 + PLOT.x1) / 2, PLOT.y1 + 32, { size: 11 });

    const floorY = yOfLam(limOut.emittanceFloorNm);
    ctx.save();
    ctx.fillStyle = 'rgba(224,138,95,.13)';
    ctx.fillRect(PLOT.x0, floorY, PLOT.x1 - PLOT.x0, PLOT.y1 - floorY);
    ctx.strokeStyle = 'rgba(224,138,95,.8)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(PLOT.x0, floorY); ctx.lineTo(PLOT.x1, floorY); ctx.stroke();
    ctx.restore();
    label(ctx, `빔 품질 바닥 ${limOut.emittanceFloorNm.toFixed(2)} nm`, PLOT.x1 - 4,
      Math.min(PLOT.y1 - 10, floorY + 13), { size: 10, align: 'right', color: '#e08a5f' });

    const ty = yOfLam(13.5);
    ctx.save();
    ctx.strokeStyle = 'rgba(127,216,143,.7)';
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(PLOT.x0, ty); ctx.lineTo(PLOT.x1, ty); ctx.stroke();
    ctx.restore();
    label(ctx, 'EUV 13.5 nm', PLOT.x1 - 4, ty - 10, { size: 10, align: 'right', color: C.green });

    const pts = limOut.scan.filter(s => s.periodMm >= PLOT.puMin && s.periodMm <= PLOT.puMax);
    ctx.save();
    ctx.lineWidth = 2.6;
    let prev = null;
    pts.forEach(s => {
      const x = xOfPu(s.periodMm);
      const y = yOfLam(s.wavelengthNm);
      if (prev) {
        ctx.strokeStyle = s.fails ? 'rgba(122,127,149,.75)' : C.violet;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
      }
      prev = { x, y };
    });
    ctx.restore();

    if (limOut.atPeriodMm) {
      const x = xOfPu(limOut.atPeriodMm);
      const y = yOfLam(limOut.shortestNm);
      glowDot(ctx, x, y, 4.4, C.green, 1);
      const lx = Math.min(PLOT.x1 - 150, x + 12);
      label(ctx, `여기가 한계  ${limOut.shortestNm.toFixed(2)} nm`, lx, y - 36, { size: 11, align: 'left', color: C.green });
      label(ctx, `λu ${limOut.atPeriodMm.toFixed(1)} mm · 자석 ${limOut.atSaturationM.toFixed(0)} m`,
        lx, y - 21, { size: 10, align: 'left' });
    }

    const leg = [[C.violet, '발진함'], ['rgba(122,127,149,.9)', '파장은 나오지만 증폭 안 됨']];
    leg.forEach(([col, txt], i) => {
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(78 + i * 132, LIM_H - 16); ctx.lineTo(100 + i * 132, LIM_H - 16); ctx.stroke();
      ctx.restore();
      label(ctx, txt, 106 + i * 132, LIM_H - 16, { size: 10, align: 'left' });
    });
    label(ctx, `${limState.energyMeV} MeV · 간극 ${limState.gapMm} mm · εn ${limState.emittanceMmMrad}`,
      LIM_W - 20, LIM_H - 16, { size: 11, align: 'right', color: C.text });
  }

  const limEnergy = document.getElementById('felLimitEnergy');
  const limGap = document.getElementById('felLimitGap');
  const limEmit = document.getElementById('felLimitEmit');

  function readLimit() {
    if (!limEnergy) return;
    limState.energyMeV = Number(limEnergy.value);
    limState.gapMm = Number(limGap.value);
    limState.emittanceMmMrad = Number(limEmit.value);
    limOut = M.shortestLasingWavelength(limState);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('felLimitEnergyValue', `${limState.energyMeV} MeV`);
    set('felLimitGapValue', `${limState.gapMm.toFixed(1)} mm`);
    set('felLimitEmitValue', `${limState.emittanceMmMrad.toFixed(2)} mm·mrad`);
    set('felShortest', `${limOut.shortestNm.toFixed(2)} nm`);
    set('felShortestPu', limOut.atPeriodMm ? `${limOut.atPeriodMm.toFixed(1)} mm` : '—');
    set('felShortestMag', Number.isFinite(limOut.atSaturationM) ? `${limOut.atSaturationM.toFixed(0)} m` : '—');
    set('felBlocker', limOut.limitedBy);
    set('felFloor', `${limOut.emittanceFloorNm.toFixed(2)} nm`);
    const box = document.getElementById('felShortestBox');
    if (box) box.className = limOut.shortestNm <= 13.5 ? 'good' : 'warn';
  }

  if (limEnergy) {
    [limEnergy, limGap, limEmit].forEach(el => el.addEventListener('input', readLimit));
    readLimit();
  }

  selectZone(state.zone);
  readControls();
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => { last = 0; });
})();
