// Quiver 🏹 
// Fire SVGs straight into Cavalry.
const currentVersion = "0.9.0";
const SCRIPT_KEY = "com.canva.quiver"; 
ui.setTitle("Quiver-Dev " + currentVersion);
ui.setBackgroundColor("#2d2d2d");


api.load(ui.scriptLocation+"/functions/quiver_utilities_checkVersion.js");

api.load(ui.scriptLocation+"/functions/quiver_createUI.js");
api.load(ui.scriptLocation+"/functions/quiver_function_convertToRectangle.js");
api.load(ui.scriptLocation+"/functions/quiver_function_dynamicAlign.js");
api.load(ui.scriptLocation+"/functions/quiver_function_renameLayers.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_sharedFunctions.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_gradient.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_patterns.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_images.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_filters.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_transform.js");
api.load(ui.scriptLocation+"/functions/quiver_svgParser.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_shapes.js");
api.load(ui.scriptLocation+"/functions/quiver_utilities_text.js");
api.load(ui.scriptLocation+"/functions/quiver_processAndImport.js");

ui.show();