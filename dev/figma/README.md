# 🏹 Quiver for Figma

Send your Figma designs directly to Cavalry with one click!

## Features

- ✅ **One-click export** - Select a frame and click "Send to Cavalry"
- ✅ **Automatic import** - No dialogs or confirmations needed
- ✅ **Real-time connection** - See if Cavalry/Quiver is running
- ✅ **Smart selection** - Works with frames, groups, components, and instances
- ✅ **Live preview** - See what will be sent before clicking

## Requirements

1. **Figma Desktop App** (or browser version)
2. **Cavalry 2.4.0+** running on your computer
3. **Quiver** loaded in Cavalry with web server enabled

## Installation

### 1. Install the Plugin in Figma

#### Option A: Development Mode (Recommended for testing)

1. Open Figma Desktop
2. Go to `Plugins > Development > Import plugin from manifest...`
3. Navigate to `/Users/sam/Repos/quiver/figma/`
4. Select `manifest.json`
5. The plugin is now installed!

#### Option B: Figma Community (Coming Soon)

Once published, you'll be able to install from the Figma Community.

### 2. Start Cavalry & Quiver

1. **Open Cavalry** (version 2.4.0 or higher)
2. **Load Quiver** - Go to `Scripts > (Browse...)` and open `Quiver-Dev.js`
3. **Verify server started** - Check Cavalry's Log Window for:
   ```
   🏹 Quiver API server listening on http://127.0.0.1:8765
   ```

If you see this message, you're ready! ✅

## Usage

### Basic Workflow

1. **Design in Figma** - Create your frames, components, or groups
2. **Select what to send** - Click on a frame or group
3. **Open the plugin** - Go to `Plugins > Development > Quiver for Figma`
4. **Click "Send to Cavalry"** - That's it!

The design will automatically appear in your Cavalry scene. No dialogs, no exports, no intermediate steps!

### What Can You Send?

- ✅ Frames
- ✅ Groups
- ✅ Components
- ✅ Component Instances

### Connection Status

The plugin shows your connection status at the bottom:
- 🟢 **Connected to Quiver** - Ready to send!
- ⚫ **Quiver not found** - Make sure Quiver is loaded in Cavalry

## Tips & Best Practices

### For Best Results

1. **Name your layers** - Use the `id` attribute in Figma for better layer names in Cavalry
2. **Use frames** - Frames export cleaner than loose groups
3. **Keep it organized** - Well-structured Figma files = well-structured Cavalry layers

### Export Settings

The plugin uses these Figma SVG export settings:
- ✅ Include ID attributes (preserves layer names)
- ✅ Simplify strokes
- ❌ Don't outline text (keeps text editable)

### What Gets Preserved?

From Figma to Cavalry via Quiver:
- ✅ Shapes (rectangles, circles, ellipses, paths)
- ✅ Colors and fills
- ✅ Strokes and borders
- ✅ Gradients (linear and radial)
- ✅ Opacity
- ✅ Layer names
- ✅ Images (embedded)
- ✅ Text (editable in Cavalry)
- ⚠️ Effects (shadows, blurs) - some supported
- ❌ Blend modes - basic support
- ❌ Auto-layout - converted to static positions

## Troubleshooting

### "Quiver not found"

**Check:**
1. ✅ Cavalry is running
2. ✅ Quiver-Dev.js is loaded (check Cavalry's Scripts menu)
3. ✅ Log Window shows "API server listening on http://127.0.0.1:8765"
4. ✅ You're using Cavalry 2.4.0 or higher

**Test the connection:**
```bash
curl -X POST http://127.0.0.1:8765/post \
  -H "Content-Type: application/json" \
  -d '{"action":"ping"}'
```

### "Please select a frame or group"

You need to select something in Figma first. The plugin works with:
- Frames
- Groups
- Components
- Instances

Individual shapes need to be inside a frame or group.

### Nothing happens after clicking "Send to Cavalry"

1. **Check Figma's console** - Right-click in plugin window > Inspect
2. **Check Cavalry's Log Window** - Look for Quiver messages

### Export looks different in Cavalry

SVG has some limitations compared to Figma's native format. Some features like:
- Complex blend modes
- Constraints and auto-layout

...are lost during SVG export. Glass is sent separately by the plugin (not via SVG), so it still comes through when you Fire to Cavalry.

## Development

### Testing Changes

1. Edit files in `/figma/`
2. In Figma Desktop, go to `Plugins > Development`
3. Right-click your plugin > "Restart"
4. Changes are now live!

### File Structure

```
figma/
├── manifest.json    # Plugin configuration
├── code.js          # Main plugin logic (Figma sandbox)
├── ui.html          # Plugin UI (can make HTTP requests)
└── README.md        # This file
```

### API Reference

The plugin sends HTTP POST requests to Quiver:

```javascript
fetch('http://127.0.0.1:8765/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'importSVG',
    svgCode: '<svg>...</svg>'
  })
});
```

See `WEBSERVER.md` in the main Quiver repo for full API documentation.

## Roadmap

Future features we're considering:
- [ ] Batch export (send multiple frames at once)
- [ ] Watch mode (auto-update Cavalry as you design)
- [ ] Custom export settings
- [ ] Direct Figma API integration (bypass SVG)
- [ ] Component library sync
- [ ] Keyboard shortcuts

## Contributing

Found a bug or want to add a feature? Open an issue on GitHub!

## License

MIT - Same as Quiver

---

Made with 🏹 by the Quiver team

