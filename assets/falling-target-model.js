(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FallingTargetModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EPSILON = 1e-6;

  function calculate({ distance, height, speed, gravity = 9.8 }) {
    const D = Number(distance);
    const H = Number(height);
    const v = Number(speed);
    const g = Number(gravity);
    if (![D, H, v, g].every(Number.isFinite) || D <= 0 || H <= 0 || v <= 0 || g <= 0) {
      throw new RangeError('거리, 높이, 속력, 중력은 0보다 큰 유한한 값이어야 합니다.');
    }

    const range = Math.hypot(D, H);
    const angle = Math.atan2(H, D);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hitTime = range / v;
    const hitHeight = H - 0.5 * g * hitTime * hitTime;
    const targetGroundTime = Math.sqrt((2 * H) / g);
    const projectileGroundTime = (2 * v * sin) / g;
    const minimumSpeed = range * Math.sqrt(g / (2 * H));

    let event;
    let endTime;
    if (Math.abs(v - minimumSpeed) <= EPSILON || Math.abs(hitHeight) <= EPSILON) {
      event = 'ground-simultaneous';
      endTime = targetGroundTime;
    } else if (v > minimumSpeed) {
      event = 'air-hit';
      endTime = hitTime;
    } else {
      event = 'projectile-ground';
      endTime = projectileGroundTime;
    }

    const impactX = event === 'projectile-ground' ? v * cos * endTime : D;
    const eventHeight = event === 'air-hit' ? hitHeight : 0;

    function positions(time) {
      const t = Math.max(0, Math.min(Number(time) || 0, endTime));
      const gravityDrop = 0.5 * g * t * t;
      const projectileNoGravityY = v * sin * t;
      const projectile = {
        x: v * cos * t,
        y: Math.max(0, projectileNoGravityY - gravityDrop),
      };
      const target = { x: D, y: Math.max(0, H - gravityDrop) };
      return {
        time: t,
        gravityDrop,
        projectile,
        target,
        projectileNoGravity: { x: projectile.x, y: projectileNoGravityY },
        targetNoGravity: { x: D, y: H },
      };
    }

    return {
      distance: D,
      height: H,
      speed: v,
      gravity: g,
      range,
      angle,
      sin,
      cos,
      hitTime,
      hitHeight,
      targetGroundTime,
      projectileGroundTime,
      minimumSpeed,
      event,
      endTime,
      impactX,
      eventHeight,
      positions,
    };
  }

  return { calculate, EPSILON };
});
