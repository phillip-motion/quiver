function _copyBasicStyles(fromId, toId) {
    try {
        var fillOn = false; try { fillOn = api.hasFill(fromId); } catch (e) {}
        if (!fillOn) { try { api.setFill(toId, false); } catch (eF0) {} }
        else {
            try { api.setFill(toId, true); } catch (eF1) {}
            var fs = {};
            try { var col = api.get(fromId, 'material.materialColor'); if (col) fs['material.materialColor'] = col; } catch (eC) {}
            try { var al = api.get(fromId, 'material.alpha'); if (typeof al === 'number') fs['material.alpha'] = al; } catch (eA) {}
            if (Object.keys(fs).length) { try { api.set(toId, fs); } catch (eFS) {} }
        }
        var strokeOn = false; try { strokeOn = api.hasStroke(fromId); } catch (eS) {}
        if (!strokeOn) { try { api.setStroke(toId, false); } catch (eS0) {} }
        else {
            try { api.setStroke(toId, true); } catch (eS1) {}
            var ss = {};
            try { var scol = api.get(fromId, 'stroke.strokeColor'); if (scol) ss['stroke.strokeColor'] = scol; } catch (eSC) {}
            try { var sw = api.get(fromId, 'stroke.width'); if (typeof sw === 'number') ss['stroke.width'] = sw; } catch (eSW) {}
            try { var sa = api.get(fromId, 'stroke.alpha'); if (typeof sa === 'number') ss['stroke.alpha'] = sa; } catch (eSA) {}
            // Preserve stroke alignment (Centre/Inner/Outer)
            try {
                var salign = api.get(fromId, 'stroke.align');
                if (salign !== undefined && salign !== null) {
                    var okAlign = false;
                    try { api.set(toId, { 'stroke.align': salign }); okAlign = true; } catch (eSetAlign) { okAlign = false; }
                    if (!okAlign) {
                        var enumVal = 0; // Centre
                        var sval = ('' + salign).toLowerCase();
                        if (sval === 'inner') enumVal = 1; else if (sval === 'outer') enumVal = 2;
                        try { api.set(toId, { 'stroke.align': enumVal }); } catch (eSetAlign2) {}
                    }
                }
            } catch (eGA) {}
            // Preserve cap style
            try {
                var capStyle = api.get(fromId, 'stroke.capStyle');
                if (capStyle !== undefined && capStyle !== null) {
                    try { api.set(toId, { 'stroke.capStyle': capStyle }); } catch (eSetCap) {}
                }
            } catch (eGCap) {}
            // Preserve join style
            try {
                var joinStyle = api.get(fromId, 'stroke.joinStyle');
                if (joinStyle !== undefined && joinStyle !== null) {
                    try { api.set(toId, { 'stroke.joinStyle': joinStyle }); } catch (eSetJoin) {}
                }
            } catch (eGJoin) {}
            // Preserve dashed stroke
            try {
                var dp = api.get(fromId, 'stroke.dashPattern');
                if (dp) { try { api.set(toId, { 'stroke.dashPattern': dp }); } catch (eDPs) {} }
                var dm = api.get(fromId, 'stroke.dashPatternMode');
                if (dm !== undefined && dm !== null) { try { api.set(toId, { 'stroke.dashPatternMode': dm }); } catch (eDMs) {} }
                var dof = api.get(fromId, 'stroke.dashOffset');
                if (typeof dof === 'number') { try { api.set(toId, { 'stroke.dashOffset': dof }); } catch (eDOf) {} }
            } catch (eDash) {}
            if (Object.keys(ss).length) { try { api.set(toId, ss); } catch (eSS) {} }
        }
    } catch (eAll) {}
}

/**
 * Map attribute paths from editableShape to basicShape (rectangle/ellipse).
 * Different shape types have different attribute structures.
 * 
 * From Cavalry UI "Copy Scripting Path":
 * - Fill shaders: material.colorShaders
 * - Stroke shaders: stroke.colorShaders
 * 
 * editableShape uses: material.colorShaders.0.shader (indexed)
 * basicShape uses: material.colorShaders (connect to the array directly)
 */
function _mapAttributeToBasicShape(attrId) {
    // Map material.colorShaders.X.shader to material.colorShaders (for fill connections)
    // Connect shader.id to material.colorShaders directly (not indexed)
    if (attrId && attrId.indexOf('material.colorShaders') === 0 && attrId.indexOf('.shader') > 0) {
        return 'material.colorShaders';
    }
    // Map stroke.colorShaders.X.shader to stroke.colorShaders (for stroke connections)
    if (attrId && attrId.indexOf('stroke.colorShaders') === 0 && attrId.indexOf('.shader') > 0) {
        return 'stroke.colorShaders';
    }
    // Return original if no mapping needed
    return attrId;
}

/**
 * Transfer all incoming and outgoing connections from one layer to another.
 * 
 * Cavalry API used:
 * - api.getInConnectedAttributes(layerId) - Get all attributes with incoming connections
 * - api.getInConnection(layerId, attrId) - Get the source of an incoming connection
 * - api.getOutConnectedAttributes(layerId) - Get all attributes with outgoing connections
 * - api.getOutConnections(layerId, attrId) - Get all destinations of outgoing connections
 * - api.connect(fromLayerId, fromAttrId, toLayerId, toAttrId, force) - Create a connection
 */
function _transferConnections(fromId, toId) {
    var transferred = 0;
    
    // Transfer incoming connections
    // Skip indexed filter attributes like "filters.0" since filters work by parenting
    // BUT shader connections (material.colorShaders.X.shader) MUST be reconnected
    try {
        var inAttrs = api.getInConnectedAttributes(fromId);
        console.log('[Convert] Found ' + (inAttrs ? inAttrs.length : 0) + ' incoming connection(s)');
        if (inAttrs && inAttrs.length > 0) {
            for (var i = 0; i < inAttrs.length; i++) {
                var attrId = inAttrs[i];
                
                // Skip filter indexed attributes (like "filters.0") - filters work by parenting
                // But DON'T skip shader connections - they MUST be connected to work
                if (attrId && attrId.indexOf('filters.') === 0 && /\.\d+$/.test(attrId)) {
                    console.log('[Convert] Skipping filter indexed attr (children reparented): ' + attrId);
                    continue;
                }
                
                try {
                    var inConn = api.getInConnection(fromId, attrId);
                    console.log('[Convert] Incoming: ' + attrId + ' <- ' + inConn);
                    if (inConn && inConn.length > 0) {
                        // inConn format is "layerId.attrId" - parse it
                        // Layer IDs are like "colorShader#123" (contain #, no dots)
                        // Attr IDs can be like "id" or "material.alpha"
                        // So find the first dot to split layer from attr
                        var firstDotIndex = inConn.indexOf('.');
                        if (firstDotIndex > 0) {
                            var sourceLayerId = inConn.substring(0, firstDotIndex);
                            var sourceAttrId = inConn.substring(firstDotIndex + 1);
                            // Map the destination attribute to basicShape format
                            var mappedAttrId = _mapAttributeToBasicShape(attrId);
                            console.log('[Convert] Parsed: sourceLayer=' + sourceLayerId + ', sourceAttr=' + sourceAttrId + ', destAttr=' + attrId + (mappedAttrId !== attrId ? ' -> mapped to: ' + mappedAttrId : ''));
                            // Connect the source to the new layer's mapped attribute
                            try {
                                api.connect(sourceLayerId, sourceAttrId, toId, mappedAttrId, true);
                                console.log('[Convert] ✓ Connected ' + sourceLayerId + '.' + sourceAttrId + ' -> ' + toId + '.' + mappedAttrId);
                                transferred++;
                                
                                // VERIFY: Check if connection actually exists now
                                try {
                                    var verifyConn = api.getInConnection(toId, mappedAttrId);
                                    console.log('[Convert] VERIFY: ' + toId + '.' + mappedAttrId + ' input = ' + (verifyConn || '(empty)'));
                                } catch (eVerify) {
                                    console.log('[Convert] VERIFY failed: ' + (eVerify.message || eVerify));
                                }
                                
                                // Also check what material.colorShaders contains
                                try {
                                    var colorShaders = api.get(toId, 'material.colorShaders');
                                    console.log('[Convert] material.colorShaders value: ' + JSON.stringify(colorShaders));
                                } catch (eGetShaders) {
                                    console.log('[Convert] Could not get material.colorShaders: ' + (eGetShaders.message || eGetShaders));
                                }
                                
                                // Check if shape has fill enabled
                                try {
                                    var hasFill = api.hasFill(toId);
                                    console.log('[Convert] Shape hasFill: ' + hasFill);
                                } catch (eHasFill) {}
                                
                            } catch (eConnect) {
                                console.log('[Convert] ✗ Failed to connect: ' + (eConnect.message || eConnect));
                            }
                        }
                    }
                } catch (eIn) {
                    console.log('[Convert] Error getting incoming connection: ' + (eIn.message || eIn));
                }
            }
        }
    } catch (eInAttrs) {
        console.log('[Convert] Error getting incoming attrs: ' + (eInAttrs.message || eInAttrs));
    }
    
    // Transfer outgoing connections
    // Skip indexed attributes like "filters.0" or "material.colorShaders.0" since:
    // - Children (shaders, filters) are reparented, not reconnected via indexed attrs
    // - basicShape may not have the same indexed structure
    try {
        var outAttrs = api.getOutConnectedAttributes(fromId);
        console.log('[Convert] Found ' + (outAttrs ? outAttrs.length : 0) + ' outgoing connection(s)');
        if (outAttrs && outAttrs.length > 0) {
            for (var j = 0; j < outAttrs.length; j++) {
                var outAttrId = outAttrs[j];
                
                // Skip indexed attributes (like "filters.0", "material.colorShaders.0")
                // These are child layer references that were already reparented
                if (outAttrId && /\.\d+$/.test(outAttrId)) {
                    console.log('[Convert] Skipping indexed attr (children reparented): ' + outAttrId);
                    continue;
                }
                
                try {
                    var outConns = api.getOutConnections(fromId, outAttrId);
                    if (outConns && outConns.length > 0) {
                        for (var k = 0; k < outConns.length; k++) {
                            var outConn = outConns[k];
                            console.log('[Convert] Outgoing: ' + outAttrId + ' -> ' + outConn);
                            // outConn format is "layerId.attrId"
                            // Layer IDs are like "basicShape#123" (contain #, no dots)
                            // Attr IDs can be like "id" or "material.alpha"
                            var outFirstDotIndex = outConn.indexOf('.');
                            if (outFirstDotIndex > 0) {
                                var destLayerId = outConn.substring(0, outFirstDotIndex);
                                var destAttrId = outConn.substring(outFirstDotIndex + 1);
                                console.log('[Convert] Parsed: sourceAttr=' + outAttrId + ', destLayer=' + destLayerId + ', destAttr=' + destAttrId);
                                // Connect the new layer's same attribute to the destination
                                try {
                                    api.connect(toId, outAttrId, destLayerId, destAttrId, true);
                                    console.log('[Convert] ✓ Connected ' + toId + '.' + outAttrId + ' -> ' + destLayerId + '.' + destAttrId);
                                    transferred++;
                                } catch (eConnectOut) {
                                    console.log('[Convert] ✗ Failed to connect outgoing: ' + (eConnectOut.message || eConnectOut));
                                }
                            }
                        }
                    }
                } catch (eOut) {
                    console.log('[Convert] Error getting outgoing connection: ' + (eOut.message || eOut));
                }
            }
        }
    } catch (eOutAttrs) {
        console.log('[Convert] Error getting outgoing attrs: ' + (eOutAttrs.message || eOutAttrs));
    }
    
    return transferred;
}

function convertSelectionToRect(keepOriginalHidden) {
    try {
        var selection = api.getSelection();
        if (!selection || selection.length === 0) { console.error('Select at least one layer'); return; }
        var defStr = defaultRadius;
        var defVal = parseFloat(defStr);
        var converted = 0;
        var connectionsTransferred = 0;
        for (var i = 0; i < selection.length; i++) {
            var layerId = selection[i]; if (!api.layerExists(layerId)) continue;
            var bbox = null; try { bbox = api.getBoundingBox(layerId, true); } catch (eBB) { bbox = null; }
            if (!bbox || !bbox.width || !bbox.height) continue;
            var name = null; try { name = api.getNiceName(layerId); } catch (eNm) { name = null; }
            if (!name) name = 'Converted Shape';
            var isCircle = Math.abs((bbox.width||0) - (bbox.height||0)) < 0.5 && (!isNaN(defVal) && defVal >= (bbox.width/2 - 0.5));
            var prim = isCircle ? 'ellipse' : 'rectangle';
            var newId = null; try { newId = api.primitive(prim, name + (isCircle?' (Circle)':' (Rect)')); } catch (eCr) { newId = null; }
            if (!newId) continue;
            try {
                if (isCircle) {
                    api.set(newId, { 'generator.radius': [bbox.width/2, bbox.height/2], 'position.x': bbox.centre.x, 'position.y': bbox.centre.y });
                } else {
                    api.set(newId, { 'generator.dimensions': [bbox.width, bbox.height], 'position.x': bbox.centre.x, 'position.y': bbox.centre.y });
                    if (!isNaN(defVal) && defVal > 0) { try { api.set(newId, { 'generator.cornerRadius': defVal }); } catch (eCR) {} }
                }
            } catch (eSet) {}
            _copyBasicStyles(layerId, newId);
            try {
                var parentId = api.getParent(layerId); if (parentId) api.parent(newId, parentId);
                var rot = api.get(layerId, 'rotation'); if (typeof rot === 'number') api.set(newId, { 'rotation': rot });
                var sx = api.get(layerId, 'scale.x'); var sy = api.get(layerId, 'scale.y');
                var scaleSet = {}; if (typeof sx==='number') scaleSet['scale.x']=sx; if (typeof sy==='number') scaleSet['scale.y']=sy; if (Object.keys(scaleSet).length) api.set(newId, scaleSet);
            } catch (eTr) {}
            
            // FIRST: Reparent any children (shaders, effects, etc.) to the new shape
            // This must happen BEFORE transferring connections so shaders are in place
            // Cavalry API: api.getChildren(layerId) returns array of child layer IDs
            // Cavalry API: api.parent(layerId, newParentId) assigns new parent
            try {
                var children = api.getChildren(layerId);
                console.log('[Convert] Found ' + (children ? children.length : 0) + ' children to reparent');
                if (children && children.length > 0) {
                    for (var c = 0; c < children.length; c++) {
                        var childId = children[c];
                        var childName = '';
                        var childType = '';
                        try { childName = api.getNiceName(childId); } catch (e) { childName = childId; }
                        try { childType = api.getNodeType(childId); } catch (e) { childType = 'unknown'; }
                        try {
                            api.parent(childId, newId);
                            console.log('[Convert] ✓ Reparented child: ' + childName + ' (type: ' + childType + ', id: ' + childId + ')');
                        } catch (eReparent) {
                            console.log('[Convert] ✗ Failed to reparent: ' + childName + ' - ' + (eReparent.message || eReparent));
                        }
                    }
                }
                // Verify new shape's children after reparenting
                try {
                    var newChildren = api.getChildren(newId);
                    console.log('[Convert] New shape now has ' + (newChildren ? newChildren.length : 0) + ' children');
                    if (newChildren && newChildren.length > 0) {
                        for (var nc = 0; nc < newChildren.length; nc++) {
                            var ncName = ''; try { ncName = api.getNiceName(newChildren[nc]); } catch(e) { ncName = newChildren[nc]; }
                            console.log('[Convert]   - Child: ' + ncName + ' (' + newChildren[nc] + ')');
                        }
                    }
                } catch (eNewChildren) {}
            } catch (eChildren) {
                console.log('[Convert] Error getting children: ' + (eChildren.message || eChildren));
            }
            
            // SECOND: Transfer all incoming and outgoing connections to the new shape
            // This happens after reparenting so shaders are already children of new shape
            try {
                connectionsTransferred += _transferConnections(layerId, newId);
            } catch (eTransfer) {}
            
            try {
                if (keepOriginalHidden) { api.set(layerId, { 'hidden': true }); }
                else { api.deleteLayer(layerId); }
            } catch (eDel) {}
            converted++;
        }
        var msg = converted > 0 ? ('Converted ' + converted + ' layer(s)') : 'No valid layers';
        if (connectionsTransferred > 0) msg += ' (' + connectionsTransferred + ' connection(s) transferred)';
        console.info(msg);
    } catch (e) { 
        var errorMsg = e && e.message ? e.message : 'An error occurred';
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
    }
}