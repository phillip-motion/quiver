/**
 * Parse a matrix transform string: matrix(a, b, c, d, e, f)
 * Returns { a, b, c, d, e, f } or null if not a matrix transform
 * In SVG: a=scaleX, b=skewY, c=skewX, d=scaleY, e=translateX, f=translateY
 */
function parseMatrixTransform(transformStr) {
    if (!transformStr) return null;
    // A transform LIST (e.g. "translate(-0.25) scale(0.0016)") must compose
    // ALL functions: the single-function shortcuts below used to match just
    // the scale() and silently DROP the translate, shifting every image crop
    // whose pattern pans the image.
    var fnCount = (transformStr.match(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(/g) || []).length;
    if (fnCount > 1 && typeof parseTransformMatrixList === 'function') {
        return parseTransformMatrixList(transformStr);
    }
    var matrixMatch = /matrix\s*\(\s*([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)\s*\)/.exec(transformStr);
    if (matrixMatch) {
        return {
            a: parseFloat(matrixMatch[1]) || 0,  // scaleX
            b: parseFloat(matrixMatch[2]) || 0,  // skewY
            c: parseFloat(matrixMatch[3]) || 0,  // skewX
            d: parseFloat(matrixMatch[4]) || 0,  // scaleY
            e: parseFloat(matrixMatch[5]) || 0,  // translateX
            f: parseFloat(matrixMatch[6]) || 0   // translateY
        };
    }
    // Also handle scale(sx, sy) or scale(s) transform
    var scaleMatch = /scale\s*\(\s*([^,\s\)]+)(?:[\s,]+([^,\s\)]+))?\s*\)/.exec(transformStr);
    if (scaleMatch) {
        var sx = parseFloat(scaleMatch[1]) || 1;
        var sy = scaleMatch[2] ? parseFloat(scaleMatch[2]) : sx;
        return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    }
    // rotate(), translate(), or combined transform lists (Figma sometimes emits these)
    if (typeof parseTransformMatrixList === 'function' &&
        /(rotate|translate|skewX|skewY|matrix|scale)\s*\(/.test(transformStr)) {
        return parseTransformMatrixList(transformStr);
    }
    return null;
}

function extractPatterns(svgCode) {
    var patterns = {};
    try {
        var re = /<pattern[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/pattern>/g; var m;
        while ((m = re.exec(svgCode)) !== null) {
            var pid = m[1]; var body = m[2] || '';
            var open = m[0].slice(0, m[0].indexOf('>')+1);
            var attrs = {};
            var keys = ['x','y','width','height','patternUnits','patternContentUnits','patternTransform'];
            for (var i=0;i<keys.length;i++){ var kk=keys[i]; var vv=extractAttribute(open, kk); if (vv!==null) attrs[kk]=vv; }
            // <image> inside pattern
            var im = /<image[^>]*>/i.exec(body);
            var image = null;
            var useTransform = null; // Transform matrix from <use> element
            var useOpacity = null;
            if (im) {
                var imgOpen = im[0];
                var href = extractAttribute(imgOpen, 'href') || extractAttribute(imgOpen, 'xlink:href');
                var ix = extractAttribute(imgOpen, 'x');
                var iy = extractAttribute(imgOpen, 'y');
                var iw = extractAttribute(imgOpen, 'width');
                var ih = extractAttribute(imgOpen, 'height');
                var imgTransform = extractAttribute(imgOpen, 'transform');
                image = { href: href||'', x: ix||'0', y: iy||'0', width: iw||attrs.width||'0', height: ih||attrs.height||'0', opacity: extractAttribute(imgOpen, 'opacity') };
                if (imgTransform) {
                    useTransform = parseMatrixTransform(imgTransform);
                }
            }
            // Or <use xlink:href="#imageId"> with transform
            if (!image) {
                var useMatch = /<use[^>]*>/ig.exec(body);
                if (useMatch) {
                    var useOpen = useMatch[0];
                    var hrefUse = extractAttribute(useOpen, 'href') || extractAttribute(useOpen, 'xlink:href');
                    var useTransformStr = extractAttribute(useOpen, 'transform');
                    useOpacity = extractAttribute(useOpen, 'opacity');
                    if (useTransformStr) {
                        useTransform = parseMatrixTransform(useTransformStr);
                    }
                    if (hrefUse && hrefUse.charAt(0) === '#') {
                        var refId = hrefUse.slice(1);
                        try {
                            var esc = refId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            var reImg = new RegExp('<image[^>]*id=["\']' + esc + '["\'][^>]*>', 'i');
                            var mImg = reImg.exec(svgCode);
                            if (mImg) {
                                var imgOpen2 = mImg[0];
                                var href2 = extractAttribute(imgOpen2, 'href') || extractAttribute(imgOpen2, 'xlink:href');
                                var iw2 = extractAttribute(imgOpen2, 'width');
                                var ih2 = extractAttribute(imgOpen2, 'height');
                                image = { href: href2||'', x: '0', y: '0', width: iw2||attrs.width||'0', height: ih2||attrs.height||'0', opacity: extractAttribute(imgOpen2, 'opacity') };
                            }
                        } catch (eFind) {}
                    }
                }
            }
            patterns[pid] = { attrs: attrs, image: image, useTransform: useTransform, useOpacity: useOpacity };
        }
    } catch (e) { 
        // extractPatterns error
    }
    return patterns;
}

/**
 * Combine the pattern's <use>/<image> transform with patternTransform, if present.
 * SVG applies patternTransform after the pattern content transform.
 */
function getPatternImageMatrix(patternData) {
    if (!patternData) return null;
    var useM = patternData.useTransform || null;
    var patStr = patternData.attrs && patternData.attrs.patternTransform;
    var patM = null;
    if (patStr) {
        patM = parseMatrixTransform(patStr);
        if (!patM && typeof parseTransformMatrixList === 'function') {
            patM = parseTransformMatrixList(patStr);
        }
    }
    if (useM && patM && typeof _matMultiply === 'function') {
        return _matMultiply(patM, useM);
    }
    return useM || patM || null;
}

function _readShapeSize(layerId) {
    try {
        // editableShapes have no generator - probing logs a Cavalry console
        // error even inside try/catch
        var hasGen = false;
        try {
            var szAttrs = api.getAttributes(layerId) || [];
            for (var ai = 0; ai < szAttrs.length; ai++) {
                if (String(szAttrs[ai]) === 'generator.dimensions') { hasGen = true; break; }
            }
        } catch (eAttrs) {}
        var dims = hasGen ? api.get(layerId, 'generator.dimensions') : null;
        if (dims) {
            if (dims.length >= 2 && dims[0] && dims[1]) {
                return { w: dims[0], h: dims[1] };
            }
            if (dims.x && dims.y) {
                return { w: dims.x, h: dims.y };
            }
        }
    } catch (eDims) {}
    try {
        var bboxLocal = api.getBoundingBox(layerId, false);
        if (bboxLocal && bboxLocal.width && bboxLocal.height) {
            return { w: bboxLocal.width, h: bboxLocal.height };
        }
    } catch (eLocal) {}
    try {
        var bbox = api.getBoundingBox(layerId, true);
        if (bbox) {
            return { w: bbox.width || 100, h: bbox.height || 100 };
        }
    } catch (eBB) {}
    return { w: 100, h: 100 };
}

/**
 * Map an SVG pattern image transform onto a Cavalry imageShader.
 * Previously only a/d (scale) and e/f (translate) were used — rotation in b/c was dropped.
 * Returns true if precise scale/offset/rotation were applied.
 */
function applyImageShaderPatternTransform(shaderNode, patternData, layerId) {
    var mat = getPatternImageMatrix(patternData);
    var isOBB = patternData && patternData.attrs && patternData.attrs.patternContentUnits === 'objectBoundingBox';
    if (!mat || !isOBB) return false;

    var smSet = false;
    try { api.set(shaderNode, { 'scaleMode': 0 }); smSet = true; } catch (eSM0) { smSet = false; }
    if (!smSet) { try { api.set(shaderNode, { 'generator.scaleMode': 0 }); } catch (eSM0b) {} }

    var size = _readShapeSize(layerId);
    var shapeW = size.w;
    var shapeH = size.h;

    var imgMeta = patternData.image;
    var imgW = parseFloat(imgMeta && imgMeta.width) || 100;
    var imgH = parseFloat(imgMeta && imgMeta.height) || 100;

    var decomposed = (typeof decomposeMatrix === 'function')
        ? decomposeMatrix(mat)
        : {
            scaleX: Math.sqrt(mat.a * mat.a + mat.b * mat.b) || mat.a,
            scaleY: Math.sqrt(mat.c * mat.c + mat.d * mat.d) || mat.d,
            rotationDeg: Math.atan2(mat.b, mat.a) * 180 / Math.PI
        };

    _setFirstSupported(shaderNode, ['scale', 'generator.scale'], [decomposed.scaleX * shapeW, decomposed.scaleY * shapeH]);

    // SVG Y-down vs Cavalry Y-up: negate, matching gradient shader handling
    _setFirstSupported(shaderNode, ['rotation', 'generator.rotation'], -(decomposed.rotationDeg || 0));

    var imgCx = imgW / 2;
    var imgCy = imgH / 2;
    var obbCx = mat.a * imgCx + mat.c * imgCy + mat.e;
    var obbCy = mat.b * imgCx + mat.d * imgCy + mat.f;
    _setFirstSupported(shaderNode, ['offset', 'generator.offset'], [
        obbCx * shapeW - shapeW / 2,
        -(obbCy * shapeH - shapeH / 2)
    ]);

    return true;
}

// --- Covered-fill pruning helpers ---

// Decode only the first `maxBytes` bytes of a base64 string. Enough to read
// image headers without paying for the whole (often multi-megabyte) payload.
var __b64Lookup = null;
function _b64PrefixBytes(b64, maxBytes) {
    if (!__b64Lookup) {
        __b64Lookup = {};
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        for (var ci = 0; ci < chars.length; ci++) __b64Lookup[chars.charAt(ci)] = ci;
    }
    var out = [];
    var buf = 0, bits = 0;
    for (var i = 0; i < b64.length && out.length < maxBytes; i++) {
        var ch = b64.charAt(i);
        if (ch === '=') break;
        var v = __b64Lookup[ch];
        if (v === undefined) continue; // skip whitespace/newlines
        buf = ((buf << 6) | v) & 0xFFFFFF;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buf >> bits) & 0xFF);
        }
    }
    return out;
}

// True only when the image provably has no transparency. JPEG never does.
// PNG only for colour types 0/2/3 (no alpha channel) with no tRNS chunk
// before the first IDAT (the spec requires tRNS to precede IDAT). Anything
// else - alpha PNGs, unknown formats, truncated headers - is treated as
// possibly transparent, which keeps the fills below it.
function _opaqueImageBytes(bytes) {
    if (!bytes || bytes.length < 3) return false;
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return true; // JPEG
    var sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33) return false;
    for (var s = 0; s < 8; s++) { if (bytes[s] !== sig[s]) return false; }
    function u32(i) { return bytes[i] * 16777216 + bytes[i + 1] * 65536 + bytes[i + 2] * 256 + bytes[i + 3]; }
    function kind(i) { return String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]); }
    if (u32(8) !== 13 || kind(12) !== 'IHDR') return false;
    var colourType = bytes[25];
    if (colourType !== 0 && colourType !== 2 && colourType !== 3) return false;
    var at = 8;
    while (at + 12 <= bytes.length) {
        var size = u32(at), k = kind(at + 4);
        if (k === 'tRNS') return false;
        if (k === 'IDAT') return true;
        at += size + 12;
    }
    return false; // header ran past the decoded prefix: stay conservative
}

function _isFullyOpaqueNumber(v) {
    if (v === undefined || v === null || v === '') return true;
    var n = parseFloat(v);
    return isNaN(n) || n >= 0.9999;
}

// Does this pattern's image paint every point of the shape's bounding box?
// Only the exact Figma form is accepted: objectBoundingBox units, no
// patternTransform, a tile covering the box, and an axis-aligned image
// transform whose image rectangle covers the box. FIT (letterboxed) and
// tiled images fail naturally; anything unusual is rejected.
function _patternFullyCoversShape(p) {
    if (!p || !p.image) return false;
    var a = p.attrs || {};
    if (a.patternTransform) return false;
    if (a.patternUnits && a.patternUnits !== 'objectBoundingBox') return false;
    if (a.patternContentUnits !== 'objectBoundingBox') return false;
    var eps = 1e-4;
    var tx = parseFloat(a.x || 0), ty = parseFloat(a.y || 0);
    var tw = parseFloat(a.width), th = parseFloat(a.height);
    if (isNaN(tx) || isNaN(ty) || isNaN(tw) || isNaN(th)) return false;
    if (tx > eps || ty > eps || tx + tw < 1 - eps || ty + th < 1 - eps) return false;
    var m = p.useTransform;
    if (!m) return false;
    if (Math.abs(m.b || 0) > 1e-9 || Math.abs(m.c || 0) > 1e-9) return false;
    var ix = parseFloat(p.image.x || 0), iy = parseFloat(p.image.y || 0);
    var iw = parseFloat(p.image.width), ih = parseFloat(p.image.height);
    if (isNaN(ix) || isNaN(iy) || isNaN(iw) || isNaN(ih) || iw <= 0 || ih <= 0) return false;
    var x0 = m.e + m.a * ix, x1 = m.e + m.a * (ix + iw);
    var y0 = m.f + m.d * iy, y1 = m.f + m.d * (iy + ih);
    var minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    var minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    return minX <= eps && minY <= eps && maxX >= 1 - eps && maxY >= 1 - eps;
}

// An upper sibling whose fill is a fully opaque image covering the whole
// shape hides every identical-geometry fill beneath it. Drop those before
// any layer exists, so their images are never decoded, saved or loaded.
function _elementIsOpaqueCoveringImage(n, patterns, opaqueCache) {
    if (!n || !n.attrs) return false;
    var a = n.attrs;
    if (a.filter || a.mask || a['clip-path']) return false;
    if (!_isFullyOpaqueNumber(a.opacity) || !_isFullyOpaqueNumber(a['fill-opacity'])) return false;
    var blend = a['mix-blend-mode'];
    try { if (!blend && a.style) blend = extractStyleProperty(a.style, 'mix-blend-mode'); } catch (eB) {}
    if (blend && ('' + blend).toLowerCase() !== 'normal') return false;
    try {
        if (a.style) {
            if (!_isFullyOpaqueNumber(extractStyleProperty(a.style, 'opacity'))) return false;
            if (!_isFullyOpaqueNumber(extractStyleProperty(a.style, 'fill-opacity'))) return false;
        }
    } catch (eS) {}
    var pid = extractUrlRefId(a.fill);
    if (!pid) return false;
    var p = patterns[pid];
    if (!p || !p.image || !p.image.href) return false;
    if (!_isFullyOpaqueNumber(p.image.opacity) || !_isFullyOpaqueNumber(p.useOpacity)) return false;
    if (!_patternFullyCoversShape(p)) return false;
    if (opaqueCache.hasOwnProperty(pid)) return opaqueCache[pid];
    var ok = false;
    try {
        var mm = /^data:[^;,]*;base64,(.*)$/i.exec(p.image.href);
        if (mm) ok = _opaqueImageBytes(_b64PrefixBytes(mm[1], 65536));
    } catch (eO) { ok = false; }
    opaqueCache[pid] = ok;
    return ok;
}

// A lower sibling can only be dropped if everything it paints stays inside
// the shared geometry. A stroke or a filter (shadow, blur) spills outside.
function _elementIsDroppableUnderCover(n) {
    if (!n || !n.attrs) return false;
    var a = n.attrs;
    if (a.stroke && !isNoPaintValue(a.stroke)) return false;
    if (a.filter || a._inheritedFilterId) return false;
    if (a['data-figma-bg-blur-radius'] || a._figmaGlass) return false;
    // Glass is attached from a name-keyed sidecar after this pass runs, so
    // ask the sidecar directly - never drop a node that owns an entry.
    var glassCand = a.id || n.name;
    try {
        if (glassCand && typeof hasFigmaGlassForName === 'function' && hasFigmaGlassForName(glassCand)) return false;
    } catch (eGl) {}
    return true;
}

function _groupFadesOrBlends(n) {
    var a = (n && n.attrs) || {};
    if (!_isFullyOpaqueNumber(a.opacity)) return true;
    var blend = a['mix-blend-mode'];
    try {
        if (a.style) {
            if (!_isFullyOpaqueNumber(extractStyleProperty(a.style, 'opacity'))) return true;
            if (!blend) blend = extractStyleProperty(a.style, 'mix-blend-mode');
        }
    } catch (eG) {}
    return !!(blend && ('' + blend).toLowerCase() !== 'normal');
}

// Returns { fills: n, images: m } - how many fill elements were dropped and
// how many of those were image fills that will now never be processed.
function pruneCoveredImageFills(node, patterns, opaqueCache, faded) {
    var stats = { fills: 0, images: 0 };
    if (!node || !node.children || !node.children.length) return stats;
    opaqueCache = opaqueCache || {};
    var i;
    // Recurse first. Under a faded or blended ancestor, Cavalry can apply the
    // effect per shape, so a covering fill would no longer fully hide what
    // is beneath it - leave those subtrees alone.
    for (i = 0; i < node.children.length; i++) {
        var c = node.children[i];
        if (c && (c.type === 'g' || c.type === 'svg')) {
            var sub = pruneCoveredImageFills(c, patterns, opaqueCache, faded || _groupFadesOrBlends(c));
            stats.fills += sub.fills;
            stats.images += sub.images;
        }
    }
    if (faded) return stats;
    // Bucket identical geometry in paint order (later = on top).
    var buckets = {}, order = [];
    for (i = 0; i < node.children.length; i++) {
        var ch = node.children[i];
        var key = null;
        try { key = _geomKey(ch); } catch (eK) { key = null; }
        if (!key) continue;
        if (!buckets[key]) { buckets[key] = []; order.push(key); }
        buckets[key].push(ch);
    }
    for (var b = 0; b < order.length; b++) {
        var arr = buckets[order[b]];
        if (arr.length < 2) continue;
        for (var k = arr.length - 1; k >= 1; k--) {
            if (!_elementIsOpaqueCoveringImage(arr[k], patterns, opaqueCache)) continue;
            for (var j = 0; j < k; j++) {
                var low = arr[j];
                if (!_elementIsDroppableUnderCover(low)) continue;
                low.__coveredFill = true;
                stats.fills++;
                if (low.attrs && extractUrlRefId(low.attrs.fill) && patterns[extractUrlRefId(low.attrs.fill)] &&
                    patterns[extractUrlRefId(low.attrs.fill)].image) {
                    stats.images++;
                }
            }
            break; // the topmost covering fill hides everything beneath it
        }
    }
    var kept = [];
    for (i = 0; i < node.children.length; i++) {
        if (!node.children[i].__coveredFill) kept.push(node.children[i]);
    }
    node.children = kept;
    return stats;
}