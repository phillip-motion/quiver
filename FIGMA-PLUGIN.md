# 🏹 Quiver for Figma - Technical Overview

This document explains how the Figma plugin integrates with Quiver and Cavalry.

## Architecture

```
┌─────────────┐         HTTP POST          ┌──────────────┐
│   Figma     │ ────────────────────────→  │   Quiver     │
│   Plugin    │   http://127.0.0.1:8765    │  Web Server  │
└─────────────┘                             └──────────────┘
      │                                            │
      │ 1. Export as SVG                           │ 2. Import SVG
      │                                            ↓
      │                                     ┌──────────────┐
      └─────────────────────────────────→  │   Cavalry    │
                                            │    Scene     │
                                            └──────────────┘
```

## Components

### 1. Figma Plugin (`/figma/`)

#### Files:
- **`manifest.json`** - Plugin configuration
- **`code.js`** - Main plugin logic (Figma sandbox)
- **`ui.html`** - UI with HTTP client
- **`README.md`** - User documentation
- **`QUICK-START.md`** - 2-minute setup guide

#### How It Works:

1. **Selection Monitoring**
   - Listens to `figma.on('selectionchange')`
   - Validates if selected node is exportable (Frame, Group, Component)
   - Updates UI with selection info

2. **SVG Export**
   ```javascript
   const svgData = await node.exportAsync({ 
     format: 'SVG',
     svgIdAttribute: true,      // Preserve layer names
     svgOutlineText: false,     // Keep text editable
     svgSimplifyStroke: true    // Simplify paths
   });
   ```

3. **HTTP Communication**
   - Main thread (code.js) can't make HTTP requests
   - Passes SVG to UI iframe (ui.html)
   - UI makes fetch() request to Quiver

4. **Connection Status**
   - Pings Quiver server every 5 seconds
   - Shows real-time connection status
   - Visual indicator (green dot = connected)

### 2. Quiver Web Server (`/src/functions/quiver_utilities_webserver.js`)

#### API Endpoint:
```
POST http://127.0.0.1:8765/post
Content-Type: application/json

{
  "action": "importSVG",
  "svgCode": "<svg>...</svg>"
}
```

#### Handler Flow:
```javascript
onPost() {
  request = parse(post.result)
  
  if (action === "importSVG") {
    processAndImportSVG(request.svgCode)  // Existing Quiver function
    console.log("✓ Imported")
  }
}
```

No dialogs, no confirmations - just automatic import!

## Data Flow

### Detailed Step-by-Step:

1. **User selects frame in Figma**
   ```javascript
   figma.currentPage.selection[0]  // Selected node
   ```

2. **User clicks "Send to Cavalry"**
   ```javascript
   figma.ui.postMessage({ type: 'send-to-cavalry' })
   ```

3. **Plugin exports as SVG**
   ```javascript
   const svg = await node.exportAsync({ format: 'SVG' })
   const svgString = new TextDecoder().decode(svg)
   ```

4. **SVG sent to UI iframe**
   ```javascript
   figma.ui.postMessage({ 
     type: 'send-svg', 
     svgCode: svgString 
   })
   ```

5. **UI makes HTTP request**
   ```javascript
   fetch('http://127.0.0.1:8765/post', {
     method: 'POST',
     body: JSON.stringify({
       action: 'importSVG',
       svgCode: svgString
     })
   })
   ```

6. **Quiver receives and processes**
   ```javascript
   // In quiver_utilities_webserver.js
   handleImportSVG(request) {
     processAndImportSVG(request.svgCode)  // Core Quiver function
   }
   ```

7. **Layers appear in Cavalry**
   - Parsed by existing Quiver SVG parser
   - Created as Cavalry layers
   - Preserves colors, strokes, gradients, etc.

## Security

### Localhost Only
```javascript
server.listen("127.0.0.1", 8765)  // Not accessible from internet
```

### No Data Storage
- Plugin doesn't store any designs
- HTTP requests are ephemeral
- No user data collected

### CORS Considerations
- Figma's UI iframe can make localhost requests
- No cross-origin issues (same machine)

## Performance

### SVG Export
- Figma's native SVG export is fast (~100ms for typical frames)
- No custom rendering needed

### HTTP Request
- Localhost HTTP is instant (~1-5ms)
- No network latency

### Quiver Import
- Uses existing optimized Quiver parser
- Same performance as manual SVG import

**Total time:** Usually under 1 second from click to Cavalry!

## Error Handling

### Plugin Side:
```javascript
try {
  const svg = await node.exportAsync({ format: 'SVG' })
  sendToCavalry(svg)
} catch (error) {
  showError('Export failed: ' + error.message)
}
```

### Server Side:
```javascript
try {
  processAndImportSVG(request.svgCode)
  console.info("✓ Imported")
} catch (e) {
  console.error("Import failed: " + e.message)
}
```

### Connection Errors:
- Plugin checks connection every 5 seconds
- Shows "Quiver not found" if unreachable
- Graceful degradation

## Future Enhancements

### Planned Features:
1. **Batch Export** - Send multiple frames at once
2. **Watch Mode** - Auto-update as you design
3. **Direct API** - Bypass SVG, use Figma's JSON API
4. **Settings Panel** - Configure export options
5. **Keyboard Shortcuts** - Send with Cmd+Shift+C

### Possible Improvements:
- TypeScript for type safety
- Unit tests for reliability
- Compression for large SVGs
- Progress indicators for big exports
- Export history/undo

## Comparison to Alternatives

### vs Manual Export:
```
Manual:  Figma → Export → Save → Import → Cavalry
         ~30 seconds, 5 clicks

Plugin:  Figma → Send
         ~1 second, 1 click
```

### vs Copy/Paste SVG:
```
Copy/Paste: Figma → Copy as SVG → Cavalry → Paste
            ~10 seconds, multiple steps

Plugin:     Figma → Send
            ~1 second, one click
```

### vs Other Figma Plugins:
Most Figma plugins that export to other tools:
- Require file downloads
- Need manual imports
- Use cloud services
- Have rate limits

**Quiver for Figma:**
- ✅ Direct local connection
- ✅ No downloads
- ✅ Instant import
- ✅ No limits
- ✅ Privacy-friendly

## Testing

### Manual Testing:
1. **Connection Test**
   ```bash
   node test-webserver.js
   ```

2. **Plugin Test**
   - Load plugin in Figma
   - Check connection indicator
   - Send test frame

3. **Integration Test**
   - Complex designs
   - Multiple layers
   - Various effects

### Automated Testing (Future):
- Jest for unit tests
- Playwright for E2E tests
- CI/CD with GitHub Actions

## Troubleshooting Guide

### Common Issues:

| Problem | Cause | Solution |
|---------|-------|----------|
| "Quiver not found" | Server not running | Load Quiver-Dev.js |
| Nothing happens | Wrong Cavalry version | Upgrade to 2.4.0+ |
| Connection drops | Quiver closed | Reload Quiver |
| Export fails | Invalid selection | Select frame/group |
| Import errors | Complex SVG | Simplify design |

### Debug Mode:

In Figma plugin UI:
1. Right-click → Inspect
2. Check Console for errors
3. Look for fetch() failures

In Cavalry:
1. Open Log Window
2. Look for Quiver messages
3. Check for import errors

## Port Configuration

Why port 8765?
- **8-7-6-5** - Easy to remember (arrow countdown! 🏹)
- Not commonly used
- In safe user port range

## Dependencies

### Figma Plugin:
- No external dependencies
- Pure JavaScript
- No build process needed

### Quiver Web Server:
- Cavalry 2.4.0+ (`api.WebServer()`)
- Existing Quiver functions
- No additional packages

## Documentation

User-facing:
- `/figma/README.md` - Full plugin documentation
- `/figma/QUICK-START.md` - 2-minute setup
- `/WEBSERVER.md` - API reference

Developer-facing:
- This file - Technical overview
- Code comments in `code.js` and `ui.html`
- API docs in web server code

## Contributing

To add features:
1. Edit files in `/figma/`
2. Test in Figma Desktop
3. Update documentation
4. Submit PR

To report bugs:
1. Check troubleshooting first
2. Test with simple designs
3. Open issue with details

---

**Built with 🏹 by the Quiver team with Cursor**

