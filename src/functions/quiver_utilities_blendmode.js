// --- Blend Mode Utilities ---
// Maps SVG mix-blend-mode values to Cavalry blendMode enum integers

// Blend mode mapping array
// Index corresponds to a logical grouping, but the actual enum values are sparse
// Structure: [svgName, cavalryEnum]
var BLEND_MODE_MAP = [
    ['normal', 0],
    ['multiply', 24],
    ['screen', 14],
    ['overlay', 15],
    ['darken', 16],
    ['lighten', 17],
    ['color-dodge', 18],
    ['color-burn', 19],
    ['hard-light', 20],
    ['soft-light', 21],
    ['difference', 22],
    ['exclusion', 23],
    ['hue', 25],
    ['saturation', 26],
    ['color', 27],
    ['luminosity', 28],
    ['plus-lighter', 12],  // SVG 'plus-lighter' maps to Cavalry 'Plus'
    ['plus', 12],          // Alternative mapping
    ['alpha-add', 30]      // Non-standard but supported by Cavalry
];

// Convert SVG blend mode name to Cavalry enum value
function svgBlendModeToCavalryEnum(svgMode) {
    if (!svgMode) return null;
    
    // Normalize: lowercase and trim
    var normalized = ('' + svgMode).toLowerCase().trim();
    
    // Search in map
    for (var i = 0; i < BLEND_MODE_MAP.length; i++) {
        if (BLEND_MODE_MAP[i][0] === normalized) {
            return BLEND_MODE_MAP[i][1];
        }
    }
    
    // Not found - return null to skip setting
    return null;
}

// Apply blend mode to a Cavalry layer
function applyBlendMode(layerId, attrs) {
    if (!layerId || !attrs) return;
    
    try {
        // Check for mix-blend-mode in attrs or style
        var blendMode = attrs['mix-blend-mode'] || 
                       (attrs.style && extractStyleProperty(attrs.style, 'mix-blend-mode'));
        
        if (!blendMode || blendMode === 'normal') {
            // Normal is default (0), no need to set
            return;
        }
        
        var enumValue = svgBlendModeToCavalryEnum(blendMode);
        
        if (enumValue !== null && enumValue !== 0) {
            try {
                api.set(layerId, { 'blendMode': enumValue });
            } catch (eSet) {
                // Silently fail if blend mode isn't supported on this layer type
            }
        }
    } catch (e) {
        // Ignore blend mode errors
    }
}

