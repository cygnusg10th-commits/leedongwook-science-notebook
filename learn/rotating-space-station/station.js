(() => {
  const radius = document.getElementById('station-radius');
  const rpm = document.getElementById('station-rpm');
  if (radius && rpm) {
    const update = () => {
      const r = Number(radius.value), n = Number(rpm.value);
      const v = StationGravity.calculate(r, n);
      document.getElementById('radius-value').textContent = `${r} m`;
      document.getElementById('rpm-value').textContent = `${n.toFixed(3)} rpm`;
      document.getElementById('gravity-value').textContent = `${v.g.toFixed(3)} g`;
      document.getElementById('acceleration-value').textContent = `${v.acceleration.toFixed(3)} m/s²`;
      document.getElementById('period-value').textContent = n === 0 ? '회전 정지' : `한 바퀴 ${v.period.toFixed(1)}초`;
      document.getElementById('speed-value').textContent = `${v.speed.toFixed(2)} m/s`;
      document.getElementById('one-g-value').textContent = `반지름 ${r}m에서 1g를 만들려면 약 ${StationGravity.rpmForG(r).toFixed(3)}rpm이 필요합니다.`;
    };
    [radius, rpm].forEach(x => x.addEventListener('input', update));
    document.getElementById('preset-video').addEventListener('click', () => { radius.value = '103'; rpm.value = '0.764'; update(); });
    document.getElementById('preset-earth').addEventListener('click', () => {
      // Keep the one-g preset inside the displayed control range at small radii.
      if (StationGravity.rpmForG(Number(radius.value)) > Number(rpm.max)) radius.value = '103';
      rpm.value = StationGravity.rpmForG(Number(radius.value)).toFixed(3); update();
    });
    update();
  }
  const video = document.getElementById('station-video');
  const status = document.getElementById('video-status');
  document.querySelectorAll('[data-video-time]').forEach(link => link.addEventListener('click', event => {
    if (!video) return;
    event.preventDefault();
    const time = Number(link.dataset.videoTime);
    const seek = () => {
      video.currentTime = time;
      video.play().catch(() => { status.textContent = '재생 버튼을 누르면 선택한 장면에서 시작합니다.'; });
    };
    if (video.readyState >= 1) seek();
    else { video.addEventListener('loadedmetadata', seek, { once: true }); video.load(); }
    video.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    status.textContent = `${Math.floor(time / 60)}분 ${time % 60}초 장면으로 이동했습니다.`;
  }));
})();
