# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the exception that the `major` version is used for marketing purposes,
not to indicate breaking changes.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

-   `Added` for new features
-   `Changed` for changes in existing functionality
-   `Deprecated` for soon-to-be removed features
-   `Removed` for now removed features
-   `Fixed` for any bug fixes
-   `Security` in case of vulnerabilities


## [1.7.5] - 2026-07-10

### Added

-   🏹 Fire any object, not just frames or groups.
-   〰️ Quiver now imports multiple strokes per shape.

### Fixed

-   Fills that are completely hidden behind other fills are no longer imported.
-   Neater files: groups collapse correctly and keep their clipping masks in 2.8.0.

## [1.7.0] - 2026-08-28

### Added

-   Figma's Glass effect now comes through when you fire towards Cavalry. The Glass plugin installs the first time you send a frame with Glass from Figma; restart Cavalry and fire your design again.
-   Overlapping layers under glass are composited into custom shapes so the effect looks like Figma. You can turn this off in Settings.
-   Update checks can be switched off in Settings.

### Changed

-   Group pivots are centred on import by default.
-   Update checks are quieter.

### Fixed

-   Flipped and rotated images import more accurately.
-   Fill and stroke colours are more reliable.

## [1.6.4] - 2026-04-29

### Changed

-   Clearer warning when you try to import images without a project set.

## [1.6.3] - 2026-04-01

### Fixed

-   Quiver no longer overwrites images when frames have the same name.

## [1.6.2] - 2026-01-30

### Added

-   Quiver now refuses to import images if there's no Cavalry project.

### Changed

-   Enhanced variable font support.
-   Single file (`Quiver.jsc`), no more `quiver_assets` folder needed.

### Fixed

-   Quiver no longer imports and immediately deletes the art.

## [1.6.0] - 2026-01-21

For highest fidelity import, use the Figma plugin. Search for Quiver in the Actions panel in Figma (Cmd-K). [What's new in Quiver 1.6.0](https://www.youtube.com/watch?v=N1kOw3FRD1E)

### Added

-   Emoji support.
-   Text alignment support, thanks to the Figma API.
-   Multiple styles within one text box.
-   Horizontal and Vertical alignment buttons that align text without changing its position on the canvas.
-   Inner shadow, background blur and gradient strokes.

### Changed

-   Previously flattened strokes now import as editable.
-   Much improved gradients, including diamond and angular distributions.
-   More robust transform logic for better alignment.
-   Optimised layer and shader names.
-   Optimised mask and shadow parsing.
-   Improved UX.

### Fixed

-   Certain frames failed to import (thanks @akre54).
-   Duplicate shaders.

## [1.5.2] - 2025-11-23

### Added

-   Blend mode support, including the new Plus Darker.
-   Basic clipping mask support.
-   Support for basic lines.

### Changed

-   Improved element positioning when using the Figma plugin.

### Fixed

-   Hyperlinks within Figma were imported as HTML.
-   A bug that could crash Cavalry.

## [1.5.0] - 2025-11-07

### Added

-   One-click Figma transfer. No more changing export settings.

### Changed

-   More compact UI.
-   Now works with Cavalry Free.

### Fixed

-   Error in the update checker.

## [1.1.0] - 2025-10-05

### Changed

-   Improved letter-spacing import.
-   Quiver now checks for updates once a day.

## [1.0.0] - 2025-09-25

### Added

-   Paste or import SVGs in one click, with support for embedded images, gradients, shadows, blurs, editable text and more.
-   **Convert To Rectangle**: create a rectangle from the bounding box of a selected layer.
-   **Dynamic Align**: dynamically adjust the pivot point of a layer.
-   **Flatten Shape**: flatten all selected shapes into one layer.
-   **Rename Layers**: rename all selected layers as [name] 1, [name] 2 and so on.
