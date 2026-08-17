const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const htmlFiles = walk(root).filter(file => file.endsWith('.html'));
const failures = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<meta name="viewport"/);
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  // 404.html은 없는 경로 어디에서나 서빙되므로 상대경로를 쓸 수 없습니다.
  // 루트 절대경로를 두고 스크립트가 프로젝트 경로에 맞게 고쳐 씁니다.
  const allowsRootAbsolute = path.basename(file) === '404.html';
  for (const ref of refs) {
    if (/^(?:https?:|mailto:|#|javascript:)/.test(ref)) continue;
    if (allowsRootAbsolute && ref.startsWith('/')) continue;
    assert.ok(!ref.startsWith('/'),
      `${path.relative(root, file)}: 루트 절대경로 ${ref} — GitHub Pages 프로젝트 경로에서 깨집니다`);
    const clean = ref.split(/[?#]/)[0];
    if (!clean) continue;
    let target = path.resolve(path.dirname(file), clean);
    if (clean.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) failures.push(`${path.relative(root, file)} -> ${ref}`);
  }
}

assert.deepEqual(failures, [], `Broken local references:\n${failures.join('\n')}`);
console.log(`Site links: ${htmlFiles.length} HTML files passed.`);
