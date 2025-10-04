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
    if (!hexColor || hexColor[0] !== '#') return hexColor;
    var h = hexColor.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    } else if (h.length === 8) {
        h = h.slice(2);
        if (h.length !== 6) h = h.slice(0, 6);
    }
    if (h.length !== 6) return hexColor;
    var a = Math.max(0, Math.min(1, opacity));
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
        var stopColor = _gradGetAttr(stopElement, "stop-color");
        var stopOpacity = _gradGetAttr(stopElement, "stop-opacity");
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

        var shaderId = api.create('gradientShader', 'Gradient ' + gradientData.id);

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
            // Set radius mode based on gradientUnits
            try {
                var radiusMode = 1; // Default to Bounding Box
                if (gradientData.gradientUnits === 'userSpaceOnUse') {
                    radiusMode = 0; // Fixed for absolute coordinates
                }
                api.set(shaderId, {"generator.radiusMode": radiusMode});
            } catch (eRM) {
                // Error setting radiusMode
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
                var colAttr = {}; 
                colAttr['generator.gradient.' + i + '.color'] = colorWithOpacity(stop.color, stop.opacity); 
                api.set(shaderId, colAttr);
            } catch (eCol) {
                
            }
        }
        
        return shaderId;
    } catch (e) {
        
        return null;
    }
}
