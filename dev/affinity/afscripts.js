'use strict';
// Packs quiver-affinity.js into an Affinity .afscripts bundle, the file Affinity's Scripts panel exports.
// Layout: [0x4c header][zstd frame][ff ff ff ff][#FT4 trailer], little-endian. The frame holds
// Scripts.dat, a stream of tag + u32-length chunks: the bundle name, then the script as
// Cnfg (the code as JSON), Engn, Desc and Titl. Its title and description come from its header comment.
const zlib = require('zlib');

const NAME = 'Quiver for Affinity';
const hex = s => Buffer.from(s, 'hex');
const HEADER = '00ff4b410c0000007241724223496e66fe09000000000000700a000000000000ae09000000000000000000000000000036b89f6a00000000020000000200000050726f74040000002346696c';
const TRAILER = '23465434000000000000000036b89f6a00000000700a000000000000ae090000000000000000000000000000010000000000000037000000000000010000000048000000000000005b17000000000000ae09000000000000149cce110220000000753812140b00536372697074732e646174';
// ponytail: one script per bundle; these counts (01000000) and the closing index grow with more scripts.
const START = '00ff4b53020056757242010020000000';
const SCRIPT = 'b156757242010000000100000000007470635303000002';
// Permissions (03: files + network) and the script's UUID are copied from the hand-saved v2.0
// export; keeping the UUID lets Affinity treat a new build as the same script.
const END = '046d72655003000000000000002972546e550017646975559e873ad0e691406ba1a8d7da41d0fdb600ab4e7572420400000001000000000000000000';
const ENGINE = 'com.canva.affinity.scriptengine.playground';

function chunk(tag, text) {
    const data = Buffer.from(text, 'utf8'), len = Buffer.alloc(4);
    len.writeUInt32LE(data.length);
    return Buffer.concat([Buffer.from(tag, 'latin1'), len, data]);
}

function afscripts(code, timestamp = Math.floor(Date.now() / 1000)) {
    const field = key => (code.match(new RegExp('^\\s*\\*\\s*' + key + ':\\s*(.+)$', 'm')) || [])[1]?.trim()
        || (() => { throw new Error('quiver-affinity.js header is missing "' + key + ':"'); })();
    const payload = Buffer.concat([hex(START), chunk('+NCPB', NAME), hex(SCRIPT),
        chunk('+gfnC', JSON.stringify({asModule: false, code})),
        chunk('+ngnE', ENGINE), chunk('+cseD', field('description')), chunk('+ltit', field('name')),
        hex(END)]);
    const frame = zlib.zstdCompressSync(payload);
    const header = hex(HEADER), trailer = hex(TRAILER);
    const at = header.length + frame.length + 4, total = at + trailer.length;
    const u64 = (buf, offset, n) => buf.writeBigUInt64LE(BigInt(n), offset);
    u64(header, 0x10, at); u64(header, 0x18, total); u64(header, 0x20, frame.length); u64(header, 0x30, timestamp);
    u64(trailer, 0x0c, timestamp); u64(trailer, 0x14, total); u64(trailer, 0x1c, frame.length);
    u64(trailer, 0x48, payload.length); u64(trailer, 0x50, frame.length);
    trailer.writeUInt32LE(zlib.crc32(payload), 0x58); trailer.writeUInt32LE(zlib.crc32(frame), 0x61);
    return Buffer.concat([header, frame, hex('ffffffff'), trailer]);
}

module.exports = {afscripts, NAME};

// `node afscripts.js out.afscripts` packs quiver-affinity.js on its own, for the release workflow.
if (require.main === module) {
    const fs = require('fs');
    fs.writeFileSync(process.argv[2], afscripts(fs.readFileSync(__dirname + '/quiver-affinity.js', 'utf8')));
}
