(() => {
  const video = document.getElementById('jupiter-video');
  const status = document.getElementById('video-status');
  if (!video || !status) return;
  let pendingTime = null;
  let pendingLabel = '';

  const seekAndPlay = () => {
    if (pendingTime === null) return;
    video.currentTime = pendingTime;
    pendingTime = null;
    status.textContent = pendingLabel + '부터 재생합니다.';
    video.play().catch(() => {
      status.textContent = pendingLabel + '로 이동했습니다. 재생 버튼을 눌러 주세요.';
    });
  };
  video.addEventListener('loadedmetadata', seekAndPlay);
  video.addEventListener('error', () => {
    pendingTime = null;
    status.textContent = '영상을 불러오지 못했습니다. 재생기 아래의 영상 파일 링크를 이용해 주세요.';
  });
  document.querySelectorAll('[data-video-time]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const time = Number(link.dataset.videoTime);
      if (!Number.isFinite(time) || time < 0) return;
      event.preventDefault();
      pendingTime = time;
      pendingLabel = `${Math.floor(time / 60)}분 ${Math.floor(time % 60)}초`;
      video.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      video.focus({ preventScroll: true });
      if (video.readyState >= 1) seekAndPlay();
      else { status.textContent = '영상을 불러오는 중입니다.'; video.load(); }
    });
  });
})();
