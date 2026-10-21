// Checks how quiver_affinity_import.js places a turned text frame (_affPlaceTurnedFrame): run with
// `node _text_frame_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them). Cavalry's api is mocked: a fixed text box is drawn from its
// top-left corner, turned anticlockwise about it, and its glyph tops sit `lead` below the box top.
'use strict';
const fs = require('fs'), assert = require('assert');
const imp = fs.readFileSync(__dirname + '/../../src/functions/quiver_affinity_import.js', 'utf8');
const grab = function (start) { const a = imp.indexOf(start), b = imp.indexOf('\n}\n', a); assert(a >= 0 && b > a, 'cannot find ' + start); return imp.slice(a, b + 2); };
const near = function (name, got, want, tol) { assert.ok(Math.abs(got - want) <= tol, name + ': ' + got + ', expected ' + want + ' +/- ' + tol); };
const lead = 20;
let state = {};
const api = {
    set: function (id, o) { Object.keys(o).forEach(function (k) { state[k] = o[k]; }); },
    // only asked while the box is upright: its glyph tops are `lead` below the position
    getBoundingBox: function () { return { top: state['position.y'] - lead }; }
};
const place = new Function('api', grab('function _affApply(') + grab('function _affInvert(') + grab('function _affToCavalry(') + grab('function _affPlaceTurnedFrame(') + '\nreturn _affPlaceTurnedFrame;')(api);

// the Dracula spine title: a frame 1174 x 383 in its own space, turned 90 degrees (reading down the page) and
// stretched 1.47 along its lines and 0.83 across them; its glyph tops are 3.5 px inside the frame's top edge
const W = [0, -0.829652, 3940.662266, 1.470418, 0, -3597.326777], box = { x: 2762.8845, y: 2164.6677, w: 1173.9061, h: 383.1466 };
const vb = { x: 0, y: 0, width: 4157.4803, height: 2881.8898 };
const glyphBox = { x: 1996.935, y: 595.7108, w: 144.2464, h: 1470.5404 };
state = {};
place('t', { frame: { glyphBox: glyphBox } }, box, W, vb, 208.33);
near('box along the lines', state.textBoxSize[0], 1726.13, 0.05);
near('box across the lines', state.textBoxSize[1], 317.88, 0.05);
near('turned to read down the page', state.rotation, -90, 1e-6);
// the frame's own top-left corner is the page box's top-right (spread 2144.7, 465.3); its top edge is the right
// side of the spine, so the glyph tops (Cavalry's 20 px down, Affinity's 3.56) need the box moved right
const cx = 2144.7417 - vb.width / 2, cy = vb.height / 2 - 465.2696, want = 3.56;
near('position x: corner moved by the glyph nudge', state['position.x'], cx + (lead - want), 0.05);
near('position y: the corner', state['position.y'], cy, 0.05);
console.log('turned text frame: own-side box, rotation about its top-left corner, glyph tops on the frame top edge');
console.log('ok');
