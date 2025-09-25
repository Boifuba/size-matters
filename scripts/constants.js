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
      svgRadius: 14
    },
    square: {
      gridSize: 4,
      squareSize: 20
    }
  },
  medium: {
    hex: {
      gridSize: 10,
      svgRadius: 24
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

// Valores padrão do GridManager
export const DEFAULT_SVG_RADIUS = 16;
export const DEFAULT_SQUARE_SIZE = 25;

// Configurações de SVG
export const SVG_VIEWPORT_SIZE = 300;
export const GRID_UNSELECTED_FILL_COLOR = 0xF4F4F4;
export const GRID_UNSELECTED_FILL_ALPHA = 1.0;
export const GRID_STROKE_COLOR = 0x666666;
export const GRID_STROKE_WIDTH = 1;

// Configurações de imagem
export const EFFECT_IMAGE_DEFAULT_OPACITY = 1;
export const IMAGE_OFFSET_SCALE_FACTOR = 50;
export const TOKEN_HEX_IMAGE_SCALE_FACTOR = 1;
export const TOKEN_SQUARE_IMAGE_SCALE_FACTOR = 0.8;
//Imagem de preview do efeito na seleção do token
export const EFFECT_IMAGE_PREVIEW_BASE_SCALE = 0.4;




//isso aqui não tem ue estar aqui
export const TOKEN_IMAGE_Z_INDEX_STYLE = 'z-index: 1000;';