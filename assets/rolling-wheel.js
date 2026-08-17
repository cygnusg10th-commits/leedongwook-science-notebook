// 예상 패널과 확인 퀴즈. 시뮬레이션과 독립적으로 동작한다.
(() => {
  'use strict';

  const prediction = document.querySelector('[data-wheel-prediction]');
  const predictionFeedback = document.querySelector('[data-wheel-prediction-feedback]');
  if (prediction && predictionFeedback) {
    const options = [...prediction.querySelectorAll('.prediction-option')];
    options.forEach(option => option.addEventListener('click', () => {
      options.forEach(item => {
        item.classList.remove('selected');
        item.setAttribute('aria-pressed', 'false');
      });
      option.classList.add('selected');
      option.setAttribute('aria-pressed', 'true');
      predictionFeedback.textContent = option.dataset.feedback || '';
    }));
  }

  document.querySelectorAll('[data-wheel-quiz] .quiz-item').forEach(item => {
    const options = [...item.querySelectorAll('.quiz-option')];
    const feedback = item.querySelector('.quiz-feedback');
    options.forEach(option => option.addEventListener('click', () => {
      const correct = option.dataset.correct === 'true';
      options.forEach(other => other.classList.remove('correct', 'incorrect'));
      option.classList.add(correct ? 'correct' : 'incorrect');
      if (!correct) options.find(other => other.dataset.correct === 'true')?.classList.add('correct');
      if (feedback) {
        feedback.textContent = correct
          ? option.dataset.feedback || '맞았습니다.'
          : `${option.dataset.hint || '다시 생각해 보세요.'} 정답은 「${options.find(other => other.dataset.correct === 'true')?.textContent.trim()}」입니다.`;
      }
    }));
  });
})();

(() => {
  'use strict';

  const model = globalThis.RollingWheelModel;
  const canvas = document.getElementById('wheelCanvas');
  if (!model || !canvas) return;

  const context = canvas.getContext('2d');
  const stage = canvas.parentElement;

  const speedRange = document.getElementById('wheelSpeed');
  const speedValue = document.getElementById('wheelSpeedValue');
  const ratioRange = document.getElementById('wheelRatio');
  const ratioValue = document.getElementById('wheelRatioValue');
  const playButton = document.getElementById('wheelPlay');
  const resetButton = document.getElementById('wheelReset');
  const contactOut = document.getElementById('wheelContact');
  const topOut = document.getElementById('wheelTop');
  const markerOut = document.getElementById('wheelMarker');
  const frameNote = document.getElementById('wheelFrameNote');
  const liveStatus = document.getElementById('wheelLiveStatus');

  const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const state = {
    speedKmh: 60,
    ratio: 1,
    playing: !(reduceMotionQuery && reduceMotionQuery.matches),
    rate: 0.1,
    wheelFrame: false,
    theta: Math.PI,
    visible: true,
    show: { translation: true, rotation: true, sum: true, path: true, stamp: false, axis: false }
  };

  const COLORS = {
    translation: '#2f6fc4',
    rotation: '#b8317a',
    sum: '#10714a',
    marker: '#a35a06',
    ground: '#3f4a5e',
    tick: '#c9d1de'
  };

  let stamps = [];
  let frameId = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;

  function resize() {
    const rect = stage.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.round(rect.width));
    const cssHeight = Math.max(180, Math.round(rect.height || cssWidth * 9 / 16));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    }
    width = cssWidth;
    height = cssHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function geometry() {
    const radius = Math.min(height * 0.34, width * 0.15);
    return { radius, groundY: height - Math.max(52, height * 0.16) };
  }

  function arrow(x, y, dx, dy, color, lineWidth) {
    const length = Math.hypot(dx, dy);
    if (length < 3) return;
    const ux = dx / length;
    const uy = dy / length;
    const head = Math.min(12, length * 0.42);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + dx - ux * head * 0.7, y + dy - uy * head * 0.7);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x + dx + ux * head * 0.5, y + dy + uy * head * 0.5);
    context.lineTo(x + dx - ux * head * 0.6 - uy * head * 0.52, y + dy - uy * head * 0.6 + ux * head * 0.52);
    context.lineTo(x + dx - ux * head * 0.6 + uy * head * 0.52, y + dy - uy * head * 0.6 - ux * head * 0.52);
    context.closePath();
    context.fill();
  }

  function drawWheel(cx, cy, radius, spin) {
    context.save();
    context.translate(cx, cy);
    context.rotate(spin);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = '#2c313b';
    context.fill();
    context.lineWidth = 3;
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      context.beginPath();
      context.moveTo(Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9);
      context.lineTo(Math.cos(angle) * radius * 0.995, Math.sin(angle) * radius * 0.995);
      context.strokeStyle = '#1b1f27';
      context.stroke();
    }
    context.beginPath();
    context.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    context.fillStyle = '#eef1f6';
    context.fill();
    for (let i = 0; i < 6; i += 1) {
      context.save();
      context.rotate((i / 6) * Math.PI * 2);
      context.beginPath();
      context.moveTo(0, -radius * 0.085);
      context.lineTo(radius * 0.66, -radius * 0.05);
      context.lineTo(radius * 0.66, radius * 0.05);
      context.lineTo(0, radius * 0.085);
      context.closePath();
      context.fillStyle = '#aab3c4';
      context.fill();
      context.restore();
    }
    context.beginPath();
    context.arc(0, 0, radius * 0.17, 0, Math.PI * 2);
    context.fillStyle = '#7d8798';
    context.fill();
    context.restore();
  }

  // theta 는 맨 위에서 시계 방향으로 잰 각. 화면에서 맨 위는 y 가 작은 쪽.
  function rimPoint(cx, cy, radius, theta) {
    return { x: cx + radius * Math.sin(theta), y: cy - radius * Math.cos(theta) };
  }

  function draw() {
    resize();
    const { radius, groundY } = geometry();
    const centerY = groundY - radius;
    const travel = radius * state.theta;
    // 화살표(최대 약 0.92R)까지 화면 안에 들어오도록 여백을 잡는다.
    const margin = Math.min(radius * 2 + 8, width * 0.45);
    const span = Math.max(60, width - 2 * margin);
    const wheelFrame = state.wheelFrame;
    const centerX = wheelFrame ? width / 2 : margin + (travel % span);
    const shift = centerX - travel;

    context.clearRect(0, 0, width, height);

    context.fillStyle = '#f2f5f9';
    context.fillRect(0, groundY, width, height - groundY);
    context.strokeStyle = COLORS.ground;
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(0, groundY);
    context.lineTo(width, groundY);
    context.stroke();
    context.strokeStyle = COLORS.tick;
    context.lineWidth = 2;
    const tickSpan = width + 180;
    for (let i = -2; i < 40; i += 1) {
      const x = (((i * 90 + shift) % tickSpan) + tickSpan) % tickSpan - 90;
      context.beginPath();
      context.moveTo(x, groundY + 9);
      context.lineTo(x, groundY + 26);
      context.stroke();
    }

    if (state.show.stamp) {
      stamps.forEach(position => {
        const x = position + shift;
        if (x < -20 || x > width + 20) return;
        context.beginPath();
        context.arc(x, groundY, 6, 0, Math.PI * 2);
        context.fillStyle = 'rgba(16, 113, 74, .85)';
        context.fill();
        context.strokeStyle = '#fff';
        context.lineWidth = 2;
        context.stroke();
      });
    }

    const markerRadius = state.ratio * radius;
    function strokeMarkerPath() {
      context.strokeStyle = 'rgba(163, 90, 6, .34)';
      context.lineWidth = 7;
      context.stroke();
      context.strokeStyle = COLORS.marker;
      context.lineWidth = 2.4;
      context.stroke();
    }
    // 지면 관점의 사이클로이드는 바퀴 뒤에, 바퀴 관점의 원은 바퀴 위에 그린다.
    if (state.show.path && !wheelFrame) {
      context.lineJoin = 'round';
      context.lineCap = 'round';
      const arc = 2.4 * Math.PI * 2;
      const steps = 420;
      context.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i += 1) {
        const theta = state.theta - arc + (arc * i) / steps;
        const point = model.trochoidPoint({ radius, radiusRatio: state.ratio, theta });
        const x = point.x + shift;
        const y = groundY - point.y;
        if (x < -40 || x > width + 40) { started = false; continue; }
        if (!started) { context.moveTo(x, y); started = true; } else context.lineTo(x, y);
      }
      strokeMarkerPath();
    }

    drawWheel(centerX, centerY, radius, state.theta);

    // 순간회전축에서 뻗은 반지름은 바퀴 위에 그려야 보인다.
    if (state.show.axis && !wheelFrame) {
      context.setLineDash([7, 7]);
      context.strokeStyle = 'rgba(16, 113, 74, .75)';
      context.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const point = rimPoint(centerX, centerY, radius, state.theta + (i / 8) * Math.PI * 2);
        context.beginPath();
        context.moveTo(centerX, groundY);
        context.lineTo(point.x, point.y);
        context.stroke();
      }
      context.setLineDash([]);
    }

    if (state.show.path && wheelFrame) {
      context.beginPath();
      context.arc(centerX, centerY, Math.max(markerRadius, 0.6), 0, Math.PI * 2);
      strokeMarkerPath();
    }

    // 화면 좌표는 y가 아래로 향하므로 세계 좌표의 세로 성분에 -1을 곱한다.
    const scale = (0.46 * radius) / 60;
    const magnitude = state.speedKmh * scale;
    for (let i = 0; i < 8; i += 1) {
      const theta = state.theta + (i / 8) * Math.PI * 2;
      const point = rimPoint(centerX, centerY, radius, theta);
      const ratio = model.pointVelocityRatio({ radiusRatio: 1, theta });
      const translationX = wheelFrame ? 0 : magnitude;
      const rotationX = magnitude * Math.cos(theta);
      const rotationY = magnitude * Math.sin(theta);
      const sumX = magnitude * (wheelFrame ? ratio.vx - 1 : ratio.vx);
      const sumY = -magnitude * ratio.vy;
      if (state.show.translation) arrow(point.x, point.y, translationX, 0, 'rgba(47, 111, 196, .92)', 3);
      if (state.show.rotation) arrow(point.x + translationX, point.y, rotationX, rotationY, 'rgba(184, 49, 122, .92)', 3);
      if (state.show.sum) arrow(point.x, point.y, sumX, sumY, COLORS.sum, 4);
    }

    context.beginPath();
    context.arc(centerX, groundY, 9, 0, Math.PI * 2);
    context.fillStyle = wheelFrame ? COLORS.rotation : COLORS.sum;
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 3;
    context.stroke();

    const marker = model.trochoidPoint({ radius, radiusRatio: state.ratio, theta: state.theta });
    const markerX = wheelFrame ? centerX + markerRadius * Math.sin(state.theta) : marker.x + shift;
    const markerY = wheelFrame ? centerY - markerRadius * Math.cos(state.theta) : groundY - marker.y;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(markerX, markerY);
    context.strokeStyle = 'rgba(163, 90, 6, .85)';
    context.lineWidth = 3;
    context.stroke();
    context.beginPath();
    context.arc(markerX, markerY, 8, 0, Math.PI * 2);
    context.fillStyle = COLORS.marker;
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 2.5;
    context.stroke();

    context.font = '700 14px system-ui, -apple-system, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = wheelFrame ? COLORS.rotation : COLORS.sum;
    context.fillText(wheelFrame ? '접지점 — 뒤로 v' : '접지점 — 0', centerX, groundY + 42);
    if (wheelFrame) {
      context.textAlign = 'left';
      context.fillStyle = '#5b6473';
      context.font = '600 13px system-ui, -apple-system, sans-serif';
      context.fillText('노면이 뒤로 흐릅니다 — 실제로는 내가 앞으로 가는 중', 14, 26);
    }
  }

  function updateReadout() {
    const speed = state.speedKmh;
    const contact = state.wheelFrame ? speed : 0;
    const top = state.wheelFrame ? speed : model.pointSpeedRatio({ radiusRatio: 1, theta: 0 }) * speed;
    const markerSpeed = state.wheelFrame
      ? speed * state.ratio
      : model.pointSpeedRatio({ radiusRatio: state.ratio, theta: state.theta }) * speed;
    contactOut.textContent = `${contact.toFixed(1)} km/h`;
    topOut.textContent = `${top.toFixed(1)} km/h`;
    markerOut.textContent = `${markerSpeed.toFixed(1)} km/h`;
  }

  let announceTimer = 0;
  function announce() {
    if (!liveStatus) return;
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      const minimum = model.minimumSpeedRatio({ radiusRatio: state.ratio }) * state.speedKmh;
      liveStatus.textContent = `차체 ${state.speedKmh} km/h, 표시점 위치 ${state.ratio.toFixed(2)} R. `
        + `${state.wheelFrame ? '바퀴와 함께 달리는 관점입니다.' : '지면 관점에서 접지점 속력은 0 km/h, 맨 위는 ' + (2 * state.speedKmh).toFixed(1) + ' km/h입니다.'} `
        + `표시점의 최저 속력은 ${minimum.toFixed(1)} km/h입니다.`;
    }, 350);
  }

  function step(delta) {
    const previous = state.theta;
    const angularSpeed = model.angularSpeed({ speed: state.speedKmh / 3.6, radius: 0.31 });
    state.theta += angularSpeed * delta;
    if (state.theta - previous > 0 && state.show.stamp) {
      const { radius } = geometry();
      const travel = radius * state.theta;
      const period = (2 * Math.PI * radius) / 8;
      const last = stamps.length ? stamps[stamps.length - 1] : -Infinity;
      if (travel - last > period) stamps.push(travel);
      if (stamps.length > 80) stamps.shift();
    }
  }

  function loop(now) {
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (state.playing && state.visible) {
      step(delta * state.rate);
      updateReadout();
    }
    draw();
    frameId = window.requestAnimationFrame(loop);
  }

  function setPlaying(playing) {
    state.playing = playing;
    playButton.textContent = playing ? 'Ⅱ 정지' : '▶ 재생';
    playButton.setAttribute('aria-pressed', String(playing));
  }

  speedRange.addEventListener('input', () => {
    state.speedKmh = Number(speedRange.value);
    speedValue.textContent = String(state.speedKmh);
    updateReadout();
    announce();
  });

  ratioRange.addEventListener('input', () => {
    state.ratio = Number(ratioRange.value) / 100;
    ratioValue.textContent = state.ratio.toFixed(2);
    updateReadout();
    announce();
  });

  playButton.addEventListener('click', () => setPlaying(!state.playing));

  resetButton.addEventListener('click', () => {
    state.theta = Math.PI;
    stamps = [];
    updateReadout();
    draw();
  });

  document.querySelectorAll('[data-playback]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-playback]').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      state.rate = Number(button.dataset.playback);
    });
  });

  document.querySelectorAll('[data-toggle-view]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.toggleView;
      const next = !state.show[key];
      state.show[key] = next;
      button.classList.toggle('active', next);
      button.setAttribute('aria-pressed', String(next));
      if (key === 'stamp') stamps = [];
      draw();
    });
  });

  document.querySelectorAll('[data-frame]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-frame]').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      state.wheelFrame = button.dataset.frame === 'wheel';
      stamps = [];
      frameNote.textContent = state.wheelFrame
        ? '바퀴와 함께 달리는 관점입니다. 테두리 위의 모든 점이 똑같이 v로 움직이고, 표시점의 궤적은 원이 됩니다. 접지점은 뒤로 v입니다.'
        : '지면에 선 관점입니다. 접지점의 속도는 0이고 맨 위는 2v입니다. 표시점의 궤적은 사이클로이드입니다.';
      updateReadout();
      announce();
      draw();
    });
  });

  if (reduceMotionQuery) {
    const onMotionChange = () => { if (reduceMotionQuery.matches) setPlaying(false); };
    if (reduceMotionQuery.addEventListener) reduceMotionQuery.addEventListener('change', onMotionChange);
    else if (reduceMotionQuery.addListener) reduceMotionQuery.addListener(onMotionChange);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
    }, { threshold: 0.05 });
    observer.observe(stage);
  }

  window.addEventListener('resize', draw);

  setPlaying(state.playing);
  updateReadout();
  announce();
  lastTime = performance.now();
  frameId = window.requestAnimationFrame(loop);
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(frameId));
})();
