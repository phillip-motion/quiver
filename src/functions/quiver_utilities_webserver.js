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

/**
 * Handle SVG import request
 */
function handleImportSVG(request) {
    try {
        processAndImportSVG(request.svgCode);
        console.info("🏹 Quiver: SVG imported successfully");
        
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
        console.error("🏹 Quiver: Import failed - " + e.message);
    }
}

/**
 * Handle clipboard import request
 */
function handleImportFromClipboard(request) {
    try {
        var svg = api.getClipboardText();
        if (!svg || svg.trim() === '') {
            console.error("🏹 Quiver: Clipboard is empty");
            return;
        }
        processAndImportSVG(svg);
        console.info("🏹 Quiver: Clipboard imported successfully");
    } catch (e) {
        console.error("🏹 Quiver: Clipboard import failed - " + e.message);
    }
}

/**
 * Handle Figma-specific import (future implementation)
 */
function handleImportFromFigma(request) {
    console.info("🏹 Quiver: Figma import received");
    console.info("   Direct Figma import coming soon!");
    console.info("   For now, export as SVG from Figma and use importSVG action");
    
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
