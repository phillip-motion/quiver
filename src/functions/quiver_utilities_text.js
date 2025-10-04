function createText(node, parentId, vb) {
    try {
    if (!node.tspans || node.tspans.length === 0) return null;
        
        // Skip text creation if disabled in settings
        if (!importLiveTextEnabled) {

            return null;
        }
    
    var combined = node.tspans.map(function(t){ return t.text; }).join('\n');
    try { combined = decodeEntitiesForName(combined); } catch (eDecAll) {}
    var name = combined.split(/\s+/).slice(0,3).join(' ');
    if (!name) name = node.name || 'text';

    var id = api.create('textShape', name);
    if (parentId) api.parent(id, parentId);

    var first = node.tspans[0];
    var pos = svgToCavalryPosition(first.x, first.y, vb);

    var fill = node.attrs.fill || extractStyleProperty(node.attrs.style, 'fill') || '#000000';
    var fontSize = parseFloat((node.attrs['font-size'] || extractStyleProperty(node.attrs.style, 'font-size') || '16').toString().replace('px',''));
    var family = (node.attrs['font-family'] || extractStyleProperty(node.attrs.style, 'font-family') || 'Arial').split(',')[0].trim().replace(/["']/g,'');
    var weight = node.attrs['font-weight'] || extractStyleProperty(node.attrs.style, 'font-weight') || '400';
    var fontStyle = node.attrs['font-style'] || extractStyleProperty(node.attrs.style, 'font-style') || '';
    // Simplified mapping like example
    function parseFontWeight(weightStr){
        var w = ('' + weightStr).toLowerCase();
        var n = parseInt(w,10);
        if (!isNaN(n)) {
            if (n <= 250) return 'Thin';
            if (n <= 350) return 'Light';
            if (n <= 450) return 'Regular';
            if (n <= 550) return 'Medium';
            if (n <= 650) return 'SemiBold';
            if (n <= 750) return 'Bold';
            if (n <= 850) return 'ExtraBold';
            return 'Black';
        }
        if (w === 'normal') return 'Regular';
        if (w === 'bold') return 'Bold';
        return w.charAt(0).toUpperCase() + w.slice(1);
    }
    function combineWeightAndItalic(weightStyle, fontStyleStr){
        var s = weightStyle || 'Regular';
        var fs = ('' + fontStyleStr).toLowerCase();
        var isItalic = fs.indexOf('italic') !== -1 || fs.indexOf('oblique') !== -1;
        if (isItalic && s.toLowerCase().indexOf('italic') === -1) return s + ' Italic';
        return s;
    }

    var finalStyle = combineWeightAndItalic(parseFontWeight(weight), fontStyle);

    // Compute line spacing from explicit line-height or tspans (multi-line)
    var lineSpacingOffset = 0;
    try {
        var lineHeightRaw = node.attrs['line-height'] || extractStyleProperty(node.attrs.style, 'line-height');
        function _lineHeightToPx(val, fs) {
            if (val === null || val === undefined || val === '') return null;
            var s = ('' + val).trim().toLowerCase();
            if (s === 'normal') return null; // use default
            if (s.indexOf('px') !== -1) { var npx = parseFloat(s.replace('px','')); return isNaN(npx)?null:npx; }
            if (s.indexOf('%') !== -1) { var p = parseFloat(s.replace('%','')); return isNaN(p)?null:(fs * (p/100)); }
            if (s.indexOf('em') !== -1) { var em = parseFloat(s.replace('em','')); return isNaN(em)?null:(fs * em); }
            var n = parseFloat(s);
            if (!isNaN(n)) {
                // Bare number in CSS is a multiplier
                if (s === (''+n)) return fs * n;
                return n; // assume px if unitless parse failed to match exactly
            }
            return null;
        }
        var defaultLineHeight = fontSize * 1.407; // Cavalry default approximation
        var lhPx = _lineHeightToPx(lineHeightRaw, fontSize);
        if (lhPx !== null && isFinite(lhPx)) {
            lineSpacingOffset = lhPx - defaultLineHeight;
        } else if (node.tspans && node.tspans.length > 1) {
            var diffs = []; for (var li = 1; li < node.tspans.length; li++) { var dy = (node.tspans[li].y - node.tspans[li-1].y); if (isFinite(dy)) diffs.push(dy); }
            if (diffs.length > 0) {
                var sum = 0; for (var di = 0; di < diffs.length; di++) sum += diffs[di];
                var avg = sum / diffs.length;
                lineSpacingOffset = avg - defaultLineHeight;
            }
        }
    } catch (eLS) { lineSpacingOffset = 0; }

    var textSettings = {
        "text": combined,
        "fontSize": fontSize,
        "font.font": family,
        "font.style": finalStyle,
        "autoWidth": true,
        "autoHeight": true,
        "position.x": pos.x,
        "position.y": pos.y,
        "verticalAlignment": 3
    };
    // letter spacing
    var letterSpacingRaw = node.attrs['letter-spacing'] || extractStyleProperty(node.attrs.style, 'letter-spacing');
    var letterSpacingRatio = null; // Track ratio for expression connection
    if (letterSpacingRaw && ('' + letterSpacingRaw).toLowerCase() !== 'normal') {
        var lsStr = ('' + letterSpacingRaw).trim();
        var lsNum = 0;
        
        // Handle different letter-spacing units and track ratio
        if (lsStr.indexOf('em') !== -1) {
            // em units: the value itself is the ratio
            letterSpacingRatio = parseFloat(lsStr.replace('em',''));
            lsNum = letterSpacingRatio * fontSize;
        } else if (lsStr.indexOf('px') !== -1) {
            // px units: calculate ratio from absolute value
            lsNum = parseFloat(lsStr.replace('px',''));
            letterSpacingRatio = lsNum / fontSize;
        } else {
            // No unit: treat as em (fractional) if small value, otherwise as px
            // SVG exports percentages as decimal (e.g., -5% becomes -0.05)
            lsNum = parseFloat(lsStr);
            if (!isNaN(lsNum) && Math.abs(lsNum) < 10) {
                // Likely an em/fractional value - this IS the ratio
                letterSpacingRatio = lsNum;
                lsNum = lsNum * fontSize;
            } else {
                // Large absolute value, treat as pixels
                letterSpacingRatio = lsNum / fontSize;
            }
        }
        
        if (!isNaN(lsNum) && lsNum !== 0) textSettings["letterSpacing"] = lsNum;
    }
    // line spacing (only meaningful when multi-line)
    if (lineSpacingOffset && node.tspans && node.tspans.length > 1) {
        try { textSettings["lineSpacing"] = lineSpacingOffset; } catch (eSetLS) {}
    }
    api.set(id, textSettings);

    // Connect fontSize to letterSpacing with expression to maintain ratio
    if (letterSpacingRatio !== null && !isNaN(letterSpacingRatio) && letterSpacingRatio !== 0) {
        try {
            // Create the connection from fontSize to letterSpacing
            api.connect(id, "fontSize", id, "letterSpacing");
            
            // Build expression: multiply fontSize (value) by ratio
            // Format ratio to avoid floating point issues (limit to 6 decimal places)
            var ratioStr = letterSpacingRatio.toFixed(6);
            var expression = ratioStr + "*value";
            
            // Apply the expression to letterSpacing
            api.setAttributeExpression(id, "letterSpacing", expression);
        } catch (eExpr) {
            // If expression fails, the static value is already set
            console.log("Note: Could not set letter-spacing expression for " + name);
        }
    }

    // Apply fill/stroke/alpha via common path (supports stroke gradients)
    // For text, default SVG fill is black if unspecified; honour that without overriding explicit values
    var attrsForTextStyle = {};
    try { for (var kAT in node.attrs) { if (Object.prototype.hasOwnProperty.call(node.attrs, kAT)) attrsForTextStyle[kAT] = node.attrs[kAT]; } } catch (eCopy) {}
    var fillRawTxt = (node.attrs && (node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')))) || null;
    var strokeRawTxt = (node.attrs && (node.attrs.stroke || (node.attrs.style && extractStyleProperty(node.attrs.style, 'stroke')))) || null;
    var hasStrokeTxt = !!(strokeRawTxt && (''+strokeRawTxt).toLowerCase() !== 'none');
    var hasStrokeGradTxt = !!extractUrlRefId(strokeRawTxt);
    var hasStyleFill = !!(node.attrs && node.attrs.style && extractStyleProperty(node.attrs.style, 'fill'));
    var forceHideFillAlpha = false;
    if ((fillRawTxt === null || fillRawTxt === undefined || fillRawTxt === '' || (''+fillRawTxt).toLowerCase() === 'none')) {
        if (hasStrokeTxt || hasStrokeGradTxt) {
            // Stroke-only text → ensure no visible fill
            attrsForTextStyle.fill = 'none';
            forceHideFillAlpha = true;
        } else if (!hasStyleFill) {
            // No fill/stroke provided → default to SVG black fill
            attrsForTextStyle.fill = '#000000';
        }
    }
    // If fill is rgba(..., a), fold alpha into fill-opacity to preserve visual alpha
    try {
        var srcFill = node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill'));
        if (srcFill && /^rgba\(/i.test(srcFill)) {
            var mA = srcFill.match(/rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\)/i);
            if (mA && mA[4] !== undefined) {
                var aVal = clamp01(parseFloat(mA[4]));
                var foRaw = node.attrs['fill-opacity'] || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill-opacity'));
                var foNum = parseOpacityValue(foRaw);
                if (foNum === null) foNum = 1;
                attrsForTextStyle['fill-opacity'] = '' + clamp01(foNum * aVal);
                // Also convert base rgba color to rgb hex for material base when non-gradient
                var rr = parseInt(mA[1]).toString(16).padStart(2,'0');
                var gg = parseInt(mA[2]).toString(16).padStart(2,'0');
                var bb = parseInt(mA[3]).toString(16).padStart(2,'0');
                attrsForTextStyle.fill = '#' + rr + gg + bb;
            }
        }
    } catch (eRGBA) {}
    applyFillAndStroke(id, attrsForTextStyle);
    if (forceHideFillAlpha) {
        try { api.set(id, {"material.materialColor.a": 0}); } catch (eHide) {}
    }
    // Hook up fill gradient (if any) to the text shape
    try {
        var gradIdT = extractUrlRefId(attrsForTextStyle.fill || (attrsForTextStyle.style && extractStyleProperty(attrsForTextStyle.style, 'fill')));
        if (gradIdT) {
            
            var shaderT = getGradientShader(gradIdT);
            if (shaderT) connectShaderToShape(shaderT, id);
        }
    } catch (eGT) {}

    return id;
    } catch (e) {
        // Silent fail when text import is disabled or other errors occur

        return null;
    }
}