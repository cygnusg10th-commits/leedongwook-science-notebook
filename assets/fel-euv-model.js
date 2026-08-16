(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FelEuvModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── 물리 상수 ─────────────────────────────────────────────
  const ELECTRON_REST_MEV = 0.51099895;   // 전자 정지 에너지 [MeV]
  const ALFVEN_CURRENT = 17045;           // 알펜 전류 I_A [A]
  const K_PER_TESLA_CM = 0.9337;          // K = 0.9337 · B[T] · λu[cm]

  // ── 기준 설계값 (xLight급 EUV-FEL을 상정한 값) ────────────
  const DESIGN = {
    bunchChargePC: 100,        // 다발 전하 [pC]
    bunchLengthPs: 4,          // 압축 전 다발 길이 [ps]
    sigmaXum: 40,              // 전자빔 횡단 크기 [µm]
    recoveryRatio: 0.9,        // 에너지 회수율
    rfEfficiency: 0.5,         // RF 발생 효율 (벽면전력 → 빔전력)
    overheadMW: 0.55,          // 냉각·제어 등 고정 소비 [MW]
    scannerWattEach: 500,      // 스캐너 1대가 필요로 하는 EUV 출력 [W]
    lppWallPerKilowatt: 4.4,   // LPP 방식이 EUV 1 kW에 쓰는 벽면 전력 [MW]
    targetNm: 13.5,            // 노광에 쓰는 EUV 파장 [nm]
    saturationGainLengths: 20, // 포화까지 걸리는 이득 길이 배수
  };

  function finite(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new RangeError(`${name}은 유한한 수여야 합니다.`);
    return number;
  }

  function positive(value, name) {
    const number = finite(value, name);
    if (number <= 0) throw new RangeError(`${name}은 0보다 커야 합니다.`);
    return number;
  }

  // ── 상대론 ────────────────────────────────────────────────
  // 가속기 관례대로 E는 전자의 전체 에너지입니다.
  function lorentzGamma(energyMeV) {
    return positive(energyMeV, '전자 에너지') / ELECTRON_REST_MEV;
  }

  // β = sqrt(1 - 1/γ²). γ가 크면 1에 붙어 버려 배정밀도로도 자릿수가 날아가므로
  // 1 - β 를 따로 정확히 계산합니다. 1 - β = (1/γ²) / (1 + β) ≈ 1/(2γ²).
  function oneMinusBeta(gamma) {
    const g = positive(gamma, 'γ');
    if (g <= 1) return 1;
    const inv = 1 / (g * g);
    const beta = Math.sqrt(1 - inv);
    return inv / (1 + beta);
  }

  function betaValue(gamma) {
    return 1 - oneMinusBeta(gamma);
  }

  // ── 언듈레이터 ────────────────────────────────────────────
  function undulatorK({ fieldT, periodCm }) {
    return K_PER_TESLA_CM * positive(fieldT, '자기장') * positive(periodCm, '언듈레이터 주기');
  }

  // 공명 파장 λ = (λu / 2γ²) · (1 + K²/2 + γ²θ²)
  function resonantWavelengthNm({ gamma, periodCm, K, thetaRad = 0 }) {
    const g = positive(gamma, 'γ');
    const period = positive(periodCm, '언듈레이터 주기');
    const k = finite(K, 'K');
    const theta = finite(thetaRad, '관측 각도');
    if (k < 0) throw new RangeError('K는 0 이상이어야 합니다.');
    const metres = (period / 100) / (2 * g * g) * (1 + (k * k) / 2 + g * g * theta * theta);
    return metres * 1e9;
  }

  // 목표 파장을 만들려면 전자 에너지가 얼마여야 하는가 (역산)
  function energyForWavelengthMeV({ wavelengthNm, periodCm, K }) {
    const lam = positive(wavelengthNm, '파장') * 1e-9;
    const period = positive(periodCm, '언듈레이터 주기') / 100;
    const k = finite(K, 'K');
    const gammaSq = (period * (1 + (k * k) / 2)) / (2 * lam);
    return Math.sqrt(gammaSq) * ELECTRON_REST_MEV;
  }

  // 전자가 축에서 벗어나는 최대 각도 θmax = K/γ, 복사 원뿔 각도 = 1/γ
  function deflectionRatio({ gamma, K }) {
    return finite(K, 'K') / positive(gamma, 'γ');
  }

  // ── 베셀 함수 (급수, |x| < 1에서 빠르게 수렴) ──────────────
  function besselJ(order, x) {
    const n = Math.trunc(order);
    let term = Math.pow(x / 2, n);
    for (let i = 2; i <= n; i += 1) term /= i;
    let sum = term;
    for (let k = 1; k < 40; k += 1) {
      term *= -(x * x / 4) / (k * (k + n));
      sum += term;
      if (Math.abs(term) < 1e-18) break;
    }
    return sum;
  }

  // 평면형 언듈레이터의 결합 인자 [JJ] = J0(ξ) - J1(ξ), ξ = K²/(4 + 2K²)
  function couplingJJ(K) {
    const k = finite(K, 'K');
    if (k <= 0) return 0;
    const xi = (k * k) / (4 + 2 * k * k);
    return besselJ(0, xi) - besselJ(1, xi);
  }

  // ── 자석이 낼 수 있는 자기장의 한계 ───────────────────────
  // Halbach 경험식 (하이브리드 NdFeB + 철 언듈레이터, 축상 최대 자기장)
  //   B0 = 3.694 · exp[ -5.068 (g/λu) + 1.520 (g/λu)² ]   [T]
  // 원식의 검증 범위는 0.1 < g/λu < 1 입니다. 그 밖은 외삽입니다.
  const HALBACH = { a: 3.694, b: 5.068, c: 1.520, maxT: 2.0 };

  function halbachFieldT({ gapMm, periodCm, cap = HALBACH.maxT }) {
    const ratio = (positive(gapMm, '자석 간극') / 10) / positive(periodCm, '언듈레이터 주기');
    const raw = HALBACH.a * Math.exp(-HALBACH.b * ratio + HALBACH.c * ratio * ratio);
    return { fieldT: Math.min(raw, cap), ratio, extrapolated: ratio < 0.1 || ratio > 1, capped: raw > cap };
  }

  // 회절 한계(에미턴스 조건) εn ≤ γλ/4π 를 파장 쪽으로 뒤집으면
  //   λ ≥ 4π εn / γ
  function emittanceFloorNm({ emittanceMmMrad, gamma }) {
    const en = positive(emittanceMmMrad, '에미턴스') * 1e-6;
    return (4 * Math.PI * en) / positive(gamma, 'γ') * 1e9;
  }

  // 주어진 조건에서 실제로 '발진하는' 가장 짧은 파장.
  // λu만 줄이면 파장은 끝없이 짧아지지만 자기장이 무너져 이득이 죽습니다.
  function shortestLasingWavelength(input) {
    const opt = Object.assign({
      energyMeV: 660, gapMm: 5, currentA: 500, sigmaXum: 40,
      emittanceMmMrad: 0.25, rhoMin: 1e-4, maxUndulatorM: 60,
    }, input || {});
    const gamma = lorentzGamma(opt.energyMeV);
    const floorNm = emittanceFloorNm({ emittanceMmMrad: opt.emittanceMmMrad, gamma });
    const scan = [];
    let best = null;
    let blocker = '없음';
    for (let mm = 40; mm >= 2; mm -= 0.1) {
      const periodCm = mm / 10;
      const { fieldT } = halbachFieldT({ gapMm: opt.gapMm, periodCm });
      const K = undulatorK({ fieldT, periodCm });
      const wavelengthNm = resonantWavelengthNm({ gamma, periodCm, K });
      const rho = pierceParameter({
        currentA: opt.currentA, periodCm, K, sigmaXum: opt.sigmaXum, gamma,
      });
      const satM = rho > 0 ? gainLengthM({ periodCm, rho }) * DESIGN.saturationGainLengths : Infinity;
      const fails = rho < opt.rhoMin ? '이득 부족'
        : wavelengthNm < floorNm ? '빔 품질 한계'
          : satM > opt.maxUndulatorM ? '자석이 너무 길어짐' : null;
      scan.push({ periodMm: mm, fieldT, K, wavelengthNm, rho, satM, fails });
      if (!fails) {
        if (!best || wavelengthNm < best.wavelengthNm) best = scan[scan.length - 1];
      } else if (best && blocker === '없음') {
        blocker = fails;
      }
    }
    return {
      gamma,
      emittanceFloorNm: floorNm,
      shortestNm: best ? best.wavelengthNm : Infinity,
      atPeriodMm: best ? best.periodMm : null,
      atRho: best ? best.rho : 0,
      atSaturationM: best ? best.satM : Infinity,
      limitedBy: blocker,
      scan,
    };
  }

  // ── 다발 압축 ─────────────────────────────────────────────
  // 시케인 압축비 C = 1 / |1 + h·R56|
  function compressionFactor({ chirpPerM, r56M }) {
    const denom = 1 + finite(chirpPerM, '에너지 기울기') * finite(r56M, 'R56');
    if (Math.abs(denom) < 1e-9) throw new RangeError('압축비가 발산합니다. h·R56이 -1에 너무 가깝습니다.');
    return 1 / Math.abs(denom);
  }

  function peakCurrentA({ chargePC, lengthPs }) {
    return (positive(chargePC, '다발 전하') * 1e-12) / (positive(lengthPs, '다발 길이') * 1e-12);
  }

  function compressedBunch({ chargePC, lengthPs, compression }) {
    const c = positive(compression, '압축비');
    const finalPs = positive(lengthPs, '다발 길이') / c;
    return {
      lengthPs: finalPs,
      lengthFs: finalPs * 1000,
      peakCurrentA: peakCurrentA({ chargePC, lengthPs: finalPs }),
    };
  }

  // ── FEL 이득 ──────────────────────────────────────────────
  // 1차원 피어스 파라미터
  // ρ = [ (I/I_A) · (λu·K·[JJ] / (2π σx))² / (32 γ³) ]^(1/3)
  function pierceParameter({ currentA, periodCm, K, sigmaXum, gamma }) {
    const I = positive(currentA, '첨두 전류');
    const period = positive(periodCm, '언듈레이터 주기') / 100;
    const sigma = positive(sigmaXum, '빔 크기') * 1e-6;
    const g = positive(gamma, 'γ');
    const k = finite(K, 'K');
    if (k <= 0) return 0;
    const coupling = (period * k * couplingJJ(k)) / (2 * Math.PI * sigma);
    const value = ((I / ALFVEN_CURRENT) * coupling * coupling) / (32 * g * g * g);
    return Math.cbrt(value);
  }

  // 이득 길이 Lg = λu / (4π√3 ρ)
  function gainLengthM({ periodCm, rho }) {
    const r = positive(rho, 'ρ');
    return (positive(periodCm, '언듈레이터 주기') / 100) / (4 * Math.PI * Math.sqrt(3) * r);
  }

  function saturationLengthM({ periodCm, rho, gainLengths = DESIGN.saturationGainLengths }) {
    return gainLengthM({ periodCm, rho }) * positive(gainLengths, '이득 길이 배수');
  }

  // ── 출력 ──────────────────────────────────────────────────
  // 평균 빔 전력 = 전하 × 반복률 × 전압
  function averageBeamPowerW({ chargePC, repRateMHz, energyMeV }) {
    const charge = positive(chargePC, '다발 전하') * 1e-12;
    const rate = positive(repRateMHz, '반복률') * 1e6;
    const volts = positive(energyMeV, '전자 에너지') * 1e6;
    return charge * rate * volts;
  }

  // 포화 시 EUV 평균 출력 ≈ ρ × 평균 빔 전력
  function euvPowerW({ rho, chargePC, repRateMHz, energyMeV }) {
    return finite(rho, 'ρ') * averageBeamPowerW({ chargePC, repRateMHz, energyMeV });
  }

  // 벽면 전력 = 고정 소비 + (회수하지 못한 빔 전력) / RF 효율
  function wallPowerMW({ beamPowerW, recovery, rfEfficiency = DESIGN.rfEfficiency, overheadMW = DESIGN.overheadMW }) {
    const beam = positive(beamPowerW, '빔 전력') / 1e6;
    const keep = Math.min(Math.max(finite(recovery, '회수율'), 0), 0.99);
    return overheadMW + (beam * (1 - keep)) / positive(rfEfficiency, 'RF 효율');
  }

  function scannerCount({ euvW, perScannerW = DESIGN.scannerWattEach }) {
    return Math.floor(positive(euvW, 'EUV 출력') / positive(perScannerW, '스캐너 소요 출력'));
  }

  // 같은 EUV 출력을 LPP 방식으로 만들 때의 벽면 전력
  function lppWallPowerMW({ euvW, perKilowattMW = DESIGN.lppWallPerKilowatt }) {
    return (positive(euvW, 'EUV 출력') / 1000) * positive(perKilowattMW, 'LPP 소요 전력');
  }

  // ── 마이크로번칭 ──────────────────────────────────────────
  // 번칭 인자 b = |⟨exp(iθ)⟩|. 0이면 완전 무질서, 1이면 완전 정렬.
  function bunchingFactor(phases) {
    if (!Array.isArray(phases) || phases.length === 0) throw new RangeError('위상 배열이 필요합니다.');
    let re = 0;
    let im = 0;
    phases.forEach(theta => {
      re += Math.cos(theta);
      im += Math.sin(theta);
    });
    return Math.hypot(re, im) / phases.length;
  }

  // ── 결맞음의 근원: 미끄러짐(slippage) ────────────────────
  // 언듈레이터 안에서 전자의 축방향 평균 속도.
  // 좌우로 굽이치는 만큼 앞으로 가는 속도가 줄어들어 K가 들어갑니다.
  function averageAxialBeta({ gamma, K }) {
    const g = positive(gamma, 'γ');
    const k = finite(K, 'K');
    return 1 - (1 + (k * k) / 2) / (2 * g * g);
  }

  // 언듈레이터 한 주기를 지나는 동안 빛이 전자보다 앞서는 거리.
  // 이 값이 정확히 공명 파장 한 개와 같다는 것이 FEL이 성립하는 이유입니다.
  function slippagePerPeriodNm({ gamma, periodCm, K }) {
    const period = positive(periodCm, '언듈레이터 주기') / 100;
    const betaZ = averageAxialBeta({ gamma, K });
    return period * (1 / betaZ - 1) * 1e9;
  }

  // 세로로 d만큼 떨어진 전자 두 개가 같은 방향으로 내보낸 빛의 세기.
  // 전자 하나가 내는 세기를 1로 두었을 때의 값입니다.
  // I = |1 + e^{i·2π·d/λ}|² = 4cos²(π·d/λ)
  function twoElectronIntensity(dOverLambda) {
    const d = finite(dOverLambda, '간격');
    return 4 * Math.pow(Math.cos(Math.PI * d), 2);
  }

  // 같은 간격 d로 늘어선 전자 N개의 세기 (격자 간섭)
  function arrayIntensity({ N, dOverLambda }) {
    const n = Math.round(positive(N, '전자 수'));
    const phi = Math.PI * finite(dOverLambda, '간격') * 2;
    if (Math.abs(Math.sin(phi / 2)) < 1e-12) return n * n;
    return Math.pow(Math.sin((n * phi) / 2) / Math.sin(phi / 2), 2);
  }

  // 다발 하나에 파장이 몇 개나 들어가는가 — '동시에'가 불가능한 이유
  function wavelengthsInBunch({ bunchLengthFs, wavelengthNm }) {
    const metres = positive(bunchLengthFs, '다발 길이') * 1e-15 * 299792458;
    return metres / (positive(wavelengthNm, '파장') * 1e-9);
  }

  // 결맞은 방출: P ∝ N + N(N-1)b²  (b=0이면 N, b=1이면 N²)
  function coherentPower({ N, b }) {
    const n = positive(N, '전자 수');
    const bunching = Math.min(Math.max(finite(b, '번칭 인자'), 0), 1);
    return n + n * (n - 1) * bunching * bunching;
  }

  // ── 전체 장치를 한 번에 계산 ──────────────────────────────
  function solve(input) {
    const design = Object.assign({}, DESIGN, input.design || {});
    const energyMeV = positive(input.energyMeV, '전자 에너지');
    const periodCm = positive(input.periodCm, '언듈레이터 주기');
    const fieldT = positive(input.fieldT, '자기장');
    const compression = positive(input.compression, '압축비');
    const repRateMHz = positive(input.repRateMHz, '반복률');
    const recovery = input.recovery === false ? 0 : design.recoveryRatio;

    const gamma = lorentzGamma(energyMeV);
    const K = undulatorK({ fieldT, periodCm });
    const wavelengthNm = resonantWavelengthNm({ gamma, periodCm, K });
    const bunch = compressedBunch({
      chargePC: design.bunchChargePC,
      lengthPs: design.bunchLengthPs,
      compression,
    });
    const rho = pierceParameter({
      currentA: bunch.peakCurrentA,
      periodCm,
      K,
      sigmaXum: design.sigmaXum,
      gamma,
    });
    const gainLength = rho > 0 ? gainLengthM({ periodCm, rho }) : Infinity;
    const beamPowerW = averageBeamPowerW({
      chargePC: design.bunchChargePC,
      repRateMHz,
      energyMeV,
    });
    const euvW = rho * beamPowerW;
    const wallMW = wallPowerMW({ beamPowerW, recovery, rfEfficiency: design.rfEfficiency, overheadMW: design.overheadMW });

    return {
      gamma,
      oneMinusBeta: oneMinusBeta(gamma),
      betaPercent: betaValue(gamma) * 100,
      K,
      couplingJJ: couplingJJ(K),
      wavelengthNm,
      wavelengthOffPercent: ((wavelengthNm - design.targetNm) / design.targetNm) * 100,
      onTarget: Math.abs(wavelengthNm - design.targetNm) / design.targetNm <= 0.01,
      deflectionRatio: deflectionRatio({ gamma, K }),
      bunchLengthFs: bunch.lengthFs,
      slippageNm: slippagePerPeriodNm({ gamma, periodCm, K }),
      wavelengthsInBunch: wavelengthsInBunch({ bunchLengthFs: bunch.lengthFs, wavelengthNm }),
      peakCurrentA: bunch.peakCurrentA,
      rho,
      gainLengthM: gainLength,
      saturationLengthM: gainLength * design.saturationGainLengths,
      beamPowerW,
      euvW,
      wallMW,
      lppWallMW: euvW > 0 ? lppWallPowerMW({ euvW, perKilowattMW: design.lppWallPerKilowatt }) : 0,
      scanners: euvW > 0 ? scannerCount({ euvW, perScannerW: design.scannerWattEach }) : 0,
    };
  }

  return {
    ELECTRON_REST_MEV,
    ALFVEN_CURRENT,
    K_PER_TESLA_CM,
    DESIGN,
    lorentzGamma,
    oneMinusBeta,
    betaValue,
    undulatorK,
    resonantWavelengthNm,
    energyForWavelengthMeV,
    deflectionRatio,
    besselJ,
    couplingJJ,
    compressionFactor,
    peakCurrentA,
    compressedBunch,
    pierceParameter,
    gainLengthM,
    saturationLengthM,
    averageBeamPowerW,
    euvPowerW,
    wallPowerMW,
    scannerCount,
    lppWallPowerMW,
    bunchingFactor,
    coherentPower,
    averageAxialBeta,
    slippagePerPeriodNm,
    twoElectronIntensity,
    arrayIntensity,
    wavelengthsInBunch,
    HALBACH,
    halbachFieldT,
    emittanceFloorNm,
    shortestLasingWavelength,
    solve,
  };
});
