// --- Utilities ---
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}

function parseOpacityValue(value) {
    if (value === null || value === undefined || value === "") return null;
    var v = ("" + value).trim();
    if (v.endsWith("%")) {
        var num = parseFloat(v.slice(0, -1));
        if (isNaN(num)) return null;
        return clamp01(num / 100);
    }
    var n = parseFloat(v);
    if (isNaN(n)) return null;
    return clamp01(n);
}

// --- Colour resolution ---
// Cavalry silently renders any colour string it cannot parse as opaque black rather
// than raising, so every value must be reduced to a plain sRGB hex before api.set.

var CSS_NAMED_COLORS = {
    aliceblue:"#F0F8FF", antiquewhite:"#FAEBD7", aqua:"#00FFFF", aquamarine:"#7FFFD4",
    azure:"#F0FFFF", beige:"#F5F5DC", bisque:"#FFE4C4", black:"#000000",
    blanchedalmond:"#FFEBCD", blue:"#0000FF", blueviolet:"#8A2BE2", brown:"#A52A2A",
    burlywood:"#DEB887", cadetblue:"#5F9EA0", chartreuse:"#7FFF00", chocolate:"#D2691E",
    coral:"#FF7F50", cornflowerblue:"#6495ED", cornsilk:"#FFF8DC", crimson:"#DC143C",
    cyan:"#00FFFF", darkblue:"#00008B", darkcyan:"#008B8B", darkgoldenrod:"#B8860B",
    darkgray:"#A9A9A9", darkgreen:"#006400", darkgrey:"#A9A9A9", darkkhaki:"#BDB76B",
    darkmagenta:"#8B008B", darkolivegreen:"#556B2F", darkorange:"#FF8C00",
    darkorchid:"#9932CC", darkred:"#8B0000", darksalmon:"#E9967A", darkseagreen:"#8FBC8F",
    darkslateblue:"#483D8B", darkslategray:"#2F4F4F", darkslategrey:"#2F4F4F",
    darkturquoise:"#00CED1", darkviolet:"#9400D3", deeppink:"#FF1493",
    deepskyblue:"#00BFFF", dimgray:"#696969", dimgrey:"#696969", dodgerblue:"#1E90FF",
    firebrick:"#B22222", floralwhite:"#FFFAF0", forestgreen:"#228B22", fuchsia:"#FF00FF",
    gainsboro:"#DCDCDC", ghostwhite:"#F8F8FF", gold:"#FFD700", goldenrod:"#DAA520",
    gray:"#808080", green:"#008000", greenyellow:"#ADFF2F", grey:"#808080",
    honeydew:"#F0FFF0", hotpink:"#FF69B4", indianred:"#CD5C5C", indigo:"#4B0082",
    ivory:"#FFFFF0", khaki:"#F0E68C", lavender:"#E6E6FA", lavenderblush:"#FFF0F5",
    lawngreen:"#7CFC00", lemonchiffon:"#FFFACD", lightblue:"#ADD8E6", lightcoral:"#F08080",
    lightcyan:"#E0FFFF", lightgoldenrodyellow:"#FAFAD2", lightgray:"#D3D3D3",
    lightgreen:"#90EE90", lightgrey:"#D3D3D3", lightpink:"#FFB6C1", lightsalmon:"#FFA07A",
    lightseagreen:"#20B2AA", lightskyblue:"#87CEFA", lightslategray:"#778899",
    lightslategrey:"#778899", lightsteelblue:"#B0C4DE", lightyellow:"#FFFFE0",
    lime:"#00FF00", limegreen:"#32CD32", linen:"#FAF0E6", magenta:"#FF00FF",
    maroon:"#800000", mediumaquamarine:"#66CDAA", mediumblue:"#0000CD",
    mediumorchid:"#BA55D3", mediumpurple:"#9370DB", mediumseagreen:"#3CB371",
    mediumslateblue:"#7B68EE", mediumspringgreen:"#00FA9A", mediumturquoise:"#48D1CC",
    mediumvioletred:"#C71585", midnightblue:"#191970", mintcream:"#F5FFFA",
    mistyrose:"#FFE4E1", moccasin:"#FFE4B5", navajowhite:"#FFDEAD", navy:"#000080",
    oldlace:"#FDF5E6", olive:"#808000", olivedrab:"#6B8E23", orange:"#FFA500",
    orangered:"#FF4500", orchid:"#DA70D6", palegoldenrod:"#EEE8AA", palegreen:"#98FB98",
    paleturquoise:"#AFEEEE", palevioletred:"#DB7093", papayawhip:"#FFEFD5",
    peachpuff:"#FFDAB9", peru:"#CD853F", pink:"#FFC0CB", plum:"#DDA0DD",
    powderblue:"#B0E0E6", purple:"#800080", rebeccapurple:"#663399", red:"#FF0000",
    rosybrown:"#BC8F8F", royalblue:"#4169E1", saddlebrown:"#8B4513", salmon:"#FA8072",
    sandybrown:"#F4A460", seagreen:"#2E8B57", seashell:"#FFF5EE", sienna:"#A0522D",
    silver:"#C0C0C0", skyblue:"#87CEEB", slateblue:"#6A5ACD", slategray:"#708090",
    slategrey:"#708090", snow:"#FFFAFA", springgreen:"#00FF7F", steelblue:"#4682B4",
    tan:"#D2B48C", teal:"#008080", thistle:"#D8BFD8", tomato:"#FF6347",
    turquoise:"#40E0D0", violet:"#EE82EE", wheat:"#F5DEB3", white:"#FFFFFF",
    whitesmoke:"#F5F5F5", yellow:"#FFFF00", yellowgreen:"#9ACD32"
};

// Linear Display P3 -> CIE XYZ (D65) -> linear sRGB
var _P3_TO_XYZ = [
    [0.4865709486482162, 0.26566769316909306, 0.19821728523436250],
    [0.2289745640697488, 0.69173852183650640, 0.07928691409374500],
    [0.0000000000000000, 0.04511338185890264, 1.04394436890097600]
];
var _XYZ_TO_SRGB = [
    [ 3.24096994190452260, -1.53738317757009400, -0.49861076029300340],
    [-0.96924363628087960,  1.87596750150772020,  0.04155505740717559],
    [ 0.05563007969699366, -0.20397695888897652,  1.05697151424287860]
];

function _srgbEncode(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function _srgbDecode(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function _hexByte(n) {
    var v = Math.max(0, Math.min(255, Math.round(n)));
    var h = v.toString(16).toUpperCase();
    return h.length < 2 ? "0" + h : h;
}

function _channelsToHex(r, g, b) {
    return "#" + _hexByte(r) + _hexByte(g) + _hexByte(b);
}

function _normaliseHex(value) {
    var h = ("" + value).trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]+$/.test(h)) return null;
    if (h.length === 3 || h.length === 4) {
        return ("#" + h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)).toUpperCase();
    }
    if (h.length === 6 || h.length === 8) {
        return ("#" + h.substring(0, 6)).toUpperCase();
    }
    return null;
}

// Splits the inside of a colour function, tolerating both comma and space separated
// forms and discarding any "/ alpha" component (alpha travels via fill-opacity).
function _splitColorArgs(inner) {
    var s = ("" + inner).trim();
    var slash = s.indexOf("/");
    if (slash !== -1) s = s.substring(0, slash);
    s = s.replace(/,/g, " ");
    return s.split(/\s+/).filter(function (t) { return t !== ""; });
}

function _numOr(token, scale, fallback) {
    var t = ("" + token).trim();
    var isPct = t.charAt(t.length - 1) === "%";
    var n = parseFloat(isPct ? t.slice(0, -1) : t);
    if (isNaN(n)) return fallback;
    return isPct ? (n / 100) * scale : n;
}

function _hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var hp = h / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r = 0, g = 0, b = 0;
    if (hp >= 0 && hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    var m = l - c / 2;
    return _channelsToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function _wideGamutToHex(space, args) {
    var comps = [
        _numOr(args[0], 1, NaN),
        _numOr(args[1], 1, NaN),
        _numOr(args[2], 1, NaN)
    ];
    if (isNaN(comps[0]) || isNaN(comps[1]) || isNaN(comps[2])) return null;

    if (space === "srgb") {
        return _channelsToHex(comps[0] * 255, comps[1] * 255, comps[2] * 255);
    }
    if (space === "srgb-linear") {
        return _channelsToHex(_srgbEncode(comps[0]) * 255, _srgbEncode(comps[1]) * 255, _srgbEncode(comps[2]) * 255);
    }
    if (space !== "display-p3") return null;

    var lin = [_srgbDecode(comps[0]), _srgbDecode(comps[1]), _srgbDecode(comps[2])];
    var xyz = [0, 0, 0];
    var i, j;
    for (i = 0; i < 3; i++) {
        xyz[i] = _P3_TO_XYZ[i][0] * lin[0] + _P3_TO_XYZ[i][1] * lin[1] + _P3_TO_XYZ[i][2] * lin[2];
    }
    var out = [0, 0, 0];
    for (i = 0; i < 3; i++) {
        out[i] = 0;
        for (j = 0; j < 3; j++) out[i] += _XYZ_TO_SRGB[i][j] * xyz[j];
    }
    return _channelsToHex(_srgbEncode(out[0]) * 255, _srgbEncode(out[1]) * 255, _srgbEncode(out[2]) * 255);
}

// Returns a "#RRGGBB" string, or null when the value names no paint at all
// ("none"/"transparent") or cannot be understood.
function resolveColorToHex(value) {
    if (value === null || value === undefined) return null;
    var s = ("" + value).trim();
    if (s === "") return null;
    var lower = s.toLowerCase();
    if (lower === "none" || lower === "transparent") return null;
    if (lower === "currentcolor") return "#000000";
    if (s.charAt(0) === "#") return _normaliseHex(s);
    if (CSS_NAMED_COLORS[lower]) return CSS_NAMED_COLORS[lower];

    var fn = /^([a-z-]+)\s*\(([\s\S]*)\)$/.exec(lower);
    if (!fn) return null;
    var name = fn[1];
    var args = _splitColorArgs(fn[2]);

    if (name === "rgb" || name === "rgba") {
        if (args.length < 3) return null;
        var r = _numOr(args[0], 255, NaN);
        var g = _numOr(args[1], 255, NaN);
        var b = _numOr(args[2], 255, NaN);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
        return _channelsToHex(r, g, b);
    }
    if (name === "hsl" || name === "hsla") {
        if (args.length < 3) return null;
        var hRaw = ("" + args[0]).replace(/deg$/, "");
        var h = parseFloat(hRaw);
        var sV = _numOr(args[1], 1, NaN);
        var lV = _numOr(args[2], 1, NaN);
        if (isNaN(h) || isNaN(sV) || isNaN(lV)) return null;
        return _hslToHex(h, sV, lV);
    }
    if (name === "color") {
        if (args.length < 4) return null;
        return _wideGamutToHex(args[0], args.slice(1));
    }
    return null;
}

// True for any value that meaningfully specifies a paint, including the explicit
// no-paint keywords and gradient/pattern references.
function isUsableColorValue(value) {
    if (value === null || value === undefined) return false;
    var s = ("" + value).trim();
    if (s === "") return false;
    var lower = s.toLowerCase();
    if (lower === "none" || lower === "transparent" || lower === "inherit" || lower === "currentcolor") return true;
    if (lower.indexOf("url(") === 0) return true;
    return resolveColorToHex(s) !== null;
}

function isNoPaintValue(value) {
    if (value === null || value === undefined) return false;
    var lower = ("" + value).trim().toLowerCase();
    return lower === "none" || lower === "transparent";
}

// Wide-gamut function forms carry colours Cavalry cannot represent directly; when an
// exporter also supplies an sRGB declaration we prefer that authored value.
function isWideGamutColorValue(value) {
    if (value === null || value === undefined) return false;
    var lower = ("" + value).trim().toLowerCase();
    if (lower.indexOf("color(") !== 0) return false;
    return !/^color\(\s*srgb(-linear)?[\s)]/.test(lower);
}

var __quiverUnresolvedColors = {};

function parseColor(colorString) {
    if (!colorString || colorString === "none") return null;
    var hex = resolveColorToHex(colorString);
    if (hex) return hex;
    if (isNoPaintValue(colorString)) return null;
    var key = "" + colorString;
    if (!__quiverUnresolvedColors[key]) {
        __quiverUnresolvedColors[key] = true;
        try {
            console.warn('🏹 Quiver: could not resolve colour "' + key + '" - Cavalry will draw it black.');
        } catch (e) {}
    }
    return colorString; // best effort
}

// Normalize SVG stroke-dasharray to Cavalry dash pattern CSV (e.g., "4, 2"); return null for none/invalid
function normalizeDashArrayToCsv(val) {
    try {
        if (val === null || val === undefined) return null;
        var s = ('' + val).trim();
        if (!s || s.toLowerCase() === 'none' || s === '0') return null;
        // Replace commas with spaces then split
        s = s.replace(/,/g, ' ');
        var parts = s.split(/\s+/).filter(function(t){ return t!==''; });
        var nums = [];
        for (var i = 0; i < parts.length; i++) {
            var n = parseFloat(parts[i]);
            if (!isNaN(n) && isFinite(n)) nums.push(Math.max(0, n));
        }
        if (nums.length === 0) return null;
        return nums.join(', ');
    } catch (e) { return null; }
}

function extractAttribute(tag, name) {
    if (!tag || !name) return null;
    // Try to match attribute with its value, handling nested quotes
    // First try double quotes
    var regex1 = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*"([^"]*)"');
    var match = regex1.exec(tag);
    if (match) return match[1];
    // Then try single quotes
    var regex2 = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*'([^']*)'");
    match = regex2.exec(tag);
    return match ? match[1] : null;
}

function extractStyleProperty(styleString, propertyName) {
    if (!styleString || !propertyName) return null;
    var parts = styleString.split(';');
    var target = ("" + propertyName).trim().toLowerCase();
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (!seg) continue;
        var kv = seg.split(':');
        if (kv.length < 2) continue;
        var key = kv[0].trim().toLowerCase();
        if (key === target) return kv.slice(1).join(':').trim();
    }
    return null;
}

var STYLE_PAINT_PROPS = {
    'fill': 1,
    'stroke': 1,
    'stop-color': 1,
    'flood-color': 1,
    'lighting-color': 1
};

// Exporters such as Figma declare a paint twice for progressive enhancement, e.g.
// style="fill:#F5F5F5;fill:color(display-p3 0.9608 0.9608 0.9608)". Plain last-wins
// would keep the wide-gamut form and lose the authored sRGB value.
function pickPaintDeclaration(values) {
    var lastUsable = null;
    var lastSrgb = null;
    for (var i = 0; i < values.length; i++) {
        var v = values[i];
        if (!isUsableColorValue(v)) continue;
        lastUsable = v;
        if (!isWideGamutColorValue(v)) lastSrgb = v;
    }
    if (lastSrgb !== null) return lastSrgb;
    if (lastUsable !== null) return lastUsable;
    return values[values.length - 1];
}

function mergeInlineStyleIntoAttrs(openingTag) {
    var styleAttr = extractAttribute(openingTag, "style");
    var merged = {};
    if (!styleAttr) return merged;
    var parts = styleAttr.split(';');
    var collected = {};
    var keyOrder = [];
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (!seg) continue;
        var kv = seg.split(':');
        if (kv.length < 2) continue;
        var key = kv[0].trim();
        var val = kv.slice(1).join(':').trim();
        if (!collected[key]) {
            collected[key] = [];
            keyOrder.push(key);
        }
        collected[key].push(val);
    }
    for (var k = 0; k < keyOrder.length; k++) {
        var name = keyOrder[k];
        var vals = collected[name];
        merged[name] = STYLE_PAINT_PROPS[name.toLowerCase()]
            ? pickPaintDeclaration(vals)
            : vals[vals.length - 1];
    }
    return merged;
}

// Decode HTML entities in names, including sequences of decimal byte entities representing UTF-8 (e.g. &#240;&#159;&#166;&#139; → 🦋)
function decodeEntitiesForName(str) {
    if (!str) return str;
    var out = str;
    // Hex numeric: &#x1F98B;
    out = out.replace(/&#x([0-9a-fA-F]+);/g, function(_, hex) {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch (e) { return _; }
    });
    // Groups of decimal numeric entities that may encode UTF-8 bytes
    out = out.replace(/((?:&#\d+;)+)/g, function(group) {
        var nums = [];
        var m;
        var rx = /&#(\d+);/g;
        while ((m = rx.exec(group)) !== null) nums.push(parseInt(m[1], 10));
        if (nums.length === 0) return group;
        // Attempt to treat as bytes and decode via percent-encoding
        try {
            var perc = nums.map(function(n){
                var h = n.toString(16).toUpperCase();
                if (h.length < 2) h = '0' + h;
                return '%' + h;
            }).join('');
            return decodeURIComponent(perc);
        } catch (e) {
            // Fallback: decode each as code point
            return nums.map(function(n){
                try { return String.fromCodePoint(n); } catch (e2) { return ''; }
            }).join('');
        }
    });
    // Common named entities
    out = out.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    return out;
}

function extractUrlRefId(value) {
    if (!value) return null;
    var m = /url\(#([^\)]+)\)/.exec(value);
    return m ? m[1] : null;
}

// Global gradient context (set at import time)
var __svgGradientMap = {};
var __svgGradientCache = {};
var __createdPathLayers = [];
var __svgViewBox = null; // Store viewBox for coordinate conversions in gradient offset calculations
var __svgFilterMap = {};
var __filterNodesCache = {}; // id -> [nodeIds]
var __groupDirectChildren = {}; // parentId -> [childIds]
var __imageImportCache = {}; // href/hash -> savedPath
var __svgPatternMap = {}; // id -> { attrs..., image: { href, x, y, width, height } }
var __patternImageShaderCache = {}; // patternId -> shaderId
var __lastPatternOrImageName = 'img';
var __currentFrameName = ''; // Source frame name from Figma for asset filename prefixes
var __imageNamingContext = {}; // Store parent context for better image naming
var __imageCounter = 0; // Global counter for unique image numbers
var __groupCounter = 0; // Global counter for anonymous groups

// Deferred background blur queue - processed after all shapes are created
// Each entry: { overlayShapeId, amount, parentId }
var __deferredBackgroundBlurs = [];
// Deferred Figma Glass queue lives in quiver_utilities_glass.js

function setPatternContext(map) {
    __svgPatternMap = map || {};
    __patternImageShaderCache = {};
}

function _hasAttr(id, attr) {
    try { if (api.hasAttribute) return !!api.hasAttribute(id, attr); } catch (e) {}
    try { var _ = api.get(id, attr); return true; } catch (e2) { return false; }
}

function _sanitizeFileComponent(name) {
    try {
        var s = (name==null?'':(''+name)).trim();
        s = decodeEntitiesForName(s);
        // Replace only filesystem-illegal characters with underscore
        // Allows Unicode/emoji while blocking: \ / : * ? " < > | and control chars
        s = s.replace(/[\\/:*?"<>|\x00-\x1F\x7F]+/g, '_');
        // Replace any remaining whitespace with underscore
        s = s.replace(/\s+/g, '_');
        // Trim leading/trailing underscores
        s = s.replace(/^_+|_+$/g, '');
        if (!s) s = 'img';
        if (s.length > 40) s = s.slice(0, 40);
        return s;
    } catch (e) { return 'img'; }
}

function _setFirstSupported(id, candidates, value) {
    for (var i = 0; i < candidates.length; i++) {
        var a = candidates[i];
        if (_hasAttr(id, a)) {
            try { var obj={}; obj[a]=value; api.set(id, obj); return a; } catch (eSet) { /* try next */ }
        }
    }
    return null;
}

/**
 * Connect a gradient/color shader to a shape's material.colorShaders.
 * 
 * @param {string} shaderId - The shader layer ID
 * @param {string} shapeId - The shape layer ID
 * @param {Object} [svgShapeCenter] - Optional shape center in SVG coordinates {x, y}
 * 
 * Cavalry API used:
 * - api.setFill(id, bool) - Enable fill on shape
 * - api.set(id, props) - Set properties
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect attributes
 * - api.get(id, attr) - Get attribute value
 * - api.getParent(id) - Get parent layer
 * - api.parent(childId, parentId) - Parent layer
 */
function connectShaderToShape(shaderId, shapeId, svgShapeCenter, fillAlpha, shapeScaleY, shapeRotationDeg) {
    // shapeScaleY: the shape's Y scale from transform (negative = Y-flip)
    // shapeRotationDeg: the shape's rotation in degrees (for userSpaceOnUse gradient compensation)
    // Used to determine if gradient direction needs to be adjusted
    var isFlippedY = (shapeScaleY !== undefined && shapeScaleY < 0);
    var shapeRotation = (shapeRotationDeg !== undefined) ? shapeRotationDeg : 0;
    
    try { 
        api.setFill(shapeId, true); 
    } catch (e) {}
    
    // Critical: hide base color so shader is visible
    try { 
        api.set(shapeId, {"material.materialColor.a": 0}); 
        
    } catch (eA) {}
    
    // Keep material.alpha at 100% - the fill-opacity is applied to the SHADER's alpha
    try { 
        api.set(shapeId, {"material.alpha": 100}); 
    } catch (eMA) {}
    
    try {
        api.connect(shaderId, 'id', shapeId, 'material.colorShaders');

        // Apply fill-opacity to the shader's alpha (not material.alpha)
        // This is how Cavalry handles gradient/shader opacity vs shape opacity
        if (typeof fillAlpha === 'number' && fillAlpha < 1) {
            var shaderAlphaPct = Math.round(fillAlpha * 100000) / 1000;
            try {
                api.set(shaderId, {'alpha': shaderAlphaPct});
            } catch (eShaderAlpha) {
            }
        }

        // Ensure shader is visible (not hidden)
        try {
            api.set(shaderId, {'hidden': false});
            
        } catch (eVis) {}
        
        // For userSpaceOnUse RADIAL gradients with stored absolute positions, calculate relative offset
        // (Linear gradients have their own offset calculation below)
        try {
            // Get the gradient data to check if it has absolute position info
            var gradientData = null;
            var gradientId = null;
            if (__svgGradientMap && __svgGradientCache) {
                // Find which gradient ID maps to this shader
                for (var gid in __svgGradientCache) {
                    if (__svgGradientCache[gid] === shaderId) {
                        gradientId = gid;
                        gradientData = __svgGradientMap[gid];
                        break;
                    }
                }
            }
            
            // Only run this block for RADIAL gradients
            if (gradientData && gradientData.type === 'radial' && gradientData._absoluteCenterX !== undefined && gradientData._absoluteCenterY !== undefined) {
                // Ensure we have valid numbers
                var absX = parseFloat(gradientData._absoluteCenterX);
                var absY = parseFloat(gradientData._absoluteCenterY);
                
                if (!isNaN(absX) && !isNaN(absY)) {
                    // Get the shape's center in SVG coordinates
                    var shapeSvgCenterX = null;
                    var shapeSvgCenterY = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        // Use provided SVG center (preferred - accurate)
                        shapeSvgCenterX = svgShapeCenter.x;
                        shapeSvgCenterY = svgShapeCenter.y;
                    } else {
                        // Fallback for paths: use Cavalry bounding box and reverse-convert to SVG
                        // We need the viewBox to do proper conversion, so just log and skip offset
                    }
                    
                    // Only calculate offset if we have a valid SVG center
                    if (shapeSvgCenterX !== null && shapeSvgCenterY !== null) {
                        // Calculate offset in SVG coordinate space
                        // offset = gradient center - shape center (both in SVG coordinates)
                        var offsetSvgX = absX - shapeSvgCenterX;
                        var offsetSvgY = absY - shapeSvgCenterY;
                        
                        // Convert to Cavalry coordinates (Y is inverted)
                        var relativeOffsetX = offsetSvgX;
                        var relativeOffsetY = -offsetSvgY; // Invert Y for SVG->Cavalry conversion
                        
                        
                        // Update the gradient's offset
                        try {
                            // Validate the offset values before setting
                            if (!isNaN(relativeOffsetX) && !isNaN(relativeOffsetY)) {
                                api.set(shaderId, {"generator.offset.x": relativeOffsetX, "generator.offset.y": relativeOffsetY});
                            }
                        } catch (eOffset) {
                            console.warn('[RADIAL GRADIENT] Could not set offset: ' + eOffset.message);
                        }
                    }
                }
            }
        } catch (eCalcOffset) {
            console.warn('[RADIAL GRADIENT] Error calculating offset: ' + eCalcOffset.message);
        }
        
        // Calculate scale.x/y for radial gradients based on SVD singular values
        // For userSpaceOnUse: use scale.x/y directly to control ellipse dimensions (radiusRatio=1)
        // For objectBoundingBox: use radiusRatio to control aspect ratio
                    try {
            // Get the gradient data to check if it's radial with a transform
            var gradientDataRR = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidRR in __svgGradientCache) {
                    if (__svgGradientCache[gidRR] === shaderId) {
                        gradientDataRR = __svgGradientMap[gidRR];
                        break;
                    }
                }
            }
            
            if (gradientDataRR && gradientDataRR.type === 'radial' && gradientDataRR.transform) {
                // Get shape dimensions from Cavalry's bounding box
                var shapeBbox = api.getBoundingBox(shapeId, false);
                if (shapeBbox && shapeBbox.width > 0 && shapeBbox.height > 0) {
                    var shapeWidth = shapeBbox.width;
                    var shapeHeight = shapeBbox.height;
                    
                    // Parse the gradient transform matrix
                    var matrixRR = parseTransformMatrixList(gradientDataRR.transform);
                    var a = matrixRR.a, b = matrixRR.b, c = matrixRR.c, d = matrixRR.d;
                    var e = matrixRR.e || 0, f = matrixRR.f || 0;
                    
                    // Check if this is userSpaceOnUse (absolute coords) or objectBoundingBox (normalized 0-1)
                    var isAbsoluteCoords = (Math.abs(a) > 2 || Math.abs(b) > 2 || Math.abs(c) > 2 || Math.abs(d) > 2 ||
                                            Math.abs(e) > 2 || Math.abs(f) > 2);
                    
                    
                    if (isAbsoluteCoords && gradientDataRR.gradientUnits === 'userSpaceOnUse') {
                        // For userSpaceOnUse: use matrix column lengths for x/y scale
                        // Column 1 (a, b) represents how the x-direction is transformed
                        // Column 2 (c, d) represents how the y-direction is transformed
                        var colXLength = Math.sqrt(a * a + b * b);  // Length of column 1
                        var colYLength = Math.sqrt(c * c + d * d);  // Length of column 2
                        
                        
                        // Calculate scale based on shape's half-dimensions
                        // In Cavalry, 100% scale means the gradient fills the bounding box
                        // So scale = (column length / shape half-dimension) * 100
                        var shapeRadiusX = shapeWidth / 2;
                        var shapeRadiusY = shapeHeight / 2;
                        
                        // Column 1 length → scale.x (x-direction stretch)
                        // Column 2 length → scale.y (y-direction stretch)
                        var scaleX = (colXLength / shapeRadiusX) * 100;
                        var scaleY = (colYLength / shapeRadiusY) * 100;
                        
                        
                        // Set radiusRatio to 1 (ellipse shape comes from scale.x/y)
                        try {
                            api.set(shaderId, {"generator.radiusRatio": 1});
                        } catch (eRR) {}
                        
                        // Set scale values
                        try {
                            api.set(shaderId, {"generator.scale.x": scaleX, "generator.scale.y": scaleY});
                        } catch (eScale) {
                            console.warn('[RADIAL GRADIENT] Could not set scale: ' + eScale.message);
                        }
                        
                        // Set rotation from the gradient transform matrix
                        // The rotation is embedded in the matrix - extract using atan2(b, a)
                        // SVG rotation is clockwise, Cavalry rotation is counter-clockwise, so negate
                        try {
                            var rotationRad = Math.atan2(b, a);
                            var rotationDeg = -rotationRad * 180 / Math.PI;
                            api.set(shaderId, {"generator.rotation": rotationDeg});
                        } catch (eRot) {
                            console.warn('[RADIAL GRADIENT] Could not set rotation: ' + eRot.message);
                        }
                    } else {
                        // For objectBoundingBox: use radiusRatio for aspect ratio
                        var centerX = a * 0.5 + c * 0.5 + e;
                        var centerY = b * 0.5 + d * 0.5 + f;
                        var handle1X = a * 1.0 + c * 0.5 + e;
                        var handle1Y = b * 1.0 + d * 0.5 + f;
                        var handle2X = a * 0.5 + c * 1.0 + e;
                        var handle2Y = b * 0.5 + d * 1.0 + f;
                        
                        var dx1 = (handle1X - centerX) * shapeWidth;
                        var dy1 = (handle1Y - centerY) * shapeHeight;
                        var dx2 = (handle2X - centerX) * shapeWidth;
                        var dy2 = (handle2Y - centerY) * shapeHeight;
                        
                        var dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                        var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                        
                        
                        var radiusRatioNew = 1;
                        if (dist1 > 0.0001 && dist2 > 0.0001) {
                            radiusRatioNew = Math.max(dist1, dist2) / Math.min(dist1, dist2);
                        }
                        radiusRatioNew = Math.max(0.01, Math.min(100, radiusRatioNew));
                        
                        api.set(shaderId, {"generator.radiusRatio": radiusRatioNew});
                    }
                }
            }
        } catch (eRadiusRatio) {
            console.warn('[RADIAL GRADIENT] Error calculating scale: ' + eRadiusRatio.message);
        }
        
        // Calculate scale and offset for LINEAR gradients with userSpaceOnUse coordinates
        try {
            // Get the gradient data to check if it's linear with absolute coordinates
            var gradientDataL = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidL in __svgGradientCache) {
                    if (__svgGradientCache[gidL] === shaderId) {
                        gradientDataL = __svgGradientMap[gidL];
                        break;
                    }
                }
            }
            
            if (gradientDataL && gradientDataL.type === 'linear' && gradientDataL.gradientUnits === 'userSpaceOnUse') {
                // Get shape dimensions from Cavalry's bounding box
                var shapeBboxL = api.getBoundingBox(shapeId, false);
                if (shapeBboxL && shapeBboxL.width > 0 && shapeBboxL.height > 0) {
                    var shapeWidthL = shapeBboxL.width;
                    var shapeHeightL = shapeBboxL.height;
                    
                    // Get the linear gradient's start and end points (absolute coords)
                    var x1 = gradientDataL.x1 || 0;
                    var y1 = gradientDataL.y1 || 0;
                    var x2 = gradientDataL.x2 || 0;
                    var y2 = gradientDataL.y2 || 0;
                    
                    // Calculate gradient vector and length
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var gradientLength = Math.sqrt(dx * dx + dy * dy);
                    
                    // Calculate gradient center in SVG coordinates
                    var gradCenterX = (x1 + x2) / 2;
                    var gradCenterY = (y1 + y2) / 2;
                    
                    
                    // Calculate offset - try to get shape SVG center, or estimate from gradient center
                    var shapeSvgCenterXL = null;
                    var shapeSvgCenterYL = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        // Use provided SVG center
                        shapeSvgCenterXL = svgShapeCenter.x;
                        shapeSvgCenterYL = svgShapeCenter.y;
                    } else {
                        // Use world-space bounding box to get actual geometric center
                        // This works for text (baseline anchor) and any other non-centered pivots
                        try {
                            var shapeBboxWorld = api.getBoundingBox(shapeId, true); // World space
                            
                            // Get viewBox info if available (stored during import)
                            var viewBoxWidth = 1080; // Default assumption
                            var viewBoxHeight = 1080;
                            if (typeof __svgViewBox !== 'undefined' && __svgViewBox) {
                                viewBoxWidth = __svgViewBox.width || viewBoxWidth;
                                viewBoxHeight = __svgViewBox.height || viewBoxHeight;
                    }
                    
                            if (shapeBboxWorld && shapeBboxWorld.width > 0 && shapeBboxWorld.height > 0) {
                                // World bbox gives us the actual geometric bounds in Cavalry coords
                                // Calculate geometric center from world bbox
                                var worldCenterX = shapeBboxWorld.x + shapeBboxWorld.width / 2;
                                var worldCenterY = shapeBboxWorld.y + shapeBboxWorld.height / 2;
                                
                                // Convert Cavalry world coords to SVG coordinates
                                // Cavalry center (0,0) corresponds to SVG center (viewBoxWidth/2, viewBoxHeight/2)
                                // Cavalry +X = SVG +X, Cavalry +Y = SVG -Y
                                shapeSvgCenterXL = (viewBoxWidth / 2) + worldCenterX;
                                shapeSvgCenterYL = (viewBoxHeight / 2) - worldCenterY;
                                
                            } else {
                            }
                        } catch (eEstimate) {
                        }
                    }
                    
                    // Calculate and set offset if we have a shape center
                    if (shapeSvgCenterXL !== null && shapeSvgCenterYL !== null) {
                        // Offset in SVG coords
                        var offsetSvgXL = gradCenterX - shapeSvgCenterXL;
                        var offsetSvgYL = gradCenterY - shapeSvgCenterYL;
                        
                        // Convert to Cavalry coords (Y inverted for normal shapes)
                        // For Y-flipped shapes (scaleY < 0), the shape's local coordinate system
                        // is already inverted, so we DON'T negate the Y offset
                        var offsetCavXL = offsetSvgXL;
                        var offsetCavYL = isFlippedY ? offsetSvgYL : -offsetSvgYL;
                        
                        
                        try {
                            api.set(shaderId, {"generator.offset.x": offsetCavXL, "generator.offset.y": offsetCavYL});
                        } catch (eOffL) {
                            console.warn('[LINEAR GRADIENT] Could not set offset: ' + eOffL.message);
                        }
                    }
                        
                    // Calculate scale: gradient length relative to shape's reference dimension
                    // In Cavalry, linear gradient scale=1.0 means the gradient spans the shape's
                    // larger dimension (width or height). Scale > 1 extends beyond.
                    var angleRad = Math.atan2(dy, dx); // Angle in radians
                    
                    // Use the larger of width or height as the reference dimension
                    var shapeReference = Math.max(shapeWidthL, shapeHeightL);
                    
                    // Scale is the ratio of gradient length to shape's reference dimension
                    var scaleL = (gradientLength / shapeReference);
                    
                    var angleDeg = angleRad * 180 / Math.PI;
                    
                    
                    try {
                        api.set(shaderId, {"generator.scale": scaleL});
                    } catch (eScaleL) {
                        console.warn('[LINEAR GRADIENT] Could not set scale: ' + eScaleL.message);
                    }
                    
                    // For Y-flipped shapes (scaleY < 0), we need to adjust the gradient rotation.
                    // 
                    // Figma exports gradients with userSpaceOnUse but coordinates relative to the
                    // untransformed shape bounds. This means the gradient is meant to transform WITH
                    // the shape. The rotation is already applied to the Cavalry shape, so we only need
                    // to compensate for the Y-flip (which is NOT applied to the Cavalry shape).
                    // 
                    // Y-flip mirrors the coordinate system across the X-axis, which negates the angle:
                    // - Horizontal gradient (0°): unaffected (symmetric across X-axis)
                    // - Vertical gradient (90°): reversed to 270° (or -90°)
                    // - Diagonal gradient (45°): mirrored to -45° (315°)
                    // 
                    // Formula: newAngle = -oldAngle (NOT +180° as previously implemented)
                    if (isFlippedY) {
                        try {
                            // Get the current rotation that was set by createGradientShader
                            var currentRotation = 0;
                            try {
                                currentRotation = api.get(shaderId, "generator.rotation") || 0;
                            } catch (eGetRot) {
                                currentRotation = 0;
                            }
                            
                            // For Y-flip: negate the angle (reflection across X-axis)
                            var newRotation = -currentRotation;
                            
                            // Normalize to 0-360 range
                            newRotation = ((newRotation % 360) + 360) % 360;
                            
                            if (Math.abs(newRotation - currentRotation) > 0.01) {
                                api.set(shaderId, {"generator.rotation": newRotation});
                            }
                        } catch (eRotL) {
                            console.warn('[LINEAR GRADIENT] Could not set rotation: ' + eRotL.message);
                        }
                    }
                }
            }
        } catch (eLinear) {
            console.warn('[LINEAR GRADIENT] Error calculating properties: ' + eLinear.message);
        }
        
        // Parent shader under the first shape it connects to for tidy stacking
        try {
            var currentParent = null;
            try { currentParent = api.getParent(shaderId); } catch (ePar) { currentParent = null; }
            if (!currentParent) {
                api.parent(shaderId, shapeId);
                
            }
        } catch (ePar2) {}
        
        return true;
    } catch (e1) {
        try {
            // Fallback: sometimes explicit indexless connect fails; leave log

        } catch (eLog) {}
    }
    return false;
}

function connectShaderToStroke(shaderId, shapeId, svgShapeCenter) {
    try { api.setStroke(shapeId, true); } catch (e) {}
    // Reveal shader by hiding base stroke color
    try { api.set(shapeId, {"stroke.strokeColor.a": 0}); } catch (eA) {}
    try {
        api.connect(shaderId, 'id', shapeId, 'stroke.colorShaders');
        
        // Calculate scale and offset for LINEAR gradients (same as connectShaderToShape)
        try {
            var gradientDataL = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidL in __svgGradientCache) {
                    if (__svgGradientCache[gidL] === shaderId) {
                        gradientDataL = __svgGradientMap[gidL];
                        break;
                    }
                }
            }
            
            if (gradientDataL && gradientDataL.type === 'linear' && gradientDataL.gradientUnits === 'userSpaceOnUse') {
                var shapeBboxL = api.getBoundingBox(shapeId, false);
                if (shapeBboxL && shapeBboxL.width > 0 && shapeBboxL.height > 0) {
                    var shapeWidthL = shapeBboxL.width;
                    var shapeHeightL = shapeBboxL.height;
                    
                    var x1 = gradientDataL.x1 || 0;
                    var y1 = gradientDataL.y1 || 0;
                    var x2 = gradientDataL.x2 || 0;
                    var y2 = gradientDataL.y2 || 0;
                    
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var gradientLength = Math.sqrt(dx * dx + dy * dy);
                    var gradCenterX = (x1 + x2) / 2;
                    var gradCenterY = (y1 + y2) / 2;
                    
                    
                    // Calculate offset
                    var shapeSvgCenterXL = null;
                    var shapeSvgCenterYL = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        shapeSvgCenterXL = svgShapeCenter.x;
                        shapeSvgCenterYL = svgShapeCenter.y;
                    } else {
                        // Use world-space bounding box to get actual geometric center
                        try {
                            var shapeBboxWorldS = api.getBoundingBox(shapeId, true);
                            var viewBoxWidth = (__svgViewBox && __svgViewBox.width) || 1080;
                            var viewBoxHeight = (__svgViewBox && __svgViewBox.height) || 1080;
                            if (shapeBboxWorldS && shapeBboxWorldS.width > 0 && shapeBboxWorldS.height > 0) {
                                var worldCenterXS = shapeBboxWorldS.x + shapeBboxWorldS.width / 2;
                                var worldCenterYS = shapeBboxWorldS.y + shapeBboxWorldS.height / 2;
                                shapeSvgCenterXL = (viewBoxWidth / 2) + worldCenterXS;
                                shapeSvgCenterYL = (viewBoxHeight / 2) - worldCenterYS;
                            }
                        } catch (eEstimate) {}
                    }
                    
                    if (shapeSvgCenterXL !== null && shapeSvgCenterYL !== null) {
                        var offsetSvgXL = gradCenterX - shapeSvgCenterXL;
                        var offsetSvgYL = gradCenterY - shapeSvgCenterYL;
                        var offsetCavXL = offsetSvgXL;
                        var offsetCavYL = -offsetSvgYL;
                        
                        try {
                            api.set(shaderId, {"generator.offset.x": offsetCavXL, "generator.offset.y": offsetCavYL});
                        } catch (eOffL) {}
                    }
                    
                    // Calculate scale using shape's reference dimension (larger of width/height)
                    // In Cavalry, linear gradient scale=1.0 means the gradient spans the reference dimension
                    var shapeReference = Math.max(shapeWidthL, shapeHeightL);
                    var scaleL = (gradientLength / shapeReference);
                    
                    
                    try {
                        api.set(shaderId, {"generator.scale": scaleL});
                    } catch (eScaleL) {}
                }
            }
        } catch (eLinearStroke) {
            console.warn('[LINEAR GRADIENT STROKE] Error: ' + eLinearStroke.message);
        }
        
        // Calculate scale and offset for RADIAL gradients (same logic as connectShaderToShape)
        try {
            var gradientDataR = null;
            var foundGidR = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidR in __svgGradientCache) {
                    if (__svgGradientCache[gidR] === shaderId) {
                        gradientDataR = __svgGradientMap[gidR];
                        foundGidR = gidR;
                        break;
                    }
                }
            }
            
            if (gradientDataR && gradientDataR.type === 'radial' && gradientDataR.transform) {
                
                var shapeBboxR = api.getBoundingBox(shapeId, false);
                if (shapeBboxR && shapeBboxR.width > 0 && shapeBboxR.height > 0) {
                    var shapeWidthR = shapeBboxR.width;
                    var shapeHeightR = shapeBboxR.height;
                    
                    // Parse the gradient transform matrix
                    var matrixR = parseTransformMatrixList(gradientDataR.transform);
                    var aR = matrixR.a, bR = matrixR.b, cR = matrixR.c, dR = matrixR.d;
                    var eR = matrixR.e || 0, fR = matrixR.f || 0;
                    
                    // Check if this is userSpaceOnUse (absolute coords)
                    var isAbsoluteCoordsR = (Math.abs(aR) > 2 || Math.abs(bR) > 2 || Math.abs(cR) > 2 || Math.abs(dR) > 2 ||
                                            Math.abs(eR) > 2 || Math.abs(fR) > 2);
                    
                    
                    if (isAbsoluteCoordsR && gradientDataR.gradientUnits === 'userSpaceOnUse') {
                        // Calculate column lengths (these represent the radii in the transformed space)
                        var colXLengthR = Math.sqrt(aR * aR + bR * bR);
                        var colYLengthR = Math.sqrt(cR * cR + dR * dR);
                        
                        
                        // For Bounding Box radiusMode: scale is relative to shape's half-dimensions
                        var shapeRadiusXR = shapeWidthR / 2;
                        var shapeRadiusYR = shapeHeightR / 2;
                        
                        var scaleXR = (colXLengthR / shapeRadiusXR) * 100;
                        var scaleYR = (colYLengthR / shapeRadiusYR) * 100;
                        
                        
                        // Set radiusRatio to 1 (ellipse shape comes from scale.x/y)
                        try {
                            api.set(shaderId, {"generator.radiusRatio": 1});
                        } catch (eRRR) {}
                        
                        // Set scale values
                        try {
                            api.set(shaderId, {"generator.scale.x": scaleXR, "generator.scale.y": scaleYR});
                        } catch (eScaleR) {}
                        
                        // Set rotation from the gradient transform matrix
                        // SVG rotation is clockwise, Cavalry rotation is counter-clockwise, so negate
                        // (matching the fill version in connectShaderToShape)
                        var rotationRadR = Math.atan2(bR, aR);
                        var rotationDegR = -rotationRadR * (180 / Math.PI);
                        try {
                            api.set(shaderId, {"generator.rotation": rotationDegR});
                        } catch (eRotR) {}
                        
                        // Calculate offset
                        var gradCenterXR = eR;
                        var gradCenterYR = fR;
                        
                        var shapeSvgCenterXR = null;
                        var shapeSvgCenterYR = null;
                        
                        if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                            shapeSvgCenterXR = svgShapeCenter.x;
                            shapeSvgCenterYR = svgShapeCenter.y;
                        } else {
                            // Estimate from world bbox
                            try {
                                var shapeBboxWorldR = api.getBoundingBox(shapeId, true);
                                var viewBoxWidthR = (__svgViewBox && __svgViewBox.width) || 1080;
                                var viewBoxHeightR = (__svgViewBox && __svgViewBox.height) || 1080;
                                if (shapeBboxWorldR && shapeBboxWorldR.width > 0 && shapeBboxWorldR.height > 0) {
                                    var worldCenterXR = shapeBboxWorldR.x + shapeBboxWorldR.width / 2;
                                    var worldCenterYR = shapeBboxWorldR.y + shapeBboxWorldR.height / 2;
                                    shapeSvgCenterXR = (viewBoxWidthR / 2) + worldCenterXR;
                                    shapeSvgCenterYR = (viewBoxHeightR / 2) - worldCenterYR;
                                }
                            } catch (eEstR) {}
                        }
                        
                        if (shapeSvgCenterXR !== null && shapeSvgCenterYR !== null) {
                            var offsetSvgXR = gradCenterXR - shapeSvgCenterXR;
                            var offsetSvgYR = gradCenterYR - shapeSvgCenterYR;
                            var offsetCavXR = offsetSvgXR;
                            var offsetCavYR = -offsetSvgYR;
                            
                            try {
                                api.set(shaderId, {"generator.offset.x": offsetCavXR, "generator.offset.y": offsetCavYR});
                            } catch (eOffR) {}
                        }
                    }
                }
            }
        } catch (eRadialStroke) {
            console.warn('[RADIAL GRADIENT STROKE] Error: ' + eRadialStroke.message);
        }
        
        // Parent shader under the first shape it connects to for tidy stacking
        try {
            var currentParent = null;
            try { currentParent = api.getParent(shaderId); } catch (ePar) { currentParent = null; }
            if (!currentParent) {
                api.parent(shaderId, shapeId);
            }
        } catch (ePar2) {}
        return true;
    } catch (e1) {
        
    }
    return false;
}
