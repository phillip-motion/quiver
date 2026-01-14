// --- Filters (Drop Shadows, Blur, etc.) ---

// Reverse lookup: targetLayerId -> [filterLayerId1, filterLayerId2, ...]
// Used to find which filters are connected to a shape (since api.get() on filter paths returns null)
var __targetToFilter = {};

/**
 * Get all filters connected to a target layer
 * @param {string} targetLayerId - The layer ID to look up
 * @returns {Array} Array of filter layer IDs
 */
function getFiltersForTarget(targetLayerId) {
    return __targetToFilter[targetLayerId] || [];
}

/**
 * Track a filter connection to a target layer
 * @param {string} targetLayerId - The layer the filter is connected to
 * @param {string} filterLayerId - The filter layer ID
 */
function addFilterForTarget(targetLayerId, filterLayerId) {
    if (!__targetToFilter[targetLayerId]) {
        __targetToFilter[targetLayerId] = [];
    }
    // Avoid duplicates
    if (__targetToFilter[targetLayerId].indexOf(filterLayerId) === -1) {
        __targetToFilter[targetLayerId].push(filterLayerId);
    }
}

/**
 * Reset the filter tracking cache (call at start of each import)
 */
function resetFilterCache() {
    __targetToFilter = {};
}

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
            addFilterForTarget(shapeId, blurId); // Track for reverse lookup
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
    // ALWAYS look for all shadow passes by finding feBlend elements with "effect" or "dropShadow" results
    // This handles Figma's multi-shadow filters which chain: effect1_dropShadow -> effect2_dropShadow -> etc.
    var effectBlendRe = /<feBlend[^>]*result\s*=\s*"(effect\d+_dropShadow[^"]*)"[^>]*>/gi;
    var effectMatch;
    var effectBlends = [];
    while ((effectMatch = effectBlendRe.exec(filterContent)) !== null) {
        effectBlends.push({ idx: effectMatch.index, result: effectMatch[1] });
    }
    
    
    if (effectBlends.length > 0) {
        // Parse each shadow pass by looking backwards from each feBlend
        for (var ei = 0; ei < effectBlends.length; ei++) {
            var blendIdx = effectBlends[ei].idx;
            // Find the start of this pass (after previous blend or start of filter)
            var passStart = 0;
            if (ei > 0) {
                passStart = effectBlends[ei - 1].idx + 50; // After previous blend
            }
            var passSeg = filterContent.slice(passStart, blendIdx + 100);
            
            // Check if this pass has morphology (spread)
            var morphInPass = /<feMorphology[^>]*>/i.exec(passSeg);
            var spread = 0;
            if (morphInPass) {
                var op = (_gradGetAttr(morphInPass[0], 'operator') || '').toLowerCase();
                var r = parseFloat(_gradGetAttr(morphInPass[0], 'radius') || '0');
                if (op === 'dilate') spread = +Math.max(0, r);
                else if (op === 'erode') spread = -Math.max(0, r);
            }
            
            var vals = parseValuesFromSegment(passSeg);
            
            if (vals.color || vals.dx !== 0 || vals.dy !== 0 || vals.blur !== 8/3 || spread !== 0) {
                var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: spread };
                passes.push(passObj);
            }
        }
    } else if (morphs.length > 0) {
        // Fallback: only morphology-based shadows with DILATE (drop shadows)
        // ERODE morphology is for inner shadows, not drop shadows!
        for (var i = 0; i < morphs.length; i++) {
            var op = (_gradGetAttr(morphs[i].el, 'operator')||'').toLowerCase();
            // Skip erode morphology - those are inner shadows, not drop shadows
            if (op === 'erode') {
                continue;
            }
            var start = morphs[i].idx + morphs[i].el.length;
            var end = (i+1 < morphs.length) ? morphs[i+1].idx : filterContent.length;
            var seg = filterContent.slice(start, end);
            var r = parseFloat(_gradGetAttr(morphs[i].el, 'radius') || '0');
            var spread = +Math.max(0, r);
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
                // Find next feBlend with result containing "dropShadow" or "effect" (Figma pattern)
                var blendRe = /<feBlend[^>]*result\s*=\s*"[^"]*(?:dropShadow|effect)[^"]*"[^>]*>/gi;
                blendRe.lastIndex = start;
                var blendMatch = blendRe.exec(filterContent);
                if (blendMatch) {
                    end = blendMatch.index + blendMatch[0].length;
                }
                
                var seg = filterContent.slice(start, end);
                var vals = parseValuesFromSegment(seg);
                
                
                // Include pass if it has any meaningful values (color, offset, blur, or alpha)
                if (vals.color || vals.dx !== 0 || vals.dy !== 0 || vals.blur !== 8/3 || (vals.alpha && vals.alpha !== 0.5)) {
                    var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: 0 };
                    passes.push(passObj);
                } else {
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
    // BUT skip this fallback entirely if filter contains inner shadow markers
    var hasInnerShadowMarker = /feComposite[^>]*operator\s*=\s*["']arithmetic["'][^>]*k2\s*=\s*["']-1["']/i.test(filterContent) ||
                               /result\s*=\s*["'][^"']*innerShadow[^"']*["']/i.test(filterContent);
    if (passes.length === 0 && !hasInnerShadowMarker) {
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

/**
 * Detect inner shadow passes in a filter
 * Inner shadows use: feComposite operator="arithmetic" k2="-1" k3="1"
 * and feBlend result="...innerShadow..."
 */
function detectInnerShadowPasses(filterContent) {
    if (!filterContent) return [];
    var passes = [];
    
    // Look for feBlend elements with "innerShadow" in result
    var innerBlendRe = /<feBlend[^>]*result\s*=\s*"(effect\d+_innerShadow[^"]*)"[^>]*>/gi;
    var innerMatch;
    var innerBlends = [];
    while ((innerMatch = innerBlendRe.exec(filterContent)) !== null) {
        innerBlends.push({ idx: innerMatch.index, result: innerMatch[1] });
    }
    
    
    if (innerBlends.length > 0) {
        for (var ei = 0; ei < innerBlends.length; ei++) {
            var blendIdx = innerBlends[ei].idx;
            // Find the start of this pass
            var passStart = 0;
            if (ei > 0) {
                passStart = innerBlends[ei - 1].idx + 50;
            } else {
                // For first inner shadow, start after "shape" result
                var shapeBlend = filterContent.indexOf('result="shape"');
                if (shapeBlend > 0) passStart = shapeBlend + 20;
            }
            var passSeg = filterContent.slice(passStart, blendIdx + 100);
            
            // Extract morphology (erode = inset amount)
            var morphInPass = /<feMorphology[^>]*>/i.exec(passSeg);
            var inset = 0;
            if (morphInPass) {
                var op = (_gradGetAttr(morphInPass[0], 'operator') || '').toLowerCase();
                var r = parseFloat(_gradGetAttr(morphInPass[0], 'radius') || '0');
                if (op === 'erode') inset = Math.max(0, r);
            }
            
            // Extract offset
            var offsetMatch = /<feOffset[^>]*>/i.exec(passSeg);
            var dx = 0, dy = 0;
            if (offsetMatch) {
                dx = parseFloat(_gradGetAttr(offsetMatch[0], 'dx') || '0');
                dy = parseFloat(_gradGetAttr(offsetMatch[0], 'dy') || '0');
            }
            
            // Extract blur - use stdDeviation directly for inner shadows (stronger blur)
            var blurMatch = /<feGaussianBlur[^>]*stdDeviation\s*=\s*["']([^"']+)["'][^>]*>/i.exec(passSeg);
            var blur = 0;
            if (blurMatch && blurMatch[1]) {
                // Use stdDeviation value directly for inner shadows (no reduction)
                blur = parseFloat(blurMatch[1]);
            }
            
            // Extract color from feColorMatrix (skip hardAlpha ones)
            var color = '#000000';
            var alpha = 1;
            var cmRe = /<feColorMatrix[^>]*type\s*=\s*"matrix"[^>]*values\s*=\s*"([^"]+)"[^>]*>/gi;
            var cmMatch;
            while ((cmMatch = cmRe.exec(passSeg)) !== null) {
                var cmTag = cmMatch[0];
                // Skip hardAlpha color matrices
                if (/result\s*=\s*"hardAlpha"/i.test(cmTag)) continue;
                
                var vals = cmMatch[1].split(/\s+/).map(parseFloat);
                if (vals.length >= 20) {
                    // Extract RGB from matrix (positions 4, 9, 14 are the color offsets)
                    var r = Math.round(Math.max(0, Math.min(1, vals[4])) * 255);
                    var g = Math.round(Math.max(0, Math.min(1, vals[9])) * 255);
                    var b = Math.round(Math.max(0, Math.min(1, vals[14])) * 255);
                    color = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
                    alpha = vals[18] || 1;
                }
            }
            
            
            var passObj = { dx: dx, dy: dy, blur: blur, color: color, alpha: alpha, inset: inset };
            passes.push(passObj);
        }
    }
    
    return passes;
}

/**
 * Helper: Create a single inner shadow filter node
 */
function createSingleInnerShadowNode(shapeId, blur, offsetX, offsetY, colorHex, alpha, nameSuffix) {
    var nodeId = null;
    var name = 'Inner Shadow' + (nameSuffix || '');
    try { nodeId = api.create('innerShadowFilter', name); } catch (e0) {}
    if (!nodeId) { try { nodeId = api.create('innerShadow', name); } catch (e00) {} }
    if (!nodeId) {
        console.error("[Inner Shadow] Failed to create innerShadowFilter");
        return null;
    }
    
    // Set blur amount
    var blurAmt = Math.max(0, blur || 0);
    var blurSet = false;
    try { 
        api.set(nodeId, { 'amount': [blurAmt, blurAmt] }); 
        blurSet = true;
    } catch (eBlur) {}
    if (!blurSet) {
        try { api.set(nodeId, { 'amount.x': blurAmt }); } catch (eBlurX) {}
        try { api.set(nodeId, { 'amount.y': blurAmt }); } catch (eBlurY) {}
    }
    
    // Set offset (Y-up in Cavalry)
    try { api.set(nodeId, { 'offset': [offsetX, -offsetY] }); } catch (eOff) {}
    
    // Set color
    var r = parseInt(colorHex.substring(1, 3), 16);
    var g = parseInt(colorHex.substring(3, 5), 16);
    var b = parseInt(colorHex.substring(5, 7), 16);
    var a = Math.round(alpha * 255);
    
    try { api.set(nodeId, { 'shadowColor': colorHex }); } catch (eCol1) {}
    try {
        api.set(nodeId, { 'shadowColor.r': r });
        api.set(nodeId, { 'shadowColor.g': g });
        api.set(nodeId, { 'shadowColor.b': b });
        api.set(nodeId, { 'shadowColor.a': a });
    } catch (eCol2) {}
    try {
        api.set(nodeId, { 'color': colorHex });
        api.set(nodeId, { 'color.r': r });
        api.set(nodeId, { 'color.g': g });
        api.set(nodeId, { 'color.b': b });
        api.set(nodeId, { 'color.a': a });
    } catch (eCol3) {}
    
    // Connect to shape's filters
    try { 
        api.connect(nodeId, 'id', shapeId, 'filters'); 
        addFilterForTarget(shapeId, nodeId); // Track for reverse lookup
    } catch (eC) {
        try { api.connect(nodeId, 'id', shapeId, 'deformers'); } catch (eC2) {}
    }
    
    // Parent under shape
    try { if (!api.getParent(nodeId)) api.parent(nodeId, shapeId); } catch (eP) {}
    
    console.info("[Inner Shadow] Created" + (nameSuffix || '') + ": blur=" + blurAmt + ", offset=[" + offsetX + "," + (-offsetY) + "], color=" + colorHex);
    return nodeId;
}

/**
 * Create and attach inner shadow filter(s) to a shape
 * @param shapeId - The shape to attach inner shadows to
 * @param pass - The inner shadow pass data (blur, color, alpha, dx, dy, inset)
 * @param passIndex - Current pass index (0-based)
 * @param totalPasses - Total number of inner shadow passes
 * 
 * Simplified strategy:
 * - 1 Figma inner shadow with spread: Use dual opposing offsets (best quality)
 * - 2+ Figma inner shadows: Single native shadow each, ignore spread
 *   (to avoid Cavalry's 3+ inner shadow bug - wait for Cavalry fix)
 */
function createAndAttachInnerShadow(shapeId, pass, passIndex, totalPasses) {
    try {
        if (!importEffectsEnabled) return null;
        
        // Default to old behavior if parameters not provided
        passIndex = (typeof passIndex === 'number') ? passIndex : 0;
        totalPasses = (typeof totalPasses === 'number') ? totalPasses : 1;
        
        var blur = pass.blur || 0;
        var colorHex = pass.color || '#000000';
        var alpha = (pass.alpha !== undefined) ? pass.alpha : 1;
        var baseDx = pass.dx || 0;
        var baseDy = pass.dy || 0;
        var inset = pass.inset || 0;
        
        // Only use dual shadow spread simulation when there's exactly 1 inner shadow
        // This keeps total native shadows at max 2, avoiding Cavalry's 3+ bug
        if (totalPasses === 1 && inset > 0) {
            console.info("[Inner Shadow] Single pass with spread (" + inset + "), creating dual shadows to simulate");
            
            // First shadow: negative offset (inward)
            var id1 = createSingleInnerShadowNode(
                shapeId,
                blur,
                baseDx - inset,  // X offset - spread
                baseDy - inset,  // Y offset - spread
                colorHex,
                alpha,
                ''
            );
            
            // Second shadow: positive offset (outward) - acts as background
            var id2 = createSingleInnerShadowNode(
                shapeId,
                blur,
                baseDx + inset,  // X offset + spread
                baseDy + inset,  // Y offset + spread
                colorHex,
                alpha,
                ' [Background]'
            );
            
            return id1; // Return first shadow ID
        }
        
        // Multiple passes OR no spread - create single shadow (ignore spread to stay under limit)
        if (totalPasses > 1 && inset > 0) {
            console.info("[Inner Shadow] Pass " + passIndex + ": Multiple inner shadows detected, ignoring spread to avoid Cavalry 3+ bug");
        }
        
        return createSingleInnerShadowNode(shapeId, blur, baseDx, baseDy, colorHex, alpha, '');
        
    } catch (e) {
        console.error("[Inner Shadow] Error: " + e.message);
        return null;
    }
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
        try { 
            api.connect(nodeId, 'id', shapeId, 'filters'); 
            addFilterForTarget(shapeId, nodeId); // Track for reverse lookup
        } catch (eC) {
            try { api.connect(nodeId, 'id', shapeId, 'deformers'); } catch (eC2) {}
        }
        // Parent under the shape if not already parented
        try { if (!api.getParent(nodeId)) api.parent(nodeId, shapeId); } catch (eP) {}
        return nodeId;
    } catch (e) { return null; }
}

/**
 * Queue a background blur request to be processed after all shapes are created.
 * This allows us to find sibling shapes that are underneath the overlay.
 * 
 * @param {string} overlayShapeId - The shape with the blur attribute (defines WHERE blur is visible)
 * @param {number} amount - The blur amount in pixels (from data-figma-bg-blur-radius)
 * @param {string} parentId - The parent group ID (to find siblings)
 * 
 * Cavalry API used: None (just queues the request)
 */
// Track which shapes are blur overlays (so we don't blur other overlays)
var __blurOverlayShapes = {};

function queueBackgroundBlur(overlayShapeId, amount, parentId) {
    if (!importEffectsEnabled) {
        return;
    }
    // Mark this shape as a blur overlay
    __blurOverlayShapes[overlayShapeId] = true;
    
    __deferredBackgroundBlurs.push({
        overlayShapeId: overlayShapeId,
        amount: amount,
        parentId: parentId
    });
}

/**
 * Check if two axis-aligned bounding boxes overlap.
 * 
 * Cavalry's getBoundingBox returns: { left, right, top, bottom, x, y, width, height, centre }
 * In Cavalry's Y-up coordinate system:
 * - 'top' is the higher Y value (upper edge)
 * - 'bottom' is the lower Y value (lower edge)
 * 
 * @param {Object} bbox1 - First bounding box with left, right, top, bottom
 * @param {Object} bbox2 - Second bounding box with left, right, top, bottom
 * @returns {boolean} True if the boxes overlap
 */
function boundingBoxesOverlap(bbox1, bbox2) {
    if (!bbox1 || !bbox2) return false;
    
    // Cavalry bbox uses: left, right, top, bottom
    var left1 = bbox1.left, right1 = bbox1.right, top1 = bbox1.top, bottom1 = bbox1.bottom;
    var left2 = bbox2.left, right2 = bbox2.right, top2 = bbox2.top, bottom2 = bbox2.bottom;
    
    // Check if any required value is undefined
    if (left1 === undefined || right1 === undefined || top1 === undefined || bottom1 === undefined) return false;
    if (left2 === undefined || right2 === undefined || top2 === undefined || bottom2 === undefined) return false;
    
    // Check for no overlap conditions (if any is true, no overlap)
    if (right1 < left2) return false;  // bbox1 is completely to the left of bbox2
    if (left1 > right2) return false;  // bbox1 is completely to the right of bbox2
    if (top1 < bottom2) return false;  // bbox1 is completely below bbox2 (Y-up)
    if (bottom1 > top2) return false;  // bbox1 is completely above bbox2 (Y-up)
    
    return true;
}

/**
 * Process all deferred background blur requests.
 * For each blur overlay, find sibling shapes that are underneath and overlapping,
 * then apply the blur filter to those underlying shapes with the overlay as inputShape.
 * 
 * This should be called AFTER all shapes have been created during import.
 * 
 * Cavalry API used:
 * - api.getParent(layerId) - Get parent of a layer
 * - api.getBoundingBox(layerId, worldSpace) - Get bounding box
 * - api.create('backgroundBlurFilter', name) - Create filter node
 * - api.set(id, props) - Set properties
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect attributes
 * - api.parent(childId, parentId) - Parent layer
 * - api.getNiceName(id) - Get display name
 */
function processDeferredBackgroundBlurs() {
    if (__deferredBackgroundBlurs.length === 0) {
        return;
    }
    
    
    for (var i = 0; i < __deferredBackgroundBlurs.length; i++) {
        var blurRequest = __deferredBackgroundBlurs[i];
        var overlayShapeId = blurRequest.overlayShapeId;
        var amount = blurRequest.amount;
        var parentId = blurRequest.parentId;
        
        try {
            // Get the overlay shape's bounding box (world space)
            var overlayBBox = null;
            try {
                overlayBBox = api.getBoundingBox(overlayShapeId, true);
            } catch (eBB) {
                console.warn('[Background Blur] Could not get bounding box for overlay: ' + eBB.message);
                continue;
            }
            
            if (!overlayBBox) {
                console.warn('[Background Blur] No bounding box for overlay "' + api.getNiceName(overlayShapeId) + '"');
                continue;
            }
            
            // Get siblings from the parent group
            var siblings = __groupDirectChildren[parentId] || [];
            
            // Find the index of the overlay shape in the sibling list
            var overlayIndex = -1;
            for (var si = 0; si < siblings.length; si++) {
                if (siblings[si] === overlayShapeId) {
                    overlayIndex = si;
                    break;
                }
            }
            
            // If overlay is the only child or not found in parent, check grandparent
            // This handles cases where the blur shape is inside a wrapper group
            if (overlayIndex <= 0 && parentId) {
                try {
                    var grandparentId = api.getParent(parentId);
                    if (grandparentId) {
                        var grandparentChildren = __groupDirectChildren[grandparentId] || [];
                        // Find the parent group's index in grandparent's children
                        var parentIndexInGrandparent = -1;
                        for (var gci = 0; gci < grandparentChildren.length; gci++) {
                            if (grandparentChildren[gci] === parentId) {
                                parentIndexInGrandparent = gci;
                                break;
                            }
                        }
                        if (parentIndexInGrandparent > 0) {
                            siblings = grandparentChildren;
                            overlayIndex = parentIndexInGrandparent;
                        }
                    }
                } catch (eGP) {
                    // Ignore grandparent lookup errors
                }
            }
            
            if (overlayIndex <= 0) {
                // No siblings before this shape (it's first or not found)
                continue;
            }
            
            // Get siblings that are BEFORE this shape (rendered underneath)
            var underlyingSiblings = siblings.slice(0, overlayIndex);
            
            var blurAmount = Math.max(0, (amount || 0) / 2); // Halve for Cavalry
            
            // FIRST PASS: Find all overlapping siblings
            var overlappingSiblings = [];
            for (var j = 0; j < underlyingSiblings.length; j++) {
                var siblingId = underlyingSiblings[j];
                
                // Skip siblings that are themselves blur overlays
                if (__blurOverlayShapes[siblingId]) {
                    continue;
                }
                
                try {
                    var siblingBBox = api.getBoundingBox(siblingId, true);
                    var overlaps = boundingBoxesOverlap(overlayBBox, siblingBBox);
                    
                    if (siblingBBox && overlaps) {
                        overlappingSiblings.push(siblingId);
                    }
                } catch (eSibling) {
                    // Skip this sibling
                }
            }
            
            if (overlappingSiblings.length === 0) {
                continue;
            }
            
            // SECOND PASS: Create ONE blur filter and connect to ALL overlapping siblings
            var blurFilterId = null;
            try {
                blurFilterId = api.create('backgroundBlurFilter', 'Background Blur');
            } catch (eCreate) {
                console.warn('[Background Blur] Could not create filter: ' + eCreate.message);
                continue;
            }
            
            if (!blurFilterId) continue;
            
            // Set blur amount
            try {
                api.set(blurFilterId, { 'amount.x': blurAmount });
                api.set(blurFilterId, { 'amount.y': blurAmount });
            } catch (eAmt) {
                console.warn('[Background Blur] Could not set amount: ' + eAmt.message);
            }
            
            // Connect the OVERLAY shape as the inputShape (where blur is visible)
            try {
                api.connect(overlayShapeId, 'id', blurFilterId, 'inputShape');
            } catch (eInput) {
                console.warn('[Background Blur] Could not connect inputShape: ' + eInput.message);
            }
            
            // Connect this ONE filter to ALL overlapping siblings' filters arrays
            var connectedCount = 0;
            for (var k = 0; k < overlappingSiblings.length; k++) {
                var targetId = overlappingSiblings[k];
                try {
                    api.connect(blurFilterId, 'id', targetId, 'filters');
                    addFilterForTarget(targetId, blurFilterId); // Track for reverse lookup
                    connectedCount++;
                } catch (eConnect) {
                    console.warn('[Background Blur] Could not connect filter to "' + api.getNiceName(targetId) + '": ' + eConnect.message);
                }
            }
            
            // Parent filter under the overlay shape for organization
            try {
                api.parent(blurFilterId, overlayShapeId);
            } catch (eParent) {
                // Optional
            }
            
            console.info('[Background Blur] Created 1 filter for overlay "' + api.getNiceName(overlayShapeId) + '" connected to ' + connectedCount + ' layer(s)');
            
        } catch (eProcess) {
            console.error('[Background Blur] Error processing blur: ' + eProcess.message);
        }
    }
    
    // Clear the queue
    __deferredBackgroundBlurs = [];
}

/**
 * Clear the deferred background blur queue (called at start of import)
 */
function clearDeferredBackgroundBlurs() {
    __deferredBackgroundBlurs = [];
    __blurOverlayShapes = {};
    resetFilterCache(); // Also clear filter tracking for new import
}

function _registerChild(parentId, childId) {
    try {
        if (parentId == null) return;
        if (!__groupDirectChildren[parentId]) __groupDirectChildren[parentId] = [];
        __groupDirectChildren[parentId].push(childId);
    } catch (e) {}
}