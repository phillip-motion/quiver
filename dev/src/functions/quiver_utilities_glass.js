// --- Figma Glass → Cavalry jackJaeschke::glass ---
// Glass is not present in Figma SVG export. The Figma plugin sends a glassData
// sidecar; we match it onto imported layers and wire Cavalry's third-party Glass
// filter the same way Background Blur finds overlapping underlying siblings.

var GLASS_LAYER_TYPE = 'jackJaeschke::glass';
var GLASS_ANCHOR_NAME = 'Glass Anchor (auto)';

// Populated by the production build. Dev uses ui.scriptLocation/plugins/Glass.
// Keep any pre-set embed from the production bundle (assigned before this file).
var QUIVER_GLASS_TEXT_FILES = (typeof QUIVER_GLASS_TEXT_FILES === 'object' && QUIVER_GLASS_TEXT_FILES) ? QUIVER_GLASS_TEXT_FILES : null;

var __figmaGlassEntries = [];
var __deferredGlass = [];
var __glassOverlayShapes = {};
var __glassInstallAttempted = false;
var __glassNeedsRestart = false;

function setFigmaGlassData(glassDataArray) {
    __figmaGlassEntries = [];
    if (!glassDataArray || !glassDataArray.length) return;
    for (var i = 0; i < glassDataArray.length; i++) {
        var raw = glassDataArray[i];
        if (!raw) continue;
        var name = raw.name ? String(raw.name) : '';
        var svgId = raw.svgId ? String(raw.svgId) : name;
        __figmaGlassEntries.push({
            name: name,
            svgId: svgId,
            nodeType: raw.nodeType ? String(raw.nodeType) : '',
            params: mapFigmaGlassParams(raw)
        });
    }
}

function clearFigmaGlassData() {
    __figmaGlassEntries = [];
}

function map01To100(value, fallback) {
    if (typeof value !== 'number' || isNaN(value)) return fallback;
    if (value <= 1) return value * 100;
    return value;
}

function clampNum(value, min, max, fallback) {
    if (typeof value !== 'number' || isNaN(value)) return fallback;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function mapFigmaGlassParams(raw) {
    var splay = 0;
    if (typeof raw.splay === 'number' && !isNaN(raw.splay)) {
        splay = map01To100(raw.splay, 0);
    }
    return {
        refraction: clampNum(map01To100(raw.refraction, 70), 0, 100, 70),
        depth: clampNum(raw.depth, 1, 100, 20),
        dispersion: clampNum(map01To100(raw.dispersion, 35), 0, 100, 35),
        frost: clampNum(raw.radius, 0, 100, 5),
        lightAngle: (typeof raw.lightAngle === 'number' && !isNaN(raw.lightAngle)) ? raw.lightAngle : -45,
        lightIntensity: clampNum(map01To100(raw.lightIntensity, 80), 0, 100, 80),
        splay: clampNum(splay, 0, 100, 0)
    };
}

function _glassIdMatches(id, candidate) {
    if (!id || !candidate) return false;
    if (id === candidate) return true;
    if (id === candidate.replace(/\s+/g, '_')) return true;
    if (id === candidate.replace(/_/g, ' ')) return true;
    return false;
}

function consumeFigmaGlassByName(name) {
    if (!name || !__figmaGlassEntries.length) return null;
    var decoded = name;
    try { decoded = decodeEntitiesForName(name) || name; } catch (eDec) {}
    // PASS 1: exact svgId match - the sidecar numbers duplicates the same
    // way the SVG exporter does, so this is authoritative.
    for (var i = 0; i < __figmaGlassEntries.length; i++) {
        var entry = __figmaGlassEntries[i];
        if (_glassIdMatches(entry.svgId, name) || _glassIdMatches(entry.svgId, decoded)) {
            __figmaGlassEntries.splice(i, 1);
            return entry;
        }
    }
    // PASS 2: name fallback, but ONLY for unnumbered entries (svgId ===
    // name). A numbered entry (Button_2) matched by bare name would let a
    // same-named NON-glass node drawn earlier steal it - which is exactly
    // how a plain 'Button' used to swallow a glass button's entry.
    for (var j = 0; j < __figmaGlassEntries.length; j++) {
        var entry2 = __figmaGlassEntries[j];
        if (entry2.svgId !== entry2.name) continue;
        if (_glassIdMatches(entry2.name, name) || _glassIdMatches(entry2.name, decoded)) {
            __figmaGlassEntries.splice(j, 1);
            return entry2;
        }
    }
    return null;
}

function attachFigmaGlassToNode(node) {
    if (!node) return;
    if (!node.attrs) node.attrs = {};
    if (node.attrs._figmaGlass) return;
    var candidate = (node.attrs.id) || node.name;
    var entry = consumeFigmaGlassByName(candidate);
    if (entry) {
        node.attrs._figmaGlass = entry.params;
        // a Figma FRAME's glass pane is its own bounds (the background rect
        // the exporter synthesises = first geometry child). Any other node
        // type - a vector/boolean split into several SVG paths, or a plain
        // group - panes as its CONTENT silhouette, so EVERY geometry child
        // must become a matte, not just the first.
        var nt = entry.nodeType || '';
        node.attrs._figmaGlassAllPaths = !(nt === 'FRAME' || nt === 'COMPONENT' || nt === 'INSTANCE');
    }
}

function propagateFigmaGlassToChild(fromNode, toNode) {
    if (!fromNode || !toNode) return;
    if (!fromNode.attrs || !fromNode.attrs._figmaGlass) return;
    if (!toNode.attrs) toNode.attrs = {};
    if (toNode.attrs._figmaGlass) return;
    toNode.attrs._figmaGlass = fromNode.attrs._figmaGlass;
}

function queueGlass(overlayShapeId, params, parentId) {
    if (!importEffectsEnabled) return;
    if (!overlayShapeId || !params) return;
    __glassOverlayShapes[overlayShapeId] = true;
    __deferredGlass.push({
        overlayShapeId: overlayShapeId,
        params: params,
        parentId: parentId
    });
}

/**
 * Glass mattes need an opaque fill (Fill Alpha 100%). Figma stores the
 * overlay transparency on the fill instead, so move that onto the shape's
 * Opacity and force fill alpha to 100%.
 */
function applyGlassMatteFillOpacityToShape(shapeId) {
    if (!shapeId) return;
    try {
        var fillFactor = 1;

        // NOTE: api.get returns FIXED scales - material.alpha is 0-100,
        // materialColor.a is 0-255, opacity is 0-100. Never scale-guess with
        // a (value > 1) heuristic: a material.alpha of exactly 1 means 1%,
        // and near-transparent fills are precisely what this function exists
        // to rescue (a 1% guess-as-opaque early-returned and shipped starved
        // glass mattes - found 2026-08-23 on a 0.4% Figma glass fill).
        var materialAlpha = null;
        try { materialAlpha = api.get(shapeId, 'material.alpha'); } catch (eMA) {}
        if (typeof materialAlpha === 'number' && !isNaN(materialAlpha)) {
            fillFactor *= materialAlpha / 100;
        }

        var colorA = null;
        try { colorA = api.get(shapeId, 'material.materialColor.a'); } catch (eCA) {}
        var shaderFill = (typeof colorA === 'number' && colorA === 0);
        if (!shaderFill && typeof colorA === 'number' && !isNaN(colorA)) {
            fillFactor *= colorA / 255;
        }

        try {
            var kids = api.getChildren(shapeId) || [];
            for (var i = 0; i < kids.length; i++) {
                var kidType = '';
                try { kidType = String(api.getLayerType(kids[i])); } catch (eT) { continue; }
                if (kidType.indexOf('Shader') === -1 && kidType.indexOf('shader') === -1 && kidType.indexOf('gradient') === -1) {
                    continue;
                }
                shaderFill = true;
                try {
                    var shaderAlpha = api.get(kids[i], 'alpha');
                    if (typeof shaderAlpha === 'number' && !isNaN(shaderAlpha) && shaderAlpha < 99.9) {
                        fillFactor *= shaderAlpha / 100;
                    }
                } catch (eSA) {}
                // gradient and image shaders have no shaderColor (their
                // alpha lives elsewhere) - probing it makes Cavalry log a
                // console error even inside try/catch
                if (kidType.indexOf('gradient') === -1 && kidType.toLowerCase().indexOf('image') === -1) {
                    try {
                        var shaderColorA = api.get(kids[i], 'shaderColor.a');
                        if (typeof shaderColorA === 'number' && !isNaN(shaderColorA) && shaderColorA > 0 && shaderColorA < 254.5) {
                            fillFactor *= shaderColorA / 255;
                        }
                    } catch (eSCA) {}
                }
            }
        } catch (eKids) {}

        if (fillFactor >= 0.999) return;

        // opacity is 0-100 from api.get - use it as-is (a 1%-opacity shape must
        // not be scale-guessed into 100%)
        var shapeOpacity = 100;
        try {
            var existingOp = api.get(shapeId, 'opacity');
            if (typeof existingOp === 'number' && !isNaN(existingOp)) shapeOpacity = existingOp;
        } catch (eOp) {}

        var newShapeOpacity = Math.max(0, Math.min(100, shapeOpacity * fillFactor));

        try { api.set(shapeId, { 'material.alpha': 100 }); } catch (eSetMA) {}
        if (!shaderFill) {
            try { api.set(shapeId, { 'material.materialColor.a': 255 }); } catch (eSetCA) {}
        }
        try { api.set(shapeId, { 'opacity': newShapeOpacity }); } catch (eSetOp) {}

        try {
            var shaderKids = api.getChildren(shapeId) || [];
            for (var s = 0; s < shaderKids.length; s++) {
                var setType = '';
                try { setType = String(api.getLayerType(shaderKids[s])); } catch (eST) { continue; }
                if (setType.indexOf('Shader') === -1 && setType.indexOf('shader') === -1 && setType.indexOf('gradient') === -1) {
                    continue;
                }
                try { api.set(shaderKids[s], { 'alpha': 100 }); } catch (eSetSA) {}
                if (setType.indexOf('gradient') === -1 && setType.toLowerCase().indexOf('image') === -1) {
                    try { api.set(shaderKids[s], { 'shaderColor.a': 255 }); } catch (eSetSCA) {}
                }
            }
        } catch (eSetKids) {}
    } catch (eFix) {
        console.warn('[Glass] Could not move fill alpha onto shape opacity: ' + eFix.message);
    }
}

function maybeQueueFigmaOverlayEffects(shapeId, node, parentId) {
    if (!shapeId || !node) return;
    try {
        attachFigmaGlassToNode(node);
        if (node.attrs && node.attrs._figmaGlass) {
            queueGlass(shapeId, node.attrs._figmaGlass, parentId);
            applyGlassMatteFillOpacityToShape(shapeId);
            return;
        }
        var bgBlurRadius = node.attrs && node.attrs['data-figma-bg-blur-radius'];
        if (bgBlurRadius) {
            var bgBlurAmount = parseFloat(bgBlurRadius);
            if (!isNaN(bgBlurAmount) && bgBlurAmount > 0) {
                queueBackgroundBlur(shapeId, bgBlurAmount, parentId);
            }
        }
    } catch (eQueue) {
        console.warn('[Glass] Error queueing overlay effects: ' + eQueue.message);
    }
}

function clearDeferredGlass() {
    __deferredGlass = [];
    __glassOverlayShapes = {};
}

// Resolve the Third-Party plugins folder on ANY Cavalry build:
// the API when it exists (newer builds), else derived from the script's own
// location (.../Cavalry/Scripts/<name> sits beside .../Cavalry/Third-Party/
// Plugins), else the macOS home-folder convention (dev setups run the
// script from outside App Support).
function _glassPluginsFolder() {
    try {
        if (typeof api.getThirdPartyPluginsFolder === 'function') {
            return api.getThirdPartyPluginsFolder();
        }
    } catch (eA) {}
    var loc = '';
    try { loc = String(ui.scriptLocation || ''); } catch (eL) {}
    var norm = loc.replace(/\\/g, '/');
    var idx = norm.indexOf('/Cavalry/Scripts');
    if (idx > 0) return norm.slice(0, idx) + '/Cavalry/Third-Party/Plugins';
    var mHome = /^(\/Users\/[^\/]+)\//.exec(norm);
    if (mHome) return mHome[1] + '/Library/Application Support/Cavalry/Third-Party/Plugins';
    return null;
}

function _glassFolderExists() {
    try {
        var base = _glassPluginsFolder();
        if (!base) return false;
        var folder = base + '/Glass';
        if (api.isDirectory && api.isDirectory(folder)) return true;
    } catch (e) {}
    return false;
}

function _installGlassFromPath(sourcePath) {
    try {
        var result = api.installPlugin(sourcePath);
        if (result && result.ok) {
            if (result.requiresRestart) {
                console.warn('[Glass] Plugin schema updated — restart Cavalry before Glass import will work');
                return false;
            }
            console.info('[Glass] Installed Cavalry Glass filter');
            return true;
        }
        if (result && result.error) {
            console.warn('[Glass] installPlugin failed: ' + result.error);
        }
    } catch (eInst) {
        console.warn('[Glass] installPlugin error: ' + eInst.message);
    }
    return false;
}

// Write one plugin file with whatever this Cavalry build offers:
// writePluginFile (newer builds) or writeToFile into the plugins folder.
function _writeGlassFile(rel, text) {
    if (typeof api.writePluginFile === 'function') {
        try { api.writePluginFile('Glass', rel, text); return true; } catch (eWP) {}
    }
    try {
        var base = _glassPluginsFolder();
        if (!base) { console.warn('[Glass] Cannot locate the plugins folder on this Cavalry build'); return false; }
        var target = base + '/Glass';
        var haveDir = false;
        try { haveDir = !!(api.isDirectory && api.isDirectory(target)); } catch (eChk) {}
        if (!haveDir && typeof api.makeFolder === 'function') { try { api.makeFolder(target); } catch (eMk) {} }
        // third argument = overwrite: reinstalls and updates must replace files
        api.writeToFile(target + '/' + rel, text, true);
        return true;
    } catch (eWT) {
        console.warn('[Glass] Could not write ' + rel + ': ' + eWT.message);
        return false;
    }
}

// Copy the dev plugin folder file-by-file (for builds without installPlugin).
function _copyGlassFromDev(devPath) {
    var textFiles = ['definitions.json', 'strings.json', 'setup.js', 'versioning.js',
                     'glassPass.sksl', 'frostH.sksl', 'frostV.sksl', 'wideH.sksl', 'wideV.sksl'];
    var wrote = 0;
    for (var i = 0; i < textFiles.length; i++) {
        var text = null;
        try { text = api.readFromFile(devPath + '/' + textFiles[i]); } catch (eR) {}
        if (text && _writeGlassFile(textFiles[i], text)) wrote++;
    }
    // icons are optional - copy them when the binary APIs exist
    if (typeof api.encodeBinary === 'function' && typeof api.writeEncodedToBinaryFile === 'function' && _glassPluginsFolder()) {
        var icons = ['glassIcon.png', 'glassIcon@2x.png', 'glassIcon_ae.png', 'glassIcon_ae@2x.png'];
        var target = _glassPluginsFolder() + '/Glass';
        for (var j = 0; j < icons.length; j++) {
            try {
                var b64 = api.encodeBinary(devPath + '/' + icons[j]);
                if (b64) api.writeEncodedToBinaryFile(target + '/' + icons[j], b64);
            } catch (eIc) {}
        }
    }
    return wrote >= textFiles.length;
}

// Register the freshly written plugin: live via installPlugin when this
// build has it, otherwise the files load on the next Cavalry start.
function _registerGlassOrAskRestart() {
    if (typeof api.installPlugin === 'function' && _glassPluginsFolder()) {
        var installedPath = _glassPluginsFolder() + '/Glass';
        return _installGlassFromPath(installedPath);
    }
    __glassNeedsRestart = true;
    console.warn('[Glass] Glass filter installed - RESTART Cavalry to finish loading it, then send the design again');
    return false;
}

function ensureGlassInstalled(force) {
    if (__glassNeedsRestart) return false; // installed this session - waiting on a restart
    if (__glassInstallAttempted && !force) return _glassFolderExists();
    __glassInstallAttempted = true;

    if (!force && _glassFolderExists()) return true;

    var devPath = ui.scriptLocation + '/plugins/Glass';
    var devAvailable = false;
    try { devAvailable = !!(api.isDirectory && api.isDirectory(devPath)); } catch (eDev) {}
    if (devAvailable) {
        if (typeof api.installPlugin === 'function') {
            if (_installGlassFromPath(devPath)) return true;
        } else if (_copyGlassFromDev(devPath)) {
            return _registerGlassOrAskRestart();
        }
    }

    if (typeof QUIVER_GLASS_TEXT_FILES === 'object' && QUIVER_GLASS_TEXT_FILES) {
        var wroteAll = true;
        for (var rel in QUIVER_GLASS_TEXT_FILES) {
            if (!QUIVER_GLASS_TEXT_FILES.hasOwnProperty(rel)) continue;
            if (!_writeGlassFile(rel, QUIVER_GLASS_TEXT_FILES[rel])) wroteAll = false;
        }
        if (wroteAll) return _registerGlassOrAskRestart();
    }

    if (_glassFolderExists()) return true;
    console.warn('[Glass] Cavalry Glass filter is not installed - skipping glass effects');
    return false;
}

function _isGlassAnchorId(id) {
    try {
        if (String(api.getLayerType(id)) !== 'backgroundBlurFilter') return false;
        var n = String(api.getNiceName(id));
        return n.indexOf('Glass Anchor') >= 0;
    } catch (e) {
        return false;
    }
}

function _isConnectedGlassAnchor(pinId, host) {
    var outs = [];
    try { outs = api.getOutConnections(pinId, 'id') || []; } catch (e) { return false; }
    for (var o = 0; o < outs.length; o++) {
        if (String(outs[o]).indexOf(host + '.filters.') === 0) return true;
    }
    return false;
}

function _hostHasGlassAnchor(host) {
    var kids = [];
    try { kids = api.getChildren(host) || []; } catch (e) { return false; }
    for (var i = 0; i < kids.length; i++) {
        if (_isGlassAnchorId(kids[i]) && _isConnectedGlassAnchor(kids[i], host)) return true;
    }
    return false;
}

function _canHostFilters(id) {
    var attrs = [];
    try { attrs = api.getAttributes(id) || []; } catch (e) { return false; }
    for (var i = 0; i < attrs.length; i++) {
        if (String(attrs[i]) === 'filters') return true;
    }
    return false;
}

function plantGlassAnchor(host) {
    if (!host || !_canHostFilters(host)) return null;
    if (_hostHasGlassAnchor(host)) return true;
    var pin = null;
    try { pin = api.create('backgroundBlurFilter', GLASS_ANCHOR_NAME); } catch (eC) { pin = null; }
    if (!pin) return null;
    var ok = false;
    try {
        var slot = api.addArrayIndex(host, 'filters');
        if (typeof slot === 'number' && slot >= 0) {
            api.connect(pin, 'id', host, 'filters.' + slot);
            api.parent(pin, host);
            ok = _hostHasGlassAnchor(host);
        }
    } catch (eA) { ok = false; }
    if (!ok) {
        try { api.deleteLayer(pin); } catch (eD) {}
        return null;
    }
    try { api.set(pin, { 'amount.x': 0, 'amount.y': 0 }); } catch (eAmt) {}
    try { api.set(pin, { showInProjectWindow: false, showUIinAtEd: false, locked: true }); } catch (eHide) {}
    return pin;
}

function sweepLooseGlassAnchors() {
    try {
        var top = api.getChildren(api.getActiveComp()) || [];
        for (var t = 0; t < top.length; t++) {
            if (_isGlassAnchorId(top[t])) {
                try { api.deleteLayer(top[t]); } catch (eDel) {}
            }
        }
    } catch (e) {}
}

function _childrenOf(groupId) {
    var cached = __groupDirectChildren[groupId];
    if (cached && cached.length) return cached;
    try { return api.getChildren(groupId) || []; } catch (e) { return []; }
}

// Descend into an overlapping GROUP and keep only the children the overlay
// actually covers. A whole-frame group used to be swallowed wholesale, which
// stole other overlays' backdrops and re-parented them at the wrong z-order.
// The group is kept whole ONLY when every child overlaps AND no child's own
// refinement narrowed any deeper - without the second condition a
// single-child wrapper group (card -> Group 1 -> panels) trivially satisfies
// "all children overlap" and swallows the whole card, discarding the correct
// panel-level pick made further down.
function _refineOverlapping(candidateId, overlayBBox, depth) {
    var bb = null;
    try { bb = api.getBoundingBox(candidateId, true); } catch (e) { return []; }
    if (!bb || !boundingBoxesOverlap(overlayBBox, bb)) return [];
    var type = '';
    try { type = String(api.getLayerType(candidateId)); } catch (eT) {}
    if (type !== 'group' || depth <= 0) return [candidateId];
    var kids = _childrenOf(candidateId);
    if (!kids.length) return [candidateId];
    var picked = [];
    var overlapCount = 0;
    var narrowed = false;
    for (var i = 0; i < kids.length; i++) {
        var sub = _refineOverlapping(kids[i], overlayBBox, depth - 1);
        if (sub.length) {
            overlapCount++;
            if (sub.length !== 1 || sub[0] !== kids[i]) narrowed = true;
        }
        for (var s = 0; s < sub.length; s++) picked.push(sub[s]);
    }
    if (overlapCount === kids.length && !narrowed) return [candidateId];
    return picked;
}

function _findUnderlyingOverlappingSiblings(overlayShapeId, parentId) {
    var overlayBBox = null;
    try { overlayBBox = api.getBoundingBox(overlayShapeId, true); } catch (eBB) { return []; }
    if (!overlayBBox) return [];

    // climb ancestors until a level yields underlying siblings that actually
    // OVERLAP the overlay. Merely having siblings below is not enough: a list
    // row's icon has the other rows below it at the list level, none of which
    // touch it, while its real backdrop (the panel) sits levels further up -
    // stopping at the first level with any underlying siblings skipped it.
    // Collect underlying overlapping siblings across EVERY ancestor level -
    // the visible backdrop can span levels (a text at one level over a
    // Background at the root), and stopping at the first level with any
    // overlap used to host glass on the text alone. The list stays in
    // z-order: deeper (closer) levels draw ABOVE rootward levels, so each
    // new level's finds go to the FRONT of the bottom-first list. One
    // occlusion cull at the end keeps only what is visually beneath.
    var node = overlayShapeId;
    var par = parentId;
    var guard = 0;
    var collected = [];
    while (par && guard < 12) {
        var siblings = __groupDirectChildren[par] || [];
        var idx = -1;
        for (var si = 0; si < siblings.length; si++) {
            if (siblings[si] === node) { idx = si; break; }
        }
        if (idx > 0) {
            var underlying = siblings.slice(0, idx);
            var levelHits = [];
            for (var j = 0; j < underlying.length; j++) {
                var siblingId = underlying[j];
                if (__glassOverlayShapes[siblingId] || __blurOverlayShapes[siblingId]) continue;
                var refined = _refineOverlapping(siblingId, overlayBBox, 4);
                for (var r = 0; r < refined.length; r++) {
                    var pickedId = refined[r];
                    if (__glassOverlayShapes[pickedId] || __blurOverlayShapes[pickedId]) continue;
                    levelHits.push(pickedId);
                }
            }
            if (levelHits.length) collected = levelHits.concat(collected);
        }
        node = par;
        try { par = api.getParent(par); } catch (eGP) { break; }
        guard++;
    }
    if (!collected.length) return [];
    var res = _occlusionCull(collected, overlayBBox);
    if (res.culled.length) return res.culled;
    // nothing opaque anywhere: better to refract the translucent stack than
    // to skip the overlay entirely
    return res.excluded;
}

// A backdrop layer must be effectively OPAQUE to host the glass: the shader
// deliberately reads any input alpha above ~1% as full glass (so translucent
// MATTES work like Figma), which blows a translucent HOST out to solid
// colour. Cheap per-layer check; groups can't be judged cheaply and keep the
// old behaviour (treated as opaque).
function _isEffectivelyOpaque(id) {
    var type = '';
    try { type = String(api.getLayerType(id)); } catch (e) { return true; }
    if (type === 'group') return true;
    var op = null;
    try { op = api.get(id, 'opacity'); } catch (e1) {}
    if (typeof op === 'number' && op < 99) return false;
    var ma = null;
    try { ma = api.get(id, 'material.alpha'); } catch (e2) {}
    if (typeof ma === 'number' && ma < 99) return false;
    var ca = null;
    try { ca = api.get(id, 'material.materialColor.a'); } catch (e3) {}
    if (typeof ca === 'number' && ca > 0 && ca < 254) return false;
    var hasShader = false;
    var kids = [];
    try { kids = api.getChildren(id) || []; } catch (e4) {}
    for (var i = 0; i < kids.length; i++) {
        var kt = '';
        try { kt = String(api.getLayerType(kids[i])); } catch (e5) { continue; }
        if (kt.indexOf('Shader') === -1 && kt.indexOf('shader') === -1 && kt.indexOf('gradient') === -1) continue;
        hasShader = true;
        var sa = null;
        try { sa = api.get(kids[i], 'alpha'); } catch (e6) {}
        if (typeof sa === 'number' && sa < 99) return false;
    }
    if (typeof ca === 'number' && ca === 0 && !hasShader) return false;
    return true;
}

// OCCLUSION CULL (visually underneath, not everything underneath): walk
// top-down and stop at the first OPAQUE layer whose bbox fully covers the
// overlay - anything below it is hidden behind it and must not join the
// backdrop (a full-bleed card Background used to get swallowed even
// though the pill sat entirely on an image covering it).
// A TRANSLUCENT full-coverer (a 10% white card) is EXCLUDED and the walk
// continues: its flat tint draws over the glass output naturally, and
// keeping it as the host blows the shader out to solid colour (its alpha
// knee reads any coverage above ~1% as full glass).
function _occlusionCull(overlapping, overlayBBox) {
    var culled = [];
    var excluded = [];
    for (var t = overlapping.length - 1; t >= 0; t--) {
        var memberId = overlapping[t];
        var mb = null;
        try { mb = api.getBoundingBox(memberId, true); } catch (eMB) { culled.unshift(memberId); continue; }
        var covers = mb && mb.left <= overlayBBox.left + 1 && mb.right >= overlayBBox.right - 1
                        && mb.bottom <= overlayBBox.bottom + 1 && mb.top >= overlayBBox.top - 1;
        if (covers && !_isEffectivelyOpaque(memberId)) {
            excluded.unshift(memberId);
            console.info('[Glass] "' + api.getNiceName(memberId) + '" is see-through - the glass refracts what sits beneath it instead');
            continue;
        }
        culled.unshift(memberId);
        if (covers) break;
    }
    return { culled: culled, excluded: excluded };
}

function _wireGlassFilterToHost(glassId, hostId) {
    if (!glassId || !hostId) return false;
    plantGlassAnchor(hostId);
    try {
        var slot = api.addArrayIndex(hostId, 'filters');
        if (typeof slot === 'number' && slot >= 0) {
            api.connect(glassId, 'id', hostId, 'filters.' + slot);
        } else {
            api.connect(glassId, 'id', hostId, 'filters');
        }
        addFilterForTarget(hostId, glassId);
        return true;
    } catch (eConnect) {
        console.warn('[Glass] Could not connect filter to "' + api.getNiceName(hostId) + '": ' + eConnect.message);
        return false;
    }
}

// Root path of sibling indices for render-order comparison. getChildren lists
// top-drawn first, so a lexicographically SMALLER path draws on top.
function _renderPath(layerId) {
    var path = [];
    var current = layerId;
    var guard = 0;
    while (current && guard < 32) {
        var parent = null;
        try { parent = api.getParent(current); } catch (eP) { break; }
        var kids = [];
        try { kids = api.getChildren(parent || api.getActiveComp()) || []; } catch (eK) { break; }
        var idx = kids.indexOf(current);
        path.unshift(idx < 0 ? 9999 : idx);
        if (!parent) break;
        current = parent;
        guard++;
    }
    return path;
}

function _topmostByRenderOrder(members) {
    var best = members[0];
    var bestPath = _renderPath(best);
    for (var i = 1; i < members.length; i++) {
        var p = _renderPath(members[i]);
        var len = Math.max(p.length, bestPath.length);
        for (var d = 0; d < len; d++) {
            var a = (d < p.length) ? p[d] : -1;
            var b = (d < bestPath.length) ? bestPath[d] : -1;
            if (a === b) continue;
            if (a < b) { best = members[i]; bestPath = p; }
            break;
        }
    }
    return best;
}

// A Custom Shape renders its input's LOCAL geometry in the host's own space:
// the input layer's transform is ignored. bakeTransform is NOT the answer -
// it renders group inputs fine but renders single-shape inputs (editableShape
// etc.) completely EMPTY while still reporting the right bounding box. So the
// stand-in adopts the original's local transform instead; being under the
// same parent, that reproduces the original's placement exactly.
function _copyLocalTransform(fromId, toId) {
    var attrs = ['position', 'pivot', 'rotation', 'scale', 'skew'];
    for (var i = 0; i < attrs.length; i++) {
        var v = null;
        try { v = api.get(fromId, attrs[i]); } catch (eG) { continue; }
        if (v === null || v === undefined) continue;
        try {
            if (typeof v === 'object') {
                var upd = {};
                if (typeof v.x === 'number') upd[attrs[i] + '.x'] = v.x;
                if (typeof v.y === 'number') upd[attrs[i] + '.y'] = v.y;
                if (typeof v.z === 'number') upd[attrs[i] + '.z'] = v.z;
                api.set(toId, upd);
            } else {
                var upd2 = {};
                upd2[attrs[i]] = v;
                api.set(toId, upd2);
            }
        } catch (eS) {}
    }
}

/**
 * IN-PLACE STAND-IN (matches the user's proven manual wiring): create a
 * Custom Shape at the backdrop layer's exact slot, connect the original into
 * inputShape and HIDE it. Nothing is re-parented, so z-order cannot break by
 * construction. With several backdrop members, the members move into a
 * hidden wrapper group at the topmost member's slot instead.
 */
function _compositeGlassBackdrops(overlapping, overlayShapeId) {
    var overlayName = 'Glass';
    try { overlayName = api.getNiceName(overlayShapeId) || 'Glass'; } catch (eN) {}

    if (overlapping.length === 1) {
        // stand-in beside the (soon hidden) original, named after it
        var member = overlapping[0];
        var customName = overlayName + ' Backdrop';
        try {
            var memberName = api.getNiceName(member);
            if (memberName) customName = memberName + ' Backdrop';
        } catch (eRn1) {}
        var customShapeId = null;
        try { customShapeId = api.create('customShape', customName); } catch (eC) { customShapeId = null; }
        if (!customShapeId) {
            console.warn('[Glass] Could not create Custom Shape for backdrop composite');
            return null;
        }
        var memberParent = null;
        try { memberParent = api.getParent(member); } catch (eMP) {}
        if (memberParent) {
            try { api.parent(customShapeId, memberParent); } catch (ePar1) {}
        }
        try { api.reorder(customShapeId, member); } catch (eR1) {}
        try { api.connect(member, 'id', customShapeId, 'inputShape'); } catch (eIn1) {
            console.warn('[Glass] Could not connect backdrop to Custom Shape: ' + eIn1.message);
        }
        _copyLocalTransform(member, customShapeId);
        try { api.set(member, { hidden: true }); } catch (eH1) {}
        return customShapeId;
    }

    // several members: hidden wrapper group inside a Custom Shape, placed at
    // the BOTTOM-MOST member's slot - backdrops sit beneath their overlays,
    // and anything that drew between the members and the overlay (a wordmark
    // between a background and its images) must STAY above the composite.
    var customShapeId = null;
    try { customShapeId = api.create('customShape', overlayName + ' Backdrop'); } catch (eC2) { customShapeId = null; }
    if (!customShapeId) {
        console.warn('[Glass] Could not create Custom Shape for backdrop composite');
        return null;
    }
    var bottomMember = _bottommostByRenderOrder(overlapping);
    var overlapParent = null;
    try { overlapParent = api.getParent(bottomMember); } catch (eOP) {}
    if (overlapParent) {
        try { api.parent(customShapeId, overlapParent); } catch (ePar) {}
    }
    try { api.reorder(customShapeId, bottomMember); } catch (eR) {}

    var groupId = null;
    try { groupId = api.create('group', overlayName + ' Backdrop Group'); } catch (eG) { groupId = null; }
    if (!groupId) {
        console.warn('[Glass] Could not create backdrop group');
        return customShapeId;
    }
    try { api.parent(groupId, customShapeId); } catch (ePG) {}

    for (var i = 0; i < overlapping.length; i++) {
        try { if (typeof removeImportedGroupId === 'function') removeImportedGroupId(overlapping[i]); } catch (eRm) {}
        try { api.parent(overlapping[i], groupId); } catch (ePl) {
            console.warn('[Glass] Could not parent backdrop layer: ' + ePl.message);
        }
    }

    try { api.connect(groupId, 'id', customShapeId, 'inputShape'); } catch (eIn) {
        console.warn('[Glass] Could not connect group to Custom Shape: ' + eIn.message);
    }
    try { api.set(groupId, { hidden: true }); } catch (eH) {}

    return customShapeId;
}

function _bottommostByRenderOrder(members) {
    var worst = members[0];
    var worstPath = _renderPath(worst);
    for (var i = 1; i < members.length; i++) {
        var p = _renderPath(members[i]);
        var len = Math.max(p.length, worstPath.length);
        for (var d = 0; d < len; d++) {
            var a = (d < p.length) ? p[d] : -1;
            var b = (d < worstPath.length) ? worstPath[d] : -1;
            if (a === b) continue;
            if (a > b) { worst = members[i]; worstPath = p; }
            break;
        }
    }
    return worst;
}



function _paramsEqual(a, b) {
    if (!a || !b) return false;
    var keys = ['refraction', 'depth', 'dispersion', 'frost', 'lightAngle', 'lightIntensity', 'splay'];
    for (var i = 0; i < keys.length; i++) {
        var va = a[keys[i]]; var vb = b[keys[i]];
        if (typeof va !== 'number' || typeof vb !== 'number') return false;
        if (Math.abs(va - vb) > 0.001) return false;
    }
    return true;
}

function _createGlassLayer(params) {
    var glassId = null;
    try { glassId = api.create(GLASS_LAYER_TYPE, 'Glass'); } catch (eCreate) { glassId = null; }
    if (!glassId) {
        ensureGlassInstalled(true);
        try { glassId = api.create(GLASS_LAYER_TYPE, 'Glass'); } catch (eRetry) { glassId = null; }
    }
    if (!glassId) {
        if (!__glassNeedsRestart) {
            console.warn('[Glass] Could not create ' + GLASS_LAYER_TYPE + ' - is the Glass plugin installed?');
        }
        return null;
    }
    try {
        api.set(glassId, {
            refraction: params.refraction,
            depth: params.depth,
            dispersion: params.dispersion,
            frost: params.frost,
            lightAngle: params.lightAngle,
            lightIntensity: params.lightIntensity,
            splay: params.splay
        });
    } catch (eSet) {
        console.warn('[Glass] Could not set parameters: ' + eSet.message);
    }
    return glassId;
}

function _connectGlassMatte(glassId, overlayShapeId) {
    // Pin must already be on the host before this connection (scene-lock).
    var matteSlot = 0;
    try {
        var slot = api.addArrayIndex(glassId, 'mattes');
        if (typeof slot === 'number' && slot >= 0) matteSlot = slot;
    } catch (eSlot) {}
    var mattePath = 'mattes.' + matteSlot + '.matteLayer';

    // A filter on the overlay (e.g. an imported drop shadow) POLLUTES the
    // matte: the glass region samples the overlay's FILTERED render, so the
    // shadow bleeds the glass outside the pane. A filtered overlay skips the
    // direct connection and mattes with a clean hidden twin instead - the
    // pane keeps its shadow, the glass gets pure geometry.
    var overlayFiltered = false;
    var oConns = [];
    try { oConns = api.getInConnectedAttributes(overlayShapeId) || []; } catch (eOC) {}
    for (var oc = 0; oc < oConns.length; oc++) {
        if (String(oConns[oc]).indexOf('filters.') === 0) { overlayFiltered = true; break; }
    }

    if (!overlayFiltered) {
        // Cavalry REJECTS this connection (a warning, not an exception) when
        // the filtered host masks the overlay - e.g. the backdrop is the
        // frame's clip rect, which masks everything inside the frame
        // including the overlay itself. Verify the connection landed.
        try { api.connect(overlayShapeId, 'id', glassId, mattePath); } catch (eMatte) {}
        var landed = '';
        try { landed = String(api.getInConnection(glassId, mattePath) || ''); } catch (eChk) {}
        if (landed) return true;
    }

    // hidden twin matte: same parent and local transform, so the matte
    // geometry is identical to the overlay's
    var twin = null;
    try { twin = api.duplicate(overlayShapeId, false); } catch (eDup) { twin = null; }
    if (!twin) {
        console.warn('[Glass] Could not connect matte for "' + api.getNiceName(overlayShapeId) + '"');
        return false;
    }
    try { api.rename(twin, api.getNiceName(overlayShapeId) + ' Glass Matte'); } catch (eRn) {}
    // strip the twin's masks, and hand back any filters: api.duplicate
    // STEALS the source's filter connections (a filter drives one host
    // only), so each one is returned to the overlay - the pane keeps its
    // drop shadow, the twin stays a clean silhouette. One connection per
    // iteration: list indices compact after every disconnect.
    var guard = 0;
    while (guard++ < 24) {
        var twinConns = [];
        try { twinConns = api.getInConnectedAttributes(twin) || []; } catch (eTC) { break; }
        var cPath = null;
        var isFilter = false;
        for (var tc = 0; tc < twinConns.length; tc++) {
            var p = String(twinConns[tc]);
            if (p.indexOf('masks.') === 0) { cPath = p; isFilter = false; break; }
            if (p.indexOf('filters.') === 0) { cPath = p; isFilter = true; break; }
        }
        if (!cPath) break;
        var src = '';
        try { src = String(api.getInConnection(twin, cPath) || '').split('.')[0]; } catch (eMS) {}
        if (!src) break;
        try { api.disconnect(src, 'id', twin, cPath); } catch (eDis) { break; }
        if (isFilter) {
            try {
                var rSlot = api.addArrayIndex(overlayShapeId, 'filters');
                if (typeof rSlot === 'number' && rSlot >= 0) {
                    api.connect(src, 'id', overlayShapeId, 'filters.' + rSlot);
                }
            } catch (eRet) {}
        }
    }
    // live-link the twin to the overlay: transform and primitive controls
    // (generator.*) follow the original, so moving or resizing the overlay
    // keeps the matte in sync. Hand-drawn path POINTS on editable shapes are
    // the one thing that stays frozen (points are not attributes).
    var linkAttrs = ['position', 'pivot', 'rotation', 'scale', 'skew'];
    var overlayAttrs = [];
    try { overlayAttrs = api.getAttributes(overlayShapeId) || []; } catch (eLA) {}
    for (var la = 0; la < overlayAttrs.length; la++) {
        var lp = String(overlayAttrs[la]);
        if (lp.indexOf('generator.') === 0) linkAttrs.push(lp);
    }
    for (var lk = 0; lk < linkAttrs.length; lk++) {
        try { api.connect(overlayShapeId, linkAttrs[lk], twin, linkAttrs[lk]); } catch (eLk) {}
    }

    // DROP SHADOW RESCUE: a shadow renders proportional to its source's
    // alpha, so a translucent pane (fill-fix moves Figma's near-transparent
    // fill onto opacity) casts an invisible shadow - in Figma the shadow
    // comes from the node's full silhouette. Move the pane's drop shadows
    // onto an OPAQUE caster duplicate just beneath it, output-clipped by the
    // twin as an INVERTED alpha matte so only the shadow ring draws.
    try {
        var overlayOpacity = 100;
        try { var ovOp = api.get(overlayShapeId, 'opacity'); if (typeof ovOp === 'number') overlayOpacity = ovOp; } catch (eOp) {}
        var overlayShadowPaths = [];
        var ovConns2 = [];
        try { ovConns2 = api.getInConnectedAttributes(overlayShapeId) || []; } catch (eC3) {}
        for (var sp = 0; sp < ovConns2.length; sp++) {
            var pth = String(ovConns2[sp]);
            if (pth.indexOf('filters.') !== 0) continue;
            var fSrc2 = '';
            try { fSrc2 = String(api.getInConnection(overlayShapeId, pth) || '').split('.')[0]; } catch (eS2) {}
            if (fSrc2 && String(api.getLayerType(fSrc2)) === 'dropShadowFilter') overlayShadowPaths.push(fSrc2);
        }
        if (overlayShadowPaths.length && overlayOpacity < 99) {
            var caster = null;
            try { caster = api.duplicate(overlayShapeId, false); } catch (eDup2) { caster = null; }
            if (caster) {
                try { api.rename(caster, api.getNiceName(overlayShapeId) + ' Shadow'); } catch (eRn2) {}
                try { api.set(caster, { opacity: 100, 'material.alpha': 100, 'material.materialColor.a': 255 }); } catch (eOpq) {}
                try { api.reorder(caster, overlayShapeId); } catch (eRo) {}
                // normalise filters: exactly ONE shadow per unique params on
                // the caster, none on the overlay, nothing else on the caster
                var seenShadowKeys = {};
                var keptShadows = {};
                var guard2 = 0;
                while (guard2++ < 16) {
                    var cConns = [];
                    try { cConns = api.getInConnectedAttributes(caster) || []; } catch (eCC) { break; }
                    var fPath2 = null, cSrc = '';
                    for (var cc = 0; cc < cConns.length; cc++) {
                        var cp = String(cConns[cc]);
                        if (cp.indexOf('filters.') !== 0) continue;
                        var candidate = '';
                        try { candidate = String(api.getInConnection(caster, cp) || '').split('.')[0]; } catch (eCS) {}
                        if (!candidate || keptShadows[candidate]) continue;
                        fPath2 = cp;
                        cSrc = candidate;
                        break;
                    }
                    if (!fPath2 || !cSrc) break;
                    var cType = String(api.getLayerType(cSrc));
                    if (cType !== 'dropShadowFilter') {
                        try { api.disconnect(cSrc, 'id', caster, fPath2); } catch (eD1) { break; }
                        continue;
                    }
                    var key = '';
                    try { key = JSON.stringify([api.get(cSrc, 'amount'), api.get(cSrc, 'offset'), api.get(cSrc, 'shadowColor'), api.get(cSrc, 'rotation')]); } catch (eK) {}
                    if (seenShadowKeys[key]) {
                        try { api.disconnect(cSrc, 'id', caster, fPath2); } catch (eD2) { break; }
                        var orphaned = [];
                        try { orphaned = api.getOutConnections(cSrc, 'id') || []; } catch (eOr) {}
                        if (!orphaned.length) { try { api.deleteLayer(cSrc); } catch (eDl) {} }
                        continue;
                    }
                    seenShadowKeys[key] = true;
                    keptShadows[cSrc] = true;
                }
                // clip the caster's body away with the twin as a SUBTRACT
                // mask on the LAYER: Cavalry masks apply AFTER filters, so
                // the shadow is cast from the full opaque body first, then
                // the pane region is subtracted - only the shadow ring
                // remains (proven manual wiring; a matte ON the shadow
                // filter does not achieve this).
                try {
                    api.connect(twin, 'id', caster, 'masks');
                    var maskIdx = -1;
                    var mConns = api.getInConnectedAttributes(caster) || [];
                    for (var mi2 = 0; mi2 < mConns.length; mi2++) {
                        var mp = String(mConns[mi2]);
                        var mm = mp.match(/^masks\.(\d+)\.id$/);
                        if (mm) {
                            var idxN = parseInt(mm[1], 10);
                            var mSrc = '';
                            try { mSrc = String(api.getInConnection(caster, mp) || '').split('.')[0]; } catch (eMSr) {}
                            if (mSrc === twin && idxN > maskIdx) maskIdx = idxN;
                        }
                    }
                    if (maskIdx >= 0) {
                        var uMode = {};
                        uMode['masks.' + maskIdx + '.mode'] = 1;
                        api.set(caster, uMode);
                    }
                } catch (eMask) {}
                // strip the overlay's own (invisible) shadows
                var guard3 = 0;
                while (guard3++ < 16) {
                    var oc2 = [];
                    try { oc2 = api.getInConnectedAttributes(overlayShapeId) || []; } catch (eOC2) { break; }
                    var oPath = null, oSrc = '';
                    for (var oo = 0; oo < oc2.length; oo++) {
                        var op2 = String(oc2[oo]);
                        if (op2.indexOf('filters.') !== 0) continue;
                        var osrc = '';
                        try { osrc = String(api.getInConnection(overlayShapeId, op2) || '').split('.')[0]; } catch (eOS) {}
                        if (osrc && String(api.getLayerType(osrc)) === 'dropShadowFilter') { oPath = op2; oSrc = osrc; break; }
                    }
                    if (!oPath) break;
                    try { api.disconnect(oSrc, 'id', overlayShapeId, oPath); } catch (eD3) { break; }
                    var oOrph = [];
                    try { oOrph = api.getOutConnections(oSrc, 'id') || []; } catch (eOO) {}
                    if (!oOrph.length) { try { api.deleteLayer(oSrc); } catch (eDl2) {} }
                }
                // caster follows the overlay like the twin does
                for (var lc = 0; lc < linkAttrs.length; lc++) {
                    try { api.connect(overlayShapeId, linkAttrs[lc], caster, linkAttrs[lc]); } catch (eLc) {}
                }
                console.info('[Glass] "' + api.getNiceName(overlayShapeId) + '" drop shadow moved to an opaque caster beneath it (a see-through pane casts an invisible shadow)');
            }
        }
    } catch (eCaster) {}

    try { api.set(twin, { hidden: true }); } catch (eH) {}
    try { api.connect(twin, 'id', glassId, mattePath); } catch (eC2) {}
    var landed2 = '';
    try { landed2 = String(api.getInConnection(glassId, mattePath) || ''); } catch (eChk2) {}
    if (landed2) {
        console.info('[Glass] "' + api.getNiceName(overlayShapeId) + '" matted with a clean linked copy - it follows the overlay transform and shape controls (the overlay itself keeps its filters/masks)');
        return true;
    }
    try { api.deleteLayer(twin); } catch (eDel) {}
    console.warn('[Glass] Could not connect matte for "' + api.getNiceName(overlayShapeId) + '"');
    return false;
}

function processDeferredGlass() {
    if (__deferredGlass.length === 0) return;

    ensureGlassInstalled();

    try { api.select([]); } catch (eSel) {}

    var compositeEnabled = (typeof compositeGlassBackdropsEnabled === 'undefined') ? true : !!compositeGlassBackdropsEnabled;

    // Composite glass backdrops OFF = manual mode: create each filter with
    // its Figma params and matte the overlay DIRECTLY - no backdrop scans,
    // no clustering, no stand-ins and no hidden twin layers. The user wires
    // the filter onto a host themselves.
    if (!compositeEnabled) {
        for (var m = 0; m < __deferredGlass.length; m++) {
            var rawM = __deferredGlass[m];
            var glassM = _createGlassLayer(rawM.params);
            if (!glassM) continue;
            var slotM = 0;
            try {
                var sM = api.addArrayIndex(glassM, 'mattes');
                if (typeof sM === 'number' && sM >= 0) slotM = sM;
            } catch (eSM) {}
            try { api.connect(rawM.overlayShapeId, 'id', glassM, 'mattes.' + slotM + '.matteLayer'); } catch (eCM) {}
            try { api.parent(glassM, rawM.overlayShapeId); } catch (ePM) {}
            console.info('[Glass] Created filter for "' + api.getNiceName(rawM.overlayShapeId) + '" (unwired - Composite glass backdrops is off)');
        }
        __deferredGlass = [];
        return;
    }

    // PASS 1: resolve every overlay's backdrop set BEFORE any compositing
    // mutates the tree. Compositing used to run inside the loop, so the first
    // overlay's composite would steal layers a later overlay also needed,
    // leaving its glass unwired and its backdrop re-stacked at the wrong z.
    var requests = [];
    for (var i = 0; i < __deferredGlass.length; i++) {
        var raw = __deferredGlass[i];
        var overlapping = [];
        try { overlapping = _findUnderlyingOverlappingSiblings(raw.overlayShapeId, raw.parentId); } catch (eF) {}
        requests.push({
            overlayShapeId: raw.overlayShapeId,
            params: raw.params || {},
            overlapping: overlapping
        });
    }

    // Cluster overlays whose backdrop sets intersect - they must share ONE
    // pre-comp: two matte-clipped third-party filters on one host render
    // EMPTY in Cavalry, so sharing is done with extra mattes (same params)
    // or an instanced reference (different params), never a second filter.
    var clusters = [];
    for (var r = 0; r < requests.length; r++) {
        var req = requests[r];
        if (!req.overlapping.length) {
            // nothing visually beneath - a glass filter would do nothing, skip
            console.info('[Glass] No backdrop found under "' + api.getNiceName(req.overlayShapeId) + '" - skipped');
            continue;
        }
        var placed = false;
        for (var c = 0; c < clusters.length && !placed; c++) {
            var cluster = clusters[c];
            for (var m = 0; m < cluster.length && !placed; m++) {
                var other = cluster[m];
                for (var o = 0; o < other.overlapping.length && !placed; o++) {
                    if (req.overlapping.indexOf(other.overlapping[o]) >= 0) {
                        cluster.push(req);
                        placed = true;
                    }
                }
            }
        }
        if (!placed) clusters.push([req]);
    }

    // PASS 2: build each cluster's composite once, then wire every overlay
    for (var ci = 0; ci < clusters.length; ci++) {
        var members = clusters[ci];
        try {
            // union of the cluster's backdrop layers, first-seen order
            var union = [];
            for (var u = 0; u < members.length; u++) {
                var set = members[u].overlapping;
                for (var s = 0; s < set.length; s++) {
                    if (union.indexOf(set[s]) < 0) union.push(set[s]);
                }
            }

            var hostBase = null;
            if (union.length) {
                // a single plain-shape backdrop hosts the filter DIRECTLY.
                // GROUPS get a Custom Shape stand-in: Cavalry runs group
                // filters PER CHILD, so glass hosted straight on a group
                // refracts each child separately and seams across child
                // boundaries inside the pane - the stand-in renders the group
                // as one composite (the user's proven manual wiring). Several
                // overlays with DIFFERENT params simply stack their filters
                // on the SAME host, one matte each.
                var needsComposite = union.length > 1;
                if (!needsComposite) {
                    try {
                        needsComposite = (String(api.getLayerType(union[0])) === 'group');
                    } catch (eType) {}
                }
                if (!needsComposite) needsComposite = !_canHostFilters(union[0]);
                hostBase = needsComposite
                         ? _compositeGlassBackdrops(union, members[0].overlayShapeId)
                         : union[0];
            }

            var clusterGlassId = null;   // shared filter when params match
            var clusterParams = null;

            for (var k = 0; k < members.length; k++) {
                var member = members[k];
                var overlayShapeId = member.overlayShapeId;

                // same backdrop + same params: extra matte on the shared filter
                if (k > 0 && clusterGlassId && _paramsEqual(member.params, clusterParams)) {
                    _connectGlassMatte(clusterGlassId, overlayShapeId);
                    console.info('[Glass] "' + api.getNiceName(overlayShapeId) + '" added as an extra matte on the shared glass');
                    continue;
                }

                var glassId = _createGlassLayer(member.params);
                if (!glassId) continue;

                // every member's filter stacks on the ONE shared host
                var hostId = null;
                if (hostBase) {
                    hostId = hostBase;
                    _wireGlassFilterToHost(glassId, hostId);
                }

                _connectGlassMatte(glassId, overlayShapeId);
                try { api.parent(glassId, overlayShapeId); } catch (eParent) {}

                if (k === 0) {
                    clusterGlassId = glassId;
                    clusterParams = member.params;
                }

                console.info('[Glass] Created filter for overlay "' + api.getNiceName(overlayShapeId) + '" on ' + (hostId ? api.getNiceName(hostId) : 'no host'));
            }
        } catch (eProcess) {
            console.error('[Glass] Error processing glass cluster: ' + eProcess.message);
        }
    }

    sweepLooseGlassAnchors();
    __deferredGlass = [];
}
