// --- Rename Selected Layers Function ---
function renameSelectedLayers() {
    try {
        var sel = api.getSelection();
        
        if (!sel || sel.length === 0) {
            console.error('Please select layer(s) to rename');
            return;
        }
        
        var newName = renamerInput.getText().trim();
        
        if (!newName) {
            console.error('Please enter a name in the rename field');
            return;
        }
        
        var renamed = 0;
        
        // If only one layer selected, rename without number
        if (sel.length === 1) {
            try {
                api.rename(sel[0], newName);
                renamed = 1;
            } catch (e) {
                // Error renaming layer
            }
        } else {
            // Multiple layers - add numbers starting from 1
            for (var i = 0; i < sel.length; i++) {
                try {
                    var numberedName = newName + ' ' + (i + 1);
                    api.rename(sel[i], numberedName);
                    renamed++;
                } catch (e) {
                    // Error renaming layer
                }
            }
        }
        
        if (renamed > 0) {
            console.info('Renamed ' + renamed + ' layer(s)');
        } else {
            console.error('Failed to rename layers');
        }
        
    } catch (e) {
        console.error('Error: ' + e.message);
    }
}
