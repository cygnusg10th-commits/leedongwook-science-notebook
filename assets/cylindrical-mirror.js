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
  let mode = 'center';

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

