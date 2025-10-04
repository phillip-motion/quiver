function importNode(node, parentId, vb, inheritedTranslate, stats, model, inHiddenDefs) {
    inheritedTranslate = inheritedTranslate || {x:0,y:0};
    inHiddenDefs = !!inHiddenDefs;
    var nodeT = parseTranslate(node.attrs && node.attrs.transform);

    if (node.type === 'g' || node.type === 'svg' || node.type === 'root') {
        var groupName = decodeEntitiesForName(node.name || 'group');
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
                        var isGeomCh = (tCh==='path'||tCh==='rect'||tCh==='circle'||tCh==='ellipse'||tCh==='text'||tCh==='polygon'||tCh==='polyline');
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
                    importNode(node.children[fi], parentId, vb, {x:0,y:0}, stats, model, false);
                }
                return parentId;
            }
        }
        if (node.type !== 'svg') {
            gid = createGroup(groupName, parentId);
            if (stats) stats.groups = (stats.groups || 0) + 1;
        }
        // Propagate filter from this group to children if present
        var inheritedFilterId = extractUrlRefId(node.attrs && node.attrs.filter);
        if (!inheritedFilterId && node.attrs && node.attrs._inheritedFilterId) inheritedFilterId = node.attrs._inheritedFilterId;
        if ((nodeT.x !== 0 || nodeT.y !== 0) && node.type !== 'root') {
            var zero = svgToCavalryPosition(0, 0, vb);
            var moved = svgToCavalryPosition(nodeT.x, nodeT.y, vb);
            api.set(gid, {"position.x": moved.x - zero.x, "position.y": moved.y - zero.y});
        }
        // Apply rotation from transform to group (Cavalry uses degrees CCW with Y up; SVG rotate is CW with Y down)
        var rotDeg = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDeg) > 0.0001 && gid != null) {
            api.set(gid, {"rotation": -rotDeg});
        }
        // If this group has a filter, only propagate to children that don't have their own filter AND are likely to be the target:
        // Heuristic: prefer geometry-bearing leaves (path/rect/circle/ellipse/text) and only the first such child if siblings exist.
        var childTargets = node.children.slice();
        if (inheritedFilterId) {
            var geomIdxs = [];
            for (var gi2 = 0; gi2 < childTargets.length; gi2++) {
                var ct = childTargets[gi2];
                var t = ct.type;
                var isGeom = (t==='path'||t==='rect'||t==='circle'||t==='ellipse'||t==='text'||t==='polygon'||t==='polyline'||t==='image');
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
        for (var i = 0; i < node.children.length; i++) {
            importNode(node.children[i], gid, vb, {x:0,y:0}, stats, model, false);
        }
        return gid;
    }
    if (node.type === 'clipPath' || node.type === 'mask' || node.type === 'defs') {
        // Do not create visible groups or children for defs/masks/clipPaths. Preserve only in model for future use.
        for (var i2 = 0; i2 < node.children.length; i2++) {
            importNode(node.children[i2], parentId, vb, {x:0,y:0}, stats, model, true);
        }
        return null;
    }

    if (inHiddenDefs) {
        return null;
    }

    if (node.type === 'rect') {
        // Apply inherited translate to x/y before creation
        var clone = JSON.parse(JSON.stringify(node));
        var x = parseFloat(clone.attrs.x || '0');
        var y = parseFloat(clone.attrs.y || '0');
        var w = parseFloat(clone.attrs.width || '0');
        var h = parseFloat(clone.attrs.height || '0');
        
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
            
            clone.attrs.x = (minX + inheritedTranslate.x).toString();
            clone.attrs.y = (minY + inheritedTranslate.y).toString();
            clone.attrs.width = (maxX - minX).toString();
            clone.attrs.height = (maxY - minY).toString();
        } else {
            // Use simple translation
            clone.attrs.x = (x + nodeT.x + inheritedTranslate.x).toString();
            clone.attrs.y = (y + nodeT.y + inheritedTranslate.y).toString();
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
                
                // Check for blur
                var blurAmount = detectBlurAmount(__svgFilterMap[fId]);
                if (blurAmount !== null) {
                    
                    createAndAttachBlur(rid, blurAmount);
                }
            } else {  }
        } catch (eDs) {  }
        var rotDegR = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegR) > 0.0001) api.set(rid, {"rotation": -rotDegR});
        if (stats) stats.rects = (stats.rects || 0) + 1;
        return rid;
    }
    if (node.type === 'circle') {
        var cloneC = JSON.parse(JSON.stringify(node));
        var cx = parseFloat(cloneC.attrs.cx || '0');
        var cy = parseFloat(cloneC.attrs.cy || '0');
        
        // Check if we have a matrix transform
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply the full matrix transform to the center point
            var transformed = applyMatrixToPoint(node.attrs.transform, cx, cy);
            cloneC.attrs.cx = (transformed.x + inheritedTranslate.x).toString();
            cloneC.attrs.cy = (transformed.y + inheritedTranslate.y).toString();
        } else {
            // Use simple translation
            cloneC.attrs.cx = (cx + nodeT.x + inheritedTranslate.x).toString();
            cloneC.attrs.cy = (cy + nodeT.y + inheritedTranslate.y).toString();
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
                
                // Check for blur
                var blurAmountC = detectBlurAmount(__svgFilterMap[fIdC]);
                if (blurAmountC !== null) {
                    
                    createAndAttachBlur(cid, blurAmountC);
                }
            }
        } catch (eDsC) {  }
        var rotDegC = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegC) > 0.0001) api.set(cid, {"rotation": -rotDegC});
        if (stats) stats.circles = (stats.circles || 0) + 1;
        return cid;
    }
    if (node.type === 'ellipse') {
        var cloneE = JSON.parse(JSON.stringify(node));
        var cx = parseFloat(cloneE.attrs.cx || '0');
        var cy = parseFloat(cloneE.attrs.cy || '0');
        
        // Check if we have a matrix transform
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply the full matrix transform to the center point
            var transformed = applyMatrixToPoint(node.attrs.transform, cx, cy);
            cloneE.attrs.cx = (transformed.x + inheritedTranslate.x).toString();
            cloneE.attrs.cy = (transformed.y + inheritedTranslate.y).toString();
        } else {
            // Use simple translation
            cloneE.attrs.cx = (cx + nodeT.x + inheritedTranslate.x).toString();
            cloneE.attrs.cy = (cy + nodeT.y + inheritedTranslate.y).toString();
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
                
                // Check for blur
                var blurAmountE = detectBlurAmount(__svgFilterMap[fIdE]);
                if (blurAmountE !== null) {
                    
                    createAndAttachBlur(eid, blurAmountE);
                }
            }
        } catch (eDsE) {  }
        var rotDegE = getRotationDegFromTransform(node.attrs && node.attrs.transform || '');
        if (Math.abs(rotDegE) > 0.0001) api.set(eid, {"rotation": -rotDegE});
        if (stats) stats.ellipses = (stats.ellipses || 0) + 1;
        return eid;
    }
    if (node.type === 'text') {
        // Shift tspans
        var cloneT = JSON.parse(JSON.stringify(node));
        
        // Check if we have a matrix transform
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply matrix transform to each tspan position
            for (var k = 0; k < cloneT.tspans.length; k++) {
                var transformed = applyMatrixToPoint(node.attrs.transform, cloneT.tspans[k].x, cloneT.tspans[k].y);
                cloneT.tspans[k].x = transformed.x + inheritedTranslate.x;
                cloneT.tspans[k].y = transformed.y + inheritedTranslate.y;
            }
        } else {
            // Use simple translation
            for (var k = 0; k < cloneT.tspans.length; k++) {
                cloneT.tspans[k].x += nodeT.x + inheritedTranslate.x;
                cloneT.tspans[k].y += nodeT.y + inheritedTranslate.y;
            }
        }
        
        var tid = createText(cloneT, parentId, vb);
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
                
                // Check for blur
                var blurAmountT = detectBlurAmount(__svgFilterMap[fIdT]);
                if (blurAmountT !== null) {
                    
                    createAndAttachBlur(tid, blurAmountT);
                }
            }
        } catch (eDsT) {  }
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
        if (stats) stats.images = (stats.images || 0) + 1;
        return idImg;
    }
    if (node.type === 'path' || node.type === 'polygon' || node.type === 'polyline') {
        var translateAll = {x: nodeT.x + inheritedTranslate.x, y: nodeT.y + inheritedTranslate.y};
        
        // Check if we have a matrix transform - if so, we need to transform all points
        var hasMatrix = node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1;
        
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
            
            // Apply matrix transform to path segments if needed
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
                translateAll = {x: inheritedTranslate.x, y: inheritedTranslate.y};
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
                
                // Check for blur
                var blurAmountP = detectBlurAmount(__svgFilterMap[fIdP]);
                if (blurAmountP !== null) {
                    
                    createAndAttachBlur(vecId, blurAmountP);
                }
            }
        } catch (eDsP) {  }
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
        var gradId2 = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId2) {
            
            var shader2 = getGradientShader(gradId2);
            if (shader2) connectShaderToShape(shader2, vecId);
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

// --- Main Import Functions ---
function processAndImportSVG(svgCode) {
    try {
        // Validate SVG content
        if (!svgCode || (svgCode + '').trim() === '') {
            console.error('No valid SVG content');
            return;
        }
        
        if (!svgCode.includes('<svg') || !svgCode.includes('</svg>')) {
            console.error('Invalid SVG format');
            return;
        }

        var vb = extractViewBox(svgCode);
        if (!vb) vb = {x:0,y:0,width:1000,height:1000};
        
        // Reset image counter for consistent numbering per import
        __imageCounter = 0;
        __imageNamingContext = {};

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
        // Use the proven gradient extractor logic pattern
        var gradientMap = {};
        var gradsArr = extractGradients(svgCode);
        for (var gi = 0; gi < gradsArr.length; gi++) {
            var gid = gradsArr[gi].id;
            if (gid) gradientMap[gid] = gradsArr[gi];
        }
        setGradientContext(gradientMap);

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
            importNode(model.children[i], rootId, vb, {x:0,y:0}, stats, model);
        }
        postProcessMasks(rootId, model);

        // After creating layers, unify any path-based fill/stroke pairs to single shapes
        try { unifyPathStrokePairsAfterImport(); } catch (eUP) {  }

        // No scene group creation - imports go directly to scene root

        console.info('🏹 Import complete — groups: ' + stats.groups + ', rects: ' + stats.rects + ', circles: ' + stats.circles + ', ellipses: ' + stats.ellipses + ', texts: ' + stats.texts + ', paths: ' + stats.paths);
    } catch (e) {
        var errorMsg = e && e.message ? e.message : 'Import failed';
        // Skip undefined/null error messages
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
    }
}