/**
 * PresetManagerApp.js
 * Aplicação para gerenciar presets do Size Matters.
 */

import { DEFAULT_SETTINGS, MESSAGES } from './constants.js';

export class PresetManagerApp extends Application {
  constructor(sizeMattersApp = null, options = {}) {
    super(options);
    this.sizeMattersApp = sizeMattersApp;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "preset-manager",
      title: "Preset Manager",
      template: "modules/size-matters/templates/preset-manager-dialog.html",
      width: 600,
      height: 500,
      resizable: true,
      closeOnSubmit: false,
    });
  }

  async getData() {
    const presets = await this.getPresets();
    const presetsArray = Object.entries(presets).map(([name, preset]) => {
      return {
        name: name,
        imageUrl: preset.imageUrl || null,
        isVideo: preset.imageUrl
          ? /\.(webm|mp4|ogg|mov)$/i.test(preset.imageUrl)
          : false,
        ...preset,
      };
    });

    return {
      presets: presetsArray,
    };
  }

  async getPresets() {
    return game.settings.get("size-matters", "presets") || {};
  }

  async savePreset(name, settings) {
    const presets = await this.getPresets();
    const presetData = {
      color: settings.color,
      fillColor: settings.fillColor,
      thickness: settings.thickness,
      alpha: settings.alpha,
      enableFill: settings.enableFill,
      enableContour: settings.enableContour,
      imageUrl: settings.imageUrl,
      imageScale: settings.imageScale,
      imageOffsetX: settings.imageOffsetX,
      imageOffsetY: settings.imageOffsetY,
      imageRotation: settings.imageRotation,
      imageVisible: settings.imageVisible,
      grid: foundry.utils.duplicate(settings.grid),
    };
    presets[name] = presetData;
    await game.settings.set("size-matters", "presets", presets);
  }

  async deletePreset(name) {
    const presets = await this.getPresets();
    delete presets[name];
    await game.settings.set("size-matters", "presets", presets);
  }

  async handleSaveCurrentPreset() {
    if (!this.sizeMattersApp) {
      ui.notifications.warn(
        "Size Matters window must be open to save current settings!"
      );
      return;
    }

    const name = document.getElementById("new-preset-name")?.value?.trim();
    if (!name) {
      ui.notifications.warn("Enter a preset name!");
      return;
    }
    const currentSettings = {
      ...this.sizeMattersApp.settings,
      thickness: DEFAULT_SETTINGS.thickness,
      grid: foundry.utils.duplicate(this.sizeMattersApp.grid),
    };

    await this.savePreset(name, currentSettings);
    document.getElementById("new-preset-name").value = "";
    this.render(true);
    ui.notifications.info(`Preset "${name}" saved!`);
  }

  async applyPreset(name) {
    if (!this.sizeMattersApp) {
      ui.notifications.warn(
        "Size Matters window must be open to apply presets!"
      );
      return;
    }

    const presets = await this.getPresets();
    const preset = presets[name];
    if (!preset) {
      ui.notifications.error(`Preset "${name}" not found!`);
      return false;
    }

    // Apply preset to the Size Matters app
    this.sizeMattersApp.settings = foundry.utils.mergeObject(
      this.sizeMattersApp.settings, 
      preset
    );

    if (preset.grid) {
      this.sizeMattersApp.grid = foundry.utils.duplicate(preset.grid);
      this.sizeMattersApp.settings.grid = this.sizeMattersApp.grid;
    }

    await this.sizeMattersApp.saveSettings();
    this.sizeMattersApp.render(true);
    await this.sizeMattersApp.drawGrid();

    ui.notifications.info(`Preset "${name}" applied!`);
    return true;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".sm-save-current-btn").click(async () => {
      await this.handleSaveCurrentPreset();
    });

    html.find(".sm-preset-item").click(async (event) => {
      if ($(event.target).closest(".sm-preset-actions").length > 0) {
        return;
      }

      const presetName = event.currentTarget.getAttribute("data-preset-name");
      await this.applyPreset(presetName);
    });

    // Adicionar listener para botão direito (associar preset ao ator)
    html.find(".sm-preset-item").on("contextmenu", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const presetName = event.currentTarget.getAttribute("data-preset-name");
      await this.associatePresetToActor(presetName);
    });
    html.find(".sm-apply-preset-btn").click(async (event) => {
      event.stopPropagation();
      const presetName = event.currentTarget.getAttribute("data-preset-name");
      await this.applyPreset(presetName);
    });

    html.find(".sm-delete-preset-btn").click(async (event) => {
      event.stopPropagation();
      const presetName = event.currentTarget.getAttribute("data-preset-name");

      const confirmed = await Dialog.confirm({
        title: "Delete Preset",
        content: `<p>Are you sure you want to delete the preset "<strong>${presetName}</strong>"?</p>`,
        yes: () => true,
        no: () => false,
      });

      if (confirmed) {
        await this.deletePreset(presetName);
        this.render(true);
        ui.notifications.info(`Preset "${presetName}" deleted!`);
      }
    });

    html.find(".sm-export-presets-btn").click(async (event) => {
      event.stopPropagation();

      try {
        const presets = await this.getPresets();

        if (Object.keys(presets).length === 0) {
          ui.notifications.warn("No presets to export!");
          return;
        }

        function downloadJSON(data, filename = "export.json") {
          const jsonString = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(url);
        }

        downloadJSON(presets, "size-matters-presets.json");

        ui.notifications.info(
          `Exported ${Object.keys(presets).length} preset(s) successfully!`
        );
      } catch (error) {
        console.error("Size Matters: Error exporting presets:", error);
        ui.notifications.error("Failed to export presets!");
      }
    });

    html.find(".sm-import-presets-btn").click(async (event) => {
      event.stopPropagation();

      try {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";

        fileInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const importedPresets = JSON.parse(text);

            if (
              typeof importedPresets !== "object" ||
              importedPresets === null
            ) {
              throw new Error("Invalid preset file format");
            }

            const currentPresets = await this.getPresets();

            const conflicts = Object.keys(importedPresets).filter((name) =>
              currentPresets.hasOwnProperty(name)
            );

            let shouldProceed = true;
            if (conflicts.length > 0) {
              shouldProceed = await Dialog.confirm({
                title: "Import Conflicts",
                content: `<p>The following presets already exist and will be overwritten:</p>
                         <ul>${conflicts
                           .map((name) => `<li><strong>${name}</strong></li>`)
                           .join("")}</ul>
                         <p>Do you want to continue?</p>`,
                yes: () => true,
                no: () => false,
              });
            }

            if (shouldProceed) {
              const mergedPresets = { ...currentPresets, ...importedPresets };
              await game.settings.set("size-matters", "presets", mergedPresets);

              this.render(true);
              ui.notifications.info(
                `Imported ${
                  Object.keys(importedPresets).length
                } preset(s) successfully!`
              );
            }
          } catch (error) {
            console.error("Size Matters: Error importing presets:", error);
            ui.notifications.error(
              "Failed to import presets! Please check the file format."
            );
          }

          document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
      } catch (error) {
        console.error("Size Matters: Error setting up import:", error);
        ui.notifications.error("Failed to set up import!");
      }
    });
  }

  async associatePresetToActor(presetName) {
    const selectedTokens = canvas.tokens.controlled;
    if (selectedTokens.length === 0) {
      ui.notifications.warn(
        MESSAGES.SELECT_TOKEN_FIRST
      );
      return;
    }

    const token = selectedTokens[0];
    if (!token.actor) {
      ui.notifications.warn(
        "O token selecionado não possui um ator associado!"
      );
      return;
    }

    try {
      await token.actor.setFlag("size-matters", "associatedPreset", presetName);
      ui.notifications.info(
        `Preset "${presetName}" associado ao ator "${token.actor.name}"!`
      );
    } catch (error) {
      console.error("Size Matters: Erro ao associar preset ao ator:", error);
      ui.notifications.error("Erro ao associar preset ao ator!");
    }
  }
}