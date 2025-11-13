function createRect(node, parentId, vb) {
    var x = parseFloat(node.attrs.x || '0');
    var y = parseFloat(node.attrs.y || '0');
    var w = parseFloat(node.attrs.width || '0');
    var h = parseFloat(node.attrs.height || '0');
    
    // Detect background rectangle: matches viewBox dimensions at origin with generic name
    var isBackgroundRect = false;
    if (vb && vb.width && vb.height) {
        var matchesViewBox = (Math.abs(w - vb.width) < 0.1 && Math.abs(h - vb.height) < 0.1);
        var atOrigin = (Math.abs(x) < 0.1 && Math.abs(y) < 0.1);
        var hasGenericName = !node.name || node.name === 'rect' || node.name === 'rectangle';
        isBackgroundRect = matchesViewBox && atOrigin && hasGenericName;
    }
    
    var name = node.name || 'rectangle';
    if (isBackgroundRect) {
        name = 'Background';
    }
    
    var id = api.primitive('rectangle', name);
    if (parentId) api.parent(id, parentId);
    var rx = node.attrs.rx ? parseFloat(node.attrs.rx) : 0;
    var ry = node.attrs.ry ? parseFloat(node.attrs.ry) : 0;
    var rxv = isNaN(rx) ? 0 : rx;
    var ryv = isNaN(ry) ? 0 : ry;
    // If ry is not provided, SVG uses rx for both
    var ryEff = (node.attrs.ry !== undefined) ? ryv : rxv;
    // Detect ellipse-equivalent rounded rect: rx≈w/2 AND ry≈h/2 (within tolerance)
    var tol = 0.05; // allow up to 5% slack from perfect half-dimensions
    var halfW = w/2, halfH = h/2;
    var ratioX = (halfW>0)? (Math.min(rxv, halfW) / halfW) : 0;
    var ratioY = (halfH>0)? (Math.min(ryEff, halfH) / halfH) : 0;
    if ((isFinite(ratioX) && isFinite(ratioY)) && (ratioX >= 1 - tol && ratioY >= 1 - tol)) {
        // Build ellipse primitive instead for cleaner, editable geometry
        try { api.deleteLayer(id); } catch (eDelRect) {}
        var ellipseNode = { name: name.replace(/^rect$/,'ellipse'), attrs: {} };
        ellipseNode.attrs.cx = x + halfW;
        ellipseNode.attrs.cy = y + halfH;
        ellipseNode.attrs.rx = halfW;
        ellipseNode.attrs.ry = halfH;
        // carry styles/transform, including our precomputed stroke alignment hint
        var styleKeys = ['fill','fill-opacity','stroke','stroke-width','stroke-opacity','opacity','transform','_stroke_align','mix-blend-mode'];
        for (var si = 0; si < styleKeys.length; si++) {
            var k = styleKeys[si];
            if (node.attrs[k] !== undefined) ellipseNode.attrs[k] = node.attrs[k];
        }
        return createEllipse(ellipseNode, parentId, vb);
    }
    var rCorner = (rxv && ryv) ? Math.min(rxv, ryv) : (rxv || ryv || 0);
    var cr = Math.max(0, Math.min(rCorner, Math.min(w, h) / 2));

    var centre = svgToCavalryPosition(x + w/2, y + h/2, vb);
    api.set(id, {
        "generator.dimensions": [w, h],
        "position.x": centre.x,
        "position.y": centre.y
    });
    if (cr > 0) api.set(id, {"generator.cornerRadius": cr});

    applyFillAndStroke(id, node.attrs);
    applyBlendMode(id, node.attrs);
    // Gradient hookup
    try {
        var gradId = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId) {
            
            var shader = getGradientShader(gradId);
            if (shader) connectShaderToShape(shader, id);
        }
    } catch (eG) {}
    // Compensate position when rotate(a cx cy) is used: rotate the centre around (cx,cy) and set position
    try {
        var rotPivot = parseRotatePivot(node.attrs && node.attrs.transform || '');
        if (rotPivot && rotPivot.cx !== null && rotPivot.cy !== null) {
            var newCenterSvg = rotatePointAround(x + w/2, y + h/2, rotPivot.angle, rotPivot.cx, rotPivot.cy);
            var newPos = svgToCavalryPosition(newCenterSvg.x, newCenterSvg.y, vb);
            api.set(id, {"position.x": newPos.x, "position.y": newPos.y});
        }
    } catch (eP) {}
    return id;
}

function createCircle(node, parentId, vb) {
    var name = node.name || 'circle';
    var id = api.primitive('ellipse', name);
    if (parentId) api.parent(id, parentId);
    var cx = parseFloat(node.attrs.cx || '0');
    var cy = parseFloat(node.attrs.cy || '0');
    var r = parseFloat(node.attrs.r || '0');
    api.set(id, {
        "generator.radius": [r, r]
    });
    var pos = svgToCavalryPosition(cx, cy, vb);
    api.set(id, {"position.x": pos.x, "position.y": pos.y});
    applyFillAndStroke(id, node.attrs);
    applyBlendMode(id, node.attrs);
    try {
        var gradId = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId) {
            
            var shader = getGradientShader(gradId);
            if (shader) connectShaderToShape(shader, id);
        }
    } catch (eG) {}
    // rotate(cx,cy) compensation: move position to rotated centre
    try {
        var rotPivotC = parseRotatePivot(node.attrs && node.attrs.transform || '');
        if (rotPivotC && rotPivotC.cx !== null && rotPivotC.cy !== null) {
            var newCenterSvgC = rotatePointAround(cx, cy, rotPivotC.angle, rotPivotC.cx, rotPivotC.cy);
            var newPosC = svgToCavalryPosition(newCenterSvgC.x, newCenterSvgC.y, vb);
            api.set(id, {"position.x": newPosC.x, "position.y": newPosC.y});
        }
    } catch (ePc) {}
    return id;
}

function createEllipse(node, parentId, vb) {
    var name = node.name || 'ellipse';
    var id = api.primitive('ellipse', name);
    if (parentId) api.parent(id, parentId);
    var cx = parseFloat(node.attrs.cx || '0');
    var cy = parseFloat(node.attrs.cy || '0');
    var rx = parseFloat(node.attrs.rx || '0');
    var ry = parseFloat(node.attrs.ry || '0');
    api.set(id, {
        "generator.radius": [rx, ry]
    });
    var pos = svgToCavalryPosition(cx, cy, vb);
    api.set(id, {"position.x": pos.x, "position.y": pos.y});
    applyFillAndStroke(id, node.attrs);
    applyBlendMode(id, node.attrs);
    try {
        var gradId = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId) {
            
            var shader = getGradientShader(gradId);
            if (shader) connectShaderToShape(shader, id);
        }
    } catch (eG) {}
    // rotate(cx,cy) compensation
    try {
        var rotPivotE = parseRotatePivot(node.attrs && node.attrs.transform || '');
        if (rotPivotE && rotPivotE.cx !== null && rotPivotE.cy !== null) {
            var newCenterSvgE = rotatePointAround(cx, cy, rotPivotE.angle, rotPivotE.cx, rotPivotE.cy);
            var newPosE = svgToCavalryPosition(newCenterSvgE.x, newCenterSvgE.y, vb);
            api.set(id, {"position.x": newPosE.x, "position.y": newPosE.y});
        }
    } catch (ePe) {}
    return id;
}



// --- Polygon/Star detection and primitive creation ---
function parsePoints(pointsStr) {
    if (!pointsStr) return [];
    var pairs = pointsStr.trim().split(/\s+/);
    var pts = [];
    for (var i = 0; i < pairs.length; i++) {
        var pr = pairs[i].split(',');
        if (pr.length < 2) continue;
        var x = parseFloat(pr[0]);
        var y = parseFloat(pr[1]);
        if (!isNaN(x) && !isNaN(y)) pts.push({x:x,y:y});
    }
    return pts;
}

function computeCentroid(points) {
    var sx = 0, sy = 0;
    for (var i = 0; i < points.length; i++) { sx += points[i].x; sy += points[i].y; }
    return {x: sx / points.length, y: sy / points.length};
}

function analyzePolygon(points) {
    // Determine radii and angles relative to centroid
    var c = computeCentroid(points);
    var radii = [];
    var angles = [];
    for (var i = 0; i < points.length; i++) {
        var dx = points[i].x - c.x;
        var dy = points[i].y - c.y;
        var r = Math.hypot(dx, dy);
        var a = Math.atan2(-dy, dx); // SVG y-down to y-up angle
        radii.push(r);
        angles.push(a);
    }
    // Normalize angles to 0..2pi and sort by angle
    var idx = angles.map(function(a,i){return {i:i,a:((a% (2*Math.PI))+2*Math.PI)%(2*Math.PI)};});
    idx.sort(function(u,v){return u.a - v.a;});
    var sortedR = idx.map(function(o){return radii[o.i];});
    // Check alternating radii pattern (star) or near-constant radius (regular polygon)
    var n = points.length;
    if (n < 3) return {type:'unknown'};
    var mean = sortedR.reduce(function(a,b){return a+b;},0)/n;
    var dev = Math.sqrt(sortedR.reduce(function(a,b){return a + (b-mean)*(b-mean);},0)/n);
    var relDev = dev / mean;
    // Heuristic thresholds
    if (relDev < 0.05) {
        return {type:'regularPolygon', centroid:c, outerRadius:mean, sides:n};
    }
    // Try star: two clusters alternating
    var even = [], odd = [];
    for (var k = 0; k < n; k++) { (k%2===0?even:odd).push(sortedR[k]); }
    if (even.length > 0 && odd.length > 0) {
        var me = even.reduce(function(a,b){return a+b;},0)/even.length;
        var mo = odd.reduce(function(a,b){return a+b;},0)/odd.length;
        var devE = Math.sqrt(even.reduce(function(a,b){return a + (b-me)*(b-me);},0)/even.length);
        var devO = Math.sqrt(odd.reduce(function(a,b){return a + (b-mo)*(b-mo);},0)/odd.length);
        if (Math.abs(me - mo) / mean > 0.2 && (devE/me) < 0.1 && (devO/mo) < 0.1) {
            return {type:'star', centroid:c, outerRadius:Math.max(me, mo), innerRadius:Math.min(me, mo), points:n/2};
        }
    }
    return {type:'unknown'};
}

function createRegularPolygonPrimitive(name, points, parentId, vb, translate, attrs) {
    var analysis = analyzePolygon(points);
    if (analysis.type === 'unknown') return null;
    if (analysis.type === 'regularPolygon' && analysis.sides >= 3) {
        var id = api.primitive('polygon', name || 'Polygon');
        if (parentId) api.parent(id, parentId);
        // Dimensions: use diameter; some Cavalry versions expect radius via generator.radius or sides via generator.sides
        try { api.set(id, {"generator.sides": analysis.sides}); } catch (eSides) {}
        try { api.set(id, {"generator.radius": analysis.outerRadius}); } catch (eRad) {
            try { api.set(id, {"generator.dimensions": [analysis.outerRadius*2, analysis.outerRadius*2]}); } catch (eDim) {}
        }
        var pos = svgToCavalryPosition(analysis.centroid.x + (translate?translate.x:0), analysis.centroid.y + (translate?translate.y:0), vb);
        api.set(id, {"position.x": pos.x, "position.y": pos.y});
        if (attrs) applyFillAndStroke(id, attrs);
        return id;
    }
    if (analysis.type === 'star' && analysis.points >= 3) {
        var id2 = api.primitive('star', name || 'Star');
        if (parentId) api.parent(id2, parentId);
        try { api.set(id2, {"generator.points": Math.round(analysis.points)}); } catch (ePts) {}
        try { api.set(id2, {"generator.innerRadius": analysis.innerRadius}); } catch (eIn) {}
        try { api.set(id2, {"generator.outerRadius": analysis.outerRadius}); } catch (eOut) {}
        var pos2 = svgToCavalryPosition(analysis.centroid.x + (translate?translate.x:0), analysis.centroid.y + (translate?translate.y:0), vb);
        api.set(id2, {"position.x": pos2.x, "position.y": pos2.y});
        if (attrs) applyFillAndStroke(id2, attrs);
        return id2;
    }
    return null;
}
