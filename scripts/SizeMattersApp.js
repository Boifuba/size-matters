/**
 * SizeMattersApp.js
 * Aplicação principal do Size Matters para configuração de tokens.
 */

import { GridManager } from "./grid-manager.js";
import { getTexture, clearTextureCache } from "./texture-utils.js";
import {
  drawSizeMattersGraphicsForToken,
  clearTokenSizeMattersGraphics,
  clearAllSizeMattersGraphics,
} from "./token-graphics.js";
import { SettingsManager } from './settings-manager.js';
import { PresetManagerApp } from './PresetManagerApp.js';
import { DEFAULT_SETTINGS, MESSAGES } from './constants.js';

export class SizeMattersApp extends Application {
  constructor(token = null, options = {}) {
    super(options);
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.gridManager = new GridManager();
    this._isInitialized = false;
    this._openedBeforeReady = !game.ready;
    
    // If opened before Foundry is ready, re-render once it's ready
    if (this._openedBeforeReady) {
      Hooks.once("ready", () => {
        if (this.rendered) {
          this.render(true);
        }
      });
    }
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "size-matters",
      title: "Yes, Size Matters!",
      template: "modules/size-matters/templates/size-matters-dialog.html",
      width: 420,
      height: "auto",
      resizable: false,
      closeOnSubmit: false,
    });
  }

  async render(force = false, options = {}) {
    // Initialize settings and grid only when rendering for the first time
    if (!this._isInitialized) {
      this.loadSettings();
      this.initializeGrid();
      this._isInitialized = true;
    }

    const result = await super.render(force, options);

    return result;
  }

  initializeGrid() {
    const zoomLevel = this.settings?.zoomLevel || "medium";
    this.grid = this.gridManager.initializeGrid(zoomLevel, this.grid);
    this.currentSvgRadius = this.gridManager.getSvgRadius();
    this.currentSquareSize = this.gridManager.getSquareSize();
  }

  loadSettings() {
    const tokenSettings = this.token
      ? this.token.document.getFlag("size-matters", "settings") || {}
      : {};

    // Load global defaults first
    const globalDefaults = game.ready 
      ? game.settings.get("size-matters", "globalDefaults") || {}
      : DEFAULT_SETTINGS;


    // Merge in order: defaults -> global -> token-specific
    this.settings = foundry.utils.mergeObject(
      DEFAULT_SETTINGS,
      globalDefaults
    );
    this.settings = foundry.utils.mergeObject(this.settings, tokenSettings);

    if (tokenSettings.grid) {
      this.grid = tokenSettings.grid;
    } else {
      this.initializeGrid();
    }

    // Após carregar as configurações, reinicializar o grid com o zoom level correto
    this.initializeGrid();
  }

  async saveSettings() {
    if (this.token) {
      await this.token.document.setFlag(
        "size-matters",
        "settings",
        foundry.utils.duplicate(this.settings)
      );
    }
  }

  async setControlledToken(token) {
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.loadSettings();
    this.render(false);
  }

  async loadPreset(name) {
    // Delegate to PresetManagerApp for consistency
    const presetManager = new PresetManagerApp(this);
    return await presetManager.applyPreset(name);
  }

  async saveGlobalDefaults() {
    // Save general settings (excluding grid) as global defaults
    const globalSettings = {
      color: this.settings.color,
      fillColor: this.settings.fillColor,
      thickness: this.settings.thickness,
      alpha: this.settings.alpha,
      enableFill: this.settings.enableFill,
      enableContour: this.settings.enableContour,
      imageUrl: this.settings.imageUrl,
      imageScale: this.settings.imageScale,
      imageOffsetX: this.settings.imageOffsetX,
      imageOffsetY: this.settings.imageOffsetY,
      imageRotation: this.settings.imageRotation,
      imageVisible: this.settings.imageVisible,
      zoomLevel: this.settings.zoomLevel,
    };

    await game.settings.set("size-matters", "globalDefaults", globalSettings);
  }

  async clearGlobalDefaults() {
    await game.settings.set("size-matters", "globalDefaults", { ...DEFAULT_SETTINGS });
  }

  // Debounced save to prevent excessive saves
  debouncedSave = foundry.utils.debounce(async () => {
    await this.saveSettings();
    await this.saveGlobalDefaults();
  }, 300);

  // Debounced draw to prevent excessive redraws
  debouncedDraw = foundry.utils.debounce(async (html) => {
    await this.drawGrid(html);
  }, 100);

  // Method to trigger optimized save and draw
  async saveAndDraw(html) {
    this.debouncedSave();
    this.debouncedDraw(html);
  }

  async immediateRedraw(html) {
    await this.saveSettings();
    await this.saveGlobalDefaults();
    await this.drawGrid(html);
  }

  async loadPreset(name) {
    // Import here to avoid circular dependency
    const { PresetManagerApp } = await import('./PresetManagerApp.js');
    const presetManager = new PresetManagerApp(this);
    return await presetManager.applyPreset(name);
  }

  getData() {
    if (!this.token) {
      return {
        noToken: true,
        gridType: "No Token Selected",
        gridSize: 0,
        gridSVG:
          '<div style="text-align: center; padding: 40px; color: #666;">Select a token to configure</div>',
        isPointyTop: false,
        isHexGrid: false,
        enableDirectionalHighlight: game.settings.get(
          "size-matters",
          "enableDirectionalHighlight"
        ),
        ...this.settings,
      };
    }
    const gridType = canvas.grid.type;
    const isHexGrid = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
      CONST.GRID_TYPES.HEXODDQ,
      CONST.GRID_TYPES.HEXEVENQ,
    ].includes(gridType);
    const isPointyTop = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
    ].includes(gridType);
    return {
      gridType: isHexGrid
        ? isPointyTop
          ? "Pointy-Top Hex"
          : "Flat-Top Hex"
        : "Square Grid",
      gridSize: canvas.grid.size,
      gridSVG: this.createGridSVG(isHexGrid, isPointyTop),
      isPointyTop: isPointyTop,
      isHexGrid: isHexGrid,
      enableDirectionalHighlight: game.settings.get(
        "size-matters",
        "enableDirectionalHighlight"
      ),
      ...this.settings,
    };
  }

  createGridSVG(isHexGrid, isPointyTop) {
    const svgSize = 300;
    // Atualizar o grid no manager antes de criar o SVG
    this.gridManager.setGrid(this.grid);
    return this.gridManager.createGridSVG(isHexGrid, isPointyTop, svgSize);
  }

  updateGridSVG(html) {
    const gridType = canvas.grid.type;
    const isHexGrid = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
      CONST.GRID_TYPES.HEXODDQ,
      CONST.GRID_TYPES.HEXEVENQ,
    ].includes(gridType);
    const isPointyTop = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
    ].includes(gridType);

    const newSVG = this.createGridSVG(isHexGrid, isPointyTop);
    html.find(".sm-grid-container").html(newSVG);
    html.find("polygon[data-grid], rect[data-grid]").click((event) => {
      const key = event.currentTarget.getAttribute("data-grid");
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.drawGrid(html);
    this.setupGridInteraction(html);
    this.setupAccordions(html);

    // Opacity input with real-time validation and update
    html.find('input[name="alpha"]').on("input", (event) => {
      let value = parseFloat(event.target.value);

      // Clamp value between 0 and 1
      if (isNaN(value) || value < 0) value = 0;
      if (value > 1) value = 1;

      // Update the input field with clamped value
      event.target.value = value;

      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    // Real-time updates for other controls
    html.find('input[name="imageScale"]').on("input", (event) => {
      html.find("#sval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageOffsetX"]').on("input", (event) => {
      html.find("#xval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageOffsetY"]').on("input", (event) => {
      html.find("#yval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageRotation"]').on("input", (event) => {
      html.find("#rval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="color"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="fillColor"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="enableFill"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="enableContour"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageVisible"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    // Zoom level changes with immediate update
    html.find('select[name="zoomLevel"]').on("change", (event) => {
      this.settings.zoomLevel = event.target.value;
      this.initializeGrid();
      this.updateGridSVG(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    // Radio button changes for zoom level
    html.find('input[name="zoomLevel"]').on("change", (event) => {
      if (event.target.checked) {
        this.settings.zoomLevel = event.target.value;
        this.initializeGrid();
        this.updateGridSVG(html);
        this.drawGrid(html);
        this.saveSettings();
      }
    });

    // Directional highlight toggle
    html
      .find('input[name="enableDirectionalHighlight"]')
      .on("change", (event) => {
        const isEnabled = event.target.checked;
        // Usar o SettingsManager para atualizar a configuração
        SettingsManager.setDirectionalHighlight(isEnabled);
        this.drawGrid(html);
      });

    // Button handlers
    html.find(".file-picker-button").click(() => this.openFilePicker(html));
    html.find(".sm-file-picker-button").click(() => this.openFilePicker(html));
    html.find(".sm-ride-button").click(() => this.handleRideButton(html));
    html.find(".sm-clear-button").click(() => this.clearAll(html));
    html
      .find(".sm-preset-manager-button")
      .click(() => this.handlePresetManager(html));

    // Line adjustment button handlers
    html.find(".sm-add-red-btn").click(() => {
      this.settings.redLineAdjustment = Math.min(
        1,
        this.settings.redLineAdjustment + 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    html.find(".sm-remove-red-btn").click(() => {
      this.settings.redLineAdjustment = Math.max(
        -1,
        this.settings.redLineAdjustment - 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    html.find(".sm-add-green-btn").click(() => {
      this.settings.greenLineAdjustment = Math.min(
        1,
        this.settings.greenLineAdjustment + 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    html.find(".sm-remove-green-btn").click(() => {
      this.settings.greenLineAdjustment = Math.max(
        -1,
        this.settings.greenLineAdjustment - 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    // Zoom button handlers
    html.find(".sm-zoom-in-btn").click(() => {
      const currentZoom = this.settings.zoomLevel;
      let newZoom = currentZoom;

      if (currentZoom === "small") {
        newZoom = "medium";
      } else if (currentZoom === "medium") {
        newZoom = "large";
      }
      // If already 'large', stay at 'large'

      if (newZoom !== currentZoom) {
        this.settings.zoomLevel = newZoom;
        this.initializeGrid();
        this.updateGridSVG(html);
        this.drawGrid(html);
        this.saveSettings();
      }
    });

    html.find(".sm-zoom-out-btn").click(() => {
      const currentZoom = this.settings.zoomLevel;
      let newZoom = currentZoom;

      if (currentZoom === "large") {
        newZoom = "medium";
      } else if (currentZoom === "medium") {
        newZoom = "small";
      }
      // If already 'small', stay at 'small'

      if (newZoom !== currentZoom) {
        this.settings.zoomLevel = newZoom;
        this.initializeGrid();
        this.updateGridSVG(html);
        this.drawGrid(html);
        this.saveSettings();
      }
    });

    // Save button handler
    html.find(".sm-save-button").click(async () => {
      this.updateSettingsFromForm(html);
      this.settings.grid = this.grid;
      await this.saveSettings();
      await this.drawGrid(html);
      ui.notifications.info("Settings saved successfully!");
    });
  }

  setupAccordions(html) {
    html.find(".sm-accordion-header").click((event) => {
      const header = $(event.currentTarget);
      const targetId = header.data("target");
      const content = html.find(`#${targetId}`);
      const icon = header.find(".sm-accordion-icon");

      // Toggle active state
      header.toggleClass("active");
      content.toggleClass("active");

      // Animate icon rotation is handled by CSS
    });
  }

  setupGridInteraction(html) {
    let isDragging = false;
    let dragMode = null;
    const gridElements = html.find("polygon[data-grid], rect[data-grid]");

    $(document).off("mouseup.size-matters");

    gridElements.on("mousedown", (event) => {
      event.preventDefault();
      const key = event.currentTarget.getAttribute("data-grid");
      const cell = this.grid[key];
      if (cell.isCenter) return;
      isDragging = true;
      dragMode = cell.selected ? "deselect" : "select";
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });

    gridElements.on("mouseenter", (event) => {
      if (!isDragging) return;
      const key = event.currentTarget.getAttribute("data-grid");
      const cell = this.grid[key];
      if (cell.isCenter) return;
      if (
        (dragMode === "select" && !cell.selected) ||
        (dragMode === "deselect" && cell.selected)
      ) {
        this.toggleGridCell(key, event.currentTarget);
        this.drawGrid(html);
      }
    });

    $(document).on("mouseup.size-matters", () => {
      isDragging = false;
      dragMode = null;
    });

    html.find(".sm-grid-container").on("mouseleave", () => {
      isDragging = false;
      dragMode = null;
    });

    html.find(".sm-grid-container").on("selectstart", (event) => {
      if (isDragging) {
        event.preventDefault();
      }
    });
  }

  updateFormFromSettings(html) {
    html.find('[name="color"]').val(this.settings.color);
    html.find('[name="fillColor"]').val(this.settings.fillColor);
    html.find('[name="alpha"]').val(this.settings.alpha);
    html.find('[name="enableFill"]').prop("checked", this.settings.enableFill);
    html
      .find('[name="enableContour"]')
      .prop("checked", this.settings.enableContour);
    html.find('[name="imageScale"]').val(this.settings.imageScale);
    html.find("#sval").text(this.settings.imageScale);
    html.find('[name="imageOffsetX"]').val(this.settings.imageOffsetX);
    html.find("#xval").text(this.settings.imageOffsetX);
    html.find('[name="imageOffsetY"]').val(this.settings.imageOffsetY);
    html.find("#yval").text(this.settings.imageOffsetY);
    html.find('[name="imageRotation"]').val(this.settings.imageRotation);
    html.find("#rval").text(this.settings.imageRotation);
  }

  async openFilePicker(html) {
    const fp = new FilePicker({
      type: "media",
      current: this.settings.imageUrl,
      callback: (path) => {
        this.settings.imageUrl = path;
        this.settings.imageVisible = true;
        this.saveSettings();
        this.updateGridSVG(html);
        this.drawGrid(html);
      },
    });
    fp.render(true);
  }

  toggleGridCell(key, element) {
    const cell = this.grid[key];
    if (!cell) return;

    cell.selected = !cell.selected;
    this.gridManager.setGrid(this.grid);
    const fill = cell.selected ? "#2196F3" : "#ffffff";
    element.setAttribute("fill", fill);
    element.classList.toggle("sm-grid-selected", cell.selected);
    element.classList.toggle("sm-grid-unselected", !cell.selected);
    this.settings.grid = this.grid;

    // Auto-save grid changes with immediate feedback
    this.saveSettings().then(() => {
      this.drawGrid();
    });
  }

  updateSettingsFromForm(html) {
    if (!html) return;
    this.settings.color = html.find('[name="color"]').val();
    this.settings.fillColor = html.find('[name="fillColor"]').val();

    // Parse opacity input with validation
    let alpha = parseFloat(html.find('[name="alpha"]').val());
    if (isNaN(alpha) || alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;
    this.settings.alpha = alpha;

    this.settings.enableFill = html.find('[name="enableFill"]').is(":checked");
    this.settings.enableContour = html
      .find('[name="enableContour"]')
      .is(":checked");
    this.settings.imageScale =
      parseFloat(html.find('[name="imageScale"]').val()) || 1.0;
    this.settings.imageOffsetX =
      parseInt(html.find('[name="imageOffsetX"]').val()) || 0;
    this.settings.imageOffsetY =
      parseInt(html.find('[name="imageOffsetY"]').val()) || 0;
    this.settings.imageRotation =
      parseInt(html.find('[name="imageRotation"]').val()) || 0;
    this.settings.imageVisible = html
      .find('[name="imageVisible"]')
      .is(":checked");
    this.settings.grid = this.grid;
  }

  async drawGrid(html) {
    if (!this.token) {
      return;
    }
    this.updateSettingsFromForm(html);
    this.settings.grid = this.grid;
    await drawSizeMattersGraphicsForToken(this.token);

    if (html) {
      this.updateGridSVG(html);
    }
  }

  async handleRideButton(html) {
    // Call the global openRideManager function
    if (game.modules.get("size-matters").api.openRideManager) {
      game.modules.get("size-matters").api.openRideManager();
    } else {
      ui.notifications.error("Ride Manager not available!");
    }
  }

  async handlePresetManager(html) {
    const presetManager = new PresetManagerApp(this);
    presetManager.render(true);
  }

  clearTokenGraphics() {
    const currentToken = canvas.tokens.get(this.tokenId);
    clearTokenSizeMattersGraphics(currentToken);
  }

  async clearAll(html) {
    if (!this.token) {
      ui.notifications.warn(MESSAGES.SELECT_TOKEN_FIRST);
      return;
    }
    this.clearTokenGraphics();

    this.settings = { ...DEFAULT_SETTINGS };

    // Reset grid manager and reinitialize
    this.grid = this.gridManager.initializeGrid("medium");
    this.settings.grid = this.grid;

    await this.clearGlobalDefaults();

    if (this.token) {
      await this.token.document.unsetFlag("size-matters", "settings");
    }
    if (html) {
      this.updateFormFromSettings(html);
      this.updateGridSVG(html);
    }
    ui.notifications.info("All settings cleared and reset to default!");
  }

  async close(options = {}) {
    $(document).off("mouseup.size-matters");

    // Force immediate save before closing
    if (this.token) {
      const html = this.element;
      if (html && html.length > 0) {
        this.updateSettingsFromForm(html);
        this.settings.grid = this.grid;
      }
    }

    // Call parent close method to properly close the application
    return super.close(options);
  }
}