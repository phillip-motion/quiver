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