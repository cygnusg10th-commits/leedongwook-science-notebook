/* 공기의 무게 — 영점 조정된 저울 시뮬레이터
   Δ = V내부 × ( ρ안쪽 − ρ바깥 )        ρ대기 = 1.204 g/L (20 ℃, 101.325 kPa)
   색의 뜻은 숏츠와 동일하게 유지합니다.
     회색보라 #7a7f95 = 변화 없음 · 시안 #5fa8e0 = 희박·진공 · 핑크 #e878a8 = 압축·정답 */
(function () {
  'use strict';
  var RHO = 1.204;
  var C = { neon: '#7fd88f', pink: '#e878a8', cyan: '#5fa8e0', gray: '#7a7f95', glass: '#aab2c8' };

  var syr = document.getElementById('airSyringe');
  var scl = document.getElementById('airScale');
  var vg = document.getElementById('airVolume');
  var na = document.getElementById('airAmount');
  if (!syr || !scl || !vg || !na) return;

  function rnd(s, i) { var x = Math.sin(s * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function f(v, n) { return v.toFixed(n === undefined ? 3 : n); }

  function drawSyringe(o) {
    var pull = o.pull, dens = o.dens, col = o.col, cap = o.cap, label = o.label;
    var W = 880, bx = 186, bw = 468, bh = 150, by = 70, tipL = 108;
    var gw = bw * pull, px = bx + gw, s = '';
    s += '<defs>'
      + '<linearGradient id="awBarrel" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".32" stop-color="#fff" stop-opacity=".02"/>'
      + '<stop offset=".70" stop-color="#000" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>'
      + '<linearGradient id="awRod" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="' + C.glass + '" stop-opacity=".85"/><stop offset=".5" stop-color="' + C.glass + '" stop-opacity=".38"/>'
      + '<stop offset="1" stop-color="' + C.glass + '" stop-opacity=".70"/></linearGradient>'
      + '<linearGradient id="awGask" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#5b6274"/><stop offset=".5" stop-color="#2b3040"/><stop offset="1" stop-color="#4a5163"/></linearGradient></defs>';
    for (var i = 0; i < 54; i++) {
      var x = rnd(1, i) * W, y = rnd(2, i) * 280;
      if (x > tipL - 30 && x < bx + bw + 195 && y > by - 32 && y < by + bh + 32) continue;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + C.gray + '" opacity=".4"/>';
    }
    s += '<path d="M' + tipL + ' ' + (by + bh / 2 - 10) + ' L' + (bx - 25) + ' ' + (by + bh / 2 - 18)
      + ' L' + (bx - 25) + ' ' + (by + bh / 2 + 18) + ' L' + tipL + ' ' + (by + bh / 2 + 10) + ' Z"'
      + ' fill="' + C.glass + '" opacity=".34" stroke="' + C.glass + '" stroke-width="3" stroke-opacity=".55" stroke-linejoin="round"/>';
    s += '<rect x="' + (bx - 25) + '" y="' + (by + 14) + '" width="29" height="' + (bh - 28) + '" rx="9" fill="' + C.glass + '" opacity=".26" stroke="' + C.glass + '" stroke-width="3" stroke-opacity=".5"/>';
    if (gw > 2) {
      s += '<rect x="' + bx + '" y="' + by + '" width="' + gw + '" height="' + bh + '" fill="' + col + '" opacity=".14"/>';
      var n = Math.round(78 * dens);
      for (var j = 0; j < n; j++) {
        var gx = bx + 9 + rnd(3, j) * (gw - 18), gy = by + 9 + rnd(4, j) * (bh - 18);
        s += '<circle cx="' + gx.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="4" fill="' + col + '"/>';
      }
    }
    s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="8" fill="url(#awBarrel)"/>';
    for (var k = 1; k <= 9; k++) {
      var tx = bx + bw * k / 10, l = (k % 5 === 0) ? 26 : 16;
      s += '<line x1="' + tx + '" y1="' + (by + 5) + '" x2="' + tx + '" y2="' + (by + 5 + l) + '" stroke="' + C.glass
        + '" stroke-width="' + (k % 5 === 0 ? 3 : 2) + '" opacity="' + (k % 5 === 0 ? .6 : .36) + '"/>';
    }
    s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="8" fill="none" stroke="' + C.glass + '" stroke-width="4" stroke-opacity=".8"/>';
    s += '<rect x="' + (bx + 6) + '" y="' + (by + 8) + '" width="' + (bw - 12) + '" height="7" rx="4" fill="#fff" opacity=".16"/>';
    s += '<rect x="' + (px - 5) + '" y="' + (by + 3) + '" width="26" height="' + (bh - 6) + '" rx="8" fill="url(#awGask)"/>';
    var rodEnd = bx + bw + 126;
    s += '<rect x="' + (px + 21) + '" y="' + (by + bh / 2 - 11) + '" width="' + (rodEnd - px - 21) + '" height="22" fill="url(#awRod)"/>';
    s += '<line x1="' + (px + 21) + '" y1="' + (by + bh / 2) + '" x2="' + rodEnd + '" y2="' + (by + bh / 2) + '" stroke="#0f1320" stroke-width="4" opacity=".45"/>';
    s += '<rect x="' + (bx + bw - 4) + '" y="' + (by - 22) + '" width="22" height="' + (bh + 44) + '" rx="11" fill="' + C.glass + '" opacity=".55" stroke="' + C.glass + '" stroke-width="3" stroke-opacity=".7"/>';
    s += '<rect x="' + rodEnd + '" y="' + (by + bh / 2 - 42) + '" width="20" height="84" rx="10" fill="' + C.glass + '" opacity=".6" stroke="' + C.glass + '" stroke-width="3" stroke-opacity=".8"/>';
    if (cap) {
      s += '<rect x="' + (tipL - 36) + '" y="' + (by + bh / 2 - 23) + '" width="38" height="46" rx="10" fill="' + C.cyan + '" opacity=".88"/>';
      s += '<text x="' + (tipL - 17) + '" y="' + (by + bh / 2 - 33) + '" font-size="22" font-weight="900" fill="' + C.cyan + '" text-anchor="middle">막음</text>';
    }
    if (label) s += '<text x="' + (bx + bw / 2) + '" y="' + (by - 34) + '" font-size="28" font-weight="900" fill="' + col + '" text-anchor="middle">' + label + '</text>';
    syr.innerHTML = s;
  }

  function drawScale(delta, accent) {
    var W = 880, cx = 440;
    var sink = (Math.abs(delta) < 0.01) ? 0 : clamp(delta, -2, 2) * 9;
    var platY = 46 + sink, bodyTop = 132, bodyH = 446, s = '';
    s += '<defs>'
      + '<linearGradient id="awPlat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa2b8"/><stop offset="1" stop-color="#434a5d"/></linearGradient>'
      + '<linearGradient id="awBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3348"/><stop offset="1" stop-color="#171c2b"/></linearGradient>'
      + '<radialGradient id="awDial" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#182036"/><stop offset="1" stop-color="#0b0f1a"/></radialGradient></defs>';
    s += '<ellipse cx="' + cx + '" cy="' + (platY + 30) + '" rx="298" ry="11" fill="#000" opacity=".28"/>';
    s += '<rect x="' + (cx - 30) + '" y="' + (platY + 13) + '" width="60" height="' + (bodyTop - platY - 1) + '" rx="6" fill="#3d4459"/>';
    s += '<rect x="' + (cx - 348) + '" y="' + platY + '" width="696" height="23" rx="11" fill="url(#awPlat)"/>';
    s += '<rect x="' + (cx - 348) + '" y="' + (platY + 2) + '" width="696" height="7" rx="4" fill="#fff" opacity=".26"/>';
    s += '<path d="M' + (cx - 326) + ' ' + (bodyTop + bodyH) + ' L' + (cx - 294) + ' ' + bodyTop
      + ' q0 -20 24 -20 h540 q24 0 24 20 L' + (cx + 326) + ' ' + (bodyTop + bodyH)
      + ' q0 22 -26 22 h-604 q-26 0 -26 -22 z" fill="url(#awBody)" stroke="' + C.glass + '" stroke-width="4" stroke-opacity=".36"/>';
    s += '<text x="' + cx + '" y="' + (bodyTop + 36) + '" font-size="22" font-weight="700" fill="' + C.gray + '" text-anchor="middle" letter-spacing="7">TARE · 영점 조정됨</text>';
    var dcx = cx, dcy = bodyTop + 198, R = 126, A0 = -128, A1 = 128;
    function ang(g) { return A0 + (clamp(g, -2, 2) + 2) / 4 * (A1 - A0); }
    function P(a, r) { return [dcx + r * Math.sin(a * Math.PI / 180), dcy - r * Math.cos(a * Math.PI / 180)]; }
    s += '<circle cx="' + dcx + '" cy="' + dcy + '" r="' + (R + 20) + '" fill="url(#awDial)" stroke="' + C.glass + '" stroke-width="4" stroke-opacity=".32"/>';
    for (var g = -2; g <= 2.0001; g += 0.25) {
      var maj = Math.abs(g % 0.5) < 1e-9, big = Math.abs(g % 1) < 1e-9;
      var a = ang(g), p1 = P(a, R), p2 = P(a, R - (big ? 24 : maj ? 15 : 10));
      var col = g < -0.02 ? C.cyan : g > 0.02 ? C.pink : C.neon;
      s += '<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1)
        + '" stroke="' + col + '" stroke-width="' + (big ? 5 : maj ? 3.5 : 2.5) + '" opacity="' + (big ? .95 : maj ? .6 : .38) + '" stroke-linecap="round"/>';
      if (big) {
        var pt = P(a, R - 48);
        s += '<text x="' + pt[0].toFixed(1) + '" y="' + (pt[1] + 10).toFixed(1) + '" font-size="26" font-weight="900" fill="' + col + '" opacity=".92" text-anchor="middle">' + (g > 0 ? '+' : '') + g + '</text>';
      }
    }
    s += '<text x="' + dcx + '" y="' + (dcy + 84) + '" font-size="21" font-weight="700" fill="' + C.gray + '" text-anchor="middle" letter-spacing="3">그램 (g)</text>';
    var an = ang(delta), np = P(an, R - 16), bp = P(an + 180, 32);
    s += '<line x1="' + bp[0].toFixed(1) + '" y1="' + bp[1].toFixed(1) + '" x2="' + np[0].toFixed(1) + '" y2="' + np[1].toFixed(1) + '" stroke="' + accent + '" stroke-width="8" stroke-linecap="round"/>';
    s += '<circle cx="' + bp[0].toFixed(1) + '" cy="' + bp[1].toFixed(1) + '" r="9" fill="' + accent + '"/>';
    s += '<circle cx="' + dcx + '" cy="' + dcy + '" r="18" fill="#0b0f1a" stroke="' + accent + '" stroke-width="6"/>';
    var sgn = delta > 0.0005 ? '+' : delta < -0.0005 ? '−' : '±', ry = bodyTop + bodyH - 104;
    s += '<rect x="' + (cx - 232) + '" y="' + ry + '" width="464" height="90" rx="17" fill="#080b14" stroke="' + accent + '" stroke-width="4" stroke-opacity=".7"/>';
    s += '<text x="' + cx + '" y="' + (ry + 65) + '" font-size="64" font-weight="900" fill="' + accent + '" text-anchor="middle" letter-spacing="2">' + sgn + ' ' + f(Math.abs(delta)) + ' g</text>';
    scl.innerHTML = s;
  }

  var PRESETS = [
    { n: '대기압 1L 흡입', vg: 1, na: 1 },
    { n: '막고 당김 (진공)', vg: 1, na: 0 },
    { n: '1L → 0.5L 압축', vg: 0.5, na: 1 },
    { n: '1L에 공기 2L', vg: 1, na: 2 }
  ];
  var host = document.getElementById('airPresets');
  if (host) {
    PRESETS.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip-button'; b.textContent = p.n;
      b.setAttribute('data-i', i); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { vg.value = p.vg; na.value = p.na; render(); });
      host.appendChild(b);
    });
  }

  function render() {
    var V = parseFloat(vg.value), N = parseFloat(na.value);
    var rhoIn = V > 0 ? RHO * N / V : 0;
    var d = V * (rhoIn - RHO);
    var ratio = rhoIn / RHO;
    var zero = Math.abs(d) < 5e-4;
    var accent = zero ? C.gray : (d > 0 ? C.pink : C.cyan);

    drawSyringe({
      pull: clamp(V / 2, 0.05, 1) * 0.92,
      dens: Math.max(ratio, 0.06),
      col: accent, cap: Math.abs(ratio - 1) > 0.02,
      label: zero ? '대기압과 같은 밀도' : (d > 0 ? '압축됨' : '희박함')
    });
    drawScale(d, accent);

    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('airVolumeOut', f(V, 2) + ' L');
    set('airAmountOut', f(N, 2) + ' L');
    set('airRhoOut', f(rhoIn) + ' g/L');
    set('airMassOut', f(RHO * N) + ' g');
    set('airBuoyOut', '−' + f(RHO * V) + ' g');
    set('airDeltaOut', (d >= 0 ? '+' : '−') + f(Math.abs(d)) + ' g');

    var v = document.getElementById('airVerdict');
    if (v) {
      var t;
      if (zero) t = '내부 기체 밀도가 바깥 공기와 <strong>똑같습니다.</strong> 질량 증가분과 부력 증가분이 정확히 상쇄되어 <strong>눈금은 꿈쩍도 하지 않습니다.</strong>';
      else if (d > 0) t = '내부가 바깥보다 <strong>' + f(ratio, 2) + '배 조밀</strong>합니다. 초과분만큼 <strong>무거워집니다.</strong>';
      else t = '내부가 바깥보다 <strong>희박</strong>합니다 (밀도비 ' + f(ratio, 2) + '). 부력이 이겨서 <strong>가벼워집니다.</strong>';
      v.innerHTML = t;
    }
    var eq = document.getElementById('airEquation');
    if (eq) eq.textContent = 'Δ = ' + f(V, 2) + ' L × ( ' + f(rhoIn) + ' − 1.204 ) g/L = ' + (d >= 0 ? '+' : '−') + f(Math.abs(d)) + ' g';

    if (host) {
      Array.prototype.forEach.call(host.children, function (b) {
        var p = PRESETS[+b.getAttribute('data-i')];
        b.setAttribute('aria-pressed', (Math.abs(p.vg - V) < 1e-9 && Math.abs(p.na - N) < 1e-9) ? 'true' : 'false');
      });
    }
  }

  vg.addEventListener('input', render);
  na.addEventListener('input', render);
  render();
})();
