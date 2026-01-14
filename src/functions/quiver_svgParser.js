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
        
        console.log('[Quiver] Extracted clipPath: ' + clipId + ' with ' + masks[clipId].children.length + ' child shapes');
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
        console.log('[CIRCLE MERGE] Detected ' + (inner ? 'inner' : 'outer') + ' stroke circle (fill r=' + fr + ', stroke r=' + sr + ', strokeWidth=' + w + ')');
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
        console.log('[MULTI-FILL TEXT] Comparing texts:');
        console.log('  A: name="' + (a.name || 'unnamed') + '", content="' + (aContent || '(empty)').substring(0, 80) + '"');
        console.log('  B: name="' + (b.name || 'unnamed') + '", content="' + (bContent || '(empty)').substring(0, 80) + '"');
        console.log('  Identical: ' + identical);
        
        // CRITICAL: If both contents are empty, texts should NOT be considered identical
        // This prevents merging different texts that failed content extraction
        if (aContent === '' && bContent === '') {
            console.log('[MULTI-FILL TEXT] WARNING: Both texts have empty content - NOT merging');
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
                console.log('[MULTI-FILL] Skipping gradient simulation helper shapes (count: ' + g.length + ')');
                for (var gri = 0; gri < g.length; gri++) {
                    g[gri].node.__remove = true;
                }
                continue; // Skip the normal merge logic for this group
            }
            
            if (!primary.attrs._additionalFills) {
                primary.attrs._additionalFills = [];
            }
            console.log('[MULTI-FILL] Merging ' + g.length + ' identical shapes into one');
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
                console.log('[MULTI-FILL]   -> Added fill: ' + (fillInfo.fill || 'gradient-fill') + ' (opacity: ' + fillInfo.fillOpacity + ')');
                
                // NOTE: data-figma-gradient-fill is stored in fillInfo and processed via _additionalFills
                // Do NOT transfer to primary.attrs to avoid duplicate gradient creation
                
                // IMPORTANT: Transfer inherited filter from secondary to primary
                // This ensures filters from parent groups (like inner shadows) aren't lost
                if (secondary.attrs._inheritedFilterId && !primary.attrs._inheritedFilterId) {
                    primary.attrs._inheritedFilterId = secondary.attrs._inheritedFilterId;
                    console.log('[MULTI-FILL]   -> Transferred _inheritedFilterId: ' + secondary.attrs._inheritedFilterId);
                }
                
                // Also transfer any direct filter attribute from the secondary shape
                if (secondary.attrs.filter && !primary.attrs.filter) {
                    primary.attrs.filter = secondary.attrs.filter;
                    console.log('[MULTI-FILL]   -> Transferred direct filter: ' + secondary.attrs.filter);
                }
                
                // CRITICAL: Check if the secondary's PARENT GROUP has a filter (e.g., inner shadow)
                // This is the common case: Figma exports <g filter="..."><rect fill="..."/></g>
                if (secondaryHolder && secondaryHolder.attrs && secondaryHolder.attrs.filter && !primary.attrs.filter) {
                    primary.attrs.filter = secondaryHolder.attrs.filter;
                    console.log('[MULTI-FILL]   -> Transferred filter from parent group: ' + secondaryHolder.attrs.filter);
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
                console.log('[ANGULAR GRADIENT] Found data-figma-gradient-fill attribute, length=' + figmaGradientFill.length);
                console.log('[ANGULAR GRADIENT] Raw attribute (first 200 chars): ' + figmaGradientFill.substring(0, 200));
                
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
                
                console.log('[ANGULAR GRADIENT] Decoded JSON (first 200 chars): ' + decodedJson.substring(0, 200));
                
                var figmaGradData = JSON.parse(decodedJson);
                console.log('[ANGULAR GRADIENT] Parsed Figma gradient data: type=' + figmaGradData.type);
                console.log('[ANGULAR GRADIENT] Stops count: ' + ((figmaGradData.stops || figmaGradData.stopsVar || []).length));
                
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
                    console.log('[DIAMOND GRADIENT] Detected GRADIENT_DIAMOND type, creating diamond gradient');
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
                    console.log('[OPACITY] Set shape opacity=' + shapeOpacityPercent + '% on ' + api.getNiceName(layerId));
                } catch (eShapeOp) {
                    console.log('[OPACITY] Could not set shape opacity: ' + eShapeOp.message);
                }
            }
            
            // Debug log when inherited opacity is applied
            if (inheritedOpacity < 0.999) {
                console.log('[OPACITY] Applied inherited opacity=' + inheritedOpacity + ' to layer ' + api.getNiceName(layerId));
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
                        console.log('[GRADIENT] Using local center for offset: (' + svgShapeCenter.x + ', ' + svgShapeCenter.y + ')');
                    }
                    // Check for transformed center (from matrix transforms - rotation/scale)
                    else if (attrs._transformedCenterX !== undefined && attrs._transformedCenterY !== undefined) {
                        svgShapeCenter = { x: attrs._transformedCenterX, y: attrs._transformedCenterY };
                    }
                    // Check for path SVG center (calculated from path segments)
                    else if (attrs._pathSvgCenterX !== undefined && attrs._pathSvgCenterY !== undefined) {
                        svgShapeCenter = { x: attrs._pathSvgCenterX, y: attrs._pathSvgCenterY };
                        console.log('[RADIAL GRADIENT] Using path SVG center from segments: (' + svgShapeCenter.x + ', ' + svgShapeCenter.y + ')');
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
                                    console.log('[Quiver Image] Set image shader alpha to ' + imgShaderAlpha + '% (fill-opacity)');
                                }
                            } catch (eImgAlpha) {
                                console.log('[Quiver Image] Could not set image shader alpha: ' + eImgAlpha.message);
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
                                    console.log('[Quiver Image] Applying precise transform for pattern ' + pid);
                                    
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
                                    console.log('[Quiver Image] Pattern: ' + pid);
                                    console.log('[Quiver Image]   Shape dimensions: ' + shapeW + ' x ' + shapeH);
                                    console.log('[Quiver Image]   Image dimensions: ' + imgW + ' x ' + imgH);
                                    console.log('[Quiver Image]   Transform matrix: a=' + useTransform.a + ', d=' + useTransform.d + ', e=' + useTransform.e + ', f=' + useTransform.f);
                                    
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
                                    
                                    console.log('[Quiver Image]   Cavalry scale: ' + cavalryScaleX.toFixed(4) + ' x ' + cavalryScaleY.toFixed(4) + ' (1.0 = 100%)');
                                    
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
                                    
                                    console.log('[Quiver Image]   Visible size: ' + visibleW.toFixed(2) + ' x ' + visibleH.toFixed(2));
                                    console.log('[Quiver Image]   Image center: (' + imgCenterX.toFixed(2) + ', ' + imgCenterY.toFixed(2) + ')');
                                    console.log('[Quiver Image]   Cavalry offset: (' + cavalryOffsetX.toFixed(2) + ', ' + cavalryOffsetY.toFixed(2) + ')');
                                    
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
                                console.log('[Quiver Image] Error applying image transform: ' + (eAlign.message || eAlign));
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
                            console.log('[MULTI-FILL] Created primary colorShader: ' + color + ' (stacking mode)');
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
            console.log('[MULTI-FILL] Connecting ' + attrs._additionalFills.length + ' additional fill(s) to ' + api.getNiceName(layerId));
            
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
                        console.log('[MULTI-FILL]   -> Processing Figma gradient fill from additional fill');
                        
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
                        console.log('[MULTI-FILL]   -> Figma gradient type: ' + figmaGradDataAdd.type);
                        
                        // Handle GRADIENT_ANGULAR (Sweep gradient)
                        if (figmaGradDataAdd.type === 'GRADIENT_ANGULAR') {
                            var sweepShaderIdAdd = createSweepGradientFromFigma(figmaGradDataAdd, layerId, attrs);
                            if (sweepShaderIdAdd) {
                                console.log('[MULTI-FILL]   -> Created sweep gradient from additional fill');
                            }
                        }
                        
                        // Handle GRADIENT_DIAMOND (Shape gradient with 4 sides)
                        if (figmaGradDataAdd.type === 'GRADIENT_DIAMOND') {
                            var diamondShaderIdAdd = createDiamondGradientFromFigma(figmaGradDataAdd, layerId, attrs);
                            if (diamondShaderIdAdd) {
                                console.log('[MULTI-FILL]   -> Created diamond gradient from additional fill');
                            }
                        }
                        
                        // Skip further processing for this fill - gradient is handled
                        continue;
                    } catch (eFigmaGradAdd) {
                        console.log('[MULTI-FILL]   -> Error processing Figma gradient: ' + eFigmaGradAdd.message);
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
                                console.log('[MULTI-FILL]   -> Connected gradient: ' + addFillId + ' with alpha=' + gradAlphaPercent + '% (fill-opacity)');
                            } catch (eGradAlpha) {
                                console.log('[MULTI-FILL]   -> Connected gradient: ' + addFillId + ' (alpha set failed: ' + eGradAlpha.message + ')');
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
                                        console.log('[MULTI-FILL] Set image shader alpha to ' + addImgAlphaPercent + '% (fill-opacity)');
                                    }
                                } catch (eAddImgAlpha) {}
                                
                                // APPLY FULL IMAGE SHADER CONFIGURATION
                                try {
                                    try { if (_hasAttr(addShaderNode, 'legacyGraph')) api.set(addShaderNode, { 'legacyGraph': false }); } catch (eLG2) {}
                                    
                                    var addPatternData = __svgPatternMap[addPid];
                                    var addUseTransform = addPatternData && addPatternData.useTransform;
                                    var addIsObjectBoundingBox = addPatternData && addPatternData.attrs && addPatternData.attrs.patternContentUnits === 'objectBoundingBox';
                                    
                                    if (addUseTransform && addIsObjectBoundingBox) {
                                        console.log('[MULTI-FILL] Applying precise transform for pattern ' + addPid);
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
                                    console.log('[MULTI-FILL] Error applying image transform: ' + (eAddAlign.message || eAddAlign));
                                }
                                
                                __patternImageShaderCache[addPid] = addShaderNode;
                                console.log('[MULTI-FILL]   -> Connected pattern/image: ' + addFillId);
                            } else if (addCached) {
                                try { api.connect(addCached, 'id', layerId, 'material.colorShaders'); } catch (eConnCached) {}
                                console.log('[MULTI-FILL]   -> Connected cached pattern/image: ' + addFillId);
                            }
                        } catch (eAddPat) {
                            console.log('[MULTI-FILL]   -> Error connecting pattern: ' + eAddPat.message);
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
                                console.log('[MULTI-FILL]   -> shaderColor set failed: ' + eSetColor.message);
                            }
                            
                            // Also set alpha attribute (0-100 percentage) for shader opacity
                            var alphaPercent = Math.round(addEffectiveOpacity * 100);
                            try { api.set(colorShaderId, { 'alpha': alphaPercent }); } catch (eA1) {}
                            
                            // Connect to shape's colorShaders
                            try { api.connect(colorShaderId, 'id', layerId, 'material.colorShaders'); } catch (eConnColor) {}
                            
                            // Parent under the shape
                            try { api.parent(colorShaderId, layerId); } catch (eParColor) {}
                            
                            console.log('[MULTI-FILL]   -> Created colorShader: rgb(' + rVal + ',' + gVal + ',' + bVal + ') alpha=' + aVal + ' (' + alphaPercent + '%)');
                        }
                    } catch (eColorShader) {
                        console.log('[MULTI-FILL]   -> Error creating colorShader: ' + eColorShader.message);
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
                            console.log('[RADIAL GRADIENT STROKE] Using path SVG center: (' + svgShapeCenterStroke.x + ', ' + svgShapeCenterStroke.y + ')');
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
