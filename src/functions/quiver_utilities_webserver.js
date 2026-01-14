// --- Web Server for External Tools (Figma Plugin, etc.) ---
// Requires Cavalry 2.4.0+ for api.WebServer()

var QUIVER_PORT = 8765; // Port 8-7-6-5 (arrow countdown! 🏹)
var quiverServer = null;

// Export Quiver API globally for external access
var Quiver = {
    version: currentVersion,
    port: QUIVER_PORT,
    
    // Core import functions
    processAndImportSVG: processAndImportSVG,
    parseSVGStructure: parseSVGStructure,
    
    // Utility functions
    flattenShape: flattenShape,
    convertSelectionToRect: convertSelectionToRect,
    applyDynamicAlignToLayer: applyDynamicAlignToLayer,
    renameSelectedLayers: renameSelectedLayers,
    
    // Status
    serverRunning: false
};

/**
 * Initialize the Quiver web server
 * Listens for HTTP POST requests from external tools (Figma plugins, etc.)
 */
function initializeQuiverWebServer() {
    try {
        // Check if WebServer API is available
        if (typeof api.WebServer === 'undefined') {
            console.info("🏹 Quiver: Web server requires Cavalry 2.4.0+");
            return false;
        }
        
        quiverServer = new api.WebServer();
        
        // Define request handlers
        var serverCallbacks = {
            onPost: function() {
                var post = quiverServer.getNextPost();
                var request;
                
                try {
                    request = JSON.parse(post.result);
                } catch (e) {
                    console.error("🏹 Quiver: Failed to parse request as JSON");
                    return;
                }
                
                // Only log non-ping requests to avoid spam
                
                // Handle different actions
                if (request.action === "importSVG" && request.svgCode) {
                    handleImportSVG(request);
                }
                else if (request.action === "importFromClipboard") {
                    handleImportFromClipboard(request);
                }
                else if (request.action === "importFromFigma" && request.figmaData) {
                    handleImportFromFigma(request);
                }
                else if (request.action === "ping") {
                    handlePing();
                }
                else {
                    console.error("🏹 Quiver: Unknown action '" + (request.action || "none") + "'");
                    console.error("   Available actions: importSVG, importFromClipboard, importFromFigma, ping");
                }
            }
        };
        
        // Start server
        quiverServer.listen("127.0.0.1", QUIVER_PORT);
        quiverServer.addCallbackObject(serverCallbacks);
        quiverServer.setHighFrequency();
        
        Quiver.serverRunning = true;
        console.info("🏹 Quiver API server listening on http://127.0.0.1:" + QUIVER_PORT);
        
        return true;
        
    } catch (e) {
        console.warn("🏹 Quiver: Could not start web server - " + e.message);
        return false;
    }
}

// Track loading indicator layer IDs for cleanup
var __loadingIndicatorLayers = [];

/**
 * Get the active composition dimensions
 * Falls back to 1920x1080 if unable to determine
 * @returns {Object} {width, height}
 */
function getCompDimensions() {
    var defaultDims = { width: 1920, height: 1080 };
    try {
        var compId = api.getActiveComp();
        if (!compId) return defaultDims;
        
        // Try to get resolution from composition
        var resolution = api.get(compId, 'resolution');
        if (resolution && resolution.length >= 2) {
            return { width: resolution[0], height: resolution[1] };
        }
        
        // Fallback: try individual properties
        var w = api.get(compId, 'resolution.x');
        var h = api.get(compId, 'resolution.y');
        if (w && h) {
            return { width: w, height: h };
        }
    } catch (e) {
        // Couldn't get comp dimensions, use defaults
    }
    return defaultDims;
}

/**
 * Show loading indicator by importing the Firing....svg file
 * Uses Quiver's native SVG import pipeline (processAndImportSVG)
 * Adjusts dimensions to match active composition bounds
 * @returns {Array} Array of created layer IDs (the "Firing..." group)
 */
function showLoadingIndicator() {
    try {
        // Get composition dimensions for the overlay
        var compDims = getCompDimensions();
        var compWidth = compDims.width;
        var compHeight = compDims.height;
        
        // Read the loading SVG file using api.readFromFile (same as quiver_createUI.js)
        // Located in quiver_assets folder following the same pattern as other assets
        var svgPath = ui.scriptLocation + '/quiver_assets/quiver_firing-loader.svg';
        var svgContent = null;
        
        try {
            svgContent = api.readFromFile(svgPath);
        } catch (readError) {
            return [];
        }
        
        if (!svgContent || svgContent.trim() === '') {
            return [];
        }
        
        // Adjust SVG dimensions to match composition bounds
        // Original SVG is 1920x1080, dialog box is centered at x=637, y=476
        // Dialog dimensions: 646.505 x 127
        var origWidth = 1920;
        var origHeight = 1080;
        var dialogWidth = 646.505;
        var dialogHeight = 127;
        
        // Calculate new dialog position to center it in the composition
        var newDialogX = Math.round((compWidth - dialogWidth) / 2);
        var newDialogY = Math.round((compHeight - dialogHeight) / 2);
        
        // Calculate offset to adjust all elements inside Frame 2 group
        var offsetX = newDialogX - 637;
        var offsetY = newDialogY - 476;
        
        // Update SVG viewBox and dimensions
        svgContent = svgContent.replace(
            /width="1920"\s+height="1080"\s+viewBox="0 0 1920 1080"/,
            'width="' + compWidth + '" height="' + compHeight + '" viewBox="0 0 ' + compWidth + ' ' + compHeight + '"'
        );
        
        // Update the dark overlay rect (70% black) to match composition bounds
        svgContent = svgContent.replace(
            /<rect width="1920" height="1080" fill="black" fill-opacity="0.7"\/>/,
            '<rect width="' + compWidth + '" height="' + compHeight + '" fill="black" fill-opacity="0.7"/>'
        );
        
        // Adjust the entire Frame 2 group position using transform
        // This moves the dialog box, logo, and text together as a unit
        // Don't modify individual element positions - just transform the group
        if (offsetX !== 0 || offsetY !== 0) {
            svgContent = svgContent.replace(
                /<g id="Frame 2">/,
                '<g id="Frame 2" transform="translate(' + offsetX + ', ' + offsetY + ')">'
            );
        }
        
        // Import using Quiver's native SVG parser (same pipeline as regular imports)
        // resetImportedGroupIds() is called at start of processAndImportSVG
        processAndImportSVG(svgContent);
        
        // Get the group IDs that were created during import
        // Uses getImportedGroupIds() from quiver_svgParser.js
        var createdGroups = [];
        try {
            createdGroups = getImportedGroupIds();
        } catch (e) {
            // Fallback if function not available
        }
        
        // Flush events to ensure the loading indicator renders immediately
        if (typeof api.processEvents === 'function') {
            api.processEvents();
        }
        
        return createdGroups;
        
    } catch (e) {
    }
    return [];
}

/**
 * Hide loading indicator by deleting its layers
 * @param {Array} layerIds - Array of layer IDs to delete
 */
function hideLoadingIndicator(layerIds) {
    try {
        if (layerIds && layerIds.length > 0) {
            for (var i = 0; i < layerIds.length; i++) {
                api.deleteLayer(layerIds[i]);
            }
        }
    } catch (e) {
        // Cleanup failure is non-critical
    }
}

/**
 * Handle SVG import request (with optional hybrid vector data for stroke gradients)
 */
function handleImportSVG(request) {
    // Show loading indicator before import starts
    var loadingLayers = showLoadingIndicator();
    
    try {
        
        // HYBRID TEXT: Store Figma text data BEFORE SVG import so createText can access it
        if (request.textData && request.textData.length > 0) {
            setFigmaTextData(request.textData);
        } else {
            clearFigmaTextData(); // Clear any previous data
        }
        
        // Clear the text shape registry before import (will be populated during SVG import)
        clearCreatedTextShapes();
        
        // Import the SVG (createText will now look up alignment from __figmaTextData)
        // Text shapes created will be registered for emoji positioning
        processAndImportSVG(request.svgCode);
        console.info("🏹 Quiver: SVG imported successfully");
        
        // If hybrid vector data is present (nodes with stroke gradients),
        // process them to restore proper strokes with gradients
        if (request.vectorData && request.vectorData.length > 0) {
            
            var viewBox = extractViewBox(request.svgCode);
            if (!viewBox) {
                viewBox = {x: 0, y: 0, width: request.frameWidth || 1000, height: request.frameHeight || 1000};
            }
            
            processStrokeGradientNodes(request.vectorData, viewBox);
        }
        
        // EMOJI IMPORT: Create image layers for emojis that Cavalry can't render
        // These overlay the invisible emoji characters in text, preserving spacing
        // Only process if emoji import is enabled in settings
        if (request.emojiData && request.emojiData.length > 0) {
            if (typeof importEmojisEnabled === 'undefined' || importEmojisEnabled) {
                
                var viewBox = extractViewBox(request.svgCode);
                if (!viewBox) {
                    viewBox = {x: 0, y: 0, width: request.frameWidth || 1000, height: request.frameHeight || 1000};
                }
                
                processEmojiData(request.emojiData, viewBox);
            }
        }
        
        // Clear text data, text shape registry, and emoji index maps after processing
        clearFigmaTextData();
        clearCreatedTextShapes();
        if (typeof clearEmojiIndexMaps === 'function') {
            clearEmojiIndexMaps();
        }
        
        // Hide loading indicator now that import is complete
        hideLoadingIndicator(loadingLayers);
        
        // Try to bring Cavalry to the foreground
        // Note: Window focusing may not be available in Cavalry's scripting API
        try {
            if (typeof api.raiseWindow !== 'undefined') {
                api.raiseWindow();
            } else if (typeof api.requestUserAttention !== 'undefined') {
                api.requestUserAttention();
            }
        } catch (e) {
            // Window focusing not available
        }
    } catch (e) {
        // Hide loading indicator even on error
        hideLoadingIndicator(loadingLayers);
        console.error("🏹 Quiver: Import failed - " + e.message);
    }
}

// Track layers we've already processed in the hybrid approach to avoid double-processing
// when multiple layers have the same name (e.g., two envelopes both having "Polygon 5")
var __processedHybridLayers = {};

// Store Figma text data for accurate alignment during text creation
// This is populated before SVG import and accessed by createText
// Now stores arrays of entries per name to handle duplicates
var __figmaTextData = {};
var __figmaTextDataByContent = {}; // Secondary index by content for disambiguation

// Registry for created text shapes - maps Figma textNodeName to Cavalry textShape ID
// This allows emoji processing to find the correct text shape for Get Sub-Mesh Transform
var __createdTextShapes = {};

/**
 * Set Figma text data for access during text creation
 * @param {Array} textDataArray - Array of text data objects from Figma
 */
function setFigmaTextData(textDataArray) {
    __figmaTextData = {};
    __figmaTextDataByContent = {};
    if (!textDataArray || textDataArray.length === 0) return;
    
    for (var i = 0; i < textDataArray.length; i++) {
        var td = textDataArray[i];
        if (td && td.name) {
            // Store as array to handle multiple nodes with same name
            if (!__figmaTextData[td.name]) {
                __figmaTextData[td.name] = [];
            }
            __figmaTextData[td.name].push(td);
            
            // Also index by content for disambiguation
            if (td.characters) {
                var contentKey = td.characters.substring(0, 50); // Use first 50 chars as key
                if (!__figmaTextDataByContent[contentKey]) {
                    __figmaTextDataByContent[contentKey] = td;
                }
            }
            
        }
    }
}

/**
 * Get Figma text data for a text node by name and optionally content/position
 * Uses position-based matching to handle cases where Figma's tree traversal order
 * differs from SVG element order (due to unique naming of duplicates).
 * 
 * CRITICAL: SVG and Figma traverse nodes in different orders, so their _N suffixes don't match!
 * We ALWAYS strip suffixes to get the base name and collect ALL variants for position matching.
 * 
 * @param {string} name - The text node name
 * @param {string} content - Optional text content for disambiguation
 * @param {Object} svgPosition - Optional {x, y} position from SVG tspan for disambiguation
 * @returns {Object|null} Figma text data or null if not found
 */
function getFigmaTextData(name, content, svgPosition) {
    // ALWAYS strip _N suffix to get base name - SVG and Figma use different numbering!
    var baseName = name.replace(/_\d+$/, '');
    
    // Collect ALL candidates from base name AND all its suffixed variants
    var allCandidates = [];
    
    // Add base name matches first
    if (__figmaTextData[baseName]) {
        for (var i = 0; i < __figmaTextData[baseName].length; i++) {
            allCandidates.push(__figmaTextData[baseName][i]);
        }
    }
    
    // Add ALL suffixed variants (baseName_2, baseName_3, etc.)
    var consecutiveMisses = 0;
    for (var suffix = 2; suffix <= 50 && consecutiveMisses < 5; suffix++) {
        var suffixedName = baseName + '_' + suffix;
        if (__figmaTextData[suffixedName]) {
            for (var j = 0; j < __figmaTextData[suffixedName].length; j++) {
                allCandidates.push(__figmaTextData[suffixedName][j]);
            }
            consecutiveMisses = 0;
        } else {
            consecutiveMisses++;
        }
    }
    
    // If base name was different from original name and we found candidates, log it
    if (baseName !== name && allCandidates.length > 0) {
    }
    
    // If no candidates found by base name, try exact name as-is (unique names)
    if (allCandidates.length === 0 && name !== baseName && __figmaTextData[name]) {
        for (var k = 0; k < __figmaTextData[name].length; k++) {
            allCandidates.push(__figmaTextData[name][k]);
        }
    }
    
    // If still no candidates, try matching by content
    if (allCandidates.length === 0) {
        if (content) {
            var contentKey = content.substring(0, 50);
            if (__figmaTextDataByContent[contentKey]) {
                return __figmaTextDataByContent[contentKey];
            }
        }
        return null;
    }
    
    // Filter by content if provided - narrows down to text with matching content
    var contentMatches = [];
    if (content) {
        for (var m = 0; m < allCandidates.length; m++) {
            if (allCandidates[m].characters === content) {
                contentMatches.push(allCandidates[m]);
            }
        }
    }
    
    // Use content matches if we have them, otherwise all candidates
    var candidateEntries = contentMatches.length > 0 ? contentMatches : allCandidates;
    
    // If only one candidate with matching content, return it
    if (candidateEntries.length === 1) {
        return candidateEntries[0];
    }
    
    // ALWAYS use position-based matching when we have position data and multiple candidates
    if (svgPosition && (svgPosition.x !== undefined || svgPosition.y !== undefined)) {
        var bestMatch = null;
        var bestDistance = Infinity;
        
        for (var n = 0; n < candidateEntries.length; n++) {
            var entry = candidateEntries[n];
            // Use relativeX/relativeY from Figma data (relative to frame)
            var entryX = (entry.relativeX !== undefined) ? entry.relativeX : entry.x;
            var entryY = (entry.relativeY !== undefined) ? entry.relativeY : entry.y;
            
            if (entryX !== undefined && entryY !== undefined) {
                // Calculate distance - weight X more since baseline differences affect Y
                var dx = Math.abs((entryX || 0) - (svgPosition.x || 0));
                var dy = Math.abs((entryY || 0) - (svgPosition.y || 0));
                var distance = dx + (dy * 0.3);
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = entry;
                }
            }
        }
        
        if (bestMatch && bestDistance < 500) { // Within 500px is a reasonable match
            return bestMatch;
        }
    }
    
    // Fallback: use first unused entry
    for (var p = 0; p < candidateEntries.length; p++) {
        if (!candidateEntries[p]._used) {
            candidateEntries[p]._used = true;
            return candidateEntries[p];
        }
    }
    
    // All entries used, return first one
    return candidateEntries[0];
}

/**
 * Clear Figma text data after import is complete
 */
function clearFigmaTextData() {
    __figmaTextData = {};
    __figmaTextDataByContent = {};
}

/**
 * Register a created text shape for emoji positioning
 * Called from createTextFromFigmaData after text shape is created
 * @param {string} figmaTextName - The Figma text node name
 * @param {string} textShapeId - The Cavalry textShape ID
 */
function registerCreatedTextShape(figmaTextName, textShapeId) {
    if (!figmaTextName || !textShapeId) return;
    
    // Store as array to handle multiple text shapes with similar names
    if (!__createdTextShapes[figmaTextName]) {
        __createdTextShapes[figmaTextName] = [];
    }
    __createdTextShapes[figmaTextName].push(textShapeId);
}

/**
 * Get the created text shape ID for a Figma text node name
 * @param {string} figmaTextName - The Figma text node name
 * @returns {string|null} The textShape ID or null if not found
 */
function getCreatedTextShape(figmaTextName) {
    if (!figmaTextName) return null;
    
    // Try exact match first
    var entries = __createdTextShapes[figmaTextName];
    if (entries && entries.length > 0) {
        return entries[0]; // Return first match
    }
    
    // Try partial matching - find text shape whose name contains the figma text name
    // This handles cases where emoji characters are stripped or modified
    var cleanName = figmaTextName.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
    for (var key in __createdTextShapes) {
        if (__createdTextShapes.hasOwnProperty(key)) {
            var cleanKey = key.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
            if (cleanKey === cleanName || key.indexOf(cleanName) >= 0 || cleanName.indexOf(key) >= 0) {
                return __createdTextShapes[key][0];
            }
        }
    }
    
    return null;
}

/**
 * Clear the text shape registry after import
 */
function clearCreatedTextShapes() {
    __createdTextShapes = {};
}

function resetProcessedHybridLayers() {
    __processedHybridLayers = {};
}

function markLayerAsProcessed(layerId) {
    __processedHybridLayers[layerId] = true;
}

function isLayerProcessed(layerId) {
    return __processedHybridLayers[layerId] === true;
}

/**
 * Process nodes with stroke gradients - creates proper strokes instead of outlined fills
 * This is the AEUX-inspired hybrid approach: SVG for everything else, JSON for stroke gradients
 * 
 * Smart approach: Reuse the existing gradient shader from the SVG import (which has correct positioning)
 * instead of creating a new one. Just move it from fill to stroke on the new path.
 */
function processStrokeGradientNodes(vectorDataArray, viewBox) {
    // Reset the processed layers tracker at the start of each batch
    // This prevents issues when multiple layers have the same name
    resetProcessedHybridLayers();
    
    for (var i = 0; i < vectorDataArray.length; i++) {
        var nodeData = vectorDataArray[i];
        
        try {
            // Find the existing layer by name (SVG import created an outlined version)
            // Pass nodeData and viewBox for position-based matching when multiple layers share the same name
            var existingLayerId = findLayerByName(nodeData.name);
            
            if (existingLayerId) {
                // Mark this layer as being processed so we don't find it again
                // if another layer has the same name
                markLayerAsProcessed(existingLayerId);
                
                
                // Determine the layer to read position from
                // If the existing layer is a group, the actual position is on its first child shape
                // Groups themselves have position 0,0 - the geometry is in the child
                var positionSourceLayerId = existingLayerId;
                try {
                    var layerType = existingLayerId.split('#')[0];
                    if (layerType === 'group') {
                        var groupChildren = api.getChildren(existingLayerId);
                        if (groupChildren && groupChildren.length > 0) {
                            // Find the first editable shape (path) child
                            for (var gc = 0; gc < groupChildren.length; gc++) {
                                var childType = groupChildren[gc].split('#')[0];
                                if (childType === 'editableShape' || childType === 'basicShape' || childType === 'path') {
                                    positionSourceLayerId = groupChildren[gc];
                                    break;
                                }
                            }
                        }
                    }
                } catch (eGroupCheck) {}
                
                // Get the existing layer's position
                var existingPos = {x: 0, y: 0};
                try {
                    existingPos.x = api.get(positionSourceLayerId, 'position.x') || 0;
                    existingPos.y = api.get(positionSourceLayerId, 'position.y') || 0;
                } catch (ePos) {}
                
                // Get the existing layer's rotation (ensure it's a proper number)
                var existingRot = 0;
                try {
                    var rawRot = api.get(positionSourceLayerId, 'rotation');
                    existingRot = (typeof rawRot === 'number') ? rawRot : parseFloat(rawRot) || 0;
                    if (existingRot !== 0) {
                    }
                } catch (eRot) {}
                
                // Get parent and sibling info before making changes
                var parentId = null;
                var originalIndex = 0;
                var originalSiblingCount = 0;
                try { 
                    parentId = api.getParent(existingLayerId);
                    // Get siblings to find the layer order position
                    if (parentId) {
                        var siblings = api.getChildren(parentId);
                        originalSiblingCount = siblings.length;
                        for (var si = 0; si < siblings.length; si++) {
                            if (siblings[si] === existingLayerId) {
                                originalIndex = si;
                                break;
                            }
                        }
                    }
                } catch (eP) {}
                
                // Find and preserve gradient shaders for both fill and stroke
                var existingStrokeShader = null;
                var existingFillShader = null;
                var allShaders = [];
                var allFilters = []; // Collect filter effects (dropShadow, blur, etc.)
                var existingClippingMasks = []; // Collect clipping masks (clip-paths/masks)
                
                // Get existing clipping masks connected to this layer
                // Use our reverse lookup cache since Cavalry's masks array isn't directly readable
                
                // Helper: recursively collect masks from a layer and its children
                // This is needed because when the found layer is a GROUP (e.g., "Vector 312"),
                // the masks may be on the inner path/shape, not the group itself
                function collectMasksRecursively(layerId, depth) {
                    if (depth > 3) return; // Prevent infinite recursion
                    
                    // Check this layer for masks
                    try {
                        var masks = getMaskShapesForTarget(layerId);
                        if (masks && masks.length > 0) {
                            for (var mi = 0; mi < masks.length; mi++) {
                                if (existingClippingMasks.indexOf(masks[mi]) === -1) {
                                    existingClippingMasks.push(masks[mi]);
                                }
                            }
                        }
                    } catch (e) {}
                    
                    // Check children
                    try {
                        var children = api.getChildren(layerId);
                        for (var ci = 0; ci < children.length; ci++) {
                            collectMasksRecursively(children[ci], depth + 1);
                        }
                    } catch (e) {}
                }
                
                // Method 1: Use our reverse lookup cache recursively (most reliable)
                // This handles both direct layers AND groups containing paths with masks
                collectMasksRecursively(existingLayerId, 0);
                
                // Method 2: Fallback - try Cavalry API methods (for completeness/debugging)
                if (existingClippingMasks.length === 0) {
                    try {
                        var clipMaskChildren = api.getAttrChildren(existingLayerId, 'masks');
                        
                        if (clipMaskChildren && clipMaskChildren.length > 0) {
                            // Try the API methods as fallback
                            for (var cmc = 0; cmc < clipMaskChildren.length; cmc++) {
                                var childAttrId = clipMaskChildren[cmc];
                                var maskLayerId = null;
                                
                                try {
                                    var directValue = api.get(existingLayerId, childAttrId);
                                    if (directValue && typeof directValue === 'string' && directValue.indexOf('#') !== -1) {
                                        maskLayerId = directValue;
                                    }
                                } catch (eGet) {}
                                
                                if (!maskLayerId) {
                                    try {
                                        var conn = api.getInConnection(existingLayerId, childAttrId);
                                        if (conn && conn.length > 0) {
                                            var maskParts = conn.split('.');
                                            if (maskParts.length > 0 && maskParts[0]) {
                                                maskLayerId = maskParts[0];
                                            }
                                        }
                                    } catch (eConn) {}
                                }
                                
                                if (maskLayerId) {
                                    existingClippingMasks.push(maskLayerId);
                                }
                            }
                        }
                    } catch (eCM) {
                    }
                }
                
                
                // Helper: extract layer type from layerId (e.g., "gradientShader#33" -> "gradientShader")
                function getLayerType(layerId) {
                    if (!layerId || typeof layerId !== 'string') return '';
                    var hashIndex = layerId.indexOf('#');
                    return hashIndex > 0 ? layerId.substring(0, hashIndex) : layerId;
                }
                
                // Filter types to look for
                var filterTypes = ['dropShadowFilter', 'dropShadow', 'blurFilter', 'blur', 'shadowFilter'];
                
                // Helper to check a layer and its children for shaders/filters
                function collectShadersAndFilters(layerId, depth) {
                    if (depth > 3) return; // Prevent infinite recursion
                    var indent = "     ";
                    for (var d = 0; d < depth; d++) indent += "  ";
                    
                    try {
                        var children = api.getChildren(layerId);
                        
                        for (var c = 0; c < children.length; c++) {
                            var childId = children[c];
                            var childType = getLayerType(childId);
                            var childName = "";
                            try { childName = api.getNiceName(childId); } catch (eN) { childName = childId; }
                            
                            if (childType === 'gradientShader') {
                                allShaders.push({id: childId, name: childName});
                            }
                            
                            // Check if this child is a filter effect
                            var isFilter = false;
                            for (var ft = 0; ft < filterTypes.length; ft++) {
                                if (childType === filterTypes[ft]) {
                                    allFilters.push({id: childId, name: childName, type: childType});
                                    isFilter = true;
                                    break;
                                }
                            }
                            
                            // If this child is a shape/group, check its children too
                            if (!isFilter && childType !== 'gradientShader') {
                                if (childType === 'editableShape' || childType === 'group' || childType === 'path') {
                                    collectShadersAndFilters(childId, depth + 1);
                                }
                            }
                        }
                    } catch (eFind) {
                    }
                }
                
                // Start searching from the existing layer
                collectShadersAndFilters(existingLayerId, 0);
                
                
                // Assign shaders based on what the Figma data tells us about the shape
                var hasFigmaFill = nodeData.fills && nodeData.fills.length > 0 && nodeData.fills[0].visible !== false;
                var hasFigmaGradientFill = hasFigmaFill && nodeData.fills[0].gradientType;
                
                // Logic for shader assignment:
                // - If shape had BOTH gradient fill and gradient stroke in Figma:
                //   - First shader from SVG is for FILL (paint1_)
                //   - Second shader is for STROKE (paint2_) - which may have been outlined
                // - If shape had ONLY gradient stroke (no fill or solid fill):
                //   - First/only shader is the outlined stroke → use for new stroke
                
                if (allShaders.length >= 2 && hasFigmaGradientFill) {
                    // Two shaders AND Figma had gradient fill
                    // SVG parser creates stroke shaders BEFORE fill shaders when both exist
                    // So: Shader 0 = STROKE, Shader 1 = FILL
                    existingStrokeShader = allShaders[0].id;
                    existingFillShader = allShaders[1].id;
                } else if (allShaders.length >= 1) {
                    // Single shader (or no gradient fill) → shader is from outlined stroke
                    existingStrokeShader = allShaders[0].id;
                    
                    // If there's a second shader and Figma had a fill, might be for fill
                    if (allShaders.length >= 2 && hasFigmaFill) {
                        existingFillShader = allShaders[1].id;
                    }
                }
                
                if (!existingStrokeShader) {
                }
                
                // Create the replacement path with proper stroke (and fill if applicable)
                // Pass null for parentId initially - we'll handle parenting manually
                // IMPORTANT: Pass the existing layer's position AND rotation so the new path matches
                // This fixes mismatches when vectorData order doesn't match layer order
                var newLayerId = createPathFromVectorDataWithExistingShaders(nodeData, viewBox, null, existingStrokeShader, existingFillShader, hasFigmaFill, existingPos, existingRot);
                
                if (newLayerId) {
                    // Parent new layer FIRST (while old layer still exists)
                    if (parentId) {
                        try {
                            api.parent(newLayerId, parentId);
                            
                            // Reorder: move new layer to the same position as the old one
                            api.select([newLayerId]);
                            
                            // First, bring all the way to front (index 0)
                            api.bringToFront();
                            
                            // Then move backward to reach originalIndex
                            // Since old layer is still at originalIndex, we need to go to originalIndex
                            // which means moving backward originalIndex times from index 0
                            if (originalIndex > 0) {
                                for (var m = 0; m < originalIndex; m++) {
                                    api.moveBackward();
                                }
                            }
                        } catch (eParent) {
                            console.error("   Failed to parent/reorder: " + eParent.message);
                        }
                    }
                    
                    // Transfer filter effects (drop shadows, blurs) to the new layer
                    if (allFilters.length > 0) {
                        for (var fi = 0; fi < allFilters.length; fi++) {
                            var filter = allFilters[fi];
                            
                            // Skip if filter id is invalid
                            if (!filter || !filter.id) {
                                console.error("     Skipping invalid filter at index " + fi);
                                continue;
                            }
                            
                            
                            // Step 1: Re-parent the filter to the new layer
                            try {
                                api.parent(filter.id, newLayerId);
                            } catch (eParentFilter) {
                                console.error("     Failed to re-parent filter: " + eParentFilter.message);
                            }
                            
                            // Step 2: Connect the filter to the new layer's filters input
                            try {
                                api.connect(filter.id, 'id', newLayerId, 'filters');
                            } catch (eConnFilter) {
                                console.error("     Failed to connect filter: " + eConnFilter.message);
                                // Try fallback to deformers
                                try {
                                    api.connect(filter.id, 'id', newLayerId, 'deformers');
                                } catch (eConnDeform) {
                                    console.error("     Deformers fallback also failed: " + eConnDeform.message);
                                }
                            }
                            
                        }
                    }
                    
                    // Transfer clipping masks (clip-paths/masks) to the new layer
                    if (existingClippingMasks.length > 0) {
                        for (var cmi = 0; cmi < existingClippingMasks.length; cmi++) {
                            var maskId = existingClippingMasks[cmi];
                            try {
                                api.connect(maskId, 'id', newLayerId, 'masks');
                                
                                // Ensure the mask stays visible (it might be a visible shape being reused)
                                try {
                                    api.set(maskId, { 'hidden': false });
                                } catch (eVis) {}
                            } catch (eConnMask) {
                                console.error("     Failed to connect clipping mask: " + eConnMask.message);
                            }
                        }
                    }
                    
                    // NOW delete the old layer (it's now at originalIndex + 1)
                    try { 
                        api.deleteLayer(existingLayerId); 
                    } catch (eDel) {
                        console.error("   Failed to delete old layer: " + eDel.message);
                    }
                    
                    // Path is positioned at existing layer's location (passed to createPathFromVectorDataWithExistingShaders)
                    // Gradient shader is already correctly positioned from the existing layer
                    
                    // Mark the new layer as processed too (in case there are multiple
                    // layers with the same name in the vectorData)
                    markLayerAsProcessed(newLayerId);
                    
                }
            } else {
                // Layer not found - create new one (without existing shader)
                createPathFromVectorData(nodeData, viewBox, null);
            }
        } catch (eNode) {
            console.error("   Failed to process '" + nodeData.name + "': " + eNode.message);
        }
    }
}

/**
 * Find a layer by its name in the scene (searches entire hierarchy)
 * Skips layers that have already been processed in the hybrid approach
 * Also tries suffixed names (e.g., "Polygon 5_2") if exact match not found
 */
function findLayerByName(name) {
    
    try {
        // #region agent log
        // #endregion
        
        // Get ALL layers in active comp (false = include nested, no compId needed)
        var allLayers = api.getCompLayers(false);
        
        // #region agent log
        // #endregion
        
        if (!allLayers || allLayers.length === 0) {
            return null;
        }
        
        // Build a list of valid (unprocessed) layers with their names
        var candidates = [];
        for (var i = 0; i < allLayers.length; i++) {
            try {
                // Skip already processed layers
                if (isLayerProcessed(allLayers[i])) {
                    continue;
                }
                
                var layerName = api.getNiceName(allLayers[i]);
                candidates.push({ id: allLayers[i], name: layerName });
            } catch (e) {
                // Skip unreadable layers
            }
        }
        
        // First pass: exact match
        for (var j = 0; j < candidates.length; j++) {
            if (candidates[j].name === name) {
                return candidates[j].id;
            }
        }
        
        // Second pass: try suffixed names (e.g., "Polygon 5_2", "Polygon 5_3", etc.)
        // This handles cases where the SVG parser renamed duplicates
        for (var suffix = 2; suffix <= 20; suffix++) {
            var suffixedName = name + '_' + suffix;
            for (var k = 0; k < candidates.length; k++) {
                if (candidates[k].name === suffixedName) {
                    return candidates[k].id;
                }
            }
        }
        
        return null;
    } catch (e) {
        var errMsg = "unknown error";
        try { errMsg = e.message || String(e); } catch (eStr) { errMsg = "could not get error message"; }
        console.error("findLayerByName error: " + errMsg);
    }
    return null;
}

/**
 * Create a path from Figma vector data, reusing existing gradient shaders for stroke and fill
 * This is the preferred method when replacing an SVG-imported outlined shape
 * 
 * @param {object} nodeData - Figma node data with vectorPaths, strokes, fills, etc.
 * @param {object} viewBox - SVG viewBox for coordinate conversion
 * @param {string} parentId - Parent layer ID (can be null, will be handled manually)
 * @param {string} existingStrokeShader - Existing stroke gradient shader to reuse
 * @param {string} existingFillShader - Existing fill gradient shader to reuse
 * @param {boolean} hasFigmaFill - Whether the original Figma shape had a fill
 * @param {object} targetPosition - Optional: existing layer's position {x, y} to use instead of nodeData's position
 * @param {number} targetRotation - Optional: existing layer's rotation (degrees) to apply to the new layer
 */
function createPathFromVectorDataWithExistingShaders(nodeData, viewBox, parentId, existingStrokeShader, existingFillShader, hasFigmaFill, targetPosition, targetRotation) {
    try {
        // Parse the first vector path data
        if (!nodeData.vectorPaths || nodeData.vectorPaths.length === 0) {
            console.error("   No vector paths in data for '" + nodeData.name + "'");
            return null;
        }
        
        var pathData = nodeData.vectorPaths[0].data;
        if (!pathData) {
            console.error("   Empty path data for '" + nodeData.name + "'");
            return null;
        }
        
        // Parse and create the path
        var segments = parsePathDataToAbsolute(pathData);
        if (!segments || segments.length === 0) {
            console.error("   Failed to parse path segments for '" + nodeData.name + "'");
            return null;
        }
        
        // Build Cavalry path from segments using figmaToCavalryCoord transformation
        // This applies the relativeTransform from Figma and maps to Cavalry's coordinate system
        var path = new cavalry.Path();
        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            if (s.cmd === 'M') {
                var p = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.moveTo(p.x, p.y);
            } else if (s.cmd === 'L') {
                var p = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.lineTo(p.x, p.y);
            } else if (s.cmd === 'C') {
                var c1 = figmaToCavalryCoord(s.cp1x, s.cp1y, nodeData, viewBox);
                var c2 = figmaToCavalryCoord(s.cp2x, s.cp2y, nodeData, viewBox);
                var pe = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.cubicTo(c1.x, c1.y, c2.x, c2.y, pe.x, pe.y);
            } else if (s.cmd === 'Q') {
                var cq = figmaToCavalryCoord(s.cpx, s.cpy, nodeData, viewBox);
                var pe = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.quadTo(cq.x, cq.y, pe.x, pe.y);
            } else if (s.cmd === 'Z') {
                path.close();
            }
        }
        
        // Rebase geometry center so pivot is at shape's geometric center
        // This is essential for gradient scale to work correctly
        var centre = null;
        try {
            var bb = path.boundingBox();
            if (bb && bb.centre) {
                centre = {x: bb.centre.x, y: bb.centre.y};
            }
        } catch (eBB) {}
        if (centre) {
            path.translate(-centre.x, -centre.y);
        }
        
        // Create the editable path
        var layerId = api.createEditable(path, nodeData.name || 'Path');
        if (parentId) api.parent(layerId, parentId);
        
        // Position the layer
        // When targetPosition is provided (from existing SVG layer), use it if there's a significant delta
        // This handles cases where vectorData order doesn't match layer order (e.g., multiple "Polygon 4" layers)
        if (centre) {
            var finalPosX = centre.x;
            var finalPosY = centre.y;
            
            // Check if we should use existing layer's position instead
            if (targetPosition && targetPosition.x !== undefined) {
                var dx = centre.x - targetPosition.x;
                var dy = centre.y - targetPosition.y;
                var dist = Math.sqrt(dx*dx + dy*dy);
                
                // If delta is large (>50px), the vectorData is for a different layer instance
                // Use the existing layer's position to place it correctly
                if (dist > 50) {
                    finalPosX = targetPosition.x;
                    finalPosY = targetPosition.y;
                }
            }
            
            api.set(layerId, {"position.x": finalPosX, "position.y": finalPosY});
        }
        
        // Apply rotation from existing layer if provided
        // This ensures the new layer has the same rotation as the original SVG-imported layer
        if (targetRotation !== undefined && targetRotation !== null) {
            // Ensure it's a proper number
            var rotValue = (typeof targetRotation === 'number') ? targetRotation : parseFloat(targetRotation) || 0;
            if (rotValue !== 0) {
                try {
                    api.set(layerId, {"rotation": rotValue});
                } catch (eRot) {
                    console.error("   Failed to apply rotation: " + eRot.message);
                }
            }
        }
        
        // Handle FILL (if the original Figma shape had a fill)
        if (hasFigmaFill) {
            api.setFill(layerId, true);
            
            // Get fill opacity from Figma data
            var fillOpacity = 1;
            if (nodeData.fills && nodeData.fills.length > 0 && nodeData.fills[0].opacity !== undefined) {
                fillOpacity = nodeData.fills[0].opacity;
            }
            
            // Apply fill opacity (material.alpha in Cavalry)
            if (fillOpacity < 1) {
                try {
                    api.set(layerId, {"material.alpha": fillOpacity * 100}); // Cavalry uses 0-100
                } catch (eAlpha) {
                    console.error("   Failed to set fill opacity: " + eAlpha.message);
                }
            }
            
            if (existingFillShader) {
                // Reuse existing fill shader
                try {
                    connectShaderToShape(existingFillShader, layerId);
                    api.parent(existingFillShader, layerId);
                } catch (eFillShader) {
                    console.error("   Failed to connect fill shader: " + eFillShader.message);
                }
            } else if (nodeData.fills && nodeData.fills.length > 0) {
                // Create new fill from Figma data
                var fill = nodeData.fills[0];
                if (fill.type === 'SOLID') {
                    api.set(layerId, {"material.materialColor": fill.color});
                } else if (fill.gradientType) {
                    var fillShader = createGradientFromFigmaPaint(fill, nodeData.name + '_fill');
                    if (fillShader) {
                        connectShaderToShape(fillShader, layerId);
                    }
                }
            }
        } else {
            // No fill for stroke-only shapes
            api.setFill(layerId, false);
        }
        
        // Handle STROKE
        if (nodeData.strokes && nodeData.strokes.length > 0) {
            api.setStroke(layerId, true);
            api.set(layerId, {"stroke.width": nodeData.strokeWeight || 1});
            
            // Map stroke cap
            var capStyle = 0;
            if (nodeData.strokeCap === 'ROUND') capStyle = 1;
            else if (nodeData.strokeCap === 'SQUARE') capStyle = 2;
            try { api.set(layerId, {'stroke.capStyle': capStyle}); } catch (eCap) {}
            
            // Map stroke join
            var joinStyle = 0;
            if (nodeData.strokeJoin === 'ROUND') joinStyle = 1;
            else if (nodeData.strokeJoin === 'BEVEL') joinStyle = 2;
            try { api.set(layerId, {'stroke.joinStyle': joinStyle}); } catch (eJoin) {}
            
            // Apply dash pattern from Figma data
            // nodeData.dashPattern is an array of numbers from Figma API (e.g., [62.35, 62.35])
            if (nodeData.dashPattern && nodeData.dashPattern.length > 0) {
                try {
                    // Set mode to Pixels (0) - matches SVG behavior
                    api.set(layerId, {'stroke.dashPatternMode': 0});
                    
                    // Convert Figma array to Cavalry CSV string (e.g., "62.35, 62.35")
                    var dashCsv = nodeData.dashPattern.join(', ');
                    api.set(layerId, {'stroke.dashPattern': dashCsv});
                } catch (eDash) {
                    console.error("   Failed to apply dash pattern: " + eDash.message);
                }
            }
            
            // Connect the gradient shader to the stroke
            if (existingStrokeShader) {
                try {
                    connectShaderToStroke(existingStrokeShader, layerId);
                    api.parent(existingStrokeShader, layerId);
                    
                    // Update the shader with correct Figma data (fixes radiusRatio)
                    // Figma's SVG export decomposes the matrix, losing shear information
                    var stroke = nodeData.strokes && nodeData.strokes[0];
                    if (stroke && stroke.gradientType === 'radial') {
                        try {
                            // When reusing an existing shader, DON'T recalculate scale/radiusRatio
                            // The shader was already configured correctly during SVG import
                            // with the proper settings for the outlined shape dimensions.
                            // Recalculating here would use wrong dimensions (non-outlined path).
                        } catch (eRadialFix) {
                            console.warn('[RADIAL GRADIENT FIX] Error: ' + eRadialFix.message);
                        }
                    }
                } catch (eShader) {
                    console.error("   Failed to connect stroke shader: " + eShader.message);
                }
            } else {
                // No existing shader - create a new one from Figma data
                var stroke = nodeData.strokes[0];
                if (stroke.type === 'SOLID') {
                    api.set(layerId, {"stroke.strokeColor": stroke.color});
                } else if (stroke.gradientType) {
                    var strokeShader = createGradientFromFigmaPaint(stroke, nodeData.name + '_stroke');
                    if (strokeShader) {
                        connectShaderToStroke(strokeShader, layerId);
                    }
                }
            }
        }
        
        // Apply corner radius using Bevel deformer (if specified)
        if (nodeData.cornerRadius && nodeData.cornerRadius > 0) {
            try {
                var bevelId = api.create('bevel', 'Bevel');
                if (bevelId) {
                    // Set bevel mode to Fillet (rounded) - enum value 0
                    api.set(bevelId, {'mode': 0});
                    // Set the radius
                    api.set(bevelId, {'radius': nodeData.cornerRadius});
                    // Connect bevel to the shape's deformers
                    api.connect(bevelId, 'id', layerId, 'deformers');
                    // Parent under the shape
                    api.parent(bevelId, layerId);
                }
            } catch (eBevel) {
                console.error("   Failed to apply Bevel deformer: " + eBevel.message);
            }
        }
        
        return layerId;
    } catch (e) {
        console.error("   createPathFromVectorDataWithExistingShaders failed: " + e.message);
        return null;
    }
}

/**
 * Create a path from Figma vector data with proper stroke gradient (creates new shader)
 * Used when there's no existing shader to reuse
 */
function createPathFromVectorData(nodeData, viewBox, parentId) {
    try {
        // Parse the first vector path data
        if (!nodeData.vectorPaths || nodeData.vectorPaths.length === 0) {
            console.error("   No vector paths in data for '" + nodeData.name + "'");
            return null;
        }
        
        var pathData = nodeData.vectorPaths[0].data;
        if (!pathData) {
            console.error("   Empty path data for '" + nodeData.name + "'");
            return null;
        }
        
        // Parse and create the path
        var segments = parsePathDataToAbsolute(pathData);
        if (!segments || segments.length === 0) {
            console.error("   Failed to parse path segments for '" + nodeData.name + "'");
            return null;
        }
        
        // Build Cavalry path from segments
        var path = new cavalry.Path();
        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            if (s.cmd === 'M') {
                var p = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.moveTo(p.x, p.y);
            } else if (s.cmd === 'L') {
                var p = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.lineTo(p.x, p.y);
            } else if (s.cmd === 'C') {
                var c1 = figmaToCavalryCoord(s.cp1x, s.cp1y, nodeData, viewBox);
                var c2 = figmaToCavalryCoord(s.cp2x, s.cp2y, nodeData, viewBox);
                var pe = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.cubicTo(c1.x, c1.y, c2.x, c2.y, pe.x, pe.y);
            } else if (s.cmd === 'Q') {
                var cq = figmaToCavalryCoord(s.cpx, s.cpy, nodeData, viewBox);
                var pe = figmaToCavalryCoord(s.x, s.y, nodeData, viewBox);
                path.quadTo(cq.x, cq.y, pe.x, pe.y);
            } else if (s.cmd === 'Z') {
                path.close();
            }
        }
        
        // Rebase geometry center
        var centre = null;
        try {
            var bb = path.boundingBox();
            if (bb && bb.centre) centre = {x: bb.centre.x, y: bb.centre.y};
        } catch (eBB) {}
        if (centre) {
            path.translate(-centre.x, -centre.y);
        }
        
        // Create the editable path
        var layerId = api.createEditable(path, nodeData.name || 'Path');
        if (parentId) api.parent(layerId, parentId);
        if (centre) {
            api.set(layerId, {"position.x": centre.x, "position.y": centre.y});
        }
        
        // Apply fill (if any)
        if (nodeData.fills && nodeData.fills.length > 0) {
            var fill = nodeData.fills[0];
            if (fill.type === 'SOLID') {
                api.setFill(layerId, true);
                api.set(layerId, {"material.materialColor": fill.color});
            } else if (fill.gradientType) {
                api.setFill(layerId, true);
                var fillShader = createGradientFromFigmaPaint(fill, nodeData.name + '_fill');
                if (fillShader) connectShaderToShape(fillShader, layerId);
            }
        } else {
            api.setFill(layerId, false);
        }
        
        // Apply stroke with gradient - the key improvement!
        if (nodeData.strokes && nodeData.strokes.length > 0) {
            var stroke = nodeData.strokes[0];
            api.setStroke(layerId, true);
            api.set(layerId, {"stroke.width": nodeData.strokeWeight || 1});
            
            // Map stroke cap
            var capStyle = 0;
            if (nodeData.strokeCap === 'ROUND') capStyle = 1;
            else if (nodeData.strokeCap === 'SQUARE') capStyle = 2;
            try { api.set(layerId, {'stroke.capStyle': capStyle}); } catch (eCap) {}
            
            // Map stroke join
            var joinStyle = 0;
            if (nodeData.strokeJoin === 'ROUND') joinStyle = 1;
            else if (nodeData.strokeJoin === 'BEVEL') joinStyle = 2;
            try { api.set(layerId, {'stroke.joinStyle': joinStyle}); } catch (eJoin) {}
            
            // Apply dash pattern from Figma data
            if (nodeData.dashPattern && nodeData.dashPattern.length > 0) {
                try {
                    api.set(layerId, {'stroke.dashPatternMode': 0});
                    var dashCsv = nodeData.dashPattern.join(', ');
                    api.set(layerId, {'stroke.dashPattern': dashCsv});
                } catch (eDash) {
                    console.error("   Failed to apply dash pattern: " + eDash.message);
                }
            }
            
            // Apply stroke color or gradient
            if (stroke.type === 'SOLID') {
                api.set(layerId, {"stroke.strokeColor": stroke.color});
            } else if (stroke.gradientType) {
                // THIS IS THE KEY: Create gradient shader and connect to stroke!
                var strokeShader = createGradientFromFigmaPaint(stroke, nodeData.name + '_stroke');
                if (strokeShader) {
                    connectShaderToStroke(strokeShader, layerId);
                }
            }
        }
        
        return layerId;
    } catch (e) {
        console.error("   createPathFromVectorData failed: " + e.message);
        return null;
    }
}

/**
 * Convert Figma coordinates to Cavalry coordinates (relative to the frame, not page)
 */
function figmaToCavalryCoord(x, y, nodeData, viewBox) {
    // Figma vectorPaths are in local coordinates relative to the node
    // Convert to frame-relative position using the node's relative transform
    var frameRelX = x;
    var frameRelY = y;
    
    if (nodeData.relativeTransform) {
        // Apply the relative transform matrix (already adjusted for frame position)
        var t = nodeData.relativeTransform;
        frameRelX = t.a * x + t.c * y + t.e;
        frameRelY = t.b * x + t.d * y + t.f;
    } else {
        // Fallback: add relative position to frame
        frameRelX = x + (nodeData.relativeX || nodeData.x || 0);
        frameRelY = y + (nodeData.relativeY || nodeData.y || 0);
    }
    
    // Convert to Cavalry's coordinate system (center origin, Y-up)
    return svgToCavalryPosition(frameRelX, frameRelY, viewBox);
}

/**
 * Create a Cavalry gradient shader from Figma paint data
 */
function createGradientFromFigmaPaint(paintData, name) {
    try {
        if (!paintData.gradientStops || paintData.gradientStops.length === 0) {
            return null;
        }
        
        // Create descriptive name: "Linear #FFF → #000" or "Radial #FFF → #000"
        var gradTypeName = paintData.gradientType === 'radial' ? 'Radial' : 'Linear';
        var firstStop = paintData.gradientStops[0];
        var lastStop = paintData.gradientStops[paintData.gradientStops.length - 1];
        var firstColor = (firstStop && firstStop.color) ? firstStop.color.toUpperCase() : '';
        var lastColor = (lastStop && lastStop.color) ? lastStop.color.toUpperCase() : '';
        var gradientName = gradTypeName + ' ' + firstColor + ' → ' + lastColor;
        
        var shaderId = api.create('gradientShader', gradientName);
        
        // Set gradient type
        if (paintData.gradientType === 'radial') {
            try { api.setGenerator(shaderId, 'generator', 'radialGradientShader'); } catch (e) {}
        } else {
            try { api.setGenerator(shaderId, 'generator', 'linearGradientShader'); } catch (e) {}
        }
        
        // Handle rotation/transform for linear gradients
        if (paintData.gradientType === 'linear' && paintData.gradientTransform) {
            try {
                var t = paintData.gradientTransform;
                var angle = Math.atan2(t.b, t.a) * 180 / Math.PI;
                api.set(shaderId, {"generator.rotation": angle});
            } catch (eRot) {}
        }
        
        // Handle transform for radial gradients
        if (paintData.gradientType === 'radial') {
            try {
                // Set radius mode to Bounding Box for Figma compatibility
                api.set(shaderId, {"generator.radiusMode": 1});
                
                // Use scale.x/y to control ellipse dimensions, radiusRatio=1
                if (paintData.gradientTransform) {
                    var t = paintData.gradientTransform;
                    
                    // Use shape dimensions if available, otherwise assume square
                    var shapeWidth = paintData.shapeWidth || 1;
                    var shapeHeight = paintData.shapeHeight || 1;
                    
                    
                    // Compute handle positions to get ellipse semi-axes
                    var centerX = t.a * 0.5 + t.c * 0.5 + t.e;
                    var centerY = t.b * 0.5 + t.d * 0.5 + t.f;
                    var handle1X = t.a * 1.0 + t.c * 0.5 + t.e;
                    var handle1Y = t.b * 1.0 + t.d * 0.5 + t.f;
                    var handle2X = t.a * 0.5 + t.c * 1.0 + t.e;
                    var handle2Y = t.b * 0.5 + t.d * 1.0 + t.f;
                    
                    // Scale deltas by shape dimensions to get pixel distances
                    var dx1 = (handle1X - centerX) * shapeWidth;
                    var dy1 = (handle1Y - centerY) * shapeHeight;
                    var dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    
                    var dx2 = (handle2X - centerX) * shapeWidth;
                    var dy2 = (handle2Y - centerY) * shapeHeight;
                    var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                    
                    
                    // Calculate scale based on shape's half-dimensions
                    var shapeRadiusX = shapeWidth / 2;
                    var shapeRadiusY = shapeHeight / 2;
                    var scaleX = (dist1 / shapeRadiusX) * 100;
                    var scaleY = (dist2 / shapeRadiusY) * 100;
                    
                    
                    // Set radiusRatio=1 (ellipse shape comes from scale.x/y)
                    api.set(shaderId, {"generator.radiusRatio": 1});
                    
                    // Set scale values
                    api.set(shaderId, {"generator.scale.x": scaleX, "generator.scale.y": scaleY});
                    
                    // Calculate and apply rotation from the matrix
                    var rotationRad = Math.atan2(t.b, t.a);
                    var rotationDeg = rotationRad * 180 / Math.PI;
                    api.set(shaderId, {"generator.rotation": rotationDeg});
                    
                    // Apply offset from translation (e, f)
                    if (t.e !== undefined && t.f !== undefined) {
                        api.set(shaderId, {"generator.offset.x": t.e, "generator.offset.y": -t.f});
                    }
                }
            } catch (eRadial) {
                console.warn('[RADIAL GRADIENT FIGMA] Error applying transform: ' + eRadial.message);
            }
        }
        
        // Set gradient stops
        var colors = paintData.gradientStops.map(function(stop) { return stop.color || '#000000'; });
        if (colors.length === 1) colors.push(colors[0]);
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop positions and opacity
        for (var i = 0; i < paintData.gradientStops.length; i++) {
            var stop = paintData.gradientStops[i];
            try {
                var posAttr = {};
                posAttr['generator.gradient.' + i + '.position'] = stop.position;
                api.set(shaderId, posAttr);
            } catch (ePos) {}
            
            try {
                var colAttr = {};
                colAttr['generator.gradient.' + i + '.color'] = colorWithOpacity(stop.color, stop.opacity);
                api.set(shaderId, colAttr);
            } catch (eCol) {}
        }
        
        return shaderId;
    } catch (e) {
        console.error("   createGradientFromFigmaPaint failed: " + e.message);
        return null;
    }
}

// ============================================================================
// EMOJI IMAGE IMPORT (for emojis that Cavalry can't render as text)
// ============================================================================

/**
 * Process emoji data from Figma and create image layers in Cavalry.
 * Uses Get Sub-Mesh Transform to precisely position emojis by querying
 * the actual character position from Cavalry's text layout engine.
 * 
 * This approach is 100% accurate because:
 * 1. Text is created with the emoji character as a placeholder
 * 2. Get Sub-Mesh Transform queries the exact position of that character
 * 3. Emoji image is connected to that position output
 * 4. Apply Text Material makes the placeholder character invisible
 * 
 * Cavalry API used:
 * - api.primitive('rectangle', name) - Create a rectangle shape
 * - api.set(id, properties) - Set shape properties
 * - api.create('imageShader', name) - Create image shader
 * - api.create('getSubMeshTransform', name) - Create Get Sub-Mesh Transform node
 * - api.create('applyTextMaterial', name) - Create Apply Text Material for hiding character
 * - api.loadAsset(path) - Load image as asset
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect nodes
 * - api.parent(childId, parentId) - Set parent
 * 
 * @param {Array} emojiDataArray - Array of emoji data from Figma
 * @param {Object} viewBox - The SVG viewBox {x, y, width, height}
 */
function processEmojiData(emojiDataArray, viewBox) {
    if (!emojiDataArray || emojiDataArray.length === 0) {
        return;
    }
    
    
    var createdCount = 0;
    
    // Track emoji name counts to handle duplicates (e.g., 🏹, 🏹_2, 🏹_3)
    var emojiNameCounts = {};
    
    // Group emojis by their text node for efficient processing
    // (Multiple emojis in same text share one Apply Text Material)
    var emojisByTextNode = {};
    
    for (var i = 0; i < emojiDataArray.length; i++) {
        var emoji = emojiDataArray[i];
        var textNodeName = emoji.textNodeName || '';
        
        if (!emojisByTextNode[textNodeName]) {
            emojisByTextNode[textNodeName] = [];
        }
        emojisByTextNode[textNodeName].push(emoji);
    }
    
    // Process each text node's emojis
    for (var textNodeName in emojisByTextNode) {
        if (!emojisByTextNode.hasOwnProperty(textNodeName)) continue;
        
        var emojisForNode = emojisByTextNode[textNodeName];
        
        // Find the corresponding text shape
        var textShapeId = getCreatedTextShape(textNodeName);
        
        if (!textShapeId) {
            console.warn('[Emoji] Could not find text shape for "' + textNodeName + '" - using fallback positioning');
            // Fallback to the old coordinate-based approach
            for (var j = 0; j < emojisForNode.length; j++) {
                var emojiData = emojisForNode[j];
                createdCount += processEmojiWithFallback(emojiData, viewBox);
            }
            continue;
        }
        
        
        // Use Count Sub-Meshes to get the ACTUAL word count
        // Word-level indexing is more reliable than character-level because:
        // - Ligatures only affect characters within words, not word count
        // - Zero-width characters don't affect word boundaries
        var actualWordCount = -1;
        try {
            var countSubMeshId = api.create('countSubMeshes', 'Temp Count');
            api.connect(textShapeId, 'id', countSubMeshId, 'inputShape');
            api.set(countSubMeshId, { 'levelMode': 2 });  // 2 = Words
            actualWordCount = api.get(countSubMeshId, 'count');
            api.deleteLayer(countSubMeshId);  // Clean up temporary node
        } catch (eCount) {
            console.warn('[Emoji] Could not create Count Sub-Meshes: ' + (eCount.message || eCount));
        }
        
        // Collect WORD indices for emoji positioning via Get Sub-Mesh Transform
        // Each emoji placeholder [e] is its own word for reliable word-level positioning
        var emojiWordData = [];   // Store word info for each emoji
        
        for (var k = 0; k < emojisForNode.length; k++) {
            var wordInfo = typeof getWordIndexForEmoji === 'function'
                ? getWordIndexForEmoji(textNodeName, emojisForNode[k].charIndex)
                : { wordIndex: -1 };
            
            emojiWordData.push(wordInfo);
        }
        
        // Create Apply Text Material to hide all emoji placeholders using Regex mode
        // This is simpler than calculating word indices - just match the placeholder pattern
        try {
            var applyMaterialId = api.create('applyTextMaterial', 'Hide Emoji Placeholders');
            
            // Get the current emoji placeholder from settings (default: [e])
            // Placeholder must be exactly 3 characters for font style logic to work correctly
            var currentPlaceholder = (typeof emojiPlaceholder !== 'undefined' && emojiPlaceholder.length === 3) ? emojiPlaceholder : '[e]';
            
            // Escape regex special characters in the placeholder
            // Characters that need escaping: \ ^ $ . | ? * + ( ) [ ] { }
            var escapedPlaceholder = currentPlaceholder.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&');
            
            // Configure: mode = Regex, pattern matches the placeholder
            api.set(applyMaterialId, {
                'mode': 0,  // Regex mode
                'regex': escapedPlaceholder  // Matches literal placeholder text
            });
            
            // Set alpha to 0 to make the placeholders invisible
            // Cavalry API: Must enable Fill first, then set Alpha to 0
            // https://docs.cavalry.scenegroup.co/nodes/utilities/apply-text-material/
            // "Any existing Fill must be overridden to remove it. To do this, enable the Fill and set the Alpha to 0."
            // Use api.setFill() for the fill toggle, and material.alpha for the alpha value
            api.setFill(applyMaterialId, true);   // Enable the fill override
            api.set(applyMaterialId, {
                'material.alpha': 0      // Set alpha to 0% (fully transparent)
            });
            
            // Connect to the text shape's materialBehaviours
            api.connect(applyMaterialId, 'id', textShapeId, 'materialBehaviours');
            api.parent(applyMaterialId, textShapeId);
            
        } catch (eApply) {
            console.warn('[Emoji] Could not create Apply Text Material: ' + (eApply.message || eApply));
        }
        
        // Track created emoji shapes and their characters for potential grouping
        // If 5+ emojis are in this text node, we'll group them together
        var createdEmojiShapes = [];  // Array of {shapeId, emojiChar}
        
        // Process each emoji for this text node
        for (var m = 0; m < emojisForNode.length; m++) {
            var emoji = emojisForNode[m];
            var emojiWord = emojiWordData[m];
            
            
            try {
                // Save the base64 PNG to the Quiver assets folder
                var savedPath = null;
                if (emoji.base64) {
                    try {
                        savedPath = _saveDataUriToQuiverFolder(emoji.base64, {
                            attrs: { id: 'emoji_' + emoji.emojiChar }
                        });
                    } catch (eSave) {
                        console.error('[Emoji] Failed to save image: ' + (eSave.message || eSave));
                    }
                }
                
                if (!savedPath) {
                    console.warn('[Emoji] Could not save emoji image for "' + emoji.emojiChar + '"');
                    continue;
                }
                
                
                // Create name for the emoji layer (just the emoji character)
                // Track duplicates to avoid naming conflicts
                var baseEmojiName = emoji.emojiChar;
                if (!emojiNameCounts[baseEmojiName]) {
                    emojiNameCounts[baseEmojiName] = 0;
                }
                emojiNameCounts[baseEmojiName]++;
                
                var emojiName = baseEmojiName;
                if (emojiNameCounts[baseEmojiName] > 1) {
                    emojiName = baseEmojiName + '_' + emojiNameCounts[baseEmojiName];
                }
                
                // Use WORD index for Get Sub-Mesh Transform
                // This is more reliable than character indexing because:
                // - Ligatures don't affect word count
                // - Zero-width characters don't affect word boundaries
                var wordIndex = emojiWord.wordIndex;
                
                // Validate word index against actual word count
                if (actualWordCount > 0) {
                    if (wordIndex >= actualWordCount) {
                        console.warn('[Emoji] Word index ' + wordIndex + ' exceeds actual count ' + actualWordCount + ', clamping to ' + (actualWordCount - 1));
                        wordIndex = actualWordCount - 1;
                    }
                }
                
                // Create Get Sub-Mesh Transform to get the exact word transform
                var getSubMeshId = null;
                try {
                    getSubMeshId = api.create('getSubMeshTransform', emojiName + ' Transform');
                    
                    // Configure the Get Sub-Mesh Transform:
                    // - levelMode: 2 = Words (0=Text, 1=Lines, 2=Words, 3=Characters)
                    // - useBoundingBox: true (use center of bounding box)
                    // - index: the word index containing the em-dash placeholder
                    api.set(getSubMeshId, {
                        'levelMode': 2,  // Words
                        'useBoundingBox': true,
                        'index': wordIndex
                    });
                    
                    // Connect the text shape to the Get Sub-Mesh Transform's input
                    api.connect(textShapeId, 'id', getSubMeshId, 'inputShape');
                    
                } catch (eSubMesh) {
                    console.error('[Emoji] Failed to create Get Sub-Mesh Transform: ' + (eSubMesh.message || eSubMesh));
                    continue;
                }
                
                // Create a basic rectangle shape for the emoji
                var shapeId = null;
                try {
                    shapeId = api.primitive('rectangle', emojiName);
                } catch (ePrim) {
                    console.error('[Emoji] Failed to create shape: ' + (ePrim.message || ePrim));
                    continue;
                }
                
                if (!shapeId) {
                    console.warn('[Emoji] Could not create shape for emoji');
                    continue;
                }
                
                // Set the shape dimensions (position will come from Get Sub-Mesh Transform)
                try {
                    api.set(shapeId, {
                        'generator.dimensions': [emoji.width || emoji.fontSize, emoji.height || emoji.fontSize]
                    });
                } catch (eSet) {
                    console.error('[Emoji] Failed to set shape dimensions: ' + (eSet.message || eSet));
                }
                
                // Connect Get Sub-Mesh Transform outputs to the emoji shape
                // Position, rotation, and scale for 100% accurate transform matching
                try {
                    api.connect(getSubMeshId, 'position', shapeId, 'position');
                    api.connect(getSubMeshId, 'rotation', shapeId, 'rotation');
                    api.connect(getSubMeshId, 'scale', shapeId, 'scale');
                } catch (eConnect) {
                    console.error('[Emoji] Failed to connect transform: ' + (eConnect.message || eConnect));
                }
                
                // Parent the Get Sub-Mesh Transform under the emoji shape
                try {
                    api.parent(getSubMeshId, shapeId);
                } catch (eParentSub) {}
                
                // Position emoji 1 layer ABOVE the text shape (not nested inside it)
                // Use api.reorder(layerToMove, underLayer) - moves layer to be directly UNDER another
                // To put emoji ABOVE text, find the layer currently above text and reorder emoji under it
                try {
                    var textParentId = api.getParent(textShapeId);
                    if (textParentId) {
                        // Parent emoji to the same parent as the text shape
                        api.parent(shapeId, textParentId);
                        
                        // Get siblings to find what's above the text shape
                        var siblings = api.getChildren(textParentId);
                        var textIndex = -1;
                        for (var si = 0; si < siblings.length; si++) {
                            if (siblings[si] === textShapeId) {
                                textIndex = si;
                                break;
                            }
                        }
                        
                        if (textIndex > 0) {
                            // There's a layer above the text - reorder emoji to be under that layer
                            var layerAboveText = siblings[textIndex - 1];
                            api.reorder(shapeId, layerAboveText);
                        } else {
                            // Text is at index 0 (top) - bring emoji to front
                            api.select([shapeId]);
                            api.bringToFront();
                        }
                    }
                } catch (eLayerOrder) {
                    console.warn('[Emoji] Could not reorder layer: ' + (eLayerOrder.message || eLayerOrder));
                }
                
                // Copy clipping masks from the text shape to the emoji
                // This ensures the emoji is clipped by the same masks as the text
                // Use the reverse lookup cache (getMaskShapesForTarget) which is the reliable way
                try {
                    var textMasks = getMaskShapesForTarget(textShapeId);
                    
                    if (textMasks && textMasks.length > 0) {
                        var masksConnected = 0;
                        for (var mi = 0; mi < textMasks.length; mi++) {
                            var maskLayerId = textMasks[mi];
                            try {
                                var maskName = '';
                                try { maskName = api.getNiceName(maskLayerId); } catch (eName) {}
                                
                                api.connect(maskLayerId, 'id', shapeId, 'masks');
                                addMaskShapeForTarget(shapeId, maskLayerId);
                                
                                // Only keep the mask visible if it's a visible shape being reused as matte
                                // (tracked in __shapesUsedAsMattes), otherwise it's a dedicated mask shape
                                if (typeof __shapesUsedAsMattes !== 'undefined' && __shapesUsedAsMattes[maskLayerId]) {
                                    try {
                                        api.set(maskLayerId, { 'hidden': false });
                                    } catch (eVis) {}
                                }
                                
                                masksConnected++;
                            } catch (eConnect) {
                                console.warn('[Emoji] Failed to connect mask ' + maskLayerId + ': ' + (eConnect.message || eConnect));
                            }
                        }
                    }
                } catch (eMask) {
                    console.warn('[Emoji] Could not get/apply masks: ' + (eMask.message || eMask));
                }
                
                // Copy filters from the text shape to the emoji
                // This ensures the emoji gets the same filter effects (e.g., background blur) as the text
                // Use reverse lookup (getFiltersForTarget) since api.getAttrChildren/api.get doesn't work for filter IDs
                try {
                    var textFilters = getFiltersForTarget(textShapeId);
                    
                    if (textFilters && textFilters.length > 0) {
                        var filtersConnected = 0;
                        for (var fi = 0; fi < textFilters.length; fi++) {
                            var filterLayerId = textFilters[fi];
                            try {
                                var filterName = '';
                                try { filterName = api.getNiceName(filterLayerId); } catch (eFName) {}
                                
                                api.connect(filterLayerId, 'id', shapeId, 'filters');
                                addFilterForTarget(shapeId, filterLayerId); // Track new connection
                                filtersConnected++;
                            } catch (eFilterConnect) {
                                console.warn('[Emoji] Failed to connect filter ' + filterLayerId + ': ' + (eFilterConnect.message || eFilterConnect));
                            }
                        }
                    }
                } catch (eFilter) {
                    console.warn('[Emoji] Could not get/apply filters: ' + (eFilter.message || eFilter));
                }
                
                // Load the image as an asset
                var assetId = null;
                try {
                    if (api.loadAsset) {
                        assetId = api.loadAsset(savedPath, false);
                    } else if (api.importAsset) {
                        assetId = api.importAsset(savedPath);
                    }
                } catch (eLoad) {
                    console.error('[Emoji] Failed to load asset: ' + (eLoad.message || eLoad));
                }
                
                if (assetId) {
                    // Create an image shader and connect it to the shape
                    var shaderId = null;
                    try {
                        shaderId = api.create('imageShader', emojiName);
                    } catch (eShader) {
                        console.error('[Emoji] Failed to create shader: ' + (eShader.message || eShader));
                    }
                    
                    if (shaderId) {
                        // Connect the asset to the shader's 'image' attribute
                        try {
                            api.connect(assetId, 'id', shaderId, 'image');
                        } catch (eConnAsset) {
                            console.error('[Emoji] Failed to connect asset to shader: ' + (eConnAsset.message || eConnAsset));
                        }
                        
                        // Set filter quality based on user setting (0=None, 1=Bilinear, 2=Mipmaps, 3=Bicubic)
                        try {
                            var fqSet = false;
                            try { api.set(shaderId, { 'filterQuality': imageFilterQuality }); fqSet = true; } catch (eFQ1) {}
                            if (!fqSet) { try { api.set(shaderId, { 'generator.filterQuality': imageFilterQuality }); } catch (eFQ2) {} }
                        } catch (eFQ) {}
                        
                        // Connect the shader to the shape's material
                        try {
                            api.connect(shaderId, 'id', shapeId, 'material.colorShaders');
                        } catch (eConnShape) {
                            console.error('[Emoji] Failed to connect shader to shape: ' + (eConnShape.message || eConnShape));
                        }
                        
                        // Parent the shader under the shape
                        try {
                            api.parent(shaderId, shapeId);
                        } catch (eParent) {}
                        
                        // Parent the asset under the Quiver group in Assets Window
                        var quiverGroup = _ensureQuiverAssetGroup();
                        if (quiverGroup) {
                            try {
                                api.parent(assetId, quiverGroup);
                            } catch (eAssetParent) {}
                        }
                    }
                }
                
                // Disable the shape's stroke (we just want the image)
                try {
                    api.setStroke(shapeId, false);
                } catch (eStroke) {}
                
                // Set the material color alpha to 0 so the rectangle is invisible
                try {
                    api.set(shapeId, { 'material.materialColor.a': 0 });
                } catch (eAlpha) {
                    console.error('[Emoji] Failed to set alpha: ' + (eAlpha.message || eAlpha));
                }
                
                createdCount++;
                
                // Track this shape for potential grouping
                createdEmojiShapes.push({
                    shapeId: shapeId,
                    emojiChar: emoji.emojiChar
                });
                
            } catch (eEmoji) {
                console.error('[Emoji] Failed to process emoji: ' + (eEmoji.message || eEmoji));
            }
        }
        
        // GROUP EMOJIS: If 5+ emojis were created for this text node, group them together
        // The group is named with the emoji characters (e.g., "🏹 ✨ 😍 🎯 🔥")
        if (createdEmojiShapes.length >= 5) {
            try {
                // Build the group name from all emoji characters (space-separated)
                var groupNameEmojis = [];
                for (var gi = 0; gi < createdEmojiShapes.length; gi++) {
                    groupNameEmojis.push(createdEmojiShapes[gi].emojiChar);
                }
                var emojiGroupName = groupNameEmojis.join(' ');
                
                // Create the group
                var emojiGroupId = api.create('group', emojiGroupName);
                
                // Get the parent of the first emoji shape (they should all share the same parent)
                var emojiParentId = null;
                try {
                    emojiParentId = api.getParent(createdEmojiShapes[0].shapeId);
                } catch (eGetParent) {}
                
                // Parent the group to the same parent as the emojis
                if (emojiParentId) {
                    try {
                        api.parent(emojiGroupId, emojiParentId);
                    } catch (eParentGroup) {
                        console.warn('[Emoji] Could not parent group: ' + (eParentGroup.message || eParentGroup));
                    }
                }
                
                // Re-parent all emoji shapes under the group
                for (var ri = 0; ri < createdEmojiShapes.length; ri++) {
                    try {
                        api.parent(createdEmojiShapes[ri].shapeId, emojiGroupId);
                    } catch (eReparent) {
                        console.warn('[Emoji] Could not re-parent emoji to group: ' + (eReparent.message || eReparent));
                    }
                }
                
                // Position the group above the text shape
                try {
                    var siblings = api.getChildren(emojiParentId);
                    var textIndex = -1;
                    for (var si = 0; si < siblings.length; si++) {
                        if (siblings[si] === textShapeId) {
                            textIndex = si;
                            break;
                        }
                    }
                    
                    if (textIndex > 0) {
                        var layerAboveText = siblings[textIndex - 1];
                        api.reorder(emojiGroupId, layerAboveText);
                    } else {
                        api.select([emojiGroupId]);
                        api.bringToFront();
                    }
                } catch (eReorder) {}
                
                
            } catch (eGroup) {
                console.warn('[Emoji] Could not create emoji group: ' + (eGroup.message || eGroup));
            }
        }
    }
    
}

/**
 * Fallback emoji processing using calculated coordinates (less accurate)
 * Used when the text shape cannot be found for Get Sub-Mesh Transform
 * 
 * @param {Object} emoji - Emoji data from Figma
 * @param {Object} viewBox - The SVG viewBox
 * @returns {number} 1 if created successfully, 0 otherwise
 */
function processEmojiWithFallback(emoji, viewBox) {
    try {
        // Save the base64 PNG to the Quiver assets folder
        var savedPath = null;
        if (emoji.base64) {
            try {
                savedPath = _saveDataUriToQuiverFolder(emoji.base64, {
                    attrs: { id: 'emoji_' + emoji.emojiChar }
                });
            } catch (eSave) {
                console.error('[Emoji Fallback] Failed to save image: ' + (eSave.message || eSave));
            }
        }
        
        if (!savedPath) {
            return 0;
        }
        
        // Convert Figma position to Cavalry coordinates
        var inputX = emoji.x + (emoji.width / 2);
        var inputY = emoji.y + (emoji.height / 2);
        var cavalryPos = svgToCavalryPosition(inputX, inputY, viewBox);
        
        var emojiName = 'Emoji ' + emoji.emojiChar;
        
        // Create shape
        var shapeId = api.primitive('rectangle', emojiName);
        if (!shapeId) return 0;
        
        api.set(shapeId, {
            'generator.dimensions': [emoji.width, emoji.height],
            'position.x': cavalryPos.x,
            'position.y': cavalryPos.y
        });
        
        // Load and apply image
        var assetId = api.loadAsset ? api.loadAsset(savedPath, false) : null;
        if (assetId) {
            var shaderId = api.create('imageShader', emojiName);
            if (shaderId) {
                api.connect(assetId, 'id', shaderId, 'image');
                
                // Set filter quality based on user setting (0=None, 1=Bilinear, 2=Mipmaps, 3=Bicubic)
                try {
                    var fqSet = false;
                    try { api.set(shaderId, { 'filterQuality': imageFilterQuality }); fqSet = true; } catch (eFQ1) {}
                    if (!fqSet) { try { api.set(shaderId, { 'generator.filterQuality': imageFilterQuality }); } catch (eFQ2) {} }
                } catch (eFQ) {}
                
                api.connect(shaderId, 'id', shapeId, 'material.colorShaders');
                api.parent(shaderId, shapeId);
            }
        }
        
        api.setStroke(shapeId, false);
        api.set(shapeId, { 'material.materialColor.a': 0 });
        
        return 1;
        
    } catch (e) {
        console.error('[Emoji Fallback] Failed: ' + (e.message || e));
        return 0;
    }
}

/**
 * Handle clipboard import request
 */
function handleImportFromClipboard(request) {
    // Show loading indicator before import starts
    var loadingLayers = showLoadingIndicator();
    
    try {
        var svg = api.getClipboardText();
        if (!svg || svg.trim() === '') {
            hideLoadingIndicator(loadingLayers);
            console.error("🏹 Quiver: Clipboard is empty");
            return;
        }
        processAndImportSVG(svg);
        console.info("🏹 Quiver: Clipboard imported successfully");
        
        // Hide loading indicator after import
        hideLoadingIndicator(loadingLayers);
    } catch (e) {
        // Hide loading indicator even on error
        hideLoadingIndicator(loadingLayers);
        console.error("🏹 Quiver: Clipboard import failed - " + e.message);
    }
}

/**
 * Handle Figma-specific import (future implementation)
 */
function handleImportFromFigma(request) {
    console.info("🏹 Quiver: Figma import received");
    
    // TODO: Implement direct Figma data conversion
    // This would parse Figma's JSON format and create Cavalry layers directly
    // without going through SVG conversion
}

/**
 * Handle ping request (for connection testing)
 * Silent by default to avoid log spam from periodic checks
 */
function handlePing() {
    // Silent - only log on explicit ping requests
    // Periodic connection checks don't need logging
}

/**
 * Cleanup function to stop the web server and free resources
 * Should be called when the UI window closes to prevent heap corruption
 */
function cleanupQuiverWebServer() {
    try {
        if (quiverServer && Quiver.serverRunning) {
            // Try to stop the server if stop method is available
            if (typeof quiverServer.stop === 'function') {
                quiverServer.stop();
            }
            // Clear the server reference
            quiverServer = null;
            Quiver.serverRunning = false;
            console.info("🏹 Quiver: Web server stopped");
        }
    } catch (e) {
        // Silently handle cleanup errors - server may already be stopped
        quiverServer = null;
        Quiver.serverRunning = false;
    }
}

// Export cleanup function globally
Quiver.cleanup = cleanupQuiverWebServer;

// Initialize the server
initializeQuiverWebServer();

// Module loaded successfully
undefined;
