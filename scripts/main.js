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
      width: 600,
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
    const gridSize = 5;
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
    const settings = game.modules.get('size-matters')?.settings || {};
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
    }, settings);
    
    if (settings.grid) {
      this.grid = foundry.utils.mergeObject(this.grid, settings.grid);
    }
  }

  saveSettings() {
    if (!game.modules.get('size-matters')) {
      game.modules.set('size-matters', { settings: {} });
    }
    game.modules.get('size-matters').settings = foundry.utils.duplicate(this.settings);
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

  axialToPixel(q, r, radius, pointy) {
    return pointy
      ? { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r }
      : { x: radius * 1.5 * q, y: radius * Math.sqrt(3) * (r + q / 2) };
  }

  squareToPixel(x, y, size) {
    return { x: x * size, y: y * size };
  }

  createGridSVG(isHexGrid, isPointyTop) {
    const svgSize = 500;
    return isHexGrid ? this.createHexSVG(isPointyTop, svgSize) : this.createSquareSVG(svgSize);
  }

  createHexSVG(isPointyTop, svgSize = 500) {
    const svgRadius = 22;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    Object.entries(this.grid).forEach(([key, h]) => {
      const pos = this.axialToPixel(h.q, h.r, svgRadius, isPointyTop);
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

  createSquareSVG(svgSize = 500) {
    const squareSize = 35;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    Object.entries(this.grid).forEach(([key, square]) => {
      const pos = this.squareToPixel(square.q, square.r, squareSize);
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
      return ui.notifications.warn("Select at least one cell!");
    }

    this.clearGraphics();

    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, 
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    const size = canvas.grid.size;

    const color = parseInt(this.settings.color.replace('#', '0x'));
    const fillColor = parseInt(this.settings.fillColor.replace('#', '0x'));

    this._gridGraphics = new PIXI.Graphics();
    this._gridGraphics.interactive = false;
    this._gridGraphics.interactiveChildren = false;
    
    if (this.settings.enableContour) {
      this._gridGraphics.lineStyle(this.settings.thickness, color, this.settings.alpha);
    }

    selectedCells.forEach(cell => {
      if (isHexGrid) {
        const hexRadius = size / Math.sqrt(3);
        const offset = this.axialToPixel(cell.q, cell.r, hexRadius, isPointyTop);
        if (this.settings.enableFill) {
          this._gridGraphics.beginFill(fillColor, this.settings.alpha);
        }
        this.drawHex(this._gridGraphics, offset.x, offset.y, hexRadius, isPointyTop);
        if (this.settings.enableFill) {
          this._gridGraphics.endFill();
        }
      } else {
        const offset = this.squareToPixel(cell.q, cell.r, size);
        if (this.settings.enableFill) {
          this._gridGraphics.beginFill(fillColor, this.settings.alpha);
        }
        this.drawSquare(this._gridGraphics, offset.x - size/2, offset.y - size/2, size);
        if (this.settings.enableFill) {
          this._gridGraphics.endFill();
        }
      }
    });

    this._gridGraphics.visible = this.settings.gridVisible;
    canvas.tokens.addChildAt(this._gridGraphics, 0);

    this._imageSprite = null;
    if (this.settings.imageUrl && this.settings.imageUrl.trim() && this.settings.imageVisible) {
      try {
        const texture = await PIXI.Texture.fromURL(this.settings.imageUrl);
        this._imageSprite = new PIXI.Sprite(texture);
        this._imageSprite.anchor.set(0.5, 0.5);
        this._imageSprite.scale.set(this.settings.imageScale);
        this._imageSprite.visible = this.settings.imageVisible;
        canvas.tokens.addChildAt(this._imageSprite, 1);
      } catch (error) {
        ui.notifications.warn("Failed to load image. Please check the path.");
      }
    }

    this._gridTicker = () => {
      const currentToken = canvas.tokens.get(this.tokenId);
      if (!currentToken || !currentToken.document) return;
      
      const centerX = currentToken.center.x;
      const centerY = currentToken.center.y;
      const rotation = Math.toRadians(currentToken.document.rotation || 0);
      
      if (this._gridGraphics) {
        this._gridGraphics.position.set(centerX, centerY);
        this._gridGraphics.rotation = rotation;
      }
      
      if (this._imageSprite) {
        let offsetX = this.settings.imageOffsetX;
        let offsetY = this.settings.imageOffsetY;
        
        if (rotation !== 0) {
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          const rotatedX = offsetX * cos - offsetY * sin;
          const rotatedY = offsetX * sin + offsetY * cos;
          offsetX = rotatedX;
          offsetY = rotatedY;
        }
        
        this._imageSprite.position.set(centerX + offsetX, centerY + offsetY);
        this._imageSprite.rotation = rotation;
        this._imageSprite.scale.set(this.settings.imageScale);
      }
    };
    canvas.app.ticker.add(this._gridTicker);

    this.saveSettings();
  }

  drawHex(g, cx, cy, r, pointy) {
    const startAngle = pointy ? -Math.PI / 2 : 0;
    g.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
    for (let i = 1; i <= 6; i++) {
      const angle = startAngle + i * Math.PI / 3;
      g.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
  }

  drawSquare(g, x, y, size) {
    g.drawRect(x, y, size, size);
  }

  toggleImageVisibility() {
    if (this._imageSprite) {
      this._imageSprite.visible = !this._imageSprite.visible;
      this.settings.imageVisible = this._imageSprite.visible;
      this.saveSettings();
    } else {
      ui.notifications.warn("No image has been loaded!");
    }
  }

  toggleGridVisibility() {
    if (this._gridGraphics) {
      this._gridGraphics.visible = !this._gridGraphics.visible;
      this.settings.gridVisible = this._gridGraphics.visible;
      this.saveSettings();
    } else {
      ui.notifications.warn("No grid has been drawn!");
    }
  }

  clearGraphics() {
    if (this._gridGraphics) {
      canvas.tokens.removeChild(this._gridGraphics);
      this._gridGraphics.destroy();
      this._gridGraphics = null;
    }
    
    if (this._imageSprite) {
      canvas.tokens.removeChild(this._imageSprite);
      this._imageSprite.destroy();
      this._imageSprite = null;
    }
    
    if (this._gridTicker) {
      canvas.app.ticker.remove(this._gridTicker);
      this._gridTicker = null;
    }
  }

  clearAll(html) {
    this.clearGraphics();
    
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

    if (game.modules.get('size-matters')) {
      game.modules.get('size-matters').settings = {};
    }

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

    ui.notifications.info("All settings cleared and reset to default!");
  }

  async close(options = {}) {
    this.clearGraphics();
    this.saveSettings();
    return super.close(options);
  }
}

Hooks.once('ready', () => {
  window.openSizeMatters = function() {
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

    const currentToken = canvas.tokens.get(token.id);
    if (currentToken && currentToken.sizeMattersHighlight) {
      canvas.tokens.removeChild(currentToken.sizeMattersHighlight);
      currentToken.sizeMattersHighlight.destroy();
      currentToken.sizeMattersHighlight = null;
      if (currentToken._gridTicker) {
        canvas.app.ticker.remove(currentToken._gridTicker);
        currentToken._gridTicker = null;
      }
    }

    const app = new SizeMattersApp(token);
    app.render(true);
  };
});

export { SizeMattersApp };