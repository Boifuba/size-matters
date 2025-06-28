// Constants for better maintainability
const CONSTANTS = {
  HEX_GRID_SIZE: 7,
  SQUARE_GRID_SIZE: 5,
  SVG_SIZE: 500,
  SVG_RADIUS: 22,
  SQUARE_SIZE: 35,
  TICKER_CLEANUP_DELAY: 100,
  CANVAS_READY_DELAY: 500
};

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

// Enhanced validation functions
function validateToken(token) {
  try {
    return token && 
           token.document && 
           canvas?.tokens?.placeables?.includes(token) &&
           !token._destroyed;
  } catch (error) {
    console.warn("Size Matters: Token validation failed", error);
    return false;
  }
}

function validateCanvas() {
  return canvas && 
         canvas.tokens && 
         canvas.grid && 
         canvas.app?.ticker;
}

function validateGridType() {
  if (!validateCanvas()) return false;
  
  const gridType = canvas.grid.type;
  const supportedTypes = [
    CONST.GRID_TYPES.HEXODDR, 
    CONST.GRID_TYPES.HEXEVENR,
    CONST.GRID_TYPES.HEXODDQ, 
    CONST.GRID_TYPES.HEXEVENQ,
    CONST.GRID_TYPES.SQUARE
  ];
  
  return supportedTypes.includes(gridType);
}

// Enhanced ticker management
function removeTokenTicker(token) {
  if (!token || !token.sizeMattersGridTicker) return;
  
  try {
    if (canvas?.app?.ticker) {
      canvas.app.ticker.remove(token.sizeMattersGridTicker);
    }
    token.sizeMattersGridTicker = null;
  } catch (error) {
    console.warn("Size Matters: Error removing ticker", error);
  }
}

function addTokenTicker(token, tickerFunction) {
  if (!validateToken(token) || !validateCanvas()) return;
  
  // Remove existing ticker first
  removeTokenTicker(token);
  
  // Add new ticker
  token.sizeMattersGridTicker = tickerFunction;
  canvas.app.ticker.add(token.sizeMattersGridTicker);
}

// Global function to draw Size Matters graphics for a token
async function drawSizeMattersGraphicsForToken(token) {
  if (!validateToken(token)) {
    console.warn("Size Matters: Invalid token provided");
    return;
  }
  
  if (!validateGridType()) {
    console.warn("Size Matters: Unsupported grid type");
    return;
  }

  try {
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
      try {
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
      } catch (error) {
        console.warn("Size Matters: Error drawing cell", cell, error);
      }
    });

    token.sizeMattersGrid.visible = settings.gridVisible !== false;
    canvas.tokens.addChildAt(token.sizeMattersGrid, 0);

    // Handle image sprite with better error handling
    if (settings.imageUrl && settings.imageUrl.trim() && settings.imageVisible !== false) {
      try {
        const texture = await PIXI.Texture.fromURL(settings.imageUrl);
        token.sizeMattersImage = new PIXI.Sprite(texture);
        token.sizeMattersImage.anchor.set(0.5, 0.5);
        token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
        token.sizeMattersImage.visible = settings.imageVisible !== false;
        canvas.tokens.addChildAt(token.sizeMattersImage, 1);
      } catch (error) {
        console.warn("Size Matters: Failed to load image for token", token.id, error);
        ui.notifications?.warn(`Failed to load image: ${settings.imageUrl}`);
      }
    }

    // Create optimized ticker with position change detection
    let lastPosition = { x: token.center.x, y: token.center.y };
    let lastRotation = token.document.rotation || 0;

    const tickerFunction = () => {
      // Enhanced validation to prevent errors during scene changes
      if (!validateToken(token)) {
        removeTokenTicker(token);
        return;
      }
      
      try {
        const currentX = token.center.x;
        const currentY = token.center.y;
        const currentRotation = token.document.rotation || 0;
        
        // Only update if position or rotation changed (performance optimization)
        if (lastPosition.x !== currentX || 
            lastPosition.y !== currentY || 
            lastRotation !== currentRotation) {
          
          const rotation = Math.toRadians(currentRotation);
          
          if (token.sizeMattersGrid && token.sizeMattersGrid.parent) {
            token.sizeMattersGrid.position.set(currentX, currentY);
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
            
            token.sizeMattersImage.position.set(currentX + offsetX, currentY + offsetY);
            token.sizeMattersImage.rotation = rotation;
            token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
          }
          
          // Update last known position
          lastPosition = { x: currentX, y: currentY };
          lastRotation = currentRotation;
        }
      } catch (error) {
        console.warn("Size Matters: Error in ticker, removing ticker", error);
        removeTokenTicker(token);
      }
    };

    addTokenTicker(token, tickerFunction);

  } catch (error) {
    console.error("Size Matters: Critical error in drawSizeMattersGraphicsForToken", error);
    clearTokenSizeMattersGraphics(token);
  }
}

// Global function to clear Size Matters graphics from a token
function clearTokenSizeMattersGraphics(token) {
  if (!token) return;

  try {
    // Remove ticker first
    removeTokenTicker(token);

    // Clean up graphics
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
  } catch (error) {
    console.warn("Size Matters: Error clearing token graphics", error);
  }
}

// Global function to clear all Size Matters graphics from all tokens
function clearAllSizeMattersGraphics() {
  console.log("Size Matters: Clearing all graphics and tickers");
  
  if (!validateCanvas()) return;
  
  try {
    // Clear from all tokens in the current scene
    for (const token of canvas.tokens.placeables) {
      clearTokenSizeMattersGraphics(token);
    }
    
    // Clean up any orphaned tickers
    if (canvas.app?.ticker?._head) {
      const tickerFunctions = [];
      let current = canvas.app.ticker._head;
      
      while (current) {
        if (current.fn && (
          current.fn.name === 'sizeMattersGridTicker' ||
          current.fn.toString().includes('sizeMattersGrid')
        )) {
          tickerFunctions.push(current.fn);
        }
        current = current.next;
      }
      
      tickerFunctions.forEach(fn => {
        try {
          canvas.app.ticker.remove(fn);
        } catch (error) {
          console.warn("Size Matters: Error removing orphaned ticker", error);
        }
      });
    }
  } catch (error) {
    console.error("Size Matters: Error in clearAllSizeMattersGraphics", error);
  }
}

class SizeMattersApp extends Application {
  constructor(token, options = {}) {
    super(options);
    
    if (!validateToken(token)) {
      throw new Error("Invalid token provided to SizeMattersApp");
    }
    
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
    const gridSize = CONSTANTS.HEX_GRID_SIZE;
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
    const gridSize = CONSTANTS.SQUARE_GRID_SIZE;
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
    try {
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
    } catch (error) {
      console.error("Size Matters: Error loading settings", error);
      // Use default settings if loading fails
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
    }
  }

  async saveSettings() {
    try {
      if (!validateToken(this.token)) {
        console.warn("Size Matters: Cannot save settings, token is invalid");
        return;
      }
      
      // Save settings to token flags instead of global module settings
      await this.token.document.setFlag('size-matters', 'settings', foundry.utils.duplicate(this.settings));
    } catch (error) {
      console.error("Size Matters: Error saving settings", error);
      ui.notifications?.error("Failed to save settings");
    }
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
    const svgSize = CONSTANTS.SVG_SIZE;
    return isHexGrid ? this.createHexSVG(isPointyTop, svgSize) : this.createSquareSVG(svgSize);
  }

  createHexSVG(isPointyTop, svgSize = CONSTANTS.SVG_SIZE) {
    const svgRadius = CONSTANTS.SVG_RADIUS;
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
        this.updateImageScale();
      });

      html.find('input[name="imageOffsetX"]').on('input', (event) => {
        html.find('#xval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.updateImagePosition();
      });

      html.find('input[name="imageOffsetY"]').on('input', (event) => {
        html.find('#yval').text(event.target.value);
        this.updateSettingsFromForm(html);
        this.updateImagePosition();
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

      html.find('.file-picker-button').click(() => this.openFilePicker(html));
      html.find('.draw-button').click(() => this.drawGrid(html));
      html.find('.clear-button').click(() => this.clearAll(html));
      html.find('.toggle-image-button').click(() => this.toggleImageVisibility());
      html.find('.toggle-grid-button').click(() => this.toggleGridVisibility());

      html.find('input:not(.clear-button)').on('change', () => {
        this.updateSettingsFromForm(html);
        this.saveSettings();
      });
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
          this.drawGrid(html);
        }
      });
      fp.render(true);
    } catch (error) {
      console.error("Size Matters: Error opening file picker", error);
      ui.notifications?.error("Failed to open file picker");
    }
  }

  updateImageScale() {
    if (this._imageSprite) {
      this.updateSettingsFromForm();
    }
  }

  updateImagePosition() {
    if (this._imageSprite) {
      this.updateSettingsFromForm();
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

  async drawGrid(html) {
    try {
      this.updateSettingsFromForm(html);
      
      const selectedCells = Object.values(this.grid).filter(h => h.selected);
      if (!selectedCells.length) {
        ui.notifications?.warn("Select at least one cell!");
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

        const gridType = canvas.grid.type;
        const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                           CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
        const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
        
        const newSVG = this.createGridSVG(isHexGrid, isPointyTop);
        html.find('.grid-svg-container').html(newSVG);
        
        html.find('polygon[data-grid], rect[data-grid]').click((event) => {
          const key = event.currentTarget.getAttribute('data-grid');
          this.toggleGridCell(key, event.currentTarget);
          this.drawGrid(html);
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

// Define openSizeMatters function immediately when script loads
window.openSizeMatters = function() {
  try {
    // Check if Foundry VTT is ready
    if (!validateCanvas()) {
      console.warn("Size Matters: Foundry VTT not ready yet. Please try again in a moment.");
      ui.notifications?.warn("Foundry VTT not ready yet. Please try again in a moment.");
      return;
    }

    if (!canvas.tokens.controlled.length) {
      ui.notifications?.warn("Select a token first.");
      return;
    }

    const token = canvas.tokens.controlled[0];
    
    if (!validateToken(token)) {
      ui.notifications?.warn("Selected token is invalid.");
      return;
    }
    
    if (!validateGridType()) {
      ui.notifications?.warn("This module works with hexagonal and square grids only!");
      return;
    }

    const app = new SizeMattersApp(token);
    app.render(true);
  } catch (error) {
    console.error("Size Matters: Error opening Size Matters", error);
    ui.notifications?.error("Failed to open Size Matters. Check console for details.");
  }
};

Hooks.once('ready', () => {
  console.log("Size Matters: Module ready and openSizeMatters function available globally");
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
    
    if (!validateCanvas()) return;
    
    try {
      // Check all tokens on the canvas for saved Size Matters settings
      for (const token of canvas.tokens.placeables) {
        if (!validateToken(token)) continue;
        
        const settings = token.document.getFlag('size-matters', 'settings');
        if (settings && settings.grid) {
          console.log(`Size Matters: Restoring graphics for token ${token.id}`);
          await drawSizeMattersGraphicsForToken(token);
        }
      }
    } catch (error) {
      console.error("Size Matters: Error in canvasReady hook", error);
    }
  }, CONSTANTS.CANVAS_READY_DELAY);
});

// Additional hook for when individual tokens are rendered
Hooks.on('renderToken', async (token) => {
  // Small delay to ensure token is fully rendered
  setTimeout(async () => {
    try {
      if (!validateToken(token)) return;
      
      const settings = token.document.getFlag('size-matters', 'settings');
      if (settings && settings.grid && !token.sizeMattersGrid) {
        console.log(`Size Matters: Restoring graphics for rendered token ${token.id}`);
        await drawSizeMattersGraphicsForToken(token);
      }
    } catch (error) {
      console.warn("Size Matters: Error in renderToken hook", error);
    }
  }, CONSTANTS.TICKER_CLEANUP_DELAY);
});

// Hook to clean up graphics when tokens are deleted
Hooks.on('deleteToken', (token) => {
  try {
    clearTokenSizeMattersGraphics(token);
  } catch (error) {
    console.warn("Size Matters: Error in deleteToken hook", error);
  }
});

// Hook to clear graphics when scene changes
Hooks.on('updateScene', (scene, changes) => {
  try {
    if (changes.active === true) {
      console.log("Size Matters: Scene changing, clearing all graphics from previous scene");
      clearAllSizeMattersGraphics();
    }
  } catch (error) {
    console.warn("Size Matters: Error in updateScene hook", error);
  }
});

export { SizeMattersApp };