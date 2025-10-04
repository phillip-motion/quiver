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
mainLayout.setSpaceBetween(4);
mainLayout.setMargins(4, 4, 4, 4);

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

var logo = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_logo.png");
logo.setImageSize(106, 35);
logo.setDrawStroke(false);
logo.setTransparentForMouseEvents(true);
headerLayout.add(logo);
headerLayout.addStretch();
headerLayout.add(settingsButton);
mainLayout.add(headerLayout);

// Import Section
var mainButtons = new ui.HLayout();
mainButtons.setSpaceBetween(6);
mainButtons.add(pasteButton);
mainButtons.add(importFileButton);
mainLayout.add(mainButtons);

mainLayout.addSpacing(8);

// Tool buttons
var toolsLabel = new ui.Label("Tools");
toolsLabel.setTextColor("#969696");
mainLayout.add(toolsLabel);

// Main tool buttons
var toolButtonsLayout = new ui.HLayout();
toolButtonsLayout.setSpaceBetween(6);
toolButtonsLayout.add(convertRectButton);
toolButtonsLayout.add(dynamicAlignButton);
toolButtonsLayout.add(flattenShapeButton);
toolButtonsLayout.addStretch();
mainLayout.add(toolButtonsLayout);

// Rename section - more compact

var renameLayout = new ui.HLayout();
renameLayout.add(renamerInput);
renameLayout.add(renamerButton);
mainLayout.add(renameLayout);

mainLayout.addStretch();

ui.add(mainLayout);
ui.setMinimumWidth(200);
ui.show();