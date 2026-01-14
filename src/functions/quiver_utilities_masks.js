// --- Mask/Clipping Path Support (Simplified) ---
// With Clipping Masks (`masks` attribute), multiple masks naturally intersect.
// No complex redundancy filtering needed - just apply all inherited masks.

// Global mask storage
var __svgMaskMap = {};

// Cache for created Cavalry mask/clip shapes (maskId -> cavalryShapeId)
// This prevents duplicate shapes when multiple elements use the same clipPath
var __createdMaskShapes = {};

// Reverse lookup: targetLayerId -> [maskShapeId1, maskShapeId2, ...]
// Used to transfer masks when replacing layers (hybrid approach)
// Now stores an ARRAY of mask shapes to support multiple masks
var __targetToMaskShape = {};

// Track which shapes are being used as mattes (so they're not hidden)
var __shapesUsedAsMattes = {};

function setMaskContext(maskMap) {
    __svgMaskMap = maskMap || {};
}

function resetMaskShapeCache() {
    // Call this at the start of each import to clear the cache
    __createdMaskShapes = {};
    __targetToMaskShape = {};
    __shapesUsedAsMattes = {};
}

// Pre-process mask child transform to extract rotation and calculate correct position
// This mirrors the transform processing done in importNode for rect/circle/ellipse nodes
// Uses: parseTransformMatrixList, decomposeMatrix, parseTranslate from quiver_utilities_transform.js
function _preprocessMaskChildTransform(maskChild) {
    // Clone to avoid modifying the original
    var clone = JSON.parse(JSON.stringify(maskChild));
    
    var transformStr = clone.attrs && clone.attrs.transform;
    if (!transformStr || typeof transformStr !== 'string') {
        return clone; // No transform to process
    }
    
    // Check if transform contains non-trivial operations (rotation, scale, skew, or matrix)
    var hasMatrix = transformStr.indexOf('matrix') !== -1;
    var hasRotate = transformStr.indexOf('rotate') !== -1;
    var hasScale = transformStr.indexOf('scale') !== -1;
    var hasSkew = transformStr.indexOf('skew') !== -1;
    var needsMatrixApproach = hasMatrix || hasRotate || hasScale || hasSkew;
    
    if (!needsMatrixApproach) {
        // Pure translation only - handle via parseTranslate (which createRect already does)
        return clone;
    }
    
    // Parse the full transform as a matrix and decompose it
    var fullMatrix = parseTransformMatrixList(transformStr);
    var decomposed = decomposeMatrix(fullMatrix);
    var rotationDeg = decomposed.rotationDeg || 0;
    
    
    // Handle based on shape type
    if (clone.type === 'rect') {
        var x = parseFloat(clone.attrs.x || '0');
        var y = parseFloat(clone.attrs.y || '0');
        var w = parseFloat(clone.attrs.width || '0');
        var h = parseFloat(clone.attrs.height || '0');
        
        // Calculate the center of the original rect
        var centerX = x + w / 2;
        var centerY = y + h / 2;
        
        // Transform the center point through the full matrix to get final position
        var transformedCenterX = fullMatrix.a * centerX + fullMatrix.c * centerY + fullMatrix.e;
        var transformedCenterY = fullMatrix.b * centerX + fullMatrix.d * centerY + fullMatrix.f;
        
        // Store rotation for application in createRect
        clone.attrs._rotationDeg = rotationDeg;
        
        // Store transformed center for position calculation
        clone.attrs._transformedCenterX = transformedCenterX;
        clone.attrs._transformedCenterY = transformedCenterY;
        
        // Store local center for gradient offset calculation
        clone.attrs._localCenterX = centerX;
        clone.attrs._localCenterY = centerY;
        
        // Update position based on transformed center
        clone.attrs.x = (transformedCenterX - w / 2).toString();
        clone.attrs.y = (transformedCenterY - h / 2).toString();
        
    } else if (clone.type === 'circle' || clone.type === 'ellipse') {
        var cx = parseFloat(clone.attrs.cx || '0');
        var cy = parseFloat(clone.attrs.cy || '0');
        
        // Transform the center point
        var transformedCx = fullMatrix.a * cx + fullMatrix.c * cy + fullMatrix.e;
        var transformedCy = fullMatrix.b * cx + fullMatrix.d * cy + fullMatrix.f;
        
        // Store rotation (circles don't visually rotate, but ellipses might need it)
        clone.attrs._rotationDeg = rotationDeg;
        
        // Update center position
        clone.attrs.cx = transformedCx.toString();
        clone.attrs.cy = transformedCy.toString();
        
    }
    
    // Clear transform to prevent double-application in createRect/createCircle/createEllipse
    delete clone.attrs.transform;
    
    return clone;
}

// Check if SVG geometry matches the clipPath geometry (for optimization)
// This compares SVG source data directly to avoid creating duplicate mask shapes
// svgGeometry: {x, y, width, height} from rect nodes, or {d: pathData} from path nodes
function doesSvgGeometryMatchClipPath(svgGeometry, maskDef) {
    try {
        if (!svgGeometry) {
            return false;
        }
        
        if (!maskDef || !maskDef.children || maskDef.children.length !== 1) {
            return false;
        }
        
        var clipChild = maskDef.children[0];
        
        // Handle rect clipPaths (most common case from Figma frames)
        if (clipChild.type === 'rect' && svgGeometry.width !== undefined) {
            // Get clipPath rect geometry
            var clipX = parseFloat(clipChild.attrs.x || '0');
            var clipY = parseFloat(clipChild.attrs.y || '0');
            var clipW = parseFloat(clipChild.attrs.width || '0');
            var clipH = parseFloat(clipChild.attrs.height || '0');
            
            // Get target SVG geometry (passed from caller)
            var targetX = svgGeometry.x;
            var targetY = svgGeometry.y;
            var targetW = svgGeometry.width;
            var targetH = svgGeometry.height;
            
            // Compare dimensions and position (within tolerance)
            var tolerance = 1.0; // 1px tolerance
            var dimMatch = Math.abs(targetW - clipW) < tolerance && Math.abs(targetH - clipH) < tolerance;
            var posMatch = Math.abs(targetX - clipX) < tolerance && Math.abs(targetY - clipY) < tolerance;
            
            
            return dimMatch && posMatch;
        }
        
        // Handle path clipPaths (rounded rects, complex shapes)
        if (clipChild.type === 'path' && svgGeometry.d !== undefined) {
            var clipD = clipChild.attrs.d || '';
            var targetD = svgGeometry.d || '';
            
            // Normalize path data for comparison (remove extra whitespace)
            var normalizePathData = function(d) {
                return d.replace(/\s+/g, ' ').trim();
            };
            
            var clipDNorm = normalizePathData(clipD);
            var targetDNorm = normalizePathData(targetD);
            
            var pathMatch = clipDNorm === targetDNorm;
            
            
            return pathMatch;
        }
        
        // Handle circle clipPaths
        if (clipChild.type === 'circle' && svgGeometry.cx !== undefined) {
            var clipCx = parseFloat(clipChild.attrs.cx || '0');
            var clipCy = parseFloat(clipChild.attrs.cy || '0');
            var clipR = parseFloat(clipChild.attrs.r || '0');
            
            var targetCx = svgGeometry.cx;
            var targetCy = svgGeometry.cy;
            var targetR = svgGeometry.r;
            
            var tolerance = 1.0;
            var circleMatch = Math.abs(targetCx - clipCx) < tolerance &&
                              Math.abs(targetCy - clipCy) < tolerance &&
                              Math.abs(targetR - clipR) < tolerance;
            
            
            return circleMatch;
        }
        
        // Handle ellipse clipPaths
        if (clipChild.type === 'ellipse' && svgGeometry.cx !== undefined && svgGeometry.rx !== undefined) {
            var clipExCx = parseFloat(clipChild.attrs.cx || '0');
            var clipExCy = parseFloat(clipChild.attrs.cy || '0');
            var clipRx = parseFloat(clipChild.attrs.rx || '0');
            var clipRy = parseFloat(clipChild.attrs.ry || '0');
            
            var targetExCx = svgGeometry.cx;
            var targetExCy = svgGeometry.cy;
            var targetRx = svgGeometry.rx;
            var targetRy = svgGeometry.ry;
            
            var tolerance = 1.0;
            var ellipseMatch = Math.abs(targetExCx - clipExCx) < tolerance &&
                               Math.abs(targetExCy - clipExCy) < tolerance &&
                               Math.abs(targetRx - clipRx) < tolerance &&
                               Math.abs(targetRy - clipRy) < tolerance;
            
            
            return ellipseMatch;
        }
        
        return false;
    } catch (e) {
        return false;
    }
}

// Get all mask shapes that were connected to a target layer
// Returns an array of mask shape IDs
function getMaskShapesForTarget(targetLayerId) {
    return __targetToMaskShape[targetLayerId] || [];
}

// Legacy function for backwards compatibility - returns first mask only
function getMaskShapeForTarget(targetLayerId) {
    var masks = __targetToMaskShape[targetLayerId];
    return (masks && masks.length > 0) ? masks[0] : null;
}

// Add a mask shape to the target's reverse lookup
function addMaskShapeForTarget(targetLayerId, maskShapeId) {
    if (!__targetToMaskShape[targetLayerId]) {
        __targetToMaskShape[targetLayerId] = [];
    }
    // Avoid duplicates
    if (__targetToMaskShape[targetLayerId].indexOf(maskShapeId) === -1) {
        __targetToMaskShape[targetLayerId].push(maskShapeId);
    }
}

function getMaskDefinition(maskId) {
    return __svgMaskMap[maskId] || null;
}

// Create or reuse a mask shape and connect it to the target
// svgGeometry is optional: {x, y, width, height} from the SVG rect node for optimization
function createMaskShapeForTarget(maskId, targetShapeId, parentId, vb, model, svgGeometry) {
    
    try {
        // Look up the mask definition
        var maskDef = getMaskDefinition(maskId);
        if (!maskDef) {
            console.warn('[Quiver] Mask definition not found: ' + maskId);
            return null;
        }

        var typeLabel = maskDef.type === 'clip' ? 'clipPath' : 'mask';
        
        // Check if we already created/designated a Cavalry shape for this maskId
        if (__createdMaskShapes[maskId]) {
            var existingShapeId = __createdMaskShapes[maskId];
            
            // If the target is the same as the cached mask shape, skip connecting to itself
            if (existingShapeId === targetShapeId) {
                return existingShapeId;
            }
            
            // Connect the existing shape to the new target via masks
            try {
                api.connect(existingShapeId, 'id', targetShapeId, 'masks');
                addMaskShapeForTarget(targetShapeId, existingShapeId);
                
                // If this matte is a visible shape being reused, ensure it stays visible
                if (__shapesUsedAsMattes[existingShapeId]) {
                    try {
                        api.set(existingShapeId, { 'hidden': false });
                    } catch (eVis) {}
                }
            } catch (eReuse) {
                console.warn('[MASK]   ✗ FAILED to connect: ' + eReuse.message);
            }
            return existingShapeId;
        }
        
        // OPTIMIZATION: Check if the target SVG geometry matches the clipPath geometry
        // If so, use the target shape itself as the matte (no duplicate needed)
        if (maskDef.type === 'clip' && svgGeometry && doesSvgGeometryMatchClipPath(svgGeometry, maskDef)) {
            
            // Cache this shape as the mask for this clipPath
            __createdMaskShapes[maskId] = targetShapeId;
            __shapesUsedAsMattes[targetShapeId] = true;
            
            // Ensure the shape stays visible (it's both a visible shape AND a matte)
            try {
                api.set(targetShapeId, { 'hidden': false });
            } catch (eVisible) {}
            
            return targetShapeId;
        }

        // Get the first child element from the mask (the mask shape)
        var maskChild = maskDef.children && maskDef.children[0];
        if (!maskChild) {
            console.warn('[Quiver] Mask has no child elements: ' + maskId);
            return null;
        }

        // Pre-process the mask child's transform (same as importNode does for rects)
        // This ensures rotation and position are correctly applied to mask shapes
        var processedMaskChild = _preprocessMaskChildTransform(maskChild);

        // Create the mask shape based on its type
        var maskShapeId = null;
        
        if (processedMaskChild.type === 'rect') {
            maskShapeId = createRect(processedMaskChild, parentId, vb);
        } else if (processedMaskChild.type === 'circle') {
            maskShapeId = createCircle(processedMaskChild, parentId, vb);
        } else if (processedMaskChild.type === 'ellipse') {
            maskShapeId = createEllipse(processedMaskChild, parentId, vb);
        } else if (maskChild.type === 'path') {
            var segments = parsePathDataToAbsolute(maskChild.attrs.d || '');
            var pathName = maskChild.name || (maskDef.type === 'clip' ? 'Clip Path' : 'Mask Path');
            maskShapeId = createEditableFromPathSegments(segments, pathName, parentId, vb, {x:0, y:0}, maskChild.attrs);
        } else {
            console.warn('[Quiver] Unsupported mask shape type: ' + maskChild.type);
            return null;
        }

        if (!maskShapeId) {
            console.warn('[Quiver] Failed to create mask shape');
            return null;
        }

        // Cache the created shape for reuse
        __createdMaskShapes[maskId] = maskShapeId;

        // Set the mask shape as hidden
        try {
            api.set(maskShapeId, { 'hidden': true });
        } catch (eHidden) {
            console.warn('[Quiver] Could not set mask shape as hidden');
        }

        // For luminance masks, create and attach ShiftChannels filter
        if (maskDef.type === 'luminance') {
            try {
                var shiftChannelsId = api.create('shiftChannels', 'Shift Channels [' + maskChild.name + ']');
                if (shiftChannelsId) {
                    // Set alpha source to Luminance (enum value 5)
                    api.set(shiftChannelsId, { 'aSource': 5 });
                    
                    // Connect filter to mask shape
                    try {
                        api.connect(shiftChannelsId, 'id', maskShapeId, 'filters');
                    } catch (eConn) {
                        console.warn('[Quiver] Could not connect ShiftChannels to mask shape');
                    }
                    
                    // Parent filter under mask shape
                    try {
                        if (!api.getParent(shiftChannelsId)) {
                            api.parent(shiftChannelsId, maskShapeId);
                        }
                    } catch (eParent) {}
                }
            } catch (eShift) {
                console.warn('[Quiver] Could not create ShiftChannels filter for luminance mask');
            }
        }

        // Connect mask shape to target shape via masks
        try {
            api.connect(maskShapeId, 'id', targetShapeId, 'masks');
            addMaskShapeForTarget(targetShapeId, maskShapeId);
        } catch (eClipMask) {
            console.warn('[Quiver] Could not connect mask: ' + eClipMask.message);
        }

        return maskShapeId;
    } catch (e) {
        console.error('[Quiver] Error creating mask shape: ' + (e.message || e));
        return null;
    }
}

