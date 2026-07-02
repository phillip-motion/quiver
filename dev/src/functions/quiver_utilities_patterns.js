/**
 * Parse a matrix transform string: matrix(a, b, c, d, e, f)
 * Returns { a, b, c, d, e, f } or null if not a matrix transform
 * In SVG: a=scaleX, b=skewY, c=skewX, d=scaleY, e=translateX, f=translateY
 */
function parseMatrixTransform(transformStr) {
    if (!transformStr) return null;
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