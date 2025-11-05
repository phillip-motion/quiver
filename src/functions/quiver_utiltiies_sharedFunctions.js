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
        // Replace illegal/suspicious chars with underscore
        s = s.replace(/[^A-Za-z0-9._-]+/g, '_');
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

function connectShaderToShape(shaderId, shapeId) {
    try { 
        api.setFill(shapeId, true); 
        
    } catch (e) {}
    
    // Critical: hide base color so shader is visible
    try { 
        api.set(shapeId, {"material.materialColor.a": 0}); 
        
    } catch (eA) {}
    
    try {
        api.connect(shaderId, 'id', shapeId, 'material.colorShaders');

        // Ensure shader is visible (not hidden)
        try {
            api.set(shaderId, {'hidden': false});
            
        } catch (eVis) {}
        
        // For userSpaceOnUse gradients with stored absolute positions, calculate relative offset
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
                if (!gradientData) {
                    
                } else {
                    try { 

                        if (gradientData._absoluteCenterX !== undefined) {

                        }
                    } catch (e0) {}
                }
            } else {
                
            }
            
            if (gradientData && gradientData._absoluteCenterX !== undefined && gradientData._absoluteCenterY !== undefined) {
                // Ensure we have valid numbers
                var absX = parseFloat(gradientData._absoluteCenterX);
                var absY = parseFloat(gradientData._absoluteCenterY);
                
                if (isNaN(absX) || isNaN(absY)) {
                    
                    return;
                }

                // Get shape's bounding box to find its center
                var bbox = null;
                try {
                    // Try without the second parameter first
                    bbox = api.getBoundingBox(shapeId);
                } catch (eBbox1) {
                    try {
                        // If that fails, try with the second parameter
                        bbox = api.getBoundingBox(shapeId, true);
                    } catch (eBbox2) {
                        
                    }
                }
                if (bbox) {

                    // Use bbox.centre if available, otherwise calculate from bounds
                    var shapeCenterX, shapeCenterY;
                    if (bbox.centre) {
                        shapeCenterX = bbox.centre.x;
                        shapeCenterY = bbox.centre.y;
                        
                    } else if (bbox.x !== undefined && bbox.y !== undefined && bbox.width !== undefined && bbox.height !== undefined) {
                        shapeCenterX = bbox.x + bbox.width / 2;
                        shapeCenterY = bbox.y + bbox.height / 2;
                        
                    } else {
                        
                        return;
                    }
                    
                    // Get the gradient's absolute position (in SVG coordinates)
                    var gradientSvgX = absX;
                    var gradientSvgY = absY;
                    
                    // For userSpaceOnUse, the gradient position is in absolute SVG coordinates
                    // We need to convert to Cavalry coordinates
                    // In Cavalry, shapes are positioned with their center at their position
                    // So we calculate the offset from the shape's center
                    
                    // Since the shape is already positioned in Cavalry coordinates,
                    // and we have the gradient's SVG coordinates, we need to find the relative offset
                    
                    // Get the shape's position (which is its center in Cavalry)
                    var shapePos = null;
                    try {
                        shapePos = api.get(shapeId, 'position');
                    } catch (ePos) {
                        
                    }
                    
                    if (shapePos) {
                        // The gradient's position in SVG needs to be converted to be relative to the shape's position
                        // Since 0,0 in generator.offset is the shape's center, we calculate:
                        var relativeOffsetX = gradientSvgX - shapeCenterX;
                        var relativeOffsetY = -(gradientSvgY - shapeCenterY); // Invert Y for SVG->Cavalry conversion
                        
                        try { 

                            if (shapePos) {

                            }

                        } catch (e0) {}
                        
                        // Update the gradient's offset
                        try {
                            // Validate the offset values before setting
                            if (isNaN(relativeOffsetX) || isNaN(relativeOffsetY)) {
                                
                                return;
                            }
                            
                            api.set(shaderId, {"generator.offset.x": relativeOffsetX, "generator.offset.y": relativeOffsetY});
                            
                        } catch (eOffset) {
                            
                        }
                    }
                }
            } else {
                
            }
        } catch (eCalcOffset) {
            
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

function connectShaderToStroke(shaderId, shapeId) {
    try { api.setStroke(shapeId, true); } catch (e) {}
    // Reveal shader by hiding base stroke color
    try { api.set(shapeId, {"stroke.strokeColor.a": 0}); } catch (eA) {}
    try {
        api.connect(shaderId, 'id', shapeId, 'stroke.colorShaders');
        
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
