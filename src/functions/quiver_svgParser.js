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
                    console.log('=== PARSING TEXT ELEMENT ===');
                    console.log('opening tag:', opening.substring(0, 200));
                    try {
                        var textEndPos = match.index + match[0].length;
                        var nextTagMatch = /<[^>]+>/.exec(svgCode.substring(textEndPos));
                        if (nextTagMatch) {
                            var directTextContent = svgCode.substring(textEndPos, textEndPos + nextTagMatch.index).trim();
                            console.log('Direct text content found:', directTextContent);
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
                                    console.log('Added direct text as tspan');
                                }
                            }
                        }
                    } catch (eDirectText) {
                        console.log('Error capturing direct text:', eDirectText);
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
                console.log('Parsed <use> element with href:', unode.attrs.href);
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
