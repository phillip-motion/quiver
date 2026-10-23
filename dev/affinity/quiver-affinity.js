/**
 * name: Quiver for Affinity
 * description: Fires your selection, or the whole spread, into Cavalry as fully editable layers. Open the Quiver panel in Cavalry first.
 * version: 2.0.1
 * author: Canva Creative Team
 *
 * Requires: Affinity 3.2+ with scripting enabled, this script granted
 *   - File system access to the Desktop (the payload passes through it; Cavalry moves the files
 *     into the project's Assets/Quiver folder and removes them from the Desktop)
 *   - Network access (to reach the Quiver panel on 127.0.0.1:8767)
 * Cavalry: the Quiver panel must be open (it listens on port 8767 for Affinity).
 */

'use strict';

const { Document, FileExportOptions, FileExportArea } = require('/document.js');
const { app } = require('/application.js');
const Fills = require('/fills.js');
const { Colour, ColourProfileSet } = require('/colours.js');
const Nodes = require('/nodes.js');
const Shapes = require('/shapes.js');
const LS = require('/linestyle.js');
const LE = require('/layereffects.js');
const PA = require('/paragraphatts.js');
const { Selection } = require('/selections.js');
const { File, fs } = require('/fs.js');
const { HttpRequest, RequestMethod } = require('/network.js');
const { Dialog, DialogResult } = require('/dialog.js');
const Timers = require('/timers.js');
const Common = require('affinity:common');
const Story = require('affinity:story');

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const QUIVER_AFFINITY_PORT = 8767;
const QUIVER_HOST = '127.0.0.1';
const QUIVER_FORMAT_VERSION = 1;
const QUIVER_VERSION = '2.0.1'; // keep in step with `version:` in the header above
const EXPORT_IMAGES = true;      // default for the dialog switch: export placed images and pixel layers beside the JSON
let __exportImages = EXPORT_IMAGES;
let __nativeBrushes = false;    // dialog switch: brush textures rebuilt in Cavalry instead of sent as masks

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safe(fn, fallback) { try { const v = fn(); return (v === undefined) ? fallback : v; } catch (e) { return fallback; } }
function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d === undefined ? 0 : d); }
function round(v, p) { const m = Math.pow(10, p === undefined ? 4 : p); return Math.round(num(v) * m) / m; }

// Enum value -> key name (all Affinity enum classes expose keys/values arrays).
function enumName(E, v) {
    try {
        if (!E || v === null || v === undefined) return null;
        const val = (typeof v === 'object' && 'value' in v) ? v.value : v;
        const vs = E.values, ks = E.keys;
        for (let i = 0; i < vs.length; i++) {
            const x = vs[i];
            if (((typeof x === 'object' && 'value' in x) ? x.value : x) === val) return ks[i];
        }
        return String(val);
    } catch (e) { return null; }
}

// Transform.data is an array-like {0..5}; Affinity is row-major 2x3:
//   x' = m0*x + m1*y + m2 ;  y' = m3*x + m4*y + m5
function mat(t) {
    if (!t) return [1, 0, 0, 0, 1, 0];
    const d = t.data || t;
    return [num(d[0], 1), num(d[1]), num(d[2]), num(d[3]), num(d[4], 1), num(d[5])];
}
function matMul(A, B) { // A after B  (apply B first, then A)
    return [
        A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2],
        A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]
    ];
}
function matApply(M, x, y) { return { x: M[0] * x + M[1] * y + M[2], y: M[3] * x + M[4] * y + M[5] }; }
function rnd6(M) { return M.map(function (v) { return round(v, 6); }); }

// A Colour carries a `tint` (Swatches panel): the rendered colour is the base colour tinted
// towards white, so tint 0 renders as white whatever the base colour says (verified: a masthead
// filled with rgba8 94,102,106 at tint 0 renders white). getRGBAuf(true) applies it.
// Colours defined in CMYK (a CMYK swatch in an RGB document) need the colour profiles too:
// without a profile set the API returns the naive (1-c)(1-k) conversion (C0 M64 Y40 -> 255,93,154)
// while Affinity renders through the CMYK profile (243,126,126). getRGBAuf(true, profileSet) with
// the default set (U.S. Web Coated SWOP v2 for CMYK) matched the renderer exactly (2026-10-13).
let __profileSet = null;
function profileSet() {
    if (__profileSet === null) { try { __profileSet = ColourProfileSet.default || ColourProfileSet.create(); } catch (e) { __profileSet = undefined; } }
    return __profileSet || undefined;
}
// Affinity reports colours and renders pixels in the document's colour profile, and Cavalry reads them
// as sRGB. An Adobe RGB (1998) document (common for Affinity Photo files) is converted with the standard
// primaries and gamma 563/256 (measured: a fill of 145,187,115 reads and renders as that in such a
// document while Affinity shows 124,188,111 = the conversion; smooth areas of an Adobe RGB photo matched
// Affinity's sRGB view within 2 levels). Other non-sRGB profiles are named in the payload, not converted.
const ADOBE_RGB_TO_SRGB = [1.3982831, -0.398283, 0, 0, 1, 0, 0, -0.0429383, 1.0429383]; // linear light, D65
let __toSrgb = null, __docProfile = '';
function setDocumentProfile(doc) {
    __toSrgb = null;
    const name = String(safe(function () { return doc.colourProfile.name; }, '') || '');
    if (name !== 'Adobe RGB (1998)') return name;
    const dec = new Float32Array(256), enc = new Uint8Array(4097), m = ADOBE_RGB_TO_SRGB;
    for (let i = 0; i < 256; i++) dec[i] = Math.pow(i / 255, 563 / 256);
    for (let i = 0; i <= 4096; i++) { const v = i / 4096; enc[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
    const q = function (v) { return enc[v <= 0 ? 0 : v >= 1 ? 4096 : Math.round(v * 4096)]; };
    // in place on the 8-bit RGB at index o of arr (alpha untouched)
    __toSrgb = function (arr, o) { const r = dec[arr[o]], g = dec[arr[o + 1]], b = dec[arr[o + 2]]; arr[o] = q(m[0] * r + m[1] * g + m[2] * b); arr[o + 1] = q(m[3] * r + m[4] * g + m[5] * b); arr[o + 2] = q(m[6] * r + m[7] * g + m[8] * b); };
    return name;
}
function rgba(colour) {
    const out = function (r, g, b, a) { const t = [r, g, b]; if (__toSrgb) __toSrgb(t, 0); return { r: t[0], g: t[1], b: t[2], a: a }; };
    try {
        if (typeof colour.getRGBAuf === 'function') {
            const f = colour.getRGBAuf(true, profileSet());
            if (f && typeof f.r === 'number') {
                const to8 = function (v) { return Math.max(0, Math.min(255, Math.round(num(v, 0) * 255))); };
                return out(to8(f.r), to8(f.g), to8(f.b), round(Math.max(0, Math.min(1, num(f.alpha, 1))), 4));
            }
        }
    } catch (eTint) {}
    try {
        const c = colour.rgba8;
        return out(c.r, c.g, c.b, round(num(c.alpha, 255) / 255, 4));
    } catch (e) { return null; }
}
function rect(r) { return r ? { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) } : null; }

// World matrix of a node: spread <- parent chain <- node.transform
function worldMatrix(n) {
    return matMul(mat(safe(function () { return n.localToSpreadTransform; })), mat(safe(function () { return n.transform; })));
}

// ---------------------------------------------------------------------------
// Fills / strokes
// ---------------------------------------------------------------------------
function serialiseFill(descriptor) {
    if (!descriptor) return null;
    const fill = safe(function () { return descriptor.fill; });
    if (!fill) return null;
    const type = enumName(Fills.FillType, safe(function () { return fill.fillType; }));
    const out = {
        type: type,
        alpha: round(num(safe(function () { return fill.alpha; }, 1), 1)),
        blendMode: enumName(Common.BlendMode, safe(function () { return descriptor.blendMode; })),
        transform: rnd6(mat(safe(function () { return descriptor.transform; }))),
        scaleWithObject: !!safe(function () { return descriptor.isScaleWithObject; }, true)
    };
    // the colour or gradient Noise slider (0..1)
    if (safe(function () { return fill.hasNoise; }, false)) out.noise = round(num(safe(function () { return fill.noise; }), 0));
    if (type === 'Solid') {
        out.colour = rgba(Fills.SolidFill.fromFill(fill).colour);
    } else if (type === 'Gradient') {
        const gf = Fills.GradientFill.fromFill(fill);
        out.gradientType = enumName(Fills.GradientFillType, safe(function () { return gf.gradientFillType; }));
        out.stops = [];
        const g = safe(function () { return gf.gradient; });
        // Each stop must be read straight after getStop(i): the stop objects go stale once the next
        // one is fetched (g.stops reported a 0.3 midpoint as 0.5; verified 2026-10-13).
        const count = num(safe(function () { return g.stopCount; }), 0);
        for (let i = 0; i < count; i++) {
            const s = safe(function () { return g.getStop(i); });
            if (!s) continue;
            const position = round(num(s.position)), midpoint = round(num(s.midpoint, 0.5)), colour = rgba(new Colour(s.colour));
            out.stops.push({ position: position, midpoint: midpoint, colour: colour });
        }
    } else if (type === 'Bitmap') {
        // the pattern spans -1..1 of the space `transform` places in the node's local space (centred on
        // its origin); extend Zero / Repeat (edge pixels) / Wrap (tiles) / Mirror (verified on a scripted doc)
        const bf = Fills.BitmapFill.fromFill(fill);
        out.extend = enumName(require('affinity:raster').RasterExtendType, safe(function () { return bf.extendType; }));
        out.bitmap = exportFillBitmap(safe(function () { return bf.bitmap; }, null));
    } else if (type === 'None') {
        return null;
    }
    // Mesh / Hatch / Diffusion fall through as type-only (Cavalry side substitutes)
    return out;
}
// A bitmap fill's pattern written as an RGBA PNG beside the payload (needs the send's drop folder,
// so nothing is written outside a send). Returns { path, width, height } or null.
let __sendCtx = null;
function exportFillBitmap(raster) {
    if (!raster || !__sendCtx || !__exportImages) return null;
    try {
        const RO = require('/rasterobject.js');
        const w = num(safe(function () { return raster.width; })), h = num(safe(function () { return raster.height; }));
        if (!(w > 0 && h > 0)) return null;
        let src = raster;
        if (enumName(RO.RasterFormat, safe(function () { return raster.format; })) !== 'RGBA8') {
            src = RO.Bitmap.create(w, h, RO.RasterFormat.RGBA8);
            raster.copyTo(src, { x: 0, y: 0, width: w, height: h }, 0, 0);
        }
        const px = new Uint8Array(src.createCompatibleBuffer(true).buffer);
        const rowLen = 1 + w * 4, raw = new Uint8Array(rowLen * h);
        for (let y = 0; y < h; y++) raw.set(px.subarray(y * w * 4, (y + 1) * w * 4), y * rowLen + 1);
        const png = pngEncode(raw, w, h, 4);
        __imageCounter++;
        const path = __sendCtx.dropFolder + '/' + __sendCtx.baseName + '_pattern' + __imageCounter + '.png';
        const f = File.create(path, 'w');
        if (!f.isOpen) return null;
        f.write(png.buffer, png.length); f.flush(); f.close();
        return fs.exists(path) ? { path: path, width: w, height: h } : null;
    } catch (e) {
        console.warn('Quiver: bitmap fill export failed: ' + e.message);
        return null;
    }
}

function serialiseStroke(n) {
    const hasPen = safe(function () { return n.hasPenFill; }, false);
    const weight = num(safe(function () { return n.lineStyle.weight; }));
    if (!hasPen || weight <= 0) return null;
    return serialiseStrokeParts(n.lineStyle, safe(function () { return n.lineStyleDescriptor; }), safe(function () { return n.penFillDescriptor; }), safe(function () { return n.strokeAlignment; }), true);
}
// Every line-style descriptor of a node (Affinity allows several strokes per object). Index 0
// is the first entry; null when the node has a single stroke (the plain `stroke` covers it).
function serialiseAllStrokes(n) {
    const li = safe(function () { return n.lineStyleInterface; });
    const count = num(safe(function () { return li.descriptorCount; }), 0);
    if (!li || count < 2) return null;
    const out = [];
    for (let i = 0; i < count; i++) {
        const ds = safe(function () { return li.getDescriptors(i); });
        if (!ds) { out.push(null); continue; }
        const lsd = safe(function () { return ds.lineStyle; });
        const ls = safe(function () { return lsd.lineStyle; });
        const weight = num(safe(function () { return ls.weight; }));
        const rec = (weight > 0) ? serialiseStrokeParts(ls, lsd, safe(function () { return ds.fill; }), safe(function () { return lsd.strokeAlignment; })) : null;
        out.push(rec);
    }
    return out;
}
// Every brush-fill descriptor of a node; null when there is only one (the plain `fill` covers it).
function serialiseAllFills(n) {
    const descs = safe(function () { return n.brushFillInterface.allDescriptors; }, null);
    if (!descs || descs.length < 2) return null;
    const out = [];
    for (let i = 0; i < descs.length; i++) out.push(serialiseFill(descs[i]));
    return out;
}
function tagColourOf(n) {
    const c = safe(function () { return n.tagColour; }, null);
    if (!c) return null;
    const v = rgba(c);
    return (v && (v.r || v.g || v.b || v.a)) ? v : null;
}
function serialiseStrokeParts(ls, desc, penDesc, align, brushWithoutPen) {
    const weight = num(safe(function () { return ls.weight; }));
    const pen = serialiseFill(penDesc), lineType = enumName(LS.LineType, safe(function () { return ls.type; }));
    // a brush with no pen still draws when it is an image brush (its own colours); checked when it is exported
    if (weight <= 0 || (!pen && !(brushWithoutPen && lineType === 'Texture'))) return null;
    return {
        weight: round(weight),
        cap: enumName(LS.LineCap, safe(function () { return ls.cap; })),
        join: enumName(LS.LineJoin, safe(function () { return ls.join; })),
        lineType: lineType,
        miterLimit: round(num(safe(function () { return ls.miterLimit; }, 10))),
        dashPattern: safe(function () { return Array.from(ls.dashPattern).map(function (v) { return round(v); }); }, []),
        dashPhase: round(num(safe(function () { return ls.dashPhase; }))),
        align: enumName(LS.StrokeAlignment, align),
        behind: !!safe(function () { return desc.isBehind; }, false),
        scaleWithObject: !!safe(function () { return desc.isScale; }, false),
        pressure: serialisePressure(safe(function () { return desc.pressure; }, null)),
        fill: pen || { type: 'None' }
    };
}
// The Pressure profile is a curve in unit space; null when absent or flat at full width.
function serialisePressure(curve) {
    if (!curve) return null;
    const walked = walkCurve(curve);
    if (!walked.start || !walked.beziers.length) return null;
    const flat = Math.abs(walked.start.y - 1) < 1e-3 && walked.beziers.every(function (b) { return Math.abs(b[1] - 1) < 1e-3 && Math.abs(b[3] - 1) < 1e-3 && Math.abs(b[5] - 1) < 1e-3; });
    return flat ? null : { start: walked.start, beziers: walked.beziers };
}
// Blend Ranges (layer > Blend Options): "This Layer" scales the layer's alpha by a curve of its own
// luma (Rec.601 of the 8-bit values, straight lines between points: measured on 52 greys and 9 colours
// to within a level); "Underlying" ranges, set per channel too, read the backdrop. Null when all are
// the default full range. The options handle goes stale after one spline is read, so it is re-read.
function serialiseBlendRanges(n) {
    const pts = function (s) { const r = []; for (let i = 0; i < s.pointCount; i++) { const q = s.getPoint(i); r.push([round(q.x, 4), round(q.y, 4)]); } return r; };
    const full = function (p) { return !p || p.every(function (q) { return Math.abs(q[1] - 1) < 1e-3; }); };
    const read = function (f) { return safe(function () { return f(n.blendOptions); }, null); };
    const source = read(function (b) { return pts(b.masterSourceLayerRanges); });
    const underlying = read(function (b) { return pts(b.masterUnderlyingCompositionRanges); });
    const channels = [];
    for (let c = 0; c < 4; c++) {
        const s = read(function (b) { return pts(b.getChannelSourceLayerRanges(c)); }), u = read(function (b) { return pts(b.getChannelUnderlyingCompositionRanges(c)); });
        if (!full(s) || !full(u)) channels.push(c);
    }
    if (full(source) && full(underlying) && !channels.length) return null;
    return { source: full(source) ? null : source, sourceLinear: read(function (b) { return b.masterSourceLayerRanges.isLinear; }) !== false,
        underlying: full(underlying) ? null : underlying, channels: channels, gamma: round(num(read(function (b) { return b.gamma; }), 2.2), 3) };
}

// ---------------------------------------------------------------------------
// Layer effects
// ---------------------------------------------------------------------------
function serialiseEffects(n) {
    const fx = safe(function () { return n.quickFX; }, []);
    const out = [];
    if (!Array.isArray(fx)) return out;
    for (let i = 0; i < fx.length; i++) {
        const e = fx[i];
        if (!safe(function () { return e.enabled; }, true)) continue;
        const type = enumName(LE.LayerEffectType, safe(function () { return e.type; }));
        const rec = {
            type: type,
            opacity: round(num(safe(function () { return e.opacity; }, 1))),
            blendMode: enumName(Common.BlendMode, safe(function () { return e.blendMode; })),
            scaleWithObject: !!safe(function () { return e.scaleWithObject; }, false)
        };
        const radius = safe(function () { return e.radius; });
        if (typeof radius === 'number') rec.radius = round(radius);
        const colour = safe(function () { return e.colour; });
        if (colour) rec.colour = rgba(colour);
        const offset = safe(function () { return e.offset; });
        if (typeof offset === 'number') rec.offset = round(offset);
        const angle = safe(function () { return e.angle; });
        if (typeof angle === 'number') rec.angle = round(angle, 6); // radians
        const intensity = safe(function () { return e.intensity; });
        if (typeof intensity === 'number') rec.intensity = round(intensity);
        const knock = safe(function () { return e.fillKnocksOut; });
        if (typeof knock === 'boolean') rec.fillKnocksOut = knock;
        const preserveAlpha = safe(function () { return e.preserveAlpha; });
        if (typeof preserveAlpha === 'boolean') rec.preserveAlpha = preserveAlpha;
        if (type === 'GradientOverlay') {
            rec.fill = serialiseFill(safe(function () { return e.fillDescriptor; }));
            rec.box = rect(safe(function () { return n.getSpreadVisibleBox(false); }, null));
        }
        if (type === 'Outline') {
            rec.align = enumName(LS.StrokeAlignment, safe(function () { return e.alignment; }));
            rec.fillType = enumName(LE.StrokeFillType, safe(function () { return e.fillType; }));
            if (rec.fillType === 'Gradient') rec.fill = serialiseFill(safe(function () { return e.fillDescriptor; }));
        }
        out.push(rec);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
function serialiseCurves(n) {
    const pc = safe(function () { return n.polyCurve; });
    if (!pc) return null;
    // Corner Tool corners are not in polyCurve (that is the sharp base path); Affinity bakes them into
    // curvesInterface.corneredPolyCurve (verified on the Catsnake: 99.7% overlap with Affinity's render)
    const baseCurves = safe(function () { return Array.from(pc.curves); }, []);
    const corneredPc = safe(function () { return n.curvesInterface.corneredPolyCurve; }, null);
    const corneredCurves = corneredPc ? safe(function () { return Array.from(corneredPc.curves); }, []) : [];
    const curves = (corneredCurves.length && corneredCurves.length === baseCurves.length) ? corneredCurves : baseCurves;
    const out = [];
    for (let ci = 0; ci < curves.length; ci++) {
        const c = curves[ci];
        const walked = walkCurve(c);
        out.push({ closed: walked.closed, clockwise: !!safe(function () { return c.isClockwise; }, true), start: walked.start, beziers: walked.beziers, nodeCount: safe(function () { return c.nodeCount; }, 0) });
    }
    return out;
}
// Walk a Curve's on-curve points and read the cubic leaving each one.
function walkCurve(c) {
    const beziers = [];
    let idx = safe(function () { return c.firstOnCurvePointIndex; }, 0);
    let guard = 0;
    const closed = !!safe(function () { return c.isClosed; }, false);
    let start = null;
    while (guard++ < 20000) {
        const b = safe(function () { return c.getCubicBezier(idx); });
        if (!b) break;
        if (start === null) start = { x: round(b.start.x), y: round(b.start.y) };
        beziers.push([round(b.c1.x), round(b.c1.y), round(b.c2.x), round(b.c2.y), round(b.end.x), round(b.end.y)]);
        const next = safe(function () { return c.getNextOnCurvePointIndex(idx, closed); }, -1);
        if (next === -1 || next === null || next === undefined) break;
        if (closed && next === safe(function () { return c.firstOnCurvePointIndex; }, 0)) break;
        if (next === idx) break;
        idx = next;
    }
    return { closed: closed, start: start, beziers: beziers };
}

function serialiseShape(n) {
    const type = enumName(Shapes.ShapeType, safe(function () { return n.shapeType; }));
    const shape = safe(function () { return n.shape; });
    const rec = { type: type };
    if (!shape) return rec;
    if (type === 'Rectangle') {
        function corner(c) { return c ? { radius: round(num(c.radius)), type: enumName(Shapes.ShapeCornerType, safe(function () { return c.cornerType; })) } : null; }
        rec.corners = {
            topLeft: corner(safe(function () { return shape.topLeft; })),
            topRight: corner(safe(function () { return shape.topRight; })),
            bottomLeft: corner(safe(function () { return shape.bottomLeft; })),
            bottomRight: corner(safe(function () { return shape.bottomRight; }))
        };
        rec.absoluteSizes = !!safe(function () { return shape.absoluteSizes; }, false);
        rec.useSingleRadius = !!safe(function () { return shape.useSingleRadius; }, true);
        rec.isPlainRectangle = !!safe(function () { return shape.isPlainRectangle; }, true);
    } else if (type === 'Polygon') {
        rec.sides = num(safe(function () { return shape.sides; }), 5);
        rec.curve = round(num(safe(function () { return shape.curve; })));
        rec.smoothPoints = !!safe(function () { return shape.smoothPoints; }, false);
    } else if (type === 'Triangle') {
        rec.position = round(num(safe(function () { return shape.position; }), 0.5));
    } else if (type === 'Star') {
        rec.points = num(safe(function () { return shape.points; }), 5);
        rec.innerRadius = round(num(safe(function () { return shape.innerRadius; })));
        rec.circleInnerRadius = round(num(safe(function () { return shape.circleInnerRadius; })));
        rec.circleOuterRadius = round(num(safe(function () { return shape.circleOuterRadius; })));
        rec.leftCurve = round(num(safe(function () { return shape.leftCurve; })));
        rec.rightCurve = round(num(safe(function () { return shape.rightCurve; })));
        rec.curvedEdges = !!safe(function () { return shape.curvedEdges; }, false);
    }
    return rec;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
function serialiseText(n) {
    const si = n.storyInterface;
    const story = si.story;
    const isFrame = !!safe(function () { return n.isFrameTextNode; }, false);
    const isPath = !!(safe(function () { return n.isCurvePathTextNode; }, false) || safe(function () { return n.isPolyCurveTextNode; }, false) || safe(function () { return n.isShapePathTextNode; }, false));
    const rec = {
        kind: isFrame ? 'frame' : (isPath ? 'path' : (safe(function () { return n.isArtTextNode; }, false) ? 'art' : 'other')),
        text: String(safe(function () { return si.text; }, '')),
        runs: [],
        paragraphs: []
    };
    const len = num(safe(function () { return story.length; }));
    let pos = 0, guard = 0;
    while (pos < len && guard++ < 500) {
        const end = num(safe(function () { return story.getGlyphAttsRunEnd(pos, len); }), len);
        const a = safe(function () { return story.getGlyphAtts(pos); });
        const f = safe(function () { return a.font; });
        const bf = safe(function () { return a.brushFill; });
        rec.runs.push({
            start: pos, end: end,
            family: String(safe(function () { return f.familyName; }, '')),
            style: String(safe(function () { return f.traitsName; }, 'Regular')),
            weight: num(safe(function () { return f.weight; }), 400),
            postscriptName: String(safe(function () { return f.postscriptName; }, '')),
            // a variable font set with the Character panel's axis sliders comes back with no style or PostScript name and
            // weight 400 whatever the sliders say; the scripting API has no way to read the axis values (Affinity 3.3)
            variableCustom: !!(f && !safe(function () { return f.traitsName; }, 'x') && !safe(function () { return f.postscriptName; }, 'x') && safe(function () { return f.familyName; }, '')),
            isItalic: !!safe(function () { return f.isItalic; }, false),
            size: round(num(safe(function () { return a.height; }), 12)),
            tracking: round(num(safe(function () { return a.characterSpacing; })), 6), // ems (the UI shows per-mille)
            absoluteLeading: round(num(safe(function () { return a.absoluteLeading; }))),
            baselineShift: round(num(safe(function () { return a.baselineAdvance; }))),
            scaleX: round(num(safe(function () { return a.getDoubleValue(require('/glyphatts.js').GlyphAttDoubleType.ScaleX); }), 1)),
            scaleY: round(num(safe(function () { return a.getDoubleValue(require('/glyphatts.js').GlyphAttDoubleType.ScaleY); }), 1)),
            fill: serialiseFill(bf),
            // a text layer's stroke lives on its glyph runs too (the layer's own line style reads weight 0)
            stroke: safe(function () { const d = a.lineStyleDescriptor; return d ? serialiseStrokeParts(d.lineStyle, d, a.penFill, d.strokeAlignment) : null; }, null),
            underline: enumName(Story.TypographicLineType, safe(function () { return a.underlineType; })),
            strikeout: enumName(Story.TypographicLineType, safe(function () { return a.strikeoutType; })),
            superSub: enumName(Story.SuperSubType, safe(function () { return a.superSubType; })),
            caps: enumName(Story.CapsType, safe(function () { return a.capsType; })),
            // the Transparency tool stores a text layer's transparency on its glyph runs, not the layer (verified 2026-10-13)
            transparency: serialiseFill(safe(function () { return a.transparency; }))
        });
        if (end <= pos) break;
        pos = end;
    }
    pos = 0; guard = 0;
    while (pos < len && guard++ < 500) {
        const end = num(safe(function () { return story.getParagraphAttsRunEnd(pos, len); }), len);
        const pa = safe(function () { return story.getParagraphAtts(pos); });
        rec.paragraphs.push({
            start: pos, end: end,
            align: enumName(PA.ParagraphAlignXType, safe(function () { return pa.alignXType; })),
            leadingType: enumName(PA.ParagraphLeadingType, safe(function () { return pa.leadingType; })),
            relativeLeading: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.RelativeLeading); }), 1)),
            absoluteLeading: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.AbsoluteLeading); }))),
            spaceBefore: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.SpaceBefore); }))),
            spaceAfter: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.SpaceAfter); }))),
            leftIndent: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.LeftIndent); }))),
            rightIndent: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.RightIndent); }))),
            firstLineIndent: round(num(safe(function () { return pa.getDoubleValue(PA.ParagraphAttDoubleType.FirstLineIndent); })))
        });
        if (end <= pos) break;
        pos = end;
    }
    // How big the glyphs really render. Resizing a frame does NOT scale its text unless the frame is
    // in "scaled text" mode: Affinity stores the compensation in textRenderScale, and textUiScale is
    // the net factor the UI applies to the nominal size (verified: frame transform 0.907/0.928 with
    // renderScale 1.103/1.077 -> glyphs at the nominal size; scaled frame 1/0.597 with renderScale
    // 1.262/2.116 -> glyphs x1.263; art text 0.25 -> 0.25).
    const tfi = safe(function () { return n.textFrameInterface; }, null);
    const uiT = mat(safe(function () { return tfi ? tfi.textUiScale : si.textUiScale; }));
    rec.uiScale = { x: round(Math.sqrt(uiT[0] * uiT[0] + uiT[3] * uiT[3]), 6), y: round(Math.sqrt(uiT[1] * uiT[1] + uiT[4] * uiT[4]), 6) };
    rec.renderScale = rnd6(mat(safe(function () { return tfi ? tfi.textRenderScale : si.textRenderScale; })));
    rec.scaledText = !!safe(function () { return tfi && tfi.hasScaledText; }, false);
    // Fields render differently from the raw text: the page-number field has no string of its own,
    // so the page the frame sits on is sent for the importer to substitute.
    rec.rendered = safe(function () { return Array.from(si.glyphs).map(function (g) { return g.string === undefined || g.string === null ? (safe(function () { return g.isPageNumberGlyph; }, false) ? '\u0000PAGE\u0000' : '') : String(g.string); }).join(''); }, null);
    // getPageIndexOfBox returns the document-wide 0-based page index (verified: 3 and 4 on the spread
    // Affinity prints as pages 4 and 5), so the printed number is index + 1.
    rec.pageNumber = safe(function () { const sp = n.spreadNode || safe(function () { return n.textFrameInterface.spreadNode; }, null); const box = n.getSpreadBaseBox(false); return num(sp.getPageIndexOfBox(box), 0) + 1; }, null);
    if (isFrame) {
        const tf = safe(function () { return n.textFrameInterface; });
        rec.frame = {
            box: rect(safe(function () { return n.baseBox; })),                // the drawn frame (local)
            glyphBox: rect(safe(function () { return n.getExactSpreadVisibleBox(true, true); })), // rendered glyph extents (spread)
            wrapping: !!safe(function () { return tf.isWrappingText; }, true),
            linked: !!safe(function () { return tf.isMultiFrameTextFlow; }, false),
            storyToDomain: rnd6(mat(safe(function () { return tf.storyToDomainTransform; })))
        };
    } else {
        rec.storyToDomain = rnd6(mat(safe(function () { return si.domainTransform; })));
    }
    return rec;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
let __imageCounter = 0;
function exportImage(doc, n, dropFolder, baseName) {
    if (!__exportImages) return null;
    __imageCounter++;
    // 0. A painted pixel layer has no source file (no image resource) and doc.export needs the live
    //    selection, so it is rendered in isolation and written as an RGBA PNG covering its own box
    //    (the renderer's bitmap is the node's own extent; straight alpha, verified 2026-10-13).
    if (!safe(function () { return n.imageResourceInterface; }, null)) {
        const rendered = renderPixelLayer(doc, n, dropFolder, baseName);
        if (rendered) return rendered;
    }
    // 0b. A RAW (Develop) layer: its original is the camera file, which Cavalry cannot read, and Affinity's
    //     node renderer draws nothing for it; its raster holds the developed photo (16-bit, full size).
    if (safe(function () { return n.isDevelopNode; }, false)) return exportDevelopLayer(n, dropFolder, baseName);
    // 1. Preferred: the untouched source image (full resolution, no clipped children baked in).
    //    Cavalry only loads BMP, JPEG, PNG and WebP stills (TIFF, HEIF, JPEG XL, GIF, EXR... fail), so
    //    any other original is decoded by Affinity and rewritten as a PNG at its full resolution.
    try {
        const iri = n.imageResourceInterface;
        if (iri && typeof iri.saveOriginalFile === 'function') {
            let ext = String(safe(function () { return iri.fileTypeName; }, '') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (ext === 'jpeg') ext = 'jpg';
            const originalSize = safe(function () { const s = iri.originalSize; return s ? { w: s.width || s.x, h: s.height || s.y } : null; }, null);
            const stem = dropFolder + '/' + baseName + '_img' + __imageCounter;
            if (/^(png|jpg|bmp|webp)$/.test(ext)) {
                iri.saveOriginalFile(stem + '.' + ext);
                if (fs.exists(stem + '.' + ext)) return { path: stem + '.' + ext, original: true, originalSize: originalSize };
            } else {
                const src = stem + '_source.' + (ext || 'img');
                iri.saveOriginalFile(src);
                const png = fs.exists(src) ? originalAsPng(src, stem + '.png') : null;
                try { if (fs.exists(src)) fs.remove(src); } catch (eRm) {}
                if (png) return { path: png, original: true, originalSize: originalSize };
            }
        }
    } catch (eOrig) {
        console.warn('Quiver: original image export failed for ' + baseName + ': ' + eOrig.message + ' (falling back to a render)');
    }
    // 2. Fallback: render the node via the live selection, with its clipped children hidden.
    let previous = null;
    try { previous = doc.selection; } catch (ePrev) { previous = null; }
    const kids = safe(function () { return Array.from(n.children).filter(function (k) { return k.isVisibleInDomain; }); }, []);
    let hidKids = false;
    try {
        const path = dropFolder + '/' + baseName + '_img' + __imageCounter + '.png';
        if (kids.length) { try { doc.hideSelection(Selection.create(doc, kids)); hidKids = true; } catch (eHide) { hidKids = false; } }
        doc.selection = Selection.create(doc, [n]);
        const options = FileExportOptions.createWithPresetName('PNG');
        const area = FileExportArea.createForSelection(doc.selection);
        const records = doc.export(path, options, area, null);
        let ok = false, err = null;
        try {
            records.enumerate(function (r) {
                const msg = safe(function () { return r.errorMessage; }, '');
                if (msg && String(msg).length) err = String(msg); else ok = true;
                return Common.EnumerationResult.Continue;
            });
        } catch (eEnum) { ok = fs.exists(path); }
        if (!ok && !fs.exists(path)) { console.warn('Quiver: image export failed for ' + baseName + (err ? ': ' + err : '')); return null; }
        if (!safe(function () { return n.imageResourceInterface; }, null)) {
            // a Pixel layer: the export covers its box rounded out to whole pixels (1009 x 691 at x 864.4 came back
            // 1010 x 692), upright with its turn drawn in, so it is placed like a render, by that box
            const b = safe(function () { return n.getSpreadVisibleBox(false); }, null);
            if (b) {
                const x0 = Math.floor(b.x), y0 = Math.floor(b.y), w = Math.ceil(b.x + b.width) - x0, h = Math.ceil(b.y + b.height) - y0;
                return { path: path, original: true, originalSize: { w: w, h: h }, pixelWidth: w, pixelHeight: h, rendered: true, box: { x: x0, y: y0, w: w, h: h } };
            }
        }
        return { path: path, original: false, originalSize: null };
    } catch (e) {
        console.warn('Quiver: image export threw for ' + baseName + ': ' + e.message);
        return null;
    } finally {
        try { if (hidKids) doc.showSelection(Selection.create(doc, kids)); } catch (eShow) {}
        try { doc.selection = previous; } catch (eRestore) { try { doc.selection = null; } catch (e2) {} }
    }
}


// ---------------------------------------------------------------------------
// Fill layers (Layer > New Fill Layer): a RasterNode whose own raster is just coverage; the colour
// or gradient it paints is not exposed by the API (the fill can be SET with
// DocumentCommand.createSetBrushFill but never read), while the node renderer is. The layer is
// rendered in isolation with gradient dithering off, sampled on a 65x65 grid, and the samples are
// fitted as a solid colour or a linear / radial / elliptical / conical gradient, which is shipped as a
// rectangle covering the clipping parent with that fill. Verified against fills set by script:
// centres exact, radii within 1%, angles exact, three-stop positions within 2% (2026-10-12).
// The render bitmap starts at the top-left of the ancestors' clipping region (see renderFrameOrigin).
// ---------------------------------------------------------------------------
function gfNum(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d === undefined ? 0 : d); }
function gfRound(v, p) { const m = Math.pow(10, p === undefined ? 4 : p); return Math.round(gfNum(v) * m) / m; }

function gfRange(S, N, c) { let mn = 1e9, mx = -1e9; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = S[j][i][c]; if (v < mn) mn = v; if (v > mx) mx = v; } return { min: mn, max: mx }; }
// iso-contour of channel c at level L: crossing points along rows and columns, in PIXEL units.
// A crossing whose two samples differ by more than `jump` is a seam (e.g. a conical wrap), not a crossing.
function gfContour(S, N, W, H, c, L, jump) {
    const pts = [];
    const px = function (i, j) { return [i * (W - 1) / (N - 1), j * (H - 1) / (N - 1)]; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N - 1; i++) {
        const a = S[j][i][c] - L, b = S[j][i + 1][c] - L;
        if (Math.abs(a - b) > jump) continue;
        if (a * b < 0) pts.push(px(i + a / (a - b), j));
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N - 1; j++) {
        const a = S[j][i][c] - L, b = S[j + 1][i][c] - L;
        if (Math.abs(a - b) > jump) continue;
        if (a * b < 0) pts.push(px(i, j + a / (a - b)));
    }
    return pts;
}
// principal line through points: centroid, unit direction d, unit normal n, rms perpendicular residual
function gfLineFit(pts) {
    const n = pts.length; if (n < 3) return null;
    let cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= n; cy /= n;
    let sxx = 0, syy = 0, sxy = 0; pts.forEach(function (p) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const d = [Math.cos(theta), Math.sin(theta)], nrm = [-d[1], d[0]];
    let res = 0; pts.forEach(function (p) { const t = (p[0] - cx) * nrm[0] + (p[1] - cy) * nrm[1]; res += t * t; });
    return { cx: cx, cy: cy, d: d, n: nrm, rms: Math.sqrt(res / n), count: n };
}
// smallest eigenvector of a symmetric matrix (Jacobi), for the conic fit
function gfSmallestEigenvector(A, size) {
    const M = A.map(function (r) { return r.slice(); });
    const V = []; for (let i = 0; i < size; i++) { const r = []; for (let j = 0; j < size; j++) r.push(i === j ? 1 : 0); V.push(r); }
    for (let sweep = 0; sweep < 60; sweep++) {
        let off = 0; for (let p = 0; p < size; p++) for (let q = p + 1; q < size; q++) off += M[p][q] * M[p][q];
        if (off < 1e-18) break;
        for (let p = 0; p < size; p++) for (let q = p + 1; q < size; q++) {
            if (Math.abs(M[p][q]) < 1e-15) continue;
            const phi = 0.5 * Math.atan2(2 * M[p][q], M[q][q] - M[p][p]);
            const c = Math.cos(phi), s = Math.sin(phi);
            for (let k = 0; k < size; k++) { const mkp = M[k][p], mkq = M[k][q]; M[k][p] = c * mkp - s * mkq; M[k][q] = s * mkp + c * mkq; }
            for (let k = 0; k < size; k++) { const mpk = M[p][k], mqk = M[q][k]; M[p][k] = c * mpk - s * mqk; M[q][k] = s * mpk + c * mqk; }
            for (let k = 0; k < size; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
        }
    }
    let best = 0; for (let i = 1; i < size; i++) if (M[i][i] < M[best][best]) best = i;
    const v = []; for (let k = 0; k < size; k++) v.push(V[k][best]);
    return v;
}
// algebraic conic fit -> ellipse {cx, cy, a, b, theta, rms} (a >= b, a along theta), coords normalised first
function gfEllipseFit(pts) {
    const n = pts.length; if (n < 8) return null;
    let mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= n; my /= n;
    let sc = 0; pts.forEach(function (p) { sc += Math.abs(p[0] - mx) + Math.abs(p[1] - my); }); sc = sc / (2 * n) || 1;
    const A = []; for (let i = 0; i < 6; i++) A.push([0, 0, 0, 0, 0, 0]);
    pts.forEach(function (p) {
        const x = (p[0] - mx) / sc, y = (p[1] - my) / sc;
        const row = [x * x, x * y, y * y, x, y, 1];
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) A[i][j] += row[i] * row[j];
    });
    const v = gfSmallestEigenvector(A, 6);
    const a = v[0], b = v[1], c = v[2], d = v[3], e = v[4], f = v[5];
    const disc = b * b - 4 * a * c;
    if (!(disc < 0)) return null; // not an ellipse
    const cx = (2 * c * d - b * e) / disc, cy = (2 * a * e - b * d) / disc;
    const num = 2 * (a * e * e + c * d * d - b * d * e + disc * f);
    const root = Math.sqrt((a - c) * (a - c) + b * b);
    const ax1 = -Math.sqrt(num * (a + c + root)) / disc, ax2 = -Math.sqrt(num * (a + c - root)) / disc;
    if (!(ax1 > 0 && ax2 > 0)) return null;
    let theta = 0.5 * Math.atan2(-b, c - a); // direction of axis ax1
    let res = 0;
    pts.forEach(function (p) {
        const x = (p[0] - mx) / sc - cx, y = (p[1] - my) / sc - cy;
        const u = x * Math.cos(theta) + y * Math.sin(theta), w = -x * Math.sin(theta) + y * Math.cos(theta);
        const r = Math.sqrt((u / ax1) * (u / ax1) + (w / ax2) * (w / ax2));
        res += (r - 1) * (r - 1);
    });
    let A1 = ax1 * sc, B1 = ax2 * sc;
    if (B1 > A1) { const t = A1; A1 = B1; B1 = t; theta += Math.PI / 2; }
    theta = Math.atan2(Math.sin(theta), Math.cos(theta));
    return { cx: cx * sc + mx, cy: cy * sc + my, a: A1, b: B1, theta: theta, rms: Math.sqrt(res / n), count: n };
}
// 1-D ramp fit over a profile of colours (array of [r,g,b,a]) sampled at `pos` (monotonic numbers).
// Returns { start, end, stops: [{ t (in pos units), colour }] } with plateau ends extrapolated and
// interior stops only where the ramp bends. `tol` is the plateau tolerance in levels.
function gfFitRamp(line, pos, tol, bend, forceStart) {
    const K = line.length; if (K < 3) return null;
    tol = tol || 3; bend = bend || 6;
    const far = function (p, q) { let d = 0; for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(p[c] - q[c])); return d; };
    let k0 = 0; while (k0 < K - 1 && far(line[k0 + 1], line[0]) <= tol) k0++;
    let k1 = K - 1; while (k1 > 0 && far(line[k1 - 1], line[K - 1]) <= tol) k1--;
    if (k1 - k0 < 1) return null;
    let chan = 0, best = 0; for (let c = 0; c < 4; c++) { const d = Math.abs(line[k1][c] - line[k0][c]); if (d > best) { best = d; chan = c; } }
    let startPos = pos[k0], endPos = pos[k1];
    if (k1 - k0 >= 3) {
        const slope = (line[k1 - 1][chan] - line[k0 + 1][chan]) / (pos[k1 - 1] - pos[k0 + 1]);
        if (Math.abs(slope) > 1e-9) {
            const s = pos[k0 + 1] + (line[k0][chan] - line[k0 + 1][chan]) / slope;
            const e = pos[k1 - 1] + (line[k1][chan] - line[k1 - 1][chan]) / slope;
            if (s >= pos[k0] - 1e-9 && s <= pos[k0 + 1]) startPos = s;
            if (e <= pos[k1] + 1e-9 && e >= pos[k1 - 1]) endPos = e;
        }
    }
    // end colours: the plateau colour when there is one, otherwise extrapolated from the ramp so a
    // sample that sits short of the true end (e.g. a radial centre) does not darken the stop
    const extrap = function (ka, kb, at) { const out = []; for (let c = 0; c < 4; c++) { const sl = (line[kb][c] - line[ka][c]) / (pos[kb] - pos[ka] || 1e-9); out.push(Math.max(0, Math.min(255, line[ka][c] + sl * (at - pos[ka])))); } return out; };
    if (k0 === 0 && typeof forceStart === 'number' && forceStart < startPos) startPos = forceStart;
    const startColour = (k0 === 0 && K > 4) ? extrap(1, 3, startPos) : line[0].slice();
    const endColour = (k1 === K - 1 && K > 4) ? extrap(K - 4, K - 2, endPos) : line[K - 1].slice();
    const stops = [{ t: startPos, colour: startColour }];
    const endStop = { t: endPos, colour: endColour };
    for (let guard = 0; guard < 6; guard++) {
        let worst = -1, worstErr = 0;
        for (let k = k0 + 2; k < k1 - 1; k++) {
            const t = pos[k];
            if (stops.some(function (st) { return Math.abs(st.t - t) < 0.02 * (endPos - startPos); })) continue;
            let lo = stops[0], hi = endStop;
            for (let q = 0; q < stops.length; q++) if (stops[q].t <= t) lo = stops[q];
            for (let q = stops.length - 1; q >= 0; q--) if (stops[q].t > t) hi = stops[q];
            const f = hi.t > lo.t ? (t - lo.t) / (hi.t - lo.t) : 0;
            const expect = [0, 1, 2, 3].map(function (c) { return lo.colour[c] + (hi.colour[c] - lo.colour[c]) * f; });
            const err = far(expect, line[k]);
            if (err > worstErr) { worstErr = err; worst = k; }
        }
        if (worst < 0 || worstErr <= bend) break;
        stops.push({ t: pos[worst], colour: line[worst].slice() });
        stops.sort(function (p, q) { return p.t - q.t; });
    }
    stops.push(endStop);
    return { start: startPos, end: endPos, stops: stops, plateauStart: k0 > 0, plateauEnd: k1 < K - 1 };
}
// profile along a direction: project samples (pixel coords) onto unit vector n, bin, average
function gfProjectedProfile(S, N, W, H, n, bins) {
    let smin = 1e9, smax = -1e9;
    const samples = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i * (W - 1) / (N - 1), y = j * (H - 1) / (N - 1);
        const s = x * n[0] + y * n[1]; samples.push({ s: s, c: S[j][i] }); if (s < smin) smin = s; if (s > smax) smax = s;
    }
    const K = bins, acc = [], cnt = [], sq = [];
    for (let k = 0; k < K; k++) { acc.push([0, 0, 0, 0]); cnt.push(0); sq.push([0, 0, 0, 0]); }
    samples.forEach(function (sm) { const k = Math.min(K - 1, Math.floor((sm.s - smin) / (smax - smin + 1e-9) * K)); for (let c = 0; c < 4; c++) { acc[k][c] += sm.c[c]; sq[k][c] += sm.c[c] * sm.c[c]; } cnt[k]++; });
    const line = [], pos = []; let scatter = 0;
    for (let k = 0; k < K; k++) {
        if (!cnt[k]) continue;
        const mean = acc[k].map(function (v) { return v / cnt[k]; });
        for (let c = 0; c < 4; c++) { const varc = sq[k][c] / cnt[k] - mean[c] * mean[c]; scatter = Math.max(scatter, Math.sqrt(Math.max(0, varc))); }
        line.push(mean); pos.push(smin + (k + 0.5) / K * (smax - smin));
    }
    return { line: line, pos: pos, scatter: scatter };
}
// angle profile around a centre (pixel coords); angles are y-down atan2 (clockwise on screen)
function gfAngularProfile(S, N, W, H, cx, cy, bins) {
    const K = bins, acc = [], cnt = [], sq = [];
    for (let k = 0; k < K; k++) { acc.push([0, 0, 0, 0]); cnt.push(0); sq.push([0, 0, 0, 0]); }
    const rMin = 0.08 * Math.min(W, H);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i * (W - 1) / (N - 1), y = j * (H - 1) / (N - 1);
        const dx = x - cx, dy = y - cy; const r = Math.sqrt(dx * dx + dy * dy); if (r < rMin) continue;
        let a = Math.atan2(dy, dx); if (a < 0) a += 2 * Math.PI;
        const k = Math.min(K - 1, Math.floor(a / (2 * Math.PI) * K));
        for (let c = 0; c < 4; c++) { acc[k][c] += S[j][i][c]; sq[k][c] += S[j][i][c] * S[j][i][c]; } cnt[k]++;
    }
    const line = [], filled = [], sds = [];
    for (let k = 0; k < K; k++) {
        if (!cnt[k]) { filled.push(false); line.push(null); continue; }
        const mean = acc[k].map(function (v) { return v / cnt[k]; });
        let sd = 0; for (let c = 0; c < 4; c++) { const varc = sq[k][c] / cnt[k] - mean[c] * mean[c]; sd = Math.max(sd, Math.sqrt(Math.max(0, varc))); }
        sds.push(sd); line.push(mean); filled.push(true);
    }
    sds.sort(function (a, b) { return a - b; });
    // the bin holding the seam is legitimately mixed, so judge the scatter at the 90th percentile
    const scatter = sds.length ? sds[Math.min(sds.length - 1, Math.floor(sds.length * 0.9))] : 0;
    return { line: line, filled: filled, scatter: scatter, bins: K };
}

// Main entry. Returns one of:
//  { kind: 'solid', colour }
//  { kind: 'linear', p0, p1, stops }                         (px coords; position 0 at p0, 1 at p1)
//  { kind: 'radial'|'elliptical', centre, axisA, axisB, stops } (axis vectors = radius at position 1)
//  { kind: 'conical', centre, start (unit vector of position 0), stops } (positions grow clockwise on screen)
//  { kind: 'complex', reason }
function fitGradientField(grid, N, W, H) {
    const S = grid; // sampled with dithering off; a blur would smear conical seams and radial centres
    const cellPx = Math.max((W - 1) / (N - 1), (H - 1) / (N - 1));
    const ranges = [0, 1, 2, 3].map(function (c) { return gfRange(S, N, c); });
    let chan = 0, bestRange = 0; for (let c = 0; c < 4; c++) { const r = ranges[c].max - ranges[c].min; if (r > bestRange) { bestRange = r; chan = c; } }
    const colourOf = function (p) { return { r: Math.round(p[0]), g: Math.round(p[1]), b: Math.round(p[2]), a: p[3] / 255 }; };
    if (bestRange <= 8) return { kind: 'solid', colour: colourOf(S[Math.floor(N / 2)][Math.floor(N / 2)]) };
    const lo = ranges[chan].min, hi = ranges[chan].max;
    const levels = [0.25, 0.5, 0.75].map(function (f) { return lo + f * (hi - lo); });
    const contours = levels.map(function (L) { return gfContour(S, N, W, H, chan, L, 0.4 * (hi - lo)); });
    const lines = contours.map(function (pts) { return gfLineFit(pts); });
    const stopsFrom = function (ramp, scale) { return ramp.stops.map(function (st) { return { position: gfRound(Math.max(0, Math.min(1, scale(st.t)))), colour: colourOf(st.colour) }; }); };

    // --- linear: parallel straight contours and a one-dimensional profile with little scatter
    const straight = lines.every(function (l) { return l && l.count >= 4 && l.rms < 0.8 * cellPx; });
    if (straight) {
        const n0 = lines[1].n;
        const parallel = lines.every(function (l) { const dot = Math.abs(l.n[0] * n0[0] + l.n[1] * n0[1]); return dot > Math.cos(4 * Math.PI / 180); });
        if (parallel) {
            let n = n0.slice();
            const c25 = lines[0], c75 = lines[2];
            if (((c75.cx - c25.cx) * n[0] + (c75.cy - c25.cy) * n[1]) < 0) n = [-n[0], -n[1]];
            const prof = gfProjectedProfile(S, N, W, H, n, 2 * N);
            if (prof.scatter < 6) {
                const ramp = gfFitRamp(prof.line, prof.pos, 3);
                if (ramp) {
                    const pt = function (s) { // point on the axis through the bitmap centre at projection s
                        const cx = (W - 1) / 2, cy = (H - 1) / 2, s0 = cx * n[0] + cy * n[1];
                        return { x: cx + (s - s0) * n[0], y: cy + (s - s0) * n[1] };
                    };
                    return { kind: 'linear', p0: pt(ramp.start), p1: pt(ramp.end), stops: stopsFrom(ramp, function (t) { return (t - ramp.start) / (ramp.end - ramp.start); }) };
                }
            }
        }
    }
    // --- radial / elliptical: contours are concentric similar ellipses
    const ells = contours.map(function (pts) { const e = gfEllipseFit(pts); return (e && e.b > 2.5 * cellPx) ? e : null; });
    const midE = ells[1] && ells[1].rms < 0.06 ? ells[1] : (ells[0] && ells[0].rms < 0.06 ? ells[0] : null);
    if (midE) {
        const others = ells.filter(function (e) { return e && e !== midE && e.rms < 0.08; });
        const sameShape = function (e) {
            const dAng = Math.atan2(Math.sin(e.theta - midE.theta), Math.cos(e.theta - midE.theta));
            return Math.hypot(e.cx - midE.cx, e.cy - midE.cy) < Math.max(1.5 * cellPx, 0.05 * midE.a) && Math.abs((e.b / e.a) - (midE.b / midE.a)) < 0.12 && (midE.b / midE.a > 0.9 || Math.abs(dAng) < 8 * Math.PI / 180);
        };
        if (others.length && others.every(sameShape)) {
            // profile over the normalised radius: every sample is placed by its distance in the
            // ellipse frame (scaled so the major axis counts in pixels), then binned and averaged
            const ct = Math.cos(midE.theta), st = Math.sin(midE.theta), ratio = midE.b / midE.a;
            const K = 2 * N, acc = [], cnt = [];
            let sMax = 0;
            const rs = [];
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
                const x = i * (W - 1) / (N - 1) - midE.cx, y = j * (H - 1) / (N - 1) - midE.cy;
                const u = x * ct + y * st, w = -x * st + y * ct;
                const sr = Math.sqrt(u * u + (w / ratio) * (w / ratio));
                rs.push(sr); if (sr > sMax) sMax = sr;
            }
            for (let k = 0; k < K; k++) { acc.push([0, 0, 0, 0]); cnt.push(0); }
            let idx = 0;
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = Math.min(K - 1, Math.floor(rs[idx++] / (sMax + 1e-9) * K)); for (let c = 0; c < 4; c++) acc[k][c] += S[j][i][c]; cnt[k]++; }
            const line = [], pos = [];
            for (let k = 0; k < K; k++) { if (!cnt[k]) continue; line.push(acc[k].map(function (v) { return v / cnt[k]; })); pos.push((k + 0.5) / K * sMax); }
            const ramp = gfFitRamp(line, pos, 3, 10, 0);
            if (ramp && ramp.end > 0) {
                const aEnd = ramp.end, bEnd = ramp.end * (midE.b / midE.a);
                const circular = Math.abs(aEnd - bEnd) / aEnd < 0.03;
                return { kind: circular ? 'radial' : 'elliptical', centre: { x: midE.cx, y: midE.cy },
                    axisA: { x: aEnd * Math.cos(midE.theta), y: aEnd * Math.sin(midE.theta) },
                    axisB: { x: -bEnd * Math.sin(midE.theta), y: bEnd * Math.cos(midE.theta) },
                    endsInside: ramp.plateauEnd, stops: stopsFrom(ramp, function (t) { return t / ramp.end; }) };
            }
        }
    }
    // --- conical: straight contours that are not parallel (rays through one centre)
    if (straight) {
        let A = 0, B = 0, C = 0, D = 0, E = 0;
        lines.forEach(function (l) { const nx = l.n[0], ny = l.n[1], k = nx * l.cx + ny * l.cy; A += nx * nx; B += nx * ny; C += ny * ny; D += nx * k; E += ny * k; });
        const det = A * C - B * B;
        if (Math.abs(det) > 1e-9) {
            const cx = (D * C - B * E) / det, cy = (A * E - B * D) / det;
            if (cx > -W && cy > -H && cx < 2 * W && cy < 2 * H) {
                const prof = gfAngularProfile(S, N, W, H, cx, cy, 180);
                if (prof.scatter < 8) {
                    const K = prof.bins; let seam = 0, jump = -1;
                    for (let k = 0; k < K; k++) { const a = prof.line[k], b = prof.line[(k + 1) % K]; if (!a || !b) continue; let d = 0; for (let c = 0; c < 4; c++) d += Math.abs(a[c] - b[c]); if (d > jump) { jump = d; seam = (k + 1) % K; } }
                    const line = [], pos = [];
                    for (let k = 0; k < K; k++) { const idx = (seam + k) % K; if (!prof.line[idx]) continue; line.push(prof.line[idx]); pos.push((k + 0.5) / K); }
                    const ramp = gfFitRamp(line, pos, 3, 10);
                    if (ramp) {
                        const a0 = seam / K * 2 * Math.PI;
                        return { kind: 'conical', centre: { x: cx, y: cy }, start: { x: Math.cos(a0), y: Math.sin(a0) }, stops: stopsFrom(ramp, function (t) { return t; }) };
                    }
                }
            }
        }
    }
    return { kind: 'complex', reason: straight ? 'straight contours but no consistent profile' : (midE ? 'ellipse rms ' + midE.rms.toFixed(3) : 'no fit'), debug: { lines: lines.map(function (l) { return l ? { rms: gfRound(l.rms / cellPx, 2), n: l.count, deg: gfRound(Math.atan2(l.d[1], l.d[0]) * 180 / Math.PI, 1) } : null; }), ells: ells.map(function (e) { return e ? { rms: gfRound(e.rms, 3), a: gfRound(e.a), b: gfRound(e.b) } : null; }) } };
}


// Where the node renderer's bitmap sits in the spread: pixel (0,0) is the top-left of the
// intersection of the ancestors' clipping boxes (verified: the owl Fill rendered 5031x3578 = the
// Owl frame cut by the page Rectangle; a radial placed at local (300,300) showed at spread
// (264.6,264.6) with the frame origin at -35.4; a Mask inside a -35,-35 frame rendered 2551x3598).
// Without a clipping ancestor the spread extents are used.
function renderFrameOrigin(n) { return clipRegionOrigin(safe(function () { return n.parent; }, null), n); }
// Top-left of the clipping region formed by `start` and its ancestors (an enclosure such as a Mask
// does not report a parent, so its host is passed explicitly).
function clipRegionOrigin(start, n) {
    let box = null;
    let p = start, guard = 0;
    while (p && guard++ < 64) {
        const pk = nodeKind(p);
        let b = null;
        // only real layers clip: the Spread and Document objects also sit on the parent chain
        if (pk === 'artboard') b = safe(function () { return p.artboardSpreadBaseBox; }, null) || safe(function () { return p.getSpreadBaseBox(false); }, null);
        else if (pk === 'shape' || pk === 'curve' || pk === 'image' || pk === 'raster' || pk === 'text') b = safe(function () { return p.getSpreadBaseBox(false); }, null);
        if (b && isFinite(b.x) && b.width > 0) {
            if (!box) box = { x: b.x, y: b.y, w: b.width, h: b.height };
            else { const x0 = Math.max(box.x, b.x), y0 = Math.max(box.y, b.y), x1 = Math.min(box.x + box.w, b.x + b.width), y1 = Math.min(box.y + box.h, b.y + b.height); box = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }; }
        }
        p = safe(function () { return p.parent; }, null);
    }
    if (!box) { const e = safe(function () { return n.spread.getSpreadExtents(); }, null); box = e ? { x: e.x, y: e.y, w: e.width, h: e.height } : { x: 0, y: 0, w: 0, h: 0 }; }
    return { x: box.x, y: box.y };
}
// Render a fill layer in isolation and sample it on an N x N grid of RGBA values.
function renderFillLayerGrid(n, N) {
    const RO = require('/rasterobject.js');
    const PX = require('/pixelaccessor.js');
    let eng = null;
    try { const opts = RO.NodeRenderingEngineOptions.create(); try { opts.isIsolatedRendering = true; } catch (e0) {} try { opts.ditherGradients = false; } catch (eD) {} eng = RO.NodeRenderingEngine.create(n, RO.RasterFormat.RGBA8, opts); } catch (e1) { eng = null; }
    if (!eng) { try { eng = RO.NodeRenderingEngine.createDefault(n, RO.RasterFormat.RGBA8); } catch (e2) { return null; } }
    const w = num(safe(function () { return eng.width; })), h = num(safe(function () { return eng.height; }));
    if (!(w > 1 && h > 1)) return null;
    let rd = null;
    try {
        const bmp = eng.createCompatibleBitmap(false);
        // createCompatibleBitmap gives an empty bitmap; copyTo is what fills it (verified)
        try { eng.copyTo(bmp, { x: 0, y: 0, width: w, height: h }, 0, 0); } catch (eCopy) {}
        rd = PX.PixelReaderRGBA8.create(bmp);
        const grid = [];
        for (let j = 0; j < N; j++) {
            const row = []; const y = Math.min(h - 1, Math.round(j * (h - 1) / (N - 1)));
            for (let i = 0; i < N; i++) { const x = Math.min(w - 1, Math.round(i * (w - 1) / (N - 1))); const p = rd.readPixel(x, y); const v = p ? [p.r, p.g, p.b, p.alpha] : [0, 0, 0, 0]; if (p && __toSrgb) __toSrgb(v, 0); row.push(v); }
            grid.push(row);
        }
        return { grid: grid, w: w, h: h };
    } catch (e) { return null; }
    finally { try { if (rd) rd.dispose(); } catch (e3) {} }
}
// A fill layer has no extent of its own (box width/height 0 at -DBL_MAX); a painted pixel layer
// has a real box and is exported as an image instead.
function isBoxlessRaster(n) {
    if (safe(function () { return n.imageResourceInterface; }, null)) return false;
    const own = safe(function () { return n.getSpreadBaseBox(false); }, null);
    return !own || !(own.width > 0 && own.height > 0) || !isFinite(own.x) || Math.abs(own.x) > 1e300;
}
// Build the shape record that stands in for a fill layer. Returns false when the fill is not a
// solid or a single gradient (the caller then flags it).
function fillLayerAsRectangle(n, rec) {
    const N = 65;
    const sampled = renderFillLayerGrid(n, N);
    if (!sampled) { rec.fillLayerReason = 'nothing to draw'; return false; } // an empty pixel layer has no box either
    const fit = fitGradientField(sampled.grid, N, sampled.w, sampled.h);
    if (!fit || fit.kind === 'complex') { rec.fillLayerReason = fit ? fit.reason : 'render failed'; return false; }
    // the fill spans whatever clips it: the nearest non-group ancestor, else its artboard, else the spread
    let pbox = null;
    let p = safe(function () { return n.parent; }, null);
    while (p && !pbox) {
        const pk = nodeKind(p);
        if (pk === 'artboard') pbox = safe(function () { return p.artboardSpreadBaseBox; }, null) || safe(function () { return p.getSpreadBaseBox(false); }, null);
        else if (pk !== 'group' && pk !== 'container') pbox = safe(function () { return p.getSpreadBaseBox(false); }, null);
        if (!pbox) p = safe(function () { return p.parent; }, null);
    }
    if (!pbox) pbox = safe(function () { return n.spread.getSpreadExtents(); }, null);
    if (!pbox || !(pbox.width > 0 && pbox.height > 0)) return false;
    const box = { x: round(pbox.x), y: round(pbox.y), w: round(pbox.width), h: round(pbox.height) };
    // the render includes the layer opacity, which travels separately: divide it back out
    const opacity = num(safe(function () { return n.globalOpacity; }, 1), 1) || 1;
    const colourOut = function (c) { let a = Math.max(0, Math.min(1, c.a / opacity)); if (a > 0.99) a = 1; return { r: c.r, g: c.g, b: c.b, a: round(a, 4) }; };
    const stopsOut = function (stops) { return stops.map(function (st) { return { position: round(st.position), midpoint: 0.5, colour: colourOut(st.colour) }; }); };
    const origin = renderFrameOrigin(n); // bitmap pixels -> spread (1:1, offset by the render frame)
    const pt = function (q) { return { x: origin.x + q.x, y: origin.y + q.y }; };
    const vec = function (v) { return { x: v.x, y: v.y }; };
    rec.kind = 'shape';
    rec.shape = { type: 'Rectangle', corners: {}, absoluteSizes: false, useSingleRadius: true, isPlainRectangle: true };
    rec.localBox = box; rec.spreadBox = box; rec.transform = [1, 0, 0, 0, 1, 0]; rec.world = [1, 0, 0, 0, 1, 0];
    rec.stroke = null; rec.strokes = null; rec.fills = null; rec.curves = null;
    const base = { alpha: 1, blendMode: 'Normal', scaleWithObject: true };
    if (fit.kind === 'solid') {
        rec.fill = Object.assign({ type: 'Solid', transform: [1, 0, 0, 0, 1, 0], colour: colourOut(fit.colour) }, base);
    } else if (fit.kind === 'linear') {
        // unit (0,0) = start, (1,0) = end, as Affinity's own descriptors have it
        const P0 = pt(fit.p0), P1 = pt(fit.p1), d = { x: P1.x - P0.x, y: P1.y - P0.y };
        rec.fill = Object.assign({ type: 'Gradient', gradientType: 'Linear', stops: stopsOut(fit.stops), transform: rnd6([d.x, -d.y, P0.x, d.y, d.x, P0.y]) }, base);
    } else if (fit.kind === 'radial' || fit.kind === 'elliptical') {
        // columns = the two radius vectors at position 1, translation = centre
        const C = pt(fit.centre), A = vec(fit.axisA), B = vec(fit.axisB);
        rec.fill = Object.assign({ type: 'Gradient', gradientType: fit.kind === 'radial' ? 'Radial' : 'Elliptical', stops: stopsOut(fit.stops), transform: rnd6([A.x, B.x, C.x, A.y, B.y, C.y]) }, base);
    } else if (fit.kind === 'conical') {
        // (1,0) points along the start direction; positions grow clockwise on screen (verified)
        const C = pt(fit.centre), L = Math.min(box.w, box.h) / 2, D = vec({ x: fit.start.x * L, y: fit.start.y * L });
        rec.fill = Object.assign({ type: 'Gradient', gradientType: 'Conical', stops: stopsOut(fit.stops), transform: rnd6([D.x, -D.y, C.x, D.y, D.x, C.y]) }, base);
    } else {
        return false;
    }
    rec.fillLayer = fit.kind;
    rec.name = rec.name || 'Fill';
    return true;
}

// ---------------------------------------------------------------------------
// Pixel masks (a painted Mask layer nested on another layer). Like fill layers they have no
// readable pixels through the API, but the node renderer gives their coverage (in the RGB
// channels, alpha solid). JSLib has no bitmap writer, so a PNG is assembled here: 8-bit
// grey + alpha, coverage in BOTH channels (Cavalry track mattes read alpha), compressed by
// deflateFixed below.
// ---------------------------------------------------------------------------
const __crcTable = (function () { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function pngCrc32(arr, start, end) { let c = 0xFFFFFFFF; for (let i = start; i < end; i++) c = __crcTable[(c ^ arr[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function pngChunk(type, data) {
    const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i); out.set(data, 8);
    dv.setUint32(8 + data.length, pngCrc32(out, 4, 8 + data.length));
    return out;
}
// Deflate (RFC 1951) with the fixed Huffman codes and LZ77 matches found through hash chains. JSLib has
// no image encoder, and the renders and masks are mostly long transparent runs, which this shrinks
// to almost nothing (a 45 MB brush render came to a few MB). Long matches skip re-hashing their
// insides, which keeps runs of millions of zeros fast.
const __deflateTables = (function () {
    const rev = function (code, len) { let r = 0; for (let i = 0; i < len; i++) { r = (r << 1) | (code & 1); code >>>= 1; } return r; };
    const litCode = new Uint16Array(288), litLen = new Uint8Array(288);
    for (let i = 0; i < 288; i++) {
        const c = i < 144 ? 0x30 + i : (i < 256 ? 0x190 + i - 144 : (i < 280 ? i - 256 : 0xC0 + i - 280));
        const l = i < 144 ? 8 : (i < 256 ? 9 : (i < 280 ? 7 : 8));
        litCode[i] = rev(c, l); litLen[i] = l;
    }
    const lenBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    const lenExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    const distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    const lenSym = new Uint8Array(259), distSym = new Uint8Array(32769);
    for (let s = 0; s < 29; s++) for (let l = lenBase[s]; l < (s < 28 ? lenBase[s + 1] : 259); l++) lenSym[l] = s;
    lenSym[258] = 28;
    for (let s = 0; s < 30; s++) for (let d = distBase[s]; d < (s < 29 ? distBase[s + 1] : 32769); d++) distSym[d] = s;
    const distCode = new Uint8Array(30); for (let s = 0; s < 30; s++) distCode[s] = rev(s, 5);
    return { litCode: litCode, litLen: litLen, lenBase: lenBase, lenExtra: lenExtra, distBase: distBase, distExtra: distExtra, lenSym: lenSym, distSym: distSym, distCode: distCode };
})();
function deflateFixed(data) {
    const T = __deflateTables, n = data.length;
    const out = new Uint8Array(n + (n >>> 3) + 64);
    let op = 0, bitBuf = 0, bitCnt = 0;
    const put = function (v, len) { bitBuf |= v << bitCnt; bitCnt += len; while (bitCnt >= 8) { out[op++] = bitBuf & 0xFF; bitBuf >>>= 8; bitCnt -= 8; } };
    const lit = function (sym) { put(T.litCode[sym], T.litLen[sym]); };
    put(1, 1); put(1, 2); // final block, fixed Huffman codes
    const WIN = 32768, HBITS = 15, head = new Int32Array(1 << HBITS).fill(-1), prev = new Int32Array(WIN);
    const hash = function (p) { return Math.imul((data[p] << 16) | (data[p + 1] << 8) | data[p + 2], 0x9E3779B1) >>> (32 - HBITS); };
    const insert = function (p) { const h = hash(p); prev[p & (WIN - 1)] = head[h]; head[h] = p; };
    let i = 0;
    while (i < n) {
        let best = 0, dist = 0;
        if (i + 2 < n) {
            const maxLen = Math.min(258, n - i);
            let j = head[hash(i)], chain = 24;
            while (j >= 0 && i - j <= WIN && chain-- > 0) {
                if (data[j + best] === data[i + best] && data[j] === data[i]) {
                    let l = 0; while (l < maxLen && data[j + l] === data[i + l]) l++;
                    if (l > best) { best = l; dist = i - j; if (l === maxLen) break; }
                }
                const nj = prev[j & (WIN - 1)];
                if (nj >= j) break; // the slot was reused by a newer position
                j = nj;
            }
            insert(i);
        }
        if (best >= 3) {
            const ls = T.lenSym[best];
            lit(257 + ls); if (T.lenExtra[ls]) put(best - T.lenBase[ls], T.lenExtra[ls]);
            const ds = T.distSym[dist];
            put(T.distCode[ds], 5); if (T.distExtra[ds]) put(dist - T.distBase[ds], T.distExtra[ds]);
            const stop = Math.min(n - 2, i + best);
            if (best <= 32) { for (let p = i + 1; p < stop; p++) insert(p); }
            else { for (let p = i + 1; p < Math.min(stop, i + 4); p++) insert(p); for (let p = Math.max(i + 4, i + best - 3); p < stop; p++) insert(p); }
            i += best;
        } else { lit(data[i]); i++; }
    }
    lit(256);
    if (bitCnt > 0) out[op++] = bitBuf & 0xFF;
    return out.subarray(0, op);
}
// raw = filtered scanlines (filter byte 0 + pixels); channels 2 = grey+alpha
function pngEncode(raw, width, height, channels) {
    let a = 1, b = 0; for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
    const body = deflateFixed(raw);
    const z = new Uint8Array(2 + body.length + 4);
    let zi = 0; z[zi++] = 0x78; z[zi++] = 0x01;
    z.set(body, zi); zi += body.length;
    const ad = ((b << 16) | a) >>> 0; z[zi++] = (ad >>> 24) & 0xFF; z[zi++] = (ad >>> 16) & 0xFF; z[zi++] = (ad >>> 8) & 0xFF; z[zi++] = ad & 0xFF;
    const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, width); dv.setUint32(4, height); ihdr[8] = 8; ihdr[9] = channels === 2 ? 4 : (channels === 4 ? 6 : 0); ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', z.subarray(0, zi)), pngChunk('IEND', new Uint8Array(0))];
    let total = 0; parts.forEach(function (p) { total += p.length; });
    const png = new Uint8Array(total); let po = 0; parts.forEach(function (p) { png.set(p, po); po += p.length; });
    return png;
}
// Decode an image file with Affinity and write it as an RGBA PNG (for formats Cavalry cannot load).
// Larger than Cavalry's 15360 x 8640 image limit, it is scaled down to fit. Returns the path or null.
function originalAsPng(src, dest) {
    try {
        const RO = require('/rasterobject.js');
        const bmp = RO.Bitmap.loadFromFile(src, RO.RasterFormat.RGBA8);
        const w = num(safe(function () { return bmp.width; })), h = num(safe(function () { return bmp.height; }));
        if (!(w > 0 && h > 0)) return null;
        const pixels = new Uint8Array(bmp.createCompatibleBuffer(true).buffer);
        const step = Math.max(1, Math.ceil(Math.max(w / 15360, h / 8640)));
        const gw = Math.floor(w / step), gh = Math.floor(h / step);
        const rowLen = 1 + gw * 4;
        const raw = new Uint8Array(rowLen * gh);
        for (let y = 0; y < gh; y++) {
            const o = y * rowLen, sy = y * step;
            if (step === 1) { raw.set(pixels.subarray(sy * w * 4, (sy + 1) * w * 4), o + 1); continue; }
            for (let x = 0; x < gw; x++) { const si = (sy * w + x * step) * 4, di = o + 1 + x * 4; raw[di] = pixels[si]; raw[di + 1] = pixels[si + 1]; raw[di + 2] = pixels[si + 2]; raw[di + 3] = pixels[si + 3]; }
        }
        const png = pngEncode(raw, gw, gh, 4);
        const f = File.create(dest, 'w');
        if (!f.isOpen) return null;
        f.write(png.buffer, png.length); f.flush(); f.close();
        return fs.exists(dest) ? dest : null;
    } catch (e) {
        console.warn('Quiver: could not convert ' + src + ' to PNG: ' + e.message);
        return null;
    }
}
// Render a painted pixel layer and write it as an RGBA PNG beside the payload. Returns
// { path, original: true, originalSize, pixelWidth, pixelHeight, rendered: true } or null.
// The render takes in the layer's clipped children, adjustments among them (an Invert child came out inverted,
// measured 2026-10-16), and those are sent as layers of their own, so they are hidden while it renders.
function renderPixelLayer(doc, n, dropFolder, baseName) {
    const kids = safe(function () { return Array.from(n.children).filter(function (k) { return k.isVisibleInDomain; }); }, []);
    let hid = false;
    try {
        if (kids.length) { try { doc.hideSelection(Selection.create(doc, kids)); hid = true; } catch (eHide) { hid = false; } }
        const RO = require('/rasterobject.js');
        const opts = RO.NodeRenderingEngineOptions.create(); try { opts.isIsolatedRendering = true; } catch (e0) {} try { opts.ditherGradients = false; } catch (eD) {}
        const eng = RO.NodeRenderingEngine.create(n, RO.RasterFormat.RGBA8, opts);
        const w = num(safe(function () { return eng.width; })), h = num(safe(function () { return eng.height; }));
        if (!(w > 1 && h > 1)) return null;
        const px = new Uint8Array(eng.createCompatibleBuffer(true).buffer);
        // a Pixel layer in a CMYK document (a CMYKA8 raster) renders as nothing here, though Affinity's export draws
        // it (the Dracula cover's reeds, 2026-10-18): a blank render is no render, so the export below takes over
        let painted = false;
        for (let i = 3; i < px.length && !painted; i += 4) if (px[i]) painted = true;
        if (!painted) return null;
        const path = dropFolder + '/' + baseName + '_img' + __imageCounter + '.png';
        const out = writeRgbaPng(px, w, { x: 0, y: 0, w: w, h: h }, path);
        if (!out) return null;
        return { path: path, original: true, originalSize: { w: w, h: h }, pixelWidth: out.w, pixelHeight: out.h, rendered: true };
    } catch (e) {
        console.warn('Quiver: pixel layer render failed for ' + String(safe(function () { return n.description; }, 'pixel layer')) + ': ' + e.message);
        return null;
    } finally {
        if (hid) { try { doc.showSelection(Selection.create(doc, kids)); } catch (eShow) {} }
    }
}
function exportDevelopLayer(n, dropFolder, baseName) {
    try {
        const ri = n.rasterInterface, w = num(ri.width), h = num(ri.height), size = num(ri.pixelSize);
        if (!(w > 1 && h > 1) || (size !== 4 && size !== 8)) { console.warn('Quiver: RAW layer ' + String(safe(function () { return n.description; }, '')) + ' has a pixel format Quiver cannot read (' + size + ' bytes a pixel)'); return null; }
        const buf = ri.createCompatibleBuffer(true).buffer;
        const path = dropFolder + '/' + baseName + '_img' + __imageCounter + '.png';
        const out = writeRgbaPng(size === 8 ? new Uint16Array(buf) : new Uint8Array(buf), w, { x: 0, y: 0, w: w, h: h }, path);
        if (!out) return null;
        return { path: path, original: true, originalSize: { w: w, h: h }, pixelWidth: out.w, pixelHeight: out.h };
    } catch (e) {
        console.warn('Quiver: RAW layer export failed for ' + String(safe(function () { return n.description; }, 'RAW layer')) + ': ' + e.message);
        return null;
    }
}
// RGBA pixels from Affinity (straight alpha, `w` wide; a Uint16Array for 16-bit rasters) -> a PNG at
// `path`, cut to `crop` ({x, y, w, h} in those pixels), in sRGB, scaled down to fit within 4096 a side by
// averaging each output pixel's footprint (colour weighted by alpha). Returns the written size, or null.
function writeRgbaPng(src, w, crop, path) {
    const full = src instanceof Uint16Array ? 65535 : 255;
    const k = Math.max(1, Math.max(crop.w, crop.h) / 4096);
    const gw = Math.max(1, Math.round(crop.w / k)), gh = Math.max(1, Math.round(crop.h / k));
    const rowLen = 1 + gw * 4, raw = new Uint8Array(rowLen * gh), s8 = 255 / full;
    const cx0 = new Int32Array(gw), cx1 = new Int32Array(gw);
    for (let x = 0; x < gw; x++) { cx0[x] = crop.x + Math.floor(x * k); cx1[x] = Math.min(crop.x + crop.w, Math.max(cx0[x] + 1, crop.x + Math.floor((x + 1) * k))); }
    for (let y = 0; y < gh; y++) {
        const o = y * rowLen, y0 = crop.y + Math.floor(y * k), y1 = Math.min(crop.y + crop.h, Math.max(y0 + 1, crop.y + Math.floor((y + 1) * k)));
        raw[o] = 0;
        for (let x = 0; x < gw; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let sy = y0; sy < y1; sy++) {
                for (let si = (sy * w + cx0[x]) * 4, end = (sy * w + cx1[x]) * 4; si < end; si += 4) { const sa = src[si + 3]; r += src[si] * sa; g += src[si + 1] * sa; b += src[si + 2] * sa; a += sa; }
            }
            const di = o + 1 + x * 4, n = (cx1[x] - cx0[x]) * (y1 - y0);
            if (a) { const m = s8 / a; raw[di] = r * m + 0.5; raw[di + 1] = g * m + 0.5; raw[di + 2] = b * m + 0.5; }
            raw[di + 3] = a / n * s8 + 0.5;
            if (__toSrgb) __toSrgb(raw, di);
        }
    }
    const png = pngEncode(raw, gw, gh, 4);
    const f = File.create(path, 'w');
    if (!f.isOpen) throw new Error('Could not open ' + path + ' for writing');
    f.write(png.buffer, png.length); f.flush(); f.close();
    return fs.exists(path) ? { w: gw, h: gh, step: k } : null;
}
// "Fire rasterised": Affinity's own render of the spread, or of the selected layers, as one sRGB picture placed
// where it sits. A RAW (Develop) layer is drawn as nothing by the node renderer (a spread holding one rendered fully
// clear, 2026-10-16), so a send that holds one goes through Affinity's export, which develops it.
function flatImageNode(doc, roots, scope, extents, ctx) {
    __imageCounter++;
    const path = ctx.dropFolder + '/' + ctx.baseName + '_img' + __imageCounter + '.png';
    const raw = holdsDevelopLayer(scope === 'spread' ? safe(function () { return Array.from(doc.currentSpread.children); }, []) : roots);
    const placed = raw ? exportFlatImage(doc, roots, scope, extents, path) : renderFlatImage(doc, roots, scope, extents, path);
    const title = String(safe(function () { return doc.title; }, 'Affinity')).replace(/\.af[a-z]*$/i, '');
    const one = scope !== 'spread' && roots.length === 1;
    let blend = one ? enumName(Common.BlendMode, safe(function () { return roots[0].blendMode; })) : 'Normal';
    if (!blend || blend === 'Passthrough') blend = 'Normal';
    if (!one && scope !== 'spread' && roots.some(function (r) { const b = enumName(Common.BlendMode, safe(function () { return r.blendMode; })); return b && b !== 'Normal' && b !== 'Passthrough'; })) {
        console.warn('Quiver: the selected layers are stacked as Normal in the rasterised image, so their blend modes only apply between themselves where Affinity draws them');
    }
    const X = placed.x, Y = placed.y;
    __nodeCounter++;
    return {
        id: 'aff_' + __nodeCounter, name: (one ? String(safe(function () { return roots[0].description; }, 'Layer')) : title) + ' (rasterised)', kind: 'raster',
        visible: true, locked: false, opacity: 1, fillOpacity: 1, blendMode: blend,
        spreadBox: { x: round(X), y: round(Y), w: placed.w, h: placed.h }, localBox: { x: 0, y: 0, w: placed.w, h: placed.h },
        transform: [1, 0, X, 0, 1, Y], world: [1, 0, X, 0, 1, Y], effects: [], children: [], enclosures: [],
        fill: null, stroke: null, fills: null, strokes: null, transparency: null, blendRanges: null,
        image: { sourceName: '', pixelWidth: placed.outW, pixelHeight: placed.outH, path: path, original: true, originalSize: { w: placed.outW, h: placed.outH }, rendered: true, flat: true }
    };
}
function holdsDevelopLayer(nodes) {
    return nodes.some(function (k) { return safe(function () { return k.isVisibleInDomain; }, true) && (safe(function () { return k.isDevelopNode; }, false) || holdsDevelopLayer(safe(function () { return Array.from(k.children); }, []))); });
}
// The node renderer: the spread whole, or each selected layer drawn by itself (so an artboard's background stays
// out) and stacked back to front, cut to what paints. A render covers the node's visible box from its exact origin
// at one pixel per spread pixel and already carries the layer's opacity, but not its blend mode (measured
// 2026-10-16), so a single selected layer keeps its blend mode on the Cavalry side.
function renderFlatImage(doc, roots, scope, extents, path) {
    const RO = require('/rasterobject.js');
    const render = function (node, box) {
        const opts = RO.NodeRenderingEngineOptions.create(); if (node !== doc.currentSpread) { try { opts.isIsolatedRendering = true; } catch (e0) {} }
        const eng = RO.NodeRenderingEngine.create(node, RO.RasterFormat.RGBA8, opts);
        return { px: new Uint8Array(eng.createCompatibleBuffer(true).buffer), w: num(eng.width), h: num(eng.height), x: box.x, y: box.y };
    };
    let img;
    if (scope === 'spread') img = render(doc.currentSpread, extents);
    else {
        const parts = roots.map(function (r) { return render(r, safe(function () { return r.getSpreadVisibleBox(); }) || safe(function () { return r.getSpreadBaseBox(false); })); })
            .filter(function (p) { return p.w > 0 && p.h > 0; });
        if (parts.length === 1) img = parts[0];
        else if (parts.length) {
            // several layers: stacked with Normal over a clear backdrop, each on the nearest whole pixel
            const X = Math.floor(Math.min.apply(null, parts.map(function (p) { return p.x; }))), Y = Math.floor(Math.min.apply(null, parts.map(function (p) { return p.y; })));
            const W = Math.max.apply(null, parts.map(function (p) { return Math.round(p.x - X) + p.w; })), H = Math.max.apply(null, parts.map(function (p) { return Math.round(p.y - Y) + p.h; }));
            const out = new Uint8Array(W * H * 4);
            parts.forEach(function (p) {
                const ox = Math.round(p.x - X), oy = Math.round(p.y - Y);
                for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
                    const s = (y * p.w + x) * 4, sa = p.px[s + 3];
                    if (!sa) continue;
                    const d = ((y + oy) * W + x + ox) * 4, da = out[d + 3] * (255 - sa) / 255, oa = sa + da;
                    for (let c = 0; c < 3; c++) out[d + c] = (p.px[s + c] * sa + out[d + c] * da) / oa + 0.5;
                    out[d + 3] = oa + 0.5;
                }
            });
            img = { px: out, w: W, h: H, x: X, y: Y };
        }
    }
    if (!img) throw new Error('nothing to render as an image');
    // what paints (a group holding an adjustment renders the whole spread); the spread itself is sent whole
    let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error((scope === 'spread' ? 'the spread' : 'the selection') + ' draws nothing to send as an image');
    const crop = scope === 'spread' ? { x: 0, y: 0, w: img.w, h: img.h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    const out = writeRgbaPng(img.px, img.w, crop, path);
    if (!out) throw new Error('could not write ' + path);
    return { x: img.x + crop.x, y: img.y + crop.y, w: crop.w, h: crop.h, outW: out.w, outH: out.h };
}
// Affinity's own PNG export of the spread or the selection (with the document's background: the preset writes
// no alpha). The file keeps the document's colour profile embedded, which Cavalry honours (an Adobe RGB-tagged
// PNG showed the sRGB-converted values, 2026-10-16); its size comes from the PNG header and it is placed over the
// spread or the selection's visible box.
function exportFlatImage(doc, roots, scope, extents, path) {
    let previous = null, box = { x: extents.x, y: extents.y, w: extents.width, h: extents.height };
    try { previous = doc.selection; } catch (eP) {}
    try {
        let area;
        if (scope === 'spread') area = FileExportArea.createForCurrentSpread();
        else {
            const bs = roots.map(function (r) { return safe(function () { return r.getSpreadVisibleBox(); }, null); }).filter(function (b) { return b && isFinite(b.x); });
            const x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })), y0 = Math.min.apply(null, bs.map(function (b) { return b.y; }));
            box = { x: x0, y: y0, w: Math.max.apply(null, bs.map(function (b) { return b.x + b.width; })) - x0, h: Math.max.apply(null, bs.map(function (b) { return b.y + b.height; })) - y0 };
            doc.selection = Selection.create(doc, roots);
            area = FileExportArea.createForSelection(doc.selection);
        }
        // the PNG preset keeps the document's bit depth (16-bit, 264 MB for an 8736 x 5856 photo), so like a
        // render it is kept within 4096 a side
        const k = Math.min(1, 4096 / Math.max(box.w, box.h));
        doc.export(path, FileExportOptions.createWithPresetName('PNG'), area, k < 1 ? { width: Math.round(box.w * k), height: Math.round(box.h * k) } : null);
    } finally {
        if (scope !== 'spread') { try { doc.selection = previous; } catch (eR) { try { doc.selection = null; } catch (e2) {} } }
    }
    if (!fs.exists(path)) throw new Error("Affinity's export wrote nothing");
    const f = File.create(path, 'r'), head = new Uint8Array(24);
    f.read(head.buffer, 24); f.close();
    const dv = new DataView(head.buffer), outW = dv.getUint32(16), outH = dv.getUint32(20);
    return { x: box.x, y: box.y, w: box.w, h: box.h, outW: outW, outH: outH };
}
// Render a pixel mask and write it as a grey+alpha PNG beside the payload. Returns
// { path, width, height, step } (step = downsample factor; the bitmap covers the mask's render
// extent, which is its parent's box in the node's local frame) or null.
function exportPixelMask(n, dropFolder, baseName) {
    if (!__exportImages) return null;
    try {
        const RO = require('/rasterobject.js');
        const opts = RO.NodeRenderingEngineOptions.create(); try { opts.isIsolatedRendering = true; } catch (e0) {} try { opts.ditherGradients = false; } catch (eD) {}
        const eng = RO.NodeRenderingEngine.create(n, RO.RasterFormat.RGBA8, opts);
        const w = num(safe(function () { return eng.width; })), h = num(safe(function () { return eng.height; }));
        if (!(w > 1 && h > 1)) return null;
        const src = new Uint8Array(eng.createCompatibleBuffer(true).buffer);
        const step = Math.max(1, Math.ceil(Math.max(w, h) / 2048));
        const gw = Math.floor(w / step), gh = Math.floor(h / step);
        const rowLen = 1 + gw * 2;
        const raw = new Uint8Array(rowLen * gh);
        for (let y = 0; y < gh; y++) {
            const o = y * rowLen; raw[o] = 0; const sy = y * step;
            for (let x = 0; x < gw; x++) { const v = src[(sy * w + x * step) * 4]; raw[o + 1 + x * 2] = v; raw[o + 2 + x * 2] = v; }
        }
        const png = pngEncode(raw, gw, gh, 2);
        __imageCounter++;
        const path = dropFolder + '/' + baseName + '_mask' + __imageCounter + '.png';
        const f = File.create(path, 'w');
        if (!f.isOpen) throw new Error('Could not open ' + path + ' for writing');
        f.write(png.buffer, png.length); f.flush(); f.close();
        if (!fs.exists(path)) return null;
        return { path: path, width: w, height: h, step: step };
    } catch (e) {
        console.warn('Quiver: pixel mask export failed for ' + String(safe(function () { return n.description; }, 'mask')) + ': ' + e.message);
        return null;
    }
}

// A vector brush stroke (line type Texture with a PathBrush): JSLib exposes the brush's settings but
// not its texture image, so the stroke is rendered on its own - the layer's fill switched off for the
// render and back on with undo (no selection change, so nothing else enters the undo history) - and
// written as a grey+alpha mask. Cavalry keeps the stroke's own colour and cuts the brush's shape and
// grain out of it with the mask. Effects, the Transparency tool and clipped children would be in the
// render as well as rebuilt in Cavalry, so those layers keep a plain stroke. With "Rebuild brush
// textures in Cavalry" the render is measured instead (fitBrushTexture) and no file is written, unless
// the self-check finds the filter cannot stand in for this brush: then the mask is sent after all, with
// the reason. Returns { path, box (spread), pixelWidth, pixelHeight, fallback? }, { native: fit },
// { skipped: reason } or null.
// ---------------------------------------------------------------------------
// Art brushes (dialog switch "Rebuild brush textures in Cavalry"). Affinity paints a vector brush by
// bending its texture along the path, and the scripting API does not expose that texture, so the same
// brush is drawn on a straight line of the same length in a scratch document and rendered: that strip
// is the texture as Affinity lays it along this path (stretched or repeated to its length, pressure
// and head and tail included). Cavalry bends the strip back along the live path (_affApplyArtBrush).
// Measured against Affinity drawing nine brushes on a new path: 0.96-0.996 IoU for washes, gouache,
// markers, pencils and scribbles, 0.62-0.86 for fine patterns (marks drift a few px on the outside of
// bends). Strokes it cannot take (several subpaths, a pattern pen, an inside or outside stroke,
// mirrored or unevenly stretched with scale-with-object) keep the texture fit or Affinity's render below.
// A closed path is drawn like Affinity's: from its start point once round, the overhang across the seam.
// ---------------------------------------------------------------------------
const ART_BRUSH_MAX_SQUASH = 1.6; // the sushi design's squashed strokes (up to 1.54) still matched Affinity by eye; its 1.26 ones scored 0.90 IoU
let __artDoc = null;
function artBrushDoc(doc) {
    if (__artDoc) return __artDoc;
    const { NewDocumentOptions } = require('/document.js');
    const opts = NewDocumentOptions.createDefault();
    try { opts.units = require('/units.js').UnitType.Pixel; } catch (e) {}
    // the stroke weight renders in the source document's pixels, so the scratch document shares its dpi
    opts.dpi = num(safe(function () { return doc.dpi; }), 72); opts.width = 25000; opts.height = 4000;
    __artDoc = Document.create(opts);
    return __artDoc;
}
function closeArtBrushDoc() {
    if (!__artDoc) return;
    try { __artDoc.close(); } catch (e) {} // closes without asking although it has changes (verified)
    __artDoc = null;
}
// Length in spread pixels of one subpath (64 chords per cubic: 379.14 px on a grid arch Cavalry
// measures at 378.95).
function curveLength(c, M) {
    let L = 0, prev = matApply(M, c.start.x, c.start.y), x0 = c.start.x, y0 = c.start.y;
    c.beziers.forEach(function (b) {
        for (let i = 1; i <= 64; i++) {
            const t = i / 64, u = 1 - t;
            const p = matApply(M, u * u * u * x0 + 3 * u * u * t * b[0] + 3 * u * t * t * b[2] + t * t * t * b[4], u * u * u * y0 + 3 * u * u * t * b[1] + 3 * u * t * t * b[3] + t * t * t * b[5]);
            L += Math.sqrt((p.x - prev.x) * (p.x - prev.x) + (p.y - prev.y) * (p.y - prev.y)); prev = p;
        }
        x0 = b[4]; y0 = b[5];
    });
    return L;
}
// Why a brushed stroke cannot become an art brush (null when it can); k is its scale-with-object factor.
function artBrushCheck(rec) {
    const c = rec.curves, M = rec.world, s = rec.stroke;
    if (!c || c.length !== 1 || !c[0].beziers || !c[0].beziers.length) return { why: 'several subpaths' };
    // a gradient pen works too: the strip is drawn with an opaque pen and Cavalry lays the gradient over it
    if (!s.fill || (s.fill.type !== 'Solid' && s.fill.type !== 'Gradient' && !(s.imageBrush && s.fill.type === 'None'))) return { why: 'a pattern pen' };
    if (s.imageBrush && s.fill.type === 'Gradient') return { why: 'an image brush with a gradient pen' };
    if (s.align && s.align !== 'Centre') return { why: 'an inside or outside stroke' };
    const det = M[0] * M[4] - M[1] * M[3];
    if (det <= 0) return { why: 'a mirrored layer' };
    // A weight that scales with an unevenly scaled (or skewed) layer is squashed by direction in
    // Affinity; the strip takes the average scale, so the squash is capped (largest over smallest
    // stretch of the layer's matrix)
    const q = (M[0] * M[0] + M[1] * M[1] + M[3] * M[3] + M[4] * M[4]) / 2, big = Math.sqrt(q + Math.sqrt(Math.max(0, q * q - det * det)));
    if (s.scaleWithObject && big * big / det > ART_BRUSH_MAX_SQUASH) return { why: 'an uneven scale' };
    return { why: null, k: s.scaleWithObject ? Math.sqrt(det) : 1 };
}
// An image brush draws its own picture: with no pen in its own colours, and a solid pen recolours it keeping
// its shading (a black pen drew it in greys, measured 2026-10-18), while a plain brush is only a shape, flat in
// the pen colour. So a short line drawn with the brush and a black pen tells them apart.
function isImageBrush(doc, n) {
    const RO = require('/rasterobject.js');
    const { CurveBuilder, PolyCurve } = require('/geometry.js');
    try {
        const scratch = artBrushDoc(doc);
        const cb = CurveBuilder.create(); cb.beginXY(1000, 2000); cb.lineToXY(1400, 2000);
        const pc = PolyCurve.create(); pc.addCurve(cb.createCurve());
        const black = Fills.FillDescriptor.createSolid(Colour.createRGBA8({ r: 0, g: 0, b: 0, alpha: 255 }), Fills.BlendMode.Normal);
        scratch.addNode(Nodes.PolyCurveNodeDefinition.create(pc, Fills.FillDescriptor.createNone(), black, n.lineStyleDescriptor, Fills.FillDescriptor.createNone()));
        const line = Array.from(scratch.currentSpread.children).pop();
        const opts = RO.NodeRenderingEngineOptions.create(); try { opts.isIsolatedRendering = true; } catch (e0) {}
        const eng = RO.NodeRenderingEngine.create(line, RO.RasterFormat.RGBA8, opts);
        const px = new Uint8Array(eng.createCompatibleBuffer(true).buffer);
        let lit = 0, painted = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 64) { painted++; if (Math.max(px[i], px[i + 1], px[i + 2]) > 24) lit++; }
        return painted > 0 && lit > painted * 0.05;
    } catch (e) { return false; }
}
function exportArtBrush(doc, n, rec) {
    if (!__sendCtx || !__nativeBrushes || !__exportImages) return null;
    if ((rec.effects && rec.effects.length) || (rec.transparency && rec.transparency.type && rec.transparency.type !== 'None')) return null;
    if (safe(function () { return Array.from(n.children).some(function (k) { return k.isVisibleInDomain; }); }, false)) return null;
    const check = artBrushCheck(rec);
    if (check.why) return null;
    const L = curveLength(rec.curves[0], rec.world);
    if (!(L > 1) || L > 20000) return null;
    const RO = require('/rasterobject.js');
    const { CurveBuilder, PolyCurve, Transform } = require('/geometry.js');
    const x0 = 1000, y0 = 2000;
    let src = null, w = 0, h = 0, vb = null;
    try {
        const scratch = artBrushDoc(doc);
        // the line carries the layer's scale: Affinity lays a brush's repeats out in the layer's own space and then
        // scales them, so on a layer scaled 16x whose weight does not scale, one repeat stretches into long streaks
        // along the path (measured 2026-10-18: the same brush on a straight line of the same spread length drew
        // short hatch marks); a weight that scales with the object scales with the line
        const W = rec.world || [1, 0, 0, 0, 1, 0], sc = Math.sqrt(Math.abs(W[0] * W[4] - W[1] * W[3])) || 1;
        const cb = CurveBuilder.create(); cb.beginXY(0, 0); cb.lineToXY(L / sc, 0);
        const pc = PolyCurve.create(); pc.addCurve(cb.createCurve());
        // drawn with an opaque pen: Affinity draws a brush as its pen colour through this mask exactly (the
        // pen's colour leaves the mask unchanged and its alpha only scales it, measured on 10 brushes), so
        // Cavalry applies the pen's colour and alpha from the path's Stroke, where they stay editable
        const opaquePen = Fills.FillDescriptor.createSolid(Colour.createRGBA8({ r: 0, g: 0, b: 0, alpha: 255 }), Fills.BlendMode.Normal);
        // an image brush keeps its own colours (or its pen's tint), so it is drawn with its own pen
        const def = Nodes.PolyCurveNodeDefinition.create(pc, Fills.FillDescriptor.createNone(), rec.stroke.imageBrush ? n.penFillDescriptor : opaquePen, n.lineStyleDescriptor, Fills.FillDescriptor.createNone());
        def.transform = Transform.createTranslate(x0, y0).multiply(Transform.createScale(sc, sc));
        scratch.addNode(def);
        const line = Array.from(scratch.currentSpread.children).pop();
        vb = line.getSpreadVisibleBox(false);
        const opts = RO.NodeRenderingEngineOptions.create(); try { opts.isIsolatedRendering = true; } catch (e0) {}
        const eng = RO.NodeRenderingEngine.create(line, RO.RasterFormat.RGBA8, opts);
        w = num(safe(function () { return eng.width; })); h = num(safe(function () { return eng.height; }));
        if (w > 1 && h > 1) src = new Uint8Array(eng.createCompatibleBuffer(true).buffer);
    } catch (e) {
        console.warn('Quiver: brush strip could not be drawn for ' + rec.name + ': ' + e.message);
        return null;
    }
    if (!src || !vb) return null;
    const head = x0 - vb.x;
    const dims = { head: round(head, 3), tail: round(w - head - L, 3), row: round(y0 - vb.y, 3), length: round(L, 3), repeat: !!safe(function () { return n.lineStyle.pathBrush.isRepeat; }, false) };
    if (rec.stroke.imageBrush) {
        // an image brush travels in colour, its pen's alpha drawn in (Cavalry draws the picture as it is)
        __imageCounter++;
        const ipath = __sendCtx.dropFolder + '/' + __sendCtx.baseName + '_brush' + __imageCounter + '.png';
        const shot = writeRgbaPng(src, w, { x: 0, y: 0, w: w, h: h }, ipath);
        if (!shot || !fs.exists(ipath)) return null;
        return Object.assign({ path: ipath, pixelWidth: shot.w, pixelHeight: shot.h, width: round(w, 3), height: round(h, 3), image: true, opaque: false }, dims);
    }
    // the strip is a mask over the pen colour in Cavalry
    const step = Math.max(1, Math.ceil(Math.max(w / 8192, h / 4096)));
    const gw = Math.floor(w / step), gh = Math.floor(h / step), rowLen = 1 + gw * 2, raw = new Uint8Array(rowLen * gh);
    for (let y = 0; y < gh; y++) {
        const o = y * rowLen, sy = y * step;
        for (let x = 0; x < gw; x++) { raw[o + 1 + x * 2] = 255; raw[o + 2 + x * 2] = src[(sy * w + x * step) * 4 + 3]; }
    }
    const png = pngEncode(raw, gw, gh, 2);
    __imageCounter++;
    const path = __sendCtx.dropFolder + '/' + __sendCtx.baseName + '_brush' + __imageCounter + '.png';
    const f = File.create(path, 'w');
    if (!f.isOpen) return null;
    f.write(png.buffer, png.length); f.flush(); f.close();
    if (!fs.exists(path)) return null;
    return Object.assign({ path: path, pixelWidth: gw, pixelHeight: gh, width: round(w, 3), height: round(h, 3), opaque: true }, dims);
}

function exportBrushMask(doc, n, rec) {
    if (!__sendCtx || !(__nativeBrushes || __exportImages)) return null;
    if ((rec.effects && rec.effects.length) || (rec.transparency && rec.transparency.type && rec.transparency.type !== 'None')) return { skipped: 'effects or transparency' };
    if (safe(function () { return Array.from(n.children).some(function (k) { return k.isVisibleInDomain; }); }, false)) return { skipped: 'clipped layers' };
    const { DocumentCommand } = require('/commands.js');
    const RO = require('/rasterobject.js');
    const hadFill = !!safe(function () { return n.hasBrushFill; }, false);
    const savedFill = hadFill ? safe(function () { return n.brushFillDescriptor; }, null) : null;
    let toggled = false, src = null, w = 0, h = 0;
    try {
        if (hadFill) {
            doc.executeCommand(DocumentCommand.createSetBrushFill(n.selfSelection, Fills.FillDescriptor.createNone()));
            toggled = !safe(function () { return n.hasBrushFill; }, true);
            if (!toggled) return null;
        }
        const opts = RO.NodeRenderingEngineOptions.create(); try { opts.isIsolatedRendering = true; } catch (e0) {}
        const eng = RO.NodeRenderingEngine.create(n, RO.RasterFormat.RGBA8, opts);
        w = num(safe(function () { return eng.width; })); h = num(safe(function () { return eng.height; }));
        if (w > 1 && h > 1) src = new Uint8Array(eng.createCompatibleBuffer(true).buffer);
    } catch (e) {
        console.warn('Quiver: brush render failed for ' + String(safe(function () { return n.description; }, 'stroke')) + ': ' + e.message);
        src = null;
    } finally {
        // undo only what was done here; if the fill still is not back, put the saved one back
        if (toggled) {
            try { doc.undo(); } catch (eU) {}
            if (!safe(function () { return n.hasBrushFill; }, false) && savedFill) { try { doc.executeCommand(DocumentCommand.createSetBrushFill(n.selfSelection, savedFill)); } catch (eR) {} }
        }
    }
    if (!src) return null;
    const vb = safe(function () { return n.getSpreadVisibleBox(false); }, null);
    if (!vb || Math.abs(vb.width - w) > 2 || Math.abs(vb.height - h) > 2) return { skipped: 'render frame' };
    let fallback = null;
    if (rec.stroke.imageBrush) {
        if (!__exportImages) return { skipped: 'an image brush needs images switched on' };
        // in colour, with the layer opacity Cavalry applies again taken out
        const op = Math.max(0.001, num(safe(function () { return n.globalOpacity; }, 1), 1));
        if (op < 0.999) for (let i = 3; i < src.length; i += 4) src[i] = Math.min(255, Math.round(src[i] / op));
        __imageCounter++;
        const ipath = __sendCtx.dropFolder + '/' + __sendCtx.baseName + '_brush' + __imageCounter + '.png';
        const shot = writeRgbaPng(src, w, { x: 0, y: 0, w: w, h: h }, ipath);
        if (!shot || !fs.exists(ipath)) return null;
        return { path: ipath, box: rect(vb), pixelWidth: shot.w, pixelHeight: shot.h, image: true, opaque: false };
    }
    if (__nativeBrushes) {
        let fit = null;
        try { fit = fitBrushTexture(src, w, h, rec, vb, __nodeCounter); } catch (eFit) { console.warn('Quiver: brush texture could not be measured for ' + rec.name + ': ' + eFit.message); }
        if (fit && fit.ok) return { native: fit };
        fallback = fit ? fit.why : 'its texture could not be measured';
        if (!__exportImages) return { skipped: 'its texture cannot be rebuilt (' + fallback + ') and images are switched off' };
    }
    // the render carries the layer opacity, which Cavalry applies to the layer again, and the pen's alpha,
    // which arrives on the path's Stroke (Alpha) where it stays editable, so the mask is at full strength
    const opacity = Math.max(0.001, num(safe(function () { return n.globalOpacity; }, 1), 1) * penAlphaOf(rec.stroke.fill));
    const step = Math.max(1, Math.ceil(Math.max(w, h) / 4096));
    const gw = Math.floor(w / step), gh = Math.floor(h / step), rowLen = 1 + gw * 2, raw = new Uint8Array(rowLen * gh);
    for (let y = 0; y < gh; y++) {
        const o = y * rowLen, sy = y * step;
        for (let x = 0; x < gw; x++) { raw[o + 1 + x * 2] = 255; raw[o + 2 + x * 2] = Math.min(255, Math.round(src[(sy * w + x * step) * 4 + 3] / opacity)); }
    }
    const png = pngEncode(raw, gw, gh, 2);
    __imageCounter++;
    const path = __sendCtx.dropFolder + '/' + __sendCtx.baseName + '_brush' + __imageCounter + '.png';
    const f = File.create(path, 'w');
    if (!f.isOpen) return null;
    f.write(png.buffer, png.length); f.flush(); f.close();
    if (!fs.exists(path)) return null;
    const out = { path: path, box: rect(vb), pixelWidth: gw, pixelHeight: gh, opaque: true };
    if (fallback) out.fallback = fallback;
    return out;
}

// ---------------------------------------------------------------------------
// Rebuilt brush textures (dialog switch "Rebuild brush textures in Cavalry"). Instead of the mask, a
// few numbers measured from the same render travel and Cavalry rebuilds the texture with an SkSL
// filter on the editable stroke (AFFINITY_BRUSH_SKSL in quiver_affinity_import.js), so it follows the
// path when the path is reshaped. The render is straightened along the path (a column every 2 px
// along it, 1 px rows across), measured (width profile, edge roughness, coverage, grain length along
// and across, dash sizes), sorted into grain, fibre, bristle or spatter and turned into the filter's
// inputs; grain thresholds are calibrated by running the filter's own noise here. The rules were
// fitted to the four brush families of a sushi illustration (2026-10-14); other brushes come out as
// the nearest of the four. Tested by _brush_fit_test.js.
// ---------------------------------------------------------------------------
const BRUSH_STEP = 2; // px between strip columns
// Stations every BRUSH_STEP px along each subpath, in render pixels, with the unit tangent.
function brushStations(curves, M, ox, oy) {
    const subs = [];
    (curves || []).forEach(function (c) {
        if (!c || !c.start || !c.beziers || !c.beziers.length) return;
        const dense = [];
        const put = function (x, y) { const p = matApply(M, x, y); dense.push([p.x - ox, p.y - oy]); };
        let x0 = c.start.x, y0 = c.start.y;
        put(x0, y0);
        c.beziers.forEach(function (b) {
            for (let i = 1; i <= 48; i++) {
                const t = i / 48, u = 1 - t;
                put(u * u * u * x0 + 3 * u * u * t * b[0] + 3 * u * t * t * b[2] + t * t * t * b[4], u * u * u * y0 + 3 * u * u * t * b[1] + 3 * u * t * t * b[3] + t * t * t * b[5]);
            }
            x0 = b[4]; y0 = b[5];
        });
        const pts = [];
        let carry = 0;
        for (let i = 1; i < dense.length; i++) {
            const ax = dense[i - 1][0], ay = dense[i - 1][1], dx = dense[i][0] - ax, dy = dense[i][1] - ay, L = Math.sqrt(dx * dx + dy * dy);
            if (L < 1e-9) continue;
            while (carry <= L) { const t = carry / L; pts.push({ x: ax + dx * t, y: ay + dy * t, tx: dx / L, ty: dy / L }); carry += BRUSH_STEP; }
            carry -= L;
        }
        if (pts.length) subs.push({ closed: !!c.closed, pts: pts });
    });
    return subs;
}
// One column of 2R+1 bilinear alpha samples across the path per station.
function brushStrip(alpha, w, h, pts, R) {
    const g = function (X, Y) { return (X >= 0 && Y >= 0 && X < w && Y < h) ? alpha[Y * w + X] : 0; };
    const at = function (x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        return (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
    };
    return pts.map(function (s) {
        const col = new Float32Array(2 * R + 1), nx = -s.ty, ny = s.tx;
        for (let j = -R; j <= R; j++) col[j + R] = at(s.x + nx * j, s.y + ny * j);
        return col;
    });
}
function brushMedian(a) { const s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[s.length >> 1] : 0; }
// Width (profile), edge roughness, coverage, density and grain size of a straightened stroke. Most
// brushes paint solid, washes and soft pencils only part of the way, so everything is measured against
// the stroke's density (its 95th-percentile alpha): edges are where it stays over half that density
// outward from the path, bridging gaps of up to maxGap px. A simulated strip only needs its outline and
// density (lite), not the grain size.
function brushMeasure(cols, R, maxGap, lite) {
    const N = cols.length, H = 2 * R + 1, top = [], bot = [], width = [], ok = [];
    const vals = [];
    for (let i = 0; i < N; i += Math.max(1, Math.floor(N / 200))) for (let j = 0; j < H; j += 2) { if (cols[i][j] > 0.02) vals.push(cols[i][j]); }
    if (vals.length < 20) return null;
    vals.sort(function (x, y) { return x - y; });
    const dens = Math.max(0.05, vals[Math.floor(vals.length * 0.95)]), on = 0.5 * dens;
    const reach = function (col, sg) { let last = -1, gap = 0; for (let d = 0; d <= R; d++) { if (col[R + sg * d] > on) { last = d; gap = 0; } else if (++gap > maxGap) break; } return last; };
    for (let i = 0; i < N; i++) {
        const a = reach(cols[i], -1), b = reach(cols[i], 1);
        if (a < 0 && b < 0) { top.push(0); bot.push(0); width.push(0); continue; }
        top.push(Math.max(0, a)); bot.push(Math.max(0, b)); width.push(Math.max(0, a) + Math.max(0, b) + 1); ok.push(i);
    }
    if (ok.length < 10) return null;
    const medW = brushMedian(ok.map(function (i) { return width[i]; }));
    // 13 windows along the path, each its 80th-percentile width (texture gaps make the maximum noisy)
    const prof = [];
    for (let q = 0; q < 13; q++) {
        const lo = Math.floor(q * N / 13), hi = Math.max(lo + 1, Math.floor((q + 1) * N / 13));
        const ws = width.slice(lo, hi).sort(function (x, y) { return x - y; });
        prof.push(ws[Math.floor(ws.length * 0.8)] || 0);
    }
    const maxW = Math.max.apply(null, prof);
    // each edge's spread around its own moving average over 25 stations, as a robust standard deviation
    // (1.4826 x the median absolute deviation), so corners where a column reaches another part of the
    // stroke do not count
    const rough = function (e) {
        const dev = [];
        for (let k = 0; k < ok.length; k++) {
            let m = 0, c = 0;
            for (let q = Math.max(0, k - 12); q <= Math.min(ok.length - 1, k + 12); q++) { m += e[ok[q]]; c++; }
            dev.push(Math.abs(e[ok[k]] - m / c));
        }
        return 1.4826 * brushMedian(dev);
    };
    let cs = 0, cn = 0;
    ok.forEach(function (i) {
        const c = (bot[i] - top[i]) / 2, hw = 0.3 * width[i];
        for (let j = Math.ceil(c - hw); j <= Math.floor(c + hw); j++) { if (j >= -R && j <= R) { cs += cols[i][R + j]; cn++; } }
    });
    // grain size: the lag where the autocorrelation of each column's middle band (centred on the band
    // itself, which strokes aligned inside or outside and spatters sit off the path) falls below 0.5,
    // along (in px) and across; too thin a stroke has no measurable grain
    const band = lite ? 0 : Math.round(0.3 * medW);
    let use = ok.filter(function (i) { return width[i] >= 0.7 * medW; });
    if (use.length > 800) use = use.slice((use.length - 800) >> 1, ((use.length - 800) >> 1) + 800);
    // the band's centre line, smoothed along the path so thin streaks are not cut by its pixel steps
    const mid = use.map(function (i, a) {
        let c = 0, n = 0;
        for (let q = Math.max(0, a - 12); q <= Math.min(use.length - 1, a + 12); q++) { c += (bot[use[q]] - top[use[q]]) / 2; n++; }
        return R + Math.round(c / n);
    });
    const inside = function (a, j) { const r = mid[a] + j; return r >= 0 && r < H; };
    let mean = 0, nv = 0;
    use.forEach(function (i, a) { for (let j = -band; j <= band; j++) { if (inside(a, j)) { mean += cols[i][mid[a] + j]; nv++; } } });
    mean /= Math.max(1, nv);
    let vr = 0;
    use.forEach(function (i, a) { for (let j = -band; j <= band; j++) { if (inside(a, j)) { const d = cols[i][mid[a] + j] - mean; vr += d * d; } } });
    vr = vr / Math.max(1, nv) || 1e-9;
    const corr = function (du, dv) {
        let s = 0, n = 0;
        for (let a = 0; a + du < use.length; a++) {
            const A = cols[use[a]], B = cols[use[a + du]];
            for (let j = -band; j + dv <= band; j++) { if (inside(a, j) && inside(a + du, j + dv)) { s += (A[mid[a] + j] - mean) * (B[mid[a + du] + j + dv] - mean); n++; } }
        }
        return n ? s / n / vr : 0;
    };
    const lag = function (along) { for (let d = 1; d < 60; d++) { if ((along ? corr(d, 0) : corr(0, d)) < 0.5) return d; } return 60; };
    const along = band >= 3 ? BRUSH_STEP * lag(true) : BRUSH_STEP, across = band >= 3 ? lag(false) : 2;
    return {
        width: maxW, medianWidth: medW, profile: maxW > 0 ? prof.map(function (v) { return v / maxW; }) : null, edgeRms: (rough(top) + rough(bot)) / 2,
        coverage: cn ? cs / cn / dens : 0, density: dens, along: along, across: across, spread: Math.sqrt(vr) / dens,
        top: top, bot: bot, widthAt: width, ok: ok, centre: brushMedian(ok.map(function (i) { return (bot[i] - top[i]) / 2; }))
    };
}
// Connected areas over half density in the strip: a spatter is many separate dashes with none holding
// most of the paint (other brushes are one band with specks around it). Returns their count, whether
// they make a spatter, and the dashes' median length, width (from each area's second moments, pixel
// size included) and whether they lie across the path.
function brushBlobs(cols, R, dens) {
    const N = Math.min(cols.length, 800), c0 = (cols.length - N) >> 1, H = 2 * R + 1, on = 0.5 * dens;
    const seen = new Uint8Array(N * H), lens = [], wids = [];
    let across = 0, total = 0, largest = 0;
    const stack = [];
    for (let i0 = 0; i0 < N; i0++) for (let j0 = 0; j0 < H; j0++) {
        if (seen[i0 * H + j0] || !(cols[c0 + i0][j0] > on)) continue;
        let n = 0, su = 0, sv = 0, suu = 0, svv = 0, suv = 0;
        seen[i0 * H + j0] = 1; stack.push(i0 * H + j0);
        while (stack.length) {
            const q = stack.pop(), i = (q / H) | 0, j = q - i * H, u = i * BRUSH_STEP;
            n++; su += u; sv += j; suu += u * u; svv += j * j; suv += u * j;
            const visit = function (a, b) { if (a >= 0 && a < N && b >= 0 && b < H && !seen[a * H + b] && cols[c0 + a][b] > on) { seen[a * H + b] = 1; stack.push(a * H + b); } };
            visit(i + 1, j); visit(i - 1, j); visit(i, j + 1); visit(i, j - 1);
        }
        total += n; largest = Math.max(largest, n);
        if (n < 3) continue;
        const mu = su / n, mv = sv / n;
        const cuu = suu / n - mu * mu + BRUSH_STEP * BRUSH_STEP / 12, cvv = svv / n - mv * mv + 1 / 12, cuv = suv / n - mu * mv;
        const tr = (cuu + cvv) / 2, dd = Math.sqrt(Math.max(0, (cuu - cvv) * (cuu - cvv) / 4 + cuv * cuv));
        lens.push(Math.sqrt(12 * (tr + dd))); wids.push(Math.sqrt(12 * Math.max(0, tr - dd)));
        if (cvv > cuu) across++;
    }
    return { count: lens.length, spatter: lens.length >= 20 && largest < 0.5 * total, length: brushMedian(lens), width: brushMedian(wids), across: across * 2 > lens.length };
}
// The filter's noise (same hash and value noise as AFFINITY_BRUSH_SKSL), to calibrate and to simulate it.
function bnFract(v) { return v - Math.floor(v); }
function bnHash(x, y) {
    let a = bnFract(x * 0.1031), b = bnFract(y * 0.1031), c = a;
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
    a += d; b += d; c += d;
    return bnFract((a + b) * c);
}
function bnNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = bnHash(ix, iy), b = bnHash(ix + 1, iy), c = bnHash(ix, iy + 1), d = bnHash(ix + 1, iy + 1);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function bnSmooth(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
function bnOriented(px, py, dx, dy, w, halfLen, seed) {
    const count = Math.min(48, Math.max(1, Math.ceil(2 * halfLen / (0.7 * w)) + 1));
    let acc = 0;
    for (let i = 0; i < count; i++) { const s = count > 1 ? (i / (count - 1) - 0.5) * 2 * halfLen : 0; acc += bnNoise((px + dx * s) / w + seed, (py + dy * s) / w + seed); }
    return Math.min(1, Math.max(0, 0.5 + (acc / count - 0.5) * Math.sqrt(Math.max(1, 2 * halfLen / w))));
}
function bnStamps(px, py, dx, dy, cell, len, wid, slant, density, seed) {
    const cs = Math.cos(slant), sn = Math.sin(slant), ex = dx * cs - dy * sn, ey = dx * sn + dy * cs;
    const bx = Math.floor(px / cell), by = Math.floor(py / cell);
    let best = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = bx + i, cy = by + j;
        if (bnHash(cx + seed * 7, cy + seed * 7) <= density) {
            const qx = px - (cx + bnHash(cx + 11, cy + 11)) * cell, qy = py - (cy + bnHash(cx + 23, cy + 23)) * cell;
            const L = len * (0.6 + 0.8 * bnHash(cx + 37, cy + 37));
            const along = Math.min(0.5 * L, Math.max(-0.5 * L, qx * ex + qy * ey));
            const fx = qx - ex * along, fy = qy - ey * along;
            best = Math.max(best, bnSmooth(0.5 * wid + 0.6, 0.5 * wid - 0.6, Math.sqrt(fx * fx + fy * fy)));
        }
    }
    return best;
}
// The grain threshold (n3), softness (n10) and streak tone (n19) that leave the measured coverage
// painted with about the measured share of mid-greys, found on the filter's own noise: grain and fibre
// get their greys from soft edges to the holes, bristles from streaks of different tones.
function brushThreshold(coverage, grey, P, softs, tones) {
    const N = 1500, g = new Float64Array(N), g2 = new Float64Array(N), c = new Float64Array(N), cell = Math.max(P[9], 1);
    let r = 12345;
    const rnd = function () { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
    for (let i = 0; i < N; i++) {
        const x = rnd() * 3000, y = rnd() * 3000;
        g[i] = bnOriented(x, y, 1, 0, Math.max(P[4], 0.5), P[5], P[7] + 17);
        g2[i] = bnOriented(x, y, 1, 0, 1.5 * Math.max(P[4], 0.5), P[5], P[7] + 31);
        c[i] = P[8] * (bnNoise(x / cell + P[7] * 3.1, y / cell + P[7] * 3.1) - 0.5) * 2;
    }
    const stats = function (thr, soft, tone) {
        let s = 0, gr = 0;
        for (let i = 0; i < N; i++) { const t = bnSmooth(thr + c[i] - soft, thr + c[i] + soft, g[i]) * (1 - tone * (1 - g2[i])); s += t; if (t > 0.15 && t < 0.85) gr++; }
        return { cover: s / N, grey: gr / N };
    };
    let best = null;
    softs.forEach(function (soft) {
        tones.forEach(function (tone) {
            let lo = -0.6, hi = 1.6;
            for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if (stats(mid, soft, tone).cover > coverage) lo = mid; else hi = mid; }
            const thr = (lo + hi) / 2, err = Math.abs(stats(thr, soft, tone).grey - grey);
            if (!best || err < best.err) best = { thr: thr, soft: soft, tone: tone, err: err };
        });
    });
    return best;
}
// The filter's 20 inputs (n0..n19, see AFFINITY_BRUSH_SKSL) for one texture type: grain, fibre,
// bristle (streaks along the path), long bristle (streaks twice as long) or spatter. An open single
// path keeps its measured taper; closed paths and spatter use the median width.
function brushParams(m, blobs, seed, taperable, rim, grey, type) {
    const P = []; for (let i = 0; i < 20; i++) P.push(0);
    const tapered = taperable && type !== 'spatter' && !!m.profile, width = tapered ? m.width : m.medianWidth;
    P[0] = 0.75 * width; P[7] = seed; P[17] = Math.min(1, m.density);
    if (type === 'spatter') {
        P[1] = 0.35 * m.edgeRms; P[2] = 1.6; P[4] = Math.max(1, blobs.width); P[6] = blobs.across ? 1 : 0;
        P[11] = 1; P[13] = Math.max(P[4], blobs.length); P[15] = 0.8;
        // cell size for the measured coverage, dashes dropped at random (Poisson overlap)
        const area = P[13] * P[4] + 0.785 * P[4] * P[4];
        P[12] = Math.max(0.7 * P[13], Math.sqrt(-P[15] * area / Math.log(1 - Math.min(0.95, Math.max(0.02, m.coverage)))));
    } else {
        if (type === 'grain') { P[1] = 2 * m.edgeRms; P[2] = 2; P[4] = Math.max(1, 0.75 * m.across); P[5] = 0.5 * P[4]; P[8] = 0.08; P[9] = 5.3 * P[4]; }
        else if (type === 'fibre') { P[1] = 2.3 * m.edgeRms; P[2] = 1.2; P[4] = 1.2; P[5] = 3; P[6] = 1; P[16] = 0.7; }
        else { P[1] = 2 * m.edgeRms; P[2] = 3; P[4] = Math.max(1.5, m.across); P[5] = (type === 'long bristle' ? 5 : 2.5) * Math.max(m.along, 8); }
        P[5] = Math.min(P[5], 60, 16 * Math.max(P[4], 0.5)); // 48 samples stay closer together than the grain, or streaks turn dotted
        if (type === 'bristle' || type === 'long bristle') P[9] = 0.8 * P[5];
        // a stroke under 10 px is too thin for its grain to show, and its soft edge would read as holes
        const streaks = type === 'bristle' || type === 'long bristle';
        if (m.coverage > 0.985 || m.medianWidth < 10) { P[3] = 0; P[10] = 0.04; }
        else {
            const t = brushThreshold(m.coverage, grey, P, streaks ? [0.06] : [0.04, 0.08, 0.14, 0.22, 0.32, 0.45], streaks ? [0, 0.15, 0.3, 0.45, 0.6, 0.8] : [0]);
            P[3] = Math.max(0.0001, t.thr); P[10] = t.soft; P[19] = t.tone;
        }
        // a denser rim (watercolour, n18 > 0: interior x (1 - 0.35 n18), edge up to x (1 + 0.65 n18)) or
        // a softer edge (n18 < 0, airbrush-like)
        if (rim > 1.08 || rim < 0.92) P[18] = Math.max(-1, Math.min(1.2, (rim - 1) / (0.39 + 0.35 * rim)));
    }
    P[1] = Math.min(P[1], 0.2 * width, 40); // edge roughness is bounded so a wild measurement cannot balloon the filter
    return { type: type, width: width, tapered: tapered, params: P.map(function (v) { return round(v, 4); }) };
}
// Shape of a straightened stroke for the self-check, measured alike on Affinity's render and on the
// simulated filter output: mean alpha across the band in half-widths (24 bins over -1.5..1.5), along
// the path (32 bins, gaps included), the direction of its edges and grain (8 bins of gradient angle
// relative to the path, weighted by strength, inside the band only: its outline is checked by the
// profiles) and the share of its core that is mid-grey.
function brushFeatures(cols, R, m) {
    const N = cols.length, across = new Float64Array(24), acrossN = new Float64Array(24), orient = new Float64Array(8), along = [];
    let grey = 0, core = 0, energy = 0, en = 0;
    const stepK = Math.max(1, Math.floor(m.ok.length / 300));
    m.ok.forEach(function (i, k) {
        const hw = Math.max(1, m.widthAt[i] / 2), c = (m.bot[i] - m.top[i]) / 2;
        const j0 = Math.max(-R + 1, Math.floor(c - 1.5 * hw)), j1 = Math.min(R - 1, Math.ceil(c + 1.5 * hw));
        for (let j = j0; j <= j1; j++) {
            const v = cols[i][R + j], q = (j - c) / hw, b = Math.floor((q + 1.5) / 3 * 24);
            if (b >= 0 && b < 24) { across[b] += v; acrossN[b]++; }
            if (Math.abs(q) < 0.6) { core++; const t = v / m.density; if (t > 0.15 && t < 0.85) grey++; }
            if (k % stepK === 0 && i > 0 && i < N - 1 && Math.abs(q) < 0.75) {
                const gu = (cols[i + 1][R + j] - cols[i - 1][R + j]) / (2 * BRUSH_STEP), gv = (cols[i][R + j + 1] - cols[i][R + j - 1]) / 2, mag = Math.sqrt(gu * gu + gv * gv) / m.density;
                energy += mag; en++;
                if (mag > 0.01) { let ang = Math.atan2(gv, gu); if (ang < 0) ang += Math.PI; orient[Math.floor(ang / Math.PI * 8 + 0.5) % 8] += mag; } // bins centred on along and across
            }
        }
    });
    // along the path every column counts, empty ones too (a dashed brush leaves gaps)
    const c0 = Math.round(m.centre), hw0 = Math.max(1, Math.round(m.medianWidth / 2));
    for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let j = Math.max(-R, c0 - hw0); j <= Math.min(R, c0 + hw0); j++) { s += cols[i][R + j]; n++; } along.push(n ? s / n : 0); }
    const acr = [], alg = [];
    for (let b = 0; b < 24; b++) acr.push(acrossN[b] ? across[b] / acrossN[b] : 0);
    // lopsidedness of the profile across: the filter is symmetric, washes often fade to one side
    let pk = 0, lop = 0, nl = 0; acr.forEach(function (v) { pk = Math.max(pk, v); });
    for (let b = 0; b < 12; b++) { const x = pk ? acr[b] / pk : 0, y = pk ? acr[23 - b] / pk : 0; if (x > 0.05 || y > 0.05) { lop += Math.abs(x - y); nl++; } }
    for (let b = 0; b < 32; b++) { const lo = Math.floor(b * N / 32), hi = Math.max(lo + 1, Math.floor((b + 1) * N / 32)); let s = 0; for (let q = lo; q < hi && q < N; q++) s += along[q]; alg.push(s / (hi - lo)); }
    let ot = 0; for (let b = 0; b < 8; b++) ot += orient[b];
    // structure: the core's autocorrelation at lags scaled to the stroke's width (4 along x 3 across):
    // clean lines stay correlated along the whole path and dashes or hatching repeat, noise does neither
    const struct = [];
    const use = m.ok.filter(function (i) { return m.widthAt[i] >= 0.7 * m.medianWidth; });
    const ctr = use.map(function (i) { return R + Math.round((m.bot[i] - m.top[i]) / 2); }), hb = Math.max(1, Math.round(0.35 * m.medianWidth));
    let mu = 0, nmu = 0;
    use.forEach(function (i, a) { for (let j = -hb; j <= hb; j++) { const r = ctr[a] + j; if (r >= 0 && r <= 2 * R) { mu += cols[i][r]; nmu++; } } });
    mu /= Math.max(1, nmu);
    let va = 0;
    use.forEach(function (i, a) { for (let j = -hb; j <= hb; j++) { const r = ctr[a] + j; if (r >= 0 && r <= 2 * R) { const d = cols[i][r] - mu; va += d * d; } } });
    va = va / Math.max(1, nmu);
    [0.15, 0.4, 1, 2.5].forEach(function (fu) {
        const du = Math.max(1, Math.round(fu * m.medianWidth / BRUSH_STEP));
        [0, 0.1, 0.3].forEach(function (fv) {
            const dv = Math.round(fv * m.medianWidth);
            let sc = 0, nc = 0;
            for (let a = 0; a + du < use.length; a += 2) {
                const A = cols[use[a]], B = cols[use[a + du]];
                for (let j = -hb; j + dv <= hb; j += 2) { const r1 = ctr[a] + j, r2 = ctr[a + du] + j + dv; if (r1 >= 0 && r2 >= 0 && r1 <= 2 * R && r2 <= 2 * R) { sc += (A[r1] - mu) * (B[r2] - mu); nc++; } }
            }
            struct.push(va > 1e-4 && nc ? sc / nc / va : 0);
        });
    });
    // regularity: how many separate painted runs cross a column, and how much the runs' widths (across)
    // and lengths (along, rows near the middle) vary; engraving lines, hatching and dash patterns are
    // regular, painted texture is not
    const cvOf = function (a) { if (a.length < 5) return 3; let mm = 0; a.forEach(function (v) { mm += v; }); mm /= a.length; let vv = 0; a.forEach(function (v) { vv += (v - mm) * (v - mm); }); return Math.min(3, Math.sqrt(vv / a.length) / mm); };
    const on = 0.5 * m.density, wRuns = [], lRuns = [], perCol = [];
    m.ok.forEach(function (i) {
        const c = Math.round((m.bot[i] - m.top[i]) / 2), hw = m.widthAt[i] / 2;
        let run = 0, n = 0;
        for (let j = Math.round(c - hw); j <= Math.round(c + hw) + 1; j++) { const v = (j >= -R && j <= R) ? cols[i][R + j] : 0; if (v > on) run++; else if (run) { wRuns.push(run); run = 0; n++; } }
        perCol.push(n);
    });
    let rowsSeen = 0;
    for (let j = c0 - Math.round(0.35 * m.medianWidth); j <= c0 + Math.round(0.35 * m.medianWidth); j += 2) {
        if (j < -R || j > R) continue;
        let run = 0; rowsSeen++;
        for (let i = 0; i < N; i++) { if (cols[i][R + j] > on) run++; else if (run) { lRuns.push(run); run = 0; } }
    }
    // gaps: columns in the middle 80% of the path where the band is all but empty (a dashed brush)
    let gaps = 0, inner = 0;
    for (let i = Math.floor(0.1 * N); i < Math.ceil(0.9 * N); i++) { inner++; if (along[i] < 0.1 * m.density) gaps++; }
    const regular = { runs: brushMedian(perCol), across: cvOf(wRuns), along: cvOf(lRuns), perLength: lRuns.length / Math.max(1, rowsSeen * N * BRUSH_STEP / 100), gaps: inner ? gaps / inner : 0 };
    return { across: acr, along: alg, lopsided: nl ? lop / nl : 0, struct: struct, regular: regular, orient: Array.from(orient).map(function (v) { return ot ? v / ot : 0; }), texture: en ? energy / en : 0, grey: core ? grey / core : 0 };
}
// How far the simulated filter output is from Affinity's render, per feature (0 = the same): profile
// differences after scaling each to its own peak, and half the L1 distance of the direction histograms
// (smoothed over neighbouring bins; nothing to compare when neither has texture inside).
function brushMismatch(fa, fs) {
    // mean and largest difference of two profiles, each scaled to its own peak
    const l1 = function (a, b, worst) {
        let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma = Math.max(ma, a[i]); mb = Math.max(mb, b[i]); }
        let s = 0, n = 0, w = 0;
        for (let i = 0; i < a.length; i++) { const x = ma ? a[i] / ma : 0, y = mb ? b[i] / mb : 0; if (x > 0.05 || y > 0.05) { s += Math.abs(x - y); n++; w = Math.max(w, Math.abs(x - y)); } }
        return worst ? w : (n ? s / n : 0);
    };
    const sm = function (h, i) { return 0.25 * h[(i + 7) % 8] + 0.5 * h[i] + 0.25 * h[(i + 1) % 8]; };
    let o = 0;
    if (fa.texture > 0.02 || fs.texture > 0.02) for (let i = 0; i < 8; i++) o += Math.abs(sm(fa.orient, i) - sm(fs.orient, i));
    let st = 0; for (let i = 0; i < fa.struct.length; i++) st += Math.abs(fa.struct[i] - fs.struct[i]);
    const ra = fa.regular, rs = fs.regular;
    return { lopsided: round(Math.abs(fa.lopsided - fs.lopsided), 3), acrossWorst: round(l1(fa.across, fs.across, true), 3), alongWorst: round(l1(fa.along, fs.along, true), 3), runs: round(Math.abs(ra.runs - rs.runs) / Math.max(1, ra.runs, rs.runs), 3), regAcross: round(Math.abs(ra.across - rs.across), 3), regAlong: round(Math.abs(ra.along - rs.along), 3), across: round(l1(fa.across, fs.across), 3), along: round(l1(fa.along, fs.along), 3), orient: round(o / 2, 3), grey: round(Math.abs(fa.grey - fs.grey), 3), structure: round(st / Math.max(1, fa.struct.length), 3) };
}
// One number for a self-check: the worst feature against its tolerance (1 = at the limit). The
// tolerances and the limits in brushVerdict were fitted on the 180 vector brushes Affinity ships:
// every one was rebuilt in Cavalry, rendered and measured against Affinity's render (the simulated
// score tracks Cavalry's with a correlation of 0.84), leaning towards the mask, since a pattern
// rebuilt as noise looks wrong while an organic brush sent as its render only stops following path
// edits (2026-10-15).
const BRUSH_TOLERANCE = { across: 0.14, along: 0.18, orient: 0.2, grey: 0.2, lopsided: 0.1 };
const BRUSH_MAX_WIDTH = 200; // px: wider still, a stroke folds over itself on a tight bend where Affinity's texture bends
const BRUSH_MAX_STREAK_WIDTH = 100; // px: on wider bristle brushes the streaks drift from Affinity's (real error 2-3x the simulated)
const BRUSH_MAX_EDGE = 10; // px of edge wobble: past it the fibres read as fur (Flat Marker Used Up, 39 px); good rebuilds measured 6.4 px at most
const BRUSH_MAX_TONED_WIDTH = 60; // px: wider bristles with toned streaks (n19) measured worse in Cavalry than simulated (3 of 3 over 1.19); untoned ones up to 100 px held
function brushScore(c) {
    return Math.max(c.across / BRUSH_TOLERANCE.across, c.along / BRUSH_TOLERANCE.along, c.orient / BRUSH_TOLERANCE.orient, c.grey / BRUSH_TOLERANCE.grey, c.lopsided / BRUSH_TOLERANCE.lopsided);
}
// Whether the filter can stand in for the render, and why not. Some brushes are designs rather than
// texture, recognised in the render itself: several even-width lines side by side (engraving, rakes,
// scribbles), many short even runs along the path (dashes, hatching, stippling) or empty stretches.
// What the render alone decides, before any filter is tried (null = try the filter).
function brushPreVerdict(reg, width) {
    if ((reg.runs >= 3 && reg.across < 0.55) || (reg.runs >= 6 && reg.across < 0.7)) return 'even lines or rows of marks side by side';
    if (reg.perLength >= 3 && reg.along < 0.5) return 'repeating dashes or hatching';
    if (reg.gaps >= 0.03) return 'gaps along the stroke';
    if (width > BRUSH_MAX_WIDTH) return 'wider than ' + BRUSH_MAX_WIDTH + ' px';
    return null;
}
function brushVerdict(fit) {
    if ((fit.type === 'bristle' || fit.type === 'long bristle') && fit.width > BRUSH_MAX_STREAK_WIDTH) return 'a bristle brush wider than ' + BRUSH_MAX_STREAK_WIDTH + ' px';
    if ((fit.type === 'bristle' || fit.type === 'long bristle') && fit.width > BRUSH_MAX_TONED_WIDTH && fit.params[19] > 0) return 'a wide bristle brush with shaded streaks';
    // a grain 3 px or coarser reads as blotches in Cavalry where Affinity paints a smooth wash or a fine
    // dry texture (watercolours, Round and Square Pastel; every good grain rebuild measured 2.25 px or finer)
    if ((fit.type === 'grain' || fit.type === 'fibre') && fit.params[4] >= 3) return 'a coarse grain the filter draws as blotches';
    if (fit.params[1] > BRUSH_MAX_EDGE) return 'edges rougher than ' + BRUSH_MAX_EDGE + ' px';
    if (fit.score <= 1) return null;
    const c = fit.check, worst = [['across', 'its profile across the stroke'], ['along', 'its strength along the stroke'], ['orient', 'the direction of its grain'], ['grey', 'its soft greys'], ['lopsided', 'its fade to one side']]
        .sort(function (a, b) { return c[b[0]] / BRUSH_TOLERANCE[b[0]] - c[a[0]] / BRUSH_TOLERANCE[a[0]]; })[0];
    return 'the rebuilt texture differs in ' + worst[1];
}
// The filter's output on a straight stroke with the measured length, width and taper, in strip
// coordinates (a column every BRUSH_STEP px along, rows 1 px across), for the self-check: columns
// i0..i0+n-1 of a stroke N columns long. It follows AFFINITY_BRUSH_SKSL's main() with the stroke's
// direction known; the fade at the ends is left out.
function brushSimulate(fit, N, R, i0, n) {
    const P = fit.params, prof = fit.tapered ? fit.profile : null, w = fit.width, L = (N - 1) * BRUSH_STEP, seed = P[7];
    const hwAt = function (u) {
        if (!prof) return w / 2;
        const x = Math.min(1, Math.max(0, u / Math.max(L, 1))) * (prof.length - 1), k = Math.min(prof.length - 2, Math.floor(x));
        return w / 2 * (prof[k] + (prof[k + 1] - prof[k]) * (x - k));
    };
    const rows = Math.min(R, Math.ceil(w / 2 + P[1] + 3)), cols = [];
    for (let i = i0; i < i0 + n; i++) {
        const col = new Float32Array(2 * R + 1), u = i * BRUSH_STEP;
        for (let j = -rows; j <= rows; j++) {
            const v = j, jit = (bnNoise(u / 6 + seed * 5.3, v / 6 + seed * 5.3) - 0.5) * 2 * P[16];
            const fdx = -Math.sin(jit), fdy = Math.cos(jit);
            const h = (bnOriented(u, v, fdx, fdy, Math.max(P[2], 0.5), 0.5 * P[1], seed) - 0.5) * 2 * P[1];
            const qu = u + fdx * h, qv = v + fdy * h;
            if (qu < 0 || qu > L) continue;
            const hw = hwAt(qu);
            let a = Math.min(1, Math.max(0, hw - Math.abs(qv) + 0.5));
            if (a <= 0) continue;
            const gdx = P[6] > 0.5 ? 0 : 1, gdy = P[6] > 0.5 ? 1 : 0;
            if (P[11] > 0.5) a *= bnStamps(u, v, gdx, gdy, Math.max(P[12], 1), P[13], Math.max(P[4], 0.5), P[14], P[15], seed);
            else {
                if (P[3] > 0) {
                    const g = bnOriented(u, v, gdx, gdy, Math.max(P[4], 0.5), P[5], seed + 17);
                    const thr = P[3] + P[8] * (bnNoise(u / Math.max(P[9], 1) + seed * 3.1, v / Math.max(P[9], 1) + seed * 3.1) - 0.5) * 2, soft = Math.max(P[10], 0.005);
                    a *= bnSmooth(thr - soft, thr + soft, g);
                }
                if (P[19] > 0) a *= 1 - P[19] * (1 - bnOriented(u, v, gdx, gdy, 1.5 * Math.max(P[4], 0.5), P[5], seed + 31));
            }
            if (P[18] > 0) a *= 1 + P[18] * (bnSmooth(0.5, 1, Math.abs(v) / Math.max(hw, 1)) - 0.35);
            col[R + j] = Math.min(1, a * P[17]);
        }
        cols.push(col);
    }
    return cols;
}
// How far the paint reaches past each end of an open path, as a share of the width: a brush with a
// rounded end paints about half its width beyond the path, a flat or tapered one hardly at all.
function brushOverhang(alpha, w, h, pts, width, dens) {
    const g = function (x, y) { const X = Math.round(x), Y = Math.round(y); return (X >= 0 && Y >= 0 && X < w && Y < h) ? alpha[Y * w + X] : 0; };
    const one = function (p, sx, sy) {
        let last = 0, gap = 0;
        for (let d = 1; d <= width; d++) {
            let hit = false;
            for (let k = -2; k <= 2; k++) { const o = 0.15 * width * k; if (g(p.x + sx * d - sy * o, p.y + sy * d + sx * o) > 0.5 * dens) hit = true; }
            if (hit) { last = d; gap = 0; } else if (++gap > 3) break;
        }
        return last / Math.max(1, width);
    };
    const a = pts[0], b = pts[pts.length - 1];
    return (one(a, -a.tx, -a.ty) + one(b, b.tx, b.ty)) / 2;
}
// A pen's alpha (a solid pen reports it on the fill and on its colour alike, so the smaller one)
function penAlphaOf(pen) {
    pen = pen || {};
    return (pen.type === 'Solid' && pen.colour) ? Math.min(num(pen.alpha, 1), num(pen.colour.a, 1)) : num(pen.alpha, 1);
}
// src = the stroke's isolated RGBA render (w x h, covering the spread box vb). Returns
// { type, width, profile, params, cap, measured, check, ok } (ok = the filter matches the render well
// enough to replace it) or null when the stroke cannot be measured.
function fitBrushTexture(src, w, h, rec, vb, seed) {
    if (!rec.curves || !rec.curves.length || !rec.stroke) return null;
    const M = rec.world;
    // the render carries the layer opacity and the pen's alpha, which Cavalry applies again
    const scale = Math.max(0.001, num(rec.opacity, 1) * penAlphaOf(rec.stroke.fill)) * 255;
    const alpha = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = Math.min(1, src[i * 4 + 3] / scale);
    const k = rec.stroke.scaleWithObject ? Math.sqrt((M[0] * M[0] + M[1] * M[1] + M[3] * M[3] + M[4] * M[4]) / 2) : 1;
    const R = Math.min(400, Math.ceil(0.8 * rec.stroke.weight * k + 24));
    const subs = brushStations(rec.curves, M, vb.x, vb.y);
    if (!subs.length) return null;
    const sub = subs.reduce(function (a, b) { return b.pts.length > a.pts.length ? b : a; }); // the longest subpath is measured
    const cols = brushStrip(alpha, w, h, sub.pts, R);
    // edges bridge gaps of up to 8 px: wider would join the passes of a path that folds back on itself
    let m = brushMeasure(cols, R, 8);
    if (!m) return null;
    const blobs = brushBlobs(cols, R, m.density);
    if (m.medianWidth < 10) blobs.spatter = false; // a thin grainy line breaks into pieces too, and is not told apart
    // a spatter's dots sit further apart than any gap a solid stroke has: measured to the outermost dot
    if (blobs.spatter) m = brushMeasure(cols, R, 2 * R) || m;
    const fa = brushFeatures(cols, R, m);
    let inner = 0, outer = 0, ni = 0, no = 0;
    fa.across.forEach(function (v, b) { const q = Math.abs((b + 0.5) / 24 * 3 - 1.5); if (q < 0.4) { inner += v; ni++; } else if (q > 0.6 && q < 0.95) { outer += v; no++; } });
    const rim = (ni && no && inner > 0) ? (outer / no) / (inner / ni) : 1;
    const measured = { coverage: round(m.coverage, 3), density: round(m.density, 3), edgeRms: round(m.edgeRms, 2), grainAlong: m.along, grainAcross: m.across, grey: round(fa.grey, 3), rim: round(rim, 3), runs: fa.regular.runs, runWidthSpread: round(fa.regular.across, 3), runLengthSpread: round(fa.regular.along, 3), runsPer100px: round(fa.regular.perLength, 2), gaps: round(fa.regular.gaps, 3) };
    const taperable = !sub.closed && subs.length === 1;
    const pre = brushPreVerdict(fa.regular, taperable && !blobs.spatter ? m.width : m.medianWidth);
    if (pre) return { type: null, ok: false, why: pre, measured: measured };
    // every texture type is tried and the one the self-check finds closest to the render is kept: the
    // filter run here on a straight copy of the stroke, measured like the render (0 = the same), first
    // briefly (200 px) for every type, then over up to 400 px from the middle for the best three
    const trial = function (fits, n) {
        const nw = Math.min(cols.length, n), i0 = (cols.length - nw) >> 1, win = nw < cols.length ? cols.slice(i0, i0 + nw) : cols;
        const mw = nw < cols.length ? (brushMeasure(win, R, blobs.spatter ? 2 * R : 8) || m) : m, fw = nw < cols.length ? brushFeatures(win, R, mw) : fa;
        return fits.map(function (f) {
            const sim = brushSimulate(f, cols.length, R, i0, nw), ms = brushMeasure(sim, R, f.type === 'spatter' ? 2 * R : 8, true);
            f.check = ms ? brushMismatch(fw, brushFeatures(sim, R, ms)) : null;
            f.score = f.check ? brushScore(f.check) : 99;
            return f;
        }).sort(function (a, b) { return a.score - b.score; });
    };
    // a spatter leaves most of its band empty (measured 0.22-0.35); a near-solid stroke with loose flecks
    // at its edge (Dense Oil Impasto 03, 0.88) must not be rebuilt as dots
    const fits = ['grain', 'fibre', 'bristle', 'long bristle'].concat(blobs.count >= 20 && m.coverage < 0.6 ? ['spatter'] : []).map(function (type) {
        const f = brushParams(m, blobs, seed, taperable, rim, fa.grey, type);
        f.profile = f.tapered ? m.profile.map(function (v) { return round(v, 3); }) : null;
        return f;
    });
    const fit = trial(trial(fits, 100).slice(0, 3), 200)[0];
    // the texture is random, and a stroke that passes with one seed only can still look wrong in Cavalry
    // (Square Pastel scored 0.9 and 1.2 by seed, 1.88 rendered): the winner must also pass with another
    if (fit.score <= 1) {
        const again = trial([Object.assign({}, fit, { params: fit.params.slice(0, 7).concat([seed + 1000], fit.params.slice(8)) })], 200)[0];
        if (again.score > fit.score) { fit.score = again.score; fit.check = again.check; }
    }
    const check = fit.check, why = brushVerdict(fit), ok = !why;
    // a round cap only for a narrow, pen-like stroke that paints past its ends: on a wide brush it shows as a blob
    const cap = (!sub.closed && subs.length === 1 && fit.width <= 60 && brushOverhang(alpha, w, h, sub.pts, fit.width, m.density) > 0.3) ? 'round' : 'flat';
    return {
        type: fit.type, width: round(fit.width, 2), profile: fit.profile, params: fit.params, cap: cap, ok: ok, why: why, check: check, score: round(fit.score, 2), measured: measured
    };
}

// ---------------------------------------------------------------------------
// Adjustments / live filters: reflect the parameters object generically
// ---------------------------------------------------------------------------
function plainValue(v, depth) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return round(v, 6);
    if (typeof v === 'boolean' || typeof v === 'string') return v;
    if (typeof v === 'object') {
        if (typeof v.value === 'number' && Object.keys(v).length <= 2) return v.value; // enum
        if (depth <= 0) return null;
        return reflectObject(v, depth - 1);
    }
    return null;
}
function reflectObject(obj, depth) {
    const out = {};
    try {
        const seen = {};
        let proto = Object.getPrototypeOf(obj);
        while (proto && proto !== Object.prototype) {
            Object.getOwnPropertyNames(proto).forEach(function (k) {
                if (seen[k] || k === 'constructor' || k === 'handle' || /Count$|^enumerate|^get[A-Z]|^set[A-Z]/.test(k)) return;
                // type-flag getters (isGradient, isAddNoiseFilterParameters...) are noise; real booleans like isMonochromatic are kept
                if (/^is[A-Z]/.test(k) && /(Parameters|Node|Fill|Gradient|Colour|Interface|Selection|Descriptor|Curve|Shape|Definition)$/.test(k)) return;
                const d = Object.getOwnPropertyDescriptor(proto, k);
                if (!d || typeof d.get !== 'function') return;
                seen[k] = true;
                const v = safe(function () { return obj[k]; });
                const pv = plainValue(v, depth);
                if (pv !== null) out[k] = pv;
            });
            proto = Object.getPrototypeOf(proto);
        }
        Object.keys(obj).forEach(function (k) { if (!seen[k]) { const pv = plainValue(obj[k], depth); if (pv !== null) out[k] = pv; } });
    } catch (e) {}
    return out;
}
function effectTypeName(n) {
    const tag = String(safe(function () { return n[Symbol.toStringTag]; }, '') || Object.prototype.toString.call(n).replace(/^\[object |\]$/g, ''));
    const stripped = tag.replace(/AdjustmentRasterNode$|FilterRasterNode$/, '');
    // Newer filters (e.g. Glitch) are not wrapped by JSLib: the tag is the bare base class,
    // so fall back to the layer's own name to at least report what was skipped.
    return stripped || ('Unsupported: ' + String(safe(function () { return n.description; }, 'live filter')));
}
function serialiseAdjustment(n, kind) {
    return {
        kind: kind,
        type: effectTypeName(n),
        name: String(safe(function () { return n.description; }, kind)),
        visible: !!safe(function () { return n.isVisibleInDomain; }, true),
        opacity: round(num(safe(function () { return n.globalOpacity; }, 1), 1)),
        blendMode: enumName(Common.BlendMode, safe(function () { return n.blendMode; })),
        params: effectTypeName(n) === 'Curves' ? serialiseCurvesAdjustment(n) : reflectObject(safe(function () { return n.parameters; }, {}), 2)
    };
}
// Curves: the master curve and each channel's (0 red, 1 green, 2 blue, 3 alpha; measured), as points
// with straight or smooth segments (Affinity's smooth curve is a natural cubic spline through the points:
// 86 greys within half a level). Affinity applies a channel's curve first, then the master (measured).
function serialiseCurvesAdjustment(n) {
    const pts = function (s) { const r = []; for (let i = 0; i < s.pointCount; i++) { const q = s.getPoint(i); r.push([round(q.x, 4), round(q.y, 4)]); } return r; };
    const curve = function (s) { return s ? { points: pts(s), linear: !!s.isLinear } : null; };
    const channels = {};
    safe(function () { n.parameters.enumerateChannelSplines(function (c, s) { const k = (c && c.value !== undefined) ? c.value : c; if (s) channels[k] = curve(s); return 0; }); });
    return {
        colourSpace: enumName(require('/colours.js').ColourSpaceType, safe(function () { return n.colourSpace; })),
        min: round(num(safe(function () { return n.parameters.min; }, 0), 0), 4), max: round(num(safe(function () { return n.parameters.max; }, 1), 1), 4),
        master: safe(function () { return curve(n.parameters.masterSpline); }, null), channels: channels
    };
}
// Enclosures are the masks, adjustments and live filters nested ON a layer.
function serialiseEnclosures(doc, n, ctx, depth) {
    const out = [];
    const encl = safe(function () { return Array.from(n.enclosures); }, []);
    for (let i = 0; i < encl.length; i++) {
        const e = encl[i];
        const k = nodeKind(e);
        if (k === 'adjustment' || k === 'liveFilter') { out.push(serialiseAdjustment(e, k)); continue; }
        if (k === 'raster' && !safe(function () { return e.imageResourceInterface; }, null)) {
            const rec = serialisePixelMask(doc, e, ctx, n);
            if (rec) out.push({ kind: 'mask', node: rec });
            continue;
        }
        const rec = serialiseNode(doc, e, ctx, depth + 1);
        if (rec) out.push({ kind: 'mask', node: rec });
    }
    return out;
}
// A painted Mask layer: rendered to a PNG whose alpha is the coverage. The record is an image
// placed over the render extent (the ancestors' clipping region, see renderFrameOrigin).
function serialisePixelMask(doc, n, ctx, host) {
    const visible = !!safe(function () { return n.isVisibleInDomain; }, true);
    if (!visible) return null;
    const exported = exportPixelMask(n, ctx.dropFolder, ctx.baseName);
    __nodeCounter++;
    let origin = clipRegionOrigin(host, n);
    // the render covers the mask's own box when it has one (a Mask standing in a group: 5663 x 7275 = its
    // box, not the group's 7780 tall one), else its host's box (a group's 2325 x 1689; a picture or Pixel
    // layer reaching past the rectangle that clips it: 5316 x 7974 from -184,-1042, not the clip's 0,0,
    // measured), else the clipping region; each is used only when the render's size matches it
    const fits = function (b) { return b && exported && isFinite(b.x) && Math.abs(exported.width - b.width) <= 2 && Math.abs(exported.height - b.height) <= 2; };
    const own = safe(function () { return n.getSpreadBaseBox(false); }, null);
    const hb = safe(function () { return host.getSpreadBaseBox(false); }, null);
    if (fits(own)) origin = { x: own.x, y: own.y }; else if (fits(hb)) origin = { x: hb.x, y: hb.y };
    const W = [1, 0, origin.x, 0, 1, origin.y]; // bitmap pixels -> spread
    const w = exported ? exported.width : 0, h = exported ? exported.height : 0;
    const box = { x: 0, y: 0, w: round(w), h: round(h) };
    const c0 = matApply(W, 0, 0), c1 = matApply(W, w, h);
    return {
        id: 'aff_' + __nodeCounter,
        name: String(safe(function () { return n.description; }, 'Mask')),
        kind: 'raster',
        pixelMask: true,
        visible: true,
        locked: false,
        opacity: round(num(safe(function () { return n.globalOpacity; }, 1), 1)),
        fillOpacity: 1,
        blendMode: 'Normal',
        spreadBox: { x: round(Math.min(c0.x, c1.x)), y: round(Math.min(c0.y, c1.y)), w: round(Math.abs(c1.x - c0.x)), h: round(Math.abs(c1.y - c0.y)) },
        localBox: box,
        transform: rnd6(mat(safe(function () { return n.transform; }))),
        world: rnd6(W),
        effects: [],
        children: [],
        enclosures: [],
        clipsChildren: false,
        image: { sourceName: '', pixelWidth: w, pixelHeight: h, fileType: 'PNG', path: exported ? exported.path : null, original: true, originalSize: { w: w, h: h }, isMask: true, frameName: String(safe(function () { const ab = artboardOf(n); return ab ? ab.description : doc.title; }, 'Affinity')) }
    };
}

// ---------------------------------------------------------------------------
// Node walk
// ---------------------------------------------------------------------------
let __nodeCounter = 0;
function nodeKind(n) {
    if (safe(function () { return n.isGroupNode; })) return 'group';
    if (safe(function () { return n.isArtboardEnabled; })) return 'artboard';
    if (safe(function () { return n.isTextNode; })) return 'text';
    if (safe(function () { return n.isImageNode; })) return 'image';
    if (safe(function () { return n.isAdjustmentRasterNode; })) return 'adjustment';
    if (safe(function () { return n.isFilterRasterNode; })) return 'liveFilter';
    if (safe(function () { return n.isRasterNode; }) || safe(function () { return n.isDevelopNode; })) return 'raster'; // a RAW (Develop) layer is sent as its developed pixels
    if (safe(function () { return n.isShapeNode; })) return 'shape';
    if (safe(function () { return n.isPolyCurveNode; })) return 'curve';
    if (safe(function () { return n.isContainerNode; })) return 'container';
    if (safe(function () { return n.isEmbeddedDocumentNode; })) return 'embedded';
    return 'other';
}

function serialiseNode(doc, n, ctx, depth) {
    const kind = nodeKind(n);
    const visible = !!safe(function () { return n.isVisibleInDomain; }, true);
    if (!visible) return null; // hidden layers stay in Affinity (the importer skips them too)
    if (kind === 'adjustment' || kind === 'liveFilter') {
        // A standalone adjustment / live filter layer: applies to everything below it in its list.
        __nodeCounter++;
        const adj = serialiseAdjustment(n, kind);
        adj.id = 'aff_' + __nodeCounter;
        adj.children = [];
        // The importer does not carry an adjustment layer's mask, so it is not rendered (21 full-size renders for
        // a graded photo); the flag lets the importer say the adjustment reaches everything below it
        adj.enclosures = [];
        adj.masked = safe(function () { return Array.from(n.enclosures).some(function (e) { return e.isVisibleInDomain; }); }, false);
        return adj;
    }
    __nodeCounter++;
    const name = String(safe(function () { return n.description; }, kind));
    const W = worldMatrix(n);
    const rec = {
        id: 'aff_' + __nodeCounter,
        name: name,
        kind: kind,
        visible: visible,
        locked: !!safe(function () { return n.isLocked; }, false),
        opacity: round(num(safe(function () { return n.globalOpacity; }, 1), 1)),
        fillOpacity: round(num(safe(function () { return n.fillOpacity; }, 1), 1)),
        blendMode: enumName(Common.BlendMode, safe(function () { return n.blendMode; })),
        spreadBox: rect(safe(function () { return n.getSpreadBaseBox(false); })),
        localBox: rect(safe(function () { return n.baseBox; })),
        transform: rnd6(mat(safe(function () { return n.transform; }))),
        world: rnd6(W),
        effects: serialiseEffects(n),
        children: []
    };
    rec.tagColour = tagColourOf(n);
    if (kind !== 'group' && kind !== 'container') {
        rec.fill = serialiseFill(safe(function () { return n.brushFillDescriptor; }));
        rec.stroke = serialiseStroke(n);
        rec.fills = serialiseAllFills(n);       // all fills when there are several (index 0 first)
        rec.strokes = serialiseAllStrokes(n);   // all strokes when there are several
    }
    // Transparency tool: a second fill whose alpha fades the layer (None when unused). Groups and Layer
    // containers carry one too; text layers keep theirs on the glyph runs (see serialiseText).
    rec.transparency = serialiseFill(safe(function () { return n.transparencyInterface.fillDescriptor; }));
    rec.blendRanges = serialiseBlendRanges(n);
    if (kind === 'artboard') { rec.strokes = null; rec.fills = null; }
    if (kind === 'shape' || kind === 'curve') {
        // Fill mode (context toolbar Alternate / Winding): 'OddEven' or 'NonZero'. Overlapping
        // subpaths of expanded strokes need NonZero, glyph holes with same-direction contours OddEven.
        rec.fillRule = enumName(require('/curvesinterface.js').WindingOrder || require('/geometry.js').WindingOrder, safe(function () { return n.curvesInterface.windingOrder; }));
    }
    if (kind === 'shape') {
        rec.shape = serialiseShape(n);
        rec.curves = serialiseCurves(n);
    } else if (kind === 'curve') {
        rec.curves = serialiseCurves(n);
        rec.compoundOperation = enumName(Common.CompoundOperation || null, safe(function () { return n.compoundOperation; }));
    } else if (kind === 'text') {
        rec.text = serialiseText(n);
        if (!rec.stroke) rec.stroke = (rec.text.runs.filter(function (r) { return r.stroke; })[0] || {}).stroke || null;
        // Filler text is one field glyph whose words Affinity generates internally (the API gives only
        // '<FillerText>', measured), so like text on a path it travels as outlines.
        const filler = safe(function () { return Array.from(n.storyInterface.fillerTextGlyphs).length > 0; }, false);
        if (rec.text.kind === 'path' || filler) {
            // Text on a path: the scripting API exposes the glyph outlines (polyCurve) but not the
            // baseline path, so the text is converted to curves, serialised as a group of outlines
            // and the conversion is undone straight away.
            const outlined = outlinePathText(doc, n, ctx, depth, filler);
            if (outlined) {
                outlined.text = rec.text; outlined.name = name; outlined.tagColour = rec.tagColour; outlined.locked = rec.locked;
                if (filler) outlined.fillerTextOutlines = true; else outlined.pathTextOutlines = true;
                return outlined;
            }
            rec.curves = null;
        }
    } else if (kind === 'artboard') {
        // An artboard is a rectangle whose children are laid out in spread space; the box is its page.
        rec.artboardBox = rect(safe(function () { return n.artboardSpreadBaseBox; })) || rec.spreadBox;
        rec.shape = serialiseShape(n);
    } else if (kind === 'raster' && isBoxlessRaster(n)) {
        // A Fill layer (Layer > New Fill Layer) becomes a rectangle carrying the fitted solid,
        // linear, radial, elliptical or conical fill; anything else is flagged for the importer.
        if (!fillLayerAsRectangle(n, rec)) rec.fillLayer = 'complex';
    } else if (kind === 'embedded') {
        // A placed Affinity document (.afpub / .afdesign) or PDF: the API gives no way into its layers, so it is
        // rendered as Affinity draws it, like a Pixel layer, and placed by its box (renders came back the size
        // of the placed box, 2026-10-18); without images it stays in Affinity
        rec.kind = 'raster';
        let exported = null;
        if (__exportImages) { __imageCounter++; exported = renderPixelLayer(doc, n, ctx.dropFolder, ctx.baseName); }
        rec.image = {
            sourceName: String(safe(function () { return n.description; }, '')), pixelWidth: exported ? exported.pixelWidth : 0, pixelHeight: exported ? exported.pixelHeight : 0,
            fileType: 'png', path: exported ? exported.path : null, original: !!exported, originalSize: exported ? exported.originalSize : null,
            frameName: String(safe(function () { const ab = artboardOf(n); return ab ? ab.description : doc.title; }, 'Affinity')), embedded: true
        };
        if (exported && rec.spreadBox) {
            rec.image.rendered = true;
            rec.world = [1, 0, rec.spreadBox.x, 0, 1, rec.spreadBox.y];
            rec.localBox = { x: 0, y: 0, w: rec.spreadBox.w, h: rec.spreadBox.h };
        }
    } else if (kind === 'image' || kind === 'raster') {
        const exported = exportImage(doc, n, ctx.dropFolder, ctx.baseName);
        rec.image = {
            sourceName: String(safe(function () { return n.imageFilePath; }, '')),
            // a painted pixel layer reports its whole canvas (e.g. 39277x41760) as rasterWidth/Height; the render is the truth
            pixelWidth: (exported && exported.pixelWidth) ? exported.pixelWidth : num(safe(function () { return n.rasterWidth; })),
            pixelHeight: (exported && exported.pixelHeight) ? exported.pixelHeight : num(safe(function () { return n.rasterHeight; })),
            fileType: String(safe(function () { return n.imageFileTypeName; }, '')),
            path: exported ? exported.path : null,
            original: exported ? !!exported.original : false,
            originalSize: exported ? exported.originalSize : null,
            // the enclosing artboard (or the document) names the stored file, like Figma's frame prefix
            frameName: String(safe(function () { const ab = artboardOf(n); return ab ? ab.description : doc.title; }, 'Affinity'))
        };
        if (exported && exported.rendered && rec.spreadBox) {
            // Affinity renders a Pixel layer upright in the spread with its rotation and scale drawn in (one
            // turned -1.2 degrees came back as its 1287 x 2755 bounding box), so it is placed by that box
            const b = exported.box || rec.spreadBox;
            rec.image.rendered = true;
            rec.world = [1, 0, b.x, 0, 1, b.y];
            rec.localBox = { x: 0, y: 0, w: b.w, h: b.h };
        }
    }
    if ((kind === 'shape' || kind === 'curve') && rec.stroke && rec.stroke.lineType === 'Texture') {
        if (isImageBrush(doc, n)) rec.stroke.imageBrush = true;
        // a plain brush with no pen draws exactly as with an opaque black pen (byte for byte, measured 2026-10-22)
        else if (rec.stroke.fill.type === 'None') rec.stroke.fill = { type: 'Solid', alpha: 1, blendMode: 'Normal', transform: [1, 0, 0, 0, 1, 0], scaleWithObject: true, colour: { r: 0, g: 0, b: 0, a: 1 } };
    }
    if ((kind === 'shape' || kind === 'curve') && rec.stroke && rec.stroke.lineType === 'Texture') {
        const art = exportArtBrush(doc, n, rec);
        if (art) rec.stroke.artBrush = art;
        else {
            const bm = exportBrushMask(doc, n, rec);
            if (bm && bm.path) rec.stroke.brush = bm;
            else if (bm && bm.native) rec.stroke.brushNative = bm.native;
            else if (bm && bm.skipped) rec.stroke.brushSkipped = bm.skipped;
        }
    }
    // Children arrive back-to-front (first = bottom of the stack; verified on an
    // overlapping pair). A child list on a non-group node means those children
    // are clipped to this node.
    rec.enclosures = serialiseEnclosures(doc, n, ctx, depth);
    const kids = safe(function () { return Array.from(n.children); }, []);
    const isList = (kind === 'group' || kind === 'container' || kind === 'artboard');
    const paints = kind === 'image' || kind === 'raster' || kind === 'text' || !!(rec.fill && rec.fill.type && rec.fill.type !== 'None') || !!(rec.stroke && rec.stroke.fill) || (rec.effects || []).length > 0;
    let clipped = 0;
    for (let i = 0; i < kids.length; i++) {
        const k = kids[i], kk = nodeKind(k);
        // Mask layers report as EnclosureRasterNode wherever they sit (verified): one that is a child of a
        // layer masks that layer, and an adjustment or live filter child adjusts it, exactly as when nested
        // on it, so they join its enclosures; one standing in a group's list masks the layers below it there
        const mask = safe(function () { return k[Symbol.toStringTag]; }, '') === 'EnclosureRasterNode';
        if (!isList && (mask || kk === 'adjustment' || kk === 'liveFilter')) {
            if (mask) { const m = serialisePixelMask(doc, k, ctx, n); if (m) rec.enclosures.push({ kind: 'mask', node: m }); continue; }
            // an adjustment child adjusts the layer and the clipped layers below it, not those above (measured
            // 2026-10-16): on the layer when it draws, and as a standalone adjustment in the clipped list over the
            // layers below it (the "Artwork" clipper drawing nothing held Levels, Unsharp Mask and HSL for the whole
            // illustration)
            if (paints || !clipped) rec.enclosures.push(serialiseAdjustment(k, kk));
            if (clipped) { const adj = serialiseNode(doc, k, ctx, depth + 1); if (adj) rec.children.push(adj); }
            continue;
        }
        const child = (isList && mask) ? serialisePixelMask(doc, k, ctx, n) : serialiseNode(doc, k, ctx, depth + 1);
        if (child) { rec.children.push(child); clipped++; }
    }
    rec.clipsChildren = !isList && clipped > 0;
    return rec;
}

// Convert a text node to curves, serialise the resulting group, then undo. The converted group takes
// the original's slot in its parent's list (verified: 'Path text' -> GroupNode with one curve per
// glyph, undo restores the CurvePathTextNode). With `merge` the glyphs become one shape (Merge Curves
// leaves it selected at the spread's top level, measured: 212 glyphs -> one curve of 305 subpaths),
// also undone.
function outlinePathText(doc, n, ctx, depth, merge) {
    let rec = null, undos = 0;
    try {
        const parent = safe(function () { return n.parent; }, null);
        const listOf = function () { return Array.from((parent && safe(function () { return parent.children; }, null)) ? parent.children : doc.currentSpread.children); };
        const before = listOf();
        // the node itself first: two text layers can share a name (two '<FillerText>' frames did)
        let index = before.findIndex(function (k) { return safe(function () { return k.isSameNode(n); }, false); });
        if (index < 0) index = before.findIndex(function (k) { return k.description === n.description && safe(function () { return k.isTextNode; }, false); });
        doc.convertToCurves(Selection.create(doc, [n]), false);
        // undo only commands that happened: after a failed command, undo reverts the user's last edit
        if (!listOf().some(function (k) { return safe(function () { return k.isSameNode(n); }, false); })) undos++;
        let conv = (undos && index >= 0 && index < listOf().length) ? listOf()[index] : null;
        if (conv && merge) {
            const leaves = [];
            (function walk(x) { Array.from(safe(function () { return x.children; }, []) || []).forEach(function (k) { if (safe(function () { return k.isPolyCurveNode; }, false)) leaves.push(k); else walk(k); }); })(conv);
            if (leaves.length > 1) {
                try { doc.mergeCurves(Selection.create(doc, leaves)); } catch (eM) { console.warn('Quiver: could not merge the outlined glyphs: ' + eM.message); }
                const sel = safe(function () { return Array.from(doc.selection.nodes); }, []);
                const one = sel.length === 1 && safe(function () { return sel[0].isPolyCurveNode; }, false);
                if (one || safe(function () { return Array.from(conv.children).length; }, leaves.length) < leaves.length) undos++;
                if (one) conv = sel[0];
            }
        }
        if (conv && !safe(function () { return conv.isTextNode; }, false)) rec = serialiseNode(doc, conv, ctx, depth);
    } catch (e) {
        console.warn('Quiver: could not outline text: ' + e.message);
        rec = null;
    }
    for (let u = 0; u < undos; u++) { try { doc.undo(); } catch (eUndo) { console.warn('Quiver: undo after outlining text failed: ' + eUndo.message); } }
    return rec;
}

// The reference frame for positioning: when every selected layer sits inside the same
// artboard, that artboard's page is the frame (so a layer keeps its place in the matching
// Cavalry composition); otherwise the spread is.
function artboardOf(n) {
    let p = safe(function () { return n.parent; }, null), guard = 0;
    while (p && guard++ < 64) {
        if (safe(function () { return p.isArtboardEnabled; }, false)) return p;
        p = safe(function () { return p.parent; }, null);
    }
    return null;
}
function frameFor(roots, scope, extents) {
    const spreadFrame = { kind: 'spread', name: '', x: round(extents.x), y: round(extents.y), width: round(extents.width), height: round(extents.height) };
    if (scope !== 'selection' || !roots.length) return spreadFrame;
    let ab = null;
    for (let i = 0; i < roots.length; i++) {
        // a selected artboard is its own frame (sending Artboard2 of a spread with two stacked artboards placed it
        // relative to the spread, 1210.5 px low in a comp its size)
        const a = safe(function () { return roots[i].isArtboardEnabled; }, false) ? roots[i] : artboardOf(roots[i]);
        if (!a) return spreadFrame;
        if (ab === null) ab = a;
        else if (!(safe(function () { return ab.isSameNode(a); }, false) || (ab.description === a.description && JSON.stringify(rect(ab.artboardSpreadBaseBox)) === JSON.stringify(rect(a.artboardSpreadBaseBox))))) return spreadFrame;
    }
    const box = safe(function () { return ab.artboardSpreadBaseBox; }, null) || safe(function () { return ab.getSpreadBaseBox(false); }, null);
    if (!box) return spreadFrame;
    return { kind: 'artboard', name: String(safe(function () { return ab.description; }, 'Artboard')), x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------
// Where the payload and images go. Preferred: the Cavalry project's Assets/Quiver folder that the
// panel advertises in its ping reply - the files then land exactly where Figma imports keep theirs
// and nothing touches the Desktop. Affinity only lets a script write to folders allowed under
// Settings > Scripting > File System Access, so the folder is probed with a real write first; on
// PERMISSION_DENIED (or when Cavalry has no project) the Desktop is used instead and
// Cavalry moves the files into the project on import.
function canWriteTo(folder) {
    try {
        if (!folder) return false;
        if (!fs.exists(folder)) fs.createDirectories(folder);
        const probe = folder + '/quiver_write_test_' + Date.now() + '.txt'; // visible name: Affinity refuses dot-files even in allowed folders
        const f = File.create(probe, 'w');
        if (!f.isOpen) return false;
        f.writeString('ok'); f.flush(); f.close();
        const ok = fs.exists(probe);
        try { fs.remove(probe); } catch (eRm) {}
        return ok;
    } catch (e) { return false; }
}
function chooseDropFolder(status) {
    const assets = status && status.assets ? String(status.assets).replace(/[\\/]+$/, '') : '';
    return (assets && canWriteTo(assets)) ? assets : ensureDropFolder();
}
// Fallback transport: the Desktop itself (no sub-folder, so nothing is left behind once Cavalry
// has moved the files into the project). Affinity allows scripts to write there once the Desktop is
// listed under Settings > Scripting > File System Access.
function desktopPath() {
    const desktop = String(safe(function () { return app.userDesktopPath; }, '') || safe(function () { return app.getUserDesktopPath; }, ''));
    return desktop ? desktop.replace(/[\\/]+$/, '') : '';
}
function ensureDropFolder() {
    const desktop = desktopPath();
    if (!desktop) throw new Error('Could not resolve the Desktop path');
    if (!canWriteTo(desktop)) throw new Error('NOT_ALLOWED: cannot write to ' + desktop);
    return desktop;
}

// First-run check, once Cavalry has answered: the payload goes to the Cavalry project's Assets/Quiver
// folder when Affinity may write there (that folder or one holding it is allowed), else to the Desktop.
// Without either, nothing can be handed over, so the run stops and says which setting to change; it only
// suggests the Desktop, the one setup the README describes. (Network access is checked by waitForCavalry.)
function fileAccessMessage(desktop, status) {
    const assets = status && status.assets ? String(status.assets).replace(/[\\/]+$/, '') : '';
    if ((assets && canWriteTo(assets)) || (desktop && canWriteTo(desktop))) return null;
    return 'Quiver needs file access in Affinity before it can fire towards Cavalry:\n\nAffinity > Settings > Scripting > File System Access > Add, then choose your Desktop' + (desktop ? ' (' + desktop + ')' : '') +
        '. Also make sure "Access the file system" is enabled for this script (Default Permissions, or the script\'s own settings in the Scripts panel).\n\nThen run Quiver again.';
}

// Greyed out (disabled) version line, added last so it sits under everything else. As the label,
// so it lines up with the other labels on the left (text goes in the right-hand value column).
function addVersionLine(column) {
    try { column.addGroup('').addStaticText('v' + QUIVER_VERSION, '').setIsEnabled(false); } catch (e) {}
}
// An OK / Cancel prompt; OK means "try again". Built with Dialog like the send window (its result
// handling is known), and never touched again once runModal has returned.
function askToTryAgain(heading, lines) {
    const dlg = Dialog.create('Quiver');
    const column = dlg.addColumn(), group = column.addGroup(heading);
    // full width: with an empty label the text would start halfway across, in the value column
    lines.forEach(function (line) { const t = group.addStaticText('', line); try { t.setIsFullWidth(true); } catch (e) {} });
    addVersionLine(column);
    dlg.initialWidth = 420;
    return isOk(dlg.runModal());
}
// Nothing is written until Cavalry answers: while the Quiver panel is not listening, ask the user to
// open it and try again. Returns the online status, or null when they cancel.
function waitForCavalry(status) {
    while (status.state !== 'online') {
        const again = (status.state === 'blocked')
            ? askToTryAgain('Network access is off for this script', ['Quiver reaches Cavalry over the network on this computer.', 'Turn on "Access networks" under Affinity > Settings > Scripting > Default Permissions (or in this script\'s settings in the Scripts panel), then press OK to try again.'])
            : askToTryAgain('Cavalry is not listening', ['Nothing answered on port ' + QUIVER_AFFINITY_PORT + '.', 'Open Cavalry and the Quiver panel, then press OK to try again.']);
        if (!again) return null;
        status = pingCavalry();
    }
    return status;
}

function writeText(path, text) {
    const f = (typeof File.create === 'function') ? File.create(path, 'w') : new File(path, 'w');
    if (!f.isOpen) throw new Error('Could not open ' + path + ' for writing. Check the script has file system access to your Desktop.');
    f.writeString(text);
    f.flush();
    f.close();
}

function notifyCavalry(jsonPath, summary) {
    const req = HttpRequest.create('http://' + QUIVER_HOST + ':' + QUIVER_AFFINITY_PORT + '/post', RequestMethod.Post);
    req.setTimeoutInSec(8);
    req.setHeaderValue('X-Quiver-Source', 'affinity');
    req.setHeaderValue('X-Quiver-Action', 'importAffinity');
    // header values lose accents on the way ('José' arrives as 'Jose', measured), so the path travels
    // percent-encoded (plain ASCII) and Cavalry decodes it
    req.setHeaderValue('X-Quiver-Path', encodeURIComponent(jsonPath));
    req.setHeaderValue('X-Quiver-Path-Encoding', 'uri');
    req.setHeaderValue('X-Quiver-Format', String(QUIVER_FORMAT_VERSION));
    req.setHeaderValue('X-Quiver-Summary', summary);
    const result = req.do();
    const state = safe(function () { return result.state.value; }, -1);
    const status = safe(function () { return result.response.statusCode.value; }, 0);
    return { ok: (state === Common.ErrorCode.OK.value), status: status, reason: String(safe(function () { return result.reason; }, '')) };
}

// Ask the Quiver panel whether it is listening (Cavalry answers GET /get with a short banner).
function pingCavalry() {
    try {
        const req = HttpRequest.create('http://' + QUIVER_HOST + ':' + QUIVER_AFFINITY_PORT + '/get', RequestMethod.Get);
        req.setTimeoutInSec(2);
        const result = req.do();
        const state = safe(function () { return result.state.value; }, -1);
        const reason = String(safe(function () { return result.reason; }, ''));
        if (state !== Common.ErrorCode.OK.value) {
            return { state: /PERMISSION|NOT_ALLOWED/i.test(reason) ? 'blocked' : 'offline' };
        }
        const body = String(safe(function () { return result.response.content; }, ''));
        let info = null;
        try { info = JSON.parse(body); } catch (eJson) { info = null; }
        const assets = (info && typeof info.assets === 'string' && info.assets) ? info.assets : '';
        // the panel hands back the options of the last send so the dialog opens on them
        const options = (info && info.options && typeof info.options === 'object') ? info.options : null;
        return { state: 'online', assets: assets, options: options };
    } catch (e) {
        return { state: 'offline' };
    }
}

// ---------------------------------------------------------------------------
// Dialog (the Affinity equivalent of the Figma plugin's panel)
// ---------------------------------------------------------------------------
// OK sends, Cancel closes. The dialog is modal, so the send runs after it has closed; the chosen
// option values are captured through change handlers WHILE the window is open, because touching
// a control after runModal() has returned crashes Affinity (native dialog already destroyed).
function buildDialog(scopeText, chosen) {
    const dlg = Dialog.create('Quiver');
    const column = dlg.addColumn();
    const info = column.addGroup('Fire towards Cavalry');
    info.addStaticText('Firing', scopeText);
    const opts = column.addGroup('Options');
    dlg.target = opts.addButtonSet('Import into', ['New composition', 'Active composition'], chosen.newComp ? 0 : 1);
    // only meaningful for the active composition, so it is greyed out for a new one (hiding it
    // instead does not resize the window, and the buttons then overlap the switch)
    dlg.matchCompSize = opts.addSwitch('Resize active comp to the spread', chosen.matchCompSize);
    try { dlg.matchCompSize.setIsEnabled(!chosen.newComp); } catch (e0) {}
    dlg.includeImages = opts.addSwitch('Include images and pixel layers', chosen.includeImages);
    // off: brush strokes carry Affinity's render as a mask; on: Cavalry rebuilds the texture on the path
    dlg.nativeBrushes = opts.addSwitch('Rebuild brush textures in Cavalry', chosen.nativeBrushes);
    // everything as Affinity draws it, in one image layer (the two switches above are greyed out)
    dlg.flatImage = opts.addSwitch('Fire rasterised', chosen.flatImage);
    const flatOff = function () { try { dlg.includeImages.setIsEnabled(!chosen.flatImage); dlg.nativeBrushes.setIsEnabled(!chosen.flatImage); } catch (e) {} };
    flatOff();
    dlg.flatImage.setOnValueChangedHandler(function () { try { chosen.flatImage = !!dlg.flatImage.value; } catch (e) {} flatOff(); });
    dlg.target.setOnValueChangedHandler(function () {
        try { chosen.newComp = (dlg.target.selectedIndex === 0); } catch (e) {}
        try { dlg.matchCompSize.setIsEnabled(!chosen.newComp); } catch (e) {}
    });
    dlg.matchCompSize.setOnValueChangedHandler(function () { try { chosen.matchCompSize = !!dlg.matchCompSize.value; } catch (e) {} });
    dlg.includeImages.setOnValueChangedHandler(function () { try { chosen.includeImages = !!dlg.includeImages.value; } catch (e) {} });
    dlg.nativeBrushes.setOnValueChangedHandler(function () { try { chosen.nativeBrushes = !!dlg.nativeBrushes.value; } catch (e) {} });
    addVersionLine(column);
    dlg.initialWidth = 400;
    return dlg;
}
function isOk(result) { return ((result && result.value !== undefined) ? result.value : result) == DialogResult.Ok.value; }
function readOptions(chosen, doc, scope) {
    return {
        includeImages: !!chosen.includeImages,
        nativeBrushes: !!chosen.nativeBrushes,
        flatImage: !!chosen.flatImage,
        matchCompSize: !chosen.newComp && !!chosen.matchCompSize,
        newComp: !!chosen.newComp,
        compName: String(safe(function () { return doc.title; }, 'Affinity')) + (scope === 'selection' ? ' (selection)' : '')
    };
}

// ---------------------------------------------------------------------------
// The send job, split into steps so a progress line can be updated between them.
// ---------------------------------------------------------------------------
function makeJob(doc, roots, scope, extents, dropFolder, options, status, report) {
    __exportImages = options.includeImages;
    __nativeBrushes = !!options.nativeBrushes;
    __nodeCounter = 0; __imageCounter = 0;
    __docProfile = setDocumentProfile(doc);
    const stamp = new Date();
    const pad = function (v) { return (v < 10 ? '0' : '') + v; };
    const baseName = 'affinity_' + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + '_' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + pad(stamp.getSeconds());
    const ctx = { dropFolder: dropFolder, baseName: baseName };
    __sendCtx = ctx;
    const nodes = [];
    const steps = [];
    const total = roots.length;
    if (options.flatImage) steps.push(function () {
        report('Rendering ' + (scope === 'spread' ? 'the spread' : 'the selection') + ' as one image…');
        nodes.push(flatImageNode(doc, roots, scope, extents, ctx));
    });
    else roots.forEach(function (root, i) {
        steps.push(function () {
            report('Reading ' + (i + 1) + ' of ' + total + ': ' + String(safe(function () { return root.description; }, 'layer')) + (__imageCounter ? ' (' + __imageCounter + ' images exported)' : ''));
            const rec = serialiseNode(doc, root, ctx, 0);
            if (rec) nodes.push(rec);
        });
    });
    const state = { jsonPath: null, sent: null, summary: '' };
    steps.push(function () {
        closeArtBrushDoc();
        report('Writing ' + __nodeCounter + ' layers to the inbox…');
        const payload = {
            source: 'affinity',
            format: QUIVER_FORMAT_VERSION,
            app: { name: String(safe(function () { return app.productShortName; }, 'Affinity')), version: String(safe(function () { return app.shortVersion; }, '')) },
            document: {
                title: String(safe(function () { return doc.title; }, '')),
                path: String(safe(function () { return doc.path; }, '')),
                dpi: num(safe(function () { return doc.dpi; }), 72),
                units: enumName(require('/units.js').UnitType || null, safe(function () { return doc.units; })),
                colourProfile: __docProfile, convertedToSrgb: !!__toSrgb
            },
            spread: { x: round(extents.x), y: round(extents.y), width: round(extents.width), height: round(extents.height) },
            frame: frameFor(roots, scope, extents), // positions are relative to this box (an artboard for a selection inside one)
            scope: scope,
            options: options,
            order: 'back-to-front',
            coordinateSpace: 'spread pixels, origin top-left, +y down; world = 2x3 row-major [a,b,tx,c,d,ty]',
            nodes: nodes
        };
        state.jsonPath = dropFolder + '/' + baseName + '.json';
        state.files = payloadImagePaths(nodes, []);
        writeText(state.jsonPath, JSON.stringify(payload));
        state.files.push(state.jsonPath);
        state.summary = __nodeCounter + ' layers, ' + __imageCounter + ' images';
    });
    steps.push(function () {
        report('Firing ' + state.summary + ' towards Cavalry…');
        // a status other than 'online' means "write only" (the headless test runs use it)
        state.sent = (status && status.state === 'online') ? sendToCavalry(state) : { ok: false, status: 0, reason: 'not sent' };
    });
    return { steps: steps, state: state };
}
function payloadImagePaths(nodes, out) {
    (nodes || []).forEach(function (n) {
        if (!n) return;
        if (n.image && n.image.path) out.push(n.image.path);
        [n.fill].concat(n.fills || []).forEach(function (f) { if (f && f.bitmap && f.bitmap.path) out.push(f.bitmap.path); });
        if (n.stroke && n.stroke.brush && n.stroke.brush.path) out.push(n.stroke.brush.path);
        if (n.stroke && n.stroke.artBrush && n.stroke.artBrush.path) out.push(n.stroke.artBrush.path);
        payloadImagePaths(n.children, out);
        (n.enclosures || []).forEach(function (e) { if (e && e.node) payloadImagePaths([e.node], out); });
    });
    return out;
}
function sendToCavalry(state) {
    try { return notifyCavalry(state.jsonPath, state.summary); } catch (eNet) { return { ok: false, status: 0, reason: eNet.message }; }
}
function wasDelivered(sent) { return !!(sent && sent.ok && sent.status >= 200 && sent.status < 300); }
// Cavalry answers a send straight away and imports afterwards (measured: 1 ms, even for a file that
// takes seconds to read), so a failed send never reached it. Offer to send the same files again;
// Cancel removes them so nothing is left behind on the Desktop.
function deliver(job) {
    const s = job.state;
    while (!wasDelivered(s.sent)) {
        console.warn('Quiver: Cavalry did not take the design (' + (s.sent ? s.sent.reason || ('HTTP ' + s.sent.status) : 'not sent') + ').');
        const again = askToTryAgain('Cavalry did not take the design', ['The design is ready to send (' + s.summary + '), but the Quiver panel did not answer.', 'Make sure Cavalry is open with the Quiver panel, then press OK to send it again. Cancel removes the prepared files.']);
        if (!again) {
            (s.files || []).forEach(function (f) { try { if (fs.exists(f)) fs.remove(f); } catch (eRm) {} });
            console.log('Quiver: send cancelled, prepared files removed');
            return;
        }
        s.sent = sendToCavalry(s);
    }
    console.log('Quiver: sent ' + s.summary + ' to Cavalry (' + s.jsonPath + ')');
}

// Run the steps one per timer tick so the dialog can repaint between them.
function runJobAsync(job, onProgress, onDone) {
    let i = 0;
    function tick() {
        if (i >= job.steps.length) { onDone(null); return; }
        try { job.steps[i++](); } catch (e) { onDone(e); return; }
        Timers.setTimeout(0, tick);
    }
    tick();
}
function runJobSync(job) {
    for (let i = 0; i < job.steps.length; i++) job.steps[i]();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function run() {
    const doc = Document.current;
    if (!doc) { app.alert('Open a document first.', 'Quiver'); return; }
    const spread = doc.currentSpread;
    const extents = safe(function () { return spread.getSpreadExtents(); }) || { x: 0, y: 0, width: 1920, height: 1080 };

    let roots = [];
    try { roots = Array.from(doc.selection.nodes); } catch (e) { roots = []; }
    const scope = roots.length ? 'selection' : 'spread';
    if (!roots.length) roots = Array.from(spread.children);
    if (!roots.length) { app.alert('Nothing to send: the spread is empty.', 'Quiver'); return; }

    const status = waitForCavalry(pingCavalry());
    if (!status) return;
    const noFiles = fileAccessMessage(desktopPath(), status);
    if (noFiles) { app.alert(noFiles, 'Quiver setup'); return; }
    const dropFolder = chooseDropFolder(status);
    const frame = frameFor(roots, scope, extents);
    const frameText = frame.kind === 'artboard' ? ' on artboard "' + frame.name + '" (' + frame.width + ' x ' + frame.height + ' px)' : '';
    const count = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); };
    const scopeText = scope === 'selection'
        ? count(roots.length, 'selected layer') + frameText
        : 'Whole spread (' + Math.round(extents.width) + ' x ' + Math.round(extents.height) + ' px, ' + count(roots.length, 'top-level layer') + ')';
    // the dialog opens on the choices of the last send (Cavalry remembers them)
    const last = status.options || {};
    const chosen = { newComp: last.newComp !== false, matchCompSize: !!last.matchCompSize, includeImages: (typeof last.includeImages === 'boolean') ? last.includeImages : EXPORT_IMAGES, nativeBrushes: !!last.nativeBrushes, flatImage: !!last.flatImage };
    const dlg = buildDialog(scopeText, chosen);

    // OK sends, Cancel does nothing. The window is gone once runModal returns, so from here on
    // nothing touches the dialog: the job runs on timer ticks (the UI stays responsive), and a send
    // Cavalry did not take is offered again (see deliver).
    const result = dlg.runModal();
    if (!isOk(result)) return;
    const options = readOptions(chosen, doc, scope);
    const job = makeJob(doc, roots, scope, extents, dropFolder, options, status, function (text) { console.log('Quiver: ' + text); });
    runJobAsync(job, null, function (err) {
        if (err) { closeArtBrushDoc(); reportError(err); return; }
        deliver(job);
    });
}

function reportError(e) {
    const msg = String(e && e.message ? e.message : e);
    let hint = '';
    if (/NOT_ALLOWED|PERMISSION/i.test(msg)) hint = '\n\nThis script needs file system access to your Desktop (and network access to reach Cavalry). Add the Desktop under Affinity > Settings > Scripting > File System Access, or in this script\'s settings in the Scripts panel.';
    else if (/could not open/i.test(msg)) hint = '\n\nCheck that your Desktop is listed under Settings > Scripting > File System Access.';
    console.error('Quiver: ' + msg);
    try { app.alert('Quiver could not run: ' + msg + hint, 'Quiver'); } catch (eAlert) {}
}

function main() {
    try { run(); } catch (e) { reportError(e); }
}

main();
