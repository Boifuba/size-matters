/**
 * Grid utility functions for coordinate calculations
 */

/**
 * Converts axial coordinates to pixel coordinates for hex grids
 * @param {number} q - Q coordinate (axial)
 * @param {number} r - R coordinate (axial)
 * @param {number} radius - Hex radius
 * @param {boolean} pointy - Whether the hex is pointy-top
 * @returns {Object} Pixel coordinates {x, y}
 */
export function axialToPixel(q, r, radius, pointy) {
  return pointy
    ? { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r }
    : { x: radius * 1.5 * q, y: radius * Math.sqrt(3) * (r + q / 2) };
}

/**
 * Converts square grid coordinates to pixel coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Grid cell size
 * @returns {Object} Pixel coordinates {x, y}
 */
export function squareToPixel(x, y, size) {
  return { x: x * size, y: y * size };
}