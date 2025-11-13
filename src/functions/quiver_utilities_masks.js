// --- Mask/Clipping Path Support ---

// Global mask storage
var __svgMaskMap = {};

function setMaskContext(maskMap) {
    __svgMaskMap = maskMap || {};
}

function getMaskDefinition(maskId) {
    return __svgMaskMap[maskId] || null;
}

function createMaskShapeForTarget(maskId, targetShapeId, parentId, vb, model) {
    try {
        // Look up the mask definition
        var maskDef = getMaskDefinition(maskId);
        if (!maskDef) {
            console.warn('[Quiver] Mask definition not found: ' + maskId);
            return null;
        }

        // Get the first child element from the mask (the mask shape)
        var maskChild = maskDef.children && maskDef.children[0];
        if (!maskChild) {
            console.warn('[Quiver] Mask has no child elements: ' + maskId);
            return null;
        }

        // Create the mask shape based on its type
        var maskShapeId = null;
        
        if (maskChild.type === 'rect') {
            maskShapeId = createRect(maskChild, parentId, vb);
        } else if (maskChild.type === 'circle') {
            maskShapeId = createCircle(maskChild, parentId, vb);
        } else if (maskChild.type === 'ellipse') {
            maskShapeId = createEllipse(maskChild, parentId, vb);
        } else if (maskChild.type === 'path') {
            var segments = parsePathDataToAbsolute(maskChild.attrs.d || '');
            maskShapeId = createEditableFromPathSegments(segments, maskChild.name || 'Mask Path', parentId, vb, {x:0, y:0}, maskChild.attrs);
        } else {
            console.warn('[Quiver] Unsupported mask shape type: ' + maskChild.type);
            return null;
        }

        if (!maskShapeId) {
            console.warn('[Quiver] Failed to create mask shape');
            return null;
        }

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

        // Connect mask shape to target shape via trackMattes
        try {
            api.connect(maskShapeId, 'id', targetShapeId, 'trackMattes');
            console.log('[Quiver] Connected mask ' + maskId + ' to shape ' + api.getNiceName(targetShapeId));
        } catch (eTrackMatte) {
            console.warn('[Quiver] Could not connect mask as track matte: ' + eTrackMatte.message);
        }

        return maskShapeId;
    } catch (e) {
        console.error('[Quiver] Error creating mask shape: ' + (e.message || e));
        return null;
    }
}

