// Checks the art brush route: run with `node _art_brush_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them).
// - the Affinity script's eligibility check and path length (quiver-affinity.js), on the 180 grid
//   strokes (dev/testfiles/affinity/brush-grid) and on hand-made records that must fall back;
// - the hidden copy of the path the importer's Pathfinder follows (quiver_affinity_import.js,
//   _affArtBrushPathCode), run against a stand-in for Cavalry's Path and Layer input: it must give the
//   path in the brush's own space (its world transform taken back out), an open path lengthened by the
//   overhang at both ends, scaled with the path's length, along the end directions; a closed one as is.
'use strict';
const fs = require('fs'), assert = require('assert');
const grab = function (src, start, end) { const a = src.indexOf(start), b = src.indexOf(end, a); assert(a >= 0 && b > a, 'cannot find ' + start); return src.slice(a, b); };
const near = function (name, got, want, tol) { assert.ok(Math.abs(got - want) <= tol, name + ': ' + got + ', expected ' + want + ' +/- ' + tol); };

// --- Affinity script ---
const ser = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8');
const lib = new Function(grab(ser, 'function safe(', '// Enum value') + grab(ser, 'function matApply(', 'function rnd6(') +
    grab(ser, 'const ART_BRUSH_MAX_SQUASH', 'let __artDoc') + grab(ser, '// Length in spread pixels of one subpath', 'function exportArtBrush(') + '\nreturn { curveLength: curveLength, artBrushCheck: artBrushCheck };')();
const line = [{ closed: false, start: { x: 0, y: 0 }, beziers: [[10, 0, 20, 0, 30, 0]] }];
near('straight line length', lib.curveLength(line[0], [1, 0, 0, 0, 1, 0]), 30, 1e-9);
near('scaled line length', lib.curveLength(line[0], [2, 0, 5, 0, 2, 7]), 60, 1e-9);
// the 180 grid strokes are kept out of the repo (dev/testfiles is ignored)
const gridPath = __dirname + '/../../testfiles/affinity/brush-grid/grid-strokes.json';
if (!fs.existsSync(gridPath)) console.error('skipped the grid checks: no brush test data in dev/testfiles/affinity');
else {
    const grid = JSON.parse(fs.readFileSync(gridPath, 'utf8'));
    Object.keys(grid).forEach(function (tag) {
        const s = grid[tag], rec = { curves: s.curves, world: s.world, stroke: s.stroke, fill: null, fills: null };
        const c = lib.artBrushCheck(rec);
        assert.strictEqual(c.why, null, tag + ' (' + s.brush + ') should be an art brush, got ' + c.why);
        near(tag + ' length', lib.curveLength(s.curves[0], s.world), 379.14, 0.05); // every grid arch is the same curve
    });
    const arch = grid['A2-040'], base = function (over) { const r = { curves: arch.curves, world: arch.world, stroke: Object.assign({}, arch.stroke), fill: null, fills: null }; return Object.assign(r, over || {}); };
    assert.strictEqual(lib.artBrushCheck(base({ curves: [Object.assign({}, arch.curves[0], { closed: true })] })).why, null, 'a closed path is fine');
    assert.strictEqual(lib.artBrushCheck(base({ fill: { type: 'Solid' } })).why, null, 'a filled path is fine');
    assert.strictEqual(lib.artBrushCheck(base({ stroke: Object.assign({}, arch.stroke, { fill: { type: 'Gradient' } }) })).why, null, 'a gradient pen is fine');
    assert.strictEqual(lib.artBrushCheck(base({ stroke: Object.assign({}, arch.stroke, { fill: { type: 'None' }, imageBrush: true }) })).why, null, 'an image brush with no pen is fine (its own colours)');
    assert.strictEqual(lib.artBrushCheck(base({ stroke: Object.assign({}, arch.stroke, { fill: { type: 'None' } }) })).why, 'a pattern pen', 'a plain brush with no pen is not');
    assert.strictEqual(lib.artBrushCheck(base({ stroke: Object.assign({}, arch.stroke, { fill: { type: 'Gradient' }, imageBrush: true }) })).why, 'an image brush with a gradient pen', 'an image brush tinted by a gradient takes the render route');
    [
        ['two subpaths', base({ curves: [arch.curves[0], arch.curves[0]] }), 'several subpaths'],
        ['inside stroke', base({ stroke: Object.assign({}, arch.stroke, { align: 'Inside' }) }), 'an inside or outside stroke'],
        ['pattern pen', base({ stroke: Object.assign({}, arch.stroke, { fill: { type: 'Bitmap' } }) }), 'a pattern pen'],
        ['mirrored', base({ world: [-1, 0, 0, 0, 1, 0] }), 'a mirrored layer'],
        ['uneven scale, scales with object', base({ world: [3, 0, 0, 0, 1, 0], stroke: Object.assign({}, arch.stroke, { scaleWithObject: true }) }), 'an uneven scale']
    ].forEach(function (t) { assert.strictEqual(lib.artBrushCheck(t[1]).why, t[2], t[0]); });
    const even = lib.artBrushCheck(base({ world: [0, -1.5, 0, 1.5, 0, 0], stroke: Object.assign({}, arch.stroke, { scaleWithObject: true }) }));
    assert.strictEqual(even.why, null, 'a rotated, evenly scaled stroke is fine'); near('its weight scale', even.k, 1.5, 1e-9);
    const squashed = lib.artBrushCheck(base({ world: [0.655, 0.1, 0, 0, 0.744, 0], stroke: Object.assign({}, arch.stroke, { scaleWithObject: true }) })); // the sushi illustration's group
    assert.strictEqual(squashed.why, null, 'a slightly squashed and skewed stroke is fine'); near('its weight scale', squashed.k, Math.sqrt(0.655 * 0.744), 1e-9);
    assert.strictEqual(lib.artBrushCheck(base({ world: [2, 0, 0, 0, 1, 0] })).why, null, 'an uneven scale is fine when the weight does not scale');
}

// --- Cavalry importer: the path-lengthening deformer ---
// a stand-in for cavalry.Path with the calls the deformer makes; param runs with length here
function Path() { this.cmds = []; this.isClosed = false; }
Path.prototype.moveTo = function (x, y) { this.cmds.push({ type: 'moveTo', point: { x: x, y: y } }); };
Path.prototype.lineTo = function (x, y) { this.cmds.push({ type: 'lineTo', point: { x: x, y: y } }); };
Path.prototype.cubicTo = function (a, b, c, d, x, y) { this.cmds.push({ type: 'cubicTo', cp1: { x: a, y: b }, cp2: { x: c, y: d }, point: { x: x, y: y } }); };
Path.prototype.quadTo = function (a, b, x, y) { this.cmds.push({ type: 'quadTo', cp1: { x: a, y: b }, point: { x: x, y: y } }); };
Path.prototype.close = function () { this.isClosed = true; this.cmds.push({ type: 'close' }); }; // Cavalry lists close as a verb
Path.prototype.pathData = function () { return JSON.parse(JSON.stringify(this.cmds)); };
Path.prototype.flat = function () {
    const pts = []; let cur = null;
    const start = this.cmds[0] && this.cmds[0].point;
    this.cmds.forEach(function (v) {
        if (v.type === 'moveTo') { cur = v.point; pts.push(cur); return; }
        if (v.type === 'close') v = { type: 'lineTo', point: start };
        for (let i = 1; i <= 200; i++) {
            const t = i / 200, u = 1 - t;
            if (v.type === 'lineTo') pts.push({ x: cur.x + (v.point.x - cur.x) * t, y: cur.y + (v.point.y - cur.y) * t });
            else if (v.type === 'quadTo') pts.push({ x: u * u * cur.x + 2 * u * t * v.cp1.x + t * t * v.point.x, y: u * u * cur.y + 2 * u * t * v.cp1.y + t * t * v.point.y });
            else pts.push({ x: u * u * u * cur.x + 3 * u * u * t * v.cp1.x + 3 * u * t * t * v.cp2.x + t * t * t * v.point.x, y: u * u * u * cur.y + 3 * u * u * t * v.cp1.y + 3 * u * t * t * v.cp2.y + t * t * t * v.point.y });
        }
        cur = v.point;
    });
    return pts;
};
// the derivative at either end (0 where the end handle sits on its point), like Cavalry's
Path.prototype.tangentAtParam = function (t) {
    const start = this.cmds[0].point, segs = this.cmds.filter(function (v) { return v.type !== 'moveTo'; }).map(function (v) { return v.type === 'close' ? { type: 'lineTo', point: start } : v; }), i = t <= 0 ? 0 : segs.length - 1, v = segs[i];
    const from = i === 0 ? this.cmds[0].point : segs[i - 1].point, ctl = v.type === 'lineTo' ? (t <= 0 ? v.point : from) : (t <= 0 ? v.cp1 : (v.cp2 || v.cp1));
    return t <= 0 ? { x: ctl.x - from.x, y: ctl.y - from.y } : { x: v.point.x - ctl.x, y: v.point.y - ctl.y };
};
Path.prototype.length = function () { const p = this.flat(); let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return L; };
Path.prototype.paramAtLength = function (s) { return s / this.length(); };
Path.prototype.pointAtParam = function (t) {
    const p = this.flat(), want = Math.max(0, Math.min(1, t)) * this.length(); let L = 0;
    for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); if (L + d >= want) { const f = d ? (want - L) / d : 0; return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * f, y: p[i - 1].y + (p[i].y - p[i - 1].y) * f }; } L += d; }
    return p[p.length - 1];
};
const imp = fs.readFileSync(__dirname + '/../../src/functions/quiver_affinity_import.js', 'utf8');
const pathCode = new Function(grab(imp, 'function _affArtBrushPathCode', 'var __affArtBrushes') + '\nreturn _affArtBrushPathCode;')();
const mapPath = function (src, M) { const o = new Path(), f = function (p) { return { x: M[0] * p.x + M[1] * p.y + M[2], y: M[3] * p.x + M[4] * p.y + M[5] }; };
    src.cmds.forEach(function (v) { const e = v.point && f(v.point); if (v.type === 'moveTo') o.moveTo(e.x, e.y); else if (v.type === 'lineTo') o.lineTo(e.x, e.y); else if (v.type === 'cubicTo') { const a = f(v.cp1), b = f(v.cp2); o.cubicTo(a.x, a.y, b.x, b.y, e.x, e.y); } else if (v.type === 'close') o.close(); }); return o; };
// the copy, as Pathfinder sees it: the path's local geometry with the world transform M (the brush sits under the path) on top
function runCopy(local, M, head, tail, length) {
    const n1 = { hasInput: true, mesh: { getFlattenedPath: function () { return local; } }, path: mapPath(local, M) };
    const out = new Function('n1', 'cavalry', pathCode(head, tail, length).replace(/getPath\(\);$/, 'return getPath();'))(n1, { Path: Path }); // Cavalry takes the last value
    return mapPath(out, M);
}
const archPath = function (s) { const p = new Path(); p.moveTo(-160 * s, -45 * s); p.cubicTo(-70 * s, -45 * s, -50 * s, 45 * s, 0, 45 * s); p.cubicTo(50 * s, 45 * s, 70 * s, -45 * s, 160 * s, -45 * s); return p; };
const L0 = archPath(1).length(), rot = 0.6, turned = [1.3 * Math.cos(rot), -1.3 * Math.sin(rot), 40, 1.3 * Math.sin(rot), 1.3 * Math.cos(rot), -25];
[[1, [1, 0, 0, 0, 1, 0]], [1.5, [1, 0, 0, 0, 1, 0]], [1, turned], [1, [1.2, 0.3, 5, 0, 0.8, 9]]].forEach(function (c) {
    const s = c[0], seen = runCopy(archPath(s), c[1], 90.51, 90.49, L0), pts = seen.cmds, tag = 'x' + s + ' ' + JSON.stringify(c[1].map(function (v) { return Math.round(v * 100) / 100; }));
    near(tag + ' lengthened path', seen.length(), s * (L0 + 181), 0.05); // in the path's own units, whatever its transform
    near(tag + ' start x', pts[0].point.x, -160 * s - 90.51 * s, 0.05); near(tag + ' start y', pts[0].point.y, -45 * s, 0.05); // the arch leaves its ends level
    near(tag + ' end x', pts[pts.length - 1].point.x, 160 * s + 90.49 * s, 0.05);
});
// an end handle sitting on its point gives no tangent there: the direction still comes from the curve
const flat = new Path(); flat.moveTo(0, 0); flat.cubicTo(0, 0, 100, 50, 100, 50); // both handles on their points: a straight run to (100, 50)
const fe = runCopy(flat, turned, 10, 10, flat.length()).cmds, dir = { x: 100 / Math.hypot(100, 50), y: 50 / Math.hypot(100, 50) };
near('degenerate start x', fe[0].point.x, -10 * dir.x, 0.05); near('degenerate start y', fe[0].point.y, -10 * dir.y, 0.05);
near('degenerate end x', fe[fe.length - 1].point.x, 100 + 10 * dir.x, 0.05); near('degenerate end y', fe[fe.length - 1].point.y, 50 + 10 * dir.y, 0.05);
// a closed path opens at its start with no overhang: the whole strip then fits once round, as Affinity draws it
const ring = archPath(1); ring.close(); const RL = ring.length();
const rc = runCopy(ring, turned, 90, 90, RL), rp = rc.cmds;
near('closed path opened, not lengthened', rc.length(), RL, 0.05);
assert.ok(rp.every(function (v) { return v.type !== 'close'; }), 'the copy of a closed path is open');
near('closed path starts at its start', rp[0].point.x, -160, 0.05); near('and ends there', rp[rp.length - 1].point.x, -160, 0.05);
// a square frame: its three corners after the start get 15 px fillets (the start is the seam), so the copy is
// 3 x (2 x 15 - 15 pi / 2) shorter, and the outside of each corner is round
const sq = new Path(); sq.moveTo(0, 0); sq.lineTo(200, 0); sq.lineTo(200, 200); sq.lineTo(0, 200); sq.close();
const sc = runCopy(sq, turned, 50, 50, 800);
near('square frame with filleted corners', sc.length(), 800 - 3 * (30 - 15 * Math.PI / 2), 0.05);
assert.strictEqual(sc.cmds.filter(function (v) { return v.type === 'cubicTo'; }).length, 3, 'three corner arcs');
// a sharp 150 degree turn (an arrow's chevron): the fillet is a small arc inside the corner, not a loop past it
const vee = new Path(), ph = 150 * Math.PI / 180; vee.moveTo(0, 0); vee.lineTo(200, 0); vee.lineTo(200 + 200 * Math.cos(ph), 200 * Math.sin(ph));
const vc = runCopy(vee, [1, 0, 0, 0, 1, 0], 0, 0, 400), rho = 15 * Math.tan((Math.PI - ph) / 2);
near('sharp corner fillet length', vc.length(), 400 - 30 + rho * ph, 0.05);
assert.ok(Math.max.apply(null, vc.flat().map(function (p) { return p.x; })) <= 200, 'the fillet stays inside the corner');
// --- Cavalry importer: a gradient pen's colours along the strip ---
// the strip runs from the head overhang's start (0) to the tail's end (1); each point takes the colour Affinity's
// flat gradient has under it, so a straight stroke ramps where the gradient does and an arrow's U-turn comes back
const oneLiners = ['function _affApply(', 'function _affAlpha('].map(function (f) { return grab(imp, f, '\n'); }).join('\n');
const gradSrc = ['function _affMat(', 'function _affMatMul(', 'function _affHex(', 'function _affInvert('].map(function (f) { return grab(imp, f, '\n}') + '\n}'; }).join('\n') + '\n' + oneLiners;
const stopsAlong = new Function(gradSrc + '\n' + grab(imp, 'var AFFINITY_GRADIENT_INTERP_GAMMA', '// Builds a Cavalry gradient shader') +
    grab(imp, 'function _affBrushGradientStops', '// A linear gradient along the strip') + '\nreturn _affBrushGradientStops;')();
const greyAt = function (stops, u) { // the strip's grey at u, Cavalry interpolating straight between stops
    for (let i = 1; i < stops.length; i++) if (u <= stops[i].offset) { const A = stops[i - 1], B = stops[i], f = (u - A.offset) / (B.offset - A.offset); return parseInt(A.color.slice(1, 3), 16) * (1 - f) + parseInt(B.color.slice(1, 3), 16) * f; }
    return parseInt(stops[stops.length - 1].color.slice(1, 3), 16);
};
const bw = { type: 'Gradient', gradientType: 'Linear', transform: [300, 0, 0, 0, 300, 0], stops: [{ position: 0, midpoint: 0.5, colour: { r: 0, g: 0, b: 0, a: 1 } }, { position: 1, midpoint: 0.5, colour: { r: 255, g: 255, b: 255, a: 1 } }] };
const straight = { world: [1, 0, 0, 0, 1, 0], curves: [{ closed: false, start: { x: 0, y: 0 }, beziers: [[100, 0, 200, 0, 300, 0]] }] };
let gs = stopsAlong(straight, { head: 30, tail: 30, length: 300 }, bw); // the strip covers x = -30 .. 330
near('straight: black over the head overhang', greyAt(gs, 15 / 360), 0, 1);
near('straight: half way along the gradient', greyAt(gs, 180 / 360), 127.5, 2);
near('straight: white over the tail', greyAt(gs, 345 / 360), 255, 1);
assert.ok(gs.length < 20, 'a plain ramp needs few stops, got ' + gs.length);
// out to x = 300 and back to x = 150 (a chevron's arm): white at the turn, half grey again at the end
const uturn = { world: [1, 0, 0, 0, 1, 0], curves: [{ closed: false, start: { x: 0, y: 0 }, beziers: [[100, 0, 200, 0, 300, 0], [250, 0, 200, 0, 150, 0]] }] };
gs = stopsAlong(uturn, { head: 0, tail: 0, length: 450 }, bw);
near('U-turn: white at the turn', greyAt(gs, 300 / 450), 255, 2);
near('U-turn: back to half grey', greyAt(gs, 1), 127.5, 2);
// the layer's world transform moves the gradient with it: the same stroke 1000 px to the right is unchanged
gs = stopsAlong(Object.assign({}, straight, { world: [1, 0, 1000, 0, 1, 0] }), { head: 30, tail: 30, length: 300 }, bw);
near('moved layer: half way along the gradient', greyAt(gs, 180 / 360), 127.5, 2);
// --- Cavalry importer: the draw-on mask (its SkSL run here as JavaScript) ---
// on a 560 x 180 strip with a 64 px cap radius, x from the strip's start: 0% shows nothing and 100% all of
// it with either cap, Butt cuts straight at the trim point, Round rounds the drawn part's head, Roundness
// stretches or flattens that head, Travel wraps round like a Cavalry stroke's, Reverse Path mirrors it all
const sksl = new Function(grab(imp, 'var AFFINITY_ART_BRUSH_TRIM_SKSL', 'function _affArtBrushPathCode') + '\nreturn AFFINITY_ART_BRUSH_TRIM_SKSL;')();
const maskAt = new Function('n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'p',
    'var min = Math.min, max = Math.max, clamp = function (v, a, b) { return min(b, max(a, v)); }, fract = function (v) { return v - Math.floor(v); }, float2 = function (x, y) { return [x, y]; }, half4 = function (v) { return v; }, length = function (v) { return Math.hypot(v[0], v[1]); };\n' +
    sksl.replace(/float (\w+)\(([^)]*)\) \{/, function (m, f, args) { return 'function ' + f + '(' + args.replace(/float /g, '') + ') {'; })
        .replace(/half4 main\(float2 p\) \{([\s\S]*)\}\s*$/, '$1').replace(/\bfloat /g, 'var '));
const mask = function (ts, te, cap, x, y, on, travel, round, rev) { return maskAt(ts, te, on === undefined ? 1 : on, cap, 560, 64, travel || 0, round === undefined ? 100 : round, rev ? 1 : 0, { x: x - 280, y: y }); };
const every = function (f) { for (let x = 2; x <= 558; x += 4) for (let y = -90; y <= 90; y += 15) if (!f(x, y)) return x + ',' + y; return null; };
[0, 1, 2].forEach(function (cap) {
    assert.strictEqual(every(function (x, y) { return mask(0, 0, cap, x, y) === 0; }), null, 'cap ' + cap + ': nothing at 0%');
    assert.strictEqual(every(function (x, y) { return mask(0, 100, cap, x, y) === 1; }), null, 'cap ' + cap + ': the whole strip at 100%');
    assert.strictEqual(every(function (x, y) { return mask(30, 60, cap, x, y, 0) === 1; }), null, 'cap ' + cap + ': Trim off shows it all');
    assert.strictEqual(mask(60, 40, cap, 280, 0), 0, 'cap ' + cap + ': start past end shows nothing');
});
assert.strictEqual(every(function (x, y) { return mask(0, 50, 0, x, y) === (x < 280 ? 1 : 0); }), null, 'Butt cuts straight at 50%');
assert.strictEqual(mask(0, 50, 1, 300, 0), 1, 'Round: the head reaches past the Butt cut on the path line');
assert.strictEqual(mask(0, 50, 1, 276, 60), 0, 'Round: and is rounded off towards the edges');
assert.strictEqual(mask(0, 50, 1, 265, 60), 1, 'Round: inside the head');
assert.strictEqual(every(function (x, y) { return mask(0, 50, 1, x, y, 1, 0, 0) === mask(0, 50, 0, x, y); }), null, 'Roundness 0 is a straight cut');
assert.strictEqual(mask(0, 50, 1, 330, 0, 1, 0, 200), 1, 'Roundness 200: the head reaches further on the path line');
assert.strictEqual(mask(0, 50, 1, 300, 60, 1, 0, 200), 0, 'Roundness 200: and tapers sooner towards the edges');
// 0-30% with Travel 80 (or -20) shows the last fifth of the strip and the first tenth, as Cavalry's stroke does
[80, -20].forEach(function (t) {
    assert.strictEqual(mask(0, 30, 0, 0.9 * 560, 0, 1, t), 1, 'Travel ' + t + ': at 90%');
    assert.strictEqual(mask(0, 30, 0, 0.05 * 560, 0, 1, t), 1, 'Travel ' + t + ': wrapped round to 5%');
    assert.strictEqual(mask(0, 30, 0, 0.5 * 560, 0, 1, t), 0, 'Travel ' + t + ': not at 50%');
});
assert.strictEqual(every(function (x, y) { return mask(20, 50, 0, x, y, 1, 30) === mask(50, 80, 0, x, y); }), null, 'Travel within the strip shifts the window');
// Reverse Path counts from the strip's far end: the mirror image, Round head and Travel included
[[0, 30, 0, 0], [0, 50, 1, 0], [0, 30, 1, 80]].forEach(function (c) {
    assert.strictEqual(every(function (x, y) { return mask(c[0], c[1], c[2], x, y, 1, c[3], 100, true) === mask(c[0], c[1], c[2], 560 - x, y, 1, c[3]); }), null, 'Reverse Path ' + c.join('/'));
});
console.log('art brush: 180 grid strokes eligible, fallbacks named, path copy in the brush\'s space, ends lengthened and scaled, corners filleted, draw-on mask');
console.log('ok');
