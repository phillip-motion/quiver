// --- Filters (Drop Shadows, Blur, etc.) ---
function extractFilters(svgCode) {
    var filters = {};
    var re = /<filter[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/filter>/g;
    var m;
    while ((m = re.exec(svgCode)) !== null) {
        filters[m[1]] = m[2];
    }
    return filters;
}

function detectBlurAmount(filterContent) {
    if (!filterContent) return null;

    // Check if this is a drop shadow filter (contains shadow-related elements)
    var hasDropShadow = /<feDropShadow[^>]*>/i.test(filterContent);
    var hasOffset = /<feOffset[^>]*>/i.test(filterContent);
    var hasColorMatrix = /<feColorMatrix[^>]*>/i.test(filterContent);
    var hasMorphology = /<feMorphology[^>]*>/i.test(filterContent);
    
    // Check for feFlood, but only consider it shadow-related if it has visible opacity
    var hasVisibleFlood = false;
    var floodRe = /<feFlood[^>]*>/g;
    var floodMatch;
    while ((floodMatch = floodRe.exec(filterContent)) !== null) {
        var floodOpacity = _gradGetAttr(floodMatch[0], 'flood-opacity');
        // If flood-opacity is missing (defaults to 1.0) or > 0, it's creating a visible color
        if (!floodOpacity || parseFloat(floodOpacity) > 0) {
            hasVisibleFlood = true;
            break;
        }
    }
    
    // If it has drop shadow elements, it's not a simple blur filter
    if (hasDropShadow || (hasOffset && hasColorMatrix) || hasMorphology || hasVisibleFlood) {
        // Filter contains drop shadow elements, not a simple blur
        return null;
    }
    
    // Look for feGaussianBlur
    var blurRe = /<feGaussianBlur[^>]*stdDeviation\s*=\s*["']([^"']+)["'][^>]*>/g;
    var match = blurRe.exec(filterContent);
    
    if (match && match[1]) {
        // Check if this blur is the main effect (not part of a composite)
        // Count the number of filter primitives
        var primitiveCount = (filterContent.match(/<fe\w+[^>]*>/g) || []).length;
        
        // A simple blur filter should have very few primitives
        // Allow up to 4 to account for feFlood (transparent), feBlend, feGaussianBlur
        if (primitiveCount > 4) {
            // Filter has too many primitives, likely not a simple blur
            return null;
        }
        
        var stdDev = parseFloat(match[1]);
        if (!isNaN(stdDev) && stdDev > 0) {
            // Convert stdDeviation to Cavalry blur amount
            // First multiply by 2, then divide by 3 for better Quiver parity
            var blurAmount = (stdDev * 2) / 3;
            return blurAmount;
        }
    }
    
    return null;
}

function createAndAttachBlur(shapeId, amount) {
    try {
        // Skip blur creation if effects are disabled
        if (!importEffectsEnabled) {

            return null;
        }
        
        var blurId = null;
        // Create blur filter with proper type
        try { 
            blurId = api.create('blurFilter', 'Blur');
        } catch (e0) {
            try { 
                blurId = api.create('blur', 'Blur');
            } catch (e00) {}
        }
        if (!blurId) return null;

        // Set blur amount (X and Y) - using proper attribute paths
        var amountSet = false;
        
        // First try setting as array
        try { 
            api.set(blurId, { 'amount': [amount, amount] }); 
            amountSet = true;
        } catch (eAmtV) {
            // If array fails, try individual components
            try { 
                api.set(blurId, { 'amount.x': amount }); 
                api.set(blurId, { 'amount.y': amount }); 
                amountSet = true;
            } catch (eAxy) {}
        }
        
        // Connect to filters
        try { 
            api.connect(blurId, 'id', shapeId, 'filters'); 
        } catch (eC) {
            try { 
                api.connect(blurId, 'id', shapeId, 'deformers'); 
            } catch (eC2) {
                // Failed to connect blur filter
            }
        }
        
        // Parent under the shape
        try { 
            if (!api.getParent(blurId)) {
                api.parent(blurId, shapeId); 
            }
        } catch (eP) {}
        
        return blurId;
    } catch (e) {
        // Error creating blur
        return null;
    }
}

function detectShadowPasses(filterContent) {
    if (!filterContent) return [];
    var passes = [];

    // Prefer feDropShadow directly
    var ds;
    var dropRe = /<feDropShadow[^>]*>/g;
    while ((ds = dropRe.exec(filterContent)) !== null) {
        var el = ds[0];
        var dx = parseFloat(_gradGetAttr(el, 'dx') || '0');
        var dy = parseFloat(_gradGetAttr(el, 'dy') || '0');
        var stdDev = parseFloat(_gradGetAttr(el, 'stdDeviation') || '4');
        var col = _gradGetAttr(el, 'flood-color') || '#000000';
        var a = parseFloat(_gradGetAttr(el, 'flood-opacity') || '0.5');
        var passObj = { dx: dx, dy: dy, blur: (stdDev*2)/3, color: parseColor(col)||'#000000', alpha: isNaN(a)?0.5:a, spread: 0 };
        passes.push(passObj);
    }
    if (passes.length) return passes;
    // Fallback chain: build passes around each feMorphology (common multi-pass pattern)
    var morphRe = /<feMorphology[^>]*>/g; var mMatch; var morphs = [];
    while ((mMatch = morphRe.exec(filterContent)) !== null) {
        morphs.push({ idx: mMatch.index, el: mMatch[0] });
    }
    function parseValuesFromSegment(seg) {
        var off = /<feOffset[^>]*>/g.exec(seg);
        var blu = /<feGaussianBlur[^>]*>/g.exec(seg);
        
        // Find all feColorMatrix elements and skip hardAlpha ones
        var cmRe = /<feColorMatrix[^>]*values\s*=\s*"([^"]+)"[^>]*>/g;
        var cm = null;
        var cmMatch;
        while ((cmMatch = cmRe.exec(seg)) !== null) {
            // Skip hardAlpha matrices (those with in="SourceAlpha")
            if (!/in\s*=\s*"SourceAlpha"/i.test(cmMatch[0])) {
                cm = cmMatch;
                break;
            }
        }
        
        var dx = 0, dy = 0, blur = 8/3, alpha = 0.35, colorHex = null;
        if (off) {
            dx = parseFloat(_gradGetAttr(off[0], 'dx') || '0');
            dy = parseFloat(_gradGetAttr(off[0], 'dy') || '0');
        }
        if (blu) {
            var std = parseFloat(_gradGetAttr(blu[0], 'stdDeviation') || '4');
            blur = (std*2)/3;
        }
        if (cm && cm[1]) {
            var vals = cm[1].trim().split(/\s+/).map(parseFloat);
            if (vals && vals.length >= 20) {
                // Color constants are offsets in the 5th column of the first 3 rows
                var rAdd = vals[4], gAdd = vals[9], bAdd = vals[14];
                function clamp01n(v){ return Math.max(0, Math.min(1, isNaN(v)?0:v)); }
                if (!isNaN(rAdd) || !isNaN(gAdd) || !isNaN(bAdd)) {
                    var r = Math.round(clamp01n(rAdd) * 255);
                    var g = Math.round(clamp01n(gAdd) * 255);
                    var b = Math.round(clamp01n(bAdd) * 255);
                    var rh = r.toString(16).padStart(2,'0');
                    var gh = g.toString(16).padStart(2,'0');
                    var bh = b.toString(16).padStart(2,'0');
                    colorHex = '#'+rh+gh+bh;
                }
                // Alpha: prefer multiplier (row4,col4) at index 18; fallback to constant offset index 19
                var aMul = vals[18];
                var aOff = vals[19];
                var aPick = (!isNaN(aMul) && aMul>0)? aMul : (!isNaN(aOff)? aOff : alpha);
                if (!isNaN(aPick)) alpha = Math.max(0, Math.min(1, aPick));
            }
        }
        var result = { dx: dx, dy: dy, blur: blur, alpha: alpha, color: colorHex };
        return result;
    }
    if (morphs.length > 0) {
        for (var i = 0; i < morphs.length; i++) {
            var start = morphs[i].idx + morphs[i].el.length;
            var end = (i+1 < morphs.length) ? morphs[i+1].idx : filterContent.length;
            var seg = filterContent.slice(start, end);
            var op = (_gradGetAttr(morphs[i].el, 'operator')||'').toLowerCase();
            var r = parseFloat(_gradGetAttr(morphs[i].el, 'radius') || '0');
            var spread = 0; if (op === 'dilate') spread = +Math.max(0,r); else if (op === 'erode') spread = -Math.max(0,r);
            var vals = parseValuesFromSegment(seg);
            var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: spread };
            passes.push(passObj);
        }
    } else {
        // Look for multiple drop shadow passes by finding each feOffset
        var offsetRe = /<feOffset[^>]*>/g;
        var offsetMatch;
        var offsetMatches = [];
        while ((offsetMatch = offsetRe.exec(filterContent)) !== null) {
            offsetMatches.push({ idx: offsetMatch.index, el: offsetMatch[0] });
        }

        if (offsetMatches.length > 0) {
            // For each offset, look for blur and color matrix that follow it
            for (var oi = 0; oi < offsetMatches.length; oi++) {
                var start = offsetMatches[oi].idx;
                var end = filterContent.length;
                // Find next feBlend or end of filter as segment boundary
                var blendRe = /<feBlend[^>]*result\s*=\s*"[^"]*dropShadow[^"]*"[^>]*>/g;
                blendRe.lastIndex = start;
                var blendMatch = blendRe.exec(filterContent);
                if (blendMatch) {
                    end = blendMatch.index + blendMatch[0].length;
                }
                
                var seg = filterContent.slice(start, end);
                var vals = parseValuesFromSegment(seg);
                if (vals.color || vals.dx !== 0 || vals.dy !== 0 || vals.blur !== 8/3) {
                    var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: 0 };
                    passes.push(passObj);
                }
            }
        } else {
            // Only detect as shadow if there's an offset OR a color matrix (not just blur)
            var hasOffset = /<feOffset[^>]*>/g.test(filterContent);
            var hasColorMatrix = /<feColorMatrix[^>]*>/g.test(filterContent) && !/<feColorMatrix[^>]*in\s*=\s*"SourceAlpha"/gi.test(filterContent);
            
            if (hasOffset || hasColorMatrix) {
                // Fallback to single-pass approximation
                var approx = parseValuesFromSegment(filterContent);
                if (approx.dx !== 0 || approx.dy !== 0 || (hasColorMatrix && approx.color)) {
                    var passObj = { dx: approx.dx, dy: approx.dy, blur: approx.blur, color: approx.color || '#000000', alpha: approx.alpha, spread: 0 };
                    passes.push(passObj);
                }
            }
        }
    }
    // Fallback: if still no passes, scan for color matrices (excluding hardAlpha) and pair with nearest preceding offset/blur
    if (passes.length === 0) {
        try {
            var cmAll = [];
            var cmReAll = /<feColorMatrix[^>]*type\s*=\s*"matrix"[^>]*values\s*=\s*"([^"]+)"[^>]*>/g; var mAll;
            while ((mAll = cmReAll.exec(filterContent)) !== null) {
                var cmTag = mAll[0];
                if (/in\s*=\s*"SourceAlpha"/i.test(cmTag)) continue; // skip hardAlpha
                cmAll.push({ idx: mAll.index, values: mAll[1], tag: cmTag });
            }
            for (var cmi = 0; cmi < cmAll.length; cmi++) {
                var cmBlock = cmAll[cmi];
                var before = filterContent.slice(0, cmBlock.idx);
                var offMatch = null, blurMatch = null;
                var offRe = /<feOffset[^>]*>/g, o;
                while ((o = offRe.exec(before)) !== null) offMatch = o;
                var blRe = /<feGaussianBlur[^>]*>/g, b;
                while ((b = blRe.exec(before)) !== null) blurMatch = b;
                var dxF = 0, dyF = 0, blurF = 8/3;
                if (offMatch) { dxF = parseFloat(_gradGetAttr(offMatch[0], 'dx') || '0'); dyF = parseFloat(_gradGetAttr(offMatch[0], 'dy') || '0'); }
                if (blurMatch) { var stdF = parseFloat(_gradGetAttr(blurMatch[0], 'stdDeviation') || '4'); blurF = (stdF*2)/3; }
                // Color/alpha from matrix values
                var valsArr = cmBlock.values.trim().split(/\s+/).map(parseFloat);
                var rAddF = valsArr[4], gAddF = valsArr[9], bAddF = valsArr[14];
                function c01(v){ return Math.max(0, Math.min(1, isNaN(v)?0:v)); }
                var rF = Math.round(c01(rAddF) * 255).toString(16).padStart(2,'0');
                var gF = Math.round(c01(gAddF) * 255).toString(16).padStart(2,'0');
                var bF = Math.round(c01(bAddF) * 255).toString(16).padStart(2,'0');
                var colF = '#' + rF + gF + bF;
                var aMulF = valsArr[18]; var aOffF = valsArr[19];
                var aF = (!isNaN(aMulF) && aMulF>0)? aMulF : (!isNaN(aOffF)? aOffF : 0.35);
                var passObj = { dx: dxF, dy: dyF, blur: blurF, color: colF, alpha: aF, spread: 0 };
                passes.push(passObj);
            }
        } catch (eFB) {}
    }
    return passes;
}

function createAndAttachDropShadow(shapeId, pass) {
    try {
        // Skip drop shadow creation if effects are disabled
        if (!importEffectsEnabled) {

            return null;
        }
        
        var nodeId = null;
        try { nodeId = api.create('dropShadowFilter', 'Drop Shadow'); } catch (e0) {}
        if (!nodeId) { try { nodeId = api.create('dropShadow', 'Drop Shadow'); } catch (e00) {} }
        if (!nodeId) return null;
        // Offset (Y-up)
        try { api.set(nodeId, { 'offset': [pass.dx || 0, -(pass.dy || 0)] }); } catch (e2) {}
        // Softness/Blur (X,Y) — attribute is 'amount' on Drop Shadow
        var blurAmt = Math.max(0, pass.blur || 0);
        var okAmount = false;
        try { api.set(nodeId, { 'amount': [blurAmt, blurAmt] }); okAmount = true; } catch (eAmtV) {}
        if (!okAmount) {
            try { api.set(nodeId, { 'amount.x': blurAmt }); } catch (eAx) {}
            try { api.set(nodeId, { 'amount.y': blurAmt }); } catch (eAy) {}
        }
        // Color (use shadowColor + shadowColor.a per scripting path)
        var baseCol = parseColor(pass.color || '#000000') || '#000000';
        var aPct = Math.max(0, Math.min(100, Math.round(((typeof pass.alpha==='number')? pass.alpha : 0.5) * 100)));

        // Set color - based on screenshot, try different approaches
        var colorWithAlpha = colorWithOpacity(baseCol, pass.alpha || 0.5);

        // Set color using shadowColor attribute (from screenshot)
        // Method 1: Try setting shadowColor with RGB hex
        var colorSet = false;
        try {
            api.set(nodeId, { 'shadowColor': baseCol });
            colorSet = true;
        } catch (eCol1) {}
        
        // Method 2: Set individual shadowColor RGBA components
        try {
            // Parse RGB values from hex - keep as 0-255 integers
            var r = parseInt(baseCol.substring(1,3), 16);
            var g = parseInt(baseCol.substring(3,5), 16);
            var b = parseInt(baseCol.substring(5,7), 16);
            var a = Math.round((pass.alpha || 0.5) * 255); // Convert to 0-255 range
            
            api.set(nodeId, { 'shadowColor.r': r });
            api.set(nodeId, { 'shadowColor.g': g });
            api.set(nodeId, { 'shadowColor.b': b });
            api.set(nodeId, { 'shadowColor.a': a });
            
        } catch (eComponents) {
            // Error setting shadowColor components
        }
        
        // Method 3: Try normalized values (0-1) if the above didn't work
        if (!colorSet) {
            try {
                // Parse RGB values from hex as normalized 0-1 values
                var rNorm = parseInt(baseCol.substring(1,3), 16) / 255.0;
                var gNorm = parseInt(baseCol.substring(3,5), 16) / 255.0;
                var bNorm = parseInt(baseCol.substring(5,7), 16) / 255.0;
                
                api.set(nodeId, { 'shadowColor.r': rNorm });
                api.set(nodeId, { 'shadowColor.g': gNorm });
                api.set(nodeId, { 'shadowColor.b': bNorm });
                api.set(nodeId, { 'shadowColor.a': pass.alpha || 0.5 });
                
            } catch (eNorm) {}
        }
        // Connect to filters (preferred) or deformers fallback
        try { api.connect(nodeId, 'id', shapeId, 'filters'); } catch (eC) {
            try { api.connect(nodeId, 'id', shapeId, 'deformers'); } catch (eC2) {}
        }
        // Parent under the shape if not already parented
        try { if (!api.getParent(nodeId)) api.parent(nodeId, shapeId); } catch (eP) {}
        return nodeId;
    } catch (e) { return null; }
}

function _registerChild(parentId, childId) {
    try {
        if (parentId == null) return;
        if (!__groupDirectChildren[parentId]) __groupDirectChildren[parentId] = [];
        __groupDirectChildren[parentId].push(childId);
    } catch (e) {}
}