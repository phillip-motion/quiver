#!/usr/bin/env node
/**
 * Self-check for the Affinity ingest path in quiver_utilities_webserver.js.
 *
 * The webserver module can only run inside Cavalry, so this pulls the two
 * pure-ish functions out of the shipped source and runs them against a stub
 * `api`. Testing the real source rather than a copy is the point.
 *
 *   node dev/test-affinity-ingest.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, 'src/functions/quiver_utilities_webserver.js');
const source = fs.readFileSync(SRC, 'utf8');

/** Slice out `function <name>(...) { ... }` by brace matching. */
function extract(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notStrictEqual(start, -1, `${name} not found in ${path.basename(SRC)}`);
    let depth = 0, i = source.indexOf('{', start);
    for (let j = i; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}' && --depth === 0) return source.slice(start, j + 1);
    }
    throw new Error(`unterminated ${name}`);
}

const files = {};
const deleted = [];
const logged = { error: [], warn: [] };
const ctx = {
    api: {
        readFromFile(p) {
            if (!(p in files)) throw new Error('ENOENT ' + p);
            return files[p];
        },
        deleteFilePath(p) { deleted.push(p); return true; },
    },
    console: {
        error: m => logged.error.push(m),
        warn: m => logged.warn.push(m),
        info: () => {}, log: () => {},
    },
};
vm.createContext(ctx);
vm.runInContext(extract('getQuiverHeader') + '\n' + extract('buildAffinityRequest'), ctx);

const H = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
const reset = () => { deleted.length = 0; logged.error.length = 0; logged.warn.length = 0; };

// header lookup is case-insensitive and tolerates junk
assert.strictEqual(ctx.getQuiverHeader(H({ 'X-Quiver-Svg': '/a.svg' }), 'x-quiver-svg'), '/a.svg');
assert.strictEqual(ctx.getQuiverHeader(H({ Other: 'x' }), 'X-Quiver-Svg'), '');
assert.strictEqual(ctx.getQuiverHeader(null, 'X-Quiver-Svg'), '');
assert.strictEqual(ctx.getQuiverHeader([null, { name: null }], 'X-Quiver-Svg'), '');

// full request: svg + sidecar, both consumed and deleted
reset();
files['/t/a.svg'] = '<svg/>';
files['/t/a.json'] = JSON.stringify({
    name: 'Card', frameWidth: 400, frameHeight: 300,
    textData: [{ name: 'Title', textAlignHorizontal: 'CENTER' }],
});
let r = ctx.buildAffinityRequest(H({ 'X-Quiver-Svg': '/t/a.svg', 'X-Quiver-Meta': '/t/a.json' }));
assert.deepStrictEqual(
    { action: r.action, svgCode: r.svgCode, nodeName: r.nodeName, frameWidth: r.frameWidth },
    { action: 'importSVG', svgCode: '<svg/>', nodeName: 'Card', frameWidth: 400 });
assert.strictEqual(r.textData[0].textAlignHorizontal, 'CENTER');
assert.deepStrictEqual(deleted, ['/t/a.svg', '/t/a.json']);

// a path with spaces survives (rfc2047 encoding is switched off on the sender)
reset();
files['/t/My Frame.svg'] = '<svg/>';
r = ctx.buildAffinityRequest(H({ 'X-Quiver-Svg': '/t/My Frame.svg' }));
assert.strictEqual(r.svgCode, '<svg/>');

// corrupt sidecar degrades to an SVG-only import rather than failing
reset();
files['/t/b.svg'] = '<svg/>';
files['/t/b.json'] = 'not json {';
r = ctx.buildAffinityRequest(H({ 'X-Quiver-Svg': '/t/b.svg', 'X-Quiver-Meta': '/t/b.json' }));
assert.strictEqual(r.svgCode, '<svg/>');
assert.strictEqual(r.textData, undefined);
assert.strictEqual(logged.warn.length, 1);
assert.deepStrictEqual(deleted, ['/t/b.svg', '/t/b.json']);

// missing header, missing file and empty export are all refused
reset();
assert.strictEqual(ctx.buildAffinityRequest(H({ 'X-Quiver-Meta': '/t/a.json' })), null);
assert.strictEqual(ctx.buildAffinityRequest(H({ 'X-Quiver-Svg': '/t/gone.svg' })), null);
files['/t/empty.svg'] = '';
assert.strictEqual(ctx.buildAffinityRequest(H({ 'X-Quiver-Svg': '/t/empty.svg' })), null);
assert.strictEqual(logged.error.length, 3);

console.log('affinity ingest: all assertions passed');
