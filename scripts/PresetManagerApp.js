/**
 * PresetManagerApp.js
 * Application for managing Size Matters presets.
 */

export class PresetManagerApp extends FormApplication {
  constructor(sizeMattersApp, options = {}) {
    super(options);
    this.sizeMattersApp = sizeMattersApp;
    this.presets = {};
    this.selectedPresetForPlacement = null;
    this.placementModeActive = false;
    this.canvasClickHandler = null;
    this.loadPresets();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "preset-manager",
      title: "Size Matters - Preset Manager",
      template: "modules/size-matters/templates/preset-manager-dialog.html",
      width: 500,
      height: 600,
      resizable: true,
      closeOnSubmit: false,
    });
  }

  /**
   * Load presets from game settings
   */
  loadPresets() {
    this.presets = foundry.utils.deepClone(game.settings.get("size-matters", "presets") || {});
  }

  /**
   * Save presets to game settings
   */
  async savePresets() {
    await game.settings.set("size-matters", "presets", foundry.utils.deepClone(this.presets));
  }

  getData() {
    // Always reload presets from game settings before rendering
    this.loadPresets();
    
    const presetsArray = Object.entries(this.presets).map(([name, preset]) => ({
      name: name,
      ...preset,
      hasGrid: preset.grid && Object.values(preset.grid).some(cell => cell.selected),
      selectedCellCount: preset.grid ? Object.values(preset.grid).filter(cell => cell.selected).length : 0,
      isSelected: this.selectedPresetForPlacement === name
    }));

    return {
      presets: presetsArray,
      hasPresets: presetsArray.length > 0,
      canSaveCurrent: !!this.sizeMattersApp && !!this.sizeMattersApp.token,
      selectedPresetForPlacement: this.selectedPresetForPlacement,
      placementModeActive: this.placementModeActive
    };
  }

  async _updateObject(event, formData) {
    // This method is called when the form is submitted
    // Handle any form-based updates here if needed
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Placement mode checkbox
    html.find('#placement-mode-checkbox').change((event) => {
      this.placementModeActive = event.target.checked;
      
      if (this.placementModeActive) {
        // Don't require preset selection to activate placement mode
        ui.notifications.info("Placement mode activated! Select a preset by clicking on a thumbnail, then click on canvas to place effect tokens.");
        this.activateCanvasPlacementMode();
      } else {
        this.deactivateCanvasPlacementMode();
        ui.notifications.info("Placement mode deactivated.");
      }
      
      // Re-render to update UI state
      this.render(true);
    });

    // Preset selection for placement - now works by clicking thumbnails directly
    html.find('.sm-preset-item').click(async (event) => {
      // Don't trigger if clicking on delete button
      if (event.target.closest('.sm-delete-preset-btn')) return;
      
      const presetName = event.currentTarget.dataset.presetName;
      const preset = this.presets[presetName];
      
      if (!preset) {
        ui.notifications.error(`Preset "${presetName}" not found!`);
        return;
      }

      // If placement mode is active, select this preset for placement
      if (this.placementModeActive) {
        this.selectedPresetForPlacement = presetName;
        this.render(true); // Re-render to show selection
        return;
      }

      // If placement mode is not active, apply preset to selected token
      const selectedTokens = canvas.tokens.controlled;
      if (selectedTokens.length === 0) {
        ui.notifications.warn("Select a token first to apply the preset!");
        return;
      }

      const token = selectedTokens[0];
      if (!token || !token.document || !token.actor) {
        ui.notifications.error("Invalid token or token has no actor!");
        return;
      }

      // Apply preset to selected token using the main module API
      if (game.modules.get("size-matters").api.togglePresetOnToken) {
        await game.modules.get("size-matters").api.togglePresetOnToken(presetName);
        
        // Set the associatedPreset flag on the actor so the HUD button appears
        await token.actor.setFlag("size-matters", "associatedPreset", presetName);
        
        // Force re-render of the token HUD to show/update the button immediately
        if (token.hasActiveHUD) {
          token.layer.hud.render(true);
        }
        
      } else {
        ui.notifications.error("Size Matters API not available!");
      }
    });

    // Save current configuration as preset
    html.find('.sm-save-current-btn').click(async () => {
      if (!this.sizeMattersApp || !this.sizeMattersApp.token) {
        ui.notifications.warn("No token selected to save preset from!");
        return;
      }

      const presetNameInput = html.find('#new-preset-name');
      const presetName = presetNameInput.val().trim();
      
      if (!presetName) {
        ui.notifications.warn("Please enter a preset name!");
        return;
      }

      // Check if preset already exists
      if (this.presets[presetName]) {
        const overwrite = await Dialog.confirm({
          title: "Preset Already Exists",
          content: `<p>A preset named "<strong>${presetName}</strong>" already exists.</p><p>Do you want to overwrite it?</p>`,
          yes: () => true,
          no: () => false
        });

        if (!overwrite) return;
      }

      const currentSettings = this.getCurrentSettings();
      this.presets[presetName] = {
        ...currentSettings,
        createdAt: Date.now(),
        createdBy: game.user.name
      };

      await this.savePresets();
      ui.notifications.info(`Preset "${presetName}" saved!`);
      
      // Clear input and re-render
      presetNameInput.val('');
      this.render(true);
    });

    // Delete preset
    html.find('.sm-delete-preset-btn').click(async (event) => {
      event.stopPropagation(); // Prevent triggering the preset item click
      
      const presetName = event.currentTarget.dataset.presetName;
      
      const confirmed = await Dialog.confirm({
        title: "Delete Preset",
        content: `<p>Are you sure you want to delete the preset "<strong>${presetName}</strong>"?</p><p>This action cannot be undone.</p>`,
        yes: () => true,
        no: () => false
      });

      if (confirmed) {
        delete this.presets[presetName];
        await this.savePresets();
        ui.notifications.info(`Preset "${presetName}" deleted!`);
        this.render(true);
      }
    });

    // Import presets
    html.find('.sm-import-presets-btn').click(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const importData = JSON.parse(text);
          
          // Handle single preset import
          if (importData.preset && importData.name) {
            await this.importSinglePreset(importData);
          }
          // Handle multiple presets import
          else if (typeof importData === 'object') {
            await this.importMultiplePresets(importData);
          }
          else {
            throw new Error("Invalid preset file format");
          }

          this.render(true);
        } catch (error) {
          console.error("Size Matters: Error importing preset:", error);
          ui.notifications.error("Failed to import preset. Please check the file format.");
        }
      };
      input.click();
    });

    // Export all presets
    html.find('.sm-export-presets-btn').click(() => {
      if (Object.keys(this.presets).length === 0) {
        ui.notifications.warn("No presets to export!");
        return;
      }

      const exportData = {
        presets: this.presets,
        exportedAt: Date.now(),
        exportedBy: game.user.name,
        version: "1.0"
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `size-matters-presets-${Date.now()}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      ui.notifications.info("All presets exported!");
    });
  }

  /**
   * Activates canvas placement mode
   */
  activateCanvasPlacementMode() {
    // Remove any existing handler
    this.deactivateCanvasPlacementMode();

    // Create the canvas click handler
    this.canvasClickHandler = this.onCanvasClick.bind(this);
    
    // Add event listener to canvas
    if (canvas && canvas.stage) {
      canvas.stage.on('pointerdown', this.canvasClickHandler);
      canvas.stage.interactive = true;
    }

    // Change cursor to indicate placement mode
    if (canvas && canvas.app && canvas.app.view) {
      canvas.app.view.style.cursor = 'crosshair';
    }
  }

  /**
   * Deactivates canvas placement mode
   */
  deactivateCanvasPlacementMode() {
    // Remove event listener
    if (this.canvasClickHandler && canvas && canvas.stage) {
      canvas.stage.off('pointerdown', this.canvasClickHandler);
    }
    
    this.canvasClickHandler = null;

    // Reset cursor
    if (canvas && canvas.app && canvas.app.view) {
      canvas.app.view.style.cursor = 'default';
    }
  }

  /**
   * Handles canvas click events for token placement
   */
  async onCanvasClick(event) {
    if (!this.placementModeActive || !this.selectedPresetForPlacement) {
      if (!this.selectedPresetForPlacement && this.placementModeActive) {
        ui.notifications.warn("Select a preset first by clicking on a thumbnail!");
      }
      return;
    }

    // Get click position
    const position = event.data.getLocalPosition(canvas.stage);
    
    // Snap to grid
    const snappedPosition = canvas.grid.getSnappedPosition(position.x, position.y);
    
    try {
      // Create invisible token
      const tokenData = {
        name: `Effect ${this.selectedPresetForPlacement}`,
        x: snappedPosition.x,
        y: snappedPosition.y,
        width: 1,
        height: 1,
        img: "icons/svg/mystery-man.svg", // Default token image
        hidden: false, // Make token visible to all users so they can see the effects
        alpha: 0.01, // Make token image nearly invisible while keeping effects visible
        flags: {
          "size-matters": {
            settings: foundry.utils.duplicate(this.presets[this.selectedPresetForPlacement]),
            activePreset: this.selectedPresetForPlacement,
            isEffectToken: true // Mark as effect token
          }
        }
      };

      // Create the token
      const tokenDocument = await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
      
      if (tokenDocument && tokenDocument[0]) {
        // Token graphics will be drawn automatically via the createToken hook
        ui.notifications.info(`Effect token "${this.selectedPresetForPlacement}" placed successfully!`);
      }
    } catch (error) {
      console.error("Size Matters: Error creating effect token:", error);
      ui.notifications.error("Error creating effect token!");
    }
  }

  /**
   * Override close to cleanup placement mode
   */
  async close(options = {}) {
    this.deactivateCanvasPlacementMode();
    return super.close(options);
  }

  /**
   * Get current settings from the Size Matters app
   * @returns {Object} Current settings as a preset
   */
  getCurrentSettings() {
    if (!this.sizeMattersApp) {
      return {};
    }

    // Get current settings from the SizeMattersApp
    const currentSettings = { ...this.sizeMattersApp.settings };
    
    // Get current grid data
    if (this.sizeMattersApp.gridManager) {
      currentSettings.grid = this.sizeMattersApp.gridManager.getGrid();
    }
    
    // Add video detection for the effect image
    if (currentSettings.imageUrl) {
      currentSettings.isVideo = this.isUrlVideo(currentSettings.imageUrl);
    }
    
    return currentSettings;
  }

  /**
   * Check if a URL is a video file
   * @param {string} url - The URL to check
   * @returns {boolean} True if URL is a video
   */
  isUrlVideo(imageUrl) {
    if (!imageUrl) return false;
    
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
    return videoExtensions.some(ext => imageUrl.toLowerCase().includes(ext));
  }

  /**
   * Import a single preset
   * @param {Object} importData - The import data containing name and preset
   */
  async importSinglePreset(importData) {
    let presetName = importData.name;
    
    // Check if preset already exists
    if (this.presets[presetName]) {
      const overwrite = await Dialog.confirm({
        title: "Preset Already Exists",
        content: `<p>A preset named "<strong>${presetName}</strong>" already exists.</p><p>Do you want to overwrite it?</p>`,
        yes: () => true,
        no: () => false
      });

      if (!overwrite) {
        presetName = await this.promptForPresetName(`${presetName} (Imported)`);
        if (!presetName) return;
      }
    }

    this.presets[presetName] = {
      ...importData.preset,
      importedAt: Date.now(),
      importedBy: game.user.name
    };

    await this.savePresets();
    ui.notifications.info(`Preset "${presetName}" imported successfully!`);
  }

  /**
   * Import multiple presets
   * @param {Object} importData - The import data containing multiple presets
   */
  async importMultiplePresets(importData) {
    let imported = 0;
    let skipped = 0;

    const presets = importData.presets || importData;
    
    for (const [name, preset] of Object.entries(presets)) {
      if (this.presets[name]) {
        skipped++;
        continue;
      }

      this.presets[name] = {
        ...preset,
        importedAt: Date.now(),
        importedBy: game.user.name
      };
      imported++;
    }

    await this.savePresets();
    
    let message = `Imported ${imported} preset(s).`;
    if (skipped > 0) {
      message += ` Skipped ${skipped} existing preset(s).`;
    }
    
  }

  /**
   * Prompt user for a preset name
   * @param {string} defaultName - Default name to suggest
   * @returns {Promise<string|null>} The entered name or null if cancelled
   */
  async promptForPresetName(defaultName = "") {
    return new Promise((resolve) => {
      new Dialog({
        title: "Enter Preset Name",
        content: `
          <form>
            <div class="form-group">
              <label>Preset Name:</label>
              <input type="text" name="presetName" value="${defaultName}" autofocus />
            </div>
          </form>
        `,
        buttons: {
          save: {
            label: "Save",
            callback: (html) => {
              const name = html.find('[name="presetName"]').val().trim();
              if (!name) {
                ui.notifications.warn("Please enter a preset name!");
                resolve(null);
                return;
              }
              resolve(name);
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "save",
        close: () => resolve(null)
      }).render(true);
    });
  }
}