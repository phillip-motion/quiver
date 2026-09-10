// Quiver — fire the current Affinity selection towards Cavalry.
//
// Affinity's HttpRequest cannot set a request body (only URL, method and
// headers), and document.export() writes to a path rather than a buffer. So
// the SVG goes to a temp file and the POST carries only the paths in headers.
// Cavalry reads the headers, reads the files, and deletes them.
//
// The temp folder must be allowed in Affinity's Scripting preferences.

'use strict';

const { Application } = require('/application.js');
const { Document, FileExportArea, FileExportOptions } = require('/document.js');
const { File } = require('/fs.js');
const { HttpRequest, RequestMethod } = require('/network.js');
const { ParagraphAlignXType } = require('/paragraphatts.js');

const QUIVER_URL = 'http://127.0.0.1:8765/post';
// Affinity only allows scripts into folders listed in Settings > Scripting,
// and those roots do not appear to cover subfolders — a write to
// Desktop/.quiver is refused even with Desktop allowed. So write into the
// allowed root itself. Both files are deleted by Cavalry as soon as it has
// read them, so nothing lingers on a successful fire.
const TEMP_DIR = Application.userDesktopPath;
const PREFERRED_PRESET = 'Quiver';
const FALLBACK_PRESET = 'SVG (for export)';

// Cavalry's text handling speaks Figma's vocabulary; map onto it rather than
// teaching the parser a second set of names.
const ALIGN_TO_FIGMA = [
    [ParagraphAlignXType.Left, 'LEFT'],
    [ParagraphAlignXType.Centre, 'CENTER'],
    [ParagraphAlignXType.JustifyCentre, 'CENTER'],
    [ParagraphAlignXType.Right, 'RIGHT'],
    [ParagraphAlignXType.JustifyRight, 'RIGHT'],
    [ParagraphAlignXType.JustifyLeft, 'JUSTIFIED'],
    [ParagraphAlignXType.JustifyAll, 'JUSTIFIED'],
];

function figmaAlign(alignXType) {
    for (const [type, name] of ALIGN_TO_FIGMA) {
        if (type !== undefined && alignXType !== undefined &&
            type.value === alignXType.value) return name;
    }
    return 'LEFT';
}

function pickPreset() {
    const names = FileExportOptions.allPresetNames;
    return names.indexOf(PREFERRED_PRESET) >= 0 ? PREFERRED_PRESET : FALLBACK_PRESET;
}

/** One sidecar entry per text node in the selected subtree. */
function collectText(node, out) {
    if (node.isTextNode) {
        try {
            const story = node.storyInterface.story;
            const entry = {
                name: node.description,
                characters: node.storyInterface.text,
                textAlignHorizontal: figmaAlign(story.getParagraphAtts(0).alignXType),
                // ponytail: vertical alignment is settable in the UI but not
                // readable from script, so Cavalry keeps its own default.
                styledSegments: [],
            };
            for (let pos = 0; pos < story.length; ) {
                const end = story.getGlyphAttsRunEnd(pos, story.length);
                const atts = story.getGlyphAtts(pos);
                entry.styledSegments.push({
                    start: pos,
                    end: end,
                    fontSize: atts.height,
                    fontName: { family: atts.font ? atts.font.familyName : '', style: atts.styleName || '' },
                });
                if (end <= pos) break;
                pos = end;
            }
            out.push(entry);
        } catch (e) {
            // A single unreadable text node must not lose the whole import.
            console.warn('Quiver: skipped text node — ' + e.message);
        }
    }
    for (let kid = node.firstChild; kid; kid = kid.nextSibling) collectText(kid, out);
}

function writeText(path, text) {
    const f = File.create(path, 'wb');
    f.writeString(text);
    f.close();
}

function main() {
    const doc = Document.current;
    if (!doc) return Application.alert('Open a document first.', 'Quiver');

    const selection = doc.selection;
    if (!selection || selection.length === 0) {
        return Application.alert('Select something to fire towards Cavalry.', 'Quiver');
    }

    const stamp = Date.now();
    const svgPath = TEMP_DIR + '/quiver-' + stamp + '.svg';
    const metaPath = TEMP_DIR + '/quiver-' + stamp + '.json';

    try {
        doc.export(svgPath,
                   FileExportOptions.createWithPresetName(pickPreset()),
                   FileExportArea.createForSelection(selection));
    } catch (e) {
        return Application.alert(
            'Could not export the SVG.\n\n' + e.message +
            '\n\nAllow ' + TEMP_DIR + ' in Settings > Scripting.',
            'Quiver');
    }

    const nodes = selection.nodes;
    const textData = [];
    for (const node of nodes) collectText(node, textData);

    const box = nodes[0].getContentExtentsBox(false, false);
    writeText(metaPath, JSON.stringify({
        source: 'affinity',
        name: nodes[0].description,
        frameWidth: box ? box.width : 0,
        frameHeight: box ? box.height : 0,
        textData: textData,
    }));

    const req = HttpRequest.create(QUIVER_URL, RequestMethod.Post);
    req.setEncodeHeaderValuesAsRfc2047(false);
    req.setHeaderValue('X-Quiver-Action', 'importFromAffinity');
    req.setHeaderValue('X-Quiver-Svg', svgPath);
    req.setHeaderValue('X-Quiver-Meta', metaPath);

    const result = req.do();
    if (!result.response || result.response.statusCode.value >= 400) {
        Application.alert(
            'Cavalry did not answer on port 8765.\n\n' +
            'Open Quiver in Cavalry (Scripts menu), then try again.',
            'Quiver');
    }
}

main();
