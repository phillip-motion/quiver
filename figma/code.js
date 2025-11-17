// Quiver for Figma - Main Plugin Code
// This runs in Figma's sandbox and handles selection/export logic

// Show the UI
figma.showUI(__html__, { themeColors: true, width: 250, height: 76 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'send-to-cavalry') {
    await sendSelectionToCavalry();
  } else if (msg.type === 'check-selection') {
    checkSelection();
  } else if (msg.type === 'fetch-success') {
    // UI successfully sent to Cavalry
    figma.notify('✓ Sent to Cavalry!', { timeout: 2000 });
  } else if (msg.type === 'fetch-error') {
    // UI failed to send
    figma.notify('❌ ' + (msg.message || 'Failed to connect to Cavalry'), { error: true });
  } else if (msg.type === 'open-github') {
    // Open GitHub repository in browser
    figma.openExternal('https://github.com/phillip-motion/quiver');
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Check what's selected and send info to UI
function checkSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ 
      type: 'selection-info', 
      hasSelection: false,
      message: 'No frame or group selected'
    });
    return;
  }
  
  const node = selection[0];
  const isValidType = node.type === 'FRAME' || 
                      node.type === 'GROUP' || 
                      node.type === 'COMPONENT' ||
                      node.type === 'INSTANCE';
  
  if (!isValidType) {
    figma.ui.postMessage({ 
      type: 'selection-info', 
      hasSelection: false,
      message: 'Please select a frame, group, or component'
    });
    return;
  }
  
  figma.ui.postMessage({ 
    type: 'selection-info', 
    hasSelection: true,
    name: node.name,
    type: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height)
  });
}

// Export selection and send to Cavalry
async function sendSelectionToCavalry() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Please select a frame or group first' 
    });
    return;
  }
  
  const node = selection[0];
  
  // Validate node type
  const isValidType = node.type === 'FRAME' || 
                      node.type === 'GROUP' || 
                      node.type === 'COMPONENT' ||
                      node.type === 'INSTANCE';
  
  if (!isValidType) {
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Please select a frame, group, or component' 
    });
    return;
  }
  
  // Temporarily enable clip content for frames to get correct viewBox
  let originalClipsContent = null;
  if (node.type === 'FRAME') {
    originalClipsContent = node.clipsContent;
    node.clipsContent = true;
  }
  
  try {
    figma.ui.postMessage({ type: 'status', message: 'Exporting SVG...' });
    
    // Export as SVG
    const svgData = await node.exportAsync({ 
      format: 'SVG',
      svgIdAttribute: true,
      svgOutlineText: false,
      svgSimplifyStroke: true
    });
    
    // Convert Uint8Array to string (TextDecoder not available in Figma)
    const svgString = String.fromCharCode.apply(null, svgData);
    
    figma.ui.postMessage({ type: 'status', message: 'Sending to Cavalry...' });
    
    // Send to UI for HTTP request (main thread can't make HTTP requests)
    figma.ui.postMessage({ 
      type: 'send-svg', 
      svgCode: svgString,
      nodeName: node.name
    });
    
  } catch (error) {
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Failed to export: ' + error.message 
    });
  } finally {
    // Restore original clip content setting
    if (node.type === 'FRAME' && originalClipsContent !== null) {
      node.clipsContent = originalClipsContent;
    }
  }
}


// Monitor selection changes
figma.on('selectionchange', () => {
  checkSelection();
});

// Small delay to ensure UI is ready before checking selection
setTimeout(() => {
  checkSelection();
}, 100);

