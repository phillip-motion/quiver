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

function convertSelectionToRect(keepOriginalHidden) {
    try {
        var selection = api.getSelection();
        if (!selection || selection.length === 0) { console.error('Select at least one layer'); return; }
        var defStr = defaultRadius;
        var defVal = parseFloat(defStr);
        var converted = 0;
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
            try {
                if (keepOriginalHidden) { api.set(layerId, { 'hidden': true }); }
                else { api.deleteLayer(layerId); }
            } catch (eDel) {}
            converted++;
        }
        console.info(converted > 0 ? ('Converted ' + converted + ' layer(s)') : 'No valid layers');
    } catch (e) { 
        var errorMsg = e && e.message ? e.message : 'An error occurred';
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
    }
}