(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.StationGravity = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const g0 = 9.80665;
  function calculate(radius, rpm) {
    if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(rpm) || rpm < 0) {
      throw new RangeError('반지름은 양수, 회전수는 0 이상의 유한한 수여야 합니다.');
    }
    const omega = rpm * Math.PI / 30;
    const acceleration = omega * omega * radius;
    return { omega, acceleration, g: acceleration / g0, speed: omega * radius, period: rpm === 0 ? Infinity : 60 / rpm };
  }
  function rpmForG(radius, gravity = 1) {
    if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(gravity) || gravity < 0) throw new RangeError('계산 범위를 확인하세요.');
    return Math.sqrt(gravity * g0 / radius) * 30 / Math.PI;
  }
  return { calculate, rpmForG };
});
