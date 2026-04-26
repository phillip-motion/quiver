
<p align="center" style="margin-top:0;margin-bottom:0;">
  <img width="240" height="75" alt="quiver_logo" src="https://github.com/user-attachments/assets/305b99e9-4ec3-48af-9c6b-e3f131d13acc" />
</p>
<p align="center" style="margin-top:0;margin-bottom:0;">
  <a href="https://github.com/phillip-motion/quiver/releases/latest/download/Quiver.jsc">
    <img width="186" height="58px" alt="quiver_download" src="https://github.com/user-attachments/assets/9295a646-c7ba-4649-b069-2e78204dc1ce" />
  </a>
</p>

<p align="center" style="margin-top:0;margin-bottom:0;">
   <img width="600" height="338" alt="quiver_download" src="https://github.com/user-attachments/assets/e5f550f0-e05e-40b2-bc6e-bc39223e50b2" />
</p>


### Launch your designs into Cavalry 🏹

Quiver improves on Cavalry's native SVG import by adding support for gradients, images, editable text and more.

## Features
- Send SVGs from Figma to Cavalry in one click
- Import or paste SVGs from other software
- Supports embedded images, gradients, shadows, blurs, editable text and more

## Demo
https://github.com/user-attachments/assets/d99671f8-e279-4cd0-8b74-6c054f8c5147

**Plus, additional features:**
- **Convert To Rectangle**: create a rectangle from the bounding box of a selected layer
- **Dynamic Align**: Dynamically adjust the pivot point of a layer
- **Flatten Shape**: Flatten all selected shapes into one layer
- **Horizontal/Vertical Text Alignment**: Dynamically adjust horizontal/vertical text alignment
- **Rename Layers**: Renames all selected layers as [name] 1, [name] 2 etc. 

## Instructions

> [!IMPORTANT]
> Make sure you have a [Cavalry project](https://docs.cavalry.scenegroup.co/user-interface/menus/window-menu/assets-window/project-settings/) selected.

## Cavalry 

1. Copy the `Quiver.jsc` file into your Cavalry Scripts folder.
2. Select the `Scripts` menu and open Quiver.

## Figma

Open the Actions menu and search for **Quiver**.

<img width="487" height="239" alt="Open Quiver in Figma" src="https://github.com/user-attachments/assets/7208388f-b263-4ae5-be4a-34226318af4a" />

Then, select a frame and click **Fire Towards Cavalry**.

<img width="267" height="132" alt="Click the Fire button." src="https://github.com/user-attachments/assets/00ebf3fb-5154-4210-a500-79f317592bbc" />


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


## Manual import

(We recommend using the Figma Plugin above for full functionality)

### Figma
1. Select the frame you want to export
2. Under **Export** in the side panel, select SVG
3. Click the 3 dots and ensure your settings match below:
- [x] Include bounding box
- [x] Include "id" attribute (this retains layer names)
- [x] Simplify Stroke
- [ ] Outline Text
- [ ] Ignore overlapping layers
4. Export or copy your frame as SVG!

### Affinity
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
| Text alignment  | ✅  |
| Variable fonts  | ✅ (limited)  |
| Emojis  | ✅  |
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
