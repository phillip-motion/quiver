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
            if (im) {
                var imgOpen = im[0];
                var href = extractAttribute(imgOpen, 'href') || extractAttribute(imgOpen, 'xlink:href');
                var ix = extractAttribute(imgOpen, 'x');
                var iy = extractAttribute(imgOpen, 'y');
                var iw = extractAttribute(imgOpen, 'width');
                var ih = extractAttribute(imgOpen, 'height');
                var imgTransform = extractAttribute(imgOpen, 'transform');
                image = { href: href||'', x: ix||'0', y: iy||'0', width: iw||attrs.width||'0', height: ih||attrs.height||'0' };
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
                                image = { href: href2||'', x: '0', y: '0', width: iw2||attrs.width||'0', height: ih2||attrs.height||'0' };
                            }
                        } catch (eFind) {}
                    }
                }
            }
            patterns[pid] = { attrs: attrs, image: image, useTransform: useTransform };
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