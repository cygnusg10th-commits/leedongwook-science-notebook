(() => {
  const video=document.querySelector('#strobe-video');
  const status=document.querySelector('#video-status');
  document.querySelectorAll('[data-video-time]').forEach(link=>link.addEventListener('click',async event=>{
    event.preventDefault();
    const time=Number(link.dataset.videoTime);
    if(!Number.isFinite(time))return;
    video.currentTime=time;
    video.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    try{await video.play();status.textContent=link.textContent.trim()+' 장면을 재생합니다.';}
    catch{status.textContent='영상의 재생 버튼을 눌러 주세요.';video.focus();}
  }));
})();
