import { CONSTANTS } from './constants.js';
import { 
  validateToken, 
  validateCanvas, 
  validateGridType,
  isHexGrid,
  isPointyTop,
  axialToPixel,
  squareToPixel,
  drawHex,
  drawSquare,
  removeTokenTicker,
  addTokenTicker
} from './utils.js';

// Global function to draw Size Matters graphics for a token
export async function drawSizeMattersGraphicsForToken(token) {
  if (!validateToken(token)) {
    console.warn("Size Matters: Invalid token provided");
    return;
  }
  
  if (!validateGridType()) {
    console.warn("Size Matters: Unsupported grid type");
    return;
  }

  try {
    const settings = token.document.getFlag('size-matters', 'settings');
    if (!settings || !settings.grid) return;

    const selectedCells = Object.values(settings.grid).filter(h => h.selected);
    if (!selectedCells.length) return;

    // Clear existing graphics for this token
    clearTokenSizeMattersGraphics(token);

    const gridType = canvas.grid.type;
    const isHex = isHexGrid();
    const isPointy = isPointyTop();
    const size = canvas.grid.size;

    const color = parseInt(settings.color.replace('#', '0x'));
    const fillColor = parseInt(settings.fillColor.replace('#', '0x'));

    // Create new graphics and attach to token
    token.sizeMattersGrid = new PIXI.Graphics();
    token.sizeMattersGrid.interactive = false;
    token.sizeMattersGrid.interactiveChildren = false;
    
    if (settings.enableContour) {
      token.sizeMattersGrid.lineStyle(settings.thickness, color, settings.alpha);
    }

    selectedCells.forEach(cell => {
      try {
        if (isHex) {
          const hexRadius = size / Math.sqrt(3);
          const offset = axialToPixel(cell.q, cell.r, hexRadius, isPointy);
          if (settings.enableFill) {
            token.sizeMattersGrid.beginFill(fillColor, settings.alpha);
          }
          drawHex(token.sizeMattersGrid, offset.x, offset.y, hexRadius, isPointy);
          if (settings.enableFill) {
            token.sizeMattersGrid.endFill();
          }
        } else {
          const offset = squareToPixel(cell.q, cell.r, size);
          if (settings.enableFill) {
            token.sizeMattersGrid.beginFill(fillColor, settings.alpha);
          }
          drawSquare(token.sizeMattersGrid, offset.x - size/2, offset.y - size/2, size);
          if (settings.enableFill) {
            token.sizeMattersGrid.endFill();
          }
        }
      } catch (error) {
        console.warn("Size Matters: Error drawing cell", cell, error);
      }
    });

    token.sizeMattersGrid.visible = settings.gridVisible !== false;
    canvas.tokens.addChildAt(token.sizeMattersGrid, 0);

    // Handle image sprite with better error handling
    if (settings.imageUrl && settings.imageUrl.trim() && settings.imageVisible !== false) {
      try {
        const texture = await PIXI.Texture.fromURL(settings.imageUrl);
        token.sizeMattersImage = new PIXI.Sprite(texture);
        token.sizeMattersImage.anchor.set(0.5, 0.5);
        token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
        token.sizeMattersImage.visible = settings.imageVisible !== false;
        canvas.tokens.addChildAt(token.sizeMattersImage, 1);
      } catch (error) {
        console.warn("Size Matters: Failed to load image for token", token.id, error);
        ui.notifications?.warn(`Failed to load image: ${settings.imageUrl}`);
      }
    }

    // Create optimized ticker with position change detection
    let lastPosition = { x: token.center.x, y: token.center.y };
    let lastRotation = token.document.rotation || 0;

    const tickerFunction = () => {
      // Enhanced validation to prevent errors during scene changes
      if (!validateToken(token)) {
        removeTokenTicker(token);
        return;
      }
      
      try {
        const currentX = token.center.x;
        const currentY = token.center.y;
        const currentRotation = token.document.rotation || 0;
        
        // Only update if position or rotation changed (performance optimization)
        if (lastPosition.x !== currentX || 
            lastPosition.y !== currentY || 
            lastRotation !== currentRotation) {
          
          const rotation = Math.toRadians(currentRotation);
          
          if (token.sizeMattersGrid && token.sizeMattersGrid.parent) {
            token.sizeMattersGrid.position.set(currentX, currentY);
            token.sizeMattersGrid.rotation = rotation;
          }
          
          if (token.sizeMattersImage && token.sizeMattersImage.parent) {
            let offsetX = settings.imageOffsetX || 0;
            let offsetY = settings.imageOffsetY || 0;
            
            if (rotation !== 0) {
              const cos = Math.cos(rotation);
              const sin = Math.sin(rotation);
              const rotatedX = offsetX * cos - offsetY * sin;
              const rotatedY = offsetX * sin + offsetY * cos;
              offsetX = rotatedX;
              offsetY = rotatedY;
            }
            
            token.sizeMattersImage.position.set(currentX + offsetX, currentY + offsetY);
            token.sizeMattersImage.rotation = rotation;
            token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
          }
          
          // Update last known position
          lastPosition = { x: currentX, y: currentY };
          lastRotation = currentRotation;
        }
      } catch (error) {
        console.warn("Size Matters: Error in ticker, removing ticker", error);
        removeTokenTicker(token);
      }
    };

    addTokenTicker(token, tickerFunction);

  } catch (error) {
    console.error("Size Matters: Critical error in drawSizeMattersGraphicsForToken", error);
    clearTokenSizeMattersGraphics(token);
  }
}

// Global function to clear Size Matters graphics from a token
export function clearTokenSizeMattersGraphics(token) {
  if (!token) return;

  try {
    // Remove ticker first
    removeTokenTicker(token);

    // Clean up graphics
    if (token.sizeMattersGrid) {
      if (token.sizeMattersGrid.parent) {
        token.sizeMattersGrid.parent.removeChild(token.sizeMattersGrid);
      }
      token.sizeMattersGrid.destroy();
      token.sizeMattersGrid = null;
    }
    
    if (token.sizeMattersImage) {
      if (token.sizeMattersImage.parent) {
        token.sizeMattersImage.parent.removeChild(token.sizeMattersImage);
      }
      token.sizeMattersImage.destroy();
      token.sizeMattersImage = null;
    }
  } catch (error) {
    console.warn("Size Matters: Error clearing token graphics", error);
  }
}

// Global function to clear all Size Matters graphics from all tokens
export function clearAllSizeMattersGraphics() {
  console.log("Size Matters: Clearing all graphics and tickers");
  
  if (!validateCanvas()) return;
  
  try {
    // Clear from all tokens in the current scene
    for (const token of canvas.tokens.placeables) {
      clearTokenSizeMattersGraphics(token);
    }
    
    // Clean up any orphaned tickers
    if (canvas.app?.ticker?._head) {
      const tickerFunctions = [];
      let current = canvas.app.ticker._head;
      
      while (current) {
        if (current.fn && (
          current.fn.name === 'sizeMattersGridTicker' ||
          current.fn.toString().includes('sizeMattersGrid')
        )) {
          tickerFunctions.push(current.fn);
        }
        current = current.next;
      }
      
      tickerFunctions.forEach(fn => {
        try {
          canvas.app.ticker.remove(fn);
        } catch (error) {
          console.warn("Size Matters: Error removing orphaned ticker", error);
        }
      });
    }
  } catch (error) {
    console.error("Size Matters: Error in clearAllSizeMattersGraphics", error);
  }
}