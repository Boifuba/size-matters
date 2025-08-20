/**
 * grid-utils.js
 * Funções de utilidade para cálculos de coordenadas e geometria da grade.
 */

/**
 * Converte coordenadas axiais para coordenadas de pixel para grades hexagonais.
 * @param {number} q - Coordenada Q (axial)
 * @param {number} r - Coordenada R (axial)
 * @param {number} radius - Raio do hexágono
 * @param {boolean} pointy - Se o hexágono tem o topo pontudo
 * @returns {Object} Coordenadas de pixel {x, y}
 */
export function axialToPixel(q, r, radius, pointy) {
  return pointy
    ? { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r }
    : { x: radius * 1.5 * q, y: radius * Math.sqrt(3) * (r + q / 2) };
}

/**
 * Converte coordenadas de grade quadrada para coordenadas de pixel.
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @param {number} size - Tamanho da célula da grade
 * @returns {Object} Coordenadas de pixel {x, y}
 */
export function squareToPixel(x, y, size) {
  return { x: x * size, y: y * size };
}

/**
 * Retorna os 6 vértices de um hexágono.
 * @param {number} cx - Centro X
 * @param {number} cy - Centro Y
 * @param {number} r - Raio
 * @param {boolean} pointy - Se o topo é pontudo
 * @returns {Array<Object>} Lista de vértices {x, y}
 */
export function getHexVertices(cx, cy, r, pointy) {
    const vertices = [];
    const startAngle = pointy ? -Math.PI / 2 : 0;
    for (let i = 0; i < 6; i++) {
        const angle = startAngle + i * Math.PI / 3;
        vertices.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle)
        });
    }
    return vertices;
}

/**
 * Cria uma chave única para uma aresta para facilitar a contagem.
 * A chave é a mesma independentemente da ordem dos pontos (p1 -> p2 vs p2 -> p1).
 * @param {Object} p1 - Ponto 1 {x, y}
 * @param {Object} p2 - Ponto 2 {x, y}
 * @returns {string} Chave da aresta
 */
export function getEdgeKey(p1, p2) {
    // Arredonda para evitar problemas de precisão com ponto flutuante
    const p1x = p1.x.toFixed(5);
    const p1y = p1.y.toFixed(5);
    const p2x = p2.x.toFixed(5);
    const p2y = p2.y.toFixed(5);

    // Ordena os pontos para garantir que a chave seja consistente
    if (p1x < p2x || (p1x === p2x && p1y < p2y)) {
        return `${p1x},${p1y}:${p2x},${p2y}`;
    }
    return `${p2x},${p2y}:${p1x},${p1y}`;
}
