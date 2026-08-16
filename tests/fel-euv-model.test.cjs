const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/fel-euv-model.js');

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (허용 ${tol})`);

test('로렌츠 인자는 전체 에너지 / 정지 에너지', () => {
  near(model.lorentzGamma(0.51099895), 1, 1e-12);
  near(model.lorentzGamma(1000), 1956.95, 0.01);
  near(model.lorentzGamma(660), 1291.59, 0.01);
});

test('1 - β 는 큰 γ에서 1/(2γ²)로 수렴한다', () => {
  [100, 1000, 5000].forEach(gamma => {
    near(model.oneMinusBeta(gamma), 1 / (2 * gamma * gamma), 1 / (2 * gamma ** 4));
  });
  // 660 MeV에서 광속의 99.99997 %
  near(model.betaValue(model.lorentzGamma(660)) * 100, 99.99997, 1e-5);
});

test('K = 0.9337 · B · λu', () => {
  near(model.undulatorK({ fieldT: 1, periodCm: 1 }), 0.9337, 1e-12);
  near(model.undulatorK({ fieldT: 0.357, periodCm: 3 }), 1.0, 0.003);
});

test('공명 파장식이 문헌 관계를 재현한다', () => {
  // K → 0 이면 λ = λu / 2γ²
  const gamma = 1000;
  near(
    model.resonantWavelengthNm({ gamma, periodCm: 3, K: 0 }),
    (0.03 / (2 * gamma * gamma)) * 1e9,
    1e-9,
  );
  // K = 1 이면 정확히 1.5배
  const a = model.resonantWavelengthNm({ gamma, periodCm: 3, K: 0 });
  const b = model.resonantWavelengthNm({ gamma, periodCm: 3, K: 1 });
  near(b / a, 1.5, 1e-12);
  // 파장은 γ의 제곱에 반비례
  const c = model.resonantWavelengthNm({ gamma: 2000, periodCm: 3, K: 1 });
  near(b / c, 4, 1e-12);
});

test('13.5 nm 역산과 정산이 서로 맞물린다', () => {
  const energy = model.energyForWavelengthMeV({ wavelengthNm: 13.5, periodCm: 3, K: 1 });
  near(energy, 660, 3);
  const back = model.resonantWavelengthNm({
    gamma: model.lorentzGamma(energy),
    periodCm: 3,
    K: 1,
  });
  near(back, 13.5, 1e-9);
});

test('결합 인자 [JJ]는 K→0에서 1, K가 커지면 줄어든다', () => {
  near(model.couplingJJ(0.001), 1, 1e-5);
  assert.ok(model.couplingJJ(1) < 1 && model.couplingJJ(1) > 0.9);
  assert.ok(model.couplingJJ(3.5) < model.couplingJJ(1));
  // 베셀 급수 자체 검증
  near(model.besselJ(0, 0.5), 0.938469807, 1e-8);
  near(model.besselJ(1, 0.5), 0.242268458, 1e-8);
});

test('다발 압축은 길이를 줄이고 첨두 전류를 그만큼 올린다', () => {
  const before = model.compressedBunch({ chargePC: 100, lengthPs: 4, compression: 1 });
  const after = model.compressedBunch({ chargePC: 100, lengthPs: 4, compression: 20 });
  near(before.peakCurrentA, 25, 1e-9);
  near(after.lengthFs, 200, 1e-9);
  near(after.peakCurrentA, 500, 1e-9);
  near(after.peakCurrentA / before.peakCurrentA, 20, 1e-9);
});

test('시케인 압축비 C = 1 / |1 + h·R56|', () => {
  near(model.compressionFactor({ chirpPerM: 19, r56M: -0.05 }), 20, 1e-9);
  assert.throws(() => model.compressionFactor({ chirpPerM: 20, r56M: -0.05 }), RangeError);
});

test('피어스 파라미터가 LCLS급 조건에서 알려진 크기(≈5e-4)에 든다', () => {
  const rho = model.pierceParameter({
    currentA: 3000, periodCm: 3, K: 3.5, sigmaXum: 30, gamma: 27000,
  });
  assert.ok(rho > 2e-4 && rho < 8e-4, `ρ=${rho}`);
});

test('이득 길이는 ρ에 반비례한다', () => {
  const l1 = model.gainLengthM({ periodCm: 3, rho: 1e-3 });
  const l2 = model.gainLengthM({ periodCm: 3, rho: 2e-3 });
  near(l1 / l2, 2, 1e-12);
  near(l1, 0.03 / (4 * Math.PI * Math.sqrt(3) * 1e-3), 1e-12);
});

test('평균 빔 전력 = 전하 × 반복률 × 전압', () => {
  near(model.averageBeamPowerW({ chargePC: 100, repRateMHz: 10, energyMeV: 660 }), 660000, 1e-6);
});

test('에너지 회수를 끄면 벽면 전력이 크게 뛴다', () => {
  const on = model.wallPowerMW({ beamPowerW: 660000, recovery: 0.9 });
  const off = model.wallPowerMW({ beamPowerW: 660000, recovery: 0 });
  near(on, 0.682, 0.001);
  near(off, 1.87, 0.001);
  assert.ok(off / on > 2.5);
});

test('번칭 인자: 고르게 퍼지면 0, 한 점에 모이면 1', () => {
  const uniform = Array.from({ length: 360 }, (_, i) => (i * 2 * Math.PI) / 360);
  near(model.bunchingFactor(uniform), 0, 1e-12);
  near(model.bunchingFactor([1.2, 1.2, 1.2]), 1, 1e-12);
  const half = model.bunchingFactor([0, Math.PI / 2]);
  near(half, Math.SQRT1_2, 1e-12);
});

test('결맞은 방출은 b=0에서 N, b=1에서 N²', () => {
  near(model.coherentPower({ N: 1000, b: 0 }), 1000, 1e-9);
  near(model.coherentPower({ N: 1000, b: 1 }), 1000 * 1000, 1e-9);
  assert.ok(model.coherentPower({ N: 1000, b: 0.5 }) > 200000);
});

test('기준 설계값이 보도된 규모(13.5 nm · 0.7 MW 급)를 재현한다', () => {
  const out = model.solve({
    energyMeV: 660, periodCm: 3, fieldT: 0.357, compression: 20, repRateMHz: 10,
  });
  near(out.wavelengthNm, 13.5, 0.15);
  assert.ok(out.onTarget, `파장 ${out.wavelengthNm} nm`);
  near(out.peakCurrentA, 500, 1e-9);
  near(out.beamPowerW / 1e3, 660, 1e-6);
  assert.ok(out.rho > 1e-3 && out.rho < 3e-3, `ρ=${out.rho}`);
  assert.ok(out.gainLengthM > 0.3 && out.gainLengthM < 2, `Lg=${out.gainLengthM}`);
  assert.ok(out.euvW > 700 && out.euvW < 2500, `EUV=${out.euvW}`);
  near(out.wallMW, 0.68, 0.02);
  // 같은 출력을 LPP로 내려면 훨씬 많이 듭니다
  assert.ok(out.lppWallMW / out.wallMW > 4);
});

test('에너지를 올리면 파장이 짧아지고 스캐너 대수는 늘어난다', () => {
  const base = { periodCm: 3, fieldT: 0.357, compression: 20, repRateMHz: 10 };
  const low = model.solve(Object.assign({ energyMeV: 500 }, base));
  const high = model.solve(Object.assign({ energyMeV: 900 }, base));
  assert.ok(high.wavelengthNm < low.wavelengthNm);
  const more = model.solve(Object.assign({ energyMeV: 660, repRateMHz: 60 }, base, { repRateMHz: 60 }));
  const less = model.solve(Object.assign({ energyMeV: 660 }, base));
  assert.ok(more.scanners > less.scanners);
});

test('언듈레이터 한 주기당 미끄러짐이 공명 파장과 정확히 같다', () => {
  // FEL이 성립하는 핵심 조건. 여러 조건에서 비가 1인지 확인합니다.
  const cases = [
    { energyMeV: 660, periodCm: 3, K: 1 },
    { energyMeV: 1000, periodCm: 2, K: 0.5 },
    { energyMeV: 350, periodCm: 4, K: 2 },
  ];
  for (const c of cases) {
    const gamma = model.lorentzGamma(c.energyMeV);
    const slip = model.slippagePerPeriodNm({ gamma, periodCm: c.periodCm, K: c.K });
    const lam = model.resonantWavelengthNm({ gamma, periodCm: c.periodCm, K: c.K });
    near(slip / lam, 1, 1e-4);
  }
});

test('축방향 평균 속도는 K가 커질수록 느려진다', () => {
  const g = 1291.59;
  assert.ok(model.averageAxialBeta({ gamma: g, K: 2 }) < model.averageAxialBeta({ gamma: g, K: 0 }));
  near(model.averageAxialBeta({ gamma: g, K: 0 }), 1 - 1 / (2 * g * g), 1e-15);
});

test('전자 두 개: 파장 간격이면 4배, 반 파장 간격이면 0', () => {
  near(model.twoElectronIntensity(0), 4, 1e-12);
  near(model.twoElectronIntensity(0.5), 0, 1e-12);
  near(model.twoElectronIntensity(1), 4, 1e-12);
  near(model.twoElectronIntensity(2), 4, 1e-12);
  // 4분의 1 파장이면 전자 두 개를 그냥 더한 값(=2)과 같아집니다
  near(model.twoElectronIntensity(0.25), 2, 1e-12);
});

test('격자 간섭: 파장 간격으로 N개가 늘어서면 세기가 N²', () => {
  [2, 5, 20].forEach(N => {
    near(model.arrayIntensity({ N, dOverLambda: 1 }), N * N, 1e-6);
    near(model.arrayIntensity({ N, dOverLambda: 0 }), N * N, 1e-6);
  });
  // 어긋난 간격에서는 N²보다 훨씬 작습니다
  assert.ok(model.arrayIntensity({ N: 20, dOverLambda: 0.5 }) < 20 * 20 * 0.02);
});

test('200 fs 다발 안에는 13.5 nm 파장이 4천 개 넘게 들어간다', () => {
  const n = model.wavelengthsInBunch({ bunchLengthFs: 200, wavelengthNm: 13.5 });
  assert.ok(n > 4000 && n < 4600, `${n}`);
});

test('Halbach 식: 간극이 벌어지면 자기장이 지수적으로 무너진다', () => {
  const a = model.halbachFieldT({ gapMm: 5, periodCm: 3.0 }).fieldT;
  const b = model.halbachFieldT({ gapMm: 5, periodCm: 1.0 }).fieldT;
  const c = model.halbachFieldT({ gapMm: 5, periodCm: 0.5 }).fieldT;
  assert.ok(a > b && b > c, `${a} > ${b} > ${c}`);
  near(a, 1.656, 0.01);   // g/λu = 0.167
  near(c, 0.106, 0.005);  // g/λu = 1.0
  // 같은 g/λu면 같은 값 (무차원 식)
  near(model.halbachFieldT({ gapMm: 10, periodCm: 6 }).fieldT,
       model.halbachFieldT({ gapMm: 5, periodCm: 3 }).fieldT, 1e-12);
  // 검증 범위 밖 표시
  assert.ok(model.halbachFieldT({ gapMm: 5, periodCm: 0.3 }).extrapolated);
  assert.ok(model.halbachFieldT({ gapMm: 1, periodCm: 3 }).capped);
});

test('에미턴스 바닥 λ ≥ 4π·εn/γ', () => {
  const gamma = model.lorentzGamma(660);
  near(model.emittanceFloorNm({ emittanceMmMrad: 0.25, gamma }), 2.43, 0.02);
  // 에너지를 두 배로 올리면 바닥이 절반으로
  const g2 = model.lorentzGamma(1320);
  near(model.emittanceFloorNm({ emittanceMmMrad: 0.25, gamma: g2 })
     / model.emittanceFloorNm({ emittanceMmMrad: 0.25, gamma }), 0.5, 1e-9);
});

test('660 MeV · 간극 5 mm에서 발진 가능한 최단 파장은 2 nm 언저리', () => {
  const r = model.shortestLasingWavelength({ energyMeV: 660, gapMm: 5 });
  assert.ok(r.shortestNm > 1.8 && r.shortestNm < 3.2, `${r.shortestNm} nm`);
  assert.ok(r.atPeriodMm > 5 && r.atPeriodMm < 12, `λu=${r.atPeriodMm} mm`);
  assert.notEqual(r.limitedBy, '없음');
  // 13.5 nm는 넉넉히 안쪽입니다
  assert.ok(r.shortestNm < 13.5);
});

test('에너지를 올리면 최단 파장이 짧아지고, 간극을 벌리면 길어진다', () => {
  const base = model.shortestLasingWavelength({ energyMeV: 660, gapMm: 5 });
  const hot = model.shortestLasingWavelength({ energyMeV: 2000, gapMm: 5 });
  const wide = model.shortestLasingWavelength({ energyMeV: 660, gapMm: 10 });
  assert.ok(hot.shortestNm < base.shortestNm, `${hot.shortestNm} < ${base.shortestNm}`);
  assert.ok(wide.shortestNm > base.shortestNm, `${wide.shortestNm} > ${base.shortestNm}`);
});

test('K를 0으로 보내도 λu/2γ² 아래로는 절대 못 내려간다', () => {
  const gamma = model.lorentzGamma(660);
  const floor = model.resonantWavelengthNm({ gamma, periodCm: 0.5, K: 0 });
  near(floor, 1.499, 0.002);
  // 어떤 K에서도 이 값 이상
  [0.1, 1, 3].forEach(K => {
    assert.ok(model.resonantWavelengthNm({ gamma, periodCm: 0.5, K }) >= floor);
  });
});

test('축방향 유효 감마 γz = γ/√(1+K²/2)', () => {
  const gamma = model.lorentzGamma(660);
  near(model.axialGamma({ gamma, K: 0 }), gamma, 1e-12);
  near(model.axialGamma({ gamma, K: 1 }), 1054.6, 0.2);
  assert.ok(model.axialGamma({ gamma, K: 3 }) < model.axialGamma({ gamma, K: 1 }));
});

test('진동수 사다리 세 단계를 곱하면 공명식과 정확히 같다', () => {
  [{ periodCm: 3, E: 660, K: 1 }, { periodCm: 1.5, E: 1000, K: 2 }, { periodCm: 4, E: 350, K: 0.4 }]
    .forEach(({ periodCm, E, K }) => {
      const gamma = model.lorentzGamma(E);
      const L = model.frequencyLadder({ periodCm, gamma, K });
      const direct = model.resonantWavelengthNm({ gamma, periodCm, K });
      near(L.lab.wavelengthM * 1e9, direct, direct * 1e-12);
      // 사다리를 거꾸로 올라가도 맞아야 합니다
      near(L.wiggle.wavelengthM / L.contractionFactor, L.rest.wavelengthM, 1e-18);
      near(L.rest.wavelengthM / L.dopplerFactor, L.lab.wavelengthM, 1e-18);
    });
});

test('3 cm 언듈레이터: 전자는 10 GHz로 흔들리는데 빛은 22 PHz', () => {
  const gamma = model.lorentzGamma(660);
  const L = model.frequencyLadder({ periodCm: 3, gamma, K: 1 });
  near(L.wiggle.hz / 1e9, 9.993, 0.01);          // 10 GHz — 마이크로파
  near(L.lab.hz / 1e15, 22.23, 0.05);            // 22 PHz — EUV
  near(L.totalFactor, 2.224e6, 2e3);
  // 총 배수는 2γ²/(1+K²/2)
  near(L.totalFactor, (2 * gamma * gamma) / 1.5, 1);
});

test('주기를 절반으로 하면 흔드는 진동수도 빛의 진동수도 정확히 두 배', () => {
  const gamma = model.lorentzGamma(660);
  const a = model.frequencyLadder({ periodCm: 3, gamma, K: 1 });
  const b = model.frequencyLadder({ periodCm: 1.5, gamma, K: 1 });
  near(b.wiggle.hz / a.wiggle.hz, 2, 1e-12);
  near(b.lab.hz / a.lab.hz, 2, 1e-12);
  near(b.totalFactor, a.totalFactor, 1e-6);      // 배수 자체는 그대로
});

test('축방향 속도는 에너지에 의존한다 — 뭉침의 원인', () => {
  const gamma = model.lorentzGamma(660);
  const lo = model.axialBeta({ gamma, K: 1, relativeEnergyOffset: -1.71e-3 });
  const mid = model.axialBeta({ gamma, K: 1, relativeEnergyOffset: 0 });
  const hi = model.axialBeta({ gamma, K: 1, relativeEnergyOffset: 1.71e-3 });
  assert.ok(lo < mid && mid < hi, '에너지가 높을수록 축방향으로 빠릅니다');
  // slipPerMetre는 1차 근사입니다. 정확값과의 차이는 O(δ) 수준이어야 합니다.
  const d = 1.71e-3;
  const exact = hi - mid;
  const linear = model.slipPerMetre({ gamma, K: 1, relativeEnergyOffset: d });
  const relErr = Math.abs(exact - linear) / linear;
  assert.ok(relErr < 3 * d, `1차 근사 오차 ${relErr} 가 O(δ)=${d} 를 넘습니다`);
  assert.ok(relErr > 0.5 * d, '2차 항이 사라져 버렸습니다 — 식을 확인하세요');
});

test('반 파장 밀림 거리 L = λu/(4δ)', () => {
  near(model.halfWavelengthSlipDistanceM({ periodCm: 3, relativeEnergyOffset: 1.71e-3 }), 4.386, 0.01);
  // δ가 두 배면 거리는 절반
  const a = model.halfWavelengthSlipDistanceM({ periodCm: 3, relativeEnergyOffset: 1e-3 });
  const b = model.halfWavelengthSlipDistanceM({ periodCm: 3, relativeEnergyOffset: 2e-3 });
  near(a / b, 2, 1e-12);
});

test('뭉치는 거리와 포화 거리가 같은 물리에서 나온다', () => {
  const out = model.solve({ energyMeV: 660, periodCm: 3, fieldT: 0.357, compression: 20, repRateMHz: 10 });
  const bunchDist = 0.03 / out.rho;                    // λu/ρ
  // 포화 길이 20Lg 와 λu/ρ 의 비는 4π√3/20 로 고정입니다
  near(bunchDist / out.saturationLengthM, (4 * Math.PI * Math.sqrt(3)) / 20, 1e-9);
  assert.ok(Math.abs(bunchDist - out.saturationLengthM) / out.saturationLengthM < 0.1);
});
