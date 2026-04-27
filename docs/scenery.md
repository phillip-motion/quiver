# Quiver
Fire Figma designs into Cavalry.

# Long description
Quiver improves on Cavalry's native SVG import by adding support for gradients, images, editable text, shadows, blurs, masks, and other advanced SVG features.

It can send SVGs from Figma to Cavalry in one click, and also supports pasted or manually imported SVGs from other software.

Made by your friends in the Canva Creative Team.

# Manual

## Installation
1. Download the `Quiver.jsc` script file.
2. In Cavalry, open the Scripts folder.
3. Drag `Quiver.jsc` into the Scripts folder.
4. In Cavalry, go to the `Scripts` menu and open Quiver.

## Usage
1. Make sure a Cavalry project is selected.
2. In Figma, open the Actions (CMD-K) menu and search for **Quiver**.
3. Select a frame and click **Fire Towards Cavalry**.

## Figma Export Settings
When exporting SVGs manually from Figma, use these settings:
- [x] Include bounding box
- [x] Include `id` attribute
- [x] Simplify Stroke
- [ ] Outline Text
- [ ] Ignore overlapping layers

## Manual Import
**Figma plugin:** Recommended for full functionality and one-click transfer.

**Clipboard import:** Click **Paste** to send an SVG from your clipboard.

**File import:** Click **Import** to select an SVG file manually.

## Supported Features
Quiver supports the following SVG features:
- Basic shapes: rectangles, circles, ellipses, paths, polygons, lines, and polylines
- Text: editable text, text alignment, tspans, emojis, and limited variable font support
- Styling: color, opacity, strokes, stroke dashes, line caps, and line joins
- Effects: linear, radial, angular, and diamond gradients; drop shadows; inner shadows; blur; background blur
- Advanced content: embedded images, patterns, blend modes, masks, and clip paths

## Extra Tools
Quiver also includes additional utility features:
- **Convert To Rectangle** - creates a rectangle from the bounding box of a selected layer
- **Dynamic Align** - dynamically adjusts the pivot point of a layer
- **Flatten Shape** - flattens selected shapes into one editable layer
- **Horizontal/Vertical Text Alignment** - adjusts text alignment while maintaining its visual position
- **Rename Layers** - renames selected layers as `[name] 1`, `[name] 2`, and so on

## Recommended workflow
1. Install `Quiver.jsc` in Cavalry.
2. Open Quiver from the `Scripts` menu.
3. Send artwork from Figma with **Fire Towards Cavalry**, or import SVGs manually.
4. Edit imported layers in Cavalry, including supported text, shapes, images, gradients, and effects.
5. Use the extra tools to clean up, align, flatten, or rename layers.

## Roadmap
- Add full support for Canva
- Add full support for Affinity

## Credits
Made possible by your friends in the Canva Creative Team.

Idea and main development by Jack Jaeschke. UI, icons and additional development assistance by Sam Mularczyk. Repo maintained by Phillip Tibballs, Jack Jaeschke and Sam Mularczyk.

## Changelog
[1.6.4] - Added warning when Cavalry project isn't selected
[1.6.3] - Fix image assets being overwritten
[1.6.2] - Fix bug where Quiver deleted imported art
[1.6.0] - Major update! Emoji & text alignment support, multiple text styles within one object, inner shadow, background blur, gradient strokes, improved alignment and UX
[1.5.2] - Blend mode and clipping mask support
[1.5.0] - Figma plugin added, more compact UI
[1.1.0] - Improved letter spacing import, checks for updates automatically
[1.0.0] - Initial release
