# 🏹 Quiver for Affinity

Send editable layers from Affinity straight into Cavalry, without going through SVG.

A script inside Affinity reads the document (shapes, curves, fills, gradients, strokes, layer effects, live text with fonts and alignment, placed images, clipping) and writes a Quiver JSON file. Quiver in Cavalry rebuilds it as native layers.

For a quick start, see the [main README](../../README.md#affinity).

## Requirements

1. **Affinity 3.2** or later
2. **Cavalry** with **Quiver** open (it listens for Affinity on port 8767)

## Installation

1. In Affinity, go to **Settings > Scripting** and turn on **Enable Affinity Scripting**.
2. Under **Default Permissions**, enable **Access the file system** and **Access networks**, then add your **Desktop** under **File System Access**.
3. Download [`Quiver (v2.0) - Fire towards Cavalry.afscript`](Quiver%20%28v2.0%29%20-%20Fire%20towards%20Cavalry.afscript) and import it into your Scripts Library, and check its settings allow file system and network access.

The `.afscript` is [`quiver-affinity.js`](quiver-affinity.js) packaged for Affinity. Re-export it after changing the script.

Why the Desktop? Affinity's script can't post data to Cavalry directly, so the payload and images pass through the Desktop for a moment. Cavalry moves the images into your project and removes the files, so nothing stays there.

If a permission is missing, the script tells you exactly which setting to change when you run it.

## Usage

### Sending a design

1. **Open Quiver in Cavalry.** If it isn't open when you run the script, the script asks you to open it and press OK to try again. Nothing is written until Cavalry answers.
2. **Select what to send** in Affinity. Nothing selected sends the whole current spread. Hidden layers are not sent.
3. **Run the script** from the Scripts Library.
4. **Pick New composition or Active composition** and press **OK**. Cancel closes without sending.

The window opens on the choices from your last send, which Cavalry remembers.

### Send options

- **Include images and pixel layers**: switch off for a quick layout send with grey placeholders.
- **Rebuild brush textures in Cavalry**: vector brush textures are rebuilt so they follow path edits. See [Vector brushes](#vector-brushes).
- **Fire rasterised**: sends everything exactly as Affinity draws it, as a single image layer.
  - With nothing selected, you get the whole spread at its full size.
  - With a selection, each layer is drawn on its own (so an artboard's background stays out), then stacked, cut to what they paint and placed where they sit. A single selected layer keeps its blend mode; several are stacked as Normal.
  - Pixels are converted to sRGB like the editable route, and a side over 4096 pixels is thinned to fit.
  - The image and brush switches are greyed out while it's on.
  - Affinity's layer renderer draws a RAW (Develop) layer as nothing, so a rasterised send that includes one goes through Affinity's own PNG export instead. That export has the document's background, and the file keeps the document's colour profile, which Cavalry honours.

### Where things land

- **Artboards**: with **New composition**, every artboard becomes its own composition (named after the artboard, sized to it, background from the artboard fill), like Figma frames. Anything outside the artboards lands in a spread-sized composition. With **Active composition**, an artboard becomes a group with a clipping background rectangle.
- **Selections inside an artboard** (or the artboard itself) keep their position relative to that artboard, so they land in the same place in the matching composition. The dialog names the artboard it will use.
- **Images** are stored in your project's `Assets/Quiver` folder with the same naming as Figma imports (`<Artboard or document>_<Layer>_<hash>.<ext>`, so re-sending the same picture reuses the file), and loaded under the **Quiver** group in the Assets Window.
- **No project yet?** You're asked for a folder, exactly as with Figma. If you cancel, the images are used from the Desktop and nothing is deleted.
- **Send didn't arrive?** If Cavalry doesn't receive it (for example, the panel was closed in the meantime), the script offers to send it again. Cancel removes the prepared files.

## What comes across

### Shapes and layers

- Groups and Layer containers
- Rectangles, ellipses, polygons and stars as live primitives: a polygon on any box (except an even-sided one in a stretched box) and a star in a square box. Cogs, stretched stars and the other shapes arrive as editable paths.
- Live corners from the Corner Tool (Affinity's own baked geometry, via the curves interface)
- Each curve's fill mode (Winding / Alternate) as the editable shape's Fill Rule
- Opacity, blend modes, clipping, layer colour tags and locks

### Fills and colour

- Solid and gradient fills, including several fills on one object
- Pattern (bitmap) fills as a placed image shader with the same tiling (transparent, edge, tile or mirror). A mirrored or skewed pattern is placed without the mirror or skew. With **Include images and pixel layers** off, they arrive as grey.
- Fill layers (**Layer > New Fill Layer**) with a solid colour or a linear, radial, elliptical or conical gradient. They're added as an extra shader on the one layer they tint when that's unambiguous, otherwise as a rectangle spanning what clips them.
- Colour tints from the Swatches panel
- The colour and gradient **Noise** slider: per-pixel monochrome noise as Affinity draws it (measured within a level of its strength), as an SkSL filter whose input `n0` is the amount
- CMYK-defined colours, converted through the colour profiles the way Affinity renders them (not the naive CMYK-to-RGB the API returns)

### Strokes

- Solid and gradient strokes, including several strokes on one object
- "Scale with object" strokes grow with their layer's and groups' scale, the way Affinity draws them
- Dashes
- Stroke **Pressure** profiles as the stroke's Width Profile (straight and curved profiles; a dashed stroke stays at full weight, as Affinity draws it)
- Vector brush strokes. See [Vector brushes](#vector-brushes).

### Text

- Art and frame text with per-run size, typeface and colour
- Variable fonts: a named instance (such as Ease Variable SemiDisplay Bold) is matched through its PostScript name
- Variable fonts set with the axis sliders: Affinity's scripting can't read the slider values, so Quiver matches the **Weight** axis to how wide Affinity draws the text (within about 1.5%). Other axes, such as Ease Variable's corner axes, don't change the width, so they keep their defaults and the console names them; set them in Cavalry's font axes (the three dots beside Font). Weight isn't matched for text that mixes fonts or for wrapped, turned or flipped text frames.
- Turned and flipped text (art and frame) keeps Affinity's position, turn and mirror
- Text strokes, including outline-only text
- Gradients on text are laid in Screen Space across the whole text, since Cavalry draws a text shader once per glyph. Moving the text moves it through a gradient that stays put.
- Underline, strikethrough, superscript and subscript
- Caps styles (as capitals)
- Tracking and leading: all Affinity leading modes and the Character panel's leading override, plus art text whose lines mix sizes with an exact leading
- Frame text at its true rendered size (a resized frame doesn't scale its text unless the frame is in scaled-text mode)
- Text frames turned on the page: a spine title turned 90 degrees keeps its own box (1726 x 318 rather than its upright 318 x 1726) and turns about its top-left corner
- Page-number fields as the printed number
- Text on a path and filler text, as outlined glyphs. See [Text on a path and filler text](#text-on-a-path-and-filler-text).

### Images and pixels

- Placed images at source resolution. Originals Cavalry can't load (TIFF, HEIF or JPEG XL) are decoded by Affinity and sent as a full-resolution PNG.
- Cropped placed images arrive as one rectangle the size of the crop, with the whole picture placed inside it by the image shader, like a cropped Figma image. Resizing the rectangle re-crops it. A square-cornered mask that matches that window exactly is not rebuilt.
- A plain picture (mirrored ones too) clipped by a shape or by another picture rides on that layer as an extra image shader, under its stroke like in Affinity, instead of arriving as a separate layer with a hidden mask copy.
- RAW (Develop) layers as their developed photo (read from the layer's raster, identical to Affinity's own export of it)
- Painted Pixel layers, rendered by Affinity to an RGBA PNG. A Pixel layer that clips other layers clips them by its painted alpha. In a CMYK document, Affinity's layer renderer draws Pixel layers as nothing, so those go through Affinity's own export, placed by their box rounded out to whole pixels.
- Embedded documents (a placed .afpub, .afdesign or PDF). The API gives no way into their layers, so each is rendered by Affinity at its placed size and arrives as one picture. Copy its layers into the main document first to get them editable.
- Pictures over 4096 pixels a side are scaled to fit by averaging (not by taking every Nth pixel).

### Effects

- Drop and inner shadows, glows, blur, colour overlay, gradient overlay and outline effects
- Gradient overlays are stacked on the fill and the stroke as shaders, at the effect's opacity and blend mode, with the base colours kept underneath. A layer with no fill or stroke for it to sit on skips it.
- Transparency-tool fades on shapes, text and groups. A flat value folds into the layer opacity. A linear, radial, elliptical or conical gradient becomes a hidden "\<layer\> (transparency)" rectangle wired as an alpha track matte, so fills, images and blend modes are untouched.

### Masks

- Clipping and nested masks
- Painted pixel masks, rendered to a PNG whose alpha is the mask and applied as a track matte to everything the host clips. A pixel mask on a group is applied to every layer inside it (Cavalry ignores a track matte on a group).
- Mask layers work wherever they sit in the Layers panel. Nested on a layer or as its child, they mask that layer. A Mask standing on its own in a group or at the top level masks every layer below it there (a hidden track matte on each).
- Cavalry adds a layer's track mattes together, so where a layer already has a matte (its own mask, say), the Mask's picture is folded into that matte as a Destination In image shader named "Mask (combined)". The layer then shows only where both masks do, as in Affinity.
- Erase-blended layers. See [Erase](#erase).

### Adjustments and live filters

Supported: HSL, brightness/contrast, levels, curves, posterise, threshold, invert, black & white, Gaussian/box/motion blur, pixelate, vignette, sharpen, and add noise (as Cavalry Grain).

- A standalone adjustment or live-filter layer is imported as a group wrapping the layers below it, with the filter on the group.
- An adjustment or live filter that's a child of a layer adjusts that layer, as when nested. One that's a child of a clipping layer adjusts the clipped layers below it the same way, and the layer itself when it draws.
- An adjustment's own mask is not carried (the console lists those layers), so it reaches everything below it. Graded photos with masked adjustments are best sent with **Fire rasterised**.
- Black & White and (non-linear) Brightness / Contrast run Affinity's own formulas as SkSL filters, measured within a level. Cavalry's own filters for them work differently (no negative Black & White weights, a linear shift instead of curves).
- **Curves (RGB)** arrive as Cavalry's Curves filter with the same points, so they stay editable:
  - The master curve goes on RGB and each channel's on Red, Green, Blue and Alpha. Cavalry, like Affinity, runs a channel's curve before the master (measured).
  - Straight curves become Linear points. Smooth ones become Bezier points whose handles reproduce Affinity's curve exactly (Affinity's smooth curve is a natural cubic spline; measured within a level on 52 greys in Cavalry).
  - The adjustment's opacity becomes the filter's Opacity (mix).

## Blend modes

Most blend modes map straight across. Affinity's Add maps to Plus Lighter and Linear Burn to Plus Darker (both verified). The rest are rebuilt as follows.

### Vivid Light, Linear Light and Pin Light

Cavalry lacks these, so they're rebuilt exactly from two modes it has. The layer is duplicated: the copy below burns with its darker half (Colour Burn, Plus Darker or Darken through a Levels filter), and the copy above dodges with its lighter half (Colour Dodge, Plus Lighter or Lighten).

This works for layers without effects, masks, a Transparency gradient or clipped layers. Others keep Normal, and the console says so.

### Divide

Rebuilt exactly as Colour Dodge with an Invert filter on the layer (backdrop / layer = Colour Dodge of the inverted layer). Measured within a level of Affinity on five colour pairs, half opacity included.

### Groups with a blend mode

Affinity draws a group that has a blend mode (or a layer together with the layers it clips) on its own, then blends the result. A Cavalry group's blend mode only blends the layers inside it with each other, so such a stack becomes a **Pre-Comp**:

- Its layers go into a composition named "\<layer\> (\<blend mode\>)", and a Pre-Comp layer in its place carries the blend mode and opacity.
- Cavalry passes a Pre-Comp's blend mode down to the Normal layers inside it, so those are set to **Alpha Add**, which composites like Normal. Only translucent layers overlapping each other inside it add their alpha up.

### Blend Ranges

Blend Ranges for "This Layer" become an SkSL filter that scales the layer's alpha by the range curve at its own brightness (measured in Affinity: Rec.601 luma with straight lines between the points, within a level).

Ranges for the underlying layers or single channels, and ranges on groups, are not carried.

### Erase

Layers and groups blended with Erase cut themselves out of everything below them in the same group. Cavalry has no Erase mode, so the eraser is hidden and becomes an **Alpha Inverted** track matte on each of those layers. Strokes and partial opacity erase as they draw.

Inside a clipping shape that paints, Erase layers knock out of the shape instead: the layer becomes a **Subtract** clipping mask on the shape.

## Vector brushes

Vector brush strokes (the textured strokes of the Vector Brush tool) keep their path editable. The **Rebuild brush textures in Cavalry** switch picks how their texture comes across.

Affinity's scripting API exposes a brush's settings but not its texture, so Affinity renders it:
- **Switch off**: the stroke itself is rendered (by switching the layer's fill off and undoing that straight away, so the document is left as it was).
- **Switch on**: the same brush is drawn on a straight line in a scratch document.

Either way, brushed layers that also have layer effects, a Transparency gradient or clipped layers keep a plain stroke at the brush's width (the console names them).

### Switch off (default): Affinity's render

The texture is laid over a normal Cavalry stroke as a mask at full strength, so it looks exactly like Affinity.

- The stroke's colour, opacity (a 50% pen arrives as Stroke Alpha 50) and draw-on (Trim) stay editable.
- Moving or scaling the layer carries the texture with it.
- Editing the path's points does not move the texture, so a heavily reshaped path shows the mask's edges.

### Switch on: the brush follows the path

Affinity draws the same brush on a straight line as long as the path, in a hidden scratch document that closes again, and Cavalry bends that strip back along your path. The texture is Affinity's own: stretched or repeated to the path's length, with pressure and the brush's head and tail included. It follows when you reshape, move, rotate or scale the path or its groups, and re-stretches when its length changes.

**What gets built**

The brush is a layer named "\<layer\> brush", nested under its path, so it takes the path's opacity, blend mode, visibility and masks. It comes in locked, so a click in the Viewport can't drag it off its path. Select it in the Scene Tree to change it, or unlock it there.

Under it sit:
- a Lattice (bends the texture)
- a Pathfinder (lays it along the path)
- a Lattice Controller and a Path Length (the live stretch)
- a hidden copy of the path that Pathfinder follows
- a shader that draws the brush on

**Colour and opacity**

The texture travels as a colourless mask drawn at full strength. Affinity draws a vector brush as its pen colour through such a mask exactly (measured on 10 brushes: the pen's colour leaves the mask unchanged and its opacity only scales it), so the pen's colour and opacity arrive on the path's Stroke instead, where they stay editable.

The path keeps a stroke of width 0 (it draws nothing) whose settings drive the brush:
- **Stroke > Colour** and **Alpha** colour it. Animate them as usual. A 50% pen arrives as Alpha 50 and can be raised to 100.
- **Trim** with **Start / End / Travel / Reverse Path** draws it on. Travel wraps round as it does on a Cavalry stroke; Reverse Path counts from the other end.

**Ends and caps**

- Trim gives a straight end for Flat and Projecting caps, or a rounded one for Round (the cap starts as Affinity's).
- How round is input **n7** (Roundness, %) on "\<layer\> brush trim": 100 is half a circle, 0 is flat, 200 is twice as long. The path's own Width can't be used for this, since any width above 0 draws the path's plain line.
- The brush's own ends are Affinity's cap, drawn into the texture, so changing it means sending again.

**Width and taper**

Cavalry's Width tool and Width Profile on the path don't reach the brush (graphs can't be linked). Instead:
- use "\<layer\> brush stretch" **Scale Y** for an even width
- use "\<layer\> brush along" **Taper Graph** for a taper (0.5 is the brush as sent, 1 is double)

**Gradients and other shaders**

Add the shader to "\<layer\> brush" **Fill > Shaders** and set its **Blend Mode** to **Source Atop**. It then colours only the brush and lies along it, bending with the path. A linear gradient runs from the brush's start to its end; rotate it 90 to run across. At Normal, it fills the whole strip.

**Sliding the texture**

Pathfinder's own **Travel** on "\<layer\> brush along" slides the texture along the path instead, running straight off the end of an open path.

**Closed shapes**

These work like Affinity's: the brush runs once round from the shape's start point, so its head and tail meet there, and corners get a small rounded outside (Affinity's Pull corners).

**Image brushes**

Affinity's picture brushes, which draw their own colours, come across the same way in full colour. The strip carries the picture, so Stroke > Colour does nothing on them, while Alpha and Trim work as usual. A solid pen set in Affinity, which recolours an image brush keeping its shading, is drawn into the picture.

An image brush with a gradient pen, or that can't be laid along its path, arrives as Affinity's render in colour. Measured on yarn, flower and cat brushes: within a level of Affinity on both routes.

**Gradient pens**

A gradient pen comes in as "\<layer\> brush gradient" on the strip, with Affinity's colours sampled along the brush. Affinity lays the gradient flat over the layer, while a gradient on the bent strip runs along it, so each point of the path gets the colour Affinity draws there. It's exact along the path, but doesn't change across the brush's width, and an arrow's U-turn comes back through the same colours. It follows the brush when you reshape the path.

**Fallback**

These take the earlier route instead:
- strokes with several subpaths
- a pattern pen
- an Inside or Outside alignment (Affinity reshapes the texture for those, differently by path direction)
- a mirrored layer
- a stroke whose weight scales with a layer squashed by more than 1.6 to 1

Cavalry grows a similar texture with an SkSL filter when its self-check passes, and keeps Affinity's render (as with the switch off) when it doesn't. The console lists them with the reason. With **Include images and pixel layers** off, only the filter route is used.

**Accuracy**

Measured against Affinity drawing the same strokes (overlap, IoU):

| Test | Overlap |
| ---- | ------- |
| 20 brushes of the grid test (median) | 0.95 |
| Washes, gouache, markers and pencils on a new path | 0.96-0.996 |
| Smooth closed shapes | 0.93-0.96 |
| Rectangles | 0.91-0.94 |
| Scribbles | 0.83-0.86 |

- Fine stipples, hatching and engraving lines look the same, but their marks drift a few pixels on the outside of tight bends.
- A brush wider than a bend is tight can show a thin seam on the inside of it.
- Sharp U-turns (an arrow's tip doubling back) come out pointed where Affinity rounds them.
- A repeating brush stretches when the path gets longer instead of adding repeats. Send again for exact repeats.
- On a scaled layer whose stroke weight doesn't scale with it, Affinity lays the repeats out at the layer's own size and then scales them. A hatching brush on a layer scaled up 16 times therefore draws a few long streaks rather than many short marks. The strip is drawn the same way, so it matches.

**Speed**

On the sushi test design (54 brushed strokes, 50 laid along their paths): send 3.5 s (the filter route took 55 s), import 3 s, and about 2 ms a frame per brush.

## Text on a path and filler text

Text on a path is imported as outlined glyphs (a group of editable paths), because Affinity's scripting API doesn't expose the baseline path. The console says which layers this happened to.

Filler text (**Text > Insert > Filler Text**) comes across the same way, as one shape per text frame. The API only gives a placeholder for it, never the words Affinity draws.

The conversion is done on a temporary copy and undone immediately, so the Affinity document is left as it was (with one or two extra steps in its undo history).

## Gradients

- **Fill layer colours** can't be read through Affinity's scripting API, so the layer is rendered and its gradient is measured from the pixels. Centres and angles come back exact, radii within about 1% and stop positions within about 2% of the authored values.
- **Stop midpoints** bend each run the way Affinity does (t to the power 1 + 8 x (midpoint - 0.5), mirrored below the middle, measured within a level) and are drawn with short straight stops.
- **Radial and elliptical gradients** are placed from the true axes of the ellipse Affinity draws, so a turned gradient on a stretched layer lands where it should (the Frankentoon background came within a level).
- **Steep segments** are subdivided with extra linear stops, because Cavalry's gradient shader doesn't blend stops linearly in sRGB (a white-to-black ramp sits about 11 levels lighter at its middle and only reaches black in its last few percent). The final approach to black still renders a little lighter than in Affinity.

## Colour management

> [!TIP]
> For a match, use **sRGB** as Cavalry's working colour space, or leave Color Management off (which is sRGB).

- **Other working spaces**: when Cavalry's Color Management uses a working colour space other than sRGB (Rec.709, for example), Cavalry blends, mixes opacity and runs filters in that space, while Affinity (and Figma) work in sRGB. Blend modes, glows and filters then come out differently. Measured in a Rec.709 scene: grey 100 + 100 in Plus Lighter gave 180, not Affinity's 200.
- **Cavalry's Curves filter** is also affected: in a Rec.709 working space even its straight-line curve darkens the image (25 to 11, 100 to 86, measured), while in sRGB it's exact.
- **Adobe RGB (1998) documents**: colours, pixel layers and fill layers are converted to sRGB as they're sent, matching what Affinity shows within about 2 levels. Adjustments then act on the sRGB values (for the garden photo's Levels, that moves the result by under a level).
- **Other profiles** (Display P3, ProPhoto RGB) are sent unconverted, and the console says so. Placed images keep their original files.
- **CMYK documents** preview their images through the document's CMYK profile, so Affinity's canvas looks darker and less saturated than the same sRGB pixels in Cavalry.

## Known limitations

Everything below is reported in Cavalry's console when it comes up.

**Not carried**

- Shapes and fills
  - Mesh, hatch and diffusion fills (a neutral grey instead)
  - Fill layers whose fill isn't a single gradient (bitmap, mesh, hatch or several fills)
  - Arrowheads
- Strokes
  - The inside or outside alignment of a variable-width stroke (Cavalry draws tapered strokes centred)
  - Affinity's balanced dashes (Cavalry repeats the pattern evenly, so dashes at corners differ)
  - Brush strokes on text, and the brushed layers named in [Vector brushes](#vector-brushes) (a plain stroke instead)
- Text
  - Small caps and other caps styles
  - Table and shape text
  - Tracking that differs within one text
  - Text frame columns (the text arrives as one column of the same width)
  - Other field types
- Effects and adjustments
  - Bevel/emboss
  - A gradient overlay on a layer with no fill or stroke
  - The Vibrance adjustment (its Saturation slider also lifts brightness and its Vibrance slider behaves nothing like Cavalry's HSV Saturation, so no mapping is attempted)
  - Curves in LAB, CMYK or Grey, and a Curves input range other than 0 to 1
  - Colour balance, selective colour, split toning and white balance adjustments
- Blend modes Cavalry lacks: Pigment, Darker/Lighter Colour, Vivid/Pin/Linear Light on layers with effects or masks, Hard Mix, Subtract, Average, Negation, Reflect, Glow and Contrast Invert
- Masks
  - Erase-blended layers below a layer that already has a track matte (Transparency or pixel mask)
  - A Transparency gradient on a layer that already has a track matte (Cavalry adds mattes together, so it shows where either one does; the console names the layer)
- Spreads other than the current one

**Small differences**

- Colour overlay lands within a few levels of Affinity's blend.
- An outline effect on a layer that also has a stroke can differ by half the stroke width at the band edge.

## Troubleshooting

### The script says Cavalry isn't answering

Open Quiver in Cavalry and press OK to try again. Nothing is written until Cavalry answers.

### The script asks for a permission

Change the setting it names under **Settings > Scripting**. See [Installation](#installation).

### Colours or blend modes look different

Check Cavalry's working colour space. See [Colour management](#colour-management).

### Something is missing

Check Cavalry's console. Anything that couldn't come across is listed there, usually with the reason.

## Testing

The brush tests also check against Affinity's brush renders in `dev/testfiles/affinity/brush-grid` and `dev/testfiles/affinity/brushes`. Those files aren't in the repo, so without them those checks are skipped.

Run the automated tests from `dev/` with:

```bash
npm run test:affinity
```
