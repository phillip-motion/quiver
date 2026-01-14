/**
 * Cycle Text Alignment
 * Cycles the horizontal alignment of selected text layers (Left → Center → Right → Left)
 * while keeping the text visually in the same position.
 * 
 * Cavalry API used:
 * - api.getSelection() - Get selected layers
 * - api.get(id, attribute) - Get layer attributes
 * - api.set(id, properties) - Set layer properties
 * - api.getBoundingBox(id, worldSpace) - Get bounding box
 * - api.getType(id) - Get layer type
 */
function cycleTextAlignment() {
    var selection = api.getSelection();
    
    if (!selection || selection.length === 0) {
        return;
    }
    
    for (var i = 0; i < selection.length; i++) {
        var layerId = selection[i];
        
        // Check if this is a text shape
        var isTextShape = false;
        if (typeof layerId === 'string' && layerId.indexOf('textShape#') === 0) {
            isTextShape = true;
        }
        if (!isTextShape) {
            try {
                var layerType = api.getType(layerId);
                if (layerType === 'textShape' || layerType === 'text') {
                    isTextShape = true;
                }
            } catch (e) {}
        }
        
        if (!isTextShape) {
            continue;
        }
        
        // Get current alignment
        var currentAlignment = 0;
        try { currentAlignment = api.get(layerId, 'horizontalAlignment'); } catch (e) { continue; }
        
        // Get bounding box BEFORE any change - this is our reference
        var bboxBefore = null;
        try { bboxBefore = api.getBoundingBox(layerId, true); } catch (e) {}
        
        if (!bboxBefore || !bboxBefore.centre) {
            continue;
        }
        
        // Store the visual center BEFORE change - this is what we want to preserve
        var targetCenterX = bboxBefore.centre.x;
        
        // Calculate new alignment (cycle: 0 → 1 → 2 → 0)
        var newAlignment = (currentAlignment + 1) % 3;
        
        // STEP 1: Change ONLY the alignment (don't change position yet)
        try {
            api.set(layerId, { 'horizontalAlignment': newAlignment });
        } catch (e) {
            continue;
        }
        
        // STEP 2: Get bounding box AFTER alignment change
        var bboxAfter = null;
        try { bboxAfter = api.getBoundingBox(layerId, true); } catch (e) {}
        
        if (!bboxAfter || !bboxAfter.centre) {
            continue;
        }
        
        // STEP 3: Calculate how much the center drifted
        var drift = bboxAfter.centre.x - targetCenterX;
        
        // STEP 4: Get current position and apply correction
        var posAfterAlignment = 0;
        try { posAfterAlignment = api.get(layerId, 'position.x'); } catch (e) { continue; }
        
        // Correct the position by subtracting the drift
        var correctedPosX = posAfterAlignment - drift;
        
        try {
            api.set(layerId, { 'position.x': correctedPosX });
        } catch (e) {
            continue;
        }
    }
}
