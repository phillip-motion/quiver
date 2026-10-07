# 🏹 Building Quiver for Production

This guide explains how to build the production version of Quiver from the modular source files in `/dev/src/`.

## 📁 Project Structure

```
quiver/
├── versions.json                # Version manifest (repo root)
└── dev/
    ├── src/                      # Development source (work here!)
    │   ├── Quiver-Dev.js        # Main entry point for development
    │   ├── functions/           # Modular function files
    │   │   ├── quiver_createUI.js
    │   │   ├── quiver_svgParser.js
    │   │   └── ... (all other modules)
    │   └── assets/               # UI assets (icons, images)
    ├── build/                    # Generated Quiver.js / Quiver.jsc (ignored)
    ├── CHANGELOG.md              # Release notes, used by auto-release
    ├── build.js                  # Build script
    └── package.json              # Node.js configuration
```

## 🔧 Prerequisites

You need Node.js 24.3 or higher. Check if you have it:

```bash
node --version
```

If not installed, download from [nodejs.org](https://nodejs.org)

## 📦 Setup

> **Note:** All `npm` commands below are run from inside the `dev/` directory.

First time only - install the build dependencies:

```bash
cd dev
npm install
```

This installs `terser`, `sharp` and `@scenery/bundler`.

## 🚀 Building

```bash
npm run build      # readable build/Quiver.js, for testing
npm run release    # minified build, encrypted build/Quiver.jsc, dist/Quiver_<version>.zip, copied to ../Quiver.jsc
```

Both bundle every `api.load()` module from `Quiver-Dev.js` into one file, embed the images and Glass plugin as base64, and set the window title to "Quiver".

`release` encrypts with [create-script](https://github.com/scenery-io/create-script)'s `@scenery/bundler`, which needs Cavalry open with **Stallion** running (it posts to `127.0.0.1:8080`). It needs Node 24.3+.

## 🚢 Publishing a release

1. Bump `version` in `dev/package.json` and the version in `versions.json`.
2. Move the `[Unreleased]` notes in `dev/CHANGELOG.md` under a new `## [x.y.z]` heading.
3. `npm run release`, then commit `Quiver.jsc` with the message `Release x.y.z`.
4. Push to `main`. `.github/workflows/auto-release.yml` tags `vx.y.z`, creates the GitHub release from the changelog entry and attaches `Quiver.jsc`.

## 🔄 Development Workflow

### Day-to-day Development

1. **Work in `/dev/src/`** - Make all your edits here
   - Edit `Quiver-Dev.js` or any file in `/dev/src/functions/`
   - Update assets in `/dev/src/assets/`

2. **Test in Cavalry** - Load the dev version
   - Load `/dev/src/Quiver-Dev.js` in Cavalry
   - Window title shows "Quiver-Dev 0.9.0" so you know it's the dev version
   - Changes to individual files in `/dev/src/functions/` are loaded dynamically

3. **Build for release** - When ready to release
   ```bash
   cd dev
   npm run build
   ```
   - Generates `/dev/build/Quiver.js` (single file, not committed)
   - Window title shows just "Quiver" (production version)

### Adding New Modules

1. Create your new file in `/dev/src/functions/`:
   ```bash
   touch dev/src/functions/quiver_myNewFeature.js
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

The file referenced in `Quiver-Dev.js` doesn't exist in `/dev/src/functions/`. Check:
- File name spelling in `Quiver-Dev.js`
- File actually exists in `/dev/src/functions/`

### Changes not appearing in production

Make sure to:
1. Save your changes in `/dev/src/`
2. Run `npm run build` again
3. Reload `Quiver.js` in Cavalry (not `Quiver-Dev.js`)

## 📝 Key Differences: Dev vs Production

| Feature | Quiver-Dev.js | Quiver.js |
|---------|---------------|-----------|
| **Location** | `/dev/src/Quiver-Dev.js` | `/dev/build/Quiver.js` |
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
- **Version control** - Commit `/dev/src/` and `Quiver.jsc`; `build/` and `dist/` are ignored

## 🤝 Contributing

When contributing:
1. Make all changes in `/dev/src/`
2. Test with `Quiver-Dev.js`
3. Run `npm run build` and test `build/Quiver.js` before committing

---

Made by the Canva Creative Team (with help from Cursor) for Cavalry

