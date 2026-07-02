// --- Dynamic Align (Scale-aware pivot) ---
function applyDynamicAlignToLayer(layerId) {
    try {
        if (!api.layerExists(layerId)) return false;
        var bbox = null; try { bbox = api.getBoundingBox(layerId, true); } catch (e) { bbox = null; }
        if (!bbox || !bbox.width || !bbox.height) return false;
        var sx = 1, sy = 1;
        try { sx = api.get(layerId, 'scale.x'); sy = api.get(layerId, 'scale.y'); } catch (eS) { sx = 1; sy = 1; }
        if (!isFinite(sx) || sx === 0) sx = 1; if (!isFinite(sy) || sy === 0) sy = 1;
        var originalWidth = bbox.width / sx;
        var originalHeight = bbox.height / sy;
        var alignId = null; try { alignId = api.create('align', 'Dynamic Align'); } catch (eA) { alignId = null; }
        if (!alignId) return false;
        try { api.connect(alignId, 'id', layerId, 'deformers'); } catch (eConDef) {}
        var jsId = null; try { jsId = api.create('javaScript', 'Scale Aware Pivot'); } catch (eJ) { jsId = null; }
        if (!jsId) return false;
        try { api.addDynamic(jsId, 'array', 'double'); } catch (eD1) {}
        try { api.addDynamic(jsId, 'array', 'double'); } catch (eD2) {}
        var expr = ''+
            '// Original unscaled dimensions\n'+
            'var originalWidth = '+originalWidth+';\n'+
            'var originalHeight = '+originalHeight+';\n\n'+
            '// Half dimensions\n'+
            'var halfWidth = (originalWidth / 2);\n'+
            'var halfHeight = (originalHeight / 2);\n\n'+
            '// Inputs\n'+
            'var pivotX = halfWidth * alignX;\n'+
            'var pivotY = halfHeight * alignY;\n\n'+
            '[pivotX, pivotY]';
        try { api.set(jsId, { 'expression': expr }); } catch (eExpr) {}
        try { api.renameAttribute(jsId, 'array.1', 'alignX'); } catch (eR1) {}
        try { api.renameAttribute(jsId, 'array.2', 'alignY'); } catch (eR2) {}
        try { api.connect(alignId, 'x', jsId, 'array.1'); } catch (eAx) {}
        try { api.connect(alignId, 'y', jsId, 'array.2'); } catch (eAy) {}
        try { api.connect(jsId, 'id', layerId, 'pivot'); } catch (ePiv) {}
        try { api.parent(alignId, layerId); } catch (ePA) {}
        try { api.parent(jsId, layerId); } catch (ePJ) {}
        return true;
    } catch (eAll) { return false; }
}