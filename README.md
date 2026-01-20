
<p align="center" style="margin-top:0;margin-bottom:0;">
  <img width="240" height="75" alt="quiver_logo" src="https://github.com/user-attachments/assets/305b99e9-4ec3-48af-9c6b-e3f131d13acc" />
</p>
<p align="center" style="margin-top:0;margin-bottom:0;">
  <a href="https://github.com/phillip-motion/quiver/releases/latest">
    <img width="186" height="108" alt="quiver_download" src="https://github.com/user-attachments/assets/9295a646-c7ba-4649-b069-2e78204dc1ce" />
  </a>
</p>

<p align="center" style="margin-top:0;margin-bottom:0;">
  <img width="430" height="311" alt="Quiver UI" src="https://github.com/user-attachments/assets/d60bbaeb-8cb6-401e-ac9c-afd9bce1e0bd" />
</p>

### Making SVG import into Cavalry as smooth as drawing an arrow and letting it fly 🏹

Quiver improves on Cavalry's native SVG import by adding support for gradients, images, editable text and more.

## Demo
https://github.com/user-attachments/assets/d99671f8-e279-4cd0-8b74-6c054f8c5147

## Features
- Send SVGs from Figma to Cavalry in one click
- Import or paste SVGs from other software
- Supports embedded images, gradients, shadows, blurs, editable text and more

**Plus, additional features:**
- **Convert To Rectangle**: create a rectangle from the bounding box of a selected layer
- **Dynamic Align**: Dynamically adjust the pivot point of a layer
- **Flatten Shape**: Flatten all selected shapes into one layer
- **Horiontal/Vertical Text Alignment**: Dynamically adjust horizontal/vertical text alignment
- **Rename Layers**: Renames all selected layers as [name] 1, [name] 2 etc. 


## Installation
1. Extract the ZIP file.
2. Copy Quiver.js and the `quiver_assets` folder into your Cavalry Scripts folder.
3. In Cavalry, open the `Scripts` menu and select Quiver.

#### Figma Plugin (recommended)
1. In Figma, right click on any frame and go to `Plugins > Development > Import plugin from manifest...`
2. Open your Cavalry Scripts folder, go to `quiver_assets/Quiver for Figma` and select `manifest.json`
3. Done!

https://github.com/user-attachments/assets/feb4bcc6-242c-434c-b945-0d933e3607ae


## Usage

In Cavalry, open the `Scripts` menu and select Quiver.

> [!IMPORTANT]
> Make sure you have a [Cavalry project](https://docs.cavalry.scenegroup.co/user-interface/menus/window-menu/assets-window/project-settings/) selected.

Transfer from Figma in one click. Select a frame and use the Figma plugin.

<img width="272" height="134" alt="Figma plugin" src="https://github.com/user-attachments/assets/89fac727-cbeb-47e2-bf89-3084a366888d" />

#### Manual import

Otherwise click Paste to fire an SVG from your clipboard, or click Import to select a file. 

See [Preparing your SVGs](#preparing-your-svgs) to make sure your SVG files have the right settings.


### Convert to Rectangle
Converts selected shapes to rectangles while preserving:
- Fill and stroke styling
- Opacity and blend modes
- Position and hierarchy

### Dynamic Align
Automatically adjusts anchor points based on layer scale. Useful for maintaining alignment during animations

### Flatten Shape
Flattens complex shapes into simpler editable paths.

### Horizontal/Vertical Text Alignment
Automatically adjusts position of text when changing text alignment. Useful for maintaining position and original design.

### Rename Layers
Batch rename selected layers. Eg. [name] 1, [name] 2 etc. 


## Preparing your SVGs

### Manually importing from Figma
(We recommend using the Figma Plugin noted above for full Quiver functionality)
1. Select the frame you want to export
2. Under **Export** in the side panel, select SVG
3. Click the 3 dots and ensure your settings match below:
- [x] Include bounding box
- [x] Include "id" attribute (this retains layer names)
- [x] Simplify Stroke
- [ ] Outline Text
- [ ] Ignore overlapping layers
4. Export or copy your frame as SVG!

### Importing from Affinity
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
| Emojis `<emojis>`  | ✅  |
| Tspan `<tspan>`  | ✅  |
| Color  | ✅  |
| Opacity  | ✅  |
| Linear gradient  | ✅  |
| Radial gradient  | ✅  |
| Angular gradient  | ✅  |
| Diamond gradient  | ✅  |
| Strokes  | ✅  |
| Stroke dashes  | ✅  |
| Line caps  | ✅  |
| Line joins  | ✅  |
| Drop shadows  | ✅  |
| Inner shadows  | ✅  |
| Blur  | ✅  |
| Images  | ✅  |
| Patterns  | ✅  |
| Blend modes  | ✅ |
| Masks and clip paths  | ✅  |
| Background blur  | ✅  |
| Text alignment  | ✅  |


## Roadmap
We're actively working on:
- Adding support for Canva and Affinity
- Supporting more filter effects

## Credits
Made possible by your friends in the [Canva Creative Team](https://canvacreative.team).

Idea and main development by Jack Jaeschke. UI, icons and additional development assistance by Sam Mularczyk. Repo maintained by Phillip Tibballs, Jack Jaeschke and Sam Mularczyk. Made with the assistance of Cursor!

Feel free to open pull requests, dig through the code and use this to build your own tools. We release these freely to help further the Cavalry community!

## License
MIT
