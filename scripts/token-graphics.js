/**
 * token-graphics.js
 * Utilitários de renderização de gráficos para tokens.
 */

import { axialToPixel, squareToPixel, getHexVertices, getEdgeKey } from './grid-utils.js';
import { DIRECTIONAL_COLORS, DEFAULT_SETTINGS } from './constants.js';
import { getTexture, clearTextureCache, getCacheSize } from './texture-utils.js';

// ================================
// TOKEN GRAPHICS LOGIC
// ================================

// Função auxiliar para reconstruir o caminho do contorno
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
 * Desenha os gráficos do Size Matters para um token.
 * @param {Token} token - O token para o qual desenhar os gráficos.
 */
export async function drawSizeMattersGraphicsForToken(token) {
  if (!token || !token.document) return;

  let settings = token.document.getFlag('size-matters', 'settings');
  const gridType = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                     CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);

  // Sempre obtenha o valor atual e global da configuração de destaque direcional
  const globalEnableDirectionalHighlight = game.settings.get("size-matters", "enableDirectionalHighlight");

  // Se não houver configurações específicas do token, crie um conjunto padrão.
  if (!settings) {
    settings = { ...DEFAULT_SETTINGS, grid: {} };
  }

  // Sobrescreva a configuração de destaque direcional com o valor global atual
  settings.enableDirectionalHighlight = globalEnableDirectionalHighlight;

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
      console.warn("Size Matters: Falha ao carregar imagem para o token", token.id, error);
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
    token.sizeMattersContainer.addChild(token.sizeMattersGrid);
  }

  if (token.sizeMattersImage) {
    token.sizeMattersContainer.addChild(token.sizeMattersImage);
  }

  // Configure o ticker apenas se houver algo para exibir (grid ou imagem)
  if (token.sizeMattersContainer.children.length > 0) {
    setupTicker(token, settings);
  } else {
    // Se não houver nada para exibir, limpe quaisquer gráficos existentes
    clearTokenSizeMattersGraphics(token);
  }
}

/**
 * Encontra arestas conectadas a uma aresta específica
 * @param {Number} targetIndex - Índice da aresta alvo
 * @param {Array} edges - Array de arestas
 * @returns {Array} Índices das arestas conectadas
 */
function findConnectedEdges(targetIndex, edges) {
  const targetEdge = edges[targetIndex];
  const connected = [];
  const VERTEX_TOLERANCE = 0.5; // Aumentar tolerância
  
  for (let i = 0; i < edges.length; i++) {
    if (i === targetIndex) continue;
    
    const edge = edges[i];
    
    // Verifica se compartilha um vértice com tolerância maior
    const sharesVertex = (
      (Math.abs(edge.p1.x - targetEdge.p1.x) < VERTEX_TOLERANCE && Math.abs(edge.p1.y - targetEdge.p1.y) < VERTEX_TOLERANCE) ||
      (Math.abs(edge.p1.x - targetEdge.p2.x) < VERTEX_TOLERANCE && Math.abs(edge.p1.y - targetEdge.p2.y) < VERTEX_TOLERANCE) ||
      (Math.abs(edge.p2.x - targetEdge.p1.x) < VERTEX_TOLERANCE && Math.abs(edge.p2.y - targetEdge.p1.y) < VERTEX_TOLERANCE) ||
      (Math.abs(edge.p2.x - targetEdge.p2.x) < VERTEX_TOLERANCE && Math.abs(edge.p2.y - targetEdge.p2.y) < VERTEX_TOLERANCE)
    );
    
    if (sharesVertex) {
      connected.push(i);
    }
  }
  
  return connected;
}

/**
 * Calcula a largura do grid contando as colunas (q) únicas.
 * @param {Array} selectedCells - Array de células de hexágono selecionadas.
 * @returns {Number} Largura do grid em unidades de hexágono.
 */
function getGridWidth(selectedCells) {
    if (!selectedCells || selectedCells.length === 0) return 0;
    const qCoordinates = selectedCells.map(cell => cell.q);
    const uniqueQ = new Set(qCoordinates);
    return uniqueQ.size;
}

/**
 * Calcula a altura do grid contando as linhas (r) únicas.
 * @param {Array} selectedCells - Array de células de hexágono selecionadas.
 * @returns {Number} Altura do grid em unidades de hexágono.
 */
function getGridHeight(selectedCells) {
    if (!selectedCells || selectedCells.length === 0) return 0;
    const rCoordinates = selectedCells.map(cell => cell.r);
    const uniqueR = new Set(rCoordinates);
    return uniqueR.size;
}

export function createGridGraphics(settings, gridData, hexRadius = null, gridSize = null) {
  const graphics = new PIXI.Graphics();
  const selectedCells = Object.values(gridData).filter(h => h.selected);
  if (selectedCells.length === 0) return graphics;

  const color     = parseInt(settings.color.replace("#", "0x"));
  const fillColor = parseInt(settings.fillColor.replace("#", "0x"));
  const gridType  = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
  const size      = gridSize || canvas.grid.size;

  const enableDirectionalHighlight = settings.enableDirectionalHighlight;
  const { RED, GREEN, YELLOW: YELL } = DIRECTIONAL_COLORS;

  if (isHexGrid) {
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    const actualHexRadius = hexRadius || (size / Math.sqrt(3));
    const edgeCounts  = new Map();
    const edgesRaw    = [];

    for (const cell of selectedCells) {
      const offset  = axialToPixel(cell.q, cell.r, actualHexRadius, isPointyTop);
      const verts   = getHexVertices(offset.x, offset.y, actualHexRadius, isPointyTop);
      for (let i = 0; i < 6; i++) {
        const p1 = verts[i];
        const p2 = verts[(i + 1) % 6];
        const key = getEdgeKey(p1, p2);
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
        edgesRaw.push({ key, p1, p2, edgeIndex: i });
      }
    }

    const outlineEdges = edgesRaw.filter(e => edgeCounts.get(e.key) === 1);
    if (outlineEdges.length === 0) return graphics;

    // Regra especial para hexágono único
    if (enableDirectionalHighlight && selectedCells.length === 1 && !isPointyTop) {
        if (settings.enableFill) {
            const path = getOutlinePath(new Set(outlineEdges.map(e => e.key)), edgesRaw);
            graphics.beginFill(fillColor, settings.alpha);
            graphics.drawPolygon(path.flatMap(p => [p.x, p.y]));
            graphics.endFill();
        }
        if (settings.enableContour) {
            for (const edge of outlineEdges) {
                let edgeColor;
                switch (edge.edgeIndex) {
                    case 4: edgeColor = RED; break;
                    case 0: case 1: case 2: edgeColor = GREEN; break;
                    case 3: case 5: edgeColor = YELL; break;
                    default: edgeColor = color;
                }
                graphics.lineStyle(settings.thickness, edgeColor, settings.alpha);
                graphics.moveTo(edge.p1.x, edge.p1.y);
                graphics.lineTo(edge.p2.x, edge.p2.y);
            }
        }
        return graphics;
    }

    const path = getOutlinePath(new Set(outlineEdges.map(e => e.key)), edgesRaw);
    if (path.length < 2) return graphics;

    if (settings.enableFill) {
      graphics.beginFill(fillColor, settings.alpha);
      graphics.drawPolygon(path.flatMap(p => [p.x, p.y]));
      graphics.endFill();
    }

    if (!settings.enableContour) return graphics;

    if (enableDirectionalHighlight) {
      const gridWidth = getGridWidth(selectedCells);
      const gridHeight = getGridHeight(selectedCells);
      
      const edges = [];
      for (let i = 0; i < path.length - 1; i++) edges.push({ p1: path[i], p2: path[i + 1] });
      const first = path[0], last = path[path.length - 1];
      if (Math.abs(first.x - last.x) > 0.1 || Math.abs(first.y - last.y) > 0.1) {
        edges.push({ p1: last, p2: first });
      }

      let minY = Infinity, maxY = -Infinity;
      for (const e of edges) {
        minY = Math.min(minY, e.p1.y, e.p2.y);
        maxY = Math.max(maxY, e.p1.y, e.p2.y);
      }

      const ANG_TOL = 0.15;
      const Y_TOL   = Math.max(3.0, size * 0.1);

      const typed = edges.map(e => {
        const vx = e.p2.x - e.p1.x, vy = e.p2.y - e.p1.y;
        const len = Math.hypot(vx, vy) || 1;
        const isHorizontal = Math.abs(vy / len) < ANG_TOL;
        const yMid = (e.p1.y + e.p2.y) / 2;
        const isNorthTop = isHorizontal && Math.abs(yMid - minY) <= Y_TOL;
        const isSouthBot = isHorizontal && Math.abs(yMid - maxY) <= Y_TOL;
        return { ...e, isHorizontal, isNorthTop, isSouthBot };
      });

      const N = typed.length;
      const col = new Array(N).fill(YELL);

      // PASSO 1: Aplicar regras básicas (limitadas)
      
      // VERMELHO - expansão básica limitada
      const northEdges = [];
      for (let i = 0; i < N; i++) {
        if (typed[i].isNorthTop) {
          col[i] = RED;
          northEdges.push(i);
        }
      }
      
      
      if (northEdges.length > 0) {
        // Expansão básica limitada do vermelho
        const baseRedExpansion = Math.max(1, gridWidth - 1);
        
        let currentRedEdges = [...northEdges];
        let allRedEdges = [...northEdges];
        
        for (let layer = 0; layer < baseRedExpansion; layer++) {
          if (currentRedEdges.length === 0) break;
          
          const nextLayerEdges = [];
          for (const redIndex of currentRedEdges) {
            const connected = findConnectedEdges(redIndex, typed);
            for (const index of connected) {
              if (col[index] === YELL && !allRedEdges.includes(index)) {
                col[index] = RED;
                nextLayerEdges.push(index);
                allRedEdges.push(index);
              }
            }
          }
          currentRedEdges = [...new Set(nextLayerEdges)];
        }
      }

      // VERDE - expansão básica limitada
      let currentGreenEdges = [];
      for (let i = 0; i < N; i++) {
        if (typed[i].isSouthBot && col[i] !== RED) {
          col[i] = GREEN;
          currentGreenEdges.push(i);
        }
      }
      

      let allGreenEdges = [...currentGreenEdges];
      
      const baseGreenExpansion = Math.max(1, gridHeight - 1);

      for (let layer = 0; layer < baseGreenExpansion; layer++) {
        if (currentGreenEdges.length === 0) break;
        
        const nextLayerEdges = [];
        for (const greenIndex of currentGreenEdges) {
          const connected = findConnectedEdges(greenIndex, typed);
          for (const index of connected) {
            if (col[index] === YELL && !allGreenEdges.includes(index)) {
              col[index] = GREEN;
              nextLayerEdges.push(index);
              allGreenEdges.push(index);
            }
          }
        }
        currentGreenEdges = [...new Set(nextLayerEdges)];
      }

      // PASSO 2: Aplicar ajustes manuais ILIMITADOS
      
      // Ajuste manual do VERMELHO (pode ser positivo ou negativo)
      const redAdjustment = settings.redLineAdjustment || 0;
      
      if (redAdjustment > 0) {
        // Adicionar mais camadas vermelhas - EXPANSÃO AGRESSIVA (IGNORA REGRAS AUTOMÁTICAS)
        let currentRedEdges = [];
        for (let i = 0; i < N; i++) {
          if (col[i] === RED) currentRedEdges.push(i);
        }
        
        for (let layer = 0; layer < redAdjustment; layer++) {
          const nextLayerEdges = [];
          
          // EXPANSÃO AGRESSIVA: Converte QUALQUER edge adjacente que não seja vermelha
          for (const redIndex of currentRedEdges) {
            const connected = findConnectedEdges(redIndex, typed);
            for (const index of connected) {
              if (col[index] !== RED && !nextLayerEdges.includes(index)) {
                nextLayerEdges.push(index);
              }
            }
          }
          
          // Aplicar as mudanças
          for (const idx of nextLayerEdges) {
            col[idx] = RED;
          }
          
          currentRedEdges = [...nextLayerEdges];
          
          // Se não conseguiu expandir nada, para
          if (nextLayerEdges.length === 0) {
            break;
          }
        }
      } else if (redAdjustment < 0) {
        // Remover camadas vermelhas (convertendo para amarelo)
        const layersToRemove = Math.abs(redAdjustment);
        for (let layer = 0; layer < layersToRemove; layer++) {
          const edgesToRemove = [];
          
          // Encontrar edges vermelhas que estão na borda (conectadas a não-vermelhas)
          for (let i = 0; i < N; i++) {
            if (col[i] === RED) {
              const connected = findConnectedEdges(i, typed);
              const hasNonRedNeighbor = connected.some(idx => col[idx] !== RED);
              if (hasNonRedNeighbor) {
                edgesToRemove.push(i);
              }
            }
          }
          
          // Converter para amarelo
          for (const idx of edgesToRemove) {
            col[idx] = YELL;
          }
          
          
          if (edgesToRemove.length === 0) break; // Não há mais edges para remover
        }
      }
      
      // Ajuste manual do VERDE (pode ser positivo ou negativo)
      const greenAdjustment = settings.greenLineAdjustment || 0;
      
      if (greenAdjustment > 0) {
        // Adicionar mais camadas verdes - EXPANSÃO AGRESSIVA (IGNORA REGRAS AUTOMÁTICAS)
        let currentGreenEdges = [];
        for (let i = 0; i < N; i++) {
          if (col[i] === GREEN) currentGreenEdges.push(i);
        }
        
        for (let layer = 0; layer < greenAdjustment; layer++) {
          const nextLayerEdges = [];
          
          // EXPANSÃO AGRESSIVA: Converte QUALQUER edge adjacente que não seja verde
          for (const greenIndex of currentGreenEdges) {
            const connected = findConnectedEdges(greenIndex, typed);
            for (const index of connected) {
              if (col[index] !== GREEN && !nextLayerEdges.includes(index)) {
                nextLayerEdges.push(index);
              }
            }
          }
          
          // Aplicar as mudanças
          for (const idx of nextLayerEdges) {
            col[idx] = GREEN;
          }
          
          currentGreenEdges = [...nextLayerEdges];
          
          // Se não conseguiu expandir nada, para
          if (nextLayerEdges.length === 0) {
            break;
          }
        }
      } else if (greenAdjustment < 0) {
        // Remover camadas verdes (convertendo para amarelo)
        const layersToRemove = Math.abs(greenAdjustment);
        for (let layer = 0; layer < layersToRemove; layer++) {
          const edgesToRemove = [];
          
          // Encontrar edges verdes que estão na borda (conectadas a não-verdes)
          for (let i = 0; i < N; i++) {
            if (col[i] === GREEN) {
              const connected = findConnectedEdges(i, typed);
              const hasNonGreenNeighbor = connected.some(idx => col[idx] !== GREEN);
              if (hasNonGreenNeighbor) {
                edgesToRemove.push(i);
              }
            }
          }
          
          // Converter para amarelo
          for (const idx of edgesToRemove) {
            col[idx] = YELL;
          }
          
          
          if (edgesToRemove.length === 0) break; // Não há mais edges para remover
        }
      }
      
      // Desenho do contorno colorido
      for (let i = 0; i < N; i++) {
        graphics.lineStyle(settings.thickness, col[i], settings.alpha);
        graphics.moveTo(typed[i].p1.x, typed[i].p1.y);
        graphics.lineTo(typed[i].p2.x, typed[i].p2.y);
      }
    } else {
      graphics.lineStyle(settings.thickness, color, settings.alpha);
      graphics.drawPolygon(path.flatMap(p => [p.x, p.y]));
    }
  } else {
    // Quadrados (inalterado)
    if (settings.enableFill) graphics.beginFill(fillColor, settings.alpha);
    if (settings.enableContour) graphics.lineStyle(settings.thickness, color, settings.alpha);
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

export function clearTokenSizeMattersGraphics(token) {
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
    try {
      if (token.sizeMattersGrid.parent) {
        token.sizeMattersGrid.parent.removeChild(token.sizeMattersGrid);
      }
      token.sizeMattersGrid.clear();
      token.sizeMattersGrid.destroy(true);
    } catch (error) {
      console.warn("Size Matters: Erro ao destruir gráficos da grade", error);
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
      console.warn("Size Matters: Erro ao destruir sprite da imagem", error);
    }
  }
  token.sizeMattersImage = null;

  if (token.sizeMattersGridTicker) {
    try {
      canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
    } catch (error) {
      console.warn("Size Matters: Erro ao remover ticker", error);
    }
  }
  token.sizeMattersGridTicker = null;
}

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