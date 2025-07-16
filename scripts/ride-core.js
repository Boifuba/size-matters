// Core ride functionality for Size Matters module
// Otimizado para FoundryVTT v13 com melhor performance e movimento suave

window.sizeMattersActiveRides = window.sizeMattersActiveRides || new Map();

const RIDE_CONFIG = {
  TICKER_THROTTLE_MS: 16,
  BATCH_UPDATE_DELAY: 32,
  MIN_MOVEMENT_THRESHOLD: 0.5,
  MIN_ROTATION_THRESHOLD: 0.1,
  MAX_FOLLOWERS_PER_BATCH: 10,
  SMOOTHING_FACTOR: 0.8
};

const tokenCache = new Map();
const updateQueue = new Map();

function getTokenFromCache(tokenId) {
  if (!tokenCache.has(tokenId)) {
    const token = canvas.tokens.get(tokenId);
    if (token) {
      tokenCache.set(tokenId, token);
    }
    return token;
  }
  return tokenCache.get(tokenId);
}

function clearTokenCache() {
  tokenCache.clear();
}

function queueTokenUpdate(tokenId, updateData) {
  if (!updateQueue.has(tokenId)) {
    updateQueue.set(tokenId, updateData);
  } else {
    Object.assign(updateQueue.get(tokenId), updateData);
  }
}

async function processBatchUpdates() {
  if (updateQueue.size === 0) return;
  
  const updates = Array.from(updateQueue.entries());
  updateQueue.clear();
  
  const chunks = [];
  for (let i = 0; i < updates.length; i += RIDE_CONFIG.MAX_FOLLOWERS_PER_BATCH) {
    chunks.push(updates.slice(i, i + RIDE_CONFIG.MAX_FOLLOWERS_PER_BATCH));
  }
  
  for (const chunk of chunks) {
    const updatePromises = chunk.map(([tokenId, updateData]) => {
      const token = getTokenFromCache(tokenId);
      if (token?.document) {
        return token.document.update(updateData, { 
          animate: false,
          broadcast: true,
          render: false
        }).catch(err => {
          console.warn(`Size Matters | Failed to update token ${tokenId}`, err);
        });
      }
      return Promise.resolve();
    });
    await Promise.all(updatePromises);
  }
  
  canvas.tokens.refresh();
}

function createRideTicker(leaderId, rideData) {
  let lastUpdateTime = 0;
  let lastBatchTime = 0;
  let isProcessing = false;
  let wasMoving = false;

  let lastLeaderActualX = rideData.lastX;
  let lastLeaderActualY = rideData.lastY;
  let lastLeaderActualRotation = rideData.lastRotation;
  
  const snapFollowersToFinalPosition = async (leaderToken) => {
    const finalX = leaderToken.document.x;
    const finalY = leaderToken.document.y;
    const finalRotation = leaderToken.document.rotation || 0;

    const gridSize = canvas.grid.size;
    const leaderCenterX = finalX + (leaderToken.document.width * gridSize) / 2;
    const leaderCenterY = finalY + (leaderToken.document.height * gridSize) / 2;
    const finalLeaderRotationRad = (finalRotation * Math.PI) / 180;

    const sinRotation = Math.sin(finalLeaderRotationRad);
    const cosRotation = Math.cos(finalLeaderRotationRad);

    rideData.followers.forEach((followerData, followerId) => {
      const followerToken = getTokenFromCache(followerId);
      if (followerToken?.document) {
        const rotatedDx = followerData.relativeDx * cosRotation - followerData.relativeDy * sinRotation;
        const rotatedDy = followerData.relativeDx * sinRotation + followerData.relativeDy * cosRotation;
        
        const newFollowerCenterX = leaderCenterX + rotatedDx;
        const newFollowerCenterY = leaderCenterY + rotatedDy;
        
        const newFollowerX = newFollowerCenterX - followerData.followerWidth / 2;
        const newFollowerY = newFollowerCenterY - followerData.followerHeight / 2;
        const newFollowerRotation = finalRotation + followerData.relativeRotationOffset;
        
        queueTokenUpdate(followerId, { x: newFollowerX, y: newFollowerY, rotation: newFollowerRotation });
      }
    });

    await processBatchUpdates();
    rideData.lastX = finalX;
    rideData.lastY = finalY;
    rideData.lastRotation = finalRotation;
  };

  return async () => {
    const currentTime = Date.now();
    if (currentTime - lastUpdateTime < RIDE_CONFIG.TICKER_THROTTLE_MS) return;
    if (isProcessing) return;

    try {
      isProcessing = true;
      lastUpdateTime = currentTime;

      const leaderToken = getTokenFromCache(leaderId);
      if (!leaderToken?.document) {
        stopTokenRide(leaderToken, true);
        return;
      }

      const currentX = leaderToken.document.x;
      const currentY = leaderToken.document.y;
      const currentRotation = leaderToken.document.rotation || 0;
      
      const deltaX = Math.abs(currentX - lastLeaderActualX);
      const deltaY = Math.abs(currentY - lastLeaderActualY);
      const deltaRotation = Math.abs(currentRotation - lastLeaderActualRotation);
      
      const isMoving = deltaX >= RIDE_CONFIG.MIN_MOVEMENT_THRESHOLD || 
                       deltaY >= RIDE_CONFIG.MIN_MOVEMENT_THRESHOLD || 
                       deltaRotation >= RIDE_CONFIG.MIN_ROTATION_THRESHOLD;

      if (isMoving) {
        wasMoving = true;
        lastLeaderActualX = currentX;
        lastLeaderActualY = currentY;
        lastLeaderActualRotation = currentRotation;

        const smoothX = rideData.lastX + (currentX - rideData.lastX) * RIDE_CONFIG.SMOOTHING_FACTOR;
        const smoothY = rideData.lastY + (currentY - rideData.lastY) * RIDE_CONFIG.SMOOTHING_FACTOR;
        const smoothRotation = rideData.lastRotation + (currentRotation - rideData.lastRotation) * RIDE_CONFIG.SMOOTHING_FACTOR;
        
        rideData.lastX = smoothX;
        rideData.lastY = smoothY;
        rideData.lastRotation = smoothRotation;

        const gridSize = canvas.grid.size;
        const leaderCenterX = smoothX + (leaderToken.document.width * gridSize) / 2;
        const leaderCenterY = smoothY + (leaderToken.document.height * gridSize) / 2;
        const currentLeaderRotationRad = (smoothRotation * Math.PI) / 180;

        const sinRotation = Math.sin(currentLeaderRotationRad);
        const cosRotation = Math.cos(currentLeaderRotationRad);

        rideData.followers.forEach((followerData, followerId) => {
          const followerToken = getTokenFromCache(followerId);
          if (followerToken?.document) {
            const rotatedDx = followerData.relativeDx * cosRotation - followerData.relativeDy * sinRotation;
            const rotatedDy = followerData.relativeDx * sinRotation + followerData.relativeDy * cosRotation;
            
            const newFollowerCenterX = leaderCenterX + rotatedDx;
            const newFollowerCenterY = leaderCenterY + rotatedDy;
            
            const newFollowerX = newFollowerCenterX - followerData.followerWidth / 2;
            const newFollowerY = newFollowerCenterY - followerData.followerHeight / 2;
            const newFollowerRotation = smoothRotation + followerData.relativeRotationOffset;
            
            queueTokenUpdate(followerId, { x: newFollowerX, y: newFollowerY, rotation: newFollowerRotation });
          }
        });
        
        if (currentTime - lastBatchTime >= RIDE_CONFIG.BATCH_UPDATE_DELAY) {
          lastBatchTime = currentTime;
          await processBatchUpdates();
        }
      } else if (wasMoving) {
        wasMoving = false;
        await snapFollowersToFinalPosition(leaderToken);
      }
    } catch (error) {
      console.warn("Size Matters | Ride ticker error:", error);
    } finally {
      isProcessing = false;
    }
  };
}

async function startTokenRide(leaderToken, followersMap) {
  if (!leaderToken?.document) throw new Error("Invalid leader token");

  await stopTokenRide(leaderToken, true);
  clearTokenCache();

  const rideId = `ride_${leaderToken.id}_${Date.now()}`;
  const gridSize = canvas.grid.size;
  
  const leaderCenterX = leaderToken.document.x + (leaderToken.document.width * gridSize) / 2;
  const leaderCenterY = leaderToken.document.y + (leaderToken.document.height * gridSize) / 2;
  const leaderRotation = leaderToken.document.rotation || 0;

  const enhancedFollowersMap = new Map();
  for (const [followerId, followerData] of followersMap) {
    const followerToken = getTokenFromCache(followerId);
    if (followerToken?.document) {
      const followerWidth = followerToken.document.width * gridSize;
      const followerHeight = followerToken.document.height * gridSize;
      const followerCenterX = followerToken.document.x + followerWidth / 2;
      const followerCenterY = followerToken.document.y + followerHeight / 2;
      const followerRotation = followerToken.document.rotation || 0;
      
      enhancedFollowersMap.set(followerId, {
        ...followerData,
        relativeDx: followerCenterX - leaderCenterX,
        relativeDy: followerCenterY - leaderCenterY,
        followerWidth,
        followerHeight,
        relativeRotationOffset: followerRotation - leaderRotation
      });
    }
  }

  const rideData = {
    leaderId: leaderToken.id,
    leaderName: leaderToken.name,
    followers: enhancedFollowersMap,
    lastX: leaderToken.document.x,
    lastY: leaderToken.document.y,
    lastRotation: leaderRotation,
    tickerFunction: null
  };

  const tickerFunction = createRideTicker(leaderToken.id, rideData);
  rideData.tickerFunction = tickerFunction;
  
  if (!canvas.app?.ticker) throw new Error("PIXI ticker not available");
  
  canvas.app.ticker.add(tickerFunction);
  window.sizeMattersActiveRides.set(rideId, rideData);

  try {
    const followersObj = {};
    enhancedFollowersMap.forEach((value, key) => { followersObj[key] = { ...value }; });
    
    await leaderToken.document.setFlag('size-matters', 'activeRideId', rideId);
    await leaderToken.document.setFlag('size-matters', 'rideFollowers', followersObj);
  } catch (error) {
    canvas.app.ticker.remove(tickerFunction);
    window.sizeMattersActiveRides.delete(rideId);
    throw new Error("Failed to set leader token flags: " + error.message);
  }

  ui.notifications.info(`Ride started! ${enhancedFollowersMap.size} follower(s) now following.`);
  return rideId;
}

async function stopTokenRide(leaderToken, suppressNotification = false) {
  if (!leaderToken?.document) return;

  const rideId = leaderToken.document.getFlag('size-matters', 'activeRideId');
  if (rideId && window.sizeMattersActiveRides.has(rideId)) {
    const rideData = window.sizeMattersActiveRides.get(rideId);
    if (canvas.app?.ticker && rideData.tickerFunction) {
      canvas.app.ticker.remove(rideData.tickerFunction);
    }
    window.sizeMattersActiveRides.delete(rideId);
  }

  await processBatchUpdates();

  try {
    await leaderToken.document.unsetFlag('size-matters', 'activeRideId');
    await leaderToken.document.unsetFlag('size-matters', 'rideFollowers');
  } catch (error) {
    console.warn(`Size Matters | Could not unset flags for token ${leaderToken.id}`, error);
  }
  
  if (!suppressNotification) {
    ui.notifications.info("Ride stopped! Followers released.");
  }
}

async function removeFollowerFromTokenRide(leaderToken, followerId) {
  if (!leaderToken?.document) return false;

  const rideId = leaderToken.document.getFlag('size-matters', 'activeRideId');
  if (!rideId || !window.sizeMattersActiveRides.has(rideId)) return false;

  const rideData = window.sizeMattersActiveRides.get(rideId);
  if (!rideData.followers.has(followerId)) return false;

  rideData.followers.delete(followerId);
  tokenCache.delete(followerId);

  if (rideData.followers.size === 0) {
    await stopTokenRide(leaderToken);
    return false;
  } else {
    const followersObj = {};
    rideData.followers.forEach((value, key) => { followersObj[key] = { ...value }; });
    await leaderToken.document.setFlag('size-matters', 'rideFollowers', followersObj);
    
    const followerToken = getTokenFromCache(followerId);
    ui.notifications.info(`${followerToken?.name || "Token"} no longer follows the leader.`);
    return true;
  }
}

async function stopAllTokenRides() {
  const rideIds = Array.from(window.sizeMattersActiveRides.keys());
  if (rideIds.length === 0) return;

  for (const rideId of rideIds) {
    const rideData = window.sizeMattersActiveRides.get(rideId);
    if (rideData) {
      const leaderToken = getTokenFromCache(rideData.leaderId);
      if (leaderToken) {
        await stopTokenRide(leaderToken, true);
      }
    }
  }
  
  clearTokenCache();
  ui.notifications.info("All active rides have been stopped!");
}

async function restoreRidesFromFlags() {
  if (!canvas?.tokens) return;
  
  for (const token of canvas.tokens.placeables) {
    const rideId = token.document.getFlag('size-matters', 'activeRideId');
    const followersData = token.document.getFlag('size-matters', 'rideFollowers');
    
    if (rideId && followersData && !window.sizeMattersActiveRides.has(rideId)) {
      const followersMap = new Map(Object.entries(followersData));
      
      if (followersMap.size > 0) {
        try {
          await startTokenRide(token, followersMap);
          ui.notifications.info(`Ride restored: ${token.name} with ${followersMap.size} follower(s).`);
        } catch (error) {
          console.warn(`Size Matters | Failed to restore ride for leader ${token.id}`, error);
          try {
            await token.document.unsetFlag('size-matters', 'activeRideId');
            await token.document.unsetFlag('size-matters', 'rideFollowers');
          } catch (flagError) { /* Silent */ }
        }
      } else {
        try {
          await token.document.unsetFlag('size-matters', 'activeRideId');
          await token.document.unsetFlag('size-matters', 'rideFollowers');
        } catch (flagError) { /* Silent */ }
      }
    }
  }
}

Hooks.on('canvasReady', () => {
  clearTokenCache();
  stopAllTokenRides().then(() => restoreRidesFromFlags());
});

Hooks.on('deleteToken', (tokenDocument) => {
  tokenCache.delete(tokenDocument.id);
});

Hooks.on('updateToken', (tokenDocument) => {
  tokenCache.delete(tokenDocument.id);
});

export {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags
};

function getActiveRideGroups() {
    const activeGroups = new Map();
    window.sizeMattersActiveRides.forEach((rideData) => {
        activeGroups.set(rideData.leaderId, {
            leaderName: rideData.leaderName,
            followers: rideData.followers
        });
    });
    return activeGroups;
}
