// Checks the Affinity script's brush texture fitter: run with `node _brush_fit_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them).
// The fitter is pulled out of quiver-affinity.js and run on brush strokes Affinity rendered
// (dev/testfiles/affinity/brushes: one per texture family plus a path that folds back on itself, with
// their paths); each must come out as its family, at its measured width, with inputs near the ones
// tuned by eye against Affinity.
'use strict';
const fs = require('fs'), zlib = require('zlib'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8');
const grab = function (start, end) { const a = src.indexOf(start), b = src.indexOf(end, a); assert(a >= 0 && b > a, 'cannot find ' + start); return src.slice(a, b); };
const code = grab('function safe(', '// Enum value') + grab('function matApply(', 'function rnd6(') + grab('const BRUSH_STEP', '// Adjustments / live filters');
const lib = new Function(code + '\nreturn { fitBrushTexture: fitBrushTexture };')();

// grey+alpha PNGs as Quiver writes them (8 bit, filter 0 on every row) -> RGBA
function readMask(path) {
    const buf = fs.readFileSync(path);
    let p = 8, w = 0, h = 0, type = 0;
    const idat = [];
    while (p < buf.length) {
        const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
        if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; }
        if (kind === 'IDAT') idat.push(data);
        p += 12 + len;
    }
    assert.strictEqual(type, 4, path + ': expected grey+alpha');
    const raw = zlib.inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        assert.strictEqual(raw[y * (1 + w * 2)], 0, path + ': row filter');
        for (let x = 0; x < w; x++) { const g = raw[y * (1 + w * 2) + 1 + x * 2], a = raw[y * (1 + w * 2) + 2 + x * 2], o = (y * w + x) * 4; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = a; }
    }
    return { w: w, h: h, px: out };
}
const near = function (name, got, want, tol) { assert.ok(Math.abs(got - want) <= tol, name + ': ' + got + ', expected ' + want + ' +/- ' + tol); };

const dir = __dirname + '/../../testfiles/affinity/brushes/', gdir = __dirname + '/../../testfiles/affinity/brush-grid/';
// the brush renders are kept out of the repo (dev/testfiles is ignored)
if (!fs.existsSync(dir) || !fs.existsSync(gdir)) { console.error('skipped: no brush test data in dev/testfiles/affinity'); process.exit(0); }
const strokes = JSON.parse(fs.readFileSync(dir + 'brush-strokes.json', 'utf8'));
// inputs tuned by eye against Affinity's renders in Cavalry (n0..n16; see AFFINITY_BRUSH_SKSL)
const tuned = {
    'grain-line':    { width: 89, n: { 1: [1.5, 0.6], 3: [0.3, 0.1], 4: [1.5, 0.5] } },
    'rough-outline': { width: 31, types: ['fibre', 'grain'], n: { 1: [5, 1.5] } }, // the self-check scores both alike
    'spatter':       { width: 122, maybeMask: true, n: { 4: [2.6, 1], 12: [7, 2.5], 13: [9, 3] } }, // fades to one side, so it keeps its render
    'bristle':       { width: 52, types: ['bristle', 'long bristle'], maybeMask: true, n: { 1: [1.5, 0.6], 5: [32, 12], 9: [26, 10] } }, // right at the across-profile limit; streaks capped at 16x their width
    'rough-folded':  { width: 20, types: ['fibre', 'grain'], n: {} } // folds back on itself: its passes must not merge into one wide band
};
let seed = 1;
Object.keys(strokes).forEach(function (name) {
    const s = strokes[name], img = readMask(dir + s.mask);
    const vb = { x: s.vb[0], y: s.vb[1], width: s.vb[2], height: s.vb[3] };
    const t0 = Date.now();
    const fit = lib.fitBrushTexture(img.px, img.w, img.h, { curves: s.curves, world: s.world, stroke: s.stroke, opacity: s.opacity }, vb, seed++);
    const ms = Date.now() - t0;
    assert.ok(fit, name + ': no fit');
    console.log(name.padEnd(14) + String(fit.type).padEnd(8) + ' width ' + String(fit.width).padEnd(6) + ' ' + ms + ' ms  measured ' + JSON.stringify(fit.measured) + '\n' + ' '.repeat(14) + 'inputs ' + JSON.stringify(fit.params || null) + (fit.profile ? '\n' + ' '.repeat(14) + 'profile ' + JSON.stringify(fit.profile) : ''));
    assert.ok(fit.ok || tuned[name].maybeMask, name + ': the self-check should pass (' + fit.why + ')');
    if (!fit.ok) { console.log(' '.repeat(14) + 'kept as its render: ' + fit.why); return; } // its inputs are not used
    assert.ok((tuned[name].types || [s.expect]).indexOf(fit.type) >= 0, name + ': type ' + fit.type);
    near(name + ' width', fit.width, tuned[name].width, 0.15 * tuned[name].width);
    Object.keys(tuned[name].n).forEach(function (i) { near(name + ' n' + i, fit.params[i], tuned[name].n[i][0], tuned[name].n[i][1]); });
    assert.strictEqual(fit.params.length, 20, name + ': input count');
});

// the 180 vector brushes Affinity ships (dev/testfiles/affinity/brush-grid): each comes out rebuilt or
// as its render about as before, and no pattern that measured badly when rebuilt is ever rebuilt
const grid = JSON.parse(fs.readFileSync(gdir + 'grid-strokes.json', 'utf8')), want = JSON.parse(fs.readFileSync(gdir + 'grid-expected.json', 'utf8'));
let same = 0, total = 0, natives = 0, gseed = 1; // seeds as when the expectations were recorded: near ties go the same way
const t0 = Date.now();
Object.keys(grid).forEach(function (tag) {
    const s = grid[tag], img = readMask(gdir + s.mask);
    const fit = lib.fitBrushTexture(img.px, img.w, img.h, { curves: s.curves, world: s.world, stroke: s.stroke, opacity: s.opacity }, { x: s.vb[0], y: s.vb[1], width: s.vb[2], height: s.vb[3] }, gseed++);
    const got = fit && fit.ok ? 'native' : 'mask';
    total++; if (got === want.expected[tag]) same++; if (got === 'native') natives++;
    assert.ok(!(got === 'native' && want.mustBeMask.indexOf(tag) >= 0), tag + ' (' + s.brush + ') is a pattern and must keep its render');
});
console.log('brush grid: ' + natives + ' of ' + total + ' rebuilt, ' + same + ' verdicts as expected, ' + (Date.now() - t0) + ' ms');
assert.ok(same >= 0.95 * total, 'brush grid verdicts changed: ' + same + ' of ' + total + ' as expected');

// rebuilt by a live send (with its seeds) but wrong in Cavalry: Square Pastel and Round Pastel blotchy,
// Creative Ink 03 hairy, Dense Oil Impasto 03 as dots, Flat Marker Used Up as fur; they must keep their render
[['A1-017', 34], ['A1-018', 36], ['A1-076', 152], ['A1-085', 170], ['A1-099', 198]].forEach(function (c) {
    const s = grid[c[0]], img = readMask(gdir + s.mask);
    const fit = lib.fitBrushTexture(img.px, img.w, img.h, { curves: s.curves, world: s.world, stroke: s.stroke, opacity: s.opacity }, { x: s.vb[0], y: s.vb[1], width: s.vb[2], height: s.vb[3] }, c[1]);
    assert.ok(fit && !fit.ok, c[0] + ' (' + s.brush + ') with seed ' + c[1] + ' must keep its render, got ' + (fit && fit.type) + ' ' + (fit && fit.score));
});
console.log('ok');
