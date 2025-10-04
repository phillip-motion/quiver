# 🏹 Building Quiver for Production

This guide explains how to build the production version of Quiver from the modular source files in `/src/`.

## 📁 Project Structure

```
quiver/
├── src/                          # Development source (work here!)
│   ├── Quiver-Dev.js            # Main entry point for development
│   ├── functions/               # Modular function files
│   │   ├── quiver_createUI.js
│   │   ├── quiver_svgParser.js
│   │   └── ... (all other modules)
│   └── quiver_assets/           # UI assets (icons, images)
├── Quiver.js                    # Generated production file
├── quiver_assets/               # Generated assets folder
├── build.js                     # Build script
└── package.json                 # Node.js configuration
```

## 🔧 Prerequisites

You need Node.js installed (v12 or higher). Check if you have it:

```bash
node --version
```

If not installed, download from [nodejs.org](https://nodejs.org)

## 📦 Setup

First time only - install the build dependencies:

```bash
npm install
```

This installs `terser` for optional minification.

## 🚀 Building

### Standard Build

Creates a production-ready `Quiver.js` with readable formatting:

```bash
npm run build
```

**What it does:**
- ✅ Bundles all modules from `/src/functions/` into a single file
- ✅ Replaces `api.load()` calls with actual file contents
- ✅ Changes window title from "Quiver-Dev" to "Quiver"
- ✅ Copies `/src/quiver_assets/` to `/quiver_assets/`
- ✅ Preserves readable formatting and comments

### Minified Build

Creates a smaller, optimized production file:

```bash
npm run build:minify
```

**Additional optimizations:**
- 🗜️ Removes dead code
- 🗜️ Compresses whitespace
- 🗜️ Keeps console logs (needed for Cavalry)
- 🗜️ Preserves API names (no mangling - important!)
- 🗜️ Reduces file size by ~30-40%

## 🔄 Development Workflow

### Day-to-day Development

1. **Work in `/src/`** - Make all your edits here
   - Edit `Quiver-Dev.js` or any file in `/src/functions/`
   - Update assets in `/src/quiver_assets/`

2. **Test in Cavalry** - Load the dev version
   - Load `/src/Quiver-Dev.js` in Cavalry
   - Window title shows "Quiver-Dev 0.9.0" so you know it's the dev version
   - Changes to individual files in `/src/functions/` are loaded dynamically

3. **Build for release** - When ready to release
   ```bash
   npm run build
   ```
   - Generates `/Quiver.js` (single file for distribution)
   - Window title shows just "Quiver" (production version)

### Adding New Modules

1. Create your new file in `/src/functions/`:
   ```bash
   touch src/functions/quiver_myNewFeature.js
   ```

2. Add the `api.load()` call to `Quiver-Dev.js`:
   ```javascript
   api.load(ui.scriptLocation+"/functions/quiver_myNewFeature.js");
   ```

3. Rebuild:
   ```bash
   npm run build
   ```

The build script automatically finds and bundles all loaded modules!

## 🐛 Troubleshooting

### "Cannot find module 'terser'"

Run `npm install` to install dependencies.

### "Warning: [filename] not found, skipping..."

The file referenced in `Quiver-Dev.js` doesn't exist in `/src/functions/`. Check:
- File name spelling in `Quiver-Dev.js`
- File actually exists in `/src/functions/`

### Changes not appearing in production

Make sure to:
1. Save your changes in `/src/`
2. Run `npm run build` again
3. Reload `Quiver.js` in Cavalry (not `Quiver-Dev.js`)

## 📝 Key Differences: Dev vs Production

| Feature | Quiver-Dev.js | Quiver.js |
|---------|---------------|-----------|
| **Location** | `/src/Quiver-Dev.js` | `/Quiver.js` (root) |
| **Window Title** | "Quiver-Dev 0.9.0" | "Quiver" |
| **Structure** | Loads multiple files | Single bundled file |
| **File Size** | Small entry point | ~27 KB complete |
| **Use Case** | Development & testing | Distribution & production |
| **Editing** | Edit directly | Never edit (regenerated) |

## 💡 Tips

- **Never edit `Quiver.js` directly** - it will be overwritten on next build
- **Keep `Quiver-Dev.js` clean** - it's the source of truth for build order
- **Use meaningful comments** - they're preserved in standard builds
- **Test before minifying** - minified code is harder to debug
- **Version control** - Commit both `/src/` and generated `Quiver.js`

## 🤝 Contributing

When contributing:
1. Make all changes in `/src/`
2. Test with `Quiver-Dev.js`
3. Run `npm run build` before committing
4. Commit both source and generated files

---

Made by the Canva Creative Team (with help from Cursor) for Cavalry

