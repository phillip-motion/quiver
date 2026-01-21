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