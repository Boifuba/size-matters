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
import { DEFAULT_SETTINGS, MESSAGES, DEFAULT_GRID_SIZE_CONFIG } from './constants.js';
import { clearModuleDataAndRestart } from './panic-utils.js';

// ================================
// HOOK REGISTRY PATTERN
// ================================

const _sizeMattersRegisteredHooks = [];

function _cleanupRegisteredHooks() {
  _sizeMattersRegisteredHooks.forEach(hookId => {
    try { Hooks.off(hookId); } catch (error) { /* Silent cleanup */ }
  });
  _sizeMattersRegisteredHooks.length = 0;
}

function _registerAllModuleHooks() {
  _cleanupRegisteredHooks();

  // Scene control buttons
  _sizeMattersRegisteredHooks.push(
    Hooks.on("getSceneControlButtons", (controls) => {
      const tokenControls = controls.tokens;
      if (tokenControls && tokenControls.tools) {
        tokenControls.tools["size-matters-config-button"] = {
          name: "size-matters-config-button",
          title: "Size Matters Config",
          icon: "fas fa-hexagon",
          button: true,
          onClick: () => game.modules.get("size-matters").api.openSizeMatters(),
          visible: game.user.isGM,
        };
      }
    })
  );

  // Chat message commands
  _sizeMattersRegisteredHooks.push(
    Hooks.on("chatMessage", (chatLog, message) => {
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

  // Token control hooks
  _sizeMattersRegisteredHooks.push(
    Hooks.on("controlToken", (token, controlled) => {
      if (sizeMattersAppInstance?.rendered && controlled) {
        sizeMattersAppInstance.setControlledToken(token);
      }
    })
  );

  _sizeMattersRegisteredHooks.push(
    Hooks.on("releaseToken", () => {
      if (sizeMattersAppInstance?.rendered && canvas.tokens.controlled.length === 0) {
        sizeMattersAppInstance.setControlledToken(null);
      }
    })
  );

  // Canvas hooks
  _sizeMattersRegisteredHooks.push(Hooks.on("canvasInit", clearAllSizeMattersGraphics));

  _sizeMattersRegisteredHooks.push(
    Hooks.on("canvasReady", async () => {
      await game.modules.get("size-matters").api.restoreRidesFromFlags();
      for (const token of canvas.tokens.placeables) {
        const settings = token.document.getFlag("size-matters", "settings");
        if (settings?.grid) {
          await drawSizeMattersGraphicsForToken(token);
        } else {
          clearTokenSizeMattersGraphics(token);
        }
      }
    })
  );

  // Token render hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("renderToken", async (token) => {
      const settings = token.document.getFlag("size-matters", "settings");
      if (settings?.grid && !token.sizeMattersGrid) {
        await drawSizeMattersGraphicsForToken(token);
      } else if (!settings && token.sizeMattersGrid) {
        clearTokenSizeMattersGraphics(token);
      }
    })
  );

  // Token creation hook for effect tokens
  _sizeMattersRegisteredHooks.push(
    Hooks.on("createToken", async (tokenDocument, options, userId) => {
      // Check if this is an effect token with Size Matters settings
      const isEffectToken = tokenDocument.getFlag("size-matters", "isEffectToken");
      const settings = tokenDocument.getFlag("size-matters", "settings");
      
      if (isEffectToken && settings) {
        // Wait a moment for the token to be fully available in canvas.tokens
        setTimeout(async () => {
          const token = canvas.tokens.get(tokenDocument.id);
          if (token) {
            console.log(`Size Matters: Drawing graphics for effect token ${tokenDocument.id}`);
            await drawSizeMattersGraphicsForToken(token);
          } else {
            console.warn(`Size Matters: Effect token ${tokenDocument.id} not found in canvas.tokens`);
          }
        }, 100);
      }
    })
  );

  // ===================================================================
  // HOOKS DE EXCLUSÃO DE TOKEN - VERSÃO CORRETA E SEGURA
  // ===================================================================

  _sizeMattersRegisteredHooks.push(
    Hooks.on("preDeleteToken", (tokenDocument) => {
      const token = canvas.tokens.get(tokenDocument.id);
      if (token) {
        clearTokenSizeMattersGraphics(token);
      }
    })
  );

  _sizeMattersRegisteredHooks.push(
    Hooks.on("deleteToken", async (tokenDocument, options, userId) => {
      // Limpeza local imediata do container do efeito
      targetedCleanupTokenGraphics(tokenDocument.id);
      
      // If deletion was initiated by this user, send signal to other clients
      if (game.user.id === userId && game.modules.get("size-matters").api._socket) {
        game.modules.get("size-matters").api._socket.emit("module.size-matters", {
          action: "forceCleanTokenGraphics",
          payload: {
            tokenId: tokenDocument.id,
            sceneId: canvas.scene.id
          }
        });
      }
      
      // Additional module logic
      if (tokenDocument.actor) {
        try {
          const actor = game.actors.get(tokenDocument.actorId);
          if (actor) {
            await actor.unsetFlag("size-matters", "associatedPreset");
          }
        } catch (error) { /* Silenciar erro */ }
      }
      game.modules.get("size-matters").api.stopTokenRide(tokenDocument, true);
    })
  );

  // ===================================================================

  // Scene/Token update hooks
  _sizeMattersRegisteredHooks.push(Hooks.on("updateScene", (scene, changes) => {
    if (changes.active === true) clearAllSizeMattersGraphics();
  }));

  _sizeMattersRegisteredHooks.push(
    Hooks.on("updateToken", async (tokenDocument, changes) => {
      if (changes.flags?.["size-matters"]) {
        const token = canvas.tokens.get(tokenDocument.id);
        if (token) {
          clearTokenSizeMattersGraphics(token);
          await drawSizeMattersGraphicsForToken(token);
        }
      }
    })
  );

  // Token HUD hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("renderTokenHUD", (app, html, data) => {
     // Check if HUD button is disabled in settings
     const showHudButton = game.settings.get("size-matters", "showHudButton");
     if (!showHudButton) {
       return;
     }
     
     // Ensure html is a jQuery object
     html = $(html);
     
      const token = canvas.tokens.get(data._id);
      if (!token?.actor) return;

      const actorAssociatedPreset = token.actor.getFlag("size-matters", "associatedPreset");
      if (!actorAssociatedPreset) return;

      const presets = game.settings.get("size-matters", "presets") || {};
      if (!presets[actorAssociatedPreset]) {
        token.actor.unsetFlag("size-matters", "associatedPreset");
        return;
      }

      const currentActivePreset = token.document.getFlag("size-matters", "activePreset");
      const isMontariaActive = currentActivePreset === actorAssociatedPreset;

      const buttonHtml = `
        <button type="button" class="control-icon ${isMontariaActive ? "active" : ""}"
                data-action="toggle-montaria-preset"
                title="${isMontariaActive ? `Remover ${actorAssociatedPreset}` : `Adicionar ${actorAssociatedPreset}`}">
          <i class="${isMontariaActive ? "fa-solid fa-person-walking" : "fa-solid fa-horse"}"></i>
        </button>`;
      
      html.find(".col.left").append(buttonHtml);
      html.find('button[data-action="toggle-montaria-preset"]').on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await game.modules.get("size-matters").api.togglePresetOnToken(actorAssociatedPreset);
      });
    })
  );

  // Module settings hook
  _sizeMattersRegisteredHooks.push(
    Hooks.on("renderModuleManagement", (app, html) => {
     // Ensure html is a jQuery object
     html = $(html);
     
      const moduleRow = html.find('li[data-module-id="size-matters"]');
      if (moduleRow.find('.size-matters-clear-data-button').length > 0) return;
      const clearDataButton = $(`
        <button type="button" class="size-matters-clear-data-button" style="margin-left: 5px; background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 12px;">
          <i class="fas fa-eraser"></i> Clear All Data
        </button>`);
      moduleRow.find('button[data-action="configure"]').after(clearDataButton);
      clearDataButton.on("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearModuleDataAndRestart();
      });
    })
  );

  // Token flag update hook for effect removal sync
  _sizeMattersRegisteredHooks.push(
    Hooks.on("updateToken", async (tokenDocument, changes, options, userId) => {
      // Check if Size Matters settings were removed/cleared
      if (changes.flags?.["size-matters"] && 
          (changes.flags["size-matters"]["-=settings"] !== undefined || 
           changes.flags["size-matters"]["settings"] === null)) {
        
        // If this change was made by this user (GM), broadcast to other clients
        if (game.user.id === userId && game.modules.get("size-matters").api._socket) {
          game.modules.get("size-matters").api._socket.emit("module.size-matters", {
            action: "removeTokenEffect",
            payload: {
              tokenId: tokenDocument.id,
              sceneId: canvas.scene.id
            }
          });
        }
        
        // Always clean locally, regardless of who made the change
        const token = canvas.tokens.get(tokenDocument.id);
        if (token) {
          clearTokenSizeMattersGraphics(token);
        }
      }
    })
  );
}

// ================================
// LIMPEZA DIRECIONADA DE GRÁFICOS
// ================================

function targetedCleanupTokenGraphics(tokenId) {
  console.log(`Size Matters: Limpeza direcionada iniciada para token ${tokenId}`);
  
  const containerName = `SizeMattersContainer-${tokenId}`;
  let foundAndRemoved = false;
  
  // Procurar primeiro em canvas.primary
  if (canvas.primary?.children) {
    for (let i = canvas.primary.children.length - 1; i >= 0; i--) {
      const child = canvas.primary.children[i];
      if (child.name === containerName) {
        console.log(`Size Matters: Container encontrado em canvas.primary: ${containerName}`);
        try {
          // Torna invisível imediatamente
          child.visible = false;
          canvas.primary.removeChild(child);
          child.destroy({ children: true, texture: false, baseTexture: false });
          foundAndRemoved = true;
          console.log(`Size Matters: Container removido com sucesso: ${containerName}`);
        } catch (error) {
          console.error(`Size Matters: Erro ao remover container:`, error);
        }
        break;
      }
    }
  }
  
  // Se não encontrou em canvas.primary, procurar em canvas.stage como fallback
  if (!foundAndRemoved && canvas.stage?.children) {
    for (let i = canvas.stage.children.length - 1; i >= 0; i--) {
      const child = canvas.stage.children[i];
      if (child.name === containerName) {
        console.log(`Size Matters: Container encontrado em canvas.stage: ${containerName}`);
        try {
          // Torna invisível imediatamente
          child.visible = false;
          canvas.stage.removeChild(child);
          child.destroy({ children: true, texture: false, baseTexture: false });
          foundAndRemoved = true;
          console.log(`Size Matters: Container removido do stage: ${containerName}`);
        } catch (error) {
          console.error(`Size Matters: Erro ao remover container do stage:`, error);
        }
        break;
      }
    }
  }
  
  if (foundAndRemoved) {
    console.log(`Size Matters: Forçando atualização do canvas após remoção`);
    // Força atualização do canvas
    canvas.perception.update({ 
      refreshLighting: false,
      refreshVision: false,
      refreshSounds: false,
      refreshTiles: false
    });
    
    // Força re-render do stage PIXI
    if (canvas.app && canvas.app.render) {
      canvas.app.render();
    }
  } else {
    console.warn(`Size Matters: Container não encontrado: ${containerName}`);
  }
}

// ================================
// UTILITIES
// ================================

export function isFoundryReady() {
  return !!(canvas?.tokens && ui?.notifications);
}

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

let sizeMattersAppInstance = null;

function openSizeMatters() {
  if (!checkFoundryReady()) return;
  if (sizeMattersAppInstance?.rendered) {
    return sizeMattersAppInstance.bringToTop();
  }
  const token = canvas.tokens.controlled[0] || null;
  const gridType = canvas.grid.type;
  if (![CONST.GRID_TYPES.SQUARE, CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType)) {
    return ui.notifications.warn("This module works with hexagonal and square grids only!");
  }
  sizeMattersAppInstance = new SizeMattersApp(token);
  sizeMattersAppInstance.render(true);
}

function openRideManager() {
  if (checkFoundryReady()) new RideManagerApp().render(true);
}

function openPresetManager() {
  if (checkFoundryReady()) new PresetManagerApp(sizeMattersAppInstance).render(true);
}

async function togglePresetOnToken(presetName) {
  if (!checkFoundryReady()) return;
  const token = canvas.tokens.controlled[0];
  if (!token) return ui.notifications.warn(MESSAGES.SELECT_TOKEN_FIRST);

  const presets = game.settings.get("size-matters", "presets") || {};
  const preset = presets[presetName];
  if (!preset) return ui.notifications.error(`Preset "${presetName}" not found!`);

  const currentActivePreset = token.document.getFlag("size-matters", "activePreset");

  if (currentActivePreset === presetName) {
    await token.document.unsetFlag("size-matters", "settings");
    await token.document.unsetFlag("size-matters", "activePreset");
    ui.notifications.info(`Preset "${presetName}" deactivated from ${token.name}.`);
  } else {
    const presetSettings = foundry.utils.duplicate(preset);
    await token.document.setFlag("size-matters", "settings", presetSettings);
    await token.document.setFlag("size-matters", "activePreset", presetName);
    if (token.actor) {
      await token.actor.setFlag("size-matters", "associatedPreset", presetName);
    }
    ui.notifications.info(`Preset "${presetName}" activated on ${token.name}.`);
  }

  if (sizeMattersAppInstance?.rendered && sizeMattersAppInstance.tokenId === token.id) {
    sizeMattersAppInstance.render(false);
  }
}

// ================================
// FOUNDRY HOOKS
// ================================

Hooks.once("init", () => {
  game.settings.register("size-matters", "enableDirectionalHighlight", { name: "Enable Directional Highlight", scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("size-matters", "gridSizeConfig", { name: "Grid Size Configuration", scope: "world", config: false, type: Object, default: DEFAULT_GRID_SIZE_CONFIG });
  game.settings.registerMenu("size-matters", "gridSizeMenu", { name: "Grid Size Settings", label: "Configure Grid Sizes", icon: "fas fa-th", type: GridSizeConfigApp, restricted: true });
  game.settings.registerMenu("size-matters", "clearDataMenu", { name: "Clear All Size Matters Data", label: "Clear All Data", icon: "fas fa-eraser", type: class extends FormApplication { constructor() { super(); clearModuleDataAndRestart(); } render() { return this; } }, restricted: true });
  game.settings.register("size-matters", "presets", { name: "Size Matters Presets", scope: "world", config: false, type: Object, default: {} });
  game.settings.register("size-matters", "globalDefaults", { name: "Size Matters Global Defaults", scope: "client", config: false, type: Object, default: DEFAULT_SETTINGS });
  game.settings.register("size-matters", "showHudButton", { name: "Show Preset Button on Token HUD", hint: "When enabled, tokens with associated presets will show a quick toggle button on their HUD.", scope: "world", config: true, type: Boolean, default: true });

  game.modules.get("size-matters").api = {
    openSizeMatters, openRideManager, openPresetManager, togglePresetOnToken,
    startTokenRide, stopTokenRide, removeFollowerFromTokenRide, getActiveRideGroups,
    stopAllTokenRides, restoreRidesFromFlags, createRideFromSelection,
    showRideManagementDialog, toggleQuickFollow,
    clearTokenSizeMattersGraphics
  };

  _registerAllModuleHooks();
});

Hooks.once("ready", () => {
  sizeMattersAppInstance = null;
  game.modules.get("size-matters").api._socket = game.socket;

  game.socket.on("module.size-matters", (data) => {
    if (data.action === "forceCleanTokenGraphics" && data.payload) {
      const { tokenId, sceneId } = data.payload;

      // Only execute cleanup if client is on the correct scene
      if (!canvas?.scene || canvas.scene.id !== sceneId) return;

      console.log(`Size Matters: Recebido sinal de limpeza direcionada para token ${tokenId}`);
      targetedCleanupTokenGraphics(tokenId);
    }
    
    // Handle effect token graphics synchronization
    // Handle effect removal synchronization
    if (data.action === "removeTokenEffect" && data.payload) {
      const { tokenId, sceneId } = data.payload;
      
      // Only execute if client is on the correct scene
      if (!canvas?.scene || canvas.scene.id !== sceneId) {
        return;
      }
      
      console.log(`Size Matters: Removendo efeito do token ${tokenId}`);
      
      const token = canvas.tokens.get(tokenId);
      if (token) {
        console.log(`Size Matters: Token encontrado, limpando efeito`);
        clearTokenSizeMattersGraphics(token);
      } else {
        console.log(`Size Matters: Token não encontrado, usando limpeza direcionada`);
        targetedCleanupTokenGraphics(tokenId);
      }
    }
  });
});