const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/rolling-wheel-model.js');

const close = (actual, expected, tolerance = 1e-12) => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `expected ${actual} to be within ${tolerance} of ${expected}`
);

test('미끄러짐 없는 구름에서 접지점 속력은 정확히 0이다', () => {
  for (const speed of [0, 5, 16.6667, 60]) {
    const point = model.pointVelocity({ speed, radiusRatio: 1, theta: Math.PI });
    close(point.vx, 0, 1e-12);
    close(point.vy, 0, 1e-12);
    close(point.speed, 0, 1e-12);
  }
});

test('맨 위는 정확히 2v, 중심 높이는 √2 v이다', () => {
  close(model.pointSpeedRatio({ radiusRatio: 1, theta: 0 }), 2);
  close(model.pointSpeedRatio({ radiusRatio: 1, theta: Math.PI / 2 }), Math.SQRT2);
  close(model.pointVelocity({ speed: 60, radiusRatio: 1, theta: 0 }).speed, 120, 1e-12);
});

test('테두리가 아닌 점은 한 순간도 멈추지 않는다', () => {
  close(model.minimumSpeedRatio({ radiusRatio: 0.615 }), 0.385, 1e-12);
  close(model.pointSpeedRatio({ radiusRatio: 0.615, theta: Math.PI }), 0.385, 1e-12);
  close(model.minimumSpeedRatio({ radiusRatio: 0.5 }), 0.5);
  close(model.minimumSpeedRatio({ radiusRatio: 0 }), 1);
  for (const q of [0.2, 0.5, 0.615, 0.9]) {
    for (let i = 0; i <= 360; i += 1) {
      assert.ok(model.pointSpeedRatio({ radiusRatio: q, theta: (i * Math.PI) / 180 }) >= 1 - q - 1e-12);
    }
  }
});

test('반지름보다 바깥의 점(기차 플랜지)은 맨 아래에서 뒤로 간다', () => {
  const flange = model.pointVelocityRatio({ radiusRatio: 1.08, theta: Math.PI });
  close(flange.vx, -0.08, 1e-12);
  close(flange.vy, 0, 1e-12);
});

test('속도장은 순간회전축 둘레의 순수 회전과 일치한다', () => {
  const R = 0.31;
  const v = 16.6667;
  const omega = model.angularSpeed({ speed: v, radius: R });
  for (let i = 0; i < 24; i += 1) {
    const theta = (i / 24) * 2 * Math.PI;
    const point = model.pointVelocity({ speed: v, radiusRatio: 1, theta });
    // 접지점을 원점으로 본 위치 벡터
    const rx = R * Math.sin(theta);
    const ry = R + R * Math.cos(theta);
    // omega 는 -z 방향(시계 방향) → v = omega × r = (omega*ry, -omega*rx)
    close(point.vx, omega * ry, 1e-9);
    close(point.vy, -omega * rx, 1e-9);
  }
});

test('사이클로이드는 접지 순간에만 첨점을 가진다', () => {
  const R = 1;
  const d = 1e-6;
  const derivative = (q, theta) => {
    const a = model.trochoidPoint({ radius: R, radiusRatio: q, theta: theta - d });
    const b = model.trochoidPoint({ radius: R, radiusRatio: q, theta: theta + d });
    return Math.hypot((b.x - a.x) / (2 * d), (b.y - a.y) / (2 * d));
  };
  close(derivative(1, Math.PI), 0, 1e-9);
  assert.ok(derivative(0.615, Math.PI) > 0.38);
  close(model.trochoidPoint({ radius: R, radiusRatio: 1, theta: Math.PI }).y, 0, 1e-12);
});

test('한 아치의 길이 8R은 수치적분과 일치하고 차체보다 27.3% 길다', () => {
  const R = 0.31;
  const steps = 200000;
  let length = 0;
  let previous = model.trochoidPoint({ radius: R, radiusRatio: 1, theta: 0 });
  for (let i = 1; i <= steps; i += 1) {
    const point = model.trochoidPoint({ radius: R, radiusRatio: 1, theta: (i / steps) * 2 * Math.PI });
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  close(length, model.archLength({ radius: R }), 1e-6);
  close(model.pathLengthRatio(), 8 / (2 * Math.PI), 1e-12);
  close(model.pathLengthRatio(), 1.2732395447, 1e-9);
});

test('높이에 따른 속력은 √h에 비례하고 번짐 길이가 본문 표와 맞는다', () => {
  const R = 0.31;
  const v = model.kmhToMs(60);
  const exposure = 1 / 125;
  close(model.speedAtHeight({ speed: v, radius: R, height: 0 }), 0);
  close(model.speedAtHeight({ speed: v, radius: R, height: R }), v * Math.SQRT2, 1e-12);
  close(model.speedAtHeight({ speed: v, radius: R, height: 2 * R }), 2 * v, 1e-12);
  close(model.motionBlurLength({ speed: v, radius: R, height: R, exposure }) * 1000, 188.6, 0.1);
  close(model.motionBlurLength({ speed: v, radius: R, height: 2 * R, exposure }) * 1000, 266.7, 0.1);
  // 테두리 점의 속력식과 높이식이 같은 값을 준다
  for (let i = 0; i <= 180; i += 1) {
    const theta = (i * Math.PI) / 180;
    const height = R + R * Math.cos(theta);
    close(model.speedAtHeight({ speed: 1, radius: R, height }), model.pointSpeedRatio({ radiusRatio: 1, theta }), 1e-9);
  }
});

test('접지점은 속도가 0이어도 가속도는 0이 아니다', () => {
  const R = 0.31;
  const v = model.kmhToMs(60);
  close(model.contactAcceleration({ speed: v, radius: R }), (v * v) / R, 1e-9);
  assert.ok(model.contactAcceleration({ speed: v, radius: R }) > 800);
});

test('균일 원판의 운동에너지는 ¾mv²이고 회전 몫은 1/3이다', () => {
  const energy = model.rollingEnergy({ mass: 2, speed: 3, inertiaFactor: 0.5 });
  close(energy.total, 0.75 * 2 * 9);
  close(energy.rotationShare, 1 / 3, 1e-12);
  close(model.rollingEnergy({ mass: 1, speed: 1, inertiaFactor: 1 }).rotationShare, 0.5, 1e-12);
});

test('잘못된 입력은 RangeError로 막는다', () => {
  assert.throws(() => model.angularSpeed({ speed: 1, radius: 0 }), RangeError);
  assert.throws(() => model.pointSpeedRatio({ radiusRatio: -1, theta: 0 }), RangeError);
  assert.throws(() => model.pointSpeedRatio({ radiusRatio: 1, theta: NaN }), RangeError);
  assert.throws(() => model.trochoidPoint({ radius: -1, radiusRatio: 1, theta: 0 }), RangeError);
  assert.throws(() => model.speedAtHeight({ speed: 1, radius: 1, height: 2.5 }), RangeError);
  assert.throws(() => model.motionBlurLength({ speed: 1, radius: 1, height: 1, exposure: 0 }), RangeError);
  assert.throws(() => model.rollingEnergy({ mass: 0, speed: 1 }), RangeError);
});

test('슬라이더 정의역 전체에서 유한한 값만 나온다', () => {
  for (let kmh = 0; kmh <= 120; kmh += 1) {
    for (let step = 0; step <= 100; step += 1) {
      const q = step / 100;
      for (let i = 0; i < 16; i += 1) {
        const point = model.pointVelocity({ speed: kmh, radiusRatio: q, theta: (i / 16) * 2 * Math.PI });
        assert.ok(Number.isFinite(point.vx) && Number.isFinite(point.vy) && Number.isFinite(point.speed));
        assert.ok(point.speed >= 0);
      }
    }
  }
});
