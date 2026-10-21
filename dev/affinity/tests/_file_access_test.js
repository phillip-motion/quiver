// Checks where quiver-affinity.js may write its payload (fileAccessMessage, chooseDropFolder): run with
// `node _file_access_test.js` from this folder (or `npm run test:affinity` in dev/ for all of them). Affinity's file API is mocked: only folders listed in
// `allowed` (or inside one) can be written to, like Settings > Scripting > File System Access.
'use strict';
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../quiver-affinity.js', 'utf8');
const grab = function (start) { const a = src.indexOf(start), b = src.indexOf('\n}\n', a); assert(a >= 0 && b > a, 'cannot find ' + start); return src.slice(a, b + 2); };
let allowed = [];
const may = function (path) { return allowed.some(function (f) { return path === f || path.indexOf(f + '/') === 0; }); };
const mockFs = { exists: function (p) { return may(p); }, createDirectories: function () {}, remove: function () {} };
const mockFile = { create: function (p) { return { isOpen: may(p), writeString: function () {}, flush: function () {}, close: function () {} }; } };
const lib = new Function('fs', 'File', grab('function canWriteTo(') + grab('function desktopPath(') + grab('function ensureDropFolder(') + grab('function chooseDropFolder(') + grab('function fileAccessMessage(') +
    '\nreturn { message: fileAccessMessage, choose: chooseDropFolder };')(mockFs, mockFile);
const desk = '/Users/sam/Desktop', assets = '/Users/sam/Projects/Promo/Assets/Quiver', status = { assets: assets };
const app = { userDesktopPath: desk }; global.app = app; global.safe = function (f, d) { try { return f(); } catch (e) { return d; } };
allowed = [desk];
assert.strictEqual(lib.message(desk, status), null, 'Desktop allowed: no popup');
allowed = ['/Users/sam/Projects'];
assert.strictEqual(lib.message(desk, status), null, 'only the projects folder allowed: no popup');
assert.strictEqual(lib.choose(status), assets, 'and the payload goes straight into Assets/Quiver');
allowed = [];
const msg = lib.message(desk, status);
assert.ok(msg && msg.indexOf(desk) !== -1 && msg.indexOf('Projects') === -1, 'neither allowed: the popup only suggests the Desktop');
assert.ok(msg.indexOf('fire towards Cavalry') !== -1, 'with the launch wording');
console.log('file access: Desktop or the project folder will do; the popup only shows when neither can be written, and suggests the Desktop');
console.log('ok');
