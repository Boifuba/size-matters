/**
 * GridSizeConfigApp.js
 * Configuration dialog for grid size settings at different zoom levels.
 */

export class GridSizeConfigApp extends FormApplication {
  constructor(sizeMattersApp = null, options = {}) {
    super(options);
    this.sizeMattersApp = sizeMattersApp;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "grid-size-config",
      title: "Grid Size Configuration",
      template: "modules/size-matters/templates/grid-size-config.html",
      width: 500,
      height: 400,
      resizable: true,
      closeOnSubmit: true,
    });
  }

  getData() {
    const config = game.settings.get("size-matters", "gridSizeConfig");
    return {
      config: config,
    };
  }

  async _updateObject(event, formData) {
    const config = {
      small: {
        hex: {
          gridSize: parseInt(formData["small.hex.gridSize"]) || 4,
          svgRadius: parseInt(formData["small.hex.svgRadius"]) || 12,
        },
        square: {
          gridSize: parseInt(formData["small.square.gridSize"]) || 4,
          squareSize: parseInt(formData["small.square.squareSize"]) || 20,
        },
      },
      medium: {
        hex: {
          gridSize: parseInt(formData["medium.hex.gridSize"]) || 4,
          svgRadius: parseInt(formData["medium.hex.svgRadius"]) || 24,
        },
        square: {
          gridSize: parseInt(formData["medium.square.gridSize"]) || 4,
          squareSize: parseInt(formData["medium.square.squareSize"]) || 40,
        },
      },
      large: {
        hex: {
          gridSize: parseInt(formData["large.hex.gridSize"]) || 4,
          svgRadius: parseInt(formData["large.hex.svgRadius"]) || 36,
        },
        square: {
          gridSize: parseInt(formData["large.square.gridSize"]) || 4,
          squareSize: parseInt(formData["large.square.squareSize"]) || 60,
        },
      },
    };

    await game.settings.set("size-matters", "gridSizeConfig", config);
    ui.notifications.info("Grid size configuration updated!");

    // Update any open Size Matters windows
    if (this.sizeMattersApp && this.sizeMattersApp.rendered) {
      this.sizeMattersApp.initializeGrid();
      this.sizeMattersApp.render(true);
    }
  }
}