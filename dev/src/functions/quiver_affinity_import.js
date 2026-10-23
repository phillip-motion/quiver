// --- Quiver: Affinity import (self-contained module) ---
// Receives Quiver JSON written by dev/affinity/quiver-affinity.js and builds
// editable Cavalry layers from it. This module is deliberately isolated from
// the Figma/SVG pipeline: it never calls the SVG parser and runs its own
// WebServer on a separate port. It only CALLS shared helpers (coordinate
// conversion, gradient, filter, blend-mode, image utilities) - it never edits
// them. Removing the api.load line for this file leaves Quiver unchanged.
//
// Coordinate model: Affinity spread pixels are treated exactly like an SVG
// viewBox (origin top-left, +y down), so _affToCavalry() does the flip.
// Every node carries `world`, a 2x3 row-major matrix [a,b,tx,c,d,ty] mapping
// its LOCAL geometry into spread space:  x' = a*x + b*y + tx ; y' = c*x + d*y + ty.

var QUIVER_AFFINITY_PORT = 8767;
var quiverAffinityServer = null;
var __affinityGradientCounter = 0;
var __affinityImageCounter = 0;
var __affinityImportedGroups = [];
var __affinityStats = null;
var __affinityWarnings = [];
var __affNodeIds = {};              // payload node id -> { id, isPath } of the Cavalry layer it became
var __affinityDocTitle = '';
var __affinityImagesIncluded = true;  // false when the Affinity dialog left images and pixel layers out

// Settings (mirrors the Figma settings when they exist)
var affinityMatchCompSize = false; // resize the active comp to the Affinity spread when a whole spread is sent

function _affSetting(name, fallback) {
    try { var v = eval(name); return (v === undefined) ? fallback : v; } catch (e) { return fallback; }
}
function _affWarn(msg) {
    __affinityWarnings.push(msg);
    try { console.warn('🏹 Quiver/Affinity: ' + msg); } catch (e) {}
}
function _affStatus(text) {
    try { if (typeof statusLabel !== 'undefined' && statusLabel && statusLabel.setText) statusLabel.setText(text); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Matrix helpers (Affinity row-major 2x3)
// ---------------------------------------------------------------------------
function _affMat(m) {
    if (!m || m.length < 6) return [1, 0, 0, 0, 1, 0];
    return [m[0], m[1], m[2], m[3], m[4], m[5]];
}
function _affMatMul(A, B) { // apply B first, then A
    return [
        A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2],
        A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]
    ];
}
function _affApply(M, x, y) { return { x: M[0] * x + M[1] * y + M[2], y: M[3] * x + M[4] * y + M[5] }; }
// Decompose into scale / rotation (degrees, y-down, clockwise positive) / skew.
function _affDecompose(M) {
    var a = M[0], b = M[1], c = M[3], d = M[4];
    var sx = Math.sqrt(a * a + c * c);
    var sy = Math.sqrt(b * b + d * d);
    var det = a * d - b * c;
    if (det < 0) sy = -sy;
    var rot = Math.atan2(c, a) * 180 / Math.PI;
    // angle between the two axes minus 90 degrees = skew
    var axisAngle = Math.atan2(d, b) * 180 / Math.PI - rot;
    var skew = 90 - ((axisAngle + 360) % 360);
    if (skew > 180) skew -= 360;
    return { sx: sx, sy: sy, rotation: rot, skew: skew, tx: M[2], ty: M[5] };
}
function _affBoxCorners(box, M) {
    return [
        _affApply(M, box.x, box.y), _affApply(M, box.x + box.w, box.y),
        _affApply(M, box.x + box.w, box.y + box.h), _affApply(M, box.x, box.y + box.h)
    ];
}
function _affBounds(points) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
function _affWorldCentre(node) {
    var box = node.localBox || { x: 0, y: 0, w: 0, h: 0 };
    return _affApply(_affMat(node.world), box.x + box.w / 2, box.y + box.h / 2);
}


// ---------------------------------------------------------------------------
// Local coordinate + path helpers (kept here so this module never depends on
// the SVG parser file). Spread pixels (y down) -> Cavalry (centre origin, y up).
// ---------------------------------------------------------------------------
function _affToCavalry(x, y, vb) {
    return { x: x - (vb.x + vb.width / 2), y: (vb.y + vb.height / 2) - y };
}
// segments: [{cmd:'M'|'L'|'C'|'Z', ...}] in spread space -> editableShape centred on its bbox
function _affBuildEditable(segments, name, parentId, vb) {
    var path = new cavalry.Path();
    for (var i = 0; i < segments.length; i++) {
        var s = segments[i];
        if (s.cmd === 'M') { var m = _affToCavalry(s.x, s.y, vb); path.moveTo(m.x, m.y); }
        else if (s.cmd === 'L') { var l = _affToCavalry(s.x, s.y, vb); path.lineTo(l.x, l.y); }
        else if (s.cmd === 'C') {
            var c1 = _affToCavalry(s.cp1x, s.cp1y, vb), c2 = _affToCavalry(s.cp2x, s.cp2y, vb), e = _affToCavalry(s.x, s.y, vb);
            path.cubicTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
        }
        else if (s.cmd === 'Z') { path.close(); }
    }
    var centre = null;
    try { var bb = path.boundingBox(); if (bb && bb.centre) centre = { x: bb.centre.x, y: bb.centre.y }; } catch (eBB) {}
    if (centre) path.translate(-centre.x, -centre.y);
    var id = api.createEditable(path, name || 'Path');
    if (parentId) api.parent(id, parentId);
    if (centre) api.set(id, { 'position.x': centre.x, 'position.y': centre.y });
    return id;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
function _affHex(c) {
    if (!c) return '#000000';
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v || 0))); var s = v.toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + h(c.r) + h(c.g) + h(c.b);
}
function _affAlpha(c) { return (c && typeof c.a === 'number') ? Math.max(0, Math.min(1, c.a)) : 1; }
// Affinity reports a solid fill's transparency twice (SolidFill.alpha AND the colour's alpha
// carry the same value: a colour at alpha 128 gives fill.alpha 0.502 and colour.a 0.502), so the
// two are combined with min() rather than multiplied. Gradient stops carry their own alpha.
function _affFillAlpha(fill, node) {
    // a gradient's alpha is only its stops' mean (setting it rescales the stops; stops at 54% rendered at 54%, measured
    // 2026-10-18), and the stops already carry it, so it is not applied again
    var a = (fill && fill.type !== 'Gradient' && typeof fill.alpha === 'number') ? fill.alpha : 1;
    if (fill && fill.colour) a = Math.min(a, _affAlpha(fill.colour));
    if (node && typeof node.fillOpacity === 'number') a *= node.fillOpacity;
    return Math.max(0, Math.min(1, a));
}

// Affinity BlendMode enum names -> the SVG names Quiver's blend-mode table understands
var AFFINITY_BLEND_TO_SVG = {
    'Normal': 'normal', 'Multiply': 'multiply', 'Screen': 'screen', 'Overlay': 'overlay',
    'Darken': 'darken', 'Lighten': 'lighten', 'ColourDodge': 'color-dodge', 'ColorDodge': 'color-dodge',
    'ColourBurn': 'color-burn', 'ColorBurn': 'color-burn', 'HardLight': 'hard-light', 'SoftLight': 'soft-light',
    'Difference': 'difference', 'Exclusion': 'exclusion', 'Hue': 'hue', 'Saturation': 'saturation',
    'Colour': 'color', 'Color': 'color', 'Luminosity': 'luminosity', 'Add': 'plus-lighter', 'LinearDodge': 'plus-lighter',
    // Cavalry's "Plus Darker" is max(0, backdrop + source - 1), i.e. Linear Burn: measured on four grey
    // pairs against Affinity's own Linear Burn render, within 2 levels (2026-10-13).
    'LinearBurn': 'plus-darker'
};
// Vivid, Linear and Pin Light are two modes Cavalry has, split at 50% grey: where the layer is darker
// it burns (Colour Burn, Plus Darker, Darken) with twice its value, where lighter it dodges (Colour
// Dodge, Plus Lighter, Lighten) with twice its value minus one, and each half leaves the backdrop as it
// is where the other works. So the layer becomes two copies, each through a Levels filter that keeps
// only its half. Only for a plain layer: a copy would lose effects, masks and clipped layers.
var AFFINITY_SPLIT_BLENDS = { 'VividLight': ['color-burn', 'color-dodge'], 'LinearLight': ['plus-darker', 'plus-lighter'], 'PinLight': ['darken', 'lighten'] };
function _affCanSplitBlend(id, node) {
    return !!(AFFINITY_SPLIT_BLENDS[node.blendMode] && !(node.effects || []).length && !(node.enclosures || []).length && !(__affCompanions[id] || []).length
        && !(node.transparency && node.transparency.type && node.transparency.type !== 'None') && !(node.clipsChildren && node.children && node.children.length));
}
function _affSplitBlend(id, node) {
    var modes = AFFINITY_SPLIT_BLENDS[node.blendMode], name = node.name || 'Layer';
    try {
        // duplicating selects the copy, and new layers are then created in its group (measured): every
        // later layer of the import landed inside this one's group until the selection was put back
        var selection = api.getSelection();
        var lights = api.duplicate(id, true), mode = node.blendMode.replace(/Light$/, ' Light');
        api.select(selection);
        __affCompanions[id] = (__affCompanions[id] || []).concat([lights]); // clips, mattes and erasers reach both copies
        api.rename(lights, name + ' (' + mode + ', lights)');
        api.rename(id, name + ' (' + mode + ', darks)');
        [[id, modes[0], 'inWhite'], [lights, modes[1], 'inBlack']].forEach(function (c) {
            applyBlendMode(c[0], { 'mix-blend-mode': c[1] });
            _affBlendRangeFilter(c[0], node); // reads the layer's own colour, so before the Levels
            var lv = api.create('levels', name + ' (' + (c[0] === id ? 'darks' : 'lights') + ')'), half = { clipBlack: true, clipWhite: true };
            half[c[2]] = 0.5;
            api.set(lv, half);
            api.connect(lv, 'id', c[0], 'filters');
            api.parent(lv, c[0]);
        });
        console.info("🏹 Quiver/Affinity: '" + name + "' " + node.blendMode + " rebuilt from " + modes.join(' and ') + " copies");
        return lights;
    } catch (e) {
        _affWarn("'" + name + "': could not rebuild its " + node.blendMode + " blend (" + e.message + ")");
        return null;
    }
}
// Blend Ranges, "This Layer": the layer's alpha times the range curve at its own luma (Rec.601 of the
// 8-bit colour, straight lines between the points; measured in Affinity to within a level), as an SkSL
// filter. The ranges that read the layers underneath have no Cavalry equivalent.
function _affBlendRangeSksl(pts) {
    var f = function (v) { return (Math.round(v * 10000) / 10000).toFixed(4); };
    var lines = ['// Quiver: Affinity Blend Ranges (This Layer) - alpha scaled by the curve at the layer\'s luma', 'uniform shader layer;', 'half4 main(float2 p) {',
        '  half4 c = layer.eval(p);', '  if (c.a <= 0.0) return c;',
        '  float l = dot(float3(c.rgb) / float(c.a), float3(0.299, 0.587, 0.114)), k = ' + f(pts[0][1]) + ';'];
    for (var i = 0; i + 1 < pts.length; i++) {
        var x0 = pts[i][0], dx = pts[i + 1][0] - x0;
        lines.push('  if (l > ' + f(x0) + ') k = ' + (dx > 1e-6 ? 'mix(' + f(pts[i][1]) + ', ' + f(pts[i + 1][1]) + ', clamp((l - ' + f(x0) + ') / ' + f(dx) + ', 0.0, 1.0))' : f(pts[i + 1][1])) + ';');
    }
    lines.push('  return c * half(k);', '}');
    return lines.join('\n');
}
// Affinity's Black & White, measured on 71 swatches (2026-10-16, exact to the level): grey = min + (mid - min) x
// the weight of the hue the two top channels make (Yellow, Cyan, Magenta) + (max - mid) x the top channel's weight
// (Red, Green, Blue), clipped; the default weights of 1 give max(r, g, b).
function _affBlackWhiteSksl(p) {
    var w = function (k) { return (Math.round((typeof p[k] === 'number' ? p[k] : 1) * 10000) / 10000).toFixed(4); };
    return ['// Quiver: Affinity Black & White', 'uniform shader layer;', 'half4 main(float2 p) {',
        '  half4 c = layer.eval(p);', '  if (c.a <= 0.0) return c;',
        '  float a = float(c.a), r = float(c.r) / a, g = float(c.g) / a, b = float(c.b) / a;',
        '  float mx = max(r, max(g, b)), mn = min(r, min(g, b)), md = r + g + b - mx - mn, wp = ' + w('blue') + ', ws = ' + w('cyan') + ';',
        '  if (r >= g && r >= b) { wp = ' + w('red') + '; ws = g >= b ? ' + w('yellow') + ' : ' + w('magenta') + '; }',
        '  else if (g >= b) { wp = ' + w('green') + '; ws = r >= b ? ' + w('yellow') + ' : ' + w('cyan') + '; }',
        '  else { ws = r >= g ? ' + w('magenta') + ' : ' + w('cyan') + '; }',
        '  float k = clamp(mn + (md - mn) * ws + (mx - md) * wp, 0.0, 1.0) * a;',
        '  return half4(half(k), half(k), half(k), c.a);', '}'].join('\n');
}
// Affinity's Brightness / Contrast (non-linear), measured on greys 5 apart for 13 settings (2026-10-16, within a
// level): brightness b bends each channel to 1 - (1 - x)^K with K = (1 + 0.6b) / (1 - 0.6b), then contrast c
// applies an S-curve about the middle, 0.5 (2x)^K below it and its mirror above, with K = 1 + c (c >= 0) or
// 1 / (1 - c) (c < 0).
function _affBrightnessContrastSksl(b, c) {
    var f = function (v) { return (Math.round(v * 100000) / 100000).toFixed(5); };
    var kb = (1 + 0.6 * b) / (1 - 0.6 * b), kc = c >= 0 ? 1 + c : 1 / (1 - c);
    return ['// Quiver: Affinity Brightness / Contrast', 'uniform shader layer;',
        'float bc(float x) {', '  x = 1.0 - pow(max(1.0 - x, 0.0), ' + f(kb) + ');',
        '  return x < 0.5 ? 0.5 * pow(max(2.0 * x, 0.0), ' + f(kc) + ') : 1.0 - 0.5 * pow(max(2.0 * (1.0 - x), 0.0), ' + f(kc) + ');', '}',
        'half4 main(float2 p) {', '  half4 c = layer.eval(p);', '  if (c.a <= 0.0) return c;',
        '  float a = float(c.a);',
        '  return half4(half(bc(float(c.r) / a) * a), half(bc(float(c.g) / a) * a), half(bc(float(c.b) / a) * a), c.a);', '}'].join('\n');
}
// Affinity's fill Noise (the colour or gradient Noise slider), measured 2026-10-16 on greys and colours: per pixel the
// same offset on R, G and B, uniform, standard deviation 84 levels x Noise (0.13 -> 10.9, 0.25 -> 21, 0.5 -> 42), the same
// over black and white (colour noise, not opacity). Cavalry's Grain grows its cell with the layer's height and a gradient
// stop's Jitter moves along the gradient (so it scales with the stops' colours and skips solid fills), hence SkSL with the
// amount on input n0.
var AFFINITY_NOISE_SKSL = ['// Quiver: Affinity fill noise (n0 = Noise, 0 to 1)', 'uniform shader layer;',
    'float h(float2 q) { float3 p3 = fract(float3(q.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'half4 main(float2 p) {', '  half4 c = layer.eval(p);', '  if (c.a <= 0.0) return c;',
    '  float a = float(c.a), n = (h(floor(p)) - 0.5) * 1.1412 * float(n0);',
    '  return half4(half3(clamp(float3(c.rgb) / a + n, 0.0, 1.0) * a), c.a);', '}'].join('\n');
function _affFillNoise(id, node) {
    var f = node.fill;
    if (!f || !(f.noise > 0)) return;
    try {
        var k = api.create('skslFilter', (node.name || 'Layer') + ' noise');
        api.set(k, { code: AFFINITY_NOISE_SKSL });
        api.set(k, { 'inputs.0': f.noise });
        api.connect(k, 'id', id, 'filters');
        api.parent(k, id);
    } catch (e) { _affWarn("'" + node.name + "': could not add its fill noise (" + e.message + ")"); }
}
function _affReportBlendRanges(node) {
    var br = node.blendRanges;
    if (!br) return;
    var where = "'" + (node.name || 'Layer') + "': ";
    if (br.underlying || (br.channels && br.channels.length)) _affWarn(where + "Blend Ranges that read the layers underneath (or single channels) have no Cavalry equivalent and were left out");
    if (br.source && (node.kind === 'group' || node.kind === 'container')) _affWarn(where + "Blend Ranges on a group were left out (a Cavalry filter on a group runs on each layer inside it)");
    else if (br.source && br.sourceLinear === false) _affWarn(where + "its curved Blend Ranges are drawn with straight lines between their points");
}
function _affBlendRangeFilter(id, node) {
    var br = node.blendRanges;
    if (!br || !br.source || br.source.length < 2) return null;
    try {
        var f = api.create('skslFilter', (node.name || 'Layer') + ' blend ranges');
        api.set(f, { code: _affBlendRangeSksl(br.source) });
        api.connect(f, 'id', id, 'filters');
        api.parent(f, id);
        return f;
    } catch (e) { _affWarn("'" + (node.name || 'Layer') + "': could not apply its Blend Ranges (" + e.message + ")"); return null; }
}
function _affApplyBlend(id, blendName) {
    if (!blendName || blendName === 'Normal' || blendName === 'Passthrough') return;
    if (blendName === 'Erase') return; // a knockout on its clipping parent, or inverted mattes below it (_affApplyErasers)
    // Divide (backdrop / layer) is exactly Colour Dodge of the inverted layer: the layer then gets an Invert
    // filter after its own filters (_affDivideInvert). A group's filters run on each layer inside, so not on groups.
    var svgName = (blendName === 'Divide' && api.getLayerType(id) !== 'group') ? 'color-dodge' : AFFINITY_BLEND_TO_SVG[blendName];
    if (!svgName) { _affWarn("blend mode '" + blendName + "' has no Cavalry equivalent"); return; }
    try { applyBlendMode(id, { 'mix-blend-mode': svgName }); } catch (e) {}
}
// Measured against Affinity's Divide on 5 colour pairs, half opacity and zero channels included: within a level.
function _affDivideInvert(id, node) {
    if (node.blendMode !== 'Divide') return;
    var inv = _affMakeFilter('invert', (node.name || 'Layer') + ' (Divide)');
    if (!inv) { _affWarn("'" + node.name + "': could not rebuild its Divide blend"); return; }
    try { api.connect(inv, 'id', id, 'filters'); api.parent(inv, id); } catch (e) { _affWarn("'" + node.name + "': could not rebuild its Divide blend (" + e.message + ")"); }
}
function _affApplyOpacity(id, node) {
    if (typeof node.opacity === 'number' && node.opacity < 0.999) {
        try { api.set(id, { 'opacity': Math.round(node.opacity * 1000) / 10 }); } catch (e) {}
    }
}

// ---------------------------------------------------------------------------
// Fills
// ---------------------------------------------------------------------------
function _affSvgMatrix(M) { // Affinity row-major -> SVG matrix(a b c d e f)
    return 'matrix(' + M[0] + ' ' + M[3] + ' ' + M[1] + ' ' + M[4] + ' ' + M[2] + ' ' + M[5] + ')';
}
// Cavalry's gradient shader does not interpolate stops linearly in sRGB: measured on white->black,
// grey->black and white->grey ramps (2026-10-09), the ramp follows a gamma of about 1.2 (the middle
// of a white->black ramp lands at 139, not 128, and the dark end falls off steeply). Affinity
// interpolates linearly in 8-bit sRGB, so a segment whose two ends would drift more than a few
// levels apart is subdivided with linearly interpolated stops; shallow ramps stay as they are.
var AFFINITY_GRADIENT_INTERP_GAMMA = 1.2;
var AFFINITY_GRADIENT_MAX_DRIFT = 4; // levels of 255
function _affGradientDrift(c0, c1) {
    var g = AFFINITY_GRADIENT_INTERP_GAMMA, worst = 0;
    ['r', 'g', 'b'].forEach(function (k) {
        var a = c0[k] / 255, b = c1[k] / 255;
        var cav = Math.pow((Math.pow(a, g) + Math.pow(b, g)) / 2, 1 / g);
        worst = Math.max(worst, Math.abs(cav - (a + b) / 2) * 255);
    });
    return worst;
}
function _affStopsToQuiver(fill) {
    var src = (fill.stops || []).slice().sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    var pts = src.map(function (s) {
        return { offset: Math.max(0, Math.min(1, s.position || 0)), midpoint: (typeof s.midpoint === 'number' && s.midpoint > 0 && s.midpoint < 1) ? s.midpoint : 0.5, colour: s.colour || { r: 0, g: 0, b: 0, a: 1 } };
    });
    var out = [];
    var push = function (offset, colour) { out.push({ offset: Math.round(offset * 10000) / 10000, color: _affHex(colour), opacity: _affAlpha(colour) }); };
    var alphaOf = function (c) { return (typeof c.a === 'number') ? c.a : 1; };
    var lerp = function (c0, c1, t) { return { r: c0.r + (c1.r - c0.r) * t, g: c0.g + (c1.g - c0.g) * t, b: c0.b + (c1.b - c0.b) * t, a: alphaOf(c0) + (alphaOf(c1) - alphaOf(c0)) * t }; };
    // one straight run from (o0,c0) to (o1,c1), split until Cavalry's curve stays within the drift budget
    var run = function (o0, c0, o1, c1) {
        var worst = function (n) { var w = 0; for (var k = 0; k < n; k++) w = Math.max(w, _affGradientDrift(lerp(c0, c1, k / n), lerp(c0, c1, (k + 1) / n))); return w; };
        var pieces = 1;
        while (pieces < 8 && worst(pieces) > AFFINITY_GRADIENT_MAX_DRIFT) pieces++;
        for (var k = 1; k < pieces; k++) push(o0 + (o1 - o0) * k / pieces, lerp(c0, c1, k / pieces));
        push(o1, c1);
    };
    for (var i = 0; i < pts.length; i++) {
        var cur = pts[i];
        if (i === 0) push(cur.offset, cur.colour);
        if (i === pts.length - 1) break;
        var next = pts[i + 1];
        var span = next.offset - cur.offset;
        if (span <= 1e-6) { push(next.offset, next.colour); continue; }
        if (Math.abs(cur.midpoint - 0.5) > 0.01) {
            // Affinity's midpoint bends the run to t^(1 + 8(m - 0.5)), mirrored below 0.5 (measured on black-white
            // ramps at seven midpoints, 2026-10-17, within a level); straight pieces short enough to follow it
            var m = cur.midpoint, p = 1 + 8 * Math.abs(m - 0.5);
            var bend = function (t) { return m >= 0.5 ? Math.pow(t, p) : 1 - Math.pow(1 - t, p); };
            var n = Math.max(2, Math.ceil(Math.sqrt(p * (p - 1) * 255 / 8)));
            for (var k = 0; k < n; k++) run(cur.offset + span * k / n, lerp(cur.colour, next.colour, bend(k / n)), cur.offset + span * (k + 1) / n, lerp(cur.colour, next.colour, bend((k + 1) / n)));
        } else {
            run(cur.offset, cur.colour, next.offset, next.colour);
        }
    }
    if (out.length === 1) out.push({ offset: 1, color: out[0].color, opacity: out[0].opacity });
    return out;
}
// Builds a Cavalry gradient shader for an Affinity gradient fill and returns its id. `G` maps the
// gradient's unit space to a y-down frame and `centre` is the point of that frame that sits at the
// shader's origin (the host shape's centre). A layer's own fill uses the spread as the frame; a
// fill layer attached to a host layer passes the host's local frame instead. Linear / Radial /
// Elliptical go through Quiver's SVG gradient builder as userSpaceOnUse gradients; Conical becomes
// a sweep gradient.
function _affGradientShaderInFrame(fill, G, centre) {
    if (!_affSetting('importGradientsEnabled', true)) return null;
    var stops = _affStopsToQuiver(fill);
    var gid = 'affinity_gradient_' + (++__affinityGradientCounter);
    var type = fill.gradientType || 'Linear';
    var gradientData;
    // Affinity's gradient unit space runs 0..1 along x: unit (0,0) is the START
    // point and (1,0) the END point (verified against Affinity's own render).
    if (type === 'Linear') {
        var p1 = _affApply(G, 0, 0), p2 = _affApply(G, 1, 0);
        gradientData = { type: 'linear', id: gid, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stops: stops, gradientUnits: 'userSpaceOnUse',
            _absoluteCenterX: (p1.x + p2.x) / 2, _absoluteCenterY: (p1.y + p2.y) / 2, _isAbsoluteCoords: true };
    } else if (type === 'Radial' || type === 'Elliptical') {
        var c0 = _affApply(G, 0, 0);
        gradientData = { type: 'radial', id: gid, cx: 0, cy: 0, r: 0.5, fx: 0, fy: 0, stops: stops, gradientUnits: 'userSpaceOnUse',
            transform: _affSvgMatrix(G), _absoluteCenterX: c0.x, _absoluteCenterY: c0.y, _isAbsoluteCoords: true };
    } else if (type === 'Conical') {
        return _affCreateSweepShader(fill, G, stops, centre);
    } else {
        _affWarn("gradient type '" + type + "' not supported, using first stop colour");
        return null;
    }
    try { __svgGradientMap[gid] = gradientData; } catch (e) {}
    var shaderId = null;
    try { shaderId = createGradientShader(gradientData); } catch (eCreate) { shaderId = null; }
    // the shared connectShaderToShape re-derives a radial's scale and rotation from this gradient's SVG data in Bounding
    // Box terms (blind to skew), so a radial stays out of its lookup and is placed here instead
    if (shaderId && type === 'Linear') { try { __svgGradientCache[gid] = shaderId; } catch (e2) {} }
    else if (shaderId) _affPlaceRadial(shaderId, G, centre);
    return shaderId;
}
// Cavalry's radial (measured 2026-10-17): in Fixed Radius mode the last stop sits at `radius` px, `scale` stretches the
// gradient's own x and y (150 x 100 drew an exact 1.5 : 1 ellipse) and `rotation` then turns it anticlockwise on screen;
// the offset is the centre's distance from the shape's centre, +y up. Affinity's unit circle maps through G to an ellipse
// whose axes are G's singular vectors, so a turned gradient on a stretched layer (a skewed G, which the shared SVG builder
// read as half the size, turned 50 degrees off) is placed from those.
function _affPlaceRadial(shaderId, G, centre) {
    var a = G[0], b = G[1], c = G[3], d = G[4];
    var E = (a + d) / 2, F = (a - d) / 2, P = (c + b) / 2, H = (c - b) / 2;
    var Q = Math.sqrt(E * E + H * H), R = Math.sqrt(F * F + P * P), major = Q + R, minor = Math.abs(Q - R);
    if (!(major > 0 && minor > 0)) return;
    var phi = (Math.atan2(H, E) + Math.atan2(P, F)) / 2; // the major axis, y-down radians
    var c0 = _affApply(G, 0, 0);
    try {
        api.set(shaderId, { 'generator.radiusMode': 0, 'generator.radius': minor, 'generator.scale': [major / minor * 100, 100], 'generator.rotation': -phi * 180 / Math.PI,
            'generator.radiusRatio': 1, 'generator.offset': [c0.x - centre.x, -(c0.y - centre.y)] });
    } catch (e) { _affWarn('could not place a radial gradient: ' + e.message); }
}
// Where a layer's gradient is laid out: a primitive carries its own rotation (and the shader turns with
// it), so its gradient goes into the primitive's frame, as on fill layers; a path keeps spread space.
// Without that a rectangle turned 180 degrees got its gradient the right way up (measured).
function _affGradientPlace(fill, node, hostId, created, vb) {
    var G = _affMatMul(_affMat(node.world), _affMat(fill.transform)); // gradient unit space -> spread
    var hf = (hostId && created && !created.isPath && !created.isText) ? _affHostFrame(hostId, node, false, vb) : null;
    return hf ? { G: _affMatMul(hf.frame, G), centre: hf.centre } : { G: G, centre: _affWorldCentre(node) };
}
function _affCreateGradientShader(fill, node, place) {
    place = place || _affGradientPlace(fill, node);
    return _affGradientShaderInFrame(fill, place.G, place.centre);
}
function _affCreateSweepShader(fill, G, stops, centre) {
    try {
        var first = stops[0], last = stops[stops.length - 1];
        var shaderId = api.create('gradientShader', 'Sweep ' + first.color.toUpperCase() + ' → ' + last.color.toUpperCase());
        try { api.setGenerator(shaderId, 'generator', 'sweepGradientShader'); } catch (eGen) {}
        var colors = stops.map(function (s) { return s.color; });
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        for (var i = 0; i < stops.length; i++) {
            var posAttr = {}; posAttr['generator.gradient.' + i + '.position'] = stops[i].offset;
            try { api.set(shaderId, posAttr); } catch (ePos) {}
            var colAttr = {}; colAttr['generator.gradient.' + i + '.color'] = colorWithOpacity(stops[i].color, stops[i].opacity);
            try { api.set(shaderId, colAttr); } catch (eCol) {}
        }
        // The sweep's seam (position 0 meets 1) sits along the gradient's x axis (unit 0 -> 1).
        // Cavalry's sweep starts at 12 o'clock and `generator.rotation` turns it anticlockwise on
        // screen: measured seam = 270 - rotation in y-down degrees (rotations 150/210/270 gave
        // seams at 120/60/0 on 2026-10-13), so the rotation that lands the seam on Affinity's
        // start ray at y-down angle a is 270 - a.
        var c0 = _affApply(G, 0, 0), c1 = _affApply(G, 1, 0);
        var angle = Math.atan2(c1.y - c0.y, c1.x - c0.x) * 180 / Math.PI;
        try { api.set(shaderId, { 'generator.rotation': 270 - angle }); } catch (eRot) {}
        // Affinity sweeps CLOCKWISE on screen from the start direction (verified 2026-10-12 on a fill
        // layer set to a known conical: white just clockwise of the 40-degree ray); Cavalry's sweep
        // runs the other way, so the stop order is reversed to keep the seam in place.
        try { api.set(shaderId, { 'reverse': true }); } catch (eRev) {}
        try { api.set(shaderId, { 'generator.offset': [c0.x - centre.x, -(c0.y - centre.y)] }); } catch (eOff) {}
        return shaderId;
    } catch (e) {
        _affWarn('could not build sweep gradient: ' + e.message);
        return null;
    }
}

// Affinity's bitmap fill: the pattern spans -1..1 of the space its transform places in the layer's
// local space, centred on that space's origin (measured: a 64 px pattern under a 96x scale repeated every
// 192 px, and with Zero extend it covered the corner around the origin), extended Zero (transparent),
// Repeat (edge pixels), Wrap (tiled) or Mirror. An image shader
// draws the pattern file at its own size (Scale Mode None), placed by that transform in the host's
// frame, with the matching tiling (verified on a scripted doc against Affinity's render).
var AFFINITY_EXTEND_TO_TILING = { 'Zero': 3, 'Repeat': 0, 'Wrap': 1, 'Mirror': 2 };
function _affBitmapFillShader(hostId, node, fill, created, vb, label) {
    if (!created || !fill || !fill.bitmap || !fill.bitmap.path) return null;
    var hf = _affHostFrame(hostId, node, !!created.isPath, vb);
    if (!hf) return null;
    var M = _affMatMul(_affMatMul([1, 0, -hf.centre.x, 0, 1, -hf.centre.y], hf.frame), _affMatMul(_affMat(node.world), _affMat(fill.transform)));
    var lx = Math.sqrt(M[0] * M[0] + M[3] * M[3]), ly = Math.sqrt(M[1] * M[1] + M[4] * M[4]);
    if (!(lx > 0 && ly > 0)) return null;
    if ((M[0] * M[4] - M[1] * M[3]) < 0 || Math.abs(M[0] * M[1] + M[3] * M[4]) > 1e-3 * lx * ly) _affWarn("'" + node.name + "': its pattern fill is mirrored or skewed; placed without that");
    var shaderNode = _affImageShader({ name: (node.name || 'Shape') + ' pattern', image: {} }, fill.bitmap.path, label);
    if (!shaderNode) return null;
    try {
        api.setFill(hostId, true);
        api.connect(shaderNode, 'id', hostId, 'material.colorShaders');
        api.parent(shaderNode, hostId);
        var res = null;
        try { res = api.get(shaderNode, 'outResolution'); } catch (eRes) { res = null; }
        var fw = (res && res.x > 0) ? res.x : fill.bitmap.width, fh = (res && res.y > 0) ? res.y : fill.bitmap.height;
        var c = _affApply(M, 0, 0);
        var tiling = AFFINITY_EXTEND_TO_TILING[fill.extend];
        if (tiling === undefined) tiling = 1;
        var attrs = { 'scaleMode': 0, 'scale.x': 2 * lx / fw, 'scale.y': 2 * ly / fh, 'offset.x': c.x, 'offset.y': -c.y, 'tilingX': tiling, 'tilingY': tiling };
        var rot = Math.atan2(M[3], M[0]) * 180 / Math.PI;
        if (Math.abs(rot) > 0.01) attrs.rotation = -rot;
        api.set(shaderNode, attrs);
        return shaderNode;
    } catch (e) {
        try { api.deleteLayer(shaderNode); } catch (eDel) {}
        _affWarn("'" + node.name + "': could not place its pattern fill (" + e.message + ")");
        return null;
    }
}
function _affApplyFill(id, node, rotationDeg, created, vb) {
    var fill = node.fill;
    if (!fill || fill.type === 'None') { try { api.setFill(id, false); } catch (e) {} return; }
    var alpha = _affFillAlpha(fill, node);
    if (fill.type === 'Solid') {
        try {
            api.setFill(id, true);
            api.set(id, { 'material.materialColor': _affHex(fill.colour), 'material.alpha': Math.round(alpha * 1000) / 10 });
        } catch (e) {}
        return;
    }
    if (fill.type === 'Gradient') {
        var place = _affGradientPlace(fill, node, id, created, vb);
        var shaderId = _affCreateGradientShader(fill, node, place);
        if (shaderId) {
            var centre = place.centre;
            try { connectShaderToShape(shaderId, id, { x: centre.x, y: centre.y }, alpha, 1, rotationDeg || 0); } catch (eConn) {}
            try { api.parent(shaderId, id); } catch (ePar) {}
            _affApplyShaderBlend(shaderId, fill.blendMode);
            return;
        }
        // fall back to the first stop colour
        var stops = _affStopsToQuiver(fill);
        try { api.setFill(id, true); api.set(id, { 'material.materialColor': stops[0].color, 'material.alpha': Math.round(alpha * stops[0].opacity * 1000) / 10 }); } catch (e3) {}
        return;
    }
    if (fill.type === 'Bitmap') {
        var bm = _affBitmapFillShader(id, node, fill, created, vb, (node.name || 'Shape') + ' pattern');
        if (bm) {
            try { api.set(id, { 'material.materialColor.a': 0, 'material.alpha': Math.round(alpha * 1000) / 10 }); } catch (eBa) {}
            _affApplyShaderBlend(bm, fill.blendMode);
            return;
        }
    }
    // Mesh / Hatch / Diffusion: no Cavalry equivalent yet
    _affWarn("fill type '" + fill.type + "' on '" + node.name + "' is not supported, using a neutral grey");
    try { api.setFill(id, true); api.set(id, { 'material.materialColor': '#808080', 'material.alpha': Math.round(alpha * 100) }); } catch (e4) {}
}
function _affApplyShaderBlend(shaderId, blendName) {
    if (!blendName || blendName === 'Normal') return;
    var svgName = AFFINITY_BLEND_TO_SVG[blendName];
    if (svgName && typeof applyShaderBlendMode === 'function') { try { applyShaderBlendMode(shaderId, svgName); } catch (e) {} }
}

// ---------------------------------------------------------------------------
// Strokes
// ---------------------------------------------------------------------------
var AFFINITY_CAP = { 'Butt': 0, 'Flat': 0, 'Round': 1, 'Square': 2, 'Projecting': 2 };
var AFFINITY_JOIN = { 'Miter': 0, 'Mitre': 0, 'Round': 1, 'Bevel': 2 };
var AFFINITY_ALIGN = { 'Centre': 0, 'Center': 0, 'Inside': 1, 'Inner': 1, 'Outside': 2, 'Outer': 2 };
function _affDashString(stroke) {
    if (!stroke.dashPattern || !stroke.dashPattern.length || stroke.lineType !== 'Dash') return null;
    // Affinity cycles through ALL pattern values (dash, gap, dash, gap, ...) as
    // multiples of the stroke width; zero-length gaps merge neighbouring dashes.
    // Measured: [1,1,1,0,1,0] at 5.5px renders dash 3w / gap 1w.
    var parts = [];
    var anyGap = false;
    for (var i = 0; i < stroke.dashPattern.length; i++) {
        var v = Math.max(0, stroke.dashPattern[i]) * stroke.weight;
        if (i % 2 === 1 && v > 0) anyGap = true;
        parts.push(Math.round(v * 1000) / 1000);
    }
    if (parts.length % 2 === 1) parts.push(0);
    return anyGap ? parts.join(',') : null;
}
function _affApplyStroke(id, node, created, vb) {
    var stroke = node.stroke;
    if (!stroke || !stroke.fill || stroke.weight <= 0) { try { api.setStroke(id, false); } catch (e) {} return; }
    try { api.setStroke(id, true); } catch (e0) {}
    // a brush mask carries the brush's own width profile, so the stroke only has to cover it
    var brush = !!(stroke.brush && created && vb), nativeBrush = !!stroke.brushNative;
    if (stroke.artBrush && created && _affApplyArtBrush(id, node, vb)) return; // the strip carries width, pressure and colour
    if (stroke.fill.type === 'None' && !(brush && stroke.brush.image)) {
        try { api.setStroke(id, false); } catch (eNo) {}
        if (stroke.imageBrush) _affWarn("'" + node.name + "': its image brush could not be carried (" + (stroke.brushSkipped || 'no texture was sent') + ")");
        return;
    }
    var attrs = { 'stroke.width': brush ? stroke.weight * 1.15 : stroke.weight };
    if (AFFINITY_CAP[stroke.cap] !== undefined) attrs['stroke.capStyle'] = AFFINITY_CAP[stroke.cap];
    if (AFFINITY_JOIN[stroke.join] !== undefined) attrs['stroke.joinStyle'] = AFFINITY_JOIN[stroke.join];
    if (AFFINITY_ALIGN[stroke.align] !== undefined) attrs['stroke.align'] = AFFINITY_ALIGN[stroke.align];
    if (typeof stroke.miterLimit === 'number') attrs['stroke.miter'] = stroke.miterLimit;
    try { api.set(id, attrs); } catch (eA) {
        for (var k in attrs) { var one = {}; one[k] = attrs[k]; try { api.set(id, one); } catch (eOne) {} }
    }
    var dash = _affDashString(stroke);
    if (dash) { try { api.set(id, { 'stroke.dashPattern': dash, 'stroke.dashPatternMode': 0 }); } catch (eD) {} }
    if (stroke.pressure && !brush && !nativeBrush) _affApplyPressure(id, 'stroke.', stroke, node.name); // a rebuilt brush brings its measured taper
    var pen = stroke.fill;
    var alpha = _affFillAlpha(pen); // a pen reports its alpha twice too (measured: 0.502 and 128)
    if (pen.type === 'Solid') {
        try { api.set(id, { 'stroke.strokeColor': _affHex(pen.colour), 'stroke.alpha': Math.round(alpha * 1000) / 10 }); } catch (eC) {}
    } else if (pen.type === 'Gradient') {
        var place = _affGradientPlace(pen, node, id, created, vb);
        var shaderId = _affCreateGradientShader(pen, node, place);
        if (shaderId) {
            var centre = place.centre;
            try { connectShaderToStroke(shaderId, id, { x: centre.x, y: centre.y }); } catch (eCS) {}
            try { api.set(id, { 'stroke.alpha': Math.round(alpha * 1000) / 10 }); } catch (eSA) {}
            try { api.parent(shaderId, id); } catch (ePar) {}
        } else {
            var stops = _affStopsToQuiver(pen);
            try { api.set(id, { 'stroke.strokeColor': stops[0].color }); } catch (eF) {}
        }
    }
    if (brush) {
        if (stroke.brush.fallback) __affBrushFallbacks.push(stroke.brush.fallback);
        if (_affApplyBrushMask(id, node, !!created.isPath, vb) && !stroke.brush.opaque) { try { api.set(id, { 'stroke.alpha': 100 }); } catch (eBA) {} } // before 0.42 the mask held the pen's alpha
        else { try { api.set(id, { 'stroke.width': stroke.weight }); } catch (eBW) {} if (stroke.pressure) _affApplyPressure(id, 'stroke.', stroke, node.name); }
    } else if (nativeBrush) {
        if (!_affApplyBrushNative(id, node)) { try { api.set(id, { 'stroke.width': stroke.weight }); } catch (eNW) {} if (stroke.pressure) _affApplyPressure(id, 'stroke.', stroke, node.name); }
    } else if (stroke.brushSkipped) _affWarn("'" + node.name + "': brush texture not carried (" + stroke.brushSkipped + "), drawn as a plain stroke");
}

// ---------------------------------------------------------------------------
// Layer colour tags, locks, extra fills and strokes
// ---------------------------------------------------------------------------

// Affinity tag colours are free RGB values; Cavalry layer colours are named. Pick the
// nearest name by hue (greys by lightness).
var AFFINITY_TAG_HUES = [['Red', 0], ['Orange', 35], ['Yellow', 60], ['Green', 120], ['Cyan', 180], ['Blue', 235], ['Purple', 275], ['Magenta', 305], ['Pink', 335], ['Red', 360]];
function _affTagName(c) {
    if (!c || typeof c.r !== 'number') return null;
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var sat = max > 0 ? d / max : 0;
    if (sat < 0.2) return max < 0.2 ? 'Black' : (max > 0.85 ? 'White' : 'Grey');
    var h = 0;
    if (d > 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    var best = null, bestD = 1e9;
    for (var i = 0; i < AFFINITY_TAG_HUES.length; i++) {
        var dd = Math.abs(AFFINITY_TAG_HUES[i][1] - h);
        if (dd < bestD) { bestD = dd; best = AFFINITY_TAG_HUES[i][0]; }
    }
    return best;
}
// Applied last: a locked Cavalry layer still accepts api.set, but keeping it last mirrors the
// import order and keeps the lock visible in the Layers panel as the final state.
function _affApplyMeta(id, node) {
    if (!id || !node) return;
    var tag = _affTagName(node.tagColour);
    if (tag) { try { api.set(id, { 'color': tag }); } catch (eT) {} }
    if (node.locked === true) { try { api.set(id, { 'locked': true }); } catch (eL) {} }
}

// Fills after the first stack as colour shaders over the base fill (Cavalry composites
// material.colorShaders over material.materialColor; a shader's own colour alpha blends
// it - verified: red base + blue shader at alpha 128 renders (139,0,140)).
function _affApplyExtraFills(id, node, rotationDeg, created, vb) {
    var fills = node.fills;
    if (!fills || fills.length < 2) return;
    for (var i = 1; i < fills.length; i++) {
        var fill = fills[i];
        if (!fill || fill.type === 'None') continue;
        var alpha = _affFillAlpha(fill, node);
        var label = (node.name || 'Fill') + ' fill ' + (i + 1);
        try {
            if (fill.type === 'Solid') {
                var sh = api.create('colorShader', label);
                api.set(sh, { 'shaderColor': _affHex(fill.colour) });
                api.set(sh, { 'shaderColor.a': Math.round(Math.max(0, Math.min(1, alpha)) * 255) });
                api.connect(sh, 'id', id, 'material.colorShaders');
                api.parent(sh, id);
                _affApplyShaderBlend(sh, fill.blendMode);
            } else if (fill.type === 'Gradient') {
                var baseA = null; try { baseA = api.get(id, 'material.materialColor.a'); } catch (eGa) {}
                var place = _affGradientPlace(fill, node, id, created, vb);
                var shaderId = _affCreateGradientShader(fill, node, place);
                if (shaderId) {
                    var centre = place.centre;
                    try { connectShaderToShape(shaderId, id, { x: centre.x, y: centre.y }, alpha, 1, rotationDeg || 0); } catch (eConn) {}
                    try { api.parent(shaderId, id); } catch (ePar) {}
                    try { api.set(shaderId, { 'niceName': label }); } catch (eN) {}
                    _affApplyShaderBlend(shaderId, fill.blendMode);
                    // connectShaderToShape hides the base colour; the base fill must stay visible underneath
                    if (typeof baseA === 'number') { try { api.set(id, { 'material.materialColor.a': baseA }); } catch (eRa) {} }
                }
            } else if (fill.type === 'Bitmap' && _affBitmapFillShader(id, node, fill, created, vb, label)) {
                var bmx = api.getInConnectedAttributes(id).filter(function (a) { return /^material\.colorShaders\.\d+\.shader$/.test(a); });
                var bmLast = bmx.length ? api.getInConnection(id, bmx[bmx.length - 1]).split('.')[0] : null;
                if (bmLast) { try { api.set(bmLast, { 'alpha': Math.round(Math.max(0, Math.min(1, alpha)) * 1000) / 10 }); } catch (eBx) {} _affApplyShaderBlend(bmLast, fill.blendMode); }
            } else {
                _affWarn("fill " + (i + 1) + " ('" + fill.type + "') on '" + node.name + "' is not supported and was skipped");
            }
        } catch (eF) { _affWarn("could not add fill " + (i + 1) + " to '" + node.name + "': " + eF.message); }
    }
}

// A stroke material connected to `multiStroke` draws on top of the layer's own stroke.
function _affMakeStrokeMaterial(id, name, stroke, node) {
    var sm = api.create('strokeMaterial', name);
    var attrs = { 'width': stroke.weight };
    if (AFFINITY_CAP[stroke.cap] !== undefined) attrs['capStyle'] = AFFINITY_CAP[stroke.cap];
    if (AFFINITY_JOIN[stroke.join] !== undefined) attrs['joinStyle'] = AFFINITY_JOIN[stroke.join];
    if (AFFINITY_ALIGN[stroke.align] !== undefined) attrs['align'] = AFFINITY_ALIGN[stroke.align];
    if (typeof stroke.miterLimit === 'number') attrs['miter'] = stroke.miterLimit;
    try { api.set(sm, attrs); } catch (eA) { for (var k in attrs) { var one = {}; one[k] = attrs[k]; try { api.set(sm, one); } catch (eOne) {} } }
    var dash = _affDashString(stroke);
    if (dash) { try { api.set(sm, { 'dashPattern': dash, 'dashPatternMode': 0 }); } catch (eD) {} }
    if (stroke.pressure) _affApplyPressure(sm, '', stroke, name);
    var pen = stroke.fill || {};
    var alpha = _affFillAlpha(pen); // a pen reports its alpha twice too (measured: 0.502 and 128)
    if (pen.type === 'Gradient') {
        var shaderId = _affCreateGradientShader(pen, node);
        if (shaderId) {
            try { api.set(sm, { 'strokeColor.a': 0 }); api.connect(shaderId, 'id', sm, 'colorShaders'); api.parent(shaderId, sm); } catch (eG) {}
        } else {
            var stops = _affStopsToQuiver(pen);
            try { api.set(sm, { 'strokeColor': stops[0].color }); } catch (eS) {}
        }
        try { api.set(sm, { 'alpha': Math.round(alpha * 1000) / 10 }); } catch (eSA) {}
    } else {
        try { api.set(sm, { 'strokeColor': _affHex(pen.colour), 'alpha': Math.round(alpha * 1000) / 10 }); } catch (eC) {}
    }
    api.connect(sm, 'id', id, 'multiStroke');
    try { api.parent(sm, id); } catch (eP) {}
    return sm;
}
// Affinity's Gradient Overlay paints its gradient over the whole layer, fill and stroke, across the
// layer's visible box (stroke included; measured: the ramp ran from the stroke's outer top edge to its
// outer bottom edge) at the effect's opacity and blend mode. Cavalry's Fill Color filter is solid only,
// so the gradient is stacked as a shader on the fill and on the stroke, base colours kept underneath.
function _affApplyGradientOverlays(id, node, created) {
    (node.effects || []).forEach(function (fx) {
        if (!fx || fx.type !== 'GradientOverlay' || !fx.fill || fx.fill.type !== 'Gradient' || !fx.box) return;
        var G = _affMatMul([fx.box.w, 0, fx.box.x, 0, fx.box.h, fx.box.y], _affMat(fx.fill.transform)); // unit -> spread
        var centre = _affWorldCentre(node);
        var opacity = Math.round(Math.max(0, Math.min(1, typeof fx.opacity === 'number' ? fx.opacity : 1)) * 1000) / 10;
        var onFill = !!(node.fill && node.fill.type !== 'None'), onStroke = !!(node.stroke && node.stroke.fill && node.stroke.weight > 0);
        if (onFill) {
            var a = null, al = null;
            try { a = api.get(id, 'material.materialColor.a'); al = api.get(id, 'material.alpha'); } catch (e0) {}
            var fs = _affGradientShaderInFrame(fx.fill, G, centre);
            if (fs) {
                try { connectShaderToShape(fs, id, { x: centre.x, y: centre.y }, 1, 1, created.rotationDeg || 0); api.parent(fs, id); } catch (e1) {}
                if (typeof a === 'number') { try { api.set(id, { 'material.materialColor.a': a }); } catch (e2) {} }
                if (typeof al === 'number') { try { api.set(id, { 'material.alpha': al }); } catch (e3) {} }
                try { api.set(fs, { 'alpha': opacity }); api.rename(fs, (node.name || 'Layer') + ' Gradient Overlay'); } catch (e4) {}
                _affApplyShaderBlend(fs, fx.blendMode);
            }
        }
        if (onStroke) {
            var sa = null;
            try { sa = api.get(id, 'stroke.strokeColor.a'); } catch (e5) {}
            var ss = _affGradientShaderInFrame(fx.fill, G, centre);
            if (ss) {
                try { connectShaderToStroke(ss, id, { x: centre.x, y: centre.y }); api.parent(ss, id); } catch (e6) {}
                if (typeof sa === 'number') { try { api.set(id, { 'stroke.strokeColor.a': sa }); } catch (e7) {} }
                try { api.set(ss, { 'alpha': opacity }); api.rename(ss, (node.name || 'Layer') + ' Gradient Overlay (stroke)'); } catch (e8) {}
                _affApplyShaderBlend(ss, fx.blendMode);
            }
        }
        fx.__applied = onFill || onStroke;
    });
}
// Affinity's Pressure profile (x along the path length, y the share of the weight) as the stroke's
// Width Profile: one graph point per node, handles relative to their point, Bezier interpolation
// (measured on "Quiver Width Test": straight and curved profiles within 0.2 px). Affinity draws a
// dashed stroke at full weight, ignoring its profile, and Cavalry centres any tapered stroke.
function _affApplyPressure(target, prefix, stroke, name) {
    var pressure = stroke.pressure;
    if (!pressure || !pressure.start || !pressure.beziers || !pressure.beziers.length || _affDashString(stroke)) return;
    if (stroke.align && stroke.align !== 'Centre') _affWarn("'" + name + "': Cavalry draws a variable-width stroke centred, so its " + stroke.align.toLowerCase() + " alignment was lost");
    var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
    var pts = [{ x: pressure.start.x, y: pressure.start.y, lx: -0.1, ly: 0, rx: 0.1, ry: 0 }];
    pressure.beziers.forEach(function (b) {
        var prev = pts[pts.length - 1];
        prev.rx = Math.max(0, b[0] - prev.x); prev.ry = b[1] - prev.y;
        pts.push({ x: b[4], y: b[5], lx: Math.min(0, b[2] - b[4]), ly: b[3] - b[5], rx: 0.1, ry: 0 });
    });
    try {
        api.set(target, _affAttr(prefix + 'taperedWidth', true));
        for (var k = 2; k < pts.length; k++) api.addArrayIndex(target, prefix + 'widthGraph'); // the graph starts with two points
        pts.forEach(function (p, i) {
            var base = prefix + 'widthGraph.' + i + '.', a = {};
            a[base + 'position.x'] = clamp(p.x); a[base + 'position.y'] = clamp(p.y);
            a[base + 'left.x'] = p.lx; a[base + 'left.y'] = p.ly; a[base + 'right.x'] = p.rx; a[base + 'right.y'] = p.ry;
            a[base + 'interpolation'] = 1; // Bezier (0 and 2 drew a curved profile straight)
            api.set(target, a);
        });
    } catch (e) { _affWarn("'" + name + "': could not apply its stroke pressure (" + e.message + ")"); }
}
function _affApplyExtraStrokes(id, node) {
    var strokes = node.strokes;
    if (!strokes || strokes.length < 2) return;
    for (var i = 1; i < strokes.length; i++) {
        var st = strokes[i];
        if (!st || !st.fill || st.weight <= 0) continue;
        try { _affMakeStrokeMaterial(id, (node.name || 'Stroke') + ' stroke ' + (i + 1), st, node); }
        catch (eS) { _affWarn("could not add stroke " + (i + 1) + " to '" + node.name + "': " + eS.message); }
    }
}

// Underline / strikethrough / superscript / subscript per run -> Apply Font Style behaviours
// on character ranges (indexMode 2 accepted and verified visually).
function _affApplyTextDecorations(textId, name, runs) {
    if (!runs || !runs.length) return;
    var order = 0, lineRun = null;
    for (var i = 0; i < runs.length; i++) {
        var r = runs[i];
        if (!r || typeof r.start !== 'number' || typeof r.end !== 'number' || r.end <= r.start) continue;
        var underline = !!(r.underline && r.underline !== 'None');
        var strike = !!(r.strikeout && r.strikeout !== 'None');
        var superSub = r.superSub === 'Superscript' ? 1 : (r.superSub === 'Subscript' ? 2 : 0);
        if (!underline && !strike && !superSub) continue;
        var indices = (r.end - r.start === 1) ? String(r.start) : (r.start + ':' + (r.end - 1));
        var label = [underline ? 'Underline' : null, strike ? 'Strikethrough' : null, superSub === 1 ? 'Superscript' : (superSub === 2 ? 'Subscript' : null)].filter(function (x) { return x; }).join(' + ') + ' ' + (++order);
        try {
            var fsId = api.create('applyFontStyle', label);
            api.set(fsId, { 'mode': 1, 'indexMode': 2, 'indices': indices, 'underline': underline, 'strikethrough': strike, 'supersInferiorsMode': superSub });
            api.connect(fsId, 'id', textId, 'styleBehaviours');
            api.parent(fsId, textId);
        } catch (eFs) { _affWarn("'" + name + "': could not apply text decoration to run " + i + ': ' + eFs.message); }
        if ((underline || strike) && !lineRun) lineRun = r;
        if (r.caps && r.caps !== 'None') _affWarn("'" + name + "': caps style '" + r.caps + "' has no Cavalry equivalent; text kept as typed");
    }
    // Cavalry strokes the lines on a "<name> Decorations" shape beside the text in a near-black of its own (measured
    // 2026-10-18: invisible on a dark card); Affinity draws them in the text's colour. One shape holds every line, so it
    // takes the first underlined or struck run's colour, linked to the text's own colour when that run sets it
    if (!lineRun) return;
    try {
        var deco = api.getChildren(api.getParent(textId)).filter(function (k) { return api.getLayerType(k) === 'customShape' && / Decorations$/.test(api.getNiceName(k)); })[0];
        var f = lineRun.fill, base = runs[0] && runs[0].fill;
        var col = f && (f.type === 'Solid' ? f.colour : (f.stops && f.stops.length ? f.stops[0].colour : null));
        if (!deco || !col) return;
        if (f === base || (base && base.type === 'Solid' && f.type === 'Solid' && _affHex(base.colour) === _affHex(col))) api.connect(textId, 'material.materialColor', deco, 'stroke.strokeColor');
        else api.set(deco, { 'stroke.strokeColor': _affHex(col) });
    } catch (eDeco) { _affWarn("'" + name + "': could not colour its underline / strikethrough (" + eDeco.message + ")"); }
}

// ---------------------------------------------------------------------------
// Layer effects -> Cavalry filters (via Quiver's filter helpers)
// ---------------------------------------------------------------------------

function _affFilterBlendEnum(blendName) {
    if (!blendName || blendName === 'Normal') return null;
    var svgName = AFFINITY_BLEND_TO_SVG[blendName];
    if (!svgName) return null;
    try { var v = svgBlendModeToCavalryEnum(svgName); return (v === null || v === 0) ? null : v; } catch (e) { return null; }
}
function _affStyleFilter(filterId, fx, opacityOverride) {
    if (!filterId) return;
    var attrs = [];
    try { attrs = api.getAttributes(filterId) || []; } catch (eA) { attrs = []; }
    var blend = _affFilterBlendEnum(fx.blendMode);
    if (blend !== null && attrs.indexOf('blendMode') !== -1) { try { api.set(filterId, { 'blendMode': blend }); } catch (eB) {} }
    var op = (typeof opacityOverride === 'number') ? opacityOverride : fx.opacity;
    if (typeof op === 'number' && op < 0.999) {
        if (attrs.indexOf('opacity') !== -1) { try { api.set(filterId, { 'opacity': Math.round(op * 1000) / 10 }); } catch (eO) {} }
        else if (attrs.indexOf('shadowColor') !== -1) {
            // no opacity attribute (drop shadow): fold it into the colour alpha
            try { var a = api.get(filterId, 'shadowColor.a'); if (typeof a === 'number') api.set(filterId, { 'shadowColor.a': Math.round(a * op) }); } catch (eC) {}
        }
    }
}
// Affinity's effect "radius" is a visible extent; Cavalry's blur "amount" behaves like
// a Gaussian sigma. Measured on the test doc: a 26.9px Affinity blur has a 10%-90% edge
// width of 26px, Cavalry at amount 26.9 has 71px; 0.35 lands both blur and shadow within 2px.
var AFFINITY_RADIUS_TO_AMOUNT = 0.35;
function _affApplyEffects(id, node) {
    if (!node.effects || !node.effects.length) return;
    if (!_affSetting('importEffectsEnabled', true)) return;
    for (var i = 0; i < node.effects.length; i++) {
        var fx = node.effects[i];
        var hex = _affHex(fx.colour);
        var alpha = (typeof fx.opacity === 'number' ? fx.opacity : 1) * _affAlpha(fx.colour);
        var radius = (typeof fx.radius === 'number' ? fx.radius : 0) * AFFINITY_RADIUS_TO_AMOUNT;
        var dx = 0, dy = 0;
        if (typeof fx.offset === 'number' && typeof fx.angle === 'number') {
            // Affinity: offset distance + angle (radians) in y-down spread space; the
            // shadow falls along +angle (45 degrees renders bottom-right). Quiver's filter
            // helpers take y-down dx/dy and flip to Cavalry's y-up themselves.
            dx = fx.offset * Math.cos(fx.angle);
            dy = fx.offset * Math.sin(fx.angle);
        }
        try {
            switch (fx.type) {
                case 'OuterShadow':
                    _affStyleFilter(createAndAttachDropShadow(id, { dx: dx, dy: dy, blur: radius, color: hex, alpha: _affAlpha(fx.colour) }), fx);
                    break;
                case 'InnerShadow':
                    _affStyleFilter(createSingleInnerShadowNode(id, radius, dx, dy, hex, _affAlpha(fx.colour), ''), fx);
                    break;
                case 'GaussianBlur':
                    createAndAttachBlur(id, radius);
                    break;
                case 'OuterGlow':
                    _affStyleFilter(createAndAttachDropShadow(id, { dx: 0, dy: 0, blur: radius, color: hex, alpha: _affAlpha(fx.colour) }), fx);
                    break;
                case 'InnerGlow': {
                    // Affinity's inner glow is a tight, bright band: a smaller blur plus a
                    // matching spread reproduces its profile (measured: 0.225 * radius for both).
                    var glowSize = (typeof fx.radius === 'number' ? fx.radius : 0) * 0.225;
                    var glowId = createSingleInnerShadowNode(id, glowSize, 0, 0, hex, _affAlpha(fx.colour), ' Glow');
                    if (glowId) { try { api.set(glowId, { 'spread': glowSize }); } catch (eSp) {} }
                    _affStyleFilter(glowId, fx);
                    break;
                }
                case 'ColourOverlay': {
                    // Affinity paints the whole layer (fill and stroke) with the colour at the effect
                    // opacity; Cavalry's Fill Color filter does the same, opacity via the colour alpha.
                    var ovId = _affMakeFilter('fill', (node.name || 'Layer') + ' Colour Overlay');
                    if (ovId) {
                        try { api.set(ovId, { 'fillColor': hex }); api.set(ovId, { 'fillColor.a': Math.round(Math.max(0, Math.min(1, alpha)) * 255) }); } catch (eOv) {}
                        var ovBlend = _affFilterBlendEnum(fx.blendMode);
                        if (ovBlend !== null) { try { api.set(ovId, { 'blendMode': ovBlend }); } catch (eOb) {} }
                        try { api.connect(ovId, 'id', id, 'filters'); api.parent(ovId, id); } catch (eOc) {}
                    }
                    break;
                }
                case 'Outline': {
                    // Affinity's Outline effect is a rounded offset band of `radius` on the chosen side of
                    // the edge; an extra stroke material of that width and alignment reproduces it.
                    // Affinity measures the band from the layer's rendered silhouette (which includes its
                    // stroke); Cavalry's stroke material measures from the geometry edge, so the part of the
                    // stroke lying outside the edge is added (Outside) or removed (Inside). Measured: outside
                    // band 12 -> exactly 12px beyond the edge; inside band 10 on a 4px centred stroke -> 48..58.
                    var baseStroke = (node.strokes && node.strokes.length) ? node.strokes[node.strokes.length - 1] : node.stroke;
                    var strokeOutside = 0;
                    if (baseStroke && baseStroke.weight > 0) strokeOutside = (baseStroke.align === 'Outside' || baseStroke.align === 'Outer') ? baseStroke.weight : ((baseStroke.align === 'Inside' || baseStroke.align === 'Inner') ? 0 : baseStroke.weight / 2);
                    var outlineRadius = (typeof fx.radius === 'number' ? fx.radius : 0);
                    var outlineWidth = (fx.align === 'Inside') ? Math.max(0, outlineRadius - strokeOutside) : ((fx.align === 'Centre') ? outlineRadius : outlineRadius + strokeOutside);
                    var outlineStroke = {
                        weight: outlineWidth,
                        cap: 'Round', join: 'Round', miterLimit: 10, dashPattern: [],
                        align: fx.align || 'Outside',
                        fill: (fx.fillType === 'Gradient' && fx.fill) ? fx.fill : { type: 'Solid', colour: fx.colour || { r: 0, g: 0, b: 0, a: 255 }, alpha: (typeof fx.opacity === 'number' ? fx.opacity : 1) }
                    };
                    if (fx.fillType === 'Contour') _affWarn("Outline on '" + node.name + "' uses a contour fill; imported as a solid outline");
                    if (outlineStroke.weight > 0) _affMakeStrokeMaterial(id, (node.name || 'Layer') + ' Outline', outlineStroke, node);
                    break;
                }
                case 'GradientOverlay':
                    // stacked as fill and stroke shaders by _affApplyGradientOverlays (layers with a fill or stroke)
                    if (!fx.__applied) _affWarn("gradient overlay on '" + node.name + "' needs a fill or stroke to sit on in Cavalry and was skipped");
                    break;
                default:
                    _affWarn("effect '" + fx.type + "' on '" + node.name + "' has no Cavalry equivalent and was skipped");
            }
        } catch (eFx) {
            _affWarn("could not build effect '" + fx.type + "' on '" + node.name + "': " + eFx.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
// A local box as one closed curve: a stand-in rectangle on a skewed or mirrored layer is built as a path
// from its curves (it had none: 'has no geometry')
function _affBoxCurves(b) {
    b = b || { x: 0, y: 0, w: 0, h: 0 };
    var x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    return [{ closed: true, start: { x: x0, y: y0 }, beziers: [[x0, y0, x1, y0, x1, y0], [x1, y0, x1, y1, x1, y1], [x1, y1, x0, y1, x0, y1]] }];
}
function _affCurvesToSegments(curves, W) {
    var segments = [];
    for (var ci = 0; ci < curves.length; ci++) {
        var c = curves[ci];
        if (!c || !c.start || !c.beziers || !c.beziers.length) continue;
        var s = _affApply(W, c.start.x, c.start.y);
        segments.push({ cmd: 'M', x: s.x, y: s.y });
        var prev = { x: c.start.x, y: c.start.y };
        for (var bi = 0; bi < c.beziers.length; bi++) {
            var b = c.beziers[bi];
            var isLine = (Math.abs(b[0] - prev.x) < 1e-6 && Math.abs(b[1] - prev.y) < 1e-6 && Math.abs(b[2] - b[4]) < 1e-6 && Math.abs(b[3] - b[5]) < 1e-6);
            var e = _affApply(W, b[4], b[5]);
            if (isLine) {
                segments.push({ cmd: 'L', x: e.x, y: e.y });
            } else {
                var c1 = _affApply(W, b[0], b[1]), c2 = _affApply(W, b[2], b[3]);
                segments.push({ cmd: 'C', cp1x: c1.x, cp1y: c1.y, cp2x: c2.x, cp2y: c2.y, x: e.x, y: e.y });
            }
            prev = { x: b[4], y: b[5] };
        }
        if (c.closed) segments.push({ cmd: 'Z' });
    }
    return segments;
}
function _affCreatePathLayer(node, parentId, vb) {
    var W = _affMat(node.world);
    var segments = _affCurvesToSegments(node.curves || [], W);
    if (!segments.length) { _affWarn("'" + node.name + "' has no geometry"); return null; }
    var id = null;
    try { id = _affBuildEditable(segments, node.name || 'Path', parentId, vb); } catch (e) { _affWarn("path build failed for '" + node.name + "': " + e.message); return null; }
    // Affinity's fill mode (Winding / Alternate) -> Cavalry fillRule (1 Winding, 0 Even Odd). Cavalry
    // defaults to Even Odd, which cuts holes wherever the overlapping contours of expanded strokes
    // or flattened glyphs cross (the "Supported Import Formats" heading, 2026-10-13).
    if (node.fillRule) { try { api.set(id, { 'fillRule': node.fillRule === 'OddEven' ? 0 : 1 }); } catch (eFR) {} }
    return id;
}
function _affRectCornerRadius(node, w, h, avgScale) {
    var shape = node.shape || {};
    var corners = shape.corners || {};
    var tl = corners.topLeft;
    if (!tl || !tl.type || tl.type === 'None') return 0;
    if (tl.type !== 'Rounded') return -1; // concave / cutout / straight: needs the path
    if (!shape.useSingleRadius) {
        var same = ['topRight', 'bottomLeft', 'bottomRight'].every(function (k) { var c = corners[k]; return c && c.type === tl.type && Math.abs(c.radius - tl.radius) < 1e-6; });
        if (!same) return -1;
    }
    // Affinity stores a percentage of the shorter side (1 = fully round) unless absolute sizes are on
    var r = shape.absoluteSizes ? tl.radius * avgScale : tl.radius * Math.min(w, h) / 2;
    return Math.max(0, Math.min(r, Math.min(w, h) / 2));
}
// Affinity draws a polygon or star inside the ellipse of its box with a vertex at the top (verified on
// a scripted doc: a pentagon in a 300x200 box has its vertices on that ellipse, an octagon and stars
// of any count put a vertex at the top). Cavalry's polygon takes an x/y radius on the same ellipse
// but draws an even polygon flat-topped (rotated half a step), and its star has one radius and an
// absolute inner radius, point up. Stretching a Cavalry layer stretches its stroke too (measured),
// so a stretched star, curved or smoothed variants and stretched even polygons stay paths. Cogs
// stay paths as well: Cavalry's cog bends each flank through its pitch circle (76 points for 12
// teeth) where Affinity's flanks are straight (52 points).
var __affTurned = {}; // primitive ids carrying a half-step turn that the shader/rider frames do not model
var __affRiddenOn = {}; // picture record id -> the clipper record whose material now draws it
function _affLiveShape(node, w, h) {
    var s = node.shape || {};
    var square = Math.abs(w - h) <= 0.005 * Math.max(w, h);
    if (s.type === 'Polygon') {
        var n = Math.round(s.sides || 0);
        if (n < 3 || Math.abs(s.curve || 0) > 1e-6 || s.smoothPoints) return null;
        if (n % 2 === 0) {
            var hasPattern = [node.fill].concat(node.fills || []).some(function (f) { return f && f.type === 'Bitmap'; });
            if (!square || node.clipsChildren || hasPattern) return null;
            return { primitive: 'polygon', attrs: { 'generator.sides': n, 'generator.radius': [w / 2, h / 2] }, turn: 180 / n };
        }
        return { primitive: 'polygon', attrs: { 'generator.sides': n, 'generator.radius': [w / 2, h / 2] }, turn: 0 };
    }
    if (s.type === 'Star') {
        var pts = Math.round(s.points || 0);
        var plain = !s.curvedEdges && Math.abs(s.leftCurve || 0) < 1e-6 && Math.abs(s.rightCurve || 0) < 1e-6 && Math.abs(s.circleOuterRadius || 0) < 1e-6 && Math.abs((s.circleInnerRadius || 0) - (s.innerRadius || 0)) < 1e-3;
        if (pts < 3 || !square || !plain || !(s.innerRadius > 0)) return null;
        return { primitive: 'star', attrs: { 'generator.sides': pts, 'generator.radius': w / 2, 'generator.useInnerRadius': true, 'generator.innerRadius': s.innerRadius * w / 2 }, turn: 0 };
    }
    return null;
}
function _affCreateShapeLayer(node, parentId, vb) {
    var W = _affMat(node.world);
    var dec = _affDecompose(W);
    var box = node.localBox || { x: 0, y: 0, w: 0, h: 0 };
    var type = node.shape ? node.shape.type : null;
    // a shape carrying an art brush stays a path: the brush starts where Affinity's outline starts and
    // runs its way round, which a Cavalry primitive does not
    var skewed = Math.abs(dec.skew) > 0.5 || dec.sx <= 0 || !!(node.stroke && node.stroke.artBrush);
    var w = box.w * Math.abs(dec.sx), h = box.h * Math.abs(dec.sy);
    var centre = _affApply(W, box.x + box.w / 2, box.y + box.h / 2);
    var pos = _affToCavalry(centre.x, centre.y, vb);
    var id = null;
    if (!skewed && type === 'Rectangle') {
        var cr = _affRectCornerRadius(node, w, h, (Math.abs(dec.sx) + Math.abs(dec.sy)) / 2);
        if (cr >= 0) {
            id = api.primitive('rectangle', node.name || 'Rectangle');
            if (parentId) api.parent(id, parentId);
            api.set(id, { 'generator.dimensions': [w, h], 'position.x': pos.x, 'position.y': pos.y });
            if (cr > 0) { try { api.set(id, { 'generator.cornerRadius': cr }); } catch (eCr) {} }
        }
    } else if (!skewed && type === 'Ellipse') {
        id = api.primitive('ellipse', node.name || 'Ellipse');
        if (parentId) api.parent(id, parentId);
        api.set(id, { 'generator.radius': [w / 2, h / 2], 'position.x': pos.x, 'position.y': pos.y });
    }
    var live = (!id && !skewed && (type === 'Polygon' || type === 'Star')) ? _affLiveShape(node, w, h) : null;
    if (live) {
        id = api.primitive(live.primitive, node.name || type);
        if (parentId) api.parent(id, parentId);
        live.attrs['position.x'] = pos.x; live.attrs['position.y'] = pos.y;
        api.set(id, live.attrs);
        if (live.turn) __affTurned[id] = true;
    }
    if (id) {
        // the turn (even polygons) is folded into the rotation the fill gradients compensate for
        var rot = dec.rotation - (live ? live.turn : 0);
        if (Math.abs(rot) > 0.01) { try { api.set(id, { 'rotation': -rot }); } catch (eRot) {} }
        if (dec.sy < 0) { try { api.set(id, { 'scale.y': -1 }); } catch (eFlip) {} }
        return { id: id, rotationDeg: rot, isPath: false };
    }
    // Everything else (polygons, stars, triangles, custom corners, skewed rects) becomes an editable path
    id = _affCreatePathLayer(node, parentId, vb);
    return id ? { id: id, rotationDeg: 0, isPath: true } : null;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
var AFFINITY_ALIGN_H = { 'Left': 0, 'Centre': 1, 'Center': 1, 'Right': 2, 'JustifyLeft': 3, 'JustifyCentre': 3, 'JustifyRight': 3, 'JustifyAll': 3, 'AwayFromSpine': 0, 'TowardsSpine': 2 };
function _affPickFontStyle(family, wanted, weight, italic, postscript) {
    var styles = [];
    try { styles = cavalry.getFontStyles(family) || []; } catch (e) { styles = []; }
    if (!styles.length) return wanted || 'Regular';
    if (wanted && styles.indexOf(wanted) !== -1) return wanted;
    // A variable font's named instance arrives with no style and weight 400; its PostScript name carries the
    // instance ("EaseVariable-SemiDisplayBold" is Cavalry's "SemiDisplay Bold")
    var squash = function (v) { return String(v || '').replace(/[\s_-]/g, '').toLowerCase(); };
    var psStyle = postscript && String(postscript).indexOf('-') !== -1 ? squash(String(postscript).split('-').pop()) : '';
    if (psStyle) { var hit = styles.filter(function (s) { return squash(s) === psStyle; }); if (hit.length) return hit[0]; }
    // Cavalry dedupes duplicate style names as "Bold_2"; prefer the plain one when present
    var plain = wanted ? styles.filter(function (s) { return s.indexOf(wanted) === 0; }) : [];
    if (plain.length) return plain[0];
    var w = weight || 400;
    var byWeight = (w >= 800) ? ['Black', 'Heavy', 'ExtraBold', 'Bold'] : (w >= 600) ? ['Bold', 'SemiBold', 'Semibold', 'Medium'] : (w >= 500) ? ['Medium', 'Regular'] : (w <= 300) ? ['Light', 'Thin', 'Regular'] : ['Regular', 'Book', 'Normal'];
    for (var i = 0; i < byWeight.length; i++) {
        var candidate = byWeight[i] + (italic ? ' Italic' : '');
        if (styles.indexOf(candidate) !== -1) return candidate;
        if (styles.indexOf(byWeight[i]) !== -1) return byWeight[i];
    }
    return styles[0];
}
// A gradient laid in the composition (Screen Space) from Affinity's spread-space G. Used where a shape's own frame would
// split it: Cavalry draws a text layer's shader once per glyph (measured: black to white across the "A" and again
// across the "a"), while Affinity spans the whole text.
// Measured in Screen Space: a linear spans comp width x Scale centred on the comp centre + Offset, Rotation anticlockwise;
// a radial keeps its Fixed Radius, Scale and Rotation with Offset from the comp centre. Moving the layer then moves it
// through a gradient that stays put.
function _affGradientInComp(shaderId, fill, G, vb, name) {
    var type = fill.gradientType || 'Linear', cc = { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
    try {
        if (type === 'Linear') {
            var compW = 0; try { compW = api.get(api.getActiveComp(), 'resolution').x; } catch (e) {}
            var p0 = _affApply(G, 0, 0), p1 = _affApply(G, 1, 0), s = _affToCavalry(p0.x, p0.y, vb), e = _affToCavalry(p1.x, p1.y, vb);
            var dx = e.x - s.x, dy = e.y - s.y, len = Math.sqrt(dx * dx + dy * dy);
            if (!(compW > 0 && len > 0)) return;
            api.set(shaderId, { screenSpace: true, 'generator.offset': [(s.x + e.x) / 2, (s.y + e.y) / 2], 'generator.rotation': Math.atan2(dy, dx) * 180 / Math.PI, 'generator.scale': len / compW });
        } else if (type === 'Radial' || type === 'Elliptical') {
            api.set(shaderId, { screenSpace: true });
            _affPlaceRadial(shaderId, G, cc);
        } else if (type === 'Conical') {
            var c0 = _affApply(G, 0, 0);
            api.set(shaderId, { screenSpace: true, 'generator.offset': [c0.x - cc.x, -(c0.y - cc.y)] });
        }
    } catch (eSs) { _affWarn("'" + name + "': could not place its gradient (" + eSs.message + ")"); }
}
// Places a text whose transform turns or mirrors it, by its own top-left corner. `box` is the frame (for art text,
// its glyph extents) in its own space and `W` maps that to the spread. Cavalry gets the turn of the reading direction
// and, for a mirror (a negative determinant: Flip Horizontal is a half turn plus this), a scale of -1 across the lines,
// as images do; it turns and scales a text about its position. A frame gets its own sides as its box (a spine title
// turned 90 degrees and stretched 1.47 x 0.83 is 1726 x 318, not its upright 318 x 1726 on the page) and its glyph tops
// on the frame's top edge; art text keeps Cavalry's own size, its drawn top-left on the glyph box's.
function _affPlaceTransformedText(id, t, box, W, vb, fontSize, isFrame) {
    var lx = Math.sqrt(W[0] * W[0] + W[3] * W[3]), ly = Math.sqrt(W[1] * W[1] + W[4] * W[4]), det = W[0] * W[4] - W[1] * W[3];
    var ang = Math.atan2(W[3], W[0]); // the reading direction, y-down radians
    var c = _affApply(W, box.x, box.y), corner = _affToCavalry(c.x, c.y, vb);
    // a skewed frame keeps its height across the reading direction
    var cross = lx > 0 ? Math.abs(det) / lx : ly;
    var upright = { 'rotation': 0, 'scale.x': 1, 'scale.y': 1, 'position.x': corner.x, 'position.y': corner.y };
    if (isFrame) { upright.autoWidth = false; upright.autoHeight = false; upright.textBoxSize = [box.w * lx, box.h * cross]; }
    else { upright.autoWidth = true; upright.autoHeight = true; }
    try { api.set(id, upright); } catch (eBox) {}
    var dx = 0, dy = 0; // from where Cavalry draws it to where it belongs, measured upright (y up)
    try {
        var bb = api.getBoundingBox(id, true);
        if (isFrame) {
            // the glyph box arrives upright on the page, so its top is only the glyphs' top when the frame is turned a
            // whole number of quarter turns; otherwise the glyph tops go on the frame's top edge, where Affinity puts them
            // (0.02 px below it on upright frames)
            var quarter = Math.abs(Math.sin(2 * ang)) < 1e-3;
            var inv = _affInvert(W), g = t.frame && t.frame.glyphBox;
            if (!quarter) { if (isFinite(corner.y - bb.top) && Math.abs(corner.y - bb.top) < fontSize) dy = corner.y - bb.top; }
            else if (inv && g && typeof g.y === 'number') {
                var top = Infinity;
                [[g.x, g.y], [g.x + g.w, g.y], [g.x, g.y + g.h], [g.x + g.w, g.y + g.h]].forEach(function (q) { top = Math.min(top, _affApply(inv, q[0], q[1]).y); });
                var want = corner.y - (top - box.y) * cross;
                if (isFinite(want - bb.top) && Math.abs(want - bb.top) < fontSize) dy = want - bb.top;
            }
        } else if (isFinite(bb.left) && isFinite(bb.top)) { dx = corner.x - bb.left; dy = corner.y - bb.top; }
    } catch (eNudge) {}
    var r = -ang, sy = det < 0 ? -1 : 1, ox = dx, oy = dy * sy;
    try { api.set(id, { 'rotation': r * 180 / Math.PI, 'scale.y': sy, 'position.x': corner.x + Math.cos(r) * ox - Math.sin(r) * oy, 'position.y': corner.y + Math.sin(r) * ox + Math.cos(r) * oy }); } catch (eRot) {}
}
// Affinity cannot tell a script a variable font's axis values (see variableCustom in the serialiser), but its Weight
// changes how wide the text draws, and the text's width is known: the Weight axis is set until Cavalry draws the text
// as wide as Affinity does (Ease Variable at 700 / 35 / 100 came back 689.8 with the corner axes unknown, 698.2 with them
// set, 2026-10-23). The other axes do not show in the width, so they keep their defaults and are named in a warning.
function _affFitVariableWeight(id, node, t, runs, W, fontSize, name) {
    var custom = runs.filter(function (r) { return r && r.variableCustom; });
    if (!custom.length) return;
    var axes = {}, names = [];
    for (var i = 0; i < 64; i++) { // hasAttribute first: asking past the end prints an error in Cavalry's console
        var nm = ''; try { if (!api.hasAttribute(id, 'fontAxes.' + i)) break; nm = api.getAttributeNiceName(id, 'fontAxes.' + i); } catch (e) { nm = ''; }
        if (!nm) break; axes[nm] = i; names.push(nm);
    }
    var others = names.filter(function (n) { return n !== 'Weight'; });
    var lx = Math.sqrt(W[0] * W[0] + W[3] * W[3]), target = 0, why = '';
    if (custom.length !== runs.length || runs.some(function (r) { return r.family !== runs[0].family; })) why = 'it mixes fonts';
    else if (t.kind === 'frame') {
        var g = t.frame && t.frame.glyphBox, rot = Math.abs(Math.atan2(W[3], W[0]));
        if (g && rot < 1e-3 && W[0] > 0 && g.h < fontSize * 1.6) target = g.w; else why = 'it is a wrapped, turned or flipped text frame';
    } else if (node.localBox && node.localBox.w > 0) target = node.localBox.w * lx;
    var fitted = null;
    if (target > 0 && axes.Weight !== undefined) {
        try {
            api.set(id, { autoWidth: true, autoHeight: true });
            var key = 'fontAxes.' + axes.Weight, width = function (w) { var o = {}; o[key] = w; api.set(id, o); return api.getBoundingBox(id, false).width; };
            var lo = 1, hi = 1000;
            if (width(lo) <= target && width(hi) >= target) {
                for (var k = 0; k < 24; k++) { var mid = (lo + hi) / 2; if (width(mid) < target) lo = mid; else hi = mid; }
                fitted = Math.round((lo + hi) / 2);
                width(fitted);
            }
        } catch (eFit) { fitted = null; }
    }
    var what = "'" + name + "' uses custom " + runs[0].family + " axis values, which Affinity's scripting cannot read: ";
    if (fitted !== null) _affWarn(what + 'Weight was matched to the text\'s width (' + fitted + ')' + (others.length ? '; set ' + others.join(', ') + ' in Cavalry\'s font axes (the three dots beside Font)' : ''));
    else _affWarn(what + 'set them in Cavalry\'s font axes (the three dots beside Font)' + (why ? ' (Weight could not be matched: ' + why + ')' : ''));
}
function _affCreateTextLayer(node, parentId, vb) {
    if (!_affSetting('importLiveTextEnabled', true)) { return _affCreateTextAsPath(node, parentId, vb); }
    var t = node.text || {};
    var runs = t.runs || [];
    var paras = t.paragraphs || [];
    var run = runs[0] || {};
    var para = paras[0] || {};
    var W = _affMat(node.world);
    var dec = _affDecompose(W);
    // Glyph scale: Affinity's textUiScale is the net factor on the nominal size (a resized frame
    // does not scale its text; a "scaled text" frame or art text does). Older payloads without it
    // fall back to the frame transform.
    var scale = (t.uiScale && typeof t.uiScale.x === 'number' && t.uiScale.x > 0) ? (t.uiScale.x + (t.uiScale.y || t.uiScale.x)) / 2 : ((Math.abs(dec.sx) + Math.abs(dec.sy)) / 2 || 1);
    var fontSize = (run.size || 12) * scale;
    var text = String(t.text || '');
    // Fields: the raw story says "<Page Number>", the page renders a number
    if (typeof t.rendered === 'string' && t.rendered.length) {
        var rendered = t.rendered;
        if (rendered.indexOf('\u0000PAGE\u0000') !== -1) rendered = rendered.split('\u0000PAGE\u0000').join(t.pageNumber ? String(t.pageNumber) : '#');
        if (rendered.replace(/\s+/g, '') !== text.replace(/\s+/g, '')) text = rendered;
    }
    // Caps styles: Cavalry's text API has no caps switch, so the characters themselves are
    // uppercased for the runs that carry one (small caps are approximated by capitals).
    var name = text.split(/\s+/).slice(0, 3).join(' ') || node.name || 'Text';
    text = _affApplyCaps(text, runs, name);
    var id = api.create('textShape', name);
    if (parentId) api.parent(id, parentId);

    var family = run.family || 'Arial';
    try { if (typeof resolveFontFamilyForCavalry === 'function') family = resolveFontFamilyForCavalry(family, fontSize); } catch (eFam) {}
    var style = _affPickFontStyle(family, run.style, run.weight, run.isItalic, run.postscriptName);
    var hAlign = AFFINITY_ALIGN_H[para.align] !== undefined ? AFFINITY_ALIGN_H[para.align] : 0;
    var attrs = { 'text': text, 'fontSize': fontSize, 'horizontalAlignment': hAlign, 'verticalAlignment': 0, 'autoName': false };
    try { api.set(id, attrs); } catch (eAttrs) { for (var k in attrs) { var one = {}; one[k] = attrs[k]; try { api.set(id, one); } catch (e1) {} } }
    try { api.set(id, { 'font.font': family, 'font.style': style }); } catch (eFont) { try { api.set(id, { 'font.font': family }); } catch (eFont2) {} }
    // Affinity's characterSpacing is in ems (the UI shows it x1000 as per-mille): measured 0.05 em on
    // 40px text adds exactly 2px per gap. Cavalry's letterSpacing is in pixels.
    if (typeof run.tracking === 'number' && Math.abs(run.tracking) > 0.00001) { try { api.set(id, { 'letterSpacing': run.tracking * fontSize }); } catch (eTr) {} }
    _affFitVariableWeight(id, node, t, runs, W, fontSize, name);
    _affApplyLeading(id, para, run, fontSize, scale, text, (t.kind === 'frame') && t.frame && t.frame.box);
    if (typeof para.spaceAfter === 'number' && para.spaceAfter > 0) { try { api.set(id, { 'paragraphSpacing': para.spaceAfter * scale }); } catch (ePs) {} }

    // Colour from the first run (node-level fill is empty for text in Affinity)
    var fill = run.fill || node.fill;
    // outline-only text: no run has a fill (a None fill arrives as null), only a stroke
    if (!fill && node.stroke && runs.length && runs.every(function (r) { return !r.fill; })) { try { api.setFill(id, false); } catch (eNf) {} }
    else if (fill && fill.type === 'Solid') {
        try { api.setFill(id, true); api.set(id, { 'material.materialColor': _affHex(fill.colour), 'material.alpha': Math.round(_affFillAlpha(fill, node) * 1000) / 10 }); } catch (eCol) {}
    } else if (fill && fill.type === 'Gradient') {
        var shaderId = _affCreateGradientShader(fill, node);
        if (shaderId) { var c = _affWorldCentre(node); try { connectShaderToShape(shaderId, id, { x: c.x, y: c.y }, _affFillAlpha(fill, node), 1, dec.rotation); api.parent(shaderId, id); } catch (eG) {} _affGradientInComp(shaderId, fill, _affMatMul(_affMat(node.world), _affMat(fill.transform)), vb, name); }
    }
    if (runs.length > 1) _affApplyTextRuns(id, name, runs, run, family, style, fontSize, scale, node);
    _affFitMixedLeading(id, t, node, runs, text, fontSize, W);
    _affApplyTextDecorations(id, name, runs);

    // Text on a path: the path is rebuilt as a hidden editable shape and connected to the text's
    // Text Path. Cavalry then puts the first character at the path's first point (Left), the middle
    // half way (Centre) or the last character at the end (Right), like Affinity. Both the text's and
    // the path's positions offset the result, so the text stays at the origin and the path carries
    // the placement (verified).
    if (t.kind === 'path' && node.curves && node.curves.length) {
        var pathId = null;
        try { pathId = _affCreatePathLayer({ name: name + ' path', curves: node.curves, world: node.world }, parentId, vb); } catch (ePath) { pathId = null; }
        if (pathId) {
            try { api.setFill(pathId, false); api.setStroke(pathId, false); api.set(pathId, { 'hidden': true }); } catch (eHide) {}
            try {
                api.connect(pathId, 'id', id, 'textPath');
                api.set(id, { 'autoWidth': true, 'autoHeight': true, 'position.x': 0, 'position.y': 0, 'pathTravel': 0 });
            } catch (eTp) { _affWarn("'" + name + "': could not attach the text path: " + eTp.message); }
            // the path is a separate layer, so it must stack right below the text: move the text above it
            _affReportSibling(pathId);
            try { if (typeof registerCreatedTextShape === 'function') registerCreatedTextShape(node.name, id); } catch (eReg2) {}
            return { id: id, rotationDeg: 0, isPath: false, isText: true, onPath: true, pathId: pathId };
        }
        _affWarn("'" + name + "': text path could not be rebuilt; placed as plain text");
    }

    // Placement. Art text (auto-sized): Cavalry anchors the position by the alignment (left edge,
    // centre or right edge). A fixed text box: the position is always the box's TOP-LEFT corner,
    // whatever the alignment (probed: a 400px box with hAlign 2 puts its glyphs at 365..397).
    var isFrame = (t.kind === 'frame') && t.frame && t.frame.box;
    var box = isFrame ? t.frame.box : (node.localBox || { x: 0, y: 0, w: 0, h: 0 });
    var wb = _affBounds(_affBoxCorners(box, W));
    if (Math.abs(dec.rotation) > 0.01 || W[0] * W[4] - W[1] * W[3] < 0) {
        _affPlaceTransformedText(id, t, box, W, vb, fontSize, !!isFrame);
        try { if (typeof registerCreatedTextShape === 'function') registerCreatedTextShape(node.name, id); } catch (eRegT) {}
        return { id: id, rotationDeg: dec.rotation, isPath: false, isText: true };
    }
    if (isFrame) {
        try { api.set(id, { 'autoWidth': false, 'autoHeight': false, 'textBoxSize': [wb.w, wb.h] }); } catch (eBox) {}
    } else {
        try { api.set(id, { 'autoWidth': true, 'autoHeight': true }); } catch (eAuto) {}
    }
    var anchorX = isFrame ? wb.x : ((hAlign === 1) ? wb.cx : (hAlign === 2) ? (wb.x + wb.w) : wb.x);
    var pos = _affToCavalry(anchorX, wb.y, vb);
    try { api.set(id, { 'position.x': pos.x, 'position.y': pos.y }); } catch (ePos) {}
    // Affinity puts the first line's glyph tops on the frame's top edge (verified on two frames),
    // while Cavalry leaves the line's internal leading above them (0.2 em on Arial). Measure the
    // rendered bounds and nudge the box up so the glyph tops coincide; x stays box-anchored.
    if (isFrame && Math.abs(dec.rotation) < 0.01) {
        try {
            var fbb = api.getBoundingBox(id, true);
            var fTargetTop = _affToCavalry(0, (t.frame.glyphBox && typeof t.frame.glyphBox.y === 'number') ? t.frame.glyphBox.y : wb.y, vb).y;
            var fDy = fTargetTop - fbb.top;
            if (isFinite(fDy) && Math.abs(fDy) < fontSize) api.set(id, { 'position.y': pos.y + fDy });
        } catch (eFn) {}
    }
    // Affinity's box is the glyph extents; Cavalry's box includes line metrics. For art
    // text, measure the rendered bounds and nudge so the visible tops coincide.
    if (!isFrame && Math.abs(dec.rotation) < 0.01) {
        try {
            var bb = api.getBoundingBox(id, true);
            var targetTop = _affToCavalry(0, wb.y, vb).y;
            var targetX = (hAlign === 1) ? _affToCavalry(wb.cx, 0, vb).x : (hAlign === 2) ? _affToCavalry(wb.x + wb.w, 0, vb).x : _affToCavalry(wb.x, 0, vb).x;
            var haveX = (hAlign === 1) ? (bb.left + bb.right) / 2 : (hAlign === 2) ? bb.right : bb.left;
            var dyNudge = targetTop - bb.top, dxNudge = targetX - haveX;
            if (isFinite(dyNudge) && isFinite(dxNudge) && Math.abs(dyNudge) < fontSize * 2 && Math.abs(dxNudge) < fontSize * 2) {
                api.set(id, { 'position.x': pos.x + dxNudge, 'position.y': pos.y + dyNudge });
            }
        } catch (eNudge) {}
    }
    if (Math.abs(dec.rotation) > 0.01) { try { api.set(id, { 'rotation': -dec.rotation }); } catch (eRot) {} }
    try { if (typeof registerCreatedTextShape === 'function') registerCreatedTextShape(node.name, id); } catch (eReg) {}
    return { id: id, rotationDeg: dec.rotation, isPath: false, isText: true };
}

function _affApplyCaps(text, runs, name) {
    var out = text;
    var warnedSmall = false;
    for (var i = 0; i < (runs || []).length; i++) {
        var r = runs[i];
        if (!r || !r.caps || r.caps === 'None') continue;
        var start = Math.max(0, r.start | 0), end = Math.min(out.length, r.end | 0);
        if (end <= start) continue;
        out = out.slice(0, start) + out.slice(start, end).toUpperCase() + out.slice(end);
        if (/Small|Petite/.test(r.caps) && !warnedSmall) { warnedSmall = true; _affWarn("'" + name + "': " + r.caps + " approximated with capitals (Cavalry has no small caps)"); }
    }
    return out;
}

// Leading. Cavalry's lineSpacing ADDS to the font's natural line pitch, and that pitch equals
// Affinity's "ideal" leading (Arial 40px: both give a 46px pitch, measured). The natural pitch
// is measured on the live layer (three lines vs one line) so any font works.
//   RelativeToIdeal r        -> pitch = r * ideal            (Affinity default, r = 1)
//   RelativeToHeight r       -> pitch = r * fontSize
//   ExactlyAbsolute a        -> pitch = a
//   AtLeastAbsolute a        -> pitch = max(a, ideal)
//   RelativeToIdealAbsolute  -> pitch = r * ideal   (absolute part ignored, measured)
// Measured on the live layer with a two-line probe so wrapped text boxes and any font work:
// the layer is briefly switched to auto-size, "Ig" vs "Ig\nIg" gives the pitch, then every
// touched attribute is restored.
function _affNaturalLinePitch(textId, text) {
    var pitch = null;
    var saved = {};
    ['text', 'autoWidth', 'autoHeight', 'textBoxSize'].forEach(function (k) { try { saved[k] = api.get(textId, k); } catch (e) {} });
    try {
        api.set(textId, { 'autoWidth': true, 'autoHeight': true, 'text': 'Ig' });
        var bb1 = api.getBoundingBox(textId, true);
        api.set(textId, { 'text': 'Ig\nIg' });
        var bb2 = api.getBoundingBox(textId, true);
        pitch = (bb2.top - bb2.bottom) - (bb1.top - bb1.bottom);
    } catch (e) { pitch = null; }
    try {
        if (saved.textBoxSize && typeof saved.textBoxSize.x === 'number') api.set(textId, { 'textBoxSize': [saved.textBoxSize.x, saved.textBoxSize.y] });
        api.set(textId, { 'autoWidth': !!saved.autoWidth, 'autoHeight': !!saved.autoHeight, 'text': text });
    } catch (eRestore) {}
    return (pitch && isFinite(pitch) && pitch > 0) ? pitch : null;
}
function _affApplyLeading(textId, para, run, fontSize, scale, text, isFrame) {
    if (!para) return;
    if (!isFrame && String(text).indexOf('\n') === -1) return; // single-line art text: leading is moot
    var type = para.leadingType || 'RelativeToIdeal';
    var rel = (typeof para.relativeLeading === 'number') ? para.relativeLeading : 1;
    var abs = ((typeof para.absoluteLeading === 'number') ? para.absoluteLeading : 0) * scale;
    // A character-level leading override (GlyphAtts.absoluteLeading, the Character panel's Leading
    // Override) takes precedence over the paragraph leading (verified: 37.5px text with run
    // absoluteLeading 50 lays out on a 50px pitch regardless of the paragraph setting).
    var runLead = (run && typeof run.absoluteLeading === 'number' && run.absoluteLeading > 0) ? run.absoluteLeading * scale : 0;
    if (runLead > 0) { type = 'ExactlyAbsolute'; abs = runLead; }
    if (type === 'RelativeToIdeal' && Math.abs(rel - 1) < 0.001) return; // Affinity default == Cavalry default
    var natural = _affNaturalLinePitch(textId, text);
    if (natural === null) natural = fontSize * 1.15;
    var pitch;
    switch (type) {
        case 'RelativeToHeight': pitch = rel * fontSize; break;
        case 'ExactlyAbsolute': pitch = abs; break;
        case 'AtLeastAbsolute': pitch = Math.max(abs, natural); break;
        case 'RelativeToIdealAbsolute': pitch = rel * natural; break; // measured: the absolute part is not added (1.5 + 10 on Arial 40 -> 69 = 1.5 x 46)
        default: pitch = rel * natural;
    }
    if (!isFinite(pitch) || pitch <= 0) return;
    try { api.set(textId, { 'lineSpacing': pitch - natural }); } catch (eLd) {}
}

// Art text whose lines use different sizes: Cavalry's lineSpacing is added to each line's own
// natural height, so a value derived from the base size puts a big second line far too low
// (measured: a 82px first line and a 274px second line on an exact 240px leading came out 418px
// apart). With the runs applied, the text's natural height at lineSpacing 0 is measured and the
// spacing is set so the glyph box ends up the height Affinity reports for the same text.
function _affFitMixedLeading(textId, t, node, runs, text, fontSize, W) {
    try {
        if (!t || t.kind !== 'art') return;
        var lines = String(text).split('\n');
        if (lines.length < 2 || /\n\s*$/.test(String(text))) return;
        var sizes = {}; (runs || []).forEach(function (r) { if (r && typeof r.size === 'number') sizes[Math.round(r.size * 100)] = true; });
        if (Object.keys(sizes).length < 2) return;
        if (Math.abs(W[1]) > 1e-6 || Math.abs(W[3]) > 1e-6) return; // rotated: the spread box is no longer the glyph box
        var target = node.spreadBox && node.spreadBox.h;
        if (!(target > 0)) return;
        // measure as auto-sized text: at this point the layer may still have Cavalry's default 600px
        // text box, which would wrap the big line and inflate the height
        var saved = {}; ['lineSpacing', 'autoWidth', 'autoHeight', 'textBoxSize'].forEach(function (k) { try { saved[k] = api.get(textId, k); } catch (e) {} });
        api.set(textId, { 'autoWidth': true, 'autoHeight': true, 'lineSpacing': 0 });
        var h0 = api.getBoundingBox(textId, true).height;
        var ls = (target - h0) / (lines.length - 1);
        try { if (saved.textBoxSize && typeof saved.textBoxSize.x === 'number') api.set(textId, { 'textBoxSize': [saved.textBoxSize.x, saved.textBoxSize.y] }); api.set(textId, { 'autoWidth': !!saved.autoWidth, 'autoHeight': !!saved.autoHeight }); } catch (eR) {}
        if (!isFinite(ls) || Math.abs(ls) > 5 * fontSize) { api.set(textId, { 'lineSpacing': saved.lineSpacing }); return; }
        api.set(textId, { 'lineSpacing': Math.round(ls * 1000) / 1000 });
    } catch (e) {}
}

// Mixed styling: every run after the first that differs from the base style becomes a
// Cavalry style/material behaviour on a character range (indices are inclusive and
// count newlines, verified live). Tracking differences are not range-addressable in
// Cavalry (applyCharacterSpacing is regex-pair based) and are reported instead.
function _affApplyTextRuns(textId, name, runs, base, baseFamily, baseStyle, baseFontSize, scale, node) {
    var order = 0;
    for (var i = 1; i < runs.length; i++) {
        var r = runs[i];
        if (!r || typeof r.start !== 'number' || typeof r.end !== 'number' || r.end <= r.start) continue;
        var indices = (r.end - r.start === 1) ? String(r.start) : (r.start + ':' + (r.end - 1));
        var label = ' ' + (++order);
        var size = (r.size || base.size || 12) * scale;
        if (Math.abs(size - baseFontSize) > 0.01) {
            try {
                var fsId = api.create('applyFontSize', 'Size' + label);
                api.set(fsId, { 'mode': 1, 'indexMode': 2, 'indices': indices, 'fontSize': size });
                api.connect(fsId, 'id', textId, 'styleBehaviours');
                api.parent(fsId, textId);
            } catch (eFs) { _affWarn("'" + name + "': could not apply font size to run " + i + ': ' + eFs.message); }
        }
        var family = r.family || baseFamily;
        try { if (typeof resolveFontFamilyForCavalry === 'function') family = resolveFontFamilyForCavalry(family, size); } catch (eFam) {}
        var style = _affPickFontStyle(family, r.style, r.weight, r.isItalic, r.postscriptName);
        if (family !== baseFamily || style !== baseStyle) {
            try {
                var tfId = api.create('applyTypeface', 'Typeface' + label);
                api.set(tfId, { 'mode': 1, 'indexMode': 2, 'indices': indices });
                try { api.set(tfId, { 'font.font': family, 'font.style': style }); } catch (eFont) { try { api.set(tfId, { 'font.font': family }); } catch (eFont2) {} }
                api.connect(tfId, 'id', textId, 'styleBehaviours');
                api.parent(tfId, textId);
            } catch (eTf) { _affWarn("'" + name + "': could not apply typeface to run " + i + ': ' + eTf.message); }
        }
        var bf = base.fill && base.fill.colour ? base.fill.colour : null;
        var rf = r.fill && r.fill.colour ? r.fill.colour : null;
        var colourDiffers = rf && (!bf || bf.r !== rf.r || bf.g !== rf.g || bf.b !== rf.b || Math.abs(_affAlpha(bf) - _affAlpha(rf)) > 0.001);
        if (colourDiffers && r.fill.type === 'Solid') {
            try {
                var mtId = api.create('applyTextMaterial', 'Colour' + label);
                api.set(mtId, { 'mode': 1, 'indexMode': 2, 'indices': indices });
                api.set(mtId, { 'material.materialColor': _affHex(rf), 'material.alpha': Math.round(_affFillAlpha(r.fill, node) * 1000) / 10 });
                api.connect(mtId, 'id', textId, 'materialBehaviours');
                api.parent(mtId, textId);
            } catch (eMt) { _affWarn("'" + name + "': could not apply colour to run " + i + ': ' + eMt.message); }
        }
        if (typeof r.tracking === 'number' && typeof base.tracking === 'number' && Math.abs(r.tracking - base.tracking) > 0.001) {
            _affWarn("'" + name + "': run " + i + " has different tracking; Cavalry cannot apply tracking to a character range, base tracking kept");
        }
    }
}
function _affCreateTextAsPath(node, parentId, vb) {
    if (node.text && node.text.kind === 'path') { _affWarn("'" + node.name + "' is text on a path; enable live text to import it"); return null; }
    if (node.curves && node.curves.length) {
        var id = _affCreatePathLayer(node, parentId, vb);
        return id ? { id: id, rotationDeg: 0, isPath: true } : null;
    }
    return null;
}


// Store an inbox image in the project's Assets/Quiver folder, named the way the Figma path names
// its files: <Frame>_<Layer>_<hash8>.<ext> (frame = enclosing artboard or the document title, layer =
// the Affinity layer name without its extension, hash = Quiver's _hashString over the file's
// base64). Identical content maps to the same file, so re-sends overwrite instead of piling up.
// Returns the project path, or null when the copy could not land (caller falls back to the inbox).
var __affinityImageStoreCache = {};   // inbox path -> project path
var __affinityImageHashCache = {};    // content hash -> project path
var __affinityAssetCache = {};        // project path -> asset id (one asset per file)
var __affinityInboxFallback = false;  // an asset still points at the inbox, so nothing may be deleted
var __affinityFolderWarned = false;
function _affImageFileName(node, ext) {
    var clean = function (v) { try { return (typeof _sanitizeFileComponent === 'function') ? _sanitizeFileComponent(String(v)) : String(v).replace(/[\\/:*?"<>|\x00-\x1F\x7F]+/g, '_'); } catch (e) { return String(v).replace(/[^A-Za-z0-9_-]+/g, '_'); } };
    var frame = (node && node.image && node.image.frameName) ? node.image.frameName : (__affinityDocTitle || 'Affinity');
    var layer = (node && node.name) ? String(node.name).replace(/\.[a-z0-9]{2,5}$/i, '') : 'image';
    return { frame: clean(frame).replace(/\s+/g, '_') || 'Affinity', base: clean(layer).replace(/\s+/g, '_') || 'image', ext: ext };
}
function _affStoreImageInProject(srcPath, node) {
    try {
        if (!srcPath || !api.filePathExists || !api.filePathExists(srcPath)) return null;
        if (__affinityImageStoreCache[srcPath]) return __affinityImageStoreCache[srcPath];
        if (typeof _ensureAssetsQuiverFolder !== 'function' || !api.encodeBinary || !api.writeEncodedToBinaryFile) return null;
        var dir = _ensureAssetsQuiverFolder(); // <project>/Assets/Quiver, or a picked folder when the scene is unsaved
        if (!dir) {
            if (!__affinityFolderWarned) { __affinityFolderWarned = true; _affWarn('no project Assets folder (save the scene or pick a folder); the images stay where Affinity wrote them (Desktop)'); }
            return null;
        }
        var b64 = api.encodeBinary(srcPath);
        if (!b64) return null;
        // the whole file: same-size uncompressed PNGs share their first bytes and their length
        var hash = (typeof _hashString === 'function') ? _hashString(b64) : String(b64.length);
        if (__affinityImageHashCache[hash] && api.filePathExists(__affinityImageHashCache[hash])) {
            __affinityImageStoreCache[srcPath] = __affinityImageHashCache[hash];
            return __affinityImageStoreCache[srcPath];
        }
        var ext = (srcPath.match(/\.[a-z0-9]+$/i) || ['.png'])[0].toLowerCase();
        var parts = _affImageFileName(node, ext);
        var dest = dir + '/' + parts.frame + '_' + parts.base + '_' + hash + parts.ext;
        if (!api.filePathExists(dest)) {
            var ok = api.writeEncodedToBinaryFile(dest, b64);
            if (!ok || !api.filePathExists(dest)) return null;
        }
        __affinityImageStoreCache[srcPath] = dest;
        __affinityImageHashCache[hash] = dest;
        return dest;
    } catch (e) {
        _affWarn('could not store image in the project assets folder: ' + e.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Images: rectangle + image shader (same wiring as Quiver's SVG image import)
// ---------------------------------------------------------------------------
function _affCreateImageLayer(node, parentId, vb) {
    var W = _affMat(node.world);
    var dec = _affDecompose(W);
    var box = node.localBox || { x: 0, y: 0, w: 0, h: 0 };
    // An empty pixel layer (Affinity reports an infinite/zero box, e.g. an unpainted "Fill" or
    // mask raster) has nothing to show: skip it instead of leaving a 0x0 placeholder behind.
    if (!(box.w > 0 && box.h > 0 && isFinite(box.w) && isFinite(box.h)) || (node.spreadBox && !(isFinite(node.spreadBox.x) && isFinite(node.spreadBox.y)))) {
        console.info("🏹 Quiver/Affinity: skipped empty pixel layer '" + (node.name || 'raster') + "'");
        return null;
    }
    // A cropped placed image: Affinity's baseBox is the visible crop window in image pixels while
    // the picture itself spans (0,0)-(pixelWidth,pixelHeight) (verified: a 3200x4000 photo with
    // baseBox y 2143 h 1490 rendered as the 1340x624 strip). Like a cropped Figma image, the
    // rectangle is the crop window and the shader places the whole picture inside it, so resizing
    // the rectangle in Cavalry re-crops it.
    var pw = node.image ? node.image.pixelWidth : 0, ph = node.image ? node.image.pixelHeight : 0;
    var cropped = _affIsCroppedImage(node);
    var w = box.w * Math.abs(dec.sx), h = box.h * Math.abs(dec.sy);
    var centre = _affApply(W, box.x + box.w / 2, box.y + box.h / 2);
    var pos = _affToCavalry(centre.x, centre.y, vb);
    // Layer name without the source file's extension ("Untitled.png" -> "Untitled"), like Figma layers read
    var layerName = String(node.name || 'Image').replace(/\.[a-z0-9]{2,5}$/i, '') || 'Image';
    var id = api.primitive('rectangle', layerName);
    if (parentId) api.parent(id, parentId);
    api.set(id, { 'generator.dimensions': [w, h], 'position.x': pos.x, 'position.y': pos.y });
    // A mirrored placement (negative determinant, e.g. Affinity's Flip Horizontal gives
    // [-1,0,tx,0,1,0]) decomposes to rotation 180 plus a y flip; both must be applied or the
    // image ends up upside down.
    if (Math.abs(dec.rotation) > 0.01) { try { api.set(id, { 'rotation': -dec.rotation }); } catch (eRot) {} }
    if (dec.sy < 0) { try { api.set(id, { 'scale.y': -1 }); } catch (eFlip) {} }
    var path = node.image && node.image.path;
    if (!path || !_affSetting('importImageryEnabled', true)) {
        try { api.setFill(id, true); api.set(id, { 'material.materialColor': '#9a9a9a' }); } catch (e) {}
        if (!path && __affinityImagesIncluded) _affWarn("'" + node.name + "' has no exported image file (check the Affinity script's file access), placeholder used");
        return { id: id, rotationDeg: dec.rotation, isPath: false };
    }
    var shaderNode = _affImageShader(node, path, layerName);
    try {
        api.setFill(id, true);
        api.set(id, { 'material.materialColor.a': 0 });
        api.connect(shaderNode, 'id', id, 'material.colorShaders');
        api.parent(shaderNode, id);
        if (!cropped || !_affPlaceCroppedPicture(shaderNode, box, pw, ph, dec)) { try { api.set(shaderNode, { 'scaleMode': 4 }); } catch (eSM) {} }
    } catch (eWire) {}
    return { id: id, rotationDeg: dec.rotation, isPath: false };
}
// An image shader reading the node's picture. Like the Figma path, imported images live with the
// project: the file is copied from the inbox into <project>/Assets/Quiver (Quiver's own helper
// resolves/creates that folder), falling back to the inbox file when the scene has no project path
// yet or the copy did not land. One asset per file; decal tiling so nothing repeats past the picture.
function _affImageShader(node, path, layerName) {
    var saved = _affStoreImageInProject(path, node);
    var assetId = null;
    var usedPath = null;
    var candidates = (saved && saved !== path) ? [saved, path] : [path];
    for (var ci = 0; ci < candidates.length && !assetId; ci++) {
        var cand = candidates[ci];
        if (__affinityAssetCache[cand]) { assetId = __affinityAssetCache[cand]; usedPath = cand; break; }
        try { if (api.loadAsset) assetId = api.loadAsset(cand, false); } catch (eLoad) { assetId = null; }
        if (!assetId) { try { if (api.importAsset) assetId = api.importAsset(cand); } catch (eImp) { assetId = null; } }
        if (assetId) {
            usedPath = cand; __affinityAssetCache[cand] = assetId;
            // Renaming an asset costs about a second in Cavalry (measured, growing with the scene) and
            // loadAsset hands back the asset the scene already holds for a file, usually already named.
            var wanted = api.getFileNameFromPath ? api.getFileNameFromPath(cand, false) : cand;
            try { if (api.rename && api.getNiceName(assetId) !== wanted) api.rename(assetId, wanted); } catch (eRn) {}
        }
    }
    if (usedPath === path) __affinityInboxFallback = true; // still reading from the inbox: keep the inbox files
    __affinityImageCounter++;
    var shaderNode = api.create('imageShader', layerName + '_' + __affinityImageCounter);
    if (assetId) {
        try { api.connect(assetId, 'id', shaderNode, 'image'); } catch (eConn) {}
        try { if (typeof _ensureQuiverAssetGroup === 'function') { var grp = _ensureQuiverAssetGroup(); if (grp) api.parent(assetId, grp); } } catch (eGrp) {}
    } else {
        __affinityInboxFallback = true;
        _affWarn("could not load image asset " + (saved || path));
    }
    try { api.set(shaderNode, { 'tilingX': 3, 'tilingY': 3 }); } catch (eT) {}
    try { api.set(shaderNode, { 'filterQuality': _affSetting('imageFilterQuality', 2) }); } catch (eFQ) {}
    return shaderNode;
}
// (a render made by the export fallback, original: false, already shows just the crop window)
function _affIsCroppedImage(node) {
    var box = node.localBox, pw = node.image ? node.image.pixelWidth : 0, ph = node.image ? node.image.pixelHeight : 0;
    return !!(box && node.kind === 'image' && node.image && node.image.path && node.image.original !== false && pw > 0 && ph > 0 && (Math.abs(box.x) > 0.5 || Math.abs(box.y) > 0.5 || Math.abs(box.w - pw) > 0.5 || Math.abs(box.h - ph) > 0.5));
}
// The picture spans (0,0)-(pw,ph) in the image's local pixels and the rectangle shows `box` of it.
// The shader draws the file at its own pixel size (Scale Mode None), scaled to the placement, with
// its centre offset from the rectangle's centre in layer pixels (+y up).
function _affPlaceCroppedPicture(shaderNode, box, pw, ph, dec) {
    var res = null;
    try { res = api.get(shaderNode, 'outResolution'); } catch (eRes) { res = null; }
    var fw = (res && res.x > 0) ? res.x : pw, fh = (res && res.y > 0) ? res.y : ph;
    var sx = Math.abs(dec.sx), sy = Math.abs(dec.sy);
    try {
        api.set(shaderNode, { 'scaleMode': 0, 'scale.x': pw * sx / fw, 'scale.y': ph * sy / fh,
            'offset.x': (pw / 2 - (box.x + box.w / 2)) * sx, 'offset.y': -(ph / 2 - (box.y + box.h / 2)) * sy });
        return true;
    } catch (e) { _affWarn('could not place the cropped picture: ' + e.message); return false; }
}

// ---------------------------------------------------------------------------
// Clipping: Affinity draws a shape's children clipped to the shape
// ---------------------------------------------------------------------------
// A layer wired into another layer's `masks` list is consumed as a mask and no
// longer draws itself, so the clipper must NOT be used directly. Instead a
// hidden, style-free copy of its geometry is built once per clipper.
// ids of mattes that clip by ALPHA (a hidden copy of an image/pixel layer): wired into
// `trackMattes` rather than `masks`, because Affinity clips children to a pixel layer's painted
// alpha, not to its bounding box (the Catsnake tongue was cut flat by its parent's box, 2026-10-13).
var __affAlphaMattes = {};
function _affCreateMaskFor(clipperNode, parentId, vb) {
    if ((clipperNode.kind === 'image' || clipperNode.kind === 'raster') && clipperNode.image && clipperNode.image.path) {
        // A second image layer over the same file (the asset and the project copy are shared through
        // the caches). api.duplicate was tried first: its shallow copy ended up showing the NEXT
        // imported layer's image, so the copy is built from the record instead.
        try {
            var imgStub = {};
            for (var ik in clipperNode) imgStub[ik] = clipperNode[ik];
            imgStub.children = []; imgStub.enclosures = []; imgStub.clipsChildren = false; imgStub.effects = [];
            imgStub.opacity = 1; imgStub.blendMode = 'Normal'; imgStub.visible = true; imgStub.transparency = null; imgStub.id = null;
            imgStub.name = (clipperNode.name || 'Clip') + ' (mask)';
            var madeImg = _affCreateImageLayer(imgStub, parentId, vb);
            if (madeImg && madeImg.id) {
                try { api.set(madeImg.id, { 'hidden': true }); } catch (eH) {}
                __affAlphaMattes[madeImg.id] = true;
                return madeImg.id;
            }
        } catch (eDup) { _affWarn("'" + clipperNode.name + "': could not build the pixel matte for clipping (" + eDup.message + "), clipping to its box instead"); }
    }
    var stub = {};
    for (var k in clipperNode) stub[k] = clipperNode[k];
    stub.fill = null; stub.stroke = null; stub.effects = []; stub.children = []; stub.clipsChildren = false;
    stub.opacity = 1; stub.blendMode = 'Normal'; stub.visible = true;
    stub.name = (clipperNode.name || 'Clip') + ' (mask)';
    var created = null;
    if (stub.kind === 'image' || stub.kind === 'raster') {
        stub.kind = 'shape'; stub.shape = { type: 'Rectangle', corners: {}, isPlainRectangle: true }; stub.curves = _affBoxCurves(stub.localBox);
        created = _affCreateShapeLayer(stub, parentId, vb);
    } else if (stub.kind === 'shape') {
        created = _affCreateShapeLayer(stub, parentId, vb);
    } else if (stub.kind === 'curve' || (stub.curves && stub.curves.length)) {
        var pid = _affCreatePathLayer(stub, parentId, vb); created = pid ? { id: pid } : null;
    } else if (stub.kind === 'text') {
        created = _affCreateTextAsPath(stub, parentId, vb);
    }
    if (!created || !created.id) return null;
    try { api.setFill(created.id, true); api.set(created.id, { 'material.materialColor': '#ffffff' }); } catch (eF) {}
    try { api.setStroke(created.id, false); } catch (eS) {}
    try { api.set(created.id, { 'hidden': true }); } catch (eH) {}
    return created.id;
}
// A picture clipped by a shape draws inside the shape's fill and under its stroke (verified in
// Affinity: a clipper's stroke covers what it clips), which is an image shader stacked on the
// clipper's material: one layer instead of the picture, a hidden copy of the clipper and the
// clipper. A picture clipped by another picture keeps to that picture's painted alpha through the
// Source Atop shader blend. Only plain pictures ride: no effects, masks, transparency, blend
// mode, children or crop, and clippers without effects (their compositing was not verified).
function _affCanCarryPictures(node) {
    if (node.__noRiders || (node.effects && node.effects.length)) return false;
    if (node.kind === 'shape' || node.kind === 'curve') return true;
    return (node.kind === 'image' || node.kind === 'raster') && !!(node.image && node.image.path);
}
function _affCanRideClipper(child) {
    return !!(child && (child.kind === 'image' || child.kind === 'raster') && child.image && child.image.path && !child.fillLayer && !child.pixelMask
        && !(child.children && child.children.length) && !(child.enclosures && child.enclosures.length) && !(child.effects && child.effects.length)
        && !(child.transparency && child.transparency.type && child.transparency.type !== 'None')
        && (!child.blendMode || child.blendMode === 'Normal') && child.localBox && child.localBox.w > 0 && child.localBox.h > 0 && !_affIsCroppedImage(child));
}
// A fill layer tints everything beneath it inside the clip, which on the rider path is the
// clipper's own fill plus the pictures on its material. It joins them only where an opaque picture
// covers the clipper's visible area (elsewhere the material is see-through).
function _affFillCanRideClipper(fill, clipper, ridden, vb) {
    if (!fill || fill.visible === false || !fill.fill || !fill.fillLayer || fill.fillLayer === 'complex') return false;
    if ((fill.effects && fill.effects.length) || (fill.enclosures && fill.enclosures.length)) return false;
    var cb = clipper.spreadBox;
    if (!cb || !isFinite(cb.w)) return false;
    var visible = _affBoxIntersect(cb, { x: vb.x, y: vb.y, w: vb.width, h: vb.height }), tol = 2;
    if (!(visible.w > 0 && visible.h > 0)) return false;
    return ridden.some(function (p) {
        if (!p.localBox || (typeof p.opacity === 'number' && p.opacity < 0.999)) return false;
        var pb = _affBounds(_affBoxCorners(p.localBox, _affMat(p.world)));
        return pb.x <= visible.x + tol && pb.y <= visible.y + tol && pb.x + pb.w >= visible.x + visible.w - tol && pb.y + pb.h >= visible.y + visible.h - tol;
    });
}
// A picture placed in spread space by `world` (picture pixels -> spread) as seen from a host layer's own
// frame (see _affHostFrame): { M, lx, ly, flip }, or null when the placement is skewed.
function _affFrameMatrix(hf, world) {
    var M = _affMatMul(_affMatMul([1, 0, -hf.centre.x, 0, 1, -hf.centre.y], hf.frame), world);
    var lx = Math.sqrt(M[0] * M[0] + M[3] * M[3]), ly = Math.sqrt(M[1] * M[1] + M[4] * M[4]);
    var det = M[0] * M[4] - M[1] * M[3];
    if (!det || Math.abs(M[0] * M[1] + M[3] * M[4]) > 1e-3 * lx * ly) return null;
    // a negative scale.x mirrors the image about its own centre, before the rotation (measured)
    return { M: M, lx: lx, ly: ly, flip: det < 0 ? -1 : 1 };
}
// Image shader attributes for that placement: P is the picture's pixel box, fw x fh the asset's resolution.
function _affImageAttrs(fm, P, fw, fh) {
    var c = _affApply(fm.M, P.x + P.w / 2, P.y + P.h / 2);
    var attrs = { 'scaleMode': 0, 'scale.x': fm.flip * fm.lx * P.w / fw, 'scale.y': fm.ly * P.h / fh, 'offset.x': c.x, 'offset.y': -c.y };
    var rot = Math.atan2(fm.flip * fm.M[3], fm.flip * fm.M[0]) * 180 / Math.PI;
    if (Math.abs(rot) > 0.01) attrs.rotation = -rot;
    return attrs;
}
function _affPictureOnClipper(hostId, hostNode, isPath, child, vb) {
    if (!_affSetting('importImageryEnabled', true)) return false;
    var hf = _affHostFrame(hostId, hostNode, isPath, vb);
    if (!hf) return false;
    var fm = _affFrameMatrix(hf, _affMat(child.world));
    if (!fm) return false; // skewed: keep it a layer
    var shaderNode = _affImageShader(child, child.image.path, String(child.name || 'Image').replace(/\.[a-z0-9]{2,5}$/i, '') || 'Image');
    if (!shaderNode) return false;
    try {
        // the picture draws in the host's fill, so a clipper without one gets an invisible fill
        var hostFills = !!(hostNode.fill && hostNode.fill.type !== 'None') || !!(hostNode.fills && hostNode.fills.some(function (f) { return f && f.type !== 'None'; }));
        if (!hostFills && hostNode.kind !== 'image' && hostNode.kind !== 'raster') { api.setFill(hostId, true); api.set(hostId, { 'material.materialColor.a': 0 }); }
        api.connect(shaderNode, 'id', hostId, 'material.colorShaders');
        api.parent(shaderNode, hostId);
        var res = null;
        try { res = api.get(shaderNode, 'outResolution'); } catch (eRes) { res = null; }
        var P = child.localBox;
        var fw = (res && res.x > 0) ? res.x : (child.image.pixelWidth || P.w), fh = (res && res.y > 0) ? res.y : (child.image.pixelHeight || P.h);
        var attrs = _affImageAttrs(fm, P, fw, fh);
        if (typeof child.opacity === 'number' && child.opacity < 0.999) attrs.alpha = Math.round(child.opacity * 1000) / 10;
        if (hostNode.kind === 'image' || hostNode.kind === 'raster') attrs.blendMode = 9; // Source Atop: only where the host picture is painted
        api.set(shaderNode, attrs);
        if (child.id) __affRiddenOn[child.id] = hostNode;
        return true;
    } catch (e) {
        try { api.deleteLayer(shaderNode); } catch (eDel) {}
        _affWarn("'" + child.name + "': could not place it on '" + hostNode.name + "' (" + e.message + "), imported as a clipped layer");
        return false;
    }
}
// A vector brush stroke arrives with a grey+alpha mask of the stroke as Affinity rendered it. The mask
// sits on the stroke in Destination In mode, so the stroke keeps its own (editable) colour and shows
// only where the brush painted, grain included; trims and draw-ons still work. The texture stays where
// it was rendered if the path's points are edited.
function _affApplyBrushMask(id, node, isPath, vb) {
    var b = node.stroke && node.stroke.brush;
    if (!b || !b.path || !b.box || !(b.pixelWidth > 0) || !_affSetting('importImageryEnabled', true)) return false;
    var hf = _affHostFrame(id, node, isPath, vb);
    var fm = hf ? _affFrameMatrix(hf, [b.box.w / b.pixelWidth, 0, b.box.x, 0, b.box.h / b.pixelHeight, b.box.y]) : null;
    if (!fm) return false;
    var shaderNode = _affImageShader(node, b.path, String(node.name || 'Stroke') + ' brush');
    if (!shaderNode) return false;
    try {
        api.connect(shaderNode, 'id', id, 'stroke.colorShaders');
        api.parent(shaderNode, id);
        var res = null; try { res = api.get(shaderNode, 'outResolution'); } catch (eRes) {}
        var attrs = _affImageAttrs(fm, { x: 0, y: 0, w: b.pixelWidth, h: b.pixelHeight }, (res && res.x > 0) ? res.x : b.pixelWidth, (res && res.y > 0) ? res.y : b.pixelHeight);
        if (b.image) api.set(id, { 'stroke.strokeColor.a': 0 }); // an image brush shows its own picture over a clear stroke
        else attrs.blendMode = 6; // Destination In: keep the stroke colour where the mask is painted
        api.set(shaderNode, attrs);
        return true;
    } catch (e) {
        try { api.deleteLayer(shaderNode); } catch (eDel) {}
        _affWarn("'" + node.name + "': could not apply its brush texture (" + e.message + "), drawn as a plain stroke");
        return false;
    }
}
// Rebuilt brush textures ("Rebuild brush textures in Cavalry" in the Affinity dialog): the stroke
// arrives with its measured width (and taper) and the inputs fitted by the Affinity script
// (fitBrushTexture), and this SkSL filter grows the brush's grain on the editable stroke, so the
// texture follows the path when it is reshaped or drawn on. The filter reads the stroke's direction
// from its own shape (a ring of alpha samples), smears value noise along or across it for grain,
// fibres and bristle streaks, or stamps dashes for spatter, and roughens the edges. Inputs: n0 ring
// radius, n1 edge amplitude, n2 edge fibre width, n3 grain threshold, n4 grain width, n5 grain
// half-length, n6 across the stroke, n7 seed, n8 clump amount, n9 clump size, n10 softness, n11 stamp
// mode, n12 stamp cell, n13 stamp length, n14 stamp slant, n15 stamp density, n16 fibre angle jitter,
// n17 opacity, n18 rim (> 0 denser towards the edges, < 0 softer), n19 streak tone variation; long
// streaks bend with the stroke. The stroke's ends come from the
// measured taper, with a round cap only where the brush paints past the path's end.
var AFFINITY_BRUSH_SKSL = [
    "uniform shader layer;",
    "",
    "float hash12(float2 p) {",
    "    float3 p3 = fract(float3(p.xyx) * 0.1031);",
    "    p3 += dot(p3, p3.yzx + 33.33);",
    "    return fract((p3.x + p3.y) * p3.z);",
    "}",
    "float vnoise(float2 x) {",
    "    float2 i = floor(x);",
    "    float2 f = fract(x);",
    "    float2 u = f * f * (3.0 - 2.0 * f);",
    "    float a = hash12(i);",
    "    float b = hash12(i + float2(1.0, 0.0));",
    "    float c = hash12(i + float2(0.0, 1.0));",
    "    float d = hash12(i + float2(1.0, 1.0));",
    "    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
    "}",
    "// value noise smeared along a line through p (line integral convolution): thin across dir, long along",
    "// it; kappa (1/px) bends the line so streaks follow a curving stroke",
    "float oriented(float2 p, float2 dir, float kappa, float w, float halfLen, float seed) {",
    "    float2 bend = float2(-dir.y, dir.x) * (0.5 * kappa);",
    "    // samples no further apart than the noise grain, or the smear shows separate copies",
    "    float count = clamp(ceil(2.0 * halfLen / (0.7 * w)) + 1.0, 1.0, 48.0);",
    "    float acc = 0.0;",
    "    for (int i = 0; i < 48; i++) {",
    "        if (float(i) >= count) { break; }",
    "        float s = count > 1.0 ? (float(i) / (count - 1.0) - 0.5) * 2.0 * halfLen : 0.0;",
    "        acc += vnoise((p + dir * s + bend * (s * s)) / w + seed);",
    "    }",
    "    acc /= count;",
    "    float k = sqrt(max(1.0, 2.0 * halfLen / w));",
    "    return clamp(0.5 + (acc - 0.5) * k, 0.0, 1.0);",
    "}",
    "// the stroke's direction from a ring of alpha samples: covered samples cluster along the stroke",
    "// (second moment) in the middle; near an edge the first moment points inward. z = how much the",
    "// covered samples sit ahead or behind rather than beside: high at the stroke's ends, where the",
    "// direction cannot be read and fans out",
    "float3 tangentAt(float2 p, float r) {",
    "    float cxx = 0.0; float cxy = 0.0; float cyy = 0.0; float sa = 0.0; float2 m = float2(0.0);",
    "    for (int k = 0; k < 16; k++) {",
    "        float ang = float(k) * 0.392699;",
    "        float2 e = float2(cos(ang), sin(ang));",
    "        float a = layer.eval(p + e * r).a;",
    "        cxx += a * e.x * e.x; cxy += a * e.x * e.y; cyy += a * e.y * e.y; sa += a; m += a * e;",
    "    }",
    "    cxx = (cxx - 0.5 * sa) / 16.0; cyy = (cyy - 0.5 * sa) / 16.0; cxy /= 16.0; m /= 16.0;",
    "    float jxx = cxx - 0.5 * m.x * m.x; float jxy = cxy - 0.5 * m.x * m.y; float jyy = cyy - 0.5 * m.y * m.y;",
    "    float h = 0.5 * (jxx - jyy);",
    "    float lam = 0.5 * (jxx + jyy) + sqrt(h * h + jxy * jxy);",
    "    float2 v = abs(jxy) > 0.000001 ? float2(jxy, lam - jxx) : (jxx >= jyy ? float2(1.0, 0.0) : float2(0.0, 1.0));",
    "    v = normalize(v);",
    "    return float3(v, smoothstep(0.04, 0.2, abs(dot(m, v))));",
    "}",
    "// one dash per cell (spatter): kept with probability density, random position and length, laid along dir turned by slant",
    "float stamps(float2 p, float2 dir, float cell, float len, float wid, float slant, float density, float seed) {",
    "    float cs = cos(slant); float sn = sin(slant);",
    "    float2 d = float2(dir.x * cs - dir.y * sn, dir.x * sn + dir.y * cs);",
    "    float2 base = floor(p / cell);",
    "    float best = 0.0;",
    "    for (int j = -1; j <= 1; j++) {",
    "        for (int i = -1; i <= 1; i++) {",
    "            float2 cid = base + float2(float(i), float(j));",
    "            if (hash12(cid + seed * 7.0) <= density) {",
    "                float2 ctr = (cid + float2(hash12(cid + 11.0), hash12(cid + 23.0))) * cell;",
    "                float L = len * (0.6 + 0.8 * hash12(cid + 37.0));",
    "                float2 q = p - ctr;",
    "                float along = clamp(dot(q, d), -0.5 * L, 0.5 * L);",
    "                float dist = length(q - d * along);",
    "                best = max(best, smoothstep(0.5 * wid + 0.6, 0.5 * wid - 0.6, dist));",
    "            }",
    "        }",
    "    }",
    "    return best;",
    "}",
    "// distance from p to the stroke's edge along dir (where its alpha drops below half of a0), up to maxD",
    "float edgeDistance(float2 p, float2 dir, float a0, float maxD) {",
    "    float prev = 0.0;",
    "    for (int i = 1; i <= 16; i++) {",
    "        float d = maxD * float(i) / 16.0;",
    "        if (layer.eval(p + dir * d).a < 0.5 * a0) {",
    "            float lo = prev; float hi = d;",
    "            for (int k = 0; k < 4; k++) { float mid = 0.5 * (lo + hi); if (layer.eval(p + dir * mid).a < 0.5 * a0) { hi = mid; } else { lo = mid; } }",
    "            return 0.5 * (lo + hi);",
    "        }",
    "        prev = d;",
    "    }",
    "    return maxD;",
    "}",
    "// n0 ring radius, n1 edge amplitude, n2 edge fibre width, n3 grain threshold, n4 grain width,",
    "// n5 grain half-length, n6 grain or dashes across the stroke (0 along, 1 across), n7 seed, n8 clump amount, n9 clump size,",
    "// n10 grain softness, n11 stamp mode, n12 stamp cell, n13 stamp length, n14 stamp slant, n15 stamp density, n16 fibre angle jitter,",
    "// n17 opacity, n18 rim (> 0 denser towards the edges, < 0 softer edges), n19 streak tone variation",
    "half4 main(float2 p) {",
    "    float3 te = tangentAt(p, n0);",
    "    float2 t = te.xy;",
    "    float2 nr = float2(-t.y, t.x);",
    "    float jit = (vnoise(p / 6.0 + n7 * 5.3) - 0.5) * 2.0 * n16;",
    "    float2 fd = float2(nr.x * cos(jit) - nr.y * sin(jit), nr.x * sin(jit) + nr.y * cos(jit));",
    "    float h = (oriented(p, fd, 0.0, max(n2, 0.5), 0.5 * n1, n7) - 0.5) * 2.0 * n1;",
    "    half4 c = layer.eval(p + fd * h);",
    "    float a = c.a;",
    "    if (a <= 0.0) { return half4(0.0); }",
    "    if (n11 > 0.5) {",
    "        a *= stamps(p, n6 > 0.5 ? nr : t, max(n12, 1.0), mix(n13, n4, te.z), max(n4, 0.5), n14, n15, n7);",
    "    } else if (n3 > 0.0 || n19 > 0.0) {",
    "        float2 gd = n6 > 0.5 ? nr : t;",
    "        float len = mix(n5, 0.5 * n4, te.z);",
    "        // long streaks bend with the stroke: its direction read half a streak ahead and behind",
    "        float kappa = 0.0;",
    "        if (n6 < 0.5 && len > 2.0 * n4) {",
    "            float hs = 0.5 * len;",
    "            float2 tf = tangentAt(p + t * hs, n0).xy;",
    "            float2 tb = tangentAt(p - t * hs, n0).xy;",
    "            if (dot(tf, t) < 0.0) { tf = -tf; }",
    "            if (dot(tb, t) < 0.0) { tb = -tb; }",
    "            kappa = (tb.x * tf.y - tb.y * tf.x) / (2.0 * hs);",
    "        }",
    "        if (n3 > 0.0) {",
    "            float g = oriented(p, gd, kappa, max(n4, 0.5), len, n7 + 17.0);",
    "            float thr = n3 + n8 * (vnoise(p / max(n9, 1.0) + n7 * 3.1) - 0.5) * 2.0;",
    "            float soft = max(n10, 0.005);",
    "            a *= smoothstep(thr - soft, thr + soft, g);",
    "        }",
    "        // each streak its own tone (painterly brushes): a second smear, a little wider",
    "        if (n19 > 0.0) { a *= 1.0 - n19 * (1.0 - oriented(p, gd, kappa, 1.5 * max(n4, 0.5), len, n7 + 31.0)); }",
    "    }",
    "    if (abs(n18) > 0.001) {",
    "        float a0 = layer.eval(p).a;",
    "        float dp = edgeDistance(p, nr, a0, 1.5 * n0);",
    "        float dm = edgeDistance(p, -nr, a0, 1.5 * n0);",
    "        float s = abs(dp - dm) / max(dp + dm, 1.0);",
    "        a *= 1.0 + n18 * (smoothstep(0.5, 1.0, s) - 0.35);",
    "    }",
    "    a = clamp(a * n17, 0.0, 1.0);",
    "    half3 straight = c.rgb / c.a;",
    "    return half4(straight * a, a);",
    "}"
].join('\n');
// A filter textures its whole layer, so on a shape that also has a fill the stroke moves to an Outline
// layer just above it (geometry that follows the shape's path live) and the filter goes there; the
// outline is the shape's companion and gets its opacity, blend mode, tag and clipping too.
var __affCompanions = {}; // Cavalry layer id -> companion layers (a filled brush shape's outline)
var __affBrushFallbacks = []; // why each brush stroke kept Affinity's render although a rebuild was asked for
function _affHasFill(node) {
    return !!(node.fill && node.fill.type !== 'None') || !!(node.fills && node.fills.some(function (f) { return f && f.type !== 'None'; }));
}
function _affApplyBrushNative(id, node) {
    var b = node.stroke && node.stroke.brushNative, stroke = node.stroke;
    if (!b || !(b.width > 0) || !b.params || [17, 19, 20].indexOf(b.params.length) < 0) return false;
    var params = b.params.concat([1, 0, 0].slice(b.params.length - 17)); // earlier scripts sent 17 or 19 (no opacity, rim or tone)
    var cap = b.cap === 'flat' ? 0 : (b.cap === 'round' ? 1 : AFFINITY_CAP[stroke.cap]);
    var outlined = _affHasFill(node);
    if (outlined && (!stroke.fill || stroke.fill.type !== 'Solid')) { _affWarn("'" + node.name + "': a brushed stroke with a gradient on a filled shape is drawn as a plain stroke"); return false; }
    var f = null, ol = null;
    try {
        var target = id;
        if (outlined) {
            ol = api.create('outline', String(node.name || 'Shape') + ' brush stroke');
            var parent = api.getParent(id);
            if (parent) api.parent(ol, parent);
            api.connect(id, 'id', ol, 'inputShape');
            var oa = { width: b.width, align: AFFINITY_ALIGN[stroke.align] || 0 };
            if (cap !== undefined) oa.capStyle = cap;
            if (AFFINITY_JOIN[stroke.join] !== undefined) oa.joinStyle = AFFINITY_JOIN[stroke.join];
            if (typeof stroke.miterLimit === 'number') oa.miter = stroke.miterLimit;
            var pen = stroke.fill;
            oa['material.materialColor'] = _affHex(pen.colour);
            oa['material.alpha'] = Math.round((typeof pen.alpha === 'number' ? Math.min(pen.alpha, _affAlpha(pen.colour)) : _affAlpha(pen.colour)) * 1000) / 10;
            api.set(ol, oa);
            api.setStroke(id, false);
            if (stroke.behind) _affWarn("'" + node.name + "': its brushed stroke is drawn in front of the fill, not behind it");
            target = ol;
        } else {
            api.set(id, { 'stroke.width': b.width });
            if (cap !== undefined) api.set(id, { 'stroke.capStyle': cap });
            if (b.profile && b.profile.length > 1) {
                api.set(id, { 'stroke.taperedWidth': true });
                for (var k = 2; k < b.profile.length; k++) api.addArrayIndex(id, 'stroke.widthGraph'); // the graph starts with two points
                b.profile.forEach(function (v, i) {
                    var base = 'stroke.widthGraph.' + i + '.', a = {};
                    a[base + 'position.x'] = i / (b.profile.length - 1); a[base + 'position.y'] = Math.max(0, Math.min(1, v)); a[base + 'interpolation'] = 0;
                    api.set(id, a);
                });
            }
        }
        f = api.create('skslFilter', String(node.name || 'Stroke') + ' brush texture');
        for (var d = 1; d < params.length; d++) api.addDynamic(f, 'inputs', 'double'); // inputs.0 (n0) exists already
        var pad = Math.ceil(b.width / 2 + 2 * params[1] + 4), vals = { code: AFFINITY_BRUSH_SKSL, padding: [pad, pad] }; // the filter clips to the path's own bounds otherwise
        params.forEach(function (v, i) { vals['inputs.' + i] = v; });
        api.set(f, vals);
        api.connect(f, 'id', target, 'filters');
        api.parent(f, target);
        if (ol) __affCompanions[id] = [ol];
        return true;
    } catch (e) {
        if (f) { try { api.deleteLayer(f); } catch (eDel) {} }
        if (ol) { try { api.deleteLayer(ol); api.setStroke(id, true); } catch (eDo) {} }
        _affWarn("'" + node.name + "': could not rebuild its brush texture (" + e.message + "), drawn as a plain stroke");
        return false;
    }
}
// Art brushes: the Affinity script sends the brush drawn on a straight line as long as the path (the
// texture exactly as Affinity lays it along this path). Here that strip is a rectangle (pen colour,
// the strip as its mask) nested under the path and bent along it: a triangulated Lattice carries the
// texture, Pathfinder lays the lattice along the path, and a Lattice Controller stretches the lattice
// by the path's live length over the strip's, so the brush follows edits and re-stretches like
// Affinity's (uniformly; a repeating brush stretches instead of adding repeats). The brush inherits the
// path's transform, opacity, blend mode, visibility and masks; the path's own Stroke drives it (Colour,
// Alpha, and Trim with Cap Style for the draw-on). Pathfinder reads its path in world space, so it follows a
// hidden copy of the path in the brush's own space (_affArtBrushPathCode), lengthened by the brush's
// overhang past the ends of an open path (Pathfinder stops at a path's end); the path itself is left as
// it is. Measured: 0.95 median IoU against Affinity on 20 grid brushes, ~0.02 s a frame per brush.
var AFFINITY_ART_BRUSH_COLUMN = 5; // px between lattice columns (finer measured no better)
// The draw-on mask over the strip (x along it, 0 at its centre). Trim maps over the whole strip, the
// brush's overhangs included; a Round cap (half an ellipse, as long as Roundness says) has its centre run
// from one cap length before the strip to its end, so 0% shows nothing and 100% the whole brush. Travel
// wraps round like a Cavalry stroke's (on open paths too, measured); Reverse Path counts it all from the
// other end. The code is the same for every brush (one shader program).
var AFFINITY_ART_BRUSH_TRIM_SKSL = [
    "// Quiver: draws the brush on from its path's Stroke: n0 Trim Start, n1 Trim End, n2 Trim, n3 Cap Style",
    "// (Round rounds the drawn part's ends), n4 strip length, n5 cap radius, n6 Travel, n7 Roundness (%:",
    "// 100 is half a circle, 0 flat, 200 twice as long), n8 Reverse Path",
    "float cut(float x, float y, float ts, float te, float W, float R, float L) {",
    "  float cs = (W + L) * ts, ce = -L + (W + L) * te;",
    "  if (L <= 0.0) return clamp(min(ce - x, x - cs) + 0.5, 0.0, 1.0);",
    "  float k = R / L, le = length(float2((x - ce) * k, y)), ls = length(float2((x - cs) * k, y));",
    "  float de = x <= ce ? max(ce - x, R - le) : R - le, ds = x >= cs ? max(x - cs, R - ls) : R - ls;",
    "  return clamp(min(de, ds) + 0.5, 0.0, 1.0);",
    "}",
    "half4 main(float2 p) {",
    "  if (n2 < 0.5) return half4(1.0);",
    "  float span = (n1 - n0) / 100.0;",
    "  if (span <= 0.0) return half4(0.0);",
    "  if (span >= 1.0) return half4(1.0);",
    "  float W = n4, L = (n3 > 0.5 && n3 < 1.5) ? n5 * max(n7, 0.0) / 100.0 : 0.0, x = n8 > 0.5 ? W * 0.5 - p.x : p.x + W * 0.5;",
    "  float ts = fract((n0 + n6) / 100.0), te = ts + span, a = cut(x, p.y, ts, min(te, 1.0), W, n5, L);",
    "  if (te > 1.0) a = max(a, cut(x, p.y, 0.0, te - 1.0, W, n5, L));",
    "  return half4(a);",
    "}"
].join('\n');
function _affArtBrushPathCode(head, tail, length) {
    return [
        "// Quiver: this brush's path in the brush's own space (the brush sits under the path, so the",
        "// path's transform, fitted from its local and world points, is taken back out). An open path is",
        "// lengthened by the brush's overhang at both ends, in step with its length; a closed one opens at its",
        "// start with no overhang, so the whole strip fits once round (as Affinity draws it, measured)",
        "var HEAD = " + head + ", TAIL = " + tail + ", LENGTH = " + length + ";",
        "function unit(x, y) { var l = Math.sqrt(x * x + y * y); return l > 1e-9 ? { x: x / l, y: y / l } : null; }",
        "function same(p, q) { return !p || !q || (Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6); }",
        // the verbs as segments with their start point; a closing line back to the start becomes a line
        "function segs(pd) { var out = [], start = pd[0].point, cur = start;",
        "  for (var i = 1; i < pd.length; i++) { var v = pd[i], end = v.type == 'close' ? start : v.point; if (!end || (v.type == 'close' && same(cur, start))) continue;",
        "    out.push({ type: v.type == 'close' ? 'lineTo' : v.type, a: cur, cp1: v.cp1, cp2: v.cp2, b: end }); cur = end; }",
        "  return out; }",
        "function dirOut(s) { var c = s.type == 'cubicTo' ? (!same(s.cp1, s.a) ? s.cp1 : (!same(s.cp2, s.a) ? s.cp2 : s.b)) : (s.type == 'quadTo' && !same(s.cp1, s.a) ? s.cp1 : s.b); return unit(c.x - s.a.x, c.y - s.a.y) || { x: 1, y: 0 }; }",
        "function dirIn(s) { var c = s.type == 'cubicTo' ? (!same(s.cp2, s.b) ? s.cp2 : (!same(s.cp1, s.b) ? s.cp1 : s.a)) : (s.type == 'quadTo' && !same(s.cp1, s.b) ? s.cp1 : s.a); return unit(s.b.x - c.x, s.b.y - c.y) || { x: 1, y: 0 }; }",
        // sharp corners get a small fillet in this copy: Pathfinder bridges a corner's outside with a straight
        // edge, a fillet gives it the rounded outside Affinity draws (Pull corners); the inside still folds
        "function roundCorners(pd) {",
        "  var sg = segs(pd); if (sg.length < 2) return pd;",
        "  var res = [{ type: 'moveTo', point: sg[0].a }];",
        "  for (var i = 0; i < sg.length; i++) { var s = sg[i];",
        "    if (i + 1 < sg.length) { var t = sg[i + 1], di = dirIn(s), dO = dirOut(t), cs = di.x * dO.x + di.y * dO.y;",
        "      if (cs < Math.cos(20 * Math.PI / 180) && cs > Math.cos(170 * Math.PI / 180)) { // a path doubling back keeps its point",
        "        var ph = Math.acos(Math.max(-1, Math.min(1, cs))), ci = Math.sqrt(Math.pow(s.b.x - s.a.x, 2) + Math.pow(s.b.y - s.a.y, 2)), co = Math.sqrt(Math.pow(t.b.x - t.a.x, 2) + Math.pow(t.b.y - t.a.y, 2));",
        "        var d = Math.min(15, 0.25 * ci, 0.25 * co), P = s.b, pin = { x: P.x - di.x * d, y: P.y - di.y * d }, pout = { x: P.x + dO.x * d, y: P.y + dO.y * d };",
        "        var mv = function (q, dx, dy) { return q ? { x: q.x + dx, y: q.y + dy } : q; };",
        "        s = { type: s.type, a: s.a, cp1: s.cp1, cp2: mv(s.cp2, -di.x * d, -di.y * d), b: pin };",
        "        if (s.type == 'quadTo') s.cp1 = mv(s.cp1, -di.x * d, -di.y * d);",
        "        sg[i + 1] = { type: t.type, a: pout, cp1: mv(t.cp1, dO.x * d, dO.y * d), cp2: t.cp2, b: t.b };",
        "        var rho = d * Math.tan((Math.PI - ph) / 2), h = 4 / 3 * Math.tan(ph / 4) * rho; // the arc touching both sides d from the corner",
        "        res.push(seg(s));",
        "        res.push({ type: 'cubicTo', cp1: { x: pin.x + di.x * h, y: pin.y + di.y * h }, cp2: { x: pout.x - dO.x * h, y: pout.y - dO.y * h }, point: pout });",
        "        continue; } }",
        "    res.push(seg(s)); }",
        "  return res; }",
        "function seg(s) { return s.type == 'cubicTo' ? { type: 'cubicTo', cp1: s.cp1, cp2: s.cp2, point: s.b } : (s.type == 'quadTo' ? { type: 'quadTo', cp1: s.cp1, point: s.b } : { type: 'lineTo', point: s.b }); }",
        "function pathLength(pd) { var p = new cavalry.Path(); pd.forEach(function (v) { if (v.type == 'moveTo') p.moveTo(v.point.x, v.point.y); else if (v.type == 'lineTo') p.lineTo(v.point.x, v.point.y); else if (v.type == 'cubicTo') p.cubicTo(v.cp1.x, v.cp1.y, v.cp2.x, v.cp2.y, v.point.x, v.point.y); else if (v.type == 'quadTo') p.quadTo(v.cp1.x, v.cp1.y, v.point.x, v.point.y); }); return p.length(); }",
        "function getPath() {",
        "  var out = new cavalry.Path();",
        "  if (!n1.hasInput) return out;",
        "  var local = n1.mesh.getFlattenedPath(), a = local.pathData(), b = n1.path.pathData();",
        "  if (a.length !== b.length || a.length < 2) return out;",
        "  var L = [], W = [];",
        "  for (var i = 0; i < a.length; i++) ['point', 'cp1', 'cp2'].forEach(function (k) { if (a[i][k] && b[i][k]) { L.push(a[i][k]); W.push(b[i][k]); } });",
        "  var i1 = 0, i2 = 0, far = 0, area = 0;",
        "  for (var j = 1; j < L.length; j++) { var dx = L[j].x - L[0].x, dy = L[j].y - L[0].y; if (dx * dx + dy * dy > far) { far = dx * dx + dy * dy; i1 = j; } }",
        "  for (var j = 1; j < L.length; j++) { var c = Math.abs((L[i1].x - L[0].x) * (L[j].y - L[0].y) - (L[i1].y - L[0].y) * (L[j].x - L[0].x)); if (c > area) { area = c; i2 = j; } }",
        "  if (!(far > 1e-9)) return out;",
        "  var m; // world = m * local: x' = m[0] x + m[1] y + m[2], y' = m[3] x + m[4] y + m[5]",
        "  if (area > 1e-4 * far) {",
        "    var p = [L[0], L[i1], L[i2]], q = [W[0], W[i1], W[i2]];",
        "    var D = p[0].x * (p[1].y - p[2].y) - p[0].y * (p[1].x - p[2].x) + (p[1].x * p[2].y - p[2].x * p[1].y);",
        "    var solve = function (r) { return [",
        "      (r[0] * (p[1].y - p[2].y) - p[0].y * (r[1] - r[2]) + (r[1] * p[2].y - r[2] * p[1].y)) / D,",
        "      (p[0].x * (r[1] - r[2]) - r[0] * (p[1].x - p[2].x) + (p[1].x * r[2] - p[2].x * r[1])) / D,",
        "      (p[0].x * (p[1].y * r[2] - p[2].y * r[1]) - p[0].y * (p[1].x * r[2] - p[2].x * r[1]) + r[0] * (p[1].x * p[2].y - p[2].x * p[1].y)) / D]; };",
        "    m = solve([q[0].x, q[1].x, q[2].x]).concat(solve([q[0].y, q[1].y, q[2].y]));",
        "  } else { // a straight path: the similarity that takes its ends to theirs",
        "    var ux = L[i1].x - L[0].x, uy = L[i1].y - L[0].y, vx = W[i1].x - W[0].x, vy = W[i1].y - W[0].y, uu = ux * ux + uy * uy;",
        "    var ca = (ux * vx + uy * vy) / uu, sa = (ux * vy - uy * vx) / uu;",
        "    m = [ca, -sa, W[0].x - ca * L[0].x + sa * L[0].y, sa, ca, W[0].y - sa * L[0].x - ca * L[0].y];",
        "  }",
        "  var det = m[0] * m[4] - m[1] * m[3]; if (!(Math.abs(det) > 1e-12)) return out;",
        "  var iv = [m[4] / det, -m[1] / det, (m[1] * m[5] - m[2] * m[4]) / det, -m[3] / det, m[0] / det, (m[2] * m[3] - m[0] * m[5]) / det];",
        "  var f = function (pt) { return { x: iv[0] * pt.x + iv[1] * pt.y + iv[2], y: iv[3] * pt.x + iv[4] * pt.y + iv[5] }; };",
        "  var pd = roundCorners(a), Ll = pathLength(pd), head = 0, tail = 0, d0x = 0, d0y = 0, d1x = 0, d1y = 0;",
        "  var shut = local.isClosed || a.some(function (v) { return v.type == 'close'; });",
        "  if (Ll > 2 && !shut) {",
        "    var k = Ll / LENGTH; head = HEAD * k; tail = TAIL * k;",
        // the end directions (from the handles, or the next point where a handle sits on its point)
        "    var sg = segs(pd), u0 = dirOut(sg[0]), u1 = dirIn(sg[sg.length - 1]); d0x = u0.x; d0y = u0.y; d1x = u1.x; d1y = u1.y;",
        "  }",
        // a closed path is drawn like Affinity's: from its start once round, the overhang past both ends
        "  var first = pd[0].point, end = first;",
        "  for (var q2 = 0; q2 < pd.length; q2++) { var v = pd[q2], e = v.point ? f(v.point) : null; if (v.point) end = v.point;",
        "    if (v.type == 'moveTo') { if (head > 0) { var h = f({ x: v.point.x - d0x * head, y: v.point.y - d0y * head }); out.moveTo(h.x, h.y); out.lineTo(e.x, e.y); } else out.moveTo(e.x, e.y); }",
        "    else if (v.type == 'lineTo') out.lineTo(e.x, e.y);",
        "    else if (v.type == 'cubicTo') { var c1 = f(v.cp1), c2 = f(v.cp2); out.cubicTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y); }",
        "    else if (v.type == 'quadTo') { var c0 = f(v.cp1); out.quadTo(c0.x, c0.y, e.x, e.y); }",
        "    else if (v.type == 'close' && (end.x !== first.x || end.y !== first.y)) { var c3 = f(first); out.lineTo(c3.x, c3.y); end = first; } }",
        "  if (tail > 0) { var t = f({ x: end.x + d1x * tail, y: end.y + d1y * tail }); out.lineTo(t.x, t.y); }",
        "  return out;",
        "}",
        "getPath();"
    ].join('\n');
}
// The colours a gradient pen gives along a rebuilt brush, as stops over its strip (0 where the head overhang starts, 1
// where the tail's ends). Affinity lays the gradient flat over the layer, but Cavalry shades the bent strip at its
// unbent position, Screen Space too (measured 2026-10-18: a gradient on the strip runs along it, and an arrow's shaft
// came out black in Screen Space; a track matte from the bent strip landed off it), so each point of the path takes the
// colour Affinity draws under it. Exact along the path; across the brush's width the colour does not change.
function _affBrushGradientStops(node, b, pen) {
    var Wm = _affMat(node.world), G = _affMatMul(Wm, _affMat(pen.transform)), Gi = _affInvert(G), c = node.curves[0];
    var pts = [_affApply(Wm, c.start.x, c.start.y)], prev = c.start;
    (c.beziers || []).forEach(function (z) {
        for (var k = 1; k <= 24; k++) {
            var t = k / 24, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
            pts.push(_affApply(Wm, w0 * prev.x + w1 * z[0] + w2 * z[2] + w3 * z[4], w0 * prev.y + w1 * z[1] + w2 * z[3] + w3 * z[5]));
        }
        prev = { x: z[4], y: z[5] };
    });
    if (c.closed) pts.push(pts[0]);
    var acc = [0];
    for (var i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.sqrt(Math.pow(pts[i].x - pts[i - 1].x, 2) + Math.pow(pts[i].y - pts[i - 1].y, 2)));
    var L = acc[acc.length - 1], k0 = b.length > 0 ? L / b.length : 1, head = c.closed ? 0 : b.head * k0, tail = c.closed ? 0 : b.tail * k0;
    var dir = function (p, q) { var dx = q.x - p.x, dy = q.y - p.y, l = Math.sqrt(dx * dx + dy * dy); return l > 1e-9 ? { x: dx / l, y: dy / l } : null; };
    var d0 = null, d1 = null;
    for (var j = 1; j < pts.length && !d0; j++) d0 = dir(pts[0], pts[j]);
    for (var j2 = pts.length - 2; j2 >= 0 && !d1; j2--) d1 = dir(pts[j2], pts[pts.length - 1]);
    d0 = d0 || { x: 1, y: 0 }; d1 = d1 || { x: 1, y: 0 };
    var at = function (s) { // the spine point s along it: the head overhang, the path, then the tail
        if (s < head) return { x: pts[0].x - d0.x * (head - s), y: pts[0].y - d0.y * (head - s) };
        s -= head;
        if (s > L) { var e = pts[pts.length - 1]; return { x: e.x + d1.x * (s - L), y: e.y + d1.y * (s - L) }; }
        var n = 1; while (n < acc.length - 1 && acc[n] < s) n++;
        var f = acc[n] > acc[n - 1] ? (s - acc[n - 1]) / (acc[n] - acc[n - 1]) : 0;
        return { x: pts[n - 1].x + (pts[n].x - pts[n - 1].x) * f, y: pts[n - 1].y + (pts[n].y - pts[n - 1].y) * f };
    };
    var type = pen.gradientType || 'Linear', p0 = _affApply(G, 0, 0), p1 = _affApply(G, 1, 0), gx = p1.x - p0.x, gy = p1.y - p0.y, gg = gx * gx + gy * gy;
    var tAt = function (P) {
        if (type === 'Linear') return gg > 0 ? ((P.x - p0.x) * gx + (P.y - p0.y) * gy) / gg : 0;
        var q = Gi ? _affApply(Gi, P.x, P.y) : { x: 0, y: 0 };
        if (type === 'Conical') { var a = Math.atan2(q.y, q.x) / (2 * Math.PI); return a < 0 ? a + 1 : a; } // clockwise on screen from the start ray
        return Math.sqrt(q.x * q.x + q.y * q.y);
    };
    var qs = _affStopsToQuiver(pen).map(function (q) { var h = parseInt(q.color.slice(1), 16); return { o: q.offset, r: (h >> 16) & 255, g: (h >> 8) & 255, b: h & 255, a: q.opacity }; });
    var colourAt = function (t) {
        t = Math.max(0, Math.min(1, t));
        if (t <= qs[0].o) return qs[0];
        for (var m = 1; m < qs.length; m++) if (t <= qs[m].o) {
            var A = qs[m - 1], B = qs[m], f = B.o > A.o ? (t - A.o) / (B.o - A.o) : 1;
            return { r: A.r + (B.r - A.r) * f, g: A.g + (B.g - A.g) * f, b: A.b + (B.b - A.b) * f, a: A.a + (B.a - A.a) * f };
        }
        return qs[qs.length - 1];
    };
    // 64 steps along the strip, plus the path's nodes, where a stroke doubles back (an arrow's tip) peaks
    var N = 64, S = head + L + tail, us = [], smp = [];
    for (var q2 = 0; q2 <= N; q2++) us.push(q2 / N);
    for (var q3 = 24; q3 < acc.length - 1; q3 += 24) if (S > 0) us.push((head + acc[q3]) / S);
    us.sort(function (x, y) { return x - y; }).forEach(function (u) {
        if (smp.length && u - smp[smp.length - 1].o < 1e-6) return;
        var col = colourAt(tAt(at(S * u))); smp.push({ o: u, r: col.r, g: col.g, b: col.b, a: col.a });
    });
    N = smp.length - 1;
    // drop samples a straight run between their neighbours already gives (within a level, and within Cavalry's own drift)
    var keep = [smp[0]], from = 0;
    var fits = function (A, B, m) { var f = (smp[m].o - A.o) / (B.o - A.o); return ['r', 'g', 'b'].every(function (ch) { return Math.abs(smp[m][ch] - (A[ch] + (B[ch] - A[ch]) * f)) <= 1; }) && Math.abs(smp[m].a - (A.a + (B.a - A.a) * f)) <= 0.005; };
    for (var e2 = 2; e2 <= N; e2++) {
        var ok = _affGradientDrift(smp[from], smp[e2]) <= AFFINITY_GRADIENT_MAX_DRIFT;
        for (var m2 = from + 1; m2 < e2 && ok; m2++) ok = fits(smp[from], smp[e2], m2);
        if (!ok) { keep.push(smp[e2 - 1]); from = e2 - 1; }
    }
    keep.push(smp[N]);
    return keep.map(function (q) { return { offset: Math.round(q.o * 10000) / 10000, color: _affHex(q), opacity: Math.round(q.a * 1000) / 1000 }; });
}
// A linear gradient along the strip: measured on a rebuilt brush, a gradient on the bent strip spans its unbent width x
// Scale from its centre + Offset, so Scale 1 and no Offset put 0 at the strip's start and 1 at its end
function _affStripGradient(stops, name) {
    var g = api.create('gradientShader', name + ' brush gradient');
    api.setGradientFromColors(g, 'generator.gradient', stops.map(function (s) { return s.color; }));
    stops.forEach(function (s, i) {
        var at = {}; at['generator.gradient.' + i + '.position'] = s.offset; at['generator.gradient.' + i + '.color'] = colorWithOpacity(s.color, s.opacity);
        api.set(g, at);
    });
    api.set(g, { screenSpace: false, 'generator.autoSetGradWidth': false, 'generator.offset': [0, 0], 'generator.scale': 1, 'generator.rotation': 0 });
    return g;
}
var __affArtBrushes = 0;
function _affApplyArtBrush(id, node, vb) {
    var b = node.stroke.artBrush, stroke = node.stroke, pen = stroke.fill, name = String(node.name || 'Stroke');
    var graded = !!(pen && pen.type === 'Gradient'), image = !!b.image;
    if (!b || !b.path || !(b.width > 0) || !(b.height > 0) || !(b.length > 0) || !pen || (pen.type !== 'Solid' && !graded && !image)) return false;
    var made = [];
    try {
        var shaderNode = _affImageShader(node, b.path, name + ' brush');
        if (!shaderNode) return false;
        made.push(shaderNode);
        api.rename(shaderNode, name + ' brush texture');
        var W = b.width, H = b.height, r3 = function (v) { return Math.round(v * 1000) / 1000; };
        var strip = api.primitive('rectangle', name + ' brush'); made.push(strip);
        api.parent(strip, id);
        // locked so a click in the Viewport cannot drag it off its path (it stays selectable and editable
        // in the Scene Tree, its helpers too; unlock it there to move it)
        api.set(strip, { position: [0, 0], 'generator.dimensions': [W, H], locked: true });
        if (stroke.behind) api.set(strip, { drawOnTopOfParent: false });
        // the path keeps a stroke of width 0 (it draws nothing, trimmed or not) whose Colour, Alpha, Trim
        // and Cap Style drive the brush
        var cap = AFFINITY_CAP[stroke.cap], alpha = b.opaque ? _affFillAlpha(pen) : 1; // before 0.41 the strip held the pen's alpha
        var penColour = graded ? ((pen.stops && pen.stops.length) ? pen.stops[0].colour : { r: 255, g: 255, b: 255, a: 1 }) : (pen.colour || { r: 255, g: 255, b: 255, a: 1 });
        api.set(id, { 'stroke.width': 0, 'stroke.alpha': Math.round(alpha * 1000) / 10, 'stroke.strokeColor': _affHex(penColour), 'stroke.capStyle': cap === undefined ? 0 : cap });
        api.connect(id, 'stroke.alpha', strip, 'material.alpha');
        if (graded) {
            // first in the strip's shaders so the texture and the trim cut it; the strip's own colour stays clear
            var grad = _affStripGradient(_affBrushGradientStops(node, b, pen), name);
            made.push(grad);
            api.set(strip, { 'material.materialColor.a': 0 });
            api.connect(grad, 'id', strip, 'material.colorShaders');
            api.parent(grad, strip);
        } else if (image) api.set(strip, { 'material.materialColor.a': 0 }); // an image brush is its own picture, drawn as it is
        else api.connect(id, 'stroke.strokeColor', strip, 'material.materialColor');
        api.connect(shaderNode, 'id', strip, 'material.colorShaders');
        api.parent(shaderNode, strip);
        // the strip's path row sits on the rectangle's centre line
        api.set(shaderNode, { scaleMode: 0, 'scale.x': W / b.pixelWidth, 'scale.y': H / b.pixelHeight, 'offset.x': 0, 'offset.y': b.row - H / 2 });
        if (!image) api.set(shaderNode, { blendMode: 6 }); // Destination In: the texture masks the colour
        // draw-on: the path's Stroke > Trim and Cap Style mask the strip in its own space, so a Round end
        // stretches with the texture as Affinity's own caps do
        var trim = api.create('skslShader', name + ' brush trim'); made.push(trim);
        for (var n = 1; n < 9; n++) api.addDynamic(trim, 'inputs', 'double'); // inputs.0 (n0) exists already
        api.set(trim, { code: AFFINITY_ART_BRUSH_TRIM_SKSL, blendMode: 6, 'inputs.4': r3(W), 'inputs.5': r3(stroke.weight / 2), 'inputs.7': 100 });
        [[0, 'stroke.trimStart'], [1, 'stroke.trimEnd'], [2, 'stroke.trim'], [3, 'stroke.capStyle'], [6, 'stroke.trimTravel'], [8, 'stroke.reversePath']].forEach(function (c) { api.connect(id, c[1], trim, 'inputs.' + c[0]); });
        api.connect(trim, 'id', strip, 'material.colorShaders');
        api.parent(trim, strip);
        var cols = Math.max(8, Math.min(400, Math.round(W / AFFINITY_ART_BRUSH_COLUMN) + 1)), rows = 9;
        var lat = api.create('lattice', name + ' brush bend'); made.push(lat);
        api.set(lat, { gridCount: { x: cols, y: rows }, triangulate: true, bounds: [{ x: -W / 2, y: -H / 2 }, { x: W, y: H }] }); // bounds are position and size
        api.connect(lat, 'id', strip, 'deformers');
        api.parent(lat, strip);
        var spine = api.create('javaScriptShape', name + ' brush path'); made.push(spine);
        api.parent(spine, strip);
        api.set(spine, { position: [0, 0] });
        api.addDynamic(spine, 'generator.array', 'layerId');
        api.connect(id, 'id', spine, 'generator.array.1');
        api.set(spine, { 'generator.expression': _affArtBrushPathCode(r3(b.head), r3(b.tail), r3(b.length)) });
        api.setFill(spine, false); api.setStroke(spine, false);
        var along = api.create('pathfinder', name + ' brush along'); made.push(along);
        api.connect(spine, 'id', along, 'inputShape');
        api.set(along, { flip: true, loop: false }); // its Path Offset pushes the brush sideways (measured), so it stays 0
        api.connect(along, 'id', lat, 'deformers');
        api.parent(along, strip);
        // live re-stretch: the path is (lengthened) W x (length / Affinity's length) long
        var stretch = api.create('latticeController', name + ' brush stretch'); made.push(stretch);
        var idx = []; for (var i = 0; i < cols * rows; i++) idx.push(i);
        api.set(stretch, { controlledPoints: idx, pivotOffset: [-W / 2, 0] });
        api.connect(stretch, 'id', lat, 'controllers');
        api.parent(stretch, strip);
        var len = api.create('pathLength', name + ' brush length'); made.push(len);
        api.connect(spine, 'id', len, 'inputShape');
        api.connect(len, 'out', stretch, 'scale.x');
        api.setAttributeExpression(stretch, 'scale.x', '/' + r3(W));
        api.parent(len, strip);
        __affArtBrushes++;
        return true;
    } catch (e) {
        made.reverse().forEach(function (m) { try { api.deleteLayer(m); } catch (eDel) {} });
        _affWarn("'" + name + "': could not lay its brush along the path (" + e.message + "), drawn as a plain stroke");
        return false;
    }
}
function _affClipChildTo(childId, maskId, clipperNode) {
    if (!maskId) return false;
    try {
        [childId].concat(__affCompanions[childId] || []).forEach(function (c) { if (__affAlphaMattes[maskId]) _affAddAlphaMatte(maskId, c); else api.connect(maskId, 'id', c, 'masks'); });
        return true;
    } catch (e) {
        _affWarn("could not clip '" + api.getNiceName(childId) + "' to '" + clipperNode.name + "': " + e.message);
        return false;
    }
}


// ---------------------------------------------------------------------------
// Affinity adjustments and live filters -> Cavalry filters
// Units measured on 2026-09-28 (scratch doc, grey 128 swatch): Affinity brightness is
// -1..1, contrast -1..1, HSL hue shift in radians, blur radius as for layer effects.
// ---------------------------------------------------------------------------
// Live-filter blur radius is NOT the layer-effect radius: measured radius 12 -> sigma 12.5,
// while Cavalry amount 4.2 -> sigma 4.7; 0.9 * radius matched the 10%-90% edge width within 2px.
var AFFINITY_LIVE_BLUR_TO_AMOUNT = 0.9;
var AFFINITY_BRIGHTNESS_TO_CAVALRY = 165;   // measured: Affinity -0.5 takes grey 128 to 80; Cavalry -77 gave 84, so ~-82 is needed
var AFFINITY_CONTRAST_TO_CAVALRY = 180;     // measured: Affinity +0.5 takes grey 192 to 211; Cavalry +50 gives 203, +100 gives 214
function _affDeg(v) { return (typeof v === 'number') ? (Math.abs(v) <= Math.PI * 2 + 1e-6 ? v * 180 / Math.PI : v) : 0; }
function _affNum(o, k, d) { return (o && typeof o[k] === 'number') ? o[k] : d; }
function _affMakeFilter(type, name) { try { return api.create(type, name); } catch (e) { return null; } }

// Grain attributes for a given Affinity Add Noise intensity (0..1). Filled in from the
// grain calibration renders; see AFFINITY_NOISE_* below.
var AFFINITY_NOISE_SD_PER_INTENSITY = 45.3;   // measured: 0.25 -> sd 11.3 on grey 128
var AFFINITY_COLOUR_NOISE_SD_PER_INTENSITY = 42.5; // colour noise: 0.25 -> sd 10.6 in each channel, channels independent
var CAVALRY_GRAIN_SD_PER_AMOUNT = 3.7;         // measured at tone multipliers 1 (size 0.2 and 1.0 agree: 3.71..3.86)
// Grain's cell is the filtered layer's height x Size / 100 px (grainFilter.sksl), so only layers up to
// ~1000 px tall get Affinity's per-pixel noise; the 0.1 floor halves the blotches on bigger ones
// (6764 px tall: lag-1 0.95 at 0.2, 0.86 at 0.1) with the strength unchanged (sd 12.2 / 12.1).
var CAVALRY_GRAIN_SIZE_FOR_PIXEL_NOISE = 0.1;
var CAVALRY_GRAIN_LIFT_PER_SD = 1.1 / 255;     // Grain lowers every tone by ~1.1 levels (of 255) per sd level, the same at grey 64/128/192,
                                               // so it is undone with an ADDITIVE lift (levels inWhite = 1 - d, outBlack = d), not a gain
function _affGrainAttrsForIntensity(intensity, mono) {
    var targetSd = Math.max(0, intensity) * (mono ? AFFINITY_NOISE_SD_PER_INTENSITY : AFFINITY_COLOUR_NOISE_SD_PER_INTENSITY);
    var amount = targetSd / CAVALRY_GRAIN_SD_PER_AMOUNT;
    var size = CAVALRY_GRAIN_SIZE_FOR_PIXEL_NOISE; // colour grain reads the per-channel sizes instead
    var out = { grainSize: size, redSize: size, greenSize: size, blueSize: size, highlight: 1, midtone: 1, shadow: 1, __targetSd: targetSd };
    if (amount > 2) {
        // push the tone multipliers before giving up (each is 0..2)
        var boost = Math.min(2, amount / 2);
        out.highlight = boost; out.midtone = boost; out.shadow = boost;
        if (amount / 2 > 2) { out.__clamped = true; out.__targetSd = 2 * 2 * CAVALRY_GRAIN_SD_PER_AMOUNT; }
        amount = 2;
    }
    out.grainAmount = Math.max(0, Math.min(2, amount));
    // colour grain ignores grainAmount and reads the per-channel amounts (same sd per unit, measured)
    out.redAmount = out.greenAmount = out.blueAmount = out.grainAmount;
    return out;
}
// Affinity's smooth Curves are natural cubic splines through their points (measured: 86 greys within
// half a level). Each piece is a cubic in x, so it is exactly a Bezier whose handles sit a third of the
// way to the next point along the spline's slope there: _affCurveGraph writes that into a Cavalry graph
// (interpolation 1 = Bezier, 0 = Linear; handles are offsets from the point). Measured on the "Nice green"
// photo curve: 52 greys within a level of Affinity.
function _affNaturalSlopes(P) {
    var n = P.length - 1, x = P.map(function (p) { return p[0]; }), a = P.map(function (p) { return p[1]; }), h = [], al = [], l = [1], mu = [0], z = [0], c = [], b = [];
    for (var i = 0; i < n; i++) h[i] = x[i + 1] - x[i];
    for (i = 1; i < n; i++) al[i] = 3 / h[i] * (a[i + 1] - a[i]) - 3 / h[i - 1] * (a[i] - a[i - 1]);
    for (i = 1; i < n; i++) { l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]; mu[i] = h[i] / l[i]; z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i]; }
    c[n] = 0;
    for (var j = n - 1; j >= 0; j--) { c[j] = z[j] - mu[j] * c[j + 1]; b[j] = (a[j + 1] - a[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3; }
    return b.concat([b[n - 1] + (2 * c[n - 1] + (c[n] - c[n - 1])) * h[n - 1]]);
}
function _affCurveIdentity(P) { return P.length < 2 || (P.length === 2 && P[0][0] === 0 && P[0][1] === 0 && P[1][0] === 1 && P[1][1] === 1); }
function _affCurveGraph(filterId, list, curve) {
    var P = [];
    (curve && curve.points || []).slice().sort(function (p, q) { return p[0] - q[0]; }).forEach(function (p) { if (!P.length || p[0] - P[P.length - 1][0] > 1e-4) P.push(p); });
    if (_affCurveIdentity(P)) return false;
    var m = curve.linear ? null : _affNaturalSlopes(P), set = {};
    api.graphPreset(filterId, list, 2);
    while (api.getArrayCount(filterId, list) < P.length) api.addArrayIndex(filterId, list);
    P.forEach(function (p, k) {
        var hl = k > 0 ? (p[0] - P[k - 1][0]) / 3 : 0, hr = k < P.length - 1 ? (P[k + 1][0] - p[0]) / 3 : 0, at = list + '.' + k + '.';
        set[at + 'position'] = { x: p[0], y: p[1] };
        set[at + 'left'] = m ? { x: -hl, y: -hl * m[k] } : { x: 0, y: 0 };
        set[at + 'right'] = m ? { x: hr, y: hr * m[k] } : { x: 0, y: 0 };
        set[at + 'interpolation'] = m ? 1 : 0; set[at + 'weightLocked'] = false; set[at + 'joined'] = true;
    });
    api.set(filterId, set);
    return true;
}
function _affApplyAdjustment(hostId, adj) {
    if (!adj || adj.visible === false) return null;
    if (!_affSetting('importEffectsEnabled', true)) return null;
    var p = adj.params || {};
    var type = adj.type || '';
    var name = adj.name || type;
    var id = null;
    try {
        switch (type) {
            case 'GaussianBlur':
                id = createAndAttachBlur(hostId, _affNum(p, 'radius', 0) * AFFINITY_LIVE_BLUR_TO_AMOUNT);
                break;
            case 'BoxBlur':
                id = _affMakeFilter('sceneGroup::boxBlurFilter', name);
                if (id) { try { api.set(id, { 'amount': _affNum(p, 'radius', 0) * AFFINITY_LIVE_BLUR_TO_AMOUNT }); } catch (e) {} }
                if (!id) { id = createAndAttachBlur(hostId, _affNum(p, 'radius', 0) * AFFINITY_LIVE_BLUR_TO_AMOUNT); _affWarn("'" + name + "': box blur approximated with a Gaussian blur"); }
                break;
            case 'MotionBlur':
                id = _affMakeFilter('sceneGroup::directionalBlurFilter', name);
                if (id) { try { api.set(id, { 'amount': Math.min(250, _affNum(p, 'radius', 0) * AFFINITY_LIVE_BLUR_TO_AMOUNT), 'angle': -_affDeg(_affNum(p, 'angle', 0)) }); } catch (e) {} }
                break;
            case 'Pixelate':
                id = _affMakeFilter('pixelateFilter', name);
                if (id) { try { api.set(id, { 'size': Math.max(1, Math.round(_affNum(p, 'quantisation', 8))) }); } catch (e) {} }
                break;
            case 'UnsharpMask': case 'Clarity':
                id = _affMakeFilter('sharpenFilter', name);
                if (id) { try { api.set(id, { 'intensity': Math.max(0, _affNum(p, 'factor', 1) * 50) }); } catch (e) {} _affWarn("'" + name + "': sharpen strength is approximate"); }
                break;
            case 'Vignette':
                id = _affMakeFilter('vignetteFilter', name);
                if (id) { try { api.set(id, { 'exposure': _affNum(p, 'exposure', -0.5) * 100, 'hardness': Math.max(0, Math.min(100, _affNum(p, 'hardness', 0.5) * 100)), 'scale': [_affNum(p, 'scale', 1), _affNum(p, 'scale', 1)] }); } catch (e) {} _affWarn("'" + name + "': vignette mapping is approximate"); }
                break;
            case 'HSLShift': {
                var m = p.masterParameters || {};
                id = _affMakeFilter('hsvAdjustmentFilter', name);
                if (id) { try { api.set(id, { 'hue': _affDeg(_affNum(m, 'hueShift', 0)), 'saturation': Math.max(-100, Math.min(100, _affNum(m, 'saturationShift', 0) * 100)), 'value': Math.max(-100, Math.min(100, _affNum(m, 'luminosityShift', 0) * 100)), 'useHsl': !p.useHSV }); } catch (e) {} }
                break;
            }
            case 'BrightnessContrast':
                if (!p.isLinear) {
                    // Affinity's (non-linear) curves run as SkSL: Cavalry's filter shifts and scales instead
                    id = _affMakeFilter('skslFilter', name);
                    if (id) { try { api.set(id, { code: _affBrightnessContrastSksl(_affNum(p, 'brightness', 0), _affNum(p, 'contrast', 0)) }); } catch (e) { _affWarn("'" + name + "': " + e.message); } }
                    break;
                }
                id = _affMakeFilter('brightnessAndContrast', name);
                if (id) { try { api.set(id, { 'brightness': Math.max(-150, Math.min(150, _affNum(p, 'brightness', 0) * AFFINITY_BRIGHTNESS_TO_CAVALRY)), 'contrast': Math.max(-50, _affNum(p, 'contrast', 0) * AFFINITY_CONTRAST_TO_CAVALRY) }); } catch (e) {} _affWarn("'" + name + "': linear brightness / contrast is approximate"); }
                break;
            case 'Posterise':
                id = _affMakeFilter('posterizeFilter', name);
                if (id) { try { api.set(id, { 'levels': Math.max(1, Math.round(_affNum(p, 'levels', 4))) }); } catch (e) {} }
                break;
            case 'Threshold':
                id = _affMakeFilter('thresholdFilter', name);
                if (id) { try { api.set(id, { 'threshold': Math.max(0, Math.min(1, _affNum(p, 'threshold', 0.5))) }); } catch (e) {} }
                break;
            case 'Invert':
                id = _affMakeFilter('invert', name);
                break;
            case 'AddNoise': {
                // Affinity Add Noise (Gaussian/Uniform, mono or colour) -> Cavalry's bundled Grain
                // filter. Amplitude measured on grey 128: Affinity 0.25 -> sd 11.3; Cavalry grain
                // sd ~3.7 per unit amount, so the mapping saturates at grainAmount 2 (tone multipliers
                // then take over). Size 0.2 gives Affinity's per-pixel texture.
                id = _affMakeFilter('sceneGroup::grainFilter', name);
                if (id) {
                    var intensity = _affNum(p, 'intensity', 0.25);
                    var mono = (p.isMonochromatic === undefined) ? true : !!p.isMonochromatic;
                    var attrs = _affGrainAttrsForIntensity(intensity, mono);
                    attrs.monochromeGrain = mono ? 1 : 0; attrs.grainTexture = 0; attrs.logGrain = 0;
                    var clamped = attrs.__clamped; var targetSd = attrs.__targetSd; delete attrs.__clamped; delete attrs.__targetSd;
                    try { api.set(id, attrs); } catch (e) {}
                    try { api.connect(id, 'id', hostId, 'filters'); } catch (eC) {}
                    try { if (!api.getParent(id)) api.parent(id, hostId); } catch (eP) {}
                    // Grain shifts every tone down by a constant amount (measured on grey 64/128/192:
                    // -13.3/-12.6/-11.7 levels at sd 11.4). A levels filter with inWhite = 1 - d and
                    // outBlack = d adds d back without changing the noise amplitude (verified +12/+12/+11).
                    var lift = Math.min(0.25, CAVALRY_GRAIN_LIFT_PER_SD * targetSd);
                    if (lift > 0.001) {
                        var lv = _affMakeFilter('levels', name + ' (grain lift)');
                        if (lv) { try { api.set(lv, { 'inWhite': 1 - lift, 'outBlack': lift }); api.connect(lv, 'id', hostId, 'filters'); api.parent(lv, hostId); } catch (eL) {} }
                    }
                    if (clamped) _affWarn("'" + name + "': Affinity noise intensity " + intensity + " exceeds what Cavalry's Grain filter can reach; set to its maximum");
                    id = null; // already connected above (the shared connect below would double-add)
                }
                break;
            }
            case 'BlackAndWhite':
                // Cavalry's Black and White filter takes no negative weights, so Affinity's formula runs as SkSL
                id = _affMakeFilter('skslFilter', name);
                if (id) { try { api.set(id, { code: _affBlackWhiteSksl(p) }); } catch (e) { _affWarn("'" + name + "': " + e.message); } }
                break;
            case 'Curves': {
                // Cavalry's Curves runs a channel's curve before the master, as Affinity does (measured)
                if (p.colourSpace && p.colourSpace !== 'RGB') { _affWarn("'" + name + "': curves in " + p.colourSpace + " colour space have no Cavalry equivalent and were skipped"); return null; }
                if ((typeof p.min === 'number' && Math.abs(p.min) > 1e-4) || (typeof p.max === 'number' && Math.abs(p.max - 1) > 1e-4)) _affWarn("'" + name + "': its input range (" + p.min + " to " + p.max + ") was not carried; the curves run over 0 to 1");
                id = _affMakeFilter('curvesFilter', name);
                if (id) {
                    _affCurveGraph(id, 'rgb', p.master);
                    var lists = { 0: 'red', 1: 'green', 2: 'blue', 3: 'alpha' };
                    Object.keys(p.channels || {}).forEach(function (c) { if (lists[c]) _affCurveGraph(id, lists[c], p.channels[c]); else if (!_affCurveIdentity(p.channels[c].points || [])) _affWarn("'" + name + "': curve channel " + c + " was not carried"); });
                    if (typeof adj.opacity === 'number' && adj.opacity < 0.999) { try { api.set(id, { mix: Math.round(adj.opacity * 1000) / 10 }); } catch (eMx) {} }
                }
                break;
            }
            case 'Levels': {
                var lm = p.masterParameters || {};
                id = _affMakeFilter('levels', name);
                if (id) {
                    var lv = {};
                    Object.keys(lm).forEach(function (k) { var v = lm[k]; if (typeof v !== 'number') return; var lk = k.toLowerCase(); if (/gamma/.test(lk)) lv.gamma = v; else if (/(black|in).*(level|point)?/.test(lk) && /black/.test(lk)) lv[/out/.test(lk) ? 'outBlack' : 'inBlack'] = v; else if (/white/.test(lk)) lv[/out/.test(lk) ? 'outWhite' : 'inWhite'] = v; });
                    try { api.set(id, lv); } catch (e) {}
                    _affWarn("'" + name + "': levels fields mapped by name (" + Object.keys(lv).join(', ') + ")");
                }
                break;
            }
            default:
                // say what the adjustment was set to, so it can be rebuilt by hand on the wrapper group
                var settings = [];
                try { Object.keys(p || {}).forEach(function (k) { var v = p[k]; if (typeof v === 'number') settings.push(k + ' ' + (Math.round(v * 1000) / 1000)); else if (typeof v === 'boolean') settings.push(k + ' ' + v); }); } catch (eS) {}
                _affWarn("'" + name + "' (" + type + ") has no Cavalry equivalent and was skipped" + (settings.length ? ' (Affinity settings: ' + settings.join(', ') + ')' : '') + "; the layers it affected are grouped under '" + name + "'");
                return null;
        }
        if (id && type !== 'GaussianBlur') {
            try { api.connect(id, 'id', hostId, 'filters'); } catch (eC) {}
            try { if (!api.getParent(id)) api.parent(id, hostId); } catch (eP) {}
        }
        if (id) _affStyleFilter(id, { blendMode: adj.blendMode, opacity: adj.opacity });
    } catch (e) {
        _affWarn("could not build '" + name + "': " + e.message);
    }
    return id;
}
// Enclosures nested on a layer: masks clip the layer; adjustments / filters process it.
function _affAttr(path, value) { var o = {}; o[path] = value; return o; }
// `targets`: the layers a nested mask must cut. For an ordinary layer that is the layer itself; for
// a clipping shape it is the shape (when it paints) plus everything it clips, because a mask wired
// to a hidden mask copy would never show.
function _affApplyEnclosures(hostId, node, parentId, vb, targets) {
    var encl = node.enclosures || [];
    var list = (targets && targets.length) ? targets : [hostId];
    for (var i = 0; i < encl.length; i++) {
        var e = encl[i];
        if (e.kind === 'mask' && e.node) {
            var maskNode = e.node;
            if (maskNode.kind === 'image' || maskNode.kind === 'raster') {
                // pixel mask: the rendered coverage PNG (alpha = coverage) becomes a hidden track matte
                if (!(maskNode.image && maskNode.image.path)) {
                    if (__affinityImagesIncluded) _affWarn("'" + node.name + "': its pixel mask was not exported, imported without it");
                    continue;
                }
                var created = _affCreateImageLayer(maskNode, parentId, vb);
                if (created && created.id) {
                    try { api.set(created.id, { 'hidden': true }); } catch (eH) {}
                    // a track matte on a Cavalry group does nothing, so a group's mask goes on its layers
                    var matted = (node.kind === 'group' || node.kind === 'container') ? _affDescendantLayerIds(node) : list;
                    for (var t = 0; t < matted.length; t++) { try { _affAddAlphaMatte(created.id, matted[t]); } catch (eTm) { _affWarn("could not matte '" + api.getNiceName(matted[t]) + "' with '" + (maskNode.name || 'Mask') + "': " + eTm.message); } }
                    _affReportSibling(created.id);
                    if (!maskNode.pixelMask) _affWarn("'" + node.name + "': pixel mask imported as a track matte (approximate)");
                }
            } else if (_affMaskIsImageWindow(maskNode, node)) {
                console.info("🏹 Quiver/Affinity: '" + (maskNode.name || 'Mask') + "' on '" + node.name + "' matches what the image already shows, no mask needed");
            } else {
                var maskId = _affCreateMaskFor(maskNode, parentId, vb);
                if (maskId) { for (var m = 0; m < list.length; m++) { try { api.connect(maskId, 'id', list[m], 'masks'); } catch (eM) {} } _affReportSibling(maskId); }
            }
        } else if (e.kind === 'adjustment' || e.kind === 'liveFilter') {
            _affApplyAdjustment(hostId, e);
        }
    }
}
// A square-cornered rectangle mask whose corners sit on an image layer's own corners changes nothing:
// the image rectangle already shows exactly that window (designs brought into Affinity often give a
// cropped photo a "Clipping Mask" the size of its crop). Anything the image clips stays inside it too.
function _affMaskIsImageWindow(maskNode, host) {
    if (!host || (host.kind !== 'image' && host.kind !== 'raster') || !host.localBox || !host.world) return false;
    if (!maskNode || maskNode.kind !== 'shape' || !maskNode.shape || maskNode.shape.type !== 'Rectangle' || !maskNode.localBox || !maskNode.world) return false;
    var corners = maskNode.shape.corners || {};
    var rounded = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].some(function (k) { var c = corners[k]; return c && c.type && c.type !== 'None' && c.radius > 0; });
    if (rounded) return false;
    var a = _affBoxCorners(maskNode.localBox, _affMat(maskNode.world)), b = _affBoxCorners(host.localBox, _affMat(host.world));
    return a.every(function (p) { return b.some(function (q) { return Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5; }); });
}
// A standalone adjustment / live filter layer applies to everything below it in the
// same list: wrap the siblings created so far into a group and filter that group.
var __affUnmasked = []; // standalone adjustments whose Affinity mask is not carried (one warning at the end)
function _affApplyStandaloneAdjustment(adj, createdSoFar, parentId) {
    if (!createdSoFar.length) { _affWarn("'" + adj.name + "' has nothing below it to affect"); return null; }
    var gid = api.create('group', adj.name || 'Adjustment');
    if (parentId) api.parent(gid, parentId);
    for (var i = 0; i < createdSoFar.length; i++) { try { api.parent(createdSoFar[i], gid); } catch (e) {} }
    __affinityImportedGroups.push(gid);
    _affApplyAdjustment(gid, adj);
    if (adj.masked) __affUnmasked.push(adj.name || 'Adjustment');
    return gid;
}
// Layers that importAffinityNode creates as SIBLINGS of the node it returns (mask copies, clipped
// children, a hidden text path) are reported here so the list importer knows about every layer at
// its level. Without this a standalone filter's wrapper group left them behind at the bottom of the
// stack (the POSTERS clouds vanished under the wrapped background).
var __affSiblingSink = null;
function _affReportSibling(id) { if (id && __affSiblingSink) __affSiblingSink.push(id); }
// Cavalry can wrap a layer on its own (a decorated textShape becomes "<name> Group" with a
// Decorations shape); the layer to move around at this level is that top-most ancestor.
function _affTopLevelUnder(id, parentId) {
    var cur = id, guard = 0;
    while (guard++ < 32) {
        var p = null; try { p = api.getParent(cur); } catch (e) { p = null; }
        if (!p || p === parentId) break;
        var t = ''; try { t = api.getLayerType(p); } catch (e2) {}
        if (t === 'compNode') break;
        cur = p;
    }
    return cur;
}
// ---------------------------------------------------------------------------
// Fill layers (Layer > New Fill Layer) arrive as rectangles with the sampled fill (see the Affinity
// script). When a fill layer sits above exactly one painted layer in its clip and that layer covers
// the visible part of the clip, the fill is attached to that layer's material as an extra shader
// (Multiply/opacity preserved) instead of becoming a separate rectangle, like Figma's stacked fills.
// Anything less clear-cut keeps the rectangle.
// ---------------------------------------------------------------------------
function _affNodePaints(node) {
    // an image or painted pixel layer draws its pixels (so as a clipper it needs a separate matte)
    if ((node.kind === 'image' || node.kind === 'raster') && node.image && node.image.path) return true;
    return !!(node.fill && node.fill.type !== 'None') || !!(node.stroke && node.stroke.fill) || !!(node.fills && node.fills.some(function (f) { return f && f.type !== 'None'; })) || !!(node.strokes && node.strokes.some(function (st) { return st && st.fill; })) || !!(node.effects && node.effects.length);
}
function _affBoxIntersect(a, b) {
    if (!a) return b; if (!b) return a;
    var x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}
// Walks down through groups and invisible clippers (Picture Frames) to the single painted layer, if
// there is exactly one; `cover` accumulates the clip boxes on the way so the caller can check that
// the painted layer really shows across the fill's visible area.
function _affSinglePaintedLeaf(node, depth, cover) {
    if (!node || node.visible === false || depth > 8) return null;
    if (node.fillLayer || node.kind === 'text' || node.kind === 'artboard' || node.kind === 'adjustment' || node.kind === 'liveFilter' || node.kind === 'other') return null;
    var kids = (node.children || []).filter(function (c) { return c && c.visible !== false && c.kind !== 'adjustment' && c.kind !== 'liveFilter'; });
    if (node.kind === 'group' || node.kind === 'container') return kids.length === 1 ? _affSinglePaintedLeaf(kids[0], depth + 1, cover) : null;
    var isImage = (node.kind === 'image' || node.kind === 'raster');
    var paints = isImage ? !!(node.image && node.image.path) : _affNodePaints(node);
    var box = node.spreadBox && isFinite(node.spreadBox.w) ? node.spreadBox : null;
    // a placed image's spread box is the whole picture; only its crop window (localBox) shows
    if (box && node.kind === 'image' && node.localBox) box = _affBounds(_affBoxCorners(node.localBox, _affMat(node.world)));
    if (!box) return null;
    if (!kids.length) return paints ? { leaf: node, cover: _affBoxIntersect(cover, box) } : null;
    if (paints) return null; // a painted clipper plus its children: the fill tints both
    return kids.length === 1 ? _affSinglePaintedLeaf(kids[0], depth + 1, _affBoxIntersect(cover, box)) : null;
}
function _affFillLayerHost(children, index, vb) {
    var fill = children[index];
    if (!fill || !fill.fill || !fill.fillLayer || fill.fillLayer === 'complex' || !fill.localBox) return null;
    if ((fill.effects && fill.effects.length) || (fill.enclosures && fill.enclosures.length)) return null;
    var below = [];
    for (var i = 0; i < index; i++) { var c = children[i]; if (c && c.visible !== false && c.kind !== 'adjustment' && c.kind !== 'liveFilter') below.push(c); }
    if (below.length !== 1) return null;
    var found = _affSinglePaintedLeaf(below[0], 0, null);
    if (found && found.leaf && __affRiddenOn[found.leaf.id]) found.leaf = __affRiddenOn[found.leaf.id]; // the picture is drawn by its frame
    if (!found || !found.leaf || !__affNodeIds[found.leaf.id]) return null;
    // the painted layer must cover the fill wherever the fill is visible (its box inside the frame)
    var visible = _affBoxIntersect(fill.localBox, { x: vb.x, y: vb.y, w: vb.width, h: vb.height });
    var cv = found.cover, tol = 2;
    if (!(visible.w > 0 && visible.h > 0)) return null;
    if (cv.x > visible.x + tol || cv.y > visible.y + tol || cv.x + cv.w < visible.x + visible.w - tol || cv.y + cv.h < visible.y + visible.h - tol) return null;
    return found.leaf;
}
function _affInvert(M) {
    var det = M[0] * M[4] - M[1] * M[3];
    if (Math.abs(det) < 1e-12) return null;
    var a = M[4] / det, b = -M[1] / det, c = -M[3] / det, d = M[0] / det;
    return [a, b, -(a * M[2] + b * M[5]), c, d, -(c * M[2] + d * M[5])];
}
// Build a gradient shader whose geometry `Gs` (unit -> spread) is expressed in a host layer's own
// frame and connect it to that layer: an editable path keeps the comp frame moved to its position;
// a primitive carries rotation/mirroring, so the host's world matrix is undone and the result is
// scaled into the primitive's pixel size. Returns the shader id (or null).
// A host layer's own frame: spread points mapped by `frame` and measured from `centre` are the
// host's local pixels (y down) around its layer origin. An editable path keeps the comp frame moved
// to its position; a primitive carries rotation/mirroring, so its world matrix is undone and the
// result scaled into the primitive's pixel size.
function _affHostFrame(hostId, hostNode, isPath, vb) {
    if (__affTurned[hostId]) return null;
    if (isPath) {
        var px = api.get(hostId, 'position.x') || 0, py = api.get(hostId, 'position.y') || 0;
        return { frame: [1, 0, 0, 0, 1, 0], centre: { x: px + vb.x + vb.width / 2, y: vb.y + vb.height / 2 - py } };
    }
    var W = _affMat(hostNode.world), inv = _affInvert(W);
    if (!inv) return null;
    var dec = _affDecompose(W), box = hostNode.localBox || { x: 0, y: 0, w: 0, h: 0 };
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var toCentre = [1, 0, -cx, 0, 1, -cy], scaleUp = [Math.abs(dec.sx), 0, 0, 0, Math.abs(dec.sy), 0];
    return { frame: _affMatMul(scaleUp, _affMatMul(toCentre, inv)), centre: { x: 0, y: 0 } };
}
function _affGradientShaderOnLayer(hostId, hostNode, isPath, fill, Gs, vb) {
    var hf = _affHostFrame(hostId, hostNode, isPath, vb);
    if (!hf) return null;
    var frame = hf.frame, centre = hf.centre;
    var shaderId = _affGradientShaderInFrame(fill, _affMatMul(frame, Gs), centre);
    if (!shaderId) return null;
    connectShaderToShape(shaderId, hostId, centre, 1, 1, 0);
    return shaderId;
}
// Affinity's Transparency tool: a gradient (or flat value) that fades the layer's alpha on top of
// its fill. A flat value folds into the layer opacity. A gradient becomes a hidden rectangle over
// the layer carrying a white gradient whose stop alphas are the transparency stops, wired as an
// alpha track matte (Cavalry mattes read alpha only), so fills, images and blend modes are untouched.
function _affApplyTransparency(id, created, node, parentId, vb) {
    var tr = node.transparency;
    if ((!tr || tr.type === 'None') && node.text && node.text.runs) {
        // a text layer keeps its transparency on the glyph runs (one per run; the tool sets them all alike)
        var runT = node.text.runs.map(function (r) { return r && r.transparency && r.transparency.type !== 'None' ? r.transparency : null; }).filter(function (x) { return x; });
        if (runT.length) {
            tr = runT[0];
            var first = JSON.stringify(tr);
            if (runT.length < node.text.runs.length || runT.some(function (x) { return JSON.stringify(x) !== first; })) _affWarn("'" + node.name + "': the text runs carry different transparencies; the first one is applied to the whole layer");
        }
    }
    if (!tr || tr.type === 'None') return;
    if (tr.type === 'Solid') {
        var a = _affAlpha(tr.colour);
        if (a < 0.999) { try { var cur = api.get(id, 'opacity'); if (typeof cur === 'number') api.set(id, { 'opacity': Math.round(cur * a * 10) / 10 }); } catch (eO) {} }
        return;
    }
    if (tr.type !== 'Gradient') { _affWarn("'" + node.name + "': transparency of type '" + tr.type + "' is not supported"); return; }
    var stub = {};
    for (var k in node) stub[k] = node[k];
    stub.kind = 'shape'; stub.shape = { type: 'Rectangle', corners: {}, isPlainRectangle: true }; stub.curves = _affBoxCurves(stub.localBox);
    stub.fill = null; stub.stroke = null; stub.fills = null; stub.strokes = null; stub.effects = []; stub.children = []; stub.enclosures = []; stub.clipsChildren = false;
    stub.transparency = null; stub.opacity = 1; stub.blendMode = 'Normal'; stub.visible = true;
    stub.name = (node.name || 'Layer') + ' (transparency)';
    var made = _affCreateShapeLayer(stub, parentId, vb);
    if (!made || !made.id) { _affWarn("'" + node.name + "': could not build the transparency matte"); return; }
    var matte = made.id;
    // white gradient carrying the transparency stops' alpha
    var fill = { type: 'Gradient', gradientType: tr.gradientType || 'Linear', transform: tr.transform, stops: (tr.stops || []).map(function (st) { return { position: st.position, midpoint: st.midpoint, colour: { r: 255, g: 255, b: 255, a: _affAlpha(st.colour) } }; }) };
    var Gs = _affMatMul(_affMat(node.world), _affMat(tr.transform));
    var shaderId = _affGradientShaderOnLayer(matte, stub, !!made.isPath, fill, Gs, vb);
    if (!shaderId) { try { api.deleteLayer(matte); } catch (eDel) {} _affWarn("'" + node.name + "': transparency gradient of type '" + tr.gradientType + "' could not be built"); return; }
    try { api.setStroke(matte, false); } catch (eS) {}
    try { api.set(matte, { 'hidden': true }); } catch (eH) {}
    // A track matte on a Cavalry group has no effect (verified in both group modes), so a group's
    // transparency is wired to every layer created for its descendants instead.
    var targets = (node.kind === 'group' || node.kind === 'container') ? _affDescendantLayerIds(node) : [id];
    if (!targets.length) { try { api.deleteLayer(matte); } catch (eDel2) {} _affWarn("'" + node.name + "': transparency could not be applied (no layers inside the group)"); return; }
    targets.forEach(function (t) { try { _affAddAlphaMatte(matte, t); } catch (eTm) { _affWarn("'" + node.name + "': could not connect the transparency matte: " + eTm.message); } });
    _affReportSibling(matte);
}
// Cavalry adds a layer's track mattes together (with two Alpha mattes the layer shows wherever either
// one does, measured 2026-10-16) while Affinity's masks multiply. So a picture matte meeting a layer
// that already has one is folded into that matte instead: a Destination In copy of its image shader,
// placed where the picture sits, so the existing matte keeps only what both cover. Everything that
// uses the existing matte sits inside what the new one masks, so the fold is right for all of them.
var __affMatteFolds = {};
function _affAddAlphaMatte(src, t) {
    var have = [];
    try { have = api.getInConnectedAttributes(t).filter(function (a) { return /^trackMattes/.test(a); }).map(function (a) { return String(api.getInConnection(t, a)).replace(/\.\w+$/, ''); }).filter(function (m) { return m !== src; }); } catch (e) {}
    if (have.length && have.every(function (m) { return __affMatteFolds[m + '|' + src] || _affFoldMatte(src, m); })) return;
    api.connect(src, 'id', t, 'trackMattes');
    if (have.length) _affWarn("'" + api.getNiceName(t) + "' has several track mattes, which Cavalry adds together, so it shows where any of them does (Affinity: only where all do)");
}
function _affFoldMatte(src, m) {
    var f = null;
    try {
        if (api.getLayerType(m) !== 'basicShape') return false; // shader offsets are from the shape's centre
        var sh = String(api.getInConnection(src, 'material.colorShaders.0.shader') || '').replace(/\.\w+$/, '');
        if (!sh || api.getLayerType(sh) !== 'imageShader' || Math.abs(api.get(sh, 'rotation')) > 0.01) return false;
        var asset = String(api.getInConnection(sh, 'image') || '').replace(/\.\w+$/, '');
        var res = api.get(sh, 'outResolution'), mode = api.get(sh, 'scaleMode'), dim = api.get(src, 'generator.dimensions');
        if (!asset || !(res.x > 0 && res.y > 0)) return false;
        var sx, sy, ox = api.get(sh, 'offset.x'), oy = api.get(sh, 'offset.y');
        if (mode === 0) { sx = api.get(sh, 'scale.x'); sy = api.get(sh, 'scale.y'); }
        else if (mode === 4) { sx = sy = Math.max(dim.x / res.x, dim.y / res.y); }
        else return false;
        // src's frame in m's frame: inverse(m global) x src global (row-major 3x3, y up)
        var A = api.get(m, 'globalTransform'), B = api.get(src, 'globalTransform'), det = A[0] * A[4] - A[1] * A[3];
        if (!det) return false;
        var i0 = A[4] / det, i1 = -A[1] / det, i3 = -A[3] / det, i4 = A[0] / det;
        var r0 = i0 * B[0] + i1 * B[3], r1 = i0 * B[1] + i1 * B[4], r3 = i3 * B[0] + i4 * B[3], r4 = i3 * B[1] + i4 * B[4];
        var dx = B[2] - A[2], dy = B[5] - A[5], tx = i0 * dx + i1 * dy, ty = i3 * dx + i4 * dy;
        var flip = (r0 * r4 - r1 * r3) < 0 ? -1 : 1;
        f = api.create('imageShader', api.getNiceName(src) + ' (combined)');
        api.connect(asset, 'id', f, 'image');
        api.set(f, { scaleMode: 0, 'scale.x': sx * Math.sqrt(r0 * r0 + r3 * r3), 'scale.y': flip * sy * Math.sqrt(r1 * r1 + r4 * r4), rotation: Math.atan2(r3, r0) * 180 / Math.PI,
            'offset.x': r0 * ox + r1 * oy + tx, 'offset.y': r3 * ox + r4 * oy + ty, tilingX: 3, tilingY: 3, blendMode: 6, filterQuality: api.get(sh, 'filterQuality') });
        api.connect(f, 'id', m, 'material.colorShaders');
        api.parent(f, m);
        __affMatteFolds[m + '|' + src] = true;
        return true;
    } catch (e) { if (f) { try { api.deleteLayer(f); } catch (eDel) {} } return false; }
}
// Erase: a layer (or group) blended with Erase cuts its alpha out of everything below it in the same
// list (a group's layers, a non-painting clipper's layers, the comp); a painting clipper takes its Erase
// children as Subtract masks instead. Cavalry has no such layer mode, so the eraser is hidden and drawn
// as an Alpha Inverted track matte on each layer beneath it (on a group's layers: a matte on a group does
// nothing). Several erasers multiply, as Affinity erases one after another; strokes and partial alpha
// erase as they draw.
function _affLayerIdsOf(c) {
    if (c.__precompRef) return [c.__precompRef]; // its layers live in their own composition
    if (c.kind === 'group' || c.kind === 'container') return _affDescendantLayerIds(c);
    var rec = __affNodeIds[c.id];
    return (rec && rec.id ? [rec.id].concat(__affCompanions[rec.id] || []) : []).concat(c.children && c.children.length ? _affDescendantLayerIds(c) : []);
}
// A Mask layer standing in a list (not nested on a layer) masks everything below it there the same way,
// as a plain Alpha track matte.
function _affApplyErasers(children) {
    for (var i = 0; i < children.length; i++) {
        var e = children[i];
        if (!e || e.visible === false || !(e.blendMode === 'Erase' || e.pixelMask)) continue;
        var mode = e.pixelMask ? 4 : 5, sources = _affLayerIdsOf(e), targets = [], kept = 0;
        if (!sources.length) continue;
        sources.forEach(function (s) { try { api.set(s, { hidden: true }); } catch (eH) {} });
        for (var j = 0; j < i; j++) { var c = children[j]; if (c && c.visible !== false && c.blendMode !== 'Erase' && !c.pixelMask) targets = targets.concat(_affLayerIdsOf(c)); }
        targets.forEach(function (t) {
            var has = null; try { has = api.get(t, 'matteMode'); } catch (eM) {}
            if (has !== mode && api.getInConnectedAttributes(t).some(function (a) { return /^trackMattes/.test(a); })) { kept++; return; } // the other kind of matte would flip
            try { sources.forEach(function (s) { if (mode === 4) _affAddAlphaMatte(s, t); else api.connect(s, 'id', t, 'trackMattes'); }); api.set(t, { matteMode: mode }); } catch (eC) { kept++; }
        });
        var n = targets.length - kept, what = e.pixelMask ? 'masks' : 'erases';
        console.info("🏹 Quiver/Affinity: '" + (e.name || 'Layer') + "' " + what + " " + n + " layer" + (n === 1 ? '' : 's') + " below it (as " + (e.pixelMask ? '' : 'inverted ') + "track mattes)");
        if (kept) _affWarn("'" + (e.name || 'Layer') + "': " + kept + " layer" + (kept === 1 ? '' : 's') + " below it already had the other kind of track matte and were not " + (e.pixelMask ? 'masked' : 'erased'));
    }
}
// Cavalry ids of the layers created for a group's descendants (groups themselves excluded)
function _affDescendantLayerIds(node) {
    var out = [];
    (node.children || []).forEach(function (c) {
        if (!c || c.visible === false) return;
        if (c.__precompRef) { out.push(c.__precompRef); return; }
        if (c.kind === 'group' || c.kind === 'container') { out = out.concat(_affDescendantLayerIds(c)); return; }
        var rec = __affNodeIds[c.id];
        if (rec && rec.id) out = out.concat([rec.id], __affCompanions[rec.id] || []);
        if (c.children && c.children.length) out = out.concat(_affDescendantLayerIds(c));
    });
    return out;
}
function _affAttachFillLayer(fillNode, leaf, vb) {
    var rec = __affNodeIds[leaf.id];
    if (!rec || !rec.id) return false;
    var hostId = rec.id, fill = fillNode.fill;
    var label = fillNode.name || 'Fill';
    var opacity = (typeof fillNode.opacity === 'number') ? Math.max(0, Math.min(1, fillNode.opacity)) : 1;
    var baseA = null, baseAlpha = null;
    try { baseA = api.get(hostId, 'material.materialColor.a'); } catch (e0) {}
    try { baseAlpha = api.get(hostId, 'material.alpha'); } catch (e1) {}
    var shaderId = null;
    try {
        if (fill.type === 'Solid') {
            shaderId = api.create('colorShader', label);
            api.set(shaderId, { 'shaderColor': _affHex(fill.colour) });
            // a solid shader ignores its `alpha`, so the layer opacity is folded into the colour
            api.set(shaderId, { 'shaderColor.a': Math.round(_affAlpha(fill.colour) * opacity * 255) });
            api.connect(shaderId, 'id', hostId, 'material.colorShaders');
        } else if (fill.type === 'Gradient') {
            var Gs = _affMatMul(_affMat(fillNode.world), _affMat(fill.transform)); // unit -> spread
            shaderId = _affGradientShaderOnLayer(hostId, leaf, rec.isPath, fill, Gs, vb);
            if (!shaderId) return false;
            try { api.set(shaderId, { 'alpha': Math.round(opacity * 1000) / 10 }); } catch (eA) {}
        } else {
            return false;
        }
        try { api.parent(shaderId, hostId); } catch (ePar) {}
        try { api.rename(shaderId, label); } catch (eRn) { try { api.set(shaderId, { 'niceName': label }); } catch (eN) {} }
        _affApplyShaderBlend(shaderId, fillNode.blendMode);
        // connectShaderToShape hides the host's base colour; put it back
        if (typeof baseA === 'number') { try { api.set(hostId, { 'material.materialColor.a': baseA }); } catch (eRa) {} }
        if (typeof baseAlpha === 'number') { try { api.set(hostId, { 'material.alpha': baseAlpha }); } catch (eRb) {} }
        console.info("🏹 Quiver/Affinity: fill layer '" + label + "' applied as a shader on '" + (leaf.name || api.getNiceName(hostId)) + "'");
        return true;
    } catch (e) {
        if (shaderId) { try { api.deleteLayer(shaderId); } catch (eDel) {} }
        _affWarn("could not attach fill layer '" + label + "' as a shader (" + e.message + "), importing it as a rectangle");
        return false;
    }
}

// Import a list of sibling records (back-to-front) into parentId; returns created ids (every layer
// that now sits at this level, bottom first).
function _affImportList(children, parentId, vb) {
    var created = [];
    var prevSink = __affSiblingSink;
    var sink = [];
    __affSiblingSink = sink;
    try {
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (!child || child.visible === false) continue;
            if (child.kind === 'adjustment' || child.kind === 'liveFilter') {
                var gid = _affApplyStandaloneAdjustment(child, created, parentId);
                if (gid) created = [gid];
                continue;
            }
            if (child.fillLayer && child.fillLayer !== 'complex') {
                // A fill layer that only tints one layer beneath it rides on that layer as a shader
                var host = _affFillLayerHost(children, i, vb);
                if (host && _affAttachFillLayer(child, host, vb)) continue;
            }
            var id = importAffinityNode(child, parentId, vb);
            if (id) created.push(_affTopLevelUnder(id, parentId));
            for (var s = 0; s < sink.length; s++) { var sid = _affTopLevelUnder(sink[s], parentId); if (created.indexOf(sid) === -1) created.push(sid); }
            sink.length = 0;
        }
        _affApplyErasers(children);
    } finally { __affSiblingSink = prevSink; }
    return created;
}

// ---------------------------------------------------------------------------
// Node import (recursive). Affinity hands children back-to-front (first = the
// bottom of the stack, verified with an overlapping pair), and Cavalry stacks
// each new layer on top, so children are created in the order they arrive.
// ---------------------------------------------------------------------------
// A "scale with object" stroke grows with the layer's transform (groups included): Affinity scales the
// weight by the root mean square of the transform's axis scales (measured: 2x1 drew 10 as 15.82,
// 3x0.5 as 21.51, x2 as 20; a x0.5 group drew 20 as 10). Other strokes keep their weight in spread px.
function _affScaleStrokeWeights(node) {
    if (node.__strokesScaled || !node.world) return;
    node.__strokesScaled = true;
    var W = _affMat(node.world), k = Math.sqrt((W[0] * W[0] + W[1] * W[1] + W[3] * W[3] + W[4] * W[4]) / 2);
    [node.stroke].concat(node.strokes || []).forEach(function (st) { if (st && st.scaleWithObject && st.weight > 0) st.weight *= k; });
}
// Affinity draws a group that has a blend mode, or a layer together with the layers it clips, on its own and
// blends the result (measured: a white child of a Difference parent over white came out black). A Cavalry
// group's blend mode only blends the layers inside it with each other, so such a stack is built in its own
// composition and placed as a Pre-Comp carrying the blend mode and opacity.
function _affNeedsPrecomp(node) {
    if (node.__inPrecomp || !_affSetting('importGroupsEnabled', true) || !AFFINITY_BLEND_TO_SVG[node.blendMode] || node.blendMode === 'Normal') return false;
    var kids = (node.children || []).filter(function (c) { return c && c.visible !== false; });
    if (!kids.length) return false;
    if (node.kind === 'group' || node.kind === 'container') return true;
    // a clipper whose clipped pictures all ride on it as shaders stays one layer
    return !!node.clipsChildren && !(!node.__noRiders && _affCanCarryPictures(node) && kids.every(_affCanRideClipper));
}
// A Pre-Comp also hands its blend mode down to every Normal layer inside it (white over cyan in a Difference
// Pre-Comp drew as their difference, even nested in a group or a second Pre-Comp), so those layers are set to
// Alpha Add, which composites like Normal (measured: opaque and half-transparent layers over opaque or empty
// backgrounds give Normal's values; only translucent layers overlapping each other add their alpha up).
function _affImportPrecomp(node, parentId, vb) {
    var main = api.getActiveComp(), sel = [], sub = null;
    try { sel = api.getSelection(); } catch (eSel) {}
    try {
        sub = api.createComp(_affUniqueCompName((node.name || 'Layer') + ' (' + node.blendMode + ')'));
        var attrs = { resolution: api.get(main, 'resolution'), backgroundColor: '#000000' };
        try { attrs.fps = api.get(main, 'fps'); attrs.endFrame = api.get(main, 'endFrame'); attrs.playbackEnd = api.get(main, 'playbackEnd'); } catch (eCopy) {}
        api.set(sub, attrs);
        api.set(sub, { 'backgroundColor.a': 0 });
        api.setActiveComp(sub);
        var inner = {};
        for (var k in node) inner[k] = node[k];
        inner.blendMode = 'Normal'; inner.opacity = 1; inner.__inPrecomp = true;
        importAffinityNode(inner, null, vb);
        var layers = [];
        (function walk(id) { (api.getChildren(id) || []).forEach(function (c) { var at = []; try { at = api.getAttributes(c); } catch (eA) {} if (at.indexOf('drawOnTopOfParent') < 0) return; layers.push(c); walk(c); }); })(sub);
        layers.forEach(function (l) { try { if (api.get(l, 'blendMode') === 3) api.set(l, { blendMode: 30 }); } catch (eB) {} });
    } catch (e) {
        _affWarn("'" + node.name + "': could not build its " + node.blendMode + " Pre-Comp (" + e.message + ")");
    } finally { api.setActiveComp(main); }
    if (!sub) return null;
    var ref = api.createCompReference(sub);
    if (parentId) api.parent(ref, parentId);
    try { api.rename(ref, node.name || 'Layer'); } catch (eRn) {}
    _affApplyOpacity(ref, node);
    _affApplyBlend(ref, node.blendMode);
    _affApplyMeta(ref, node);
    node.__precompRef = ref;
    if (node.id) __affNodeIds[node.id] = { id: ref, isPath: false, kind: 'precomp' };
    try { api.select(sel); } catch (eRs) {}
    console.info("🏹 Quiver/Affinity: '" + node.name + "' and what it " + (node.clipsChildren ? 'clips' : 'holds') + " became a Pre-Comp blended with " + node.blendMode + " (composition \"" + api.getNiceName(sub) + "\"), as Affinity blends them together");
    return ref;
}
// An artboard's own fill as a rectangle layer (its children are imported separately)
function _affArtboardBackground(node) {
    var abStub = {};
    for (var abKey in node) abStub[abKey] = node[abKey];
    abStub.kind = 'shape'; abStub.name = (node.name || 'Artboard') + ' (background)';
    abStub.shape = node.shape && node.shape.type ? node.shape : { type: 'Rectangle', corners: {}, isPlainRectangle: true };
    abStub.tagColour = null; abStub.locked = false; abStub.effects = []; abStub.__noRiders = true; // a full-bleed picture stays its own layer
    if (node.localBox && node.artboardBox && (!node.localBox.w || !node.localBox.h)) abStub.localBox = { x: 0, y: 0, w: node.artboardBox.w, h: node.artboardBox.h };
    return abStub;
}
function importAffinityNode(node, parentId, vb) {
    if (!node || node.visible === false) return null;
    if (_affNeedsPrecomp(node)) return _affImportPrecomp(node, parentId, vb);
    _affScaleStrokeWeights(node);
    var kind = node.kind;
    var created = null;
    if (kind === 'artboard') {
        // Inside an existing composition an artboard becomes a group holding its background
        // rectangle, with the children clipped to it (artboards get their own compositions only
        // when the import targets a new composition; see importAffinityDocument).
        var abGroup = api.create('group', node.name || 'Artboard');
        if (parentId) api.parent(abGroup, parentId);
        __affinityImportedGroups.push(abGroup);
        var abStub = _affArtboardBackground(node);
        abStub.clipsChildren = true;
        importAffinityNode(abStub, abGroup, vb);
        _affApplyOpacity(abGroup, node);
        _affApplyBlend(abGroup, node.blendMode);
        _affApplyMeta(abGroup, node);
        __affinityStats.groups++;
        return abGroup;
    }
    if (node.pathTextOutlines) _affWarn("'" + node.name + "' is text on a path; Affinity's scripting API exposes no baseline path, so it was imported as outlined glyphs (not live text)");
    if (node.fillerTextOutlines) _affWarn("'" + node.name + "' is Affinity filler text, whose words the scripting API does not expose, so it was imported as outlined glyphs (not live text)");
    if (kind === 'group' || kind === 'container') {
        if (!_affSetting('importGroupsEnabled', true) && parentId) {
            _affImportList(node.children, parentId, vb);
            return null;
        }
        var gid = api.create('group', node.name || 'Group');
        if (parentId) api.parent(gid, parentId);
        __affinityImportedGroups.push(gid);
        _affImportList(node.children, gid, vb);
        _affApplyOpacity(gid, node);
        _affApplyBlend(gid, node.blendMode);
        _affApplyTransparency(gid, { id: gid }, node, parentId, vb);
        _affApplyEnclosures(gid, node, parentId, vb);
        _affApplyEffects(gid, node);
        _affReportBlendRanges(node);
        _affApplyMeta(gid, node);
        __affinityStats.groups++;
        return gid;
    }
    try {
        if (kind === 'shape') created = _affCreateShapeLayer(node, parentId, vb);
        else if (kind === 'curve') { var pid = _affCreatePathLayer(node, parentId, vb); created = pid ? { id: pid, rotationDeg: 0, isPath: true } : null; }
        else if (kind === 'text') created = _affCreateTextLayer(node, parentId, vb);
        else if (node.fillLayer === 'complex' && node.fillLayerReason === 'nothing to draw') created = null; // an empty pixel layer
        else if (node.fillLayer === 'complex') { _affWarn("Fill layer '" + (node.name || 'Fill') + "' could not be read as a solid colour or a single linear/radial/elliptical/conical gradient" + (node.fillLayerReason ? ' (' + node.fillLayerReason + ')' : '') + " and was skipped"); created = null; }
        else if (kind === 'image' || kind === 'raster') created = _affCreateImageLayer(node, parentId, vb);
        else { _affWarn("layer kind '" + kind + "' ('" + node.name + "') is not supported yet"); return null; }
    } catch (eCreate) {
        _affWarn("failed to create '" + node.name + "': " + eCreate.message);
        return null;
    }
    if (!created || !created.id) return null;
    var id = created.id;
    if (node.id) __affNodeIds[node.id] = { id: id, isPath: !!created.isPath, kind: kind };
    // With several fills/strokes Affinity's `fill`/`stroke` is the CURRENT descriptor, not the first
    if (node.fills && node.fills.length > 1) node.fill = node.fills[0];
    if (node.strokes && node.strokes.length > 1) node.stroke = node.strokes[0];
    if (kind !== 'text' && kind !== 'image' && kind !== 'raster') {
        _affApplyFill(id, node, created.rotationDeg, created, vb);
        _affApplyExtraFills(id, node, created.rotationDeg, created, vb);
        _affFillNoise(id, node);
        _affApplyStroke(id, node, created, vb);
        _affApplyExtraStrokes(id, node);
        _affApplyGradientOverlays(id, node, created);
    } else if (kind === 'text' && node.stroke) {
        _affApplyStroke(id, node);
        _affApplyExtraStrokes(id, node);
    }
    _affApplyOpacity(id, node);
    var splitBlend = _affCanSplitBlend(id, node);
    if (!splitBlend) _affApplyBlend(id, node.blendMode);
    _affApplyTransparency(id, created, node, parentId, vb);
    // Clipped children (before effects: duplicating a shape steals its filters)
    // Clipped children become SIBLINGS of the clipper (created right after it, so
    // they stack above it) masked by a hidden copy of its geometry. They are not
    // parented under the clipper: a shape parent would offset them by its own
    // transform, and a layer wired into `masks` stops drawing itself.
    if (node.clipsChildren && node.children && node.children.length) {
        // A layer connected to another layer's Clipping Masks stops drawing itself (verified),
        // so a clipper that also paints something (fill, stroke, effects) needs a hidden copy as
        // the mask. An invisible clipper (Affinity's typical Picture Frame) draws nothing anyway,
        // so it is used as the mask directly and no copy is made.
        var paints = _affNodePaints(node);
        // Children blended with Erase knock holes into the clipper (Affinity's "Erase" inside a
        // clipping shape): they become Subtract clipping masks on the clipper instead of drawing.
        var erasers = (node.children || []).filter(function (c) { return c && c.visible !== false && c.blendMode === 'Erase'; });
        var drawn = (node.children || []).filter(function (c) { return !(c && c.blendMode === 'Erase'); });
        if (erasers.length && !paints) { erasers = []; drawn = node.children; } // they erase the layers below them instead (_affApplyErasers)
        // Pictures at the bottom of the clip stack ride on the clipper as image shaders (an Erase
        // child would cut them too, so not when there is one)
        var riders = 0, carried = 0;
        if (!erasers.length && _affCanCarryPictures(node)) {
            while (riders < drawn.length && (!drawn[riders] || drawn[riders].visible === false || (_affCanRideClipper(drawn[riders]) && _affPictureOnClipper(id, node, !!created.isPath, drawn[riders], vb)))) riders++;
            var ridden = drawn.slice(0, riders).filter(function (c) { return c && c.visible !== false; });
            carried = ridden.length;
            drawn = drawn.slice(riders);
            // Fill layers straight above the pictures tint only what the clipper now draws, so they
            // join its material too, above the pictures
            while (carried && drawn.length && _affFillCanRideClipper(drawn[0], node, ridden, vb) && _affAttachFillLayer(drawn[0], node, vb)) drawn = drawn.slice(1);
        }
        // A clipper carrying pictures paints, and a layer wired into Clipping Masks stops drawing,
        // so whatever it still clips needs the hidden copy
        var maskId = (drawn.length && (paints || carried)) ? _affCreateMaskFor(node, parentId, vb) : id;
        var clipped = drawn.length ? _affImportList(drawn, parentId, vb) : [];
        if (__affAlphaMattes[maskId]) {
            // a track matte on a Cavalry group does nothing (a clipped adjustment wraps the layers below it in one),
            // so an alpha clip goes on every layer drawn for the clipped children
            var seenM = {};
            drawn.forEach(function (c) { if (c && c.visible !== false) _affLayerIdsOf(c).forEach(function (t) { if (seenM[t]) return; seenM[t] = true; try { _affAddAlphaMatte(maskId, t); } catch (eAm) { _affWarn("could not clip '" + api.getNiceName(t) + "' to '" + node.name + "': " + eAm.message); } }); });
        } else for (var ci = 0; ci < clipped.length; ci++) _affClipChildTo(clipped[ci], maskId, node);
        if (maskId !== id) _affReportSibling(maskId);
        for (var cs = 0; cs < clipped.length; cs++) _affReportSibling(clipped[cs]);
        if (erasers.length) {
            var erased = _affImportList(erasers, parentId, vb);
            for (var ei = 0; ei < erased.length; ei++) {
                try {
                    api.connect(erased[ei], 'id', id, 'masks');
                    var slots = api.getInConnectedAttributes(id).filter(function (a) { return /^masks\.\d+\.id$/.test(a); });
                    var last = slots.length ? slots[slots.length - 1].replace(/\.id$/, '') : null;
                    if (last) api.set(id, _affAttr(last + '.mode', 1)); // 1 = Subtract (verified: the text is cut out of the shape)
                } catch (eEr) { _affWarn("could not knock out '" + api.getNiceName(erased[ei]) + "' from '" + node.name + "': " + eEr.message); }
            }
            console.info("🏹 Quiver/Affinity: " + erased.length + " Erase layer" + (erased.length === 1 ? '' : 's') + " knocked out of '" + node.name + "'");
        }
        // Masks nested on the clipper must reach what it clips (a mask on a hidden mask copy does nothing):
        // every layer drawn for it, so a split blend's second copy and a clipped group's layers too
        var maskTargets = (paints || carried) ? [id] : [];
        drawn.forEach(function (c) { if (c && c.visible !== false) maskTargets = maskTargets.concat(_affLayerIdsOf(c)); });
        node.__maskTargets = maskTargets;
    }
    _affApplyEnclosures(id, node, parentId, vb, (node.__maskTargets || [id]).concat(__affCompanions[id] || []));
    _affApplyEffects(id, node);
    _affReportBlendRanges(node);
    if (!splitBlend) _affBlendRangeFilter(id, node); // the split puts one on each copy
    _affApplyMeta(id, node);
    (__affCompanions[id] || []).forEach(function (c) { _affApplyOpacity(c, node); _affApplyBlend(c, node.blendMode); _affApplyMeta(c, node); });
    [id].concat(__affCompanions[id] || []).forEach(function (c) { _affDivideInvert(c, node); });
    if (splitBlend) _affSplitBlend(id, node);
    __affinityStats.layers++;
    return id;
}

// ---------------------------------------------------------------------------
// Document import
// ---------------------------------------------------------------------------

// Composition names must be unique: append a counter when the name is taken.
function _affUniqueCompName(base) {
    var taken = {};
    try { api.getAllSceneLayers().forEach(function (id) { if (api.getLayerType(id) === 'compNode') taken[api.getNiceName(id)] = true; }); } catch (e) {}
    if (!taken[base]) return base;
    for (var i = 2; i < 1000; i++) { var n = base + ' ' + i; if (!taken[n]) return n; }
    return base + ' ' + Date.now();
}
function importAffinityDocument(data) {
    if (!data || data.source !== 'affinity' || !data.nodes) { _affWarn('not a Quiver Affinity payload'); return false; }
    __affinityStats = { groups: 0, layers: 0 };
    __affinityWarnings = [];
    __affNodeIds = {};
    __affAlphaMattes = {};
    __affMatteFolds = {};
    __affUnmasked = [];
    __affTurned = {};
    __affRiddenOn = {};
    __affCompanions = {};
    __affBrushFallbacks = [];
    __affArtBrushes = 0;
    var docInfo = data.document || {}, profile = String(docInfo.colourProfile || '');
    if (docInfo.convertedToSrgb) console.info("🏹 Quiver/Affinity: colours and pixels converted from the document's " + profile + " to sRGB");
    else if (profile && !/sRGB/i.test(profile)) _affWarn("the document's colour profile is " + profile + "; its colours and pixel layers were not converted to sRGB, so they may look different in Cavalry");
    __affinityImportedGroups = [];
    __affinityImageStoreCache = {};
    __affinityImageHashCache = {};
    __affinityAssetCache = {};
    __affinityInboxFallback = false;
    __affinityFolderWarned = false;
    __affinityDocTitle = (data.document && data.document.title) ? data.document.title : '';
    var spread = data.spread || { x: 0, y: 0, width: 1920, height: 1080 };
    // Positions are relative to the payload's frame: the spread, or the artboard a selection was
    // made inside (so a layer sent from an artboard lands where it sits in that artboard's comp).
    var frame = (data.frame && data.frame.width > 0 && data.frame.height > 0) ? data.frame : spread;
    if (frame.kind === 'artboard') console.info('🏹 Quiver/Affinity: positioning relative to artboard "' + (frame.name || '') + '" (' + Math.round(frame.width) + ' x ' + Math.round(frame.height) + ')');
    var vb = { x: frame.x || 0, y: frame.y || 0, width: frame.width, height: frame.height };
    _affStatus('Importing from Affinity…');
    try { if (_affSetting('autoSaveEnabled', false) && typeof saveSceneBeforeImport === 'function') saveSceneBeforeImport(); } catch (eSave) {}
    var opts = data.options || {};
    __affinityImagesIncluded = opts.includeImages !== false;
    if (!__affinityImagesIncluded) console.info('🏹 Quiver/Affinity: images and pixel layers were left out in Affinity; grey placeholders stand in for them');
    var previousComp = null;
    var spreadComp = null;
    if (opts.newComp) {
        // Build into a fresh composition sized to the spread; the user's active comp is untouched.
        try {
            previousComp = api.getActiveComp();
            var compName = _affUniqueCompName(opts.compName || (data.document && data.document.title) || 'Affinity');
            var newComp = api.createComp(compName);
            spreadComp = newComp;
            api.setActiveComp(newComp);
            var compAttrs = { 'resolution': [Math.round(frame.width), Math.round(frame.height)] };
            try { if (previousComp) { compAttrs.fps = api.get(previousComp, 'fps'); compAttrs.endFrame = api.get(previousComp, 'endFrame'); compAttrs.playbackEnd = api.get(previousComp, 'playbackEnd'); } } catch (eCopy) {}
            api.set(newComp, compAttrs);
            console.info('🏹 Quiver/Affinity: created composition "' + compName + '" (' + Math.round(frame.width) + ' x ' + Math.round(frame.height) + ')');
        } catch (eComp) {
            _affWarn('could not create a new composition, importing into the active one: ' + eComp.message);
        }
    }
    var wantResize = !opts.newComp && (affinityMatchCompSize || !!opts.matchCompSize);
    if (wantResize && (data.scope === 'spread' || frame !== spread)) {
        try { api.set(api.getActiveComp(), { 'resolution': [Math.round(frame.width), Math.round(frame.height)] }); } catch (eRes) {}
    }
    var ordered = (data.order === 'front-to-back') ? data.nodes.slice().reverse() : data.nodes;
    var created = [];
    var artboards = ordered.filter(function (n) { return n && n.kind === 'artboard' && n.visible !== false && n.artboardBox; });
    if (opts.newComp && artboards.length) {
        // Like Figma frames: one composition per artboard, sized to it, children placed relative to it.
        var loose = ordered.filter(function (n) { return !(n && n.kind === 'artboard'); });
        var firstComp = null;
        for (var ai = 0; ai < artboards.length; ai++) {
            var ab = artboards[ai];
            var box = ab.artboardBox;
            try {
                var abCompName = _affUniqueCompName(ab.name || ('Artboard ' + (ai + 1)));
                var abComp = api.createComp(abCompName);
                api.setActiveComp(abComp);
                var abAttrs = { 'resolution': [Math.round(box.w), Math.round(box.h)] };
                try { if (previousComp) { abAttrs.fps = api.get(previousComp, 'fps'); abAttrs.endFrame = api.get(previousComp, 'endFrame'); abAttrs.playbackEnd = api.get(previousComp, 'playbackEnd'); } } catch (eCopy2) {}
                var abFill = (ab.fills && ab.fills.length) ? ab.fills[0] : ab.fill;
                var plainBg = !!(abFill && abFill.type === 'Solid' && abFill.colour && !(abFill.noise > 0) && !(ab.fills && ab.fills.length > 1));
                if (plainBg) abAttrs.backgroundColor = _affHex(abFill.colour);
                api.set(abComp, abAttrs);
                if (!firstComp) firstComp = abComp;
                var abVb = { x: box.x, y: box.y, width: box.w, height: box.h };
                // a gradient, noisy or stacked fill cannot be the composition's background colour: it becomes the bottom layer
                if (abFill && !plainBg) { var abBg = _affArtboardBackground(ab); abBg.children = []; importAffinityNode(abBg, null, abVb); }
                var abCreated = _affImportList(ab.children || [], null, abVb);
                if (ab.effects && ab.effects.length) _affWarn("artboard '" + ab.name + "' has layer effects; these are not applied to a composition");
                console.info('🏹 Quiver/Affinity: created composition "' + abCompName + '" for artboard (' + Math.round(box.w) + ' x ' + Math.round(box.h) + ', ' + abCreated.length + ' top-level layers)');
                created = abCreated;
            } catch (eAb) { _affWarn("could not build a composition for artboard '" + ab.name + "': " + eAb.message); }
        }
        if (loose.length && spreadComp) {
            // whatever sits outside the artboards goes into the spread-sized composition created above
            try { api.setActiveComp(spreadComp); api.set(spreadComp, { 'niceName': _affUniqueCompName((opts.compName || __affinityDocTitle || 'Affinity') + ' (outside artboards)') }); } catch (eLc) {}
            created = _affImportList(loose, null, vb);
        } else if (loose.length) {
            created = _affImportList(loose, null, vb);
        } else if (spreadComp && spreadComp !== firstComp) {
            // the spread-sized composition made above is redundant when everything lives on artboards
            try { if ((api.getChildren(spreadComp) || []).length === 0) { api.setActiveComp(firstComp); api.deleteLayer(spreadComp); } } catch (eDel) {}
        }
        if (firstComp) { try { api.setActiveComp(firstComp); } catch (eFc) {} }
    } else {
        created = _affImportList(ordered, null, vb);
    }
    if (_affSetting('centreGroupPivotsEnabled', true)) {
        for (var g = 0; g < __affinityImportedGroups.length; g++) { try { api.centrePivot(__affinityImportedGroups[g], false); } catch (eCp) {} }
    }
    try { if (created.length) api.select(created); } catch (eSel) {}
    var summary = __affinityStats.layers + ' layers, ' + __affinityStats.groups + ' groups from ' + (data.document && data.document.title ? data.document.title : 'Affinity');
    if (__affArtBrushes) console.info('🏹 Quiver/Affinity: ' + __affArtBrushes + ' brush stroke' + (__affArtBrushes === 1 ? '' : 's') + ' laid along ' + (__affArtBrushes === 1 ? 'its path' : 'their paths') + ' with Affinity\'s texture (they follow and re-stretch with path edits)');
    if (__affBrushFallbacks.length) {
        var why = {}; __affBrushFallbacks.forEach(function (r) { why[r] = (why[r] || 0) + 1; });
        console.info('🏹 Quiver/Affinity: kept Affinity\'s render for ' + __affBrushFallbacks.length + ' brush stroke' + (__affBrushFallbacks.length === 1 ? '' : 's') + ' the filter cannot stand in for (' + Object.keys(why).map(function (k) { return why[k] + ': ' + k; }).join('; ') + ')');
    }
    if (__affUnmasked.length) _affWarn(__affUnmasked.length + ' adjustment layer' + (__affUnmasked.length === 1 ? ' has a mask' : 's have masks') + " in Affinity, which Quiver does not carry, so " + (__affUnmasked.length === 1 ? 'it affects' : 'they affect') + ' everything below ' + (__affUnmasked.length === 1 ? 'it' : 'them') + ': ' + __affUnmasked.join(', '));
    console.info('🏹 Quiver/Affinity: imported ' + summary + (__affinityWarnings.length ? ' (' + __affinityWarnings.length + ' warnings)' : ''));
    _affStatus('Affinity: ' + __affinityStats.layers + ' layers imported' + (__affinityWarnings.length ? ', ' + __affinityWarnings.length + ' warnings' : ''));
    return true;
}

function importAffinityFile(path) {
    if (!path) return false;
    var text = null;
    try { text = api.readFromFile(path); } catch (e) { _affWarn('could not read ' + path + ': ' + e.message); return false; }
    var data = null;
    try { data = JSON.parse(text); } catch (eJson) { _affWarn('invalid JSON in ' + path); return false; }
    if (quiverAffinityServer) _affRememberOptions(data.options); // a real send from the panel, not a test harness
    var ok = importAffinityDocument(data);
    if (ok) _affCleanInbox(path, data);
    return ok;
}
// The Desktop is only a transport inbox (Affinity's HTTP client cannot send a body).
// Once every image has a copy in the project's Assets/Quiver folder the payload and its images
// are removed from the inbox. If any asset still points at an inbox file, everything stays.
function _affImagePaths(nodes, out) {
    for (var i = 0; i < (nodes || []).length; i++) {
        var n = nodes[i]; if (!n) continue;
        if (n.image && n.image.path) out.push(n.image.path);
        [n.fill].concat(n.fills || []).forEach(function (f) { if (f && f.bitmap && f.bitmap.path) out.push(f.bitmap.path); });
        if (n.stroke && n.stroke.brush && n.stroke.brush.path) out.push(n.stroke.brush.path);
        if (n.stroke && n.stroke.artBrush && n.stroke.artBrush.path) out.push(n.stroke.artBrush.path);
        _affImagePaths(n.children, out);
        for (var e = 0; e < (n.enclosures || []).length; e++) { var enc = n.enclosures[e]; if (enc && enc.node) _affImagePaths([enc.node], out); }
    }
    return out;
}
function _affCleanInbox(jsonPath, data) {
    try {
        if (!api.deleteFilePath) return;
        if (__affinityInboxFallback) { console.info('🏹 Quiver/Affinity: kept the inbox files (some images are still used from the inbox)'); return; }
        var folder = jsonPath.substring(0, jsonPath.lastIndexOf('/'));
        var images = _affImagePaths(data.nodes, []);
        var removed = 0;
        var seen = {};
        for (var i = 0; i < images.length; i++) {
            var p = images[i];
            if (seen[p] || p.indexOf(folder + '/') !== 0) continue; // only files beside the payload, never elsewhere
            seen[p] = true;
            var copy = __affinityImageStoreCache[p];
            // a file the import never used (an older payload's adjustment masks) is removed too
            if (!copy && !__affinityAssetCache[p]) { try { if (api.filePathExists(p) && api.deleteFilePath(p)) removed++; } catch (eUn) {} continue; }
            if (!copy || copy === p || !api.filePathExists(copy)) continue; // no project copy: keep the original
            try { if (api.filePathExists(p) && api.deleteFilePath(p)) removed++; } catch (eDel) {}
        }
        try { if (api.filePathExists(jsonPath) && api.deleteFilePath(jsonPath)) removed++; } catch (eJ) {}
        if (removed) console.info('🏹 Quiver/Affinity: cleaned ' + removed + ' file' + (removed === 1 ? '' : 's') + ' from the inbox');
    } catch (e) { _affWarn('inbox cleanup skipped: ' + e.message); }
}

// ---------------------------------------------------------------------------
// Transport: own WebServer. Affinity's HTTP client cannot send a body, so the
// payload is written to disk and its path arrives in the X-Quiver-Path header.
// ---------------------------------------------------------------------------
function _affHeader(post, name) {
    var headers = (post && post.headers) || [];
    var wanted = String(name).toLowerCase();
    for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (h && String(h.name || '').toLowerCase() === wanted) return h.value;
    }
    return null;
}
// The GET banner Affinity pings before sending. It carries the project's Assets/Quiver folder so
// the Affinity script can write the payload and images straight there (if that folder is allowed
// in Affinity's scripting settings) instead of the Desktop inbox. Never prompts: when the scene has
// no project the banner simply has no folder and Affinity uses the inbox.
function _affAssetsQuiverDir() {
    try {
        var assets = (api.getAssetPath && api.getAssetPath()) || '';
        if (!assets) return '';
        var dir = assets + '/Quiver';
        try { if (!api.filePathExists(dir) && api.ensureDirectory) api.ensureDirectory(dir, false, true); } catch (eMk) {}
        return api.filePathExists(dir) ? dir : assets;
    } catch (e) { return ''; }
}
// The Affinity dialog opens on the choices of the last send: Affinity gives scripts no settings
// storage, so Cavalry keeps them and hands them back in the ping reply.
var QUIVER_AFFINITY_OPTIONS_PREF = 'quiverAffinityLastOptions';
function _affRememberOptions(opts) {
    if (!opts) return;
    try { api.setPreferenceObject(QUIVER_AFFINITY_OPTIONS_PREF, { newComp: !!opts.newComp, matchCompSize: !!opts.matchCompSize, includeImages: opts.includeImages !== false, nativeBrushes: !!opts.nativeBrushes, flatImage: !!opts.flatImage }); } catch (e) {}
}
function _affRememberedOptions() {
    try { return api.hasPreferenceObject(QUIVER_AFFINITY_OPTIONS_PREF) ? api.getPreferenceObject(QUIVER_AFFINITY_OPTIONS_PREF) : null; } catch (e) { return null; }
}
function _affRefreshBanner() {
    if (!quiverAffinityServer) return;
    try {
        var banner = { app: 'Quiver', version: (typeof currentVersion !== 'undefined' ? String(currentVersion) : ''), listening: true, assets: _affAssetsQuiverDir(), options: _affRememberedOptions() };
        quiverAffinityServer.setResultForGet(JSON.stringify(banner));
    } catch (eGet) {}
}
function initializeQuiverAffinityServer() {
    try {
        if (typeof api.WebServer === 'undefined') { console.info('🏹 Quiver/Affinity: web server needs Cavalry 2.4+'); return false; }
        quiverAffinityServer = new api.WebServer();
        var callbacks = {
            onPost: function () {
                var post = null;
                try { post = quiverAffinityServer.getNextPost(); } catch (e) { return; }
                if (!post) return;
                var source = _affHeader(post, 'X-Quiver-Source');
                var path = _affHeader(post, 'X-Quiver-Path');
                // Affinity strips accents from header values ('José' arrives as 'Jose'), so 0.33+ sends the path
                // percent-encoded and says so; older scripts send it raw
                if (path && String(_affHeader(post, 'X-Quiver-Path-Encoding') || '').toLowerCase() === 'uri') { try { path = decodeURIComponent(path); } catch (eDec) {} }
                if (source !== 'affinity' || !path) {
                    console.warn('🏹 Quiver/Affinity: ignored a request without an X-Quiver-Path header');
                    return;
                }
                console.info('🏹 Quiver/Affinity: receiving ' + (_affHeader(post, 'X-Quiver-Summary') || 'payload') + ' from ' + path);
                importAffinityFile(path);
                _affRefreshBanner();
            }
        };
        quiverAffinityServer.listen('127.0.0.1', QUIVER_AFFINITY_PORT);
        _affRefreshBanner();
        quiverAffinityServer.addCallbackObject(callbacks);
        quiverAffinityServer.setHighFrequency();
        console.info('🏹 Quiver/Affinity listening on http://127.0.0.1:' + QUIVER_AFFINITY_PORT);
        return true;
    } catch (e) {
        console.warn('🏹 Quiver/Affinity: could not start web server - ' + e.message);
        quiverAffinityServer = null;
        return false;
    }
}
function stopQuiverAffinityServer() {
    try { if (quiverAffinityServer) quiverAffinityServer.stop(); } catch (e) {}
    quiverAffinityServer = null;
}

// ---------------------------------------------------------------------------
// Cleanup on close (additive and guarded, so the Figma UI is untouched if it fails). There is no
// Affinity button: the Affinity script waits until this panel is listening before it sends.
// ---------------------------------------------------------------------------
(function quiverAffinityInit() {
    try {
        if (typeof Quiver !== 'undefined' && Quiver) {
            var previousCleanup = Quiver.cleanup;
            Quiver.cleanup = function () { stopQuiverAffinityServer(); if (typeof previousCleanup === 'function') previousCleanup(); };
            Quiver.affinityPort = QUIVER_AFFINITY_PORT;
            Quiver.importAffinityFile = importAffinityFile;
            Quiver.importAffinityDocument = importAffinityDocument;
        }
    } catch (eQ) {}
    if (typeof __quiverAffinityNoServer === 'undefined') initializeQuiverAffinityServer();
})();
