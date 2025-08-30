/**
 * @fileoverview Panic Utils - Emergency cleanup utilities for Size Matters module
 * @description Provides functionality to completely remove all Size Matters data from the world
 * @author Boifubá
 */

/**
 * Clears all Size Matters module data from the world and restarts Foundry
 * This function will:
 * - Remove all size-matters flags from tokens and actors
 * - Clear all module settings
 * - Clear texture cache
 * - Reload the world
 * @returns {Promise<void>}
 */
export async function clearModuleDataAndRestart() {
  // Show confirmation dialog
  const confirmed = await Dialog.confirm({
    title: "Clear All Size Matters Data",
    content: `
      <p><strong>WARNING:</strong> This action will permanently delete ALL Size Matters data from this world, including:</p>
      <ul>
        <li>All token configurations and graphics</li>
        <li>All presets and settings</li>
        <li>All ride formations</li>
        <li>All cached textures</li>
      </ul>
      <p><strong>This action cannot be undone!</strong></p>
      <p>The world will be reloaded after cleanup.</p>
      <p>Are you sure you want to continue?</p>
    `,
    yes: () => true,
    no: () => false,
    defaultYes: false
  });

  if (!confirmed) {
    return;
  }

  try {
    ui.notifications.info("Starting Size Matters data cleanup...");

    // Clear all token flags
    for (const scene of game.scenes) {
      for (const tokenDoc of scene.tokens) {
        try {
          await tokenDoc.unsetFlag("size-matters", "settings");
          await tokenDoc.unsetFlag("size-matters", "activePreset");
          await tokenDoc.unsetFlag("size-matters", "rideLeader");
          await tokenDoc.unsetFlag("size-matters", "rideFollowers");
          await tokenDoc.unsetFlag("size-matters", "followingToken");
        } catch (error) {
          // Silent fail for individual tokens
        }
      }
    }

    // Clear all actor flags
    for (const actor of game.actors) {
      try {
        await actor.unsetFlag("size-matters", "associatedPreset");
      } catch (error) {
        // Silent fail for individual actors
      }
    }

    // Clear all module settings
    try {
      await game.settings.set("size-matters", "presets", {});
      await game.settings.set("size-matters", "globalDefaults", {});
      await game.settings.set("size-matters", "gridSizeConfig", {});
      await game.settings.set("size-matters", "enableDirectionalHighlight", false);
    } catch (error) {
      // Silent fail for settings
    }

    // Clear texture cache if available
    try {
      if (game.modules.get("size-matters").api.clearTextureCache) {
        game.modules.get("size-matters").api.clearTextureCache();
      }
    } catch (error) {
      // Silent fail for texture cache
    }

    // Clear all graphics from canvas
    try {
      if (canvas && canvas.tokens) {
        for (const token of canvas.tokens.placeables) {
          if (token.sizeMattersGrid) {
            token.sizeMattersGrid.destroy();
            token.sizeMattersGrid = null;
          }
        }
      }
    } catch (error) {
      // Silent fail for graphics cleanup
    }

    ui.notifications.info("Size Matters data cleared successfully. Reloading world...");

    // Wait a moment for notifications to show
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error("Size Matters: Error during data cleanup:", error);
    ui.notifications.error("Error occurred during cleanup. Check console for details.");
  }
}