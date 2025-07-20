// Import ride functionality
// Import ride restoration function
import {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags
} from './ride-core.js';

// Simple texture cache
const textureCache = new Map();
const MAX_CACHE_SIZE = 50;

// Utility functions moved outside the class for global access
function axialToPixel(q, r, radius, pointy) {
  return pointy
    ? { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r }
    : { x: radius * 1.5 * q, y: radius * Math.sqrt(3) * (r + q / 2) };
}

function squareToPixel(x, y, size) {
  return { x: x * size, y: y * size };
}

function drawHex(g, cx, cy, r, pointy) {
  const startAngle = pointy ? -Math.PI / 2 : 0;
  g.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
  for (let i = 1; i <= 6; i++) {
    const angle = startAngle + i * Math.PI / 3;
    g.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
}

function drawSquare(g, x, y, size) {
  g.drawRect(x, y, size, size);
}

// Global function to draw Size Matters graphics for a token

async function drawSizeMattersGraphicsForToken(token) {
  if (!token || !token.document) return;

  const settings = token.document.getFlag('size-matters', 'settings');
  if (!settings) return;

  clearTokenSizeMattersGraphics(token);

  // 1. CRIA UM CONTÊINER PARA TODOS OS GRÁFICOS
  // Este contêiner será movido pelo ticker.
  token.sizeMattersContainer = new PIXI.Container();

  // 2. ADICIONA O CONTÊINER À CAMADA CORRETA
  // A camada 'primary' fica abaixo da visão ('effects').
  canvas.primary.addChild(token.sizeMattersContainer);

  // Handle image sprite
  if (settings.imageUrl && settings.imageUrl.trim()) {
    try {
      const texture = await getTexture(settings.imageUrl);
      if (texture) {
        token.sizeMattersImage = new PIXI.Sprite(texture);
        token.sizeMattersImage.anchor.set(0.5, 0.5);
        
        // 3. Adiciona a imagem DENTRO do nosso contêiner
        token.sizeMattersContainer.addChild(token.sizeMattersImage);
      }
    } catch (error) {
      console.warn("Size Matters: Failed to load image for token", token.id, error);
    }
  }

  // Handle grid graphics
  const selectedCells = Object.values(settings.grid || {}).filter(h => h.selected);
  if (selectedCells.length > 0) {
    token.sizeMattersGrid = createGridGraphics(settings, settings.grid);
    
    // 4. Adiciona o grid DENTRO do nosso contêiner
    token.sizeMattersContainer.addChild(token.sizeMattersGrid);
  }

  // Se o contêiner tem algo dentro, ativa o ticker para posicioná-lo.
  if (token.sizeMattersContainer.children.length > 0) {
    setupTicker(token, settings);
  } else {
    // Se não há nada para desenhar, limpa o contêiner vazio.
    clearTokenSizeMattersGraphics(token);
  }
}





// Simple texture cache function
// Simple texture cache function
async function getTexture(url) {
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  try {
    // Carrega a textura da URL
    const texture = await PIXI.Texture.fromURL(url);
    
    // NOVO: Verifica se a textura tem um recurso de vídeo (como .webm)
    if (texture.baseTexture.resource && texture.baseTexture.resource.source) {
      const videoSource = texture.baseTexture.resource.source;
      
      // Verifica se é um elemento de vídeo HTML
      if (videoSource instanceof HTMLVideoElement) {
        videoSource.loop = true; // <<< AQUI ESTÁ A MÁGICA!
        videoSource.muted = true; // Necessário para autoplay na maioria dos navegadores
        await videoSource.play();      // Inicia a reprodução da animação
      }
    }
    
    // Gerencia o tamanho do cache
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


// Create grid graphics
function createGridGraphics(settings, gridData) {
  const graphics = new PIXI.Graphics();
  
  // Pre-calculate colors once
  const color = parseInt(settings.color.replace('#', '0x'));
  const fillColor = parseInt(settings.fillColor.replace('#', '0x'));
  
  // Set line style once if needed
  if (settings.enableContour) {
    graphics.lineStyle(settings.thickness, color, settings.alpha);
  }
  
  // Batch all drawing operations
  const selectedCells = Object.values(gridData).filter(h => h.selected);
  
  if (settings.enableFill) {
    graphics.beginFill(fillColor, settings.alpha);
  }
  
  // Draw all shapes in one batch
  selectedCells.forEach(cell => {
    drawCell(graphics, cell, settings);
  });
  
  if (settings.enableFill) {
    graphics.endFill();
  }
  
  return graphics;
}

function drawCell(graphics, cell, settings) {
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

function drawHexOptimized(graphics, cx, cy, r, pointy) {
  const startAngle = pointy ? -Math.PI / 2 : 0;
  const points = [];
  
  for (let i = 0; i <= 6; i++) {
    const angle = startAngle + i * Math.PI / 3;
    points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  
  graphics.drawPolygon(points);
}

// function setupImageTicker(token, settings) {
//   if (token.sizeMattersGridTicker) {
//     try {
//       canvas.app.ticker.remove(token.sizeMattersGridTicker);
//     } catch (error) {
//       console.warn("Size Matters: Error removing ticker", error);
//     }
//   }

//   token.sizeMattersGridTicker = () => {
//     if (!token || !token.document || !token.center || !canvas || !canvas.tokens) {
//       if (token && token.sizeMattersGridTicker) {
//         canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
//         token.sizeMattersGridTicker = null;
//       }
//       return;
//     }

//     if (!canvas.tokens.placeables.includes(token)) {
//       if (token.sizeMattersGridTicker) {
//         canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
//         token.sizeMattersGridTicker = null;
//       }
//       return;
//     }

//     try {
//       const centerX = token.center.x;
//       const centerY = token.center.y;
//       const tokenRotation = Math.toRadians(token.document.rotation || 0);

//       if (token.sizeMattersImage && token.sizeMattersImage.parent) {
//         let offsetX = settings.imageOffsetX || 0;
//         let offsetY = settings.imageOffsetY || 0;

//         if (tokenRotation !== 0) {
//           const cos = Math.cos(tokenRotation);
//           const sin = Math.sin(tokenRotation);
//           const rotatedX = offsetX * cos - offsetY * sin;
//           const rotatedY = offsetX * sin + offsetY * cos;
//           offsetX = rotatedX;
//           offsetY = rotatedY;
//         }

//         token.sizeMattersImage.position.set(centerX + offsetX, centerY + offsetY);

//         const imageRotation = Math.toRadians(settings.imageRotation || 0);
//         token.sizeMattersImage.rotation = tokenRotation + imageRotation;

//         token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
//       }
//     } catch (error) {
//       console.warn("Size Matters: Error in ticker, removing ticker", error);
//       if (token.sizeMattersGridTicker) {
//         canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
//         token.sizeMattersGridTicker = null;
//       }
//     }
//   };

//   canvas.app.ticker.add(token.sizeMattersGridTicker);
// }

function setupTicker(token, settings) {
  if (token.sizeMattersGridTicker) {
    canvas.app.ticker.remove(token.sizeMattersGridTicker);
  }

  token.sizeMattersGridTicker = () => {
    // Verifica se o token e nosso contêiner ainda existem.
    if (!token || !token.document || !token.center || !token.sizeMattersContainer || !token.sizeMattersContainer.parent) {
      if (token && token.sizeMattersGridTicker) {
        canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
        token.sizeMattersGridTicker = null;
      }
      return;
    }

    const container = token.sizeMattersContainer;
    const tokenRotation = Math.toRadians(token.document.rotation || 0);

    // 1. POSICIONA O CONTÊINER INTEIRO
    // O contêiner é movido para o centro exato do token.
    container.position.set(token.center.x, token.center.y);
    container.rotation = tokenRotation;
    container.visible = token.visible;

    // 2. POSICIONA OS GRÁFICOS DENTRO DO CONTÊINER
    // A posição deles agora é relativa ao centro do contêiner (que é o centro do token).
    
    if (token.sizeMattersGrid) {
      token.sizeMattersGrid.visible = (settings.gridVisible !== false);
      // O grid fica em (0,0) dentro do contêiner, pois já é desenhado em volta do centro.
      token.sizeMattersGrid.position.set(0, 0);
    }

    if (token.sizeMattersImage) {
      token.sizeMattersImage.visible = (settings.imageVisible !== false);
      token.sizeMattersImage.scale.set(settings.imageScale || 1.0);
      
      // O offset da imagem é aplicado a partir do centro (0,0) do contêiner.
      const offsetX = settings.imageOffsetX || 0;
      const offsetY = settings.imageOffsetY || 0;
      token.sizeMattersImage.position.set(offsetX, offsetY);
      
      // A rotação da imagem é relativa à rotação do contêiner.
      token.sizeMattersImage.rotation = Math.toRadians(settings.imageRotation || 0);
    }
  };

  // Executa uma vez para posicionar imediatamente.
  token.sizeMattersGridTicker();
  canvas.app.ticker.add(token.sizeMattersGridTicker);
}

function clearTokenSizeMattersGraphics(token) {
  if (!token) return;

  // Safe graphics cleanup
  if (token.sizeMattersGrid) {
    try {
      if (token.sizeMattersGrid.parent) {
        token.sizeMattersGrid.parent.removeChild(token.sizeMattersGrid);
      }
      token.sizeMattersGrid.clear();
      token.sizeMattersGrid.destroy(true); // Destroy with textures
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
      token.sizeMattersImage.destroy(false); // Don't destroy shared textures
    } catch (error) {
      console.warn("Size Matters: Error destroying image sprite", error);
    }
  }
  token.sizeMattersImage = null;

  // Safe ticker cleanup
  if (token.sizeMattersGridTicker) {
    try {
      canvas.app?.ticker?.remove(token.sizeMattersGridTicker);
    } catch (error) {
      console.warn("Size Matters: Error removing ticker", error);
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

class RideManagerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.selectedLeader = null;
    this.selectedFollowers = new Set();
    this.activeGroups = new Map();
    this.initializeFromControlledTokens();
    this.loadActiveGroups();
  }

  initializeFromControlledTokens() {
    const controlledTokens = canvas.tokens.controlled;
    
    if (controlledTokens.length > 0) {
      // Set the first controlled token as leader
      this.selectedLeader = controlledTokens[0].id;
      
      // Set remaining controlled tokens as followers
      for (let i = 1; i < controlledTokens.length; i++) {
        this.selectedFollowers.add(controlledTokens[i].id);
      }
      
      console.log("Size Matters: Initialized ride manager with controlled tokens", {
        leader: this.selectedLeader,
        followers: Array.from(this.selectedFollowers)
      });
    }
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ride-manager",
      title: "Ride Manager",
      template: "modules/size-matters/templates/ride-manager-dialog.html",
      width: 500,
      height: "auto",
      resizable: false,
      closeOnSubmit: false
    });
  }

  getData() {
    // Get all tokens that are currently following someone (either as leader or follower)
    const tokensInActiveRides = new Set();
    
    // Add all leaders to the set
    this.activeGroups.forEach((group, leaderId) => {
      tokensInActiveRides.add(leaderId);
      // Add all followers to the set
      group.followers.forEach((follower, followerId) => {
        tokensInActiveRides.add(followerId);
      });
    });

    // Filter out tokens that are already in active rides
    const availableTokens = canvas.tokens.placeables
      .filter(token => !tokensInActiveRides.has(token.id))
      .map(token => ({
        id: token.id,
        name: token.name || "Unnamed Token",
        controlled: token.controlled,
        isSelectedLeader: this.selectedLeader === token.id,
        isSelectedFollower: this.selectedFollowers.has(token.id)
      }));

    const activeGroupsArray = Array.from(this.activeGroups.entries()).map(([leaderId, group]) => ({
      leaderId: leaderId,
      leaderName: group.leaderName,
      followers: Array.from(group.followers.entries()).map(([followerId, follower]) => ({
        id: followerId,
        name: follower.name
      }))
    }));

    return {
      availableTokens: availableTokens,
      activeGroups: activeGroupsArray,
      selectedLeader: this.selectedLeader,
      selectedFollowers: Array.from(this.selectedFollowers)
    };
  }

  loadActiveGroups() {
    this.activeGroups = getActiveRideGroups();
  }

  async startRide() {
    if (!this.selectedLeader || this.selectedFollowers.size === 0) {
      ui.notifications.warn("Select a leader and at least one follower!");
      return;
    }

    // Ensure leader token is selected
    const leaderToken = canvas.tokens.get(this.selectedLeader);
    if (leaderToken && !leaderToken.controlled) {
      leaderToken.control({ releaseOthers: true });
    }
    
    // Ensure all follower tokens are selected
    for (const followerId of this.selectedFollowers) {
      const followerToken = canvas.tokens.get(followerId);
      if (followerToken && !followerToken.controlled) {
        followerToken.control({ releaseOthers: false });
      }
    }
    if (!leaderToken) {
      ui.notifications.error("Leader token not found!");
      return;
    }

    console.log("Size Matters DEBUG: ===== UI STARTING RIDE =====");
    console.log("Size Matters DEBUG: RideManagerApp starting ride", {
      selectedLeader: this.selectedLeader,
      selectedFollowers: Array.from(this.selectedFollowers),
      leaderToken: !!leaderToken,
      leaderName: leaderToken.name
    });

    // Build followers map
    const followersMap = new Map();
    for (const followerId of this.selectedFollowers) {
      const followerToken = canvas.tokens.get(followerId);
      if (followerToken) {
        followersMap.set(followerId, {
          name: followerToken.name || "Unnamed Token",
          hookId: null
        });
        console.log("Size Matters DEBUG: Added follower to map", {
          followerId: followerId,
          followerName: followerToken.name
        });
      } else {
        console.warn("Size Matters DEBUG: Follower token not found", {
          followerId: followerId
        });
      }
    }

    console.log("Size Matters DEBUG: Final followers map", {
      followersCount: followersMap.size,
      followers: Array.from(followersMap.entries())
    });

    try {
      // Use the ride-core function to start the ride
      console.log("Size Matters DEBUG: About to call startTokenRide...");
      await startTokenRide(leaderToken, followersMap);
      console.log("Size Matters DEBUG: startTokenRide completed successfully");

      // Update local state
      this.activeGroups.set(this.selectedLeader, {
        leaderName: leaderToken.name || "Unnamed Token",
        followers: followersMap
      });

      // Reset selection
      this.selectedLeader = null;
      this.selectedFollowers.clear();
      this.render();
      
      console.log("Size Matters DEBUG: Ride started successfully through UI");
    } catch (error) {
      console.error("Size Matters DEBUG: Error starting ride:", error);
      ui.notifications.error("Error starting ride!");
    }
  }

  async stopRideForLeader(leaderId) {
    const leaderToken = canvas.tokens.get(leaderId);
    if (!leaderToken) return;

    await stopTokenRide(leaderToken);
    this.activeGroups.delete(leaderId);
    
    // Clear selections if this leader was selected
    if (this.selectedLeader === leaderId) {
      this.selectedLeader = null;
    }
    
    // Clear any followers from this group that were selected
    const group = this.activeGroups.get(leaderId);
    if (group) {
      group.followers.forEach((follower, followerId) => {
        this.selectedFollowers.delete(followerId);
      });
    }
  }

  async removeFollowerFromGroup(leaderId, followerId) {
    const leaderToken = canvas.tokens.get(leaderId);
    if (!leaderToken) return;

    const rideStillActive = await removeFollowerFromTokenRide(leaderToken, followerId);
    
    if (!rideStillActive) {
      // Ride was stopped because no followers remain
      this.activeGroups.delete(leaderId);
    } else {
      // Update local state
      const group = this.activeGroups.get(leaderId);
      if (group) {
        group.followers.delete(followerId);
      }
    }

    // Clear selections if the removed follower was selected
    this.selectedFollowers.delete(followerId);
    
    // If the leader was removed (ride stopped), clear leader selection too
    if (!rideStillActive && this.selectedLeader === leaderId) {
      this.selectedLeader = null;
    }

    this.render();
  }

  async stopAllRides() {
    await stopAllTokenRides();
    
    // Clear all selections since all rides are stopped
    this.selectedLeader = null;
    this.selectedFollowers.clear();
    
    this.activeGroups.clear();
    this.render();
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('#leader-select').change((event) => {
      this.selectedLeader = event.target.value || null;
      
      // Auto-select the leader token on canvas
      if (this.selectedLeader) {
        const leaderToken = canvas.tokens.get(this.selectedLeader);
        if (leaderToken) {
          leaderToken.control({ releaseOthers: true });
          console.log("Size Matters: Auto-selected leader token", leaderToken.name);
        }
      }
    });

    html.find('.follower-checkbox').change((event) => {
      const followerId = event.target.value;
      const isChecked = event.target.checked;
      const followerToken = canvas.tokens.get(followerId);
      
      if (isChecked) {
        this.selectedFollowers.add(followerId);
        // Auto-select follower token (add to selection, don't release others)
        if (followerToken) {
          followerToken.control({ releaseOthers: false });
          console.log("Size Matters: Auto-selected follower token", followerToken.name);
        }
      } else {
        this.selectedFollowers.delete(followerId);
        // Deselect follower token
        if (followerToken) {
          followerToken.release();
          console.log("Size Matters: Deselected follower token", followerToken.name);
        }
      }
    });

    html.find('.start-ride-btn').click(() => {
      this.startRide();
    });

    html.find('.stop-all-btn').click(() => {
      this.stopAllRides();
    });

    html.find('.remove-group-btn').click(async (event) => {
      const leaderId = event.currentTarget.getAttribute('data-leader');
      await this.stopRideForLeader(leaderId);
      this.render(true);
    });

    html.find('.remove-follower-btn').click(async (event) => {
      const leaderId = event.currentTarget.getAttribute('data-leader');
      const followerId = event.currentTarget.getAttribute('data-follower');
      await this.removeFollowerFromGroup(leaderId, followerId);
    });
  }
}

class SizeMattersApp extends Application {
  constructor(token = null, options = {}) {
    super(options);
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.initializeGrid();
    this.loadSettings();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "size-matters",
      title: "Size Matters",
      template: "modules/size-matters/templates/size-matters-dialog.html",
      width: 420,
      height: "auto",
      resizable: false,
      closeOnSubmit: false
    });
  }

  initializeGrid() {
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    if (isHexGrid) {
      return this.initializeHexGrid();
    } else {
      return this.initializeSquareGrid();
    }
  }

  initializeHexGrid() {
    const gridSize = 7;
    const grid = {};
    for (let q = -gridSize; q <= gridSize; q++) {
      for (let r = -gridSize; r <= gridSize; r++) {
        if (Math.abs(q + r) > gridSize) continue;
        const key = `${q},${r}`;
        grid[key] = { 
          q: q,
          r: r, 
          selected: false, 
          isCenter: q === 0 && r === 0 
        };
      }
    }
    this.grid = grid;
    return grid;
  }

  initializeSquareGrid() {
    const gridSize = 5;
    const grid = {};
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let y = -gridSize; y <= gridSize; y++) {
        const key = `${x},${y}`;
        grid[key] = { 
          q: x,
          r: y, 
          selected: false, 
          isCenter: x === 0 && y === 0 
        };
      }
    }
    this.grid = grid;
    return grid;
  }

  loadSettings() {
    const tokenSettings = this.token ? (this.token.document.getFlag('size-matters', 'settings') || {}) : {};
    
    this.settings = foundry.utils.mergeObject({
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 4,
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      imageVisible: true,
      gridVisible: true
    }, tokenSettings);
    
    // Reference grid directly instead of duplicating
    if (tokenSettings.grid) {
      this.grid = tokenSettings.grid;
    } else {
      this.grid = this.initializeGrid();
    }
  }

  async saveSettings() {
    if (this.token) {
      await this.token.document.setFlag('size-matters', 'settings', foundry.utils.duplicate(this.settings));
    }
  }

  async setControlledToken(token) {
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.loadSettings();
    this.render(true);
  }

  async getPresets() {
    return game.settings.get('size-matters', 'presets') || {};
  }

  async savePreset(name, settings) {
    const presets = await this.getPresets();
    const presetData = {
      color: settings.color,
      fillColor: settings.fillColor,
      thickness: settings.thickness,
      alpha: settings.alpha,
      enableFill: settings.enableFill,
      enableContour: settings.enableContour,
      imageUrl: settings.imageUrl,
      imageScale: settings.imageScale,
      imageOffsetX: settings.imageOffsetX,
      imageOffsetY: settings.imageOffsetY,
      imageRotation: settings.imageRotation,
      imageVisible: settings.imageVisible,
      gridVisible: settings.gridVisible,
      grid: foundry.utils.duplicate(settings.grid)
    };
    presets[name] = presetData;
    await game.settings.set('size-matters', 'presets', presets);
  }

  async deletePreset(name) {
    const presets = await this.getPresets();
    delete presets[name];
    await game.settings.set('size-matters', 'presets', presets);
  }

  async loadPreset(name) {
    const presets = await this.getPresets();
    const preset = presets[name];
    if (preset) {
      this.settings = foundry.utils.mergeObject(this.settings, preset);
      if (preset.grid) {
        this.grid = foundry.utils.duplicate(preset.grid);
        this.settings.grid = this.grid;
      }
      await this.saveSettings();
      return true;
    }
    return false;
  }

  getData() {
    if (!this.token) {
      return {
        noToken: true,
        gridType: 'No Token Selected',
        gridSize: 0,
        gridSVG: '<div style="text-align: center; padding: 40px; color: #666;">Select a token to configure</div>',
        isPointyTop: false,
        isHexGrid: false,
        ...this.settings
      };
    }
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    return {
      gridType: isHexGrid ? (isPointyTop ? 'Pointy-Top Hex' : 'Flat-Top Hex') : 'Square Grid',
      gridSize: canvas.grid.size,
      gridSVG: this.createGridSVG(isHexGrid, isPointyTop),
      isPointyTop: isPointyTop,
      isHexGrid: isHexGrid,
      ...this.settings
    };
  }

  createGridSVG(isHexGrid, isPointyTop) {
    const svgSize = 300;
    return isHexGrid ? this.createHexSVG(isPointyTop, svgSize) : this.createSquareSVG(svgSize);
  }

  createHexSVG(isPointyTop, svgSize = 300) {
    const svgRadius = 16;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    Object.entries(this.grid).forEach(([key, h]) => {
      const pos = axialToPixel(h.q, h.r, svgRadius, isPointyTop);
      const cx = svgSize / 2 + pos.x;
      const cy = svgSize / 2 + pos.y;
      let pts = [];
      for (let i = 0; i < 6; i++) {
        const angle = isPointyTop ? (i * Math.PI / 3) - Math.PI / 2 : i * Math.PI / 3;
        const x = cx + svgRadius * Math.cos(angle);
        const y = cy + svgRadius * Math.sin(angle);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      const fill = h.isCenter ? '#4CAF50' : h.selected ? '#2196F3' : '#fff';
      const stroke = h.isCenter ? '#2E7D32' : '#666';
      const cssClass = 'grid-selectable';
      svg += `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" 
              stroke-width="${h.isCenter ? 2 : 1}" data-grid="${key}" 
              class="${cssClass}" />`;
    });
    svg += `</svg>`;
    return svg;
  }

  createSquareSVG(svgSize = 300) {
    const squareSize = 25;
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    Object.entries(this.grid).forEach(([key, square]) => {
      const pos = squareToPixel(square.q, square.r, squareSize);
      const cx = svgSize / 2 + pos.x - squareSize / 2;
      const cy = svgSize / 2 + pos.y - squareSize / 2;
      const fill = square.isCenter ? '#4CAF50' : square.selected ? '#2196F3' : '#fff';
      const stroke = square.isCenter ? '#2E7D32' : '#666';
      const cssClass = 'grid-selectable';
      svg += `<rect x="${cx}" y="${cy}" width="${squareSize}" height="${squareSize}" 
              fill="${fill}" stroke="${stroke}" 
              stroke-width="${square.isCenter ? 2 : 1}" data-grid="${key}" 
              class="${cssClass}" />`;
    });
    svg += `</svg>`;
    return svg;
  }

  updateGridSVG(html) {
    const gridType = canvas.grid.type;
    const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                       CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
    const isPointyTop = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(gridType);
    const newSVG = this.createGridSVG(isHexGrid, isPointyTop);
    html.find('.grid-container').html(newSVG);
    html.find('polygon[data-grid], rect[data-grid]').click((event) => {
      const key = event.currentTarget.getAttribute('data-grid');
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.drawGrid(html);
    this.populatePresetsDropdown(html);
    this.setupGridInteraction(html);
    html.find('input[name="thickness"]').on('input', (event) => {
      html.find('#tval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="alpha"]').on('input', (event) => {
      html.find('#aval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="imageScale"]').on('input', (event) => {
      html.find('#sval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="imageOffsetX"]').on('input', (event) => {
      html.find('#xval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="imageOffsetY"]').on('input', (event) => {
      html.find('#yval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="imageRotation"]').on('input', (event) => {
      html.find('#rval').text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="color"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="fillColor"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="enableFill"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('input[name="enableContour"]').on('change', (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
    });
    html.find('.save-preset-button').click(() => this.handleSavePreset(html));
    html.find('.load-preset-button').click(() => this.handleLoadPreset(html));
    html.find('.delete-preset-button').click(() => this.handleDeletePreset(html));
    html.find('.file-picker-button').click(() => this.openFilePicker(html));
    html.find('.ride-button').click(() => this.handleRideButton(html));
    html.find('.clear-button').click(() => this.clearAll(html));
    html.find('.toggle-image-button').click(() => this.toggleImageVisibility());
    html.find('.toggle-grid-button').click(() => this.toggleGridVisibility());
    html.find('input:not(.clear-button)').on('change', () => {
      this.updateSettingsFromForm(html);
      this.saveSettings();
    });
  }

  setupGridInteraction(html) {
    let isDragging = false;
    let dragMode = null;
    const gridElements = html.find('polygon[data-grid], rect[data-grid]');
    
    // Remove any existing listeners first
    $(document).off('mouseup.size-matters');
    
    gridElements.on('mousedown', (event) => {
      event.preventDefault();
      const key = event.currentTarget.getAttribute('data-grid');
      const cell = this.grid[key];
      if (cell.isCenter) return;
      isDragging = true;
      dragMode = cell.selected ? 'deselect' : 'select';
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });
    gridElements.on('mouseenter', (event) => {
      if (!isDragging) return;
      const key = event.currentTarget.getAttribute('data-grid');
      const cell = this.grid[key];
      if (cell.isCenter) return;
      if ((dragMode === 'select' && !cell.selected) ||
          (dragMode === 'deselect' && cell.selected)) {
        this.toggleGridCell(key, event.currentTarget);
        this.drawGrid(html);
      }
    });
    $(document).on('mouseup.size-matters', () => {
      isDragging = false;
      dragMode = null;
    });
    html.find('.grid-container').on('mouseleave', () => {
      isDragging = false;
      dragMode = null;
    });
    html.find('.grid-container').on('selectstart', (event) => {
      if (isDragging) {
        event.preventDefault();
      }
    });
  }

  async populatePresetsDropdown(html) {
    const presets = await this.getPresets();
    const select = html.find('#preset-select');
    select.empty();
    select.append('<option value="">Select preset...</option>');
    Object.keys(presets).forEach(name => {
      select.append(`<option value="${name}">${name}</option>`);
    });
  }

  async handleSavePreset(html) {
    const name = html.find('#preset-name').val().trim();
    if (!name) {
      ui.notifications.warn("Enter a preset name!");
      return;
    }
    this.updateSettingsFromForm(html);
    await this.savePreset(name, this.settings);
    await this.populatePresetsDropdown(html);
    html.find('#preset-name').val('');
    ui.notifications.info(`Preset "${name}" saved!`);
  }

  async handleLoadPreset(html) {
    const name = html.find('#preset-select').val();
    if (!name) {
      ui.notifications.warn("Select a preset to load!");
      return;
    }
    const loaded = await this.loadPreset(name);
    if (loaded) {
      this.updateFormFromSettings(html);
      this.updateGridSVG(html);
      this.drawGrid(html);
      ui.notifications.info(`Preset "${name}" loaded!`);
    } else {
      ui.notifications.error("Failed to load preset!");
    }
  }

  async handleDeletePreset(html) {
    const name = html.find('#preset-select').val();
    if (!name) {
      ui.notifications.warn("Select a preset to delete!");
      return;
    }
    const confirmed = await Dialog.confirm({
      title: "Delete Preset",
      content: `<p>Are you sure you want to delete the preset "<strong>${name}</strong>"?</p>`,
      yes: () => true,
      no: () => false
    });
    if (confirmed) {
      await this.deletePreset(name);
      await this.populatePresetsDropdown(html);
      ui.notifications.info(`Preset "${name}" deleted!`);
    }
  }

  updateFormFromSettings(html) {
    html.find('[name="color"]').val(this.settings.color);
    html.find('[name="fillColor"]').val(this.settings.fillColor);
    html.find('[name="thickness"]').val(this.settings.thickness);
    html.find('#tval').text(this.settings.thickness);
    html.find('[name="alpha"]').val(this.settings.alpha);
    html.find('#aval').text(this.settings.alpha);
    html.find('[name="enableFill"]').prop('checked', this.settings.enableFill);
    html.find('[name="enableContour"]').prop('checked', this.settings.enableContour);
    html.find('[name="imageScale"]').val(this.settings.imageScale);
    html.find('#sval').text(this.settings.imageScale);
    html.find('[name="imageOffsetX"]').val(this.settings.imageOffsetX);
    html.find('#xval').text(this.settings.imageOffsetX);
    html.find('[name="imageOffsetY"]').val(this.settings.imageOffsetY);
    html.find('#yval').text(this.settings.imageOffsetY);
    html.find('[name="imageRotation"]').val(this.settings.imageRotation);
    html.find('#rval').text(this.settings.imageRotation);
  }

  async openFilePicker(html) {
    const fp = new FilePicker({
      type: "media",
      current: this.settings.imageUrl,
      callback: (path) => {
        this.settings.imageUrl = path;
        this.settings.imageVisible = true;
        this.saveSettings();
        // Update the mini grid to show the new image
        this.updateGridSVG(html);
        this.drawGrid(html);
      }
    });
    fp.render(true);
  }

  toggleGridCell(key, element) {
    const cell = this.grid[key];
    cell.selected = !cell.selected;
    const fill = cell.isCenter ? (cell.selected ? '#2196F3' : '#4CAF50') : (cell.selected ? '#2196F3' : '#ffffff');
    element.setAttribute("fill", fill);
    element.classList.toggle('grid-selected', cell.selected);
    element.classList.toggle('grid-unselected', !cell.selected);
    this.settings.grid = this.grid;
    this.saveSettings();
  }

  updateSettingsFromForm(html) {
    if (!html) return;
    this.settings.color = html.find('[name="color"]').val();
    this.settings.fillColor = html.find('[name="fillColor"]').val();
    this.settings.thickness = parseInt(html.find('[name="thickness"]').val());
    this.settings.alpha = parseFloat(html.find('[name="alpha"]').val());
    this.settings.enableFill = html.find('[name="enableFill"]').is(':checked');
    this.settings.enableContour = html.find('[name="enableContour"]').is(':checked');
    this.settings.imageScale = parseFloat(html.find('[name="imageScale"]').val()) || 1.0;
    this.settings.imageOffsetX = parseInt(html.find('[name="imageOffsetX"]').val()) || 0;
    this.settings.imageOffsetY = parseInt(html.find('[name="imageOffsetY"]').val()) || 0;
    this.settings.imageRotation = parseInt(html.find('[name="imageRotation"]').val()) || 0;
    this.settings.grid = this.grid;
  }

  async drawGrid(html) {
    if (!this.token) {
      return;
    }
    this.updateSettingsFromForm(html);
    this.settings.grid = this.grid;
    await this.saveSettings();
    await drawSizeMattersGraphicsForToken(this.token);
    
    // Update the mini grid to show the image preview
    if (html) {
      this.updateGridSVG(html);
    }
    
    this._gridGraphics = this.token.sizeMattersGrid;
    this._imageSprite = this.token.sizeMattersImage;
    this._gridTicker = this.token.sizeMattersGridTicker;
  }

  async handleRideButton(html) {
    openRideManager();
  }

  clearTokenGraphics() {
    const currentToken = canvas.tokens.get(this.tokenId);
    clearTokenSizeMattersGraphics(currentToken);
    this._gridGraphics = null;
    this._imageSprite = null;
    this._gridTicker = null;
  }

  clearGraphics() {
    this._gridGraphics = null;
    this._imageSprite = null;
    this._gridTicker = null;
  }

  async clearAll(html) {
    if (!this.token) {
      ui.notifications.warn("Select a token first!");
      return;
    }
    this.clearTokenGraphics();
    this.initializeGrid();
    this.settings = {
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 4,
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      grid: this.grid,
      imageVisible: true,
      gridVisible: true
    };
    if (this.token) {
      await this.token.document.unsetFlag('size-matters', 'settings');
    }
    if (html) {
      this.updateFormFromSettings(html);
      this.updateGridSVG(html);
    }
    ui.notifications.info("All settings cleared and reset to default!");
  }

  async close(options = {}) {
    // Clean up event listeners
    $(document).off('mouseup.size-matters');
    
    if (this.token) {
      await this.saveSettings();
    }
    window.sizeMattersApp = null;
    return super.close(options);
  }
}

window.openSizeMatters = function() {
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn("Size Matters: Foundry VTT not ready yet. Please try again in a moment.");
    return;
  }
  if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
    window.sizeMattersApp.bringToTop();
    return;
  }
  const token = canvas.tokens.controlled.length > 0 ? canvas.tokens.controlled[0] : null;
  const gridType = canvas.grid.type;
  const isHexGrid = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
                     CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(gridType);
  const isSquareGrid = gridType === CONST.GRID_TYPES.SQUARE;
  if (!isHexGrid && !isSquareGrid) {
    return ui.notifications.warn("This module works with hexagonal and square grids only!");
  }
  window.sizeMattersApp = new SizeMattersApp(token);
  window.sizeMattersApp.render(true);
};

// Export function to open ride manager dialog
window.openRideManager = function() {
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn("Size Matters: Foundry VTT not ready yet. Please try again in a moment.");
    return;
  }
  
  const rideManager = new RideManagerApp();
  rideManager.render(true);
};

//HOOK DE INICIALIZAÇÃO: O lugar correto para registrar configurações.
Hooks.once('init', () => {
  game.settings.register('size-matters', 'presets', {
    name: 'Size Matters Presets',
    hint: 'Stored presets for Size Matters configurations',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
});

// HOOK DE PRONTO: O lugar correto para adicionar elementos de UI como botões.
Hooks.once('ready', () => {
  window.sizeMattersApp = null; // Inicializa a variável global
});

// Adiciona o botão de controle de cena.
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.tokens;

  if (tokenControls && tokenControls.tools) {
    tokenControls.tools["size-matters-config-button"] = {
      name: "size-matters-config-button",
      title: "Size Matters Config",
      icon: "fas fa-hexagon",
      button: true,
      onClick: () => {
        // A função openSizeMatters já está no escopo global.
        openSizeMatters();
      },
      visible: true
    };
  }
});


Hooks.on('chatMessage', (chatLog, message, chatData) => {
  if (message.trim() === '/size') {
    openSizeMatters();
    return false;
  }
  if (message.trim() === '/ride') {
    openRideManager();
    return false;
  }
});

Hooks.on('controlToken', (token, controlled) => {
  if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
    if (controlled) {
      window.sizeMattersApp.setControlledToken(token);
    }
  }
});

Hooks.on('releaseToken', (token, controlled) => {
  if (window.sizeMattersApp && window.sizeMattersApp.rendered && canvas.tokens.controlled.length === 0) {
    window.sizeMattersApp.setControlledToken(null);
  }
});

Hooks.on('canvasInit', () => {
  clearAllSizeMattersGraphics();
  
  // Clear texture cache when canvas changes
  textureCache.forEach((texture, url) => {
    texture.destroy(true);
  });
  textureCache.clear();
});

Hooks.on('canvasReady', async () => {
  setTimeout(async () => {
    // Restore rides from flags first
    await restoreRidesFromFlags();
    
    for (const token of canvas.tokens.placeables) {
      const settings = token.document.getFlag('size-matters', 'settings');
      if (settings && settings.grid) {
        await drawSizeMattersGraphicsForToken(token);
      }
    }
  }, 500);
});

Hooks.on('renderToken', async (token) => {
  setTimeout(async () => {
    const settings = token.document.getFlag('size-matters', 'settings');
    if (settings && settings.grid && !token.sizeMattersGrid) {
      await drawSizeMattersGraphicsForToken(token);
    }
  }, 100);
});

Hooks.on('deleteToken', (token) => {
  clearTokenSizeMattersGraphics(token);
  
  // Clean up ride functionality when token is deleted
  const leaderToken = canvas.tokens.get(token.id);
  if (leaderToken) {
    stopTokenRide(leaderToken, true);
  }
});

Hooks.on('updateScene', (scene, changes) => {
  if (changes.active === true) {
    clearAllSizeMattersGraphics();
  }
});

Hooks.on('updateToken', async (tokenDocument, changes, options, userId) => {
  try {
    if (changes.flags && changes.flags['size-matters']) {
      const token = canvas.tokens.get(tokenDocument.id);
      if (!token) {
        return;
      }
      setTimeout(async () => {
        clearTokenSizeMattersGraphics(token);
        await drawSizeMattersGraphicsForToken(token);
      }, 50);
    }
  } catch (error) {
    // Silent error handling
  }
});

export { SizeMattersApp };
