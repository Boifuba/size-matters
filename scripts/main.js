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
import { SettingsManager } from './settings-manager.js';
import { RideManagerApp } from './RideManagerApp.js';
import { PresetManagerApp } from './PresetManagerApp.js';
import { GridSizeConfigApp } from './GridSizeConfigApp.js';
import { SizeMattersApp } from './SizeMattersApp.js';
import { DEFAULT_SETTINGS, DIRECTIONAL_COLORS, MESSAGES, DEFAULT_GRID_SIZE_CONFIG } from './constants.js';


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

function openSizeMatters() {
  if (!checkFoundryReady()) {
    return;
  }
  if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
    window.sizeMattersApp.bringToTop();
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
  window.sizeMattersApp = new SizeMattersApp(token);
  window.sizeMattersApp.render(true);
}

function openRideManager() {
  if (!checkFoundryReady()) {
    return;
  }

  const rideManager = new RideManagerApp();
  rideManager.render(true);
}

function openPresetManager() {
  if (!checkFoundryReady()) {
    return;
  }

  const presetManager = new PresetManagerApp(window.sizeMattersApp);
  presetManager.render(true);
}

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
        thickness: 3,
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

      await drawSizeMattersGraphicsForToken(token);

    }

    if (
      window.sizeMattersApp &&
      window.sizeMattersApp.rendered &&
      window.sizeMattersApp.tokenId === token.id
    ) {
      window.sizeMattersApp.loadSettings();
      window.sizeMattersApp.render(true);
    }
  } catch (error) {
    console.error("Size Matters: Error toggling preset on token:", error);
    ui.notifications.error("Error applying preset to token!");
  }
}

Hooks.once("init", () => {
  // Inicializar o SettingsManager primeiro
  SettingsManager.initialize();

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
});

Hooks.once("ready", () => {
  SettingsManager.setupSocketListeners();

  window.sizeMattersApp = null;
});


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
      visible: true,
    };
  }
});

Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (message.trim() === "/size-matters") {
    game.modules.get("size-matters").api.openSizeMatters();
    return false;
  }
  if (message.trim() === "/ride") {
    game.modules.get("size-matters").api.openRideManager();
    return false;
  }
});

Hooks.on("controlToken", (token, controlled) => {
  if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
    if (controlled) {
      window.sizeMattersApp.setControlledToken(token);
    }
  }
});

Hooks.on("releaseToken", (token, controlled) => {
  if (
    window.sizeMattersApp &&
    window.sizeMattersApp.rendered &&
    canvas.tokens.controlled.length === 0
  ) {
    window.sizeMattersApp.setControlledToken(null);
  }
});

Hooks.on("canvasInit", () => {
  clearAllSizeMattersGraphics();
});

Hooks.on("canvasReady", async () => {
  setTimeout(async () => {
    await game.modules.get("size-matters").api.restoreRidesFromFlags();

    for (const token of canvas.tokens.placeables) {
      const settings = token.document.getFlag("size-matters", "settings");
      //      const activePreset = token.document.getFlag('size-matters', 'activePreset');

      if (settings && settings.grid) {
        await drawSizeMattersGraphicsForToken(token);
      } else if (!settings) {
        clearTokenSizeMattersGraphics(token);
      }
    }
  }, 500);
});

Hooks.on("renderToken", async (token) => {
  setTimeout(async () => {
    const settings = token.document.getFlag("size-matters", "settings");
    //    const activePreset = token.document.getFlag('size-matters', 'activePreset');

    if (settings && settings.grid && !token.sizeMattersGrid) {
      await drawSizeMattersGraphicsForToken(token);
    } else if (!settings && token.sizeMattersGrid) {
      clearTokenSizeMattersGraphics(token);
    }
  }, 100);
});

Hooks.on("preDeleteToken", (tokenDocument, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (token) {
    clearTokenSizeMattersGraphics(token);
  }
});

Hooks.on("deleteToken", (tokenDocument, options, userId) => {
  game.modules.get("size-matters").api.stopTokenRide(tokenDocument, true);
});

Hooks.on("updateScene", (scene, changes) => {
  if (changes.active === true) {
    clearAllSizeMattersGraphics();
  }
});

Hooks.on("updateToken", async (tokenDocument, changes, options, userId) => {
  try {
    if (changes.flags && changes.flags["size-matters"]) {
      const token = canvas.tokens.get(tokenDocument.id);
      if (!token) {
        return;
      }
      setTimeout(async () => {
        clearTokenSizeMattersGraphics(token);
        await drawSizeMattersGraphicsForToken(token);
      }, 50);
    }
  } catch (error) {
    // Silent error handling
  }
});

Hooks.on("renderTokenHUD", (app, html, data) => {
  const $html = $(html);
  if ($html.find("button[data-action='toggle-montaria-preset']").length) return;

  const token = canvas.tokens.get(data._id);
  if (!token) return;

  const actorAssociatedPreset = token.actor
    ? token.actor.getFlag("size-matters", "associatedPreset")
    : null;

  if (!actorAssociatedPreset) return;

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
  button.on("click", async () => {
    if (game.modules.get("size-matters").api.togglePresetOnToken) {
      await game.modules.get("size-matters").api.togglePresetOnToken(actorAssociatedPreset);
      app.render(true);
    } else {
      ui.notifications.error(
        "Função togglePresetOnToken não encontrada! Verifique se o seu módulo está carregado corretamente."
      );
    }
  });
});

Hooks.on("updateSetting", (settingName, value, options) => {
  if (settingName === "size-matters.enableDirectionalHighlight") {
    // Debounce the redraw to prevent excessive calls
    if (window.sizeMattersRedrawTimeout) {
      clearTimeout(window.sizeMattersRedrawTimeout);
    }
    
    window.sizeMattersRedrawTimeout = setTimeout(() => {
      if (canvas && canvas.tokens && canvas.tokens.placeables) {
        // Only redraw tokens that have Size Matters settings
        for (const token of canvas.tokens.placeables) {
          const settings = token.document.getFlag("size-matters", "settings");
          if (settings && settings.grid) {
            drawSizeMattersGraphicsForToken(token);
          }
        }
      }
      if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
        window.sizeMattersApp.drawGrid(window.sizeMattersApp.element);
      }
      window.sizeMattersRedrawTimeout = null;
    }, 100);
  }
});
