import { CONSTANTS } from './constants.js';
import { 
  validateToken, 
  validateGridType,
  isHexGrid,
  isPointyTop,
  axialToPixel,
  squareToPixel,
  initializeHexGrid,
  initializeSquareGrid
} from './utils.js';
import { drawSizeMattersGraphicsForToken, clearTokenSizeMattersGraphics } from './graphics.js';

export class SizeMattersApp extends Application {
  constructor(token, options = {}) {
    super(options);
    
    if (!validateToken(token)) {
      throw new Error("Invalid token provided to SizeMattersApp");
    }
    
    this.token = token;
    this.tokenId = token.id;
    this.initializeGrid();
    this.loadSettings();
    this.loadPresets();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "size-matters",
      title: "Size Matters",
      template: "modules/size-matters/templates/size-matters-dialog.html",
      width: 600,
      height: "auto",
      resizable: false,
      closeOnSubmit: false
    });
  }

  initializeGrid() {
    if (!validateGridType()) {
      throw new Error("Unsupported grid type");
    }

    this.grid = isHexGrid() ? initializeHexGrid() : initializeSquareGrid();
  }

  loadSettings() {
    try {
      // Load settings from token flags instead of global module settings
      const tokenSettings = this.token.document.getFlag('size-matters', 'settings') || {};
      
      this.settings = foundry.utils.mergeObject({
        ...CONSTANTS.DEFAULT_SETTINGS,
        grid: this.grid
      }, tokenSettings);
      
      if (tokenSettings.grid) {
        this.grid = foundry.utils.mergeObject(this.grid, tokenSettings.grid);
      }
    } catch (error) {
      console.error("Size Matters: Error loading settings", error);
      // Use default settings if loading fails
      this.settings = {
        ...CONSTANTS.DEFAULT_SETTINGS,
        grid: this.grid
      };
    }
  }

  loadPresets() {
    try {
      this.presets = game.settings.get('size-matters', CONSTANTS.PRESETS_SETTING_KEY) || {};
    } catch (error) {
      console.error("Size Matters: Error loading presets", error);
      this.presets = {};
    }
  }

  async saveSettings() {
    try {
      if (!validateToken(this.token)) {
        console.warn("Size Matters: Cannot save settings, token is invalid");
        return;
      }
      
      // Save settings to token flags
      await this.token.document.setFlag('size-matters', 'settings', foundry.utils.duplicate(this.settings));
    } catch (error) {
      console.error("Size Matters: Error saving settings", error);
      ui.notifications?.error("Failed to save settings");
    }
  }

  async savePreset(name) {
    try {
      if (!name || name.trim() === '') {
        ui.notifications?.warn("Please enter a preset name");
        return;
      }

      // Create a clean copy of current settings without the grid
      const presetData = foundry.utils.duplicate(this.settings);
      delete presetData.grid; // Don't save grid selection in presets

      this.presets[name] = presetData;
      await game.settings.set('size-matters', CONSTANTS.PRESETS_SETTING_KEY, this.presets);
      
      ui.notifications?.info(`Preset "${name}" saved successfully!`);
      this.render(true); // Refresh the dialog to show new preset
    } catch (error) {
      console.error("Size Matters: Error saving preset", error);
      ui.notifications?.error("Failed to save preset");
    }
  }

  async loadPreset(name) {
    try {
      if (!this.presets[name]) {
        ui.notifications?.warn("Preset not found");
        return;
      }

      const presetData = this.presets[name];
      
      // Apply preset settings but keep current grid selection
      const currentGrid = this.grid;
      this.settings = foundry.utils.mergeObject(this.settings, presetData);
      this.settings.grid = currentGrid;

      await this.saveSettings();
      await this.drawGrid();
      this.render(true); // Refresh the dialog to show updated values
      
      ui.notifications?.info(`Preset "${name}" loaded successfully!`);
    } catch (error) {
      console.error("Size Matters: Error loading preset", error);
      ui.notifications?.error("Failed to load preset");
    }
  }

  async deletePreset(name) {
    try {
      if (!this.presets[name]) {
        ui.notifications?.warn("Preset not found");
        return;
      }

      delete this.presets[name];
      await game.settings.set('size-matters', CONSTANTS.PRESETS_SETTING_KEY, this.presets);
      
      ui.notifications?.info(`Preset "${name}" deleted successfully!`);
      this.render(true); // Refresh the dialog to remove deleted preset
    } catch (error) {
      console.error("Size Matters: Error deleting preset", error);
      ui.notifications?.error("Failed to delete preset");
    }
  }

  getData() {
    const isHex = isHexGrid();
    const isPointy = isPointyTop();
    
    return {
      gridType: isHex ? (isPointy ? 'Pointy-Top Hex' : 'Flat-Top Hex') : 'Square Grid',
      gridSize: canvas.grid.size,
      gridSVG: this.createGridSVG(isHex, isPointy),
      isPointyTop: isPointy,
      isHexGrid: isHex,
      presets: this.presets,
      presetNames: Object.keys(this.presets),
      ...this.settings
    };
  }

  createGridSVG(isHex, isPointy) {
    const svgSize = CONSTANTS.SVG_SIZE;
    return isHex ? this.createHexSVG(isPointy, svgSize) : this.createSquareSVG(svgSize);
  }

  createHexSVG(isPointy, svgSize = CONSTANTS.SVG_SIZE) {
    const svgRadius = CONSTANTS.SVG_RADIUS;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    Object.entries(this.grid).forEach(([key, h]) => {
      const pos = axialToPixel(h.q, h.r, svgRadius, isPointy);
      const cx = svgSize / 2 + pos.x;
      const cy = svgSize / 2 + pos.y;
      let pts = [];
      
      for (let i = 0; i < 6; i++) {
        const angle = isPointy ? (i * Math.PI / 3) - Math.PI / 2 : i * Math.PI / 3;
        const x = cx + svgRadius * Math.cos(angle);
        const y = cy + svgRadius * Math.sin(angle);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      
      const fill = h.isCenter ? '#4CAF50' : h.selected ? '#2196F3' : '#fff';
      const stroke = h.isCenter ? '#2E7D32' : '#666';
      const cssClass = h.isCenter ? 'grid-center' : 'grid-selectable';
      
      svg += `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" 
              stroke-width="${h.isCenter ? 2 : 1}" data-grid="${key}" 
              class="${cssClass}" />`;
    });
    
    svg += `</svg>`;
    return svg;
  }

  createSquareSVG(svgSize = CONSTANTS.SVG_SIZE) {
    const squareSize = CONSTANTS.SQUARE_SIZE;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    Object.entries(this.grid).forEach(([key, square]) => {
      const pos = squareToPixel(square.q, square.r, squareSize);
      const cx = svgSize / 2 + pos.x - squareSize / 2;
      const cy = svgSize / 2 + pos.y - squareSize / 2;
      
      const fill = square.isCenter ? '#4CAF50' : square.selected ? '#2196F3' : '#fff';
      const stroke = square.isCenter ? '#2E7D32' : '#666';
      const cssClass = square.isCenter ? 'grid-center' : 'grid-selectable';
      
      svg += `<rect x="${cx}" y="${cy}" width="${squareSize}" height="${squareSize}" 
              fill="${fill}" stroke="${stroke}" 
              stroke-width="${square.isCenter ? 2 : 1}" data-grid="${key}" 
              class="${cssClass}" />`;
    });
    
    svg += `</svg>`;
    return svg;
  }

  activateListeners(html) {
    super.activateListeners(html);

    try {
      // CRITICAL: Draw initial graphics when dialog opens
      this.drawGrid();

      // Grid cell selection with immediate update
      html.find('polygon[data-grid], rect[data-grid]').click((event) => {
        const key = event.currentTarget.getAttribute('data-grid');
        this.toggleGridCell(key, event.currentTarget);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      // Real-time updates for all sliders
      html.find('input[name="thickness"]').on('input', (event) => {
        html.find('#tval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      html.find('input[name="alpha"]').on('input', (event) => {
        html.find('#aval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      html.find('input[name="imageScale"]').on('input', (event) => {
        html.find('#sval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      html.find('input[name="imageOffsetX"]').on('input', (event) => {
        html.find('#xval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      html.find('input[name="imageOffsetY"]').on('input', (event) => {
        html.find('#yval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      // Color changes with immediate update
      html.find('input[name="color"]').on('change', (event) => {
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      html.find('input[name="fillColor"]').on('change', (event) => {
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      // Checkbox changes with immediate update
      html.find('input[name="enableFill"]').on('change', (event) => {
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      html.find('input[name="enableContour"]').on('change', (event) => {
        this.updateSettingsFromForm(html);
        this.drawGrid(); // IMMEDIATE UPDATE
      });

      // Preset management
      html.find('.save-preset-button').click(() => {
        const name = html.find('[name="presetName"]').val();
        this.savePreset(name);
      });

      html.find('.load-preset-button').click(() => {
        const name = html.find('[name="presetSelect"]').val();
        this.loadPreset(name);
      });

      html.find('.delete-preset-button').click(() => {
        const name = html.find('[name="presetSelect"]').val();
        if (name) {
          Dialog.confirm({
            title: "Delete Preset",
            content: `<p>Are you sure you want to delete the preset "${name}"?</p>`,
            yes: () => this.deletePreset(name),
            no: () => {},
            defaultYes: false
          });
        }
      });

      // Button actions
      html.find('.file-picker-button').click(() => this.openFilePicker(html));
      html.find('.draw-button').click(() => this.drawGrid());
      html.find('.clear-button').click(() => this.clearAll(html));
      html.find('.toggle-image-button').click(() => this.toggleImageVisibility());
      html.find('.toggle-grid-button').click(() => this.toggleGridVisibility());

    } catch (error) {
      console.error("Size Matters: Error activating listeners", error);
    }
  }

  async openFilePicker(html) {
    try {
      const fp = new FilePicker({
        type: "image",
        current: this.settings.imageUrl,
        callback: (path) => {
          this.settings.imageUrl = path;
          this.settings.imageVisible = true;
          this.saveSettings();
          this.drawGrid(); // IMMEDIATE UPDATE
        }
      });
      fp.render(true);
    } catch (error) {
      console.error("Size Matters: Error opening file picker", error);
      ui.notifications?.error("Failed to open file picker");
    }
  }

  toggleGridCell(key, element) {
    try {
      const cell = this.grid[key];
      if (!cell || cell.isCenter) return;
      
      cell.selected = !cell.selected;
      element.setAttribute("fill", cell.selected ? "#2196F3" : "#ffffff");
      element.classList.toggle('grid-selected', cell.selected);
      element.classList.toggle('grid-unselected', !cell.selected);
      
      this.settings.grid = this.grid;
      this.saveSettings();
    } catch (error) {
      console.error("Size Matters: Error toggling grid cell", error);
    }
  }

  updateSettingsFromForm(html) {
    if (!html) return;
    
    try {
      this.settings.color = html.find('[name="color"]').val();
      this.settings.fillColor = html.find('[name="fillColor"]').val();
      this.settings.thickness = parseInt(html.find('[name="thickness"]').val());
      this.settings.alpha = parseFloat(html.find('[name="alpha"]').val());
      this.settings.enableFill = html.find('[name="enableFill"]').is(':checked');
      this.settings.enableContour = html.find('[name="enableContour"]').is(':checked');
      this.settings.imageScale = parseFloat(html.find('[name="imageScale"]').val()) || 1.0;
      this.settings.imageOffsetX = parseInt(html.find('[name="imageOffsetX"]').val()) || 0;
      this.settings.imageOffsetY = parseInt(html.find('[name="imageOffsetY"]').val()) || 0;
      this.settings.grid = this.grid;
    } catch (error) {
      console.error("Size Matters: Error updating settings from form", error);
    }
  }

  async drawGrid() {
    try {
      const selectedCells = Object.values(this.grid).filter(h => h.selected);
      if (!selectedCells.length) {
        // Clear graphics if no cells selected
        clearTokenSizeMattersGraphics(this.token);
        return;
      }

      // Update settings and save to token flags
      this.settings.grid = this.grid;
      await this.saveSettings();

      // Draw graphics immediately
      await drawSizeMattersGraphicsForToken(this.token);

      // Store references for easy access
      this._gridGraphics = this.token.sizeMattersGrid;
      this._imageSprite = this.token.sizeMattersImage;
      this._gridTicker = this.token.sizeMattersGridTicker;
    } catch (error) {
      console.error("Size Matters: Error drawing grid", error);
      ui.notifications?.error("Failed to draw grid");
    }
  }

  toggleImageVisibility() {
    try {
      const currentToken = canvas.tokens.get(this.tokenId);
      if (currentToken?.sizeMattersImage) {
        currentToken.sizeMattersImage.visible = !currentToken.sizeMattersImage.visible;
        this.settings.imageVisible = currentToken.sizeMattersImage.visible;
        this.saveSettings();
      } else {
        ui.notifications?.warn("No image has been loaded!");
      }
    } catch (error) {
      console.error("Size Matters: Error toggling image visibility", error);
    }
  }

  toggleGridVisibility() {
    try {
      const currentToken = canvas.tokens.get(this.tokenId);
      if (currentToken?.sizeMattersGrid) {
        currentToken.sizeMattersGrid.visible = !currentToken.sizeMattersGrid.visible;
        this.settings.gridVisible = currentToken.sizeMattersGrid.visible;
        this.saveSettings();
      } else {
        ui.notifications?.warn("No grid has been drawn!");
      }
    } catch (error) {
      console.error("Size Matters: Error toggling grid visibility", error);
    }
  }

  clearTokenGraphics() {
    try {
      const currentToken = canvas.tokens.get(this.tokenId);
      clearTokenSizeMattersGraphics(currentToken);

      // Clear references
      this._gridGraphics = null;
      this._imageSprite = null;
      this._gridTicker = null;
    } catch (error) {
      console.error("Size Matters: Error clearing token graphics", error);
    }
  }

  clearGraphics() {
    // This method now only clears references, doesn't remove from canvas
    this._gridGraphics = null;
    this._imageSprite = null;
    this._gridTicker = null;
  }

  async clearAll(html) {
    try {
      // Clear graphics from canvas
      this.clearTokenGraphics();
      
      this.initializeGrid();
      
      this.settings = {
        ...CONSTANTS.DEFAULT_SETTINGS,
        grid: this.grid
      };

      // Remove settings from token flags
      await this.token.document.unsetFlag('size-matters', 'settings');

      if (html) {
        html.find('[name="color"]').val("#ff0000");
        html.find('[name="fillColor"]').val("#ff0000");
        html.find('[name="thickness"]').val(4);
        html.find('#tval').text(4);
        html.find('[name="alpha"]').val(0.7);
        html.find('#aval').text(0.7);
        html.find('[name="enableFill"]').prop('checked', true);
        html.find('[name="enableContour"]').prop('checked', true);
        html.find('[name="imageScale"]').val(1.0);
        html.find('#sval').text(1.0);
        html.find('[name="imageOffsetX"]').val(0);
        html.find('#xval').text(0);
        html.find('[name="imageOffsetY"]').val(0);
        html.find('#yval').text(0);

        const isHex = isHexGrid();
        const isPointy = isPointyTop();
        
        const newSVG = this.createGridSVG(isHex, isPointy);
        html.find('.grid-svg-container').html(newSVG);
        
        html.find('polygon[data-grid], rect[data-grid]').click((event) => {
          const key = event.currentTarget.getAttribute('data-grid');
          this.toggleGridCell(key, event.currentTarget);
          this.drawGrid();
        });
      }

      ui.notifications?.info("All settings cleared and reset to default!");
    } catch (error) {
      console.error("Size Matters: Error clearing all settings", error);
      ui.notifications?.error("Failed to clear settings");
    }
  }

  async close(options = {}) {
    try {
      // Only clear references, don't remove graphics from canvas
      this.clearGraphics();
      await this.saveSettings();
      return super.close(options);
    } catch (error) {
      console.error("Size Matters: Error closing dialog", error);
      return super.close(options);
    }
  }
}