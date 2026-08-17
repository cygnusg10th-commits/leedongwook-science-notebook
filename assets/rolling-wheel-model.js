(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RollingWheelModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 각 theta 는 바퀴 맨 위를 0 으로 하고 굴러가는 방향(시계 방향)으로 잽니다.
  // 좌표는 x 가 진행 방향, y 가 위쪽입니다.
  // 미끄러짐 없는 구름 조건 v = omega * R 을 전제로 합니다.

  function positive(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name}은 0보다 큰 유한한 값이어야 합니다.`);
    return number;
  }

  function finite(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new RangeError(`${name}은 유한한 값이어야 합니다.`);
    return number;
  }

  function nonNegative(value, name) {
    const number = finite(value, name);
    if (number < 0) throw new RangeError(`${name}은 0 이상이어야 합니다.`);
    return number;
  }

  function kmhToMs(kmh) {
    return finite(kmh, '속력') / 3.6;
  }

  function angularSpeed({ speed, radius }) {
    return nonNegative(speed, '속력') / positive(radius, '반지름');
  }

  // 중심에서 거리 a = ratio * R 인 점의 속도. 차체 속력 v 를 1 로 둔 무차원 값.
  function pointVelocityRatio({ radiusRatio, theta }) {
    const q = nonNegative(radiusRatio, '표시점 위치');
    const angle = finite(theta, '각');
    return { vx: 1 + q * Math.cos(angle), vy: -q * Math.sin(angle) };
  }

  // |v_P| / v = sqrt(1 + 2q cos(theta) + q^2)
  function pointSpeedRatio({ radiusRatio, theta }) {
    const q = nonNegative(radiusRatio, '표시점 위치');
    const angle = finite(theta, '각');
    return Math.sqrt(Math.max(0, 1 + 2 * q * Math.cos(angle) + q * q));
  }

  function pointVelocity({ speed, radiusRatio, theta }) {
    const v = nonNegative(speed, '속력');
    const ratio = pointVelocityRatio({ radiusRatio, theta });
    return { vx: v * ratio.vx, vy: v * ratio.vy, speed: v * pointSpeedRatio({ radiusRatio, theta }) };
  }

  // theta = pi (접지 쪽)에서 최솟값 |1 - q|, theta = 0 (맨 위)에서 최댓값 1 + q
  function minimumSpeedRatio({ radiusRatio }) {
    return Math.abs(1 - nonNegative(radiusRatio, '표시점 위치'));
  }

  function maximumSpeedRatio({ radiusRatio }) {
    return 1 + nonNegative(radiusRatio, '표시점 위치');
  }

  // 사이클로이드(q = 1) 또는 커테이트/커테이트 사이클로이드
  function trochoidPoint({ radius, radiusRatio, theta }) {
    const R = positive(radius, '반지름');
    const q = nonNegative(radiusRatio, '표시점 위치');
    const angle = finite(theta, '각');
    return { x: R * angle + q * R * Math.sin(angle), y: R + q * R * Math.cos(angle) };
  }

  // 사이클로이드 한 아치의 길이는 정확히 8R, 같은 시간 동안 차체는 2*pi*R 을 간다.
  function archLength({ radius }) {
    return 8 * positive(radius, '반지름');
  }

  function pathLengthRatio() {
    return 4 / Math.PI;
  }

  // 지면에서 높이 h 인 테두리 점의 속력: |v| = v * sqrt(2h/R)
  function speedAtHeight({ speed, radius, height }) {
    const R = positive(radius, '반지름');
    const h = nonNegative(height, '높이');
    if (h > 2 * R + 1e-12) throw new RangeError('높이는 바퀴 지름 이하여야 합니다.');
    return nonNegative(speed, '속력') * Math.sqrt((2 * h) / R);
  }

  function motionBlurLength({ speed, radius, height, exposure }) {
    return speedAtHeight({ speed, radius, height }) * positive(exposure, '노출 시간');
  }

  // 접지점의 가속도 크기는 0 이 아니라 중심을 향한 omega^2 * R
  function contactAcceleration({ speed, radius }) {
    const R = positive(radius, '반지름');
    const omega = angularSpeed({ speed, radius: R });
    return omega * omega * R;
  }

  // I_center = inertiaFactor * m * R^2 (균일 원판 0.5, 얇은 고리 1)
  function rollingEnergy({ mass, speed, inertiaFactor = 0.5 }) {
    const m = positive(mass, '질량');
    const v = nonNegative(speed, '속력');
    const c = nonNegative(inertiaFactor, '관성 계수');
    const translational = 0.5 * m * v * v;
    const rotational = 0.5 * c * m * v * v;
    const total = translational + rotational;
    return { translational, rotational, total, rotationShare: total === 0 ? 0 : rotational / total };
  }

  return {
    kmhToMs,
    angularSpeed,
    pointVelocityRatio,
    pointSpeedRatio,
    pointVelocity,
    minimumSpeedRatio,
    maximumSpeedRatio,
    trochoidPoint,
    archLength,
    pathLengthRatio,
    speedAtHeight,
    motionBlurLength,
    contactAcceleration,
    rollingEnergy
  };
});
