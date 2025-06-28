import { CONSTANTS } from './constants.js';

// Utility functions for coordinate conversion and drawing
export function axialToPixel(q, r, radius, pointy) {
  return pointy
    ? { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r }
    : { x: radius * 1.5 * q, y: radius * Math.sqrt(3) * (r + q / 2) };
}

export function squareToPixel(x, y, size) {
  return { x: x * size, y: y * size };
}

export function drawHex(g, cx, cy, r, pointy) {
  const startAngle = pointy ? -Math.PI / 2 : 0;
  g.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
  for (let i = 1; i <= 6; i++) {
    const angle = startAngle + i * Math.PI / 3;
    g.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
}

export function drawSquare(g, x, y, size) {
  g.drawRect(x, y, size, size);
}

// Enhanced validation functions
export function validateToken(token) {
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

export function validateCanvas() {
  return canvas && 
         canvas.tokens && 
         canvas.grid && 
         canvas.app?.ticker;
}

export function validateGridType() {
  if (!validateCanvas()) return false;
  
  const gridType = canvas.grid.type;
  const supportedTypes = [
    ...CONSTANTS.HEX_GRID_TYPES,
    CONST.GRID_TYPES.SQUARE
  ];
  
  return supportedTypes.includes(gridType);
}

export function isHexGrid() {
  return CONSTANTS.HEX_GRID_TYPES.includes(canvas.grid.type);
}

export function isPointyTop() {
  return CONSTANTS.POINTY_TOP_TYPES.includes(canvas.grid.type);
}

// Enhanced ticker management
export function removeTokenTicker(token) {
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

export function addTokenTicker(token, tickerFunction) {
  if (!validateToken(token) || !validateCanvas()) return;
  
  // Remove existing ticker first
  removeTokenTicker(token);
  
  // Add new ticker
  token.sizeMattersGridTicker = tickerFunction;
  canvas.app.ticker.add(token.sizeMattersGridTicker);
}

// Grid initialization utilities
export function initializeHexGrid() {
  const gridSize = CONSTANTS.HEX_GRID_SIZE;
  const grid = {};
  for (let q = -gridSize; q <= gridSize; q++) {
    for (let r = -gridSize; r <= gridSize; r++) {
      if (Math.abs(q + r) <= gridSize) {
        const key = `${q},${r}`;
        grid[key] = { 
          q, 
          r, 
          selected: q === 0 && r === 0, 
          isCenter: q === 0 && r === 0 
        };
      }
    }
  }
  return grid;
}

export function initializeSquareGrid() {
  const gridSize = CONSTANTS.SQUARE_GRID_SIZE;
  const grid = {};
  for (let x = -gridSize; x <= gridSize; x++) {
    for (let y = -gridSize; y <= gridSize; y++) {
      const key = `${x},${y}`;
      grid[key] = { 
        q: x,
        r: y, 
        selected: x === 0 && y === 0, 
        isCenter: x === 0 && y === 0 
      };
    }
  }
  return grid;
}