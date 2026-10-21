// Checks the importer's blend rebuilds: run with `node _blend_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them).
// - Blend Ranges ("This Layer"): the SkSL filter from _affBlendRangeSksl, run here as JavaScript, against
//   what Affinity drew for the "Nice green" paper's ranges (strips over black, 2026-10-16): each strip's
//   value is its colour times the range curve at its luma.
// - Vivid / Linear / Pin Light: the two copies (darks through Levels In White 0.5, lights through Levels
//   In Black 0.5, each in its Cavalry mode) must give the standard mode for every backdrop and layer value.
// - Curves: the Bezier graph _affCurveGraph writes for the "Nice green" photo's smooth curve, evaluated the
//   way Cavalry's Curves does (interpolation 1 = Bezier from the point offsets, 0 = Linear), against what
//   Affinity drew for that curve on 86 greys (2026-10-16); a straight curve stays straight.
'use strict';
const fs = require('fs'), assert = require('assert');
const imp = fs.readFileSync(__dirname + '/../../src/functions/quiver_affinity_import.js', 'utf8');
const grab = function (start, end) { const a = imp.indexOf(start), b = imp.indexOf(end, a); assert(a >= 0 && b > a, 'cannot find ' + start); return imp.slice(a, b); };

// --- Blend Ranges ---
const sksl = new Function(grab('function _affBlendRangeSksl', 'function _affReportBlendRanges') + '\nreturn _affBlendRangeSksl;')();
const code = sksl([[0, 1], [0.494, 0.501], [0.758, 0.04], [0.949, 0.36], [1, 1]]);
const body = code.replace(/^[\s\S]*half4 main\(float2 p\) \{/, '').replace(/\}\s*$/, '').replace(/\bfloat /g, 'var ').replace(/half4 c = layer\.eval\(p\);/, '');
const filter = new Function('c', 'var mix = function (a, b, t) { return a + (b - a) * t; }, clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); }, float3 = function (x, y, z) { return y === undefined ? x : [x, y, z]; }, float = function (v) { return v; }, half = float, dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };\n' +
    'var C = { a: c[3], rgb: [c[0] * c[3], c[1] * c[3], c[2] * c[3]] }; c = C;\n' +
    body.replace('float3(c.rgb) / float(c.a)', '[c.rgb[0] / c.a, c.rgb[1] / c.a, c.rgb[2] / c.a]').replace('return c * half(k);', 'return [c.rgb[0] * k, c.rgb[1] * k, c.rgb[2] * k];'));
const overBlack = function (rgb) { return filter([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1]).map(function (v) { return v * 255; }); };
const greys = { 0: 0, 5: 5, 10: 10, 20: 18, 50: 40, 100: 60, 125: 63, 150: 50, 190: 12, 195: 9, 200: 16, 230: 64, 245: 124, 250: 188, 255: 255 };
Object.keys(greys).forEach(function (g) { const got = overBlack([+g, +g, +g])[0]; assert.ok(Math.abs(got - greys[g]) <= 1.5, 'grey ' + g + ': ' + got.toFixed(1) + ', Affinity ' + greys[g]); });
[[[255, 0, 0], [177, 0, 0]], [[0, 255, 0], [0, 86, 0]], [[0, 0, 255], [0, 0, 225]], [[255, 255, 0], [64, 64, 0]], [[0, 255, 255], [0, 35, 35]], [[255, 0, 255], [148, 0, 148]],
    [[200, 100, 50], [101, 51, 25]], [[29, 123, 68], [19, 80, 44]], [[210, 206, 189], [25, 24, 22]]].forEach(function (t) {
    const got = overBlack(t[0]);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i] - t[1][i]) <= 1.5, t[0] + ': ' + got.map(function (v) { return v.toFixed(1); }) + ', Affinity ' + t[1]);
});

// --- Split modes ---
const split = new Function(grab('var AFFINITY_SPLIT_BLENDS', 'function _affCanSplitBlend') + '\nreturn AFFINITY_SPLIT_BLENDS;')();
const modes = { // separable blend functions, backdrop b and source s in 0..1
    'color-burn': function (b, s) { return b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s); },
    'color-dodge': function (b, s) { return b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)); },
    'plus-darker': function (b, s) { return Math.max(0, b + s - 1); }, 'plus-lighter': function (b, s) { return Math.min(1, b + s); },
    'darken': Math.min, 'lighten': Math.max
};
const standard = {
    VividLight: function (b, a) { return a < 0.5 ? modes['color-burn'](b, 2 * a) : modes['color-dodge'](b, 2 * a - 1); },
    LinearLight: function (b, a) { return Math.min(1, Math.max(0, b + 2 * a - 1)); },
    PinLight: function (b, a) { return a < 0.5 ? Math.min(b, 2 * a) : Math.max(b, 2 * a - 1); }
};
const clip = function (v) { return Math.min(1, Math.max(0, v)); };
Object.keys(standard).forEach(function (name) {
    const pair = split[name];
    assert.ok(pair && modes[pair[0]] && modes[pair[1]], name + ': unknown split ' + pair);
    for (let bi = 0; bi <= 20; bi++) for (let ai = 0; ai <= 20; ai++) {
        const b = bi / 20, a = ai / 20;
        const darks = modes[pair[0]](b, clip(2 * a)), both = modes[pair[1]](darks, clip(2 * a - 1));
        assert.ok(Math.abs(both - standard[name](b, a)) < 1e-9, name + ' backdrop ' + b + ' layer ' + a + ': ' + both + ' vs ' + standard[name](b, a));
    }
});
// --- Curves ---
const curveLib = new Function('api', grab('function _affNaturalSlopes', 'function _affApplyAdjustment') + '\nreturn _affCurveGraph;');
const graphFor = function (curve) {
    const lists = {}, api = {
        graphPreset: function (f, l) { lists[l] = [{}, {}]; }, addArrayIndex: function (f, l) { lists[l].push({}); }, getArrayCount: function (f, l) { return lists[l].length; },
        set: function (f, o) { Object.keys(o).forEach(function (k) { const m = k.match(/^(\w+)\.(\d+)\.(\w+)$/); lists[m[1]][+m[2]][m[3]] = o[k]; }); }
    };
    const wrote = curveLib(api)('f', 'rgb', curve);
    return wrote ? lists.rgb : null;
};
const evalGraph = function (G, x) {
    let k = 0; while (k < G.length - 2 && x > G[k + 1].position.x) k++;
    const a = G[k], b = G[k + 1], p0 = a.position, p3 = b.position;
    if (a.interpolation === 0) return p0.y + (p3.y - p0.y) * (x - p0.x) / (p3.x - p0.x);
    const p1 = { x: p0.x + a.right.x, y: p0.y + a.right.y }, p2 = { x: p3.x + b.left.x, y: p3.y + b.left.y };
    const bz = function (t, q) { const u = 1 - t; return u * u * u * p0[q] + 3 * u * u * t * p1[q] + 3 * u * t * t * p2[q] + t * t * t * p3[q]; };
    let lo = 0, hi = 1; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (bz(mid, 'x') < x) lo = mid; else hi = mid; }
    return bz((lo + hi) / 2, 'y');
};
const affinityCurve = '0:0 3:4 6:7 9:11 12:14 15:18 18:21 21:25 24:28 27:31 30:35 33:38 36:41 39:44 42:47 45:50 48:53 51:56 54:59 57:61 60:64 63:66 66:69 69:71 72:73 75:76 78:78 81:80 84:82 87:84 90:87 93:89 96:91 99:93 102:95 105:97 108:99 111:101 114:104 117:106 120:108 123:110 126:113 129:115 132:117 135:120 138:122 141:125 144:128 147:130 150:133 153:136 156:139 159:142 162:145 165:148 168:151 171:154 174:157 177:160 180:164 183:167 186:170 189:174 192:177 195:181 198:184 201:188 204:191 207:195 210:199 213:202 216:206 219:210 222:213 225:217 228:221 231:225 234:228 237:232 240:236 243:240 246:244 249:247 252:251 255:255';
const G = graphFor({ points: [[0, 0], [0.183, 0.203], [0.539, 0.478], [1, 1]], linear: false });
assert.ok(G && G.every(function (q) { return q.interpolation === 1; }), 'a smooth curve becomes Bezier points');
affinityCurve.split(' ').forEach(function (pair) { const v = pair.split(':').map(Number), got = evalGraph(G, v[0] / 255) * 255; assert.ok(Math.abs(got - v[1]) <= 1, 'curve at ' + v[0] + ': ' + got.toFixed(2) + ', Affinity ' + v[1]); });
const L = graphFor({ points: [[0, 0], [0.5, 0.1], [1, 1]], linear: true });
assert.ok(L.every(function (q) { return q.interpolation === 0; }) && Math.abs(evalGraph(L, 0.25) - 0.05) < 1e-9, 'a straight curve stays straight');
assert.strictEqual(graphFor({ points: [[0, 0], [1, 1]], linear: false }), null, 'the identity writes nothing');
// --- Black & White ---
// the SkSL from _affBlackWhiteSksl, run as JavaScript, against what Affinity drew for the "Temi Coker" portrait's
// settings (red 1.099, yellow 1.4, green -0.412, cyan -2, blue -1.764, magenta 0.305) on 71 swatches (2026-10-16)
const bwLib = new Function(grab('function _affBlackWhiteSksl', 'function _affReportBlendRanges') + '\nreturn _affBlackWhiteSksl;')();
const bwBody = bwLib({ red: 1.099098, yellow: 1.400258, green: -0.412158, cyan: -2, blue: -1.763665, magenta: 0.304688 })
    .replace(/^[\s\S]*half4 main\(float2 p\) \{/, '').replace(/\}\s*$/, '').replace('half4 c = layer.eval(p);', '').replace(/\bfloat (?=[a-z])/g, 'var ');
const bw = new Function('c', 'var float = function (v) { return v; }, half = float, half4 = function (r, g, b, a) { return [r, g, b, a]; }, max = Math.max, min = Math.min, clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };\n' + bwBody);
const bwAffinity = '0,0,0>0 0,0,85>0 0,0,170>0 0,0,255>0 0,85,0>0 0,85,85>0 0,85,170>0 0,85,255>0 0,170,0>0 0,170,85>0 0,170,170>0 0,170,255>0 0,255,0>0 0,255,85>0 0,255,170>0 0,255,255>0 85,0,0>93 85,0,85>26 85,0,170>0 85,0,255>0 85,85,0>119 85,85,85>85 85,85,170>0 85,85,255>0 85,170,0>84 85,170,85>50 85,170,170>0 85,170,255>0 85,255,0>49 85,255,85>15 85,255,170>0 85,255,255>0 170,0,0>187 170,0,85>119 170,0,170>52 170,0,255>0 170,85,0>212 170,85,85>178 170,85,170>111 170,85,255>0 170,170,0>238 170,170,85>204 170,170,170>170 170,170,255>20 170,255,0>203 170,255,85>169 170,255,170>135 170,255,255>0 255,0,0>255 255,0,85>213 255,0,170>145 255,0,255>78 255,85,0>255 255,85,85>255 255,85,170>204 255,85,255>137 255,170,0>255 255,170,85>255 255,170,170>255 255,170,255>196 255,255,0>255 255,255,85>255 255,255,170>255 255,255,255>255 200,60,30>226 30,120,220>0 128,64,192>0 250,240,230>255 90,80,70>95 255,200,0>255 0,200,180>0';
bwAffinity.split(' ').forEach(function (t) {
    const m = t.split('>'), rgb = m[0].split(',').map(Number), want = +m[1], got = bw({ r: rgb[0] / 255, g: rgb[1] / 255, b: rgb[2] / 255, a: 1 })[0] * 255;
    assert.ok(Math.abs(got - want) <= 1, 'black & white ' + m[0] + ': ' + got.toFixed(1) + ', Affinity ' + want);
});
// --- Brightness / Contrast ---
// the SkSL from _affBrightnessContrastSksl, run as JavaScript, against Affinity's greys (2026-10-16): the "Temi Coker"
// head's settings (brightness -0.2599, contrast 0.5334), brightness 0.7 with contrast 0.8, and contrast -1 alone
const bcLib = new Function(grab('function _affBrightnessContrastSksl', 'function _affReportBlendRanges') + '\nreturn _affBrightnessContrastSksl;')();
const bcRun = function (b, c) {
    const js = bcLib(b, c).replace('uniform shader layer;', '').replace('float bc(float x) {', 'function bc(x) {').replace('half4 main(float2 p) {', 'return function (c) {')
        .replace('half4 c = layer.eval(p);', '').replace(/\bfloat (?=[a-z])/g, 'var ');
    return new Function('var float = function (v) { return v; }, half = float, half4 = function (r, g, b, a) { return [r, g, b, a]; }, max = Math.max, pow = Math.pow;\n' + js)();
};
[[-0.25993067026138306, 0.5334231853485107, '0>0 15>3 30>9 45>17 60>26 75>37 90>50 105>65 120>81 135>99 150>118 165>140 180>161 195>182 210>202 225>221 240>240 255>255'], [0.7, 0.8, '0>0 5>2 10>6 15>13 20>20 25>30 30>40 35>52 40>64 45>77 50>90 55>104 60>119 65>134 70>147 75>160 80>171 85>181 90>190 95>198 100>206 105>212 110>218 115>223 120>228 125>232 130>236 135>239 140>242 145>244 150>246 155>248 160>249 165>251 170>252 175>252 180>253 185>254 190>254 195>254 200>254 205>255 210>255 215>255 220>255 225>255 230>255 235>255 240>255 245>255 250>255 255>255'], [0, -1, '0>0 5>25 10>36 15>44 20>51 25>57 30>62 35>67 40>72 45>76 50>80 55>84 60>88 65>91 70>95 75>98 80>101 85>104 90>107 95>110 100>113 105>116 110>119 115>121 120>124 125>126 130>129 135>131 140>134 145>136 150>139 155>142 160>145 165>148 170>151 175>154 180>157 185>160 190>164 195>167 200>171 205>175 210>179 215>183 220>188 225>193 230>198 235>204 240>211 245>219 250>230 255>255']].forEach(function (t) {
    const f = bcRun(t[0], t[1]);
    t[2].split(' ').forEach(function (pair) { const v = pair.split('>').map(Number), got = f({ r: v[0] / 255, g: v[0] / 255, b: v[0] / 255, a: 1 })[0] * 255; assert.ok(Math.abs(got - v[1]) <= 1, 'brightness ' + t[0] + ' contrast ' + t[1] + ' at ' + v[0] + ': ' + got.toFixed(2) + ', Affinity ' + v[1]); });
});
// --- Fill noise ---
// Affinity's Noise slider: uniform per-pixel noise, standard deviation 84 levels x Noise (measured 2026-10-16), so the
// SkSL spans sqrt(12) x 84 / 255 of the range per unit; a fill without noise gets no filter
const noiseLib = new Function('api', '_affWarn', grab('var AFFINITY_NOISE_SKSL', 'function _affReportBlendRanges') + '\nreturn { code: AFFINITY_NOISE_SKSL, add: _affFillNoise };');
const nmade = [], napi = { create: function (t, n) { nmade.push({ type: t, name: n }); return 'k'; }, set: function (id, o) { Object.assign(nmade[nmade.length - 1], o); }, connect: function (a, b, c, d) { nmade[nmade.length - 1].to = c + '.' + d; }, parent: function () {} };
const noise = noiseLib(napi, function (m) { throw new Error(m); });
const span = +noise.code.match(/\* ([0-9.]+) \* float\(n0\)/)[1];
assert.ok(Math.abs(span - Math.sqrt(12) * 84 / 255) < 0.001, 'noise span ' + span + ' gives an sd of ' + (span / Math.sqrt(12) * 255).toFixed(1) + ' levels per unit, Affinity 84');
noise.add('rect', { name: 'Dark', fill: { noise: 0.1328 } }); noise.add('rect', { name: 'Plain', fill: { noise: 0 } });
assert.ok(nmade.length === 1 && nmade[0].type === 'skslFilter' && nmade[0]['inputs.0'] === 0.1328 && nmade[0].to === 'rect.filters', 'one noise filter, its amount on n0');
// --- Gradient midpoints and radial placement ---
// a stop's midpoint bends its run to t^(1 + 8(m - 0.5)) (mirrored below 0.5): the stops _affStopsToQuiver writes, read
// as straight runs, against Affinity's black-to-white ramps at midpoints 0.777 and 0.25 (256 px, 2026-10-17)
const stopLib = new Function(grab('var AFFINITY_GRADIENT_INTERP_GAMMA', '// Builds a Cavalry gradient shader') + grab('function _affHex', '\nfunction ') + '\n' + grab('function _affAlpha', '\nfunction ') + '\nreturn _affStopsToQuiver;')();
[[0.777, '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 2 2 2 2 2 2 2 3 3 3 3 3 3 4 4 4 4 4 5 5 5 5 5 6 6 6 6 7 7 7 8 8 8 8 9 9 9 10 10 11 11 11 12 12 13 13 13 14 14 15 15 16 16 17 17 18 18 19 19 20 20 21 22 22 23 23 24 25 25 26 27 27 28 29 29 30 31 32 32 33 34 35 36 37 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 59 60 61 62 63 65 66 67 69 70 71 72 74 75 77 78 79 81 82 84 85 87 88 90 92 93 95 96 98 100 101 103 105 107 108 110 112 114 116 118 119 121 123 125 127 129 131 133 135 137 140 142 144 146 148 150 153 155 157 160 162 164 167 169 172 174 176 179 181 184 187 189 192 194 197 200 203 205 208 211 214 217 219 222 225 228 231 234 237 240 243 247 250 253'], [0.25, '1 4 7 10 13 16 18 21 24 27 30 32 35 38 40 43 46 48 51 53 56 59 61 63 66 68 71 73 76 78 80 83 85 87 89 92 94 96 98 100 102 104 107 109 111 113 115 117 119 121 123 125 126 128 130 132 134 136 137 139 141 143 144 146 148 149 151 153 154 156 157 159 161 162 164 165 167 168 170 171 172 174 175 176 178 179 180 182 183 184 186 187 188 189 190 192 193 194 195 196 197 198 200 201 202 203 204 205 206 207 208 209 210 211 211 212 213 214 215 216 217 218 218 219 220 221 221 222 223 224 224 225 226 227 227 228 229 229 230 230 231 232 232 233 233 234 235 235 236 236 237 237 238 238 239 239 240 240 240 241 241 242 242 242 243 243 244 244 244 245 245 245 246 246 246 247 247 247 247 248 248 248 248 249 249 249 249 250 250 250 250 250 251 251 251 251 251 251 252 252 252 252 252 252 252 253 253 253 253 253 253 253 253 253 253 253 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254 254']].forEach(function (t) {
    const st = stopLib({ stops: [{ position: 0, midpoint: t[0], colour: { r: 0, g: 0, b: 0, a: 1 } }, { position: 1, midpoint: 0.5, colour: { r: 255, g: 255, b: 255, a: 1 } }] });
    const val = function (x) { let k = 0; while (k < st.length - 2 && x > st[k + 1].offset) k++; const a = st[k], b = st[k + 1], u = (x - a.offset) / (b.offset - a.offset); return parseInt(a.color.slice(1, 3), 16) * (1 - u) + parseInt(b.color.slice(1, 3), 16) * u; };
    t[1].split(' ').map(Number).forEach(function (v, x) { const got = val((x + 0.5) / 256); assert.ok(Math.abs(got - v) <= 2, 'midpoint ' + t[0] + ' at ' + x + ': ' + got.toFixed(1) + ', Affinity ' + v); });
});
// the "Frankentoon" background's radial (a turned circle on a 3.04 x 4.42 stretched layer, so a skewed transform): every
// point of Affinity's unit circle must land on the ellipse Cavalry draws from the placement (Fixed radius, scale on its
// own x and y, then turned anticlockwise, +y up)
let placed = null;
const radialLib = new Function('api', '_affWarn', grab('function _affApply(', '\nfunction ') + '\n' + grab('function _affPlaceRadial', '\nfunction ') + '\nreturn _affPlaceRadial;')(
    { set: function (id, o) { placed = o; } }, function (m) { throw new Error(m); });
const Gd = [2169.3, 1776.3, 2855.3, -2661.8, 3108.4, 2288.3];
radialLib('g', Gd, { x: 2879, y: 2338.6 });
assert.strictEqual(placed['generator.radiusMode'], 0, 'a fixed radius');
for (let k = 0; k < 24; k++) {
    const t = k * Math.PI / 12, px = Gd[0] * Math.cos(t) + Gd[1] * Math.sin(t), py = Gd[3] * Math.cos(t) + Gd[4] * Math.sin(t); // from the centre, y down
    const r = -placed['generator.rotation'] * Math.PI / 180, ux = px * Math.cos(r) + py * Math.sin(r), uy = -px * Math.sin(r) + py * Math.cos(r); // into the ellipse's axes
    const e = Math.pow(ux / (placed['generator.radius'] * placed['generator.scale'][0] / 100), 2) + Math.pow(uy / (placed['generator.radius'] * placed['generator.scale'][1] / 100), 2);
    assert.ok(Math.abs(e - 1) < 1e-6, 'unit circle point ' + k + ' lands at ' + e.toFixed(6) + ' of the ellipse');
}
assert.ok(Math.abs(placed['generator.offset'][0] + 23.7) < 0.01 && Math.abs(placed['generator.offset'][1] - 50.3) < 0.01, 'centred where Affinity has it');
// --- Colour profile (Affinity script) ---
// an Adobe RGB (1998) document's colours as Affinity shows them in sRGB (measured 2026-10-16); an sRGB one is left alone
const ser = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8'), sgrab = function (a, b) { const i = ser.indexOf(a), j = ser.indexOf(b, i); assert(i >= 0 && j > i, 'cannot find ' + a); return ser.slice(i, j); };
const prof = new Function(sgrab('function safe(', '// Enum value') + sgrab('const ADOBE_RGB_TO_SRGB', 'function rgba(') + '\nreturn { set: setDocumentProfile, conv: function () { return __toSrgb; } };')();
assert.strictEqual(prof.set({ colourProfile: { name: 'Adobe RGB (1998)' } }), 'Adobe RGB (1998)');
[[[145, 187, 115], [124, 188, 111]], [[147, 189, 119], [126, 190, 114]], [[0, 0, 0], [0, 0, 0]], [[255, 255, 255], [255, 255, 255]]].forEach(function (t) {
    const v = t[0].slice(); prof.conv()(v, 0);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(v[i] - t[1][i]) <= 1, 'Adobe RGB ' + t[0] + ' -> ' + v + ', Affinity shows ' + t[1]);
});
prof.set({ colourProfile: { name: 'sRGB IEC61966-2.1' } }); assert.strictEqual(prof.conv(), null, 'an sRGB document is not converted');
// --- Matte fold ---
// a picture matte folded into another matte must land where the picture sits in the comp: map points of
// the picture through the folded shader (offset from m's centre, CCW rotation, scale, all y up, as
// measured in Cavalry 2026-10-16) and through the source matte, and compare in comp space
const foldLib = new Function('api', grab('var __affMatteFolds', '// Erase: a layer') + '\nreturn _affAddAlphaMatte;');
const xf = function (deg, s, tx, ty) { const r = deg * Math.PI / 180; return [s * Math.cos(r), -s * Math.sin(r), tx, s * Math.sin(r), s * Math.cos(r), ty, 0, 0, 1]; };
const attrs = {
    m: { globalTransform: xf(30, 1, 43, -10) }, src: { globalTransform: xf(50, 2, 100, 20), 'generator.dimensions': { x: 200, y: 100 } },
    sh: { rotation: 0, outResolution: { x: 400, y: 200 }, scaleMode: 4, 'offset.x': 0, 'offset.y': 0, filterQuality: 2 }
}, made = {}, links = [];
const fapi = {
    getInConnectedAttributes: function (t) { return t === 't' ? ['trackMattes.0.id'] : []; },
    getInConnection: function (t, a) { return t === 't' ? 'm.id' : a === 'image' ? 'asset.id' : 'sh.id'; },
    getLayerType: function (id) { return id === 'sh' ? 'imageShader' : 'basicShape'; }, getNiceName: function (id) { return id; },
    get: function (id, a) { return attrs[id][a]; }, create: function () { return 'f'; }, set: function (id, o) { Object.assign(made, o); },
    connect: function (a, b, c, d) { links.push([a, c, d]); }, parent: function () {}, deleteLayer: function () {}
};
foldLib(fapi)('src', 't');
assert.ok(made.blendMode === 6 && links.some(function (l) { return l[0] === 'f' && l[1] === 'm'; }) && !links.some(function (l) { return l[2] === 'trackMattes'; }), 'the picture is folded into the matte the layer already has');
const apply = function (M, x, y) { return [M[0] * x + M[1] * y + M[2], M[3] * x + M[4] * y + M[5]]; };
[[0, 0], [200, 100], [-200, 100], [123, -77]].forEach(function (p) { // image pixels from its centre, y up
    const viaSrc = apply(attrs.src.globalTransform, p[0] * 0.5, p[1] * 0.5); // cover: 200x100 rect over a 400x200 file
    const r = made.rotation * Math.PI / 180, qx = p[0] * made['scale.x'], qy = p[1] * made['scale.y'];
    const viaFold = apply(attrs.m.globalTransform, made['offset.x'] + qx * Math.cos(r) - qy * Math.sin(r), made['offset.y'] + qx * Math.sin(r) + qy * Math.cos(r));
    assert.ok(Math.abs(viaSrc[0] - viaFold[0]) < 1e-6 && Math.abs(viaSrc[1] - viaFold[1]) < 1e-6, 'fold places image point ' + p + ' at ' + viaFold + ', the matte has it at ' + viaSrc);
});
console.log('blends: Blend Ranges filter matches Affinity on 15 greys and 9 colours; Vivid, Linear and Pin Light splits match their formulas; Curves graph within a level of Affinity on 86 greys; Black & White within a level on 71 swatches; Brightness / Contrast within a level on 3 settings; fill noise as strong as in Affinity; gradient midpoints within 2 levels; a skewed radial on its true ellipse; Adobe RGB colours as Affinity shows them; a folded matte lands where its picture sits');
console.log('ok');
