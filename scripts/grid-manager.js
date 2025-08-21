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
  if (typeof game !== 'undefined' && game.settings) {
    return game.settings.get('size-matters', 'gridSizeConfig');
  }
  
  // Fallback para configuração padrão consistente
  return DEFAULT_GRID_SIZE_CONFIG;
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
   * @returns {string} SVG como string
   */
  createGridSVG(isHexGrid, isPointyTop, svgSize = 300) {
    return isHexGrid ? this.createHexSVG(isPointyTop, svgSize) : this.createSquareSVG(svgSize);
  }

  /**
   * Cria SVG hexagonal
   * @param {boolean} isPointyTop - Se hexágono tem topo pontudo
   * @param {number} svgSize - Tamanho do SVG
   * @returns {string} SVG hexagonal
   */
  createHexSVG(isPointyTop, svgSize = 300) {
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
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
      const fill = h.selected ? '#2196F3' : '#fff';
      const stroke = '#666';
      const cssClass = 'grid-selectable';
      svg += `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" 
              stroke-width="1" data-grid="${key}" 
              class="${cssClass}" />`;
      
      // Add center point marker for center cell
      if (h.isCenter) {
        svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="#4CAF50" stroke="#2E7D32" stroke-width="1" />`;
      }
    });
    svg += `</svg>`;
    return svg;
  }

  /**
   * Cria SVG quadrado
   * @param {number} svgSize - Tamanho do SVG
   * @returns {string} SVG quadrado
   */
  createSquareSVG(svgSize = 300) {
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    Object.entries(this.grid).forEach(([key, square]) => {
      const pos = squareToPixel(square.q, square.r, this.currentSquareSize);
      const cx = svgSize / 2 + pos.x - this.currentSquareSize / 2;
      const cy = svgSize / 2 + pos.y - this.currentSquareSize / 2;

      const fill = square.selected ? '#2196F3' : '#fff';
      const stroke = '#666';
      const cssClass = 'grid-selectable';
      svg += `<rect x="${cx}" y="${cy}" width="${this.currentSquareSize}" height="${this.currentSquareSize}" 
              fill="${fill}" stroke="${stroke}" 
              stroke-width="1" data-grid="${key}" 
              class="${cssClass}" />`;
      
      // Add center point marker for center cell
      if (square.isCenter) {
        const centerX = cx + this.currentSquareSize / 2;
        const centerY = cy + this.currentSquareSize / 2;
        svg += `<circle cx="${centerX}" cy="${centerY}" r="4" fill="#4CAF50" stroke="#2E7D32" stroke-width="1" />`;
      }
    });
    svg += `</svg>`;
    return svg;
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