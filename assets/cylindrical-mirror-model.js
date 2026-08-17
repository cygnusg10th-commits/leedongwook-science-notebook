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

  function offsetPointImages({ R, L, s, nMax = 8, rho = 0.96 }) {
    const radius = positive(R, 'R');
    positive(L, 'L');
    const offset = Number(s);
    const max = Number(nMax);
    const reflectivity = Number(rho);
    if (!Number.isFinite(offset) || Math.abs(offset) >= radius) throw new RangeError('축 이탈량은 원통 반지름보다 작아야 합니다.');
    if (!Number.isInteger(max) || max < 1 || max > 24) throw new RangeError('최대 차수는 1~24의 정수여야 합니다.');
    if (!Number.isFinite(reflectivity) || reflectivity <= 0 || reflectivity > 1) throw new RangeError('반사율은 0보다 크고 1 이하여야 합니다.');
    // 마주 보는 두 벽(u = ±R)에 대한 반복 반사상. 위치에서 차수를 되짚지 않고
    // 차수에서 위치를 직접 만듭니다 — u = ±2nR + s·(−1)ⁿ.
    // 이렇게 해야 좌우 대칭이 보장되고, nMax에서 짝이 잘리지 않습니다.
    const points = [{ n: 0, uOverR: offset / radius, intensity: 1 }];
    for (let n = 1; n <= max; n += 1) {
      const mirrored = n % 2 ? -offset : offset;
      [2 * n * radius + mirrored, -2 * n * radius + mirrored].forEach(u => {
        points.push({ n, uOverR: u / radius, intensity: Math.pow(reflectivity, n) });
      });
    }
    return points.sort((a, b) => a.uOverR - b.uOverR);
  }

  return { images, offsetPointImages, ringRadiusRatio, angularSpacingDeg, halfBrightnessOrder };
});

