import { CONSTANTS } from './constants.js';
import { validateCanvas, validateToken } from './utils.js';
import { drawSizeMattersGraphicsForToken, clearTokenSizeMattersGraphics, clearAllSizeMattersGraphics } from './graphics.js';

// Hook to clear all graphics before scene changes
Hooks.on('canvasInit', () => {
  console.log("Size Matters: Canvas initializing, clearing all graphics");
  clearAllSizeMattersGraphics();
});

// Hook to recreate graphics when tokens are rendered (after page reload)
Hooks.on('canvasReady', async () => {
  // Wait a bit for canvas to be fully ready
  setTimeout(async () => {
    console.log("Size Matters: Canvas ready, checking for tokens with saved graphics...");
    
    if (!validateCanvas()) return;
    
    try {
      // Check all tokens on the canvas for saved Size Matters settings
      for (const token of canvas.tokens.placeables) {
        if (!validateToken(token)) continue;
        
        const settings = token.document.getFlag('size-matters', 'settings');
        if (settings && settings.grid) {
          console.log(`Size Matters: Restoring graphics for token ${token.id}`);
          await drawSizeMattersGraphicsForToken(token);
        }
      }
    } catch (error) {
      console.error("Size Matters: Error in canvasReady hook", error);
    }
  }, CONSTANTS.CANVAS_READY_DELAY);
});

// Additional hook for when individual tokens are rendered
Hooks.on('renderToken', async (token) => {
  // Small delay to ensure token is fully rendered
  setTimeout(async () => {
    try {
      if (!validateToken(token)) return;
      
      const settings = token.document.getFlag('size-matters', 'settings');
      if (settings && settings.grid && !token.sizeMattersGrid) {
        console.log(`Size Matters: Restoring graphics for rendered token ${token.id}`);
        await drawSizeMattersGraphicsForToken(token);
      }
    } catch (error) {
      console.warn("Size Matters: Error in renderToken hook", error);
    }
  }, CONSTANTS.TICKER_CLEANUP_DELAY);
});

// Hook to clean up graphics when tokens are deleted
Hooks.on('deleteToken', (token) => {
  try {
    clearTokenSizeMattersGraphics(token);
  } catch (error) {
    console.warn("Size Matters: Error in deleteToken hook", error);
  }
});

// Hook to clear graphics when scene changes
Hooks.on('updateScene', (scene, changes) => {
  try {
    if (changes.active === true) {
      console.log("Size Matters: Scene changing, clearing all graphics from previous scene");
      clearAllSizeMattersGraphics();
    }
  } catch (error) {
    console.warn("Size Matters: Error in updateScene hook", error);
  }
});

// CRITICAL: Hook to synchronize image updates across all users
Hooks.on('updateToken', async (tokenDocument, changes, options, userId) => {
  try {
    // Check if Size Matters settings were updated
    if (changes.flags && changes.flags['size-matters']) {
      console.log(`Size Matters: Token ${tokenDocument.id} settings updated, redrawing graphics for all users`);
      
      // Get the actual token object from the canvas
      const token = canvas.tokens.get(tokenDocument.id);
      if (!token) {
        console.warn(`Size Matters: Could not find token ${tokenDocument.id} on canvas`);
        return;
      }
      
      // Small delay to ensure the flag update is fully processed
      setTimeout(async () => {
        // Clear existing graphics first
        clearTokenSizeMattersGraphics(token);
        
        // Redraw with new settings
        await drawSizeMattersGraphicsForToken(token);
        
        console.log(`Size Matters: Graphics redrawn for token ${tokenDocument.id}`);
      }, 50);
    }
  } catch (error) {
    console.error("Size Matters: Error in updateToken hook", error);
  }
});

// Hook to handle chat commands
Hooks.on('chatMessage', (chatLog, message, chatData) => {
  try {
    // Check if the message is the /size-matters command
    if (message.trim().toLowerCase() === '/size-matters') {
      // Prevent the command from appearing in chat
      chatData.content = '';
      
      // Call the openSizeMatters function
      if (window.openSizeMatters) {
        window.openSizeMatters();
      } else {
        ui.notifications?.error("Size Matters module not properly loaded");
      }
      
      // Return false to prevent the message from being processed further
      return false;
    }
  } catch (error) {
    console.error("Size Matters: Error in chatMessage hook", error);
  }
  
  // Return true to allow other messages to be processed normally
  return true;
});