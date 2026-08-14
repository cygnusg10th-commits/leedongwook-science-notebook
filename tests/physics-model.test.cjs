const assert = require('node:assert/strict');
const { calculate } = require('../assets/falling-target-model.js');

function close(actual, expected, tolerance = 1e-6, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

const cases = [
  { input: { distance: 20, height: 20, speed: 20 }, event: 'air-hit', min: 14, hitTime: 1.414213562, hitHeight: 10.2 },
  { input: { distance: 20, height: 20, speed: 14 }, event: 'ground-simultaneous', min: 14, hitTime: 2.020305089, hitHeight: 0 },
  { input: { distance: 20, height: 20, speed: 14.01 }, event: 'air-hit', min: 14, hitTime: 2.018863, hitHeight: 0.028541 },
  { input: { distance: 20, height: 20, speed: 13.99 }, event: 'projectile-ground', min: 14, impactTime: 2.018862 },
  { input: { distance: 20, height: 20, speed: 10 }, event: 'projectile-ground', min: 14, impactTime: 1.443075063, impactX: 10.204081633 },
  { input: { distance: 30, height: 10, speed: 25 }, event: 'air-hit', min: 22.135943621, hitTime: 1.264911064, hitHeight: 2.16 },
  { input: { distance: 30, height: 10, speed: 20 }, event: 'projectile-ground', min: 22.135943621, impactTime: 1.290725576 },
  { input: { distance: 10, height: 30, speed: 15 }, event: 'air-hit', min: 12.780193, hitTime: 2.108185107, hitHeight: 8.222222222 },
  { input: { distance: 10, height: 30, speed: 12 }, event: 'projectile-ground', min: 12.780193, impactTime: 2.323306 },
];

for (const test of cases) {
  const model = calculate(test.input);
  assert.equal(model.event, test.event, JSON.stringify(test.input));
  close(model.minimumSpeed, test.min, 1e-6, 'minimumSpeed');
  if (test.hitTime !== undefined) close(model.hitTime, test.hitTime, 1e-6, 'hitTime');
  if (test.hitHeight !== undefined) close(model.hitHeight, test.hitHeight, 1e-6, 'hitHeight');
  if (test.impactTime !== undefined) close(model.endTime, test.impactTime, 1e-6, 'impactTime');
  if (test.impactX !== undefined) close(model.impactX, test.impactX, 1e-6, 'impactX');

  const midpoint = model.positions(model.endTime * 0.5);
  close(midpoint.projectileNoGravity.y - midpoint.projectile.y, midpoint.gravityDrop, 1e-9, 'projectile gravity drop');
  close(midpoint.targetNoGravity.y - midpoint.target.y, midpoint.gravityDrop, 1e-9, 'target gravity drop');
}

assert.throws(() => calculate({ distance: 0, height: 20, speed: 20 }), RangeError);
console.log(`Physics model: ${cases.length} cases passed.`);
