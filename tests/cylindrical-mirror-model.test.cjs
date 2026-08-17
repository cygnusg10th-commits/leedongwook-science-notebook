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


test('축 이탈 점열은 좌우 대칭이고 차수마다 짝이 있다', () => {
  for (const nMax of [1, 2, 3, 4, 8]) {
    const points = model.offsetPointImages({ R: 1, L: 8, s: .5, nMax });
    assert.equal(points.length, 2 * nMax + 1, `nMax=${nMax}: 직접상 1개 + 차수마다 2개`);
    for (let n = 1; n <= nMax; n += 1) {
      const pair = points.filter(point => point.n === n);
      assert.equal(pair.length, 2, `nMax=${nMax}: n=${n}의 짝이 잘렸습니다`);
      // 두 상은 광원(s)을 기준으로 반대쪽에 같은 거리만큼 놓입니다
      assert.ok(Math.abs((pair[0].uOverR + pair[1].uOverR) - 2 * (n % 2 ? -.5 : .5)) < 1e-12);
    }
    const orders = points.map(point => point.n);
    assert.deepEqual([...orders].sort((a, b) => a - b), orders.slice().sort((a, b) => a - b));
  }
});

test('같은 자리에 상이 두 번 생기지 않는다', () => {
  const positions = model.offsetPointImages({ R: 1, L: 8, s: .5, nMax: 8 }).map(point => point.uOverR);
  assert.equal(new Set(positions).size, positions.length, '중복된 위치가 있습니다');
});

test('반사 차수는 관찰자에서 상까지 지나치는 벽의 수와 같다', () => {
  // 벽은 u = ±R, ±3R, ±5R … 에 있습니다. 관찰자는 u = 0.
  for (const s of [-.8, -.3, 0, .25, .5, .9]) {
    for (const point of model.offsetPointImages({ R: 1, L: 8, s, nMax: 6 })) {
      const crossings = Math.floor((Math.abs(point.uOverR) + 1) / 2);
      assert.equal(point.n, crossings, `s=${s}, u=${point.uOverR}: 차수가 벽 통과 수와 다릅니다`);
    }
  }
});

test('밝기는 차수만으로 정해지고 좌우가 같다', () => {
  const points = model.offsetPointImages({ R: 1, L: 8, s: .5, nMax: 5, rho: .9 });
  for (const point of points) assert.ok(Math.abs(point.intensity - .9 ** point.n) < 1e-12);
  const left = points.filter(point => point.uOverR < .5).map(point => point.intensity).sort();
  const right = points.filter(point => point.uOverR > .5).map(point => point.intensity).sort();
  assert.deepEqual(left, right, '좌우 밝기 분포가 다릅니다');
});

test('잘못된 입력은 RangeError로 막는다', () => {
  assert.throws(() => model.offsetPointImages({ R: 0, L: 8, s: 0, nMax: 4 }), RangeError);
  assert.throws(() => model.offsetPointImages({ R: 1, L: 0, s: 0, nMax: 4 }), RangeError);
  assert.throws(() => model.offsetPointImages({ R: 1, L: 8, s: 1, nMax: 4 }), RangeError);
  assert.throws(() => model.offsetPointImages({ R: 1, L: 8, s: 0, nMax: 0 }), RangeError);
  assert.throws(() => model.offsetPointImages({ R: 1, L: 8, s: 0, nMax: 2.5 }), RangeError);
  assert.throws(() => model.offsetPointImages({ R: 1, L: 8, s: 0, nMax: 4, rho: 'abc' }), RangeError);
  assert.throws(() => model.offsetPointImages({ R: 1, L: 8, s: 0, nMax: 4, rho: 1.2 }), RangeError);
  assert.throws(() => model.ringRadiusRatio({ R: 1, L: 8, n: -1 }), RangeError);
  assert.throws(() => model.halfBrightnessOrder(1), RangeError);
});
