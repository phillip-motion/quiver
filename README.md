# Quiver
<p align="center" style="margin-top:0;margin-bottom:0;">

  <img alt="Screenshot of the Quiver UI." src="/docs/quiver-screenshot.png" />
  
</p>

<p align="center" style="margin-top:0;margin-bottom:0;">

  <a href="https://github.com/phillip-motion/quiver/releases/latest">
<img width="200" height="80" src="https://github.com/user-attachments/assets/f7b3b274-ce43-4c46-bd55-bec9a45634ce" alt="Download Quiver" />
  </a>
</p>


### Making SVG import into Cavalry as smooth as drawing an arrow and letting it fly 🏹

Quiver improves on Cavalry's native SVG import by adding support for gradients, images, editable text and more.


## Features
- Paste or import SVGs in one click
- Supports embedded images, gradients, shadows, blurs, editable text and more

**Plus, additional features:**
- **Convert To Rectangle**: create a rectangle from the bounding box of a selected layer
- **Dynamic Align**: Dynamically adjust the pivot point of a layer
- **Flatten Shape**: Flatten all selected shapes into one layer
- **Rename Layers**: Renames all selected layers as [name] 1, [name] 2 etc. 


## Installation
Copy Quiver.js and the `quiver_assets` folder into your Cavalry Scripts folder.

## Usage

> [!IMPORTANT]
> Make sure you have a [Cavalry project](https://docs.cavalry.scenegroup.co/user-interface/menus/window-menu/assets-window/project-settings/) selected.

Simply click Paste to fire an SVG from your clipboard, or click Import to select a file. 

See [Preparing your SVGs](#preparing-your-svgs) to make sure your SVG files are in the right format.


### Convert to Rectangle
Converts selected shapes to rectangles while preserving:
- Fill and stroke styling
- Opacity and blend modes
- Position and hierarchy

### Dynamic Align
Automatically adjusts anchor points based on layer scale. Useful for maintaining alignment during animations

### Flatten Shape
Flattens complex shapes into simpler editable paths.

### Rename Layers
Batch rename selected layers. Eg. [name] 1, [name] 2 etc. 


## Preparing your SVGs

### Importing from Figma
1. Select the frame you want to export
2. Under **Export** in the side panel, select SVG
3. Click the 3 dots and ensure your settings match below:
- [x] Include bounding box
- [x] Include "id" attribute (this retains layer names)
- [x] Simplify Stroke
- [ ] Outline Text
- [ ] Ignore overlapping layers
4. Export or copy your frame as SVG!

### Importing from Affinity Designer
Coming soon!


## Supported features

| Feature name  | Supported |
| ------------- | ------------- |
| Rectangles `<rect>`  | ✅  |
| Circles `<circle>`  | ✅  |
| Ellipse `<ellipse>`  | ✅  |
| Paths `<path>`  | ✅  |
| Polygons `<polygon>`  | ✅  |
| Lines `<line>`  | ✅  |
| Polyline `<polyline>`  | ✅  |
| Text `<text>`  | ✅  |
| Tspan `<tspan>`  | ✅  |
| Color  | ✅  |
| Opacity  | ✅  |
| Linear gradient  | ✅  |
| Radial gradient  | ✅  |
| Strokes  | ✅  |
| Stroke dashes  | ✅  |
| Line caps  | ✅  |
| Line joins  | ✅  |
| Drop shadows  | ✅  |
| Blur  | ✅  |
| Images  | ✅  |
| Patterns  | ✅  |
| Blend modes  | Basic support |
| Background blur  | ❌  |
| Masks and clip paths  | ❌  |
| Text alignment  | ❌  |












## Roadmap
We're actively working on:
- Adding support for Affinity Designer
- Improving letter-spacing import
- Supporting more filter effects

## Credits
Created by your friends in the [Canva Creative Team](https://canvacreative.team). 

Idea and development by Jack Jaeschke using Cursor. UI & icons by Sam Mularczyk.

## License
MIT
