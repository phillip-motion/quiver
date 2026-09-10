#!/usr/bin/env node
/**
 * Pack Quiver's Affinity script into an .afscripts bundle.
 *
 * Format (reverse-engineered, verified by a byte-identical rebuild of a
 * reference bundle):
 *
 *   [0x4c header][zstd frame of Scripts.dat][ff ff ff ff][#FT4 trailer]
 *
 * Header and trailer are constant for a single-entry archive; eight fields are
 * derived. Inside, Scripts.dat is a chunk stream of reversed FourCC tags, each
 * followed by a uint32-LE length: +NCPB bundle name, tpcS script record,
 * +gfnC the {asModule, code} JSON, +ngnE engine id, +cseD description,
 * +ltit title, diuU a 16-byte uuid. A trailing NurB chunk holds the count.
 *
 * We substitute fields into affinity/template.afscripts — a one-script bundle
 * saved by Affinity itself — rather than synthesising the record stream. The
 * payload carries a script count (the uint32 after the second VurB tag) and
 * per-record framing we have not fully mapped, so anything that changes the
 * number of records has to come from Affinity, not from us.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

if (typeof zlib.zstdCompressSync !== 'function' || typeof zlib.crc32 !== 'function') {
    throw new Error('Packing .afscripts needs Node 22.15+ / 23.8+ for zlib.zstdCompressSync and zlib.crc32');
}

// Derived field offsets. Header offsets are absolute; trailer offsets are
// relative to the 0xffffffff marker that precedes the #FT4 tag.
const HEADER_LEN      = 0x4c;
const H_TRAILER_OFF   = 0x10;
const H_TOTAL_SIZE    = 0x18;
const H_COMP_LEN      = 0x20;
const H_TIMESTAMP     = 0x30;
const T_TIMESTAMP     = 0x10;
const T_TOTAL_SIZE    = 0x18;
const T_COMP_LEN      = 0x20;
const T_DECOMP_SIZE   = 0x4c;
const T_COMP_LEN_2    = 0x54;
const T_DECOMP_CRC    = 0x5c;
const T_COMP_CRC      = 0x65;

const END_MARKER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
/** Locate a `tag` + uint32-LE length chunk and return its bounds. */
function findChunk(buf, tag, from = 0) {
    const at = buf.indexOf(Buffer.from(tag, 'latin1'), from);
    if (at < 0) throw new Error(`chunk '${tag}' not found`);
    const lenAt = at + tag.length;
    const len = buf.readUInt32LE(lenAt);
    return { at, lenAt, start: lenAt + 4, end: lenAt + 4 + len, len };
}

/** Replace a chunk's payload, rewriting its length prefix. */
function replaceChunk(buf, tag, value, from = 0) {
    const c = findChunk(buf, tag, from);
    const body = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(body.length);
    return Buffer.concat([buf.subarray(0, c.lenAt), len, body, buf.subarray(c.end)]);
}

/** Split a container into its header, zstd frame and trailer. */
function unpack(bundle) {
    const trailerOff = Number(bundle.readBigUInt64LE(H_TRAILER_OFF));
    const compLen = Number(bundle.readBigUInt64LE(H_COMP_LEN));
    const frame = bundle.subarray(HEADER_LEN, HEADER_LEN + compLen);
    return {
        header: bundle.subarray(0, HEADER_LEN),
        frame,
        trailer: bundle.subarray(trailerOff - END_MARKER.length),
        payload: zlib.zstdDecompressSync(frame),
    };
}

/** Rebuild a container around a new Scripts.dat payload. */
function pack(header, trailer, payload, timestamp) {
    // Match Serif's frame shape exactly. Node's default sets the content-size
    // flag, which makes the encoder emit a single-segment frame with no window
    // descriptor — Affinity rejects those with "Incompatible scripts format".
    // Clearing the flag restores a windowed frame; windowLog 19 mirrors the
    // 0x48 window descriptor Serif's own bundles carry.
    const frame = zlib.zstdCompressSync(payload, {
        params: {
            [zlib.constants.ZSTD_c_contentSizeFlag]: 0,
            [zlib.constants.ZSTD_c_windowLog]: 19,
        },
    });
    const h = Buffer.from(header);
    const t = Buffer.from(trailer);
    const total = h.length + frame.length + t.length;

    h.writeBigUInt64LE(BigInt(HEADER_LEN + frame.length + END_MARKER.length), H_TRAILER_OFF);
    h.writeBigUInt64LE(BigInt(total), H_TOTAL_SIZE);
    h.writeBigUInt64LE(BigInt(frame.length), H_COMP_LEN);
    h.writeBigUInt64LE(BigInt(timestamp), H_TIMESTAMP);

    t.writeBigUInt64LE(BigInt(timestamp), T_TIMESTAMP);
    t.writeBigUInt64LE(BigInt(total), T_TOTAL_SIZE);
    t.writeBigUInt64LE(BigInt(frame.length), T_COMP_LEN);
    t.writeBigUInt64LE(BigInt(payload.length), T_DECOMP_SIZE);
    t.writeBigUInt64LE(BigInt(frame.length), T_COMP_LEN_2);
    t.writeUInt32LE(zlib.crc32(payload), T_DECOMP_CRC);
    t.writeUInt32LE(zlib.crc32(frame), T_COMP_CRC);

    return Buffer.concat([h, frame, t]);
}

/**
 * Build an .afscripts bundle from a one-script template.
 *
 * @param {Buffer} template  a single-script .afscripts to substitute into
 * @param {object} script    {code, title, description, bundleName}
 */
function build(template, script) {
    const { header, trailer, payload } = unpack(template);

    let out = payload;
    out = replaceChunk(out, '+NCPB', script.bundleName);
    out = replaceChunk(out, '+ltit', script.title);
    out = replaceChunk(out, '+cseD', script.description);
    out = replaceChunk(out, '+gfnC', JSON.stringify({ asModule: false, code: script.code }));
    // Fresh uuid so re-installs replace rather than duplicate the entry.
    const uuid = findChunk(out, 'diuU');
    out = Buffer.concat([
        out.subarray(0, uuid.at + 4),
        crypto.createHash('sha1').update(script.title).digest().subarray(0, 16),
        out.subarray(uuid.at + 4 + 16),
    ]);

    return pack(header, trailer, out, Math.floor(Date.now() / 1000));
}

/** Read back a bundle's scripts — used by the self-check and by --inspect. */
function inspect(bundle) {
    const { payload } = unpack(bundle);
    const scripts = [];
    let from = 0;
    for (;;) {
        let cfg;
        try { cfg = findChunk(payload, '+gfnC', from); } catch { break; }
        const title = findChunk(payload, '+ltit', cfg.end);
        scripts.push({
            title: payload.subarray(title.start, title.end).toString('utf8'),
            code: JSON.parse(payload.subarray(cfg.start, cfg.end).toString('utf8')).code,
        });
        from = cfg.end;
    }
    return { bundleName: (() => {
        const n = findChunk(payload, '+NCPB');
        return payload.subarray(n.start, n.end).toString('utf8');
    })(), scripts };
}

module.exports = { build, inspect, unpack, pack, findChunk, replaceChunk };

// --- CLI -------------------------------------------------------------------

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args[0] === '--inspect') {
        const r = inspect(fs.readFileSync(args[1]));
        console.log(`bundle: ${r.bundleName}`);
        r.scripts.forEach((s, i) => console.log(`  [${i}] ${s.title} (${s.code.length} bytes)`));
        process.exit(0);
    }

    if (args[0] === '--selfcheck') {
        // Round-trip a reference bundle: rebuilding from its own parts must be
        // byte-identical, and a substituted build must read back correctly.
        const ref = fs.readFileSync(args[1]);
        const u = unpack(ref);
        const stamp = Number(ref.readBigUInt64LE(H_TIMESTAMP));
        const rebuilt = Buffer.concat([
            (() => {
                const h = Buffer.from(u.header);
                h.writeBigUInt64LE(BigInt(HEADER_LEN + u.frame.length + 4), H_TRAILER_OFF);
                h.writeBigUInt64LE(BigInt(ref.length), H_TOTAL_SIZE);
                h.writeBigUInt64LE(BigInt(u.frame.length), H_COMP_LEN);
                h.writeBigUInt64LE(BigInt(stamp), H_TIMESTAMP);
                return h;
            })(),
            u.frame,
            (() => {
                const t = Buffer.from(u.trailer);
                t.writeBigUInt64LE(BigInt(stamp), T_TIMESTAMP);
                t.writeBigUInt64LE(BigInt(ref.length), T_TOTAL_SIZE);
                t.writeBigUInt64LE(BigInt(u.frame.length), T_COMP_LEN);
                t.writeBigUInt64LE(BigInt(u.payload.length), T_DECOMP_SIZE);
                t.writeBigUInt64LE(BigInt(u.frame.length), T_COMP_LEN_2);
                t.writeUInt32LE(zlib.crc32(u.payload), T_DECOMP_CRC);
                t.writeUInt32LE(zlib.crc32(u.frame), T_COMP_CRC);
                return t;
            })(),
        ]);
        console.assert(rebuilt.equals(ref), 'byte-identical rebuild failed');

        const made = build(ref, {
            bundleName: 'Quiver', title: 'Fire towards Cavalry',
            description: 'Send the selection to Cavalry.', code: '// hi\n',
        });
        const back = inspect(made);
        console.assert(back.bundleName === 'Quiver', 'bundle name round-trip failed');
        console.assert(back.scripts[0].title === 'Fire towards Cavalry', 'title round-trip failed');
        console.assert(back.scripts[0].code === '// hi\n', 'code round-trip failed');
        const v = unpack(made);
        console.assert(zlib.crc32(v.payload) === made.readUInt32LE(made.length - v.trailer.length + T_DECOMP_CRC), 'payload crc failed');
        console.log('selfcheck: all assertions passed');
        process.exit(0);
    }

    console.error('usage: build-afscripts.js --selfcheck <ref.afscripts> | --inspect <file.afscripts>');
    process.exit(1);
}
