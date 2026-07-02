function setGradientContext(map) {
    __svgGradientMap = map || {};
    __svgGradientCache = {};
}

function getGradientShader(gradientId) {
    if (!gradientId) return null;
    if (__svgGradientCache[gradientId]) {
        return __svgGradientCache[gradientId];
    }
    var data = __svgGradientMap[gradientId];
    if (!data) return null;
    
    try { 

        if (data._absoluteCenterX !== undefined || data._absoluteCenterY !== undefined) {

        }
    } catch (e) {}
    
    var sh = createGradientShader(data);
    if (sh) __svgGradientCache[gradientId] = sh;
    return sh;
}

// --- Gradients (M2) ---
function _gradGetAttr(element, name) {
    var regex = new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']');
    var match = regex.exec(element);
    return match ? match[1] : null;
}

function colorWithOpacity(hexColor, opacity) {
    // Default to black if no color provided
    var baseColor = hexColor;
    if (!baseColor || baseColor[0] !== '#') {
        baseColor = '#000000';
    }
    
    var h = baseColor.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    } else if (h.length === 8) {
        // Already has alpha, extract just RGB
        h = h.slice(2);
        if (h.length !== 6) h = h.slice(0, 6);
    }
    if (h.length !== 6) {
        h = '000000'; // Fallback to black
    }
    
    // Default opacity to 1 if undefined/null/NaN
    var opVal = (typeof opacity === 'number' && !isNaN(opacity)) ? opacity : 1;
    var a = Math.max(0, Math.min(1, opVal));
    var aByte = Math.round(a * 255);
    var aHex = aByte.toString(16).padStart(2, '0').toUpperCase();
    return '#' + aHex + h.toUpperCase();
}

function parseGradientStops(gradientElement) {
    var stops = [];
    var stopRegex = /<stop[^>]*>/g;
    var match;
    while ((match = stopRegex.exec(gradientElement)) !== null) {
        var stopElement = match[0];
        var offset = _gradGetAttr(stopElement, "offset");
        
        // Try to get stop-color from direct attribute first
        var stopColor = _gradGetAttr(stopElement, "stop-color");
        var stopOpacity = _gradGetAttr(stopElement, "stop-opacity");
        
        // If not found as direct attribute, try extracting from style (Affinity SVG format)
        if (!stopColor || !stopOpacity) {
            var styleAttr = _gradGetAttr(stopElement, "style");
            if (styleAttr) {
                if (!stopColor) {
                    stopColor = extractStyleProperty(styleAttr, 'stop-color');
                }
                if (!stopOpacity) {
                    stopOpacity = extractStyleProperty(styleAttr, 'stop-opacity');
                }
            }
        }
        
        var offsetNum = 0;
        if (offset) {
            if (offset.indexOf('%') !== -1) offsetNum = parseFloat(offset) / 100; else offsetNum = parseFloat(offset);
            if (isNaN(offsetNum)) offsetNum = 0;
        }
        var opacity = stopOpacity ? parseFloat(stopOpacity) : 1.0;
        if (isNaN(opacity)) opacity = 1.0;
        stops.push({
            offset: Math.max(0, Math.min(1, offsetNum)),
            color: parseColor(stopColor),
            opacity: opacity
        });
    }
    stops.sort(function(a,b){ return a.offset - b.offset; });
    return stops;
}

function extractGradients(svgCode) {
    var gradients = [];
    // linear
    var linearRegex = /<linearGradient[^>]*>[\s\S]*?<\/linearGradient>/g;
    var m;
    while ((m = linearRegex.exec(svgCode)) !== null) {
        var el = m[0];
        var id = _gradGetAttr(el, 'id');
        var gradientUnits = _gradGetAttr(el, 'gradientUnits') || 'objectBoundingBox';
        var x1 = parseFloat(_gradGetAttr(el, 'x1') || '0');
        var y1 = parseFloat(_gradGetAttr(el, 'y1') || '0');
        var x2 = parseFloat(_gradGetAttr(el, 'x2') || '1');
        var y2 = parseFloat(_gradGetAttr(el, 'y2') || '0');
        var transform = _gradGetAttr(el, 'gradientTransform');
        var stops = parseGradientStops(el);
        if (stops.length > 0) {
            var grad = { type:'linear', id: id || ('linear_' + gradients.length), x1:x1, y1:y1, x2:x2, y2:y2, stops:stops, gradientUnits:gradientUnits };
            if (transform) grad.transform = transform;
            
            // Store the gradient center for offset calculations (like radial)
            if (gradientUnits === 'userSpaceOnUse') {
                grad._absoluteCenterX = (x1 + x2) / 2;
                grad._absoluteCenterY = (y1 + y2) / 2;
                grad._isAbsoluteCoords = true;
            }
            
            gradients.push(grad);
        }
    }
    // radial
    var radialRegex = /<radialGradient[^>]*>[\s\S]*?<\/radialGradient>/g;
    while ((m = radialRegex.exec(svgCode)) !== null) {
        var el2 = m[0];
        var id2 = _gradGetAttr(el2, 'id');
        var gradientUnits = _gradGetAttr(el2, 'gradientUnits') || 'objectBoundingBox';
        // Default values depend on gradientUnits
        var defaultVal = (gradientUnits === 'userSpaceOnUse') ? '0' : '0.5';
        var cx = parseFloat(_gradGetAttr(el2, 'cx') || defaultVal);
        var cy = parseFloat(_gradGetAttr(el2, 'cy') || defaultVal);
        var r = parseFloat(_gradGetAttr(el2, 'r') || defaultVal);
        var fx = _gradGetAttr(el2, 'fx');
        var fy = _gradGetAttr(el2, 'fy');
        fx = fx !== null ? parseFloat(fx) : cx;
        fy = fy !== null ? parseFloat(fy) : cy;
        var transform2 = _gradGetAttr(el2, 'gradientTransform');
        var stops2 = parseGradientStops(el2);
        if (stops2.length > 0) {
            var grad2 = { type:'radial', id: id2 || ('radial_' + gradients.length), cx:cx, cy:cy, r:r, fx:fx, fy:fy, stops:stops2, gradientUnits:gradientUnits };
            if (transform2) grad2.transform = transform2;
            gradients.push(grad2);
        }
    }
    return gradients;
}

function createGradientShader(gradientData) {
    try {
        // Skip gradient creation if disabled in settings
        if (!importGradientsEnabled) {

            return null;
        }

        // Create descriptive name: "Linear #FFF → #000" or "Radial #FFF → #000"
        var gradTypeName = gradientData.type === 'radial' ? 'Radial' : 'Linear';
        var firstStop = gradientData.stops && gradientData.stops[0];
        var lastStop = gradientData.stops && gradientData.stops[gradientData.stops.length - 1];
        var firstColor = (firstStop && firstStop.color) ? firstStop.color.toUpperCase() : '';
        var lastColor = (lastStop && lastStop.color) ? lastStop.color.toUpperCase() : '';
        var gradientName = gradTypeName + ' ' + firstColor + ' → ' + lastColor;
        
        var shaderId = api.create('gradientShader', gradientName);

        // Set gradient type using setGenerator
        if (gradientData.type === 'radial') {
            try {
                api.setGenerator(shaderId, 'generator', 'radialGradientShader');
            } catch (e) {
                // Failed to set radial gradient type
            }
        } else {
            // Linear gradient - use linearGradientShader for consistency
            try {
                api.setGenerator(shaderId, 'generator', 'linearGradientShader');
            } catch (e) {
                // Linear is likely the default, so failure is not critical
                // Note: Could not explicitly set linear gradient type (may be default)
            }
        }
        
        // Handle gradient-specific properties
        if (gradientData.type === 'radial') {
            // Set radius mode to Bounding Box (1) for all radial gradients
            // This better matches Figma's behavior where gradients scale to fit the shape
            // radiusMode: 0 = Fixed, 1 = Bounding Box
            try {
                api.set(shaderId, {"generator.radiusMode": 1}); // Bounding Box
            } catch (eRM) {
                console.warn('[RADIAL GRADIENT] Could not set radiusMode: ' + eRM.message);
            }
            
            // Calculate SVD singular values from the gradient transform
            // These represent the actual ellipse semi-axes in pixels
            // We use scale.x and scale.y to control the ellipse dimensions directly,
            // so radiusRatio is set to 1 (no additional stretching needed)
            if (gradientData.transform) {
                try {
                    var matrix = parseTransformMatrixList(gradientData.transform);
                    var a = matrix.a, b = matrix.b, c = matrix.c, d = matrix.d;
                    
                    // Calculate singular values of the 2x2 transformation matrix
                    // For M = [[a, c], [b, d]], singular values are sqrt of eigenvalues of M^T * M
                    var norm1Sq = a * a + b * b;
                    var norm2Sq = c * c + d * d;
                    var dotProd = a * c + b * d;
                    
                    var sum = norm1Sq + norm2Sq;
                    var diff = norm1Sq - norm2Sq;
                    var discriminant = Math.sqrt(diff * diff + 4 * dotProd * dotProd);
                    
                    var sigma1Sq = (sum + discriminant) / 2;
                    var sigma2Sq = (sum - discriminant) / 2;
                    
                    var sigma1 = Math.sqrt(Math.max(0, sigma1Sq));
                    var sigma2 = Math.sqrt(Math.max(0, sigma2Sq));
                    
                    // For userSpaceOnUse gradients, we use scale.x/y to control the ellipse directly
                    // So radiusRatio should be 1 (the elliptical shape comes from different scale values)
                    // For objectBoundingBox, we may still need radiusRatio
                    var isAbsoluteCoords = (Math.abs(a) > 2 || Math.abs(b) > 2 || Math.abs(c) > 2 || Math.abs(d) > 2);
                    
                    if (isAbsoluteCoords && gradientData.gradientUnits === 'userSpaceOnUse') {
                        // Set radiusRatio to 1 - ellipse shape will come from scale.x/y
                        api.set(shaderId, {"generator.radiusRatio": 1});
                    } else {
                        // For objectBoundingBox or small matrices, use radiusRatio for aspect
                        var radiusRatio = 1;
                        if (sigma2 > 0.0001) {
                            radiusRatio = sigma1 / sigma2;
                        }
                        radiusRatio = Math.max(0.01, Math.min(100, radiusRatio));
                        api.set(shaderId, {"generator.radiusRatio": radiusRatio});
                    }
                    
                    // Store SVD values for scale calculation when connecting to shape
                    if (__svgGradientMap && __svgGradientMap[gradientData.id]) {
                        __svgGradientMap[gradientData.id]._svdSigma1 = sigma1;
                        __svgGradientMap[gradientData.id]._svdSigma2 = sigma2;
                        __svgGradientMap[gradientData.id]._isAbsoluteCoords = isAbsoluteCoords;
                    }
                } catch (eRR) {
                    console.warn('[RADIAL GRADIENT] Could not process transform: ' + eRR.message);
                }
            }
            
            // Calculate radius first (needed for offset calculation)
            var calculatedRadius = null;
            if (gradientData.r !== undefined && gradientData.gradientUnits === 'userSpaceOnUse') {
                // For userSpaceOnUse, calculate the actual radius with transform
                if (gradientData.transform) {
                    try {
                        var matrix = parseTransformMatrixList(gradientData.transform);
                        var decomposed = decomposeMatrix(matrix);
                        var scaleX = Math.abs(decomposed.scaleX);
                        var scaleY = Math.abs(decomposed.scaleY);
                        var avgScale = (scaleX + scaleY) / 2;
                        calculatedRadius = gradientData.r * avgScale;
                    } catch (eT) {
                        calculatedRadius = gradientData.r;
                    }
                } else {
                    calculatedRadius = gradientData.r;
                }
            }
            
            // Set radial-specific properties (including offset from transform)
            // Always process offset for radial gradients, even if cx/cy are 0
            if (gradientData.type === 'radial') {
                
                // Check if gradient data already has these properties set
                try {
                    if (gradientData._absoluteCenterX !== undefined || gradientData._absoluteCenterY !== undefined) {

                    }
                } catch (e0) {}
                
                try {
                    var offsetX, offsetY;
                    
                    // Handle different gradient units
                    if (gradientData.gradientUnits === 'userSpaceOnUse') {
                        // For userSpaceOnUse, we need the center position from cx/cy plus any transform translation
                        // Default to 0 if cx/cy are not specified
                        offsetX = (gradientData.cx !== undefined) ? parseFloat(gradientData.cx) : 0;
                        offsetY = (gradientData.cy !== undefined) ? parseFloat(gradientData.cy) : 0;

                        // Check if we have a transform with translation
                        if (gradientData.transform) {
                            try {
                                var matrix = parseTransformMatrixList(gradientData.transform);
                                var decomposed = decomposeMatrix(matrix);
                                
                                // Add the translation from the transform
                                var translateX = parseFloat(decomposed.translateX) || 0;
                                var translateY = parseFloat(decomposed.translateY) || 0;

                                offsetX += translateX;
                                offsetY += translateY;
                                
                            } catch (eT) {
                                // Error parsing gradient transform
                                // Keep base cx/cy values
                            }
                        } else {
                        }
                        
                        // For userSpaceOnUse with scale=100 and Fixed radius mode,
                        // the offset needs to be relative to the shape's center
                        // Since we don't have the shape info here, we'll store the absolute position
                        // and calculate the relative offset when connecting to the shape
                        
                        // Store absolute position for later use when connecting to shape
                        // Note: Don't invert Y here, we'll handle coordinate conversion when we know the viewBox
                        
                        if (__svgGradientMap && __svgGradientMap[gradientData.id]) {
                            // Check if we're modifying the right object

                            // Make sure we have valid numbers before storing
                            var absX = parseFloat(offsetX);
                            var absY = parseFloat(offsetY);

                            if (!isNaN(absX) && !isNaN(absY)) {
                                // Log before storing
                                
                                // Store in both places to be sure
                                __svgGradientMap[gradientData.id]._absoluteCenterX = absX;
                                __svgGradientMap[gradientData.id]._absoluteCenterY = absY;
                                __svgGradientMap[gradientData.id]._gradientUnits = gradientData.gradientUnits;
                                
                                // Also store on the gradientData object itself
                                gradientData._absoluteCenterX = absX;
                                gradientData._absoluteCenterY = absY;
                                
                                // Log after storing
                            } else {
                                // Warning: Invalid gradient position values
                            }
                        } else {
                            // Warning: Could not store gradient absolute position
                        }

                        // For now, set offset to 0,0 - we'll update it when connecting to shape
                        offsetX = 0;
                        offsetY = 0;
                    } else {
                        // For objectBoundingBox (default), cx/cy are 0-1
                        // Cavalry offset appears to use -1 to 1 range
                        offsetX = (gradientData.cx - 0.5) * 2;
                        offsetY = (gradientData.cy - 0.5) * 2;
                        
                        // Clamp to reasonable range
                        offsetX = Math.max(-2, Math.min(2, offsetX));
                        offsetY = Math.max(-2, Math.min(2, offsetY));
                    }
                    
                    // Always try to set offset, even if it's (0, 0)
                    // Try setting offset.x and offset.y separately (this seems to work best)
                    try {
                            api.set(shaderId, {"generator.offset.x": offsetX, "generator.offset.y": offsetY});
                            
                            // Log the actual values that were set to help debug
                            try {
                                var actualX = api.get(shaderId, "generator.offset.x");
                                var actualY = api.get(shaderId, "generator.offset.y");
                            } catch (eGet) {}
                    } catch (eXY) {
                        // If that fails, try as array
                        try {
                            api.set(shaderId, {"generator.offset": [offsetX, offsetY]});
                        } catch (eArr) {
                            // Could not set gradient offset
                        }
                    }
                    
                    // Force update to ensure offset is visible
                    try {
                        // Try to trigger an update by setting another property
                        var currentRadius = api.get(shaderId, "generator.radius");
                        api.set(shaderId, {"generator.radius": currentRadius});
                    } catch (eUpdate) {}
                } catch (eOff) {
                    // Error setting gradient offset
                }
            }
            
            // Handle radial gradient radius
            if (gradientData.r !== undefined) {
                try {
                    // For userSpaceOnUse, the radius is in absolute pixels
                    if (gradientData.gradientUnits === 'userSpaceOnUse') {
                        var radius = calculatedRadius || gradientData.r;
                        
                        // Set the radius property
                        try {
                            api.set(shaderId, {"generator.radius": radius});
                        } catch (eRad) {
                            // Error setting radius
                        }
                        
                        // Set scale to 100 for userSpaceOnUse radial gradients
                        try {
                            api.set(shaderId, {"generator.scale.x": 100, "generator.scale.y": 100});
                        } catch (eResetScale) {}
                        
                        // Note: Non-uniform scaling for radial gradients might need to be handled differently
                        // For now, we'll use uniform scaling based on the average
                        if (gradientData.transform) {
                            try {
                                var matrix = parseTransformMatrixList(gradientData.transform);
                                var decomposed = decomposeMatrix(matrix);
                                var scaleX = Math.abs(decomposed.scaleX);
                                var scaleY = Math.abs(decomposed.scaleY);
                                
                                if (Math.abs(scaleX - scaleY) > 0.001) {
                                    // Note: Non-uniform scaling detected - using average for radius
                                }
                            } catch (eT) {}
                        }
                    } else {
                        // For objectBoundingBox, use scale
                        // SVG default radius is 0.5 for objectBoundingBox
                        // Scale = actual radius / default radius
                        var scale = gradientData.r / 0.5;

                        // Sanity check for reasonable scale values to avoid parsing errors
                        if (scale > 5) {
                            // Warning: Large radial gradient scale, clamping to 2.0
                            scale = 2.0;
                        }
                        
                        // Ensure scale is a float with decimal
                        scale = parseFloat(scale.toFixed(2));
                        
                        // Only set scale if it's not 1.0 (default)
                        if (Math.abs(scale - 1.0) > 0.01) {
                            // Try setting scale.x and scale.y separately (this seems to work best)
                            try {
                                api.set(shaderId, {"generator.scale.x": scale, "generator.scale.y": scale});
                            } catch (eXY) {
                                // If that fails, try as array
                                try {
                                    api.set(shaderId, {"generator.scale": [scale, scale]});
                                } catch (eArr) {
                                    // Last resort: try single value
                                    try {
                                        api.set(shaderId, {"generator.scale": scale});
                                    } catch (eSingle) {
                                        // Error setting radial gradient scale - all methods failed
                                    }
                                }
                            }
                        } else {
                            
                        }
                    }
                } catch (eScale) {
                    
                }
            }
        }
        
        var angle = 0;
        if (gradientData.type === 'linear') {
            var dx = (gradientData.x2 - gradientData.x1);
            var dy = (gradientData.y2 - gradientData.y1);
            // SVG Y-axis points down, Cavalry Y-axis points up, so invert dy
            var rawAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
            angle = ((rawAngle % 360) + 360) % 360;
            api.set(shaderId, {"generator.rotation": angle});
            
        }
        
        // Apply gradient transform if present (for rotation, scale, translation)
        if (gradientData.transform) {
            try {
                // Parse the full transform matrix to get rotation, scale, etc.
                var matrix = parseTransformMatrixList(gradientData.transform);
                var decomposed = decomposeMatrix(matrix);
                
                // Apply rotation - SVG uses clockwise, Cavalry uses counter-clockwise
                if (Math.abs(decomposed.rotationDeg) > 0.0001) {
                    // Negate the rotation to convert from SVG to Cavalry coordinate system
                    var cavalryRotation = -decomposed.rotationDeg;
                    api.set(shaderId, {"generator.rotation": cavalryRotation});
                    
                }
                
                // Apply scale if present
                if (Math.abs(decomposed.scaleX - 1) > 0.0001 || Math.abs(decomposed.scaleY - 1) > 0.0001) {
                    var scaleX = decomposed.scaleX;
                    var scaleY = decomposed.scaleY;
                    
                    // For userSpaceOnUse radial gradients, the scale is applied to the radius, not generator.scale
                    if (gradientData.gradientUnits === 'userSpaceOnUse' && gradientData.type === 'radial') {
                        // Scale is already handled in the radius section above
                        
                    } else if (gradientData.gradientUnits === 'userSpaceOnUse') {
                        // For linear userSpaceOnUse gradients, we might still need to handle scale differently
                        
                    } else {
                        // For objectBoundingBox, apply the scale but cap it
                        var avgScale = (scaleX + scaleY) / 2;
                        
                        // Cap at reasonable values
                        if (avgScale > 5) {
                            
                            avgScale = 5;
                        }
                        
                        // Ensure scale is a float with decimal
                        avgScale = parseFloat(avgScale.toFixed(2));
                        
                        // Try setting scale as array [x, y]
                        try {
                            api.set(shaderId, {"generator.scale": [scaleX, scaleY]});
                            
                        } catch (eArr) {
                            // If array fails, try separate x/y
                            try {
                                api.set(shaderId, {"generator.scale.x": scaleX, "generator.scale.y": scaleY});
                                
                            } catch (eXY) {
                                // Last resort: try single average value
                                try {
                                    api.set(shaderId, {"generator.scale": avgScale});
                                    
                                } catch (eSingle) {
                                    
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                
            }
        }
        
        // Set gradient stops on the shader
        var colors = gradientData.stops.map(function(stop){ return stop.color || '#000000'; });
        // Ensure at least two stops for Cavalry gradient
        if (colors.length === 1) colors.push(colors[0]);
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop properties
        for (var i = 0; i < gradientData.stops.length; i++) {
            var stop = gradientData.stops[i];
            try {
                // Set position
                var posAttr = {}; 
                posAttr['generator.gradient.' + i + '.position'] = stop.offset; 
                api.set(shaderId, posAttr);
            } catch (ePos) {
                
            }
            
            try {
                // Set color with opacity
                var colorWithAlpha = colorWithOpacity(stop.color, stop.opacity);
                var colAttr = {}; 
                colAttr['generator.gradient.' + i + '.color'] = colorWithAlpha; 
                api.set(shaderId, colAttr);
            } catch (eCol) {
            }
        }
        
        return shaderId;
    } catch (e) {
        
        return null;
    }
}

/**
 * Create a Sweep (Angular) gradient shader from Figma's GRADIENT_ANGULAR data.
 * Figma exports angular gradients with a data-figma-gradient-fill attribute since
 * SVG doesn't natively support conic/angular gradients.
 * 
 * Cavalry API:
 * - api.create('gradientShader', name) - Create gradient layer
 * - api.setGenerator(id, 'generator', 'sweepGradientShader') - Set to sweep mode
 * - api.setGradientFromColors(id, attr, colors) - Set gradient colors
 * - api.set(id, props) - Set properties like rotation, stops
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect shader to shape
 * 
 * @param {Object} figmaGradData - Parsed Figma gradient data from data-figma-gradient-fill
 * @param {string} layerId - The Cavalry layer ID to apply the gradient to
 * @param {Object} attrs - The shape's SVG attributes (for calculating center, etc.)
 * @returns {string|null} The created shader ID, or null on failure
 */
function createSweepGradientFromFigma(figmaGradData, layerId, attrs) {
    try {
        // Skip gradient creation if disabled in settings
        if (typeof importGradientsEnabled !== 'undefined' && !importGradientsEnabled) {
            return null;
        }
        
        // Extract gradient stops from Figma data
        var stops = figmaGradData.stops || figmaGradData.stopsVar || [];
        if (stops.length === 0) {
            console.warn('[SWEEP GRADIENT] No stops found in Figma gradient data');
            return null;
        }
        
        
        // Create descriptive name from first and last colors
        var firstStop = stops[0];
        var lastStop = stops[stops.length - 1];
        var firstColor = figmaRgbaToHex(firstStop.color);
        var lastColor = figmaRgbaToHex(lastStop.color);
        var gradientName = 'Sweep ' + firstColor + ' → ' + lastColor;
        
        // Create the gradient shader
        var shaderId = api.create('gradientShader', gradientName);
        
        // Set gradient type to sweep (angular) gradient
        try {
            api.setGenerator(shaderId, 'generator', 'sweepGradientShader');
        } catch (eGen) {
            console.warn('[SWEEP GRADIENT] Could not set sweepGradientShader: ' + eGen.message);
            // If sweepGradientShader isn't available, the gradient may default to linear
        }
        
        // Enable Wrap UVs - this makes the gradient wrap smoothly from the last stop
        // back to the first stop, matching Figma's angular gradient behavior
        // Cavalry API: generator.wrapUVs (boolean)
        try {
            api.set(shaderId, {"generator.wrapUVs": true});
        } catch (eWrap) {
            console.warn('[SWEEP GRADIENT] Could not set wrapUVs: ' + eWrap.message);
        }
        
        // Extract gradient stops and invert positions for Cavalry
        // Figma angular gradients go CLOCKWISE, Cavalry sweep gradients go COUNTER-CLOCKWISE
        // To fix this, we invert stop positions: new_position = 1.0 - original_position
        // This reverses the direction so colors appear at the correct angles
        
        // Build array with inverted positions
        var invertedStops = [];
        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            // Invert position: 0 stays at 0, others get mirrored
            // Position 0 becomes 0, 0.341 becomes 0.659, 0.654 becomes 0.346, etc.
            var invertedPos = (stop.position === 0) ? 0 : (1.0 - stop.position);
            invertedStops.push({
                position: invertedPos,
                color: stop.color
            });
        }
        
        // Sort by position (ascending) so gradient stops are in correct order
        invertedStops.sort(function(a, b) { return a.position - b.position; });
        
        // Add closing stop at position 1.0 (same color as position 0) for seamless wrap
        // Find the color at position 0
        var startColor = invertedStops[0].color;
        invertedStops.push({
            position: 1.0,
            color: startColor
        });
        
        
        // Build colors array for setGradientFromColors
        var colors = [];
        for (var ic = 0; ic < invertedStops.length; ic++) {
            colors.push(figmaRgbaToHex(invertedStops[ic].color));
        }
        
        // Ensure at least two stops for Cavalry gradient
        if (colors.length === 1) colors.push(colors[0]);
        
        // Set gradient colors
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop positions and colors with opacity
        for (var si = 0; si < invertedStops.length; si++) {
            var stopData = invertedStops[si];
            var isClosing = (si === invertedStops.length - 1);
            
            try {
                // Set position
                var posAttr = {};
                posAttr['generator.gradient.' + si + '.position'] = stopData.position;
                api.set(shaderId, posAttr);
            } catch (ePos) {
            }
            
            try {
                // Set color with opacity
                var colorWithAlphaValue = figmaRgbaToHexWithAlpha(stopData.color);
                var logSuffix = isClosing ? ' (closing loop)' : '';
                var colAttr = {};
                colAttr['generator.gradient.' + si + '.color'] = colorWithAlphaValue;
                api.set(shaderId, colAttr);
            } catch (eCol) {
            }
        }
        
        // Calculate rotation from Figma's transform matrix
        // Figma transform: {m00, m01, m02, m10, m11, m12}
        // m00, m01, m10, m11 form the 2x2 rotation/scale matrix
        // m02, m12 are translation (center offset)
        // 
        // Key coordinate system differences:
        // - Figma angular gradient: starts at TOP (12 o'clock), goes clockwise
        //   (follows CSS conic-gradient convention: "from 0deg" = top)
        // - Cavalry sweep gradient: starts at RIGHT (3 o'clock), goes counter-clockwise
        //   (Cavalry API: generator.rotation rotates the start point CCW)
        // 
        // IMPORTANT: The gradient transform from Figma often includes the SHAPE's rotation.
        // When you rotate a shape in Figma, the gradient stays aligned with it, so the
        // gradient transform captures that combined rotation. Since the shape's rotation
        // is already applied to the Cavalry shape separately, we need to subtract it
        // from the gradient rotation to avoid double-rotation.
        // 
        // Stop position inversion (done above) handles the direction change (CW → CCW).
        // Rotation must account for the starting point difference (-90°).
        if (figmaGradData.transform) {
            try {
                var t = figmaGradData.transform;
                // Calculate rotation angle from the gradient transform matrix
                // atan2(m10, m00) extracts the rotation component
                var rotationRad = Math.atan2(t.m10, t.m00);
                var gradientRotationDeg = rotationRad * (180 / Math.PI);
                
                // Extract the shape's rotation from its SVG transform attribute
                // The shape's rotation is applied to the Cavalry shape separately,
                // so we need to subtract it to get the gradient-only rotation
                // 
                // Note: For rects with complex transforms, the transform may have been
                // pre-processed and deleted, with the rotation stored in _rotationDeg
                var shapeRotationDeg = 0;
                if (attrs) {
                    if (attrs._rotationDeg !== undefined) {
                        // Use pre-computed rotation from rect transform processing
                        shapeRotationDeg = attrs._rotationDeg;
                    } else if (attrs.transform) {
                        // Parse rotation from transform attribute
                        shapeRotationDeg = getRotationDegFromTransform(attrs.transform);
                    }
                }
                
                // Calculate the gradient-relative rotation (gradient rotation minus shape rotation)
                var relativeGradientRotation = gradientRotationDeg - shapeRotationDeg;
                
                
                // Convert from Figma (TOP start, CW) to Cavalry (RIGHT start, CCW):
                // The negation accounts for direction flip, -90 shifts from TOP to RIGHT
                // Example: Figma 0° → -0 - 90 = -90° = 270° (TOP position in Cavalry)
                var cavalryRotation = -relativeGradientRotation - 90;
                
                // Normalize to 0-360 range
                cavalryRotation = ((cavalryRotation % 360) + 360) % 360;
                
                
                api.set(shaderId, {"generator.rotation": cavalryRotation});
            } catch (eRot) {
                console.warn('[SWEEP GRADIENT] Error applying rotation: ' + eRot.message);
            }
        }
        
        // Apply opacity if specified
        if (figmaGradData.opacity !== undefined && figmaGradData.opacity < 1) {
            var alphaPercent = Math.round(figmaGradData.opacity * 100);
            try {
                api.set(shaderId, {'alpha': alphaPercent});
            } catch (eAlpha) {}
        }
        
        // Connect the shader to the shape
        try {
            api.setFill(layerId, true);
            api.set(layerId, {"material.materialColor.a": 0}); // Hide base color
            api.set(layerId, {"material.alpha": 100});
            api.connect(shaderId, 'id', layerId, 'material.colorShaders');
            
            // Parent the shader under the shape
            try { api.parent(shaderId, layerId); } catch (ePar) {}
            
        } catch (eConnect) {
            console.error('[SWEEP GRADIENT] Failed to connect shader: ' + eConnect.message);
        }
        
        return shaderId;
        
    } catch (e) {
        console.error('[SWEEP GRADIENT] Error creating sweep gradient: ' + e.message);
        return null;
    }
}

/**
 * Create a Diamond gradient shader from Figma's GRADIENT_DIAMOND data.
 * Figma exports diamond gradients with a data-figma-gradient-fill attribute since
 * SVG doesn't natively support diamond gradients.
 * 
 * Diamond gradients in Figma radiate from the center outward in a diamond shape.
 * In Cavalry, we approximate this using a Shape Gradient with shapeSides=4.
 * 
 * Cavalry API:
 * - api.create('gradientShader', name) - Create gradient layer
 * - api.setGenerator(id, 'generator', 'shapeGradientShader') - Set to shape mode
 * - api.set(id, {'generator.shapeSides': 4}) - Set to 4 sides for diamond shape
 * - api.setGradientFromColors(id, attr, colors) - Set gradient colors
 * - api.set(id, props) - Set properties like rotation, stops
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect shader to shape
 * 
 * @param {Object} figmaGradData - Parsed Figma gradient data from data-figma-gradient-fill
 * @param {string} layerId - The Cavalry layer ID to apply the gradient to
 * @param {Object} attrs - The shape's SVG attributes (for calculating center, etc.)
 * @returns {string|null} The created shader ID, or null on failure
 */
function createDiamondGradientFromFigma(figmaGradData, layerId, attrs) {
    try {
        // Skip gradient creation if disabled in settings
        if (typeof importGradientsEnabled !== 'undefined' && !importGradientsEnabled) {
            return null;
        }
        
        // Extract gradient stops from Figma data
        var stops = figmaGradData.stops || figmaGradData.stopsVar || [];
        if (stops.length === 0) {
            console.warn('[DIAMOND GRADIENT] No stops found in Figma gradient data');
            return null;
        }
        
        
        // Create descriptive name from first and last colors
        var firstStop = stops[0];
        var lastStop = stops[stops.length - 1];
        var firstColor = figmaRgbaToHex(firstStop.color);
        var lastColor = figmaRgbaToHex(lastStop.color);
        var gradientName = 'Diamond ' + firstColor + ' → ' + lastColor;
        
        // Create the gradient shader
        var shaderId = api.create('gradientShader', gradientName);
        
        // Set gradient type to shape gradient (for diamond with 4 sides)
        // Cavalry API: api.setGenerator(id, 'generator', 'shapeGradientShader')
        try {
            api.setGenerator(shaderId, 'generator', 'shapeGradientShader');
        } catch (eGen) {
            console.warn('[DIAMOND GRADIENT] Could not set shapeGradientShader: ' + eGen.message);
            // Fallback: try radial gradient as an approximation
            try {
                api.setGenerator(shaderId, 'generator', 'radialGradientShader');
            } catch (eFallback) {
                console.warn('[DIAMOND GRADIENT] Could not set radial fallback: ' + eFallback.message);
            }
        }
        
        // Set shape sides to 4 for diamond shape
        // Cavalry API: generator.sides (integer) - from Cavalry docs "Shape Sides"
        try {
            api.set(shaderId, {"generator.sides": 4});
        } catch (eSides) {
            console.warn('[DIAMOND GRADIENT] Could not set sides: ' + eSides.message);
        }
        
        // Set rotation to 45 degrees to orient diamond correctly (point up)
        // Figma's diamond gradient has points at top/bottom/left/right
        // Cavalry's polygon with 4 sides starts with flat top, so rotate 45°
        try {
            api.set(shaderId, {"generator.rotation": 45});
        } catch (eInitRot) {
            console.warn('[DIAMOND GRADIENT] Could not set initial rotation: ' + eInitRot.message);
        }
        
        // Build colors array for setGradientFromColors
        var colors = [];
        for (var ic = 0; ic < stops.length; ic++) {
            colors.push(figmaRgbaToHex(stops[ic].color));
        }
        
        // Ensure at least two stops for Cavalry gradient
        if (colors.length === 1) colors.push(colors[0]);
        
        // Set gradient colors
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop positions and colors with opacity
        for (var si = 0; si < stops.length; si++) {
            var stopData = stops[si];
            
            try {
                // Set position
                var posAttr = {};
                posAttr['generator.gradient.' + si + '.position'] = stopData.position;
                api.set(shaderId, posAttr);
            } catch (ePos) {
            }
            
            try {
                // Set color with opacity
                var colorWithAlphaValue = figmaRgbaToHexWithAlpha(stopData.color);
                var colAttr = {};
                colAttr['generator.gradient.' + si + '.color'] = colorWithAlphaValue;
                api.set(shaderId, colAttr);
            } catch (eCol) {
            }
        }
        
        // Calculate rotation from Figma's transform matrix
        // Figma transform: {m00, m01, m02, m10, m11, m12}
        // m00, m01, m10, m11 form the 2x2 rotation/scale matrix
        // m02, m12 are translation (center offset)
        // 
        // IMPORTANT: The gradient transform from Figma often includes the SHAPE's rotation.
        // When you rotate a shape in Figma, the gradient stays aligned with it, so the
        // gradient transform captures that combined rotation. Since the shape's rotation
        // is already applied to the Cavalry shape separately, we need to subtract it
        // from the gradient rotation to avoid double-rotation.
        if (figmaGradData.transform) {
            try {
                var t = figmaGradData.transform;
                // Calculate rotation angle from the gradient transform matrix
                // rotation = atan2(m10, m00) gives the angle in radians
                var rotationRad = Math.atan2(t.m10, t.m00);
                var gradientRotationDeg = rotationRad * (180 / Math.PI);
                
                // Extract the shape's rotation from its SVG transform attribute
                // The shape's rotation is applied to the Cavalry shape separately,
                // so we need to subtract it to get the gradient-only rotation
                // 
                // Note: For rects with complex transforms, the transform may have been
                // pre-processed and deleted, with the rotation stored in _rotationDeg
                var shapeRotationDeg = 0;
                if (attrs) {
                    if (attrs._rotationDeg !== undefined) {
                        // Use pre-computed rotation from rect transform processing
                        shapeRotationDeg = attrs._rotationDeg;
                    } else if (attrs.transform) {
                        // Parse rotation from transform attribute
                        shapeRotationDeg = getRotationDegFromTransform(attrs.transform);
                    }
                }
                
                // Calculate the gradient-relative rotation (gradient rotation minus shape rotation)
                var relativeGradientRotation = gradientRotationDeg - shapeRotationDeg;
                
                
                // Add 45° base rotation for diamond orientation, then apply relative gradient rotation
                // Negate the rotation because Cavalry uses counter-clockwise positive
                var cavalryRotation = 45 - relativeGradientRotation;
                
                // Normalize to 0-360 range
                cavalryRotation = ((cavalryRotation % 360) + 360) % 360;
                
                
                api.set(shaderId, {"generator.rotation": cavalryRotation});
            } catch (eRot) {
                console.warn('[DIAMOND GRADIENT] Error applying rotation: ' + eRot.message);
            }
        }
        
        // Set tiling to Mirror for diamond gradients
        // Cavalry API: Gradient Shader has 'tiling' at top level (not under generator.)
        // Values: 0=Clamp, 1=Repeat, 2=Mirror, 3=Decal
        try {
            api.set(shaderId, {'tiling': 2});
        } catch (eTiling) {
            console.warn('[DIAMOND GRADIENT] Could not set tiling: ' + eTiling.message);
        }
        
        // Apply opacity if specified
        if (figmaGradData.opacity !== undefined && figmaGradData.opacity < 1) {
            var alphaPercent = Math.round(figmaGradData.opacity * 100);
            try {
                api.set(shaderId, {'alpha': alphaPercent});
            } catch (eAlpha) {}
        }
        
        // Connect the shader to the shape
        try {
            api.setFill(layerId, true);
            api.set(layerId, {"material.materialColor.a": 0}); // Hide base color
            api.set(layerId, {"material.alpha": 100});
            api.connect(shaderId, 'id', layerId, 'material.colorShaders');
            
            // Parent the shader under the shape
            try { api.parent(shaderId, layerId); } catch (ePar) {}
            
        } catch (eConnect) {
            console.error('[DIAMOND GRADIENT] Failed to connect shader: ' + eConnect.message);
        }
        
        return shaderId;
        
    } catch (e) {
        console.error('[DIAMOND GRADIENT] Error creating diamond gradient: ' + e.message);
        return null;
    }
}

/**
 * Convert Figma RGBA color object to hex string (#RRGGBB)
 * @param {Object} color - Figma color object {r, g, b, a} with 0-1 values
 * @returns {string} Hex color string
 */
function figmaRgbaToHex(color) {
    if (!color) return '#000000';
    var r = Math.round((color.r || 0) * 255).toString(16).padStart(2, '0');
    var g = Math.round((color.g || 0) * 255).toString(16).padStart(2, '0');
    var b = Math.round((color.b || 0) * 255).toString(16).padStart(2, '0');
    return '#' + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
}

/**
 * Convert Figma RGBA color object to hex string with alpha (#AARRGGBB for Cavalry)
 * @param {Object} color - Figma color object {r, g, b, a} with 0-1 values
 * @returns {string} Hex color string with alpha
 */
function figmaRgbaToHexWithAlpha(color) {
    if (!color) return '#FF000000';
    var a = Math.round((color.a !== undefined ? color.a : 1) * 255).toString(16).padStart(2, '0');
    var r = Math.round((color.r || 0) * 255).toString(16).padStart(2, '0');
    var g = Math.round((color.g || 0) * 255).toString(16).padStart(2, '0');
    var b = Math.round((color.b || 0) * 255).toString(16).padStart(2, '0');
    return '#' + a.toUpperCase() + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
}
