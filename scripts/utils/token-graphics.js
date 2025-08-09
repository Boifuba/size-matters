/**
 * Token graphics rendering utilities
 */

import { axialToPixel, squareToPixel } from './grid-utils.js';
import { getTexture } from './texture-utils.js';

/**
 * Draws Size Matters graphics for a token
 * @param {Token} token - The token to draw graphics for
 */
export async function drawSizeMattersGraphicsForToken(token) {
  if (!token || !token.document) return;

  const settings = token.document.getFlag('size-matters', 'settings');
  if (!settings) return;

  clearTokenSizeMattersGraphics(token);

  token.sizeMattersContainer = new PIXI.Container();
  canvas.primary.addChild(token.sizeMattersContainer);

  if (settings.imageUrl && settings.imageUrl.trim()) {
    try {
      const texture = await getTexture(settings.imageUrl);
      if (texture) {
        token.sizeMattersImage = new PIXI.Sprite(texture);
        token.sizeMattersImage.anchor.set(0.5, 0.5);
      }
    } catch (error) {
      console.warn("Size Matters: Failed to load image for token", token.id, error);
    }
  }

  const selectedCells = Object.values(settings.grid || {}).filter(h => h.selected);
  if (selectedCells.length > 0) {
    token.sizeMattersGrid = createGridGraphics(settings, settings.grid);
    token.sizeMattersContainer.addChild(token.sizeMattersGrid);
  }

  if (token.sizeMattersImage) {
    token.sizeMattersContainer.addChild(token.sizeMattersImage);
  }

  if (token.sizeMattersContainer.children.length > 0) {
    setupTicker(token, settings);
  } else {
    clearTokenSizeMattersGraphics(token);
  }
}

/**
 * Creates grid graphics based on settings and grid data
 * @param {Object} settings - Grid settings
 * @param {Object} gridData - Grid cell data
 * @returns {PIXI.Graphics} The created graphics object
 */
export function createGridGraphics(settings, gridData) {
  const graphics = new PIXI.Graphics();
  
  const color = parseInt(settings.color.replace('#', '0x'));
  const fillColor = parseInt(settings.fillColor.replace('#', '0x'));
  
  if (settings.enableContour) {
    graphics.lineStyle(settings.thickness, color, settings.alpha);
  }
  
  const selectedCells = Object.values(gridData).filter(h => h.selected);
  
  if (settings.enableFill) {
    graphics.beginFill(fillColor, settings.alpha);
  }
  
  selectedCells.forEach(cell => {
    drawCell(graphics, cell, settings);
  });
  
  if (settings.enableFill) {
    graphics.endFill();
  }
  
  return graphics;
}

/**
 * Draws a single cell on the graphics object
 * @param {PIXI.Graphics} graphics - The graphics object to draw on
 * @param {Object} cell - Cell data with q, r coordinates
 * @param {Object} settings - Grid settings
 */
export function drawCell(graphics, cell, settings) {
  const gridType = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                     CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
  const size = canvas.grid.size;
  
  if (isHexGrid) {
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    const hexRadius = size / Math.sqrt(3);
    const offset = axialToPixel(cell.q, cell.r, hexRadius, isPointyTop);
    drawHexOptimized(graphics, offset.x, offset.y, hexRadius, isPointyTop);
  } else {
    const offset = squareToPixel(cell.q, cell.r, size);
    graphics.drawRect(offset.x - size / 2, offset.y - size / 2, size, size);
  }
}

/**
 * Draws an optimized hexagon
 * @param {PIXI.Graphics} graphics - The graphics object to draw on
 * @param {number} cx - Center X coordinate
 * @param {number} cy - Center Y coordinate
 * @param {number} r - Radius
 * @param {boolean} pointy - Whether the hex is pointy-top
 */
export function drawHexOptimized(graphics, cx, cy, r, pointy) {
  const startAngle = pointy ? -Math.PI / 2 : 0;
  const points = [];
  
  for (let i = 0; i <= 6; i++) {
    const angle = startAngle + i * Math.PI / 3;
    points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  
  graphics.drawPolygon(points);
}

/**
 * Sets up the ticker for updating token graphics
 * @param {Token} token - The token to set up ticker for
 * @param {Object} settings - Token settings
 */
export function setupTicker(token, settings) {
  if (token.sizeMattersGridTicker) {
    canvas.app.ticker.remove(token.sizeMattersGridTicker);
  }

  token.sizeMattersGridTicker = () => {
    if (!token || !token.document || !token.center || !token.sizeMattersContainer || !token.sizeMattersContainer.parent) {
      if (token && token.sizeMattersGridTicker) {
        canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
        token.sizeMattersGridTicker = null;
      }
      return;
    }

    const container = token.sizeMattersContainer;
    const tokenRotation = Math.toRadians(token.document.rotation || 0);

    container.position.set(token.center.x, token.center.y);
    container.rotation = tokenRotation;
    
    container.visible = token.visible && ((settings.gridVisible !== false) || (settings.imageVisible !== false));

    if (token.sizeMattersGrid) {
      token.sizeMattersGrid.visible = (settings.gridVisible !== false);
      token.sizeMattersGrid.position.set(0, 0);
    }

    if (token.sizeMattersImage) {
      token.sizeMattersImage.visible = (settings.imageVisible !== false);
      token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
      
      const offsetX = settings.imageOffsetX || 0;
      const offsetY = settings.imageOffsetY || 0;
      token.sizeMattersImage.position.set(offsetX, offsetY);
      
      token.sizeMattersImage.rotation = Math.toRadians(settings.imageRotation || 0);
    }
  };

  token.sizeMattersGridTicker();
  canvas.app.ticker.add(token.sizeMattersGridTicker);
}

/**
 * Clears Size Matters graphics for a specific token
 * @param {Token} token - The token to clear graphics for
 */
export function clearTokenSizeMattersGraphics(token) {
  if (!token) return;

  // Clean up the main container first
  if (token.sizeMattersContainer) {
    try {
      if (token.sizeMattersContainer.parent) {
        token.sizeMattersContainer.parent.removeChild(token.sizeMattersContainer);
      }
      token.sizeMattersContainer.destroy({ children: true, texture: false, baseTexture: false });
    } catch (error) {
      console.warn("Size Matters: Error destroying container", error);
    }
  }
  token.sizeMattersContainer = null;

  if (token.sizeMattersGrid) {
    try {
      if (token.sizeMattersGrid.parent) {
        token.sizeMattersGrid.parent.removeChild(token.sizeMattersGrid);
      }
      token.sizeMattersGrid.clear();
      token.sizeMattersGrid.destroy(true);
    } catch (error) {
      console.warn("Size Matters: Error destroying grid graphics", error);
    }
  }
  token.sizeMattersGrid = null;

  if (token.sizeMattersImage) {
    try {
      if (token.sizeMattersImage.parent) {
        token.sizeMattersImage.parent.removeChild(token.sizeMattersImage);
      }
      token.sizeMattersImage.destroy(false);
    } catch (error) {
      console.warn("Size Matters: Error destroying image sprite", error);
    }
  }
  token.sizeMattersImage = null;

  if (token.sizeMattersGridTicker) {
    try {
      canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
    } catch (error) {
      console.warn("Size Matters: Error removing ticker", error);
    }
  }
  token.sizeMattersGridTicker = null;
}

/**
 * Clears all Size Matters graphics from all tokens
 */
export function clearAllSizeMattersGraphics() {
  if (!canvas || !canvas.tokens) return;

  for (const token of canvas.tokens.placeables) {
    clearTokenSizeMattersGraphics(token);
  }

  if (canvas.app?.ticker) {
    const tickerFunctions = canvas.app.ticker._head;
    let current = tickerFunctions;
    const toRemove = [];

    while (current) {
      if (current.fn && current.fn.name === 'sizeMattersGridTicker') {
        toRemove.push(current.fn);
      }
      current = current.next;
    }

    toRemove.forEach(fn => canvas.app.ticker.remove(fn));
  }
}