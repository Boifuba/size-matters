/**
 * constants.js
 * Centralized constants and default configurations for Size Matters.
 */

// Default module settings
export const DEFAULT_SETTINGS = {
  color: "#ff0000",
  fillColor: "#ff0000",
  thickness: 3, // Sempre fixo em 3px
  alpha: 0.7,
  enableFill: true,
  enableContour: true,
  imageUrl: "",
  imageScale: 1.0,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageRotation: 0,
  imageVisible: true,
  zoomLevel: "medium",
  redLineAdjustment: 0,
  greenLineAdjustment: 0,
};

// Color constants for directional highlighting
export const DIRECTIONAL_COLORS = {
  RED: 0xFF0000,   // topo
  GREEN: 0x00FF00, // base
  YELLOW: 0xFFFF00 // laterais
};

// Common messages
export const MESSAGES = {
  SELECT_TOKEN_FIRST: "Select a token first!",
  FOUNDRY_NOT_READY: "Size Matters: Foundry VTT not ready yet. Please try again in a moment."
};

// Default grid size configuration
export const DEFAULT_GRID_SIZE_CONFIG = {
  small: {
    hex: { gridSize: 4, svgRadius: 12 },
    square: { gridSize: 4, squareSize: 20 },
  },
  medium: {
    hex: { gridSize: 4, svgRadius: 24 },
    square: { gridSize: 4, squareSize: 40 },
  },
  large: {
    hex: { gridSize: 4, svgRadius: 36 },
    square: { gridSize: 4, squareSize: 60 },
  },
};