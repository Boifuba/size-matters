/**
 * Texture loading and caching utilities
 */

// Simple texture cache
const textureCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Gets a texture from cache or loads it from URL
 * @param {string} url - Texture URL
 * @returns {Promise<PIXI.Texture|null>} The loaded texture or null if failed
 */
export async function getTexture(url) {
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  try {
    const texture = await PIXI.Texture.fromURL(url);
    
    if (texture.baseTexture.resource && texture.baseTexture.resource.source) {
      const videoSource = texture.baseTexture.resource.source;
      
      if (videoSource instanceof HTMLVideoElement) {
        videoSource.loop = true;
        videoSource.muted = true;
        await videoSource.play();
      }
    }
    
    if (textureCache.size >= MAX_CACHE_SIZE) {
      const firstKey = textureCache.keys().next().value;
      const oldTexture = textureCache.get(firstKey);
      oldTexture.destroy(true);
      textureCache.delete(firstKey);
    }
    
    textureCache.set(url, texture);
    return texture;
  } catch (error) {
    console.warn("Size Matters: Failed to load texture", url, error);
    return null;
  }
}

/**
 * Clears all cached textures
 */
export function clearTextureCache() {
  textureCache.forEach((texture, url) => {
    texture.destroy(true);
  });
  textureCache.clear();
}

/**
 * Gets the current cache size
 * @returns {number} Number of cached textures
 */
export function getCacheSize() {
  return textureCache.size;
}