// Matrix utilities for translate-only in M1 (keep simple)
function parseTranslate(transform) {
    if (!transform) return {x:0,y:0};
    
    // First try to extract from translate() transform
    var m = transform.match(/translate\(([^\)]*)\)/);
    if (m) {
        var parts = m[1].split(/[ ,]+/).map(function(s){return parseFloat(s);});
        var tx = parts.length > 0 && !isNaN(parts[0]) ? parts[0] : 0;
        var ty = parts.length > 1 && !isNaN(parts[1]) ? parts[1] : 0;
        return {x:tx, y:ty};
    }
    
    // If no translate(), check for matrix() and extract translation components
    var matrixMatch = transform.match(/matrix\(([^\)]*)\)/);
    if (matrixMatch) {
        var matrixParts = matrixMatch[1].split(/[ ,]+/).map(function(s){return parseFloat(s);});
        if (matrixParts.length >= 6) {
            // matrix(a b c d e f) where e,f are the translation components
            var tx = !isNaN(matrixParts[4]) ? matrixParts[4] : 0;
            var ty = !isNaN(matrixParts[5]) ? matrixParts[5] : 0;
            return {x:tx, y:ty};
        }
    }
    
    return {x:0,y:0};
}

// Parse full matrix transform and apply to a point
function applyMatrixToPoint(transform, x, y) {
    if (!transform) return {x:x, y:y};
    
    var matrixMatch = transform.match(/matrix\(([^\)]*)\)/);
    if (!matrixMatch) return {x:x, y:y};
    
    var parts = matrixMatch[1].split(/[ ,]+/).map(function(s){return parseFloat(s);});
    if (parts.length < 6) return {x:x, y:y};
    
    // matrix(a b c d e f) transforms (x,y) to (ax+cy+e, bx+dy+f)
    var a = parts[0], b = parts[1], c = parts[2], d = parts[3], e = parts[4], f = parts[5];
    var newX = a * x + c * y + e;
    var newY = b * x + d * y + f;
    
    return {x: newX, y: newY};
}

function parseRotatePivot(transform) {
    // Parse rotate(a [cx cy]) and return {angle, cx, cy}; cx/cy null when not provided
    var out = { angle: 0, cx: null, cy: null };
    if (!transform || typeof transform !== 'string') return out;
    var re = /rotate\(\s*([-\d\.]+)(?:[ ,]+([-\d\.]+)[ ,]+([-\d\.]+))?\s*\)/;
    var m = re.exec(transform);
    if (!m) return out;
    var ang = parseFloat(m[1]);
    if (!isNaN(ang)) out.angle = ang;
    if (m[2] !== undefined && m[3] !== undefined) {
        var cx = parseFloat(m[2]);
        var cy = parseFloat(m[3]);
        if (!isNaN(cx) && !isNaN(cy)) { out.cx = cx; out.cy = cy; }
    }
    return out;
}

function rotatePointAround(x, y, angleDeg, cx, cy) {
    var th = (angleDeg || 0) * Math.PI / 180;
    var cos = Math.cos(th), sin = Math.sin(th);
    var dx = x - cx, dy = y - cy;
    var xr = cx + dx * cos - dy * sin;
    var yr = cy + dx * sin + dy * cos;
    return {x: xr, y: yr};
}

// --- Rotation (transform) helpers ---
function _matIdentity(){ return {a:1,b:0,c:0,d:1,e:0,f:0}; }
function _matMultiply(m1,m2){
    return { a: m1.a*m2.a + m1.c*m2.b,
             b: m1.b*m2.a + m1.d*m2.b,
             c: m1.a*m2.c + m1.c*m2.d,
             d: m1.b*m2.c + m1.d*m2.d,
             e: m1.a*m2.e + m1.c*m2.f + m1.e,
             f: m1.b*m2.e + m1.d*m2.f + m1.f };
}
function _matTranslate(tx,ty){ return {a:1,b:0,c:0,d:1,e:tx||0,f:ty||0}; }
function _matScale(sx,sy){ if (sy===undefined||isNaN(sy)) sy = sx; return {a:sx||1,b:0,c:0,d:sy||1,e:0,f:0}; }
function _matRotate(rad){ var cos=Math.cos(rad), sin=Math.sin(rad); return {a:cos,b:sin,c:-sin,d:cos,e:0,f:0}; }
function _matSkewX(rad){ return {a:1,b:0,c:Math.tan(rad),d:1,e:0,f:0}; }
function _matSkewY(rad){ return {a:1,b:Math.tan(rad),c:0,d:1,e:0,f:0}; }
function _matFrom(a,b,c,d,e,f){ return {a:a,b:b,c:c,d:d,e:e,f:f}; }

function parseTransformMatrixList(str){
    if (!str || typeof str !== 'string') return _matIdentity();
    var regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^\)]*)\)/g;
    var m; var acc = _matIdentity();
    while ((m = regex.exec(str)) !== null) {
        var kind = m[1];
        var args = m[2].split(/[ ,]+/).filter(function(s){return s!=='';}).map(parseFloat);
        var t = _matIdentity();
        if (kind === 'matrix' && args.length>=6) {
            t = _matFrom(args[0],args[1],args[2],args[3],args[4],args[5]);
        } else if (kind === 'translate') {
            var tx = args[0]||0, ty = (args.length>1?args[1]:0)||0; t = _matTranslate(tx,ty);
        } else if (kind === 'scale') {
            var sx = args[0]||1, sy = (args.length>1?args[1]:sx); t = _matScale(sx,sy);
        } else if (kind === 'rotate') {
            var ang = (args[0]||0) * Math.PI/180;
            if (args.length>=3) {
                var cx = args[1]||0, cy = args[2]||0;
                t = _matMultiply(_matMultiply(_matTranslate(cx,cy), _matRotate(ang)), _matTranslate(-cx,-cy));
            } else {
                t = _matRotate(ang);
            }
        } else if (kind === 'skewX') {
            t = _matSkewX((args[0]||0)*Math.PI/180);
        } else if (kind === 'skewY') {
            t = _matSkewY((args[0]||0)*Math.PI/180);
        }
        acc = _matMultiply(acc, t);
    }
    return acc;
}

function decomposeMatrix(m){
    var a=m.a,b=m.b,c=m.c,d=m.d;
    var scaleX = Math.sqrt(a*a + b*b) || 0;
    var rot = 0;
    if (scaleX !== 0) { rot = Math.atan2(b, a); }
    var a2 = a/ (scaleX||1), b2 = b/ (scaleX||1);
    var shear = a2*c + b2*d;
    var c2 = c - a2*shear, d2 = d - b2*shear;
    var scaleY = Math.sqrt(c2*c2 + d2*d2) || 0;
    if ((a*d - b*c) < 0) { if (scaleX < scaleY) scaleX = -scaleX; else scaleY = -scaleY; }
    var shearFactor = (scaleY!==0)? shear/scaleY : 0;
    
    // Extract translation values
    var translateX = m.e || m.tx || 0;
    var translateY = m.f || m.ty || 0;
    
    return { 
        rotationDeg: rot*180/Math.PI, 
        scaleX: scaleX, 
        scaleY: scaleY, 
        shear: shearFactor,
        translateX: translateX,
        translateY: translateY
    };
}

function getRotationDegFromTransform(tstr){
    var m = parseTransformMatrixList(tstr||'');
    var d = decomposeMatrix(m);
    return d.rotationDeg || 0;
}
