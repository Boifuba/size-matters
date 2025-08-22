/**
 * grid-manager.js
 * Gerenciador centralizado para lógica de grid do Size Matters.
 */

import { axialToPixel, squareToPixel } from './grid-utils.js';
import { DEFAULT_GRID_SIZE_CONFIG } from './constants.js';

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
    this.currentSvgRadius = 16;
    this.currentSquareSize = 25;
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
   * Cria SVG do grid
   * @param {boolean} isHexGrid - Se é grid hexagonal
   * @param {boolean} isPointyTop - Se hexágono tem topo pontudo
   * @param {number} svgSize - Tamanho do SVG
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   * @returns {string} SVG como string
   */
  createGridSVG(isHexGrid, isPointyTop, svgSize = 300, token = null, settings = null) {
    return isHexGrid ? this.createHexSVG(isPointyTop, svgSize, token, settings) : this.createSquareSVG(svgSize, token, settings);
  }

  /**
   * Cria SVG hexagonal
   * @param {boolean} isPointyTop - Se hexágono tem topo pontudo
   * @param {number} svgSize - Tamanho do SVG
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   * @returns {string} SVG hexagonal
   */
  createHexSVG(isPointyTop, svgSize = 300, token = null, settings = null) {
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    // Primeiro, renderizar todas as células do grid
    Object.entries(this.grid).forEach(([key, h]) => {
      const pos = axialToPixel(h.q, h.r, this.currentSvgRadius, isPointyTop);
      const cx = svgSize / 2 + pos.x;
      const cy = svgSize / 2 + pos.y;
      let pts = [];
      for (let i = 0; i < 6; i++) {
        const angle = isPointyTop ? (i * Math.PI / 3) - Math.PI / 2 : i * Math.PI / 3;
        const x = cx + this.currentSvgRadius * Math.cos(angle);
        const y = cy + this.currentSvgRadius * Math.sin(angle);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      
      // Se a célula está selecionada, usar cor transparente para mostrar a imagem do token por baixo
      // Se não está selecionada, usar cor branca normal
      const fill = h.selected ? (settings && settings.fillColor ? settings.fillColor : '#ff0000') : 'rgba(255,255,255,0.1)';
      const stroke = '#666';
      const cssClass = 'grid-selectable';
      svg += `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" 
              stroke-width="1" data-grid="${key}" 
              class="${cssClass}" />`;
    });
    
    // Add effect image if available (behind everything)
    if (token && settings && settings.imageUrl && settings.imageUrl.trim() && settings.imageVisible) {
      svg += this.createImageSVG(svgSize, token, settings);
    }
    
    // Add token image on top (highest layer)
    if (token && token.document && token.document.texture && token.document.texture.src) {
      svg += this.createTokenImageSVG(svgSize, token);
    }
    
    svg += `</svg>`;
    return svg;
  }

  /**
   * Cria SVG quadrado
   * @param {number} svgSize - Tamanho do SVG
   * @param {Token} token - Token para calcular dimensões da imagem
   * @param {Object} settings - Configurações incluindo imagem
   * @returns {string} SVG quadrado
   */
  createSquareSVG(svgSize = 300, token = null, settings = null) {
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    // Primeiro, renderizar todas as células do grid
    Object.entries(this.grid).forEach(([key, square]) => {
      const pos = squareToPixel(square.q, square.r, this.currentSquareSize);
      const cx = svgSize / 2 + pos.x - this.currentSquareSize / 2;
      const cy = svgSize / 2 + pos.y - this.currentSquareSize / 2;

      // Se a célula está selecionada, usar cor transparente para mostrar a imagem do token por baixo
      // Se não está selecionada, usar cor branca normal
      const fill = square.selected ? (settings && settings.fillColor ? settings.fillColor : '#ff0000') : 'rgba(255,255,255,0.1)';
      const stroke = '#666';
      const cssClass = 'grid-selectable';
      svg += `<rect x="${cx}" y="${cy}" width="${this.currentSquareSize}" height="${this.currentSquareSize}" 
              fill="${fill}" stroke="${stroke}" 
              stroke-width="1" data-grid="${key}" 
              class="${cssClass}" />`;
    });
    
    // Add effect image if available (behind everything)
    if (token && settings && settings.imageUrl && settings.imageUrl.trim() && settings.imageVisible) {
      svg += this.createImageSVG(svgSize, token, settings);
    }
    
    // Add token image on top (highest layer)
    if (token && token.document && token.document.texture && token.document.texture.src) {
      svg += this.createTokenImageSVG(svgSize, token);
    }
    
    svg += `</svg>`;
    return svg;
  }


  /**
   * Cria elemento de imagem SVG para o efeito
   * @param {number} svgSize - Tamanho do SVG
   * @param {Token} token - Token para calcular dimensões
   * @param {Object} settings - Configurações da imagem
   * @returns {string} Elemento de imagem SVG do efeito
   */
  createImageSVG(svgSize, token, settings) {
    if (!token || !settings || !settings.imageUrl || !settings.imageUrl.trim()) {
      return '';
    }

    // Calculate effect image dimensions independently from token size
    // Use settings properties for effect dimensions, or default to 1x1 grid units
    const effectWidthInGridUnits = settings.effectGridWidth || 1;
    const effectHeightInGridUnits = settings.effectGridHeight || 1;
    
    // Get current grid cell size based on grid type
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    
    const baseCellSize = isHexGrid ? (this.currentSvgRadius * 2) : this.currentSquareSize;
    
    // Scale effect image based on effect dimensions and user scale setting
    const imageWidth = baseCellSize * effectWidthInGridUnits * (settings.imageScale || 1.0);
    const imageHeight = baseCellSize * effectHeightInGridUnits * (settings.imageScale || 1.0);
    
    // Calculate position (centered with offsets)
    const centerX = svgSize / 2;
    const centerY = svgSize / 2;
    
    // Scale offsets proportionally to current grid cell size
    const offsetScale = baseCellSize / 50; // Proportional offset scaling
    const offsetX = (settings.imageOffsetX || 0) * offsetScale;
    const offsetY = (settings.imageOffsetY || 0) * offsetScale;
    
    // Position image (top-left corner for SVG image element)
    const x = centerX - imageWidth / 2 + offsetX;
    const y = centerY - imageHeight / 2 + offsetY;
    
    // Create image element with rotation if needed
    const rotation = settings.imageRotation || 0;
    let imageElement = '';
    
    if (rotation !== 0) {
      // Use a group element for rotation
      imageElement = `<g transform="rotate(${rotation} ${centerX + offsetX} ${centerY + offsetY})">`;
      imageElement += `<image href="${settings.imageUrl}" x="${x}" y="${y}" width="${imageWidth}" height="${imageHeight}" opacity="0.8" pointer-events="none" />`;
      imageElement += `</g>`;
    } else {
      imageElement = `<image href="${settings.imageUrl}" x="${x}" y="${y}" width="${imageWidth}" height="${imageHeight}" opacity="0.8" pointer-events="none" />`;
    }
    
    return imageElement;
  }

  /**
   * Cria elemento de imagem SVG para o token do jogador
   * @param {number} svgSize - Tamanho do SVG
   * @param {Token} token - Token para obter a imagem
   * @returns {string} Elemento de imagem SVG do token
   */
  createTokenImageSVG(svgSize, token) {
    if (!token || !token.document || !token.document.texture || !token.document.texture.src) {
      return '';
    }


    // Calculate token image dimensions based on grid type
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    
    let tokenImageSize;
    if (isHexGrid) {
      // For hex grids, use the current SVG radius as base size
      tokenImageSize = this.currentSvgRadius * 1.5;
    } else {
      // For square grids, use the current square size
      tokenImageSize = this.currentSquareSize * 0.8;
    }
    
    // Calculate position (centered in the SVG)
    const centerX = svgSize / 2;
    const centerY = svgSize / 2;
    
    // Position image (top-left corner for SVG image element)
    const x = centerX - tokenImageSize / 2;
    const y = centerY - tokenImageSize / 2;
    
    // Create token image element (always fully opaque and on top)
    const imageElement = `<image href="${token.document.texture.src}" x="${x}" y="${y}" width="${tokenImageSize}" height="${tokenImageSize}" opacity="1.0" style="z-index: 1000;" pointer-events="none" />`;
    
    
    return imageElement;
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
