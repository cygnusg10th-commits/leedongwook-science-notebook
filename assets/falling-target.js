(() => {
  const modelApi = window.FallingTargetModel;
  if (!modelApi) return;

  const $ = selector => document.querySelector(selector);
  const svgNS = 'http://www.w3.org/2000/svg';
  const elements = {
    svg: $('#simulationSvg'), stage: $('.sim-stage'), aim: $('#aimLine'), projectilePath: $('#projectilePath'),
    targetPath: $('#targetPath'), projectile: $('#projectile'), target: $('#target'), targetStart: $('#targetStart'),
    projectileLabel: $('#projectileLabel'), targetLabel: $('#targetLabel'), ground: $('#groundLine'),
    eventMarker: $('#eventMarker'), markers: $('#timeMarkers'), gravityGuides: $('#gravityGuides'),
    play: $('#playButton'), pause: $('#pauseButton'), reset: $('#resetButton'), speed: $('#speedRange'),
    height: $('#heightRange'), distance: $('#distanceRange'), speedValue: $('#speedValue'), heightValue: $('#heightValue'),
    distanceValue: $('#distanceValue'), timeValue: $('#timeValue'), projectileHeight: $('#projectileHeight'),
    targetHeight: $('#targetHeight'), result: $('#resultCard'), resultIcon: $('#resultIcon'), resultTitle: $('#resultTitle'),
    resultText: $('#resultText'), status: $('#simLiveStatus'), conditionStatus: $('#conditionStatus'), predictionReview: $('#predictionReview'),
    predictionConditions: $('#predictionConditions'), predictionFeedback: $('#predictionFeedback'),
    predictionPanel: $('.prediction-panel'), playGuidance: $('#playGuidance'),
    progress: [...document.querySelectorAll('.progress span')],
  };

  const toggles = { trajectory: true, aim: true, markers: false, xy: false };
  let playbackRate = 0.5;
  let currentTime = 0;
  let playing = false;
  let frameId = null;
  let previousTimestamp = null;
  let completed = false;
  let prediction = null;
  let predictionText = '';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const postExperiment = $('#postExperiment');
  if (postExperiment) postExperiment.hidden = true;

  function settings() {
    return {
      distance: Number(elements.distance.value),
      height: Number(elements.height.value),
      speed: Number(elements.speed.value),
      gravity: 9.8,
    };
  }

  function getModel() { return modelApi.calculate(settings()); }

  function dimensions(model) {
    const left = 64, right = 750, top = 36, ground = 402;
    const scale = Math.min((right - left) / (model.distance * 1.12), (ground - top) / (model.height * 1.12));
    return { left, right, top, ground, scale };
  }

  function mapPoint(point, model) {
    const d = dimensions(model);
    return {
      x: d.left + point.x * d.scale,
      y: d.ground - point.y * d.scale,
    };
  }

  function setLine(line, a, b) {
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
  }

  function makePath(model, objectName, until) {
    const points = [];
    const count = Math.max(2, Math.ceil(80 * (until / Math.max(model.endTime, .001))));
    for (let i = 0; i <= count; i += 1) {
      const t = until * (i / count);
      const state = model.positions(t);
      const p = mapPoint(state[objectName], model);
      points.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    }
    return points.join(' ');
  }

  function renderMarkers(model, until) {
    elements.markers.replaceChildren();
    if (!toggles.markers || until <= 0) return;
    const interval = model.endTime > 2.5 ? .5 : .25;
    for (let t = interval; t < until + 1e-7; t += interval) {
      const state = model.positions(Math.min(t, until));
      const p = mapPoint(state.projectile, model);
      const target = mapPoint(state.target, model);
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y); circle.setAttribute('r', '4'); circle.setAttribute('fill', '#315fdb');
      const square = document.createElementNS(svgNS, 'rect');
      square.setAttribute('x', target.x - 4); square.setAttribute('y', target.y - 4); square.setAttribute('width', '8'); square.setAttribute('height', '8'); square.setAttribute('fill', '#d97706');
      elements.markers.append(circle, square);
    }
  }

  function renderGravityGuides(model, state) {
    elements.gravityGuides.replaceChildren();
    if (!toggles.xy || state.time <= 0) return;
    const pairs = [
      [state.projectileNoGravity, state.projectile, '발사체에 의한 중력 변화'],
      [state.targetNoGravity, state.target, '표적에 의한 중력 변화'],
    ];
    pairs.forEach(([from, to, label], index) => {
      const a = mapPoint(from, model); const b = mapPoint(to, model);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('stroke', '#813866'); line.setAttribute('stroke-width', '3'); line.setAttribute('marker-end', 'url(#gravityArrow)');
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', a.x + (index ? -210 : 10)); text.setAttribute('y', (a.y + b.y) / 2); text.setAttribute('fill', '#6b3055'); text.setAttribute('font-size', '12'); text.textContent = '중력 없을 때보다 같은 거리만큼 아래';
      elements.gravityGuides.append(line, text);
    });
  }

  function render() {
    const model = getModel();
    currentTime = Math.min(currentTime, model.endTime);
    const state = model.positions(currentTime);
    const d = dimensions(model);
    const launch = mapPoint({ x: 0, y: 0 }, model);
    const targetInitial = mapPoint({ x: model.distance, y: model.height }, model);
    const projectile = mapPoint(state.projectile, model);
    const target = mapPoint(state.target, model);

    setLine(elements.ground, { x: d.left - 25, y: d.ground }, { x: d.right + 10, y: d.ground });
    setLine(elements.aim, launch, targetInitial);
    elements.aim.hidden = !toggles.aim;
    elements.projectilePath.setAttribute('d', toggles.trajectory ? makePath(model, 'projectile', currentTime) : '');
    elements.targetPath.setAttribute('d', toggles.trajectory ? makePath(model, 'target', currentTime) : '');
    elements.projectile.setAttribute('cx', projectile.x); elements.projectile.setAttribute('cy', projectile.y);
    elements.target.setAttribute('cx', target.x); elements.target.setAttribute('cy', target.y);
    elements.targetStart.setAttribute('cx', targetInitial.x); elements.targetStart.setAttribute('cy', targetInitial.y);
    elements.projectileLabel.setAttribute('x', Math.min(projectile.x + 13, 700)); elements.projectileLabel.setAttribute('y', Math.max(projectile.y - 11, 20));
    elements.targetLabel.setAttribute('x', Math.min(target.x + 18, 700)); elements.targetLabel.setAttribute('y', Math.max(target.y - 12, 20));
    renderMarkers(model, currentTime);
    renderGravityGuides(model, state);

    elements.timeValue.textContent = `${state.time.toFixed(2)} s`;
    elements.projectileHeight.textContent = `${state.projectile.y.toFixed(1)} m`;
    elements.targetHeight.textContent = `${state.target.y.toFixed(1)} m`;
    elements.speedValue.textContent = model.speed.toFixed(1);
    elements.heightValue.textContent = model.height.toFixed(0);
    elements.distanceValue.textContent = model.distance.toFixed(0);
    elements.conditionStatus.textContent = `높이 ${model.height.toFixed(0)}m · 거리 ${model.distance.toFixed(0)}m`;
    elements.predictionConditions.textContent = `높이 ${model.height.toFixed(0)}m · 수평거리 ${model.distance.toFixed(0)}m · 발사 속력 ${model.speed.toFixed(1)}m/s`;

    const eventPoint = mapPoint({ x: model.impactX, y: model.eventHeight }, model);
    elements.eventMarker.setAttribute('cx', eventPoint.x); elements.eventMarker.setAttribute('cy', eventPoint.y);
    elements.eventMarker.hidden = !completed;
  }

  function setResult(kind, title, text, icon) {
    elements.result.className = `result-card ${kind}`;
    elements.resultIcon.textContent = icon;
    elements.resultTitle.textContent = title;
    elements.resultText.textContent = text;
  }

  function announce(message) { elements.status.textContent = message; }

  function setPlayReady(ready, message) {
    elements.play.setAttribute('aria-disabled', String(!ready));
    elements.play.classList.toggle('needs-prediction', !ready);
    if (!playing) elements.play.textContent = ready ? (reducedMotion ? '↦ 다음 장면' : '▶ 재생') : '↑ 예상 선택 필요';
    elements.playGuidance.textContent = message;
    elements.playGuidance.classList.toggle('ready', ready);
  }

  function requestPrediction() {
    const message = '재생하려면 위에서 결과를 먼저 예상해 주세요.';
    elements.predictionFeedback.textContent = message;
    elements.predictionPanel.classList.add('attention');
    elements.predictionPanel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => {
      document.querySelector('.prediction-option')?.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 400);
    announce(message);
  }

  function clearPrediction(message) {
    prediction = null;
    predictionText = '';
    document.querySelectorAll('.prediction-option').forEach(item => { item.classList.remove('selected'); item.setAttribute('aria-pressed', 'false'); });
    elements.predictionReview.hidden = true;
    elements.predictionFeedback.textContent = message;
    setPlayReady(false, message);
  }

  function setProgress(completedSteps) {
    elements.progress.forEach((step, index) => {
      step.classList.toggle('active', index < completedSteps);
      step.removeAttribute('aria-current');
    });
    elements.progress[Math.max(0, Math.min(completedSteps - 1, elements.progress.length - 1))]?.setAttribute('aria-current', 'step');
  }

  function finish() {
    const model = getModel();
    currentTime = model.endTime;
    playing = false;
    completed = true;
    previousTimestamp = null;
    elements.play.textContent = reducedMotion ? '↦ 처음 장면부터' : '▶ 다시 재생';
    elements.pause.disabled = true;
    if (postExperiment) postExperiment.hidden = false;
    if (model.event === 'air-hit') {
      const title = '공중에서 만났습니다';
      const text = `${model.hitTime.toFixed(2)}초 후, 지상 ${model.hitHeight.toFixed(1)}m에서 만납니다. 같은 시간 동안 중력은 두 물체의 위치를 각자의 중력 없는 경로보다 같은 만큼 아래로 바꿉니다.`;
      setResult('success', title, text, '✓'); announce(title);
    } else if (model.event === 'ground-simultaneous') {
      const title = '지면과 동시에 도달했습니다';
      const text = `약 ${model.endTime.toFixed(2)}초 후 지면에서 만납니다. 공중에서 만난 것으로 처리하지 않습니다.`;
      setResult('warning', title, text, '△'); announce(title);
    } else {
      const state = model.positions(model.endTime);
      const title = '발사체가 먼저 지면에 닿았습니다';
      const text = `${model.endTime.toFixed(2)}초에 수평거리 ${state.projectile.x.toFixed(1)}m에서 지면에 닿았습니다. 방향 관계는 맞지만 속력이 충분하지 않습니다.`;
      setResult('warning', title, text, '!'); announce(title);
    }
    setProgress(5);
    if (prediction) {
      const labels = { 'air-hit': '공중에서 만난다', 'projectile-ground': '발사체가 먼저 지면에 닿는다', 'ground-simultaneous': '지면과 동시에 도달한다' };
      const correct = prediction === model.event;
      elements.predictionReview.hidden = false;
      elements.predictionReview.innerHTML = `<b>내 예상:</b> ${predictionText}<br /><b>실험 결과:</b> ${labels[model.event]}<br />${correct ? '예상과 결과가 같았습니다.' : '예상과 결과가 달랐습니다. 조건과 중력의 영향을 다시 살펴보세요.'}`;
    } else {
      elements.predictionReview.hidden = true;
    }
    render();
  }

  function frame(timestamp) {
    if (!playing) return;
    if (previousTimestamp === null) previousTimestamp = timestamp;
    const delta = Math.min((timestamp - previousTimestamp) / 1000, .05);
    previousTimestamp = timestamp;
    currentTime += delta * playbackRate;
    const model = getModel();
    if (currentTime >= model.endTime) { finish(); return; }
    render();
    frameId = requestAnimationFrame(frame);
  }

  function reset({ announceReset = true } = {}) {
    if (frameId) cancelAnimationFrame(frameId);
    currentTime = 0; playing = false; completed = false; frameId = null; previousTimestamp = null;
    elements.play.textContent = reducedMotion ? '↦ 다음 장면' : '▶ 재생';
    elements.pause.disabled = true;
    setResult('', '예상한 뒤 재생해 보세요', '발사체와 표적이 시간에 따라 어떻게 움직이는지 살펴보세요.', '•');
    elements.predictionReview.hidden = true;
    setProgress(1);
    if (announceReset) announce('처음 상태로 돌아왔습니다.');
    render();
  }

  function play() {
    if (!prediction) { requestPrediction(); return; }
    const model = getModel();
    if (reducedMotion) {
      if (completed) reset({ announceReset: false });
      currentTime = Math.min(currentTime + model.endTime / 4, model.endTime);
      if (currentTime >= model.endTime) finish();
      else { render(); announce(`${currentTime.toFixed(2)}초 장면입니다.`); }
      return;
    }
    if (completed) reset({ announceReset: false });
    if (playing) return;
    playing = true; previousTimestamp = null; elements.play.textContent = '재생 중'; elements.pause.disabled = false;
    setProgress(2);
    announce('재생을 시작했습니다.');
    frameId = requestAnimationFrame(frame);
  }

  function pause() {
    if (!playing) return;
    playing = false; previousTimestamp = null; elements.play.textContent = '▶ 이어서'; elements.pause.disabled = true;
    if (frameId) cancelAnimationFrame(frameId);
    announce(`${currentTime.toFixed(2)}초에서 정지했습니다.`);
  }

  elements.play.addEventListener('click', play);
  elements.pause.addEventListener('click', pause);
  elements.reset.addEventListener('click', () => reset());
  [elements.speed, elements.height, elements.distance].forEach(input => input.addEventListener('input', () => {
    pause(); reset({ announceReset: false }); clearPrediction('조건이 바뀌었습니다. 새 결과를 먼저 예상해 보세요.'); render(); announce('조건을 변경했습니다. 새 결과를 예상한 뒤 확인해 보세요.');
  }));

  document.querySelectorAll('[data-playback]').forEach(button => button.addEventListener('click', () => {
    playbackRate = Number(button.dataset.playback);
    document.querySelectorAll('[data-playback]').forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
    announce(`재생 배속을 ${playbackRate}배로 바꿨습니다.`);
  }));

  document.querySelectorAll('[data-toggle-view]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.toggleView;
    toggles[key] = !toggles[key];
    button.classList.toggle('active', toggles[key]);
    button.setAttribute('aria-pressed', String(toggles[key]));
    render();
  }));

  document.querySelectorAll('.prediction-option').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.prediction-option').forEach(item => { item.classList.remove('selected'); item.setAttribute('aria-pressed', 'false'); });
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
    prediction = button.dataset.prediction; predictionText = button.textContent.trim();
    elements.predictionPanel.classList.remove('attention');
    setPlayReady(true, '예상 완료. 재생을 눌러 결과를 확인하세요.');
    setProgress(1);
    elements.predictionFeedback.textContent = '예상을 선택했습니다. 아직 정답은 보여드리지 않을게요. 직접 재생해 확인해 보세요.';
  }));

  document.querySelectorAll('.quiz-option').forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const item = button.closest('.quiz-item');
      item.querySelectorAll('.quiz-option').forEach(option => { option.classList.remove('correct', 'incorrect'); option.setAttribute('aria-pressed', 'false'); });
      const correct = button.dataset.correct === 'true';
      button.classList.add(correct ? 'correct' : 'incorrect');
      button.setAttribute('aria-pressed', 'true');
      item.querySelector('.quiz-feedback').textContent = correct ? button.dataset.feedback : `다시 생각해 보세요. ${button.dataset.hint}`;
    });
  });

  reset({ announceReset: false });
  clearPrediction('예상 하나를 선택하면 재생할 수 있습니다.');
})();
