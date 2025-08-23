/**
 * directional-utils.js
 * Utilitários para cálculo de cores direcionais em grids hexagonais.
 */

import { axialToPixel, getHexVertices, getEdgeKey } from './grid-utils.js';
import { DIRECTIONAL_COLORS } from './constants.js';

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
 * Calcula as cores direcionais para arestas de um grid hexagonal
 * @param {Array} selectedCells - Células selecionadas
 * @param {Number} hexRadius - Raio do hexágono
 * @param {Boolean} isPointyTop - Se hexágono tem topo pontudo
 * @param {Object} settings - Configurações incluindo ajustes manuais
 * @returns {Object} Resultado com edges e cores
 */
export function calculateDirectionalColors(selectedCells, hexRadius, isPointyTop, settings) {
  const { RED, GREEN, YELLOW: YELL } = DIRECTIONAL_COLORS;
  const edgeCounts = new Map();
  const edgesRaw = [];

  // Gerar todas as arestas
  for (const cell of selectedCells) {
    const offset = axialToPixel(cell.q, cell.r, hexRadius, isPointyTop);
    const verts = getHexVertices(offset.x, offset.y, hexRadius, isPointyTop);
    for (let i = 0; i < 6; i++) {
      const p1 = verts[i];
      const p2 = verts[(i + 1) % 6];
      const key = getEdgeKey(p1, p2);
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      edgesRaw.push({ key, p1, p2, edgeIndex: i });
    }
  }

  const outlineEdges = edgesRaw.filter(e => edgeCounts.get(e.key) === 1);
  if (outlineEdges.length === 0) return { edges: [], colors: [] };

  // Caso especial para hexágono único com flat-top
  if (selectedCells.length === 1 && !isPointyTop) {
    const colors = outlineEdges.map(edge => {
      switch (edge.edgeIndex) {
        case 4: return RED;
        case 0: case 1: case 2: return GREEN;
        case 3: case 5: return YELL;
        default: return parseInt(settings.color?.replace("#", "0x")) || RED;
      }
    });
    return { edges: outlineEdges, colors };
  }

  // Lógica completa para múltiplos hexágonos
  const path = getOutlinePath(new Set(outlineEdges.map(e => e.key)), edgesRaw);
  if (path.length < 2) return { edges: [], colors: [] };

  const gridWidth = getGridWidth(selectedCells);
  const gridHeight = getGridHeight(selectedCells);
  
  const edges = [];
  for (let i = 0; i < path.length - 1; i++) {
    edges.push({ p1: path[i], p2: path[i + 1] });
  }
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
  const Y_TOL = Math.max(3.0, hexRadius * 0.1);

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

  return { edges: typed, colors: col };
}