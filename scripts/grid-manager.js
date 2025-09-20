/**
 * grid-manager.js
 * Gerenciador centralizado para lógica de grid do Size Matters.
 */

import { axialToPixel, squareToPixel } from './grid-utils.js';
import { getTexture } from './texture-utils.js';
import { calculateDirectionalColors } from './directional-utils.js';
import { 
  DEFAULT_GRID_SIZE_CONFIG,
  DEFAULT_SVG_RADIUS,
  DEFAULT_SQUARE_SIZE,
  SVG_VIEWPORT_SIZE,
  GRID_UNSELECTED_FILL_COLOR,
  GRID_UNSELECTED_FILL_ALPHA,
  GRID_STROKE_COLOR,
  GRID_STROKE_WIDTH,
  EFFECT_IMAGE_DEFAULT_OPACITY,
  IMAGE_OFFSET_SCALE_FACTOR,
  TOKEN_HEX_IMAGE_SCALE_FACTOR,
  TOKEN_SQUARE_IMAGE_SCALE_FACTOR,
  EFFECT_IMAGE_PREVIEW_BASE_SCALE,
  TOKEN_IMAGE_Z_INDEX_STYLE
} from './constants.js';

// Z-Index Definitions for layering order
export const TOKEN_IMAGE_Z_INDEX = 20;
export const EFFECT_IMAGE_Z_INDEX = 10;
export const GRID_GRAPHICS_Z_INDEX = 0;

/**
 * Obtém a configuração de zoom atual das configurações do jogo
 * @returns {Object} Configuração de zoom
 */
function getZoomConfig() {
  // Start with default configuration as fallback
  let config = foundry.utils.duplicate(DEFAULT_GRID_SIZE_CONFIG);
  
  if (typeof game !== 'undefined' && game.settings) {
    try {
      const savedConfig = game.settings.get('size-matters', 'gridSizeConfig');
      
      // Only use saved config if it's a valid object with expected structure
      if (savedConfig && typeof savedConfig === 'object' && 
          savedConfig.small && savedConfig.medium && savedConfig.large) {
        config = savedConfig;
        // console.log('Size Matters Debug - getZoomConfig() using saved config:', config);
      } else {
        // console.log('Size Matters Debug - getZoomConfig() saved config invalid, using default:', config);
      }
    } catch (error) {
      console.warn('Size Matters Debug - Error getting gridSizeConfig, using default:', error);
    }
  } else {
    // console.log('Size Matters Debug - getZoomConfig() game not ready, using default:', config);
  }
  
  return config;
}

export class GridManager {
  constructor() {
    this.grid = {};
    this.currentSvgRadius = DEFAULT_SVG_RADIUS;
    this.currentSquareSize = DEFAULT_SQUARE_SIZE;
    this.currentZoomLevel = 'medium';
  }

  /**
   * Inicializa o grid baseado no tipo de canvas e nível de zoom
   * @param {string} zoomLevel - Nível de zoom ('small', 'medium', 'large')
   * @param {Object} existingGridData - Dados de grid existentes (opcional)
   * @returns {Object} Grid inicializado
   */
  initializeGrid(zoomLevel = 'medium', existingGridData = null) {
    this.currentZoomLevel = zoomLevel;
    
    const ZOOM_CONFIG = getZoomConfig();
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    
    if (isHexGrid) {
      const config = ZOOM_CONFIG[zoomLevel].hex;
      this.currentSvgRadius = config.svgRadius;
      this.grid = this.initializeHexGrid(config.gridSize);
    } else {
      const config = ZOOM_CONFIG[zoomLevel].square;
      this.currentSquareSize = config.squareSize;
      this.grid = this.initializeSquareGrid(config.gridSize);
    }

    // Se há dados de grid existentes, preservar as seleções
    if (existingGridData) {
      this.mergeExistingSelections(existingGridData);
    }

    return this.grid;
  }

  /**
   * Inicializa grid hexagonal
   * @param {number} gridSize - Tamanho do grid
   * @returns {Object} Grid hexagonal
   */
  initializeHexGrid(gridSize = 4) {
    const grid = {};
    for (let q = -gridSize; q <= gridSize; q++) {
      for (let r = -gridSize; r <= gridSize; r++) {
        if (Math.abs(q + r) > gridSize) continue;
        const key = `${q},${r}`;
        grid[key] = { 
          q: q,
          r: r, 
          selected: false, 
          isCenter: q === 0 && r === 0 
        };
      }
    }
    return grid;
  }

  /**
   * Inicializa grid quadrado
   * @param {number} gridSize - Tamanho do grid
   * @returns {Object} Grid quadrado
   */
  initializeSquareGrid(gridSize = 4) {
    const grid = {};
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let y = -gridSize; y <= gridSize; y++) {
        const key = `${x},${y}`;
        grid[key] = { 
          q: x,
          r: y, 
          selected: false, 
          isCenter: x === 0 && y === 0 
        };
      }
    }
    return grid;
  }

  /**
   * Mescla seleções existentes com o novo grid
   * @param {Object} existingGridData - Dados de grid existentes
   */
  mergeExistingSelections(existingGridData) {
    if (!existingGridData || typeof existingGridData !== 'object') return;

    Object.entries(existingGridData).forEach(([key, cellData]) => {
      if (this.grid[key] && cellData.selected) {
        this.grid[key].selected = true;
      }
    });
  }

  /**
   * Configura um sprite para ser completamente não-interativo e garantir que cliques passem através
   * @param {PIXI.Sprite} sprite - O sprite a ser configurado
   */
  makeCompletelyNonInteractive(sprite) {
    sprite.interactive = false;
    sprite.interactiveChildren = false;
    sprite.buttonMode = false;
    sprite.hitArea = null;
    sprite.eventMode = 'none';
    
    // Adicionais para garantir que eventos passem através
    sprite.pointerEvents = 'none';
    sprite.cursor = 'default';
    
    // Força o sprite a não capturar qualquer tipo de evento
    if (sprite.on) {
      sprite.removeAllListeners();
    }
  }

  /**
   * Draws the grid preview using PIXI.Graphics
   * @param {PIXI.Graphics} graphics - The PIXI Graphics object to draw on
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   */
  async drawGridPreview(graphics, token = null, settings = null) {
    if (!graphics) return;

    // Clear previous graphics
    graphics.clear();

    const gridType = canvas?.grid?.type || CONST.GRID_TYPES.SQUARE;
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

    const canvasSize = 350; // Canvas size
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // PRIMEIRO: Adicionar imagens ANTES de desenhar o grid
    await this.addPreviewImages(graphics, centerX, centerY, token, settings);

    // DEPOIS: Desenhar o grid POR CIMA das imagens
    if (isHexGrid) {
      await this.drawHexGridPreview(graphics, centerX, centerY, isPointyTop, token, settings);
    } else {
      await this.drawSquareGridPreview(graphics, centerX, centerY, token, settings);
    }
  }

  /**
   * Draws hexagonal grid preview
   * @param {PIXI.Graphics} graphics - The PIXI Graphics object
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   * @param {boolean} isPointyTop - Se hexágono tem topo pontudo
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   */
  async drawHexGridPreview(graphics, centerX, centerY, isPointyTop, token = null, settings = null) {
    const selectedCells = Object.values(this.grid).filter(cell => cell.selected);
    
    // Draw all grid cells first
    Object.entries(this.grid).forEach(([key, h]) => {
      const pos = axialToPixel(h.q, h.r, this.currentSvgRadius, isPointyTop);
      const cx = centerX + pos.x;
      const cy = centerY + pos.y;
      
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = isPointyTop ? (i * Math.PI / 3) - Math.PI / 2 : i * Math.PI / 3;
        const x = cx + this.currentSvgRadius * Math.cos(angle);
        const y = cy + this.currentSvgRadius * Math.sin(angle);
        points.push(x, y);
      }
      
      // Set fill color based on selection
      if (h.selected) {
        if (settings?.enableFill) {
          const fillColor = settings?.fillColor ? parseInt(settings.fillColor.replace('#', '0x')) : 0xff0000;
          graphics.beginFill(fillColor, 0.3);
        } else {
          // Use visible light gray when fill is disabled to show selection without confusion
          graphics.beginFill(0xCCCCCC, 0.6);
        }
      } else {
        graphics.beginFill(GRID_UNSELECTED_FILL_COLOR, GRID_UNSELECTED_FILL_ALPHA);
      }
      
      graphics.lineStyle(GRID_STROKE_WIDTH, GRID_STROKE_COLOR);
      graphics.drawPolygon(points);
      graphics.endFill();
    });

    // Draw directional colors if enabled and there are selected cells
    if (settings?.enableDirectionalHighlight && selectedCells.length > 0) {
      // Create grid data for drawing (similar to token-graphics.js)
      let gridDataForDrawing = this.grid;
      let selectedCellsForDrawing = selectedCells;

      // Special case for empty selection with directional highlight
      if (selectedCellsForDrawing.length === 0) {
        gridDataForDrawing = {
          "0,0": { q: 0, r: 0, selected: true, isCenter: true }
        };
        selectedCellsForDrawing = Object.values(gridDataForDrawing);
      }

      const result = calculateDirectionalColors(
        selectedCellsForDrawing, 
        this.currentSvgRadius, 
        isPointyTop, 
        settings
      );

      if (result.edges && result.colors) {
        // Draw directional colored edges
        result.edges.forEach((edge, index) => {
          const color = result.colors[index];
          graphics.lineStyle(settings.thickness || 3, color, 1.0);
          graphics.moveTo(centerX + edge.p1.x, centerY + edge.p1.y);
          graphics.lineTo(centerX + edge.p2.x, centerY + edge.p2.y);
        });
      }
    } else if (settings?.enableContour && selectedCells.length > 0) {
      // Draw normal outline without directional colors
      const outlineColor = settings?.color ? parseInt(settings.color.replace('#', '0x')) : 0xff0000;
      graphics.lineStyle(settings.thickness || 3, outlineColor, 1.0);
      
      // Simple outline for preview (could be enhanced with the same path logic)
      selectedCells.forEach(cell => {
        const pos = axialToPixel(cell.q, cell.r, this.currentSvgRadius, isPointyTop);
        const cx = centerX + pos.x;
        const cy = centerY + pos.y;
        
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = isPointyTop ? (i * Math.PI / 3) - Math.PI / 2 : i * Math.PI / 3;
          const x = cx + this.currentSvgRadius * Math.cos(angle);
          const y = cy + this.currentSvgRadius * Math.sin(angle);
          points.push(x, y);
        }
        
        graphics.drawPolygon(points);
      });
    }
  }

  /**
   * Draws square grid preview
   * @param {PIXI.Graphics} graphics - The PIXI Graphics object
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   */
  async drawSquareGridPreview(graphics, centerX, centerY, token = null, settings = null) {
    // Draw all grid cells
    Object.entries(this.grid).forEach(([key, square]) => {
      const pos = squareToPixel(square.q, square.r, this.currentSquareSize);
      const x = centerX + pos.x - this.currentSquareSize / 2;
      const y = centerY + pos.y - this.currentSquareSize / 2;

      // Set fill color based on selection
      if (square.selected) {
        if (settings?.enableFill) {
          const fillColor = settings?.fillColor ? parseInt(settings.fillColor.replace('#', '0x')) : 0xff0000;
          graphics.beginFill(fillColor, 0.3);
        } else {
          // Use visible light gray when fill is disabled to show selection without confusion
          graphics.beginFill(0xCCCCCC, 0.6);
        }
      } else {
        graphics.beginFill(GRID_UNSELECTED_FILL_COLOR, GRID_UNSELECTED_FILL_ALPHA);
      }
      
      graphics.lineStyle(GRID_STROKE_WIDTH, GRID_STROKE_COLOR);
      graphics.drawRect(x, y, this.currentSquareSize, this.currentSquareSize);
      graphics.endFill();
    });
  }

  /**
   * Adds effect and token images to the preview
   * @param {PIXI.Graphics} graphics - The PIXI Graphics object
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   */
  async addPreviewImages(graphics, centerX, centerY, token = null, settings = null) {
    // Clear any existing sprites from the parent container
    if (graphics.parent) {
      graphics.parent.children.forEach(child => {
        if (child instanceof PIXI.Sprite && child !== graphics) {
          graphics.parent.removeChild(child);
        }
      });
    }

    // Add effect image if available - BEHIND the grid graphics
    if (token && settings && settings.imageUrl && settings.imageUrl.trim() && settings.imageVisible) {
      try {
        const texture = await getTexture(settings.imageUrl);
        if (texture && graphics.parent) {
          const sprite = new PIXI.Sprite(texture);
          sprite.anchor.set(0.5, 0.5);
          
          // CRÍTICO: Fazer o sprite COMPLETAMENTE não-interativo
          this.makeCompletelyNonInteractive(sprite);
          
          // Definir zIndex muito baixo para garantir que fique atrás
          sprite.zIndex = EFFECT_IMAGE_Z_INDEX;
          
          // Calculate effect image dimensions
          const gridType = canvas?.grid?.type || CONST.GRID_TYPES.SQUARE;
          const isHexGrid = [
            CONST.GRID_TYPES.HEXODDR,
            CONST.GRID_TYPES.HEXEVENR,
            CONST.GRID_TYPES.HEXODDQ,
            CONST.GRID_TYPES.HEXEVENQ,
          ].includes(gridType);
          
          const baseCellSize = isHexGrid ? (this.currentSvgRadius * 2) : this.currentSquareSize;
          const imageScale = (settings.imageScale || 1.0) * EFFECT_IMAGE_PREVIEW_BASE_SCALE;
          
          sprite.scale.set(imageScale * baseCellSize / texture.width);
          
          // Apply offsets
          const offsetScale = baseCellSize / IMAGE_OFFSET_SCALE_FACTOR;
          sprite.x = centerX + (settings.imageOffsetX || 0) * offsetScale;
          sprite.y = centerY + (settings.imageOffsetY || 0) * offsetScale;
          
          // Apply rotation
          sprite.rotation = Math.toRadians(settings.imageRotation || 0);
          sprite.alpha = EFFECT_IMAGE_DEFAULT_OPACITY;
          
          // Add ATRÁS do graphics
          graphics.parent.addChild(sprite);
          
          // console.log('Size Matters: Effect image sprite created with zIndex:', sprite.zIndex, 'interactive:', sprite.interactive);
        }
      } catch (error) {
        console.warn('Size Matters: Failed to load effect image for preview:', error);
      }
    }

    // Add token image - TAMBÉM ATRÁS do grid graphics
    if (token && token.document && token.document.texture && token.document.texture.src) {
      try {
        const texture = await getTexture(token.document.texture.src);
        if (texture && graphics.parent) {
          const sprite = new PIXI.Sprite(texture);
          sprite.anchor.set(0.5, 0.5);
          
          // CRÍTICO: Fazer o sprite COMPLETAMENTE não-interativo
          this.makeCompletelyNonInteractive(sprite);
          
          // Definir zIndex baixo mas maior que a imagem de efeito
          sprite.zIndex = TOKEN_IMAGE_Z_INDEX;
          
          // Calculate token image size
          const gridType = canvas?.grid?.type || CONST.GRID_TYPES.SQUARE;
          const isHexGrid = [
            CONST.GRID_TYPES.HEXODDR,
            CONST.GRID_TYPES.HEXEVENR,
            CONST.GRID_TYPES.HEXODDQ,
            CONST.GRID_TYPES.HEXEVENQ,
          ].includes(gridType);
          
          let tokenImageSize;
          if (isHexGrid) {
            tokenImageSize = this.currentSvgRadius * TOKEN_HEX_IMAGE_SCALE_FACTOR;
          } else {
            tokenImageSize = this.currentSquareSize * TOKEN_SQUARE_IMAGE_SCALE_FACTOR;
          }
          
          sprite.scale.set(tokenImageSize / texture.width);
          sprite.x = centerX;
          sprite.y = centerY;
          sprite.alpha = 1.0;
          
          // Add ATRÁS do graphics
          graphics.parent.addChild(sprite);
          
        }
      } catch (error) {
        console.warn('Size Matters: Failed to load token image for preview:', error);
      }
    }
  }

  /**
   * Obtém o grid atual
   * @returns {Object} Grid atual
   */
  getGrid() {
    return this.grid;
  }

  /**
   * Define o grid
   * @param {Object} newGrid - Novo grid
   */
  setGrid(newGrid) {
    this.grid = newGrid;
  }

  /**
   * Obtém o raio SVG atual
   * @returns {number} Raio SVG
   */
  getSvgRadius() {
    return this.currentSvgRadius;
  }

  /**
   * Obtém o tamanho do quadrado atual
   * @returns {number} Tamanho do quadrado
   */
  getSquareSize() {
    return this.currentSquareSize;
  }

  /**
   * Obtém o nível de zoom atual
   * @returns {string} Nível de zoom
   */
  getZoomLevel() {
    return this.currentZoomLevel;
  }

  /**
   * Limpa todas as seleções do grid
   */
  clearSelections() {
    Object.values(this.grid).forEach(cell => {
      if (!cell.isCenter) {
        cell.selected = false;
      }
    });
  }

  /**
   * Obtém células selecionadas
   * @returns {Array} Array de células selecionadas
   */
  getSelectedCells() {
    return Object.values(this.grid).filter(cell => cell.selected);
  }
}