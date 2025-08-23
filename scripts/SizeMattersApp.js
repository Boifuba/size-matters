/**
 * SizeMattersApp.js
 * Aplicação principal do Size Matters para configuração de tokens.
 */

import { GridManager } from "./grid-manager.js";
import {
  drawSizeMattersGraphicsForToken,
  clearTokenSizeMattersGraphics,
} from "./token-graphics.js";
import { PresetManagerApp } from './PresetManagerApp.js';
import { DEFAULT_SETTINGS, MESSAGES } from './constants.js';
import { pixelToAxial, pixelToSquare } from './grid-utils.js';

export class SizeMattersApp extends Application {
  constructor(token = null, options = {}) {
    super(options);
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.gridManager = new GridManager();
    this.pixiApp = null;
    this.gridGraphics = null;
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
      height: 700,
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

  async initializePixiPreview() {
    if (this.pixiApp) {
      return; // Already initialized
    }

    const canvas = this.element.find('#sm-grid-preview-canvas')[0];
    if (!canvas) {
      console.warn('Size Matters: Grid preview canvas not found');
      return;
    }

    try {
      this.pixiApp = new PIXI.Application({
        view: canvas,
        width: 350,
        height: 350,
        backgroundColor: 0xfafaf5,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });
      
      // CONFIGURAÇÃO CRÍTICA DO CANVAS
      this.pixiApp.view.style.pointerEvents = 'auto';
      this.pixiApp.view.style.cursor = 'pointer';
      this.pixiApp.view.style.touchAction = 'none'; // Previne scroll em mobile

      this.gridGraphics = new PIXI.Graphics();
      
      // CONFIGURAÇÃO MÁXIMA DE INTERATIVIDADE
      this.gridGraphics.interactive = true;
      this.gridGraphics.interactiveChildren = false;
      this.gridGraphics.hitArea = new PIXI.Rectangle(0, 0, 350, 350); // Área de hit completa
      this.gridGraphics.eventMode = 'static'; // FORÇA captura de eventos
      this.gridGraphics.cursor = 'pointer';
      
      // zIndex MÁXIMO para ficar no topo SEMPRE
      this.gridGraphics.zIndex = 0;
      
      this.pixiApp.stage.addChild(this.gridGraphics);
      
      // FORÇA sorting por zIndex
      this.pixiApp.stage.sortableChildren = true;
      this.pixiApp.stage.sortDirty = true;
      
      console.log('Size Matters: Grid graphics - zIndex:', this.gridGraphics.zIndex, 'interactive:', this.gridGraphics.interactive, 'eventMode:', this.gridGraphics.eventMode);

      // Draw initial grid
      await this.redrawGridPreview();
    } catch (error) {
      console.error('Size Matters: Failed to initialize PIXI preview:', error);
    }
  }

  async redrawGridPreview() {
    if (!this.gridGraphics || !this.gridManager) {
      return;
    }

    try {
      await this.gridManager.drawGridPreview(this.gridGraphics, this.token, this.settings);
      
      // FORÇA TOTAL refresh do stage
      if (this.pixiApp && this.pixiApp.stage) {
        this.pixiApp.stage.sortDirty = true;
        this.pixiApp.stage.sortableChildren = true;
        
        // FORÇA o grid graphics para o topo
        this.gridGraphics.zIndex = 0;
        this.gridGraphics.parent.setChildIndex(this.gridGraphics, this.gridGraphics.parent.children.length - 1);
      }
      
      console.log('Size Matters: Grid redrawn - zIndex:', this.gridGraphics.zIndex, 'interactive:', this.gridGraphics.interactive, 'children count:', this.pixiApp.stage.children.length);
    } catch (error) {
      console.error('Size Matters: Failed to redraw grid preview:', error);
    }
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

    // Load global defaults first (WITHOUT IMAGE SETTINGS)
    const globalDefaults = game.ready 
      ? game.settings.get("size-matters", "globalDefaults") || {}
      : {};

    // Start with DEFAULT_SETTINGS as base
    this.settings = foundry.utils.duplicate(DEFAULT_SETTINGS);
    
    // Apply global defaults (but NEVER image settings)
    const safeGlobalDefaults = {
      color: globalDefaults.color,
      fillColor: globalDefaults.fillColor,
      thickness: globalDefaults.thickness,
      alpha: globalDefaults.alpha,
      enableFill: globalDefaults.enableFill,
      enableContour: globalDefaults.enableContour,
      zoomLevel: globalDefaults.zoomLevel,
      // ❌ NEVER MERGE IMAGE SETTINGS FROM GLOBAL DEFAULTS
    };
    
    // Remove any undefined values
    Object.keys(safeGlobalDefaults).forEach(key => {
      if (safeGlobalDefaults[key] !== undefined) {
        this.settings[key] = safeGlobalDefaults[key];
      }
    });
    
    // Finally, apply token-specific settings (including images)
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
    // Clear graphics from old token first
    if (this.token && this.token.id !== (token ? token.id : null)) {
      clearTokenSizeMattersGraphics(this.token);
    }

    this.token = token;
    this.tokenId = token ? token.id : null;
    this.loadSettings();
    
    // Update form fields with new settings
    if (this.element && this.element.length > 0) {
      this.updateFormFromSettings(this.element);
      
      // Force complete redraw with new token data
      await this.redrawGridPreview();
      await this.drawGrid(this.element);
    }
  }

  async loadPreset(name) {
    // Import here to avoid circular dependency
    const { PresetManagerApp } = await import('./PresetManagerApp.js');
    const presetManager = new PresetManagerApp(this);
    return await presetManager.applyPreset(name);
  }

  async saveGlobalDefaults() {
    // Save general settings (excluding grid and ALL image settings) as global defaults
    // IMAGES SHOULD NEVER BE SAVED AS GLOBAL DEFAULTS
    const globalSettings = {
      color: this.settings.color,
      fillColor: this.settings.fillColor,
      thickness: this.settings.thickness,
      alpha: this.settings.alpha,
      enableFill: this.settings.enableFill,
      enableContour: this.settings.enableContour,
      zoomLevel: this.settings.zoomLevel,
      // ❌ NEVER SAVE IMAGE SETTINGS AS GLOBAL DEFAULTS:
      // imageUrl: this.settings.imageUrl,
      // imageScale: this.settings.imageScale,
      // imageOffsetX: this.settings.imageOffsetX,
      // imageOffsetY: this.settings.imageOffsetY,
      // imageRotation: this.settings.imageRotation,
      // imageVisible: this.settings.imageVisible,
    };

    await game.settings.set("size-matters", "globalDefaults", globalSettings);
  }

  async clearGlobalDefaults() {
    // Create clean defaults without any image settings
    const cleanDefaults = {
      color: DEFAULT_SETTINGS.color,
      fillColor: DEFAULT_SETTINGS.fillColor,
      thickness: DEFAULT_SETTINGS.thickness,
      alpha: DEFAULT_SETTINGS.alpha,
      enableFill: DEFAULT_SETTINGS.enableFill,
      enableContour: DEFAULT_SETTINGS.enableContour,
      zoomLevel: DEFAULT_SETTINGS.zoomLevel,
      // ❌ NEVER INCLUDE IMAGE SETTINGS IN GLOBAL DEFAULTS
    };
    
    await game.settings.set("size-matters", "globalDefaults", cleanDefaults);
  }

  // Consolidated debounced handler to prevent excessive saves and redraws
  debouncedSaveAndDraw = foundry.utils.debounce(async (html) => {
    try {
      // Save settings and global defaults
      await this.saveSettings();
      await this.saveGlobalDefaults();
      
      // Redraw grid if html is provided
      if (html) {
        await this.drawGrid(html);
      }
    } catch (error) {
      console.error("Size Matters: Error in debounced save and draw:", error);
      ui.notifications.error("Failed to save settings or update display");
    }
  }, 300);

  // Method to trigger consolidated save and draw
  async saveAndDraw(html) {
    this.debouncedSaveAndDraw(html);
  }

  async immediateRedraw(html) {
    await this.saveSettings();
    await this.saveGlobalDefaults();
    await this.drawGrid(html);
  }

  getData() {
    if (!this.token) {
      return {
        noToken: true,
        gridType: "No Token Selected",
        gridSize: 0,
        isPointyTop: false,
        isHexGrid: false,
        enableDirectionalHighlight: this.settings.enableDirectionalHighlight,
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
      enableDirectionalHighlight: this.settings.enableDirectionalHighlight,
      ...this.settings,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Initialize PIXI preview first, after HTML is rendered and in DOM
    this.initializePixiPreview().then(() => {
      this.setupGridInteraction(html);
      this.drawGrid(html);
    }).catch(error => {
      console.error('Size Matters: Failed to initialize PIXI preview:', error);
    });
    
    // Prevent form submission that causes page reload
    html.find('form').on('submit', (event) => {
      event.preventDefault();
      return false;
    });
    
    this.setupAccordions(html);

    // Opacity input with real-time validation and update
    html.find('input[name="alpha"]').on("input", (event) => {
      let value = parseFloat(event.target.value.replace(',', '.'));

      // Clamp value between 0 and 1
      if (isNaN(value) || value < 0) value = 0;
      if (value > 1) value = 1;

      this.settings.alpha = value;
      this.saveAndDraw(html);
    });

    // Prevent Enter key from submitting form on opacity input
    html.find('input[name="alpha"]').on("keydown", (event) => {
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        event.stopPropagation();
        event.target.blur(); // Remove focus from input
        return false;
      }
    });

    // Additional prevention for all inputs
    html.find('input, select, textarea').on("keydown", (event) => {
      if (event.key === 'Enter' || event.keyCode === 13) {
        // Only prevent if it's not a textarea (where Enter should work normally)
        if (event.target.tagName.toLowerCase() !== 'textarea') {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }
    });
    // Real-time updates for other controls
    html.find('input[name="imageScale"]').on("input", (event) => {
      html.find("#sval").text(event.target.value);
      this.settings.imageScale = parseFloat(event.target.value.replace(',', '.')) || 1.0;
      this.saveAndDraw(html);
    });

    html.find('input[name="imageOffsetX"]').on("input", (event) => {
      html.find("#xval").text(event.target.value);
      this.settings.imageOffsetX = parseInt(event.target.value) || 0;
      this.saveAndDraw(html);
    });

    html.find('input[name="imageOffsetY"]').on("input", (event) => {
      html.find("#yval").text(event.target.value);
      this.settings.imageOffsetY = parseInt(event.target.value) || 0;
      this.saveAndDraw(html);
    });

    html.find('input[name="imageRotation"]').on("input", (event) => {
      html.find("#rval").text(event.target.value);
      this.settings.imageRotation = parseInt(event.target.value) || 0;
      this.saveAndDraw(html);
    });

    html.find('input[name="color"]').on("change", (event) => {
      this.settings.color = event.target.value;
      this.saveAndDraw(html);
    });

    html.find('input[name="fillColor"]').on("change", (event) => {
      this.settings.fillColor = event.target.value;
      this.saveAndDraw(html);
    });

    // Switch handlers for toggles
    html.find('.sm-switch input[name="enableFill"]').on("change", (event) => {
      this.settings.enableFill = event.target.checked;
      this.saveAndDraw(html);
    });

    html.find('.sm-switch input[name="enableContour"]').on("change", (event) => {
      this.settings.enableContour = event.target.checked;
      this.saveAndDraw(html);
    });

    html.find('.sm-switch input[name="imageVisible"]').on("change", (event) => {
      this.settings.imageVisible = event.target.checked;
      this.saveAndDraw(html);
    });

    html.find('.sm-switch input[name="enableDirectionalHighlight"]').on("change", (event) => {
      this.settings.enableDirectionalHighlight = event.target.checked;
      this.saveAndDraw(html);
    });
    // Switch handlers for toggles
    html.find('.sm-toggle-switch input[name="enableFill"]').on("change", (event) => {
      this.settings.enableFill = event.target.checked;
      this.saveAndDraw(html);
    });

    html.find('.sm-toggle-switch input[name="enableContour"]').on("change", (event) => {
      this.settings.enableContour = event.target.checked;
      this.saveAndDraw(html);
    });

    html.find('.sm-toggle-switch input[name="imageVisible"]').on("change", (event) => {
      this.settings.imageVisible = event.target.checked;
      this.saveAndDraw(html);
    });

    html.find('.sm-toggle-switch input[name="enableDirectionalHighlight"]').on("change", (event) => {
      this.settings.enableDirectionalHighlight = event.target.checked;
      this.saveAndDraw(html);
    });

    // Zoom level changes with immediate update
    html.find('select[name="zoomLevel"]').on("change", (event) => {
      this.settings.zoomLevel = event.target.value;
      this.initializeGrid();
      this.redrawGridPreview();
      this.immediateRedraw(html);
    });

    // Radio button changes for zoom level
    html.find('input[name="zoomLevel"]').on("change", (event) => {
      if (event.target.checked) {
        this.settings.zoomLevel = event.target.value;
        this.initializeGrid();
        this.redrawGridPreview();
        this.immediateRedraw(html);
      }
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
      this.saveAndDraw(html);
    });

    html.find(".sm-remove-red-btn").click(() => {
      this.settings.redLineAdjustment = Math.max(
        -1,
        this.settings.redLineAdjustment - 1
      );
      this.saveAndDraw(html);
    });

    html.find(".sm-add-green-btn").click(() => {
      this.settings.greenLineAdjustment = Math.min(
        1,
        this.settings.greenLineAdjustment + 1
      );
      this.saveAndDraw(html);
    });

    html.find(".sm-remove-green-btn").click(() => {
      this.settings.greenLineAdjustment = Math.max(
        -1,
        this.settings.greenLineAdjustment - 1
      );
      this.saveAndDraw(html);
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
        this.redrawGridPreview();
        this.immediateRedraw(html);
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
        this.settings.grid = this.grid;
        this.initializeGrid();
        this.redrawGridPreview();
        this.immediateRedraw(html);
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
    
    if (!this.gridGraphics || !this.pixiApp) {
      console.warn('Size Matters: Grid graphics or PIXI app not available for interaction setup');
      return;
    }

    // LIMPAR todos os listeners existentes
    this.gridGraphics.removeAllListeners();
    
    // FORÇA configurações de interatividade novamente
    this.gridGraphics.interactive = true;
    this.gridGraphics.eventMode = 'static';
    this.gridGraphics.cursor = 'pointer';
    this.gridGraphics.zIndex = 0;

    // Handle pointer down (mouse/touch start)
    this.gridGraphics.on('pointerdown', (event) => {
      console.log('Size Matters: POINTER DOWN - event received at stage');
      const localPos = event.data.getLocalPosition(this.gridGraphics);
      const key = this.getGridCellFromPixelPosition(localPos.x, localPos.y);
      
      console.log('Size Matters: CLICK POSITION:', localPos.x, localPos.y, 'GRID CELL:', key);
      
      if (key) {
        const cell = this.grid[key];
        if (cell) {
          isDragging = true;
          dragMode = cell.selected ? "deselect" : "select";
          this.toggleGridCell(key);
          this.drawGrid(html);
          console.log('Size Matters: CELL TOGGLED:', key, 'NEW STATE:', cell.selected);
        }
      }
    });

    // Handle pointer move (mouse/touch move)
    this.gridGraphics.on('pointermove', (event) => {
      const localPos = event.data.getLocalPosition(this.gridGraphics);
      const key = this.getGridCellFromPixelPosition(localPos.x, localPos.y);
      
      if (isDragging && key) {
        const cell = this.grid[key];
        if (cell) {
          if (
            (dragMode === "select" && !cell.selected) ||
            (dragMode === "deselect" && cell.selected)
          ) {
            this.toggleGridCell(key);
            this.drawGrid(html);
          }
        }
      }
      
      // Update cursor based on hover
      if (!isDragging && key) {
        const cell = this.grid[key];
        if (cell) {
          this.pixiApp.view.style.cursor = 'pointer';
        } else {
          this.pixiApp.view.style.cursor = 'pointer';
        }
      } else if (!isDragging) {
        this.pixiApp.view.style.cursor = 'pointer';
      }
    });

    // Handle pointer up (mouse/touch end)
    this.gridGraphics.on('pointerup', () => {
      console.log('Size Matters: POINTER UP - event received');
      isDragging = false;
      dragMode = null;
    });

    // Handle pointer up outside (mouse/touch end outside canvas)
    this.gridGraphics.on('pointerupoutside', () => {
      console.log('Size Matters: POINTER UP OUTSIDE - event received');
      isDragging = false;
      dragMode = null;
      this.pixiApp.view.style.cursor = 'pointer';
    });

    // Handle pointer leave
    this.gridGraphics.on('pointerout', () => {
      if (!isDragging) {
        this.pixiApp.view.style.cursor = 'pointer';
      }
    });

    console.log('Size Matters: INTERACTION SETUP COMPLETE - interactive:', this.gridGraphics.interactive, 'zIndex:', this.gridGraphics.zIndex, 'eventMode:', this.gridGraphics.eventMode);
  }

  getGridCellFromPixelPosition(x, y) {
    // Canvas center coordinates
    const centerX = 350 / 2;
    const centerY = 350 / 2;
    
    // Convert to relative coordinates from center
    const relativeX = x - centerX;
    const relativeY = y - centerY;
    
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
    
    if (isHexGrid) {
      // Use precise hex grid coordinate conversion
      const radius = this.gridManager.getSvgRadius();
      const coords = pixelToAxial(relativeX, relativeY, radius, isPointyTop);
      
      const key = `${coords.q},${coords.r}`;
      return this.grid[key] ? key : null;
    } else {
      // Use precise square grid coordinate conversion
      const size = this.gridManager.getSquareSize();
      const coords = pixelToSquare(relativeX, relativeY, size);
      
      const key = `${coords.x},${coords.y}`;
      return this.grid[key] ? key : null;
    }
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
    html.find('[name="imageVisible"]').prop("checked", this.settings.imageVisible);
    html.find('[name="enableDirectionalHighlight"]').prop("checked", this.settings.enableDirectionalHighlight);
  }

  async openFilePicker(html) {
    const fp = new FilePicker({
      type: "media",
      current: this.settings.imageUrl,
      callback: async (path) => {
        this.settings.imageUrl = path;
        this.settings.imageVisible = true;
        await this.saveSettings();
        await this.redrawGridPreview();
        await this.drawGrid(html);
      },
    });
    fp.render(true);
  }

  toggleGridCell(key) {
    const cell = this.grid[key];
    if (!cell) return;

    cell.selected = !cell.selected;
    this.gridManager.setGrid(this.grid);
    this.settings.grid = this.grid;

    // Auto-save grid changes with immediate feedback
    this.saveSettings().then(() => {
      this.redrawGridPreview();
    });
  }

  updateSettingsFromForm(html) {
    if (!html) return;
    this.settings.color = html.find('[name="color"]').val();
    this.settings.fillColor = html.find('[name="fillColor"]').val();

    // Parse opacity input with validation
    let alpha = parseFloat(html.find('[name="alpha"]').val().replace(',', '.'));
    if (isNaN(alpha) || alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;
    this.settings.alpha = alpha;

    this.settings.enableFill = html.find('[name="enableFill"]').is(":checked");
    this.settings.enableContour = html
      .find('[name="enableContour"]')
      .is(":checked");
    this.settings.imageScale =
      parseFloat(html.find('[name="imageScale"]').val().replace(',', '.')) || 1.0;
    this.settings.imageOffsetX =
      parseInt(html.find('[name="imageOffsetX"]').val()) || 0;
    this.settings.imageOffsetY =
      parseInt(html.find('[name="imageOffsetY"]').val()) || 0;
    this.settings.imageRotation =
      parseInt(html.find('[name="imageRotation"]').val()) || 0;
    this.settings.imageVisible = html
      .find('[name="imageVisible"]')
      .is(":checked");
    this.settings.enableDirectionalHighlight = html
      .find('[name="enableDirectionalHighlight"]')
      .is(":checked");
    this.settings.grid = this.grid;
  }

  async drawGrid(html) {
    this.updateSettingsFromForm(html);
    this.settings.grid = this.grid;
    
    // Draw graphics for token (or clear if no token)
    await drawSizeMattersGraphicsForToken(this.token);

    // Redraw the PIXI preview
    await this.redrawGridPreview();
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

    
    // Clear token graphics first (if desired, but for now, we'll keep the token visible)
    // this.clearTokenGraphics();

    // Reset settings to defaults
    this.settings = foundry.utils.duplicate(DEFAULT_SETTINGS);

    // Reset grid manager and reinitialize
    this.grid = this.gridManager.initializeGrid("medium");
    this.settings.grid = this.grid;

    // Do NOT clear the global texture cache here — it can invalidate Foundry's own textures (tokens, grid)
    // clearTextureCache();

    // Clear global defaults
    await this.clearGlobalDefaults();

    // Clear token-specific settings
    if (this.token) {
      await this.token.document.unsetFlag("size-matters", "settings");
    }

    // Force immediate save of cleared settings
    await this.saveSettings();
    
    // Redraw grid preview with cleared settings
    this.redrawGridPreview();
    
    // Force redraw with cleared settings
    await this.drawGrid(html);

    // Force canvas refresh to ensure graphics are cleared
    if (this.token) {
      await drawSizeMattersGraphicsForToken(this.token);
    }

    ui.notifications.info("All settings cleared and reset to default!");
  }

  /**
   * Configura um sprite para ser completamente não-interativo
   * @param {PIXI.Sprite} sprite - O sprite a ser configurado
   */
  makeNonInteractive(sprite) {
    sprite.interactive = false;
    sprite.interactiveChildren = false;
    sprite.buttonMode = false;
    sprite.hitArea = null; // Remove hit area completamente
    // Força o sprite a não capturar eventos de ponteiro
    sprite.eventMode = 'none';
  }

  async close(options = {}) {
    // Destroy PIXI application
    if (this.pixiApp) {
      this.pixiApp.destroy(true);
      this.pixiApp = null;
      this.gridGraphics = null;
    }

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