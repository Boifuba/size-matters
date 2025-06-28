// Constants for better maintainability
export const CONSTANTS = {
  HEX_GRID_SIZE: 7,
  SQUARE_GRID_SIZE: 5,
  SVG_SIZE: 500,
  SVG_RADIUS: 22,
  SQUARE_SIZE: 35,
  TICKER_CLEANUP_DELAY: 100,
  CANVAS_READY_DELAY: 500,
  
  // Grid types
  HEX_GRID_TYPES: [
    CONST.GRID_TYPES.HEXODDR, 
    CONST.GRID_TYPES.HEXEVENR,
    CONST.GRID_TYPES.HEXODDQ, 
    CONST.GRID_TYPES.HEXEVENQ
  ],
  
  POINTY_TOP_TYPES: [
    CONST.GRID_TYPES.HEXODDR, 
    CONST.GRID_TYPES.HEXEVENR
  ],
  
  // Default settings
  DEFAULT_SETTINGS: {
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
    imageVisible: true,
    gridVisible: true
  },
  
  // Settings keys
  PRESETS_SETTING_KEY: "size-matters-presets"
};