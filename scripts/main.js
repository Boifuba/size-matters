// Utility functions moved outside the class for global access
function axialToPixel(q, r, radius, pointy) {
  return pointy
    ? { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r }
    : { x: radius * 1.5 * q, y: radius * Math.sqrt(3) * (r + q / 2) };
}

function squareToPixel(x, y, size) {
  return { x: x * size, y: y * size };
}

function drawHex(g, cx, cy, r, pointy) {
  const startAngle = pointy ? -Math.PI / 2 : 0;
  g.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
  for (let i = 1; i <= 6; i++) {
    const angle = startAngle + i * Math.PI / 3;
    g.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
}

function drawSquare(g, x, y, size) {
  g.drawRect(x, y, size, size);
}

// Global function to draw Size Matters graphics for a token
async function drawSizeMattersGraphicsForToken(token) {
  if (!token || !token.document) return;
  
  const settings = token.document.getFlag('size-matters', 'settings');
  if (!settings || !settings.grid) return;

  const selectedCells = Object.values(settings.grid).filter(h => h.selected);
  if (!selectedCells.length) return;

  // Clear existing graphics for this token
  clearTokenSizeMattersGraphics(token);

  const gridType = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                     CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
  const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
  const size = canvas.grid.size;

  const color = parseInt(settings.color.replace('#', '0x'));
  const fillColor = parseInt(settings.fillColor.replace('#', '0x'));

  // Create new graphics and attach to token
  token.sizeMattersGrid = new PIXI.Graphics();
  token.sizeMattersGrid.interactive = false;
  token.sizeMattersGrid.interactiveChildren = false;
  
  if (settings.enableContour) {
    token.sizeMattersGrid.lineStyle(settings.thickness, color, settings.alpha);
  }

  selectedCells.forEach(cell => {
    if (isHexGrid) {
      const hexRadius = size / Math.sqrt(3);
      const offset = axialToPixel(cell.q, cell.r, hexRadius, isPointyTop);
      if (settings.enableFill) {
        token.sizeMattersGrid.beginFill(fillColor, settings.alpha);
      }
      drawHex(token.sizeMattersGrid, offset.x, offset.y, hexRadius, isPointyTop);
      if (settings.enableFill) {
        token.sizeMattersGrid.endFill();
      }
    } else {
      const offset = squareToPixel(cell.q, cell.r, size);
      if (settings.enableFill) {
        token.sizeMattersGrid.beginFill(fillColor, settings.alpha);
      }
      drawSquare(token.sizeMattersGrid, offset.x - size/2, offset.y - size/2, size);
      if (settings.enableFill) {
        token.sizeMattersGrid.endFill();
      }
    }
  });

  token.sizeMattersGrid.visible = settings.gridVisible !== false;
  canvas.tokens.addChildAt(token.sizeMattersGrid, 0);

  // Handle image sprite - ALWAYS create if imageUrl exists, just control visibility
  if (settings.imageUrl && settings.imageUrl.trim()) {
    try {
      const texture = await PIXI.Texture.fromURL(settings.imageUrl);
      token.sizeMattersImage = new PIXI.Sprite(texture);
      token.sizeMattersImage.anchor.set(0.5, 0.5);
      token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
      // CRITICAL: Set visibility based on imageVisible setting
      token.sizeMattersImage.visible = settings.imageVisible !== false;
      canvas.tokens.addChildAt(token.sizeMattersImage, 1);
    } catch (error) {
      console.warn("Size Matters: Failed to load image for token", token.id, error);
    }
  }

  // Remove existing ticker if any
  if (token.sizeMattersGridTicker) {
    canvas.app.ticker.remove(token.sizeMattersGridTicker);
  }

  // Create new ticker for position updates
  token.sizeMattersGridTicker = () => {
    // Enhanced validation to prevent errors during scene changes
    if (!token || !token.document || !token.center || !canvas || !canvas.tokens) {
      // Token is invalid, remove the ticker
      if (token && token.sizeMattersGridTicker) {
        canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
        token.sizeMattersGridTicker = null;
      }
      return;
    }
    
    // Additional check to ensure token still exists in the canvas
    if (!canvas.tokens.placeables.includes(token)) {
      if (token.sizeMattersGridTicker) {
        canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
        token.sizeMattersGridTicker = null;
      }
      return;
    }
    
    try {
      const centerX = token.center.x;
      const centerY = token.center.y;
      const rotation = Math.toRadians(token.document.rotation || 0);
      
      if (token.sizeMattersGrid && token.sizeMattersGrid.parent) {
        token.sizeMattersGrid.position.set(centerX, centerY);
        token.sizeMattersGrid.rotation = rotation;
      }
      
      if (token.sizeMattersImage && token.sizeMattersImage.parent) {
        let offsetX = settings.imageOffsetX || 0;
        let offsetY = settings.imageOffsetY || 0;
        
        if (rotation !== 0) {
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          const rotatedX = offsetX * cos - offsetY * sin;
          const rotatedY = offsetX * sin + offsetY * cos;
          offsetX = rotatedX;
          offsetY = rotatedY;
        }
        
        token.sizeMattersImage.position.set(centerX + offsetX, centerY + offsetY);
        token.sizeMattersImage.rotation = rotation;
        token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
      }
    } catch (error) {
      console.warn("Size Matters: Error in ticker, removing ticker", error);
      if (token.sizeMattersGridTicker) {
        canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
        token.sizeMattersGridTicker = null;
      }
    }
  };

  canvas.app.ticker.add(token.sizeMattersGridTicker);
}

// Global function to clear Size Matters graphics from a token
function clearTokenSizeMattersGraphics(token) {
  if (!token) return;

  if (token.sizeMattersGrid) {
    if (token.sizeMattersGrid.parent) {
      token.sizeMattersGrid.parent.removeChild(token.sizeMattersGrid);
    }
    token.sizeMattersGrid.destroy();
    token.sizeMattersGrid = null;
  }
  
  if (token.sizeMattersImage) {
    if (token.sizeMattersImage.parent) {
      token.sizeMattersImage.parent.removeChild(token.sizeMattersImage);
    }
    token.sizeMattersImage.destroy();
    token.sizeMattersImage = null;
  }
  
  if (token.sizeMattersGridTicker) {
    if (canvas.app?.ticker) {
      canvas.app.ticker.remove(token.sizeMattersGridTicker);
    }
    token.sizeMattersGridTicker = null;
  }
}

// Global function to clear all Size Matters graphics from all tokens
function clearAllSizeMattersGraphics() {
  console.log("Size Matters: Clearing all graphics and tickers");
  
  if (!canvas || !canvas.tokens) return;
  
  // Clear from all tokens in the current scene
  for (const token of canvas.tokens.placeables) {
    clearTokenSizeMattersGraphics(token);
  }
  
  // Also clear any remaining tickers that might be orphaned
  if (canvas.app?.ticker) {
    // Remove any remaining Size Matters tickers
    const tickerFunctions = canvas.app.ticker._head;
    let current = tickerFunctions;
    const toRemove = [];
    
    while (current) {
      if (current.fn && current.fn.name === 'sizeMattersGridTicker') {
        toRemove.push(current.fn);
      }
      current = current.next;
    }
    
    toRemove.forEach(fn => canvas.app.ticker.remove(fn));
  }
}

class SizeMattersApp extends Application {
  constructor(token, options = {}) {
    super(options);
    this.token = token;
    this.tokenId = token.id;
    this.initializeGrid();
    this.loadSettings();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "size-matters",
      title: "Size Matters",
      template: "modules/size-matters/templates/size-matters-dialog.html",
      width: 420,
      height: "auto",
      resizable: false,
      closeOnSubmit: false
    });
  }

  initializeGrid() {
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    
    if (isHexGrid) {
      this.initializeHexGrid();
    } else {
      this.initializeSquareGrid();
    }
  }

  initializeHexGrid() {
    const gridSize = 7;
    this.grid = {};
    for (let q = -gridSize; q <= gridSize; q++) {
      for (let r = -gridSize; r <= gridSize; r++) {
        if (Math.abs(q + r) <= gridSize) {
          const key = `${q},${r}`;
          this.grid[key] = { 
            q, 
            r, 
            selected: q === 0 && r === 0, 
            isCenter: q === 0 && r === 0 
          };
        }
      }
    }
  }

  initializeSquareGrid() {
    const gridSize = 5;
    this.grid = {};
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let y = -gridSize; y <= gridSize; y++) {
        const key = `${x},${y}`;
        this.grid[key] = { 
          q: x,
          r: y, 
          selected: x === 0 && y === 0, 
          isCenter: x === 0 && y === 0 
        };
      }
    }
  }

  loadSettings() {
    // Load settings from token flags instead of global module settings
    const tokenSettings = this.token.document.getFlag('size-matters', 'settings') || {};
    
    this.settings = foundry.utils.mergeObject({
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 4,
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      grid: this.grid,
      imageVisible: true,
      gridVisible: true
    }, tokenSettings);
    
    if (tokenSettings.grid) {
      this.grid = foundry.utils.mergeObject(this.grid, tokenSettings.grid);
    }
  }

  async saveSettings() {
    // Save settings to token flags instead of global module settings
    await this.token.document.setFlag('size-matters', 'settings', foundry.utils.duplicate(this.settings));
  }

  // Preset management methods
  async getPresets() {
    return game.settings.get('size-matters', 'presets') || {};
  }

  async savePreset(name, settings) {
    const presets = await this.getPresets();
    // FIXED: Now save EVERYTHING including grid selection
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
      imageVisible: settings.imageVisible,
      gridVisible: settings.gridVisible,
      grid: foundry.utils.duplicate(settings.grid) // CRITICAL: Save grid selection too!
    };
    presets[name] = presetData;
    await game.settings.set('size-matters', 'presets', presets);
  }

  async deletePreset(name) {
    const presets = await this.getPresets();
    delete presets[name];
    await game.settings.set('size-matters', 'presets', presets);
  }

  async loadPreset(name) {
    const presets = await this.getPresets();
    const preset = presets[name];
    if (preset) {
      // FIXED: Load everything including grid selection
      this.settings = foundry.utils.mergeObject(this.settings, preset);
      
      // CRITICAL: Update the grid object with the loaded grid selection
      if (preset.grid) {
        this.grid = foundry.utils.duplicate(preset.grid);
        this.settings.grid = this.grid;
      }
      
      await this.saveSettings();
      return true;
    }
    return false;
  }

  getData() {
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    
    return {
      gridType: isHexGrid ? (isPointyTop ? 'Pointy-Top Hex' : 'Flat-Top Hex') : 'Square Grid',
      gridSize: canvas.grid.size,
      gridSVG: this.createGridSVG(isHexGrid, isPointyTop),
      isPointyTop: isPointyTop,
      isHexGrid: isHexGrid,
      ...this.settings
    };
  }

  createGridSVG(isHexGrid, isPointyTop) {
    const svgSize = 300;
    return isHexGrid ? this.createHexSVG(isPointyTop, svgSize) : this.createSquareSVG(svgSize);
  }

  createHexSVG(isPointyTop, svgSize = 300) {
    const svgRadius = 16;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    Object.entries(this.grid).forEach(([key, h]) => {
      const pos = axialToPixel(h.q, h.r, svgRadius, isPointyTop);
      const cx = svgSize / 2 + pos.x;
      const cy = svgSize / 2 + pos.y;
      let pts = [];
      
      for (let i = 0; i < 6; i++) {
        const angle = isPointyTop ? (i * Math.PI / 3) - Math.PI / 2 : i * Math.PI / 3;
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

  createSquareSVG(svgSize = 300) {
    const squareSize = 25;
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

  // CRITICAL: Method to regenerate and update the grid SVG
  updateGridSVG(html) {
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    
    const newSVG = this.createGridSVG(isHexGrid, isPointyTop);
    html.find('.grid-container').html(newSVG);
    
    // Re-attach click handlers to the new SVG elements
    html.find('polygon[data-grid], rect[data-grid]').click((event) => {
      const key = event.currentTarget.getAttribute('data-grid');
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Draw initial graphics when dialog opens
    this.drawGrid(html);

    // Populate presets dropdown
    this.populatePresetsDropdown(html);

    html.find('polygon[data-grid], rect[data-grid]').click((event) => {
      const key = event.currentTarget.getAttribute('data-grid');
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });

    html.find('input[name="thickness"]').on('input', (event) => {
      html.find('#tval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="alpha"]').on('input', (event) => {
      html.find('#aval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="imageScale"]').on('input', (event) => {
      html.find('#sval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="imageOffsetX"]').on('input', (event) => {
      html.find('#xval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="imageOffsetY"]').on('input', (event) => {
      html.find('#yval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="color"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="fillColor"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="enableFill"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    html.find('input[name="enableContour"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });

    // Preset management
    html.find('.save-preset-button').click(() => this.handleSavePreset(html));
    html.find('.load-preset-button').click(() => this.handleLoadPreset(html));
    html.find('.delete-preset-button').click(() => this.handleDeletePreset(html));

    html.find('.file-picker-button').click(() => this.openFilePicker(html));
    html.find('.draw-button').click(() => this.drawGrid(html));
    html.find('.clear-button').click(() => this.clearAll(html));
    html.find('.toggle-image-button').click(() => this.toggleImageVisibility());
    html.find('.toggle-grid-button').click(() => this.toggleGridVisibility());

    html.find('input:not(.clear-button)').on('change', () => {
      this.updateSettingsFromForm(html);
      this.saveSettings();
    });
  }

  async populatePresetsDropdown(html) {
    const presets = await this.getPresets();
    const select = html.find('#preset-select');
    select.empty();
    select.append('<option value="">Select preset...</option>');
    
    Object.keys(presets).forEach(name => {
      select.append(`<option value="${name}">${name}</option>`);
    });
  }

  async handleSavePreset(html) {
    const name = html.find('#preset-name').val().trim();
    if (!name) {
      ui.notifications.warn("Enter a preset name!");
      return;
    }

    this.updateSettingsFromForm(html);
    await this.savePreset(name, this.settings);
    await this.populatePresetsDropdown(html);
    html.find('#preset-name').val('');
    ui.notifications.info(`Preset "${name}" saved!`);
  }

  async handleLoadPreset(html) {
    const name = html.find('#preset-select').val();
    if (!name) {
      ui.notifications.warn("Select a preset to load!");
      return;
    }

    const loaded = await this.loadPreset(name);
    if (loaded) {
      this.updateFormFromSettings(html);
      this.updateGridSVG(html); // CRITICAL: Update the grid visual too!
      this.drawGrid(html);
      ui.notifications.info(`Preset "${name}" loaded!`);
    } else {
      ui.notifications.error("Failed to load preset!");
    }
  }

  async handleDeletePreset(html) {
    const name = html.find('#preset-select').val();
    if (!name) {
      ui.notifications.warn("Select a preset to delete!");
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Delete Preset",
      content: `<p>Are you sure you want to delete the preset "<strong>${name}</strong>"?</p>`,
      yes: () => true,
      no: () => false
    });

    if (confirmed) {
      await this.deletePreset(name);
      await this.populatePresetsDropdown(html);
      ui.notifications.info(`Preset "${name}" deleted!`);
    }
  }

  updateFormFromSettings(html) {
    html.find('[name="color"]').val(this.settings.color);
    html.find('[name="fillColor"]').val(this.settings.fillColor);
    html.find('[name="thickness"]').val(this.settings.thickness);
    html.find('#tval').text(this.settings.thickness);
    html.find('[name="alpha"]').val(this.settings.alpha);
    html.find('#aval').text(this.settings.alpha);
    html.find('[name="enableFill"]').prop('checked', this.settings.enableFill);
    html.find('[name="enableContour"]').prop('checked', this.settings.enableContour);
    html.find('[name="imageScale"]').val(this.settings.imageScale);
    html.find('#sval').text(this.settings.imageScale);
    html.find('[name="imageOffsetX"]').val(this.settings.imageOffsetX);
    html.find('#xval').text(this.settings.imageOffsetX);
    html.find('[name="imageOffsetY"]').val(this.settings.imageOffsetY);
    html.find('#yval').text(this.settings.imageOffsetY);
  }

  async openFilePicker(html) {
    const fp = new FilePicker({
      type: "image",
      current: this.settings.imageUrl,
      callback: (path) => {
        this.settings.imageUrl = path;
        this.settings.imageVisible = true;
        this.saveSettings();
        this.drawGrid(html);
      }
    });
    fp.render(true);
  }

  toggleGridCell(key, element) {
    const cell = this.grid[key];
    if (!cell.isCenter) {
      cell.selected = !cell.selected;
      element.setAttribute("fill", cell.selected ? "#2196F3" : "#ffffff");
      element.classList.toggle('grid-selected', cell.selected);
      element.classList.toggle('grid-unselected', !cell.selected);
      
      this.settings.grid = this.grid;
      this.saveSettings();
    }
  }

  updateSettingsFromForm(html) {
    if (!html) return;
    
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
  }

  async drawGrid(html) {
    this.updateSettingsFromForm(html);
    
    const selectedCells = Object.values(this.grid).filter(h => h.selected);
    if (!selectedCells.length) {
      clearTokenSizeMattersGraphics(this.token);
      return;
    }

    // Update settings and save to token flags
    this.settings.grid = this.grid;
    await this.saveSettings();

    // Use the global function to draw graphics
    await drawSizeMattersGraphicsForToken(this.token);

    // Store references for easy access
    this._gridGraphics = this.token.sizeMattersGrid;
    this._imageSprite = this.token.sizeMattersImage;
    this._gridTicker = this.token.sizeMattersGridTicker;
  }

  // FIXED: Toggle image visibility properly - just show/hide, don't remove
  toggleImageVisibility() {
    const currentToken = canvas.tokens.get(this.tokenId);
    
    // Toggle the imageVisible setting
    this.settings.imageVisible = !this.settings.imageVisible;
    this.saveSettings();
    
    // If we have an image sprite, just toggle its visibility
    if (currentToken && currentToken.sizeMattersImage) {
      currentToken.sizeMattersImage.visible = this.settings.imageVisible;
      ui.notifications.info(`Image ${this.settings.imageVisible ? 'shown' : 'hidden'}`);
    } else if (this.settings.imageUrl && this.settings.imageUrl.trim()) {
      // If we have an imageUrl but no sprite, redraw to create it
      this.drawGrid();
      ui.notifications.info(`Image ${this.settings.imageVisible ? 'shown' : 'hidden'}`);
    } else {
      ui.notifications.warn("No image has been loaded!");
    }
  }

  toggleGridVisibility() {
    const currentToken = canvas.tokens.get(this.tokenId);
    
    // Toggle the gridVisible setting
    this.settings.gridVisible = !this.settings.gridVisible;
    this.saveSettings();
    
    if (currentToken && currentToken.sizeMattersGrid) {
      currentToken.sizeMattersGrid.visible = this.settings.gridVisible;
      ui.notifications.info(`Grid ${this.settings.gridVisible ? 'shown' : 'hidden'}`);
    } else {
      ui.notifications.warn("No grid has been drawn!");
    }
  }

  clearTokenGraphics() {
    const currentToken = canvas.tokens.get(this.tokenId);
    clearTokenSizeMattersGraphics(currentToken);

    // Clear references
    this._gridGraphics = null;
    this._imageSprite = null;
    this._gridTicker = null;
  }

  clearGraphics() {
    // This method now only clears references, doesn't remove from canvas
    this._gridGraphics = null;
    this._imageSprite = null;
    this._gridTicker = null;
  }

  async clearAll(html) {
    // Clear graphics from canvas
    this.clearTokenGraphics();
    
    // CRITICAL: Reset the grid to initial state
    this.initializeGrid();
    
    this.settings = {
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 4,
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      grid: this.grid,
      imageVisible: true,
      gridVisible: true
    };

    // Remove settings from token flags
    await this.token.document.unsetFlag('size-matters', 'settings');

    if (html) {
      // Update form with default values
      this.updateFormFromSettings(html);
      
      // CRITICAL: Regenerate the SVG with the reset grid
      this.updateGridSVG(html);
    }

    ui.notifications.info("All settings cleared and reset to default!");
  }

  async close(options = {}) {
    // Only clear references, don't remove graphics from canvas
    this.clearGraphics();
    await this.saveSettings();
    return super.close(options);
  }
}

// Define openSizeMatters function immediately when script loads
window.openSizeMatters = function() {
  // Check if Foundry VTT is ready
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn("Size Matters: Foundry VTT not ready yet. Please try again in a moment.");
    return;
  }

  if (!canvas.tokens.controlled.length) {
    return ui.notifications.warn("Select a token first.");
  }

  const token = canvas.tokens.controlled[0];
  const gridType = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                     CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
  const isSquareGrid = gridType === CONST.GRID_TYPES.SQUARE;
  
  if (!isHexGrid && !isSquareGrid) {
    return ui.notifications.warn("This module works with hexagonal and square grids only!");
  }

  const app = new SizeMattersApp(token);
  app.render(true);
};

// Register chat command
Hooks.once('ready', () => {
  console.log("Size Matters: Module ready and openSizeMatters function available globally");
  
  // Register game setting for presets
  game.settings.register('size-matters', 'presets', {
    name: 'Size Matters Presets',
    hint: 'Stored presets for Size Matters configurations',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
});

// Chat command handler
Hooks.on('chatMessage', (chatLog, message, chatData) => {
  if (message.trim() === '/size-matters') {
    openSizeMatters();
    return false; // Prevent the message from appearing in chat
  }
});

// Hook to clear all graphics before scene changes
Hooks.on('canvasInit', () => {
  console.log("Size Matters: Canvas initializing, clearing all graphics");
  clearAllSizeMattersGraphics();
});

// Hook to recreate graphics when tokens are rendered (after page reload)
Hooks.on('canvasReady', async () => {
  // Wait a bit for canvas to be fully ready
  setTimeout(async () => {
    console.log("Size Matters: Canvas ready, checking for tokens with saved graphics...");
    
    // Check all tokens on the canvas for saved Size Matters settings
    for (const token of canvas.tokens.placeables) {
      const settings = token.document.getFlag('size-matters', 'settings');
      if (settings && settings.grid) {
        console.log(`Size Matters: Restoring graphics for token ${token.id}`);
        await drawSizeMattersGraphicsForToken(token);
      }
    }
  }, 500);
});

// Additional hook for when individual tokens are rendered
Hooks.on('renderToken', async (token) => {
  // Small delay to ensure token is fully rendered
  setTimeout(async () => {
    const settings = token.document.getFlag('size-matters', 'settings');
    if (settings && settings.grid && !token.sizeMattersGrid) {
      console.log(`Size Matters: Restoring graphics for rendered token ${token.id}`);
      await drawSizeMattersGraphicsForToken(token);
    }
  }, 100);
});

// Hook to clean up graphics when tokens are deleted
Hooks.on('deleteToken', (token) => {
  clearTokenSizeMattersGraphics(token);
});

// Hook to clear graphics when scene changes
Hooks.on('updateScene', (scene, changes) => {
  if (changes.active === true) {
    console.log("Size Matters: Scene changing, clearing all graphics from previous scene");
    clearAllSizeMattersGraphics();
  }
});

// CRITICAL: Hook to synchronize image updates across all users
Hooks.on('updateToken', async (tokenDocument, changes, options, userId) => {
  try {
    // Check if Size Matters settings were updated
    if (changes.flags && changes.flags['size-matters']) {
      console.log(`Size Matters: Token ${tokenDocument.id} settings updated, redrawing graphics for all users`);
      
      // Get the actual token object from the canvas
      const token = canvas.tokens.get(tokenDocument.id);
      if (!token) {
        console.warn(`Size Matters: Could not find token ${tokenDocument.id} on canvas`);
        return;
      }
      
      // Small delay to ensure the flag update is fully processed
      setTimeout(async () => {
        // Clear existing graphics first
        clearTokenSizeMattersGraphics(token);
        
        // Redraw with new settings
        await drawSizeMattersGraphicsForToken(token);
        
        console.log(`Size Matters: Graphics redrawn for token ${tokenDocument.id}`);
      }, 50);
    }
  } catch (error) {
    console.error("Size Matters: Error in updateToken hook", error);
  }
});

export { SizeMattersApp };