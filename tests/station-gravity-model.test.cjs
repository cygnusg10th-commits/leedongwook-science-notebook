const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, rpmForG } = require('../learn/rotating-space-station/gravity-model.js');
test('영상의 R=103m, ω=0.08rad/s는 0.6592m/s²다', () => {
  const v = calculate(103, .08 * 30 / Math.PI);
  assert.ok(Math.abs(v.acceleration - .6592) < 1e-12);
  assert.ok(Math.abs(v.period - 2 * Math.PI / .08) < 1e-10);
  assert.ok(Math.abs(v.speed - 8.24) < 1e-12);
});
test('회전수가 두 배면 가속도는 네 배, 반지름이 두 배면 두 배다', () => {
  assert.equal(calculate(100, 2).acceleration, 4 * calculate(100, 1).acceleration);
  assert.equal(calculate(200, 1).acceleration, 2 * calculate(100, 1).acceleration);
});
test('1g 역산은 반지름에 관계없이 1g로 돌아온다', () => {
  for (const r of [20, 103, 300]) assert.ok(Math.abs(calculate(r, rpmForG(r)).g - 1) < 1e-12);
});
test('회전 정지에서는 가속도와 속도가 0이고 주기는 무한대다', () => {
  assert.deepEqual(calculate(103, 0), { omega: 0, acceleration: 0, g: 0, speed: 0, period: Infinity });
  assert.throws(() => calculate(0, 1), RangeError);
  assert.throws(() => calculate(103, -1), RangeError);
});
