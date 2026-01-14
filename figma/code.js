// Quiver for Figma - Main Plugin Code
// This runs in Figma's sandbox and handles selection/export logic

// Show the UI
figma.showUI(__html__, { themeColors: true, width: 250, height: 76 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'send-to-cavalry') {
    await sendSelectionToCavalry();
  } else if (msg.type === 'check-selection') {
    checkSelection();
  } else if (msg.type === 'fetch-success') {
    // UI successfully sent to Cavalry
    figma.notify('✓ Sent to Cavalry!', { timeout: 2000 });
  } else if (msg.type === 'fetch-error') {
    // UI failed to send
    figma.notify('❌ ' + (msg.message || 'Failed to connect to Cavalry'), { error: true });
  } else if (msg.type === 'open-github') {
    // Open GitHub repository in browser
    figma.openExternal('https://github.com/phillip-motion/quiver');
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// ============================================================================
// HYBRID VECTOR DATA EXTRACTION (for stroke gradients that SVG can't preserve)
// ============================================================================

/**
 * Check if a paint is a gradient type
 */
function isGradientPaint(paint) {
  return paint && (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  );
}

/**
 * Check if a node has gradient strokes (which SVG export will outline/flatten)
 */
function hasGradientStroke(node) {
  if (!('strokes' in node) || !node.strokes || node.strokes.length === 0) {
    return false;
  }
  for (var i = 0; i < node.strokes.length; i++) {
    var stroke = node.strokes[i];
    if (stroke.visible !== false && isGradientPaint(stroke)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a node has ANY visible stroke (solid or gradient)
 * Complex stroked paths get flattened by Figma's SVG exporter
 */
function hasVisibleStroke(node) {
  if (!('strokes' in node) || !node.strokes || node.strokes.length === 0) {
    return false;
  }
  for (var i = 0; i < node.strokes.length; i++) {
    var stroke = node.strokes[i];
    if (stroke.visible !== false) {
      return true;
    }
  }
  return false;
}

/**
 * Safely convert a value to string (handles Symbols)
 */
function safeString(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'symbol') return val.description || 'symbol';
  return String(val);
}

/**
 * Check if a VectorNode might have its stroke flattened by SVG export
 * This happens with stroked paths - Figma outlines strokes for complex/thick paths
 */
function mightGetStrokeFlattened(node) {
  // Must be a VECTOR type (pen-tool paths)
  if (node.type !== 'VECTOR') {
    return false;
  }
  
  // Must have a visible stroke
  if (!hasVisibleStroke(node)) {
    return false;
  }
  
  // Get stroke properties (handle mixed values which can be Symbols)
  var strokeWeight = 0;
  try {
    strokeWeight = (typeof node.strokeWeight === 'number') ? node.strokeWeight : 0;
  } catch (e) { strokeWeight = 0; }
  
  var strokeCap = 'NONE';
  try {
    if (typeof node.strokeCap === 'string') strokeCap = node.strokeCap;
    else if (typeof node.strokeCap === 'symbol') strokeCap = node.strokeCap.description || 'MIXED';
  } catch (e) { strokeCap = 'NONE'; }
  
  var strokeJoin = 'MITER';
  try {
    if (typeof node.strokeJoin === 'string') strokeJoin = node.strokeJoin;
    else if (typeof node.strokeJoin === 'symbol') strokeJoin = node.strokeJoin.description || 'MIXED';
  } catch (e) { strokeJoin = 'MITER'; }
  
  // Debug logging (use safeString for safety)
  console.log('  Checking VECTOR: ' + node.name);
  console.log('    strokeWeight: ' + strokeWeight);
  console.log('    strokeCap: ' + safeString(strokeCap));
  console.log('    strokeJoin: ' + safeString(strokeJoin));
  
  // Get path complexity info
  var vertexCount = 0;
  var segmentCount = 0;
  try {
    if ('vectorNetwork' in node && node.vectorNetwork) {
      var network = node.vectorNetwork;
      vertexCount = (network.vertices) ? network.vertices.length : 0;
      segmentCount = (network.segments) ? network.segments.length : 0;
      console.log('    vectorNetwork: ' + vertexCount + ' vertices, ' + segmentCount + ' segments');
    }
  } catch (e) {
    console.log('    vectorNetwork: error reading');
  }
  
  var pathCommandCount = 0;
  try {
    if ('vectorPaths' in node && node.vectorPaths && node.vectorPaths.length > 0) {
      var pathData = node.vectorPaths[0].data || '';
      pathCommandCount = (pathData.match(/[MLCQAZ]/gi) || []).length;
      console.log('    vectorPaths: ' + pathCommandCount + ' commands, ' + pathData.length + ' chars');
    }
  } catch (e) {
    console.log('    vectorPaths: error reading');
  }
  
  // Check stroke weight - thicker strokes are more likely to get flattened
  if (strokeWeight < 1) {
    console.log('    -> Skipping (stroke too thin)');
    return false;
  }
  
  // CRITERIA FOR FLATTENING:
  // 1. Thick strokes (weight > 10) are almost always flattened
  if (strokeWeight > 10) {
    console.log('    -> HYBRID: Thick stroke (' + strokeWeight + 'px)');
    return true;
  }
  
  // 2. Rounded caps/joins often cause flattening
  if (strokeCap === 'ROUND' || strokeJoin === 'ROUND') {
    console.log('    -> HYBRID: Rounded stroke caps/joins');
    return true;
  }
  
  // 3. Complex paths (many segments) are flattened
  if (segmentCount > 5 || vertexCount > 5) {
    console.log('    -> HYBRID: Complex path (' + vertexCount + ' vertices)');
    return true;
  }
  
  // 4. Many path commands also indicates complexity
  if (pathCommandCount > 10) {
    console.log('    -> HYBRID: Many path commands (' + pathCommandCount + ')');
    return true;
  }
  
  console.log('    -> Not using hybrid (simple thin stroke)');
  return false;
}

/**
 * Convert Figma color to hex string
 */
function figmaColorToHex(color) {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return '#' + r + g + b;
}

/**
 * Convert Figma gradient transform matrix to usable format
 */
function extractGradientTransform(gradientTransform) {
  if (!gradientTransform) return null;
  // Figma uses [[a, c, e], [b, d, f]] format
  return {
    a: gradientTransform[0][0],
    b: gradientTransform[1][0],
    c: gradientTransform[0][1],
    d: gradientTransform[1][1],
    e: gradientTransform[0][2],
    f: gradientTransform[1][2]
  };
}

/**
 * Extract paint data (fills or strokes) in a Cavalry-friendly format
 */
function extractPaintData(paints) {
  if (!paints || paints.length === 0) return [];
  
  var result = [];
  for (var i = 0; i < paints.length; i++) {
    var paint = paints[i];
    if (paint.visible === false) continue;
    
    var paintData = {
      type: paint.type,
      opacity: paint.opacity !== undefined ? paint.opacity : 1
    };
    
    if (paint.type === 'SOLID') {
      paintData.color = figmaColorToHex(paint.color);
    } else if (isGradientPaint(paint)) {
      paintData.gradientType = paint.type.replace('GRADIENT_', '').toLowerCase();
      var stops = [];
      for (var j = 0; j < paint.gradientStops.length; j++) {
        var stop = paint.gradientStops[j];
        stops.push({
          position: stop.position,
          color: figmaColorToHex(stop.color),
          opacity: stop.color.a !== undefined ? stop.color.a : 1
        });
      }
      paintData.gradientStops = stops;
      paintData.gradientTransform = extractGradientTransform(paint.gradientTransform);
      
      // Extract gradientHandlePositions for accurate radial gradient sizing
      // Figma API: For radial gradients, these 3 points define the ellipse:
      // - Position 0: center of the gradient
      // - Position 1: point on the ellipse edge (defines one radius)
      // - Position 2: point on the ellipse edge (defines the other radius, perpendicular)
      // Coordinates are in normalized 0-1 space relative to the shape's bounding box
      console.log('[GRADIENT DEBUG] Paint type: ' + paint.type);
      console.log('[GRADIENT DEBUG] Has gradientHandlePositions: ' + ('gradientHandlePositions' in paint));
      if (paint.gradientHandlePositions) {
        console.log('[GRADIENT DEBUG] gradientHandlePositions length: ' + paint.gradientHandlePositions.length);
        console.log('[GRADIENT DEBUG] gradientHandlePositions: ' + JSON.stringify(paint.gradientHandlePositions));
      }
      if (paint.gradientHandlePositions && paint.gradientHandlePositions.length >= 3) {
        paintData.gradientHandlePositions = paint.gradientHandlePositions.map(function(pos) {
          return { x: pos.x, y: pos.y };
        });
        console.log('[GRADIENT DEBUG] Added gradientHandlePositions to paintData');
      }
    }
    
    result.push(paintData);
  }
  return result;
}

/**
 * Extract vector data from a single node
 * frameAbsX/frameAbsY: the frame's absolute position on the page (for calculating relative coords)
 */
function extractVectorNodeData(node, frameAbsX, frameAbsY) {
  frameAbsX = frameAbsX || 0;
  frameAbsY = frameAbsY || 0;
  
  console.log('Extracting vector data for: ' + node.name + ' (type: ' + node.type + ')');
  
  // Try to get path data from vectorPaths first
  var pathData = null;
  
  if ('vectorPaths' in node && node.vectorPaths && node.vectorPaths.length > 0) {
    console.log('  Found ' + node.vectorPaths.length + ' vectorPath(s)');
    pathData = [];
    for (var i = 0; i < node.vectorPaths.length; i++) {
      var vp = node.vectorPaths[i];
      pathData.push({
        data: vp.data,
        windingRule: vp.windingRule
      });
    }
    var firstPathLen = (pathData[0] && pathData[0].data) ? pathData[0].data.length : 0;
    console.log('  First path data length: ' + firstPathLen + ' chars');
  }
  
  // If vectorPaths is empty, try vectorNetwork
  var hasValidPathData = pathData && pathData.length > 0 && pathData[0] && pathData[0].data;
  if (!hasValidPathData) {
    if ('vectorNetwork' in node && node.vectorNetwork) {
      console.log('  vectorPaths empty, trying vectorNetwork...');
      var network = node.vectorNetwork;
      var vertCount = (network && network.vertices) ? network.vertices.length : 0;
      var segCount = (network && network.segments) ? network.segments.length : 0;
      console.log('  VectorNetwork: ' + vertCount + ' vertices, ' + segCount + ' segments');
      
      // Convert vectorNetwork to path data
      pathData = convertVectorNetworkToPath(network);
      if (pathData && pathData[0] && pathData[0].data) {
        console.log('  Converted network to path: ' + pathData[0].data.length + ' chars');
      }
    }
  }
  
  var finalHasValidData = pathData && pathData.length > 0 && pathData[0] && pathData[0].data;
  if (!finalHasValidData) {
    console.log('  No path data available for ' + node.name);
    return null;
  }
  
  // Calculate absolute position (page-relative)
  var pageAbsoluteX = node.absoluteTransform ? node.absoluteTransform[0][2] : node.x;
  var pageAbsoluteY = node.absoluteTransform ? node.absoluteTransform[1][2] : node.y;
  
  // Calculate position RELATIVE to the frame (not the page)
  // This is critical when the frame is not at (0,0) on the page
  var relativeX = pageAbsoluteX - frameAbsX;
  var relativeY = pageAbsoluteY - frameAbsY;
  
  console.log('  Page position: ' + pageAbsoluteX + ', ' + pageAbsoluteY);
  console.log('  Relative to frame: ' + relativeX + ', ' + relativeY);
  
  // Helper to safely get string value (handles Symbols from mixed values)
  function safeStringValue(val, defaultVal) {
    if (val === null || val === undefined) return defaultVal;
    if (typeof val === 'symbol') return val.description || defaultVal;
    if (typeof val === 'string') return val;
    return defaultVal;
  }
  
  // Helper to safely get number value
  function safeNumberValue(val, defaultVal) {
    if (typeof val === 'number' && !isNaN(val)) return val;
    return defaultVal;
  }
  
  // Extract corner radius from vectorNetwork (per-vertex or uniform)
  var cornerRadius = 0;
  try {
    // Check for uniform cornerRadius on the node
    if ('cornerRadius' in node && typeof node.cornerRadius === 'number') {
      cornerRadius = node.cornerRadius;
      console.log('  Corner radius (uniform): ' + cornerRadius);
    }
    // Check per-vertex corner radii in vectorNetwork
    if ('vectorNetwork' in node && node.vectorNetwork && node.vectorNetwork.vertices) {
      var maxRadius = 0;
      for (var vi = 0; vi < node.vectorNetwork.vertices.length; vi++) {
        var vertex = node.vectorNetwork.vertices[vi];
        if (vertex.cornerRadius && vertex.cornerRadius > maxRadius) {
          maxRadius = vertex.cornerRadius;
        }
      }
      if (maxRadius > 0) {
        cornerRadius = maxRadius;
        console.log('  Corner radius (from vertices): ' + cornerRadius);
      }
    }
  } catch (eCR) {
    console.log('  Could not extract corner radius: ' + eCR.message);
  }
  
  var result = {
    type: 'vectorPath',
    name: node.name,
    nodeType: node.type,
    // Path data (SVG-like d attribute)
    vectorPaths: pathData,
    // Stroke properties (safely handle mixed/Symbol values)
    strokes: extractPaintData(node.strokes),
    strokeWeight: safeNumberValue(node.strokeWeight, 1),
    strokeCap: safeStringValue(node.strokeCap, 'NONE'),
    strokeJoin: safeStringValue(node.strokeJoin, 'MITER'),
    strokeMiterLimit: safeNumberValue(node.strokeMiterLimit, 4),
    strokeAlign: safeStringValue(node.strokeAlign, 'CENTER'),
    dashPattern: node.dashPattern || [],
    // Corner radius for Bevel deformer
    cornerRadius: cornerRadius,
    // Fill properties
    fills: extractPaintData(node.fills),
    // Transform & position (relative to frame, not page!)
    x: node.x,
    y: node.y,
    // Use frame-relative position for Cavalry import
    relativeX: relativeX,
    relativeY: relativeY,
    width: node.width,
    height: node.height,
    rotation: node.rotation || 0,
    // Relative transform matrix (adjusted for frame position)
    relativeTransform: node.absoluteTransform ? {
      a: node.absoluteTransform[0][0],
      b: node.absoluteTransform[1][0],
      c: node.absoluteTransform[0][1],
      d: node.absoluteTransform[1][1],
      // Use frame-relative position
      e: relativeX,
      f: relativeY
    } : null
  };
  
  console.log('  Successfully extracted data for ' + node.name);
  console.log('  Strokes: ' + result.strokes.length + ', Fills: ' + result.fills.length);
  
  return result;
}

/**
 * Convert VectorNetwork to path data string
 * This handles cases where vectorPaths is empty but vectorNetwork has data
 */
function convertVectorNetworkToPath(network) {
  if (!network || !network.vertices || !network.segments) {
    return null;
  }
  
  const vertices = network.vertices;
  const segments = network.segments;
  
  if (vertices.length === 0 || segments.length === 0) {
    return null;
  }
  
  // Build path from segments
  let pathStr = '';
  let currentVertex = -1;
  
  for (const segment of segments) {
    const startV = vertices[segment.start];
    const endV = vertices[segment.end];
    
    if (!startV || !endV) continue;
    
    // Move to start if this is a new starting point
    if (currentVertex !== segment.start) {
      pathStr += 'M ' + startV.x + ' ' + startV.y + ' ';
    }
    
    // Check if this is a curve (has tangents) or a line
    if (segment.tangentStart && segment.tangentEnd) {
      // Cubic bezier
      var cp1x = startV.x + segment.tangentStart.x;
      var cp1y = startV.y + segment.tangentStart.y;
      var cp2x = endV.x + segment.tangentEnd.x;
      var cp2y = endV.y + segment.tangentEnd.y;
      pathStr += 'C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + endV.x + ' ' + endV.y + ' ';
    } else {
      // Line
      pathStr += 'L ' + endV.x + ' ' + endV.y + ' ';
    }
    
    currentVertex = segment.end;
  }
  
  // Check for closed regions
  if (network.regions && network.regions.length > 0) {
    pathStr += 'Z ';
  }
  
  if (!pathStr.trim()) {
    return null;
  }
  
  return [{
    data: pathStr.trim(),
    windingRule: 'NONZERO'
  }];
}

/**
 * Recursively find all nodes that need hybrid approach (gradient strokes OR complex stroked paths)
 * These are nodes where Figma's SVG export will flatten/outline the stroke
 * Filters out nodes that are outside the frame bounds
 * 
 * @param {SceneNode} node - The node to search
 * @param {Array} results - Array to collect results
 * @param {string} parentPath - Path for debugging
 * @param {number} frameAbsX - Frame's absolute X position
 * @param {number} frameAbsY - Frame's absolute Y position
 * @param {number} frameWidth - Frame width for bounds checking
 * @param {number} frameHeight - Frame height for bounds checking
 */
function findNodesWithGradientStrokes(node, results, parentPath, frameAbsX, frameAbsY, frameWidth, frameHeight) {
  results = results || [];
  parentPath = parentPath || '';
  frameAbsX = frameAbsX || 0;
  frameAbsY = frameAbsY || 0;
  frameWidth = frameWidth || 0;
  frameHeight = frameHeight || 0;
  const nodePath = parentPath ? (parentPath + '/' + node.name) : node.name;
  
  // Check if this node needs hybrid approach:
  // 1. Has gradient stroke (always gets flattened)
  // 2. Is a complex stroked path (likely to get flattened)
  var needsHybrid = hasGradientStroke(node) || mightGetStrokeFlattened(node);
  
  if (needsHybrid) {
    const vectorData = extractVectorNodeData(node, frameAbsX, frameAbsY);
    if (vectorData) {
      // BOUNDS CHECK: Skip nodes that are completely outside the frame
      var tolerance = 1;
      var nodeRight = vectorData.relativeX + vectorData.width;
      var nodeBottom = vectorData.relativeY + vectorData.height;
      
      var isOutsideRight = vectorData.relativeX > frameWidth + tolerance;
      var isOutsideBottom = vectorData.relativeY > frameHeight + tolerance;
      var isOutsideLeft = nodeRight < -tolerance;
      var isOutsideTop = nodeBottom < -tolerance;
      
      if (frameWidth > 0 && frameHeight > 0 && (isOutsideRight || isOutsideBottom || isOutsideLeft || isOutsideTop)) {
        console.log('  Skipping vector node "' + node.name + '" - outside frame bounds');
        // Don't add to results - skip this node
      } else {
        vectorData.path = nodePath;
        vectorData.hasGradientStroke = hasGradientStroke(node);
        vectorData.isComplexStroke = mightGetStrokeFlattened(node) && !hasGradientStroke(node);
        results.push(vectorData);
        console.log('  Hybrid approach needed for: ' + node.name + 
          (vectorData.hasGradientStroke ? ' (gradient stroke)' : ' (complex stroke)'));
      }
    }
  }
  
  // Recurse into children
  if ('children' in node) {
    for (var i = 0; i < node.children.length; i++) {
      findNodesWithGradientStrokes(node.children[i], results, nodePath, frameAbsX, frameAbsY, frameWidth, frameHeight);
    }
  }
  
  return results;
}

// ============================================================================
// HYBRID TEXT DATA EXTRACTION (for accurate text alignment that SVG loses)
// ============================================================================

/**
 * Extract text node data from a Figma TextNode
 * This provides accurate alignment, font, and spacing info that SVG export loses
 * @param {TextNode} node - The Figma text node
 * @param {number} frameAbsX - Frame's absolute X position
 * @param {number} frameAbsY - Frame's absolute Y position
 * @returns {Object|null} Text data object or null if not a text node
 */
function extractTextNodeData(node, frameAbsX, frameAbsY) {
  if (node.type !== 'TEXT') return null;
  
  frameAbsX = frameAbsX || 0;
  frameAbsY = frameAbsY || 0;
  
  console.log('Extracting text data for: ' + node.name);
  
  // Calculate position relative to frame
  var pageAbsoluteX = node.absoluteTransform ? node.absoluteTransform[0][2] : node.x;
  var pageAbsoluteY = node.absoluteTransform ? node.absoluteTransform[1][2] : node.y;
  var relativeX = pageAbsoluteX - frameAbsX;
  var relativeY = pageAbsoluteY - frameAbsY;
  
  // Helper to safely get values (handles figma.mixed Symbol)
  function safeValue(val, defaultVal) {
    if (val === null || val === undefined) return defaultVal;
    if (typeof val === 'symbol') return 'mixed'; // figma.mixed is a Symbol
    return val;
  }
  
  // Extract font name safely (can be mixed for styled text)
  var fontFamily = 'Arial';
  var fontStyle = 'Regular';
  try {
    if (node.fontName && typeof node.fontName !== 'symbol') {
      fontFamily = node.fontName.family || 'Arial';
      fontStyle = node.fontName.style || 'Regular';
    }
  } catch (e) {
    console.log('  Font name is mixed or unavailable');
  }
  
  // Extract font size (can be mixed)
  var fontSize = 16;
  try {
    if (typeof node.fontSize === 'number') {
      fontSize = node.fontSize;
    }
  } catch (e) {}
  
  // Extract letter spacing (can be mixed)
  var letterSpacing = null;
  try {
    if (node.letterSpacing && typeof node.letterSpacing !== 'symbol') {
      letterSpacing = {
        value: node.letterSpacing.value,
        unit: node.letterSpacing.unit // "PIXELS" or "PERCENT"
      };
    }
  } catch (e) {}
  
  // Extract line height (can be mixed or AUTO)
  var lineHeight = null;
  try {
    if (node.lineHeight && typeof node.lineHeight !== 'symbol') {
      if (node.lineHeight.unit === 'AUTO') {
        lineHeight = { unit: 'AUTO' };
      } else {
        lineHeight = {
          value: node.lineHeight.value,
          unit: node.lineHeight.unit // "PIXELS" or "PERCENT"
        };
      }
    }
  } catch (e) {}
  
  // Debug: check if characters contains newlines
  var hasNewlines = node.characters.indexOf('\n') !== -1;
  var lineCount = node.characters.split('\n').length;
  console.log('  Characters has newlines: ' + hasNewlines + ', line count: ' + lineCount);
  console.log('  Raw characters: ' + JSON.stringify(node.characters));
  
  var result = {
    type: 'text',
    name: node.name,
    // The actual text content with line breaks preserved
    characters: node.characters,
    // Alignment - these are the key properties SVG doesn't preserve!
    textAlignHorizontal: safeValue(node.textAlignHorizontal, 'LEFT'), // "LEFT"|"CENTER"|"RIGHT"|"JUSTIFIED"
    textAlignVertical: safeValue(node.textAlignVertical, 'TOP'),       // "TOP"|"CENTER"|"BOTTOM"
    // Text box sizing mode - crucial for matching Figma's text behavior
    // "NONE" = Fixed size (both width and height fixed)
    // "HEIGHT" = Auto height (width fixed, height auto-expands)
    // "WIDTH_AND_HEIGHT" = Auto width (both auto-expand, single line behavior)
    // "TRUNCATE" = Fixed with truncation
    textAutoResize: safeValue(node.textAutoResize, 'WIDTH_AND_HEIGHT'),
    // Font properties
    fontFamily: fontFamily,
    fontStyle: fontStyle,
    fontSize: fontSize,
    // Spacing
    letterSpacing: letterSpacing,
    lineHeight: lineHeight,
    // Position and size (relative to frame)
    relativeX: relativeX,
    relativeY: relativeY,
    width: node.width,
    height: node.height,
    // Rotation
    rotation: node.rotation || 0
  };
  
  console.log('  Text: "' + node.characters.substring(0, 30) + (node.characters.length > 30 ? '...' : '') + '"');
  console.log('  Align: ' + result.textAlignHorizontal + ' / ' + result.textAlignVertical);
  console.log('  Sizing: ' + result.textAutoResize + ' (' + node.width.toFixed(1) + 'x' + node.height.toFixed(1) + ')');
  console.log('  Font: ' + fontFamily + ' ' + fontStyle + ' @ ' + fontSize + 'px');
  console.log('  Position: (' + relativeX.toFixed(2) + ', ' + relativeY.toFixed(2) + ')');
  
  // Extract styled text segments for mixed-style text (bold, italic, different fonts, etc.)
  // This is crucial for text that has multiple font weights/styles within the same text box
  // Figma API: https://www.figma.com/plugin-docs/api/properties/TextNode-getstyledtextsegments/
  try {
    var styledSegments = node.getStyledTextSegments(['fontName', 'fontWeight', 'fontSize', 'fills', 'textDecoration']);
    if (styledSegments && styledSegments.length > 0) {
      // Only include if there are multiple segments (mixed styling)
      // or if the single segment has non-default styling we need to preserve
      result.styledSegments = [];
      for (var si = 0; si < styledSegments.length; si++) {
        var seg = styledSegments[si];
        var segData = {
          characters: seg.characters,
          start: seg.start,
          end: seg.end
        };
        // Include font info
        if (seg.fontName) {
          segData.fontFamily = seg.fontName.family;
          segData.fontStyle = seg.fontName.style;
        }
        if (seg.fontWeight !== undefined) {
          segData.fontWeight = seg.fontWeight;
        }
        if (seg.fontSize !== undefined) {
          segData.fontSize = seg.fontSize;
        }
        // Include fill color (first solid fill)
        if (seg.fills && seg.fills.length > 0) {
          var firstFill = seg.fills[0];
          if (firstFill.type === 'SOLID' && firstFill.color) {
            segData.fillColor = {
              r: Math.round(firstFill.color.r * 255),
              g: Math.round(firstFill.color.g * 255),
              b: Math.round(firstFill.color.b * 255)
            };
            if (firstFill.opacity !== undefined) {
              segData.fillOpacity = firstFill.opacity;
            }
          }
        }
        // Include text decoration
        if (seg.textDecoration && seg.textDecoration !== 'NONE') {
          segData.textDecoration = seg.textDecoration;
        }
        result.styledSegments.push(segData);
      }
      console.log('  Styled segments: ' + result.styledSegments.length + ' segment(s)');
      // Log first few segments for debugging
      for (var sj = 0; sj < Math.min(3, result.styledSegments.length); sj++) {
        var s = result.styledSegments[sj];
        console.log('    [' + s.start + '-' + s.end + '] "' + s.characters.substring(0, 20) + '..." ' + 
                    (s.fontFamily || '') + ' ' + (s.fontStyle || '') + ' w' + (s.fontWeight || '?'));
      }
      if (result.styledSegments.length > 3) {
        console.log('    ... and ' + (result.styledSegments.length - 3) + ' more segment(s)');
      }
    }
  } catch (e) {
    console.log('  Could not extract styled segments: ' + e.message);
  }
  
  return result;
}

/**
 * Recursively find all TEXT nodes in a tree
 * Filters out nodes that are outside the frame bounds to prevent positioning issues
 * 
 * @param {SceneNode} node - The node to search
 * @param {Array} results - Array to collect results
 * @param {string} parentPath - Path for debugging
 * @param {number} frameAbsX - Frame's absolute X position
 * @param {number} frameAbsY - Frame's absolute Y position
 * @param {number} frameWidth - Frame width for bounds checking
 * @param {number} frameHeight - Frame height for bounds checking
 * @returns {Array} Array of text data objects
 */
// Track text node name counts for generating unique names
var __textNodeNameCounts = {};

/**
 * Reset text node name tracking (call before each frame extraction)
 */
function resetTextNodeNameTracking() {
  __textNodeNameCounts = {};
}

/**
 * Get a unique name for a text node, adding _2, _3, etc. suffix for duplicates
 * This prevents ambiguity when multiple text nodes have the same name
 * 
 * @param {string} originalName - The original node name
 * @returns {string} Unique name with suffix if needed
 */
function getUniqueTextNodeName(originalName) {
  if (!__textNodeNameCounts[originalName]) {
    __textNodeNameCounts[originalName] = 1;
    return originalName; // First occurrence keeps original name
  }
  
  // Increment count and return suffixed name
  __textNodeNameCounts[originalName]++;
  var uniqueName = originalName + '_' + __textNodeNameCounts[originalName];
  console.log('  Renaming duplicate "' + originalName + '" -> "' + uniqueName + '"');
  return uniqueName;
}

function findTextNodes(node, results, parentPath, frameAbsX, frameAbsY, frameWidth, frameHeight) {
  results = results || [];
  parentPath = parentPath || '';
  frameAbsX = frameAbsX || 0;
  frameAbsY = frameAbsY || 0;
  frameWidth = frameWidth || 0;
  frameHeight = frameHeight || 0;
  
  var nodePath = parentPath ? (parentPath + '/' + node.name) : node.name;
  
  // Check if this is a text node
  if (node.type === 'TEXT') {
    var textData = extractTextNodeData(node, frameAbsX, frameAbsY);
    if (textData) {
      // BOUNDS CHECK: Skip text nodes that are completely outside the frame
      // A node is "outside" if its left edge is past the right edge of frame,
      // OR its top edge is past the bottom of frame, OR it's entirely to the left/above
      // We use a small tolerance (1px) to handle floating point precision
      var tolerance = 1;
      var nodeRight = textData.relativeX + textData.width;
      var nodeBottom = textData.relativeY + textData.height;
      
      var isOutsideRight = textData.relativeX > frameWidth + tolerance;
      var isOutsideBottom = textData.relativeY > frameHeight + tolerance;
      var isOutsideLeft = nodeRight < -tolerance;
      var isOutsideTop = nodeBottom < -tolerance;
      
      if (frameWidth > 0 && frameHeight > 0 && (isOutsideRight || isOutsideBottom || isOutsideLeft || isOutsideTop)) {
        console.log('  Skipping text node "' + node.name + '" - outside frame bounds');
        console.log('    Position: (' + textData.relativeX.toFixed(1) + ', ' + textData.relativeY.toFixed(1) + ')');
        console.log('    Frame: ' + frameWidth + 'x' + frameHeight);
        // Don't add to results - skip this node
      } else {
        // Generate unique name for this text node to avoid ambiguity
        textData.name = getUniqueTextNodeName(textData.name);
        textData.path = nodePath;
        results.push(textData);
        console.log('  Found text node: ' + textData.name);
      }
    }
  }
  
  // Recurse into children
  if ('children' in node) {
    for (var i = 0; i < node.children.length; i++) {
      findTextNodes(node.children[i], results, nodePath, frameAbsX, frameAbsY, frameWidth, frameHeight);
    }
  }
  
  return results;
}

// ============================================================================
// EMOJI DETECTION AND EXPORT (for emojis that Cavalry can't render)
// ============================================================================

/**
 * Regex pattern to match emoji characters
 * Covers: basic emojis, variation selectors, skin tone modifiers, ZWJ sequences
 * 
 * Figma Plugin API: Uses standard JavaScript regex with Unicode support
 * Reference: https://unicode.org/reports/tr51/
 */
const EMOJI_REGEX = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\p{Emoji_Modifier})?)*|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?/gu;

/**
 * Detect all emojis in a text string and return their positions
 * @param {string} text - The text content to scan
 * @returns {Array} Array of {emoji, index, length} objects
 */
function detectEmojis(text) {
  // #region agent log
  console.log('[Emoji Debug] detectEmojis called with text length: ' + (text ? text.length : 0));
  console.log('[Emoji Debug] Text preview: "' + (text ? text.substring(0, 100) : '') + '"');
  // #endregion
  
  if (!text) return [];
  
  const emojis = [];
  let match;
  
  // Reset regex lastIndex for fresh matching
  EMOJI_REGEX.lastIndex = 0;
  
  // #region agent log
  console.log('[Emoji Debug] Starting regex matching...');
  // #endregion
  
  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    // #region agent log
    console.log('[Emoji Debug] Found emoji: "' + match[0] + '" at index ' + match.index);
    // #endregion
    emojis.push({
      emoji: match[0],
      index: match.index,
      length: match[0].length
    });
  }
  
  // #region agent log
  console.log('[Emoji Debug] detectEmojis returning ' + emojis.length + ' emoji(s)');
  // #endregion
  
  return emojis;
}

/**
 * Check if a text node contains any emojis
 * @param {TextNode} node - Figma text node
 * @returns {boolean} True if emojis are present
 */
function hasEmojis(node) {
  if (node.type !== 'TEXT') return false;
  // #region agent log
  console.log('[Emoji Debug] hasEmojis checking: "' + node.characters.substring(0, 50) + '..."');
  // #endregion
  const emojis = detectEmojis(node.characters);
  // #region agent log
  console.log('[Emoji Debug] hasEmojis found ' + emojis.length + ' emoji(s)');
  // #endregion
  return emojis.length > 0;
}

/**
 * Export a single emoji as a PNG image
 * Creates a temporary text node, exports it, then deletes it
 * 
 * Figma API:
 * - figma.createText() - Create a text node
 * - figma.loadFontAsync() - Load font before setting text
 * - node.exportAsync() - Export node as image
 * - node.remove() - Delete the node
 * 
 * @param {string} emoji - The emoji character(s)
 * @param {number} fontSize - Font size to render at
 * @returns {Promise<string|null>} Base64 data URI or null if failed
 */
async function exportEmojiAsPNG(emoji, fontSize) {
  let tempNode = null;
  
  try {
    // #region agent log
    console.log('[Emoji Export] Starting export for "' + emoji + '" at ' + fontSize + 'px');
    // #endregion
    
    // Create a temporary text node for the emoji
    tempNode = figma.createText();
    // #region agent log
    console.log('[Emoji Export] Created temp text node');
    // #endregion
    
    // Load the default font (Apple Color Emoji or system emoji font)
    // Figma uses Inter as default, but emojis use system emoji font
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    // #region agent log
    console.log('[Emoji Export] Font loaded');
    // #endregion
    
    // Set the emoji text and size
    tempNode.characters = emoji;
    tempNode.fontSize = fontSize;
    
    // Resize to fit content
    tempNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    // #region agent log
    console.log('[Emoji Export] Text node configured, size: ' + tempNode.width + 'x' + tempNode.height);
    // #endregion
    
    // Export as PNG with transparency
    // Use 2x scale for crisp emojis on retina displays
    const pngData = await tempNode.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    });
    // #region agent log
    console.log('[Emoji Export] PNG exported, ' + pngData.length + ' bytes');
    // #endregion
    
    // Convert Uint8Array to base64
    // Note: btoa() is not available in Figma's plugin sandbox
    // Use a lookup table approach instead
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let base64 = '';
    const bytes = pngData;
    const len = bytes.length;
    
    for (let i = 0; i < len; i += 3) {
      const b1 = bytes[i];
      const b2 = i + 1 < len ? bytes[i + 1] : 0;
      const b3 = i + 2 < len ? bytes[i + 2] : 0;
      
      base64 += base64Chars[b1 >> 2];
      base64 += base64Chars[((b1 & 3) << 4) | (b2 >> 4)];
      base64 += i + 1 < len ? base64Chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
      base64 += i + 2 < len ? base64Chars[b3 & 63] : '=';
    }
    
    const dataUri = 'data:image/png;base64,' + base64;
    // #region agent log
    console.log('[Emoji Export] Base64 encoded, ' + dataUri.length + ' chars');
    // #endregion
    
    console.log('[Emoji] Exported "' + emoji + '" at ' + fontSize + 'px -> ' + dataUri.length + ' chars');
    
    return dataUri;
    
  } catch (e) {
    // #region agent log
    console.error('[Emoji Export] FAILED at step, error: ' + e.message);
    console.error('[Emoji Export] Stack: ' + (e.stack || 'no stack'));
    // #endregion
    console.error('[Emoji] Failed to export emoji "' + emoji + '": ' + e.message);
    return null;
  } finally {
    // Clean up: remove the temporary node
    if (tempNode) {
      try {
        tempNode.remove();
        // #region agent log
        console.log('[Emoji Export] Temp node cleaned up');
        // #endregion
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Calculate the position of an emoji within a text node
 * Uses a measurement approach: create temp text with characters before the emoji
 * 
 * Figma API:
 * - figma.createText() - Create temp text for measurement
 * - node.width/height - Get dimensions
 * 
 * @param {TextNode} node - The original text node
 * @param {number} charIndex - Character index of the emoji
 * @param {number} frameAbsX - Frame's absolute X position
 * @param {number} frameAbsY - Frame's absolute Y position
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
async function calculateEmojiPosition(node, charIndex, frameAbsX, frameAbsY) {
  let measureNode = null;
  
  // #region agent log - Debug: capture all calculation steps
  const debugData = {
    hypothesisId: 'A-E',
    location: 'figma/code.js:calculateEmojiPosition',
    textNodeName: node.name,
    charIndex: charIndex,
    frameAbsX: frameAbsX,
    frameAbsY: frameAbsY
  };
  // #endregion
  
  try {
    // Get the font at this character position
    let fontName = { family: "Inter", style: "Regular" };
    let fontSize = 16;
    
    try {
      // Try to get font at specific character
      const fontAtChar = node.getRangeFontName(charIndex, charIndex + 1);
      if (fontAtChar && typeof fontAtChar !== 'symbol') {
        fontName = fontAtChar;
      }
      const sizeAtChar = node.getRangeFontSize(charIndex, charIndex + 1);
      if (typeof sizeAtChar === 'number') {
        fontSize = sizeAtChar;
      }
    } catch (e) {
      // Fall back to node-level font
      if (node.fontName && typeof node.fontName !== 'symbol') {
        fontName = node.fontName;
      }
      if (typeof node.fontSize === 'number') {
        fontSize = node.fontSize;
      }
    }
    
    // #region agent log
    debugData.fontSize = fontSize;
    debugData.fontFamily = fontName.family;
    // #endregion
    
    // Load the font
    await figma.loadFontAsync(fontName);
    
    // Create temp text with characters BEFORE the emoji
    const textBefore = node.characters.substring(0, charIndex);
    
    // #region agent log - Hypothesis A: Check for line breaks before emoji
    const lineBreaksBefore = (textBefore.match(/\n/g) || []).length;
    debugData.textBeforeLength = textBefore.length;
    debugData.lineBreaksBefore = lineBreaksBefore;
    debugData.textBeforePreview = textBefore.substring(Math.max(0, textBefore.length - 20));
    // #endregion
    
    // FIX: For multi-line text, only measure text on the CURRENT LINE
    // Find the last line break before the emoji
    const lastLineBreakIndex = textBefore.lastIndexOf('\n');
    const textOnCurrentLine = lastLineBreakIndex >= 0 
      ? textBefore.substring(lastLineBreakIndex + 1)  // Text after last \n
      : textBefore;  // No line breaks, use all text
    
    // #region agent log
    debugData.lastLineBreakIndex = lastLineBreakIndex;
    debugData.textOnCurrentLine = textOnCurrentLine;
    debugData.textOnCurrentLineLength = textOnCurrentLine.length;
    // #endregion
    
    measureNode = figma.createText();
    measureNode.fontName = fontName;
    measureNode.fontSize = fontSize;
    measureNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    
    // Handle empty prefix (emoji at start of line)
    if (textOnCurrentLine.length > 0) {
      measureNode.characters = textOnCurrentLine;
    } else {
      measureNode.characters = ' '; // Use space for measurement baseline
    }
    
    // Get the width of text on current line before the emoji (this is the X offset)
    const xOffset = textOnCurrentLine.length > 0 ? measureNode.width : 0;
    
    // #region agent log - Hypothesis B: Measure node dimensions
    debugData.measureNodeWidth = measureNode.width;
    debugData.measureNodeHeight = measureNode.height;
    debugData.xOffset = xOffset;
    // #endregion
    
    // For alignment, we need the full current line width (including emoji and text after)
    // Find where the current line ends (next \n or end of string)
    const textAfterEmoji = node.characters.substring(charIndex);
    const nextLineBreakIndex = textAfterEmoji.indexOf('\n');
    const emojiAndAfter = nextLineBreakIndex >= 0 
      ? textAfterEmoji.substring(0, nextLineBreakIndex)
      : textAfterEmoji;
    
    // Measure full current line for alignment calculation
    let fullCurrentLineWidth = xOffset + fontSize; // At minimum: text before + emoji
    try {
      // Create another temp node to measure full line
      const fullLineNode = figma.createText();
      fullLineNode.fontName = fontName;
      fullLineNode.fontSize = fontSize;
      fullLineNode.textAutoResize = 'WIDTH_AND_HEIGHT';
      fullLineNode.characters = textOnCurrentLine + emojiAndAfter;
      fullCurrentLineWidth = fullLineNode.width;
      fullLineNode.remove();
    } catch (e) {
      // Fallback: estimate
      fullCurrentLineWidth = xOffset + fontSize * 2;
    }
    
    // #region agent log
    debugData.fullCurrentLineWidth = fullCurrentLineWidth;
    debugData.emojiAndAfterLength = emojiAndAfter.length;
    // #endregion
    
    // Calculate absolute position
    const nodeAbsX = node.absoluteTransform ? node.absoluteTransform[0][2] : node.x;
    const nodeAbsY = node.absoluteTransform ? node.absoluteTransform[1][2] : node.y;
    
    // #region agent log - Hypothesis D: Node absolute position
    debugData.nodeAbsX = nodeAbsX;
    debugData.nodeAbsY = nodeAbsY;
    debugData.nodeWidth = node.width;
    debugData.nodeHeight = node.height;
    // #endregion
    
    // Calculate relative position to frame
    let relativeX = nodeAbsX - frameAbsX + xOffset;
    let relativeY = nodeAbsY - frameAbsY;
    
    // #region agent log
    debugData.relativeX_beforeAlign = relativeX;
    debugData.relativeY_beforeAlign = relativeY;
    // #endregion
    
    // Adjust for text alignment
    const alignment = node.textAlignHorizontal || 'LEFT';
    debugData.alignment = alignment;
    
    // Base position: left edge of text box
    const nodeLeftX = nodeAbsX - frameAbsX;
    
    if (alignment === 'CENTER') {
      // For center-aligned text within a text box:
      // The line content is centered, so line starts at: nodeLeftX + (nodeWidth - fullLineWidth) / 2
      const lineStartX = nodeLeftX + (node.width - fullCurrentLineWidth) / 2;
      relativeX = lineStartX + xOffset;
      // #region agent log
      debugData.centerCalc = {
        nodeWidth: node.width,
        nodeLeftX: nodeLeftX,
        fullCurrentLineWidth: fullCurrentLineWidth,
        lineStartX: lineStartX,
        xOffset: xOffset
      };
      // #endregion
    } else if (alignment === 'RIGHT') {
      // For right-aligned text: line ends at right edge, so line starts at: nodeLeftX + nodeWidth - fullLineWidth
      const lineStartX = nodeLeftX + node.width - fullCurrentLineWidth;
      relativeX = lineStartX + xOffset;
      // #region agent log
      debugData.rightCalc = {
        nodeWidth: node.width,
        nodeLeftX: nodeLeftX,
        fullCurrentLineWidth: fullCurrentLineWidth,
        lineStartX: lineStartX,
        xOffset: xOffset
      };
      // #endregion
    }
    // LEFT alignment: lineStartX = nodeLeftX, so relativeX = nodeLeftX + xOffset (already correct from initial calc)
    
    // #region agent log - FIX: Apply Y offset for multi-line/wrapped text
    // For text that wraps (textAutoResize = HEIGHT or NONE), we need to measure
    // the actual height of text before the emoji, not just count \n characters
    
    let yOffsetForLines = 0;
    let lineHeight = fontSize * 1.2; // Default approximation
    
    // Check if this is a width-constrained text box that wraps
    const textAutoResize = node.textAutoResize;
    const isWrappingText = (textAutoResize === 'HEIGHT' || textAutoResize === 'NONE');
    
    debugData.textAutoResize = textAutoResize;
    debugData.isWrappingText = isWrappingText;
    
    if (isWrappingText && textBefore.length > 0) {
      // For wrapping text: measure the actual wrapped height of text before emoji
      let wrapMeasureNode = null;
      try {
        wrapMeasureNode = figma.createText();
        wrapMeasureNode.fontName = fontName;
        wrapMeasureNode.fontSize = fontSize;
        // Set to HEIGHT mode with same width as original - this wraps the text
        wrapMeasureNode.textAutoResize = 'HEIGHT';
        wrapMeasureNode.resize(node.width, 100); // Set same width, height will auto-adjust
        wrapMeasureNode.characters = textBefore;
        
        // The height of this wrapped text gives us the Y offset
        // We subtract one line height because we want offset to the LAST line's baseline
        const wrappedHeight = wrapMeasureNode.height;
        yOffsetForLines = wrappedHeight - fontSize; // Offset to last line's top, not bottom
        
        // Also get line height from this measured node
        if (wrapMeasureNode.lineHeight && typeof wrapMeasureNode.lineHeight !== 'symbol') {
          if (wrapMeasureNode.lineHeight.unit === 'PIXELS') {
            lineHeight = wrapMeasureNode.lineHeight.value;
          } else if (wrapMeasureNode.lineHeight.unit === 'PERCENT') {
            lineHeight = fontSize * (wrapMeasureNode.lineHeight.value / 100);
          }
        }
        
        debugData.wrappedHeight = wrappedHeight;
        debugData.yOffsetFromWrap = yOffsetForLines;
        
        wrapMeasureNode.remove();
      } catch (e) {
        // Fallback to line break counting if measurement fails
        console.warn('[Emoji Position] Wrap measurement failed, falling back to line count');
        yOffsetForLines = lineBreaksBefore * lineHeight;
        if (wrapMeasureNode) {
          try { wrapMeasureNode.remove(); } catch (e2) {}
        }
      }
    } else {
      // For non-wrapping text (WIDTH_AND_HEIGHT): use line break counting
      try {
        if (node.lineHeight && typeof node.lineHeight !== 'symbol') {
          if (node.lineHeight.unit === 'PIXELS') {
            lineHeight = node.lineHeight.value;
          } else if (node.lineHeight.unit === 'PERCENT') {
            lineHeight = fontSize * (node.lineHeight.value / 100);
          }
        }
      } catch (e) {}
      
      yOffsetForLines = lineBreaksBefore * lineHeight;
    }
    
    debugData.lineHeight = lineHeight;
    debugData.yOffsetForLines = yOffsetForLines;
    debugData.relativeY_original = relativeY;
    
    // Apply the Y offset
    relativeY = relativeY + yOffsetForLines;
    debugData.relativeY_afterLineOffset = relativeY;
    // #endregion
    
    // Emoji dimensions are approximately fontSize x fontSize
    const emojiWidth = fontSize;
    const emojiHeight = fontSize;
    
    // #region agent log - Final result
    debugData.finalX = relativeX;
    debugData.finalY = relativeY;
    debugData.emojiWidth = emojiWidth;
    debugData.emojiHeight = emojiHeight;
    console.log('[Emoji Position Debug] ' + JSON.stringify(debugData));
    // #endregion
    
    return {
      x: relativeX,
      y: relativeY,
      width: emojiWidth,
      height: emojiHeight,
      fontSize: fontSize
    };
    
  } catch (e) {
    console.error('[Emoji] Failed to calculate position: ' + e.message);
    
    // Fallback: use simple estimation
    const nodeAbsX = node.absoluteTransform ? node.absoluteTransform[0][2] : node.x;
    const nodeAbsY = node.absoluteTransform ? node.absoluteTransform[1][2] : node.y;
    const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 16;
    
    // Rough estimate: assume monospace-like character width
    const charWidth = fontSize * 0.6;
    const xOffset = charIndex * charWidth;
    
    return {
      x: nodeAbsX - frameAbsX + xOffset,
      y: nodeAbsY - frameAbsY,
      width: fontSize,
      height: fontSize,
      fontSize: fontSize
    };
    
  } finally {
    if (measureNode) {
      try {
        measureNode.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Extract all emojis from a text node with their positions and images
 * @param {TextNode} node - The Figma text node
 * @param {number} frameAbsX - Frame's absolute X position
 * @param {number} frameAbsY - Frame's absolute Y position
 * @returns {Promise<Array>} Array of emoji data objects
 */
async function extractEmojisFromTextNode(node, frameAbsX, frameAbsY) {
  if (node.type !== 'TEXT') return [];
  
  const emojis = detectEmojis(node.characters);
  if (emojis.length === 0) return [];
  
  console.log('[Emoji] Found ' + emojis.length + ' emoji(s) in "' + node.name + '"');
  
  const results = [];
  
  for (const emojiInfo of emojis) {
    try {
      // Get font size at this position
      let fontSize = 16;
      try {
        const sizeAtChar = node.getRangeFontSize(emojiInfo.index, emojiInfo.index + 1);
        if (typeof sizeAtChar === 'number') {
          fontSize = sizeAtChar;
        } else if (typeof node.fontSize === 'number') {
          fontSize = node.fontSize;
        }
      } catch (e) {
        if (typeof node.fontSize === 'number') {
          fontSize = node.fontSize;
        }
      }
      
      // Calculate position
      const position = await calculateEmojiPosition(node, emojiInfo.index, frameAbsX, frameAbsY);
      
      // Export emoji as PNG
      const base64 = await exportEmojiAsPNG(emojiInfo.emoji, fontSize);
      
      if (base64) {
        results.push({
          textNodeName: node.name,
          emojiChar: emojiInfo.emoji,
          charIndex: emojiInfo.index,
          base64: base64,
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
          fontSize: fontSize
        });
        
        console.log('[Emoji] Processed: "' + emojiInfo.emoji + '" at index ' + emojiInfo.index + 
                    ' -> (' + position.x.toFixed(1) + ', ' + position.y.toFixed(1) + ')');
      }
    } catch (e) {
      console.error('[Emoji] Failed to process emoji "' + emojiInfo.emoji + '": ' + e.message);
    }
  }
  
  return results;
}

/**
 * Find all emojis in all text nodes within a tree
 * Filters out nodes that are outside the frame bounds
 * 
 * @param {SceneNode} node - The root node to search
 * @param {Array} results - Array to collect results
 * @param {number} frameAbsX - Frame's absolute X position
 * @param {number} frameAbsY - Frame's absolute Y position
 * @param {number} frameWidth - Frame width for bounds checking
 * @param {number} frameHeight - Frame height for bounds checking
 * @returns {Promise<Array>} Array of emoji data objects
 */
async function findAllEmojis(node, results, frameAbsX, frameAbsY, frameWidth, frameHeight) {
  results = results || [];
  frameAbsX = frameAbsX || 0;
  frameAbsY = frameAbsY || 0;
  frameWidth = frameWidth || 0;
  frameHeight = frameHeight || 0;
  
  // #region agent log
  console.log('[Emoji Debug] findAllEmojis checking node: ' + node.name + ' (type: ' + node.type + ')');
  // #endregion
  
  // Check if this is a text node with emojis
  if (node.type === 'TEXT') {
    // BOUNDS CHECK: Skip text nodes that are completely outside the frame
    var pageAbsoluteX = node.absoluteTransform ? node.absoluteTransform[0][2] : node.x;
    var pageAbsoluteY = node.absoluteTransform ? node.absoluteTransform[1][2] : node.y;
    var relativeX = pageAbsoluteX - frameAbsX;
    var relativeY = pageAbsoluteY - frameAbsY;
    
    var tolerance = 1;
    var nodeRight = relativeX + node.width;
    var nodeBottom = relativeY + node.height;
    
    var isOutsideRight = relativeX > frameWidth + tolerance;
    var isOutsideBottom = relativeY > frameHeight + tolerance;
    var isOutsideLeft = nodeRight < -tolerance;
    var isOutsideTop = nodeBottom < -tolerance;
    
    if (frameWidth > 0 && frameHeight > 0 && (isOutsideRight || isOutsideBottom || isOutsideLeft || isOutsideTop)) {
      console.log('[Emoji Debug] Skipping text node "' + node.name + '" - outside frame bounds');
      // Don't process this node
    } else {
      // #region agent log
      console.log('[Emoji Debug] Found TEXT node: "' + node.name + '" with characters: "' + node.characters.substring(0, 50) + '..."');
      const hasEm = hasEmojis(node);
      console.log('[Emoji Debug] hasEmojis result: ' + hasEm);
      // #endregion
      
      if (hasEm) {
        try {
          // #region agent log
          console.log('[Emoji Debug] Extracting emojis from text node...');
          // #endregion
          const emojiData = await extractEmojisFromTextNode(node, frameAbsX, frameAbsY);
          // #region agent log
          console.log('[Emoji Debug] extractEmojisFromTextNode returned ' + emojiData.length + ' emoji(s)');
          // #endregion
          for (const emoji of emojiData) {
            results.push(emoji);
          }
        } catch (e) {
          // #region agent log
          console.error('[Emoji Debug] ERROR in extractEmojisFromTextNode: ' + e.message);
          // #endregion
        }
      }
    }
  }
  
  // Recurse into children
  if ('children' in node) {
    for (const child of node.children) {
      await findAllEmojis(child, results, frameAbsX, frameAbsY, frameWidth, frameHeight);
    }
  }
  
  // #region agent log
  console.log('[Emoji Debug] findAllEmojis returning with ' + results.length + ' total emoji(s)');
  // #endregion
  
  return results;
}

// Check what's selected and send info to UI
function checkSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ 
      type: 'selection-info', 
      hasSelection: false,
      message: 'No frame or group selected'
    });
    return;
  }
  
  const node = selection[0];
  const isValidType = node.type === 'FRAME' || 
                      node.type === 'GROUP' || 
                      node.type === 'COMPONENT' ||
                      node.type === 'INSTANCE';
  
  if (!isValidType) {
    figma.ui.postMessage({ 
      type: 'selection-info', 
      hasSelection: false,
      message: 'Please select a frame, group, or component'
    });
    return;
  }
  
  figma.ui.postMessage({ 
    type: 'selection-info', 
    hasSelection: true,
    name: node.name,
    type: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height)
  });
}

// Export selection and send to Cavalry
async function sendSelectionToCavalry() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Please select a frame or group first' 
    });
    return;
  }
  
  const node = selection[0];
  
  // Validate node type
  const isValidType = node.type === 'FRAME' || 
                      node.type === 'GROUP' || 
                      node.type === 'COMPONENT' ||
                      node.type === 'INSTANCE';
  
  if (!isValidType) {
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Please select a frame, group, or component' 
    });
    return;
  }
  
  // Temporarily enable clip content for frames to get correct viewBox
  let originalClipsContent = null;
  if (node.type === 'FRAME') {
    originalClipsContent = node.clipsContent;
    node.clipsContent = true;
  }
  
  try {
    figma.ui.postMessage({ type: 'status', message: 'Analyzing design...' });
    
    // Get the frame's absolute position (for calculating relative positions)
    var frameAbsoluteX = 0;
    var frameAbsoluteY = 0;
    if (node.absoluteTransform) {
      frameAbsoluteX = node.absoluteTransform[0][2];
      frameAbsoluteY = node.absoluteTransform[1][2];
    }
    console.log('Frame absolute position: ' + frameAbsoluteX + ', ' + frameAbsoluteY);
    
    // HYBRID APPROACH: Find nodes with gradient strokes that need special handling
    // Pass frame dimensions for bounds checking - filters out nodes outside the frame
    let vectorDataNodes = [];
    try {
      vectorDataNodes = findNodesWithGradientStrokes(node, [], '', frameAbsoluteX, frameAbsoluteY, node.width, node.height);
    } catch (e) {
      console.error('Error finding gradient stroke nodes:', e.message);
    }
    
    const hasStrokeGradients = vectorDataNodes.length > 0;
    
    if (hasStrokeGradients) {
      console.log('Found ' + vectorDataNodes.length + ' node(s) with gradient strokes - using hybrid export');
      // Log the extracted data for debugging
      for (var i = 0; i < vectorDataNodes.length; i++) {
        var vd = vectorDataNodes[i];
        var pathCount = (vd.vectorPaths) ? vd.vectorPaths.length : 0;
        var strokeCount = (vd.strokes) ? vd.strokes.length : 0;
        console.log('  - ' + vd.name + ': ' + pathCount + ' paths, ' + strokeCount + ' strokes');
        if (vd.vectorPaths && vd.vectorPaths[0] && vd.vectorPaths[0].data) {
          console.log('    Path data: ' + vd.vectorPaths[0].data.substring(0, 100) + '...');
        }
      }
    }
    
    // HYBRID APPROACH: Find text nodes for accurate alignment data
    // Pass frame dimensions for bounds checking - filters out nodes outside the frame
    let textDataNodes = [];
    try {
      // Reset name tracking to ensure unique names for this frame
      resetTextNodeNameTracking();
      textDataNodes = findTextNodes(node, [], '', frameAbsoluteX, frameAbsoluteY, node.width, node.height);
    } catch (e) {
      console.error('Error finding text nodes:', e.message);
    }
    
    const hasTextData = textDataNodes.length > 0;
    
    if (hasTextData) {
      console.log('Found ' + textDataNodes.length + ' text node(s) - sending alignment data');
    }
    
    // EMOJI EXTRACTION: Find and export emojis as images
    // Cavalry can't render emoji fonts, so we export them as PNGs
    figma.ui.postMessage({ type: 'status', message: 'Processing emojis...' });
    
    // #region agent log
    console.log('[Emoji Debug] === Starting emoji extraction ===');
    console.log('[Emoji Debug] Frame: ' + node.name + ', absolutePos: (' + frameAbsoluteX + ', ' + frameAbsoluteY + ')');
    // #endregion
    
    let emojiDataNodes = [];
    try {
      emojiDataNodes = await findAllEmojis(node, [], frameAbsoluteX, frameAbsoluteY, node.width, node.height);
      // #region agent log
      console.log('[Emoji Debug] findAllEmojis completed, got ' + emojiDataNodes.length + ' emoji(s)');
      // #endregion
    } catch (e) {
      // #region agent log
      console.error('[Emoji Debug] ERROR in findAllEmojis: ' + e.message);
      console.error('[Emoji Debug] Stack: ' + e.stack);
      // #endregion
      console.error('Error finding emojis:', e.message);
    }
    
    const hasEmojiData = emojiDataNodes.length > 0;
    
    // #region agent log
    console.log('[Emoji Debug] hasEmojiData: ' + hasEmojiData);
    if (hasEmojiData) {
      console.log('[Emoji Debug] First emoji: ' + JSON.stringify(emojiDataNodes[0]));
    }
    // #endregion
    
    if (hasEmojiData) {
      console.log('Found ' + emojiDataNodes.length + ' emoji(s) - exporting as images');
    }
    
    figma.ui.postMessage({ type: 'status', message: 'Exporting SVG...' });
    
    // Export as SVG (main export format)
    const svgData = await node.exportAsync({ 
      format: 'SVG',
      svgIdAttribute: true,
      svgOutlineText: false,
      svgSimplifyStroke: true
    });
    
    // Convert Uint8Array to string - handle large SVGs
    let svgString = '';
    try {
      // For small SVGs, use the simple approach
      if (svgData.length < 50000) {
        svgString = String.fromCharCode.apply(null, svgData);
      } else {
        // For large SVGs, chunk it to avoid call stack issues
        const chunkSize = 10000;
        for (let i = 0; i < svgData.length; i += chunkSize) {
          const chunk = svgData.slice(i, i + chunkSize);
          svgString += String.fromCharCode.apply(null, chunk);
        }
      }
    } catch (e) {
      console.error('Error converting SVG to string:', e.message);
      throw e;
    }
    
    console.log('SVG exported: ' + svgString.length + ' chars');
    
    figma.ui.postMessage({ type: 'status', message: 'Sending to Cavalry...' });
    
    // Prepare the message payload
    const payload = { 
      type: 'send-svg', 
      svgCode: svgString,
      nodeName: node.name,
      // Include frame dimensions for coordinate conversion
      frameWidth: node.width,
      frameHeight: node.height,
      // Hybrid data: vector nodes with stroke gradients
      vectorData: hasStrokeGradients ? vectorDataNodes : null,
      // Hybrid data: text nodes with alignment info
      textData: hasTextData ? textDataNodes : null,
      // Emoji data: emojis exported as PNG images with positions
      emojiData: hasEmojiData ? emojiDataNodes : null
    };
    
    var vectorDataInfo = hasStrokeGradients ? (vectorDataNodes.length + ' nodes') : 'none';
    var textDataInfo = hasTextData ? (textDataNodes.length + ' nodes') : 'none';
    var emojiDataInfo = hasEmojiData ? (emojiDataNodes.length + ' emojis') : 'none';
    console.log('Sending payload: SVG ' + svgString.length + ' chars, vectorData: ' + vectorDataInfo + ', textData: ' + textDataInfo + ', emojiData: ' + emojiDataInfo);
    
    // IMPORTANT: Sanitize vectorData by going through JSON round-trip
    // This strips out Symbols and other non-serializable Figma internals
    // that cause "Cannot unwrap symbol" error in postMessage
    if (payload.vectorData) {
      try {
        var jsonStr = JSON.stringify(payload.vectorData);
        console.log('vectorData JSON: ' + jsonStr.length + ' chars');
        // Parse it back to get a clean, Symbol-free copy
        payload.vectorData = JSON.parse(jsonStr);
        console.log('vectorData sanitized successfully');
      } catch (e) {
        console.error('vectorData sanitization failed: ' + e.message);
        // Fall back to sending without vectorData
        payload.vectorData = null;
      }
    }
    
    // Sanitize textData the same way
    if (payload.textData) {
      try {
        var textJsonStr = JSON.stringify(payload.textData);
        console.log('textData JSON: ' + textJsonStr.length + ' chars');
        payload.textData = JSON.parse(textJsonStr);
        console.log('textData sanitized successfully');
      } catch (e) {
        console.error('textData sanitization failed: ' + e.message);
        payload.textData = null;
      }
    }
    
    // Sanitize emojiData the same way
    if (payload.emojiData) {
      try {
        var emojiJsonStr = JSON.stringify(payload.emojiData);
        console.log('emojiData JSON: ' + emojiJsonStr.length + ' chars');
        payload.emojiData = JSON.parse(emojiJsonStr);
        console.log('emojiData sanitized successfully');
      } catch (e) {
        console.error('emojiData sanitization failed: ' + e.message);
        payload.emojiData = null;
      }
    }
    
    // Send to UI for HTTP request (main thread can't make HTTP requests)
    try {
      figma.ui.postMessage(payload);
      console.log('postMessage sent to UI');
    } catch (e) {
      console.error('postMessage failed: ' + e.message);
    }
    
  } catch (error) {
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Failed to export: ' + error.message 
    });
  } finally {
    // Restore original clip content setting
    if (node.type === 'FRAME' && originalClipsContent !== null) {
      node.clipsContent = originalClipsContent;
    }
  }
}


// Monitor selection changes
figma.on('selectionchange', () => {
  checkSelection();
});

// Small delay to ensure UI is ready before checking selection
setTimeout(() => {
  checkSelection();
}, 100);

