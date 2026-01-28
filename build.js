#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Try to load sharp, but allow build to continue without it
let sharp = null;
let sharpAvailable = false;
try {
    sharp = require('sharp');
    sharpAvailable = true;
} catch (e) {
    console.warn('⚠️  Sharp not available (requires Node.js 18+). Images will not be compressed.');
    console.warn('   To enable compression, upgrade to Node.js 18+ and run: npm install\n');
}

// Check for minify flag
const shouldMinify = process.argv.includes('--minify');

// Read version from package.json (source of truth)
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;

console.log('🏹 Building Quiver...\n');
console.log(`📌 Version: ${VERSION} (from package.json)\n`);
if (shouldMinify) {
    console.log('🗜️  Minification enabled\n');
}

// Paths
const SRC_DIR = path.join(__dirname, 'src');
const FUNCTIONS_DIR = path.join(SRC_DIR, 'functions');
const SRC_ASSETS_DIR = path.join(SRC_DIR, 'assets');
const DEV_FILE = path.join(SRC_DIR, 'Quiver-Dev.js');
const OUTPUT_FILE = path.join(__dirname, 'Quiver.js');
const FIGMA_DIR = path.join(__dirname, 'figma');
const FIGMA_UI_FILE = path.join(FIGMA_DIR, 'ui.html');
const CACHE_FILE = path.join(__dirname, '.build-cache.json');

/**
 * Load or initialize build cache
 */
function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch (e) {
            console.warn('  ⚠️  Cache file corrupted, rebuilding...');
        }
    }
    return { images: {} };
}

/**
 * Save build cache
 */
function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * Compress PNG image using sharp (if available)
 */
async function compressPNG(inputPath) {
    if (sharpAvailable) {
        const buffer = await sharp(inputPath)
            .png({ quality: 80, compressionLevel: 9 })
            .toBuffer();
        return buffer;
    } else {
        // Fallback: read file without compression
        return fs.readFileSync(inputPath);
    }
}

/**
 * Process image: compress if PNG, read if SVG, convert to base64
 */
async function processImage(filename, cache) {
    const imagePath = path.join(SRC_ASSETS_DIR, filename);
    const stats = fs.statSync(imagePath);
    const mtime = stats.mtimeMs;
    
    // Check cache
    if (cache.images[filename] && cache.images[filename].mtime === mtime) {
        return { cached: true, base64: cache.images[filename].base64 };
    }
    
    let buffer;
    const ext = path.extname(filename).toLowerCase();
    
    if (ext === '.png') {
        // Compress PNG
        buffer = await compressPNG(imagePath);
    } else if (ext === '.svg') {
        // Read SVG as-is
        buffer = fs.readFileSync(imagePath);
    } else {
        throw new Error(`Unsupported image format: ${ext}`);
    }
    
    const base64 = buffer.toString('base64');
    
    // Update cache
    cache.images[filename] = {
        mtime: mtime,
        base64: base64
    };
    
    return { cached: false, base64: base64 };
}

/**
 * Extract all image references from code
 */
function extractImageReferences(code) {
    const regex = /ui\.scriptLocation\s*\+\s*["']\/assets\/([^"']+)["']/g;
    const images = new Set();
    let match;
    
    while ((match = regex.exec(code)) !== null) {
        images.add(match[1]);
    }
    
    return Array.from(images);
}

/**
 * Generate embedded assets code
 */
function generateEmbeddedAssetsCode(imageMap) {
    const lines = [
        '// ========================================',
        '// Embedded Assets (Base64)',
        '// ========================================',
        'var QUIVER_ASSETS_PATH = api.getTempFolder() + "/temp_quiver_assets/";',
        'var QUIVER_EMBEDDED_ASSETS = {'
    ];
    
    const entries = Object.entries(imageMap);
    entries.forEach(([filename, base64], index) => {
        const isLast = index === entries.length - 1;
        lines.push(`  "${filename}": "${base64}"${isLast ? '' : ','}`);
    });
    
    lines.push('};');
    lines.push('');
    lines.push('function initializeQuiverAssets() {');
    lines.push('  if (!api.isDirectory(QUIVER_ASSETS_PATH)) {');
    lines.push('    api.makeFolder(QUIVER_ASSETS_PATH);');
    lines.push('  }');
    lines.push('  ');
    lines.push('  for (var filename in QUIVER_EMBEDDED_ASSETS) {');
    lines.push('    var filePath = QUIVER_ASSETS_PATH + filename;');
    lines.push('    if (!api.isFile(filePath)) {');
    lines.push('      var base64Data = QUIVER_EMBEDDED_ASSETS[filename];');
    lines.push('      api.writeEncodedToBinaryFile(filePath, base64Data);');
    lines.push('    }');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('initializeQuiverAssets(); // Run on load');
    lines.push('');
    
    return lines.join('\n');
}

/**
 * Replace image paths in code
 */
function replaceImagePaths(code) {
    return code.replace(
        /ui\.scriptLocation\s*\+\s*["']\/assets\/([^"']+)["']/g,
        'QUIVER_ASSETS_PATH + "$1"'
    );
}

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Main build function
 */
async function build() {
    // Update version in source file
    console.log('\n📝 Updating version in source files...');
    let devContent = fs.readFileSync(DEV_FILE, 'utf8');
    const updatedDevContent = devContent.replace(
        /const currentVersion = "[\d.]+";/,
        `const currentVersion = "${VERSION}";`
    );
    if (updatedDevContent !== devContent) {
        fs.writeFileSync(DEV_FILE, updatedDevContent, 'utf8');
        console.log(`  ✓ Updated src/Quiver-Dev.js to v${VERSION}`);
        devContent = updatedDevContent;
    } else {
        console.log(`  ✓ src/Quiver-Dev.js already at v${VERSION}`);
    }
    
    // Read the dev file
    console.log('\n📖 Reading Quiver-Dev.js...');
    
    // Split into lines for processing
    const lines = devContent.split('\n');
    
    // Add warning header
    const outputLines = [
        '// ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY',
        '// This file is generated from /src/Quiver-Dev.js and /src/functions/',
        '// Make changes in /src/ and run: npm run build',
        ''
    ];
    
    // Track if we're in the api.load section
    let inLoadSection = false;
    let loadedFiles = [];
    
    for (const line of lines) {
        // Check if this line contains api.load
        const apiLoadMatch = line.match(/api\.load\(ui\.scriptLocation\s*\+\s*["']\/functions\/(.+?)["']\)/);
        
        if (apiLoadMatch) {
            const filename = apiLoadMatch[1];
            const filePath = path.join(FUNCTIONS_DIR, filename);
            
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  Warning: ${filename} not found, skipping...`);
                continue;
            }
            
            if (!inLoadSection) {
                outputLines.push('');
                outputLines.push('// ========================================');
                outputLines.push('// Bundled Functions');
                outputLines.push('// ========================================');
                outputLines.push('');
                inLoadSection = true;
            }
            
            console.log(`  ✓ Bundling ${filename}...`);
            
            // Read the function file
            const functionContent = fs.readFileSync(filePath, 'utf8');
            
            // Add a comment header for this file
            outputLines.push('// ----------------------------------------');
            outputLines.push(`// ${filename}`);
            outputLines.push('// ----------------------------------------');
            outputLines.push(functionContent);
            outputLines.push('');
            
            loadedFiles.push(filename);
        } else {
            // Keep the line as-is if it's not an api.load call
            // But skip empty lines right before api.load calls
            if (line.trim() === '' && lines[lines.indexOf(line) + 1]?.includes('api.load')) {
                continue;
            }
            outputLines.push(line);
            inLoadSection = false;
        }
    }
    
    // Post-process the content
    console.log('\n📝 Post-processing...');
    let finalContent = outputLines.join('\n');
    
    // Replace "Quiver-Dev" title with just "Quiver" for production
    finalContent = finalContent.replace(
        /ui\.setTitle\("Quiver-Dev "\s*\+\s*currentVersion\);/g,
        'ui.setTitle("Quiver");'
    );
    console.log('  ✓ Updated window title for production');
    
    // Process and embed images
    console.log('\n📦 Processing images...');
    const cache = loadCache();
    const imageRefs = extractImageReferences(finalContent);
    console.log(`  ℹ️  Found ${imageRefs.length} image references`);
    
    const imageMap = {};
    let cachedCount = 0;
    let processedCount = 0;
    
    for (const filename of imageRefs) {
        const imagePath = path.join(SRC_ASSETS_DIR, filename);
        
        if (!fs.existsSync(imagePath)) {
            console.warn(`  ⚠️  Warning: ${filename} not found, skipping...`);
            continue;
        }
        
        const result = await processImage(filename, cache);
        imageMap[filename] = result.base64;
        
        if (result.cached) {
            cachedCount++;
        } else {
            processedCount++;
            const ext = path.extname(filename).toLowerCase();
            const sizeKB = (result.base64.length * 0.75 / 1024).toFixed(1);
            console.log(`  ✓ ${ext === '.png' ? 'Compressed' : 'Encoded'} ${filename} (${sizeKB} KB)`);
        }
    }
    
    if (cachedCount > 0) {
        console.log(`  ⚡ Used cache for ${cachedCount} image(s)`);
    }
    
    // Save updated cache
    saveCache(cache);
    console.log(`  ✓ Processed ${imageRefs.length} images (${processedCount} new, ${cachedCount} cached)`);
    
    // Generate embedded assets code
    const embeddedAssetsCode = generateEmbeddedAssetsCode(imageMap);
    
    // Replace image paths
    finalContent = replaceImagePaths(finalContent);
    
    // Prepend embedded assets code after the header
    const headerEndIndex = finalContent.indexOf('\n\n') + 2;
    finalContent = finalContent.slice(0, headerEndIndex) + embeddedAssetsCode + '\n' + finalContent.slice(headerEndIndex);
    
    console.log('  ✓ Embedded assets and updated image paths');
    
    // Minify if requested
    if (shouldMinify) {
        try {
            const { minify } = require('terser');
            console.log('  ⏳ Minifying...');
            
            const minified = await minify(finalContent, {
                compress: {
                    dead_code: true,
                    drop_console: true, // Keep console logs for Cavalry
                    drop_debugger: true,
                    pure_funcs: []
                },
                mangle: false, // Don't mangle names - important for Cavalry API
                format: {
                    comments: false // Strip ALL comments in minified build
                }
            });
            
            if (minified.code) {
                finalContent = minified.code;
                console.log('  ✓ Minified successfully');
            }
        } catch (minifyError) {
            console.warn('  ⚠️  Minification failed:', minifyError.message);
            console.warn('     Continuing with unminified output...');
        }
    }
    
    // Write the bundled file
    console.log('\n📝 Writing Quiver.js...');
    fs.writeFileSync(OUTPUT_FILE, finalContent, 'utf8');
    
    console.log(`✅ Bundled ${loadedFiles.length} files into Quiver.js`);
    
    
    // Update Figma plugin version
    console.log('\n🎨 Updating Figma plugin...');
    
    // Update ui.html version number
    if (fs.existsSync(FIGMA_UI_FILE)) {
        let uiContent = fs.readFileSync(FIGMA_UI_FILE, 'utf8');
        // Match the version number pattern (v followed by digits/dots, optionally followed by arrow)
        const versionMatch = uiContent.match(/(v[\d.]+)/);
        if (versionMatch) {
            uiContent = uiContent.replace(
                /v[\d.]+/,
                `v${VERSION}`
            );
            fs.writeFileSync(FIGMA_UI_FILE, uiContent, 'utf8');
            console.log('  ✓ Updated figma/ui.html version');
        } else {
            console.warn('  ⚠️  Could not find version number pattern in ui.html');
        }
    }
    
    // Summary
    console.log('\n✨ Build complete!');
    console.log(`   Version: ${VERSION}`);
    console.log(`   Output: ${path.relative(__dirname, OUTPUT_FILE)}`);
    console.log(`   Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
}

// Run the build
(async () => {
    try {
        await build();
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        console.error(error);
        process.exit(1);
    }
})();


