/**
 * @fileoverview Size Matters Module - Main Entry Point
 * @description This module provides functionality for customizing token area effects,
 * token riding systems, and preset management in Foundry VTT.
 * @author Boifubá
 * @alias jsdocs
 */

import {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags,
  createRideFromSelection,
  showRideManagementDialog,
  toggleQuickFollow,
} from "./ride-core.js";
import { GridManager } from "./grid-manager.js";
import {
  drawSizeMattersGraphicsForToken,
  clearTokenSizeMattersGraphics,
  clearAllSizeMattersGraphics,
} from "./token-graphics.js";
import { RideManagerApp } from './RideManagerApp.js';
import { PresetManagerApp } from './PresetManagerApp.js';
import { GridSizeConfigApp } from './GridSizeConfigApp.js';
import { SizeMattersApp } from './SizeMattersApp.js';
import { DEFAULT_SETTINGS, DIRECTIONAL_COLORS, MESSAGES, DEFAULT_GRID_SIZE_CONFIG } from './constants.js';

// ================================
// HOOK REGISTRY PATTERN
// ================================

/**
 * Global array to store registered hook IDs for cleanup
 * @type {Array<number>}
 * @private
 */
const _sizeMattersRegisteredHooks = [];

/**
 * Cleans up previously registered hooks to prevent duplicates
 * @private
 * @returns {void}
 */
function _cleanupRegisteredHooks() {
  _sizeMattersRegisteredHooks.forEach(hookId => {
    try {
      Hooks.off(hookId);
    } catch (error) {
      // Silent cleanup - hook may already be removed
    }
  });
  _sizeMattersRegisteredHooks.length = 0;
}

/**
 * Registers all module hooks with automatic cleanup
 * @private
 * @returns {void}
 */
function _registerAllModuleHooks() {
  // Clean up any previously registered hooks
  _cleanupRegisteredHooks();

  // Register scene control buttons hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("getSceneControlButtons", (controls) => {
      const tokenControls = controls.tokens;

      if (tokenControls && tokenControls.tools) {
        tokenControls.tools["size-matters-config-button"] = {
          name: "size-matters-config-button",
          title: "Size Matters Config",
          icon: "fas fa-hexagon",
          button: true,
          onClick: () => {
            game.modules.get("size-matters").api.openSizeMatters();
          },
          visible: game.user.isGM,
        };
      }
    })
  );

  // Register chat message hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("chatMessage", (chatLog, message, chatData) => {
      if (message.trim() === "/size-matters") {
        game.modules.get("size-matters").api.openSizeMatters();
        return false;
      }
      if (message.trim() === "/ride") {
        game.modules.get("size-matters").api.openRideManager();
        return false;
      }
    })
  );

  // Register token control hooks
  _sizeMattersRegisteredHooks.push(
    Hooks.on("controlToken", (token, controlled) => {
      if (sizeMattersAppInstance && sizeMattersAppInstance.rendered) {
        if (controlled) {
          sizeMattersAppInstance.setControlledToken(token);
        }
      }
    })
  );

  _sizeMattersRegisteredHooks.push(
    Hooks.on("releaseToken", (token, controlled) => {
      if (
        sizeMattersAppInstance &&
        sizeMattersAppInstance.rendered &&
        canvas.tokens.controlled.length === 0
      ) {
        sizeMattersAppInstance.setControlledToken(null);
      }
    })
  );

  // Register canvas hooks
  _sizeMattersRegisteredHooks.push(
    Hooks.on("canvasInit", () => {
      clearAllSizeMattersGraphics();
    })
  );

  _sizeMattersRegisteredHooks.push(
    Hooks.on("canvasReady", async () => {
      await game.modules.get("size-matters").api.restoreRidesFromFlags();

      for (const token of canvas.tokens.placeables) {
        const settings = token.document.getFlag("size-matters", "settings");

        if (settings && settings.grid) {
          await drawSizeMattersGraphicsForToken(token);
        } else if (!settings) {
          clearTokenSizeMattersGraphics(token);
        }
      }
    })
  );

  // Register token render hooks
  _sizeMattersRegisteredHooks.push(
    Hooks.on("renderToken", async (token) => {
      const settings = token.document.getFlag("size-matters", "settings");

      if (settings && settings.grid && !token.sizeMattersGrid) {
        await drawSizeMattersGraphicsForToken(token);
      } else if (!settings && token.sizeMattersGrid) {
        clearTokenSizeMattersGraphics(token);
      }
    })
  );

  // Register token deletion hooks
  _sizeMattersRegisteredHooks.push(
    Hooks.on("preDeleteToken", (tokenDocument, options, userId) => {
      const token = canvas.tokens.get(tokenDocument.id);
      if (token) {
        clearTokenSizeMattersGraphics(token);
      }
    })
  );

  _sizeMattersRegisteredHooks.push(
    Hooks.on("deleteToken", async (tokenDocument, options, userId) => {
      // Remove the associatedPreset flag from the actor
      const token = canvas.tokens.get(tokenDocument.id);
      if (token && token.actor) {
        try {
          await token.actor.unsetFlag("size-matters", "associatedPreset");
        } catch (error) {
          // Silent fail for cleanup
        }
      }

      game.modules.get("size-matters").api.stopTokenRide(tokenDocument, true);
    })
  );

  // Register scene update hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("updateScene", (scene, changes) => {
      if (changes.active === true) {
        clearAllSizeMattersGraphics();
      }
    })
  );

  // Register token update hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("updateToken", async (tokenDocument, changes, options, userId) => {
      try {
        if (changes.flags && changes.flags["size-matters"]) {
          const token = canvas.tokens.get(tokenDocument.id);
          if (!token) {
            return;
          }
          clearTokenSizeMattersGraphics(token);
          await drawSizeMattersGraphicsForToken(token);
        }
      } catch (error) {
        // Silent error handling
      }
    })
  );

  // Register token HUD hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("renderTokenHUD", (app, html, data) => {
      const $html = $(html);
      if ($html.find("button[data-action='toggle-montaria-preset']").length) return;

      const token = canvas.tokens.get(data._id);
      if (!token) return;

      const actorAssociatedPreset = token.actor
        ? token.actor.getFlag("size-matters", "associatedPreset")
        : null;

      if (!actorAssociatedPreset) return;

      // Check if the preset actually exists
      const presets = game.settings.get("size-matters", "presets") || {};
      if (!presets[actorAssociatedPreset]) {
        // Clean up invalid preset association
        if (token.actor) {
          token.actor.unsetFlag("size-matters", "associatedPreset");
        }
        return;
      }

      const currentActivePreset = token.document.getFlag(
        "size-matters",
        "activePreset"
      );
      const isMontariaActive = currentActivePreset === actorAssociatedPreset;

      const button = $(`
        <button type="button" class="control-icon ${
          isMontariaActive ? "active" : ""
        }"
                data-action="toggle-montaria-preset"
                title="${
                  isMontariaActive
                    ? `Remover ${actorAssociatedPreset}`
                    : `Adicionar ${actorAssociatedPreset}`
                }">
          <i class="${
            isMontariaActive ? "fa-solid fa-person-walking" : "fa-solid fa-horse"
          }"></i>
        </button>
      `);

      $html.find(".col.left").append(button);
      // Use event delegation for the button click to ensure it works after re-renders
      $html.on("click", "button[data-action='toggle-montaria-preset']", async (event) => {
        event.preventDefault(); // Prevent default button behavior
        if (game.modules.get("size-matters").api.togglePresetOnToken) {
          await game.modules.get("size-matters").api.togglePresetOnToken(actorAssociatedPreset);
          // No need to force re-render the entire HUD here, as the togglePresetOnToken already handles it
          // The HUD will naturally re-render if the token's flags change, which is handled by updateToken hook
        } else {
          ui.notifications.error(
            "Função togglePresetOnToken não encontrada! Verifique se o seu módulo está carregado corretamente."
          );
        }
      });
    })
  );
}

// ================================
// UTILITIES (formerly utils.js)
// ================================

/**
 * Verifica se o Foundry VTT está pronto para uso
 * @returns {boolean} True se estiver pronto, false caso contrário
 */
export function isFoundryReady() {
  return !!(canvas && canvas.tokens && ui && ui.notifications);
}

/**
 * Mostra aviso se o Foundry não estiver pronto
 * @returns {boolean} True se estiver pronto, false se mostrou aviso
 */
export function checkFoundryReady() {
  if (!isFoundryReady()) {
    console.warn(MESSAGES.FOUNDRY_NOT_READY);
    return false;
  }
  return true;
}

// ================================
// MAIN MODULE LOGIC
// ================================

/**
 * Module-scoped instance of the Size Matters application
 * @type {SizeMattersApp|null}
 * @private
 */
let sizeMattersAppInstance = null;

/**
 * Opens the Size Matters configuration dialog
 * @public
 * @returns {void}
 */
function openSizeMatters() {
  if (!checkFoundryReady()) {
    return;
  }
  if (sizeMattersAppInstance && sizeMattersAppInstance.rendered) {
    sizeMattersAppInstance.bringToTop();
    return;
  }
  const token =
    canvas.tokens.controlled.length > 0 ? canvas.tokens.controlled[0] : null;
  const gridType = canvas.grid.type;
  const isHexGrid = [
    CONST.GRID_TYPES.HEXODDR,
    CONST.GRID_TYPES.HEXEVENR,
    CONST.GRID_TYPES.HEXODDQ,
    CONST.GRID_TYPES.HEXEVENQ,
  ].includes(gridType);
  const isSquareGrid = gridType === CONST.GRID_TYPES.SQUARE;
  if (!isHexGrid && !isSquareGrid) {
    return ui.notifications.warn(
      "This module works with hexagonal and square grids only!"
    );
  }
  sizeMattersAppInstance = new SizeMattersApp(token);
  sizeMattersAppInstance.render(true);
}

/**
 * Opens the Ride Manager dialog for managing token formations
 * @public
 * @returns {void}
 */
function openRideManager() {
  if (!checkFoundryReady()) {
    return;
  }

  const rideManager = new RideManagerApp();
  rideManager.render(true);
}

/**
 * Opens the Preset Manager dialog for managing Size Matters presets
 * @public
 * @returns {void}
 */
function openPresetManager() {
  if (!checkFoundryReady()) {
    return;
  }

  const presetManager = new PresetManagerApp(sizeMattersAppInstance);
  presetManager.render(true);
}

/**
 * Toggles a preset on the selected token
 * @public
 * @param {string} presetName - The name of the preset to toggle
 * @returns {Promise<void>}
 */
async function togglePresetOnToken(presetName) {
  if (!checkFoundryReady()) {
    return;
  }

  const selectedTokens = canvas.tokens.controlled;
  if (selectedTokens.length === 0) {
    ui.notifications.warn(MESSAGES.SELECT_TOKEN_FIRST);
    return;
  }

  const token = selectedTokens[0];
  if (!token || !token.document) {
    ui.notifications.error("Invalid token selected!");
    return;
  }

  try {
    const presets = game.settings.get("size-matters", "presets") || {};
    if (!presets[presetName]) {
      ui.notifications.error(`Preset "${presetName}" not found!`);
      return;
    }

    const currentActivePreset = token.document.getFlag(
      "size-matters",
      "activePreset"
    );

    if (currentActivePreset === presetName) {
      await token.document.unsetFlag("size-matters", "settings");
      await token.document.unsetFlag("size-matters", "activePreset");

      clearTokenSizeMattersGraphics(token);

      ui.notifications.info(
        `Preset "${presetName}" deactivated from ${token.name}!`
      );
    } else {
      const preset = presets[presetName];

      clearTokenSizeMattersGraphics(token);
      const presetSettings = {
        color: preset.color,
        fillColor: preset.fillColor,
        thickness: preset.thickness,
        alpha: preset.alpha,
        enableFill: preset.enableFill,
        enableContour: preset.enableContour,
        imageUrl: preset.imageUrl,
        imageScale: preset.imageScale,
        imageOffsetX: preset.imageOffsetX,
        imageOffsetY: preset.imageOffsetY,
        imageRotation: preset.imageRotation,
        imageVisible: preset.imageVisible,
        grid: foundry.utils.duplicate(preset.grid),
      };

      await token.document.setFlag("size-matters", "settings", presetSettings);
      await token.document.setFlag("size-matters", "activePreset", presetName);

      // Also set the associatedPreset flag on the actor for HUD button functionality
      if (token.actor) {
        await token.actor.setFlag("size-matters", "associatedPreset", presetName);
      }

      await drawSizeMattersGraphicsForToken(token);

    }

    // Force re-render of the token HUD to show/update the button immediately
    if (token.hasActiveHUD) {
      token.layer.hud.render(true);
    }

    if (
      sizeMattersAppInstance &&
      sizeMattersAppInstance.rendered &&
      sizeMattersAppInstance.tokenId === token.id
    ) {
      sizeMattersAppInstance.loadSettings();
      // Don't force re-render if the window is already open for this token
      // Just refresh the settings without opening a new window
      sizeMattersAppInstance.render(false);
    }
  } catch (error) {
    console.error("Size Matters: Error toggling preset on token:", error);
    ui.notifications.error("Error applying preset to token!");
  }
}

/**
 * Foundry VTT init hook - Registers settings and initializes the module
 * @event
 */
Hooks.once("init", () => {
  // Register enableDirectionalHighlight setting
  game.settings.register("size-matters", "enableDirectionalHighlight", {
    name: "Enable Directional Highlight",
    hint: "Enable directional highlighting for hexagonal grids",
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
  });

  // Grid size configuration settings
  game.settings.register("size-matters", "gridSizeConfig", {
    name: "Grid Size Configuration",
    hint: "Configuration for grid sizes at different zoom levels",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_GRID_SIZE_CONFIG,
  });

  // Grid size settings menu
  game.settings.registerMenu("size-matters", "gridSizeMenu", {
    name: "Grid Size Settings",
    label: "Configure Grid Sizes",
    hint: "Configure the visual size of grid cells for each zoom level",
    icon: "fas fa-th",
    type: GridSizeConfigApp,
    restricted: true,
  });

  game.settings.register("size-matters", "presets", {
    name: "Size Matters Presets",
    hint: "Stored presets for Size Matters configurations",
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register("size-matters", "globalDefaults", {
    name: "Size Matters Global Defaults",
    hint: "Global default settings for Size Matters module",
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULT_SETTINGS,
  });

  // Define the module API
  game.modules.get("size-matters").api = {
    openSizeMatters,
    openRideManager,
    openPresetManager,
    togglePresetOnToken,
    startTokenRide,
    stopTokenRide,
    removeFollowerFromTokenRide,
    getActiveRideGroups,
    stopAllTokenRides,
    restoreRidesFromFlags,
    createRideFromSelection,
    showRideManagementDialog,
    toggleQuickFollow,
  };

  // Register all module hooks with cleanup
  _registerAllModuleHooks();
});

/**
 * Foundry VTT ready hook - Initializes module state after Foundry is fully loaded
 * @event
 */
Hooks.once("ready", () => {
  sizeMattersAppInstance = null;
});