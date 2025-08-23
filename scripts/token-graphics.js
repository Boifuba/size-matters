/**
 * token-graphics.js
 * Utilitários de renderização de gráficos para tokens.
 */

import { axialToPixel, squareToPixel } from './grid-utils.js';
import { calculateDirectionalColors } from './directional-utils.js';
import { DIRECTIONAL_COLORS, DEFAULT_SETTINGS } from './constants.js';
import { getTexture } from './texture-utils.js';

// ================================
// TOKEN GRAPHICS LOGIC
// ================================

/**
 * Reconstrói o caminho do contorno a partir das arestas
 * @param {Set} outlineEdgeKeys - Chaves das arestas do contorno
 * @param {Array} allEdges - Todas as arestas
 * @returns {Array} Pontos do caminho
 */
function getOutlinePath(outlineEdgeKeys, allEdges) {
    const outlineEdges = allEdges.filter(edge => outlineEdgeKeys.has(edge.key));
    if (outlineEdges.length === 0) return [];
    
    const path = [outlineEdges[0].p1, outlineEdges[0].p2];
    let currentPoint = outlineEdges[0].p2;
    const remainingEdges = [...outlineEdges];
    remainingEdges.splice(0, 1);

    while (remainingEdges.length > 0) {
        let foundNext = false;
        for (let i = 0; i < remainingEdges.length; i++) {
            const nextEdge = remainingEdges[i];
            const p1Key = `${nextEdge.p1.x.toFixed(5)},${nextEdge.p1.y.toFixed(5)}`;
            const p2Key = `${nextEdge.p2.x.toFixed(5)},${nextEdge.p2.y.toFixed(5)}`;
            const currentKey = `${currentPoint.x.toFixed(5)},${currentPoint.y.toFixed(5)}`;

            if (p1Key === currentKey) {
                path.push(nextEdge.p2);
                currentPoint = nextEdge.p2;
                remainingEdges.splice(i, 1);
                foundNext = true;
                break;
            } else if (p2Key === currentKey) {
                path.push(nextEdge.p1);
                currentPoint = nextEdge.p1;
                remainingEdges.splice(i, 1);
                foundNext = true;
                break;
            }
        }
        if (!foundNext) break;
    }
    return path;
}

/**
 * Configura um sprite para ser completamente não-interativo
 * @param {PIXI.Sprite} sprite - O sprite a ser configurado
 */
function makeNonInteractive(sprite) {
    sprite.interactive = false;
    sprite.interactiveChildren = false;
    sprite.buttonMode = false;
    sprite.hitArea = null; // Remove hit area completamente
    
    // FORÇA pointer-events: none no DOM se existir
    if (sprite.view && sprite.view.style) {
        sprite.view.style.pointerEvents = 'none';
        sprite.view.style.userSelect = 'none';
    }
    
    // Força propriedades PIXI para garantir que não capture eventos
    sprite.eventMode = 'none';
    sprite.cursor = null;
    sprite.pointerdown = null;
    sprite.pointerup = null;
    sprite.pointermove = null;
    sprite.pointerover = null;
    sprite.pointerout = null;
    sprite.click = null;
    sprite.tap = null;
}

/**
 * Desenha os gráficos do Size Matters para um token.
 * @param {Token} token - O token para o qual desenhar os gráficos.
 */
async function drawSizeMattersGraphicsForToken(token) {
  if (!token || !token.document) return;

  let settings = token.document.getFlag('size-matters', 'settings');
  
  // If no settings exist for this token, clear any existing graphics and return
  if (!settings) {
    clearTokenSizeMattersGraphics(token);
    return;
  }
  
  const gridType = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                     CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);

  // Se não houver configurações específicas do token, crie um conjunto padrão.
  if (!settings) {
    settings = { ...DEFAULT_SETTINGS, grid: {} };
  }

  clearTokenSizeMattersGraphics(token);

  token.sizeMattersContainer = new PIXI.Container();
  // Fazer o container também não-interativo para garantir que cliques passem através
  makeNonInteractive(token.sizeMattersContainer);
  
  // FORÇA o container a não capturar eventos
  token.sizeMattersContainer.interactive = false;
  token.sizeMattersContainer.interactiveChildren = false;
  token.sizeMattersContainer.eventMode = 'none';
  
  canvas.primary.addChild(token.sizeMattersContainer);

  // Load effect image if available
  if (settings.imageUrl && settings.imageUrl.trim()) {
    try {
      const texture = await getTexture(settings.imageUrl);
      if (texture) {
        token.sizeMattersImage = new PIXI.Sprite(texture);
        token.sizeMattersImage.anchor.set(0.5, 0.5);
        
        // CRÍTICO: Fazer a imagem do efeito completamente não-interativa
        makeNonInteractive(token.sizeMattersImage);
        
        // FORÇA propriedades adicionais para garantir que não capture cliques
        token.sizeMattersImage.interactive = false;
        token.sizeMattersImage.interactiveChildren = false;
        token.sizeMattersImage.eventMode = 'none';
        token.sizeMattersImage.hitArea = null;
        token.sizeMattersImage.buttonMode = false;
        
        // Se tiver referência ao DOM, aplica pointer-events: none
        if (token.sizeMattersImage.view) {
          token.sizeMattersImage.view.style.pointerEvents = 'none';
          token.sizeMattersImage.view.style.userSelect = 'none';
        }
      }
    } catch (error) {
      console.warn("Size Matters: Falha ao carregar imagem para o token", token.id, error);
    }
  }

  // Load token image for rendering on top
  if (token.document && token.document.texture && token.document.texture.src) {
    try {
      const tokenTexture = await getTexture(token.document.texture.src);
      if (tokenTexture) {
        token.sizeMattersTokenImage = new PIXI.Sprite(tokenTexture);
        token.sizeMattersTokenImage.anchor.set(0.5, 0.5);
        
        // CRÍTICO: Fazer a imagem do token completamente não-interativa
        makeNonInteractive(token.sizeMattersTokenImage);
        
        // FORÇA propriedades adicionais para garantir que não capture cliques
        token.sizeMattersTokenImage.interactive = false;
        token.sizeMattersTokenImage.interactiveChildren = false;
        token.sizeMattersTokenImage.eventMode = 'none';
        token.sizeMattersTokenImage.hitArea = null;
        token.sizeMattersTokenImage.buttonMode = false;
        
        // Se tiver referência ao DOM, aplica pointer-events: none
        if (token.sizeMattersTokenImage.view) {
          token.sizeMattersTokenImage.view.style.pointerEvents = 'none';
          token.sizeMattersTokenImage.view.style.userSelect = 'none';
        }
        
        // Calculate token image size based on grid type and token size
        const gridType = canvas.grid.type;
        const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                           CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
        const gridSize = canvas.grid.size;
        
        let tokenImageSize;
        if (isHexGrid) {
          const hexRadius = gridSize / Math.sqrt(3);
          tokenImageSize = hexRadius * 1.5;
        } else {
          tokenImageSize = gridSize * 0.8;
        }
        
        // Scale the token image to fit the grid cell
        const scaleX = tokenImageSize / tokenTexture.width;
        const scaleY = tokenImageSize / tokenTexture.height;
        const scale = Math.min(scaleX, scaleY);
        token.sizeMattersTokenImage.scale.set(scale, scale);
      }
    } catch (error) {
      console.warn("Size Matters: Falha ao carregar imagem do token", token.id, error);
    }
  }

  let gridDataForDrawing = settings.grid || {};
  let selectedCellsForDrawing = Object.values(gridDataForDrawing).filter(h => h.selected);

  // Se o destaque direcional estiver habilitado para grids hexagonais,
  // e não houver células explicitamente selecionadas no grid personalizado do token,
  // crie um grid temporário de 1x1 para desenhar o contorno.
  if (settings.enableDirectionalHighlight && isHexGrid && selectedCellsForDrawing.length === 0) {
      // Crie um grid dummy representando um único hexágono em (0,0) para fins de desenho.
      gridDataForDrawing = {
          "0,0": { q: 0, r: 0, selected: true, isCenter: true }
      };
      selectedCellsForDrawing = Object.values(gridDataForDrawing); // Agora terá uma célula selecionada.
  }

  // Desenhe os gráficos do grid apenas se houver células selecionadas (personalizadas ou o dummy 1x1)
  if (selectedCellsForDrawing.length > 0) {
    // Get current grid size info from canvas
    const size = canvas.grid.size;
    const hexRadius = isHexGrid ? size / Math.sqrt(3) : null;
    
    // Passe o gridDataForDrawing (modificado se necessário) para createGridGraphics
    token.sizeMattersGrid = createGridGraphics(settings, gridDataForDrawing, hexRadius, size);
    
    // CRÍTICO: Fazer o grid também não-interativo para garantir consistência
    makeNonInteractive(token.sizeMattersGrid);
    
    // FORÇA propriedades adicionais no grid
    token.sizeMattersGrid.interactive = false;
    token.sizeMattersGrid.interactiveChildren = false;
    token.sizeMattersGrid.eventMode = 'none';
    token.sizeMattersGrid.hitArea = null;
    
    token.sizeMattersContainer.addChild(token.sizeMattersGrid);
  }

  // Add effect image (middle layer)
  if (token.sizeMattersImage) {
    token.sizeMattersContainer.addChild(token.sizeMattersImage);
  }

  // Add token image on top (highest layer)
  if (token.sizeMattersTokenImage) {
    token.sizeMattersContainer.addChild(token.sizeMattersTokenImage);
  }

  // Configure o ticker apenas se houver algo para exibir (grid ou imagem)
  if (token.sizeMattersContainer.children.length > 0) {
    setupTicker(token, settings);
  } else {
    // Se não houver nada para exibir, limpe quaisquer gráficos existentes
    clearTokenSizeMattersGraphics(token);
  }
}

export function createGridGraphics(settings, gridData, hexRadius = null, gridSize = null) {
  const graphics = new PIXI.Graphics();
  const selectedCells = Object.values(gridData).filter(h => h.selected);
  if (selectedCells.length === 0) return graphics;

  // Ensure alpha is always a valid number between 0 and 1 for PIXI.js
  const effectiveAlpha = Math.max(0, Math.min(1, parseFloat(settings.alpha) || 0.8));

  const color     = parseInt(settings.color.replace("#", "0x"));
  const fillColor = parseInt(settings.fillColor.replace("#", "0x"));
  const gridType  = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
  const size      = gridSize || canvas.grid.size;

  const enableDirectionalHighlight = settings.enableDirectionalHighlight;

  if (isHexGrid) {
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    const actualHexRadius = hexRadius || (size / Math.sqrt(3));

    // Use the new directional colors utility
    const result = calculateDirectionalColors(selectedCells, actualHexRadius, isPointyTop, settings);
    
    if (result.edges.length === 0) return graphics;

    // Create path from edges for fill
    const path = [];
    if (result.edges.length > 0) {
      // Build path from first and last points of edges
      result.edges.forEach((edge, index) => {
        if (index === 0) {
          path.push(edge.p1.x, edge.p1.y);
        }
        path.push(edge.p2.x, edge.p2.y);
      });
    }

    // Draw fill if enabled
    if (settings.enableFill && path.length > 4) {
      graphics.beginFill(fillColor, effectiveAlpha);
      graphics.drawPolygon(path);
      graphics.endFill();
    }

    // Draw contours if enabled
    if (settings.enableContour) {
      if (enableDirectionalHighlight && result.colors) {
        // Draw directional colored edges
        result.edges.forEach((edge, index) => {
          const edgeColor = result.colors[index];
          graphics.lineStyle(settings.thickness, edgeColor, effectiveAlpha);
          graphics.moveTo(edge.p1.x, edge.p1.y);
          graphics.lineTo(edge.p2.x, edge.p2.y);
        });
      } else {
        // Draw normal outline
        graphics.lineStyle(settings.thickness, color, effectiveAlpha);
        if (path.length > 4) {
          graphics.drawPolygon(path);
        }
      }
    }
  } else {
    // Quadrados (inalterado)
    if (settings.enableFill) graphics.beginFill(fillColor, effectiveAlpha);
    if (settings.enableContour) graphics.lineStyle(settings.thickness, color, effectiveAlpha);
    selectedCells.forEach(cell => {
      const offset = squareToPixel(cell.q, cell.r, size);
      graphics.drawRect(offset.x - size / 2, offset.y - size / 2, size, size);
    });
    if (settings.enableFill) graphics.endFill();
  }

  return graphics;
}

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
    
    // REFORÇA que o container não deve capturar eventos
    container.interactive = false;
    container.interactiveChildren = false;
    container.eventMode = 'none';

    if (token.sizeMattersGrid) {
      token.sizeMattersGrid.visible = (settings.gridVisible !== false);
      token.sizeMattersGrid.position.set(0, 0);
      
      // REFORÇA que o grid não deve capturar eventos
      token.sizeMattersGrid.interactive = false;
      token.sizeMattersGrid.interactiveChildren = false;
      token.sizeMattersGrid.eventMode = 'none';
    }

    if (token.sizeMattersImage) {
      token.sizeMattersImage.visible = (settings.imageVisible !== false);
      token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
      
      const offsetX = settings.imageOffsetX || 0;
      const offsetY = settings.imageOffsetY || 0;
      token.sizeMattersImage.position.set(offsetX, offsetY);
      
      token.sizeMattersImage.rotation = Math.toRadians(settings.imageRotation || 0);
      
      // REFORÇA que a imagem não deve capturar eventos
      token.sizeMattersImage.interactive = false;
      token.sizeMattersImage.interactiveChildren = false;
      token.sizeMattersImage.eventMode = 'none';
      token.sizeMattersImage.hitArea = null;
    }

    if (token.sizeMattersTokenImage) {
      // Token image is always visible when the container is visible
      token.sizeMattersTokenImage.visible = true;
      token.sizeMattersTokenImage.position.set(0, 0); // Centered in container
      
      // REFORÇA que a imagem do token não deve capturar eventos
      token.sizeMattersTokenImage.interactive = false;
      token.sizeMattersTokenImage.interactiveChildren = false;
      token.sizeMattersTokenImage.eventMode = 'none';
      token.sizeMattersTokenImage.hitArea = null;
    }
  };

  token.sizeMattersGridTicker();
  canvas.app.ticker.add(token.sizeMattersGridTicker);
}

function clearTokenSizeMattersGraphics(token) {
  if (!token) return;

  if (token.sizeMattersContainer) {
    try {
      if (token.sizeMattersContainer.parent) {
        token.sizeMattersContainer.parent.removeChild(token.sizeMattersContainer);
      }
      token.sizeMattersContainer.destroy({ children: true, texture: false, baseTexture: false });
    } catch (error) {
      console.warn("Size Matters: Erro ao destruir container", error);
    }
  }
  token.sizeMattersContainer = null;

  if (token.sizeMattersGrid) {
    // Grid is already destroyed as a child of sizeMattersContainer
  }
  token.sizeMattersGrid = null;

  if (token.sizeMattersImage) {
    // Image is already destroyed as a child of sizeMattersContainer
  }
  token.sizeMattersImage = null;

  if (token.sizeMattersTokenImage) {
    // Token image is already destroyed as a child of sizeMattersContainer
  }
  token.sizeMattersTokenImage = null;

  if (token.sizeMattersGridTicker) {
    try {
      canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
    } catch (error) {
      console.warn("Size Matters: Erro ao remover ticker", error);
    }
  }
  token.sizeMattersGridTicker = null;
}

function clearAllSizeMattersGraphics() {
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

export { drawSizeMattersGraphicsForToken, clearTokenSizeMattersGraphics, clearAllSizeMattersGraphics }