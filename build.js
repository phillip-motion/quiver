#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check for minify flag
const shouldMinify = process.argv.includes('--minify');

// Read version from versions.json (source of truth)
const versionsJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'versions.json'), 'utf8'));
const VERSION = versionsJson.Quiver;

console.log('🏹 Building Quiver...\n');
console.log(`📌 Version: ${VERSION} (from versions.json)\n`);
if (shouldMinify) {
    console.log('🗜️  Minification enabled\n');
}

// Paths
const SRC_DIR = path.join(__dirname, 'src');
const FUNCTIONS_DIR = path.join(SRC_DIR, 'functions');
const SRC_ASSETS_DIR = path.join(SRC_DIR, 'quiver_assets');
const ROOT_ASSETS_DIR = path.join(__dirname, 'quiver_assets');
const DEV_FILE = path.join(SRC_DIR, 'Quiver-Dev.js');
const OUTPUT_FILE = path.join(__dirname, 'Quiver.js');
const FIGMA_UI_FILE = path.join(__dirname, 'figma', 'ui.html');

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
    // Update package.json version from versions.json
    console.log('📝 Syncing version to package.json...');
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.version !== VERSION) {
        packageJson.version = VERSION;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
        console.log(`  ✓ Updated package.json to v${VERSION}`);
    } else {
        console.log(`  ✓ package.json already at v${VERSION}`);
    }
    
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
    
    // Minify if requested
    if (shouldMinify) {
        try {
            const { minify } = require('terser');
            console.log('  ⏳ Minifying...');
            
            const minified = await minify(finalContent, {
                compress: {
                    dead_code: true,
                    drop_console: false, // Keep console logs for Cavalry
                    drop_debugger: true,
                    pure_funcs: []
                },
                mangle: false, // Don't mangle names - important for Cavalry API
                format: {
                    comments: /^!|@preserve|@license|@cc_on|Quiver/i
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
    
    // Copy assets
    console.log('\n📦 Copying assets...');
    if (fs.existsSync(SRC_ASSETS_DIR)) {
        // Remove old assets directory if it exists
        if (fs.existsSync(ROOT_ASSETS_DIR)) {
            fs.rmSync(ROOT_ASSETS_DIR, { recursive: true, force: true });
        }
        
        // Copy new assets
        copyDir(SRC_ASSETS_DIR, ROOT_ASSETS_DIR);
        
        const assetFiles = fs.readdirSync(SRC_ASSETS_DIR);
        console.log(`✅ Copied ${assetFiles.length} asset files`);
    } else {
        console.warn('⚠️  Warning: src/quiver_assets/ not found, skipping asset copy...');
    }
    
    // Update Figma plugin version
    console.log('\n🎨 Updating Figma plugin...');
    
    // Update ui.html version number
    if (fs.existsSync(FIGMA_UI_FILE)) {
        let uiContent = fs.readFileSync(FIGMA_UI_FILE, 'utf8');
        uiContent = uiContent.replace(
            /<div id="versionNumber" class="version-number">v[\d.]+<\/div>/,
            `<div id="versionNumber" class="version-number">v${VERSION}</div>`
        );
        fs.writeFileSync(FIGMA_UI_FILE, uiContent, 'utf8');
        console.log('  ✓ Updated figma/ui.html version');
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


