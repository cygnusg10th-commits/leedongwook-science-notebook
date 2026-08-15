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
  let mode = 'center';

  const causeFigure = document.createElement('figure');
  causeFigure.className = 'point-cause-figure';
  causeFigure.innerHTML = `
    <svg viewBox="0 0 920 430" role="img" aria-labelledby="pointCauseTitle pointCauseDesc">
      <title id="pointCauseTitle">하나의 자오면이 수평 점열을 만드는 과정</title>
      <desc id="pointCauseDesc">위에서 본 원통의 허용 광선이 하나의 자오면으로 제한되고, 그 평면과 센서가 만나는 선 위에 점상만 생기며 동심원은 생기지 않는 비교 그림</desc>
      <defs><marker id="causeArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z"/></marker></defs>
      <g transform="translate(20 52)">
        <text class="cause-head" x="0" y="-18">① 위에서 본 원통</text>
        <rect class="cause-tube" x="0" y="0" width="410" height="250" rx="12"/>
        <line class="cause-axis" x1="0" y1="125" x2="410" y2="125"/>
        <circle class="cause-source" cx="26" cy="80" r="8"/>
        <circle class="cause-pinhole" cx="384" cy="125" r="8"/>
        <path class="cause-ray" d="M384 125 L302 8 L206 242 L118 8 L26 80"/>
        <path class="cause-miss" d="M384 125 L300 242 L210 40 L120 242 L26 170"/>
        <circle class="cause-miss-dot" cx="26" cy="170" r="6"/>
        <text x="8" y="65">축 밖 광원</text><text x="333" y="110">핀홀</text>
        <text class="cause-ok" x="165" y="92">광원과 같은 자오면</text>
        <text class="cause-no" x="152" y="198">다른 방위각 → 빗나감</text>
      </g>
      <path class="cause-arrow" d="M455 177 H530" marker-end="url(#causeArrow)"/>
      <text class="cause-link" x="465" y="155">허용된</text><text class="cause-link" x="465" y="171">한 평면만</text>
      <g transform="translate(550 52)">
        <text class="cause-head" x="0" y="-18">② 핀홀 센서에서 보이는 상</text>
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
    <figcaption>축 위 광원은 모든 방위각의 자오면에 속하므로 같은 점상이 회전해 링을 만듭니다. 축 밖 광원은 단 하나의 자오면에만 속하므로, 그 면이 센서와 만나는 직선 위의 점들만 보입니다.</figcaption>`;
  offsetTopView.querySelector('.top-ray-stage').insertAdjacentElement('afterend', causeFigure);

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
          dash.setAttribute('x1', String(260 + sign * radius - 12)); dash.setAttribute('x2', String(260 + sign * radius + 12));
          dash.setAttribute('y1', '260'); dash.setAttribute('y2', '260'); dash.setAttribute('class', 'mirror-slit-image');
          dash.setAttribute('opacity', String(Math.max(.18, item.intensity))); rings.append(dash);
        });
      });
      const sourceDash = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      sourceDash.setAttribute('x1', '250'); sourceDash.setAttribute('x2', '270'); sourceDash.setAttribute('y1', '260'); sourceDash.setAttribute('y2', '260'); sourceDash.setAttribute('class', 'mirror-slit-image'); rings.append(sourceDash);
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

