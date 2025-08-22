/**
 * constants.js
 * Constantes e configurações padrão do Size Matters.
 */

// Cores direcionais para destaque em grids hexagonais
export const DIRECTIONAL_COLORS = {
  RED: 0xFF0000,
  GREEN: 0x00FF00,
  YELLOW: 0xFFFF00
};

// Mensagens do sistema
export const MESSAGES = {
  FOUNDRY_NOT_READY: "Size Matters: Foundry VTT não está pronto ainda!",
  SELECT_TOKEN_FIRST: "Selecione um token primeiro!"
};

// Configurações padrão do módulo
export const DEFAULT_SETTINGS = {
  color: "#ff0000",
  fillColor: "#ff0000",
  thickness: 3,
  alpha: 0.8,
  enableFill: false,
  enableContour: true,
  imageUrl: "",
  imageScale: 1.0,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageRotation: 0,
  imageVisible: true,
  gridVisible: true,
  enableDirectionalHighlight: false,
  redLineAdjustment: 0,
  greenLineAdjustment: 0,
  effectGridWidth: 3,
  effectGridHeight: 3,
  zoomLevel: "medium"
};

// Configuração padrão de tamanhos de grid
export const DEFAULT_GRID_SIZE_CONFIG = {
  small: {
    hex: {
      gridSize: 10,
      svgRadius: 18
    },
    square: {
      gridSize: 4,
      squareSize: 20
    }
  },
  medium: {
    hex: {
      gridSize: 4,
      svgRadius: 28
    },
    square: {
      gridSize: 4,
      squareSize: 40
    }
  },
  large: {
    hex: {
      gridSize: 4,
      svgRadius: 36
    },
    square: {
      gridSize: 4,
      squareSize: 60
    }
  }
};