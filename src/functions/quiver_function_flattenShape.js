// --- Flatten Shape Function ---
function flattenShape() {
    try {
        var sel = api.getSelection();
        if (!sel || sel.length === 0) {
            console.error('Please select shape(s) to flatten');
            return;
        }
        
        // Validate that all selected items are shapes
        var shapeTypes = ['rectangleShape', 'ellipseShape', 'starShape', 'polygonShape', 'customShape', 'editable', 'editableShape', 'textShape', 'pathShape'];
        // Also check without 'Shape' suffix for compatibility
        var alternateTypes = ['rectangle', 'ellipse', 'star', 'polygon', 'path', 'text'];
        var validShapes = [];
        for (var i = 0; i < sel.length; i++) {
            try {
                var type = api.getType(sel[i]);
                if (shapeTypes.indexOf(type) !== -1 || alternateTypes.indexOf(type) !== -1) {
                    validShapes.push(sel[i]);
                }
        } catch (e) {}
        }
        
        if (validShapes.length === 0) {
            // Try with all selected items as a fallback
            validShapes = sel;
        }
        
        // Get a name from the first selected item for naming
        var firstItemName = '';
        try {
            firstItemName = api.getNiceName(validShapes[0]) || '';
        } catch (e) {}
        
        // Determine names for our layers
        var baseName = firstItemName || 'Shape';
        var customShapeName = baseName + ' Flattened';
        var groupName = baseName + ' Group';
        
        // FIRST: Create the custom shape (so it's on top in the layer stack)
        var customShapeId = null;
        try {
            customShapeId = api.create('customShape', customShapeName);
        } catch (e) {
            var errorMsg = e && e.message ? e.message : 'Failed to create custom shape';
            console.error(errorMsg);
            return;
        }
        
        // SECOND: Create the group
        var groupId;
        try {
            groupId = api.create('group', groupName);
            
            // Parent the group under the custom shape immediately
            api.parent(groupId, customShapeId);
            
            // Parent all valid shape items to the new group
            for (var i = 0; i < validShapes.length; i++) {
                api.parent(validShapes[i], groupId);
            }
        } catch (e) {
            var errorMsg = e && e.message ? e.message : 'Failed to create/organize group';
            console.error(errorMsg);
            return;
        }
        
        // Connect the group to the custom shape's inputShape
        try {
            api.connect(groupId, 'id', customShapeId, 'inputShape');
        } catch (e) {
            var errorMsg = e && e.message ? e.message : 'Failed to connect group to custom shape';
            console.error(errorMsg);
            return;
        }
        
        // Turn off the group visibility
        try {
            api.set(groupId, {'hidden': true});
        } catch (e) {
            // Could not hide group
        }
        
        // Add the flattenShapeLayers deformer to the custom shape's deformers
        try {
            var deformerId = null;
            var deformerName = 'Flatten Shape Layers [' + customShapeName + ']';
            
            // Create the deformer layer (following the pattern from align deformer)
            try {
                deformerId = api.create('flattenShapeLayers', deformerName);
            } catch (eCreate) {
                // Error creating deformer
            }
            
            if (!deformerId) {
                console.error('Error: Could not create Flatten Shape Layers deformer');
                return;
            }
            
            // Connect the deformer to the custom shape's deformers attribute
            try {
                api.connect(deformerId, 'id', customShapeId, 'deformers');
            } catch (eConnect) {
                console.error('Error connecting deformer to custom shape');
                return;
            }
            
            // Parent the deformer under the custom shape
            try {
                api.parent(deformerId, customShapeId);
            } catch (eParent) {
                // Could not parent deformer to custom shape
            }
            
        } catch (e) {
            var errorMsg = e && e.message ? e.message : 'Failed to add deformer';
            console.error(errorMsg);
            return;
        }
        
        // Select the new custom shape
        try {
            api.select([customShapeId]);
        } catch (e) {}
        
        console.info('Flattened ' + validShapes.length + ' shape(s) into: ' + customShapeName);
        
    } catch (e) {
        console.error('Error: ' + e.message);
    }
}
