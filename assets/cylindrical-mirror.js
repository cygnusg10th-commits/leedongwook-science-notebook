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
    data.forEach(item => {
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
    });
    const step = (2 * state.R) / state.L;
    spacing.textContent = `${step.toFixed(3)} f`;
    half.textContent = state.rho < 1 ? `약 ${model.halfBrightnessOrder(state.rho).toFixed(1)}회` : '감쇠 없음';
    status.textContent = `최대 n=${state.nMax}, 바깥 고리 반지름은 화면 초점거리 f의 ${(state.nMax * step).toFixed(2)}배입니다.`;
  }
  Object.values(controls).forEach(input => input.addEventListener('input', render));
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

