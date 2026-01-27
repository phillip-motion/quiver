function importNode(node, parentId, vb, inheritedTranslate, stats, model, inHiddenDefs, inheritedScale, parentMatrix) {
    inheritedTranslate = inheritedTranslate || {x:0,y:0};
    inheritedScale = inheritedScale || {x:1,y:1};
    parentMatrix = parentMatrix || null;
    inHiddenDefs = !!inHiddenDefs;
    var nodeT = parseTranslate(node.attrs && node.attrs.transform);

    if (node.type === 'g' || node.type === 'svg' || node.type === 'root') {
        // Skip empty groups (no children)
        if (node.type === 'g' && (!node.children || node.children.length === 0)) {
            return null;
        }
        
        // Skip groups with data-figma-skip-parse="true" (Figma gradient simulation workaround groups)
        // These groups contain foreignObject elements used to render angular/diamond gradients
        // Since we parse data-figma-gradient-fill directly, we don't need these simulation groups
        if (node.type === 'g' && node.attrs && node.attrs['data-figma-skip-parse'] === 'true') {
            return null;
        }
        
        var rawGroupName = decodeEntitiesForName(node.name || 'group');
        
        // Number anonymous groups for better naming
        var groupName = rawGroupName;
        if (node.type === 'g' && (rawGroupName === 'g' || rawGroupName === 'group')) {
            __groupCounter++;
            groupName = 'Group ' + __groupCounter;
        }
        
        // Extract scale and full matrix from this group's transform
        var groupScale = {x: 1, y: 1};
        var groupMatrix = null;
        if (node.attrs && node.attrs.transform) {
            groupMatrix = parseTransformMatrixList(node.attrs.transform);
            var decomposed = decomposeMatrix(groupMatrix);
            groupScale.x = decomposed.scaleX;
            groupScale.y = decomposed.scaleY;
        }
        
        // Combine with inherited scale
        var combinedScale = {
            x: inheritedScale.x * groupScale.x,
            y: inheritedScale.y * groupScale.y
        };
        
        var gid = parentId;
        // Optionally flatten anonymous wrapper <g> layers (often named just "g") with no transform/style
        if (node.type === 'g') {
            var tStrG = node.attrs && node.attrs.transform || '';
            var rotG = getRotationDegFromTransform(tStrG);
            var tXYG = parseTranslate(tStrG);
            var hasStyleG = !!(node.attrs && (node.attrs.fill || node.attrs.stroke || node.attrs.opacity || node.attrs['fill-opacity'] || node.attrs['stroke-opacity'] || node.attrs.style));
            var isAnonG = (groupName === 'g');
            var inheritedFilterForFlatten = (function(){
                try {
                    var fidLocal = extractUrlRefId(node.attrs && node.attrs.filter);
                    if (!fidLocal && node.attrs && node.attrs._inheritedFilterId) fidLocal = node.attrs._inheritedFilterId;
                    return fidLocal || null;
                } catch (e) { return null; }
            })();
            if (isAnonG && Math.abs(rotG) < 0.0001 && Math.abs(tXYG.x) < 0.0001 && Math.abs(tXYG.y) < 0.0001 && !hasStyleG) {
                // Choose a single target child to receive the inherited filter when flattening
                var chosenChildIndex = null;
                if (inheritedFilterForFlatten) {
                    // Prefer direct geometry child; else pass to first group child
                    for (var ci = 0; ci < node.children.length; ci++) {
                        var ch = node.children[ci];
                        var tCh = ch.type;
                        var isGeomCh = (tCh==='path'||tCh==='rect'||tCh==='circle'||tCh==='ellipse'||tCh==='text'||tCh==='polygon'||tCh==='polyline'||tCh==='line');
                        if (isGeomCh) { chosenChildIndex = ci; break; }
                    }
                    if (chosenChildIndex === null) {
                        for (var cj = 0; cj < node.children.length; cj++) { if (node.children[cj].type === 'g') { chosenChildIndex = cj; break; } }
                    }
                }
                for (var fi = 0; fi < node.children.length; fi++) {
                    if (inheritedFilterForFlatten && fi === chosenChildIndex) {
                        if (!node.children[fi].attrs) node.children[fi].attrs = {};
                        if (!node.children[fi].attrs.filter) node.children[fi].attrs._inheritedFilterId = inheritedFilterForFlatten;
                    }
                    importNode(node.children[fi], parentId, vb, {x:0,y:0}, stats, model, false, inheritedScale, parentMatrix);
                }
                return parentId;
            }
        }
        
        // Optimize blend mode application for single-child groups
        // If a group has a blend mode and only one child, apply the blend mode directly to the child
        // and skip creating the wrapper group
        if (node.type === 'g' && node.children && node.children.length === 1) {
            var hasBlendMode = false;
            if (node.attrs) {
                hasBlendMode = !!(node.attrs['mix-blend-mode'] || 
                                 (node.attrs.style && extractStyleProperty(node.attrs.style, 'mix-blend-mode')));
            }
            
            if (hasBlendMode) {
                // Transfer blend mode attributes to the single child
                var singleChild = node.children[0];
                if (!singleChild.attrs) singleChild.attrs = {};
                
                // Copy blend mode attribute
                if (node.attrs['mix-blend-mode']) {
                    singleChild.attrs['mix-blend-mode'] = node.attrs['mix-blend-mode'];
                }
                
                // Copy blend mode from style if present
                if (node.attrs.style) {
                    var blendModeFromStyle = extractStyleProperty(node.attrs.style, 'mix-blend-mode');
                    if (blendModeFromStyle) {
                        if (!singleChild.attrs.style) singleChild.attrs.style = '';
                        // Add to child's style if not already present
                        if (!singleChild.attrs['mix-blend-mode'] && !extractStyleProperty(singleChild.attrs.style, 'mix-blend-mode')) {
                            singleChild.attrs.style = (singleChild.attrs.style ? singleChild.attrs.style + '; ' : '') + 'mix-blend-mode: ' + blendModeFromStyle;
                        }
                    }
                }
                
                // Also transfer opacity if present on the group
                if (node.attrs.opacity && !singleChild.attrs.opacity) {
                    singleChild.attrs.opacity = node.attrs.opacity;
                }
                
                // Transfer background blur attribute if present on the group
                if (node.attrs['data-figma-bg-blur-radius'] && !singleChild.attrs['data-figma-bg-blur-radius']) {
                    singleChild.attrs['data-figma-bg-blur-radius'] = node.attrs['data-figma-bg-blur-radius'];
                }
                
                // Transfer filter attribute if present on the group (for layer blur, etc.)
                var groupFilterId = extractUrlRefId(node.attrs.filter);
                if (!groupFilterId && node.attrs._inheritedFilterId) {
                    groupFilterId = node.attrs._inheritedFilterId;
                }
                if (groupFilterId && !singleChild.attrs.filter && !singleChild.attrs._inheritedFilterId) {
                    singleChild.attrs._inheritedFilterId = groupFilterId;
                }
                
                // Transfer inherited masks to the child (nested clip intersection)
                var parentMasks = node.attrs._inheritedMaskIds || [];
                var groupClipPath = extractUrlRefId(node.attrs.mask) || extractUrlRefId(node.attrs['clip-path']);
                
                // Build full mask list: parent masks + this group's own mask
                var allMasks = parentMasks.slice(); // clone
                if (groupClipPath) {
                    allMasks.push(groupClipPath);
                }
                
                if (allMasks.length > 0) {
                    if (!singleChild.attrs._inheritedMaskIds) {
                        singleChild.attrs._inheritedMaskIds = [];
                    }
                    // Merge masks (avoid duplicates)
                    for (var mIdx = 0; mIdx < allMasks.length; mIdx++) {
                        if (singleChild.attrs._inheritedMaskIds.indexOf(allMasks[mIdx]) === -1) {
                            singleChild.attrs._inheritedMaskIds.push(allMasks[mIdx]);
                        }
                    }
                }
                
                // Transfer parent name if child has no meaningful name
                var childName = (singleChild.name || '').toLowerCase();
                var parentName = node.name || '';
                var genericNames = ['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', ''];
                var hasGenericChildName = genericNames.indexOf(childName) !== -1;
                var parentNameIsGeneric = parentName === 'g' || parentName === 'group' || parentName === '';
                
                if (hasGenericChildName && !parentNameIsGeneric) {
                    // Transfer the parent's meaningful name to the child
                    singleChild.name = parentName;
                }
                
                // Import the child directly under the parent, skipping the group wrapper
                importNode(singleChild, parentId, vb, inheritedTranslate, stats, model, inHiddenDefs, inheritedScale, parentMatrix);
                return parentId;
            }
        }
        
        // STYLED TEXT GROUP DETECTION:
        // Figma exports text with mixed styling (bold + regular) as a group containing multiple <text> elements.
        // If we have Figma textData for this group, create ONE text shape from the Figma data
        // instead of multiple text shapes from the SVG <text> elements.
        if (node.type === 'g' && node.children && node.children.length > 0) {
            // Check if ALL children are text elements
            var allChildrenAreText = true;
            for (var tci = 0; tci < node.children.length; tci++) {
                if (node.children[tci].type !== 'text') {
                    allChildrenAreText = false;
                    break;
                }
            }
            
            if (allChildrenAreText && typeof getFigmaTextData === 'function') {
                // Try to find Figma textData for this group's name
                var figmaTextForGroup = getFigmaTextData(rawGroupName);
                
                if (figmaTextForGroup && figmaTextForGroup.characters) {
                    
                    // Extract fills from the SVG text children for multi-fill support
                    // Figma exports multiple <text> elements with the same geometry but different fills
                    // After multi-fill optimization, additional fills are stored in _additionalFills
                    var textFills = [];
                    var seenFills = {};
                    for (var fci = 0; fci < node.children.length; fci++) {
                        var textChild = node.children[fci];
                        
                        // Get primary fill from this child
                        var childFill = textChild.attrs && textChild.attrs.fill;
                        var childOpacity = parseFloat(textChild.attrs && textChild.attrs['fill-opacity']) || 1;
                        if (childFill && childFill !== 'none' && !seenFills[childFill]) {
                            seenFills[childFill] = true;
                            textFills.push({color: childFill, opacity: childOpacity});
                        }
                        
                        // Check for additional fills from multi-fill optimization
                        if (textChild.attrs && textChild.attrs._additionalFills) {
                            var addFills = textChild.attrs._additionalFills;
                            for (var afi = 0; afi < addFills.length; afi++) {
                                var addFill = addFills[afi].fill;
                                var addOpacity = parseFloat(addFills[afi].fillOpacity) || 1;
                                if (addFill && addFill !== 'none' && !seenFills[addFill]) {
                                    seenFills[addFill] = true;
                                    textFills.push({color: addFill, opacity: addOpacity});
                                }
                            }
                        }
                    }
                    
                    // Create text shape from Figma data, passing extracted fills
                    // Also pass ALL SVG text children so we can analyze their tspans/Y positions for line spacing
                    // For multi-line right-aligned text, lines may be in separate <text> elements
                    var svgTextChildren = [];
                    for (var sti = 0; sti < node.children.length; sti++) {
                        if (node.children[sti].type === 'text' && node.children[sti].tspans && node.children[sti].tspans.length > 0) {
                            svgTextChildren.push(node.children[sti]);
                        }
                    }
                    var styledTextId = createTextFromFigmaData(figmaTextForGroup, parentId, vb, inheritedScale, textFills, svgTextChildren);
                    
                    if (styledTextId) {
                        _registerChild(parentId, styledTextId);
                        
                        // Apply masks if inherited
                        try {
                            var styledMaskIds = node.attrs && node.attrs._inheritedMaskIds || [];
                            var ownStyledMask = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
                            if (ownStyledMask) styledMaskIds = styledMaskIds.concat([ownStyledMask]);
                            for (var smi = 0; smi < styledMaskIds.length; smi++) {
                                createMaskShapeForTarget(styledMaskIds[smi], styledTextId, parentId, vb, model);
                            }
                        } catch (eStyledMask) {}
                        
                        // Apply blend mode from group or text children
                        // Figma may put the blend mode on the text element itself, not the wrapper group
                        var blendModeApplied = false;
                        
                        // First try the group attrs
                        var groupBlendMode = node.attrs && (node.attrs['mix-blend-mode'] || 
                            (node.attrs.style && extractStyleProperty(node.attrs.style, 'mix-blend-mode')));
                        if (groupBlendMode && groupBlendMode !== 'normal') {
                            applyBlendMode(styledTextId, node.attrs);
                            blendModeApplied = true;
                        }
                        
                        // If no blend mode on group, check text children
                        if (!blendModeApplied && node.children && node.children.length > 0) {
                            for (var bmIdx = 0; bmIdx < node.children.length && !blendModeApplied; bmIdx++) {
                                var bmChild = node.children[bmIdx];
                                if (bmChild.type === 'text' && bmChild.attrs) {
                                    var childBlendMode = bmChild.attrs['mix-blend-mode'] ||
                                        (bmChild.attrs.style && extractStyleProperty(bmChild.attrs.style, 'mix-blend-mode'));
                                    if (childBlendMode && childBlendMode !== 'normal') {
                                        applyBlendMode(styledTextId, bmChild.attrs);
                                        blendModeApplied = true;
                                    }
                                }
                            }
                        }
                        
                        // Apply filters (drop shadows, inner shadows, blur) from group, inherited, or text children
                        try {
                            var fIdStyled = extractUrlRefId(node.attrs && node.attrs.filter);
                            if (!fIdStyled && node.attrs && node.attrs._inheritedFilterId) fIdStyled = node.attrs._inheritedFilterId;
                            
                            // Also check text children for filters (Figma may put drop shadow on the text element itself)
                            if (!fIdStyled && node.children && node.children.length > 0) {
                                for (var fcIdx = 0; fcIdx < node.children.length && !fIdStyled; fcIdx++) {
                                    var filterChild = node.children[fcIdx];
                                    if (filterChild.type === 'text' && filterChild.attrs) {
                                        var childFilterId = extractUrlRefId(filterChild.attrs.filter);
                                        if (!childFilterId) childFilterId = filterChild.attrs._inheritedFilterId;
                                        if (childFilterId) {
                                            fIdStyled = childFilterId;
                                        }
                                    }
                                }
                            }
                            
                            
                            if (fIdStyled && __svgFilterMap && __svgFilterMap[fIdStyled]) {
                                
                                // Check for drop shadows
                                var passesStyled = detectShadowPasses(__svgFilterMap[fIdStyled]);
                                for (var pStyled = 0; pStyled < passesStyled.length; pStyled++) {
                                    createAndAttachDropShadow(styledTextId, passesStyled[pStyled]);
                                }
                                
                                // Check for inner shadows
                                var innerPassesStyled = detectInnerShadowPasses(__svgFilterMap[fIdStyled]);
                                for (var inpStyled = 0; inpStyled < innerPassesStyled.length; inpStyled++) {
                                    createAndAttachInnerShadow(styledTextId, innerPassesStyled[inpStyled]);
                                }
                                
                                // Check for blur
                                var blurAmtStyled = detectBlurAmount(__svgFilterMap[fIdStyled]);
                                if (blurAmtStyled !== null) {
                                    createAndAttachBlur(styledTextId, blurAmtStyled);
                                }
                            } else if (fIdStyled) {
                            } else {
                            }
                        } catch (eStyledFilter) {
                            console.warn('[Styled Text] Error applying filters: ' + (eStyledFilter.message || eStyledFilter));
                        }
                        
                        if (stats) stats.texts = (stats.texts || 0) + 1;
                        
                        // Skip processing children - we've handled this group as a single styled text
                        return styledTextId;
                    }
                }
            }
        }
        
        if (node.type !== 'svg') {
            // Always create groups during import to preserve correct layer order
            // If importGroupsEnabled is false, we'll flatten AFTER import completes
            gid = createGroup(groupName, parentId);
            _registerChild(parentId, gid); // Register group as child for sibling lookups (e.g., background blur)
            if (stats) stats.groups = (stats.groups || 0) + 1;
            applyBlendMode(gid, node.attrs);
        }
        // Propagate filter from this group to children if present
        var inheritedFilterId = extractUrlRefId(node.attrs && node.attrs.filter);
        if (!inheritedFilterId && node.attrs && node.attrs._inheritedFilterId) inheritedFilterId = node.attrs._inheritedFilterId;
        
        // Only set group position/rotation if there's NO matrix transform
        // If groupMatrix exists, the full transform (position + rotation) is applied to children
        if (!groupMatrix) {
            // Apply rotation from transform to group
            var rotDeg = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
            if (Math.abs(rotDeg) > 0.0001 && gid != null) {
                api.set(gid, {"rotation": -rotDeg});
            }
            
            // Apply position
            if ((nodeT.x !== 0 || nodeT.y !== 0) && node.type !== 'root') {
                var zero = svgToCavalryPosition(0, 0, vb);
                var moved = svgToCavalryPosition(nodeT.x, nodeT.y, vb);
                api.set(gid, {"position.x": moved.x - zero.x, "position.y": moved.y - zero.y});
            }
        }
        // If this group has a filter, only propagate to children that don't have their own filter AND are likely to be the target:
        // Heuristic: prefer geometry-bearing leaves (path/rect/circle/ellipse/text) and only the first such child if siblings exist.
        var childTargets = node.children.slice();
        if (inheritedFilterId) {
            var geomIdxs = [];
            for (var gi2 = 0; gi2 < childTargets.length; gi2++) {
                var ct = childTargets[gi2];
                var t = ct.type;
                var isGeom = (t==='path'||t==='rect'||t==='circle'||t==='ellipse'||t==='text'||t==='polygon'||t==='polyline'||t==='line'||t==='image');
                if (isGeom) geomIdxs.push(gi2);
            }
            // Choose target among direct geometry children first (prefer a path named 'path' if present)
            var chosenIdx = null;
            for (var gi3 = 0; gi3 < geomIdxs.length; gi3++) {
                var idx = geomIdxs[gi3];
                var nm = (childTargets[idx].name||'')+'';
                if (/editableShape#\d+/i.test(nm)) { chosenIdx = idx; break; }
                if (nm === 'path') { chosenIdx = idx; break; }
            }
            if (chosenIdx === null && geomIdxs.length>0) chosenIdx = geomIdxs[0];

            // If no direct geometry child exists, pass filter down to the most likely wrapper group (clip-path wrapper if present)
            if (chosenIdx === null) {
                var wrapperIdx = null;
                // prefer a single 'g' that has clip-path attribute
                for (var wi = 0; wi < childTargets.length; wi++) {
                    var ctw = childTargets[wi];
                    if (ctw.type === 'g' && ctw.attrs && (ctw.attrs['clip-path'] || ctw.attrs.clipPath)) { wrapperIdx = wi; break; }
                }
                if (wrapperIdx === null) {
                    // fallback to first group child if unique
                    for (var wj = 0; wj < childTargets.length; wj++) {
                        if (childTargets[wj].type === 'g') { wrapperIdx = wj; break; }
                    }
                }
                if (wrapperIdx !== null) chosenIdx = wrapperIdx;
            }

            for (var ci2 = 0; ci2 < childTargets.length; ci2++) {
                var chN = childTargets[ci2];
                if (!chN.attrs) chN.attrs = {};
                var hasOwnFilter = !!extractUrlRefId(chN.attrs.filter);
                if (!hasOwnFilter && ci2 === chosenIdx) {
                    chN.attrs._inheritedFilterId = inheritedFilterId;
                }
            }
        }
        
        // Propagate background blur attribute from group to geometry children
        var groupBgBlur = node.attrs && node.attrs['data-figma-bg-blur-radius'];
        if (groupBgBlur) {
            // Find the first geometry child to apply blur to
            for (var blurIdx = 0; blurIdx < childTargets.length; blurIdx++) {
                var blurChild = childTargets[blurIdx];
                var blurType = blurChild.type;
                var isBlurGeom = (blurType==='path'||blurType==='rect'||blurType==='circle'||blurType==='ellipse'||blurType==='polygon'||blurType==='polyline');
                if (isBlurGeom && !blurChild.attrs['data-figma-bg-blur-radius']) {
                    if (!blurChild.attrs) blurChild.attrs = {};
                    blurChild.attrs['data-figma-bg-blur-radius'] = groupBgBlur;
                    break; // Only apply to first geometry child
                }
            }
        }
        // Propagate mask/clip-path from this group to children if present (similar to filters)
        // NESTED CLIPS: Use _inheritedMaskIds array to accumulate multiple masks
        var groupName = node.attrs && node.attrs.id || node.name || 'unnamed';
        var ownMaskId = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
        
        // Build array of all masks to propagate (parent masks + this group's mask)
        var parentMaskIds = (node.attrs && node.attrs._inheritedMaskIds) || [];
        
        // Combine: parent masks first, then this group's mask (order matters for intersection)
        var masksToPropagate = parentMaskIds.slice(); // clone array
        if (ownMaskId) {
            masksToPropagate.push(ownMaskId);
        }
        
        // Log all children for debugging
        for (var dbgC = 0; dbgC < childTargets.length; dbgC++) {
            var dbgChild = childTargets[dbgC];
        }
        
        if (masksToPropagate.length > 0) {
            // Propagate ALL masks to all direct children
            for (var mi = 0; mi < childTargets.length; mi++) {
                var chM = childTargets[mi];
                if (!chM.attrs) chM.attrs = {};
                
                // Check if child has own mask - if so, child will add it to the array when processing
                var childOwnMask = extractUrlRefId(chM.attrs.mask) || extractUrlRefId(chM.attrs['clip-path']);
                
                // Always propagate parent masks (nested intersection)
                chM.attrs._inheritedMaskIds = masksToPropagate.slice(); // clone array
                
                if (childOwnMask) {
                } else {
                }
            }
        } else {
        }
        
        // Propagate group opacity to children (Figma applies opacity to groups, not children)
        // This must be inherited AND multiplied with any existing opacity
        var groupOpacity = parseFloat(node.attrs && node.attrs.opacity);
        var inheritedOpacity = parseFloat(node.attrs && node.attrs._inheritedOpacity);
        if (isNaN(groupOpacity)) groupOpacity = 1;
        if (isNaN(inheritedOpacity)) inheritedOpacity = 1;
        var effectiveGroupOpacity = groupOpacity * inheritedOpacity;
        
        // Only propagate if opacity is less than 1 (something to inherit)
        if (effectiveGroupOpacity < 0.999) {
            for (var oi = 0; oi < childTargets.length; oi++) {
                var chO = childTargets[oi];
                if (!chO.attrs) chO.attrs = {};
                // Store inherited opacity for children to use
                chO.attrs._inheritedOpacity = effectiveGroupOpacity;
            }
        }
        
        // Compose parent matrix with this group's matrix for nested transforms
        var composedMatrix = groupMatrix;
        if (parentMatrix && groupMatrix) {
            // Multiply parent matrix by this group's matrix
            composedMatrix = _matMultiply(parentMatrix, groupMatrix);
        } else if (parentMatrix && !groupMatrix) {
            composedMatrix = parentMatrix;
        }
        
        for (var i = 0; i < node.children.length; i++) {
            importNode(node.children[i], gid, vb, {x:0,y:0}, stats, model, false, combinedScale, composedMatrix);
        }
        return gid;
    }
    if (node.type === 'clipPath' || node.type === 'mask' || node.type === 'defs') {
        // Do not create visible groups or children for defs/masks/clipPaths. Preserve only in model for future use.
        for (var i2 = 0; i2 < node.children.length; i2++) {
            importNode(node.children[i2], parentId, vb, {x:0,y:0}, stats, model, true, inheritedScale, parentMatrix);
        }
        return null;
    }

    if (inHiddenDefs) {
        return null;
    }

    if (node.type === 'rect') {
        // Skip gradient simulation helper shapes
        // These are unnamed rects whose fill references Figma's diamond/angular gradient simulation IDs
        // The actual user shape with data-figma-gradient-fill will handle the gradient natively
        var rectFill = node.attrs && node.attrs.fill;
        var hasFigmaGradientData = !!(node.attrs && node.attrs['data-figma-gradient-fill']);
        var isGenericName = (node.name === 'rect' || !node.name);
        if (rectFill && !hasFigmaGradientData && isGenericName) {
            var fillIdMatch = /url\(#([^)]+)\)/.exec(rectFill);
            if (fillIdMatch) {
                var fillId = fillIdMatch[1].toLowerCase();
                if (fillId.indexOf('_diamond_') !== -1 || fillId.indexOf('_angular_') !== -1) {
                    return null;
                }
            }
        }
        
        // Apply inherited translate to x/y before creation
        var clone = JSON.parse(JSON.stringify(node));
        var x = parseFloat(clone.attrs.x || '0');
        var y = parseFloat(clone.attrs.y || '0');
        var w = parseFloat(clone.attrs.width || '0');
        var h = parseFloat(clone.attrs.height || '0');
        
        // Debug logging for rect positioning
        var rectName = node.name || 'unnamed rect';
        
        // Apply parent matrix if it exists (inherited from parent group transform)
        if (parentMatrix) {
            // Transform all four corners to handle rotation/scale correctly
            var tl = {x: parentMatrix.a * x + parentMatrix.c * y + parentMatrix.e,
                      y: parentMatrix.b * x + parentMatrix.d * y + parentMatrix.f};
            var tr = {x: parentMatrix.a * (x+w) + parentMatrix.c * y + parentMatrix.e,
                      y: parentMatrix.b * (x+w) + parentMatrix.d * y + parentMatrix.f};
            var bl = {x: parentMatrix.a * x + parentMatrix.c * (y+h) + parentMatrix.e,
                      y: parentMatrix.b * x + parentMatrix.d * (y+h) + parentMatrix.f};
            var br = {x: parentMatrix.a * (x+w) + parentMatrix.c * (y+h) + parentMatrix.e,
                      y: parentMatrix.b * (x+w) + parentMatrix.d * (y+h) + parentMatrix.f};
            
            // Find the bounding box of the transformed corners
            var minXP = Math.min(tl.x, tr.x, bl.x, br.x);
            var maxXP = Math.max(tl.x, tr.x, bl.x, br.x);
            var minYP = Math.min(tl.y, tr.y, bl.y, br.y);
            var maxYP = Math.max(tl.y, tr.y, bl.y, br.y);
            
            clone.attrs.x = minXP.toString();
            clone.attrs.y = minYP.toString();
            clone.attrs.width = (maxXP - minXP).toString();
            clone.attrs.height = (maxYP - minYP).toString();
            // Clear transform to prevent double-application in createRect
            delete clone.attrs.transform;
        } else if (node.attrs && node.attrs.transform) {
            // Check if transform contains non-trivial operations (rotation, scale, skew, or matrix)
            // If so, use full matrix approach to compute the correct center position
            var transformStr = node.attrs.transform;
            var hasMatrix = transformStr.indexOf('matrix') !== -1;
            var hasRotate = transformStr.indexOf('rotate') !== -1;
            var hasScale = transformStr.indexOf('scale') !== -1;
            var hasSkew = transformStr.indexOf('skew') !== -1;
            var needsMatrixApproach = hasMatrix || hasRotate || hasScale || hasSkew;
            
            if (needsMatrixApproach) {
                // Parse the full transform as a matrix and decompose it
                var fullMatrix = parseTransformMatrixList(transformStr);
                var decomposed = decomposeMatrix(fullMatrix);
                var rotationDeg = decomposed.rotationDeg || 0;
                
                
                // Calculate the center of the original rect
                var centerX = x + w / 2;
                var centerY = y + h / 2;
                
                // Transform the center point through the full matrix to get final position
                var transformedCenterX = fullMatrix.a * centerX + fullMatrix.c * centerY + fullMatrix.e;
                var transformedCenterY = fullMatrix.b * centerX + fullMatrix.d * centerY + fullMatrix.f;
                
                // Keep original width/height (not bounding box)
                clone.attrs.width = w.toString();
                clone.attrs.height = h.toString();
                
                // Store rotation for application in createRect
                clone.attrs._rotationDeg = rotationDeg;
                
                // Position will be set based on transformed center
                clone.attrs._transformedCenterX = transformedCenterX + inheritedTranslate.x;
                clone.attrs._transformedCenterY = transformedCenterY + inheritedTranslate.y;
                
                // Set x/y for now (createRect will recalculate based on center)
                clone.attrs.x = (transformedCenterX - w / 2 + inheritedTranslate.x).toString();
                clone.attrs.y = (transformedCenterY - h / 2 + inheritedTranslate.y).toString();
                
                // Store the LOCAL center (before transformation) for gradient offset calculation
                // Gradient coordinates in Figma's SVG export are in local/pre-transform space
                clone.attrs._localCenterX = x + w / 2;
                clone.attrs._localCenterY = y + h / 2;
                
                // Store scaleY for gradient flip detection
                // When scaleY is negative, the gradient direction needs to be reversed
                clone.attrs._scaleY = decomposed.scaleY;
                
                // Clear transform to prevent double-application in createRect
                delete clone.attrs.transform;
            } else {
                // Pure translation only - use simple translation
                clone.attrs.x = (x + nodeT.x + inheritedTranslate.x).toString();
                clone.attrs.y = (y + nodeT.y + inheritedTranslate.y).toString();
                // Store the LOCAL center (before translation) for gradient offset calculation
                // Gradient coordinates in Figma's SVG export are in local/pre-transform space
                clone.attrs._localCenterX = x + w / 2;
                clone.attrs._localCenterY = y + h / 2;
                // Clear translate from transform to prevent double-application in createRect
                if (clone.attrs.transform && (nodeT.x !== 0 || nodeT.y !== 0)) {
                    clone.attrs.transform = clone.attrs.transform.replace(/translate\([^)]*\)\s*/g, '').trim();
                    if (clone.attrs.transform === '') delete clone.attrs.transform;
                }
            }
        } else {
            // No transform at all
            clone.attrs.x = (x + inheritedTranslate.x).toString();
            clone.attrs.y = (y + inheritedTranslate.y).toString();
            // Store the LOCAL center for gradient offset calculation
            clone.attrs._localCenterX = x + w / 2;
            clone.attrs._localCenterY = y + h / 2;
        }
        
        
        var rid = createRect(clone, parentId, vb);
        _registerChild(parentId, rid);
        // DropShadow: if this node has filter url(#id) attach passes now
        try {
            var fId = extractUrlRefId(node.attrs && node.attrs.filter);
            if (!fId && node.attrs && node.attrs._inheritedFilterId) fId = node.attrs._inheritedFilterId;
            // If multiple siblings exist and this node name doesn't match editableShape#, only attach if no sibling has it
            if (fId && __svgFilterMap && __svgFilterMap[fId]) {
                var siblings = __groupDirectChildren[parentId] || [];
                var nameMatches = ((node.name||'')+'').match(/editableShape#\d+/i);
                if (!nameMatches && siblings.length > 0) {
                    var hasEditableNamed = false;
                    for (var si0 = 0; si0 < siblings.length; si0++) {
                        try {
                            var n0 = api.getName(siblings[si0]) || '';
                            if (/editableShape#\d+/i.test(n0)) { hasEditableNamed = true; break; }
                        } catch (eGN) {}
                    }
                    if (hasEditableNamed) {
                        // Skip attaching to this rect; editableShape sibling will receive it
                        fId = null;
                    }
                }
            }
            if (fId && __svgFilterMap && __svgFilterMap[fId]) {
                // Check for drop shadows
                var passes = detectShadowPasses(__svgFilterMap[fId]);
                
                for (var pi = 0; pi < passes.length; pi++) {
                    
                    createAndAttachDropShadow(rid, passes[pi]);
                }
                
                // Check for inner shadows
                var innerPasses = detectInnerShadowPasses(__svgFilterMap[fId]);
                for (var ipi = 0; ipi < innerPasses.length; ipi++) {
                    createAndAttachInnerShadow(rid, innerPasses[ipi], ipi, innerPasses.length);
                }
                
                // Check for blur
                var blurAmount = detectBlurAmount(__svgFilterMap[fId]);
                if (blurAmount !== null) {
                    
                    createAndAttachBlur(rid, blurAmount);
                }
            } else {  }
        } catch (eDs) {  }
        
        // Check for Figma Background Blur (frosted glass effect)
        // Figma exports this as data-figma-bg-blur-radius attribute
        // Queue for deferred processing so we can find underlying siblings
        try {
            var bgBlurRadius = node.attrs && node.attrs['data-figma-bg-blur-radius'];
            if (bgBlurRadius) {
                var bgBlurAmount = parseFloat(bgBlurRadius);
                if (!isNaN(bgBlurAmount) && bgBlurAmount > 0) {
                    queueBackgroundBlur(rid, bgBlurAmount, parentId);
                }
            }
        } catch (eBgBlur) {
            console.warn('[Background Blur] Error processing rect: ' + eBgBlur.message);
        }
        // Mask/Clip: apply ALL masks (nested clip intersection)
        try {
            var allMaskIds = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
            var ownMask = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
            if (ownMask && allMaskIds.indexOf(ownMask) === -1) {
                allMaskIds.push(ownMask);
            }
            
            // Build geometry for redundancy check
            var svgGeometry = {
                x: x,  // Original x before nodeT transform
                y: y,  // Original y before nodeT transform
                width: w,
                height: h
            };
            
            // Apply all inherited masks - Clipping Masks naturally intersect
            if (allMaskIds.length > 0) {
                for (var mri = 0; mri < allMaskIds.length; mri++) {
                    createMaskShapeForTarget(allMaskIds[mri], rid, parentId, vb, model, svgGeometry);
                }
                if (allMaskIds.length > 1) {
                }
            }
        } catch (eMask) {  }
        var rotDegR = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegR) > 0.0001) api.set(rid, {"rotation": -rotDegR});
        if (stats) stats.rects = (stats.rects || 0) + 1;
        return rid;
    }
    if (node.type === 'circle') {
        var cloneC = JSON.parse(JSON.stringify(node));
        var cxCircle = parseFloat(cloneC.attrs.cx || '0');
        var cyCircle = parseFloat(cloneC.attrs.cy || '0');
        
        // Check if we have a matrix transform
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply the full matrix transform to the center point
            var transformed = applyMatrixToPoint(node.attrs.transform, cxCircle, cyCircle);
            cloneC.attrs.cx = (transformed.x + inheritedTranslate.x).toString();
            cloneC.attrs.cy = (transformed.y + inheritedTranslate.y).toString();
            
            // Store the LOCAL center (before transformation) for gradient offset calculation
            // Gradient coordinates in Figma's SVG export are in local/pre-transform space
            cloneC.attrs._localCenterX = cxCircle;
            cloneC.attrs._localCenterY = cyCircle;
            
            // Parse the full matrix and decompose to get rotation and scale
            var fullMatrixC = parseTransformMatrixList(node.attrs.transform);
            var decomposedC = decomposeMatrix(fullMatrixC);
            
            // Store rotation for application in createCircle
            if (Math.abs(decomposedC.rotationDeg) > 0.0001) {
                cloneC.attrs._rotationDeg = decomposedC.rotationDeg;
            }
            
            // Store scaleY for gradient flip detection
            // When scaleY is negative (Y-flip), the gradient direction needs to be reversed
            cloneC.attrs._scaleY = decomposedC.scaleY;
            
            // Clear transform to prevent double-application in createCircle
            delete cloneC.attrs.transform;
        } else {
            // Use simple translation
            cloneC.attrs.cx = (cxCircle + nodeT.x + inheritedTranslate.x).toString();
            cloneC.attrs.cy = (cyCircle + nodeT.y + inheritedTranslate.y).toString();
            
            // Store the LOCAL center for gradient offset calculation
            cloneC.attrs._localCenterX = cxCircle;
            cloneC.attrs._localCenterY = cyCircle;
            
            // Clear translate from transform to prevent double-application in createCircle
            if (cloneC.attrs.transform && nodeT.x !== 0 || nodeT.y !== 0) {
                cloneC.attrs.transform = cloneC.attrs.transform.replace(/translate\([^)]*\)\s*/g, '').trim();
                if (cloneC.attrs.transform === '') delete cloneC.attrs.transform;
            }
        }
        
        var cid = createCircle(cloneC, parentId, vb);
        _registerChild(parentId, cid);
        try {
            var fIdC = extractUrlRefId(node.attrs && node.attrs.filter);
            if (!fIdC && node.attrs && node.attrs._inheritedFilterId) fIdC = node.attrs._inheritedFilterId;
            if (fIdC && __svgFilterMap && __svgFilterMap[fIdC]) {
                // Check for drop shadows
                var passesC = detectShadowPasses(__svgFilterMap[fIdC]);
                
                for (var pC = 0; pC < passesC.length; pC++) createAndAttachDropShadow(cid, passesC[pC]);
                
                // Check for inner shadows
                var innerPassesC = detectInnerShadowPasses(__svgFilterMap[fIdC]);
                for (var ipC = 0; ipC < innerPassesC.length; ipC++) createAndAttachInnerShadow(cid, innerPassesC[ipC], ipC, innerPassesC.length);
                
                // Check for blur
                var blurAmountC = detectBlurAmount(__svgFilterMap[fIdC]);
                if (blurAmountC !== null) {
                    
                    createAndAttachBlur(cid, blurAmountC);
                }
            }
        } catch (eDsC) {  }
        
        // Check for Figma Background Blur (frosted glass effect)
        // Queue for deferred processing so we can find underlying siblings
        try {
            var bgBlurRadiusC = node.attrs && node.attrs['data-figma-bg-blur-radius'];
            if (bgBlurRadiusC) {
                var bgBlurAmountC = parseFloat(bgBlurRadiusC);
                if (!isNaN(bgBlurAmountC) && bgBlurAmountC > 0) {
                    queueBackgroundBlur(cid, bgBlurAmountC, parentId);
                }
            }
        } catch (eBgBlurC) {
            console.warn('[Background Blur] Error processing circle: ' + eBgBlurC.message);
        }
        
        // Mask/Clip: apply ALL masks (nested clip intersection)
        try {
            var allMaskIdsC = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
            var ownMaskC = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
            if (ownMaskC && allMaskIdsC.indexOf(ownMaskC) === -1) {
                allMaskIdsC.push(ownMaskC);
            }
            
            // Build geometry for redundancy check
            var svgGeometryC = {
                cx: cx,
                cy: cy,
                r: parseFloat(node.attrs.r || '0')
            };
            
            // Apply all inherited masks - Clipping Masks naturally intersect
            if (allMaskIdsC.length > 0) {
                for (var mci = 0; mci < allMaskIdsC.length; mci++) {
                    createMaskShapeForTarget(allMaskIdsC[mci], cid, parentId, vb, model, svgGeometryC);
                }
                if (allMaskIdsC.length > 1) {
                }
            }
        } catch (eMaskC) {  }
        var rotDegC = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegC) > 0.0001) api.set(cid, {"rotation": -rotDegC});
        if (stats) stats.circles = (stats.circles || 0) + 1;
        return cid;
    }
    if (node.type === 'ellipse') {
        var cloneE = JSON.parse(JSON.stringify(node));
        var cx = parseFloat(cloneE.attrs.cx || '0');
        var cy = parseFloat(cloneE.attrs.cy || '0');
        var rxE = parseFloat(cloneE.attrs.rx || '0');
        var ryE = parseFloat(cloneE.attrs.ry || '0');
        
        // Check if we have a matrix transform
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply the full matrix transform to the center point
            var transformed = applyMatrixToPoint(node.attrs.transform, cx, cy);
            cloneE.attrs.cx = (transformed.x + inheritedTranslate.x).toString();
            cloneE.attrs.cy = (transformed.y + inheritedTranslate.y).toString();
            
            // Store the LOCAL center (before transformation) for gradient offset calculation
            // Gradient coordinates in Figma's SVG export are in local/pre-transform space
            cloneE.attrs._localCenterX = cx;
            cloneE.attrs._localCenterY = cy;
            
            // Parse the full matrix and decompose to get rotation and scale
            var fullMatrixE = parseTransformMatrixList(node.attrs.transform);
            var decomposedE = decomposeMatrix(fullMatrixE);
            
            // Store rotation for application in createEllipse
            if (Math.abs(decomposedE.rotationDeg) > 0.0001) {
                cloneE.attrs._rotationDeg = decomposedE.rotationDeg;
            }
            
            // Store scaleY for gradient flip detection
            // When scaleY is negative (Y-flip), the gradient direction needs to be reversed
            cloneE.attrs._scaleY = decomposedE.scaleY;
            
            // Clear transform to prevent double-application in createEllipse
            delete cloneE.attrs.transform;
            
        } else {
            // Use simple translation
            cloneE.attrs.cx = (cx + nodeT.x + inheritedTranslate.x).toString();
            cloneE.attrs.cy = (cy + nodeT.y + inheritedTranslate.y).toString();
            
            // Store the LOCAL center for gradient offset calculation
            cloneE.attrs._localCenterX = cx;
            cloneE.attrs._localCenterY = cy;
            
            // Clear translate from transform to prevent double-application in createEllipse
            if (cloneE.attrs.transform && nodeT.x !== 0 || nodeT.y !== 0) {
                cloneE.attrs.transform = cloneE.attrs.transform.replace(/translate\([^)]*\)\s*/g, '').trim();
                if (cloneE.attrs.transform === '') delete cloneE.attrs.transform;
            }
        }
        
        var eid = createEllipse(cloneE, parentId, vb);
        _registerChild(parentId, eid);
        try {
            var fIdE = extractUrlRefId(node.attrs && node.attrs.filter);
            if (!fIdE && node.attrs && node.attrs._inheritedFilterId) fIdE = node.attrs._inheritedFilterId;
            if (fIdE && __svgFilterMap && __svgFilterMap[fIdE]) {
                // Check for drop shadows
                var passesE = detectShadowPasses(__svgFilterMap[fIdE]);
                
                for (var pE = 0; pE < passesE.length; pE++) createAndAttachDropShadow(eid, passesE[pE]);
                
                // Check for inner shadows
                var innerPassesE = detectInnerShadowPasses(__svgFilterMap[fIdE]);
                for (var ipE = 0; ipE < innerPassesE.length; ipE++) createAndAttachInnerShadow(eid, innerPassesE[ipE], ipE, innerPassesE.length);
                
                // Check for blur
                var blurAmountE = detectBlurAmount(__svgFilterMap[fIdE]);
                if (blurAmountE !== null) {
                    
                    createAndAttachBlur(eid, blurAmountE);
                }
            }
        } catch (eDsE) {  }
        
        // Check for Figma Background Blur (frosted glass effect)
        // Queue for deferred processing so we can find underlying siblings
        try {
            var bgBlurRadiusE = node.attrs && node.attrs['data-figma-bg-blur-radius'];
            if (bgBlurRadiusE) {
                var bgBlurAmountE = parseFloat(bgBlurRadiusE);
                if (!isNaN(bgBlurAmountE) && bgBlurAmountE > 0) {
                    queueBackgroundBlur(eid, bgBlurAmountE, parentId);
                }
            }
        } catch (eBgBlurE) {
            console.warn('[Background Blur] Error processing ellipse: ' + eBgBlurE.message);
        }
        
        // Mask/Clip: apply ALL masks (nested clip intersection)
        try {
            var allMaskIdsE = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
            var ownMaskE = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
            if (ownMaskE && allMaskIdsE.indexOf(ownMaskE) === -1) {
                allMaskIdsE.push(ownMaskE);
            }
            
            // Build geometry for redundancy check
            var svgGeometryE = {
                cx: cx,
                cy: cy,
                rx: parseFloat(node.attrs.rx || '0'),
                ry: parseFloat(node.attrs.ry || '0')
            };
            
            // Apply all inherited masks - Clipping Masks naturally intersect
            if (allMaskIdsE.length > 0) {
                for (var mei = 0; mei < allMaskIdsE.length; mei++) {
                    createMaskShapeForTarget(allMaskIdsE[mei], eid, parentId, vb, model, svgGeometryE);
                }
                if (allMaskIdsE.length > 1) {
                }
            }
        } catch (eMaskE) {  }
        var rotDegE = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegE) > 0.0001) api.set(eid, {"rotation": -rotDegE});
        if (stats) stats.ellipses = (stats.ellipses || 0) + 1;
        return eid;
    }
    if (node.type === 'text') {
        // Shift tspans
        var cloneT = JSON.parse(JSON.stringify(node));
        
        // Apply parent matrix transform if it exists
        if (parentMatrix) {
            for (var k = 0; k < cloneT.tspans.length; k++) {
                var origX = cloneT.tspans[k].x;
                var origY = cloneT.tspans[k].y;
                // Transform using parent matrix (a*x + c*y + e, b*x + d*y + f)
                var newX = parentMatrix.a * origX + parentMatrix.c * origY + parentMatrix.e;
                var newY = parentMatrix.b * origX + parentMatrix.d * origY + parentMatrix.f;
                cloneT.tspans[k].x = newX;
                cloneT.tspans[k].y = newY;
            }
            // Extract scaleY from parent matrix for gradient flip detection
            var decomposedParentT = decomposeMatrix(parentMatrix);
            if (!cloneT.attrs) cloneT.attrs = {};
            cloneT.attrs._scaleY = decomposedParentT.scaleY;
        }
        
        // Then apply node's own transform if it has one
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply matrix transform to each tspan position
            for (var k = 0; k < cloneT.tspans.length; k++) {
                var transformed = applyMatrixToPoint(node.attrs.transform, cloneT.tspans[k].x, cloneT.tspans[k].y);
                cloneT.tspans[k].x = transformed.x + inheritedTranslate.x;
                cloneT.tspans[k].y = transformed.y + inheritedTranslate.y;
            }
            
            // Extract and store scaleY from matrix for gradient flip detection
            var fullMatrixT = parseTransformMatrixList(node.attrs.transform);
            var decomposedT = decomposeMatrix(fullMatrixT);
            cloneT.attrs._scaleY = decomposedT.scaleY;
        } else if (!parentMatrix) {
            // Only apply simple translation if we didn't already apply parent matrix
            for (var k = 0; k < cloneT.tspans.length; k++) {
                cloneT.tspans[k].x += nodeT.x + inheritedTranslate.x;
                cloneT.tspans[k].y += nodeT.y + inheritedTranslate.y;
            }
        }
        
        var tid = createText(cloneT, parentId, vb, inheritedScale);
        if (!tid) {
            // Text creation skipped (likely disabled in settings)
            return null;
        }
        _registerChild(parentId, tid);
        try {
            var fIdT = extractUrlRefId(node.attrs && node.attrs.filter);
            if (!fIdT && node.attrs && node.attrs._inheritedFilterId) fIdT = node.attrs._inheritedFilterId;
            if (fIdT && __svgFilterMap && __svgFilterMap[fIdT]) {
                // Check for drop shadows
                var passesT = detectShadowPasses(__svgFilterMap[fIdT]);
                
                for (var pT = 0; pT < passesT.length; pT++) createAndAttachDropShadow(tid, passesT[pT]);
                
                // Check for inner shadows
                var innerPassesT = detectInnerShadowPasses(__svgFilterMap[fIdT]);
                for (var ipT = 0; ipT < innerPassesT.length; ipT++) createAndAttachInnerShadow(tid, innerPassesT[ipT], ipT, innerPassesT.length);
                
                // Check for blur
                var blurAmountT = detectBlurAmount(__svgFilterMap[fIdT]);
                if (blurAmountT !== null) {
                    
                    createAndAttachBlur(tid, blurAmountT);
                }
            }
        } catch (eDsT) {  }
        // Mask/Clip: apply ALL masks (nested clip intersection)
        try {
            var allMaskIdsT = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
            var ownMaskT = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
            if (ownMaskT && allMaskIdsT.indexOf(ownMaskT) === -1) {
                allMaskIdsT.push(ownMaskT);
            }
            
            // Apply all inherited masks - Clipping Masks naturally intersect
            if (allMaskIdsT.length > 0) {
                for (var mti = 0; mti < allMaskIdsT.length; mti++) {
                    createMaskShapeForTarget(allMaskIdsT[mti], tid, parentId, vb, model);
                }
            }
        } catch (eMaskT) {  }
        var rotDegT = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegT) > 0.0001) api.set(tid, {"rotation": -rotDegT});
        if (stats) stats.texts = (stats.texts || 0) + 1;
        return tid;
    }
    if (node.type === 'image') {
        var cloneImg = JSON.parse(JSON.stringify(node));
        var x = parseFloat(cloneImg.attrs.x || '0');
        var y = parseFloat(cloneImg.attrs.y || '0');
        var w = parseFloat(cloneImg.attrs.width || '0');
        var h = parseFloat(cloneImg.attrs.height || '0');
        
        // Check if we have a matrix transform
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply matrix transform to all four corners and find new bounds
            var tl = applyMatrixToPoint(node.attrs.transform, x, y);
            var tr = applyMatrixToPoint(node.attrs.transform, x + w, y);
            var bl = applyMatrixToPoint(node.attrs.transform, x, y + h);
            var br = applyMatrixToPoint(node.attrs.transform, x + w, y + h);
            
            // Find the new bounding box
            var minX = Math.min(tl.x, tr.x, bl.x, br.x);
            var maxX = Math.max(tl.x, tr.x, bl.x, br.x);
            var minY = Math.min(tl.y, tr.y, bl.y, br.y);
            var maxY = Math.max(tl.y, tr.y, bl.y, br.y);
            
            cloneImg.attrs.x = (minX + inheritedTranslate.x).toString();
            cloneImg.attrs.y = (minY + inheritedTranslate.y).toString();
            cloneImg.attrs.width = (maxX - minX).toString();
            cloneImg.attrs.height = (maxY - minY).toString();
        } else {
            // Use simple translation
            cloneImg.attrs.x = (x + nodeT.x + inheritedTranslate.x).toString();
            cloneImg.attrs.y = (y + nodeT.y + inheritedTranslate.y).toString();
        }
        
        var idImg = createImage(cloneImg, parentId, vb);
        _registerChild(parentId, idImg);
        try {
            var fIdI = extractUrlRefId(node.attrs && node.attrs.filter);
            if (!fIdI && node.attrs && node.attrs._inheritedFilterId) fIdI = node.attrs._inheritedFilterId;
            if (fIdI && __svgFilterMap && __svgFilterMap[fIdI]) {
                // Check for drop shadows
                var passesI = detectShadowPasses(__svgFilterMap[fIdI]);
                
                for (var pI = 0; pI < passesI.length; pI++) createAndAttachDropShadow(idImg, passesI[pI]);
                
                // Check for inner shadows
                var innerPassesI = detectInnerShadowPasses(__svgFilterMap[fIdI]);
                for (var ipI = 0; ipI < innerPassesI.length; ipI++) createAndAttachInnerShadow(idImg, innerPassesI[ipI], ipI, innerPassesI.length);
                
                // Check for blur
                var blurAmountI = detectBlurAmount(__svgFilterMap[fIdI]);
                if (blurAmountI !== null) {
                    
                    createAndAttachBlur(idImg, blurAmountI);
                }
            }
        } catch (eDsI) {}
        var rotDegI = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegI) > 0.0001) api.set(idImg, { 'rotation': -rotDegI });
        try {
            var rotPivotI = parseRotatePivot(node.attrs && node.attrs.transform || '');
            if (rotPivotI && rotPivotI.cx !== null && rotPivotI.cy !== null) {
                var newCenterSvgI = rotatePointAround(parseFloat(node.attrs.x||0) + parseFloat(node.attrs.width||0)/2, parseFloat(node.attrs.y||0) + parseFloat(node.attrs.height||0)/2, rotPivotI.angle, rotPivotI.cx, rotPivotI.cy);
                var newPosI = svgToCavalryPosition(newCenterSvgI.x, newCenterSvgI.y, vb);
                api.set(idImg, { 'position.x': newPosI.x, 'position.y': newPosI.y });
            }
        } catch (ePI) {}
        // Mask/Clip: apply ALL masks (nested clip intersection)
        try {
            var allMaskIdsI = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
            var ownMaskI = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
            if (ownMaskI && allMaskIdsI.indexOf(ownMaskI) === -1) {
                allMaskIdsI.push(ownMaskI);
            }
            
            // Build geometry for redundancy check
            var svgGeometryI = { x: x, y: y, width: w, height: h };
            
            // Apply all inherited masks - Clipping Masks naturally intersect
            if (allMaskIdsI.length > 0) {
                for (var mii = 0; mii < allMaskIdsI.length; mii++) {
                    createMaskShapeForTarget(allMaskIdsI[mii], idImg, parentId, vb, model);
                }
            }
        } catch (eMaskI) {}
        if (stats) stats.images = (stats.images || 0) + 1;
        return idImg;
    }
    if (node.type === 'use') {
        // Handle <use> elements - treat them like images if they reference an image
        // Resolve the reference (e.g., #_Image3) to get the actual image data
        var refId = (node.attrs.href || '').replace('#', '');
        
        // Look up the referenced element in the model's ID index
        var referencedNode = model._idIndex && model._idIndex[refId];
        
        if (!referencedNode || referencedNode.type !== 'image') {
            return null;
        }
        
        // Treat <use> as an image element - copy attributes and process
        var cloneUse = JSON.parse(JSON.stringify(node));
        cloneUse.type = 'image'; // Convert to image type for processing
        
        // Get the actual image href from the referenced node
        var actualHref = referencedNode.attrs && (referencedNode.attrs.href || referencedNode.attrs['xlink:href']);
        cloneUse.attrs.href = actualHref;
        
        var x = parseFloat(cloneUse.attrs.x || '0');
        var y = parseFloat(cloneUse.attrs.y || '0');
        var w = parseFloat(cloneUse.attrs.width || '0');
        var h = parseFloat(cloneUse.attrs.height || '0');
        
        // Apply parent matrix if it exists - use full matrix like we do for paths/text
        if (parentMatrix) {
            // Transform all four corners to handle rotation correctly
            var tl = {x: parentMatrix.a * x + parentMatrix.c * y + parentMatrix.e,
                      y: parentMatrix.b * x + parentMatrix.d * y + parentMatrix.f};
            var tr = {x: parentMatrix.a * (x+w) + parentMatrix.c * y + parentMatrix.e,
                      y: parentMatrix.b * (x+w) + parentMatrix.d * y + parentMatrix.f};
            var bl = {x: parentMatrix.a * x + parentMatrix.c * (y+h) + parentMatrix.e,
                      y: parentMatrix.b * x + parentMatrix.d * (y+h) + parentMatrix.f};
            var br = {x: parentMatrix.a * (x+w) + parentMatrix.c * (y+h) + parentMatrix.e,
                      y: parentMatrix.b * (x+w) + parentMatrix.d * (y+h) + parentMatrix.f};
            
            // Find the bounding box of the transformed corners
            var minX = Math.min(tl.x, tr.x, bl.x, br.x);
            var maxX = Math.max(tl.x, tr.x, bl.x, br.x);
            var minY = Math.min(tl.y, tr.y, bl.y, br.y);
            var maxY = Math.max(tl.y, tr.y, bl.y, br.y);
            
            cloneUse.attrs.x = minX.toString();
            cloneUse.attrs.y = minY.toString();
            cloneUse.attrs.width = (maxX - minX).toString();
            cloneUse.attrs.height = (maxY - minY).toString();
        }
        
        // Instead of trying to create an image layer (doesn't work in Cavalry API),
        // create a rectangle with an image shader (like Figma patterns do)
        var rectId = api.primitive('rectangle', cloneUse.name || 'image');
        if (parentId) api.parent(rectId, parentId);
        _registerChild(parentId, rectId);
        
        // Calculate position and size
        var x = parseFloat(cloneUse.attrs.x || '0');
        var y = parseFloat(cloneUse.attrs.y || '0');
        var w = parseFloat(cloneUse.attrs.width || '0');
        var h = parseFloat(cloneUse.attrs.height || '0');
        var centre = svgToCavalryPosition(x + w/2, y + h/2, vb);
        
        // Set rectangle size and position
        // Note: rotation is handled by parent group, not applied to the <use> element directly
        try {
            api.set(rectId, {
                'generator.dimensions': [w, h],
                'position.x': centre.x,
                'position.y': centre.y
            });
        } catch (eSet) {}
        
        // Create image shader and connect it
        __imageCounter++;
        var shaderName = (cloneUse.name || 'image') + '_' + __imageCounter;
        var shaderNode = api.create('imageShader', shaderName);
        
        if (shaderNode && actualHref) {
            // Save the image file
            var saved = _resolveImageHrefToAsset(actualHref, cloneUse);
            var linkVal = saved || actualHref;
            
            if (linkVal) {
                // Load as asset and connect
                var assetId = null;
                try { if (saved && api.loadAsset) assetId = api.loadAsset(saved, false); } catch (eLoad) {}
                if (!assetId) { try { if (saved && api.importAsset) assetId = api.importAsset(saved); } catch (eImp) {} }
                
                if (assetId) {
                    try { api.connect(assetId, 'id', shaderNode, 'image'); } catch (eConn) {}
                    
                    // Parent asset under Quiver group
                    var quiverGroup = _ensureQuiverAssetGroup();
                    if (quiverGroup) {
                        try { api.parent(assetId, quiverGroup); } catch (ePar) {}
                    }
                } else {
                    // Fallback: set path directly
                    _setFirstSupported(shaderNode, ['image','generator.image','file','path'], linkVal);
                }
            }
            
            // Connect shader to rectangle
            try {
                api.setFill(rectId, true);
                api.set(rectId, {"material.materialColor.a": 0});
                api.connect(shaderNode, 'id', rectId, 'material.colorShaders');
                api.parent(shaderNode, rectId);
                
                // Configure shader (same as pattern images)
                try { if (_hasAttr(shaderNode, 'legacyGraph')) api.set(shaderNode, { 'legacyGraph': false }); } catch (eLG) {}
                try { api.set(shaderNode, { 'scaleMode': 4 }); } catch (eSM) {}
                try { api.set(shaderNode, { 'tilingX': 3, 'tilingY': 3 }); } catch (eT) {}
                
                // Set filter quality based on user setting (0=None, 1=Bilinear, 2=Mipmaps, 3=Bicubic)
                var fqOk = false;
                try { api.set(shaderNode, { 'filterQuality': imageFilterQuality }); fqOk = true; } catch (eFQ1) { fqOk = false; }
                if (!fqOk) { try { api.set(shaderNode, { 'generator.filterQuality': imageFilterQuality }); } catch (eFQ2) {} }
                
                _setFirstSupported(shaderNode, ['offset','generator.offset'], [0,0]);
            } catch (eShader) {}
        }
        
        if (stats) stats.images = (stats.images || 0) + 1;
        return rectId;
    }
    if (node.type === 'path' || node.type === 'polygon' || node.type === 'polyline' || node.type === 'line') {
        // Skip gradient simulation helper shapes (same check as for rects)
        var pathFill = node.attrs && node.attrs.fill;
        var pathHasFigmaGradientData = !!(node.attrs && node.attrs['data-figma-gradient-fill']);
        var pathIsGenericName = (node.name === node.type || !node.name);
        if (pathFill && !pathHasFigmaGradientData && pathIsGenericName) {
            var pathFillIdMatch = /url\(#([^)]+)\)/.exec(pathFill);
            if (pathFillIdMatch) {
                var pathFillId = pathFillIdMatch[1].toLowerCase();
                if (pathFillId.indexOf('_diamond_') !== -1 || pathFillId.indexOf('_angular_') !== -1) {
                    return null;
                }
            }
        }
        
        var translateAll = {x: nodeT.x + inheritedTranslate.x, y: nodeT.y + inheritedTranslate.y};
        
        // Check if we have a matrix transform - if so, we need to transform all points
        var hasMatrix = node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1;
        
        // If we have a parent matrix, we need to apply it to the path data
        var hasParentMatrix = !!parentMatrix;
        
        if (node.type === 'line') {
            // Convert line to path segments: M x1 y1 L x2 y2
            var x1 = parseFloat(node.attrs.x1 || '0');
            var y1 = parseFloat(node.attrs.y1 || '0');
            var x2 = parseFloat(node.attrs.x2 || '0');
            var y2 = parseFloat(node.attrs.y2 || '0');
            
            // Apply parent matrix first if it exists
            if (hasParentMatrix) {
                var p1 = {
                    x: parentMatrix.a * x1 + parentMatrix.c * y1 + parentMatrix.e,
                    y: parentMatrix.b * x1 + parentMatrix.d * y1 + parentMatrix.f
                };
                var p2 = {
                    x: parentMatrix.a * x2 + parentMatrix.c * y2 + parentMatrix.e,
                    y: parentMatrix.b * x2 + parentMatrix.d * y2 + parentMatrix.f
                };
                x1 = p1.x;
                y1 = p1.y;
                x2 = p2.x;
                y2 = p2.y;
                translateAll = {x: 0, y: 0};
            }
            
            // Then apply node's own matrix transform if it has one
            if (hasMatrix) {
                var t1 = applyMatrixToPoint(node.attrs.transform, x1, y1);
                var t2 = applyMatrixToPoint(node.attrs.transform, x2, y2);
                x1 = t1.x;
                y1 = t1.y;
                x2 = t2.x;
                y2 = t2.y;
                if (!hasParentMatrix) {
                    translateAll = {x: inheritedTranslate.x, y: inheritedTranslate.y};
                }
            }
            
            // Create path segments
            var segments = [
                {cmd:'M', x: x1, y: y1},
                {cmd:'L', x: x2, y: y2}
            ];
            
            var vecId = createEditableFromPathSegments(segments, node.name || 'Line', parentId, vb, translateAll, node.attrs);
            _registerChild(parentId, vecId);
            try {
                var fIdL = extractUrlRefId(node.attrs && node.attrs.filter);
                if (!fIdL && node.attrs && node.attrs._inheritedFilterId) fIdL = node.attrs._inheritedFilterId;
                if (fIdL && __svgFilterMap && __svgFilterMap[fIdL]) {
                    // Check for drop shadows
                    var passesL = detectShadowPasses(__svgFilterMap[fIdL]);
                    
                    for (var pL = 0; pL < passesL.length; pL++) createAndAttachDropShadow(vecId, passesL[pL]);
                    
                    // Check for inner shadows
                    var innerPassesL = detectInnerShadowPasses(__svgFilterMap[fIdL]);
                    for (var ipL = 0; ipL < innerPassesL.length; ipL++) createAndAttachInnerShadow(vecId, innerPassesL[ipL], ipL, innerPassesL.length);
                    
                    // Check for blur
                    var blurAmountL = detectBlurAmount(__svgFilterMap[fIdL]);
                    if (blurAmountL !== null) {
                        
                        createAndAttachBlur(vecId, blurAmountL);
                    }
                }
            } catch (eDsL) {  }
            var rotDegL = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
            if (Math.abs(rotDegL) > 0.0001) api.set(vecId, {"rotation": -rotDegL});
            // Mask/Clip: apply ALL masks (nested clip intersection)
            try {
                var allMaskIdsL = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
                var ownMaskL = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
                if (ownMaskL && allMaskIdsL.indexOf(ownMaskL) === -1) {
                    allMaskIdsL.push(ownMaskL);
                }
                
                // Apply all inherited masks - Clipping Masks naturally intersect
                if (allMaskIdsL.length > 0) {
                    for (var mli = 0; mli < allMaskIdsL.length; mli++) {
                        createMaskShapeForTarget(allMaskIdsL[mli], vecId, parentId, vb, model);
                    }
                }
            } catch (eMaskL) {}
            
            // Check for Figma Background Blur (frosted glass effect)
            // Queue for deferred processing so we can find underlying siblings
            try {
                var bgBlurRadiusL = node.attrs && node.attrs['data-figma-bg-blur-radius'];
                if (bgBlurRadiusL) {
                    var bgBlurAmountL = parseFloat(bgBlurRadiusL);
                    if (!isNaN(bgBlurAmountL) && bgBlurAmountL > 0) {
                        queueBackgroundBlur(vecId, bgBlurAmountL, parentId);
                    }
                }
            } catch (eBgBlurL) {
                console.warn('[Background Blur] Error processing line: ' + eBgBlurL.message);
            }
            
            if (stats) stats.paths = (stats.paths || 0) + 1;
            return vecId;
        }
        
        if (node.type === 'polygon' || node.type === 'polyline') {
            var polyPts = parsePoints(node.attrs.points || '');
            
            // Apply matrix transform to polygon/polyline points if needed
            if (hasMatrix && polyPts) {
                for (var pi = 0; pi < polyPts.length; pi++) {
                    var transformed = applyMatrixToPoint(node.attrs.transform, polyPts[pi].x, polyPts[pi].y);
                    polyPts[pi].x = transformed.x;
                    polyPts[pi].y = transformed.y;
                }
                // Reset translate since we've already applied the full transform
                translateAll = {x: inheritedTranslate.x, y: inheritedTranslate.y};
            }
            
            // Try to recreate as primitives (regular polygon/star)
            var primId = createRegularPolygonPrimitive(node.name || (node.type === 'polygon' ? 'Polygon' : 'Polyline'), polyPts, parentId, vb, translateAll, node.attrs);
            if (primId) {
                if (stats) stats.paths = (stats.paths || 0) + 1;
                return primId;
            }
        }
        // Fallback: parse to editable vector
        var segments = [];
        if (node.type === 'path') {
            segments = parsePathDataToAbsolute(node.attrs.d || '');
            
            // Apply parent matrix first if it exists
            if (hasParentMatrix) {
                for (var si = 0; si < segments.length; si++) {
                    var seg = segments[si];
                    if (seg.x !== undefined && seg.y !== undefined) {
                        var newX = parentMatrix.a * seg.x + parentMatrix.c * seg.y + parentMatrix.e;
                        var newY = parentMatrix.b * seg.x + parentMatrix.d * seg.y + parentMatrix.f;
                        seg.x = newX;
                        seg.y = newY;
                    }
                    // Handle control points for curves
                    if (seg.cp1x !== undefined && seg.cp1y !== undefined) {
                        var newCp1X = parentMatrix.a * seg.cp1x + parentMatrix.c * seg.cp1y + parentMatrix.e;
                        var newCp1Y = parentMatrix.b * seg.cp1x + parentMatrix.d * seg.cp1y + parentMatrix.f;
                        seg.cp1x = newCp1X;
                        seg.cp1y = newCp1Y;
                    }
                    if (seg.cp2x !== undefined && seg.cp2y !== undefined) {
                        var newCp2X = parentMatrix.a * seg.cp2x + parentMatrix.c * seg.cp2y + parentMatrix.e;
                        var newCp2Y = parentMatrix.b * seg.cp2x + parentMatrix.d * seg.cp2y + parentMatrix.f;
                        seg.cp2x = newCp2X;
                        seg.cp2y = newCp2Y;
                    }
                    if (seg.cpx !== undefined && seg.cpy !== undefined) {
                        var newCpX = parentMatrix.a * seg.cpx + parentMatrix.c * seg.cpy + parentMatrix.e;
                        var newCpY = parentMatrix.b * seg.cpx + parentMatrix.d * seg.cpy + parentMatrix.f;
                        seg.cpx = newCpX;
                        seg.cpy = newCpY;
                    }
                }
                // Reset translate since we've already applied the full parent transform
                translateAll = {x: 0, y: 0};
            }
            
            // Then apply node's own matrix transform if it has one
            if (hasMatrix) {
                for (var si = 0; si < segments.length; si++) {
                    var seg = segments[si];
                    if (seg.x !== undefined && seg.y !== undefined) {
                        var transformed = applyMatrixToPoint(node.attrs.transform, seg.x, seg.y);
                        seg.x = transformed.x;
                        seg.y = transformed.y;
                    }
                    // Handle control points for curves
                    if (seg.x1 !== undefined && seg.y1 !== undefined) {
                        var t1 = applyMatrixToPoint(node.attrs.transform, seg.x1, seg.y1);
                        seg.x1 = t1.x;
                        seg.y1 = t1.y;
                    }
                    if (seg.x2 !== undefined && seg.y2 !== undefined) {
                        var t2 = applyMatrixToPoint(node.attrs.transform, seg.x2, seg.y2);
                        seg.x2 = t2.x;
                        seg.y2 = t2.y;
                    }
                }
                // Reset translate since we've already applied the full transform
                if (!hasParentMatrix) {
                    translateAll = {x: inheritedTranslate.x, y: inheritedTranslate.y};
                }
            }
        } else {
            if (polyPts && polyPts.length) {
                segments.push({cmd:'M', x: polyPts[0].x, y: polyPts[0].y});
                for (var ppi = 1; ppi < polyPts.length; ppi++) {
                    segments.push({cmd:'L', x: polyPts[ppi].x, y: polyPts[ppi].y});
                }
                if (node.type === 'polygon') segments.push({cmd:'Z'});
            }
        }
        var vecId = createEditableFromPathSegments(segments, node.name || 'Path', parentId, vb, translateAll, node.attrs);
        _registerChild(parentId, vecId);
        try {
            var fIdP = extractUrlRefId(node.attrs && node.attrs.filter);
            if (!fIdP && node.attrs && node.attrs._inheritedFilterId) fIdP = node.attrs._inheritedFilterId;
            if (fIdP && __svgFilterMap && __svgFilterMap[fIdP]) {
                // Check for drop shadows
                var passesP = detectShadowPasses(__svgFilterMap[fIdP]);
                
                for (var pP = 0; pP < passesP.length; pP++) createAndAttachDropShadow(vecId, passesP[pP]);
                
                // Check for inner shadows
                var innerPassesP = detectInnerShadowPasses(__svgFilterMap[fIdP]);
                for (var ipP = 0; ipP < innerPassesP.length; ipP++) createAndAttachInnerShadow(vecId, innerPassesP[ipP], ipP, innerPassesP.length);
                
                // Check for blur
                var blurAmountP = detectBlurAmount(__svgFilterMap[fIdP]);
                if (blurAmountP !== null) {
                    
                    createAndAttachBlur(vecId, blurAmountP);
                }
            }
        } catch (eDsP) {  }
        
        // Check for Figma Background Blur (frosted glass effect)
        // Queue for deferred processing so we can find underlying siblings
        try {
            var bgBlurRadiusP = node.attrs && node.attrs['data-figma-bg-blur-radius'];
            if (bgBlurRadiusP) {
                var bgBlurAmountP = parseFloat(bgBlurRadiusP);
                if (!isNaN(bgBlurAmountP) && bgBlurAmountP > 0) {
                    queueBackgroundBlur(vecId, bgBlurAmountP, parentId);
                }
            }
        } catch (eBgBlurP) {
            console.warn('[Background Blur] Error processing path: ' + eBgBlurP.message);
        }
        
        var rotDegP = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegP) > 0.0001) api.set(vecId, {"rotation": -rotDegP});
        // rotate(cx,cy) compensation for paths: rotate geometric centre around pivot
        try {
            var rotPivotP = parseRotatePivot(node.attrs && node.attrs.transform || '');
            if (rotPivotP && rotPivotP.cx !== null && rotPivotP.cy !== null) {
                var bbp = null;
                try { bbp = api.getBoundingBox(vecId, true); } catch (eBB) {}
                if (bbp && bbp.centre) {
                    // Convert back to SVG space? Our cvt already placed geometry in Cavalry space.
                    // We approximate by computing the new SVG centre and converting to Cavalry again.
                    // To keep consistent with primitives, rotate original intended centre (average of segment M points if available)
                    var guessSvgX = 0, guessSvgY = 0, countM = 0;
                    for (var si = 0; si < segments.length; si++) {
                        if (segments[si].cmd === 'M') { guessSvgX += segments[si].x; guessSvgY += segments[si].y; countM++; }
                    }
                    if (countM > 0) {
                        guessSvgX /= countM; guessSvgY /= countM;
                    } else {
                        // Fallback: use bbox centre projected back approximately by reversing svgToCavalryPosition around origin
                        guessSvgX = vb.x + vb.width/2 + bbp.centre.x;
                        guessSvgY = vb.y + vb.height/2 - bbp.centre.y;
                    }
                    var newSvgC = rotatePointAround(guessSvgX, guessSvgY, rotPivotP.angle, rotPivotP.cx, rotPivotP.cy);
                    var newPosP = svgToCavalryPosition(newSvgC.x, newSvgC.y, vb);
                    api.set(vecId, {"position.x": newPosP.x, "position.y": newPosP.y});
                }
            }
        } catch (ePP) {}
        // Note: Gradient connection is already handled by applyFillAndStroke called from createEditableFromPathSegments
        // No need for duplicate gradient connection here
        
        // Mask/Clip: apply ALL masks (nested clip intersection)
        try {
            
            // Build list of all masks to apply: inherited masks + own mask
            var allMaskIdsP = (node.attrs && node.attrs._inheritedMaskIds) ? node.attrs._inheritedMaskIds.slice() : [];
            var ownMaskP = extractUrlRefId(node.attrs && node.attrs.mask) || extractUrlRefId(node.attrs && node.attrs['clip-path']);
            if (ownMaskP && allMaskIdsP.indexOf(ownMaskP) === -1) {
                allMaskIdsP.push(ownMaskP);
            }
            
            // Build geometry for redundancy check (paths don't have simple bbox)
            var svgGeometryP = null;
            if (node.type === 'path' && node.attrs && node.attrs.d) {
                svgGeometryP = { d: node.attrs.d };
            }
            
            // Apply all inherited masks - Clipping Masks naturally intersect
            
            if (allMaskIdsP.length > 0) {
                
                for (var mpi = 0; mpi < allMaskIdsP.length; mpi++) {
                    createMaskShapeForTarget(allMaskIdsP[mpi], vecId, parentId, vb, model, svgGeometryP);
                }
                
                if (allMaskIdsP.length > 1) {
            }
            } else {
            }
        } catch (eMaskP) {
            console.error('[DEBUG MASK PATH] Error applying mask: ' + (eMaskP.message || eMaskP));
        }
        if (stats) stats.paths = (stats.paths || 0) + 1;
        return vecId;
    }
    return null;
}

// Connects mask/clipPath references by naming convention. For now, we place clip/mask groups inline in order.
// Future M2: when Cavalry mask attributes are known, connect programmatically.
function postProcessMasks(modelRootId, model) {
    // Placeholder: no-op until we confirm API attribute paths for masks.
}

function _safeHasFill(id) { try { return api.hasFill(id); } catch (e) { return false; } }
function _safeHasStroke(id) { try { return api.hasStroke(id); } catch (e) { return false; } }
function _safeGet(id, attr, defv) { try { var v = api.get(id, attr); return (v===undefined||v===null)?defv:v; } catch (e) { return defv; } }

function unifyPathStrokePairsAfterImport() {
    if (!__createdPathLayers || __createdPathLayers.length === 0) return;
    var byParent = {};
    for (var i = 0; i < __createdPathLayers.length; i++) {
        var rec = __createdPathLayers[i];
        if (!rec || !api.layerExists(rec.id)) continue;
        var p = (rec.parent==null)?-1:rec.parent;
        if (!byParent[p]) byParent[p] = [];
        byParent[p].push(rec.id);
    }
    var tolMin = 0.5;
    for (var parentKey in byParent) {
        var ids = byParent[parentKey];
        // build fill-only and stroke-only lists
        var fills = [], strokes = [];
        for (var j = 0; j < ids.length; j++) {
            var lid = ids[j];
            var hasF = _safeHasFill(lid);
            var hasS = _safeHasStroke(lid);
            if (hasF && !hasS) fills.push(lid);
            else if (!hasF && hasS) strokes.push(lid);
        }
        if (fills.length === 0 || strokes.length === 0) continue;
        // attempt to pair by bbox similarity and stroke width
        for (var f = 0; f < fills.length; f++) {
            var fid = fills[f];
            var bbF = null; try { bbF = api.getBoundingBox(fid, true); } catch (eF) {}
            if (!bbF) continue;
            var best = null; var bestScore = 1e9;
            for (var s = 0; s < strokes.length; s++) {
                var sid = strokes[s]; if (!sid) continue;
                var bbS = null; try { bbS = api.getBoundingBox(sid, true); } catch (eS) {}
                if (!bbS) continue;
                var sw = parseFloat(_safeGet(sid, 'stroke.width', 0));
                if (!(sw>0)) continue;
                var dw = bbF.width - bbS.width;
                var dh = bbF.height - bbS.height;
                var cxDiff = Math.abs(bbF.centre.x - bbS.centre.x);
                var cyDiff = Math.abs(bbF.centre.y - bbS.centre.y);
                var tol = Math.max(tolMin, sw*0.15);
                var inner = (Math.abs(dw - sw) <= tol) && (Math.abs(dh - sw) <= tol);
                var outer = (Math.abs(dw + sw) <= tol) && (Math.abs(dh + sw) <= tol);
                if (!inner && !outer) continue;
                if (cxDiff > tol || cyDiff > tol) continue;
                var score = Math.abs(dw) + Math.abs(dh) + cxDiff + cyDiff;
                if (score < bestScore) { best = { sid: sid, inner: inner, outer: outer, sw: sw }; bestScore = score; }
            }
            if (best) {
                // apply stroke to fill and delete stroke layer
                try {
                    var scol = _safeGet(best.sid, 'stroke.strokeColor', '#000000');
                    var sa = _safeGet(best.sid, 'stroke.alpha', 100);
                    api.setStroke(fid, true);
                    api.set(fid, { 'stroke.strokeColor': scol, 'stroke.width': best.sw, 'stroke.alpha': sa });
                    var alignEnum = best.inner ? 1 : 2; // 1=Inner, 2=Outer
                    try { api.set(fid, { 'stroke.align': alignEnum }); } catch (eAlign) {}
                    try { api.deleteLayer(best.sid); } catch (eDel) {}
                } catch (eMerge) {}
                // Remove from strokes list to avoid reusing
                for (var s2 = 0; s2 < strokes.length; s2++) { if (strokes[s2] === best.sid) { strokes[s2] = null; break; } }
            }
        }
    }
}

// --- Flatten Groups After Import ---
/**
 * Flattens all groups that were created during import.
 * Processes groups from innermost to outermost to preserve layer order.
 * 
 * Cavalry API used:
 * - api.getChildren(groupId) - Get children of a group
 * - api.getParent(groupId) - Get parent of a group  
 * - api.parent(childId, parentId) - Re-parent a layer
 * - api.sendBackward(layerId) - Move layer backward in stack
 * - api.deleteLayer(groupId) - Delete the empty group
 * - api.getNiceName(id) - Get layer name for logging
 */
function flattenAllGroupsAfterImport() {
    var groupIds = getImportedGroupIds();
    if (!groupIds || groupIds.length === 0) {
        console.info('[Flatten] No groups to flatten');
        return 0;
    }
    
    console.info('[Flatten] Processing ' + groupIds.length + ' group(s) for flattening...');
    var flattenedCount = 0;
    var unparentedCount = 0;
    
    // Process in reverse order (deepest nested groups first)
    // This ensures children are moved before their parent group is processed
    for (var i = groupIds.length - 1; i >= 0; i--) {
        var groupId = groupIds[i];
        
        try {
            // Check if group still exists
            var groupName = '';
            try { 
                groupName = api.getNiceName(groupId); 
            } catch (e) { 
                // Group may have been deleted, skip it
                console.info('[Flatten] Group ' + groupId + ' no longer exists, skipping');
                continue; 
            }
            
            // Get the group's parent
            var parentId = null;
            try { 
                parentId = api.getParent(groupId); 
            } catch (e) {
                parentId = null;
            }
            
            // Get children of the group
            var children = [];
            try { 
                children = api.getChildren(groupId); 
            } catch (e) { 
                children = []; 
            }
            
            console.info('[Flatten] Group "' + groupName + '" (' + groupId + ') has ' + children.length + ' children');
            
            if (children.length === 0) {
                // Empty group, just delete it
                try { 
                    api.deleteLayer(groupId); 
                    console.info('[Flatten] Deleted empty group: ' + groupName);
                } catch (e) {}
                flattenedCount++;
                continue;
            }
            
            // For each child, unparent it (move up one level in hierarchy)
            // Process in reverse order to maintain layer stacking order
            for (var c = children.length - 1; c >= 0; c--) {
                var childId = children[c];
                var childName = '';
                try { childName = api.getNiceName(childId); } catch (e) { childName = childId; }
                
                try {
                    // Use api.unParent to move child up one level in hierarchy
                    // This detaches the child from its current parent (the group)
                    api.unParent(childId);
                    unparentedCount++;
                    console.info('[Flatten] Unparented "' + childName + '" from "' + groupName + '"');
                } catch (eUnparent) {
                    // Failed to unparent, continue with other children
                    console.warn('[Flatten] Failed to unparent "' + childName + '": ' + eUnparent.message);
                }
            }
            
            // Delete the now-empty group
            try {
                api.deleteLayer(groupId);
                flattenedCount++;
                console.info('[Flatten] Deleted group: ' + groupName);
            } catch (eDelete) {
                // Group deletion failed, it may still have children
                console.warn('[Flatten] Failed to delete group "' + groupName + '": ' + eDelete.message);
            }
            
        } catch (eGroup) {
            // Error processing group, continue with others
            console.warn('[Flatten] Error processing group: ' + eGroup.message);
        }
    }
    
    console.info('[Flatten] Complete: flattened ' + flattenedCount + ' groups, unparented ' + unparentedCount + ' children');
    return flattenedCount;
}

// --- Save Scene Function ---
function saveSceneBeforeImport() {
    try {
        // Use api.saveScene() as shown in Package 2.0.js
            api.saveScene();

            return true;
    } catch (e) {

        return false;
    }
}

// --- Image/Project Validation Helpers ---
/**
 * Check if SVG contains image assets (direct images or image patterns)
 */
function svgContainsImages(svgCode) {
    // Check for <image> tags (direct images)
    if (/<image[^>]*>/i.test(svgCode)) return true;
    // Check for image patterns (image fills)
    if (/<pattern[^>]*>[\s\S]*?<image/i.test(svgCode)) return true;
    return false;
}

/**
 * Check if a Cavalry project is saved/set
 */
function hasProjectPath() {
    try {
        var path = api.getProjectPath && api.getProjectPath();
        return path && path !== '' && path !== null;
    } catch (e) {
        return false;
    }
}

// --- Main Import Functions ---
function processAndImportSVG(svgCode) {
    try {
        // Validate SVG content
        if (!svgCode || (svgCode + '').trim() === '') {
            console.error('No valid SVG content');
            return false;
        }
        
        if (!svgCode.includes('<svg') || !svgCode.includes('</svg>')) {
            console.error('Invalid SVG format');
            return false;
        }

        // Block import if SVG contains images but no project is saved
        if (svgContainsImages(svgCode) && !hasProjectPath()) {
            console.error('🏹 Can\'t import images without a Project. Go to File > Project Settings to create one.');
            return false;
        }

        var vb = extractViewBox(svgCode);
        if (!vb) vb = {x:0,y:0,width:1000,height:1000};
        
        // Store viewBox globally for gradient offset calculations
        __svgViewBox = vb;
        
        // Reset image counter for consistent numbering per import
        __imageCounter = 0;
        __imageNamingContext = {};
        
        // Reset group counter for consistent numbering per import
        __groupCounter = 0;
        
        // Reset imported group tracking for post-import flattening
        resetImportedGroupIds();

        var model = parseSVGStructure(svgCode);
        // Normalize: merge separate fill/stroke siblings before creating layers
        try { mergeFillStrokePairs(model); } catch (eMerge) {  }
        // Extract filters once for dropshadows
        try {
            __svgFilterMap = extractFilters(svgCode) || {};
            
        } catch (eF) { __svgFilterMap = {}; }
        // Extract patterns (image fills)
        try {
            var patterns = extractPatterns(svgCode) || {};
            setPatternContext(patterns);
        } catch (ePatt) { setPatternContext({}); }
        // Extract masks (clipping/masking)
        try {
            var masks = extractMasks(svgCode) || {};
            setMaskContext(masks);
            resetMaskShapeCache(); // Clear cache for new import to avoid stale references
        } catch (eMask) { setMaskContext({}); resetMaskShapeCache(); }
        // Use the proven gradient extractor logic pattern
        var gradientMap = {};
        var gradsArr = extractGradients(svgCode);
        for (var gi = 0; gi < gradsArr.length; gi++) {
            var gid = gradsArr[gi].id;
            if (gid) gradientMap[gid] = gradsArr[gi];
        }
        setGradientContext(gradientMap);
        
        // Clear any previous deferred background blur queue
        clearDeferredBackgroundBlurs();

        console.info('Creating layers…');

        // Create layers directly under scene root: use the outer-most <svg>'s children
        var rootId = null; // no extra wrapper group
        var stats = {groups:0, rects:0, circles:0, ellipses:0, texts:0, paths:0};
        function ensureShader(id) {
            if (__svgGradientCache[id]) return __svgGradientCache[id];
            var data = __svgGradientMap[id];
            if (!data) return null;
            var sh = createGradientShader(data);
            if (sh) __svgGradientCache[id] = sh;
            return sh;
        }

        function maybeConnectGradient(shapeId, attrs) {
            var fillUrl = extractUrlRefId(attrs && (attrs.fill || attrs.style && extractStyleProperty(attrs.style, 'fill')));
            if (fillUrl) {
                var shaderId = ensureShader(fillUrl);
                if (shaderId) connectShaderToShape(shaderId, shapeId);
            }
        }

        for (var i = 0; i < model.children.length; i++) {
            importNode(model.children[i], rootId, vb, {x:0,y:0}, stats, model, false, {x:1,y:1}, null);
        }
        postProcessMasks(rootId, model);

        // After creating layers, unify any path-based fill/stroke pairs to single shapes
        try { unifyPathStrokePairsAfterImport(); } catch (eUP) {  }
        
        // Process deferred background blurs now that all shapes are created
        // This finds underlying overlapping siblings and applies blur filters
        try { processDeferredBackgroundBlurs(); } catch (eBgBlurPost) { 
            console.warn('[Background Blur] Post-processing error: ' + eBgBlurPost.message);
        }

        // No scene group creation - imports go directly to scene root
        
        // Flatten groups after import if the setting is disabled
        // This preserves layer order while removing the group hierarchy
        var finalGroupCount = stats.groups;
        if (typeof importGroupsEnabled !== 'undefined' && !importGroupsEnabled) {
            try {
                var flattened = flattenAllGroupsAfterImport();
                if (flattened > 0) {
                    finalGroupCount = 0;
                    console.info('🏹 Flattened ' + flattened + ' group(s)');
                }
            } catch (eFlatten) {
                console.warn('[Flatten] Error: ' + eFlatten.message);
            }
        }

        console.info('🏹 Import complete — groups: ' + finalGroupCount + ', rects: ' + stats.rects + ', circles: ' + stats.circles + ', ellipses: ' + stats.ellipses + ', texts: ' + stats.texts + ', paths: ' + stats.paths);
        return true;
    } catch (e) {
        var errorMsg = e && e.message ? e.message : 'Import failed';
        // Skip undefined/null error messages
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
        return false;
    }
}