// Quiver 🏹 - Development Version
// Fire SVGs straight into Cavalry.
// 
// 📝 This is the SOURCE file for development.
// When ready for production, run: npm run build
//


// IMPORTANT!!!!!! Version number must be in the format x.x.x for update checking to work!!!
const currentVersion = "1.5.1";

const SCRIPT_KEY = "com.canva.quiver"; 
ui.setTitle("Quiver-Dev " + currentVersion);
ui.setBackgroundColor("#2d2d2d");


api.load(ui.scriptLocation+"/functions/quiver_utilities_checkVersion.js");

api.load(ui.scriptLocation+"/functions/quiver_createUI.js");
api.load(ui.scriptLocation+"/functions/quiver_function_flattenShape.js");
api.load(ui.scriptLocation+"/functions/quiver_function_convertToRectangle.js");
api.load(ui.scriptLocation+"/functions/quiver_function_dynamicAlign.js");
api.load(ui.scriptLocation+"/functions/quiver_function_renameLayers.js");
api.load(ui.scriptLocation+"/functions/quiver_utiltiies_sharedFunctions.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_blendmode.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_gradient.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_patterns.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_images.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_filters.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_masks.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_transform.js");
api.load(ui.scriptLocation+"/functions/quiver_svgParser.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_shapes.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_text.js");
api.load(ui.scriptLocation+"/functions/quiver_processAndImport.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_webserver.js");

ui.show();