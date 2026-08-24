# AGENTS.md

## Cursor Cloud specific instructions

Quiver is a Cavalry motion-design script (`Quiver.js` / distributable `Quiver.jsc`) plus a
companion Figma plugin (`dev/figma/`). The actual product runs inside the proprietary
Cavalry desktop app and Figma Desktop, which are not available in the cloud VM. The only
component that runs here is the Node.js build system in `dev/`.

- All build/dev work happens inside `dev/`. Run npm commands from there (for example
  `npm run build`), not from the repo root.
- Node 18+ is required so the `sharp` dependency can compress PNG assets. The VM ships
  Node 22, which works. If `sharp` is missing/unavailable the build still succeeds but skips
  image compression (see the warning in `dev/build.js`).
- Build commands (see `dev/src/BUILD.md`): `node build.js` produces a readable
  `dev/Quiver.js`; `npm run build` and `npm run build:minify` both produce the minified
  version (terser). There is no lint or automated test setup in this repo.
- Editing rules (see `dev/.cursorrules`): edit sources in `dev/src/` only. `dev/Quiver.js`
  is auto-generated — never edit it by hand; regenerate it with the build.
- Running the build rewrites tracked artifacts `dev/Quiver.js` and `dev/.build-cache.json`.
  When you only intend to verify the build, restore them afterward
  (`git checkout -- dev/Quiver.js dev/.build-cache.json`) to keep the diff clean. When you
  actually change sources for release, commit the regenerated `dev/Quiver.js`.
- Test SVGs live in `dev/testfiles/` for exercising the parser inside Cavalry.
