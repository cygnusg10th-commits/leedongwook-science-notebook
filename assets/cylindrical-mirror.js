(() => {
  const model = globalThis.CylindricalMirrorModel;
  if (!model) return;
  const $ = id => document.getElementById(id);
  const controls = { R: $('mirrorR'), L: $('mirrorL'), nMax: $('mirrorOrder'), rho: $('mirrorRho') };
  const values = { R: $('mirrorRValue'), L: $('mirrorLValue'), nMax: $('mirrorOrderValue'), rho: $('mirrorRhoValue') };
  const rings = $('mirrorRings');
  const ruler = $('mirrorRuler');
  const status = $('mirrorStatus');
  const spacing = $('mirrorSpacing');
  const half = $('mirrorHalf');
  const modeButtons = [...document.querySelectorAll('[data-mirror-mode]')];
  const modeStatus = $('mirrorModeStatus');
  const rulerAxis = $('mirrorRulerAxis');
  const stage = $('mirrorStage');
  const offsetExplainer = $('offsetRayExplainer');
  const offsetTopView = $('offsetTopView');
  let mode = 'offset';

  const causeFigure = document.createElement('figure');
  causeFigure.className = 'point-cause-figure';
  causeFigure.innerHTML = `
    <h3>축 밖 점광원은 왜 링이 아니라 점으로 보일까요?</h3>
    <svg viewBox="0 0 920 430" role="img" aria-labelledby="pointCauseTitle pointCauseDesc">
      <title id="pointCauseTitle">광원 쪽 끝판의 축 이탈 점광원에서 핀홀까지 가는 빛</title>
      <desc id="pointCauseDesc">축 밖 점광원에서 출발해 원통 벽에서 반사된 뒤 중앙 핀홀에 도달하는 한 자오면의 경로와, 다른 방위각으로 출발해 핀홀을 빗나가는 경로, 센서의 점상 비교 그림</desc>
      <defs><marker id="causeArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z"/></marker></defs>
      <g transform="translate(20 52)">
        <text class="cause-head" x="0" y="-18">① 광원 끝판 → 반사 → 중앙 핀홀</text>
        <rect class="cause-tube" x="0" y="0" width="410" height="250" rx="12"/>
        <line class="cause-axis" x1="0" y1="125" x2="410" y2="125"/>
        <circle class="cause-source" cx="26" cy="80" r="8"/>
        <circle class="cause-pinhole" cx="384" cy="125" r="8"/>
        <path class="cause-ray" d="M26 80 L118 8 L206 242 L302 8 L384 125" marker-end="url(#causeArrow)"/>
        <path class="cause-miss" d="M26 80 L120 242 L210 40 L300 242 L384 190"/>
        <circle class="cause-miss-dot" cx="384" cy="190" r="6"/>
        <text x="3" y="65">끝판의 축 밖 광원</text><text x="321" y="110">중앙 핀홀</text>
        <text class="cause-ok" x="145" y="92">같은 자오면의 빛 → 핀홀 도달</text>
        <text class="cause-no" x="134" y="198">다른 방위각의 빛 → 핀홀 빗나감</text>
        <circle class="cause-endplate" cx="58" cy="330" r="39"/><circle class="cause-source" cx="58" cy="315" r="6"/>
        <line class="cause-end-axis" x1="25" y1="330" x2="91" y2="330"/><line class="cause-end-axis" x1="58" y1="297" x2="58" y2="363"/>
        <text x="112" y="326">광원 쪽 끝판</text><text class="cause-no" x="112" y="345">흰 점이 중심에서 R/2 이탈</text>
      </g>
      <path class="cause-arrow" d="M455 177 H530" marker-end="url(#causeArrow)"/>
      <text class="cause-link" x="465" y="155">허용된</text><text class="cause-link" x="465" y="171">한 평면만</text>
      <g transform="translate(550 52)">
        <text class="cause-head" x="0" y="-18">② 핀홀 뒤 센서에서 보이는 상</text>
        <circle class="cause-sensor" cx="165" cy="125" r="122"/>
        <line class="cause-image-line" x1="42" y1="125" x2="288" y2="125"/>
        <circle class="cause-image-dot" cx="62" cy="125" r="6"/><circle class="cause-image-dot" cx="104" cy="125" r="6"/>
        <circle class="cause-image-dot" cx="145" cy="125" r="6"/><circle class="cause-image-dot" cx="185" cy="125" r="6"/>
        <circle class="cause-image-dot" cx="226" cy="125" r="6"/><circle class="cause-image-dot" cx="268" cy="125" r="6"/>
        <circle class="cause-ring-no" cx="165" cy="125" r="74"/><path class="cause-x" d="M118 78 L212 172 M212 78 L118 172"/>
        <text class="cause-ok" x="93" y="282">한 직선 위 점상만 남음</text>
        <text class="cause-no" x="105" y="316">원을 채울 다른 자오면이 없음</text>
      </g>
    </svg>
    <figcaption>광원에서 나온 빛 가운데 광원·원통축·중앙 핀홀을 함께 포함하는 한 자오면의 경로만 핀홀에 도달합니다. 이유는 빛의 길을 거꾸로 따라도 같기 때문입니다. 핀홀에서 역추적한 광선은 처음 정해진 자오면을 반사 뒤에도 벗어나지 않으므로, 축 밖 광원을 포함한 단 하나의 자오면만 광원과 연결됩니다. 따라서 센서에는 그 평면이 센서와 만나는 직선 위의 점들만 생기고, 360° 방향의 광선이 필요한 링은 생기지 않습니다.</figcaption>`;
  document.querySelector('.explanation .xy-grid').insertAdjacentElement('afterend', causeFigure);

  function render() {
    const state = Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, Number(input.value)]));
    values.R.textContent = state.R.toFixed(1);
    values.L.textContent = state.L.toFixed(1);
    values.nMax.textContent = state.nMax;
    values.rho.textContent = state.rho.toFixed(2);
    const data = model.images(state);
    const maxRatio = data[data.length - 1].radiusOverF || 1;
    const scale = 208 / maxRatio;
    rings.replaceChildren();
    ruler.replaceChildren();
    const addCircle = item => {
      if (item.n === 0) {
        const source = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        source.setAttribute('cx', '260'); source.setAttribute('cy', '260'); source.setAttribute('r', '5'); source.setAttribute('class', 'mirror-source');
        rings.append(source);
        return;
      }
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '260'); circle.setAttribute('cy', '260'); circle.setAttribute('r', String(item.radiusOverF * scale));
      circle.setAttribute('class', 'mirror-ring'); circle.setAttribute('opacity', String(Math.max(.12, item.intensity)));
      rings.append(circle);
      const y = 260 - item.radiusOverF * scale;
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', '264'); tick.setAttribute('x2', item.n % 2 ? '280' : '274'); tick.setAttribute('y1', y); tick.setAttribute('y2', y);
      ruler.append(tick);
    };
    if (mode === 'center') data.forEach(addCircle);
    if (mode === 'offset') {
      const points = model.offsetPointImages({ ...state, s: state.R / 2 });
      const span = Math.max(...points.map(point => Math.abs(point.uOverR))) || 1;
      points.forEach(point => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(260 + point.uOverR * 210 / span)); dot.setAttribute('cy', '260');
        dot.setAttribute('r', point.n === 0 ? '5' : '4'); dot.setAttribute('class', point.n === 0 ? 'mirror-source' : 'mirror-point');
        dot.setAttribute('opacity', String(Math.max(.18, point.intensity))); rings.append(dot);
      });
    }
    if (mode === 'slit') {
      data.forEach(addCircle);
      data.filter(item => item.n > 0).forEach(item => {
        const radius = item.radiusOverF * scale;
        [-1, 1].forEach(sign => {
          const dash = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          dash.setAttribute('x1', String(260 + sign * radius - 6)); dash.setAttribute('x2', String(260 + sign * radius + 6));
          dash.setAttribute('y1', '260'); dash.setAttribute('y2', '260'); dash.setAttribute('class', 'mirror-slit-image');
          dash.setAttribute('opacity', String(Math.max(.18, item.intensity))); rings.append(dash);
        });
      });
      const sourceDash = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      sourceDash.setAttribute('x1', '254'); sourceDash.setAttribute('x2', '266'); sourceDash.setAttribute('y1', '260'); sourceDash.setAttribute('y2', '260'); sourceDash.setAttribute('class', 'mirror-slit-image'); rings.append(sourceDash);
    }
    ruler.style.display = mode === 'center' ? '' : 'none';
    rulerAxis.style.display = mode === 'center' ? '' : 'none';
    stage.classList.toggle('slit-view', mode === 'slit');
    offsetExplainer.hidden = mode !== 'offset';
    offsetTopView.hidden = mode !== 'offset';
    const step = (2 * state.R) / state.L;
    spacing.textContent = `${step.toFixed(3)} f`;
    half.textContent = state.rho < 1 ? `약 ${model.halfBrightnessOrder(state.rho).toFixed(1)}회` : '감쇠 없음';
    const messages = {
      center: `중앙 점광원: 최대 n=${state.nMax}, 바깥 고리 반지름은 f의 ${(state.nMax * step).toFixed(2)}배입니다.`,
      offset: '축에서 R/2 벗어난 점광원: 고리는 사라지고 1R, 3R 간격이 교대하는 점열이 됩니다.',
      slit: '가로 슬릿 광원: 얇은 고리와 좌우로 벌어진 짧은 선상이 함께 나타납니다.',
    };
    status.textContent = messages[mode]; modeStatus.textContent = messages[mode];
  }
  Object.values(controls).forEach(input => input.addEventListener('input', render));
  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mirrorMode;
    modeButtons.forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    render();
  }));
  modeButtons.forEach(item => {
    const active = item.dataset.mirrorMode === mode;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-mirror-quiz]').forEach(group => {
    group.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      group.querySelectorAll('button').forEach(item => item.classList.remove('correct', 'incorrect'));
      const correct = button.dataset.correct === 'true';
      button.classList.add(correct ? 'correct' : 'incorrect');
      group.querySelector('[data-feedback]').textContent = correct ? button.dataset.feedback : button.dataset.hint;
    }));
  });
  render();
})();

