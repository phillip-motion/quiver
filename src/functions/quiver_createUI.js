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

var cycleTextAlignButton = new ui.ImageButton(ui.scriptLocation+"/quiver_assets/quiver_icon-text-left.png");
cycleTextAlignButton.setImageSize(22,22);
cycleTextAlignButton.setSize(34, 34);
cycleTextAlignButton.setToolTip("Text Alignment");
cycleTextAlignButton.onClick = function() {
    cycleTextAlignment();
    // Update icon after cycling alignment
    updateTextAlignIcon();
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
 * horizontalAlignment values: 0 = Left, 1 = Center, 2 = Right
 */
function updateTextAlignIcon() {
    try {
        var selection = api.getSelection();
        
        // Default to left-aligned icon when no text is selected
        var iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-left.png";
        
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
                        // 0 = Left, 1 = Center, 2 = Right
                        if (alignment === 1) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-center.png";
                        } else if (alignment === 2) {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-right.png";
                        } else {
                            iconPath = ui.scriptLocation + "/quiver_assets/quiver_icon-text-left.png";
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
// Register callback to update text alignment icon when selection changes
// Cavalry API: ui.addCallbackObject() registers an object with callback functions
// onSelectionChanged is called whenever the scene selection changes
function SelectionCallbacks() {
    this.onSelectionChanged = function() {
        updateTextAlignIcon();
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