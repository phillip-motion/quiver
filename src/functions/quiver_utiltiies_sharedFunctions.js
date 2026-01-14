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

function parseColor(colorString) {
    if (!colorString || colorString === "none") return null;
    if (colorString[0] === '#') return colorString;
    var named = {
        white: "#FFFFFF",
        black: "#000000",
        red: "#FF0000",
        green: "#008000",
        blue: "#0000FF",
        yellow: "#FFFF00",
        cyan: "#00FFFF",
        magenta: "#FF00FF",
        gray: "#808080",
        grey: "#808080"
    };
    var lower = (colorString + "").toLowerCase();
    if (named[lower]) return named[lower];
    if (lower.indexOf("rgb(") === 0) {
        var m = lower.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m) {
            var r = parseInt(m[1]).toString(16).padStart(2, '0');
            var g = parseInt(m[2]).toString(16).padStart(2, '0');
            var b = parseInt(m[3]).toString(16).padStart(2, '0');
            return "#" + r + g + b;
        }
    }
    if (lower.indexOf("rgba(") === 0) {
        var mr = lower.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (mr) {
            var rr = parseInt(mr[1]).toString(16).padStart(2, '0');
            var gr = parseInt(mr[2]).toString(16).padStart(2, '0');
            var br = parseInt(mr[3]).toString(16).padStart(2, '0');
            return "#" + rr + gr + br;
        }
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

function mergeInlineStyleIntoAttrs(openingTag) {
    var styleAttr = extractAttribute(openingTag, "style");
    var merged = {};
    if (!styleAttr) return merged;
    var parts = styleAttr.split(';');
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (!seg) continue;
        var kv = seg.split(':');
        if (kv.length < 2) continue;
        var key = kv[0].trim();
        var val = kv.slice(1).join(':').trim();
        merged[key] = val;
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
var __imageNamingContext = {}; // Store parent context for better image naming
var __imageCounter = 0; // Global counter for unique image numbers
var __groupCounter = 0; // Global counter for anonymous groups

// Deferred background blur queue - processed after all shapes are created
// Each entry: { overlayShapeId, amount, parentId }
var __deferredBackgroundBlurs = [];

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
            var shaderAlphaPct = Math.round(fillAlpha * 100);
            try {
                api.set(shaderId, {'alpha': shaderAlphaPct});
                console.log('[GRADIENT] Set shader alpha to ' + shaderAlphaPct + '% (from fill-opacity)');
            } catch (eShaderAlpha) {
                console.log('[GRADIENT] Could not set shader alpha: ' + eShaderAlpha.message);
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
                        console.log('[RADIAL GRADIENT] Using provided SVG center: (' + shapeSvgCenterX + ', ' + shapeSvgCenterY + ')');
                    } else {
                        // Fallback for paths: use Cavalry bounding box and reverse-convert to SVG
                        // We need the viewBox to do proper conversion, so just log and skip offset
                        console.log('[RADIAL GRADIENT] No SVG center provided (likely a path) - skipping offset calculation');
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
                        
                        console.log('[RADIAL GRADIENT] Gradient SVG center: (' + absX + ', ' + absY + ')');
                        console.log('[RADIAL GRADIENT] Shape SVG center: (' + shapeSvgCenterX + ', ' + shapeSvgCenterY + ')');
                        console.log('[RADIAL GRADIENT] Offset SVG: (' + offsetSvgX + ', ' + offsetSvgY + ')');
                        console.log('[RADIAL GRADIENT] Offset Cavalry: (' + relativeOffsetX + ', ' + relativeOffsetY + ')');
                        
                        // Update the gradient's offset
                        try {
                            // Validate the offset values before setting
                            if (!isNaN(relativeOffsetX) && !isNaN(relativeOffsetY)) {
                                api.set(shaderId, {"generator.offset.x": relativeOffsetX, "generator.offset.y": relativeOffsetY});
                                console.log('[RADIAL GRADIENT] Set generator.offset: (' + relativeOffsetX + ', ' + relativeOffsetY + ')');
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
                    
                    console.log('[RADIAL GRADIENT] Computing scale from transform:');
                    console.log('  Matrix: a=' + a.toFixed(2) + ', b=' + b.toFixed(2) + ', c=' + c.toFixed(2) + ', d=' + d.toFixed(2));
                    console.log('  Shape dimensions: ' + shapeWidth.toFixed(2) + ' x ' + shapeHeight.toFixed(2));
                    console.log('  Coordinate space: ' + (isAbsoluteCoords ? 'userSpaceOnUse' : 'objectBoundingBox'));
                    
                    if (isAbsoluteCoords && gradientDataRR.gradientUnits === 'userSpaceOnUse') {
                        // For userSpaceOnUse: use matrix column lengths for x/y scale
                        // Column 1 (a, b) represents how the x-direction is transformed
                        // Column 2 (c, d) represents how the y-direction is transformed
                        var colXLength = Math.sqrt(a * a + b * b);  // Length of column 1
                        var colYLength = Math.sqrt(c * c + d * d);  // Length of column 2
                        
                        console.log('  Matrix column lengths: colX=' + colXLength.toFixed(2) + 'px, colY=' + colYLength.toFixed(2) + 'px');
                        
                        // Calculate scale based on shape's half-dimensions
                        // In Cavalry, 100% scale means the gradient fills the bounding box
                        // So scale = (column length / shape half-dimension) * 100
                        var shapeRadiusX = shapeWidth / 2;
                        var shapeRadiusY = shapeHeight / 2;
                        
                        // Column 1 length → scale.x (x-direction stretch)
                        // Column 2 length → scale.y (y-direction stretch)
                        var scaleX = (colXLength / shapeRadiusX) * 100;
                        var scaleY = (colYLength / shapeRadiusY) * 100;
                        
                        console.log('  Shape half-dimensions: ' + shapeRadiusX.toFixed(2) + ' x ' + shapeRadiusY.toFixed(2));
                        console.log('  Calculated scale: x=' + scaleX.toFixed(1) + '%, y=' + scaleY.toFixed(1) + '%');
                        
                        // Set radiusRatio to 1 (ellipse shape comes from scale.x/y)
                        try {
                            api.set(shaderId, {"generator.radiusRatio": 1});
                            console.log('[RADIAL GRADIENT] Set radiusRatio: 1 (using scale.x/y for ellipse)');
                        } catch (eRR) {}
                        
                        // Set scale values
                        try {
                            api.set(shaderId, {"generator.scale.x": scaleX, "generator.scale.y": scaleY});
                            console.log('[RADIAL GRADIENT] Set generator.scale: (' + scaleX.toFixed(1) + ', ' + scaleY.toFixed(1) + ')');
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
                            console.log('[RADIAL GRADIENT] Set generator.rotation: ' + rotationDeg.toFixed(1) + '°');
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
                        
                        console.log('  Handle distances: dist1=' + dist1.toFixed(2) + 'px, dist2=' + dist2.toFixed(2) + 'px');
                        
                        var radiusRatioNew = 1;
                        if (dist1 > 0.0001 && dist2 > 0.0001) {
                            radiusRatioNew = Math.max(dist1, dist2) / Math.min(dist1, dist2);
                        }
                        radiusRatioNew = Math.max(0.01, Math.min(100, radiusRatioNew));
                        
                        api.set(shaderId, {"generator.radiusRatio": radiusRatioNew});
                        console.log('[RADIAL GRADIENT] Set radiusRatio: ' + radiusRatioNew.toFixed(4) + ' (objectBoundingBox)');
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
                    
                    console.log('[LINEAR GRADIENT] Computing properties:');
                    console.log('  Start: (' + x1.toFixed(2) + ', ' + y1.toFixed(2) + ')');
                    console.log('  End: (' + x2.toFixed(2) + ', ' + y2.toFixed(2) + ')');
                    console.log('  Gradient length: ' + gradientLength.toFixed(2) + 'px');
                    console.log('  Gradient center: (' + gradCenterX.toFixed(2) + ', ' + gradCenterY.toFixed(2) + ')');
                    console.log('  Shape dimensions: ' + shapeWidthL.toFixed(2) + ' x ' + shapeHeightL.toFixed(2));
                    
                    // Calculate offset - try to get shape SVG center, or estimate from gradient center
                    var shapeSvgCenterXL = null;
                    var shapeSvgCenterYL = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        // Use provided SVG center
                        shapeSvgCenterXL = svgShapeCenter.x;
                        shapeSvgCenterYL = svgShapeCenter.y;
                        console.log('  Shape SVG center (provided): (' + shapeSvgCenterXL.toFixed(2) + ', ' + shapeSvgCenterYL.toFixed(2) + ')');
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
                                
                                console.log('  Shape world bbox: x=' + shapeBboxWorld.x.toFixed(1) + ', y=' + shapeBboxWorld.y.toFixed(1) + ', w=' + shapeBboxWorld.width.toFixed(1) + ', h=' + shapeBboxWorld.height.toFixed(1));
                                console.log('  Shape world center: (' + worldCenterX.toFixed(2) + ', ' + worldCenterY.toFixed(2) + ')');
                                console.log('  Shape SVG center (from world bbox): (' + shapeSvgCenterXL.toFixed(2) + ', ' + shapeSvgCenterYL.toFixed(2) + ')');
                            } else {
                                console.log('  Could not get valid world bounding box');
                            }
                        } catch (eEstimate) {
                            console.log('  Could not estimate shape SVG center: ' + eEstimate.message);
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
                        
                        console.log('  Offset (SVG): (' + offsetSvgXL.toFixed(2) + ', ' + offsetSvgYL.toFixed(2) + ')');
                        console.log('  Offset (Cavalry): (' + offsetCavXL.toFixed(2) + ', ' + offsetCavYL.toFixed(2) + ')' + (isFlippedY ? ' [Y-flip adjusted]' : ''));
                        
                        try {
                            api.set(shaderId, {"generator.offset.x": offsetCavXL, "generator.offset.y": offsetCavYL});
                            console.log('[LINEAR GRADIENT] Set generator.offset: (' + offsetCavXL.toFixed(1) + ', ' + offsetCavYL.toFixed(1) + ')');
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
                    
                    console.log('  Gradient angle: ' + angleDeg.toFixed(2) + '°');
                    console.log('  Shape reference dimension: ' + shapeReference.toFixed(2) + 'px');
                    console.log('  Calculated scale: ' + scaleL.toFixed(4));
                    
                    try {
                        api.set(shaderId, {"generator.scale": scaleL});
                        console.log('[LINEAR GRADIENT] Set generator.scale: ' + scaleL.toFixed(4));
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
                                console.log('[LINEAR GRADIENT] Y-flip compensation: rotation ' + 
                                            currentRotation.toFixed(1) + '° → ' + newRotation.toFixed(1) + '° (negated)');
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
                    
                    console.log('[LINEAR GRADIENT STROKE] Computing properties:');
                    console.log('  Gradient: (' + x1.toFixed(1) + ',' + y1.toFixed(1) + ') to (' + x2.toFixed(1) + ',' + y2.toFixed(1) + ')');
                    console.log('  Gradient length: ' + gradientLength.toFixed(2) + 'px');
                    console.log('  Shape dimensions: ' + shapeWidthL.toFixed(2) + ' x ' + shapeHeightL.toFixed(2));
                    
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
                                console.log('  Shape SVG center (from world bbox): (' + shapeSvgCenterXL.toFixed(2) + ', ' + shapeSvgCenterYL.toFixed(2) + ')');
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
                            console.log('[LINEAR GRADIENT STROKE] Set offset: (' + offsetCavXL.toFixed(1) + ', ' + offsetCavYL.toFixed(1) + ')');
                        } catch (eOffL) {}
                    }
                    
                    // Calculate scale using shape's reference dimension (larger of width/height)
                    // In Cavalry, linear gradient scale=1.0 means the gradient spans the reference dimension
                    var shapeReference = Math.max(shapeWidthL, shapeHeightL);
                    var scaleL = (gradientLength / shapeReference);
                    
                    console.log('  Shape reference dimension: ' + shapeReference.toFixed(2) + 'px');
                    console.log('  Calculated scale: ' + scaleL.toFixed(4));
                    
                    try {
                        api.set(shaderId, {"generator.scale": scaleL});
                        console.log('[LINEAR GRADIENT STROKE] Set scale: ' + scaleL.toFixed(4));
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
                console.log('[RADIAL GRADIENT STROKE] Computing properties for ' + foundGidR);
                
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
                    
                    console.log('[RADIAL GRADIENT STROKE] Computing scale from transform:');
                    console.log('  Matrix: a=' + aR.toFixed(2) + ', b=' + bR.toFixed(2) + ', c=' + cR.toFixed(2) + ', d=' + dR.toFixed(2));
                    console.log('  Shape dimensions: ' + shapeWidthR.toFixed(2) + ' x ' + shapeHeightR.toFixed(2));
                    
                    if (isAbsoluteCoordsR && gradientDataR.gradientUnits === 'userSpaceOnUse') {
                        // Calculate column lengths (these represent the radii in the transformed space)
                        var colXLengthR = Math.sqrt(aR * aR + bR * bR);
                        var colYLengthR = Math.sqrt(cR * cR + dR * dR);
                        
                        console.log('  Matrix column lengths: colX=' + colXLengthR.toFixed(2) + 'px, colY=' + colYLengthR.toFixed(2) + 'px');
                        
                        // For Bounding Box radiusMode: scale is relative to shape's half-dimensions
                        var shapeRadiusXR = shapeWidthR / 2;
                        var shapeRadiusYR = shapeHeightR / 2;
                        
                        var scaleXR = (colXLengthR / shapeRadiusXR) * 100;
                        var scaleYR = (colYLengthR / shapeRadiusYR) * 100;
                        
                        console.log('  Shape half-dimensions: ' + shapeRadiusXR.toFixed(2) + ' x ' + shapeRadiusYR.toFixed(2));
                        console.log('  Calculated scale: x=' + scaleXR.toFixed(1) + '%, y=' + scaleYR.toFixed(1) + '%');
                        
                        // Set radiusRatio to 1 (ellipse shape comes from scale.x/y)
                        try {
                            api.set(shaderId, {"generator.radiusRatio": 1});
                            console.log('[RADIAL GRADIENT STROKE] Set radiusRatio: 1');
                        } catch (eRRR) {}
                        
                        // Set scale values
                        try {
                            api.set(shaderId, {"generator.scale.x": scaleXR, "generator.scale.y": scaleYR});
                            console.log('[RADIAL GRADIENT STROKE] Set generator.scale: (' + scaleXR.toFixed(1) + ', ' + scaleYR.toFixed(1) + ')');
                        } catch (eScaleR) {}
                        
                        // Set rotation from the gradient transform matrix
                        // SVG rotation is clockwise, Cavalry rotation is counter-clockwise, so negate
                        // (matching the fill version in connectShaderToShape)
                        var rotationRadR = Math.atan2(bR, aR);
                        var rotationDegR = -rotationRadR * (180 / Math.PI);
                        try {
                            api.set(shaderId, {"generator.rotation": rotationDegR});
                            console.log('[RADIAL GRADIENT STROKE] Set generator.rotation: ' + rotationDegR.toFixed(1) + '°');
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
                                console.log('[RADIAL GRADIENT STROKE] Set generator.offset: (' + offsetCavXR.toFixed(1) + ', ' + offsetCavYR.toFixed(1) + ')');
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
