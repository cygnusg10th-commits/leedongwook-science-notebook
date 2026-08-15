(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CylindricalMirrorModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function positive(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name}은 0보다 큰 유한한 값이어야 합니다.`);
    return number;
  }

  function ringRadiusRatio({ R, L, n }) {
    const radius = positive(R, 'R');
    const length = positive(L, 'L');
    const order = Number(n);
    if (!Number.isInteger(order) || order < 0) throw new RangeError('n은 0 이상의 정수여야 합니다.');
    return (2 * order * radius) / length;
  }

  function angularSpacingDeg({ R, L, n }) {
    const step = (2 * positive(R, 'R')) / positive(L, 'L');
    const order = Number(n);
    if (!Number.isInteger(order) || order < 0) throw new RangeError('n은 0 이상의 정수여야 합니다.');
    return Math.atan(step / (1 + step * step * order * (order + 1))) * 180 / Math.PI;
  }

  function halfBrightnessOrder(rho) {
    const reflectivity = Number(rho);
    if (!Number.isFinite(reflectivity) || reflectivity <= 0 || reflectivity >= 1) throw new RangeError('반사율은 0과 1 사이여야 합니다.');
    return Math.log(0.5) / Math.log(reflectivity);
  }

  function images({ R, L, nMax = 8, rho = 0.96 }) {
    const max = Number(nMax);
    const reflectivity = Number(rho);
    if (!Number.isInteger(max) || max < 1 || max > 24) throw new RangeError('최대 차수는 1~24의 정수여야 합니다.');
    if (!Number.isFinite(reflectivity) || reflectivity <= 0 || reflectivity > 1) throw new RangeError('반사율은 0보다 크고 1 이하여야 합니다.');
    return Array.from({ length: max + 1 }, (_, n) => ({
      n,
      radiusOverF: ringRadiusRatio({ R, L, n }),
      thetaDeg: Math.atan(ringRadiusRatio({ R, L, n })) * 180 / Math.PI,
      intensity: Math.pow(reflectivity, n),
    }));
  }

  return { images, ringRadiusRatio, angularSpacingDeg, halfBrightnessOrder };
});

