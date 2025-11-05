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
const currentVersion = "1.5.0";

const SCRIPT_KEY = "com.canva.quiver"; 
ui.setTitle("Quiver");
ui.setBackgroundColor("#2d2d2d");



// ========================================
// Bundled Functions
// ========================================

// ----------------------------------------
// quiver_utilities_checkVersion.js
// ----------------------------------------
/**
 * Compare two semantic version strings (e.g., "1.0.0" vs "1.0.1")
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    const parts2 = v2.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    
    for (var i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    
    return 0;
}

function checkForUpdate() {
    if (api.hasPreferenceObject(SCRIPT_KEY)) {
        const prefs = api.getPreferenceObject(SCRIPT_KEY);
        const now = new Date().getTime();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // Uncomment this to reset the version check
        // api.setPreferenceObject(SCRIPT_KEY, {
        //     lastCheck: null,
        //     latestVersion: null,
        //     newVersionAvailable: false
        // });
        
        if (prefs.newVersionAvailable == true && prefs.lastCheck > oneDayAgo) {
            return;
        }

        
    }
    
    
    // Do the version check
    const client = new api.WebClient("https://api.github.com");
    client.get("/repos/phillip-motion/quiver/releases/latest");
    
    if (client.status() == 200) {
        const release = JSON.parse(client.body());
        let latestVersion = release.tag_name;
        
        // Remove 'v' prefix if present (e.g., "v1.0.0" -> "1.0.0")
        if (latestVersion.startsWith('v')) {
            latestVersion = latestVersion.substring(1);
        }
        
        var newVersionAvailable = false;
        
        // Compare versions properly
        if (compareVersions(latestVersion, currentVersion) > 0) {
            newVersionAvailable = true;
        }
        
        api.setPreferenceObject(SCRIPT_KEY, {
            lastCheck: new Date().getTime(),
            latestVersion: latestVersion,
            newVersionAvailable: newVersionAvailable
        });
       
    }
}

checkForUpdate();



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
var importImageryEnabled = true;
var importEffectsEnabled = true;
var imageFilterQuality = 2; // 0=None, 1=Bilinear, 2=Mipmaps (default), 3=Bicubic

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

    // Import gradients checkbox
    var gradientsLayout = new ui.HLayout();
    var importGradientsCheckbox = new ui.Checkbox(importGradientsEnabled);
    importGradientsCheckbox.onValueChanged = function() {
        importGradientsEnabled = importGradientsCheckbox.getValue();
    };
    gradientsLayout.add(importGradientsCheckbox);
    gradientsLayout.add(new ui.Label("Import gradients"));
    gradientsLayout.setSpaceBetween(6);
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
        importImageryEnabled = importImageryCheckbox.getValue();
        importEffectsEnabled = importEffectsCheckbox.getValue();
        imageFilterQuality = filterQualityDropdown.getValue();
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

    var finePrintCredit = new ui.Label("Made for the Canva Creative Team by Jack Jaeschke");
    finePrintCredit.setAlignment(1); // Center align
    finePrintCredit.setTextColor("#969696");
    settingsLayout.add(finePrintCredit);

    var openGitHubButton = new ui.Button("Open GitHub Repo");
    openGitHubButton.setMinimumHeight(24);
    openGitHubButton.onClick = function() {
        api.openURL("https://github.com/phillip-motion/quiver");
    };
    settingsLayout.add(openGitHubButton);

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
newVersionAvailable.setRadius(3,3,3,3);
newVersionAvailable.setLayout(newVersionAvailableLayout);

if (api.getPreferenceObject(SCRIPT_KEY).newVersionAvailable == true) {
    mainLayout.add(newVersionAvailable);
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
        // Replace illegal/suspicious chars with underscore
        s = s.replace(/[^A-Za-z0-9._-]+/g, '_');
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

function connectShaderToShape(shaderId, shapeId) {
    try { 
        api.setFill(shapeId, true); 
        
    } catch (e) {}
    
    // Critical: hide base color so shader is visible
    try { 
        api.set(shapeId, {"material.materialColor.a": 0}); 
        
    } catch (eA) {}
    
    try {
        api.connect(shaderId, 'id', shapeId, 'material.colorShaders');

        // Ensure shader is visible (not hidden)
        try {
            api.set(shaderId, {'hidden': false});
            
        } catch (eVis) {}
        
        // For userSpaceOnUse gradients with stored absolute positions, calculate relative offset
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
                if (!gradientData) {
                    
                } else {
                    try { 

                        if (gradientData._absoluteCenterX !== undefined) {

                        }
                    } catch (e0) {}
                }
            } else {
                
            }
            
            if (gradientData && gradientData._absoluteCenterX !== undefined && gradientData._absoluteCenterY !== undefined) {
                // Ensure we have valid numbers
                var absX = parseFloat(gradientData._absoluteCenterX);
                var absY = parseFloat(gradientData._absoluteCenterY);
                
                if (isNaN(absX) || isNaN(absY)) {
                    
                    return;
                }

                // Get shape's bounding box to find its center
                var bbox = null;
                try {
                    // Try without the second parameter first
                    bbox = api.getBoundingBox(shapeId);
                } catch (eBbox1) {
                    try {
                        // If that fails, try with the second parameter
                        bbox = api.getBoundingBox(shapeId, true);
                    } catch (eBbox2) {
                        
                    }
                }
                if (bbox) {

                    // Use bbox.centre if available, otherwise calculate from bounds
                    var shapeCenterX, shapeCenterY;
                    if (bbox.centre) {
                        shapeCenterX = bbox.centre.x;
                        shapeCenterY = bbox.centre.y;
                        
                    } else if (bbox.x !== undefined && bbox.y !== undefined && bbox.width !== undefined && bbox.height !== undefined) {
                        shapeCenterX = bbox.x + bbox.width / 2;
                        shapeCenterY = bbox.y + bbox.height / 2;
                        
                    } else {
                        
                        return;
                    }
                    
                    // Get the gradient's absolute position (in SVG coordinates)
                    var gradientSvgX = absX;
                    var gradientSvgY = absY;
                    
                    // For userSpaceOnUse, the gradient position is in absolute SVG coordinates
                    // We need to convert to Cavalry coordinates
                    // In Cavalry, shapes are positioned with their center at their position
                    // So we calculate the offset from the shape's center
                    
                    // Since the shape is already positioned in Cavalry coordinates,
                    // and we have the gradient's SVG coordinates, we need to find the relative offset
                    
                    // Get the shape's position (which is its center in Cavalry)
                    var shapePos = null;
                    try {
                        shapePos = api.get(shapeId, 'position');
                    } catch (ePos) {
                        
                    }
                    
                    if (shapePos) {
                        // The gradient's position in SVG needs to be converted to be relative to the shape's position
                        // Since 0,0 in generator.offset is the shape's center, we calculate:
                        var relativeOffsetX = gradientSvgX - shapeCenterX;
                        var relativeOffsetY = -(gradientSvgY - shapeCenterY); // Invert Y for SVG->Cavalry conversion
                        
                        try { 

                            if (shapePos) {

                            }

                        } catch (e0) {}
                        
                        // Update the gradient's offset
                        try {
                            // Validate the offset values before setting
                            if (isNaN(relativeOffsetX) || isNaN(relativeOffsetY)) {
                                
                                return;
                            }
                            
                            api.set(shaderId, {"generator.offset.x": relativeOffsetX, "generator.offset.y": relativeOffsetY});
                            
                        } catch (eOffset) {
                            
                        }
                    }
                }
            } else {
                
            }
        } catch (eCalcOffset) {
            
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

function connectShaderToStroke(shaderId, shapeId) {
    try { api.setStroke(shapeId, true); } catch (e) {}
    // Reveal shader by hiding base stroke color
    try { api.set(shapeId, {"stroke.strokeColor.a": 0}); } catch (eA) {}
    try {
        api.connect(shaderId, 'id', shapeId, 'stroke.colorShaders');
        
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
    if (!hexColor || hexColor[0] !== '#') return hexColor;
    var h = hexColor.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    } else if (h.length === 8) {
        h = h.slice(2);
        if (h.length !== 6) h = h.slice(0, 6);
    }
    if (h.length !== 6) return hexColor;
    var a = Math.max(0, Math.min(1, opacity));
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

        var shaderId = api.create('gradientShader', 'Gradient ' + gradientData.id);

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
            // Set radius mode based on gradientUnits
            try {
                var radiusMode = 1; // Default to Bounding Box
                if (gradientData.gradientUnits === 'userSpaceOnUse') {
                    radiusMode = 0; // Fixed for absolute coordinates
                }
                api.set(shaderId, {"generator.radiusMode": radiusMode});
            } catch (eRM) {
                // Error setting radiusMode
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
                var colAttr = {}; 
                colAttr['generator.gradient.' + i + '.color'] = colorWithOpacity(stop.color, stop.opacity); 
                api.set(shaderId, colAttr);
            } catch (eCol) {
                
            }
        }
        
        return shaderId;
    } catch (e) {
        
        return null;
    }
}


// ----------------------------------------
// quiver_utilities_patterns.js
// ----------------------------------------
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
            if (im) {
                var imgOpen = im[0];
                var href = extractAttribute(imgOpen, 'href') || extractAttribute(imgOpen, 'xlink:href');
                var ix = extractAttribute(imgOpen, 'x');
                var iy = extractAttribute(imgOpen, 'y');
                var iw = extractAttribute(imgOpen, 'width');
                var ih = extractAttribute(imgOpen, 'height');
                image = { href: href||'', x: ix||'0', y: iy||'0', width: iw||attrs.width||'0', height: ih||attrs.height||'0' };
            }
            // Or <use xlink:href="#imageId">
            if (!image) {
                var useMatch = /<use[^>]*>/ig.exec(body);
                if (useMatch) {
                    var useOpen = useMatch[0];
                    var hrefUse = extractAttribute(useOpen, 'href') || extractAttribute(useOpen, 'xlink:href');
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
            patterns[pid] = { attrs: attrs, image: image };
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
    return id;
}

// ----------------------------------------
// quiver_utilities_filters.js
// ----------------------------------------
// --- Filters (Drop Shadows, Blur, etc.) ---
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
    if (morphs.length > 0) {
        for (var i = 0; i < morphs.length; i++) {
            var start = morphs[i].idx + morphs[i].el.length;
            var end = (i+1 < morphs.length) ? morphs[i+1].idx : filterContent.length;
            var seg = filterContent.slice(start, end);
            var op = (_gradGetAttr(morphs[i].el, 'operator')||'').toLowerCase();
            var r = parseFloat(_gradGetAttr(morphs[i].el, 'radius') || '0');
            var spread = 0; if (op === 'dilate') spread = +Math.max(0,r); else if (op === 'erode') spread = -Math.max(0,r);
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
                // Find next feBlend or end of filter as segment boundary
                var blendRe = /<feBlend[^>]*result\s*=\s*"[^"]*dropShadow[^"]*"[^>]*>/g;
                blendRe.lastIndex = start;
                var blendMatch = blendRe.exec(filterContent);
                if (blendMatch) {
                    end = blendMatch.index + blendMatch[0].length;
                }
                
                var seg = filterContent.slice(start, end);
                var vals = parseValuesFromSegment(seg);
                if (vals.color || vals.dx !== 0 || vals.dy !== 0 || vals.blur !== 8/3) {
                    var passObj = { dx: vals.dx, dy: vals.dy, blur: vals.blur, color: vals.color || '#000000', alpha: vals.alpha, spread: 0 };
                    passes.push(passObj);
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
    if (passes.length === 0) {
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
        try { api.connect(nodeId, 'id', shapeId, 'filters'); } catch (eC) {
            try { api.connect(nodeId, 'id', shapeId, 'deformers'); } catch (eC2) {}
        }
        // Parent under the shape if not already parented
        try { if (!api.getParent(nodeId)) api.parent(nodeId, shapeId); } catch (eP) {}
        return nodeId;
    } catch (e) { return null; }
}

function _registerChild(parentId, childId) {
    try {
        if (parentId == null) return;
        if (!__groupDirectChildren[parentId]) __groupDirectChildren[parentId] = [];
        __groupDirectChildren[parentId].push(childId);
    } catch (e) {}
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
    var regex = /<(svg|g|rect|circle|ellipse|text|path|polygon|polyline|image|pattern|defs|clipPath|mask|use)([^>]*)>|<\/\s*(svg|g|text|defs|clipPath|mask|pattern)\s*>|<tspan([^>]*)>(.*?)<\/tspan>/g;
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
                var directAttrs = ['id','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','font-style','letter-spacing','x','y','mask','clip-path','filter'];
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
                var keys = ['id','x','y','width','height','rx','ry','cx','cy','r','rx','ry','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','mask','clip-path','filter'];
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
                var ikeys = ['id','x','y','width','height','opacity','transform','preserveAspectRatio','mask','clip-path','filter'];
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
                var ukeys = ['id','x','y','width','height','opacity','transform','mask','clip-path','filter'];
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
                var pkeys = ['id','d','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','fill-rule','clip-rule','mask','clip-path','filter'];
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
                var vkeys = ['id','points','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','transform','mask','clip-path','filter'];
                for (var vj = 0; vj < vkeys.length; vj++) {
                    var vk = vkeys[vj];
                    var vv2 = extractAttribute(opening, vk);
                    if (vv2 !== null) vnode.attrs[vk] = vv2;
                }
                var inline4 = mergeInlineStyleIntoAttrs(opening);
                for (var k4 in inline4) vnode.attrs[k4] = inline4[k4];
                stack[stack.length - 1].children.push(vnode);
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
            // Decode HTML entities (e.g., &#x2019; → ’)
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
                if (kind === 'rect') ok = tryMergeRectPair(a,b); else ok = tryMergeEllipsePair(a,b);
                if (ok) break;
            }
        }
    }
    var rectEntries = buildEntries('rect');
    var ellipseEntries = buildEntries('ellipse');
    mergeForTypeEntries(rectEntries, 'rect');
    mergeForTypeEntries(ellipseEntries, 'ellipse');
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

        var gradientId = extractUrlRefId(fill);
        var strokeGradientId = extractUrlRefId(stroke);

        // Fill
        if (!fill || fill === 'none') {
            api.setFill(layerId, false);
        } else {
            api.setFill(layerId, true);
            var fo = parseOpacityValue(fillOpacity); if (fo === null) fo = 1;
            var o = parseOpacityValue(opacity); if (o === null) o = 1;
            var effectiveAlpha = clamp01(fo * o);
            // If gradient fill, don't set base material color to an invalid string; just set alpha
            if (gradientId) {
                // Let shader show through: base color alpha 0
                try { api.set(layerId, {"material.materialColor.a": 0}); } catch (e0) {}
                try { api.set(layerId, { "material.alpha": Math.round(effectiveAlpha * 100) }); } catch (e1) {}
                // Attempt gradient connect first
                var shaderOk = false;
                try {
                    var sh = getGradientShader(gradientId);
                    if (sh) { shaderOk = connectShaderToShape(sh, layerId); }
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
                            // Align and scale inside the target shape
                            try {
                                // Prefer centre alignment behaviour (only if attribute exists)
                                try { if (_hasAttr(shaderNode, 'legacyGraph')) api.set(shaderNode, { 'legacyGraph': false }); } catch (eLG) {}
                                // Set Scale Mode using numeric enums only to avoid parse errors
                                var modes = [4,3,2,1];
                                var setDone = false;
                                for (var mi = 0; mi < modes.length && !setDone; mi++) {
                                    try { api.set(shaderNode, { 'scaleMode': modes[mi] }); setDone = true; } catch (eSMA) { setDone = false; }
                                    if (!setDone) { try { api.set(shaderNode, { 'generator.scaleMode': modes[mi] }); setDone = true; } catch (eSMB) { setDone = false; } }
                                }
                                // Set tiling to Decal via enum index only (avoid string parse errors). Likely 0=Clamp,1=Repeat,2=Mirror,3=Decal
                                try { api.set(shaderNode, { 'tilingX': 3 }); } catch (eTX1) { try { api.set(shaderNode, { 'generator.tilingX': 3 }); } catch (eTX2) {} }
                                try { api.set(shaderNode, { 'tilingY': 3 }); } catch (eTY1) { try { api.set(shaderNode, { 'generator.tilingY': 3 }); } catch (eTY2) {} }
                                // Set filter quality based on user setting (0=None, 1=Bilinear, 2=Mipmaps, 3=Bicubic)
                                var fqOk = false;
                                try { api.set(shaderNode, { 'filterQuality': imageFilterQuality }); fqOk = true; } catch (eFQ1) { fqOk = false; }
                                if (!fqOk) { try { api.set(shaderNode, { 'generator.filterQuality': imageFilterQuality }); } catch (eFQ2) {} }
                                // Reset offset to centre
                                _setFirstSupported(shaderNode, ['offset','generator.offset'], [0,0]);
                            } catch (eAlign) {}
                            __patternImageShaderCache[pid] = shaderNode;
                            }
                        }
                    } catch (eImgPat) {}
                }
            } else {
                var color = parseColor(fill) || "#000000";
                api.set(layerId, {
                    "material.materialColor": color,
                    "material.alpha": Math.round(effectiveAlpha * 100)
                });
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
            var effA = clamp01(so * o2);
            if (strokeGradientId) {
                api.set(layerId, { "stroke.strokeColor": scolor, "stroke.strokeColor.a": 0, "stroke.width": sw, "stroke.alpha": Math.round(effA * 100) });
                var shStroke = getGradientShader(strokeGradientId);
                if (shStroke) connectShaderToStroke(shStroke, layerId);
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
function createGroup(name, parentId) {
    var id = api.create('group', name);
    if (parentId) api.parent(id, parentId);
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
    if (attrs) applyFillAndStroke(id, attrs);
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
    var name = node.name || 'rect';
    var id = api.primitive('rectangle', name);
    if (parentId) api.parent(id, parentId);

    var x = parseFloat(node.attrs.x || '0');
    var y = parseFloat(node.attrs.y || '0');
    var w = parseFloat(node.attrs.width || '0');
    var h = parseFloat(node.attrs.height || '0');
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
        // carry styles/transform, including our precomputed stroke alignment hint
        var styleKeys = ['fill','fill-opacity','stroke','stroke-width','stroke-opacity','opacity','transform','_stroke_align'];
        for (var si = 0; si < styleKeys.length; si++) {
            var k = styleKeys[si];
            if (node.attrs[k] !== undefined) ellipseNode.attrs[k] = node.attrs[k];
        }
        return createEllipse(ellipseNode, parentId, vb);
    }
    var rCorner = (rxv && ryv) ? Math.min(rxv, ryv) : (rxv || ryv || 0);
    var cr = Math.max(0, Math.min(rCorner, Math.min(w, h) / 2));

    var centre = svgToCavalryPosition(x + w/2, y + h/2, vb);
    api.set(id, {
        "generator.dimensions": [w, h],
        "position.x": centre.x,
        "position.y": centre.y
    });
    if (cr > 0) api.set(id, {"generator.cornerRadius": cr});

    applyFillAndStroke(id, node.attrs);
    // Gradient hookup
    try {
        var gradId = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId) {
            
            var shader = getGradientShader(gradId);
            if (shader) connectShaderToShape(shader, id);
        }
    } catch (eG) {}
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
    api.set(id, {
        "generator.radius": [r, r]
    });
    var pos = svgToCavalryPosition(cx, cy, vb);
    api.set(id, {"position.x": pos.x, "position.y": pos.y});
    applyFillAndStroke(id, node.attrs);
    try {
        var gradId = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId) {
            
            var shader = getGradientShader(gradId);
            if (shader) connectShaderToShape(shader, id);
        }
    } catch (eG) {}
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
    api.set(id, {
        "generator.radius": [rx, ry]
    });
    var pos = svgToCavalryPosition(cx, cy, vb);
    api.set(id, {"position.x": pos.x, "position.y": pos.y});
    applyFillAndStroke(id, node.attrs);
    try {
        var gradId = extractUrlRefId(node.attrs.fill || (node.attrs.style && extractStyleProperty(node.attrs.style, 'fill')));
        if (gradId) {
            
            var shader = getGradientShader(gradId);
            if (shader) connectShaderToShape(shader, id);
        }
    } catch (eG) {}
    // rotate(cx,cy) compensation
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

function createText(node, parentId, vb, inheritedScale) {
    try {
    inheritedScale = inheritedScale || {x:1, y:1};
    if (!node.tspans || node.tspans.length === 0) return null;
        
        // Skip text creation if disabled in settings
        if (!importLiveTextEnabled) {

            return null;
        }
    
    // Smart joining: check if tspans are on the same line (same Y position) or different lines
    // If Y positions are very close (within 1px), they're on the same line - no newline
    // If Y positions differ significantly, insert newline
    var combined = '';
    for (var ti = 0; ti < node.tspans.length; ti++) {
        if (ti > 0) {
            var prevY = node.tspans[ti - 1].y;
            var currY = node.tspans[ti].y;
            var yDiff = Math.abs(currY - prevY);
            // If Y difference is more than 1px, they're on different lines
            if (yDiff > 1) {
                combined += '\n';
            }
        }
        combined += node.tspans[ti].text;
    }
    
    try { combined = decodeEntitiesForName(combined); } catch (eDecAll) {}
    var name = combined.split(/\s+/).slice(0,3).join(' ');
    if (!name) name = node.name || 'text';

    var id = api.create('textShape', name);
    if (parentId) api.parent(id, parentId);

    var first = node.tspans[0];
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

    // Compute line spacing from explicit line-height or tspans (multi-line)
    var lineSpacingOffset = 0;
    try {
        var lineHeightRaw = node.attrs['line-height'] || extractStyleProperty(node.attrs.style, 'line-height');
        function _lineHeightToPx(val, fs) {
            if (val === null || val === undefined || val === '') return null;
            var s = ('' + val).trim().toLowerCase();
            if (s === 'normal') return null; // use default
            if (s.indexOf('px') !== -1) { var npx = parseFloat(s.replace('px','')); return isNaN(npx)?null:npx; }
            if (s.indexOf('%') !== -1) { var p = parseFloat(s.replace('%','')); return isNaN(p)?null:(fs * (p/100)); }
            if (s.indexOf('em') !== -1) { var em = parseFloat(s.replace('em','')); return isNaN(em)?null:(fs * em); }
            var n = parseFloat(s);
            if (!isNaN(n)) {
                // Bare number in CSS is a multiplier
                if (s === (''+n)) return fs * n;
                return n; // assume px if unitless parse failed to match exactly
            }
            return null;
        }
        var defaultLineHeight = fontSize * 1.407; // Cavalry default approximation
        var lhPx = _lineHeightToPx(lineHeightRaw, fontSize);
        if (lhPx !== null && isFinite(lhPx)) {
            lineSpacingOffset = lhPx - defaultLineHeight;
        } else if (node.tspans && node.tspans.length > 1) {
            var diffs = []; 
            for (var li = 1; li < node.tspans.length; li++) { 
                var dy = (node.tspans[li].y - node.tspans[li-1].y); 
                if (isFinite(dy)) diffs.push(dy); 
            }
            if (diffs.length > 0) {
                var sum = 0; for (var di = 0; di < diffs.length; di++) sum += diffs[di];
                var avg = sum / diffs.length;
                // Only apply line spacing if there are actual line breaks (Y diff > 1px)
                // If all tspans are on same line (Y diff ~0), don't set line spacing
                if (Math.abs(avg) > 1) {
                    lineSpacingOffset = avg - defaultLineHeight;
                }
            }
        }
    } catch (eLS) { lineSpacingOffset = 0; }

    var textSettings = {
        "text": combined,
        "fontSize": fontSize,
        "font.font": family,
        "font.style": finalStyle,
        "autoWidth": true,
        "autoHeight": true,
        "position.x": pos.x,
        "position.y": pos.y,
        "verticalAlignment": 3
    };
    // letter spacing
    var letterSpacingRaw = node.attrs['letter-spacing'] || extractStyleProperty(node.attrs.style, 'letter-spacing');
    var letterSpacingRatio = null; // Track ratio for expression connection
    if (letterSpacingRaw && ('' + letterSpacingRaw).toLowerCase() !== 'normal') {
        var lsStr = ('' + letterSpacingRaw).trim();
        var lsNum = 0;
        
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
        
        if (!isNaN(lsNum) && lsNum !== 0) textSettings["letterSpacing"] = lsNum;
    }
    // line spacing (only meaningful when multi-line)
    if (lineSpacingOffset && node.tspans && node.tspans.length > 1) {
        try { textSettings["lineSpacing"] = lineSpacingOffset; } catch (eSetLS) {}
    }
    api.set(id, textSettings);

    // Connect fontSize to letterSpacing with expression to maintain ratio
    if (letterSpacingRatio !== null && !isNaN(letterSpacingRatio) && letterSpacingRatio !== 0) {
        try {
            // Create the connection from fontSize to letterSpacing
            api.connect(id, "fontSize", id, "letterSpacing");
            
            // Build expression: multiply fontSize (value) by ratio
            // Format ratio to avoid floating point issues (limit to 6 decimal places)
            var ratioStr = letterSpacingRatio.toFixed(6);
            var expression = ratioStr + "*value";
            
            // Apply the expression to letterSpacing
            api.setAttributeExpression(id, "letterSpacing", expression);
        } catch (eExpr) {
            // If expression fails, the static value is already set
            console.log("Note: Could not set letter-spacing expression for " + name);
        }
    }

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
    if (forceHideFillAlpha) {
        try { api.set(id, {"material.materialColor.a": 0}); } catch (eHide) {}
    }
    // Hook up fill gradient (if any) to the text shape
    try {
        var gradIdT = extractUrlRefId(attrsForTextStyle.fill || (attrsForTextStyle.style && extractStyleProperty(attrsForTextStyle.style, 'fill')));
        if (gradIdT) {
            var shaderT = getGradientShader(gradIdT);
            if (shaderT) connectShaderToShape(shaderT, id);
        }
    } catch (eGT) {}

    return id;
    } catch (e) {
        // Silent fail when text import is disabled or other errors occur

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
            console.log('Skipping empty group:', node.name);
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
                    importNode(node.children[fi], parentId, vb, {x:0,y:0}, stats, model, false, inheritedScale, parentMatrix);
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
        }
        
        // Then apply node's own transform if it has one
        if (node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1) {
            // Apply matrix transform to each tspan position
            for (var k = 0; k < cloneT.tspans.length; k++) {
                var transformed = applyMatrixToPoint(node.attrs.transform, cloneT.tspans[k].x, cloneT.tspans[k].y);
                cloneT.tspans[k].x = transformed.x + inheritedTranslate.x;
                cloneT.tspans[k].y = transformed.y + inheritedTranslate.y;
            }
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
    if (node.type === 'path' || node.type === 'polygon' || node.type === 'polyline') {
        var translateAll = {x: nodeT.x + inheritedTranslate.x, y: nodeT.y + inheritedTranslate.y};
        
        // Check if we have a matrix transform - if so, we need to transform all points
        var hasMatrix = node.attrs && node.attrs.transform && node.attrs.transform.indexOf('matrix') !== -1;
        
        // If we have a parent matrix, we need to apply it to the path data
        var hasParentMatrix = !!parentMatrix;
        
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
        
        // Reset group counter for consistent numbering per import
        __groupCounter = 0;

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
            importNode(model.children[i], rootId, vb, {x:0,y:0}, stats, model, false, {x:1,y:1}, null);
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

// Initialize the server
initializeQuiverWebServer();

// Module loaded successfully
undefined;



ui.show();