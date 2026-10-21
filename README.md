
<p align="center" style="margin-top:0;margin-bottom:0;">
  <img width="240" height="75" alt="quiver_logo" src="https://github.com/user-attachments/assets/305b99e9-4ec3-48af-9c6b-e3f131d13acc" />
</p>

<h3 align="center">Launch your designs into Cavalry 🏹</h3>
<p align="center">Send art from Affinity/Figma to Cavalry in one click.</p>

<p align="center" style="margin-top:0;margin-bottom:0;">
   <img width="600" height="338" alt="quiver_download" src="https://github.com/user-attachments/assets/e5f550f0-e05e-40b2-bc6e-bc39223e50b2" />
</p>

<p align="center">
  <a href="https://github.com/phillip-motion/Quiver/releases/latest/download/Quiver.jsc"><img width="258" height="48" alt="Download for Cavalry" src="https://github.com/user-attachments/assets/561a6d14-8c79-490d-9286-7e72510e5f8a" /></a> 
<a href="https://github.com/phillip-motion/Quiver/releases/latest/download/Quiver-for-Affinity.afscripts"><img width="257" height="48" alt="Download for Affinity" src="https://github.com/user-attachments/assets/2cd2d0d1-4745-4708-b40c-a87083e3a9fc" /></a> 
<a href="https://www.figma.com/community/plugin/1595599188685560428"><img width="186" height="48" alt="Add to Figma" src="https://github.com/user-attachments/assets/82e9d58f-b7c4-4676-b450-a3a4f49ae1c5" /></a>
</p>

## Demo
https://github.com/user-attachments/assets/d99671f8-e279-4cd0-8b74-6c054f8c5147

## Other features
- Import or paste SVGs from other software
- Supports editable text, embedded images, gradients, shadows, blurs and more
- **Convert To Rectangle**: create a rectangle from the bounding box of a selected layer
- **Dynamic Align**: Dynamically adjust the pivot point of a layer
- **Flatten Shape**: Flatten all selected shapes into one layer
- **Horizontal/Vertical Text Alignment**: Dynamically adjust horizontal/vertical text alignment
- **Rename Layers**: Renames all selected layers as [name] 1, [name] 2 etc. 


## Install

> [!IMPORTANT]
> Make sure you have a [Cavalry project](https://docs.cavalry.scenegroup.co/user-interface/menus/window-menu/assets-window/project-settings/) selected.

## Cavalry 
1. Copy the `Quiver.jsc` file into your Cavalry Scripts folder.
2. Select the `Scripts` menu and open Quiver.

## Affinity
> [!TIP]
> For colours and blend modes that match Affinity, use sRGB as Cavalry's working colour space (or leave Color Management off).

1. In Affinity, go to *Settings > Scripting* and turn on *Enable Affinity Scripting*.
2. Under *Default Permissions*, allow *Access the file system* and *Access networks*, then add your *Desktop* under *File System Access*.
3. Drag the `Quiver for Affinity.afscripts` file into your Affinity app.
4. Open *Window > Scripting > Scripts Library* and click *Quiver for Affinity*.

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

### Affinity features

| Feature name  | Supported |
| ------------- | ------------- |
| Rectangles, ellipses, polygons, stars  | :white_check_mark: (as live shapes)  |
| Curves and paths  | :white_check_mark:  |
| Live corners  | :white_check_mark:  |
| Artboards  | :white_check_mark: (as compositions)  |
| Art and frame text  | :white_check_mark:  |
| Text styling (fonts, size, colour, tracking, leading)  | :white_check_mark:  |
| Variable fonts  | :white_check_mark:  |
| Text on a path, filler text  | :white_check_mark: (outlined)  |
| Text columns, table text  | :x:  |
| Solid and gradient fills  | :white_check_mark:  |
| Multiple fills and strokes  | :white_check_mark:  |
| Fill layers  | :white_check_mark:  |
| Pattern fills  | :white_check_mark:  |
| Mesh, hatch and diffusion fills  | :x:  |
| Strokes and dashes  | :white_check_mark:  |
| Pressure profiles  | :white_check_mark:  |
| Vector brushes  | :white_check_mark:  |
| Arrowheads  | :x:  |
| Placed images  | :white_check_mark:  |
| Pixel and RAW layers  | :white_check_mark:  |
| Embedded documents  | :white_check_mark: (as an image)  |
| Opacity and Transparency tool  | :white_check_mark:  |
| Blend modes  | :white_check_mark: (most)  |
| Clipping and masks  | :white_check_mark:  |
| Shadows, glows, blur, colour and gradient overlay, outline  | :white_check_mark:  |
| Bevel and emboss  | :x:  |
| Adjustments and live filters  | :white_check_mark: (most)  |
| CMYK documents  | :white_check_mark:  |

## Figma features

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
| Glass  | ✅ (Figma plugin) |

## Credits
Made possible by your friends in the [Canva Creative Team](https://canvacreative.team).

Idea and main development by Jack Jaeschke. UI, icons and additional development assistance by Sam Mularczyk. Repo maintained by Phillip Tibballs, Jack Jaeschke and Sam Mularczyk. Made with Claude.

Feel free to open pull requests, dig through the code and use this to build your own tools. We release these freely to help further the Cavalry community!

## License
MIT
