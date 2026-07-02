/**
 * Cycle Vertical Text Alignment
 * Cycles the vertical alignment of selected text layers (Top → Centre → Bottom → Baseline → Top)
 * while keeping the text visually in the same position.
 * 
 * Cavalry API used:
 * - api.getSelection() - Get selected layers
 * - api.get(id, attribute) - Get layer attributes
 * - api.set(id, properties) - Set layer properties
 * - api.getBoundingBox(id, worldSpace) - Get bounding box
 * - api.getType(id) - Get layer type
 * 
 * Cavalry verticalAlignment values (from Text Shape node documentation):
 * 0 = Top
 * 1 = Centre
 * 2 = Bottom
 * 3 = Baseline
 * 
 * Note: "A Text Shape with baseline alignment will be aligned to the bottom of its layout.
 * This means that any descenders will sit outside of its 'cell'." - Cavalry docs
 */
function cycleVerticalTextAlignment() {
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
        
        // Get current vertical alignment
        var currentAlignment = 0;
        try { currentAlignment = api.get(layerId, 'verticalAlignment'); } catch (e) { continue; }
        
        // Get bounding box BEFORE any change - this is our reference
        var bboxBefore = null;
        try { bboxBefore = api.getBoundingBox(layerId, true); } catch (e) {}
        
        if (!bboxBefore || !bboxBefore.centre) {
            continue;
        }
        
        // Store the visual center BEFORE change - this is what we want to preserve
        var targetCenterY = bboxBefore.centre.y;
        
        // Calculate new alignment (cycle: 0 → 1 → 2 → 3 → 0)
        // Top (0) → Centre (1) → Bottom (2) → Baseline (3) → Top (0)
        var newAlignment = (currentAlignment + 1) % 4;
        
        // STEP 1: Change ONLY the alignment (don't change position yet)
        try {
            api.set(layerId, { 'verticalAlignment': newAlignment });
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
        var drift = bboxAfter.centre.y - targetCenterY;
        
        // STEP 4: Get current position and apply correction
        var posAfterAlignment = 0;
        try { posAfterAlignment = api.get(layerId, 'position.y'); } catch (e) { continue; }
        
        // Correct the position by subtracting the drift
        var correctedPosY = posAfterAlignment - drift;
        
        try {
            api.set(layerId, { 'position.y': correctedPosY });
        } catch (e) {
            continue;
        }
    }
}
