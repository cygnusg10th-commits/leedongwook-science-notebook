(() => {
  'use strict';
  // 재생은 사용자 조작으로만 시작하며 숨긴 원음이나 다른 플레이어와 겹치지 않는다.
  const players = [...document.querySelectorAll('main video, main audio')];
  players.forEach(player => player.addEventListener('play', () => {
    players.forEach(other => { if (other !== player) other.pause(); });
  }));
  const reveal = document.querySelector('#voice-reveal');
  reveal?.addEventListener('toggle', () => {
    if (!reveal.open) reveal.querySelector('audio')?.pause();
  });

  const canvas = document.querySelector('#wave-canvas');
  const figure = document.querySelector('#wave-figure');
  const status = document.querySelector('#wave-status');
  const axis = document.querySelector('#wave-axis');
  const description = document.querySelector('#wave-description');
  const buttons = [...document.querySelectorAll('[data-wave-mode]')];
  if (!canvas || !figure || !status || !axis || !description) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    figure.setAttribute('aria-busy', 'false');
    status.textContent = '이 브라우저에서는 파형을 그릴 수 없습니다. 아래 설명과 원자료 링크를 이용해 주세요.';
    return;
  }
  let data = null;
  let mode = 'whole';
  let resizeFrame = 0;
  const number = (value, digits = 3) => Number(value.toFixed(digits)).toLocaleString('ko-KR', { maximumFractionDigits: digits });
  const finite = value => typeof value === 'number' && Number.isFinite(value);

  function validate(payload) {
    for (const key of ['whole', 'zoom']) {
      const part = payload?.[key];
      if (!part || !finite(part.duration_s) || part.duration_s <= 0 || !finite(part.start_s)) throw new Error('잘못된 시간 구간');
      for (const name of ['voice', 'piano']) {
        const points = part[name];
        if (!Array.isArray(points) || points.length < 2) throw new Error('파형 데이터 없음');
        const valid = key === 'whole'
          ? points.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(finite) && pair[0] <= pair[1])
          : points.every(finite);
        if (!valid) throw new Error('잘못된 실제 샘플');
      }
    }
    if (!finite(payload.zoom.center_s)) throw new Error('확대 중심 없음');
    return payload;
  }

  function draw() {
    if (!data) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(260, bounds.width);
    const height = Math.max(300, bounds.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#00090a';
    ctx.fillRect(0, 0, width, height);
    const part = data[mode];
    const left = width < 440 ? 30 : 48;
    const right = 28;
    const plotWidth = width - left - right;
    const axisY = height - 49;
    const centers = [height * 0.29, height * 0.67];
    const amplitude = height * 0.135;
    const ticks = width < 440 ? 2 : 4;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (let i = 0; i <= ticks; i += 1) {
      const x = left + plotWidth * i / ticks;
      ctx.strokeStyle = '#183137';
      ctx.beginPath(); ctx.moveTo(x, 36); ctx.lineTo(x, axisY); ctx.stroke();
      ctx.fillStyle = '#b0c0c4';
      ctx.textAlign = i === 0 ? 'left' : i === ticks ? 'right' : 'center';
      const time = part.duration_s * i / ticks;
      ctx.fillText(number(mode === 'zoom' ? time * 1000 : part.start_s + time), x, axisY + 17);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b0c0c4';
    ctx.fillText(part.xlabel || (mode === 'zoom' ? '확대 구간 시간 (ms)' : '시간 (초)'), left + plotWidth / 2, height - 13);
    ['voice', 'piano'].forEach((name, row) => {
      const points = part[name];
      const y = centers[row];
      const color = row === 0 ? '#ffffff' : '#90b7fb';
      const maximum = Math.max(1e-12, ...points.map(point => Array.isArray(point) ? Math.max(Math.abs(point[0]), Math.abs(point[1])) : Math.abs(point)));
      const valueY = value => y - value / maximum * amplitude;
      ctx.strokeStyle = '#385057';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotWidth, y); ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = color;
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(row === 0 ? '목소리 원음' : '피아노형 합성음', left, y - amplitude - 19);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.15;
      // 전체는 실제 구간의 최솟값·최댓값을, 확대는 실제 샘플을 연결한다.
      if (mode === 'whole') {
        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        points.forEach((pair, i) => {
          const x = left + plotWidth * (i + 0.5) / points.length;
          ctx.moveTo(x, valueY(pair[0])); ctx.lineTo(x, valueY(pair[1]));
        });
        ctx.stroke(); ctx.globalAlpha = 1;
        for (const edge of [0, 1]) {
          ctx.beginPath();
          points.forEach((pair, i) => {
            const x = left + plotWidth * (i + 0.5) / points.length;
            if (i === 0) ctx.moveTo(x, valueY(pair[edge])); else ctx.lineTo(x, valueY(pair[edge]));
          });
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        points.forEach((point, i) => {
          const x = left + plotWidth * i / (points.length - 1);
          if (i === 0) ctx.moveTo(x, valueY(point)); else ctx.lineTo(x, valueY(point));
        });
        ctx.stroke();
      }
    });
  }

  function setMode(next) {
    if (!data || !['whole', 'zoom'].includes(next)) return;
    mode = next;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.waveMode === mode)));
    const part = data[mode];
    if (mode === 'whole') {
      axis.textContent = '가로축: 음원 시작 후 ' + number(part.start_s) + '–' + number(part.start_s + part.duration_s) + '초. 목소리 끝의 빈 시간은 0으로 채워 같은 축에 맞췄습니다.';
      description.textContent = '두 음원의 전체 구간을 시간 칸별 실제 최솟값·최댓값으로 표시합니다. 큰 세기 흐름을 비교하는 보기이며 미세한 진동 하나하나를 그대로 펼친 그림은 아닙니다.';
      status.textContent = '전체 윤곽을 표시합니다. 두 파형은 독립 정규화했으므로 음량 비교가 아닙니다.';
    } else {
      axis.textContent = '가로축: 확대 구간 시작 후 0–' + number(part.duration_s * 1000) + 'ms. 원음 파일의 ' + number(part.start_s) + '–' + number(part.start_s + part.duration_s) + '초 구간입니다.';
      description.textContent = '원음 ' + number(part.center_s) + '초 주변의 모음 구간을 실제 샘플의 선으로 표시합니다. 이 구간의 반복 무늬와 서로 다른 미세 진동을 비교하세요.';
      status.textContent = number(part.duration_s * 1000) + 'ms 확대를 표시합니다. 다른 말소리 구간도 늘 같은 모양인 것은 아닙니다.';
    }
    draw();
  }
  buttons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.waveMode)));
  const scheduleDraw = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(draw);
  };
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe(canvas);
  else window.addEventListener('resize', scheduleDraw);
  fetch('media/waveforms.json')
    .then(response => { if (!response.ok) throw new Error('파형 불러오기 실패'); return response.json(); })
    .then(payload => {
      data = validate(payload);
      buttons.forEach(button => { button.disabled = false; });
      setMode('whole');
    })
    .catch(() => {
      status.textContent = '파형 데이터를 불러오지 못했습니다. 아래 설명이나 원자료의 실제 파형 데이터 링크를 이용해 주세요.';
    })
    .finally(() => figure.setAttribute('aria-busy', 'false'));
})();
