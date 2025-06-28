import { validateCanvas, validateToken, validateGridType } from './utils.js';
import { SizeMattersApp } from './app.js';
import './hooks.js'; // Import hooks to register them

// Define openSizeMatters function immediately when script loads
window.openSizeMatters = function() {
  try {
    // Check if Foundry VTT is ready
    if (!validateCanvas()) {
      console.warn("Size Matters: Foundry VTT not ready yet. Please try again in a moment.");
      ui.notifications?.warn("Foundry VTT not ready yet. Please try again in a moment.");
      return;
    }

    if (!canvas.tokens.controlled.length) {
      ui.notifications?.warn("Select a token first.");
      return;
    }

    const token = canvas.tokens.controlled[0];
    
    if (!validateToken(token)) {
      ui.notifications?.warn("Selected token is invalid.");
      return;
    }
    
    if (!validateGridType()) {
      ui.notifications?.warn("This module works with hexagonal and square grids only!");
      return;
    }

    const app = new SizeMattersApp(token);
    app.render(true);
  } catch (error) {
    console.error("Size Matters: Error opening Size Matters", error);
    ui.notifications?.error("Failed to open Size Matters. Check console for details.");
  }
};

Hooks.once('ready', () => {
  console.log("Size Matters: Module ready and openSizeMatters function available globally");
});

export { SizeMattersApp };