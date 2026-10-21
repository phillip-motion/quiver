// Checks the "Fire rasterised" stacking and cropping in quiver-affinity.js: run with
// `node _flat_image_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them). Affinity's renderer is mocked with tiny RGBA buffers
// (straight alpha, one pixel per spread pixel from the visible box's origin, as measured 2026-10-16).
'use strict';
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8');
const grab = function (start, end) { const a = src.indexOf(start), b = src.indexOf(end, a); assert(a >= 0 && b > a, 'cannot find ' + start); return src.slice(a, b); };
const body = grab('function safe(', 'function round(') + grab('function round(', '\n') + '\n' + grab('function enumName', '\nfunction ') + '\n' + grab('function flatImageNode', '// Render a pixel mask');

// a node renders as the given w x h pixels, all one colour unless `paint` picks the pixels
const node = function (name, box, w, h, rgba, paint, blend) {
    return { description: name, blendMode: blend || 0, getSpreadVisibleBox: function () { return box; }, w: w, h: h, rgba: rgba, paint: paint || function () { return true; } };
};
const run = function (roots, scope, extents) {
    let written = null;
    const RO = {
        NodeRenderingEngineOptions: { create: function () { return {}; } }, RasterFormat: { RGBA8: 0 },
        NodeRenderingEngine: { create: function (n) {
            const px = new Uint8Array(n.w * n.h * 4);
            for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) if (n.paint(x, y)) px.set(n.rgba, (y * n.w + x) * 4);
            return { width: n.w, height: n.h, createCompatibleBuffer: function () { return { buffer: px.buffer }; } };
        } }
    };
    const Common = { BlendMode: { keys: ['Normal', 'Multiply', 'Passthrough'], values: [0, 1, 2] } };
    const f = new Function('require', 'Common', 'writeRgbaPng', 'console', 'let __imageCounter = 0, __nodeCounter = 0;\n' + body + '\nreturn flatImageNode;')(
        function () { return RO; }, Common,
        function (px, w, crop, path) { written = { px: px, w: w, crop: crop }; return { w: crop.w, h: crop.h }; }, { warn: function () {} });
    const doc = { title: 'Test.afdesign', currentSpread: node('spread', extents, extents ? extents.width : 0, extents ? extents.height : 0, [9, 9, 9, 255]) };
    const rec = f(doc, roots, scope, extents, { dropFolder: '/tmp', baseName: 'b' });
    return { rec: rec, written: written, at: function (x, y) { const k = ((written.crop.y + y) * written.w + written.crop.x + x) * 4; return Array.from(written.px.slice(k, k + 4)); } };
};

// two layers: a half-transparent blue one over red, on the nearest whole pixel
const red = node('red', { x: 10.2, y: 5, width: 2, height: 2 }, 2, 2, [255, 0, 0, 255]);
const blue = node('blue', { x: 11, y: 5, width: 2, height: 1 }, 2, 1, [0, 0, 255, 128]);
let r = run([red, blue], 'selection');
assert.deepStrictEqual(r.written.crop, { x: 0, y: 0, w: 3, h: 2 }, 'the stack spans both layers');
assert.deepStrictEqual(r.at(0, 0), [255, 0, 0, 255], 'red alone');
assert.deepStrictEqual(r.at(1, 0), [127, 0, 128, 255], 'blue at half alpha over red');
assert.deepStrictEqual(r.at(2, 0), [0, 0, 255, 128], 'blue alone keeps its alpha');
assert.deepStrictEqual(r.at(2, 1), [0, 0, 0, 0], 'nothing painted there');
assert.ok(r.rec.world[2] === 10 && r.rec.world[5] === 5 && r.rec.blendMode === 'Normal' && r.rec.name === 'Test (rasterised)', 'placed at the stack origin, named after the document');

// one layer that renders far bigger than what it paints (a group holding an adjustment): cut to the paint
const big = node('group', { x: 100, y: 200, width: 6, height: 5 }, 6, 5, [10, 20, 30, 200], function (x, y) { return (x === 2 || x === 4) && y === 1; }, 1);
r = run([big], 'selection');
assert.deepStrictEqual(r.written.crop, { x: 2, y: 1, w: 3, h: 1 }, 'cut to the painted pixels');
assert.ok(r.rec.world[2] === 102 && r.rec.world[5] === 201 && r.rec.localBox.w === 3, 'the cut keeps its spread position');
assert.ok(r.rec.blendMode === 'Multiply' && r.rec.name === 'group (rasterised)', 'a single layer keeps its blend mode and name');

// the spread: the whole extent, uncut
r = run([red], 'spread', { x: 0, y: 0, width: 4, height: 3 });
assert.deepStrictEqual(r.written.crop, { x: 0, y: 0, w: 4, h: 3 }, 'the spread is sent whole');
// a RAW (Develop) layer anywhere in the send picks Affinity's export (the node renderer draws it as nothing)
const holds = new Function(grab('function safe(', 'function round(') + grab('function holdsDevelopLayer', 'function renderFlatImage') + '\nreturn holdsDevelopLayer;')();
assert.ok(holds([{ isVisibleInDomain: true, children: [{ isVisibleInDomain: true, isDevelopNode: true }] }]), 'a RAW layer inside a group is found');
assert.ok(!holds([{ isVisibleInDomain: true, children: [{ isVisibleInDomain: false, isDevelopNode: true }] }, { isVisibleInDomain: true }]), 'a hidden RAW layer, or none, keeps the node renderer');
// a 16-bit raster (the developed RAW photo) comes down to 8 bits rounded, and is cut and thinned like an 8-bit one
let pngRaw = null;
const writePng = new Function('pngEncode', 'File', 'fs', 'let __toSrgb = null;\n' + grab('function writeRgbaPng', '// "Fire rasterised"') + '\nreturn writeRgbaPng;')(
    function (raw, w, h) { pngRaw = { raw: raw, w: w, h: h }; return new Uint8Array(1); },
    { create: function () { return { isOpen: true, write: function () {}, flush: function () {}, close: function () {} }; } }, { exists: function () { return true; } });
const wide = new Uint16Array([65535, 32896, 0, 65535, 25700, 385, 127, 65535]);
assert.deepStrictEqual(writePng(wide, 2, { x: 0, y: 0, w: 2, h: 1 }, 'x.png'), { w: 2, h: 1, step: 1 });
assert.deepStrictEqual(Array.from(pngRaw.raw), [0, 255, 128, 0, 255, 100, 1, 0, 255], '16-bit values to 8 bits (row filter byte first)');
// over 4096 a side the image is scaled to fit by averaging: 8192 pixels -> 4096, each the mean of a pair, colour
// weighted by alpha (a clear neighbour does not darken a white pixel)
const wideRow = new Uint8Array(8192 * 4);
for (let i = 0; i < 8192; i++) wideRow.set(i < 4096 ? (i % 2 ? [0, 0, 255, 255] : [255, 0, 0, 255]) : (i % 2 ? [0, 0, 0, 0] : [255, 255, 255, 255]), i * 4);
assert.deepStrictEqual(writePng(wideRow, 8192, { x: 0, y: 0, w: 8192, h: 1 }, 'x.png'), { w: 4096, h: 1, step: 2 });
assert.deepStrictEqual(Array.from(pngRaw.raw.slice(1, 5)), [128, 0, 128, 255], 'red and blue average to purple');
assert.deepStrictEqual(Array.from(pngRaw.raw.slice(1 + 3000 * 4, 1 + 3000 * 4 + 4)), [255, 255, 255, 128], 'white beside clear stays white at half alpha');
console.log('rasterised send: layers stack with Normal over a clear backdrop, a single layer is cut to its paint and keeps its blend mode, the spread goes whole; RAW layers pick the export route; 16-bit rasters round to 8 bits; big images are averaged down to 4096');
console.log('ok');
