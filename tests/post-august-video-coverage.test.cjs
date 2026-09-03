const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const coverage = {
  'surfing-physics': ['dXDB1cSFF_I', 'pLlps6JSRko'],
  'dried-squid': ['CkUGZbmZJwk', 'IeMSeTIZXTs'],
  'electric-fly-swatter': ['0me9Id_2bls'],
  'mosquito-rain': ['AlevGIARWIk'],
  'innate-immune-cells': ['ula8lz3poUo', 'bxY4_CLSr8U', 'SwJkSlsTdFM'],
  'brain-learning': ['jh5sHIl8jvE'],
  'three-body-chaos': ['xHkRDtnQovg'],
  'human-computer': ['BNbLsyMGqRU'],
  'rutherford-atom': ['-WHMh7RaaGo'],
};

test('8월 6일 이후 누락됐던 쇼츠 13편이 심화 문서에 모두 연결된다', () => {
  const seen = [];
  for (const [slug, videoIds] of Object.entries(coverage)) {
    const file = path.join(root, 'learn', slug, 'index.html');
    assert.ok(fs.existsSync(file), `${slug}: 문서가 없습니다`);
    const html = fs.readFileSync(file, 'utf8');
    for (const videoId of videoIds) {
      assert.match(html, new RegExp(`youtube-nocookie\\.com/embed/${videoId.replace('-', '\\-')}`),
        `${slug}: ${videoId} 영상 연결이 없습니다`);
      seen.push(videoId);
    }
  }
  assert.equal(seen.length, 13);
  assert.equal(new Set(seen).size, 13);
});
