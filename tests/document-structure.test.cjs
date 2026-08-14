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

console.log(`Document structure: ${pages.length} pages passed.`);
