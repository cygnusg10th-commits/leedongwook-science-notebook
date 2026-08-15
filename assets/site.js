(() => {
  const menuButton = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-site-nav]');

  if (menuButton && nav) {
    const setMenu = (open, { restoreFocus = false } = {}) => {
      nav.dataset.open = String(open);
      menuButton.setAttribute('aria-expanded', String(open));
      if (open) nav.querySelector('a')?.focus();
      else if (restoreFocus) menuButton.focus();
    };
    menuButton.addEventListener('click', () => setMenu(nav.dataset.open !== 'true'));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.dataset.open === 'true') setMenu(false, { restoreFocus: true });
    });
    document.addEventListener('click', event => {
      if (nav.dataset.open === 'true' && !nav.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
    });
  }

  document.querySelectorAll('[data-share]').forEach(button => {
    button.addEventListener('click', async () => {
      const data = { title: document.title, text: '과학 수첩에서 직접 확인해 보세요.', url: location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else {
          await navigator.clipboard.writeText(location.href);
          button.setAttribute('aria-label', '링크가 복사되었습니다');
          button.textContent = '✓';
          setTimeout(() => { button.setAttribute('aria-label', '공유'); button.textContent = '↗'; }, 1600);
        }
      } catch (error) {
        if (error.name !== 'AbortError') button.setAttribute('title', '공유하지 못했습니다');
      }
    });
  });

  const contentCards = [...document.querySelectorAll('[data-content-card]')];
  const contentSearch = document.querySelector('[data-content-search]');
  const searchCount = document.querySelector('[data-search-count]');
  function applyContentFilters() {
    if (!contentCards.length) return;
    const active = document.querySelector('[data-filter].active');
    const filter = active?.dataset.filter || 'all';
    const query = contentSearch?.value.trim().toLocaleLowerCase('ko') || '';
    let visible = 0;
    contentCards.forEach(card => {
      const tags = (card.dataset.tags || '').split(' ');
      const filterMatch = filter === 'all' || tags.includes(filter);
      const searchMatch = !query || card.textContent.toLocaleLowerCase('ko').includes(query);
      card.hidden = !(filterMatch && searchMatch);
      if (!card.hidden) visible += 1;
    });
    if (searchCount) searchCount.textContent = query ? `${visible}개의 콘텐츠를 찾았습니다.` : `전체 ${visible}개 콘텐츠`;
  }
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    const group = button.closest('[data-filter-group]');
    if (!group) return;
    group.querySelectorAll('[data-filter]').forEach(item => { item.classList.remove('active'); item.setAttribute('aria-pressed', 'false'); });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    applyContentFilters();
  }));
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
  if (contentSearch) contentSearch.addEventListener('input', applyContentFilters);
  applyContentFilters();
})();
