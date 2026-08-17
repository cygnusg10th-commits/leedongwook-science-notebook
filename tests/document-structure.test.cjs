const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const pages = walk(root).filter(file => file.endsWith('.html') && path.basename(file) !== '404.html');
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  const h1s = [...html.matchAll(/<h1(?:\s[^>]*)?>/g)];
  assert.equal(h1s.length, 1, `${rel}: expected one h1, found ${h1s.length}`);
  assert.match(html, /<title>[^<]+<\/title>/, `${rel}: missing title`);
  assert.match(html, /<main(?:\s[^>]*)?>/, `${rel}: missing main landmark`);
  assert.match(html, /<nav[^>]+aria-label=/, `${rel}: nav needs aria-label`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `${rel}: duplicate ids`);

  const ranges = [...html.matchAll(/<input[^>]+type="range"[^>]*>/g)].map(match => match[0]);
  for (const range of ranges) {
    const id = range.match(/id="([^"]+)"/)?.[1];
    const hasAria = /aria-label=/.test(range);
    const hasLabel = id && new RegExp(`<label[^>]+for="${id}"`).test(html);
    assert.ok(hasAria || hasLabel, `${rel}: range ${id || '(no id)'} needs a label`);
  }
}

const lessonHtml = fs.readFileSync(path.join(root, 'learn', 'falling-target', 'index.html'), 'utf8');
const playButtonTag = lessonHtml.match(/<button[^>]+id="playButton"[^>]*>/)?.[0] || '';
assert.doesNotMatch(playButtonTag, /\sdisabled(?:\s|>)/, 'play button must remain tappable when a prediction is missing');
assert.doesNotMatch(playButtonTag, /aria-disabled=/, 'play button should be exposed as an actionable guidance control');
assert.match(lessonHtml, /id="playGuidance"[^>]+role="status"/, 'mobile play guidance is missing');
assert.match(lessonHtml, /falling-target\.js\?v=[^"\s]+/, 'simulation script needs a cache-busting version');


// ── 사이트 전역 불변식 ───────────────────────────────────────────
const versions = new Map();
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);

  // 모든 페이지에 공통 푸터와 모바일 내비가 있어야 합니다
  assert.match(html, /class="site-footer"/, `${rel}: 공통 푸터가 없습니다`);
  assert.match(html, /class="mobile-nav"/, `${rel}: 모바일 하단 내비가 없습니다`);

  // 로컬 자산은 캐시 무효화 버전을 달고, 같은 파일이면 같은 버전이어야 합니다
  for (const match of html.matchAll(/(?:href|src)="(?:\.\.\/)*assets\/([a-z0-9.-]+\.(?:css|js))(\?v=([^"]+))?"/g)) {
    const [, asset, , version] = match;
    assert.ok(version, `${rel}: assets/${asset}에 ?v= 가 없습니다`);
    if (!versions.has(asset)) versions.set(asset, { version, rel });
    else assert.equal(version, versions.get(asset).version,
      `assets/${asset}의 버전이 갈립니다: ${rel}=${version} vs ${versions.get(asset).rel}=${versions.get(asset).version}`);
  }

  // aria-current="page"는 정말로 그 페이지를 가리키는 링크에만 씁니다.
  // 이 페이지가 속한 상위 구역을 가리킬 때는 "true"를 씁니다.
  const dir = path.dirname(rel).split(path.sep).filter(Boolean);
  for (const match of html.matchAll(/<a\s+href="([^"]+)"[^>]*aria-current="page"/g)) {
    const href = match[1];
    const target = path.normalize(path.join(path.dirname(rel), href.replace(/[?#].*$/, '')));
    const self = path.normalize(path.dirname(rel) + path.sep);
    assert.ok(target === self || target === path.normalize(rel) || href === './',
      `${rel}: aria-current="page"가 다른 곳(${href})을 가리킵니다. 상위 구역이면 "true"를 쓰세요`);
  }
  void dir;

  // 인라인 SVG에는 접근 가능한 이름이 있어야 하거나, 장식이라면 숨겨야 합니다
  for (const tag of html.match(/<svg\b[^>]*>/g) || []) {
    assert.ok(/aria-hidden="true"|aria-label=|aria-labelledby=|role="presentation"/.test(tag),
      `${rel}: 이름 없는 SVG가 있습니다 — aria-label 또는 aria-hidden이 필요합니다`);
  }
}

// 포커스 표시는 반투명이면 대비가 무너집니다
const css = fs.readFileSync(path.join(root, 'assets', 'site.css'), 'utf8');
const focusRule = css.match(/:focus-visible\s*\{[^}]*\}/)?.[0] || '';
assert.doesNotMatch(focusRule, /rgba\(/, '포커스 링에 반투명 색을 쓰면 배경에 따라 대비가 3:1 아래로 내려갑니다');
assert.match(css, /\[id\]\s*\{[^}]*scroll-margin-top/, 'sticky 헤더에 앵커가 가리지 않도록 scroll-margin-top이 필요합니다');
assert.match(css, /mjx-container\s*\{[^}]*overflow-x/, '수식이 좁은 화면에서 문서 폭을 밀어내지 않도록 전역 가드가 필요합니다');

console.log(`Document structure: ${pages.length} pages passed.`);
