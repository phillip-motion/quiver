// ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// This file is generated from /src/Quiver-Dev.js and /src/functions/
// Make changes in /src/ and run: npm run build

// Quiver 🏹 - Development Version
// Fire SVGs straight into Cavalry.
// 
// 📝 This is the SOURCE file for development.
// When ready for production, run: npm run build
//


// IMPORTANT!!!!!! Version number must be in the format x.x.x for update checking to work!!!
const currentVersion = "1.6.0";

const SCRIPT_KEY = "com.canva.quiver"; 
ui.setTitle("Quiver");
ui.setBackgroundColor("#2d2d2d");



// ========================================
// Bundled Functions
// ========================================

// ----------------------------------------
// quiver_utilities_checkVersion.js
// ----------------------------------------
// Check Update from Github
// Usage:
//   1. Create a versions.json file in the root of your repository with the following format:
//      {
//          "scriptName": "1.0.0"
//      }
//   2. Paste this entire code block
//   3. Call the function:
//      // Default (console warning)
//      checkForUpdate(GITHUB_REPO, scriptName, currentVersion);
//
//      // Advanced (UI callback)
//      checkForUpdate(GITHUB_REPO, scriptName, currentVersion, function(updateAvailable, newVersion) {
//          if (updateAvailable) {
//              statusLabel.setText("⚠ Update " + newVersion + " available!");
//          }
//      });

var GITHUB_REPO = "phillip-motion/Quiver";
var scriptName = "Quiver";  // Must match key your repo's versions.json
// var currentVersion = currentVersion;

function compareVersions(v1, v2) {
    /* Compare two semantic version strings (e.g., "1.0.0" vs "1.0.1") */
    var parts1 = v1.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    var parts2 = v2.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    
    for (var i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        var num1 = parts1[i] || 0;
        var num2 = parts2[i] || 0;
        
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    
    return 0;
}


function checkForUpdate(githubRepo, scriptName, currentVersion, callback) {
    // Uncomment below to reset the version check for testing
    // api.setPreferenceObject(scriptName + "_update_check", {
    //     lastCheck: null,
    //     latestVersion: null
    // });
    
    var now = new Date().getTime();
    var oneDayAgo = now - (24 * 60 * 60 * 1000);
    var shouldFetchFromGithub = true;
    var cachedLatestVersion = null;
    
    // Check if we have cached data
    if (api.hasPreferenceObject(scriptName + "_update_check")) {
        var prefs = api.getPreferenceObject(scriptName + "_update_check");
        cachedLatestVersion = prefs.latestVersion;
        
        // If we checked recently, use cached version (don't fetch from GitHub)
        if (prefs.lastCheck && prefs.lastCheck > oneDayAgo) {
            shouldFetchFromGithub = false;
        }
    }
    
    // If we don't need to fetch, just compare current version to cached latest
    if (!shouldFetchFromGithub && cachedLatestVersion) {
        var updateAvailable = compareVersions(cachedLatestVersion, currentVersion) > 0;
        if (updateAvailable) {
            console.warn(scriptName + ' ' + cachedLatestVersion + ' update available (you have ' + currentVersion + '). Download at github.com/' + githubRepo);
            if (callback) callback(true, cachedLatestVersion);
        } else {
            if (callback) callback(false);
        }
        return;
    }
    
    // Perform the version check
    try {
        var path = "/" + githubRepo + "/main/versions.json";
        var client = new api.WebClient("https://raw.githubusercontent.com");
        client.get(path);
        
        if (client.status() === 200) {
            var versions = JSON.parse(client.body());
            var latestVersion = versions[scriptName];
            
            if (!latestVersion) {
                console.warn("Version check: Script name '" + scriptName + "' not found in versions.json");
                if (callback) callback(false);
                return;
            }
            
            // Remove 'v' prefix if present (e.g., "v1.0.0" -> "1.0.0")
            if (latestVersion.startsWith('v')) {
                latestVersion = latestVersion.substring(1);
            }
            
            // Save latest version to preferences (always save, regardless of comparison)
            api.setPreferenceObject(scriptName + "_update_check", {
                lastCheck: new Date().getTime(),
                latestVersion: latestVersion
            });
            
            // Compare and notify if update available
            var updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
            if (updateAvailable) {
                console.warn(scriptName + ' ' + latestVersion + ' update available (you have ' + currentVersion + '). Download at github.com/' + githubRepo);
                if (callback) callback(true, latestVersion);
            } else {
                if (callback) callback(false);
            }
        } else {
            if (callback) callback(false);
        }
    } catch (e) {
        if (callback) callback(false);
    }
}

// Version check runs automatically (stores result in scriptName + "_update_check" preference)
checkForUpdate(GITHUB_REPO, scriptName, currentVersion);

// End update checker



// ========================================
// Bundled Functions
// ========================================

// ----------------------------------------
// quiver_createUI.js
// ----------------------------------------
// --- Icon Button Helper ---
// Create icon buttons with unicode symbols
function createIconButton(symbol, tooltip, size) {
    size = size || 32;
    var btn = new ui.Button(symbol);
    btn.setSize(size, size);
    if (tooltip) btn.setToolTip(tooltip);
    return btn;
}



var pasteButton = new ui.ImageButton(ui.scriptLocation + "/quiver_assets/quiver_text-paste.png");
pasteButton.setImageSize(61,22);
pasteButton.setMinimumHeight(36);
pasteButton.setToolTip("Paste SVG content from clipboard");

pasteButton.onClick = function() {
    try {
        // Get SVG from clipboard
        var svgCode = '';
        try {
            svgCode = api.getClipboardText();
        } catch (clipboardError) {
            console.error('Error accessing clipboard: ' + clipboardError.toString());
            return;
        }
        
        // Validate clipboard content
        if (!svgCode || (svgCode + '').trim() === '') {
            console.error('No content found in clipboard');
            return;
        }
        
        if (!svgCode.includes('<svg') || !svgCode.includes('</svg>')) {
            console.error('No valid SVG found in clipboard');
            return;
        }
        
        // Check if auto-save is enabled
        if (autoSaveEnabled) {
            // Attempt to save the scene before importing
            console.info('Saving scene...');
            var saved = saveSceneBeforeImport();
            
            if (saved) {
                console.info('Scene saved. Parsing…');
            } else {
                console.error('Could not save. Parsing…');
            }
        }
        
        // Process the SVG
        processAndImportSVG(svgCode);
        
    } catch (e) {
        var errorMsg = e && e.message ? e.message : 'Import failed';
        // Skip undefined/null error messages
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
    }
};

// Import from file button
var importFileButton = new ui.ImageButton(ui.scriptLocation + "/quiver_assets/quiver_text-import.png");
importFileButton.setImageSize(70,22);
importFileButton.setMinimumHeight(36);
importFileButton.setToolTip("Import SVG file from your computer");
importFileButton.onClick = function() {
    // Open file dialog - use project path if available, otherwise empty string
    var startPath = "";
    try {
        startPath = api.getProjectPath() || "";
} catch (e) {
        // No project open, use empty string
    }
    var filePath = api.presentOpenFile(startPath, "Select SVG file", "SVG files (*.svg)");
    
    if (!filePath || filePath === "") {
        console.error("No file selected");
        return;
    }

    try {
        // Try to read the file contents
        var fileContents = null;
        
        try {
            fileContents = api.readFromFile(filePath);
        } catch (readError) {
            // Alternative: Use Cavalry's built-in SVG importer
            try {
                // Auto-save if enabled
                if (autoSaveEnabled) {
                    var saved = saveSceneBeforeImport();
                    if (!saved) {
                        // Could not auto-save before using convertSVGToLayers
                    }
                }
                
                // Use Cavalry's native SVG import
                var importedLayers = api.convertSVGToLayers(filePath);
                if (importedLayers && importedLayers.length > 0) {
                    console.info('🏹 Import complete - ' + importedLayers.length + ' layers imported');
                    return;
                }
            } catch (convertError) {
                // convertSVGToLayers also failed
            }
            
            // If both methods fail, show error
            console.error("❌ Unable to read SVG file");
            return;
        }
        
        if (!fileContents || fileContents.trim() === "") {
            console.error("❌ File is empty");
            return;
        }
        
        // Auto-save if enabled
        if (autoSaveEnabled) {
            var saved = saveSceneBeforeImport();
            
            if (saved) {
                console.info('Scene saved. Processing file...');
            } else {
                console.error('Could not save. Processing file...');
            }
        }
        
        // Process the SVG content
        processAndImportSVG(fileContents);
        
    } catch (error) {
        console.error("❌ Error reading file");
    }
};



var statusLabel = new ui.Label("Ready to import");
statusLabel.setMinimumHeight(20);

// Override setText to prevent undefined errors
var originalSetText = statusLabel.setText;
statusLabel.setText = function(text) {
    // Filter out "Error: undefined" and "Error: null" messages
    if (text === "Error: undefined" || text === "Error: null" || 
        text === "undefined" || text === "null") {
        return;
    }
    originalSetText.call(this, text);
};

// Settings values (stored for modal)
var autoSaveEnabled = true;
var keepOriginalEnabled = false;
var defaultRadius = "";
var importGradientsEnabled = true;
var importLiveTextEnabled = true;
var importEmojisEnabled = true;
var importImageryEnabled = true;
var importEffectsEnabled = true;
var importGroupsEnabled = true;
var imageFilterQuality = 2; // 0=None, 1=Bilinear, 2=Mipmaps (default), 3=Bicubic
var emojiPlaceholder = "[e]"; // Placeholder string for emoji positions (must be at least 2 chars)

// Settings button
var settingsButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-settings.png");
settingsButton.setImageSize(22,22);
settingsButton.setSize(35, 35);
settingsButton.setToolTip("Settings");

// Create icon buttons

var convertRectButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-rectangle.png");
convertRectButton.setImageSize(22,22);
convertRectButton.setSize(34, 34);
convertRectButton.setToolTip("Convert to Rectangle");

convertRectButton.onClick = function(evt) {
    try {
        convertSelectionToRect(keepOriginalEnabled);
    } catch (e) {}
};


var dynamicAlignButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-align.png");
dynamicAlignButton.setImageSize(22,22);
dynamicAlignButton.setSize(34, 34);
dynamicAlignButton.setToolTip("Dynamic Align");

dynamicAlignButton.onClick = function() {
    try {
        var sel = null; try { sel = api.getSelection(); } catch (e) { sel = null; }
        if (!sel || !sel.length) { console.error('Select at least one layer'); return; }
        var applied = 0;
        for (var i = 0; i < sel.length; i++) { if (applyDynamicAlignToLayer(sel[i])) applied++; }
        console.info(applied ? ('Dynamic Align applied to ' + applied + ' layer(s)') : 'No valid layers for Dynamic Align');
    } catch (e) { console.error('Dynamic Align error: ' + e.message); }
};

var flattenShapeButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-flatten.png");
flattenShapeButton.setImageSize(22,22);
flattenShapeButton.setSize(34, 34);
flattenShapeButton.setToolTip("Flatten Shape");
flattenShapeButton.onClick = function() {
    flattenShape();
};

var cycleTextAlignButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-text-horizontal-left.png");
cycleTextAlignButton.setImageSize(22,22);
cycleTextAlignButton.setSize(34, 34);
cycleTextAlignButton.setToolTip("Horizontal Text Alignment");
cycleTextAlignButton.onClick = function() {
    cycleTextAlignment();
    // Update icon after cycling alignment
    updateTextAlignIcon();
};

var cycleVerticalTextAlignButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-text-vertical-top.png");
cycleVerticalTextAlignButton.setImageSize(22,22);
cycleVerticalTextAlignButton.setSize(34, 34);
cycleVerticalTextAlignButton.setToolTip("Vertical Text Alignment");
cycleVerticalTextAlignButton.onClick = function() {
    cycleVerticalTextAlignment();
    // Update icon after cycling alignment
    updateVerticalTextAlignIcon();
};

/**
 * Update the Text Alignment button icon based on selected text's alignment.
 * Uses api.getSelection(), api.getType(), api.get() to determine alignment.
 * Uses setImage() to dynamically update the ImageButton icon.
 * 
 * Cavalry API used:
 * - api.getSelection() - Get selected layers
 * - api.getType(id) - Get layer type
 * - api.get(id, attribute) - Get layer attributes
 * - ImageButton.setImage(path) - Set button image
 * 
 * Cavalry horizontalAlignment values (from Text Shape node documentation):
 * 0 = Left, 1 = Centre, 2 = Right, 3 = Justified
 */
function updateTextAlignIcon() {
    try {
        var selection = api.getSelection();
        
        // Default to left-aligned icon when no text is selected
        var iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-horizontal-left.png";
        
        if (selection && selection.length > 0) {
            // Check each selected layer for text shapes
            for (var i = 0; i < selection.length; i++) {
                var layerId = selection[i];
                var isTextShape = false;
                
                // Check if this is a text shape by ID prefix
                if (typeof layerId === 'string' && layerId.indexOf('textShape#') === 0) {
                    isTextShape = true;
                }
                
                // Also check by layer type
                if (!isTextShape) {
                    try {
                        var layerType = api.getType(layerId);
                        if (layerType === 'textShape' || layerType === 'text') {
                            isTextShape = true;
                        }
                    } catch (e) {}
                }
                
                if (isTextShape) {
                    // Get the alignment of this text shape
                    try {
                        var alignment = api.get(layerId, 'horizontalAlignment');
                        // Cavalry horizontalAlignment values (from Text Shape node documentation):
                        // 0 = Left, 1 = Centre, 2 = Right, 3 = Justified
                        if (alignment === 1) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-horizontal-center.png";
                        } else if (alignment === 2) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-horizontal-right.png";
                        } else if (alignment === 3) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-horizontal-justified.png";
                        } else {
                            // 0 (Left) - show left icon
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-horizontal-left.png";
                        }
                    } catch (e) {}
                    break; // Use first text shape found
                }
            }
        }
        
        // Update the button image
        cycleTextAlignButton.setImage(iconPath);
    } catch (e) {
        // Silently fail - don't disrupt UI
    }
}

/**
 * Update the Vertical Text Alignment button icon based on selected text's alignment.
 * Uses api.getSelection(), api.getType(), api.get() to determine vertical alignment.
 * Uses setImage() to dynamically update the ImageButton icon.
 * 
 * Cavalry API used:
 * - api.getSelection() - Get selected layers
 * - api.getType(id) - Get layer type
 * - api.get(id, attribute) - Get layer attributes
 * - ImageButton.setImage(path) - Set button image
 * 
 * verticalAlignment values: 0 = Top, 1 = Centre, 2 = Bottom, 3 = Baseline
 */
function updateVerticalTextAlignIcon() {
    try {
        var selection = api.getSelection();
        
        // Default to top-aligned icon when no text is selected
        var iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-vertical-top.png";
        
        if (selection && selection.length > 0) {
            // Check each selected layer for text shapes
            for (var i = 0; i < selection.length; i++) {
                var layerId = selection[i];
                var isTextShape = false;
                
                // Check if this is a text shape by ID prefix
                if (typeof layerId === 'string' && layerId.indexOf('textShape#') === 0) {
                    isTextShape = true;
                }
                
                // Also check by layer type
                if (!isTextShape) {
                    try {
                        var layerType = api.getType(layerId);
                        if (layerType === 'textShape' || layerType === 'text') {
                            isTextShape = true;
                        }
                    } catch (e) {}
                }
                
                if (isTextShape) {
                    // Get the vertical alignment of this text shape
                    try {
                        var alignment = api.get(layerId, 'verticalAlignment');
                        // Cavalry verticalAlignment values (from Text Shape node documentation):
                        // 0 = Top, 1 = Centre, 2 = Bottom, 3 = Baseline
                        if (alignment === 1) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-vertical-middle.png";
                        } else if (alignment === 2) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-vertical-bottom.png";
                        } else if (alignment === 3) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-vertical-baseline.png";
                        } else {
                            // 0 (Top) - show top icon
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-vertical-top.png";
                        }
                    } catch (e) {}
                    break; // Use first text shape found
                }
            }
        }
        
        // Update the button image
        cycleVerticalTextAlignButton.setImage(iconPath);
    } catch (e) {
        // Silently fail - don't disrupt UI
    }
}


// Renamer
var renamerInput = new ui.LineEdit();
renamerInput.setMinimumHeight(36);
renamerInput.setContentsMargins(6,6,6,6);
renamerInput.setCornerRounding(4);
renamerInput.setBackgroundColor(ui.getThemeColor("Window"));
renamerInput.setPlaceholder("Rename layers...");

var renamerButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-apply.png");
renamerButton.setImageSize(22,22);
renamerButton.setSize(34, 34);
renamerButton.setToolTip("Rename");
renamerButton.onClick = function() {
    try {
        renameSelectedLayers();
    } catch (e) {
        console.error('Rename error: ' + e.message);
    }
};

// Settings window
var settingsWindow;

// Create settings window
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.close();
        settingsWindow = null;
        return;
    }

    settingsWindow = new ui.Container();
    settingsWindow.setMinimumWidth(350);
    settingsWindow.setMinimumHeight(520);
    settingsWindow.setBackgroundColor(ui.getThemeColor("Base"));
    
    var settingsLayout = new ui.VLayout();
    settingsLayout.setMargins(15, 15, 15, 15);
    settingsLayout.setSpaceBetween(4);
    
    // Settings header
    var titleLabel = new ui.Label("Settings");
    titleLabel.setTextColor(ui.getThemeColor("Light"));
    titleLabel.setFontSize(18);
    settingsLayout.add(titleLabel);
    settingsLayout.addSpacing(12);

// Auto-save option

    var autoSaveLayout = new ui.HLayout();
    var autoSaveCheckbox = new ui.Checkbox(autoSaveEnabled);
    // Force set the value
    if (autoSaveEnabled) {
        autoSaveCheckbox.setValue(true);
    } else {
        autoSaveCheckbox.setValue(false);
    }
    autoSaveCheckbox.onValueChanged = function() {
        autoSaveEnabled = autoSaveCheckbox.getValue();
    };
    autoSaveLayout.add(autoSaveCheckbox);
    autoSaveLayout.add(new ui.Label("Auto-save before import"));
    autoSaveLayout.setSpaceBetween(8);
    settingsLayout.add(autoSaveLayout);
    
    // Import groups checkbox
    var groupsLayout = new ui.HLayout();
    var importGroupsCheckbox = new ui.Checkbox(importGroupsEnabled);
    importGroupsCheckbox.onValueChanged = function() {
        importGroupsEnabled = importGroupsCheckbox.getValue();
    };
    groupsLayout.add(importGroupsCheckbox);
    groupsLayout.add(new ui.Label("Import groups"));
    groupsLayout.setSpaceBetween(8);
    settingsLayout.add(groupsLayout);

    // Import gradients checkbox
    var gradientsLayout = new ui.HLayout();
    var importGradientsCheckbox = new ui.Checkbox(importGradientsEnabled);
    importGradientsCheckbox.onValueChanged = function() {
        importGradientsEnabled = importGradientsCheckbox.getValue();
    };
    gradientsLayout.add(importGradientsCheckbox);
    gradientsLayout.add(new ui.Label("Import gradients"));
    gradientsLayout.setSpaceBetween(8);
    settingsLayout.add(gradientsLayout);
    
    // Import live text checkbox
    var liveTextLayout = new ui.HLayout();
    var importLiveTextCheckbox = new ui.Checkbox(importLiveTextEnabled);
    importLiveTextCheckbox.onValueChanged = function() {
        importLiveTextEnabled = importLiveTextCheckbox.getValue();
    };
    liveTextLayout.add(importLiveTextCheckbox);
    liveTextLayout.add(new ui.Label("Import live text"));
    liveTextLayout.setSpaceBetween(8);
    settingsLayout.add(liveTextLayout);
    
    // Import emojis checkbox
    var emojisLayout = new ui.HLayout();
    var importEmojisCheckbox = new ui.Checkbox(importEmojisEnabled);
    importEmojisCheckbox.onValueChanged = function() {
        importEmojisEnabled = importEmojisCheckbox.getValue();
    };
    emojisLayout.add(importEmojisCheckbox);
    emojisLayout.add(new ui.Label("Import emojis"));
    emojisLayout.setSpaceBetween(8);
    settingsLayout.add(emojisLayout);
    
    // Import imagery checkbox
    var imageryLayout = new ui.HLayout();
    var importImageryCheckbox = new ui.Checkbox(importImageryEnabled);
    importImageryCheckbox.onValueChanged = function() {
        importImageryEnabled = importImageryCheckbox.getValue();
    };
    imageryLayout.add(importImageryCheckbox);
    imageryLayout.add(new ui.Label("Import imagery"));
    imageryLayout.setSpaceBetween(8);
    settingsLayout.add(imageryLayout);
    
    // Import effects checkbox
    var effectsLayout = new ui.HLayout();
    var importEffectsCheckbox = new ui.Checkbox(importEffectsEnabled);
    importEffectsCheckbox.onValueChanged = function() {
        importEffectsEnabled = importEffectsCheckbox.getValue();
    };
    effectsLayout.add(importEffectsCheckbox);
    effectsLayout.add(new ui.Label("Import effects (blur, drop shadow)"));
    effectsLayout.setSpaceBetween(8);
    settingsLayout.add(effectsLayout);
    
    // Image quality dropdown
    var qualityLayout = new ui.HLayout();
    qualityLayout.add(new ui.Label("Image quality"));
    
    var filterQualityDropdown = new ui.DropDown();
    filterQualityDropdown.addEntry("None (Fastest)");
    filterQualityDropdown.addEntry("Bilinear");
    filterQualityDropdown.addEntry("Mipmaps (Use For Scaling Down)");
    filterQualityDropdown.addEntry("Bicubic (Use For Scaling Up)");
    filterQualityDropdown.setValue(imageFilterQuality);
    filterQualityDropdown.onValueChanged = function() {
        imageFilterQuality = filterQualityDropdown.getValue();
    };
    qualityLayout.addStretch();
    
    qualityLayout.add(filterQualityDropdown);
    settingsLayout.add(qualityLayout);
    
    // Emoji placeholder setting
    var emojiPlaceholderLayout = new ui.HLayout();
    emojiPlaceholderLayout.add(new ui.Label("Emoji placeholder"));
    var emojiPlaceholderInput = new ui.LineEdit();
    emojiPlaceholderInput.setText(emojiPlaceholder);
    emojiPlaceholderInput.setPlaceholder("[e]");
    emojiPlaceholderInput.setMaximumWidth(60);
    emojiPlaceholderInput.onTextChanged = function() {
        var newValue = emojiPlaceholderInput.getText();
        // Require exactly 3 characters for the placeholder to work correctly with font style logic
        if (newValue.length === 3) {
            emojiPlaceholder = newValue;
        } else if (newValue.length > 0 && newValue.length !== 3) {
            // Show warning but don't update the value yet
            console.warn("Emoji placeholder must be exactly 3 characters");
        }
    };
    emojiPlaceholderLayout.addStretch();
    emojiPlaceholderLayout.add(emojiPlaceholderInput);
    settingsLayout.add(emojiPlaceholderLayout);
    
    settingsLayout.addSpacing(16);
    
    // Rectangle conversion options
    rectangleConversionLabel = new ui.Label("Rectangle conversion settings");
    rectangleConversionLabel.setTextColor("#969696");
    settingsLayout.add(rectangleConversionLabel);
    
    var radiusLayout = new ui.HLayout();
    radiusLayout.add(new ui.Label("Default radius"));
var cornerRadiusInput = new ui.LineEdit();
    cornerRadiusInput.setText(defaultRadius);
    cornerRadiusInput.setPlaceholder("15");
    cornerRadiusInput.setMaximumWidth(60);
    cornerRadiusInput.onTextChanged = function() {
        defaultRadius = cornerRadiusInput.getText();
    };
    radiusLayout.addStretch();
    radiusLayout.add(cornerRadiusInput);
    settingsLayout.add(radiusLayout);
    
    var keepLayout = new ui.HLayout();
    var keepOriginalCheckbox = new ui.Checkbox(keepOriginalEnabled);
    // Force set the value
    if (keepOriginalEnabled) {
        keepOriginalCheckbox.setValue(true);
    } else {
        keepOriginalCheckbox.setValue(false);
    }
    keepOriginalCheckbox.onValueChanged = function() {
        keepOriginalEnabled = keepOriginalCheckbox.getValue();
    };
    keepLayout.add(keepOriginalCheckbox);
    keepLayout.add(new ui.Label("Keep original shapes"));
    keepLayout.setSpaceBetween(8);
    settingsLayout.add(keepLayout);        

    settingsLayout.addSpacing(15);
    
    // Button layout
    var buttonLayout = new ui.HLayout();
    buttonLayout.setSpaceBetween(10);
    
    // Apply button
    var applyButton = new ui.Button("Apply");
    applyButton.setMinimumHeight(24);
    applyButton.onClick = function() {
        // Force capture all values
        autoSaveEnabled = autoSaveCheckbox.getValue();
        keepOriginalEnabled = keepOriginalCheckbox.getValue();
        defaultRadius = cornerRadiusInput.getText();
        importGradientsEnabled = importGradientsCheckbox.getValue();
        importLiveTextEnabled = importLiveTextCheckbox.getValue();
        importEmojisEnabled = importEmojisCheckbox.getValue();
        importImageryEnabled = importImageryCheckbox.getValue();
        importEffectsEnabled = importEffectsCheckbox.getValue();
        importGroupsEnabled = importGroupsCheckbox.getValue();
        imageFilterQuality = filterQualityDropdown.getValue();
        
        // Capture emoji placeholder with validation - must be exactly 3 characters
        var emojiValue = emojiPlaceholderInput.getText();
        if (emojiValue.length === 3) {
            emojiPlaceholder = emojiValue;
        } else {
            console.warn("Emoji placeholder must be exactly 3 characters - keeping current value: " + emojiPlaceholder);
            emojiPlaceholderInput.setText(emojiPlaceholder); // Reset to valid value
        }
        
        console.info("Settings applied");
    };
    
    // Close button
    var closeButton = new ui.Button("Close");
    closeButton.setMinimumHeight(24);
    closeButton.onClick = function() {
        settingsWindow.close();
        settingsWindow = null;
    };
    
    buttonLayout.add(applyButton);
    buttonLayout.add(closeButton);
    settingsLayout.add(buttonLayout);
    
    settingsLayout.addSpacing(32);
    
    // Version info
    var settingsLogo = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_logo.png");
    settingsLogo.setImageSize(106, 35);
    settingsLogo.setDrawStroke(false);
    settingsLogo.setBackgroundColor(ui.getThemeColor("Base"));
    settingsLogo.setTransparentForMouseEvents(true);
    settingsLayout.add(settingsLogo);
    settingsLayout.addSpacing(10);
    var sloganLabel = new ui.Label("Fire SVGs from Figma into Cavalry 🏹");
    sloganLabel.setTextColor("#bebebe");
    sloganLabel.setAlignment(1); // Center align
    settingsLayout.add(sloganLabel);
    var versionLabel = new ui.Label("Version " + currentVersion);
    versionLabel.setAlignment(1); // Center align
    versionLabel.setTextColor("#bebebe");
    settingsLayout.add(versionLabel);
    
    // Fine print
    settingsLayout.addSpacing(16);
    var finePrint1 = new ui.Label("Any q's or bugs?");
    finePrint1.setTextColor("#969696");
    finePrint1.setAlignment(1); // Center align
    settingsLayout.add(finePrint1);

    var finePrint2 = new ui.Label("Raise an issue on GitHub.");
    finePrint2.setTextColor("#969696");
    finePrint2.setAlignment(1); // Center align
    settingsLayout.add(finePrint2);

    var finePrintCredit = new ui.Label("Made by the Canva Creative Team");
    finePrintCredit.setAlignment(1); // Center align
    finePrintCredit.setTextColor("#969696");
    settingsLayout.add(finePrintCredit);

    var openGitHubButton = new ui.Button("Open GitHub Repo");
    openGitHubButton.setMinimumHeight(24);
    openGitHubButton.onClick = function() {
        api.openURL("https://github.com/phillip-motion/quiver");
    };
    settingsLayout.add(openGitHubButton);
    var openCreativeTeamButton = new ui.Button("canvacreative.team/motion");
    openCreativeTeamButton.setMinimumHeight(24);
    openCreativeTeamButton.onClick = function() {
        api.openURL("https://canvacreative.team/motion");
    };
    settingsLayout.add(openCreativeTeamButton);

    settingsLayout.addSpacing(5);
    settingsLayout.addStretch();
    
    settingsWindow.setLayout(settingsLayout);
    
    // Position relative to main window
    settingsWindow.move(50, 50);
    settingsWindow.show();
}

settingsButton.onClick = function() {
    createSettingsWindow();
};

// Create main layout
var mainLayout = new ui.VLayout();
mainLayout.setSpaceBetween(0);
mainLayout.setMargins(0, 0, 0, 0);

// Top row with settings button
var headerLayout = new ui.HLayout();


var newVersionAvailableLayout = new ui.HLayout();
newVersionAvailableLayout.setMargins(6, 0, 3, 6);

var newVersionAvailableLabel = new ui.Label("New version available");
newVersionAvailableLabel.setMinimumWidth(120);
newVersionAvailableLabel.setContentsMargins(0,7,0,0);

newVersionAvailableLabel.setTextColor("#ffffff");
newVersionAvailableLayout.add(newVersionAvailableLabel);

var newVersionAvailableButton = new ui.Button("Update");
newVersionAvailableButton.setMinimumHeight(24);
newVersionAvailableButton.onClick = function() {
    api.openURL("https://github.com/phillip-motion/quiver/releases/latest");
};
newVersionAvailableLayout.addStretch();
newVersionAvailableLayout.add(newVersionAvailableButton);

var newVersionAvailable = new ui.Container();
newVersionAvailable.setBackgroundColor("#4a53fa");
// newVersionAvailable.setRadius(3,3,3,3);
newVersionAvailable.setLayout(newVersionAvailableLayout);

// Check if there's a newer version available (version checker stores in scriptName + "_update_check")
if (api.hasPreferenceObject(scriptName + "_update_check")) {
    var updatePrefs = api.getPreferenceObject(scriptName + "_update_check");
    if (updatePrefs.latestVersion && compareVersions(updatePrefs.latestVersion, currentVersion) > 0) {
        mainLayout.add(newVersionAvailable);
    }
}


// Import Section
var mainButtonsContainer = new ui.Container();
mainButtonsContainer.setBackgroundColor(ui.getThemeColor("AlternateBase"));

var mainButtons = new ui.HLayout();
mainButtons.setSpaceBetween(6);
mainButtons.setMargins(6,6,6,6);

var logo = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon.png");
logo.setImageSize(28, 29);
logo.setBackgroundColor(ui.getThemeColor("AlternateBase"));
logo.setDrawStroke(false);
logo.setTransparentForMouseEvents(true);
logo.setSize(28, 29);

mainButtons.add(logo);
mainButtons.add(pasteButton);
mainButtons.add(importFileButton);
mainButtonsContainer.setLayout(mainButtons);
mainLayout.add(mainButtonsContainer);

// // Tool buttons
// var toolsLabel = new ui.Label("Tools");
// toolsLabel.setTextColor("#969696");
// mainLayout.add(toolsLabel);

// Main tool buttons
var toolButtonsContainer = new ui.Container();
var toolsVLayout = new ui.VLayout();
toolsVLayout.setSpaceBetween(2);
toolsVLayout.setMargins(6,6,6,6);
var toolButtonsLayout = new ui.HLayout();
toolButtonsLayout.add(convertRectButton);
toolButtonsLayout.add(dynamicAlignButton);
toolButtonsLayout.add(flattenShapeButton);
toolButtonsLayout.add(cycleTextAlignButton);
toolButtonsLayout.add(cycleVerticalTextAlignButton);
toolButtonsLayout.addStretch();
toolButtonsLayout.add(settingsButton);

// Rename section - more compact

var renameLayout = new ui.HLayout();
renameLayout.add(renamerInput);
renameLayout.add(renamerButton);

toolsVLayout.add(renameLayout);
toolsVLayout.add(toolButtonsLayout);



toolButtonsContainer.setLayout(toolsVLayout);
mainLayout.add(toolButtonsContainer);


mainLayout.addStretch();

ui.add(mainLayout);
ui.setMargins(0, 0, 0, 0);
ui.setMinimumWidth(150);

// --- Selection Change Callback ---
// Register callback to update text alignment icons when selection changes
// Cavalry API: ui.addCallbackObject() registers an object with callback functions
// onSelectionChanged is called whenever the scene selection changes
function SelectionCallbacks() {
    this.onSelectionChanged = function() {
        updateTextAlignIcon();
        updateVerticalTextAlignIcon();
    };
}

var selectionCallbackObj = new SelectionCallbacks();
ui.addCallbackObject(selectionCallbackObj);

// Register cleanup handler for window close to prevent heap corruption
ui.onClose = function() {
    try {
        // Cleanup web server resources
        if (typeof Quiver !== 'undefined' && typeof Quiver.cleanup === 'function') {
            Quiver.cleanup();
        }
        
        // Close settings window if it's open
        if (settingsWindow) {
            try {
                settingsWindow.close();
            } catch (e) {
                // Settings window may already be closed
            }
            settingsWindow = null;
        }
    } catch (e) {
        // Silently handle cleanup errors
    }
};

ui.show();

// ----------------------------------------
// quiver_function_flattenShape.js
// ----------------------------------------
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


// ----------------------------------------
// quiver_function_convertToRectangle.js
// ----------------------------------------
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

/**
 * Map attribute paths from editableShape to basicShape (rectangle/ellipse).
 * Different shape types have different attribute structures.
 * 
 * From Cavalry UI "Copy Scripting Path":
 * - Fill shaders: material.colorShaders
 * - Stroke shaders: stroke.colorShaders
 * 
 * editableShape uses: material.colorShaders.0.shader (indexed)
 * basicShape uses: material.colorShaders (connect to the array directly)
 */
function _mapAttributeToBasicShape(attrId) {
    // Map material.colorShaders.X.shader to material.colorShaders (for fill connections)
    // Connect shader.id to material.colorShaders directly (not indexed)
    if (attrId && attrId.indexOf('material.colorShaders') === 0 && attrId.indexOf('.shader') > 0) {
        return 'material.colorShaders';
    }
    // Map stroke.colorShaders.X.shader to stroke.colorShaders (for stroke connections)
    if (attrId && attrId.indexOf('stroke.colorShaders') === 0 && attrId.indexOf('.shader') > 0) {
        return 'stroke.colorShaders';
    }
    // Map masks.X to masks (for mask connections)
    // Connect maskShape.id to masks directly (not indexed)
    if (attrId && attrId.indexOf('masks.') === 0 && /^masks\.\d+$/.test(attrId)) {
        return 'masks';
    }
    // Return original if no mapping needed
    return attrId;
}

/**
 * Transfer all incoming and outgoing connections from one layer to another.
 * 
 * Cavalry API used:
 * - api.getInConnectedAttributes(layerId) - Get all attributes with incoming connections
 * - api.getInConnection(layerId, attrId) - Get the source of an incoming connection
 * - api.getOutConnectedAttributes(layerId) - Get all attributes with outgoing connections
 * - api.getOutConnections(layerId, attrId) - Get all destinations of outgoing connections
 * - api.connect(fromLayerId, fromAttrId, toLayerId, toAttrId, force) - Create a connection
 */
function _transferConnections(fromId, toId) {
    var transferred = 0;
    
    // Transfer incoming connections
    // Skip indexed filter attributes like "filters.0" since filters work by parenting
    // BUT shader connections (material.colorShaders.X.shader) MUST be reconnected
    try {
        var inAttrs = api.getInConnectedAttributes(fromId);
        if (inAttrs && inAttrs.length > 0) {
            for (var i = 0; i < inAttrs.length; i++) {
                var attrId = inAttrs[i];
                
                // Skip filter, mask, and materialBehaviours indexed attributes
                // Filters work by parenting, masks are external shapes that need special handling,
                // materialBehaviours are internal systems
                if (attrId && (attrId.indexOf('filters.') === 0 || attrId.indexOf('masks.') === 0 || attrId.indexOf('materialBehaviours.') === 0) && /\.\d+$/.test(attrId)) {
                    continue;
                }
                
                try {
                    var inConn = api.getInConnection(fromId, attrId);
                    if (inConn && inConn.length > 0) {
                        // inConn format is "layerId.attrId" - parse it
                        // Layer IDs are like "colorShader#123" (contain #, no dots)
                        // Attr IDs can be like "id" or "material.alpha"
                        // So find the first dot to split layer from attr
                        var firstDotIndex = inConn.indexOf('.');
                        if (firstDotIndex > 0) {
                            var sourceLayerId = inConn.substring(0, firstDotIndex);
                            var sourceAttrId = inConn.substring(firstDotIndex + 1);
                            // Map the destination attribute to basicShape format
                            var mappedAttrId = _mapAttributeToBasicShape(attrId);
                            // Connect the source to the new layer's mapped attribute
                            try {
                                api.connect(sourceLayerId, sourceAttrId, toId, mappedAttrId, true);
                                transferred++;
                            } catch (eConnect) {
                            }
                        }
                    }
                } catch (eIn) {
                }
            }
        }
    } catch (eInAttrs) {
    }
    
    // Transfer outgoing connections
    // Skip indexed attributes like "filters.0" or "material.colorShaders.0" since:
    // - Children (shaders, filters) are reparented, not reconnected via indexed attrs
    // - basicShape may not have the same indexed structure
    try {
        var outAttrs = api.getOutConnectedAttributes(fromId);
        if (outAttrs && outAttrs.length > 0) {
            for (var j = 0; j < outAttrs.length; j++) {
                var outAttrId = outAttrs[j];
                
                // Skip indexed attributes (like "filters.0", "material.colorShaders.0")
                // These are child layer references that were already reparented
                if (outAttrId && /\.\d+$/.test(outAttrId)) {
                    continue;
                }
                
                try {
                    var outConns = api.getOutConnections(fromId, outAttrId);
                    if (outConns && outConns.length > 0) {
                        for (var k = 0; k < outConns.length; k++) {
                            var outConn = outConns[k];
                            // outConn format is "layerId.attrId"
                            // Layer IDs are like "basicShape#123" (contain #, no dots)
                            // Attr IDs can be like "id" or "material.alpha"
                            var outFirstDotIndex = outConn.indexOf('.');
                            if (outFirstDotIndex > 0) {
                                var destLayerId = outConn.substring(0, outFirstDotIndex);
                                var destAttrId = outConn.substring(outFirstDotIndex + 1);
                                // Connect the new layer's same attribute to the destination
                                try {
                                    api.connect(toId, outAttrId, destLayerId, destAttrId, true);
                                    transferred++;
                                } catch (eConnectOut) {
                                }
                            }
                        }
                    }
                } catch (eOut) {
                }
            }
        }
    } catch (eOutAttrs) {
    }
    
    return transferred;
}

function convertSelectionToRect(keepOriginalHidden) {
    try {
        var selection = api.getSelection();
        if (!selection || selection.length === 0) { console.error('Select at least one layer'); return; }
        var defStr = defaultRadius;
        var defVal = parseFloat(defStr);
        var converted = 0;
        var connectionsTransferred = 0;
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
            
            // FIRST: Reparent any children (shaders, effects, etc.) to the new shape
            // This must happen BEFORE transferring connections so shaders are in place
            // Cavalry API: api.getChildren(layerId) returns array of child layer IDs
            // Cavalry API: api.parent(layerId, newParentId) assigns new parent
            try {
                var children = api.getChildren(layerId);
                if (children && children.length > 0) {
                    for (var c = 0; c < children.length; c++) {
                        var childId = children[c];
                        var childName = '';
                        var childType = '';
                        try { childName = api.getNiceName(childId); } catch (e) { childName = childId; }
                        try { childType = api.getNodeType(childId); } catch (e) { childType = 'unknown'; }
                        try {
                            api.parent(childId, newId);
                        } catch (eReparent) {
                        }
                    }
                }
            } catch (eChildren) {
            }
            
            // SECOND: Transfer all incoming and outgoing connections to the new shape
            // This happens after reparenting so shaders are already children of new shape
            try {
                connectionsTransferred += _transferConnections(layerId, newId);
            } catch (eTransfer) {}
            
            // THIRD: Transfer mask connections (masks are external shapes, need special handling)
            // Get masks connected to original shape and reconnect them to new shape
            try {
                var inAttrs = api.getInConnectedAttributes(layerId);
                if (inAttrs && inAttrs.length > 0) {
                    for (var m = 0; m < inAttrs.length; m++) {
                        var mAttr = inAttrs[m];
                        if (mAttr && mAttr.indexOf('masks.') === 0 && /^masks\.\d+$/.test(mAttr)) {
                            try {
                                var maskConn = api.getInConnection(layerId, mAttr);
                                if (maskConn && maskConn.length > 0) {
                                    // maskConn format is "maskShape#123.id"
                                    var dotIdx = maskConn.indexOf('.');
                                    if (dotIdx > 0) {
                                        var maskShapeId = maskConn.substring(0, dotIdx);
                                        // Connect mask to new shape
                                        api.connect(maskShapeId, 'id', newId, 'masks');
                                        connectionsTransferred++;
                                    }
                                }
                            } catch (eMaskConn) {}
                        }
                    }
                }
            } catch (eMasks) {}
            
            try {
                if (keepOriginalHidden) { api.set(layerId, { 'hidden': true }); }
                else { api.deleteLayer(layerId); }
            } catch (eDel) {}
            converted++;
        }
        var msg = converted > 0 ? ('Converted ' + converted + ' layer(s)') : 'No valid layers';
        if (connectionsTransferred > 0) msg += ' (' + connectionsTransferred + ' connection(s) transferred)';
        console.info(msg);
    } catch (e) { 
        var errorMsg = e && e.message ? e.message : 'An error occurred';
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
    }
}

// ----------------------------------------
// quiver_function_dynamicAlign.js
// ----------------------------------------
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

// ----------------------------------------
// quiver_function_renameLayers.js
// ----------------------------------------
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


// ----------------------------------------
// quiver_function_cycleTextAlignment.js
// ----------------------------------------
/**
 * Cycle Text Alignment
 * Cycles the horizontal alignment of selected text layers (Left → Center → Right → Justified → Left)
 * while keeping the text visually in the same position.
 * 
 * Cavalry API used:
 * - api.getSelection() - Get selected layers
 * - api.get(id, attribute) - Get layer attributes
 * - api.set(id, properties) - Set layer properties
 * - api.getBoundingBox(id, worldSpace) - Get bounding box
 * - api.getType(id) - Get layer type
 * 
 * Cavalry horizontalAlignment values (from Text Shape node documentation):
 * 0 = Left
 * 1 = Centre
 * 2 = Right
 * 3 = Justified
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
        
        // Calculate new alignment (cycle: 0 → 1 → 2 → 3 → 0)
        // Left (0) → Centre (1) → Right (2) → Justified (3) → Left (0)
        var newAlignment = (currentAlignment + 1) % 4;
        
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


// ----------------------------------------
// quiver_function_cycleVerticalTextAlignment.js
// ----------------------------------------
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


// ----------------------------------------
// quiver_utiltiies_sharedFunctions.js
// ----------------------------------------
// --- Utilities ---
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}

function parseOpacityValue(value) {
    if (value === null || value === undefined || value === "") return null;
    var v = ("" + value).trim();
    if (v.endsWith("%")) {
        var num = parseFloat(v.slice(0, -1));
        if (isNaN(num)) return null;
        return clamp01(num / 100);
    }
    var n = parseFloat(v);
    if (isNaN(n)) return null;
    return clamp01(n);
}

function parseColor(colorString) {
    if (!colorString || colorString === "none") return null;
    if (colorString[0] === '#') return colorString;
    var named = {
        white: "#FFFFFF",
        black: "#000000",
        red: "#FF0000",
        green: "#008000",
        blue: "#0000FF",
        yellow: "#FFFF00",
        cyan: "#00FFFF",
        magenta: "#FF00FF",
        gray: "#808080",
        grey: "#808080"
    };
    var lower = (colorString + "").toLowerCase();
    if (named[lower]) return named[lower];
    if (lower.indexOf("rgb(") === 0) {
        var m = lower.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m) {
            var r = parseInt(m[1]).toString(16).padStart(2, '0');
            var g = parseInt(m[2]).toString(16).padStart(2, '0');
            var b = parseInt(m[3]).toString(16).padStart(2, '0');
            return "#" + r + g + b;
        }
    }
    if (lower.indexOf("rgba(") === 0) {
        var mr = lower.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (mr) {
            var rr = parseInt(mr[1]).toString(16).padStart(2, '0');
            var gr = parseInt(mr[2]).toString(16).padStart(2, '0');
            var br = parseInt(mr[3]).toString(16).padStart(2, '0');
            return "#" + rr + gr + br;
        }
    }
    return colorString; // best effort
}

// Normalize SVG stroke-dasharray to Cavalry dash pattern CSV (e.g., "4, 2"); return null for none/invalid
function normalizeDashArrayToCsv(val) {
    try {
        if (val === null || val === undefined) return null;
        var s = ('' + val).trim();
        if (!s || s.toLowerCase() === 'none' || s === '0') return null;
        // Replace commas with spaces then split
        s = s.replace(/,/g, ' ');
        var parts = s.split(/\s+/).filter(function(t){ return t!==''; });
        var nums = [];
        for (var i = 0; i < parts.length; i++) {
            var n = parseFloat(parts[i]);
            if (!isNaN(n) && isFinite(n)) nums.push(Math.max(0, n));
        }
        if (nums.length === 0) return null;
        return nums.join(', ');
    } catch (e) { return null; }
}

function extractAttribute(tag, name) {
    if (!tag || !name) return null;
    // Try to match attribute with its value, handling nested quotes
    // First try double quotes
    var regex1 = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*"([^"]*)"');
    var match = regex1.exec(tag);
    if (match) return match[1];
    // Then try single quotes
    var regex2 = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*'([^']*)'");
    match = regex2.exec(tag);
    return match ? match[1] : null;
}

function extractStyleProperty(styleString, propertyName) {
    if (!styleString || !propertyName) return null;
    var parts = styleString.split(';');
    var target = ("" + propertyName).trim().toLowerCase();
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (!seg) continue;
        var kv = seg.split(':');
        if (kv.length < 2) continue;
        var key = kv[0].trim().toLowerCase();
        if (key === target) return kv.slice(1).join(':').trim();
    }
    return null;
}

function mergeInlineStyleIntoAttrs(openingTag) {
    var styleAttr = extractAttribute(openingTag, "style");
    var merged = {};
    if (!styleAttr) return merged;
    var parts = styleAttr.split(';');
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (!seg) continue;
        var kv = seg.split(':');
        if (kv.length < 2) continue;
        var key = kv[0].trim();
        var val = kv.slice(1).join(':').trim();
        merged[key] = val;
    }
    return merged;
}

// Decode HTML entities in names, including sequences of decimal byte entities representing UTF-8 (e.g. &#240;&#159;&#166;&#139; → 🦋)
function decodeEntitiesForName(str) {
    if (!str) return str;
    var out = str;
    // Hex numeric: &#x1F98B;
    out = out.replace(/&#x([0-9a-fA-F]+);/g, function(_, hex) {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch (e) { return _; }
    });
    // Groups of decimal numeric entities that may encode UTF-8 bytes
    out = out.replace(/((?:&#\d+;)+)/g, function(group) {
        var nums = [];
        var m;
        var rx = /&#(\d+);/g;
        while ((m = rx.exec(group)) !== null) nums.push(parseInt(m[1], 10));
        if (nums.length === 0) return group;
        // Attempt to treat as bytes and decode via percent-encoding
        try {
            var perc = nums.map(function(n){
                var h = n.toString(16).toUpperCase();
                if (h.length < 2) h = '0' + h;
                return '%' + h;
            }).join('');
            return decodeURIComponent(perc);
        } catch (e) {
            // Fallback: decode each as code point
            return nums.map(function(n){
                try { return String.fromCodePoint(n); } catch (e2) { return ''; }
            }).join('');
        }
    });
    // Common named entities
    out = out.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    return out;
}

function extractUrlRefId(value) {
    if (!value) return null;
    var m = /url\(#([^\)]+)\)/.exec(value);
    return m ? m[1] : null;
}

// Global gradient context (set at import time)
var __svgGradientMap = {};
var __svgGradientCache = {};
var __createdPathLayers = [];
var __svgViewBox = null; // Store viewBox for coordinate conversions in gradient offset calculations
var __svgFilterMap = {};
var __filterNodesCache = {}; // id -> [nodeIds]
var __groupDirectChildren = {}; // parentId -> [childIds]
var __imageImportCache = {}; // href/hash -> savedPath
var __svgPatternMap = {}; // id -> { attrs..., image: { href, x, y, width, height } }
var __patternImageShaderCache = {}; // patternId -> shaderId
var __lastPatternOrImageName = 'img';
var __imageNamingContext = {}; // Store parent context for better image naming
var __imageCounter = 0; // Global counter for unique image numbers
var __groupCounter = 0; // Global counter for anonymous groups

// Deferred background blur queue - processed after all shapes are created
// Each entry: { overlayShapeId, amount, parentId }
var __deferredBackgroundBlurs = [];

function setPatternContext(map) {
    __svgPatternMap = map || {};
    __patternImageShaderCache = {};
}

function _hasAttr(id, attr) {
    try { if (api.hasAttribute) return !!api.hasAttribute(id, attr); } catch (e) {}
    try { var _ = api.get(id, attr); return true; } catch (e2) { return false; }
}

function _sanitizeFileComponent(name) {
    try {
        var s = (name==null?'':(''+name)).trim();
        s = decodeEntitiesForName(s);
        // Replace only filesystem-illegal characters with underscore
        // Allows Unicode/emoji while blocking: \ / : * ? " < > | and control chars
        s = s.replace(/[\\/:*?"<>|\x00-\x1F\x7F]+/g, '_');
        // Replace any remaining whitespace with underscore
        s = s.replace(/\s+/g, '_');
        // Trim leading/trailing underscores
        s = s.replace(/^_+|_+$/g, '');
        if (!s) s = 'img';
        if (s.length > 40) s = s.slice(0, 40);
        return s;
    } catch (e) { return 'img'; }
}

function _setFirstSupported(id, candidates, value) {
    for (var i = 0; i < candidates.length; i++) {
        var a = candidates[i];
        if (_hasAttr(id, a)) {
            try { var obj={}; obj[a]=value; api.set(id, obj); return a; } catch (eSet) { /* try next */ }
        }
    }
    return null;
}

/**
 * Connect a gradient/color shader to a shape's material.colorShaders.
 * 
 * @param {string} shaderId - The shader layer ID
 * @param {string} shapeId - The shape layer ID
 * @param {Object} [svgShapeCenter] - Optional shape center in SVG coordinates {x, y}
 * 
 * Cavalry API used:
 * - api.setFill(id, bool) - Enable fill on shape
 * - api.set(id, props) - Set properties
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect attributes
 * - api.get(id, attr) - Get attribute value
 * - api.getParent(id) - Get parent layer
 * - api.parent(childId, parentId) - Parent layer
 */
function connectShaderToShape(shaderId, shapeId, svgShapeCenter, fillAlpha, shapeScaleY, shapeRotationDeg) {
    // shapeScaleY: the shape's Y scale from transform (negative = Y-flip)
    // shapeRotationDeg: the shape's rotation in degrees (for userSpaceOnUse gradient compensation)
    // Used to determine if gradient direction needs to be adjusted
    var isFlippedY = (shapeScaleY !== undefined && shapeScaleY < 0);
    var shapeRotation = (shapeRotationDeg !== undefined) ? shapeRotationDeg : 0;
    
    try { 
        api.setFill(shapeId, true); 
    } catch (e) {}
    
    // Critical: hide base color so shader is visible
    try { 
        api.set(shapeId, {"material.materialColor.a": 0}); 
        
    } catch (eA) {}
    
    // Keep material.alpha at 100% - the fill-opacity is applied to the SHADER's alpha
    try { 
        api.set(shapeId, {"material.alpha": 100}); 
    } catch (eMA) {}
    
    try {
        api.connect(shaderId, 'id', shapeId, 'material.colorShaders');

        // Apply fill-opacity to the shader's alpha (not material.alpha)
        // This is how Cavalry handles gradient/shader opacity vs shape opacity
        if (typeof fillAlpha === 'number' && fillAlpha < 1) {
            var shaderAlphaPct = Math.round(fillAlpha * 100);
            try {
                api.set(shaderId, {'alpha': shaderAlphaPct});
            } catch (eShaderAlpha) {
            }
        }

        // Ensure shader is visible (not hidden)
        try {
            api.set(shaderId, {'hidden': false});
            
        } catch (eVis) {}
        
        // For userSpaceOnUse RADIAL gradients with stored absolute positions, calculate relative offset
        // (Linear gradients have their own offset calculation below)
        try {
            // Get the gradient data to check if it has absolute position info
            var gradientData = null;
            var gradientId = null;
            if (__svgGradientMap && __svgGradientCache) {
                // Find which gradient ID maps to this shader
                for (var gid in __svgGradientCache) {
                    if (__svgGradientCache[gid] === shaderId) {
                        gradientId = gid;
                        gradientData = __svgGradientMap[gid];
                        break;
                    }
                }
            }
            
            // Only run this block for RADIAL gradients
            if (gradientData && gradientData.type === 'radial' && gradientData._absoluteCenterX !== undefined && gradientData._absoluteCenterY !== undefined) {
                // Ensure we have valid numbers
                var absX = parseFloat(gradientData._absoluteCenterX);
                var absY = parseFloat(gradientData._absoluteCenterY);
                
                if (!isNaN(absX) && !isNaN(absY)) {
                    // Get the shape's center in SVG coordinates
                    var shapeSvgCenterX = null;
                    var shapeSvgCenterY = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        // Use provided SVG center (preferred - accurate)
                        shapeSvgCenterX = svgShapeCenter.x;
                        shapeSvgCenterY = svgShapeCenter.y;
                    } else {
                        // Fallback for paths: use Cavalry bounding box and reverse-convert to SVG
                        // We need the viewBox to do proper conversion, so just log and skip offset
                    }
                    
                    // Only calculate offset if we have a valid SVG center
                    if (shapeSvgCenterX !== null && shapeSvgCenterY !== null) {
                        // Calculate offset in SVG coordinate space
                        // offset = gradient center - shape center (both in SVG coordinates)
                        var offsetSvgX = absX - shapeSvgCenterX;
                        var offsetSvgY = absY - shapeSvgCenterY;
                        
                        // Convert to Cavalry coordinates (Y is inverted)
                        var relativeOffsetX = offsetSvgX;
                        var relativeOffsetY = -offsetSvgY; // Invert Y for SVG->Cavalry conversion
                        
                        
                        // Update the gradient's offset
                        try {
                            // Validate the offset values before setting
                            if (!isNaN(relativeOffsetX) && !isNaN(relativeOffsetY)) {
                                api.set(shaderId, {"generator.offset.x": relativeOffsetX, "generator.offset.y": relativeOffsetY});
                            }
                        } catch (eOffset) {
                            console.warn('[RADIAL GRADIENT] Could not set offset: ' + eOffset.message);
                        }
                    }
                }
            }
        } catch (eCalcOffset) {
            console.warn('[RADIAL GRADIENT] Error calculating offset: ' + eCalcOffset.message);
        }
        
        // Calculate scale.x/y for radial gradients based on SVD singular values
        // For userSpaceOnUse: use scale.x/y directly to control ellipse dimensions (radiusRatio=1)
        // For objectBoundingBox: use radiusRatio to control aspect ratio
                    try {
            // Get the gradient data to check if it's radial with a transform
            var gradientDataRR = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidRR in __svgGradientCache) {
                    if (__svgGradientCache[gidRR] === shaderId) {
                        gradientDataRR = __svgGradientMap[gidRR];
                        break;
                    }
                }
            }
            
            if (gradientDataRR && gradientDataRR.type === 'radial' && gradientDataRR.transform) {
                // Get shape dimensions from Cavalry's bounding box
                var shapeBbox = api.getBoundingBox(shapeId, false);
                if (shapeBbox && shapeBbox.width > 0 && shapeBbox.height > 0) {
                    var shapeWidth = shapeBbox.width;
                    var shapeHeight = shapeBbox.height;
                    
                    // Parse the gradient transform matrix
                    var matrixRR = parseTransformMatrixList(gradientDataRR.transform);
                    var a = matrixRR.a, b = matrixRR.b, c = matrixRR.c, d = matrixRR.d;
                    var e = matrixRR.e || 0, f = matrixRR.f || 0;
                    
                    // Check if this is userSpaceOnUse (absolute coords) or objectBoundingBox (normalized 0-1)
                    var isAbsoluteCoords = (Math.abs(a) > 2 || Math.abs(b) > 2 || Math.abs(c) > 2 || Math.abs(d) > 2 ||
                                            Math.abs(e) > 2 || Math.abs(f) > 2);
                    
                    
                    if (isAbsoluteCoords && gradientDataRR.gradientUnits === 'userSpaceOnUse') {
                        // For userSpaceOnUse: use matrix column lengths for x/y scale
                        // Column 1 (a, b) represents how the x-direction is transformed
                        // Column 2 (c, d) represents how the y-direction is transformed
                        var colXLength = Math.sqrt(a * a + b * b);  // Length of column 1
                        var colYLength = Math.sqrt(c * c + d * d);  // Length of column 2
                        
                        
                        // Calculate scale based on shape's half-dimensions
                        // In Cavalry, 100% scale means the gradient fills the bounding box
                        // So scale = (column length / shape half-dimension) * 100
                        var shapeRadiusX = shapeWidth / 2;
                        var shapeRadiusY = shapeHeight / 2;
                        
                        // Column 1 length → scale.x (x-direction stretch)
                        // Column 2 length → scale.y (y-direction stretch)
                        var scaleX = (colXLength / shapeRadiusX) * 100;
                        var scaleY = (colYLength / shapeRadiusY) * 100;
                        
                        
                        // Set radiusRatio to 1 (ellipse shape comes from scale.x/y)
                        try {
                            api.set(shaderId, {"generator.radiusRatio": 1});
                        } catch (eRR) {}
                        
                        // Set scale values
                        try {
                            api.set(shaderId, {"generator.scale.x": scaleX, "generator.scale.y": scaleY});
                        } catch (eScale) {
                            console.warn('[RADIAL GRADIENT] Could not set scale: ' + eScale.message);
                        }
                        
                        // Set rotation from the gradient transform matrix
                        // The rotation is embedded in the matrix - extract using atan2(b, a)
                        // SVG rotation is clockwise, Cavalry rotation is counter-clockwise, so negate
                        try {
                            var rotationRad = Math.atan2(b, a);
                            var rotationDeg = -rotationRad * 180 / Math.PI;
                            api.set(shaderId, {"generator.rotation": rotationDeg});
                        } catch (eRot) {
                            console.warn('[RADIAL GRADIENT] Could not set rotation: ' + eRot.message);
                        }
                    } else {
                        // For objectBoundingBox: use radiusRatio for aspect ratio
                        var centerX = a * 0.5 + c * 0.5 + e;
                        var centerY = b * 0.5 + d * 0.5 + f;
                        var handle1X = a * 1.0 + c * 0.5 + e;
                        var handle1Y = b * 1.0 + d * 0.5 + f;
                        var handle2X = a * 0.5 + c * 1.0 + e;
                        var handle2Y = b * 0.5 + d * 1.0 + f;
                        
                        var dx1 = (handle1X - centerX) * shapeWidth;
                        var dy1 = (handle1Y - centerY) * shapeHeight;
                        var dx2 = (handle2X - centerX) * shapeWidth;
                        var dy2 = (handle2Y - centerY) * shapeHeight;
                        
                        var dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                        var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                        
                        
                        var radiusRatioNew = 1;
                        if (dist1 > 0.0001 && dist2 > 0.0001) {
                            radiusRatioNew = Math.max(dist1, dist2) / Math.min(dist1, dist2);
                        }
                        radiusRatioNew = Math.max(0.01, Math.min(100, radiusRatioNew));
                        
                        api.set(shaderId, {"generator.radiusRatio": radiusRatioNew});
                    }
                }
            }
        } catch (eRadiusRatio) {
            console.warn('[RADIAL GRADIENT] Error calculating scale: ' + eRadiusRatio.message);
        }
        
        // Calculate scale and offset for LINEAR gradients with userSpaceOnUse coordinates
        try {
            // Get the gradient data to check if it's linear with absolute coordinates
            var gradientDataL = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidL in __svgGradientCache) {
                    if (__svgGradientCache[gidL] === shaderId) {
                        gradientDataL = __svgGradientMap[gidL];
                        break;
                    }
                }
            }
            
            if (gradientDataL && gradientDataL.type === 'linear' && gradientDataL.gradientUnits === 'userSpaceOnUse') {
                // Get shape dimensions from Cavalry's bounding box
                var shapeBboxL = api.getBoundingBox(shapeId, false);
                if (shapeBboxL && shapeBboxL.width > 0 && shapeBboxL.height > 0) {
                    var shapeWidthL = shapeBboxL.width;
                    var shapeHeightL = shapeBboxL.height;
                    
                    // Get the linear gradient's start and end points (absolute coords)
                    var x1 = gradientDataL.x1 || 0;
                    var y1 = gradientDataL.y1 || 0;
                    var x2 = gradientDataL.x2 || 0;
                    var y2 = gradientDataL.y2 || 0;
                    
                    // Calculate gradient vector and length
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var gradientLength = Math.sqrt(dx * dx + dy * dy);
                    
                    // Calculate gradient center in SVG coordinates
                    var gradCenterX = (x1 + x2) / 2;
                    var gradCenterY = (y1 + y2) / 2;
                    
                    
                    // Calculate offset - try to get shape SVG center, or estimate from gradient center
                    var shapeSvgCenterXL = null;
                    var shapeSvgCenterYL = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        // Use provided SVG center
                        shapeSvgCenterXL = svgShapeCenter.x;
                        shapeSvgCenterYL = svgShapeCenter.y;
                    } else {
                        // Use world-space bounding box to get actual geometric center
                        // This works for text (baseline anchor) and any other non-centered pivots
                        try {
                            var shapeBboxWorld = api.getBoundingBox(shapeId, true); // World space
                            
                            // Get viewBox info if available (stored during import)
                            var viewBoxWidth = 1080; // Default assumption
                            var viewBoxHeight = 1080;
                            if (typeof __svgViewBox !== 'undefined' && __svgViewBox) {
                                viewBoxWidth = __svgViewBox.width || viewBoxWidth;
                                viewBoxHeight = __svgViewBox.height || viewBoxHeight;
                    }
                    
                            if (shapeBboxWorld && shapeBboxWorld.width > 0 && shapeBboxWorld.height > 0) {
                                // World bbox gives us the actual geometric bounds in Cavalry coords
                                // Calculate geometric center from world bbox
                                var worldCenterX = shapeBboxWorld.x + shapeBboxWorld.width / 2;
                                var worldCenterY = shapeBboxWorld.y + shapeBboxWorld.height / 2;
                                
                                // Convert Cavalry world coords to SVG coordinates
                                // Cavalry center (0,0) corresponds to SVG center (viewBoxWidth/2, viewBoxHeight/2)
                                // Cavalry +X = SVG +X, Cavalry +Y = SVG -Y
                                shapeSvgCenterXL = (viewBoxWidth / 2) + worldCenterX;
                                shapeSvgCenterYL = (viewBoxHeight / 2) - worldCenterY;
                                
                            } else {
                            }
                        } catch (eEstimate) {
                        }
                    }
                    
                    // Calculate and set offset if we have a shape center
                    if (shapeSvgCenterXL !== null && shapeSvgCenterYL !== null) {
                        // Offset in SVG coords
                        var offsetSvgXL = gradCenterX - shapeSvgCenterXL;
                        var offsetSvgYL = gradCenterY - shapeSvgCenterYL;
                        
                        // Convert to Cavalry coords (Y inverted for normal shapes)
                        // For Y-flipped shapes (scaleY < 0), the shape's local coordinate system
                        // is already inverted, so we DON'T negate the Y offset
                        var offsetCavXL = offsetSvgXL;
                        var offsetCavYL = isFlippedY ? offsetSvgYL : -offsetSvgYL;
                        
                        
                        try {
                            api.set(shaderId, {"generator.offset.x": offsetCavXL, "generator.offset.y": offsetCavYL});
                        } catch (eOffL) {
                            console.warn('[LINEAR GRADIENT] Could not set offset: ' + eOffL.message);
                        }
                    }
                        
                    // Calculate scale: gradient length relative to shape's reference dimension
                    // In Cavalry, linear gradient scale=1.0 means the gradient spans the shape's
                    // larger dimension (width or height). Scale > 1 extends beyond.
                    var angleRad = Math.atan2(dy, dx); // Angle in radians
                    
                    // Use the larger of width or height as the reference dimension
                    var shapeReference = Math.max(shapeWidthL, shapeHeightL);
                    
                    // Scale is the ratio of gradient length to shape's reference dimension
                    var scaleL = (gradientLength / shapeReference);
                    
                    var angleDeg = angleRad * 180 / Math.PI;
                    
                    
                    try {
                        api.set(shaderId, {"generator.scale": scaleL});
                    } catch (eScaleL) {
                        console.warn('[LINEAR GRADIENT] Could not set scale: ' + eScaleL.message);
                    }
                    
                    // For Y-flipped shapes (scaleY < 0), we need to adjust the gradient rotation.
                    // 
                    // Figma exports gradients with userSpaceOnUse but coordinates relative to the
                    // untransformed shape bounds. This means the gradient is meant to transform WITH
                    // the shape. The rotation is already applied to the Cavalry shape, so we only need
                    // to compensate for the Y-flip (which is NOT applied to the Cavalry shape).
                    // 
                    // Y-flip mirrors the coordinate system across the X-axis, which negates the angle:
                    // - Horizontal gradient (0°): unaffected (symmetric across X-axis)
                    // - Vertical gradient (90°): reversed to 270° (or -90°)
                    // - Diagonal gradient (45°): mirrored to -45° (315°)
                    // 
                    // Formula: newAngle = -oldAngle (NOT +180° as previously implemented)
                    if (isFlippedY) {
                        try {
                            // Get the current rotation that was set by createGradientShader
                            var currentRotation = 0;
                            try {
                                currentRotation = api.get(shaderId, "generator.rotation") || 0;
                            } catch (eGetRot) {
                                currentRotation = 0;
                            }
                            
                            // For Y-flip: negate the angle (reflection across X-axis)
                            var newRotation = -currentRotation;
                            
                            // Normalize to 0-360 range
                            newRotation = ((newRotation % 360) + 360) % 360;
                            
                            if (Math.abs(newRotation - currentRotation) > 0.01) {
                                api.set(shaderId, {"generator.rotation": newRotation});
                            }
                        } catch (eRotL) {
                            console.warn('[LINEAR GRADIENT] Could not set rotation: ' + eRotL.message);
                        }
                    }
                }
            }
        } catch (eLinear) {
            console.warn('[LINEAR GRADIENT] Error calculating properties: ' + eLinear.message);
        }
        
        // Parent shader under the first shape it connects to for tidy stacking
        try {
            var currentParent = null;
            try { currentParent = api.getParent(shaderId); } catch (ePar) { currentParent = null; }
            if (!currentParent) {
                api.parent(shaderId, shapeId);
                
            }
        } catch (ePar2) {}
        
        return true;
    } catch (e1) {
        try {
            // Fallback: sometimes explicit indexless connect fails; leave log

        } catch (eLog) {}
    }
    return false;
}

function connectShaderToStroke(shaderId, shapeId, svgShapeCenter) {
    try { api.setStroke(shapeId, true); } catch (e) {}
    // Reveal shader by hiding base stroke color
    try { api.set(shapeId, {"stroke.strokeColor.a": 0}); } catch (eA) {}
    try {
        api.connect(shaderId, 'id', shapeId, 'stroke.colorShaders');
        
        // Calculate scale and offset for LINEAR gradients (same as connectShaderToShape)
        try {
            var gradientDataL = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidL in __svgGradientCache) {
                    if (__svgGradientCache[gidL] === shaderId) {
                        gradientDataL = __svgGradientMap[gidL];
                        break;
                    }
                }
            }
            
            if (gradientDataL && gradientDataL.type === 'linear' && gradientDataL.gradientUnits === 'userSpaceOnUse') {
                var shapeBboxL = api.getBoundingBox(shapeId, false);
                if (shapeBboxL && shapeBboxL.width > 0 && shapeBboxL.height > 0) {
                    var shapeWidthL = shapeBboxL.width;
                    var shapeHeightL = shapeBboxL.height;
                    
                    var x1 = gradientDataL.x1 || 0;
                    var y1 = gradientDataL.y1 || 0;
                    var x2 = gradientDataL.x2 || 0;
                    var y2 = gradientDataL.y2 || 0;
                    
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var gradientLength = Math.sqrt(dx * dx + dy * dy);
                    var gradCenterX = (x1 + x2) / 2;
                    var gradCenterY = (y1 + y2) / 2;
                    
                    
                    // Calculate offset
                    var shapeSvgCenterXL = null;
                    var shapeSvgCenterYL = null;
                    
                    if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                        shapeSvgCenterXL = svgShapeCenter.x;
                        shapeSvgCenterYL = svgShapeCenter.y;
                    } else {
                        // Use world-space bounding box to get actual geometric center
                        try {
                            var shapeBboxWorldS = api.getBoundingBox(shapeId, true);
                            var viewBoxWidth = (__svgViewBox && __svgViewBox.width) || 1080;
                            var viewBoxHeight = (__svgViewBox && __svgViewBox.height) || 1080;
                            if (shapeBboxWorldS && shapeBboxWorldS.width > 0 && shapeBboxWorldS.height > 0) {
                                var worldCenterXS = shapeBboxWorldS.x + shapeBboxWorldS.width / 2;
                                var worldCenterYS = shapeBboxWorldS.y + shapeBboxWorldS.height / 2;
                                shapeSvgCenterXL = (viewBoxWidth / 2) + worldCenterXS;
                                shapeSvgCenterYL = (viewBoxHeight / 2) - worldCenterYS;
                            }
                        } catch (eEstimate) {}
                    }
                    
                    if (shapeSvgCenterXL !== null && shapeSvgCenterYL !== null) {
                        var offsetSvgXL = gradCenterX - shapeSvgCenterXL;
                        var offsetSvgYL = gradCenterY - shapeSvgCenterYL;
                        var offsetCavXL = offsetSvgXL;
                        var offsetCavYL = -offsetSvgYL;
                        
                        try {
                            api.set(shaderId, {"generator.offset.x": offsetCavXL, "generator.offset.y": offsetCavYL});
                        } catch (eOffL) {}
                    }
                    
                    // Calculate scale using shape's reference dimension (larger of width/height)
                    // In Cavalry, linear gradient scale=1.0 means the gradient spans the reference dimension
                    var shapeReference = Math.max(shapeWidthL, shapeHeightL);
                    var scaleL = (gradientLength / shapeReference);
                    
                    
                    try {
                        api.set(shaderId, {"generator.scale": scaleL});
                    } catch (eScaleL) {}
                }
            }
        } catch (eLinearStroke) {
            console.warn('[LINEAR GRADIENT STROKE] Error: ' + eLinearStroke.message);
        }
        
        // Calculate scale and offset for RADIAL gradients (same logic as connectShaderToShape)
        try {
            var gradientDataR = null;
            var foundGidR = null;
            if (__svgGradientMap && __svgGradientCache) {
                for (var gidR in __svgGradientCache) {
                    if (__svgGradientCache[gidR] === shaderId) {
                        gradientDataR = __svgGradientMap[gidR];
                        foundGidR = gidR;
                        break;
                    }
                }
            }
            
            if (gradientDataR && gradientDataR.type === 'radial' && gradientDataR.transform) {
                
                var shapeBboxR = api.getBoundingBox(shapeId, false);
                if (shapeBboxR && shapeBboxR.width > 0 && shapeBboxR.height > 0) {
                    var shapeWidthR = shapeBboxR.width;
                    var shapeHeightR = shapeBboxR.height;
                    
                    // Parse the gradient transform matrix
                    var matrixR = parseTransformMatrixList(gradientDataR.transform);
                    var aR = matrixR.a, bR = matrixR.b, cR = matrixR.c, dR = matrixR.d;
                    var eR = matrixR.e || 0, fR = matrixR.f || 0;
                    
                    // Check if this is userSpaceOnUse (absolute coords)
                    var isAbsoluteCoordsR = (Math.abs(aR) > 2 || Math.abs(bR) > 2 || Math.abs(cR) > 2 || Math.abs(dR) > 2 ||
                                            Math.abs(eR) > 2 || Math.abs(fR) > 2);
                    
                    
                    if (isAbsoluteCoordsR && gradientDataR.gradientUnits === 'userSpaceOnUse') {
                        // Calculate column lengths (these represent the radii in the transformed space)
                        var colXLengthR = Math.sqrt(aR * aR + bR * bR);
                        var colYLengthR = Math.sqrt(cR * cR + dR * dR);
                        
                        
                        // For Bounding Box radiusMode: scale is relative to shape's half-dimensions
                        var shapeRadiusXR = shapeWidthR / 2;
                        var shapeRadiusYR = shapeHeightR / 2;
                        
                        var scaleXR = (colXLengthR / shapeRadiusXR) * 100;
                        var scaleYR = (colYLengthR / shapeRadiusYR) * 100;
                        
                        
                        // Set radiusRatio to 1 (ellipse shape comes from scale.x/y)
                        try {
                            api.set(shaderId, {"generator.radiusRatio": 1});
                        } catch (eRRR) {}
                        
                        // Set scale values
                        try {
                            api.set(shaderId, {"generator.scale.x": scaleXR, "generator.scale.y": scaleYR});
                        } catch (eScaleR) {}
                        
                        // Set rotation from the gradient transform matrix
                        // SVG rotation is clockwise, Cavalry rotation is counter-clockwise, so negate
                        // (matching the fill version in connectShaderToShape)
                        var rotationRadR = Math.atan2(bR, aR);
                        var rotationDegR = -rotationRadR * (180 / Math.PI);
                        try {
                            api.set(shaderId, {"generator.rotation": rotationDegR});
                        } catch (eRotR) {}
                        
                        // Calculate offset
                        var gradCenterXR = eR;
                        var gradCenterYR = fR;
                        
                        var shapeSvgCenterXR = null;
                        var shapeSvgCenterYR = null;
                        
                        if (svgShapeCenter && svgShapeCenter.x !== undefined && svgShapeCenter.y !== undefined) {
                            shapeSvgCenterXR = svgShapeCenter.x;
                            shapeSvgCenterYR = svgShapeCenter.y;
                        } else {
                            // Estimate from world bbox
                            try {
                                var shapeBboxWorldR = api.getBoundingBox(shapeId, true);
                                var viewBoxWidthR = (__svgViewBox && __svgViewBox.width) || 1080;
                                var viewBoxHeightR = (__svgViewBox && __svgViewBox.height) || 1080;
                                if (shapeBboxWorldR && shapeBboxWorldR.width > 0 && shapeBboxWorldR.height > 0) {
                                    var worldCenterXR = shapeBboxWorldR.x + shapeBboxWorldR.width / 2;
                                    var worldCenterYR = shapeBboxWorldR.y + shapeBboxWorldR.height / 2;
                                    shapeSvgCenterXR = (viewBoxWidthR / 2) + worldCenterXR;
                                    shapeSvgCenterYR = (viewBoxHeightR / 2) - worldCenterYR;
                                }
                            } catch (eEstR) {}
                        }
                        
                        if (shapeSvgCenterXR !== null && shapeSvgCenterYR !== null) {
                            var offsetSvgXR = gradCenterXR - shapeSvgCenterXR;
                            var offsetSvgYR = gradCenterYR - shapeSvgCenterYR;
                            var offsetCavXR = offsetSvgXR;
                            var offsetCavYR = -offsetSvgYR;
                            
                            try {
                                api.set(shaderId, {"generator.offset.x": offsetCavXR, "generator.offset.y": offsetCavYR});
                            } catch (eOffR) {}
                        }
                    }
                }
            }
        } catch (eRadialStroke) {
            console.warn('[RADIAL GRADIENT STROKE] Error: ' + eRadialStroke.message);
        }
        
        // Parent shader under the first shape it connects to for tidy stacking
        try {
            var currentParent = null;
            try { currentParent = api.getParent(shaderId); } catch (ePar) { currentParent = null; }
            if (!currentParent) {
                api.parent(shaderId, shapeId);
            }
        } catch (ePar2) {}
        return true;
    } catch (e1) {
        
    }
    return false;
}


// ----------------------------------------
// quiver_utilities_blendmode.js
// ----------------------------------------
// --- Blend Mode Utilities ---
// Maps SVG mix-blend-mode values to Cavalry blendMode enum integers

// Blend mode mapping array
// Index corresponds to a logical grouping, but the actual enum values are sparse
// Structure: [svgName, cavalryEnum]
var BLEND_MODE_MAP = [
    ['normal', 0],
    ['multiply', 24],
    ['screen', 14],
    ['overlay', 15],
    ['darken', 16],
    ['lighten', 17],
    ['color-dodge', 18],
    ['color-burn', 19],
    ['hard-light', 20],
    ['soft-light', 21],
    ['difference', 22],
    ['exclusion', 23],
    ['hue', 25],
    ['saturation', 26],
    ['color', 27],
    ['luminosity', 28],
    ['plus-lighter', 12],  // SVG 'plus-lighter' maps to Cavalry 'Plus'
    ['plus', 12],          // Alternative mapping
    ['alpha-add', 30],     // Non-standard but supported by Cavalry
    ['plus-darker', 32],   // SVG 'plus-darker' maps to Cavalry 'Plus'
];

// Convert SVG blend mode name to Cavalry enum value
function svgBlendModeToCavalryEnum(svgMode) {
    if (!svgMode) return null;
    
    // Normalize: lowercase and trim
    var normalized = ('' + svgMode).toLowerCase().trim();
    
    // Search in map
    for (var i = 0; i < BLEND_MODE_MAP.length; i++) {
        if (BLEND_MODE_MAP[i][0] === normalized) {
            return BLEND_MODE_MAP[i][1];
        }
    }
    
    // Not found - return null to skip setting
    return null;
}

// Apply blend mode to a Cavalry layer
function applyBlendMode(layerId, attrs) {
    if (!layerId || !attrs) return;
    
    try {
        // Check for mix-blend-mode in attrs or style
        var blendMode = attrs['mix-blend-mode'] || 
                       (attrs.style && extractStyleProperty(attrs.style, 'mix-blend-mode'));
        
        if (!blendMode || blendMode === 'normal') {
            // Normal is default (0), no need to set
            return;
        }
        
        var enumValue = svgBlendModeToCavalryEnum(blendMode);
        
        if (enumValue !== null && enumValue !== 0) {
            try {
                api.set(layerId, { 'blendMode': enumValue });
            } catch (eSet) {
                // Silently fail if blend mode isn't supported on this layer type
            }
        }
    } catch (e) {
        // Ignore blend mode errors
    }
}



// ----------------------------------------
// quiver_utilities_gradient.js
// ----------------------------------------
function setGradientContext(map) {
    __svgGradientMap = map || {};
    __svgGradientCache = {};
}

function getGradientShader(gradientId) {
    if (!gradientId) return null;
    if (__svgGradientCache[gradientId]) {
        return __svgGradientCache[gradientId];
    }
    var data = __svgGradientMap[gradientId];
    if (!data) return null;
    
    try { 

        if (data._absoluteCenterX !== undefined || data._absoluteCenterY !== undefined) {

        }
    } catch (e) {}
    
    var sh = createGradientShader(data);
    if (sh) __svgGradientCache[gradientId] = sh;
    return sh;
}

// --- Gradients (M2) ---
function _gradGetAttr(element, name) {
    var regex = new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']');
    var match = regex.exec(element);
    return match ? match[1] : null;
}

function colorWithOpacity(hexColor, opacity) {
    // Default to black if no color provided
    var baseColor = hexColor;
    if (!baseColor || baseColor[0] !== '#') {
        baseColor = '#000000';
    }
    
    var h = baseColor.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    } else if (h.length === 8) {
        // Already has alpha, extract just RGB
        h = h.slice(2);
        if (h.length !== 6) h = h.slice(0, 6);
    }
    if (h.length !== 6) {
        h = '000000'; // Fallback to black
    }
    
    // Default opacity to 1 if undefined/null/NaN
    var opVal = (typeof opacity === 'number' && !isNaN(opacity)) ? opacity : 1;
    var a = Math.max(0, Math.min(1, opVal));
    var aByte = Math.round(a * 255);
    var aHex = aByte.toString(16).padStart(2, '0').toUpperCase();
    return '#' + aHex + h.toUpperCase();
}

function parseGradientStops(gradientElement) {
    var stops = [];
    var stopRegex = /<stop[^>]*>/g;
    var match;
    while ((match = stopRegex.exec(gradientElement)) !== null) {
        var stopElement = match[0];
        var offset = _gradGetAttr(stopElement, "offset");
        
        // Try to get stop-color from direct attribute first
        var stopColor = _gradGetAttr(stopElement, "stop-color");
        var stopOpacity = _gradGetAttr(stopElement, "stop-opacity");
        
        // If not found as direct attribute, try extracting from style (Affinity SVG format)
        if (!stopColor || !stopOpacity) {
            var styleAttr = _gradGetAttr(stopElement, "style");
            if (styleAttr) {
                if (!stopColor) {
                    stopColor = extractStyleProperty(styleAttr, 'stop-color');
                }
                if (!stopOpacity) {
                    stopOpacity = extractStyleProperty(styleAttr, 'stop-opacity');
                }
            }
        }
        
        var offsetNum = 0;
        if (offset) {
            if (offset.indexOf('%') !== -1) offsetNum = parseFloat(offset) / 100; else offsetNum = parseFloat(offset);
            if (isNaN(offsetNum)) offsetNum = 0;
        }
        var opacity = stopOpacity ? parseFloat(stopOpacity) : 1.0;
        if (isNaN(opacity)) opacity = 1.0;
        stops.push({
            offset: Math.max(0, Math.min(1, offsetNum)),
            color: parseColor(stopColor),
            opacity: opacity
        });
    }
    stops.sort(function(a,b){ return a.offset - b.offset; });
    return stops;
}

function extractGradients(svgCode) {
    var gradients = [];
    // linear
    var linearRegex = /<linearGradient[^>]*>[\s\S]*?<\/linearGradient>/g;
    var m;
    while ((m = linearRegex.exec(svgCode)) !== null) {
        var el = m[0];
        var id = _gradGetAttr(el, 'id');
        var gradientUnits = _gradGetAttr(el, 'gradientUnits') || 'objectBoundingBox';
        var x1 = parseFloat(_gradGetAttr(el, 'x1') || '0');
        var y1 = parseFloat(_gradGetAttr(el, 'y1') || '0');
        var x2 = parseFloat(_gradGetAttr(el, 'x2') || '1');
        var y2 = parseFloat(_gradGetAttr(el, 'y2') || '0');
        var transform = _gradGetAttr(el, 'gradientTransform');
        var stops = parseGradientStops(el);
        if (stops.length > 0) {
            var grad = { type:'linear', id: id || ('linear_' + gradients.length), x1:x1, y1:y1, x2:x2, y2:y2, stops:stops, gradientUnits:gradientUnits };
            if (transform) grad.transform = transform;
            
            // Store the gradient center for offset calculations (like radial)
            if (gradientUnits === 'userSpaceOnUse') {
                grad._absoluteCenterX = (x1 + x2) / 2;
                grad._absoluteCenterY = (y1 + y2) / 2;
                grad._isAbsoluteCoords = true;
            }
            
            gradients.push(grad);
        }
    }
    // radial
    var radialRegex = /<radialGradient[^>]*>[\s\S]*?<\/radialGradient>/g;
    while ((m = radialRegex.exec(svgCode)) !== null) {
        var el2 = m[0];
        var id2 = _gradGetAttr(el2, 'id');
        var gradientUnits = _gradGetAttr(el2, 'gradientUnits') || 'objectBoundingBox';
        // Default values depend on gradientUnits
        var defaultVal = (gradientUnits === 'userSpaceOnUse') ? '0' : '0.5';
        var cx = parseFloat(_gradGetAttr(el2, 'cx') || defaultVal);
        var cy = parseFloat(_gradGetAttr(el2, 'cy') || defaultVal);
        var r = parseFloat(_gradGetAttr(el2, 'r') || defaultVal);
        var fx = _gradGetAttr(el2, 'fx');
        var fy = _gradGetAttr(el2, 'fy');
        fx = fx !== null ? parseFloat(fx) : cx;
        fy = fy !== null ? parseFloat(fy) : cy;
        var transform2 = _gradGetAttr(el2, 'gradientTransform');
        var stops2 = parseGradientStops(el2);
        if (stops2.length > 0) {
            var grad2 = { type:'radial', id: id2 || ('radial_' + gradients.length), cx:cx, cy:cy, r:r, fx:fx, fy:fy, stops:stops2, gradientUnits:gradientUnits };
            if (transform2) grad2.transform = transform2;
            gradients.push(grad2);
        }
    }
    return gradients;
}

function createGradientShader(gradientData) {
    try {
        // Skip gradient creation if disabled in settings
        if (!importGradientsEnabled) {

            return null;
        }

        // Create descriptive name: "Linear #FFF → #000" or "Radial #FFF → #000"
        var gradTypeName = gradientData.type === 'radial' ? 'Radial' : 'Linear';
        var firstStop = gradientData.stops && gradientData.stops[0];
        var lastStop = gradientData.stops && gradientData.stops[gradientData.stops.length - 1];
        var firstColor = (firstStop && firstStop.color) ? firstStop.color.toUpperCase() : '';
        var lastColor = (lastStop && lastStop.color) ? lastStop.color.toUpperCase() : '';
        var gradientName = gradTypeName + ' ' + firstColor + ' → ' + lastColor;
        
        var shaderId = api.create('gradientShader', gradientName);

        // Set gradient type using setGenerator
        if (gradientData.type === 'radial') {
            try {
                api.setGenerator(shaderId, 'generator', 'radialGradientShader');
            } catch (e) {
                // Failed to set radial gradient type
            }
        } else {
            // Linear gradient - use linearGradientShader for consistency
            try {
                api.setGenerator(shaderId, 'generator', 'linearGradientShader');
            } catch (e) {
                // Linear is likely the default, so failure is not critical
                // Note: Could not explicitly set linear gradient type (may be default)
            }
        }
        
        // Handle gradient-specific properties
        if (gradientData.type === 'radial') {
            // Set radius mode to Bounding Box (1) for all radial gradients
            // This better matches Figma's behavior where gradients scale to fit the shape
            // radiusMode: 0 = Fixed, 1 = Bounding Box
            try {
                api.set(shaderId, {"generator.radiusMode": 1}); // Bounding Box
            } catch (eRM) {
                console.warn('[RADIAL GRADIENT] Could not set radiusMode: ' + eRM.message);
            }
            
            // Calculate SVD singular values from the gradient transform
            // These represent the actual ellipse semi-axes in pixels
            // We use scale.x and scale.y to control the ellipse dimensions directly,
            // so radiusRatio is set to 1 (no additional stretching needed)
            if (gradientData.transform) {
                try {
                    var matrix = parseTransformMatrixList(gradientData.transform);
                    var a = matrix.a, b = matrix.b, c = matrix.c, d = matrix.d;
                    
                    // Calculate singular values of the 2x2 transformation matrix
                    // For M = [[a, c], [b, d]], singular values are sqrt of eigenvalues of M^T * M
                    var norm1Sq = a * a + b * b;
                    var norm2Sq = c * c + d * d;
                    var dotProd = a * c + b * d;
                    
                    var sum = norm1Sq + norm2Sq;
                    var diff = norm1Sq - norm2Sq;
                    var discriminant = Math.sqrt(diff * diff + 4 * dotProd * dotProd);
                    
                    var sigma1Sq = (sum + discriminant) / 2;
                    var sigma2Sq = (sum - discriminant) / 2;
                    
                    var sigma1 = Math.sqrt(Math.max(0, sigma1Sq));
                    var sigma2 = Math.sqrt(Math.max(0, sigma2Sq));
                    
                    // For userSpaceOnUse gradients, we use scale.x/y to control the ellipse directly
                    // So radiusRatio should be 1 (the elliptical shape comes from different scale values)
                    // For objectBoundingBox, we may still need radiusRatio
                    var isAbsoluteCoords = (Math.abs(a) > 2 || Math.abs(b) > 2 || Math.abs(c) > 2 || Math.abs(d) > 2);
                    
                    if (isAbsoluteCoords && gradientData.gradientUnits === 'userSpaceOnUse') {
                        // Set radiusRatio to 1 - ellipse shape will come from scale.x/y
                        api.set(shaderId, {"generator.radiusRatio": 1});
                    } else {
                        // For objectBoundingBox or small matrices, use radiusRatio for aspect
                        var radiusRatio = 1;
                        if (sigma2 > 0.0001) {
                            radiusRatio = sigma1 / sigma2;
                        }
                        radiusRatio = Math.max(0.01, Math.min(100, radiusRatio));
                        api.set(shaderId, {"generator.radiusRatio": radiusRatio});
                    }
                    
                    // Store SVD values for scale calculation when connecting to shape
                    if (__svgGradientMap && __svgGradientMap[gradientData.id]) {
                        __svgGradientMap[gradientData.id]._svdSigma1 = sigma1;
                        __svgGradientMap[gradientData.id]._svdSigma2 = sigma2;
                        __svgGradientMap[gradientData.id]._isAbsoluteCoords = isAbsoluteCoords;
                    }
                } catch (eRR) {
                    console.warn('[RADIAL GRADIENT] Could not process transform: ' + eRR.message);
                }
            }
            
            // Calculate radius first (needed for offset calculation)
            var calculatedRadius = null;
            if (gradientData.r !== undefined && gradientData.gradientUnits === 'userSpaceOnUse') {
                // For userSpaceOnUse, calculate the actual radius with transform
                if (gradientData.transform) {
                    try {
                        var matrix = parseTransformMatrixList(gradientData.transform);
                        var decomposed = decomposeMatrix(matrix);
                        var scaleX = Math.abs(decomposed.scaleX);
                        var scaleY = Math.abs(decomposed.scaleY);
                        var avgScale = (scaleX + scaleY) / 2;
                        calculatedRadius = gradientData.r * avgScale;
                    } catch (eT) {
                        calculatedRadius = gradientData.r;
                    }
                } else {
                    calculatedRadius = gradientData.r;
                }
            }
            
            // Set radial-specific properties (including offset from transform)
            // Always process offset for radial gradients, even if cx/cy are 0
            if (gradientData.type === 'radial') {
                
                // Check if gradient data already has these properties set
                try {
                    if (gradientData._absoluteCenterX !== undefined || gradientData._absoluteCenterY !== undefined) {

                    }
                } catch (e0) {}
                
                try {
                    var offsetX, offsetY;
                    
                    // Handle different gradient units
                    if (gradientData.gradientUnits === 'userSpaceOnUse') {
                        // For userSpaceOnUse, we need the center position from cx/cy plus any transform translation
                        // Default to 0 if cx/cy are not specified
                        offsetX = (gradientData.cx !== undefined) ? parseFloat(gradientData.cx) : 0;
                        offsetY = (gradientData.cy !== undefined) ? parseFloat(gradientData.cy) : 0;

                        // Check if we have a transform with translation
                        if (gradientData.transform) {
                            try {
                                var matrix = parseTransformMatrixList(gradientData.transform);
                                var decomposed = decomposeMatrix(matrix);
                                
                                // Add the translation from the transform
                                var translateX = parseFloat(decomposed.translateX) || 0;
                                var translateY = parseFloat(decomposed.translateY) || 0;

                                offsetX += translateX;
                                offsetY += translateY;
                                
                            } catch (eT) {
                                // Error parsing gradient transform
                                // Keep base cx/cy values
                            }
                        } else {
                        }
                        
                        // For userSpaceOnUse with scale=100 and Fixed radius mode,
                        // the offset needs to be relative to the shape's center
                        // Since we don't have the shape info here, we'll store the absolute position
                        // and calculate the relative offset when connecting to the shape
                        
                        // Store absolute position for later use when connecting to shape
                        // Note: Don't invert Y here, we'll handle coordinate conversion when we know the viewBox
                        
                        if (__svgGradientMap && __svgGradientMap[gradientData.id]) {
                            // Check if we're modifying the right object

                            // Make sure we have valid numbers before storing
                            var absX = parseFloat(offsetX);
                            var absY = parseFloat(offsetY);

                            if (!isNaN(absX) && !isNaN(absY)) {
                                // Log before storing
                                
                                // Store in both places to be sure
                                __svgGradientMap[gradientData.id]._absoluteCenterX = absX;
                                __svgGradientMap[gradientData.id]._absoluteCenterY = absY;
                                __svgGradientMap[gradientData.id]._gradientUnits = gradientData.gradientUnits;
                                
                                // Also store on the gradientData object itself
                                gradientData._absoluteCenterX = absX;
                                gradientData._absoluteCenterY = absY;
                                
                                // Log after storing
                            } else {
                                // Warning: Invalid gradient position values
                            }
                        } else {
                            // Warning: Could not store gradient absolute position
                        }

                        // For now, set offset to 0,0 - we'll update it when connecting to shape
                        offsetX = 0;
                        offsetY = 0;
                    } else {
                        // For objectBoundingBox (default), cx/cy are 0-1
                        // Cavalry offset appears to use -1 to 1 range
                        offsetX = (gradientData.cx - 0.5) * 2;
                        offsetY = (gradientData.cy - 0.5) * 2;
                        
                        // Clamp to reasonable range
                        offsetX = Math.max(-2, Math.min(2, offsetX));
                        offsetY = Math.max(-2, Math.min(2, offsetY));
                    }
                    
                    // Always try to set offset, even if it's (0, 0)
                    // Try setting offset.x and offset.y separately (this seems to work best)
                    try {
                            api.set(shaderId, {"generator.offset.x": offsetX, "generator.offset.y": offsetY});
                            
                            // Log the actual values that were set to help debug
                            try {
                                var actualX = api.get(shaderId, "generator.offset.x");
                                var actualY = api.get(shaderId, "generator.offset.y");
                            } catch (eGet) {}
                    } catch (eXY) {
                        // If that fails, try as array
                        try {
                            api.set(shaderId, {"generator.offset": [offsetX, offsetY]});
                        } catch (eArr) {
                            // Could not set gradient offset
                        }
                    }
                    
                    // Force update to ensure offset is visible
                    try {
                        // Try to trigger an update by setting another property
                        var currentRadius = api.get(shaderId, "generator.radius");
                        api.set(shaderId, {"generator.radius": currentRadius});
                    } catch (eUpdate) {}
                } catch (eOff) {
                    // Error setting gradient offset
                }
            }
            
            // Handle radial gradient radius
            if (gradientData.r !== undefined) {
                try {
                    // For userSpaceOnUse, the radius is in absolute pixels
                    if (gradientData.gradientUnits === 'userSpaceOnUse') {
                        var radius = calculatedRadius || gradientData.r;
                        
                        // Set the radius property
                        try {
                            api.set(shaderId, {"generator.radius": radius});
                        } catch (eRad) {
                            // Error setting radius
                        }
                        
                        // Set scale to 100 for userSpaceOnUse radial gradients
                        try {
                            api.set(shaderId, {"generator.scale.x": 100, "generator.scale.y": 100});
                        } catch (eResetScale) {}
                        
                        // Note: Non-uniform scaling for radial gradients might need to be handled differently
                        // For now, we'll use uniform scaling based on the average
                        if (gradientData.transform) {
                            try {
                                var matrix = parseTransformMatrixList(gradientData.transform);
                                var decomposed = decomposeMatrix(matrix);
                                var scaleX = Math.abs(decomposed.scaleX);
                                var scaleY = Math.abs(decomposed.scaleY);
                                
                                if (Math.abs(scaleX - scaleY) > 0.001) {
                                    // Note: Non-uniform scaling detected - using average for radius
                                }
                            } catch (eT) {}
                        }
                    } else {
                        // For objectBoundingBox, use scale
                        // SVG default radius is 0.5 for objectBoundingBox
                        // Scale = actual radius / default radius
                        var scale = gradientData.r / 0.5;

                        // Sanity check for reasonable scale values to avoid parsing errors
                        if (scale > 5) {
                            // Warning: Large radial gradient scale, clamping to 2.0
                            scale = 2.0;
                        }
                        
                        // Ensure scale is a float with decimal
                        scale = parseFloat(scale.toFixed(2));
                        
                        // Only set scale if it's not 1.0 (default)
                        if (Math.abs(scale - 1.0) > 0.01) {
                            // Try setting scale.x and scale.y separately (this seems to work best)
                            try {
                                api.set(shaderId, {"generator.scale.x": scale, "generator.scale.y": scale});
                            } catch (eXY) {
                                // If that fails, try as array
                                try {
                                    api.set(shaderId, {"generator.scale": [scale, scale]});
                                } catch (eArr) {
                                    // Last resort: try single value
                                    try {
                                        api.set(shaderId, {"generator.scale": scale});
                                    } catch (eSingle) {
                                        // Error setting radial gradient scale - all methods failed
                                    }
                                }
                            }
                        } else {
                            
                        }
                    }
                } catch (eScale) {
                    
                }
            }
        }
        
        var angle = 0;
        if (gradientData.type === 'linear') {
            var dx = (gradientData.x2 - gradientData.x1);
            var dy = (gradientData.y2 - gradientData.y1);
            // SVG Y-axis points down, Cavalry Y-axis points up, so invert dy
            var rawAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
            angle = ((rawAngle % 360) + 360) % 360;
            api.set(shaderId, {"generator.rotation": angle});
            
        }
        
        // Apply gradient transform if present (for rotation, scale, translation)
        if (gradientData.transform) {
            try {
                // Parse the full transform matrix to get rotation, scale, etc.
                var matrix = parseTransformMatrixList(gradientData.transform);
                var decomposed = decomposeMatrix(matrix);
                
                // Apply rotation - SVG uses clockwise, Cavalry uses counter-clockwise
                if (Math.abs(decomposed.rotationDeg) > 0.0001) {
                    // Negate the rotation to convert from SVG to Cavalry coordinate system
                    var cavalryRotation = -decomposed.rotationDeg;
                    api.set(shaderId, {"generator.rotation": cavalryRotation});
                    
                }
                
                // Apply scale if present
                if (Math.abs(decomposed.scaleX - 1) > 0.0001 || Math.abs(decomposed.scaleY - 1) > 0.0001) {
                    var scaleX = decomposed.scaleX;
                    var scaleY = decomposed.scaleY;
                    
                    // For userSpaceOnUse radial gradients, the scale is applied to the radius, not generator.scale
                    if (gradientData.gradientUnits === 'userSpaceOnUse' && gradientData.type === 'radial') {
                        // Scale is already handled in the radius section above
                        
                    } else if (gradientData.gradientUnits === 'userSpaceOnUse') {
                        // For linear userSpaceOnUse gradients, we might still need to handle scale differently
                        
                    } else {
                        // For objectBoundingBox, apply the scale but cap it
                        var avgScale = (scaleX + scaleY) / 2;
                        
                        // Cap at reasonable values
                        if (avgScale > 5) {
                            
                            avgScale = 5;
                        }
                        
                        // Ensure scale is a float with decimal
                        avgScale = parseFloat(avgScale.toFixed(2));
                        
                        // Try setting scale as array [x, y]
                        try {
                            api.set(shaderId, {"generator.scale": [scaleX, scaleY]});
                            
                        } catch (eArr) {
                            // If array fails, try separate x/y
                            try {
                                api.set(shaderId, {"generator.scale.x": scaleX, "generator.scale.y": scaleY});
                                
                            } catch (eXY) {
                                // Last resort: try single average value
                                try {
                                    api.set(shaderId, {"generator.scale": avgScale});
                                    
                                } catch (eSingle) {
                                    
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                
            }
        }
        
        // Set gradient stops on the shader
        var colors = gradientData.stops.map(function(stop){ return stop.color || '#000000'; });
        // Ensure at least two stops for Cavalry gradient
        if (colors.length === 1) colors.push(colors[0]);
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop properties
        for (var i = 0; i < gradientData.stops.length; i++) {
            var stop = gradientData.stops[i];
            try {
                // Set position
                var posAttr = {}; 
                posAttr['generator.gradient.' + i + '.position'] = stop.offset; 
                api.set(shaderId, posAttr);
            } catch (ePos) {
                
            }
            
            try {
                // Set color with opacity
                var colorWithAlpha = colorWithOpacity(stop.color, stop.opacity);
                var colAttr = {}; 
                colAttr['generator.gradient.' + i + '.color'] = colorWithAlpha; 
                api.set(shaderId, colAttr);
            } catch (eCol) {
            }
        }
        
        return shaderId;
    } catch (e) {
        
        return null;
    }
}

/**
 * Create a Sweep (Angular) gradient shader from Figma's GRADIENT_ANGULAR data.
 * Figma exports angular gradients with a data-figma-gradient-fill attribute since
 * SVG doesn't natively support conic/angular gradients.
 * 
 * Cavalry API:
 * - api.create('gradientShader', name) - Create gradient layer
 * - api.setGenerator(id, 'generator', 'sweepGradientShader') - Set to sweep mode
 * - api.setGradientFromColors(id, attr, colors) - Set gradient colors
 * - api.set(id, props) - Set properties like rotation, stops
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect shader to shape
 * 
 * @param {Object} figmaGradData - Parsed Figma gradient data from data-figma-gradient-fill
 * @param {string} layerId - The Cavalry layer ID to apply the gradient to
 * @param {Object} attrs - The shape's SVG attributes (for calculating center, etc.)
 * @returns {string|null} The created shader ID, or null on failure
 */
function createSweepGradientFromFigma(figmaGradData, layerId, attrs) {
    try {
        // Skip gradient creation if disabled in settings
        if (typeof importGradientsEnabled !== 'undefined' && !importGradientsEnabled) {
            return null;
        }
        
        // Extract gradient stops from Figma data
        var stops = figmaGradData.stops || figmaGradData.stopsVar || [];
        if (stops.length === 0) {
            console.warn('[SWEEP GRADIENT] No stops found in Figma gradient data');
            return null;
        }
        
        
        // Create descriptive name from first and last colors
        var firstStop = stops[0];
        var lastStop = stops[stops.length - 1];
        var firstColor = figmaRgbaToHex(firstStop.color);
        var lastColor = figmaRgbaToHex(lastStop.color);
        var gradientName = 'Sweep ' + firstColor + ' → ' + lastColor;
        
        // Create the gradient shader
        var shaderId = api.create('gradientShader', gradientName);
        
        // Set gradient type to sweep (angular) gradient
        try {
            api.setGenerator(shaderId, 'generator', 'sweepGradientShader');
        } catch (eGen) {
            console.warn('[SWEEP GRADIENT] Could not set sweepGradientShader: ' + eGen.message);
            // If sweepGradientShader isn't available, the gradient may default to linear
        }
        
        // Enable Wrap UVs - this makes the gradient wrap smoothly from the last stop
        // back to the first stop, matching Figma's angular gradient behavior
        // Cavalry API: generator.wrapUVs (boolean)
        try {
            api.set(shaderId, {"generator.wrapUVs": true});
        } catch (eWrap) {
            console.warn('[SWEEP GRADIENT] Could not set wrapUVs: ' + eWrap.message);
        }
        
        // Extract gradient stops and invert positions for Cavalry
        // Figma angular gradients go CLOCKWISE, Cavalry sweep gradients go COUNTER-CLOCKWISE
        // To fix this, we invert stop positions: new_position = 1.0 - original_position
        // This reverses the direction so colors appear at the correct angles
        
        // Build array with inverted positions
        var invertedStops = [];
        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            // Invert position: 0 stays at 0, others get mirrored
            // Position 0 becomes 0, 0.341 becomes 0.659, 0.654 becomes 0.346, etc.
            var invertedPos = (stop.position === 0) ? 0 : (1.0 - stop.position);
            invertedStops.push({
                position: invertedPos,
                color: stop.color
            });
        }
        
        // Sort by position (ascending) so gradient stops are in correct order
        invertedStops.sort(function(a, b) { return a.position - b.position; });
        
        // Add closing stop at position 1.0 (same color as position 0) for seamless wrap
        // Find the color at position 0
        var startColor = invertedStops[0].color;
        invertedStops.push({
            position: 1.0,
            color: startColor
        });
        
        
        // Build colors array for setGradientFromColors
        var colors = [];
        for (var ic = 0; ic < invertedStops.length; ic++) {
            colors.push(figmaRgbaToHex(invertedStops[ic].color));
        }
        
        // Ensure at least two stops for Cavalry gradient
        if (colors.length === 1) colors.push(colors[0]);
        
        // Set gradient colors
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop positions and colors with opacity
        for (var si = 0; si < invertedStops.length; si++) {
            var stopData = invertedStops[si];
            var isClosing = (si === invertedStops.length - 1);
            
            try {
                // Set position
                var posAttr = {};
                posAttr['generator.gradient.' + si + '.position'] = stopData.position;
                api.set(shaderId, posAttr);
            } catch (ePos) {
            }
            
            try {
                // Set color with opacity
                var colorWithAlphaValue = figmaRgbaToHexWithAlpha(stopData.color);
                var logSuffix = isClosing ? ' (closing loop)' : '';
                var colAttr = {};
                colAttr['generator.gradient.' + si + '.color'] = colorWithAlphaValue;
                api.set(shaderId, colAttr);
            } catch (eCol) {
            }
        }
        
        // Calculate rotation from Figma's transform matrix
        // Figma transform: {m00, m01, m02, m10, m11, m12}
        // m00, m01, m10, m11 form the 2x2 rotation/scale matrix
        // m02, m12 are translation (center offset)
        // 
        // Key coordinate system differences:
        // - Figma angular gradient: starts at TOP (12 o'clock), goes clockwise
        //   (follows CSS conic-gradient convention: "from 0deg" = top)
        // - Cavalry sweep gradient: starts at RIGHT (3 o'clock), goes counter-clockwise
        //   (Cavalry API: generator.rotation rotates the start point CCW)
        // 
        // IMPORTANT: The gradient transform from Figma often includes the SHAPE's rotation.
        // When you rotate a shape in Figma, the gradient stays aligned with it, so the
        // gradient transform captures that combined rotation. Since the shape's rotation
        // is already applied to the Cavalry shape separately, we need to subtract it
        // from the gradient rotation to avoid double-rotation.
        // 
        // Stop position inversion (done above) handles the direction change (CW → CCW).
        // Rotation must account for the starting point difference (-90°).
        if (figmaGradData.transform) {
            try {
                var t = figmaGradData.transform;
                // Calculate rotation angle from the gradient transform matrix
                // atan2(m10, m00) extracts the rotation component
                var rotationRad = Math.atan2(t.m10, t.m00);
                var gradientRotationDeg = rotationRad * (180 / Math.PI);
                
                // Extract the shape's rotation from its SVG transform attribute
                // The shape's rotation is applied to the Cavalry shape separately,
                // so we need to subtract it to get the gradient-only rotation
                // 
                // Note: For rects with complex transforms, the transform may have been
                // pre-processed and deleted, with the rotation stored in _rotationDeg
                var shapeRotationDeg = 0;
                if (attrs) {
                    if (attrs._rotationDeg !== undefined) {
                        // Use pre-computed rotation from rect transform processing
                        shapeRotationDeg = attrs._rotationDeg;
                    } else if (attrs.transform) {
                        // Parse rotation from transform attribute
                        shapeRotationDeg = getRotationDegFromTransform(attrs.transform);
                    }
                }
                
                // Calculate the gradient-relative rotation (gradient rotation minus shape rotation)
                var relativeGradientRotation = gradientRotationDeg - shapeRotationDeg;
                
                
                // Convert from Figma (TOP start, CW) to Cavalry (RIGHT start, CCW):
                // The negation accounts for direction flip, -90 shifts from TOP to RIGHT
                // Example: Figma 0° → -0 - 90 = -90° = 270° (TOP position in Cavalry)
                var cavalryRotation = -relativeGradientRotation - 90;
                
                // Normalize to 0-360 range
                cavalryRotation = ((cavalryRotation % 360) + 360) % 360;
                
                
                api.set(shaderId, {"generator.rotation": cavalryRotation});
            } catch (eRot) {
                console.warn('[SWEEP GRADIENT] Error applying rotation: ' + eRot.message);
            }
        }
        
        // Apply opacity if specified
        if (figmaGradData.opacity !== undefined && figmaGradData.opacity < 1) {
            var alphaPercent = Math.round(figmaGradData.opacity * 100);
            try {
                api.set(shaderId, {'alpha': alphaPercent});
            } catch (eAlpha) {}
        }
        
        // Connect the shader to the shape
        try {
            api.setFill(layerId, true);
            api.set(layerId, {"material.materialColor.a": 0}); // Hide base color
            api.set(layerId, {"material.alpha": 100});
            api.connect(shaderId, 'id', layerId, 'material.colorShaders');
            
            // Parent the shader under the shape
            try { api.parent(shaderId, layerId); } catch (ePar) {}
            
        } catch (eConnect) {
            console.error('[SWEEP GRADIENT] Failed to connect shader: ' + eConnect.message);
        }
        
        return shaderId;
        
    } catch (e) {
        console.error('[SWEEP GRADIENT] Error creating sweep gradient: ' + e.message);
        return null;
    }
}

/**
 * Create a Diamond gradient shader from Figma's GRADIENT_DIAMOND data.
 * Figma exports diamond gradients with a data-figma-gradient-fill attribute since
 * SVG doesn't natively support diamond gradients.
 * 
 * Diamond gradients in Figma radiate from the center outward in a diamond shape.
 * In Cavalry, we approximate this using a Shape Gradient with shapeSides=4.
 * 
 * Cavalry API:
 * - api.create('gradientShader', name) - Create gradient layer
 * - api.setGenerator(id, 'generator', 'shapeGradientShader') - Set to shape mode
 * - api.set(id, {'generator.shapeSides': 4}) - Set to 4 sides for diamond shape
 * - api.setGradientFromColors(id, attr, colors) - Set gradient colors
 * - api.set(id, props) - Set properties like rotation, stops
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect shader to shape
 * 
 * @param {Object} figmaGradData - Parsed Figma gradient data from data-figma-gradient-fill
 * @param {string} layerId - The Cavalry layer ID to apply the gradient to
 * @param {Object} attrs - The shape's SVG attributes (for calculating center, etc.)
 * @returns {string|null} The created shader ID, or null on failure
 */
function createDiamondGradientFromFigma(figmaGradData, layerId, attrs) {
    try {
        // Skip gradient creation if disabled in settings
        if (typeof importGradientsEnabled !== 'undefined' && !importGradientsEnabled) {
            return null;
        }
        
        // Extract gradient stops from Figma data
        var stops = figmaGradData.stops || figmaGradData.stopsVar || [];
        if (stops.length === 0) {
            console.warn('[DIAMOND GRADIENT] No stops found in Figma gradient data');
            return null;
        }
        
        
        // Create descriptive name from first and last colors
        var firstStop = stops[0];
        var lastStop = stops[stops.length - 1];
        var firstColor = figmaRgbaToHex(firstStop.color);
        var lastColor = figmaRgbaToHex(lastStop.color);
        var gradientName = 'Diamond ' + firstColor + ' → ' + lastColor;
        
        // Create the gradient shader
        var shaderId = api.create('gradientShader', gradientName);
        
        // Set gradient type to shape gradient (for diamond with 4 sides)
        // Cavalry API: api.setGenerator(id, 'generator', 'shapeGradientShader')
        try {
            api.setGenerator(shaderId, 'generator', 'shapeGradientShader');
        } catch (eGen) {
            console.warn('[DIAMOND GRADIENT] Could not set shapeGradientShader: ' + eGen.message);
            // Fallback: try radial gradient as an approximation
            try {
                api.setGenerator(shaderId, 'generator', 'radialGradientShader');
            } catch (eFallback) {
                console.warn('[DIAMOND GRADIENT] Could not set radial fallback: ' + eFallback.message);
            }
        }
        
        // Set shape sides to 4 for diamond shape
        // Cavalry API: generator.sides (integer) - from Cavalry docs "Shape Sides"
        try {
            api.set(shaderId, {"generator.sides": 4});
        } catch (eSides) {
            console.warn('[DIAMOND GRADIENT] Could not set sides: ' + eSides.message);
        }
        
        // Set rotation to 45 degrees to orient diamond correctly (point up)
        // Figma's diamond gradient has points at top/bottom/left/right
        // Cavalry's polygon with 4 sides starts with flat top, so rotate 45°
        try {
            api.set(shaderId, {"generator.rotation": 45});
        } catch (eInitRot) {
            console.warn('[DIAMOND GRADIENT] Could not set initial rotation: ' + eInitRot.message);
        }
        
        // Build colors array for setGradientFromColors
        var colors = [];
        for (var ic = 0; ic < stops.length; ic++) {
            colors.push(figmaRgbaToHex(stops[ic].color));
        }
        
        // Ensure at least two stops for Cavalry gradient
        if (colors.length === 1) colors.push(colors[0]);
        
        // Set gradient colors
        api.setGradientFromColors(shaderId, 'generator.gradient', colors);
        
        // Set individual stop positions and colors with opacity
        for (var si = 0; si < stops.length; si++) {
            var stopData = stops[si];
            
            try {
                // Set position
                var posAttr = {};
                posAttr['generator.gradient.' + si + '.position'] = stopData.position;
                api.set(shaderId, posAttr);
            } catch (ePos) {
            }
            
            try {
                // Set color with opacity
                var colorWithAlphaValue = figmaRgbaToHexWithAlpha(stopData.color);
                var colAttr = {};
                colAttr['generator.gradient.' + si + '.color'] = colorWithAlphaValue;
                api.set(shaderId, colAttr);
            } catch (eCol) {
            }
        }
        
        // Calculate rotation from Figma's transform matrix
        // Figma transform: {m00, m01, m02, m10, m11, m12}
        // m00, m01, m10, m11 form the 2x2 rotation/scale matrix
        // m02, m12 are translation (center offset)
        // 
        // IMPORTANT: The gradient transform from Figma often includes the SHAPE's rotation.
        // When you rotate a shape in Figma, the gradient stays aligned with it, so the
        // gradient transform captures that combined rotation. Since the shape's rotation
        // is already applied to the Cavalry shape separately, we need to subtract it
        // from the gradient rotation to avoid double-rotation.
        if (figmaGradData.transform) {
            try {
                var t = figmaGradData.transform;
                // Calculate rotation angle from the gradient transform matrix
                // rotation = atan2(m10, m00) gives the angle in radians
                var rotationRad = Math.atan2(t.m10, t.m00);
                var gradientRotationDeg = rotationRad * (180 / Math.PI);
                
                // Extract the shape's rotation from its SVG transform attribute
                // The shape's rotation is applied to the Cavalry shape separately,
                // so we need to subtract it to get the gradient-only rotation
                // 
                // Note: For rects with complex transforms, the transform may have been
                // pre-processed and deleted, with the rotation stored in _rotationDeg
                var shapeRotationDeg = 0;
                if (attrs) {
                    if (attrs._rotationDeg !== undefined) {
                        // Use pre-computed rotation from rect transform processing
                        shapeRotationDeg = attrs._rotationDeg;
                    } else if (attrs.transform) {
                        // Parse rotation from transform attribute
                        shapeRotationDeg = getRotationDegFromTransform(attrs.transform);
                    }
                }
                
                // Calculate the gradient-relative rotation (gradient rotation minus shape rotation)
                var relativeGradientRotation = gradientRotationDeg - shapeRotationDeg;
                
                
                // Add 45° base rotation for diamond orientation, then apply relative gradient rotation
                // Negate the rotation because Cavalry uses counter-clockwise positive
                var cavalryRotation = 45 - relativeGradientRotation;
                
                // Normalize to 0-360 range
                cavalryRotation = ((cavalryRotation % 360) + 360) % 360;
                
                
                api.set(shaderId, {"generator.rotation": cavalryRotation});
            } catch (eRot) {
                console.warn('[DIAMOND GRADIENT] Error applying rotation: ' + eRot.message);
            }
        }
        
        // Set tiling to Mirror for diamond gradients
        // Cavalry API: Gradient Shader has 'tiling' at top level (not under generator.)
        // Values: 0=Clamp, 1=Repeat, 2=Mirror, 3=Decal
        try {
            api.set(shaderId, {'tiling': 2});
        } catch (eTiling) {
            console.warn('[DIAMOND GRADIENT] Could not set tiling: ' + eTiling.message);
        }
        
        // Apply opacity if specified
        if (figmaGradData.opacity !== undefined && figmaGradData.opacity < 1) {
            var alphaPercent = Math.round(figmaGradData.opacity * 100);
            try {
                api.set(shaderId, {'alpha': alphaPercent});
            } catch (eAlpha) {}
        }
        
        // Connect the shader to the shape
        try {
            api.setFill(layerId, true);
            api.set(layerId, {"material.materialColor.a": 0}); // Hide base color
            api.set(layerId, {"material.alpha": 100});
            api.connect(shaderId, 'id', layerId, 'material.colorShaders');
            
            // Parent the shader under the shape
            try { api.parent(shaderId, layerId); } catch (ePar) {}
            
        } catch (eConnect) {
            console.error('[DIAMOND GRADIENT] Failed to connect shader: ' + eConnect.message);
        }
        
        return shaderId;
        
    } catch (e) {
        console.error('[DIAMOND GRADIENT] Error creating diamond gradient: ' + e.message);
        return null;
    }
}

/**
 * Convert Figma RGBA color object to hex string (#RRGGBB)
 * @param {Object} color - Figma color object {r, g, b, a} with 0-1 values
 * @returns {string} Hex color string
 */
function figmaRgbaToHex(color) {
    if (!color) return '#000000';
    var r = Math.round((color.r || 0) * 255).toString(16).padStart(2, '0');
    var g = Math.round((color.g || 0) * 255).toString(16).padStart(2, '0');
    var b = Math.round((color.b || 0) * 255).toString(16).padStart(2, '0');
    return '#' + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
}

/**
 * Convert Figma RGBA color object to hex string with alpha (#AARRGGBB for Cavalry)
 * @param {Object} color - Figma color object {r, g, b, a} with 0-1 values
 * @returns {string} Hex color string with alpha
 */
function figmaRgbaToHexWithAlpha(color) {
    if (!color) return '#FF000000';
    var a = Math.round((color.a !== undefined ? color.a : 1) * 255).toString(16).padStart(2, '0');
    var r = Math.round((color.r || 0) * 255).toString(16).padStart(2, '0');
    var g = Math.round((color.g || 0) * 255).toString(16).padStart(2, '0');
    var b = Math.round((color.b || 0) * 255).toString(16).padStart(2, '0');
    return '#' + a.toUpperCase() + r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
}


// ----------------------------------------
// quiver_utilities_patterns.js
// ----------------------------------------
/**
 * Parse a matrix transform string: matrix(a, b, c, d, e, f)
 * Returns { a, b, c, d, e, f } or null if not a matrix transform
 * In SVG: a=scaleX, b=skewY, c=skewX, d=scaleY, e=translateX, f=translateY
 */
function parseMatrixTransform(transformStr) {
    if (!transformStr) return null;
    var matrixMatch = /matrix\s*\(\s*([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)\s*\)/.exec(transformStr);
    if (matrixMatch) {
        return {
            a: parseFloat(matrixMatch[1]) || 0,  // scaleX
            b: parseFloat(matrixMatch[2]) || 0,  // skewY
            c: parseFloat(matrixMatch[3]) || 0,  // skewX
            d: parseFloat(matrixMatch[4]) || 0,  // scaleY
            e: parseFloat(matrixMatch[5]) || 0,  // translateX
            f: parseFloat(matrixMatch[6]) || 0   // translateY
        };
    }
    // Also handle scale(sx, sy) or scale(s) transform
    var scaleMatch = /scale\s*\(\s*([^,\s\)]+)(?:[\s,]+([^,\s\)]+))?\s*\)/.exec(transformStr);
    if (scaleMatch) {
        var sx = parseFloat(scaleMatch[1]) || 1;
        var sy = scaleMatch[2] ? parseFloat(scaleMatch[2]) : sx;
        return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    }
    return null;
}

function extractPatterns(svgCode) {
    var patterns = {};
    try {
        var re = /<pattern[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/pattern>/g; var m;
        while ((m = re.exec(svgCode)) !== null) {
            var pid = m[1]; var body = m[2] || '';
            var open = m[0].slice(0, m[0].indexOf('>')+1);
            var attrs = {};
            var keys = ['x','y','width','height','patternUnits','patternContentUnits','patternTransform'];
            for (var i=0;i<keys.length;i++){ var kk=keys[i]; var vv=extractAttribute(open, kk); if (vv!==null) attrs[kk]=vv; }
            // <image> inside pattern
            var im = /<image[^>]*>/i.exec(body);
            var image = null;
            var useTransform = null; // Transform matrix from <use> element
            if (im) {
                var imgOpen = im[0];
                var href = extractAttribute(imgOpen, 'href') || extractAttribute(imgOpen, 'xlink:href');
                var ix = extractAttribute(imgOpen, 'x');
                var iy = extractAttribute(imgOpen, 'y');
                var iw = extractAttribute(imgOpen, 'width');
                var ih = extractAttribute(imgOpen, 'height');
                var imgTransform = extractAttribute(imgOpen, 'transform');
                image = { href: href||'', x: ix||'0', y: iy||'0', width: iw||attrs.width||'0', height: ih||attrs.height||'0' };
                if (imgTransform) {
                    useTransform = parseMatrixTransform(imgTransform);
                }
            }
            // Or <use xlink:href="#imageId"> with transform
            if (!image) {
                var useMatch = /<use[^>]*>/ig.exec(body);
                if (useMatch) {
                    var useOpen = useMatch[0];
                    var hrefUse = extractAttribute(useOpen, 'href') || extractAttribute(useOpen, 'xlink:href');
                    var useTransformStr = extractAttribute(useOpen, 'transform');
                    if (useTransformStr) {
                        useTransform = parseMatrixTransform(useTransformStr);
                    }
                    if (hrefUse && hrefUse.charAt(0) === '#') {
                        var refId = hrefUse.slice(1);
                        try {
                            var esc = refId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            var reImg = new RegExp('<image[^>]*id=["\']' + esc + '["\'][^>]*>', 'i');
                            var mImg = reImg.exec(svgCode);
                            if (mImg) {
                                var imgOpen2 = mImg[0];
                                var href2 = extractAttribute(imgOpen2, 'href') || extractAttribute(imgOpen2, 'xlink:href');
                                var iw2 = extractAttribute(imgOpen2, 'width');
                                var ih2 = extractAttribute(imgOpen2, 'height');
                                image = { href: href2||'', x: '0', y: '0', width: iw2||attrs.width||'0', height: ih2||attrs.height||'0' };
                            }
                        } catch (eFind) {}
                    }
                }
            }
            patterns[pid] = { attrs: attrs, image: image, useTransform: useTransform };
        }
    } catch (e) { 
        // extractPatterns error
    }
    return patterns;
}

// ----------------------------------------
// quiver_utilities_images.js
// ----------------------------------------
// --- Image asset helpers ---
var __quiverAssetGroupId = null; // Cache for the Quiver asset group in Assets Window

function _ensureQuiverAssetGroup() {
    try {
        // Check if we already have the Quiver asset group
        if (__quiverAssetGroupId && api.layerExists && api.layerExists(__quiverAssetGroupId)) {
            return __quiverAssetGroupId;
        }
        
        // Try to find existing Quiver asset group by checking all assets
        var assetLayers = [];
        try { assetLayers = api.getAssetWindowLayers && api.getAssetWindowLayers(false) || []; } catch (e) {}
        
        for (var i = 0; i < assetLayers.length; i++) {
            var assetId = assetLayers[i];
            var assetName = '';
            try { assetName = api.getNiceName(assetId) || ''; } catch (e) {}
            if (assetName === 'Quiver') {
                // Check if it's an asset group (we can try to parent to it as a test)
                __quiverAssetGroupId = assetId;
                return __quiverAssetGroupId;
            }
        }
        
        // Create new asset group using the proper API
        try {
            if (api.createAssetGroup) {
                __quiverAssetGroupId = api.createAssetGroup('Quiver');
                return __quiverAssetGroupId;
            } else {
                // api.createAssetGroup not available
                return null;
            }
        } catch (eCreate) {
            // Could not create asset group
            return null;
        }
    } catch (e) {
        // Error ensuring Quiver asset group
        return null;
    }
}

function _ensureAssetsQuiverFolder() {
    try {
        if (__imageImportCache.__quiverDir) return __imageImportCache.__quiverDir;
        // Prefer Cavalry's Assets path if available
        var assetsPath = null;
        try { assetsPath = (api.getAssetPath && api.getAssetPath()) || null; } catch (eAP) { assetsPath = null; }
        if (assetsPath) {
            var quiverInAssets = assetsPath + '/Quiver';
            var finalAssets = assetsPath;
            // Check if folder already exists
            var folderExists = false;
            try { folderExists = api.filePathExists && api.filePathExists(quiverInAssets); } catch (e) {}
            
            if (folderExists) {
                finalAssets = quiverInAssets;
            } else {
                var folderCreated = false;
                try { 
                    if (api.ensureDirectory) { 
                        api.ensureDirectory(quiverInAssets, false, true); // path, createParents, overwrite
                        finalAssets = quiverInAssets;
                        folderCreated = true;
                    } else if (api.makeFolder) {
                        api.makeFolder(quiverInAssets);
                        finalAssets = quiverInAssets;
                        folderCreated = true;
                    } else if (api.createDirectory) {
                        api.createDirectory(quiverInAssets);
                        finalAssets = quiverInAssets;
                        folderCreated = true;
                    }
                } catch (eMkFA) { 
                    // If it's an "already exists" error, that's fine
                    if ((eMkFA + '').indexOf('already exists') !== -1) {
                        finalAssets = quiverInAssets;
                    } else {
                        // Could not create Quiver folder with API
                    }
                }
            }
            
            // If API methods failed, try using system commands
            if (!folderCreated && api.runProcess) {
                try {
                    if (api.getPlatform && api.getPlatform() === "Windows") {
                        // Windows mkdir command
                        api.runProcess("cmd", ["/c", "mkdir", quiverInAssets.replace(/\//g, "\\")]);
                    } else {
                        // macOS/Linux mkdir command
                        api.runProcess("mkdir", ["-p", quiverInAssets]);
                    }
                    finalAssets = quiverInAssets;
                    folderCreated = true;
                } catch (eCmd) {
                    // Could not create Quiver folder with system command
                }
            }
            __imageImportCache.__quiverDir = finalAssets;
            return __imageImportCache.__quiverDir;
        }
        var projPath = null;
        try { projPath = (api.getProjectFilePath && api.getProjectFilePath()) || projPath; } catch (eProj) {}
        try { projPath = projPath || (api.getProjectPath && api.getProjectPath()); } catch (eProj2) {}
        try { projPath = projPath || (api.projectPath && api.projectPath()); } catch (eProj3) {}
        try { projPath = projPath || (api.getProjectDirectory && api.getProjectDirectory()); } catch (eProj4) {}
        try { projPath = projPath || (api.projectDirectory && api.projectDirectory()); } catch (eProj5) {}
        // Derive project directory. If projPath points to a .cv file, use its parent; otherwise assume it is a directory
        var baseDir = null;
        if (projPath && (projPath + '').indexOf('/') !== -1) {
            var pstr = (projPath + '');
            if (/\.cv$/i.test(pstr)) baseDir = pstr.substring(0, pstr.lastIndexOf('/')); else baseDir = pstr;
        }
        if (!baseDir) {
            try { baseDir = ui.selectDirectory && ui.selectDirectory('Select your Cavalry Project folder (to create Assets/Quiver)'); } catch (eSel) { baseDir = null; }
        }
        if (!baseDir) { return null; }
        var assetsDir = baseDir + '/Assets';
        var quiverDir = assetsDir + '/Quiver';
        var finalDir = null;
        try { 
            if (api.ensureDirectory) {
                api.ensureDirectory(assetsDir); 
                finalDir = assetsDir;
            } else if (api.makeFolder) {
                api.makeFolder(assetsDir);
                finalDir = assetsDir;
            } else if (api.createDirectory) {
                api.createDirectory(assetsDir);
                finalDir = assetsDir;
            }
        } catch (eMkA) { 
            finalDir = null;
            // Could not create Assets folder
        }
        
        // Try Quiver subfolder; if it fails, keep using Assets root
        // Check if folder already exists
        var folderExists = false;
        try { folderExists = api.filePathExists && api.filePathExists(quiverDir); } catch (e) {}
        
        if (folderExists) {
            finalDir = quiverDir;
        } else {
            var folderCreated = false;
            try { 
                if (api.ensureDirectory) {
                    api.ensureDirectory(quiverDir, false, true); // path, createParents, overwrite
                    finalDir = quiverDir;
                    folderCreated = true;
                } else if (api.makeFolder) {
                    api.makeFolder(quiverDir);
                    finalDir = quiverDir;
                    folderCreated = true;
                } else if (api.createDirectory) {
                    api.createDirectory(quiverDir);
                    finalDir = quiverDir;
                    folderCreated = true;
                }
            } catch (eMkF) { 
                // If it's an "already exists" error, that's fine
                if ((eMkF + '').indexOf('already exists') !== -1) {
                    finalDir = quiverDir;
                } else {
                    // Could not create Quiver folder with API
                }
            }
        }
        
        // If API methods failed, try using system commands
        if (!folderCreated && api.runProcess) {
            try {
                if (api.getPlatform && api.getPlatform() === "Windows") {
                    // Windows mkdir command
                    api.runProcess("cmd", ["/c", "mkdir", quiverDir.replace(/\//g, "\\")]);
                } else {
                    // macOS/Linux mkdir command
                    api.runProcess("mkdir", ["-p", quiverDir]);
                }
                finalDir = quiverDir;
                folderCreated = true;
            } catch (eCmd) {
                // Could not create Quiver folder with system command
            }
        }
        __imageImportCache.__quiverDir = finalDir || assetsDir;
        return __imageImportCache.__quiverDir;
    } catch (e) { return null; }
}

function _hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
}

function _saveDataUriToQuiverFolder(dataUri, contextNode) {
    try {
        if (__imageImportCache[dataUri]) return __imageImportCache[dataUri];
        var m = /^data:([^;]+);base64,(.*)$/i.exec(dataUri);
        if (!m) return null;
        var mime = m[1].toLowerCase();
        var b64 = m[2];
        var ext = 'bin';
        if (mime.indexOf('png') !== -1) ext = 'png';
        else if (mime.indexOf('jpeg') !== -1 || mime.indexOf('jpg') !== -1) ext = 'jpg';
        else if (mime.indexOf('svg') !== -1) ext = 'svg';
        else if (mime.indexOf('webp') !== -1) ext = 'webp';
        var dir = _ensureAssetsQuiverFolder();
        if (!dir) {
            // Prompt user to save location as a fallback
            try {
                var suggest = 'img_' + _hashString(dataUri.slice(0, 120) + '|' + dataUri.length) + '.' + ext;
                var saveFn = ui.saveFile || ui.saveFileDialog || ui.selectSaveFile;
                if (saveFn) {
                    var picked = saveFn('Save embedded image as...', suggest);
                    if (picked) {
                        var wroteP = false;
                        try { if (api.writeEncodedToBinaryFile) { wroteP = !!api.writeEncodedToBinaryFile(picked, b64); } } catch (eW0) { wroteP = false; }
                        if (!wroteP) {
                            try { if (api.writeFile) { api.writeFile(picked, b64, { encoding: 'base64' }); wroteP = true; } } catch (eW1) { wroteP = false; }
                        }
                        if (wroteP) { __imageImportCache[dataUri] = picked; return picked; }
                    }
                }
            } catch (eDlg) {}
            // No Assets/Quiver dir available and user did not pick a path
            return null;
        }
        var head = dataUri.slice(0, 120);
        var hash = _hashString(head + '|' + dataUri.length);
        
        // Increment counter for unique numbering
        __imageCounter++;
        
        // Build a descriptive name using parent context and unique number
        var baseName = __lastPatternOrImageName || 'img';
        
        // If we have an ID attribute from the image element itself, use that
        if (contextNode && contextNode.attrs && contextNode.attrs.id) {
            baseName = contextNode.attrs.id;
        }
        
        var base = _sanitizeFileComponent(baseName);
        
        // Check if the base name already ends with a number (from shader naming)
        // If so, don't add another counter
        var uniqueName = base;
        if (!/_\d+$/.test(base)) {
            uniqueName = base + '_' + __imageCounter;
        }
        
        var outPath = dir + '/' + uniqueName + '.' + ext;
        var wrote = false;
        try { if (api.writeEncodedToBinaryFile) { wrote = !!api.writeEncodedToBinaryFile(outPath, b64); } } catch (eEnc) { wrote = false; }
        if (!wrote) {
            try { if (api.writeFile) { api.writeFile(outPath, b64, { encoding: 'base64' }); wrote = true; } } catch (eWF) { wrote = false; }
        }
        if (!wrote) return null;
        __imageImportCache[dataUri] = outPath;
        return outPath;
    } catch (e) { return null; }
}

function _copyExternalToQuiverFolder(srcPath) {
    try {
        if (__imageImportCache[srcPath]) return __imageImportCache[srcPath];
        var dir = _ensureAssetsQuiverFolder();
        if (!dir) return null;
        var name = srcPath.substring(srcPath.lastIndexOf('/')+1);
        var dest = dir + '/' + name;
        try { api.copyFile && api.copyFile(srcPath, dest); } catch (eC) { return null; }
        __imageImportCache[srcPath] = dest;
        return dest;
    } catch (e) { return null; }
}

function _resolveImageHrefToAsset(href, contextNode) {
    if (!href) return null;
    
    // Skip image saving if disabled in settings
    if (!importImageryEnabled) {
        return null;
    }
    
    if (/^data:/i.test(href)) return _saveDataUriToQuiverFolder(href, contextNode);
    if (/^file:\/\//i.test(href)) {
        var p = href.replace(/^file:\/\//i, '');
        return _copyExternalToQuiverFolder(p);
    }
    if (href[0] === '/') return _copyExternalToQuiverFolder(href);
    // Unsupported http(s) or relative: skip for now
    return null;
}

function createImage(node, parentId, vb) {
    // Skip image creation if disabled in settings
    if (!importImageryEnabled) {

        return null;
    }
    
    var name = node.name || 'image';
    
    // Get parent name for better image naming
    var parentName = '';
    if (parentId) {
        try { 
            parentName = api.getNiceName(parentId) || '';
            // Store the parent context for image naming
            __imageNamingContext.parentId = parentId;
            __imageNamingContext.parentName = parentName;
        } catch (e) {}
    }
    
    // Set a more descriptive name based on parent context
    var contextualName = parentName ? parentName + '_image' : name;
    try { __lastPatternOrImageName = contextualName; } catch (eNm2) {}
    
    var href = node.attrs && (node.attrs.href || node.attrs['xlink:href']);
    var savedPath = _resolveImageHrefToAsset(href, node);
    var x = parseFloat(node.attrs.x || '0');
    var y = parseFloat(node.attrs.y || '0');
    var w = parseFloat(node.attrs.width || '0');
    var h = parseFloat(node.attrs.height || '0');
    var centre = svgToCavalryPosition(x + w/2, y + h/2, vb);
    var id = null;
    var types = ['image','bitmap','footage','imageShape','footageShape','imageLayer'];
    for (var ti = 0; ti < types.length && !id; ti++) {
        try { id = api.create(types[ti], name); } catch (eCT) { id = null; }
    }
    var isPlaceholder = false;
    if (!id) { id = api.primitive('rectangle', name); isPlaceholder = true; }
    if (parentId) api.parent(id, parentId);
    try {
        if (!isPlaceholder) {
            try { api.set(id, { 'position.x': centre.x, 'position.y': centre.y }); } catch (eP) {}
            var sizeSet = false;
            try { api.set(id, { 'dimensions': [w, h] }); sizeSet = true; } catch (eD0) {}
            if (!sizeSet) {
                try { api.set(id, { 'generator.dimensions': [w, h] }); sizeSet = true; } catch (eD1) {}
            }
        } else {
            try { api.set(id, { 'generator.dimensions': [w, h], 'position.x': centre.x, 'position.y': centre.y }); } catch (eR) {}
        }
    } catch (eSz) {}
    try {
        if (!isPlaceholder) {
            var setOk = false;
            var targetVal = savedPath || href || null;
            var assetId = null;
            if (savedPath && api.loadAsset) {
                try { assetId = api.loadAsset(savedPath, false); } catch (eLoad) { assetId = null; }
            }
            if (!assetId && savedPath && api.importAsset) {
                try { assetId = api.importAsset(savedPath); } catch (eImp) { assetId = null; }
            }
            if (assetId) {
                try { api.connect(assetId, 'id', id, 'image'); setOk = true; } catch (eConImg) { setOk = false; }
                
                // Parent the asset under the Quiver group in Assets Window
                var quiverGroup = _ensureQuiverAssetGroup();
                if (quiverGroup && api.parent) {
                    try { 
                        api.parent(assetId, quiverGroup);
                    } catch (eParent) {
                        // Could not parent asset to Quiver group
                    }
                }
            }
            if (!setOk && targetVal) {
                var isData = (typeof targetVal==='string') && targetVal.indexOf('data:') === 0;
                var setPaths = isData ? ['uri','image.uri','path','image.path','source','file'] : ['path','image.path','source','file','uri','image.uri'];
                var used = _setFirstSupported(id, setPaths, targetVal);
                setOk = !!used;
            }
        }
    } catch (eLink) {}
    try {
        var o = node.attrs.opacity || (node.attrs.style && extractStyleProperty(node.attrs.style, 'opacity'));
        var oNum = parseOpacityValue(o); if (oNum === null) oNum = 1;
        api.set(id, { 'material.alpha': Math.round(oNum * 100) });
    } catch (eO) {}
    applyBlendMode(id, node.attrs);
    return id;
}

// ----------------------------------------
// quiver_utilities_filters.js
// ----------------------------------------
// --- Filters (Drop Shadows, Blur, etc.) ---

// Reverse lookup: targetLayerId -> [filterLayerId1, filterLayerId2, ...]
// Used to find which filters are connected to a shape (since api.get() on filter paths returns null)
var __targetToFilter = {};

/**
 * Get all filters connected to a target layer
 * @param {string} targetLayerId - The layer ID to look up
 * @returns {Array} Array of filter layer IDs
 */
function getFiltersForTarget(targetLayerId) {
    return __targetToFilter[targetLayerId] || [];
}

/**
 * Track a filter connection to a target layer
 * @param {string} targetLayerId - The layer the filter is connected to
 * @param {string} filterLayerId - The filter layer ID
 */
function addFilterForTarget(targetLayerId, filterLayerId) {
    if (!__targetToFilter[targetLayerId]) {
        __targetToFilter[targetLayerId] = [];
    }
    // Avoid duplicates
    if (__targetToFilter[targetLayerId].indexOf(filterLayerId) === -1) {
        __targetToFilter[targetLayerId].push(filterLayerId);
    }
}

/**
 * Reset the filter tracking cache (call at start of each import)
 */
function resetFilterCache() {
    __targetToFilter = {};
}

function extractFilters(svgCode) {
    var filters = {};
    var re = /<filter[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/filter>/g;
    var m;
    while ((m = re.exec(svgCode)) !== null) {
        filters[m[1]] = m[2];
    }
    return filters;
}

function detectBlurAmount(filterContent) {
    if (!filterContent) return null;

    // Check if this is a drop shadow filter (contains shadow-related elements)
    var hasDropShadow = /<feDropShadow[^>]*>/i.test(filterContent);
    var hasOffset = /<feOffset[^>]*>/i.test(filterContent);
    var hasColorMatrix = /<feColorMatrix[^>]*>/i.test(filterContent);
    var hasMorphology = /<feMorphology[^>]*>/i.test(filterContent);
    
    // Check for feFlood, but only consider it shadow-related if it has visible opacity
    var hasVisibleFlood = false;
    var floodRe = /<feFlood[^>]*>/g;
    var floodMatch;
    while ((floodMatch = floodRe.exec(filterContent)) !== null) {
        var floodOpacity = _gradGetAttr(floodMatch[0], 'flood-opacity');
        // If flood-opacity is missing (defaults to 1.0) or > 0, it's creating a visible color
        if (!floodOpacity || parseFloat(floodOpacity) > 0) {
            hasVisibleFlood = true;
            break;
        }
    }
    
    // If it has drop shadow elements, it's not a simple blur filter
    if (hasDropShadow || (hasOffset && hasColorMatrix) || hasMorphology || hasVisibleFlood) {
        // Filter contains drop shadow elements, not a simple blur
        return null;
    }
    
    // Look for feGaussianBlur
    var blurRe = /<feGaussianBlur[^>]*stdDeviation\s*=\s*["']([^"']+)["'][^>]*>/g;
    var match = blurRe.exec(filterContent);
    
    if (match && match[1]) {
        // Check if this blur is the main effect (not part of a composite)
        // Count the number of filter primitives
        var primitiveCount = (filterContent.match(/<fe\w+[^>]*>/g) || []).length;
        
        // A simple blur filter should have very few primitives
        // Allow up to 4 to account for feFlood (transparent), feBlend, feGaussianBlur
        if (primitiveCount > 4) {
            // Filter has too many primitives, likely not a simple blur
            return null;
        }
        
        var stdDev = parseFloat(match[1]);
        if (!isNaN(stdDev) && stdDev > 0) {
            // Convert stdDeviation to Cavalry blur amount
            // First multiply by 2, then divide by 3 for better Quiver parity
            var blurAmount = (stdDev * 2) / 3;
            return blurAmount;
        }
    }
    
    return null;
}

function createAndAttachBlur(shapeId, amount) {
    try {
        // Skip blur creation if effects are disabled
        if (!importEffectsEnabled) {

            return null;
        }
        
        var blurId = null;
        // Create blur filter with proper type
        try { 
            blurId = api.create('blurFilter', 'Blur');
        } catch (e0) {
            try { 
                blurId = api.create('blur', 'Blur');
            } catch (e00) {}
        }
        if (!blurId) return null;

        // Set blur amount (X and Y) - using proper attribute paths
        var amountSet = false;
        
        // First try setting as array
        try { 
            api.set(blurId, { 'amount': [amount, amount] }); 
            amountSet = true;
        } catch (eAmtV) {
            // If array fails, try individual components
            try { 
                api.set(blurId, { 'amount.x': amount }); 
                api.set(blurId, { 'amount.y': amount }); 
                amountSet = true;
            } catch (eAxy) {}
        }
        
        // Connect to filters
        try { 
            api.connect(blurId, 'id', shapeId, 'filters'); 
            addFilterForTarget(shapeId, blurId); // Track for reverse lookup
        } catch (eC) {
            try { 
                api.connect(blurId, 'id', shapeId, 'deformers'); 
            } catch (eC2) {
                // Failed to connect blur filter
            }
        }
        
        // Parent under the shape
        try { 
            if (!api.getParent(blurId)) {
                api.parent(blurId, shapeId); 
            }
        } catch (eP) {}
        
        return blurId;
    } catch (e) {
        // Error creating blur
        return null;
    }
}

function detectShadowPasses(filterContent) {
    if (!filterContent) return [];
    var passes = [];

    // Prefer feDropShadow directly
    var ds;
    var dropRe = /<feDropShadow[^>]*>/g;
    while ((ds = dropRe.exec(filterContent)) !== null) {
        var el = ds[0];
        var dx = parseFloat(_gradGetAttr(el, 'dx') || '0');
        var dy = parseFloat(_gradGetAttr(el, 'dy') || '0');
        var stdDev = parseFloat(_gradGetAttr(el, 'stdDeviation') || '4');
        var col = _gradGetAttr(el, 'flood-color') || '#000000';
        var a = parseFloat(_gradGetAttr(el, 'flood-opacity') || '0.5');
        var passObj = { dx: dx, dy: dy, blur: (stdDev*2)/3, color: parseColor(col)||'#000000', alpha: isNaN(a)?0.5:a, spread: 0 };
        passes.push(passObj);
    }
    if (passes.length) return passes;
    // Fallback chain: build passes around each feMorphology (common multi-pass pattern)
    var morphRe = /<feMorphology[^>]*>/g; var mMatch; var morphs = [];
    while ((mMatch = morphRe.exec(filterContent)) !== null) {
        morphs.push({ idx: mMatch.index, el: mMatch[0] });
    }
    function parseValuesFromSegment(seg) {
        var off = /<feOffset[^>]*>/g.exec(seg);
        var blu = /<feGaussianBlur[^>]*>/g.exec(seg);
        
        // Find all feColorMatrix elements and skip hardAlpha ones
        var cmRe = /<feColorMatrix[^>]*values\s*=\s*"([^"]+)"[^>]*>/g;
        var cm = null;
        var cmMatch;
        while ((cmMatch = cmRe.exec(seg)) !== null) {
            // Skip hardAlpha matrices (those with in="SourceAlpha")
            if (!/in\s*=\s*"SourceAlpha"/i.test(cmMatch[0])) {
                cm = cmMatch;
                break;
            }
        }
        
        var dx = 0, dy = 0, blur = 8/3, alpha = 0.35, colorHex = null;
        if (off) {
            dx = parseFloat(_gradGetAttr(off[0], 'dx') || '0');
            dy = parseFloat(_gradGetAttr(off[0], 'dy') || '0');
        }
        if (blu) {
            var std = parseFloat(_gradGetAttr(blu[0], 'stdDeviation') || '4');
            blur = (std*2)/3;
        }
        if (cm && cm[1]) {
            var vals = cm[1].trim().split(/\s+/).map(parseFloat);
            if (vals && vals.length >= 20) {
                // Color constants are offsets in the 5th column of the first 3 rows
                var rAdd = vals[4], gAdd = vals[9], bAdd = vals[14];
                function clamp01n(v){ return Math.max(0, Math.min(1, isNaN(v)?0:v)); }
                if (!isNaN(rAdd) || !isNaN(gAdd) || !isNaN(bAdd)) {
                    var r = Math.round(clamp01n(rAdd) * 255);
                    var g = Math.round(clamp01n(gAdd) * 255);
                    var b = Math.round(clamp01n(bAdd) * 255);
                    var rh = r.toString(16).padStart(2,'0');
                    var gh = g.toString(16).padStart(2,'0');
                    var bh = b.toString(16).padStart(2,'0');
                    colorHex = '#'+rh+gh+bh;
                }
                // Alpha: prefer multiplier (row4,col4) at index 18; fallback to constant offset index 19
                var aMul = vals[18];
                var aOff = vals[19];
                var aPick = (!isNaN(aMul) && aMul>0)? aMul : (!isNaN(aOff)? aOff : alpha);
                if (!isNaN(aPick)) alpha = Math.max(0, Math.min(1, aPick));
            }
        }
        var result = { dx: dx, dy: dy, blur: blur, alpha: alpha, color: colorHex };
        return result;
    }
    // ALWAYS look for all shadow passes by finding feBlend elements with "effect" or "dropShadow" results
    // This handles Figma's multi-shadow filters which chain: effect1_dropShadow -> effect2_dropShadow -> etc.
    var effectBlendRe = /<feBlend[^>]*result\s*=\s*"(effect\d+_dropShadow[^"]*)"[^>]*>/gi;
    var effectMatch;
    var effectBlends = [];
    while ((effectMatch = effectBlendRe.exec(filterContent)) !== null) {
        effectBlends.push({ idx: effectMatch.index, result: effectMatch[1] });
    }
    
    
    if (effectBlends.length > 0) {
        // Parse each shadow pass by looking backwards from each feBlend
        for (var ei = 0; ei < effectBlends.length; ei++) {
            var blendIdx = effectBlends[ei].idx;
            // Find the start of this pass (after previous blend or start of filter)
            var passStart = 0;
            if (ei > 0) {
                passStart = effectBlends[ei - 1].idx + 50; // After previous blend
            }
            var passSeg = filterContent.slice(passStart, blendIdx + 100);
            
            // Check if this pass has morphology (spread)
            var morphInPass = /<feMorphology[^>]*>/i.exec(passSeg);
            var spread = 0;
            if (morphInPass) {
                var op = (_gradGetAttr(morphInPass[0], 'operator') || '').toLowerCase();
                var r = parseFloat(_gradGetAttr(morphInPass[0], 'radius') || '0');
                if (op === 'dilate') spread = +Math.max(0, r);
                else if (op === 'erode') spread = -Math.max(0, r);
            }
            
            var vals = parseValuesFromSegment(passSeg);
            
            if (vals.color || vals.dx !== 0 || vals.dy !== 0 || vals.blur !== 8/3 || spread !== 0) {
                var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: spread };
                passes.push(passObj);
            }
        }
    } else if (morphs.length > 0) {
        // Fallback: only morphology-based shadows with DILATE (drop shadows)
        // ERODE morphology is for inner shadows, not drop shadows!
        for (var i = 0; i < morphs.length; i++) {
            var op = (_gradGetAttr(morphs[i].el, 'operator')||'').toLowerCase();
            // Skip erode morphology - those are inner shadows, not drop shadows
            if (op === 'erode') {
                continue;
            }
            var start = morphs[i].idx + morphs[i].el.length;
            var end = (i+1 < morphs.length) ? morphs[i+1].idx : filterContent.length;
            var seg = filterContent.slice(start, end);
            var r = parseFloat(_gradGetAttr(morphs[i].el, 'radius') || '0');
            var spread = +Math.max(0, r);
            var vals = parseValuesFromSegment(seg);
            var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: spread };
            passes.push(passObj);
        }
    } else {
        // Look for multiple drop shadow passes by finding each feOffset
        var offsetRe = /<feOffset[^>]*>/g;
        var offsetMatch;
        var offsetMatches = [];
        while ((offsetMatch = offsetRe.exec(filterContent)) !== null) {
            offsetMatches.push({ idx: offsetMatch.index, el: offsetMatch[0] });
        }
        

        if (offsetMatches.length > 0) {
            // For each offset, look for blur and color matrix that follow it
            for (var oi = 0; oi < offsetMatches.length; oi++) {
                var start = offsetMatches[oi].idx;
                var end = filterContent.length;
                // Find next feBlend with result containing "dropShadow" or "effect" (Figma pattern)
                var blendRe = /<feBlend[^>]*result\s*=\s*"[^"]*(?:dropShadow|effect)[^"]*"[^>]*>/gi;
                blendRe.lastIndex = start;
                var blendMatch = blendRe.exec(filterContent);
                if (blendMatch) {
                    end = blendMatch.index + blendMatch[0].length;
                }
                
                var seg = filterContent.slice(start, end);
                var vals = parseValuesFromSegment(seg);
                
                
                // Include pass if it has any meaningful values (color, offset, blur, or alpha)
                if (vals.color || vals.dx !== 0 || vals.dy !== 0 || vals.blur !== 8/3 || (vals.alpha && vals.alpha !== 0.5)) {
                    var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: 0 };
                    passes.push(passObj);
                } else {
                }
            }
        } else {
            // Only detect as shadow if there's an offset OR a color matrix (not just blur)
            var hasOffset = /<feOffset[^>]*>/g.test(filterContent);
            var hasColorMatrix = /<feColorMatrix[^>]*>/g.test(filterContent) && !/<feColorMatrix[^>]*in\s*=\s*"SourceAlpha"/gi.test(filterContent);
            
            if (hasOffset || hasColorMatrix) {
                // Fallback to single-pass approximation
                var approx = parseValuesFromSegment(filterContent);
                if (approx.dx !== 0 || approx.dy !== 0 || (hasColorMatrix && approx.color)) {
                    var passObj = { dx: approx.dx, dy: approx.dy, blur: approx.blur, color: approx.color || '#000000', alpha: approx.alpha, spread: 0 };
                    passes.push(passObj);
                }
            }
        }
    }
    // Fallback: if still no passes, scan for color matrices (excluding hardAlpha) and pair with nearest preceding offset/blur
    // BUT skip this fallback entirely if filter contains inner shadow markers
    var hasInnerShadowMarker = /feComposite[^>]*operator\s*=\s*["']arithmetic["'][^>]*k2\s*=\s*["']-1["']/i.test(filterContent) ||
                               /result\s*=\s*["'][^"']*innerShadow[^"']*["']/i.test(filterContent);
    if (passes.length === 0 && !hasInnerShadowMarker) {
        try {
            var cmAll = [];
            var cmReAll = /<feColorMatrix[^>]*type\s*=\s*"matrix"[^>]*values\s*=\s*"([^"]+)"[^>]*>/g; var mAll;
            while ((mAll = cmReAll.exec(filterContent)) !== null) {
                var cmTag = mAll[0];
                if (/in\s*=\s*"SourceAlpha"/i.test(cmTag)) continue; // skip hardAlpha
                cmAll.push({ idx: mAll.index, values: mAll[1], tag: cmTag });
            }
            for (var cmi = 0; cmi < cmAll.length; cmi++) {
                var cmBlock = cmAll[cmi];
                var before = filterContent.slice(0, cmBlock.idx);
                var offMatch = null, blurMatch = null;
                var offRe = /<feOffset[^>]*>/g, o;
                while ((o = offRe.exec(before)) !== null) offMatch = o;
                var blRe = /<feGaussianBlur[^>]*>/g, b;
                while ((b = blRe.exec(before)) !== null) blurMatch = b;
                var dxF = 0, dyF = 0, blurF = 8/3;
                if (offMatch) { dxF = parseFloat(_gradGetAttr(offMatch[0], 'dx') || '0'); dyF = parseFloat(_gradGetAttr(offMatch[0], 'dy') || '0'); }
                if (blurMatch) { var stdF = parseFloat(_gradGetAttr(blurMatch[0], 'stdDeviation') || '4'); blurF = (stdF*2)/3; }
                // Color/alpha from matrix values
                var valsArr = cmBlock.values.trim().split(/\s+/).map(parseFloat);
                var rAddF = valsArr[4], gAddF = valsArr[9], bAddF = valsArr[14];
                function c01(v){ return Math.max(0, Math.min(1, isNaN(v)?0:v)); }
                var rF = Math.round(c01(rAddF) * 255).toString(16).padStart(2,'0');
                var gF = Math.round(c01(gAddF) * 255).toString(16).padStart(2,'0');
                var bF = Math.round(c01(bAddF) * 255).toString(16).padStart(2,'0');
                var colF = '#' + rF + gF + bF;
                var aMulF = valsArr[18]; var aOffF = valsArr[19];
                var aF = (!isNaN(aMulF) && aMulF>0)? aMulF : (!isNaN(aOffF)? aOffF : 0.35);
                var passObj = { dx: dxF, dy: dyF, blur: blurF, color: colF, alpha: aF, spread: 0 };
                passes.push(passObj);
            }
        } catch (eFB) {}
    }
    return passes;
}

/**
 * Detect inner shadow passes in a filter
 * Inner shadows use: feComposite operator="arithmetic" k2="-1" k3="1"
 * and feBlend result="...innerShadow..."
 */
function detectInnerShadowPasses(filterContent) {
    if (!filterContent) return [];
    var passes = [];
    
    // Look for feBlend elements with "innerShadow" in result
    var innerBlendRe = /<feBlend[^>]*result\s*=\s*"(effect\d+_innerShadow[^"]*)"[^>]*>/gi;
    var innerMatch;
    var innerBlends = [];
    while ((innerMatch = innerBlendRe.exec(filterContent)) !== null) {
        innerBlends.push({ idx: innerMatch.index, result: innerMatch[1] });
    }
    
    
    if (innerBlends.length > 0) {
        for (var ei = 0; ei < innerBlends.length; ei++) {
            var blendIdx = innerBlends[ei].idx;
            // Find the start of this pass
            var passStart = 0;
            if (ei > 0) {
                passStart = innerBlends[ei - 1].idx + 50;
            } else {
                // For first inner shadow, start after "shape" result
                var shapeBlend = filterContent.indexOf('result="shape"');
                if (shapeBlend > 0) passStart = shapeBlend + 20;
            }
            var passSeg = filterContent.slice(passStart, blendIdx + 100);
            
            // Extract morphology (erode = inset amount)
            var morphInPass = /<feMorphology[^>]*>/i.exec(passSeg);
            var inset = 0;
            if (morphInPass) {
                var op = (_gradGetAttr(morphInPass[0], 'operator') || '').toLowerCase();
                var r = parseFloat(_gradGetAttr(morphInPass[0], 'radius') || '0');
                if (op === 'erode') inset = Math.max(0, r);
            }
            
            // Extract offset
            var offsetMatch = /<feOffset[^>]*>/i.exec(passSeg);
            var dx = 0, dy = 0;
            if (offsetMatch) {
                dx = parseFloat(_gradGetAttr(offsetMatch[0], 'dx') || '0');
                dy = parseFloat(_gradGetAttr(offsetMatch[0], 'dy') || '0');
            }
            
            // Extract blur - use stdDeviation directly for inner shadows (stronger blur)
            var blurMatch = /<feGaussianBlur[^>]*stdDeviation\s*=\s*["']([^"']+)["'][^>]*>/i.exec(passSeg);
            var blur = 0;
            if (blurMatch && blurMatch[1]) {
                // Use stdDeviation value directly for inner shadows (no reduction)
                blur = parseFloat(blurMatch[1]);
            }
            
            // Extract color from feColorMatrix (skip hardAlpha ones)
            var color = '#000000';
            var alpha = 1;
            var cmRe = /<feColorMatrix[^>]*type\s*=\s*"matrix"[^>]*values\s*=\s*"([^"]+)"[^>]*>/gi;
            var cmMatch;
            while ((cmMatch = cmRe.exec(passSeg)) !== null) {
                var cmTag = cmMatch[0];
                // Skip hardAlpha color matrices
                if (/result\s*=\s*"hardAlpha"/i.test(cmTag)) continue;
                
                var vals = cmMatch[1].split(/\s+/).map(parseFloat);
                if (vals.length >= 20) {
                    // Extract RGB from matrix (positions 4, 9, 14 are the color offsets)
                    var r = Math.round(Math.max(0, Math.min(1, vals[4])) * 255);
                    var g = Math.round(Math.max(0, Math.min(1, vals[9])) * 255);
                    var b = Math.round(Math.max(0, Math.min(1, vals[14])) * 255);
                    color = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
                    alpha = vals[18] || 1;
                }
            }
            
            
            var passObj = { dx: dx, dy: dy, blur: blur, color: color, alpha: alpha, inset: inset };
            passes.push(passObj);
        }
    }
    
    return passes;
}

/**
 * Helper: Create a single inner shadow filter node
 */
function createSingleInnerShadowNode(shapeId, blur, offsetX, offsetY, colorHex, alpha, nameSuffix) {
    var nodeId = null;
    var name = 'Inner Shadow' + (nameSuffix || '');
    try { nodeId = api.create('innerShadowFilter', name); } catch (e0) {}
    if (!nodeId) { try { nodeId = api.create('innerShadow', name); } catch (e00) {} }
    if (!nodeId) {
        console.error("[Inner Shadow] Failed to create innerShadowFilter");
        return null;
    }
    
    // Set blur amount
    var blurAmt = Math.max(0, blur || 0);
    var blurSet = false;
    try { 
        api.set(nodeId, { 'amount': [blurAmt, blurAmt] }); 
        blurSet = true;
    } catch (eBlur) {}
    if (!blurSet) {
        try { api.set(nodeId, { 'amount.x': blurAmt }); } catch (eBlurX) {}
        try { api.set(nodeId, { 'amount.y': blurAmt }); } catch (eBlurY) {}
    }
    
    // Set offset (Y-up in Cavalry)
    try { api.set(nodeId, { 'offset': [offsetX, -offsetY] }); } catch (eOff) {}
    
    // Set color
    var r = parseInt(colorHex.substring(1, 3), 16);
    var g = parseInt(colorHex.substring(3, 5), 16);
    var b = parseInt(colorHex.substring(5, 7), 16);
    var a = Math.round(alpha * 255);
    
    try { api.set(nodeId, { 'shadowColor': colorHex }); } catch (eCol1) {}
    try {
        api.set(nodeId, { 'shadowColor.r': r });
        api.set(nodeId, { 'shadowColor.g': g });
        api.set(nodeId, { 'shadowColor.b': b });
        api.set(nodeId, { 'shadowColor.a': a });
    } catch (eCol2) {}
    try {
        api.set(nodeId, { 'color': colorHex });
        api.set(nodeId, { 'color.r': r });
        api.set(nodeId, { 'color.g': g });
        api.set(nodeId, { 'color.b': b });
        api.set(nodeId, { 'color.a': a });
    } catch (eCol3) {}
    
    // Connect to shape's filters
    try { 
        api.connect(nodeId, 'id', shapeId, 'filters'); 
        addFilterForTarget(shapeId, nodeId); // Track for reverse lookup
    } catch (eC) {
        try { api.connect(nodeId, 'id', shapeId, 'deformers'); } catch (eC2) {}
    }
    
    // Parent under shape
    try { if (!api.getParent(nodeId)) api.parent(nodeId, shapeId); } catch (eP) {}
    
    console.info("[Inner Shadow] Created" + (nameSuffix || '') + ": blur=" + blurAmt + ", offset=[" + offsetX + "," + (-offsetY) + "], color=" + colorHex);
    return nodeId;
}

/**
 * Create and attach inner shadow filter(s) to a shape
 * @param shapeId - The shape to attach inner shadows to
 * @param pass - The inner shadow pass data (blur, color, alpha, dx, dy, inset)
 * @param passIndex - Current pass index (0-based)
 * @param totalPasses - Total number of inner shadow passes
 * 
 * Simplified strategy:
 * - 1 Figma inner shadow with spread: Use dual opposing offsets (best quality)
 * - 2+ Figma inner shadows: Single native shadow each, ignore spread
 *   (to avoid Cavalry's 3+ inner shadow bug - wait for Cavalry fix)
 */
function createAndAttachInnerShadow(shapeId, pass, passIndex, totalPasses) {
    try {
        if (!importEffectsEnabled) return null;
        
        // Default to old behavior if parameters not provided
        passIndex = (typeof passIndex === 'number') ? passIndex : 0;
        totalPasses = (typeof totalPasses === 'number') ? totalPasses : 1;
        
        var blur = pass.blur || 0;
        var colorHex = pass.color || '#000000';
        var alpha = (pass.alpha !== undefined) ? pass.alpha : 1;
        var baseDx = pass.dx || 0;
        var baseDy = pass.dy || 0;
        var inset = pass.inset || 0;
        
        // Only use dual shadow spread simulation when there's exactly 1 inner shadow
        // This keeps total native shadows at max 2, avoiding Cavalry's 3+ bug
        if (totalPasses === 1 && inset > 0) {
            console.info("[Inner Shadow] Single pass with spread (" + inset + "), creating dual shadows to simulate");
            
            // First shadow: negative offset (inward)
            var id1 = createSingleInnerShadowNode(
                shapeId,
                blur,
                baseDx - inset,  // X offset - spread
                baseDy - inset,  // Y offset - spread
                colorHex,
                alpha,
                ''
            );
            
            // Second shadow: positive offset (outward) - acts as background
            var id2 = createSingleInnerShadowNode(
                shapeId,
                blur,
                baseDx + inset,  // X offset + spread
                baseDy + inset,  // Y offset + spread
                colorHex,
                alpha,
                ' [Background]'
            );
            
            return id1; // Return first shadow ID
        }
        
        // Multiple passes OR no spread - create single shadow (ignore spread to stay under limit)
        if (totalPasses > 1 && inset > 0) {
            console.info("[Inner Shadow] Pass " + passIndex + ": Multiple inner shadows detected, ignoring spread to avoid Cavalry 3+ bug");
        }
        
        return createSingleInnerShadowNode(shapeId, blur, baseDx, baseDy, colorHex, alpha, '');
        
    } catch (e) {
        console.error("[Inner Shadow] Error: " + e.message);
        return null;
    }
}

function createAndAttachDropShadow(shapeId, pass) {
    try {
        // Skip drop shadow creation if effects are disabled
        if (!importEffectsEnabled) {

            return null;
        }
        
        var nodeId = null;
        try { nodeId = api.create('dropShadowFilter', 'Drop Shadow'); } catch (e0) {}
        if (!nodeId) { try { nodeId = api.create('dropShadow', 'Drop Shadow'); } catch (e00) {} }
        if (!nodeId) return null;
        // Offset (Y-up)
        try { api.set(nodeId, { 'offset': [pass.dx || 0, -(pass.dy || 0)] }); } catch (e2) {}
        // Softness/Blur (X,Y) — attribute is 'amount' on Drop Shadow
        var blurAmt = Math.max(0, pass.blur || 0);
        var okAmount = false;
        try { api.set(nodeId, { 'amount': [blurAmt, blurAmt] }); okAmount = true; } catch (eAmtV) {}
        if (!okAmount) {
            try { api.set(nodeId, { 'amount.x': blurAmt }); } catch (eAx) {}
            try { api.set(nodeId, { 'amount.y': blurAmt }); } catch (eAy) {}
        }
        // Color (use shadowColor + shadowColor.a per scripting path)
        var baseCol = parseColor(pass.color || '#000000') || '#000000';
        var aPct = Math.max(0, Math.min(100, Math.round(((typeof pass.alpha==='number')? pass.alpha : 0.5) * 100)));

        // Set color - based on screenshot, try different approaches
        var colorWithAlpha = colorWithOpacity(baseCol, pass.alpha || 0.5);

        // Set color using shadowColor attribute (from screenshot)
        // Method 1: Try setting shadowColor with RGB hex
        var colorSet = false;
        try {
            api.set(nodeId, { 'shadowColor': baseCol });
            colorSet = true;
        } catch (eCol1) {}
        
        // Method 2: Set individual shadowColor RGBA components
        try {
            // Parse RGB values from hex - keep as 0-255 integers
            var r = parseInt(baseCol.substring(1,3), 16);
            var g = parseInt(baseCol.substring(3,5), 16);
            var b = parseInt(baseCol.substring(5,7), 16);
            var a = Math.round((pass.alpha || 0.5) * 255); // Convert to 0-255 range
            
            api.set(nodeId, { 'shadowColor.r': r });
            api.set(nodeId, { 'shadowColor.g': g });
            api.set(nodeId, { 'shadowColor.b': b });
            api.set(nodeId, { 'shadowColor.a': a });
            
        } catch (eComponents) {
            // Error setting shadowColor components
        }
        
        // Method 3: Try normalized values (0-1) if the above didn't work
        if (!colorSet) {
            try {
                // Parse RGB values from hex as normalized 0-1 values
                var rNorm = parseInt(baseCol.substring(1,3), 16) / 255.0;
                var gNorm = parseInt(baseCol.substring(3,5), 16) / 255.0;
                var bNorm = parseInt(baseCol.substring(5,7), 16) / 255.0;
                
                api.set(nodeId, { 'shadowColor.r': rNorm });
                api.set(nodeId, { 'shadowColor.g': gNorm });
                api.set(nodeId, { 'shadowColor.b': bNorm });
                api.set(nodeId, { 'shadowColor.a': pass.alpha || 0.5 });
                
            } catch (eNorm) {}
        }
        // Connect to filters (preferred) or deformers fallback
        try { 
            api.connect(nodeId, 'id', shapeId, 'filters'); 
            addFilterForTarget(shapeId, nodeId); // Track for reverse lookup
        } catch (eC) {
            try { api.connect(nodeId, 'id', shapeId, 'deformers'); } catch (eC2) {}
        }
        // Parent under the shape if not already parented
        try { if (!api.getParent(nodeId)) api.parent(nodeId, shapeId); } catch (eP) {}
        return nodeId;
    } catch (e) { return null; }
}

/**
 * Queue a background blur request to be processed after all shapes are created.
 * This allows us to find sibling shapes that are underneath the overlay.
 * 
 * @param {string} overlayShapeId - The shape with the blur attribute (defines WHERE blur is visible)
 * @param {number} amount - The blur amount in pixels (from data-figma-bg-blur-radius)
 * @param {string} parentId - The parent group ID (to find siblings)
 * 
 * Cavalry API used: None (just queues the request)
 */
// Track which shapes are blur overlays (so we don't blur other overlays)
var __blurOverlayShapes = {};

function queueBackgroundBlur(overlayShapeId, amount, parentId) {
    if (!importEffectsEnabled) {
        return;
    }
    // Mark this shape as a blur overlay
    __blurOverlayShapes[overlayShapeId] = true;
    
    __deferredBackgroundBlurs.push({
        overlayShapeId: overlayShapeId,
        amount: amount,
        parentId: parentId
    });
}

/**
 * Check if two axis-aligned bounding boxes overlap.
 * 
 * Cavalry's getBoundingBox returns: { left, right, top, bottom, x, y, width, height, centre }
 * In Cavalry's Y-up coordinate system:
 * - 'top' is the higher Y value (upper edge)
 * - 'bottom' is the lower Y value (lower edge)
 * 
 * @param {Object} bbox1 - First bounding box with left, right, top, bottom
 * @param {Object} bbox2 - Second bounding box with left, right, top, bottom
 * @returns {boolean} True if the boxes overlap
 */
function boundingBoxesOverlap(bbox1, bbox2) {
    if (!bbox1 || !bbox2) return false;
    
    // Cavalry bbox uses: left, right, top, bottom
    var left1 = bbox1.left, right1 = bbox1.right, top1 = bbox1.top, bottom1 = bbox1.bottom;
    var left2 = bbox2.left, right2 = bbox2.right, top2 = bbox2.top, bottom2 = bbox2.bottom;
    
    // Check if any required value is undefined
    if (left1 === undefined || right1 === undefined || top1 === undefined || bottom1 === undefined) return false;
    if (left2 === undefined || right2 === undefined || top2 === undefined || bottom2 === undefined) return false;
    
    // Check for no overlap conditions (if any is true, no overlap)
    if (right1 < left2) return false;  // bbox1 is completely to the left of bbox2
    if (left1 > right2) return false;  // bbox1 is completely to the right of bbox2
    if (top1 < bottom2) return false;  // bbox1 is completely below bbox2 (Y-up)
    if (bottom1 > top2) return false;  // bbox1 is completely above bbox2 (Y-up)
    
    return true;
}

/**
 * Process all deferred background blur requests.
 * For each blur overlay, find sibling shapes that are underneath and overlapping,
 * then apply the blur filter to those underlying shapes with the overlay as inputShape.
 * 
 * This should be called AFTER all shapes have been created during import.
 * 
 * Cavalry API used:
 * - api.getParent(layerId) - Get parent of a layer
 * - api.getBoundingBox(layerId, worldSpace) - Get bounding box
 * - api.create('backgroundBlurFilter', name) - Create filter node
 * - api.set(id, props) - Set properties
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect attributes
 * - api.parent(childId, parentId) - Parent layer
 * - api.getNiceName(id) - Get display name
 */
function processDeferredBackgroundBlurs() {
    if (__deferredBackgroundBlurs.length === 0) {
        return;
    }
    
    
    for (var i = 0; i < __deferredBackgroundBlurs.length; i++) {
        var blurRequest = __deferredBackgroundBlurs[i];
        var overlayShapeId = blurRequest.overlayShapeId;
        var amount = blurRequest.amount;
        var parentId = blurRequest.parentId;
        
        try {
            // Get the overlay shape's bounding box (world space)
            var overlayBBox = null;
            try {
                overlayBBox = api.getBoundingBox(overlayShapeId, true);
            } catch (eBB) {
                console.warn('[Background Blur] Could not get bounding box for overlay: ' + eBB.message);
                continue;
            }
            
            if (!overlayBBox) {
                console.warn('[Background Blur] No bounding box for overlay "' + api.getNiceName(overlayShapeId) + '"');
                continue;
            }
            
            // Get siblings from the parent group
            var siblings = __groupDirectChildren[parentId] || [];
            
            // Find the index of the overlay shape in the sibling list
            var overlayIndex = -1;
            for (var si = 0; si < siblings.length; si++) {
                if (siblings[si] === overlayShapeId) {
                    overlayIndex = si;
                    break;
                }
            }
            
            // If overlay is the only child or not found in parent, check grandparent
            // This handles cases where the blur shape is inside a wrapper group
            if (overlayIndex <= 0 && parentId) {
                try {
                    var grandparentId = api.getParent(parentId);
                    if (grandparentId) {
                        var grandparentChildren = __groupDirectChildren[grandparentId] || [];
                        // Find the parent group's index in grandparent's children
                        var parentIndexInGrandparent = -1;
                        for (var gci = 0; gci < grandparentChildren.length; gci++) {
                            if (grandparentChildren[gci] === parentId) {
                                parentIndexInGrandparent = gci;
                                break;
                            }
                        }
                        if (parentIndexInGrandparent > 0) {
                            siblings = grandparentChildren;
                            overlayIndex = parentIndexInGrandparent;
                        }
                    }
                } catch (eGP) {
                    // Ignore grandparent lookup errors
                }
            }
            
            if (overlayIndex <= 0) {
                // No siblings before this shape (it's first or not found)
                continue;
            }
            
            // Get siblings that are BEFORE this shape (rendered underneath)
            var underlyingSiblings = siblings.slice(0, overlayIndex);
            
            var blurAmount = Math.max(0, (amount || 0) / 2); // Halve for Cavalry
            
            // FIRST PASS: Find all overlapping siblings
            var overlappingSiblings = [];
            for (var j = 0; j < underlyingSiblings.length; j++) {
                var siblingId = underlyingSiblings[j];
                
                // Skip siblings that are themselves blur overlays
                if (__blurOverlayShapes[siblingId]) {
                    continue;
                }
                
                try {
                    var siblingBBox = api.getBoundingBox(siblingId, true);
                    var overlaps = boundingBoxesOverlap(overlayBBox, siblingBBox);
                    
                    if (siblingBBox && overlaps) {
                        overlappingSiblings.push(siblingId);
                    }
                } catch (eSibling) {
                    // Skip this sibling
                }
            }
            
            if (overlappingSiblings.length === 0) {
                continue;
            }
            
            // SECOND PASS: Create ONE blur filter and connect to ALL overlapping siblings
            var blurFilterId = null;
            try {
                blurFilterId = api.create('backgroundBlurFilter', 'Background Blur');
            } catch (eCreate) {
                console.warn('[Background Blur] Could not create filter: ' + eCreate.message);
                continue;
            }
            
            if (!blurFilterId) continue;
            
            // Set blur amount
            try {
                api.set(blurFilterId, { 'amount.x': blurAmount });
                api.set(blurFilterId, { 'amount.y': blurAmount });
            } catch (eAmt) {
                console.warn('[Background Blur] Could not set amount: ' + eAmt.message);
            }
            
            // Connect the OVERLAY shape as the inputShape (where blur is visible)
            try {
                api.connect(overlayShapeId, 'id', blurFilterId, 'inputShape');
            } catch (eInput) {
                console.warn('[Background Blur] Could not connect inputShape: ' + eInput.message);
            }
            
            // Connect this ONE filter to ALL overlapping siblings' filters arrays
            var connectedCount = 0;
            for (var k = 0; k < overlappingSiblings.length; k++) {
                var targetId = overlappingSiblings[k];
                try {
                    api.connect(blurFilterId, 'id', targetId, 'filters');
                    addFilterForTarget(targetId, blurFilterId); // Track for reverse lookup
                    connectedCount++;
                } catch (eConnect) {
                    console.warn('[Background Blur] Could not connect filter to "' + api.getNiceName(targetId) + '": ' + eConnect.message);
                }
            }
            
            // Parent filter under the overlay shape for organization
            try {
                api.parent(blurFilterId, overlayShapeId);
            } catch (eParent) {
                // Optional
            }
            
            console.info('[Background Blur] Created 1 filter for overlay "' + api.getNiceName(overlayShapeId) + '" connected to ' + connectedCount + ' layer(s)');
            
        } catch (eProcess) {
            console.error('[Background Blur] Error processing blur: ' + eProcess.message);
        }
    }
    
    // Clear the queue
    __deferredBackgroundBlurs = [];
}

/**
 * Clear the deferred background blur queue (called at start of import)
 */
function clearDeferredBackgroundBlurs() {
    __deferredBackgroundBlurs = [];
    __blurOverlayShapes = {};
    resetFilterCache(); // Also clear filter tracking for new import
}

function _registerChild(parentId, childId) {
    try {
        if (parentId == null) return;
        if (!__groupDirectChildren[parentId]) __groupDirectChildren[parentId] = [];
        __groupDirectChildren[parentId].push(childId);
    } catch (e) {}
}

// ----------------------------------------
// quiver_utilities_masks.js
// ----------------------------------------
// --- Mask/Clipping Path Support (Simplified) ---
// With Clipping Masks (`masks` attribute), multiple masks naturally intersect.
// No complex redundancy filtering needed - just apply all inherited masks.

// Global mask storage
var __svgMaskMap = {};

// Cache for created Cavalry mask/clip shapes (maskId -> cavalryShapeId)
// This prevents duplicate shapes when multiple elements use the same clipPath
var __createdMaskShapes = {};

// Reverse lookup: targetLayerId -> [maskShapeId1, maskShapeId2, ...]
// Used to transfer masks when replacing layers (hybrid approach)
// Now stores an ARRAY of mask shapes to support multiple masks
var __targetToMaskShape = {};

// Track which shapes are being used as mattes (so they're not hidden)
var __shapesUsedAsMattes = {};

function setMaskContext(maskMap) {
    __svgMaskMap = maskMap || {};
}

function resetMaskShapeCache() {
    // Call this at the start of each import to clear the cache
    __createdMaskShapes = {};
    __targetToMaskShape = {};
    __shapesUsedAsMattes = {};
}

// Pre-process mask child transform to extract rotation and calculate correct position
// This mirrors the transform processing done in importNode for rect/circle/ellipse nodes
// Uses: parseTransformMatrixList, decomposeMatrix, parseTranslate from quiver_utilities_transform.js
function _preprocessMaskChildTransform(maskChild) {
    // Clone to avoid modifying the original
    var clone = JSON.parse(JSON.stringify(maskChild));
    
    var transformStr = clone.attrs && clone.attrs.transform;
    if (!transformStr || typeof transformStr !== 'string') {
        return clone; // No transform to process
    }
    
    // Check if transform contains non-trivial operations (rotation, scale, skew, or matrix)
    var hasMatrix = transformStr.indexOf('matrix') !== -1;
    var hasRotate = transformStr.indexOf('rotate') !== -1;
    var hasScale = transformStr.indexOf('scale') !== -1;
    var hasSkew = transformStr.indexOf('skew') !== -1;
    var needsMatrixApproach = hasMatrix || hasRotate || hasScale || hasSkew;
    
    if (!needsMatrixApproach) {
        // Pure translation only - handle via parseTranslate (which createRect already does)
        return clone;
    }
    
    // Parse the full transform as a matrix and decompose it
    var fullMatrix = parseTransformMatrixList(transformStr);
    var decomposed = decomposeMatrix(fullMatrix);
    var rotationDeg = decomposed.rotationDeg || 0;
    
    
    // Handle based on shape type
    if (clone.type === 'rect') {
        var x = parseFloat(clone.attrs.x || '0');
        var y = parseFloat(clone.attrs.y || '0');
        var w = parseFloat(clone.attrs.width || '0');
        var h = parseFloat(clone.attrs.height || '0');
        
        // Calculate the center of the original rect
        var centerX = x + w / 2;
        var centerY = y + h / 2;
        
        // Transform the center point through the full matrix to get final position
        var transformedCenterX = fullMatrix.a * centerX + fullMatrix.c * centerY + fullMatrix.e;
        var transformedCenterY = fullMatrix.b * centerX + fullMatrix.d * centerY + fullMatrix.f;
        
        // Store rotation for application in createRect
        clone.attrs._rotationDeg = rotationDeg;
        
        // Store transformed center for position calculation
        clone.attrs._transformedCenterX = transformedCenterX;
        clone.attrs._transformedCenterY = transformedCenterY;
        
        // Store local center for gradient offset calculation
        clone.attrs._localCenterX = centerX;
        clone.attrs._localCenterY = centerY;
        
        // Update position based on transformed center
        clone.attrs.x = (transformedCenterX - w / 2).toString();
        clone.attrs.y = (transformedCenterY - h / 2).toString();
        
    } else if (clone.type === 'circle' || clone.type === 'ellipse') {
        var cx = parseFloat(clone.attrs.cx || '0');
        var cy = parseFloat(clone.attrs.cy || '0');
        
        // Transform the center point
        var transformedCx = fullMatrix.a * cx + fullMatrix.c * cy + fullMatrix.e;
        var transformedCy = fullMatrix.b * cx + fullMatrix.d * cy + fullMatrix.f;
        
        // Store rotation (circles don't visually rotate, but ellipses might need it)
        clone.attrs._rotationDeg = rotationDeg;
        
        // Update center position
        clone.attrs.cx = transformedCx.toString();
        clone.attrs.cy = transformedCy.toString();
        
    }
    
    // Clear transform to prevent double-application in createRect/createCircle/createEllipse
    delete clone.attrs.transform;
    
    return clone;
}

// Check if SVG geometry matches the clipPath geometry (for optimization)
// This compares SVG source data directly to avoid creating duplicate mask shapes
// svgGeometry: {x, y, width, height} from rect nodes, or {d: pathData} from path nodes
function doesSvgGeometryMatchClipPath(svgGeometry, maskDef) {
    try {
        if (!svgGeometry) {
            return false;
        }
        
        if (!maskDef || !maskDef.children || maskDef.children.length !== 1) {
            return false;
        }
        
        var clipChild = maskDef.children[0];
        
        // Handle rect clipPaths (most common case from Figma frames)
        if (clipChild.type === 'rect' && svgGeometry.width !== undefined) {
            // Get clipPath rect geometry
            var clipX = parseFloat(clipChild.attrs.x || '0');
            var clipY = parseFloat(clipChild.attrs.y || '0');
            var clipW = parseFloat(clipChild.attrs.width || '0');
            var clipH = parseFloat(clipChild.attrs.height || '0');
            
            // Get target SVG geometry (passed from caller)
            var targetX = svgGeometry.x;
            var targetY = svgGeometry.y;
            var targetW = svgGeometry.width;
            var targetH = svgGeometry.height;
            
            // Compare dimensions and position (within tolerance)
            var tolerance = 1.0; // 1px tolerance
            var dimMatch = Math.abs(targetW - clipW) < tolerance && Math.abs(targetH - clipH) < tolerance;
            var posMatch = Math.abs(targetX - clipX) < tolerance && Math.abs(targetY - clipY) < tolerance;
            
            
            return dimMatch && posMatch;
        }
        
        // Handle path clipPaths (rounded rects, complex shapes)
        if (clipChild.type === 'path' && svgGeometry.d !== undefined) {
            var clipD = clipChild.attrs.d || '';
            var targetD = svgGeometry.d || '';
            
            // Normalize path data for comparison (remove extra whitespace)
            var normalizePathData = function(d) {
                return d.replace(/\s+/g, ' ').trim();
            };
            
            var clipDNorm = normalizePathData(clipD);
            var targetDNorm = normalizePathData(targetD);
            
            var pathMatch = clipDNorm === targetDNorm;
            
            
            return pathMatch;
        }
        
        // Handle circle clipPaths
        if (clipChild.type === 'circle' && svgGeometry.cx !== undefined) {
            var clipCx = parseFloat(clipChild.attrs.cx || '0');
            var clipCy = parseFloat(clipChild.attrs.cy || '0');
            var clipR = parseFloat(clipChild.attrs.r || '0');
            
            var targetCx = svgGeometry.cx;
            var targetCy = svgGeometry.cy;
            var targetR = svgGeometry.r;
            
            var tolerance = 1.0;
            var circleMatch = Math.abs(targetCx - clipCx) < tolerance &&
                              Math.abs(targetCy - clipCy) < tolerance &&
                              Math.abs(targetR - clipR) < tolerance;
            
            
            return circleMatch;
        }
        
        // Handle ellipse clipPaths
        if (clipChild.type === 'ellipse' && svgGeometry.cx !== undefined && svgGeometry.rx !== undefined) {
            var clipExCx = parseFloat(clipChild.attrs.cx || '0');
            var clipExCy = parseFloat(clipChild.attrs.cy || '0');
            var clipRx = parseFloat(clipChild.attrs.rx || '0');
            var clipRy = parseFloat(clipChild.attrs.ry || '0');
            
            var targetExCx = svgGeometry.cx;
            var targetExCy = svgGeometry.cy;
            var targetRx = svgGeometry.rx;
            var targetRy = svgGeometry.ry;
            
            var tolerance = 1.0;
            var ellipseMatch = Math.abs(targetExCx - clipExCx) < tolerance &&
                               Math.abs(targetExCy - clipExCy) < tolerance &&
                               Math.abs(targetRx - clipRx) < tolerance &&
                               Math.abs(targetRy - clipRy) < tolerance;
            
            
            return ellipseMatch;
        }
        
        return false;
    } catch (e) {
        return false;
    }
}

// Get all mask shapes that were connected to a target layer
// Returns an array of mask shape IDs
function getMaskShapesForTarget(targetLayerId) {
    return __targetToMaskShape[targetLayerId] || [];
}

// Legacy function for backwards compatibility - returns first mask only
function getMaskShapeForTarget(targetLayerId) {
    var masks = __targetToMaskShape[targetLayerId];
    return (masks && masks.length > 0) ? masks[0] : null;
}

// Add a mask shape to the target's reverse lookup
function addMaskShapeForTarget(targetLayerId, maskShapeId) {
    if (!__targetToMaskShape[targetLayerId]) {
        __targetToMaskShape[targetLayerId] = [];
    }
    // Avoid duplicates
    if (__targetToMaskShape[targetLayerId].indexOf(maskShapeId) === -1) {
        __targetToMaskShape[targetLayerId].push(maskShapeId);
    }
}

function getMaskDefinition(maskId) {
    return __svgMaskMap[maskId] || null;
}

// Create or reuse a mask shape and connect it to the target
// svgGeometry is optional: {x, y, width, height} from the SVG rect node for optimization
function createMaskShapeForTarget(maskId, targetShapeId, parentId, vb, model, svgGeometry) {
    
    try {
        // Look up the mask definition
        var maskDef = getMaskDefinition(maskId);
        if (!maskDef) {
            console.warn('[Quiver] Mask definition not found: ' + maskId);
            return null;
        }

        var typeLabel = maskDef.type === 'clip' ? 'clipPath' : 'mask';
        
        // Check if we already created/designated a Cavalry shape for this maskId
        if (__createdMaskShapes[maskId]) {
            var existingShapeId = __createdMaskShapes[maskId];
            
            // If the target is the same as the cached mask shape, skip connecting to itself
            if (existingShapeId === targetShapeId) {
                return existingShapeId;
            }
            
            // Connect the existing shape to the new target via masks
            try {
                api.connect(existingShapeId, 'id', targetShapeId, 'masks');
                addMaskShapeForTarget(targetShapeId, existingShapeId);
                
                // If this matte is a visible shape being reused, ensure it stays visible
                if (__shapesUsedAsMattes[existingShapeId]) {
                    try {
                        api.set(existingShapeId, { 'hidden': false });
                    } catch (eVis) {}
                }
            } catch (eReuse) {
                console.warn('[MASK]   ✗ FAILED to connect: ' + eReuse.message);
            }
            return existingShapeId;
        }
        
        // OPTIMIZATION: Check if the target SVG geometry matches the clipPath geometry
        // If so, use the target shape itself as the matte (no duplicate needed)
        if (maskDef.type === 'clip' && svgGeometry && doesSvgGeometryMatchClipPath(svgGeometry, maskDef)) {
            
            // Cache this shape as the mask for this clipPath
            __createdMaskShapes[maskId] = targetShapeId;
            __shapesUsedAsMattes[targetShapeId] = true;
            
            // Ensure the shape stays visible (it's both a visible shape AND a matte)
            try {
                api.set(targetShapeId, { 'hidden': false });
            } catch (eVisible) {}
            
            return targetShapeId;
        }

        // Get the first child element from the mask (the mask shape)
        var maskChild = maskDef.children && maskDef.children[0];
        if (!maskChild) {
            console.warn('[Quiver] Mask has no child elements: ' + maskId);
            return null;
        }

        // Pre-process the mask child's transform (same as importNode does for rects)
        // This ensures rotation and position are correctly applied to mask shapes
        var processedMaskChild = _preprocessMaskChildTransform(maskChild);

        // Create the mask shape based on its type
        var maskShapeId = null;
        
        if (processedMaskChild.type === 'rect') {
            maskShapeId = createRect(processedMaskChild, parentId, vb);
        } else if (processedMaskChild.type === 'circle') {
            maskShapeId = createCircle(processedMaskChild, parentId, vb);
        } else if (processedMaskChild.type === 'ellipse') {
            maskShapeId = createEllipse(processedMaskChild, parentId, vb);
        } else if (maskChild.type === 'path') {
            var segments = parsePathDataToAbsolute(maskChild.attrs.d || '');
            var pathName = maskChild.name || (maskDef.type === 'clip' ? 'Clip Path' : 'Mask Path');
            maskShapeId = createEditableFromPathSegments(segments, pathName, parentId, vb, {x:0, y:0}, maskChild.attrs);
        } else {
            console.warn('[Quiver] Unsupported mask shape type: ' + maskChild.type);
            return null;
        }

        if (!maskShapeId) {
            console.warn('[Quiver] Failed to create mask shape');
            return null;
        }

        // Cache the created shape for reuse
        __createdMaskShapes[maskId] = maskShapeId;

        // Set the mask shape as hidden
        try {
            api.set(maskShapeId, { 'hidden': true });
        } catch (eHidden) {
            console.warn('[Quiver] Could not set mask shape as hidden');
        }

        // For luminance masks, create and attach ShiftChannels filter
        if (maskDef.type === 'luminance') {
            try {
                var shiftChannelsId = api.create('shiftChannels', 'Shift Channels [' + maskChild.name + ']');
                if (shiftChannelsId) {
                    // Set alpha source to Luminance (enum value 5)
                    api.set(shiftChannelsId, { 'aSource': 5 });
                    
                    // Connect filter to mask shape
                    try {
                        api.connect(shiftChannelsId, 'id', maskShapeId, 'filters');
                    } catch (eConn) {
                        console.warn('[Quiver] Could not connect ShiftChannels to mask shape');
                    }
                    
                    // Parent filter under mask shape
                    try {
                        if (!api.getParent(shiftChannelsId)) {
                            api.parent(shiftChannelsId, maskShapeId);
                        }
                    } catch (eParent) {}
                }
            } catch (eShift) {
                console.warn('[Quiver] Could not create ShiftChannels filter for luminance mask');
            }
        }

        // Connect mask shape to target shape via masks
        try {
            api.connect(maskShapeId, 'id', targetShapeId, 'masks');
            addMaskShapeForTarget(targetShapeId, maskShapeId);
        } catch (eClipMask) {
            console.warn('[Quiver] Could not connect mask: ' + eClipMask.message);
        }

        return maskShapeId;
    } catch (e) {
        console.error('[Quiver] Error creating mask shape: ' + (e.message || e));
        return null;
    }
}



// ----------------------------------------
// quiver_utilities_transform.js
// ----------------------------------------
// Matrix utilities for translate-only in M1 (keep simple)
function parseTranslate(transform) {
    if (!transform) return {x:0,y:0};
    
    // First try to extract from translate() transform
    var m = transform.match(/translate\(([^\)]*)\)/);
    if (m) {
        var parts = m[1].split(/[ ,]+/).map(function(s){return parseFloat(s);});
        var tx = parts.length > 0 && !isNaN(parts[0]) ? parts[0] : 0;
        var ty = parts.length > 1 && !isNaN(parts[1]) ? parts[1] : 0;
        return {x:tx, y:ty};
    }
    
    // If no translate(), check for matrix() and extract translation components
    var matrixMatch = transform.match(/matrix\(([^\)]*)\)/);
    if (matrixMatch) {
        var matrixParts = matrixMatch[1].split(/[ ,]+/).map(function(s){return parseFloat(s);});
        if (matrixParts.length >= 6) {
            // matrix(a b c d e f) where e,f are the translation components
            var tx = !isNaN(matrixParts[4]) ? matrixParts[4] : 0;
            var ty = !isNaN(matrixParts[5]) ? matrixParts[5] : 0;
            return {x:tx, y:ty};
        }
    }
    
    return {x:0,y:0};
}

// Parse full matrix transform and apply to a point
function applyMatrixToPoint(transform, x, y) {
    if (!transform) return {x:x, y:y};
    
    var matrixMatch = transform.match(/matrix\(([^\)]*)\)/);
    if (!matrixMatch) return {x:x, y:y};
    
    var parts = matrixMatch[1].split(/[ ,]+/).map(function(s){return parseFloat(s);});
    if (parts.length < 6) return {x:x, y:y};
    
    // matrix(a b c d e f) transforms (x,y) to (ax+cy+e, bx+dy+f)
    var a = parts[0], b = parts[1], c = parts[2], d = parts[3], e = parts[4], f = parts[5];
    var newX = a * x + c * y + e;
    var newY = b * x + d * y + f;
    
    return {x: newX, y: newY};
}

function parseRotatePivot(transform) {
    // Parse rotate(a [cx cy]) and return {angle, cx, cy}; cx/cy null when not provided
    var out = { angle: 0, cx: null, cy: null };
    if (!transform || typeof transform !== 'string') return out;
    var re = /rotate\(\s*([-\d\.]+)(?:[ ,]+([-\d\.]+)[ ,]+([-\d\.]+))?\s*\)/;
    var m = re.exec(transform);
    if (!m) return out;
    var ang = parseFloat(m[1]);
    if (!isNaN(ang)) out.angle = ang;
    if (m[2] !== undefined && m[3] !== undefined) {
        var cx = parseFloat(m[2]);
        var cy = parseFloat(m[3]);
        if (!isNaN(cx) && !isNaN(cy)) { out.cx = cx; out.cy = cy; }
    }
    return out;
}

function rotatePointAround(x, y, angleDeg, cx, cy) {
    var th = (angleDeg || 0) * Math.PI / 180;
    var cos = Math.cos(th), sin = Math.sin(th);
    var dx = x - cx, dy = y - cy;
    var xr = cx + dx * cos - dy * sin;
    var yr = cy + dx * sin + dy * cos;
    return {x: xr, y: yr};
}

// --- Rotation (transform) helpers ---
function _matIdentity(){ return {a:1,b:0,c:0,d:1,e:0,f:0}; }
function _matMultiply(m1,m2){
    return { a: m1.a*m2.a + m1.c*m2.b,
             b: m1.b*m2.a + m1.d*m2.b,
             c: m1.a*m2.c + m1.c*m2.d,
             d: m1.b*m2.c + m1.d*m2.d,
             e: m1.a*m2.e + m1.c*m2.f + m1.e,
             f: m1.b*m2.e + m1.d*m2.f + m1.f };
}
function _matTranslate(tx,ty){ return {a:1,b:0,c:0,d:1,e:tx||0,f:ty||0}; }
function _matScale(sx,sy){ if (sy===undefined||isNaN(sy)) sy = sx; return {a:sx||1,b:0,c:0,d:sy||1,e:0,f:0}; }
function _matRotate(rad){ var cos=Math.cos(rad), sin=Math.sin(rad); return {a:cos,b:sin,c:-sin,d:cos,e:0,f:0}; }
function _matSkewX(rad){ return {a:1,b:0,c:Math.tan(rad),d:1,e:0,f:0}; }
function _matSkewY(rad){ return {a:1,b:Math.tan(rad),c:0,d:1,e:0,f:0}; }
function _matFrom(a,b,c,d,e,f){ return {a:a,b:b,c:c,d:d,e:e,f:f}; }

function parseTransformMatrixList(str){
    if (!str || typeof str !== 'string') return _matIdentity();
    var regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^\)]*)\)/g;
    var m; var acc = _matIdentity();
    while ((m = regex.exec(str)) !== null) {
        var kind = m[1];
        var args = m[2].split(/[ ,]+/).filter(function(s){return s!=='';}).map(parseFloat);
        var t = _matIdentity();
        if (kind === 'matrix' && args.length>=6) {
            t = _matFrom(args[0],args[1],args[2],args[3],args[4],args[5]);
        } else if (kind === 'translate') {
            var tx = args[0]||0, ty = (args.length>1?args[1]:0)||0; t = _matTranslate(tx,ty);
        } else if (kind === 'scale') {
            var sx = args[0]||1, sy = (args.length>1?args[1]:sx); t = _matScale(sx,sy);
        } else if (kind === 'rotate') {
            var ang = (args[0]||0) * Math.PI/180;
            if (args.length>=3) {
                var cx = args[1]||0, cy = args[2]||0;
                t = _matMultiply(_matMultiply(_matTranslate(cx,cy), _matRotate(ang)), _matTranslate(-cx,-cy));
            } else {
                t = _matRotate(ang);
            }
        } else if (kind === 'skewX') {
            t = _matSkewX((args[0]||0)*Math.PI/180);
        } else if (kind === 'skewY') {
            t = _matSkewY((args[0]||0)*Math.PI/180);
        }
        acc = _matMultiply(acc, t);
    }
    return acc;
}

function decomposeMatrix(m){
    var a=m.a,b=m.b,c=m.c,d=m.d;
    var scaleX = Math.sqrt(a*a + b*b) || 0;
    var rot = 0;
    if (scaleX !== 0) { rot = Math.atan2(b, a); }
    var a2 = a/ (scaleX||1), b2 = b/ (scaleX||1);
    var shear = a2*c + b2*d;
    var c2 = c - a2*shear, d2 = d - b2*shear;
    var scaleY = Math.sqrt(c2*c2 + d2*d2) || 0;
    if ((a*d - b*c) < 0) { if (scaleX < scaleY) scaleX = -scaleX; else scaleY = -scaleY; }
    var shearFactor = (scaleY!==0)? shear/scaleY : 0;
    
    // Extract translation values
    var translateX = m.e || m.tx || 0;
    var translateY = m.f || m.ty || 0;
    
    return { 
        rotationDeg: rot*180/Math.PI, 
        scaleX: scaleX, 
        scaleY: scaleY, 
        shear: shearFactor,
        translateX: translateX,
        translateY: translateY
    };
}

function getRotationDegFromTransform(tstr){
    var m = parseTransformMatrixList(tstr||'');
    var d = decomposeMatrix(m);
    return d.rotationDeg || 0;
}


// ----------------------------------------
// quiver_svgParser.js
// ----------------------------------------
// --- Minimal SVG parsing (M1 scope) ---
function parseSVGStructure(svgCode) {
    var uidCounter = 0;
    var idIndex = {};
    function makeNode(base) {
        base._uid = (++uidCounter);
        if (base.attrs && base.attrs.id) idIndex[base.attrs.id] = base;
        return base;
    }
    var tree = makeNode({ type: 'root', name: 'root', children: [], attrs: {}, transformChain: [] });
    var stack = [tree];

    // Extract opening tags and self-closing blocks for supported types (including image/pattern/use)
    var regex = /<(svg|g|rect|circle|ellipse|text|path|polygon|polyline|line|image|pattern|defs|clipPath|mask|use)([^>]*)>|<\/\s*(svg|g|text|defs|clipPath|mask|pattern)\s*>|<tspan([^>]*)>(.*?)<\/tspan>/g;
    var match;
    var textBuffer = null;
    while ((match = regex.exec(svgCode)) !== null) {
        if (match[1]) {
            var tag = match[1];
            var attrsRaw = match[2] || "";
            var opening = "<" + tag + attrsRaw + ">";
            if (tag === 'svg' || tag === 'g' || tag === 'text' || tag === 'defs' || tag === 'clipPath' || tag === 'mask') {
                var node = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], tspans: [], transformChain: [] });
                node.attrs.transform = extractAttribute(opening, 'transform');
                // Store direct attributes commonly used
                var directAttrs = ['id','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','font-style','letter-spacing','x','y','mask','clip-path','filter','mix-blend-mode','data-figma-bg-blur-radius','data-figma-gradient-fill','data-figma-skip-parse'];
                for (var d = 0; d < directAttrs.length; d++) {
                    var key = directAttrs[d];
                    var val = extractAttribute(opening, key);
                    if (val !== null) node.attrs[key] = val;
                }
                // Preserve the original style attribute (needed for fallback extraction)
                var styleAttr = extractAttribute(opening, 'style');
                if (styleAttr) node.attrs.style = styleAttr;
                // Merge inline style properties into attrs for easy access
                var inline = mergeInlineStyleIntoAttrs(opening);
                for (var k in inline) node.attrs[k] = inline[k];
                stack[stack.length - 1].children.push(node);
                stack.push(node);
                
                // For text elements, capture any direct text content before first tspan (Affinity SVG support)
                if (tag === 'text') {
                    try {
                        var textEndPos = match.index + match[0].length;
                        var nextTagMatch = /<[^>]+>/.exec(svgCode.substring(textEndPos));
                        if (nextTagMatch) {
                            var directTextContent = svgCode.substring(textEndPos, textEndPos + nextTagMatch.index).trim();
                            if (directTextContent) {
                                // Decode entities and clean up
                                directTextContent = directTextContent.replace(/&#10;/g, '');
                                // Strip HTML anchor tags (e.g., <a href="...">text</a> → text)
                                directTextContent = directTextContent.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '');
                                try { directTextContent = decodeEntitiesForName(directTextContent); } catch (eDec) {}
                                // Add as first tspan with parent text's position
                                if (directTextContent) {
                                    node.tspans.push({
                                        x: parseFloat(node.attrs.x || '0'),
                                        y: parseFloat(node.attrs.y || '0'),
                                        text: directTextContent
                                    });
                                }
                            }
                        }
                    } catch (eDirectText) {
                        // Silent fail - direct text capture is optional
                    }
                }
            } else if (tag === 'rect' || tag === 'circle' || tag === 'ellipse') {
                var leaf = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var keys = ['id','x','y','width','height','rx','ry','cx','cy','r','rx','ry','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','mask','clip-path','filter','mix-blend-mode','data-figma-bg-blur-radius','data-figma-gradient-fill'];
                for (var j = 0; j < keys.length; j++) {
                    var kk = keys[j];
                    var vv = extractAttribute(opening, kk);
                    if (vv !== null) leaf.attrs[kk] = vv;
                }
                var inline2 = mergeInlineStyleIntoAttrs(opening);
                for (var k2 in inline2) leaf.attrs[k2] = inline2[k2];
                stack[stack.length - 1].children.push(leaf);
            } else if (tag === 'image') {
                var inode = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var href = extractAttribute(opening, 'href') || extractAttribute(opening, 'xlink:href');
                if (href !== null) inode.attrs.href = href;
                var ikeys = ['id','x','y','width','height','opacity','transform','preserveAspectRatio','mask','clip-path','filter','mix-blend-mode'];
                for (var ij = 0; ij < ikeys.length; ij++) {
                    var ikk = ikeys[ij];
                    var ivv = extractAttribute(opening, ikk);
                    if (ivv !== null) inode.attrs[ikk] = ivv;
                }
                var inlineI = mergeInlineStyleIntoAttrs(opening);
                for (var kI in inlineI) inode.attrs[kI] = inlineI[kI];
                // Re-index after ID attribute is extracted (for <use> element lookups)
                if (inode.attrs.id) idIndex[inode.attrs.id] = inode;
                stack[stack.length - 1].children.push(inode);
            } else if (tag === 'use') {
                // Handle <use> elements (Affinity SVG format for referencing images/symbols)
                var unode = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var href = extractAttribute(opening, 'href') || extractAttribute(opening, 'xlink:href');
                if (href !== null) unode.attrs.href = href;
                var ukeys = ['id','x','y','width','height','opacity','transform','mask','clip-path','filter','mix-blend-mode'];
                for (var uj = 0; uj < ukeys.length; uj++) {
                    var ukk = ukeys[uj];
                    var uvv = extractAttribute(opening, ukk);
                    if (uvv !== null) unode.attrs[ukk] = uvv;
                }
                var inlineU = mergeInlineStyleIntoAttrs(opening);
                for (var kU in inlineU) unode.attrs[kU] = inlineU[kU];
                stack[stack.length - 1].children.push(unode);
            } else if (tag === 'pattern') {
                var pnode = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var pkeys = ['id','x','y','width','height','patternUnits','patternContentUnits','patternTransform'];
                for (var pkj = 0; pkj < pkeys.length; pkj++) {
                    var pkk = pkeys[pkj];
                    var pkv = extractAttribute(opening, pkk);
                    if (pkv !== null) pnode.attrs[pkk] = pkv;
                }
                stack[stack.length - 1].children.push(pnode);
                stack.push(pnode);
            } else if (tag === 'path') {
                // Record path as a node (M1: placeholder only)
                var pnode = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var pkeys = ['id','d','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','fill-rule','clip-rule','mask','clip-path','filter','mix-blend-mode','data-figma-bg-blur-radius','data-figma-gradient-fill'];
                for (var pj = 0; pj < pkeys.length; pj++) {
                    var pk = pkeys[pj];
                    var pv = extractAttribute(opening, pk);
                    if (pv !== null) pnode.attrs[pk] = pv;
                }
                var inline3 = mergeInlineStyleIntoAttrs(opening);
                for (var k3 in inline3) pnode.attrs[k3] = inline3[k3];
                stack[stack.length - 1].children.push(pnode);
            } else if (tag === 'polygon' || tag === 'polyline') {
                var vnode = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var vkeys = ['id','points','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','mask','clip-path','filter','mix-blend-mode','data-figma-bg-blur-radius','data-figma-gradient-fill'];
                for (var vj = 0; vj < vkeys.length; vj++) {
                    var vk = vkeys[vj];
                    var vv2 = extractAttribute(opening, vk);
                    if (vv2 !== null) vnode.attrs[vk] = vv2;
                }
                var inline4 = mergeInlineStyleIntoAttrs(opening);
                for (var k4 in inline4) vnode.attrs[k4] = inline4[k4];
                stack[stack.length - 1].children.push(vnode);
            } else if (tag === 'line') {
                var lnode = makeNode({ type: tag, name: decodeEntitiesForName(extractAttribute(opening, 'id') || tag), attrs: {}, opening: opening, children: [], transformChain: [] });
                var lkeys = ['id','x1','y1','x2','y2','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','mask','clip-path','filter','mix-blend-mode','data-figma-bg-blur-radius','data-figma-gradient-fill'];
                for (var lj = 0; lj < lkeys.length; lj++) {
                    var lk = lkeys[lj];
                    var lv = extractAttribute(opening, lk);
                    if (lv !== null) lnode.attrs[lk] = lv;
                }
                var inline5 = mergeInlineStyleIntoAttrs(opening);
                for (var k5 in inline5) lnode.attrs[k5] = inline5[k5];
                stack[stack.length - 1].children.push(lnode);
            }
        } else if (match[3]) {
            // closing tag (svg/g/text)
            var closingTag = match[3];
            // Pop until matching
            for (var s = stack.length - 1; s >= 0; s--) {
                if (stack[s].type === closingTag) {
                    stack.splice(s, stack.length - s);
                    break;
                }
            }
        } else if (match[4] !== undefined) {
            // <tspan ...>text</tspan> inside current <text>
            var tspanAttrsRaw = match[4] || "";
            var tspanOpen = "<tspan" + tspanAttrsRaw + ">";
            var textContent = (match[5] || "").replace(/&#10;/g, '');
            // Strip HTML anchor tags (e.g., <a href="...">text</a> → text)
            textContent = textContent.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '');
            // Decode HTML entities (e.g., &#x2019; → ')
            try { textContent = decodeEntitiesForName(textContent); } catch (eDec) {}
            // find nearest text node on stack
            var target = null;
            for (var si = stack.length - 1; si >= 0; si--) {
                if (stack[si].type === 'text') { target = stack[si]; break; }
            }
            if (target) {
                target.tspans.push({
                    x: parseFloat(extractAttribute(tspanOpen, 'x') || target.attrs.x || '0'),
                    y: parseFloat(extractAttribute(tspanOpen, 'y') || target.attrs.y || '0'),
                    text: textContent
                });
            }
        }
    }
    tree._idIndex = idIndex;
    return tree;
}

// --- Extract mask and clipPath definitions from SVG ---
function extractMasks(svgCode) {
    var masks = {};
    
    // Helper function to parse child shapes within a mask or clipPath
    function parseChildShapes(content) {
        var children = [];
        var childRegex = /<(circle|ellipse|rect|path)([^>]*)\/?>(?:[\s\S]*?<\/\1>)?/g;
        var childMatch;
        
        while ((childMatch = childRegex.exec(content)) !== null) {
            var childType = childMatch[1];
            var childAttrsStr = childMatch[2];
            var childOpening = '<' + childType + childAttrsStr + '>';
            
            var childNode = {
                type: childType,
                name: extractAttribute(childOpening, 'id') || childType,
                attrs: {}
            };
            
            // Extract relevant attributes based on shape type
            var attrKeys = [];
            if (childType === 'circle') {
                attrKeys = ['id', 'cx', 'cy', 'r', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'opacity', 'transform'];
            } else if (childType === 'ellipse') {
                attrKeys = ['id', 'cx', 'cy', 'rx', 'ry', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'opacity', 'transform'];
            } else if (childType === 'rect') {
                attrKeys = ['id', 'x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'opacity', 'transform'];
            } else if (childType === 'path') {
                attrKeys = ['id', 'd', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'opacity', 'transform', 'fill-rule'];
            }
            
            for (var i = 0; i < attrKeys.length; i++) {
                var key = attrKeys[i];
                var val = extractAttribute(childOpening, key);
                if (val !== null) {
                    childNode.attrs[key] = val;
                }
            }
            
            children.push(childNode);
        }
        return children;
    }
    
    // Find all <mask> elements with their content
    var maskRegex = /<mask([^>]*)>([\s\S]*?)<\/mask>/g;
    var match;
    
    while ((match = maskRegex.exec(svgCode)) !== null) {
        var maskAttrs = match[1];
        var maskContent = match[2];
        
        // Extract mask ID
        var idMatch = /id\s*=\s*["']([^"']+)["']/.exec(maskAttrs);
        if (!idMatch) continue;
        var maskId = idMatch[1];
        
        // Determine mask type (alpha or luminance)
        var maskType = 'alpha'; // default
        
        // Check style attribute for mask-type
        var styleMatch = /style\s*=\s*["']([^"']+)["']/.exec(maskAttrs);
        if (styleMatch) {
            var styleContent = styleMatch[1];
            if (/mask-type\s*:\s*luminance/i.test(styleContent)) {
                maskType = 'luminance';
            }
        }
        
        masks[maskId] = {
            type: maskType,
            children: parseChildShapes(maskContent),
            attrs: {}
        };
    }
    
    // Find all <clipPath> elements with their content
    var clipPathRegex = /<clipPath([^>]*)>([\s\S]*?)<\/clipPath>/g;
    var clipMatch;
    
    while ((clipMatch = clipPathRegex.exec(svgCode)) !== null) {
        var clipAttrs = clipMatch[1];
        var clipContent = clipMatch[2];
        
        // Extract clipPath ID
        var clipIdMatch = /id\s*=\s*["']([^"']+)["']/.exec(clipAttrs);
        if (!clipIdMatch) continue;
        var clipId = clipIdMatch[1];
        
        // clipPath is always alpha-based (uses shape boundaries)
        masks[clipId] = {
            type: 'clip',
            children: parseChildShapes(clipContent),
            attrs: {}
        };
        
    }
    
    return masks;
}

// --- Pre-import normalization: merge separate fill/stroke siblings with identical geometry ---
function _geomKey(node) {
    if (!node || !node.type) return null;
    var t = node.type;
    var a = node.attrs || {};
    var tr = a.transform || '';
    if (t === 'path') return 'p:' + (a.d || '') + '|t:' + tr;
    if (t === 'rect') return 'r:' + [a.x||0,a.y||0,a.width||0,a.height||0,a.rx||0,a.ry||0].join(',') + '|t:' + tr;
    if (t === 'circle') return 'c:' + [a.cx||0,a.cy||0,a.r||0].join(',') + '|t:' + tr;
    if (t === 'ellipse') return 'e:' + [a.cx||0,a.cy||0,a.rx||0,a.ry||0].join(',') + '|t:' + tr;
    if (t === 'polygon' || t === 'polyline') return (t==='polygon'?'g:':'l:') + (a.points||'') + '|t:' + tr;
    if (t === 'line') return 'line:' + [a.x1||0,a.y1||0,a.x2||0,a.y2||0].join(',') + '|t:' + tr;
    return null;
}

function _hasFillOnly(attrs) {
    if (!attrs) return false;
    var f = attrs.fill;
    var s = attrs.stroke;
    var hasF = (f && f !== 'none');
    var hasS = (s && s !== 'none');
    return hasF && !hasS;
}

function _hasStrokeOnly(attrs) {
    if (!attrs) return false;
    var f = attrs.fill;
    var s = attrs.stroke;
    var hasF = (f && f !== 'none');
    var hasS = (s && s !== 'none');
    return !hasF && hasS;
}

function mergeFillStrokePairs(node) {
    if (!node || !node.children || !node.children.length) return;
    // Only merge within the same parent group/svg/root
    var buckets = {};
    for (var i = 0; i < node.children.length; i++) {
        var ch = node.children[i];
        // Recurse for subgroups first
        if (ch.type === 'g' || ch.type === 'svg' || ch.type === 'root') mergeFillStrokePairs(ch);
        var key = _geomKey(ch);
        if (!key) continue;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(ch);
    }
    // For each geometry bucket, merge a fill-only and a stroke-only node
    for (var k in buckets) {
        var arr = buckets[k];
        if (!arr || arr.length < 2) continue;
        var fillNode = null, strokeNode = null;
        for (var j = 0; j < arr.length; j++) {
            var n = arr[j];
            if (!fillNode && _hasFillOnly(n.attrs)) fillNode = n;
            if (!strokeNode && _hasStrokeOnly(n.attrs)) strokeNode = n;
        }
        if (fillNode && strokeNode) {
            // Merge stroke attributes into the base (prefer the fill node as base)
            var base = fillNode;
            var donor = strokeNode;
            base.attrs.stroke = donor.attrs.stroke;
            if (donor.attrs['stroke-width'] !== undefined) base.attrs['stroke-width'] = donor.attrs['stroke-width'];
            if (donor.attrs['stroke-opacity'] !== undefined) base.attrs['stroke-opacity'] = donor.attrs['stroke-opacity'];
            if (donor.attrs['stroke-dasharray'] !== undefined) base.attrs['stroke-dasharray'] = donor.attrs['stroke-dasharray'];
            if (donor.attrs['stroke-dashoffset'] !== undefined) base.attrs['stroke-dashoffset'] = donor.attrs['stroke-dashoffset'];
            // Mark donor for removal
            donor.__remove = true;
        }
    }
    // Filter out removed nodes
    var filtered = [];
    for (var m = 0; m < node.children.length; m++) {
        var ch2 = node.children[m];
        if (!ch2.__remove) filtered.push(ch2);
    }
    node.children = filtered;

    // Additional pass: detect inner/outer stroke pairs for rectangles and ellipses
    var eps = 1.0; // tolerance in px
    function nearly(a,b){ return Math.abs((parseFloat(a)||0) - (parseFloat(b)||0)) <= eps; }
    function tryMergeRectPair(fillRect, strokeRect) {
        var fx = parseFloat(fillRect.attrs.x||0), fy = parseFloat(fillRect.attrs.y||0);
        var fw = parseFloat(fillRect.attrs.width||0), fh = parseFloat(fillRect.attrs.height||0);
        var sx = parseFloat(strokeRect.attrs.x||0), sy = parseFloat(strokeRect.attrs.y||0);
        var sw = parseFloat(strokeRect.attrs.width||0), sh = parseFloat(strokeRect.attrs.height||0);
        var w = parseFloat(strokeRect.attrs['stroke-width']||0);
        if (!(w>0)) return false;
        // Inner: stroke rect inset by w/2 on all sides and size reduced by w
        var inner = nearly(sx, fx + w/2) && nearly(sy, fy + w/2) && nearly(sw, fw - w) && nearly(sh, fh - w);
        // Outer: stroke rect outset by w/2 and size increased by w
        var outer = nearly(sx, fx - w/2) && nearly(sy, fy - w/2) && nearly(sw, fw + w) && nearly(sh, fh + w);
        if (!inner && !outer) return false;
        // Merge stroke into fill rect and tag alignment
        fillRect.attrs.stroke = strokeRect.attrs.stroke;
        if (strokeRect.attrs['stroke-width'] !== undefined) fillRect.attrs['stroke-width'] = strokeRect.attrs['stroke-width'];
        if (strokeRect.attrs['stroke-opacity'] !== undefined) fillRect.attrs['stroke-opacity'] = strokeRect.attrs['stroke-opacity'];
        fillRect.attrs._stroke_align = inner ? 'inner' : 'outer';
        strokeRect.__remove = true;
        return true;
    }
    function tryMergeEllipsePair(fillEl, strokeEl) {
        var fcx = parseFloat(fillEl.attrs.cx||0), fcy = parseFloat(fillEl.attrs.cy||0);
        var frx = parseFloat(fillEl.attrs.rx||0), fry = parseFloat(fillEl.attrs.ry||0);
        var scx = parseFloat(strokeEl.attrs.cx||0), scy = parseFloat(strokeEl.attrs.cy||0);
        var srx = parseFloat(strokeEl.attrs.rx||0), sry = parseFloat(strokeEl.attrs.ry||0);
        var w = parseFloat(strokeEl.attrs['stroke-width']||0);
        if (!(w>0)) return false;
        var inner = nearly(scx, fcx) && nearly(scy, fcy) && nearly(srx, frx - w/2) && nearly(sry, fry - w/2);
        var outer = nearly(scx, fcx) && nearly(scy, fcy) && nearly(srx, frx + w/2) && nearly(sry, fry + w/2);
        if (!inner && !outer) return false;
        fillEl.attrs.stroke = strokeEl.attrs.stroke;
        if (strokeEl.attrs['stroke-width'] !== undefined) fillEl.attrs['stroke-width'] = strokeEl.attrs['stroke-width'];
        if (strokeEl.attrs['stroke-opacity'] !== undefined) fillEl.attrs['stroke-opacity'] = strokeEl.attrs['stroke-opacity'];
        fillEl.attrs._stroke_align = inner ? 'inner' : 'outer';
        strokeEl.__remove = true;
        return true;
    }
    function tryMergeCirclePair(fillEl, strokeEl) {
        // Similar to tryMergeEllipsePair but for circles (single radius)
        var fcx = parseFloat(fillEl.attrs.cx||0), fcy = parseFloat(fillEl.attrs.cy||0);
        var fr = parseFloat(fillEl.attrs.r||0);
        var scx = parseFloat(strokeEl.attrs.cx||0), scy = parseFloat(strokeEl.attrs.cy||0);
        var sr = parseFloat(strokeEl.attrs.r||0);
        var w = parseFloat(strokeEl.attrs['stroke-width']||0);
        if (!(w>0)) return false;
        // Inner stroke: stroke circle radius = fill radius - strokeWidth/2
        var inner = nearly(scx, fcx) && nearly(scy, fcy) && nearly(sr, fr - w/2);
        // Outer stroke: stroke circle radius = fill radius + strokeWidth/2
        var outer = nearly(scx, fcx) && nearly(scy, fcy) && nearly(sr, fr + w/2);
        if (!inner && !outer) return false;
        fillEl.attrs.stroke = strokeEl.attrs.stroke;
        if (strokeEl.attrs['stroke-width'] !== undefined) fillEl.attrs['stroke-width'] = strokeEl.attrs['stroke-width'];
        if (strokeEl.attrs['stroke-opacity'] !== undefined) fillEl.attrs['stroke-opacity'] = strokeEl.attrs['stroke-opacity'];
        fillEl.attrs._stroke_align = inner ? 'inner' : 'outer';
        strokeEl.__remove = true;
        return true;
    }
    // Search rect/ellipse pairs (include one-level nested groups without transforms, e.g. clip wrappers)
    function buildEntries(kind) {
        var out = [];
        for (var ci = 0; ci < node.children.length; ci++) {
            var c = node.children[ci];
            if (c.type === kind) {
                out.push({ node: c, holder: node });
                continue;
            }
            if (c.type === 'g') {
                var tStr = c.attrs && c.attrs.transform || '';
                if (!tStr) {
                    for (var cj = 0; cj < c.children.length; cj++) {
                        var cc = c.children[cj];
                        if (cc && cc.type === kind) out.push({ node: cc, holder: c });
                    }
                }
            }
        }
        return out;
    }
    function mergeForTypeEntries(entries, kind) {
        for (var i = 0; i < entries.length; i++) {
            var aEnt = entries[i]; if (!aEnt || !aEnt.node || aEnt.node.__remove) continue;
            var a = aEnt.node;
            if (!_hasFillOnly(a.attrs)) continue;
            for (var j = 0; j < entries.length; j++) {
                if (i === j) continue; var bEnt = entries[j]; if (!bEnt || !bEnt.node || bEnt.node.__remove) continue;
                var b = bEnt.node;
                if (!_hasStrokeOnly(b.attrs)) continue;
                var ok = false;
                if (kind === 'rect') ok = tryMergeRectPair(a,b); 
                else if (kind === 'circle') ok = tryMergeCirclePair(a,b);
                else ok = tryMergeEllipsePair(a,b);
                if (ok) break;
            }
        }
    }
    var rectEntries = buildEntries('rect');
    var ellipseEntries = buildEntries('ellipse');
    var circleEntries = buildEntries('circle');
    mergeForTypeEntries(rectEntries, 'rect');
    mergeForTypeEntries(ellipseEntries, 'ellipse');
    mergeForTypeEntries(circleEntries, 'circle');
    
    // MULTI-FILL OPTIMIZATION: Merge identical sibling shapes with different fills
    // Figma exports multiple fills as separate identical shapes - combine into one shape with multiple shaders
    function areRectsIdentical(a, b) {
        var ax = parseFloat(a.attrs.x||0), ay = parseFloat(a.attrs.y||0);
        var aw = parseFloat(a.attrs.width||0), ah = parseFloat(a.attrs.height||0);
        var arx = parseFloat(a.attrs.rx||0), ary = parseFloat(a.attrs.ry||0);
        var bx = parseFloat(b.attrs.x||0), by = parseFloat(b.attrs.y||0);
        var bw = parseFloat(b.attrs.width||0), bh = parseFloat(b.attrs.height||0);
        var brx = parseFloat(b.attrs.rx||0), bry = parseFloat(b.attrs.ry||0);
        return nearly(ax, bx) && nearly(ay, by) && nearly(aw, bw) && nearly(ah, bh) && nearly(arx, brx) && nearly(ary, bry);
    }
    function areEllipsesIdentical(a, b) {
        var acx = parseFloat(a.attrs.cx||0), acy = parseFloat(a.attrs.cy||0);
        var arx = parseFloat(a.attrs.rx||0), ary = parseFloat(a.attrs.ry||0);
        var bcx = parseFloat(b.attrs.cx||0), bcy = parseFloat(b.attrs.cy||0);
        var brx = parseFloat(b.attrs.rx||0), bry = parseFloat(b.attrs.ry||0);
        return nearly(acx, bcx) && nearly(acy, bcy) && nearly(arx, brx) && nearly(ary, bry);
    }
    function arePathsIdentical(a, b) {
        // Compare path 'd' attribute and transform
        var aD = (a.attrs.d || '').trim();
        var bD = (b.attrs.d || '').trim();
        var aTransform = (a.attrs.transform || '').trim();
        var bTransform = (b.attrs.transform || '').trim();
        return aD === bD && aTransform === bTransform;
    }
    function areCirclesIdentical(a, b) {
        var acx = parseFloat(a.attrs.cx||0), acy = parseFloat(a.attrs.cy||0);
        var ar = parseFloat(a.attrs.r||0);
        var bcx = parseFloat(b.attrs.cx||0), bcy = parseFloat(b.attrs.cy||0);
        var br = parseFloat(b.attrs.r||0);
        // Also compare transforms for consistency with arePathsIdentical
        var aTransform = (a.attrs.transform || '').trim();
        var bTransform = (b.attrs.transform || '').trim();
        return nearly(acx, bcx) && nearly(acy, bcy) && nearly(ar, br) && aTransform === bTransform;
    }
    function arePolygonsIdentical(a, b) {
        // Compare points attribute and transform
        var aPoints = (a.attrs.points || '').trim();
        var bPoints = (b.attrs.points || '').trim();
        var aTransform = (a.attrs.transform || '').trim();
        var bTransform = (b.attrs.transform || '').trim();
        return aPoints === bPoints && aTransform === bTransform;
    }
    function areLinesIdentical(a, b) {
        var ax1 = parseFloat(a.attrs.x1||0), ay1 = parseFloat(a.attrs.y1||0);
        var ax2 = parseFloat(a.attrs.x2||0), ay2 = parseFloat(a.attrs.y2||0);
        var bx1 = parseFloat(b.attrs.x1||0), by1 = parseFloat(b.attrs.y1||0);
        var bx2 = parseFloat(b.attrs.x2||0), by2 = parseFloat(b.attrs.y2||0);
        return nearly(ax1, bx1) && nearly(ay1, by1) && nearly(ax2, bx2) && nearly(ay2, by2);
    }
    function areTextsIdentical(a, b) {
        // Compare text position, transform, and content
        var ax = parseFloat(a.attrs.x||0), ay = parseFloat(a.attrs.y||0);
        var bx = parseFloat(b.attrs.x||0), by = parseFloat(b.attrs.y||0);
        if (!nearly(ax, bx) || !nearly(ay, by)) return false;
        
        var aTransform = (a.attrs.transform || '').trim();
        var bTransform = (b.attrs.transform || '').trim();
        if (aTransform !== bTransform) return false;
        
        // Compare text content by serializing tspans
        // NOTE: The SVG parser stores tspan content in node.tspans array (not node.children)
        function getTextContent(node) {
            // Check node.tspans first (where the SVG parser stores tspan data)
            if (node.tspans && node.tspans.length > 0) {
                var content = '';
                for (var i = 0; i < node.tspans.length; i++) {
                    var tspan = node.tspans[i];
                    content += (tspan.x || 0) + ',' + (tspan.y || 0) + ':' + (tspan.text || '') + '|';
                }
                return content;
            }
            // Fallback: check children (for other parsers that might use child nodes)
            if (node.children && node.children.length > 0) {
                var contentFromChildren = '';
                for (var j = 0; j < node.children.length; j++) {
                    var child = node.children[j];
                    if (child.type === 'tspan') {
                        var tspanX = child.attrs && child.attrs.x || '';
                        var tspanY = child.attrs && child.attrs.y || '';
                        var tspanText = child.text || '';
                        if (!tspanText && child.children) {
                            for (var ti = 0; ti < child.children.length; ti++) {
                                var tc = child.children[ti];
                                if (tc.text) tspanText += tc.text;
                            }
                        }
                        contentFromChildren += tspanX + ',' + tspanY + ':' + tspanText + '|';
                    }
                }
                if (contentFromChildren) return contentFromChildren;
            }
            // Final fallback: direct text property
            return node.text || '';
        }
        
        var aContent = getTextContent(a);
        var bContent = getTextContent(b);
        var identical = (aContent === bContent);
        
        // Debug logging for text comparison
        
        // CRITICAL: If both contents are empty, texts should NOT be considered identical
        // This prevents merging different texts that failed content extraction
        if (aContent === '' && bContent === '') {
            return false;
        }
        
        return identical;
    }
    function hasMergeableFill(attrs) {
        var fill = attrs.fill || '';
        // Mergeable: url(#...) references OR solid colors (not 'none' or empty)
        if (fill.indexOf('url(') === 0) return true;
        if (fill && fill !== 'none') return true;
        // Also mergeable: Figma gradient fill marker (angular/diamond gradients)
        if (attrs['data-figma-gradient-fill']) return true;
        return false;
    }
    function mergeIdenticalFillShapes(entries, isIdenticalFn) {
        // Group identical shapes together
        var groups = [];
        var used = {};
        for (var i = 0; i < entries.length; i++) {
            if (used[i]) continue;
            var aEnt = entries[i];
            if (!aEnt || !aEnt.node || aEnt.node.__remove) continue;
            var a = aEnt.node;
            if (!hasMergeableFill(a.attrs)) continue;
            
            // Include holder (parent group) for filter checking
            var group = [{ idx: i, node: a, holder: aEnt.holder }];
            used[i] = true;
            
            for (var j = i + 1; j < entries.length; j++) {
                if (used[j]) continue;
                var bEnt = entries[j];
                if (!bEnt || !bEnt.node || bEnt.node.__remove) continue;
                var b = bEnt.node;
                if (!hasMergeableFill(b.attrs)) continue;
                
                // CRITICAL: Only merge shapes that are SIBLINGS (same parent holder)
                // This prevents incorrectly merging shapes from different groups
                if (aEnt.holder !== bEnt.holder) continue;
                
                if (isIdenticalFn(a, b)) {
                    group.push({ idx: j, node: b, holder: bEnt.holder });
                    used[j] = true;
                }
            }
            
            if (group.length > 1) {
                groups.push(group);
            }
        }
        
        // Helper function to detect Figma gradient simulation helper shapes
        // These are shapes that Figma creates to simulate diamond/angular gradients in SVG
        // The fill references gradient IDs like "paint0_diamond_81_199" or "paint0_angular_81_199"
        function isGradientSimulationFill(fill) {
            if (!fill || typeof fill !== 'string') return false;
            // Extract gradient ID from url(#id)
            var match = /url\(#([^)]+)\)/.exec(fill);
            if (!match) return false;
            var gradId = match[1].toLowerCase();
            // Figma uses patterns like "paint0_diamond_81_199" or "paint0_angular_81_199"
            return gradId.indexOf('_diamond_') !== -1 || gradId.indexOf('_angular_') !== -1;
        }
        
        // Merge each group: keep first, store additional fills, mark others for removal
        for (var gi = 0; gi < groups.length; gi++) {
            var g = groups[gi];
            var primaryEntry = g[0];
            var primary = primaryEntry.node;
            
            // Check if ALL shapes in this group are gradient simulation helpers
            // If so, skip the entire group - the actual user shape with data-figma-gradient-fill will handle the gradient
            var allAreGradientSimulation = true;
            for (var gsi = 0; gsi < g.length; gsi++) {
                var gNode = g[gsi].node;
                var gFill = gNode.attrs && gNode.attrs.fill;
                if (!isGradientSimulationFill(gFill)) {
                    allAreGradientSimulation = false;
                    break;
                }
            }
            
            if (allAreGradientSimulation) {
                // Mark ALL shapes in this group for removal - they're gradient simulation helpers
                for (var gri = 0; gri < g.length; gri++) {
                    g[gri].node.__remove = true;
                }
                continue; // Skip the normal merge logic for this group
            }
            
            if (!primary.attrs._additionalFills) {
                primary.attrs._additionalFills = [];
            }
            for (var si = 1; si < g.length; si++) {
                var secondaryEntry = g[si];
                var secondary = secondaryEntry.node;
                var secondaryHolder = secondaryEntry.holder;
                
                // Store fill info: for solid colors, include opacity
                var fillInfo = {
                    fill: secondary.attrs.fill,
                    fillOpacity: secondary.attrs['fill-opacity'] || '1',
                    opacity: secondary.attrs.opacity || '1'
                };
                
                // Also check for Figma gradient marker (angular/diamond gradients)
                if (secondary.attrs['data-figma-gradient-fill']) {
                    fillInfo['data-figma-gradient-fill'] = secondary.attrs['data-figma-gradient-fill'];
                }
                
                primary.attrs._additionalFills.push(fillInfo);
                
                // NOTE: data-figma-gradient-fill is stored in fillInfo and processed via _additionalFills
                // Do NOT transfer to primary.attrs to avoid duplicate gradient creation
                
                // IMPORTANT: Transfer inherited filter from secondary to primary
                // This ensures filters from parent groups (like inner shadows) aren't lost
                if (secondary.attrs._inheritedFilterId && !primary.attrs._inheritedFilterId) {
                    primary.attrs._inheritedFilterId = secondary.attrs._inheritedFilterId;
                }
                
                // Also transfer any direct filter attribute from the secondary shape
                if (secondary.attrs.filter && !primary.attrs.filter) {
                    primary.attrs.filter = secondary.attrs.filter;
                }
                
                // CRITICAL: Check if the secondary's PARENT GROUP has a filter (e.g., inner shadow)
                // This is the common case: Figma exports <g filter="..."><rect fill="..."/></g>
                if (secondaryHolder && secondaryHolder.attrs && secondaryHolder.attrs.filter && !primary.attrs.filter) {
                    primary.attrs.filter = secondaryHolder.attrs.filter;
                }
                
                // Mark for removal
                secondary.__remove = true;
            }
        }
    }
    mergeIdenticalFillShapes(rectEntries, areRectsIdentical);
    mergeIdenticalFillShapes(ellipseEntries, areEllipsesIdentical);
    
    // Also handle paths - Figma exports multi-fill paths as identical <path> elements with same 'd' attribute
    var pathEntries = buildEntries('path');
    mergeIdenticalFillShapes(pathEntries, arePathsIdentical);
    
    // Handle circles
    var circleEntries = buildEntries('circle');
    mergeIdenticalFillShapes(circleEntries, areCirclesIdentical);
    
    // Handle polygons and polylines (both use 'points' attribute)
    var polygonEntries = buildEntries('polygon');
    mergeIdenticalFillShapes(polygonEntries, arePolygonsIdentical);
    
    var polylineEntries = buildEntries('polyline');
    mergeIdenticalFillShapes(polylineEntries, arePolygonsIdentical); // Same comparison logic
    
    // Handle lines (less common for multi-fill, but included for completeness)
    var lineEntries = buildEntries('line');
    mergeIdenticalFillShapes(lineEntries, areLinesIdentical);
    
    // Handle text elements - Figma can export multi-fill text as identical <text> elements
    var textEntries = buildEntries('text');
    mergeIdenticalFillShapes(textEntries, areTextsIdentical);
    
    // Remove any stroke-only nodes marked for deletion after inner/outer merge (recursively)
    function pruneRemovedRecursively(n) {
        if (!n || !n.children) return;
        var keep = [];
        for (var ii = 0; ii < n.children.length; ii++) {
            var ch = n.children[ii];
            if (ch && !ch.__remove) keep.push(ch);
        }
        n.children = keep;
        for (var jj = 0; jj < n.children.length; jj++) pruneRemovedRecursively(n.children[jj]);
    }
    pruneRemovedRecursively(node);
}

// --- Coordinate conversion (viewBox aware) ---
function extractViewBox(svg) {
    var m = svg.match(/<svg[^>]*>/);
    if (!m) return null;
    var open = m[0];
    var vb = extractAttribute(open, 'viewBox');
    var widthAttr = extractAttribute(open, 'width');
    var heightAttr = extractAttribute(open, 'height');
    if (vb) {
        var vals = vb.split(/[ ,]+/);
        if (vals.length === 4) {
            return { x: parseFloat(vals[0]), y: parseFloat(vals[1]), width: parseFloat(vals[2]), height: parseFloat(vals[3]) };
        }
    }
    // fallback
    var w = widthAttr ? parseFloat(('' + widthAttr).replace('px','')) : 1000;
    var h = heightAttr ? parseFloat(('' + heightAttr).replace('px','')) : 1000;
    return { x: 0, y: 0, width: w, height: h };
}

function svgToCavalryPosition(xSvg, ySvg, vb) {
    var cx = xSvg - (vb.x + vb.width / 2);
    var cy = (vb.y + vb.height / 2) - ySvg;
    return {x: cx, y: cy};
}

// --- Style application ---
function applyFillAndStroke(layerId, attrs) {
    try {
        var fill = attrs.fill || (attrs.style && extractStyleProperty(attrs.style, 'fill'));
        var fillOpacity = attrs['fill-opacity'] || extractStyleProperty(attrs.style, 'fill-opacity');
        var opacity = attrs.opacity || extractStyleProperty(attrs.style, 'opacity');
        var stroke = attrs.stroke || (attrs.style && extractStyleProperty(attrs.style, 'stroke'));
        var strokeWidth = attrs['stroke-width'] || (attrs.style && extractStyleProperty(attrs.style, 'stroke-width'));
        var strokeOpacity = attrs['stroke-opacity'] || (attrs.style && extractStyleProperty(attrs.style, 'stroke-opacity'));
        var strokeDashArray = attrs['stroke-dasharray'] || (attrs.style && extractStyleProperty(attrs.style, 'stroke-dasharray'));
        var strokeDashOffset = attrs['stroke-dashoffset'] || (attrs.style && extractStyleProperty(attrs.style, 'stroke-dashoffset'));
        var strokeLinecap = attrs['stroke-linecap'] || (attrs.style && extractStyleProperty(attrs.style, 'stroke-linecap'));
        var strokeLinejoin = attrs['stroke-linejoin'] || (attrs.style && extractStyleProperty(attrs.style, 'stroke-linejoin'));
        
        // Inherited opacity from parent groups (Figma exports opacity on groups, not children)
        var inheritedOpacity = parseFloat(attrs._inheritedOpacity);
        if (isNaN(inheritedOpacity)) inheritedOpacity = 1;

        var gradientId = extractUrlRefId(fill);
        var strokeGradientId = extractUrlRefId(stroke);
        
        // Check for Figma gradient fill data attribute (for Angular/Sweep gradients that SVG can't represent natively)
        var figmaGradientFill = attrs['data-figma-gradient-fill'];
        if (figmaGradientFill && !gradientId) {
            try {
                
                // Parse the JSON data from the attribute (HTML entities need decoding)
                // Handle both named entities (&quot;) and numeric entities (&#34;)
                var decodedJson = figmaGradientFill
                    .replace(/&#34;/g, '"')      // Numeric entity for "
                    .replace(/&#39;/g, "'")      // Numeric entity for '
                    .replace(/&quot;/g, '"')     // Named entity for "
                    .replace(/&apos;/g, "'")     // Named entity for '
                    .replace(/&lt;/g, '<')       // Named entity for <
                    .replace(/&gt;/g, '>')       // Named entity for >
                    .replace(/&amp;/g, '&');     // Named entity for & (must be last!)
                
                
                var figmaGradData = JSON.parse(decodedJson);
                
                // Handle GRADIENT_ANGULAR (maps to Cavalry's Sweep gradient)
                if (figmaGradData.type === 'GRADIENT_ANGULAR') {
                    // Create a sweep gradient shader
                    var sweepShaderId = createSweepGradientFromFigma(figmaGradData, layerId, attrs);
                    if (sweepShaderId) {
                        // Skip the normal fill processing - gradient is already applied
                        gradientId = '__figma_angular__'; // Mark as handled
                    }
                }
                
                // Handle GRADIENT_DIAMOND (maps to Cavalry's Shape gradient with 4 sides)
                if (figmaGradData.type === 'GRADIENT_DIAMOND') {
                    // Create a diamond (shape) gradient shader
                    var diamondShaderId = createDiamondGradientFromFigma(figmaGradData, layerId, attrs);
                    if (diamondShaderId) {
                        // Skip the normal fill processing - gradient is already applied
                        gradientId = '__figma_diamond__'; // Mark as handled
                    }
                }
            } catch (eFigmaGrad) {
                console.warn('[ANGULAR GRADIENT] Failed to parse Figma gradient data: ' + eFigmaGrad.message);
            }
        }

        // Fill
        if (!fill || fill === 'none') {
            // Check if we have a Figma gradient that should override the 'none' fill
            if (gradientId === '__figma_angular__' || gradientId === '__figma_diamond__') {
                // Already handled above - special Figma gradient was applied
            } else {
                api.setFill(layerId, false);
            }
        } else {
            api.setFill(layerId, true);
            var fo = parseOpacityValue(fillOpacity); if (fo === null) fo = 1;
            var o = parseOpacityValue(opacity); if (o === null) o = 1;
            
            // Separate opacity concerns:
            // - fill-opacity (fo) → affects material.alpha / shader alpha
            // - opacity (o) + inheritedOpacity → affects shape's opacity attribute
            var shapeOpacity = clamp01(o * inheritedOpacity);
            var fillAlpha = fo; // fill-opacity only affects fill, not shape
            
            // Apply shape-level opacity (0-100 percentage)
            if (shapeOpacity < 0.999) {
                var shapeOpacityPercent = Math.round(shapeOpacity * 100);
                try {
                    api.set(layerId, { 'opacity': shapeOpacityPercent });
                } catch (eShapeOp) {
                }
            }
            
            // Debug log when inherited opacity is applied
            if (inheritedOpacity < 0.999) {
            }
            // If gradient fill, pass fill-opacity to shader (not material.alpha)
            if (gradientId) {
                // Let shader show through: base color alpha 0
                // Note: material.alpha is set to 100% in connectShaderToShape
                // fill-opacity is applied to the shader's alpha property instead
                try { api.set(layerId, {"material.materialColor.a": 0}); } catch (e0) {}
                
                // Calculate SVG center from attrs for gradient offset calculation
                // NOTE: For gradient offset, we need the LOCAL center (before translation)
                // because Figma exports gradient coordinates in local/pre-transform space
                var svgShapeCenter = null;
                try {
                    // Check for local center first (for rects with simple translate transforms)
                    // This is the center BEFORE translation - needed because gradient coords are local
                    if (attrs._localCenterX !== undefined && attrs._localCenterY !== undefined) {
                        svgShapeCenter = { x: attrs._localCenterX, y: attrs._localCenterY };
                    }
                    // Check for transformed center (from matrix transforms - rotation/scale)
                    else if (attrs._transformedCenterX !== undefined && attrs._transformedCenterY !== undefined) {
                        svgShapeCenter = { x: attrs._transformedCenterX, y: attrs._transformedCenterY };
                    }
                    // Check for path SVG center (calculated from path segments)
                    else if (attrs._pathSvgCenterX !== undefined && attrs._pathSvgCenterY !== undefined) {
                        svgShapeCenter = { x: attrs._pathSvgCenterX, y: attrs._pathSvgCenterY };
                    }
                    // For rect: x + width/2, y + height/2
                    else if (attrs.x !== undefined && attrs.width !== undefined) {
                        var rectX = parseFloat(attrs.x || '0');
                        var rectY = parseFloat(attrs.y || '0');
                        var rectW = parseFloat(attrs.width || '0');
                        var rectH = parseFloat(attrs.height || '0');
                        svgShapeCenter = { x: rectX + rectW / 2, y: rectY + rectH / 2 };
                    }
                    // For circle: cx, cy
                    else if (attrs.cx !== undefined && attrs.cy !== undefined) {
                        svgShapeCenter = { x: parseFloat(attrs.cx), y: parseFloat(attrs.cy) };
                    }
                    // For ellipse: cx, cy
                    else if (attrs.r !== undefined || attrs.rx !== undefined) {
                        svgShapeCenter = { x: parseFloat(attrs.cx || '0'), y: parseFloat(attrs.cy || '0') };
                    }
                } catch (eSvgCenter) {
                    // Couldn't calculate SVG center, offset may be inaccurate
                }
                
                // Extract scaleY and rotation for gradient flip/rotation compensation
                // When scaleY is negative (Y-flip), gradient direction needs to be adjusted
                // Shape rotation also affects userSpaceOnUse gradient appearance
                var shapeScaleY = (attrs._scaleY !== undefined) ? attrs._scaleY : 1;
                var shapeRotationDeg = (attrs._rotationDeg !== undefined) ? attrs._rotationDeg : 0;
                
                // Attempt gradient connect first (pass fillAlpha for shader opacity)
                var shaderOk = false;
                try {
                    var sh = getGradientShader(gradientId);
                    if (sh) { 
                        shaderOk = connectShaderToShape(sh, layerId, svgShapeCenter, fillAlpha, shapeScaleY, shapeRotationDeg); 
                    }
                } catch (eSh) {}
                // If not a known gradient but a pattern with image, connect an imageShader
                if (!shaderOk && __svgPatternMap && __svgPatternMap[gradientId]) {
                    try {
                        var pid = gradientId;
                        
                        // Get a better name from the shape or its parent instead of using pattern ID
                        var shaderName = 'Image Shader';
                        try {
                            // First try to get the shape's name
                            var shapeName = api.getNiceName(layerId) || '';
                            if (shapeName && shapeName !== 'Shape' && shapeName !== 'Path') {
                                shaderName = shapeName;
                                
                            } else {
                                // If shape name is generic, try to get parent's name
                                var parentId = api.getParent(layerId);
                                if (parentId) {
                                    var parentName = api.getNiceName(parentId) || '';
                                    if (parentName) {
                                        shaderName = parentName;
                                        
                                    }
                                }
                            }
                            // Add unique counter
                            __imageCounter++;
                            shaderName = shaderName + '_' + __imageCounter;
                        } catch (eGetName) {
                            // Fallback to pattern ID if we can't get a better name
                            shaderName = 'Image Shader ' + pid;
                            
                        }
                        
                        // Save a friendly base name for file outputs used by this pattern
                        try { __lastPatternOrImageName = shaderName; } catch (eNm) {}
                        // Skip image shader creation if disabled in settings
                        if (!importImageryEnabled) {

                        } else {
                        var cached = __patternImageShaderCache[pid];
                        var shaderNode = cached || api.create('imageShader', shaderName);
                        if (shaderNode) {
                            // load image
                            var meta = __svgPatternMap[pid] && __svgPatternMap[pid].image;
                            var target = (meta && meta.href) ? meta.href : null;
                            
                            // Create a context object with the shape/parent name for better naming
                            var patternContext = { attrs: { id: shaderName } };
                            var saved = target ? _resolveImageHrefToAsset(target, patternContext) : null;
                            var linkVal = saved || target;
                            if (linkVal) {
                                // Prefer loading the file as an Asset and connect it
                                var assetId = null;
                                try { if (saved && api.loadAsset) assetId = api.loadAsset(saved, false); } catch (eLoad) { assetId = null; }
                                if (!assetId) { try { if (saved && api.importAsset) assetId = api.importAsset(saved); } catch (eImp) { assetId = null; } }
                                var connected = false;
                                if (assetId) {
                                    try { api.connect(assetId, 'id', shaderNode, 'image'); connected = true; } catch (eConA) { connected = false; }
                                    try { if (!connected) console.error('[Quiver] Failed to connect asset to imageShader.image'); } catch (eLog1) {}
                                    
                                    // Parent the asset under the Quiver group in Assets Window
                                    var quiverGroup = _ensureQuiverAssetGroup();
                                    if (quiverGroup && api.parent) {
                                        try { 
                                            api.parent(assetId, quiverGroup);
                                            
                                        } catch (eParent) {
                                            
                                        }
                                    }
                                }
                                if (!connected) {
                                    // Fallback to setting a path/uri attribute on the shader
                                    var setAttr = _setFirstSupported(shaderNode, ['image','generator.image','file','path','source','uri','image.uri','image.path'], linkVal);
                                    
                                } else {
                                    
                                }
                            }
                            try { api.connect(shaderNode, 'id', layerId, 'material.colorShaders'); } catch (eConn) {}
                            try { if (!api.getParent(shaderNode)) api.parent(shaderNode, layerId); } catch (ePar) {}
                            
                            // Set alpha on the image shader based on fill-opacity only (0-100 percentage)
                            // Shape-level opacity is handled separately via shape's 'opacity' attribute
                            try {
                                var imgShaderAlpha = Math.round(fillAlpha * 100);
                                api.set(shaderNode, { 'alpha': imgShaderAlpha });
                                if (imgShaderAlpha < 100) {
                                }
                            } catch (eImgAlpha) {
                            }
                            
                            // Align and scale inside the target shape
                            try {
                                // Prefer centre alignment behaviour (only if attribute exists)
                                try { if (_hasAttr(shaderNode, 'legacyGraph')) api.set(shaderNode, { 'legacyGraph': false }); } catch (eLG) {}
                                
                                // Check if we have transform matrix data for precise positioning
                                var patternData = __svgPatternMap[pid];
                                var useTransform = patternData && patternData.useTransform;
                                var isObjectBoundingBox = patternData && patternData.attrs && patternData.attrs.patternContentUnits === 'objectBoundingBox';
                                
                                if (useTransform && isObjectBoundingBox) {
                                    // PRECISE MODE: Use scaleMode None and calculate exact scale/offset
                                    // The transform matrix is in objectBoundingBox coordinates (0-1 range)
                                    
                                    // Set scaleMode to None (0) for manual positioning
                                    var smSet = false;
                                    try { api.set(shaderNode, { 'scaleMode': 0 }); smSet = true; } catch (eSM0) { smSet = false; }
                                    if (!smSet) { try { api.set(shaderNode, { 'generator.scaleMode': 0 }); } catch (eSM0b) {} }
                                    
                                    // Get the target shape's dimensions using api.getBoundingBox
                                    var shapeW = 100, shapeH = 100;
                                    try { 
                                        var bbox = api.getBoundingBox(layerId, true);
                                        if (bbox) {
                                            shapeW = bbox.width || 100;
                                            shapeH = bbox.height || 100;
                                        }
                                    } catch (eBB) {
                                        // Fallback: try to get generator.dimensions
                                        try {
                                            var dims = api.get(layerId, 'generator.dimensions');
                                            if (dims && dims.length >= 2) {
                                                shapeW = dims[0] || 100;
                                                shapeH = dims[1] || 100;
                                            }
                                        } catch (eDims) {}
                                    }
                                    
                                    // Get source image dimensions from pattern metadata
                                    var imgMeta = patternData.image;
                                    var imgW = parseFloat(imgMeta && imgMeta.width) || 100;
                                    var imgH = parseFloat(imgMeta && imgMeta.height) || 100;
                                    
                                    // Debug: log all input values
                                    
                                    // Calculate scale for Cavalry (where 1.0 = 100% = native image size)
                                    // In objectBoundingBox with patternContentUnits="objectBoundingBox":
                                    // - matrix.a and matrix.d are scale factors in the 0-1 coordinate space
                                    // - The visible portion of image = a * imgW (as fraction of shape width)
                                    // - Visible pixels = a * imgW * shapeW
                                    // - Cavalry scale = (visible pixels / native pixels)
                                    //                 = (a * imgW * shapeW / imgW)
                                    //                 = a * shapeW
                                    var cavalryScaleX = useTransform.a * shapeW;
                                    var cavalryScaleY = useTransform.d * shapeH;
                                    
                                    
                                    // Apply scale
                                    _setFirstSupported(shaderNode, ['scale','generator.scale'], [cavalryScaleX, cavalryScaleY]);
                                    
                                    // Calculate offset in pixels
                                    // e and f are in objectBoundingBox 0-1 coordinates (origin = top-left of shape)
                                    // Cavalry offset is from center of shape
                                    // 
                                    // The transform positions the image such that:
                                    // - Image top-left corner is at (e * shapeW, f * shapeH) from shape's top-left
                                    // - The visible image size is (a * imgW * shapeW, d * imgH * shapeH)
                                    //
                                    // To convert to Cavalry's center-based offset:
                                    // - Shape center is at (shapeW/2, shapeH/2)
                                    // - Image center should be at: (e * shapeW + visibleW/2, f * shapeH + visibleH/2)
                                    // - Cavalry offset = image center - shape center
                                    
                                    var visibleW = useTransform.a * imgW * shapeW;
                                    var visibleH = useTransform.d * imgH * shapeH;
                                    
                                    var imgCenterX = useTransform.e * shapeW + visibleW / 2;
                                    var imgCenterY = useTransform.f * shapeH + visibleH / 2;
                                    
                                    var offsetX = imgCenterX - shapeW / 2;
                                    var offsetY = imgCenterY - shapeH / 2;
                                    
                                    // Cavalry Y axis is inverted (positive = up, negative = down)
                                    var cavalryOffsetX = offsetX;
                                    var cavalryOffsetY = -offsetY;
                                    
                                    
                                    _setFirstSupported(shaderNode, ['offset','generator.offset'], [cavalryOffsetX, cavalryOffsetY]);
                                    
                                } else {
                                    // FALLBACK MODE: Use Fit Cover (legacy behavior)
                                // Set Scale Mode using numeric enums only to avoid parse errors
                                var modes = [4,3,2,1];
                                var setDone = false;
                                for (var mi = 0; mi < modes.length && !setDone; mi++) {
                                    try { api.set(shaderNode, { 'scaleMode': modes[mi] }); setDone = true; } catch (eSMA) { setDone = false; }
                                    if (!setDone) { try { api.set(shaderNode, { 'generator.scaleMode': modes[mi] }); setDone = true; } catch (eSMB) { setDone = false; } }
                                }
                                    // Reset offset to centre
                                    _setFirstSupported(shaderNode, ['offset','generator.offset'], [0,0]);
                                }
                                
                                // Set tiling to Decal via enum index only (avoid string parse errors). Likely 0=Clamp,1=Repeat,2=Mirror,3=Decal
                                try { api.set(shaderNode, { 'tilingX': 3 }); } catch (eTX1) { try { api.set(shaderNode, { 'generator.tilingX': 3 }); } catch (eTX2) {} }
                                try { api.set(shaderNode, { 'tilingY': 3 }); } catch (eTY1) { try { api.set(shaderNode, { 'generator.tilingY': 3 }); } catch (eTY2) {} }
                                // Set filter quality based on user setting (0=None, 1=Bilinear, 2=Mipmaps, 3=Bicubic)
                                var fqOk = false;
                                try { api.set(shaderNode, { 'filterQuality': imageFilterQuality }); fqOk = true; } catch (eFQ1) { fqOk = false; }
                                if (!fqOk) { try { api.set(shaderNode, { 'generator.filterQuality': imageFilterQuality }); } catch (eFQ2) {} }
                            } catch (eAlign) {
                            }
                            __patternImageShaderCache[pid] = shaderNode;
                            }
                        }
                    } catch (eImgPat) {}
                }
            } else {
                var color = parseColor(fill) || "#000000";
                
                // If there are additional fills to stack, create the primary as a colorShader too
                // This ensures proper stacking (colorShaders stack, materialColor does not)
                if (attrs._additionalFills && attrs._additionalFills.length > 0) {
                    try {
                        // Use clean name with color hex for easy identification
                        var primaryColorShaderName = 'Fill 1 ' + color.toUpperCase();
                        var primaryColorShaderId = api.create('colorShader', primaryColorShaderName);
                        if (primaryColorShaderId) {
                            var hexCleanP = color.replace('#', '');
                            var rValP = parseInt(hexCleanP.substring(0, 2), 16) || 0;
                            var gValP = parseInt(hexCleanP.substring(2, 4), 16) || 0;
                            var bValP = parseInt(hexCleanP.substring(4, 6), 16) || 0;
                            // Use fillAlpha for shader color, not effectiveAlpha (shape opacity is separate)
                            var aValP = Math.round(fillAlpha * 255);
                            
                            api.set(primaryColorShaderId, { 
                                'shaderColor.r': rValP,
                                'shaderColor.g': gValP,
                                'shaderColor.b': bValP,
                                'shaderColor.a': aValP
                            });
                            api.set(primaryColorShaderId, { 'alpha': Math.round(fillAlpha * 100) });
                            api.connect(primaryColorShaderId, 'id', layerId, 'material.colorShaders');
                            try { api.parent(primaryColorShaderId, layerId); } catch (eParP) {}
                        }
                    } catch (ePrimaryShader) {
                        // Fallback to materialColor
                api.set(layerId, {
                    "material.materialColor": color,
                            "material.alpha": Math.round(fillAlpha * 100)
                        });
                    }
                } else {
                    // No stacking needed, use materialColor directly
                    api.set(layerId, {
                        "material.materialColor": color,
                        "material.alpha": Math.round(fillAlpha * 100)
                    });
                }
            }
        }
        
        // MULTI-FILL: Connect additional fills (from merged identical shapes)
        // These are stacked on top of the primary fill
        if (attrs._additionalFills && attrs._additionalFills.length > 0) {
            
            // Calculate SVG center for gradient offset calculation (if not already calculated)
            // NOTE: Use local center for gradient offset (gradient coords are in local space)
            var svgShapeCenterMulti = null;
            try {
                // Check for local center first (for rects with simple translate transforms)
                if (attrs._localCenterX !== undefined && attrs._localCenterY !== undefined) {
                    svgShapeCenterMulti = { x: attrs._localCenterX, y: attrs._localCenterY };
                }
                // Check for transformed center (from matrix transforms - rotation/scale)
                else if (attrs._transformedCenterX !== undefined && attrs._transformedCenterY !== undefined) {
                    svgShapeCenterMulti = { x: attrs._transformedCenterX, y: attrs._transformedCenterY };
                }
                // Check for path SVG center (calculated from path segments)
                else if (attrs._pathSvgCenterX !== undefined && attrs._pathSvgCenterY !== undefined) {
                    svgShapeCenterMulti = { x: attrs._pathSvgCenterX, y: attrs._pathSvgCenterY };
                }
                // For rect: x + width/2, y + height/2
                else if (attrs.x !== undefined && attrs.width !== undefined) {
                    var rectXM = parseFloat(attrs.x || '0');
                    var rectYM = parseFloat(attrs.y || '0');
                    var rectWM = parseFloat(attrs.width || '0');
                    var rectHM = parseFloat(attrs.height || '0');
                    svgShapeCenterMulti = { x: rectXM + rectWM / 2, y: rectYM + rectHM / 2 };
                }
                // For circle/ellipse: cx, cy
                else if (attrs.cx !== undefined && attrs.cy !== undefined) {
                    svgShapeCenterMulti = { x: parseFloat(attrs.cx), y: parseFloat(attrs.cy) };
                }
            } catch (eSvgCenterM) {}
            
            for (var afi = 0; afi < attrs._additionalFills.length; afi++) {
                var addFillInfo = attrs._additionalFills[afi];
                // Handle both old string format and new object format
                var addFillValue = (typeof addFillInfo === 'object') ? addFillInfo.fill : addFillInfo;
                var addFillOpacity = (typeof addFillInfo === 'object') ? parseFloat(addFillInfo.fillOpacity || '1') : 1;
                var addOpacity = (typeof addFillInfo === 'object') ? parseFloat(addFillInfo.opacity || '1') : 1;
                var addEffectiveOpacity = clamp01(addFillOpacity * addOpacity);
                
                // Check for Figma gradient fill marker (angular/diamond gradients)
                var addFigmaGradFill = (typeof addFillInfo === 'object') ? addFillInfo['data-figma-gradient-fill'] : null;
                if (addFigmaGradFill) {
                    try {
                        
                        // Decode HTML entities in the JSON
                        var decodedJsonAdd = addFigmaGradFill
                            .replace(/&#34;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/&quot;/g, '"')
                            .replace(/&apos;/g, "'")
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&');
                        
                        var figmaGradDataAdd = JSON.parse(decodedJsonAdd);
                        
                        // Handle GRADIENT_ANGULAR (Sweep gradient)
                        if (figmaGradDataAdd.type === 'GRADIENT_ANGULAR') {
                            var sweepShaderIdAdd = createSweepGradientFromFigma(figmaGradDataAdd, layerId, attrs);
                            if (sweepShaderIdAdd) {
                            }
                        }
                        
                        // Handle GRADIENT_DIAMOND (Shape gradient with 4 sides)
                        if (figmaGradDataAdd.type === 'GRADIENT_DIAMOND') {
                            var diamondShaderIdAdd = createDiamondGradientFromFigma(figmaGradDataAdd, layerId, attrs);
                            if (diamondShaderIdAdd) {
                            }
                        }
                        
                        // Skip further processing for this fill - gradient is handled
                        continue;
                    } catch (eFigmaGradAdd) {
                    }
                }
                
                var addFillId = extractUrlRefId(addFillValue);
                
                if (addFillId) {
                    // URL fill: gradient or pattern
                    var addShaderConnected = false;
                    try {
                        var addGradShader = getGradientShader(addFillId);
                        if (addGradShader) {
                            connectShaderToShape(addGradShader, layerId, svgShapeCenterMulti);
                            addShaderConnected = true;
                            
                            // Set the alpha on the gradient shader based on fill-opacity only (0-100 percentage)
                            var gradAlphaPercent = Math.round(addFillOpacity * 100);
                            try {
                                api.set(addGradShader, { 'alpha': gradAlphaPercent });
                            } catch (eGradAlpha) {
                            }
                        }
                    } catch (eAddGrad) {}
                    
                    // Try pattern (image shader) - with FULL configuration
                    if (!addShaderConnected && __svgPatternMap && __svgPatternMap[addFillId]) {
                        try {
                            var addPid = addFillId;
                            var addShaderName = api.getNiceName(layerId) + '_' + (afi + 2);
                            __imageCounter++;
                            addShaderName = addShaderName + '_' + __imageCounter;
                            
                            var addCached = __patternImageShaderCache[addPid];
                            var addShaderNode = addCached || api.create('imageShader', addShaderName);
                            if (addShaderNode && !addCached) {
                                var addMeta = __svgPatternMap[addPid] && __svgPatternMap[addPid].image;
                                var addTarget = (addMeta && addMeta.href) ? addMeta.href : null;
                                var addPatternContext = { attrs: { id: addShaderName } };
                                var addSaved = addTarget ? _resolveImageHrefToAsset(addTarget, addPatternContext) : null;
                                var addLinkVal = addSaved || addTarget;
                                if (addLinkVal) {
                                    var addAssetId = null;
                                    try { if (addSaved && api.loadAsset) addAssetId = api.loadAsset(addSaved, false); } catch (eLoad2) { addAssetId = null; }
                                    if (!addAssetId) { try { if (addSaved && api.importAsset) addAssetId = api.importAsset(addSaved); } catch (eImp2) { addAssetId = null; } }
                                    if (addAssetId) {
                                        try { api.connect(addAssetId, 'id', addShaderNode, 'image'); } catch (eConA2) {}
                                        var quiverGroup2 = _ensureQuiverAssetGroup();
                                        if (quiverGroup2 && api.parent) {
                                            try { api.parent(addAssetId, quiverGroup2); } catch (eParent2) {}
                                        }
                                    }
                                }
                                try { api.connect(addShaderNode, 'id', layerId, 'material.colorShaders'); } catch (eConn2) {}
                                try { if (!api.getParent(addShaderNode)) api.parent(addShaderNode, layerId); } catch (ePar2) {}
                                
                                // Set alpha on the additional image shader based on fill-opacity only (0-100 percentage)
                                try {
                                    var addImgAlphaPercent = Math.round(addFillOpacity * 100);
                                    api.set(addShaderNode, { 'alpha': addImgAlphaPercent });
                                    if (addImgAlphaPercent < 100) {
                                    }
                                } catch (eAddImgAlpha) {}
                                
                                // APPLY FULL IMAGE SHADER CONFIGURATION
                                try {
                                    try { if (_hasAttr(addShaderNode, 'legacyGraph')) api.set(addShaderNode, { 'legacyGraph': false }); } catch (eLG2) {}
                                    
                                    var addPatternData = __svgPatternMap[addPid];
                                    var addUseTransform = addPatternData && addPatternData.useTransform;
                                    var addIsObjectBoundingBox = addPatternData && addPatternData.attrs && addPatternData.attrs.patternContentUnits === 'objectBoundingBox';
                                    
                                    if (addUseTransform && addIsObjectBoundingBox) {
                                        var addSmSet = false;
                                        try { api.set(addShaderNode, { 'scaleMode': 0 }); addSmSet = true; } catch (eSM02) { addSmSet = false; }
                                        if (!addSmSet) { try { api.set(addShaderNode, { 'generator.scaleMode': 0 }); } catch (eSM0b2) {} }
                                        
                                        var addShapeW = 100, addShapeH = 100;
                                        try {
                                            var addBbox = api.getBoundingBox(layerId, true);
                                            if (addBbox) { addShapeW = addBbox.width || 100; addShapeH = addBbox.height || 100; }
                                        } catch (eBB2) {
                                            try {
                                                var addDims = api.get(layerId, 'generator.dimensions');
                                                if (addDims && addDims.length >= 2) { addShapeW = addDims[0] || 100; addShapeH = addDims[1] || 100; }
                                            } catch (eDims2) {}
                                        }
                                        
                                        var addImgMeta = addPatternData.image;
                                        var addImgW = parseFloat(addImgMeta && addImgMeta.width) || 100;
                                        var addImgH = parseFloat(addImgMeta && addImgMeta.height) || 100;
                                        
                                        var addCavScaleX = addUseTransform.a * addShapeW;
                                        var addCavScaleY = addUseTransform.d * addShapeH;
                                        _setFirstSupported(addShaderNode, ['scale','generator.scale'], [addCavScaleX, addCavScaleY]);
                                        
                                        var addVisibleW = addUseTransform.a * addImgW * addShapeW;
                                        var addVisibleH = addUseTransform.d * addImgH * addShapeH;
                                        var addImgCenterX = addUseTransform.e * addShapeW + addVisibleW / 2;
                                        var addImgCenterY = addUseTransform.f * addShapeH + addVisibleH / 2;
                                        var addCavOffsetX = addImgCenterX - addShapeW / 2;
                                        var addCavOffsetY = -(addImgCenterY - addShapeH / 2);
                                        _setFirstSupported(addShaderNode, ['offset','generator.offset'], [addCavOffsetX, addCavOffsetY]);
                                    } else {
                                        var addModes = [4,3,2,1];
                                        var addSetDone = false;
                                        for (var ami = 0; ami < addModes.length && !addSetDone; ami++) {
                                            try { api.set(addShaderNode, { 'scaleMode': addModes[ami] }); addSetDone = true; } catch (eSMA2) {}
                                            if (!addSetDone) { try { api.set(addShaderNode, { 'generator.scaleMode': addModes[ami] }); addSetDone = true; } catch (eSMB2) {} }
                                        }
                                        _setFirstSupported(addShaderNode, ['offset','generator.offset'], [0,0]);
                                    }
                                    
                                    try { api.set(addShaderNode, { 'tilingX': 3 }); } catch (eTX12) { try { api.set(addShaderNode, { 'generator.tilingX': 3 }); } catch (eTX22) {} }
                                    try { api.set(addShaderNode, { 'tilingY': 3 }); } catch (eTY12) { try { api.set(addShaderNode, { 'generator.tilingY': 3 }); } catch (eTY22) {} }
                                    
                                    var addFqOk = false;
                                    try { api.set(addShaderNode, { 'filterQuality': imageFilterQuality }); addFqOk = true; } catch (eFQ12) {}
                                    if (!addFqOk) { try { api.set(addShaderNode, { 'generator.filterQuality': imageFilterQuality }); } catch (eFQ22) {} }
                                } catch (eAddAlign) {
                                }
                                
                                __patternImageShaderCache[addPid] = addShaderNode;
                            } else if (addCached) {
                                try { api.connect(addCached, 'id', layerId, 'material.colorShaders'); } catch (eConnCached) {}
                            }
                        } catch (eAddPat) {
                        }
                    }
                } else if (addFillValue && addFillValue !== 'none') {
                    // SOLID COLOR fill: create a colorShader
                    try {
                        // Use clean name with fill number and color hex
                        var solidColorHexForName = parseColor(addFillValue) || '#000000';
                        var colorShaderName = 'Fill ' + (afi + 2) + ' ' + solidColorHexForName.toUpperCase();
                        var colorShaderId = api.create('colorShader', colorShaderName);
                        if (colorShaderId) {
                            // Parse the color to hex, then convert to RGB components
                            var solidColorHex = parseColor(addFillValue) || '#000000';
                            var hexClean = solidColorHex.replace('#', '');
                            var rVal = parseInt(hexClean.substring(0, 2), 16) || 0;
                            var gVal = parseInt(hexClean.substring(2, 4), 16) || 0;
                            var bVal = parseInt(hexClean.substring(4, 6), 16) || 0;
                            // Alpha is 0-255 based on fill-opacity
                            var aVal = Math.round(addEffectiveOpacity * 255);
                            
                            // Set shaderColor with RGBA (the correct attribute path!)
                            try { 
                                api.set(colorShaderId, { 
                                    'shaderColor.r': rVal,
                                    'shaderColor.g': gVal,
                                    'shaderColor.b': bVal,
                                    'shaderColor.a': aVal
                                }); 
                            } catch (eSetColor) {
                            }
                            
                            // Also set alpha attribute (0-100 percentage) for shader opacity
                            var alphaPercent = Math.round(addEffectiveOpacity * 100);
                            try { api.set(colorShaderId, { 'alpha': alphaPercent }); } catch (eA1) {}
                            
                            // Connect to shape's colorShaders
                            try { api.connect(colorShaderId, 'id', layerId, 'material.colorShaders'); } catch (eConnColor) {}
                            
                            // Parent under the shape
                            try { api.parent(colorShaderId, layerId); } catch (eParColor) {}
                            
                        }
                    } catch (eColorShader) {
                    }
                }
            }
        }

        // Stroke
        if (!stroke || stroke === 'none') {
            api.setStroke(layerId, false);
        } else {
            api.setStroke(layerId, true);
            var scolor = parseColor(stroke) || "#000000";
            var sw = parseFloat(('' + (strokeWidth || '1')).replace('px',''));
            if (isNaN(sw)) sw = 1;
            var so = parseOpacityValue(strokeOpacity); if (so === null) so = 1;
            var o2 = parseOpacityValue(opacity); if (o2 === null) o2 = 1;
            // Multiply by inherited opacity from parent groups
            var effA = clamp01(so * o2 * inheritedOpacity);
            if (strokeGradientId) {
                api.set(layerId, { "stroke.strokeColor": scolor, "stroke.strokeColor.a": 0, "stroke.width": sw, "stroke.alpha": Math.round(effA * 100) });
                var shStroke = getGradientShader(strokeGradientId);
                if (shStroke) {
                    // Calculate SVG center for stroke gradient offset calculation
                    // NOTE: Use local center for gradient offset (gradient coords are in local space)
                    var svgShapeCenterStroke = null;
                    try {
                        // Check for local center first (for rects with simple translate transforms)
                        if (attrs._localCenterX !== undefined && attrs._localCenterY !== undefined) {
                            svgShapeCenterStroke = { x: attrs._localCenterX, y: attrs._localCenterY };
                        } else if (attrs._transformedCenterX !== undefined && attrs._transformedCenterY !== undefined) {
                            svgShapeCenterStroke = { x: attrs._transformedCenterX, y: attrs._transformedCenterY };
                        } else if (attrs._pathSvgCenterX !== undefined && attrs._pathSvgCenterY !== undefined) {
                            svgShapeCenterStroke = { x: attrs._pathSvgCenterX, y: attrs._pathSvgCenterY };
                        } else if (attrs.x !== undefined && attrs.width !== undefined) {
                            var rectXS = parseFloat(attrs.x || '0');
                            var rectYS = parseFloat(attrs.y || '0');
                            var rectWS = parseFloat(attrs.width || '0');
                            var rectHS = parseFloat(attrs.height || '0');
                            svgShapeCenterStroke = { x: rectXS + rectWS / 2, y: rectYS + rectHS / 2 };
                        } else if (attrs.cx !== undefined && attrs.cy !== undefined) {
                            svgShapeCenterStroke = { x: parseFloat(attrs.cx), y: parseFloat(attrs.cy) };
                        }
                    } catch (eSvgCenterS) {}
                    connectShaderToStroke(shStroke, layerId, svgShapeCenterStroke);
                }
            } else {
                api.set(layerId, { "stroke.strokeColor": scolor, "stroke.width": sw, "stroke.alpha": Math.round(effA * 100) });
            }
            
            // Cap Style - Map SVG stroke-linecap to Cavalry capStyle enum
            if (strokeLinecap) {
                var capStyle = -1;
                switch (strokeLinecap.toLowerCase()) {
                    case 'butt':
                        capStyle = 0; // Flat
                        break;
                    case 'round':
                        capStyle = 1; // Round
                        break;
                    case 'square':
                        capStyle = 2; // Projecting
                        break;
                }
                if (capStyle >= 0) {
                    try { 
                        api.set(layerId, { 'stroke.capStyle': capStyle }); 
                        
                    } catch (eCap) {
                        
                    }
                }
            }
            
            // Join Style - Map SVG stroke-linejoin to Cavalry joinStyle enum
            if (strokeLinejoin) {
                var joinStyle = -1;
                switch (strokeLinejoin.toLowerCase()) {
                    case 'miter':
                        joinStyle = 0; // Mitre
                        break;
                    case 'round':
                        joinStyle = 1; // Round
                        break;
                    case 'bevel':
                        joinStyle = 2; // Bevel
                        break;
                }
                if (joinStyle >= 0) {
                    try { 
                        api.set(layerId, { 'stroke.joinStyle': joinStyle }); 
                        
                    } catch (eJoin) {
                        
                    }
                }
            }
            
            // Dashes (mode: Pixels) — use enum only to avoid parse errors
            try { api.set(layerId, { 'stroke.dashPatternMode': 0 }); } catch (eDM2) {}
            var csv = normalizeDashArrayToCsv(strokeDashArray);
            if (csv) {
                // Cavalry UI expects a CSV string (e.g., "4, 2") for dash pattern input
                try { api.set(layerId, { 'stroke.dashPattern': csv }); } catch (eDPs) {
                    // As a fallback, try touching the attribute then setting again
                    try { var cur = api.get(layerId, 'stroke.dashPattern'); } catch (eGetDP) {}
                    try { api.set(layerId, { 'stroke.dashPattern': csv }); } catch (eDPs2) {}
                }
                var doff = parseFloat(('' + (strokeDashOffset||'0')).replace('px',''));
                if (!isNaN(doff)) { try { api.set(layerId, { 'stroke.dashOffset': doff }); } catch (eDO) {} }
            }
            // Stroke alignment hint if discovered during pre-merge
            if (attrs && attrs._stroke_align) {
                var align = attrs._stroke_align; // 'inner' | 'outer'
                try {
                    // Prefer integer enum values if supported: 0=Centre, 1=Inner, 2=Outer
                    var enumVal = 0;
                    if (align === 'inner') enumVal = 1;
                    else if (align === 'outer') enumVal = 2;
                    api.set(layerId, {"stroke.align": enumVal});
                } catch (eAlign1) {
                    try {
                        // Fallback: set string label
                        var label = (align === 'inner') ? 'Inner' : (align === 'outer') ? 'Outer' : 'Centre';
                        api.set(layerId, {"stroke.align": label});
                    } catch (eAlign2) {}
                }
            }
        }
    } catch (e) {
        // ignore style errors
    }
}

// --- Create Cavalry layers ---
// Track created groups for potential ungrouping after import
var __importedGroupIds = [];

function resetImportedGroupIds() {
    __importedGroupIds = [];
}

function getImportedGroupIds() {
    return __importedGroupIds;
}

function createGroup(name, parentId) {
    var id = api.create('group', name);
    if (parentId) api.parent(id, parentId);
    // Track this group for potential ungrouping
    __importedGroupIds.push(id);
    return id;
}

// --- Path Parsing (M2) ---
function _readNumber(tokens, idxObj) {
    var v = parseFloat(tokens[idxObj.i++]);
    if (isNaN(v)) v = 0;
    return v;
}

function _tokenizePathData(d) {
    if (!d) return [];
    // Insert spaces around commands, replace commas with spaces
    var norm = d.replace(/,/g, ' ').replace(/([MmLlHhVvCcSsQqTtAaZz])/g, ' $1 ').trim();
    // Collapse multiple spaces
    norm = norm.replace(/\s+/g, ' ');
    return norm.split(' ');
}

function parsePathDataToAbsolute(d) {
    var tokens = _tokenizePathData(d);
    var iObj = {i:0};
    var segments = [];
    var cmd = null;
    var cx = 0, cy = 0; // current point
    var subx = 0, suby = 0; // current subpath start
    var prevCpx = null, prevCpy = null; // last control point for smooth
    var lastCmd = null;
    function readPoint(rel) {
        var x = _readNumber(tokens, iObj);
        var y = _readNumber(tokens, iObj);
        if (rel) { x += cx; y += cy; }
        return {x:x,y:y};
    }
    function reflect(px, py, cx0, cy0) {
        return {x: 2*cx0 - px, y: 2*cy0 - py};
    }
    while (iObj.i < tokens.length) {
        var t = tokens[iObj.i++];
        if (!t) break;
        if (/^[A-Za-z]$/.test(t)) { cmd = t; } else { iObj.i--; }
        if (!cmd) break;
        var isRel = (cmd === cmd.toLowerCase());
        switch (cmd.toUpperCase()) {
            case 'M': {
                var p = readPoint(isRel);
                segments.push({cmd:'M', x:p.x, y:p.y});
                cx = p.x; cy = p.y; subx = p.x; suby = p.y;
                // Subsequent pairs without explicit command are treated as L
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var p2 = readPoint(isRel);
                    segments.push({cmd:'L', x:p2.x, y:p2.y});
                    cx = p2.x; cy = p2.y;
                }
                prevCpx = prevCpy = null;
                lastCmd = 'M';
                break;
            }
            case 'L': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var p = readPoint(isRel);
                    segments.push({cmd:'L', x:p.x, y:p.y});
                    cx = p.x; cy = p.y;
                }
                prevCpx = prevCpy = null;
                lastCmd = 'L';
                break;
            }
            case 'H': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var x = _readNumber(tokens, iObj);
                    if (isRel) x += cx;
                    segments.push({cmd:'L', x:x, y:cy});
                    cx = x;
                }
                prevCpx = prevCpy = null;
                lastCmd = 'H';
                break;
            }
            case 'V': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var y = _readNumber(tokens, iObj);
                    if (isRel) y += cy;
                    segments.push({cmd:'L', x:cx, y:y});
                    cy = y;
                }
                prevCpx = prevCpy = null;
                lastCmd = 'V';
                break;
            }
            case 'C': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var cp1 = readPoint(isRel);
                    var cp2 = readPoint(isRel);
                    var p = readPoint(isRel);
                    segments.push({cmd:'C', cp1x:cp1.x, cp1y:cp1.y, cp2x:cp2.x, cp2y:cp2.y, x:p.x, y:p.y});
                    prevCpx = cp2.x; prevCpy = cp2.y;
                    cx = p.x; cy = p.y;
                }
                lastCmd = 'C';
                break;
            }
            case 'S': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var cp1x, cp1y;
                    if (lastCmd === 'C' || lastCmd === 'S') {
                        var refl = reflect(prevCpx==null?cx:prevCpx, prevCpy==null?cy:prevCpy, cx, cy);
                        cp1x = refl.x; cp1y = refl.y;
                    } else {
                        cp1x = cx; cp1y = cy;
                    }
                    var cp2 = readPoint(isRel);
                    var p = readPoint(isRel);
                    segments.push({cmd:'C', cp1x:cp1x, cp1y:cp1y, cp2x:cp2.x, cp2y:cp2.y, x:p.x, y:p.y});
                    prevCpx = cp2.x; prevCpy = cp2.y;
                    cx = p.x; cy = p.y;
                }
                lastCmd = 'S';
                break;
            }
            case 'Q': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var cp = readPoint(isRel);
                    var p = readPoint(isRel);
                    segments.push({cmd:'Q', cpx:cp.x, cpy:cp.y, x:p.x, y:p.y});
                    prevCpx = cp.x; prevCpy = cp.y;
                    cx = p.x; cy = p.y;
                }
                lastCmd = 'Q';
                break;
            }
            case 'T': {
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var cpxT, cpyT;
                    if (lastCmd === 'Q' || lastCmd === 'T') {
                        var r = reflect(prevCpx==null?cx:prevCpx, prevCpy==null?cy:prevCpy, cx, cy);
                        cpxT = r.x; cpyT = r.y;
                    } else {
                        cpxT = cx; cpyT = cy;
                    }
                    var p = readPoint(isRel);
                    segments.push({cmd:'Q', cpx:cpxT, cpy:cpyT, x:p.x, y:p.y});
                    prevCpx = cpxT; prevCpy = cpyT;
                    cx = p.x; cy = p.y;
                }
                lastCmd = 'T';
                break;
            }
            case 'A': {
                // Consume 7 parameters per arc; multiple arcs possible
                while (iObj.i < tokens.length && !/^[A-Za-z]$/.test(tokens[iObj.i])) {
                    var rx = _readNumber(tokens, iObj); var ry = _readNumber(tokens, iObj);
                    var xAxisRot = _readNumber(tokens, iObj);
                    var largeArc = _readNumber(tokens, iObj); var sweep = _readNumber(tokens, iObj);
                    var x = _readNumber(tokens, iObj); var y = _readNumber(tokens, iObj);
                    if (isRel) { x += cx; y += cy; }
                    segments.push({cmd:'A', rx:rx, ry:ry, phi:xAxisRot, large:!!largeArc, sweep:!!sweep, x:x, y:y});
                    cx = x; cy = y;
                }
                prevCpx = prevCpy = null;
                lastCmd = 'A';
                break;
            }
            case 'Z': {
                segments.push({cmd:'Z'});
                cx = subx; cy = suby;
                prevCpx = prevCpy = null;
                lastCmd = 'Z';
                break;
            }
            default: {
                // Unknown; break loop
                iObj.i = tokens.length;
                break;
            }
        }
    }
    return segments;
}

function createEditableFromPathSegments(segments, nodeName, parentId, vb, translate, attrs) {
    var path = new cavalry.Path();
    function cvt(pt) {
        var px = pt.x + (translate ? translate.x : 0);
        var py = pt.y + (translate ? translate.y : 0);
        return svgToCavalryPosition(px, py, vb);
    }
    function arcToCubics(cx0, cy0, rx, ry, phiDeg, largeArc, sweep, x1, y1) {
        // Implementation adapted from SVG spec (F.6.5) to cubics
        var phi = (phiDeg || 0) * Math.PI / 180;
        var cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
        // Step 1: Compute (x1', y1')
        var dx2 = (cx0 - x1) / 2.0;
        var dy2 = (cy0 - y1) / 2.0;
        var x1p = cosPhi * dx2 + sinPhi * dy2;
        var y1p = -sinPhi * dx2 + cosPhi * dy2;
        rx = Math.abs(rx); ry = Math.abs(ry);
        // Ensure radii large enough
        var lam = (x1p*x1p)/(rx*rx) + (y1p*y1p)/(ry*ry);
        if (lam > 1) { var s = Math.sqrt(lam); rx *= s; ry *= s; }
        // Step 2: Compute (cx', cy')
        var sign = (largeArc === sweep) ? -1 : 1;
        var rx2 = rx*rx, ry2 = ry*ry;
        var num = rx2*ry2 - rx2*y1p*y1p - ry2*x1p*x1p;
        var den = rx2*y1p*y1p + ry2*x1p*x1p;
        var coef = (den === 0) ? 0 : sign * Math.sqrt(Math.max(0, num/den));
        var cxp = coef * (rx * y1p) / ry;
        var cyp = coef * -(ry * x1p) / rx;
        // Step 3: Compute (cx, cy)
        var cx = cosPhi * cxp - sinPhi * cyp + (cx0 + x1)/2;
        var cy = sinPhi * cxp + cosPhi * cyp + (cy0 + y1)/2;
        function angle(u, v) {
            var dot = u.x*v.x + u.y*v.y;
            var len = Math.sqrt(u.x*u.x + u.y*u.y) * Math.sqrt(v.x*v.x + v.y*v.y);
            var ang = Math.acos(Math.max(-1, Math.min(1, dot/len)));
            if ((u.x*v.y - u.y*v.x) < 0) ang = -ang;
            return ang;
        }
        var v1 = {x:(x1p - cxp)/rx, y:(y1p - cyp)/ry};
        var v2 = {x:(-x1p - cxp)/rx, y:(-y1p - cyp)/ry};
        var theta1 = angle({x:1, y:0}, v1);
        var delta = angle(v1, v2);
        if (!sweep && delta > 0) delta -= 2*Math.PI;
        if (sweep && delta < 0) delta += 2*Math.PI;
        // Approximate arc via cubic Beziers in segments of <= 90°
        var segs = Math.ceil(Math.abs(delta) / (Math.PI/2));
        var deltaSeg = delta / segs;
        var res = [];
        for (var i = 0; i < segs; i++) {
            var t1 = theta1 + i*deltaSeg;
            var t2 = t1 + deltaSeg;
            var cosT1 = Math.cos(t1), sinT1 = Math.sin(t1);
            var cosT2 = Math.cos(t2), sinT2 = Math.sin(t2);
            var e1x = cx + (cosPhi*rx*cosT1 - sinPhi*ry*sinT1);
            var e1y = cy + (sinPhi*rx*cosT1 + cosPhi*ry*sinT1);
            var e2x = cx + (cosPhi*rx*cosT2 - sinPhi*ry*sinT2);
            var e2y = cy + (sinPhi*rx*cosT2 + cosPhi*ry*sinT2);
            var alpha = (4/3) * Math.tan((t2 - t1)/4);
            var c1x = e1x - alpha*(cosPhi*rx*sinT1 + sinPhi*ry*cosT1);
            var c1y = e1y - alpha*(sinPhi*rx*sinT1 - cosPhi*ry*cosT1);
            var c2x = e2x + alpha*(cosPhi*rx*sinT2 + sinPhi*ry*cosT2);
            var c2y = e2y + alpha*(sinPhi*rx*sinT2 - cosPhi*ry*cosT2);
            res.push({c1x:c1x, c1y:c1y, c2x:c2x, c2y:c2y, ex:e2x, ey:e2y});
        }
        return res;
    }
    for (var i = 0; i < segments.length; i++) {
        var s = segments[i];
        if (s.cmd === 'M') {
            var p0 = cvt({x:s.x, y:s.y});
            path.moveTo(p0.x, p0.y);
        } else if (s.cmd === 'L') {
            var p1 = cvt({x:s.x, y:s.y});
            path.lineTo(p1.x, p1.y);
        } else if (s.cmd === 'C') {
            var c1 = cvt({x:s.cp1x, y:s.cp1y});
            var c2 = cvt({x:s.cp2x, y:s.cp2y});
            var pe = cvt({x:s.x, y:s.y});
            path.cubicTo(c1.x, c1.y, c2.x, c2.y, pe.x, pe.y);
        } else if (s.cmd === 'Q') {
            var cq = cvt({x:s.cpx, y:s.cpy});
            var pe2 = cvt({x:s.x, y:s.y});
            path.quadTo(cq.x, cq.y, pe2.x, pe2.y);
        } else if (s.cmd === 'A') {
            // Convert arcs to sequence of cubics
            var prev = null;
            // Find previous end point as arc start (current path end)
            try {
                var bbPeek = path.boundingBox();
                // This is not start; we need the last commanded point; track separately below
            } catch (e) {}
            // Track last drawn point manually
            // We can reconstruct from last move/line/cubic/quad operations. Keep a running cursor.
            // For simplicity, walk backwards to find last absolute point in built segments
            var cxCur = null, cyCur = null;
            for (var j = i-1; j >= 0; j--) {
                var pj = segments[j];
                if (pj.cmd === 'M' || pj.cmd === 'L' || pj.cmd === 'C' || pj.cmd === 'Q') { cxCur = pj.x; cyCur = pj.y; break; }
            }
            if (cxCur === null) { cxCur = s.x; cyCur = s.y; }
            var cubs = arcToCubics(cxCur, cyCur, s.rx, s.ry, s.phi, s.large, s.sweep, s.x, s.y);
            for (var ci = 0; ci < cubs.length; ci++) {
                var cc1 = cvt({x:cubs[ci].c1x, y:cubs[ci].c1y});
                var cc2 = cvt({x:cubs[ci].c2x, y:cubs[ci].c2y});
                var ee = cvt({x:cubs[ci].ex, y:cubs[ci].ey});
                path.cubicTo(cc1.x, cc1.y, cc2.x, cc2.y, ee.x, ee.y);
            }
        } else if (s.cmd === 'Z') {
            path.close();
        }
    }
    // Rebase geometry so its centre sits at (0,0), then place the layer at the centre
    var centre = null;
    try {
        var bb = path.boundingBox();
        if (bb && bb.centre) centre = {x: bb.centre.x, y: bb.centre.y};
    } catch (eBB) {}
    if (centre) {
        path.translate(-centre.x, -centre.y);
    }
    var id = api.createEditable(path, nodeName || 'Path');
    if (parentId) api.parent(id, parentId);
    if (centre) {
        api.set(id, {"position.x": centre.x, "position.y": centre.y});
    }
    
    // Calculate SVG bounding box center from original segments for gradient offset calculation
    // This is done BEFORE coordinate conversion so we have accurate SVG coordinates
    if (attrs && segments && segments.length > 0) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var si = 0; si < segments.length; si++) {
            var seg = segments[si];
            // Include main point
            if (seg.x !== undefined && seg.y !== undefined) {
                var px = seg.x + (translate ? translate.x : 0);
                var py = seg.y + (translate ? translate.y : 0);
                if (px < minX) minX = px;
                if (py < minY) minY = py;
                if (px > maxX) maxX = px;
                if (py > maxY) maxY = py;
            }
            // Include control points for curves
            if (seg.cp1x !== undefined && seg.cp1y !== undefined) {
                var cp1x = seg.cp1x + (translate ? translate.x : 0);
                var cp1y = seg.cp1y + (translate ? translate.y : 0);
                if (cp1x < minX) minX = cp1x;
                if (cp1y < minY) minY = cp1y;
                if (cp1x > maxX) maxX = cp1x;
                if (cp1y > maxY) maxY = cp1y;
            }
            if (seg.cp2x !== undefined && seg.cp2y !== undefined) {
                var cp2x = seg.cp2x + (translate ? translate.x : 0);
                var cp2y = seg.cp2y + (translate ? translate.y : 0);
                if (cp2x < minX) minX = cp2x;
                if (cp2y < minY) minY = cp2y;
                if (cp2x > maxX) maxX = cp2x;
                if (cp2y > maxY) maxY = cp2y;
            }
            if (seg.cpx !== undefined && seg.cpy !== undefined) {
                var cpx = seg.cpx + (translate ? translate.x : 0);
                var cpy = seg.cpy + (translate ? translate.y : 0);
                if (cpx < minX) minX = cpx;
                if (cpy < minY) minY = cpy;
                if (cpx > maxX) maxX = cpx;
                if (cpy > maxY) maxY = cpy;
            }
        }
        // Store SVG center in attrs for gradient offset calculation
        if (minX !== Infinity && maxX !== -Infinity) {
            attrs._pathSvgCenterX = (minX + maxX) / 2;
            attrs._pathSvgCenterY = (minY + maxY) / 2;
        }
    }
    
    if (attrs) {
        applyFillAndStroke(id, attrs);
        applyBlendMode(id, attrs);
    }
    try { __createdPathLayers.push({ id: id, parent: parentId }); } catch (eReg) {}
    return id;
}

function createSVGFallbackLayer(node, parentId, vb, translate) {
    // Current Cavalry API does not accept inline SVG data via script for SVG nodes.
    // Create a named placeholder group to preserve hierarchy without triggering errors.
    var wrapName = node.name || node.type;
    var pid = createGroup(wrapName, parentId);
    if (translate && (translate.x !== 0 || translate.y !== 0)) {
        var zero = svgToCavalryPosition(0, 0, vb);
        var moved = svgToCavalryPosition(translate.x, translate.y, vb);
        api.set(pid, {"position.x": moved.x - zero.x, "position.y": moved.y - zero.y});
    }

    return pid;
}


// ----------------------------------------
// quiver_utilities_shapes.js
// ----------------------------------------
function createRect(node, parentId, vb) {
    var x = parseFloat(node.attrs.x || '0');
    var y = parseFloat(node.attrs.y || '0');
    var w = parseFloat(node.attrs.width || '0');
    var h = parseFloat(node.attrs.height || '0');
    
    // Apply translate transform if present (e.g., transform="translate(970)")
    var translateOffset = parseTranslate(node.attrs && node.attrs.transform || '');
    x += translateOffset.x;
    y += translateOffset.y;
    
    // Detect background rectangle: matches viewBox dimensions at origin with generic name
    // This auto-names full-frame rects as "Background" for convenience
    // NOTE: The hybrid processing conflict was fixed by improving mightGetStrokeFlattened()
    // to skip simple closed shapes (like radio button circles) with INSIDE-aligned strokes
    var isBackgroundRect = false;
    if (vb && vb.width && vb.height) {
        var matchesViewBox = (Math.abs(w - vb.width) < 0.1 && Math.abs(h - vb.height) < 0.1);
        var atOrigin = (Math.abs(x) < 0.1 && Math.abs(y) < 0.1);
        var hasGenericName = !node.name || node.name === 'rect' || node.name === 'rectangle';
        isBackgroundRect = matchesViewBox && atOrigin && hasGenericName;
    }
    
    var name = node.name || 'rectangle';
    if (isBackgroundRect) {
        name = 'Background';
    }
    
    var id = api.primitive('rectangle', name);
    if (parentId) api.parent(id, parentId);
    var rx = node.attrs.rx ? parseFloat(node.attrs.rx) : 0;
    var ry = node.attrs.ry ? parseFloat(node.attrs.ry) : 0;
    var rxv = isNaN(rx) ? 0 : rx;
    var ryv = isNaN(ry) ? 0 : ry;
    // If ry is not provided, SVG uses rx for both
    var ryEff = (node.attrs.ry !== undefined) ? ryv : rxv;
    // Detect ellipse-equivalent rounded rect: rx≈w/2 AND ry≈h/2 (within tolerance)
    var tol = 0.05; // allow up to 5% slack from perfect half-dimensions
    var halfW = w/2, halfH = h/2;
    var ratioX = (halfW>0)? (Math.min(rxv, halfW) / halfW) : 0;
    var ratioY = (halfH>0)? (Math.min(ryEff, halfH) / halfH) : 0;
    if ((isFinite(ratioX) && isFinite(ratioY)) && (ratioX >= 1 - tol && ratioY >= 1 - tol)) {
        // Build ellipse primitive instead for cleaner, editable geometry
        try { api.deleteLayer(id); } catch (eDelRect) {}
        var ellipseNode = { name: name.replace(/^rect$/,'ellipse'), attrs: {} };
        ellipseNode.attrs.cx = x + halfW;
        ellipseNode.attrs.cy = y + halfH;
        ellipseNode.attrs.rx = halfW;
        ellipseNode.attrs.ry = halfH;
        // carry styles/transform, including our precomputed stroke alignment hint and internal tracking
        var styleKeys = [
            'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'opacity', 
            'transform', '_stroke_align', 'mix-blend-mode', 'filter',
            // Internal tracking attributes
            '_additionalFills', '_inheritedFilterId', '_inheritedMaskIds', 'data-figma-bg-blur-radius'
        ];
        for (var si = 0; si < styleKeys.length; si++) {
            var k = styleKeys[si];
            if (node.attrs[k] !== undefined) ellipseNode.attrs[k] = node.attrs[k];
        }
        return createEllipse(ellipseNode, parentId, vb);
    }
    var rCorner = (rxv && ryv) ? Math.min(rxv, ryv) : (rxv || ryv || 0);
    var cr = Math.max(0, Math.min(rCorner, Math.min(w, h) / 2));

    // Use transformed center if available (from matrix transform), otherwise calculate from x,y
    var centre;
    if (node.attrs._transformedCenterX !== undefined && node.attrs._transformedCenterY !== undefined) {
        centre = svgToCavalryPosition(node.attrs._transformedCenterX, node.attrs._transformedCenterY, vb);
    } else {
        centre = svgToCavalryPosition(x + w/2, y + h/2, vb);
    }
    
    api.set(id, {
        "generator.dimensions": [w, h],
        "position.x": centre.x,
        "position.y": centre.y
    });
    if (cr > 0) api.set(id, {"generator.cornerRadius": cr});
    
    // Apply rotation from matrix transform if present
    // SVG rotation is clockwise, Cavalry is counter-clockwise, so negate
    if (node.attrs._rotationDeg !== undefined && node.attrs._rotationDeg !== 0) {
        var cavalryRotation = -node.attrs._rotationDeg;
        try {
            api.set(id, { "rotation": cavalryRotation });
        } catch (eRot) {
        }
    }

    applyFillAndStroke(id, node.attrs);
    applyBlendMode(id, node.attrs);
    // Note: Gradient hookup is handled inside applyFillAndStroke - no duplicate connection needed
    // Compensate position when rotate(a cx cy) is used: rotate the centre around (cx,cy) and set position
    try {
        var rotPivot = parseRotatePivot(node.attrs && node.attrs.transform || '');
        if (rotPivot && rotPivot.cx !== null && rotPivot.cy !== null) {
            var newCenterSvg = rotatePointAround(x + w/2, y + h/2, rotPivot.angle, rotPivot.cx, rotPivot.cy);
            var newPos = svgToCavalryPosition(newCenterSvg.x, newCenterSvg.y, vb);
            api.set(id, {"position.x": newPos.x, "position.y": newPos.y});
        }
    } catch (eP) {}
    return id;
}

function createCircle(node, parentId, vb) {
    var name = node.name || 'circle';
    var id = api.primitive('ellipse', name);
    if (parentId) api.parent(id, parentId);
    var cx = parseFloat(node.attrs.cx || '0');
    var cy = parseFloat(node.attrs.cy || '0');
    var r = parseFloat(node.attrs.r || '0');
    
    // Apply translate transform if present
    var translateOffset = parseTranslate(node.attrs && node.attrs.transform || '');
    cx += translateOffset.x;
    cy += translateOffset.y;
    
    api.set(id, {
        "generator.radius": [r, r]
    });
    var pos = svgToCavalryPosition(cx, cy, vb);
    api.set(id, {"position.x": pos.x, "position.y": pos.y});
    applyFillAndStroke(id, node.attrs);
    applyBlendMode(id, node.attrs);
    // Note: Gradient hookup is handled inside applyFillAndStroke - no duplicate connection needed
    // rotate(cx,cy) compensation: move position to rotated centre
    try {
        var rotPivotC = parseRotatePivot(node.attrs && node.attrs.transform || '');
        if (rotPivotC && rotPivotC.cx !== null && rotPivotC.cy !== null) {
            var newCenterSvgC = rotatePointAround(cx, cy, rotPivotC.angle, rotPivotC.cx, rotPivotC.cy);
            var newPosC = svgToCavalryPosition(newCenterSvgC.x, newCenterSvgC.y, vb);
            api.set(id, {"position.x": newPosC.x, "position.y": newPosC.y});
        }
    } catch (ePc) {}
    return id;
}

function createEllipse(node, parentId, vb) {
    var name = node.name || 'ellipse';
    var id = api.primitive('ellipse', name);
    if (parentId) api.parent(id, parentId);
    var cx = parseFloat(node.attrs.cx || '0');
    var cy = parseFloat(node.attrs.cy || '0');
    var rx = parseFloat(node.attrs.rx || '0');
    var ry = parseFloat(node.attrs.ry || '0');
    
    // Apply translate transform if present (only if transform still exists)
    var translateOffset = parseTranslate(node.attrs && node.attrs.transform || '');
    cx += translateOffset.x;
    cy += translateOffset.y;
    
    api.set(id, {
        "generator.radius": [rx, ry]
    });
    var pos = svgToCavalryPosition(cx, cy, vb);
    api.set(id, {"position.x": pos.x, "position.y": pos.y});
    applyFillAndStroke(id, node.attrs);
    applyBlendMode(id, node.attrs);
    // Note: Gradient hookup is handled inside applyFillAndStroke - no duplicate connection needed
    
    // Apply rotation from matrix transform (stored as _rotationDeg during pre-processing)
    try {
        if (node.attrs._rotationDeg !== undefined && Math.abs(node.attrs._rotationDeg) > 0.0001) {
            api.set(id, {"rotation": -node.attrs._rotationDeg});
        }
    } catch (eRotE) {}
    
    // rotate(cx,cy) compensation for explicit rotate() transforms
    try {
        var rotPivotE = parseRotatePivot(node.attrs && node.attrs.transform || '');
        if (rotPivotE && rotPivotE.cx !== null && rotPivotE.cy !== null) {
            var newCenterSvgE = rotatePointAround(cx, cy, rotPivotE.angle, rotPivotE.cx, rotPivotE.cy);
            var newPosE = svgToCavalryPosition(newCenterSvgE.x, newCenterSvgE.y, vb);
            api.set(id, {"position.x": newPosE.x, "position.y": newPosE.y});
        }
    } catch (ePe) {}
    return id;
}



// --- Polygon/Star detection and primitive creation ---
function parsePoints(pointsStr) {
    if (!pointsStr) return [];
    var pairs = pointsStr.trim().split(/\s+/);
    var pts = [];
    for (var i = 0; i < pairs.length; i++) {
        var pr = pairs[i].split(',');
        if (pr.length < 2) continue;
        var x = parseFloat(pr[0]);
        var y = parseFloat(pr[1]);
        if (!isNaN(x) && !isNaN(y)) pts.push({x:x,y:y});
    }
    return pts;
}

function computeCentroid(points) {
    var sx = 0, sy = 0;
    for (var i = 0; i < points.length; i++) { sx += points[i].x; sy += points[i].y; }
    return {x: sx / points.length, y: sy / points.length};
}

function analyzePolygon(points) {
    // Determine radii and angles relative to centroid
    var c = computeCentroid(points);
    var radii = [];
    var angles = [];
    for (var i = 0; i < points.length; i++) {
        var dx = points[i].x - c.x;
        var dy = points[i].y - c.y;
        var r = Math.hypot(dx, dy);
        var a = Math.atan2(-dy, dx); // SVG y-down to y-up angle
        radii.push(r);
        angles.push(a);
    }
    // Normalize angles to 0..2pi and sort by angle
    var idx = angles.map(function(a,i){return {i:i,a:((a% (2*Math.PI))+2*Math.PI)%(2*Math.PI)};});
    idx.sort(function(u,v){return u.a - v.a;});
    var sortedR = idx.map(function(o){return radii[o.i];});
    // Check alternating radii pattern (star) or near-constant radius (regular polygon)
    var n = points.length;
    if (n < 3) return {type:'unknown'};
    var mean = sortedR.reduce(function(a,b){return a+b;},0)/n;
    var dev = Math.sqrt(sortedR.reduce(function(a,b){return a + (b-mean)*(b-mean);},0)/n);
    var relDev = dev / mean;
    // Heuristic thresholds
    if (relDev < 0.05) {
        return {type:'regularPolygon', centroid:c, outerRadius:mean, sides:n};
    }
    // Try star: two clusters alternating
    var even = [], odd = [];
    for (var k = 0; k < n; k++) { (k%2===0?even:odd).push(sortedR[k]); }
    if (even.length > 0 && odd.length > 0) {
        var me = even.reduce(function(a,b){return a+b;},0)/even.length;
        var mo = odd.reduce(function(a,b){return a+b;},0)/odd.length;
        var devE = Math.sqrt(even.reduce(function(a,b){return a + (b-me)*(b-me);},0)/even.length);
        var devO = Math.sqrt(odd.reduce(function(a,b){return a + (b-mo)*(b-mo);},0)/odd.length);
        if (Math.abs(me - mo) / mean > 0.2 && (devE/me) < 0.1 && (devO/mo) < 0.1) {
            return {type:'star', centroid:c, outerRadius:Math.max(me, mo), innerRadius:Math.min(me, mo), points:n/2};
        }
    }
    return {type:'unknown'};
}

function createRegularPolygonPrimitive(name, points, parentId, vb, translate, attrs) {
    var analysis = analyzePolygon(points);
    if (analysis.type === 'unknown') return null;
    if (analysis.type === 'regularPolygon' && analysis.sides >= 3) {
        var id = api.primitive('polygon', name || 'Polygon');
        if (parentId) api.parent(id, parentId);
        // Dimensions: use diameter; some Cavalry versions expect radius via generator.radius or sides via generator.sides
        try { api.set(id, {"generator.sides": analysis.sides}); } catch (eSides) {}
        try { api.set(id, {"generator.radius": analysis.outerRadius}); } catch (eRad) {
            try { api.set(id, {"generator.dimensions": [analysis.outerRadius*2, analysis.outerRadius*2]}); } catch (eDim) {}
        }
        var pos = svgToCavalryPosition(analysis.centroid.x + (translate?translate.x:0), analysis.centroid.y + (translate?translate.y:0), vb);
        api.set(id, {"position.x": pos.x, "position.y": pos.y});
        if (attrs) applyFillAndStroke(id, attrs);
        return id;
    }
    if (analysis.type === 'star' && analysis.points >= 3) {
        var id2 = api.primitive('star', name || 'Star');
        if (parentId) api.parent(id2, parentId);
        try { api.set(id2, {"generator.points": Math.round(analysis.points)}); } catch (ePts) {}
        try { api.set(id2, {"generator.innerRadius": analysis.innerRadius}); } catch (eIn) {}
        try { api.set(id2, {"generator.outerRadius": analysis.outerRadius}); } catch (eOut) {}
        var pos2 = svgToCavalryPosition(analysis.centroid.x + (translate?translate.x:0), analysis.centroid.y + (translate?translate.y:0), vb);
        api.set(id2, {"position.x": pos2.x, "position.y": pos2.y});
        if (attrs) applyFillAndStroke(id2, attrs);
        return id2;
    }
    return null;
}


// ----------------------------------------
// quiver_utilities_text.js
// ----------------------------------------
// Parse font family with embedded variant (Affinity SVG format)
// e.g., 'CanvaSansDisplay-Medium' -> { family: 'Canva Sans Display', variant: 'Medium' }
// e.g., 'Arial-ItalicMT' -> { family: 'Arial', variant: 'Italic' }
function parseFontFamilyVariant(fontFamilyStr) {
    if (!fontFamilyStr) return null;
    
    // Remove quotes and trim
    var cleaned = fontFamilyStr.replace(/["']/g, '').trim();
    
    // Check if there's a hyphen separator
    var hyphenIndex = cleaned.lastIndexOf('-');
    if (hyphenIndex === -1) return null; // No variant embedded
    
    var baseName = cleaned.substring(0, hyphenIndex);
    var variant = cleaned.substring(hyphenIndex + 1);
    
    // Map common Affinity font variant suffixes to Cavalry styles
    var variantMap = {
        // Weight variants
        'Thin': 'Thin',
        'UltraLight': 'Thin',
        'ExtraLight': 'Light',
        'Light': 'Light',
        'Regular': 'Regular',
        'Medium': 'Medium',
        'SemiBold': 'SemiBold',
        'Semibold': 'SemiBold',
        'DemiBold': 'SemiBold',
        'Bold': 'Bold',
        'ExtraBold': 'ExtraBold',
        'UltraBold': 'ExtraBold',
        'Black': 'Black',
        'Heavy': 'Black',
        
        // Italic variants
        'Italic': 'Italic',
        'ItalicMT': 'Italic',
        'It': 'Italic',
        'Oblique': 'Italic',
        
        // Combined variants
        'BoldItalic': 'Bold Italic',
        'BoldItalicMT': 'Bold Italic',
        'MediumItalic': 'Medium Italic',
        'SemiBoldItalic': 'SemiBold Italic',
        'LightItalic': 'Light Italic',
        'BlackItalic': 'Black Italic'
    };
    
    var mappedVariant = variantMap[variant];
    if (!mappedVariant) {
        // If no exact match, check if it ends with 'MT' (common Apple font suffix without variant info)
        if (variant === 'MT' || variant.match(/^MT$/)) {
            // Just 'MT' suffix (e.g., ArialMT) - remove it and use base name
            var spacedName = baseName.replace(/([a-z])([A-Z])/g, '$1 $2');
            return {
                family: spacedName,
                variant: 'Regular'
            };
        }
        return null; // No recognized variant
    }
    
    // Convert base name from CamelCase to spaced name
    // e.g., 'CanvaSansDisplay' -> 'Canva Sans Display'
    var spacedName = baseName.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return {
        family: spacedName,
        variant: mappedVariant
    };
}

/**
 * Replace emoji characters with a placeholder for Cavalry text rendering.
 * Cavalry doesn't render emoji glyphs, so we need characters that create geometry
 * for Get Sub-Mesh Transform to query. Using the emojiPlaceholder setting (default: [e])
 * ensures it's counted as a "word" and matches what Apply Text Material will hide.
 * 
 * Also builds an index mapping from original emoji positions to new positions,
 * since multi-codepoint emojis become single characters and shift indices.
 * 
 * The emoji images will overlay these positions, and Apply Text Material will hide them.
 * 
 * If importEmojisEnabled is false, emojis are completely removed from the text
 * (no placeholder, no image overlay) to avoid affecting Apply Typeface indices.
 * 
 * @param {string} text - The text string that may contain emojis
 * @returns {Object} - {text: modified string, indexMap: {originalIndex -> newIndex}}
 */
function replaceEmojisWithPlaceholder(text) {
    if (!text) return { text: text, indexMap: {}, emojisStripped: false, matches: [] };
    
    // Check if emoji import is disabled - if so, completely remove emojis from text
    var emojisDisabled = (typeof importEmojisEnabled !== 'undefined' && !importEmojisEnabled);
    
    // Comprehensive emoji regex pattern matching:
    // - Emoji presentation sequences
    // - Skin tone modifiers  
    // - ZWJ sequences (family, flags, etc.)
    // - Regional indicators (flags)
    // - Various emoji ranges
    var emojiPattern = /(?:\u{1F3F4}(?:\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F})?|[\u{1F1E0}-\u{1F1FF}]{2}|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}])(?:\u{FE0F})?(?:\u{200D}(?:\u{1F3F4}(?:\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F})?|[\u{1F1E0}-\u{1F1FF}]{2}|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])(?:\u{FE0F})?)*/gu;
    
    // Placeholder for emoji positions - must be recognized as a "word" by Cavalry
    // Using the global emojiPlaceholder setting (default: [e]) for consistency with Apply Text Material
    // The placeholder must match what the regex in quiver_utilities_webserver.js looks for
    // Placeholder must be exactly 3 characters for font style logic to work correctly
    // When emojis are disabled, we use no placeholder (length 0) - just strip them
    var placeholder = emojisDisabled ? '' : ((typeof emojiPlaceholder !== 'undefined' && emojiPlaceholder.length === 3) ? emojiPlaceholder : '[e]');
    var placeholderLength = placeholder.length;
    
    // Build index mapping: track how indices shift after replacement
    var indexMap = {};
    var matches = [];
    var match;
    
    // Find all emoji matches with their positions and lengths
    while ((match = emojiPattern.exec(text)) !== null) {
        matches.push({
            originalIndex: match.index,
            originalLength: match[0].length,
            emoji: match[0]
        });
    }
    
    // When emojis are disabled, we just need to track the matches for index adjustment
    // No spaces are added - emojis are simply removed
    // When emojis are enabled, we add spaces around placeholders for word-level positioning
    if (!emojisDisabled) {
        // Determine which spaces need to be added around each emoji
        // Each emoji placeholder must be its own "word" for word-level positioning
        // We need spaces BEFORE and AFTER each em-dash placeholder
        // 
        // IMPORTANT: For consecutive emojis, we only insert ONE space between them
        // (either as "after" for the first or "before" for the second, not both)
        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            m.needsSpaceBefore = false;
            m.needsSpaceAfter = false;
            
            // Check if we need a space BEFORE this emoji
            // But first check if the previous emoji already has a space AFTER it
            // (in which case we don't need a space before this one)
            var prevEmoji = (i > 0) ? matches[i - 1] : null;
            var prevEmojiEnd = prevEmoji ? (prevEmoji.originalIndex + prevEmoji.originalLength) : -1;
            
            if (m.originalIndex > 0) {
                // If this emoji immediately follows the previous one, check if prev has spaceAfter
                if (prevEmoji && prevEmojiEnd === m.originalIndex && prevEmoji.needsSpaceAfter) {
                    // Previous emoji already inserted space after - we don't need space before
                    m.needsSpaceBefore = false;
                } else {
                    var charBefore = text.charAt(m.originalIndex - 1);
                    // If the previous character is not whitespace, we need a space
                    if (charBefore !== ' ' && charBefore !== '\t' && charBefore !== '\n' && charBefore !== '\r') {
                        m.needsSpaceBefore = true;
                    }
                }
            }
            
            // Check if we need a space AFTER this emoji
            var endIndex = m.originalIndex + m.originalLength;
            if (endIndex < text.length) {
                var charAfter = text.charAt(endIndex);
                // If the next character is not whitespace, we need a space
                if (charAfter !== ' ' && charAfter !== '\t' && charAfter !== '\n' && charAfter !== '\r') {
                    m.needsSpaceAfter = true;
                }
            }
        }
    } else {
        // When disabled, no spaces are added
        for (var i = 0; i < matches.length; i++) {
            matches[i].needsSpaceBefore = false;
            matches[i].needsSpaceAfter = false;
        }
    }
    
    // Calculate new indices accounting for:
    // - Emoji length reduction (emoji -> placeholder or removed entirely)
    // - Added spaces before/after each emoji (when enabled)
    // 
    // Track the net offset: positive = text grew, negative = text shrank
    // For each emoji position, we calculate where the placeholder ends up
    var netOffset = 0;  // Tracks cumulative change in text length
    
    for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        
        // Space added BEFORE this emoji increases the position
        if (m.needsSpaceBefore) {
            netOffset += 1;
        }
        
        // The placeholder position = original index + current offset
        var newIndex = m.originalIndex + netOffset;
        indexMap[m.originalIndex] = newIndex;
        
        // Emoji replacement: multi-codepoint becomes placeholder (or nothing when disabled)
        // This changes subsequent positions by (emojiLength - placeholderLength)
        // When disabled: placeholderLength is 0, so offset = -emojiLength (text shrinks by emoji length)
        netOffset -= (m.originalLength - placeholderLength);
        
        // Space added AFTER this emoji increases subsequent positions
        if (m.needsSpaceAfter) {
            netOffset += 1;
        }
    }
    
    // Build the modified text manually
    // Insert spaces before/after each emoji to make it a standalone word (when enabled)
    // Or just remove the emoji entirely (when disabled)
    var modifiedText = '';
    var lastEnd = 0;
    
    for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        
        // Add text between last position and this emoji
        modifiedText += text.substring(lastEnd, m.originalIndex);
        
        // Add space before if needed
        if (m.needsSpaceBefore) {
            modifiedText += ' ';
        }
        
        // Add the placeholder (empty string when disabled)
        modifiedText += placeholder;
        
        // Add space after if needed
        if (m.needsSpaceAfter) {
            modifiedText += ' ';
        }
        
        lastEnd = m.originalIndex + m.originalLength;
    }
    
    // Add any remaining text after the last emoji
    modifiedText += text.substring(lastEnd);
    
    // Log what happened
    if (emojisDisabled && matches.length > 0) {
    } else if (matches.length > 0) {
        var spacesBefore = matches.filter(function(m) { return m.needsSpaceBefore; }).length;
        var spacesAfter = matches.filter(function(m) { return m.needsSpaceAfter; }).length;
        if (spacesBefore > 0 || spacesAfter > 0) {
        }
    }
    
    return {
        text: modifiedText,
        indexMap: indexMap,
        // Also return the matches array for adjusting arbitrary indices (not just emoji positions)
        matches: matches,
        // Flag to indicate if emojis were stripped (no placeholder) vs replaced
        emojisStripped: emojisDisabled
    };
}

// Global storage for emoji index mappings per text node
// Used by processEmojiData to get correct indices after emoji replacement
// Format: { textNodeName: { indexMap: {...}, modifiedText: "...", matches: [...] } }
var __emojiIndexMaps = {};

/**
 * Adjust any character index for emoji replacements.
 * Unlike getStringEmojiIndex which only works for emoji positions,
 * this function can adjust ANY index based on:
 * 1. How many emoji characters were removed before that position
 * 2. How many spaces were INSERTED before/after emojis to ensure standalone words
 * 
 * IMPORTANT: When we insert spaces around emojis, ALL subsequent indices shift.
 * This function accounts for both the emoji shrinking (multi-codepoint -> placeholder)
 * AND the space insertions.
 * 
 * When emojisStripped is true, emojis are completely removed (placeholderLength = 0)
 * and no spaces are inserted around them.
 * 
 * @param {number} originalIndex - The original character index in Figma's text
 * @param {Array} matches - Array of {originalIndex, originalLength, needsSpaceBefore, needsSpaceAfter} from replaceEmojisWithPlaceholder
 * @param {boolean} emojisStripped - If true, emojis were removed entirely (no placeholder)
 * @returns {number} - The adjusted index in the modified text
 */
function adjustIndexForEmojiReplacements(originalIndex, matches, emojisStripped) {
    if (!matches || matches.length === 0) return originalIndex;
    
    // Placeholder length depends on whether emojis were stripped or replaced
    // When stripped: 0 (completely removed)
    // When replaced: 3 characters ([e])
    var placeholderLength = emojisStripped ? 0 : 3;
    
    // Track how indices shift:
    // - Emoji replacement: changes by (emojiLength - placeholderLength)
    //   When stripped: offset = -emojiLength (text shrinks)
    //   When replaced: offset = -(emojiLength - 3)
    // - Space before emoji: INCREASES by 1 (only when not stripped)
    // - Space after emoji: INCREASES by 1 (only when not stripped)
    var netOffset = 0;  // Positive = text got longer, Negative = text got shorter
    
    for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        var emojiStart = m.originalIndex;
        var emojiEnd = emojiStart + m.originalLength;
        
        // Only process emojis that START before our target index
        if (emojiStart < originalIndex) {
            // Space inserted BEFORE this emoji (shifts all indices after it by +1)
            // Only applies when emojis are being replaced, not stripped
            if (m.needsSpaceBefore && !emojisStripped) {
                netOffset += 1;
            }
            
            // Emoji was replaced/removed: changes by (emojiLength - placeholderLength)
            netOffset -= (m.originalLength - placeholderLength);
            
            // Space inserted AFTER this emoji (shifts all indices at or after emojiEnd by +1)
            // Only applies when emojis are being replaced, not stripped
            if (m.needsSpaceAfter && !emojisStripped && originalIndex >= emojiEnd) {
                netOffset += 1;
            }
        } else if (emojiStart === originalIndex) {
            // Index is exactly AT the start of an emoji
            // Account for space before (if any, and only when not stripped)
            if (m.needsSpaceBefore && !emojisStripped) {
                netOffset += 1;
            }
            // The index points to the start of the placeholder (or nothing if stripped)
            break;
        } else {
            // All remaining emojis are after this index, stop
            break;
        }
    }
    
    return originalIndex + netOffset;
}

/**
 * Get the STRING index for an emoji (used by applyTextMaterial).
 * This is the position in the actual text string after emoji replacement.
 * 
 * @param {string} textNodeName - The Figma text node name
 * @param {number} originalIndex - The original emoji character index from Figma
 * @returns {number} - The string index in the modified text
 */
function getStringEmojiIndex(textNodeName, originalIndex) {
    var data = __emojiIndexMaps[textNodeName];
    if (!data || !data.indexMap || !data.indexMap.hasOwnProperty(originalIndex)) {
        return originalIndex;
    }
    return data.indexMap[originalIndex];
}

/**
 * Count characters that have visual geometry in Cavalry.
 * Skips whitespace and zero-width characters that don't render glyphs.
 * Used to calculate total visual chars for scaling ratio.
 * 
 * @param {string} text - The text to analyze
 * @returns {number} - Count of characters with geometry
 */
function countVisualChars(text) {
    if (!text) return 0;
    var count = 0;
    for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var code = text.charCodeAt(i);
        
        // Skip characters without geometry
        var hasNoGeometry = (
            ch === ' ' || 
            ch === '\t' || 
            ch === '\n' || 
            ch === '\r' ||
            code === 0x200B ||  // Zero-width space
            code === 0x200C ||  // Zero-width non-joiner
            code === 0x200D ||  // Zero-width joiner
            code === 0x2060 ||  // Word joiner
            code === 0xFEFF ||  // BOM / Zero-width no-break space
            code === 0x00AD ||  // Soft hyphen
            code === 0xFE0E ||  // Variation selector-15 (text style)
            code === 0xFE0F     // Variation selector-16 (emoji style)
        );
        
        if (!hasNoGeometry) {
            count++;
        }
    }
    return count;
}

/**
 * Calculate the WORD index for an emoji placeholder position.
 * Word-level indexing is more stable than character-level because:
 * - Ligatures only affect characters within words, not word count
 * - Zero-width characters don't affect word boundaries
 * 
 * NOTE: Consecutive emojis now have spaces inserted between them during
 * replacement, so each emoji is guaranteed to be in its own word.
 * 
 * @param {string} textNodeName - The Figma text node name
 * @param {number} originalIndex - The original emoji character index from Figma
 * @returns {Object} - { wordIndex: number }
 */
function getWordIndexForEmoji(textNodeName, originalIndex) {
    var data = __emojiIndexMaps[textNodeName];
    if (!data || !data.indexMap || !data.modifiedText) {
        return { wordIndex: -1 };
    }
    
    var stringIndex = data.indexMap[originalIndex];
    var text = data.modifiedText;
    
    if (stringIndex === undefined) {
        return { wordIndex: -1 };
    }
    
    // Count which word contains the character at stringIndex
    // Each emoji placeholder is now guaranteed to be its own word
    // (consecutive emojis have spaces inserted between them)
    var wordIndex = 0;
    var inWord = false;
    
    for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var isWhitespace = (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r');
        
        if (isWhitespace) {
            if (inWord) {
                inWord = false;
            }
        } else {
            if (!inWord) {
                // Starting a new word
                inWord = true;
            }
            
            // Check if this is our target position
            if (i === stringIndex) {
                return { wordIndex: wordIndex };
            }
        }
        
        // Increment word count when we finish a word (transition from word to whitespace)
        // OR when we're about to start a new word (but we handle that above)
        if (!isWhitespace && i + 1 < text.length) {
            var nextCh = text.charAt(i + 1);
            var nextIsWhitespace = (nextCh === ' ' || nextCh === '\t' || nextCh === '\n' || nextCh === '\r');
            if (nextIsWhitespace) {
                wordIndex++;
            }
        } else if (!isWhitespace && i + 1 === text.length) {
            // Last character of text, still in a word
            // Don't increment - we've already found or passed our target
        }
    }
    
    return { wordIndex: -1 };
}

/**
 * Store the actual glyph count from Cavalry's Count Sub-Meshes.
 * This is the ground truth for index calibration - no guessing about ligatures!
 * 
 * Call this AFTER creating the text shape and BEFORE processing emojis.
 * 
 * @param {string} textNodeName - The Figma text node name
 * @param {number} actualGlyphCount - The count from Count Sub-Meshes (Characters level)
 */
function setActualGlyphCount(textNodeName, actualGlyphCount) {
    if (typeof __emojiIndexMaps === 'undefined' || !__emojiIndexMaps[textNodeName]) {
        console.warn('[Emoji Index] No emoji data for "' + textNodeName + '" to set glyph count');
        return;
    }
    
    var data = __emojiIndexMaps[textNodeName];
    data.actualGlyphCount = actualGlyphCount;
    
    // Calculate total visual chars (non-whitespace) for scaling ratio
    if (data.modifiedText) {
        data.totalVisualChars = countVisualChars(data.modifiedText);
        
        // Calculate the scaling factor: actual glyphs / expected chars
        // This accounts for ligatures automatically - no pattern matching needed!
        if (data.totalVisualChars > 0) {
            data.glyphScaleFactor = actualGlyphCount / data.totalVisualChars;
        }
    }
}

/**
 * Calculate the "visual character index" for Cavalry's Sub-Mesh Transform.
 * 
 * IMPORTANT: Cavalry's getSubMeshTransform counts GLYPHS, not string characters.
 * This means:
 * 1. Whitespace (spaces, tabs, newlines) are not counted
 * 2. Ligatures (fi, fl, ff, etc.) render as single glyphs - font dependent!
 * 
 * Instead of guessing which ligatures exist, we use COUNT SUB-MESHES as ground truth:
 * - We know the total glyph count from Cavalry (actualGlyphCount)
 * - We know the total visual chars we calculated (totalVisualChars)
 * - We scale each position proportionally: glyphIndex = visualIndex × scaleFactor
 * 
 * This is 100% accurate because we use Cavalry's actual rendering as the source of truth.
 * 
 * @param {string} textNodeName - The Figma text node name
 * @param {number} originalIndex - The original emoji character index from Figma
 * @returns {number} - The glyph index for Cavalry Sub-Mesh Transform
 */
function getAdjustedEmojiIndex(textNodeName, originalIndex) {
    var data = __emojiIndexMaps[textNodeName];
    if (!data) {
        return originalIndex;
    }
    
    var indexMap = data.indexMap;
    var modifiedText = data.modifiedText;
    
    if (!indexMap || !indexMap.hasOwnProperty(originalIndex)) {
        return originalIndex;
    }
    
    // Get the string position of the em-dash (after emoji replacement)
    var stringIndex = indexMap[originalIndex];
    
    if (!modifiedText) {
        return stringIndex;
    }
    
    // Count non-whitespace characters BEFORE this position
    // This is our "visual index" before accounting for ligatures
    var visualIndex = 0;
    var spaceCount = 0;
    var newlineCount = 0;
    var zeroWidthCount = 0;
    
    for (var i = 0; i < stringIndex && i < modifiedText.length; i++) {
        var ch = modifiedText.charAt(i);
        var code = modifiedText.charCodeAt(i);
        
        // Check for characters WITHOUT geometry in Cavalry:
        // 1. Standard whitespace: space, tab, newline, carriage return
        // 2. Zero-width characters that have no visual geometry
        var hasNoGeometry = (
            ch === ' ' || 
            ch === '\t' || 
            ch === '\n' || 
            ch === '\r' ||
            code === 0x200B ||  // Zero-width space
            code === 0x200C ||  // Zero-width non-joiner
            code === 0x200D ||  // Zero-width joiner
            code === 0x2060 ||  // Word joiner
            code === 0xFEFF ||  // BOM / Zero-width no-break space
            code === 0x00AD ||  // Soft hyphen
            code === 0xFE0E ||  // Variation selector-15 (text style)
            code === 0xFE0F     // Variation selector-16 (emoji style)
        );
        
        if (!hasNoGeometry) {
            visualIndex++;
        } else {
            if (ch === ' ') spaceCount++;
            else if (ch === '\n' || ch === '\r') newlineCount++;
            else zeroWidthCount++;
        }
    }
    
    // Calculate the actual glyph index using proportional scaling
    // This uses Count Sub-Meshes as ground truth - 100% accurate, no ligature guessing!
    var glyphIndex = visualIndex;  // Default: no scaling
    
    if (data.glyphScaleFactor !== undefined && data.glyphScaleFactor > 0) {
        // Scale proportionally based on actual glyph count
        // Round to nearest integer for the index
        glyphIndex = Math.round(visualIndex * data.glyphScaleFactor);
    }
    
    return glyphIndex;
}

/**
 * Clear all emoji index mappings after import is complete.
 */
function clearEmojiIndexMaps() {
    __emojiIndexMaps = {};
}

function createText(node, parentId, vb, inheritedScale) {
    try {
    inheritedScale = inheritedScale || {x:1, y:1};
    if (!node.tspans || node.tspans.length === 0) return null;
        
        // Skip text creation if disabled in settings
        if (!importLiveTextEnabled) {

            return null;
        }
    
    // HYBRID TEXT: Look up Figma text data for accurate alignment
    // getFigmaTextData is defined in quiver_utilities_webserver.js and populated before SVG import
    var figmaTextData = null;
    try {
        var textNodeName = node.name || '';
        
        // Extract text content preview for disambiguation when multiple nodes have same name
        var textContentPreview = '';
        if (node.tspans && node.tspans.length > 0) {
            for (var tpi = 0; tpi < node.tspans.length && textContentPreview.length < 50; tpi++) {
                textContentPreview += node.tspans[tpi].text.replace(/[\u2028\u2029]/g, '');
            }
        }
        
        // Extract SVG position from first tspan for position-based disambiguation
        // This helps when multiple text nodes have the same name AND same content
        var svgPosition = null;
        if (node.tspans && node.tspans.length > 0) {
            svgPosition = {
                x: node.tspans[0].x || 0,
                y: node.tspans[0].y || 0
            };
        }
        
        if (typeof getFigmaTextData === 'function') {
            figmaTextData = getFigmaTextData(textNodeName, textContentPreview, svgPosition);
            if (figmaTextData) {
            } else {
            }
        } else {
        }
    } catch (eFTD) {
    }
    
    // ALWAYS use SVG tspan joining for text content - this preserves visual line breaks
    // Figma's node.characters doesn't contain newlines for auto-wrapped text
    // The SVG tspans have different Y positions for each visual line
    // We use Figma data only for alignment, not for the actual text content
    
    // Smart joining: check if tspans are on the same line (same Y position) or different lines
    // If Y positions are very close (within 1px), they're on the same line - no newline
    // If Y positions differ significantly, insert newline (replacing any trailing space)
    // NOTE: Figma sometimes includes Unicode Line Separator (U+2028) or Paragraph Separator (U+2029)
    // in text - we need to strip these to avoid double line breaks
    var combined = '';
    for (var ti = 0; ti < node.tspans.length; ti++) {
        // Get the tspan text and strip any Unicode line/paragraph separators
        // U+2028 = Line Separator, U+2029 = Paragraph Separator, and also strip newlines (\n, \r)
        // We manage line breaks via Y-position differences, so embedded newlines cause duplicates
        var tspanText = node.tspans[ti].text.replace(/[\u2028\u2029\n\r]/g, '');
        
        if (ti > 0) {
            var prevY = node.tspans[ti - 1].y;
            var currY = node.tspans[ti].y;
            var yDiff = Math.abs(currY - prevY);
            // If Y difference is more than 1px, they're on different lines
            if (yDiff > 1) {
                // Remove trailing space/separators before adding newline (newline replaces the space)
                combined = combined.replace(/[ \u2028\u2029]+$/, '');
                combined += '\n';
                // NOTE: Do NOT strip leading spaces - they may be intentional indentation
                // used by Figma for visual alignment (e.g., "            outside")
            }
        }
        combined += tspanText;
    }
    
    // Strip leading empty lines - these occur when Figma exports empty tspans before visible content
    // Since we position based on the first VISIBLE tspan, leading empty lines shift text incorrectly
    combined = combined.replace(/^(\n)+/, '');
    
    
    try { combined = decodeEntitiesForName(combined); } catch (eDecAll) {}
    var name = combined.split(/\s+/).slice(0,3).join(' ');
    if (!name) name = node.name || 'text';

    var id = api.create('textShape', name);
    if (parentId) api.parent(id, parentId);

    // Find the first tspan with actual text content (not just whitespace)
    // Figma sometimes exports empty/whitespace tspans before the real content
    var first = node.tspans[0];
    for (var tIdx = 0; tIdx < node.tspans.length; tIdx++) {
        var tspan = node.tspans[tIdx];
        if (tspan.text && tspan.text.trim().length > 0) {
            first = tspan;
            break;
        }
    }
    var pos = svgToCavalryPosition(first.x, first.y, vb);

    var fill = node.attrs.fill || extractStyleProperty(node.attrs.style, 'fill') || '#000000';
    var fontSizeRaw = parseFloat((node.attrs['font-size'] || extractStyleProperty(node.attrs.style, 'font-size') || '16').toString().replace('px',''));
    
    // Apply inherited scale to font size (use average of X and Y scale for uniform scaling)
    var scaleAvg = (inheritedScale.x + inheritedScale.y) / 2;
    var fontSize = fontSizeRaw * scaleAvg;
    
    // Enhanced font extraction: try Affinity format first, then fall back to Figma format
    var familyRaw = node.attrs['font-family'] || extractStyleProperty(node.attrs.style, 'font-family') || 'Arial';
    var familyFirst = familyRaw.split(',')[0].trim().replace(/["']/g,'');
    
    // Try to parse font variant from family name (Affinity SVG format)
    var parsed = parseFontFamilyVariant(familyFirst);
    
    // Use parsed result if available, otherwise clean up familyFirst
    var family = familyFirst;
    var variantFromName = null;
    if (parsed) {
        family = parsed.family;
        variantFromName = parsed.variant;
    } else {
        // If no variant parsed but name ends with MT, strip it
        if (familyFirst.match(/MT$/)) {
            family = familyFirst.replace(/MT$/, '');
        }
    }
    
    // Get explicit weight and style attributes (Figma format)
    var weight = node.attrs['font-weight'] || extractStyleProperty(node.attrs.style, 'font-weight') || '400';
    var fontStyle = node.attrs['font-style'] || extractStyleProperty(node.attrs.style, 'font-style') || '';
    
    // Simplified mapping like example
    function parseFontWeight(weightStr){
        var w = ('' + weightStr).toLowerCase();
        var n = parseInt(w,10);
        if (!isNaN(n)) {
            if (n <= 250) return 'Thin';
            if (n <= 350) return 'Light';
            if (n <= 450) return 'Regular';
            if (n <= 550) return 'Medium';
            if (n <= 650) return 'SemiBold';
            if (n <= 750) return 'Bold';
            if (n <= 850) return 'ExtraBold';
            return 'Black';
        }
        if (w === 'normal') return 'Regular';
        if (w === 'bold') return 'Bold';
        return w.charAt(0).toUpperCase() + w.slice(1);
    }
    function combineWeightAndItalic(weightStyle, fontStyleStr){
        var s = weightStyle || 'Regular';
        var fs = ('' + fontStyleStr).toLowerCase();
        var isItalic = fs.indexOf('italic') !== -1 || fs.indexOf('oblique') !== -1;
        if (isItalic && s.toLowerCase().indexOf('italic') === -1) return s + ' Italic';
        return s;
    }

    // Use variant from font name if available (Affinity), otherwise parse from weight/style (Figma)
    var finalStyle = variantFromName || combineWeightAndItalic(parseFontWeight(weight), fontStyle);

    // Compute line spacing - use SVG tspan Y positions as ground truth
    // The tspan Y values give us the ACTUAL baseline-to-baseline distance in the source
    var lineSpacingOffset = 0;
    try {
        // FIRST: Calculate actual baseline-to-baseline distance from SVG tspans
        // This is the ground truth - the actual line height in the source SVG
        var actualLineHeight = null;
        if (node.tspans && node.tspans.length > 1) {
            var diffs = []; 
            for (var li = 1; li < node.tspans.length; li++) { 
                var dy = (node.tspans[li].y - node.tspans[li-1].y); 
                if (isFinite(dy) && Math.abs(dy) > 1) diffs.push(dy); // Only count actual line breaks
            }
            if (diffs.length > 0) {
                var sum = 0; 
                for (var di = 0; di < diffs.length; di++) sum += diffs[di];
                actualLineHeight = sum / diffs.length;
            }
        }
        
        // If we have the actual line height from SVG, use it directly
        // This is more accurate than Figma's percentage-based lineHeight
        if (actualLineHeight !== null) {
            // Cavalry's default line height is the fontSize times some multiplier
            // We need to find: lineSpacingOffset such that:
            //   Cavalry_default_line_height + lineSpacingOffset = actualLineHeight
            // So: lineSpacingOffset = actualLineHeight - Cavalry_default_line_height
            //
            // Empirically measured using Bounding Box on 2-line text in Cavalry:
            //   110px font: default line height = 141.95px = 1.29x
            //   160px font: default line height = 208.02px = 1.30x
            // Average: ~1.29x (font-specific, based on Canva Sans Display metrics)
            var cavalryDefaultMultiplier = 1.29; // Empirically measured from Cavalry Bounding Box
            var cavalryDefaultLH = fontSize * cavalryDefaultMultiplier;
            lineSpacingOffset = actualLineHeight - cavalryDefaultLH;
            
            // Also check if Figma data gives us additional info for logging
            var figmaLhInfo = '';
            if (figmaTextData && figmaTextData.lineHeight) {
                var lh = figmaTextData.lineHeight;
                if (lh.unit === 'PERCENT') {
                    figmaLhInfo = ' (Figma: ' + lh.value + '%)';
                } else if (lh.unit === 'PIXELS') {
                    figmaLhInfo = ' (Figma: ' + lh.value + 'px)';
                } else if (lh.unit === 'AUTO') {
                    figmaLhInfo = ' (Figma: AUTO)';
                }
            }
        } else if (figmaTextData && figmaTextData.lineHeight) {
            // Single line text or no measurable line breaks - use Figma data if available
            var lh = figmaTextData.lineHeight;
            if (lh.unit === 'AUTO') {
                lineSpacingOffset = 0;
            } else if (lh.unit === 'PIXELS' && typeof lh.value === 'number') {
                var cavalryDefaultLH = fontSize * 1.29;
                lineSpacingOffset = lh.value - cavalryDefaultLH;
            } else if (lh.unit === 'PERCENT' && typeof lh.value === 'number') {
                var figmaLH = fontSize * (lh.value / 100);
                var cavalryDefaultLH = fontSize * 1.29;
                lineSpacingOffset = figmaLH - cavalryDefaultLH;
            }
        }
    } catch (eLS) { lineSpacingOffset = 0; }

    // Determine horizontal alignment
    // Cavalry: 0=Left, 1=Center, 2=Right, 3=Justified
    // Figma: "LEFT", "CENTER", "RIGHT", "JUSTIFIED"
    var horizontalAlignment = 0; // Default: left
    if (figmaTextData && figmaTextData.textAlignHorizontal) {
        var alignH = figmaTextData.textAlignHorizontal.toUpperCase();
        if (alignH === 'CENTER') horizontalAlignment = 1;
        else if (alignH === 'RIGHT') horizontalAlignment = 2;
        else if (alignH === 'JUSTIFIED') horizontalAlignment = 3;
    }
    
    // Determine vertical alignment
    // Cavalry: 0=Top, 1=Center, 2=Bottom, 3=Baseline
    // Since we use SVG tspan Y positions (which are baseline-based), we should use Baseline alignment
    // This ensures the text position matches the SVG's baseline positioning
    var verticalAlignment = 3; // Default: Baseline (matches SVG tspan Y positioning)
    
    // Calculate position based on alignment and Figma data
    // IMPORTANT: Keep SVG's Y position (pos.y) - it's based on text baseline which is more accurate
    // Only adjust X position for horizontal alignment using Figma's bounding box data
    var finalPosX = pos.x;
    var finalPosY = pos.y; // Keep SVG's baseline-based Y position
    
    if (figmaTextData) {
        // Use Figma's width to adjust X position for alignment
        var figmaWidth = (figmaTextData.width || 0) * inheritedScale.x;
        
        // For horizontal alignment, we need to offset X based on the text box width
        // SVG tspan X is typically the left edge of each line
        // For center-aligned text, we need to position at the center of the text box
        if (horizontalAlignment === 1) {
            // Center: use the center of the Figma text box
            var figmaPosConverted = svgToCavalryPosition(
                figmaTextData.relativeX,
                figmaTextData.relativeY,
                vb
            );
            finalPosX = figmaPosConverted.x + (figmaWidth / 2);
        } else if (horizontalAlignment === 2) {
            // Right: use the right edge of the Figma text box
            var figmaPosConverted = svgToCavalryPosition(
                figmaTextData.relativeX,
                figmaTextData.relativeY,
                vb
            );
            finalPosX = figmaPosConverted.x + figmaWidth;
        }
        // For left alignment (0), keep the SVG's X position (pos.x)
        
    }
    
    // Replace emoji characters with em-dash placeholders for Get Sub-Mesh Transform positioning
    // The em-dash creates geometry at the correct position for emoji overlay
    var originalCombined = combined;
    var textNodeNameForEmoji = node.name || name;
    var emojiReplacement = replaceEmojisWithPlaceholder(combined);
    combined = emojiReplacement.text;
    
    // Store the index map AND modified text for emoji processing
    var emojiMatchesSimple = emojiReplacement.matches || [];
    var emojisStrippedSimple = emojiReplacement.emojisStripped || false;
    if (Object.keys(emojiReplacement.indexMap).length > 0 || emojiMatchesSimple.length > 0) {
        if (typeof __emojiIndexMaps !== 'undefined') {
            __emojiIndexMaps[textNodeNameForEmoji] = {
                indexMap: emojiReplacement.indexMap,
                modifiedText: combined,
                matches: emojiMatchesSimple,
                emojisStripped: emojisStrippedSimple
            };
        }
        if (!emojisStrippedSimple) {
            var currentPlaceholder = (typeof emojiPlaceholder !== 'undefined' && emojiPlaceholder.length === 3) ? emojiPlaceholder : '[e]';
        } else {
        }
    }
    
    var textSettings = {
        "text": combined,
        "fontSize": fontSize,
        "font.font": family,
        "font.style": finalStyle,
        "autoWidth": true,
        "autoHeight": true,
        "position.x": finalPosX,
        "position.y": finalPosY,
        "horizontalAlignment": horizontalAlignment,
        "verticalAlignment": verticalAlignment
    };
    
    // Letter spacing - prefer Figma's letterSpacing data when available
    var letterSpacingRatio = null; // Track ratio for expression connection
    var lsNum = 0;
    var figmaLetterSpacingUsed = false;
    
    // First, try Figma's letterSpacing data (more accurate)
    if (figmaTextData && figmaTextData.letterSpacing && typeof figmaTextData.letterSpacing.value === 'number') {
        var ls = figmaTextData.letterSpacing;
        if (ls.unit === 'PIXELS') {
            // Absolute pixel value
            lsNum = ls.value;
            letterSpacingRatio = lsNum / fontSize;
            figmaLetterSpacingUsed = true;
        } else if (ls.unit === 'PERCENT') {
            // Percentage of font size (e.g., -3% = -0.03 * fontSize)
            letterSpacingRatio = ls.value / 100;
            lsNum = letterSpacingRatio * fontSize;
            figmaLetterSpacingUsed = true;
        }
    }
    
    // Fall back to SVG parsing if Figma data not available
    if (!figmaLetterSpacingUsed) {
        var letterSpacingRaw = node.attrs['letter-spacing'] || extractStyleProperty(node.attrs.style, 'letter-spacing');
        if (letterSpacingRaw && ('' + letterSpacingRaw).toLowerCase() !== 'normal') {
            var lsStr = ('' + letterSpacingRaw).trim();
            
            // Handle different letter-spacing units and track ratio
            if (lsStr.indexOf('em') !== -1) {
                // em units: the value itself is the ratio
                letterSpacingRatio = parseFloat(lsStr.replace('em',''));
                lsNum = letterSpacingRatio * fontSize;
            } else if (lsStr.indexOf('px') !== -1) {
                // px units: calculate ratio from absolute value
                lsNum = parseFloat(lsStr.replace('px',''));
                letterSpacingRatio = lsNum / fontSize;
            } else {
                // No unit: treat as em (fractional) if small value, otherwise as px
                // SVG exports percentages as decimal (e.g., -5% becomes -0.05)
                lsNum = parseFloat(lsStr);
                if (!isNaN(lsNum) && Math.abs(lsNum) < 10) {
                    // Likely an em/fractional value - this IS the ratio
                    letterSpacingRatio = lsNum;
                    lsNum = lsNum * fontSize;
                } else {
                    // Large absolute value, treat as pixels
                    letterSpacingRatio = lsNum / fontSize;
                }
            }
        }
    }
    
    if (!isNaN(lsNum) && lsNum !== 0) textSettings["letterSpacing"] = lsNum;
    // line spacing (only meaningful when multi-line)
    if (lineSpacingOffset && node.tspans && node.tspans.length > 1) {
        try { textSettings["lineSpacing"] = lineSpacingOffset; } catch (eSetLS) {}
    }
    api.set(id, textSettings);
    
    // VARIABLE FONT SUPPORT: Set font axes for variable fonts
    // Cavalry API: fontAxes.0 is typically the weight axis, fontAxes.1 is typically slant
    // Reference: https://docs.cavalry.scenegroup.co/tech-info/scripting/example-scripts/
    // IMPORTANT: Use getAttributeDefinition to check if font is variable BEFORE setting
    // This prevents Cavalry from logging errors for static fonts (e.g., Lato Bold)
    try {
        // Check if this font has variable font axes by checking for fontAxes.0
        var isVariableFont = false;
        try {
            var axisCheck = api.getAttributeDefinition(id, "fontAxes.0");
            isVariableFont = (axisCheck !== null && axisCheck !== undefined);
        } catch (eCheck) {
            // getAttributeDefinition threw - font is not variable
            isVariableFont = false;
        }
        
        if (!isVariableFont) {
            // Static font - skip variable font processing entirely
            // No logging needed for static fonts to keep console clean
        } else {
            console.log('[Variable Font] Processing text: ' + name + ' with font: ' + family + ' ' + finalStyle);
            
            // Get numeric weight from Figma data or SVG
            var numericWeightForAxis = null;
            
            // First, try to get numeric weight from Figma data (most accurate)
            if (figmaTextData && figmaTextData.styledSegments && figmaTextData.styledSegments.length > 0) {
                for (var fwti = 0; fwti < figmaTextData.styledSegments.length; fwti++) {
                    var fwtSeg = figmaTextData.styledSegments[fwti];
                    if (fwtSeg.fontWeight !== undefined && typeof fwtSeg.fontWeight === 'number') {
                        numericWeightForAxis = fwtSeg.fontWeight;
                        console.log('[Variable Font] Found fontWeight in Figma data: ' + numericWeightForAxis);
                        break;
                    }
                }
            }
            
            // Fallback: parse weight from SVG font-weight attribute
            if (numericWeightForAxis === null && weight) {
                var parsedWeight = parseInt(weight, 10);
                if (!isNaN(parsedWeight) && parsedWeight >= 100 && parsedWeight <= 900) {
                    numericWeightForAxis = parsedWeight;
                    console.log('[Variable Font] Parsed weight from SVG: ' + numericWeightForAxis);
                } else if (('' + weight).toLowerCase() === 'bold') {
                    numericWeightForAxis = 700;
                } else if (('' + weight).toLowerCase() === 'normal') {
                    numericWeightForAxis = 400;
                }
            }
            
            // Set weight axis (fontAxes.0)
            if (numericWeightForAxis !== null) {
                try {
                    api.set(id, { "fontAxes.0": numericWeightForAxis });
                    console.log('[Variable Font] Set fontAxes.0 (weight) to ' + numericWeightForAxis + ' for ' + family);
                } catch (eWght) {
                    // Silently ignore - axis might not exist for this specific variable font
                }
            }
            
            // SLANT AXIS: Parse actual degree value from font-style
            // SVG can have: "italic", "oblique", "oblique -10deg", "oblique 10deg"
            var slantValue = null;
            var fontStyleRaw = fontStyle || '';
            var fontStyleLowerCheck = fontStyleRaw.toLowerCase();
            var finalStyleLowerCheck = (finalStyle || '').toLowerCase();
            
            // First, try to parse actual degree value from "oblique Xdeg" format
            var obliqueMatch = fontStyleRaw.match(/oblique\s*(-?\d+(?:\.\d+)?)\s*deg/i);
            if (obliqueMatch && obliqueMatch[1]) {
                slantValue = parseFloat(obliqueMatch[1]);
                console.log('[Variable Font] Parsed slant from font-style: ' + slantValue + ' degrees');
            } else if (fontStyleLowerCheck.indexOf('italic') !== -1 || fontStyleLowerCheck.indexOf('oblique') !== -1 ||
                finalStyleLowerCheck.indexOf('italic') !== -1 || finalStyleLowerCheck.indexOf('oblique') !== -1) {
                // Fallback: use default slant for italic/oblique
                slantValue = -12;
                console.log('[Variable Font] Using default slant for italic/oblique: ' + slantValue);
            }
            
            // Check if slant axis exists before setting
            if (slantValue !== null) {
                try {
                    var slantAxisCheck = api.getAttributeDefinition(id, "fontAxes.1");
                    if (slantAxisCheck) {
                        api.set(id, { "fontAxes.1": slantValue });
                        console.log('[Variable Font] Set fontAxes.1 (slant) to ' + slantValue);
                    }
                } catch (eSlnt) {
                    // Silently ignore - slant axis might not exist
                }
            }
        }
    } catch (eVarFont) {
        // Variable font handling failed - not critical, continue
    }
    
    // Verify the alignment was set correctly
    try {
        var appliedHAlign = api.get(id, 'horizontalAlignment');
        var appliedVAlign = api.get(id, 'verticalAlignment');
    } catch (eVerify) {
    }

    // Letter spacing is now set as a simple static value (not an expression)
    // The value was already applied via textSettings["letterSpacing"] above

    // Apply fill/stroke/alpha via common path (supports stroke gradients)
    // For text, default SVG fill is black if unspecified; honour that without overriding explicit values
    var attrsForTextStyle = {};
    try { for (var kAT in node.attrs) { if (Object.prototype.hasOwnProperty.call(node.attrs, kAT)) attrsForTextStyle[kAT] = node.attrs[kAT]; } } catch (eCopy) {}
    var fillRawTxt = (node.attrs && (node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')))) || null;
    var strokeRawTxt = (node.attrs && (node.attrs.stroke || (node.attrs.style && extractStyleProperty(node.attrs.style, 'stroke')))) || null;
    var hasStrokeTxt = !!(strokeRawTxt && (''+strokeRawTxt).toLowerCase() !== 'none');
    var hasStrokeGradTxt = !!extractUrlRefId(strokeRawTxt);
    var hasStyleFill = !!(node.attrs && node.attrs.style && extractStyleProperty(node.attrs.style, 'fill'));
    var forceHideFillAlpha = false;
    if ((fillRawTxt === null || fillRawTxt === undefined || fillRawTxt === '' || (''+fillRawTxt).toLowerCase() === 'none')) {
        if (hasStrokeTxt || hasStrokeGradTxt) {
            // Stroke-only text → ensure no visible fill
            attrsForTextStyle.fill = 'none';
            forceHideFillAlpha = true;
        } else if (!hasStyleFill) {
            // No fill/stroke provided → default to SVG black fill
            attrsForTextStyle.fill = '#000000';
        }
    }
    // If fill is rgba(..., a), fold alpha into fill-opacity to preserve visual alpha
    try {
        var srcFill = node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill'));
        if (srcFill && /^rgba\(/i.test(srcFill)) {
            var mA = srcFill.match(/rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\)/i);
            if (mA && mA[4] !== undefined) {
                var aVal = clamp01(parseFloat(mA[4]));
                var foRaw = node.attrs['fill-opacity'] || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill-opacity'));
                var foNum = parseOpacityValue(foRaw);
                if (foNum === null) foNum = 1;
                attrsForTextStyle['fill-opacity'] = '' + clamp01(foNum * aVal);
                // Also convert base rgba color to rgb hex for material base when non-gradient
                var rr = parseInt(mA[1]).toString(16).padStart(2,'0');
                var gg = parseInt(mA[2]).toString(16).padStart(2,'0');
                var bb = parseInt(mA[3]).toString(16).padStart(2,'0');
                attrsForTextStyle.fill = '#' + rr + gg + bb;
            }
        }
    } catch (eRGBA) {}
    applyFillAndStroke(id, attrsForTextStyle);
    applyBlendMode(id, attrsForTextStyle);
    if (forceHideFillAlpha) {
        try { api.set(id, {"material.materialColor.a": 0}); } catch (eHide) {}
    }
    // Note: Fill gradient connection is already handled by applyFillAndStroke()
    // No need to connect again here - that would cause duplicate shaders
    
    // Register the created text shape for emoji positioning via Get Sub-Mesh Transform
    // This allows processEmojiData to find the text shape and connect emojis
    if (typeof registerCreatedTextShape === 'function') {
        registerCreatedTextShape(node.name || name, id);
    }

    return id;
    } catch (e) {
        // Silent fail when text import is disabled or other errors occur

        return null;
    }
}

/**
 * Create a text shape directly from Figma text data (hybrid approach).
 * This is used when Figma exports styled text as multiple SVG <text> elements,
 * but we want to create a single Cavalry textShape with the full content.
 * 
 * Cavalry API used:
 * - api.create('textShape', name) - Create text shape
 * - api.parent(childId, parentId) - Parent to group
 * - api.set(id, properties) - Set text properties
 * - api.create('applyTypeface', name) - Create Apply Typeface for styled segments
 * - api.connect(srcId, srcAttr, dstId, dstAttr) - Connect nodes
 * 
 * @param {Object} figmaData - The Figma text data object with characters, alignment, etc.
 * @param {string} parentId - The parent group ID
 * @param {Object} vb - ViewBox {width, height}
 * @param {Object} inheritedScale - Scale {x, y}
 * @param {Array} fills - Array of fill objects {color, opacity} extracted from SVG text children
 * @param {Array|Object} svgTextChildren - SVG text nodes with tspans for line spacing/position analysis
 * @returns {string|null} The created text shape ID, or null if failed
 */
function createTextFromFigmaData(figmaData, parentId, vb, inheritedScale, fills, svgTextChildren) {
    try {
        inheritedScale = inheritedScale || {x: 1, y: 1};
        
        if (!figmaData || !figmaData.characters) {
            return null;
        }
        
        // Skip if text import is disabled
        if (!importLiveTextEnabled) {
            return null;
        }
        
        var characters = figmaData.characters;
        var name = figmaData.name || characters.split(/\s+/).slice(0, 3).join(' ') || 'Text';
        
        // Replace emoji characters with em-dash (—) for proper geometry in Cavalry
        // Cavalry doesn't render emoji glyphs, but we need geometry for Get Sub-Mesh Transform
        // to find the correct position. The em-dash has appropriate width and creates geometry.
        // The emoji images will overlay these positions after Apply Text Material hides them.
        var originalCharacters = characters;
        var emojiReplacement = replaceEmojisWithPlaceholder(characters);
        characters = emojiReplacement.text;
        
        // Store the index map, modified text, AND matches array for emoji processing
        // The modified text is needed to calculate visual character indices
        // (Cavalry's Sub-Mesh Transform counts non-whitespace chars only)
        // The matches array is needed to adjust styled segment indices
        // emojisStripped indicates whether emojis were removed (true) or replaced with placeholder (false)
        var emojiMatches = emojiReplacement.matches || [];
        var emojisStripped = emojiReplacement.emojisStripped || false;
        if (Object.keys(emojiReplacement.indexMap).length > 0 || emojiMatches.length > 0) {
            __emojiIndexMaps[figmaData.name || name] = {
                indexMap: emojiReplacement.indexMap,
                modifiedText: characters,  // Text with placeholders (or emojis removed)
                matches: emojiMatches,
                emojisStripped: emojisStripped
            };
            if (!emojisStripped) {
                var currentPlaceholder = (typeof emojiPlaceholder !== 'undefined' && emojiPlaceholder.length === 3) ? emojiPlaceholder : '[e]';
            } else {
            }
        }
        
        
        // Create the text shape
        var id = api.create('textShape', name);
        if (parentId) api.parent(id, parentId);
        
        // Calculate position from Figma relative coordinates
        // Figma: Y-down, origin at frame top-left, position is TOP-LEFT of text box
        // Cavalry: Y-up, origin at composition center
        // 
        // IMPORTANT: We use BASELINE vertical alignment (3) for consistent positioning!
        // This makes the Y position refer to the first line's baseline, which is predictable
        // regardless of autoWidth/autoHeight settings. This matches how SVG text positioning works.
        var figmaX = figmaData.relativeX || 0;
        var figmaY = figmaData.relativeY || 0;
        var figmaWidth = figmaData.width || 100;
        var figmaHeight = figmaData.height || 100;
        var vbWidth = vb.width || 1920;
        var vbHeight = vb.height || 1080;
        
        // Apply font size with inherited scale
        var scaleAvg = (inheritedScale.x + inheritedScale.y) / 2;
        var fontSize = (figmaData.fontSize || 16) * scaleAvg;
        
        // Map Figma horizontal alignment to Cavalry
        // Cavalry: horizontalAlignment: 0=Left, 1=Center, 2=Right
        var hAlignMap = {'LEFT': 0, 'CENTER': 1, 'RIGHT': 2, 'JUSTIFIED': 0};
        var horizontalAlignment = hAlignMap[figmaData.textAlignHorizontal] || 0;
        
        // ALWAYS use Baseline (3) for vertical alignment - this gives consistent positioning
        // regardless of autoWidth/autoHeight settings
        var verticalAlignment = 3; // Baseline
        
        // X position depends on whether text has a fixed width (textBoxSize.x) or auto width
        // 
        // FIXED WIDTH (autoWidth=false): position.x is ALWAYS the LEFT edge of the text box
        //   The horizontalAlignment setting controls where text flows WITHIN the box
        //
        // AUTO WIDTH (autoWidth=true): position.x depends on horizontalAlignment
        //   - LEFT (0): anchor at LEFT edge of text
        //   - CENTER (1): anchor at CENTER of text  
        //   - RIGHT (2): anchor at RIGHT edge of text
        //
        // We need to determine autoWidth before calculating X, so pre-calculate it here
        var textAutoResize = figmaData.textAutoResize || 'WIDTH_AND_HEIGHT';
        var isAutoWidth = (textAutoResize === 'WIDTH_AND_HEIGHT');
        
        var figmaAnchorX;
        if (isAutoWidth) {
            // Auto width: anchor depends on alignment
            if (horizontalAlignment === 2) {
                // RIGHT: anchor at right edge of Figma box
                figmaAnchorX = figmaX + figmaWidth;
            } else if (horizontalAlignment === 1) {
                // CENTER: anchor at center of Figma box
                figmaAnchorX = figmaX + (figmaWidth / 2);
            } else {
                // LEFT: anchor at left edge
                figmaAnchorX = figmaX;
            }
        } else {
            // Fixed width: always use left edge
            figmaAnchorX = figmaX;
        }
        
        // Calculate Y position as the BASELINE of the first line
        // BEST: Use actual SVG tspan Y position (ground truth from rendered text)
        // FALLBACK: Estimate as top of text box + fontSize (less accurate, varies by font)
        var figmaBaselineY;
        var baselineSource = 'estimated';
        
        // Normalize svgTextChildren to always be an array
        var textChildrenArray = [];
        if (svgTextChildren) {
            if (Array.isArray(svgTextChildren)) {
                textChildrenArray = svgTextChildren;
            } else {
                // Legacy: single object passed
                textChildrenArray = [svgTextChildren];
            }
        }
        
        // IMPORTANT: Sort text children by their first tspan's Y position (topmost first)
        // Figma exports multi-styled text as separate <text> elements, but NOT in visual order!
        // We need the topmost line's baseline for correct positioning.
        // NOTE: Each text element may have its own transform, so we need to apply it
        if (textChildrenArray.length > 1) {
            // Helper function to get the transformed Y position of a text child's first tspan
            function getTransformedTspanY(textChild) {
                if (!textChild.tspans || textChild.tspans.length === 0) return 0;
                var tspanY = textChild.tspans[0].y;
                var tspanX = textChild.tspans[0].x;
                
                // Apply the text element's transform if present
                if (textChild.attrs && textChild.attrs.transform) {
                    var matrix = parseTransformMatrixList(textChild.attrs.transform);
                    // Apply matrix: y' = b*x + d*y + f
                    tspanY = matrix.b * tspanX + matrix.d * tspanY + matrix.f;
                }
                return tspanY;
            }
            
            textChildrenArray.sort(function(a, b) {
                var aY = getTransformedTspanY(a);
                var bY = getTransformedTspanY(b);
                return aY - bY; // Sort ascending (topmost Y = smallest value first)
            });
            if (textChildrenArray[0].tspans && textChildrenArray[0].tspans.length > 0) {
            }
        }
        
        // Get first text child for baseline Y (now guaranteed to be the topmost line)
        var firstTextChild = textChildrenArray.length > 0 ? textChildrenArray[0] : null;
        
        if (firstTextChild && firstTextChild.tspans && firstTextChild.tspans.length > 0) {
            // Use the actual baseline Y from the first tspan - this is the ground truth
            // The SVG tspan Y attribute gives us the exact baseline position
            // IMPORTANT: Apply the text element's transform to get the actual position!
            // Figma exports text with transforms like translate(32 487) on the <text> element
            // and the tspans have positions relative to that transform
            var tspanY = firstTextChild.tspans[0].y;
            var tspanX = firstTextChild.tspans[0].x;
            
            // Check if the text element has a transform attribute
            if (firstTextChild.attrs && firstTextChild.attrs.transform) {
                // Parse the full transform as a matrix (handles translate, matrix, etc.)
                var textTransformMatrix = parseTransformMatrixList(firstTextChild.attrs.transform);
                
                // Apply the matrix to the tspan position: (a*x + c*y + e, b*x + d*y + f)
                var transformedX = textTransformMatrix.a * tspanX + textTransformMatrix.c * tspanY + textTransformMatrix.e;
                var transformedY = textTransformMatrix.b * tspanX + textTransformMatrix.d * tspanY + textTransformMatrix.f;
                
                tspanY = transformedY;
                // Note: We use tspanY for baseline positioning, tspanX would be used if we needed it
            }
            
            figmaBaselineY = tspanY;
            baselineSource = 'SVG tspan';
        } else {
            // Fallback: estimate baseline as top + fontSize
            // This is approximate since actual baseline depends on font ascender
            figmaBaselineY = figmaY + fontSize;
            baselineSource = 'estimated (top + fontSize)';
        }
        
        // Convert to Cavalry coordinates (flip Y, offset by half composition)
        var cavalryX = figmaAnchorX - (vbWidth / 2);
        var cavalryY = (vbHeight / 2) - figmaBaselineY;
        
        // Build font family string
        // Cavalry uses "font.font" for family and "font.style" for style
        // 
        // OPTIMIZATION: If styled segments exist, find the DOMINANT font (most character coverage)
        // and use that as the base font. This minimizes Apply Typeface nodes.
        // Example: If Regular covers 900 chars and Bold covers 100 chars, set base to Regular
        // and only create Apply Typeface for Bold (reducing from 2 nodes to 1).
        var fontFamily = figmaData.fontFamily || 'Arial';
        var fontStyle = figmaData.fontStyle || 'Regular';
        
        // Analyze styled segments to find dominant font
        if (figmaData.styledSegments && figmaData.styledSegments.length > 1) {
            // Calculate total character coverage per font
            // Key: "FontFamily FontStyle", Value: {fontFamily, fontStyle, charCount}
            var fontCoverage = {};
            
            for (var sci = 0; sci < figmaData.styledSegments.length; sci++) {
                var seg = figmaData.styledSegments[sci];
                var segFontFamily = seg.fontFamily || fontFamily;
                var segFontStyle = seg.fontStyle || fontStyle;
                var segFontFull = segFontFamily + ' ' + segFontStyle;
                var segCharCount = (seg.end || 0) - (seg.start || 0);
                
                if (!fontCoverage[segFontFull]) {
                    fontCoverage[segFontFull] = {
                        fontFamily: segFontFamily,
                        fontStyle: segFontStyle,
                        charCount: 0
                    };
                }
                fontCoverage[segFontFull].charCount += segCharCount;
            }
            
            // Find the font with maximum character coverage
            var dominantFont = null;
            var maxCoverage = 0;
            var coverageKeys = Object.keys(fontCoverage);
            
            for (var ci = 0; ci < coverageKeys.length; ci++) {
                var coverageKey = coverageKeys[ci];
                var coverage = fontCoverage[coverageKey];
                if (coverage.charCount > maxCoverage) {
                    maxCoverage = coverage.charCount;
                    dominantFont = coverage;
                }
            }
            
            // Use the dominant font as the base font
            if (dominantFont) {
                fontFamily = dominantFont.fontFamily;
                fontStyle = dominantFont.fontStyle;
            }
        }
        
        // Determine text box sizing mode from Figma's textAutoResize
        // Figma textAutoResize values:
        // - "WIDTH_AND_HEIGHT" = Auto width (both dimensions auto, single line behavior)
        // - "HEIGHT" = Auto height (width fixed, height expands for multi-line)
        // - "NONE" = Fixed size (both width and height are fixed)
        // - "TRUNCATE" = Fixed with truncation (treated as fixed)
        // NOTE: textAutoResize was already parsed above for X position calculation
        var autoWidth = isAutoWidth;
        var autoHeight = true;
        
        // Scale the text box dimensions
        var textBoxWidth = (figmaData.width || 100) * scaleAvg;
        var textBoxHeight = (figmaData.height || 100) * scaleAvg;
        
        if (textAutoResize === 'NONE' || textAutoResize === 'TRUNCATE') {
            // Fixed size - both dimensions fixed
            autoWidth = false;
            autoHeight = false;
        } else if (textAutoResize === 'HEIGHT') {
            // Auto height - width is fixed, height auto-expands (for multi-line text)
            autoWidth = false;
            autoHeight = true;
        } else {
            // WIDTH_AND_HEIGHT (default) - both auto, single line behavior
            autoWidth = true;
            autoHeight = true;
        }
        
        
        // Set text properties
        var textSettings = {
            "text": characters,
            "position.x": cavalryX,
            "position.y": cavalryY,
            "fontSize": fontSize,
            "font.font": fontFamily,
            "font.style": fontStyle,
            "horizontalAlignment": horizontalAlignment,
            "verticalAlignment": verticalAlignment,
            "autoWidth": autoWidth,
            "autoHeight": autoHeight
        };
        
        // Set text box width when using fixed width (for text wrapping)
        // We don't set textBoxSize.y since we're using baseline alignment,
        // which positions based on the first line's baseline regardless of box height
        if (!autoWidth) {
            textSettings["textBoxSize.x"] = textBoxWidth;
        }
        
        // Apply line height - use SVG tspan Y positions as ground truth when available
        // This is more accurate than Figma's percentage-based lineHeight
        var lineSpacingOffset = 0;
        var lineSpacingCalculated = false;
        
        // FIRST: Try to calculate actual line height from SVG tspans (ground truth)
        // Check tspans within the first text child
        if (firstTextChild && firstTextChild.tspans && firstTextChild.tspans.length > 1) {
            var diffs = [];
            // Maximum reasonable line height is ~3x font size (generous for large line heights)
            // Anything larger is likely a paragraph break, not a line break
            var maxReasonableLineHeight = fontSize * 3;
            
            for (var li = 1; li < firstTextChild.tspans.length; li++) {
                var dy = firstTextChild.tspans[li].y - firstTextChild.tspans[li - 1].y;
                // Only count actual line breaks that aren't paragraph breaks
                if (isFinite(dy) && dy > 1 && dy <= maxReasonableLineHeight) {
                    diffs.push(dy);
                }
            }
            if (diffs.length > 0) {
                // Use the minimum difference as line height (most reliable for text with paragraph breaks)
                var minDiff = diffs[0];
                for (var di = 1; di < diffs.length; di++) {
                    if (diffs[di] < minDiff) minDiff = diffs[di];
                }
                var actualLineHeight = minDiff * scaleAvg;
                
                // Cavalry's default line height is fontSize * 1.29 (empirically measured)
                var cavalryDefaultLH = fontSize * 1.29;
                lineSpacingOffset = actualLineHeight - cavalryDefaultLH;
                lineSpacingCalculated = true;
                
                // Log with Figma info for debugging
                var figmaLhInfo = '';
                if (figmaData.lineHeight) {
                    if (figmaData.lineHeight.unit === 'PERCENT') figmaLhInfo = ' (Figma: ' + figmaData.lineHeight.value + '%)';
                    else if (figmaData.lineHeight.unit === 'PIXELS') figmaLhInfo = ' (Figma: ' + figmaData.lineHeight.value + 'px)';
                }
            }
        }
        
        // SECOND: For right-aligned multi-line text, lines may be in separate <text> elements
        // Check Y positions across multiple text children
        if (!lineSpacingCalculated && textChildrenArray.length > 1) {
            // Collect first tspan Y position from each text child
            var yPositions = [];
            for (var tci = 0; tci < textChildrenArray.length; tci++) {
                var tc = textChildrenArray[tci];
                if (tc.tspans && tc.tspans.length > 0) {
                    yPositions.push(tc.tspans[0].y);
                }
            }
            // Sort and calculate differences
            yPositions.sort(function(a, b) { return a - b; });
            if (yPositions.length > 1) {
                var diffs = [];
                // Maximum reasonable line height is ~3x font size
                var maxReasonableLineHeight = fontSize * 3;
                
                for (var yi = 1; yi < yPositions.length; yi++) {
                    var dy = yPositions[yi] - yPositions[yi - 1];
                    // Only count line breaks, not paragraph breaks
                    if (isFinite(dy) && dy > 1 && dy <= maxReasonableLineHeight) {
                        diffs.push(dy);
                    }
                }
                if (diffs.length > 0) {
                    // Use the minimum difference as line height (most reliable)
                    var minDiff = diffs[0];
                    for (var di = 1; di < diffs.length; di++) {
                        if (diffs[di] < minDiff) minDiff = diffs[di];
                    }
                    var actualLineHeight = minDiff * scaleAvg;
                    
                    var cavalryDefaultLH = fontSize * 1.29;
                    lineSpacingOffset = actualLineHeight - cavalryDefaultLH;
                    lineSpacingCalculated = true;
                    
                    var figmaLhInfo = '';
                    if (figmaData.lineHeight) {
                        if (figmaData.lineHeight.unit === 'PERCENT') figmaLhInfo = ' (Figma: ' + figmaData.lineHeight.value + '%)';
                        else if (figmaData.lineHeight.unit === 'PIXELS') figmaLhInfo = ' (Figma: ' + figmaData.lineHeight.value + 'px)';
                    }
                }
            }
        }
        
        // FALLBACK: Use Figma's lineHeight if SVG analysis wasn't possible
        if (!lineSpacingCalculated && figmaData.lineHeight) {
            if (figmaData.lineHeight.unit === 'PIXELS' && figmaData.lineHeight.value) {
                var lineHeightPx = figmaData.lineHeight.value * scaleAvg;
                var defaultLineHeight = fontSize * 1.29;
                lineSpacingOffset = lineHeightPx - defaultLineHeight;
            } else if (figmaData.lineHeight.unit === 'PERCENT' && figmaData.lineHeight.value) {
                var lineHeightPx = fontSize * (figmaData.lineHeight.value / 100);
                var defaultLineHeight = fontSize * 1.29;
                lineSpacingOffset = lineHeightPx - defaultLineHeight;
            } else {
            }
        }
        
        // Apply line spacing if calculated and text is multi-line
        if (lineSpacingOffset !== 0) {
            textSettings["lineSpacing"] = lineSpacingOffset;
        }
        
        // Apply letter spacing if available
        // Figma letterSpacing can be: { value: X, unit: 'PIXELS'|'PERCENT' }
        if (figmaData.letterSpacing) {
            if (figmaData.letterSpacing.unit === 'PIXELS' && figmaData.letterSpacing.value !== undefined) {
                textSettings["letterSpacing"] = figmaData.letterSpacing.value * scaleAvg;
            } else if (figmaData.letterSpacing.unit === 'PERCENT' && figmaData.letterSpacing.value !== undefined) {
                // Percent is relative to font size (e.g., 10% of 16px = 1.6px)
                textSettings["letterSpacing"] = (fontSize * figmaData.letterSpacing.value / 100) * scaleAvg;
            }
        }
        
        if (!autoWidth) {
        }
        
        api.set(id, textSettings);
        
        // VARIABLE FONT SUPPORT: Set font axes for variable fonts
        // Cavalry API: fontAxes.0 is typically the weight axis, fontAxes.1 is typically slant
        // Reference: https://docs.cavalry.scenegroup.co/tech-info/scripting/example-scripts/
        // IMPORTANT: Use getAttributeDefinition to check if font is variable BEFORE setting
        try {
            // Check if this font has variable font axes by checking for fontAxes.0
            var isVariableFontFigma = false;
            try {
                var axisCheckFigma = api.getAttributeDefinition(id, "fontAxes.0");
                isVariableFontFigma = (axisCheckFigma !== null && axisCheckFigma !== undefined);
            } catch (eCheckFigma) {
                isVariableFontFigma = false;
            }
            
            if (!isVariableFontFigma) {
                // Static font - skip variable font processing entirely
            } else {
                console.log('[Variable Font] Processing Figma text: ' + name + ' with font: ' + fontFamily + ' ' + fontStyle);
                
                // Get numeric weight from Figma styled segments
                var numericWeight = null;
                if (figmaData.styledSegments && figmaData.styledSegments.length > 0) {
                    for (var fwi = 0; fwi < figmaData.styledSegments.length; fwi++) {
                        var fwSeg = figmaData.styledSegments[fwi];
                        if (fwSeg.fontWeight !== undefined && typeof fwSeg.fontWeight === 'number') {
                            numericWeight = fwSeg.fontWeight;
                            console.log('[Variable Font] Found fontWeight in Figma styledSegments: ' + numericWeight);
                            break;
                        }
                    }
                }
                
                // Set weight axis (fontAxes.0)
                if (numericWeight !== null) {
                    try {
                        api.set(id, { "fontAxes.0": numericWeight });
                        console.log('[Variable Font] Set fontAxes.0 (weight) to ' + numericWeight + ' for ' + fontFamily);
                    } catch (eWghtSet) {
                        // Silently ignore
                    }
                }
                
                // SLANT AXIS: Try to get slant from SVG text children's font-style attribute
                var slantVal = null;
                var svgFontStyle = null;
                
                // Look for font-style in the SVG text children
                if (svgTextChildren) {
                    var textChildArr = Array.isArray(svgTextChildren) ? svgTextChildren : [svgTextChildren];
                    for (var tci = 0; tci < textChildArr.length; tci++) {
                        var tc = textChildArr[tci];
                        if (tc.attrs && tc.attrs['font-style']) {
                            svgFontStyle = tc.attrs['font-style'];
                            break;
                        }
                    }
                }
                
                // Parse actual degree value from "oblique Xdeg" format
                if (svgFontStyle) {
                    var obliqueMatchFigma = svgFontStyle.match(/oblique\s*(-?\d+(?:\.\d+)?)\s*deg/i);
                    if (obliqueMatchFigma && obliqueMatchFigma[1]) {
                        slantVal = parseFloat(obliqueMatchFigma[1]);
                        console.log('[Variable Font] Parsed slant from SVG font-style: ' + slantVal + ' degrees');
                    } else if (svgFontStyle.toLowerCase().indexOf('italic') !== -1 || 
                               svgFontStyle.toLowerCase().indexOf('oblique') !== -1) {
                        slantVal = -12;
                        console.log('[Variable Font] Using default slant for italic/oblique: ' + slantVal);
                    }
                } else {
                    // Fallback: check fontStyle name
                    var fontStyleLowerCheckFigma = (fontStyle || '').toLowerCase();
                    if (fontStyleLowerCheckFigma.indexOf('italic') !== -1 || fontStyleLowerCheckFigma.indexOf('oblique') !== -1) {
                        slantVal = -12;
                    }
                }
                
                // Check if slant axis exists before setting
                if (slantVal !== null) {
                    try {
                        var slantAxisCheckFigma = api.getAttributeDefinition(id, "fontAxes.1");
                        if (slantAxisCheckFigma) {
                            api.set(id, { "fontAxes.1": slantVal });
                            console.log('[Variable Font] Set fontAxes.1 (slant) to ' + slantVal);
                        }
                    } catch (eSlntSet) {
                        // Silently ignore
                    }
                }
            }
        } catch (eVarFont) {
            // Variable font handling failed - not critical
        }
        
        // Apply styled segments using Apply Typeface nodes
        // Cavalry API: https://docs.cavalry.scenegroup.co/nodes/utilities/apply-typeface/
        // OPTIMIZATION: Group segments by font to reduce node count
        // Instead of creating one node per segment, we combine indices for segments with the same font
        // e.g., segments 0:40 and 773:821 with same font become one node with indices "0:40, 773:821"
        if (figmaData.styledSegments && figmaData.styledSegments.length > 1) {
            
            // Build base font string for comparison
            var baseFontFull = fontFamily + ' ' + fontStyle;
            
            // Group segments by font (fontFamily + fontStyle)
            // Key: "FontFamily FontStyle", Value: {fontFamily, fontStyle, ranges: ["0:40", "773:821"]}
            var fontGroups = {};
            
            for (var si = 0; si < figmaData.styledSegments.length; si++) {
                var seg = figmaData.styledSegments[si];
                
                // Build font name for this segment
                var segFontFamily = seg.fontFamily || fontFamily;
                var segFontStyle = seg.fontStyle || fontStyle;
                var segFontFull = segFontFamily + ' ' + segFontStyle;
                
                // Skip segments that match the base font (no styling needed)
                if (segFontFull === baseFontFull) {
                    continue;
                }
                
                // IMPORTANT: Adjust indices for emoji replacements!
                // Figma's indices are for the ORIGINAL text, but we need indices for the MODIFIED text
                // where multi-codepoint emojis have been replaced with placeholders or stripped entirely.
                var adjustedStart = adjustIndexForEmojiReplacements(seg.start, emojiMatches, emojisStripped);
                var adjustedEnd = adjustIndexForEmojiReplacements(seg.end, emojiMatches, emojisStripped);
                
                // Build index range string: "start:end" (Cavalry uses inclusive end, Figma's end is exclusive)
                var rangeStr = adjustedStart + ':' + (adjustedEnd - 1);
                
                if (emojiMatches.length > 0) {
                }
                
                // Add to font group - also store fontWeight for variable font support
                if (!fontGroups[segFontFull]) {
                    fontGroups[segFontFull] = {
                        fontFamily: segFontFamily,
                        fontStyle: segFontStyle,
                        fontWeight: seg.fontWeight,  // Store numeric weight for variable fonts
                        ranges: []
                    };
                }
                fontGroups[segFontFull].ranges.push(rangeStr);
            }
            
            // Create one Apply Typeface node per unique font
            var fontKeys = Object.keys(fontGroups);
            
            for (var fi = 0; fi < fontKeys.length; fi++) {
                var fontKey = fontKeys[fi];
                var group = fontGroups[fontKey];
                
                try {
                    // Create Apply Typeface node with a descriptive name
                    var styleName = group.fontStyle || 'Style';
                    var applyTypefaceId = api.create('applyTypeface', styleName);
                    
                    // Combine all ranges with comma separator
                    // Cavalry API supports: "0:40, 773:821" for multiple ranges
                    var indicesStr = group.ranges.join(', ');
                    
                    // Set the font for this segment
                    // mode: 0 = Regex, 1 = Specific Indices, 2 = All
                    // indexMode: 0 = Line, 1 = Word, 2 = Character
                    // indices: string like "0:40, 773:821" (comma-separated ranges)
                    api.set(applyTypefaceId, {
                        "mode": 1,  // Specific Indices
                        "indexMode": 2,  // Character level
                        "indices": indicesStr
                    });
                    
                    // Set font separately (font.font and font.style)
                    api.set(applyTypefaceId, {
                        "font.font": group.fontFamily,
                        "font.style": group.fontStyle
                    });
                    
                    // VARIABLE FONT SUPPORT for Apply Typeface
                    // If this segment has a fontWeight and the font is variable, set fontAxes.0
                    if (group.fontWeight !== undefined && typeof group.fontWeight === 'number') {
                        try {
                            // Check if Apply Typeface has fontAxes.0 (font is variable)
                            var applyTypefaceAxisCheck = api.getAttributeDefinition(applyTypefaceId, "fontAxes.0");
                            if (applyTypefaceAxisCheck) {
                                api.set(applyTypefaceId, { "fontAxes.0": group.fontWeight });
                                console.log('[Variable Font] Apply Typeface: Set fontAxes.0 to ' + group.fontWeight + ' for ' + group.fontStyle);
                            }
                        } catch (eApplyAxis) {
                            // Font might not be variable - silently ignore
                        }
                    }
                    
                    // SLANT AXIS for Apply Typeface
                    // Check if fontStyle contains "italic" or "oblique" and set slant axis
                    var applyTypefaceStyleLower = (group.fontStyle || '').toLowerCase();
                    if (applyTypefaceStyleLower.indexOf('italic') !== -1 || applyTypefaceStyleLower.indexOf('oblique') !== -1) {
                        try {
                            var applyTypefaceSlantCheck = api.getAttributeDefinition(applyTypefaceId, "fontAxes.1");
                            if (applyTypefaceSlantCheck) {
                                api.set(applyTypefaceId, { "fontAxes.1": -12 });
                                console.log('[Variable Font] Apply Typeface: Set fontAxes.1 (slant) to -12 for ' + group.fontStyle);
                            }
                        } catch (eApplySlant) {
                            // Slant axis might not exist - silently ignore
                        }
                    }
                    
                    // Connect Apply Typeface to the text shape's styleBehaviours
                    api.connect(applyTypefaceId, 'id', id, 'styleBehaviours');
                    
                    // Parent Apply Typeface under the text shape for clean hierarchy
                    api.parent(applyTypefaceId, id);
                    
                } catch (eApply) {
                }
            }
        }
        
        // Apply fill colors as color shaders
        // When there are multiple fills, ALL should be colorShaders (stacking mode)
        // This matches how other shapes handle multi-fill (see quiver_svgParser.js)
        // SVG rendering order: first element is at BOTTOM, later elements are on TOP
        fills = fills || [];
        if (fills.length > 0) {
            
            // Extract _scaleY from svgTextChildren for gradient flip detection
            // Text nodes can have matrix transforms with Y-flips that affect gradient direction
            var textScaleY = 1;
            try {
                var svgTextArr = svgTextChildren || [];
                if (!Array.isArray(svgTextArr)) svgTextArr = [svgTextArr];
                for (var sci = 0; sci < svgTextArr.length; sci++) {
                    if (svgTextArr[sci] && svgTextArr[sci].attrs && svgTextArr[sci].attrs._scaleY !== undefined) {
                        textScaleY = svgTextArr[sci].attrs._scaleY;
                        break; // Use the first one found
                    }
                }
            } catch (eScaleY) {}
            
            // If multiple fills, use stacking mode (all colorShaders)
            // If single fill, set on material directly
            var useStackingMode = fills.length > 1;
            
            for (var fi = 0; fi < fills.length; fi++) {
                try {
                    var fillInfo = fills[fi];
                    var fillColor = fillInfo.color || '#000000';
                    var fillOpacity = fillInfo.opacity !== undefined ? fillInfo.opacity : 1;
                    
                    // Check if this fill is a gradient URL (e.g., url(#paint7_linear_...))
                    var gradientId = null;
                    if (fillColor && fillColor.indexOf('url(#') !== -1) {
                        // Extract gradient ID from url(#xxx) format
                        var urlMatch = fillColor.match(/url\(#([^)]+)\)/);
                        if (urlMatch && urlMatch[1]) {
                            gradientId = urlMatch[1];
                        }
                    }
                    
                    if (gradientId) {
                        // This is a gradient fill - use the gradient system
                        // getGradientShader and connectShaderToShape are from quiver_utilities_gradient.js
                        try {
                            var gradShader = getGradientShader(gradientId);
                            if (gradShader) {
                                // For text, we need to pass fill opacity to shader and scaleY for flip detection
                                var connectedOk = connectShaderToShape(gradShader, id, null, fillOpacity, textScaleY);
                                if (connectedOk) {
                                } else {
                                }
                            } else {
                            }
                        } catch (eGrad) {
                        }
                    } else {
                        // Parse hex color to RGB components
                        var hexClean = fillColor.replace('#', '');
                        var rVal = parseInt(hexClean.substring(0, 2), 16) || 0;
                        var gVal = parseInt(hexClean.substring(2, 4), 16) || 0;
                        var bVal = parseInt(hexClean.substring(4, 6), 16) || 0;
                        var aVal = Math.round(fillOpacity * 255);
                        
                        if (useStackingMode) {
                            // Multiple fills: ALL become colorShaders for proper stacking
                            // Use clean names with color hex for easy identification
                            var shaderName = 'Fill ' + (fi + 1) + ' ' + fillColor.toUpperCase();
                            var shaderId = api.create('colorShader', shaderName);
                            
                            // Set shaderColor with RGBA (correct Cavalry API)
                            api.set(shaderId, {
                                'shaderColor.r': rVal,
                                'shaderColor.g': gVal,
                                'shaderColor.b': bVal,
                                'shaderColor.a': aVal
                            });
                            
                            // Set alpha percentage
                            api.set(shaderId, {'alpha': Math.round(fillOpacity * 100)});
                            
                            // Connect to colorShaders
                            api.connect(shaderId, 'id', id, 'material.colorShaders');
                            
                            // Parent under the text shape
                            api.parent(shaderId, id);
                            
                        } else {
                            // Single fill: set on material directly
                            api.set(id, {"material.materialColor": fillColor});
                            if (fillOpacity < 1) {
                                api.set(id, {"material.alpha": fillOpacity * 100});
                            }
                        }
                    }
                } catch (eFillShader) {
                }
            }
        } else {
            // Fallback: use first segment's color or default black
            try {
                var fillColor = '#000000';
                if (figmaData.styledSegments && figmaData.styledSegments[0] && figmaData.styledSegments[0].fillColor) {
                    var fc = figmaData.styledSegments[0].fillColor;
                    fillColor = '#' + 
                        fc.r.toString(16).padStart(2, '0') + 
                        fc.g.toString(16).padStart(2, '0') + 
                        fc.b.toString(16).padStart(2, '0');
                }
                api.set(id, {"material.materialColor": fillColor});
            } catch (eFill) {}
        }
        
        // Register the created text shape for emoji positioning via Get Sub-Mesh Transform
        // This allows processEmojiData to find the text shape and connect emojis
        if (typeof registerCreatedTextShape === 'function') {
            registerCreatedTextShape(figmaData.name || name, id);
        }
        
        return id;
        
    } catch (e) {
        return null;
    }
}

// ----------------------------------------
// quiver_processAndImport.js
// ----------------------------------------
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
    } catch (e) {
        var errorMsg = e && e.message ? e.message : 'Import failed';
        // Skip undefined/null error messages
        if (errorMsg !== 'undefined' && errorMsg !== 'null') {
            console.error('Error: ' + errorMsg);
        }
    }
}

// ----------------------------------------
// quiver_utilities_webserver.js
// ----------------------------------------
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



ui.show();