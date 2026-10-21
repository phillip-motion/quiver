// Checks the Affinity script's PNG deflate: run with `node _png_deflate_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them).
// The encoder is pulled out of quiver-affinity.js (it needs Affinity's modules to run as a whole),
// and every stream must inflate back to its input with Node's zlib.
'use strict';
const fs = require('fs'), zlib = require('zlib'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8');
const grab = function (start, end) { const a = src.indexOf(start), b = src.indexOf(end, a); assert(a >= 0 && b > a, 'cannot find ' + start); return src.slice(a, b); };
const code = grab('const __crcTable', '// Decode an image file with Affinity');
const lib = new Function(code + '\nreturn { deflateFixed: deflateFixed, pngEncode: pngEncode };')();

function check(name, data) {
    const t0 = Date.now();
    const z = lib.deflateFixed(data);
    const ms = Date.now() - t0;
    const back = zlib.inflateRawSync(Buffer.from(z));
    assert.strictEqual(back.length, data.length, name + ': length');
    assert.ok(Buffer.from(data).equals(back), name + ': bytes differ');
    console.log(name.padEnd(34) + String(data.length).padStart(10) + ' -> ' + String(z.length).padStart(9) + ' bytes  ' + ms + ' ms');
}
let seed = 1; const rnd = function () { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed >>> 24; };
check('empty', new Uint8Array(0));
check('one byte', new Uint8Array([7]));
check('random 100 kB', Uint8Array.from({ length: 100000 }, rnd));
check('zeros 5 MB', new Uint8Array(5e6));
const mixed = new Uint8Array(4e6); for (let i = 0; i < mixed.length; i++) mixed[i] = (i % 2 === 0) ? 255 : ((i >> 14) % 3 === 0 ? rnd() : 0);
check('grey+alpha mask, runs + grain', mixed);
const rep = new Uint8Array(300000); for (let i = 0; i < rep.length; i++) rep[i] = (i % 1000) & 0xFF;
check('repeats at distance 1000', rep);
const longrun = new Uint8Array(70000); for (let i = 0; i < longrun.length; i++) longrun[i] = i < 40000 ? 9 : rnd();
check('a run then noise', longrun);

// a whole PNG: zlib-wrapped IDAT must inflate to the scanlines and pass the adler32 check
const w = 300, h = 200, raw = new Uint8Array((1 + w * 2) * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { raw[y * (1 + w * 2) + 1 + x * 2] = 255; raw[y * (1 + w * 2) + 2 + x * 2] = (x > 100 && x < 200) ? rnd() : 0; }
const png = lib.pngEncode(raw, w, h, 2);
const idatAt = Buffer.from(png).indexOf('IDAT'), len = Buffer.from(png).readUInt32BE(idatAt - 4);
assert.ok(zlib.inflateSync(Buffer.from(png.subarray(idatAt + 4, idatAt + 4 + len))).equals(Buffer.from(raw)), 'png IDAT');
fs.writeFileSync(require('os').tmpdir() + '/quiver_deflate_test.png', png);
console.log('png ok (' + png.length + ' bytes, written to the temp folder)');
