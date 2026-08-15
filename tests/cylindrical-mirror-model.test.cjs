const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/cylindrical-mirror-model.js');

test('검증 벡터의 닫힌 해를 재현한다', () => {
  const cases = [[1, 8, 8, 2], [1, 4, 4, 2], [1, 12, 8, 4 / 3], [2, 10, 5, 2], [.5, 6, 10, 5 / 3], [3, 3, 1, 2]];
  for (const [R, L, n, expected] of cases) {
    assert.ok(Math.abs(model.ringRadiusRatio({ R, L, n }) - expected) <= 1e-12);
  }
});

test('고리 반지름은 반사 차수 n에 선형이다', () => {
  const radii = model.images({ R: 1, L: 8, nMax: 8 }).map(image => image.radiusOverF);
  for (let n = 1; n < radii.length; n += 1) {
    assert.ok(Math.abs((radii[n] - radii[n - 1]) - .25) <= 1e-12);
  }
});

test('밝기는 rho의 n제곱으로 감쇠한다', () => {
  const images = model.images({ R: 1, L: 8, nMax: 4, rho: .96 });
  assert.equal(images[4].intensity, .96 ** 4);
  assert.ok(Math.abs(model.halfBrightnessOrder(.96) - 16.98) < .02);
});

test('R/2 축 이탈 점광원은 1R, 3R 교대 점열을 만든다', () => {
  const points = model.offsetPointImages({ R: 1, L: 8, s: .5, nMax: 4 }).map(point => point.uOverR);
  const visible = [...new Set(points)].sort((a, b) => a - b);
  const gaps = visible.slice(1).map((value, index) => Number((value - visible[index]).toFixed(6)));
  assert.ok(gaps.includes(1));
  assert.ok(gaps.includes(3));
});

