// Checks afscripts.js: run with `node _afscripts_test.js` from this folder (or `npm run test:affinity` in dev/).
// The sizes and CRCs must add up, and the bundle must hold quiver-affinity.js unchanged. (The layout was
// checked against Affinity's own export; Node's zstd frame differs from Affinity's, so compressed bytes can't be.)
'use strict';
const fs = require('fs'), assert = require('assert'), zlib = require('zlib');
const {afscripts, NAME} = require('../afscripts.js');
const code = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8');
const unpack = file => {
    const length = Number(file.readBigUInt64LE(0x20)), at = Number(file.readBigUInt64LE(0x10));
    const frame = file.subarray(0x4c, 0x4c + length), trailer = file.subarray(at), payload = zlib.zstdDecompressSync(frame);
    assert.strictEqual(at, 0x4c + length + 4, 'trailer follows the frame');
    assert.strictEqual(Number(file.readBigUInt64LE(0x18)), file.length, 'header has the file size');
    assert.strictEqual(Number(trailer.readBigUInt64LE(0x48)), payload.length, 'trailer has the Scripts.dat size');
    assert.strictEqual(trailer.readUInt32LE(0x58), zlib.crc32(payload), 'trailer has the Scripts.dat CRC');
    assert.strictEqual(trailer.readUInt32LE(0x61), zlib.crc32(frame), 'trailer has the frame CRC');
    return payload;
};
assert.strictEqual(/QUIVER_VERSION = '([^']+)'/.exec(code)[1], /\* version: (\S+)/.exec(code)[1], 'the popup shows the header version');
const bundle = unpack(afscripts(code));
assert.ok(bundle.includes(Buffer.from(NAME)), 'the bundle is named ' + NAME);
const at = bundle.indexOf('+gfnC');
assert.strictEqual(JSON.parse(bundle.subarray(at + 9, at + 9 + bundle.readUInt32LE(at + 5))).code, code, 'the bundle holds quiver-affinity.js as is');
console.log('afscripts: quiver-affinity.js packs into the "' + NAME + '" bundle');
