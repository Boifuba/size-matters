// Core ride functionality for Size Matters module
// Uses PIXI ticker with proper relative positioning and rotation

// Global storage for active rides
window.sizeMattersActiveRides = window.sizeMattersActiveRides || new Map();

/**
 * Ticker function that handles token following with proper relative positioning
 * @param {string} leaderId - ID of the leader token
 * @param {Object} rideData - Ride data containing followers and last known state
 */
function createRideTicker(leaderId, rideData) {
  return () => {
    try {
      const leaderToken = canvas.tokens.get(leaderId);
      if (!leaderToken || !leaderToken.document) {
        console.log("Size Matters DEBUG: Leader token not found, stopping ticker");
        stopTokenRide(leaderToken, true);
        return;
      }

      // Get current leader state
      const currentX = leaderToken.document.x;
      const currentY = leaderToken.document.y;
      const currentRotation = leaderToken.document.rotation || 0;
      
      // Check if leader state changed
      if (currentX === rideData.lastX && 
          currentY === rideData.lastY && 
          currentRotation === rideData.lastRotation) {
        return; // No movement or rotation
      }

      console.log("Size Matters DEBUG: Leader state changed", {
        leaderId: leaderId,
        leaderName: leaderToken.name,
        oldState: { x: rideData.lastX, y: rideData.lastY, rotation: rideData.lastRotation },
        newState: { x: currentX, y: currentY, rotation: currentRotation }
      });

      // Update last known state
      rideData.lastX = currentX;
      rideData.lastY = currentY;
      rideData.lastRotation = currentRotation;

      // Calculate leader's current center
      const gridSize = canvas.grid.size;
      const leaderCenterX = currentX + (leaderToken.document.width * gridSize) / 2;
      const leaderCenterY = currentY + (leaderToken.document.height * gridSize) / 2;
      const currentLeaderRotationRad = (currentRotation * Math.PI) / 180;

      // Precalculate rotation values
      const sinRotation = Math.sin(currentLeaderRotationRad);
      const cosRotation = Math.cos(currentLeaderRotationRad);

      // Move all followers based on relative positioning
      rideData.followers.forEach(async (followerData, followerId) => {
        const followerToken = canvas.tokens.get(followerId);
        if (followerToken && followerToken.document) {
          // Apply rotation transformation to relative position
          const rotatedDx = followerData.relativeDx * cosRotation - followerData.relativeDy * sinRotation;
          const rotatedDy = followerData.relativeDx * sinRotation + followerData.relativeDy * cosRotation;
          
          // Calculate new follower position (center-based, then convert to top-left)
          const newFollowerCenterX = leaderCenterX + rotatedDx;
          const newFollowerCenterY = leaderCenterY + rotatedDy;
          
          // Convert from center to top-left corner for token positioning
          const newFollowerX = newFollowerCenterX - followerData.followerWidth / 2;
          const newFollowerY = newFollowerCenterY - followerData.followerHeight / 2;
          
          // Calculate new rotation (leader rotation + relative offset)
          const newFollowerRotation = currentRotation + followerData.relativeRotationOffset;
          
          console.log("Size Matters DEBUG: Moving follower with rotation", {
            followerId: followerId,
            followerName: followerToken.name,
            relativeDx: followerData.relativeDx,
            relativeDy: followerData.relativeDy,
            rotatedDx: rotatedDx,
            rotatedDy: rotatedDy,
            oldPosition: { x: followerToken.document.x, y: followerToken.document.y, rotation: followerToken.document.rotation },
            newPosition: { x: newFollowerX, y: newFollowerY, rotation: newFollowerRotation }
          });
          
          try {
            await followerToken.document.update({ 
              x: newFollowerX, 
              y: newFollowerY,
              rotation: newFollowerRotation
            }, { animate: false });
          } catch (error) {
            console.error(`Size Matters DEBUG: Failed to move follower ${followerId}:`, error);
          }
        }
      });

    } catch (error) {
      console.error("Size Matters DEBUG: Error in ride ticker:", error);
    }
  };
}

/**
 * Starts a ride with the given leader and followers using proper relative positioning
 * @param {Token} leaderToken - The leader token
 * @param {Map} followersMap - Map of follower IDs to follower data
 * @returns {Promise<string>} A unique identifier for this ride
 */
async function startTokenRide(leaderToken, followersMap) {
  if (!leaderToken || !leaderToken.document) {
    throw new Error("Invalid leader token");
  }

  console.log("Size Matters DEBUG: ===== STARTING ENHANCED RIDE WITH ROTATION =====");
  console.log("Size Matters DEBUG: Starting ride", {
    leaderId: leaderToken.id,
    leaderName: leaderToken.name,
    followersCount: followersMap.size,
    followers: Array.from(followersMap.keys())
  });

  // Stop any existing ride for this leader first
  await stopTokenRide(leaderToken, true);

  // Create unique ride ID
  const rideId = `ride_${leaderToken.id}_${Date.now()}`;
  
  // Get grid size and leader's initial state
  const gridSize = canvas.grid.size;
  const leaderCenterX = leaderToken.document.x + (leaderToken.document.width * gridSize) / 2;
  const leaderCenterY = leaderToken.document.y + (leaderToken.document.height * gridSize) / 2;
  const leaderRotation = leaderToken.document.rotation || 0;

  // Calculate relative positions and rotations for each follower
  const enhancedFollowersMap = new Map();
  
  for (const [followerId, followerData] of followersMap) {
    const followerToken = canvas.tokens.get(followerId);
    if (followerToken && followerToken.document) {
      // Calculate follower's center and dimensions
      const followerWidth = followerToken.document.width * gridSize;
      const followerHeight = followerToken.document.height * gridSize;
      const followerCenterX = followerToken.document.x + followerWidth / 2;
      const followerCenterY = followerToken.document.y + followerHeight / 2;
      const followerRotation = followerToken.document.rotation || 0;
      
      // Calculate relative position (dx, dy from leader center to follower center)
      const relativeDx = followerCenterX - leaderCenterX;
      const relativeDy = followerCenterY - leaderCenterY;
      
      // Calculate relative rotation offset
      const relativeRotationOffset = followerRotation - leaderRotation;
      
      // Store enhanced follower data
      enhancedFollowersMap.set(followerId, {
        ...followerData,
        relativeDx: relativeDx,
        relativeDy: relativeDy,
        followerWidth: followerWidth,
        followerHeight: followerHeight,
        relativeRotationOffset: relativeRotationOffset
      });
      
      console.log("Size Matters DEBUG: Calculated relative data for follower", {
        followerId: followerId,
        followerName: followerToken.name,
        relativeDx: relativeDx,
        relativeDy: relativeDy,
        followerDimensions: { width: followerWidth, height: followerHeight },
        relativeRotationOffset: relativeRotationOffset
      });
    }
  }

  // Create ride data with initial state
  const rideData = {
    leaderId: leaderToken.id,
    leaderName: leaderToken.name,
    followers: enhancedFollowersMap,
    lastX: leaderToken.document.x,
    lastY: leaderToken.document.y,
    lastRotation: leaderRotation,
    tickerFunction: null
  };

  // Create ticker function
  const tickerFunction = createRideTicker(leaderToken.id, rideData);
  rideData.tickerFunction = tickerFunction;
  
  // Add to PIXI ticker
  if (!canvas.app || !canvas.app.ticker) {
    throw new Error("PIXI ticker not available");
  }
  
  canvas.app.ticker.add(tickerFunction);
  console.log("Size Matters DEBUG: Added enhanced ticker function for ride", rideId);

  // Store ride data
  window.sizeMattersActiveRides.set(rideId, rideData);

  // Set flags on the leader token for persistence
  try {
    await leaderToken.document.setFlag('size-matters', 'activeRideId', rideId);
    
    // Convert followers map to object for storage (with enhanced data)
    const followersObj = {};
    enhancedFollowersMap.forEach((value, key) => {
      followersObj[key] = { ...value };
    });
    
    await leaderToken.document.setFlag('size-matters', 'rideFollowers', followersObj);
    
    console.log("Size Matters DEBUG: Successfully set token flags with enhanced data");
  } catch (error) {
    console.error("Size Matters DEBUG: Failed to set token flags:", error);
    // Clean up ticker if flag setting fails
    canvas.app.ticker.remove(tickerFunction);
    window.sizeMattersActiveRides.delete(rideId);
    throw new Error("Failed to set leader token flags: " + error.message);
  }

  // Success notification
  ui.notifications.info(`Ride started! ${enhancedFollowersMap.size} follower(s) now following the leader with relative positioning.`);
  
  console.log("Size Matters DEBUG: Enhanced ride started successfully with proper rotation support");
  return rideId;
}

/**
 * Stops a ride for the given leader token
 * @param {Token} leaderToken - The leader token
 * @param {boolean} suppressNotification - Whether to suppress the stop notification
 */
async function stopTokenRide(leaderToken, suppressNotification = false) {
  if (!leaderToken || !leaderToken.document) {
    return;
  }

  console.log("Size Matters DEBUG: Stopping enhanced ride", {
    leaderId: leaderToken.id,
    leaderName: leaderToken.name
  });

  const rideId = leaderToken.document.getFlag('size-matters', 'activeRideId');
  if (rideId && window.sizeMattersActiveRides.has(rideId)) {
    const rideData = window.sizeMattersActiveRides.get(rideId);
    
    // Remove ticker
    if (canvas.app && canvas.app.ticker && rideData.tickerFunction) {
      canvas.app.ticker.remove(rideData.tickerFunction);
      console.log("Size Matters DEBUG: Removed enhanced ticker function for ride", rideId);
    }
    
    // Remove from active rides
    window.sizeMattersActiveRides.delete(rideId);
  }

  // Clean up flags
  try {
    await leaderToken.document.unsetFlag('size-matters', 'activeRideId');
    await leaderToken.document.unsetFlag('size-matters', 'rideFollowers');
    console.log("Size Matters DEBUG: Successfully removed token flags");
  } catch (error) {
    console.error("Size Matters DEBUG: Error removing token flags:", error);
  }
  
  if (!suppressNotification) {
    ui.notifications.info("Ride stopped! Followers released.");
  }
  
  console.log("Size Matters DEBUG: Enhanced ride stopped successfully");
}

/**
 * Removes a specific follower from a leader's ride
 * @param {Token} leaderToken - The leader token
 * @param {string} followerId - ID of the follower to remove
 * @returns {Promise<boolean>} True if the ride continues, false if it was stopped
 */
async function removeFollowerFromTokenRide(leaderToken, followerId) {
  if (!leaderToken || !leaderToken.document) {
    return false;
  }

  const rideId = leaderToken.document.getFlag('size-matters', 'activeRideId');
  if (!rideId || !window.sizeMattersActiveRides.has(rideId)) {
    return false;
  }

  const rideData = window.sizeMattersActiveRides.get(rideId);
  rideData.followers.delete(followerId);

  // If no followers remain, stop the ride entirely
  if (rideData.followers.size === 0) {
    await stopTokenRide(leaderToken);
    return false;
  } else {
    // Update the followers list in flags
    const followersObj = {};
    rideData.followers.forEach((value, key) => {
      followersObj[key] = { ...value };
    });
    
    await leaderToken.document.setFlag('size-matters', 'rideFollowers', followersObj);
    
    const followerToken = canvas.tokens.get(followerId);
    const followerName = followerToken ? followerToken.name : "Token";
    ui.notifications.info(`${followerName} no longer follows the leader.`);
    return true;
  }
}

/**
 * Gets all active ride groups from the global storage
 * @returns {Map} Map of leader IDs to group data
 */
function getActiveRideGroups() {
  const activeGroups = new Map();
  
  window.sizeMattersActiveRides.forEach((rideData, rideId) => {
    activeGroups.set(rideData.leaderId, {
      leaderName: rideData.leaderName,
      followers: rideData.followers
    });
  });
  
  return activeGroups;
}

/**
 * Stops all active rides
 */
async function stopAllTokenRides() {
  const rideIds = Array.from(window.sizeMattersActiveRides.keys());
  
  for (const rideId of rideIds) {
    const rideData = window.sizeMattersActiveRides.get(rideId);
    if (rideData) {
      const leaderToken = canvas.tokens.get(rideData.leaderId);
      if (leaderToken) {
        await stopTokenRide(leaderToken, true);
      }
    }
  }
  
  if (rideIds.length > 0) {
    ui.notifications.info("All rides have been stopped!");
  }
}

/**
 * Restores rides from token flags when canvas is ready
 */
async function restoreRidesFromFlags() {
  if (!canvas || !canvas.tokens) {
    console.log("Size Matters DEBUG: Canvas or tokens not ready for ride restoration");
    return;
  }
  
  console.log("Size Matters DEBUG: Restoring enhanced rides from flags...");
  
  for (const token of canvas.tokens.placeables) {
    const rideId = token.document.getFlag('size-matters', 'activeRideId');
    const followersData = token.document.getFlag('size-matters', 'rideFollowers');
    
    if (rideId && followersData && !window.sizeMattersActiveRides.has(rideId)) {
      console.log("Size Matters DEBUG: Restoring enhanced ride for token", {
        tokenId: token.id,
        tokenName: token.name,
        rideId: rideId,
        followersCount: Object.keys(followersData).length
      });
      
      // Convert followers object back to Map (with enhanced data)
      const followersMap = new Map();
      Object.entries(followersData).forEach(([followerId, followerData]) => {
        // Verify follower token still exists
        const followerToken = canvas.tokens.get(followerId);
        if (followerToken) {
          followersMap.set(followerId, followerData);
          console.log("Size Matters DEBUG: Restored follower", {
            followerId: followerId,
            followerName: followerToken.name
          });
        } else {
          console.warn("Size Matters DEBUG: Follower token not found during restoration", followerId);
        }
      });
      
      // Only restore if we have valid followers
      if (followersMap.size > 0) {
        try {
          await startTokenRide(token, followersMap);
          console.log("Size Matters DEBUG: Successfully restored enhanced ride for token", {
            tokenId: token.id,
            tokenName: token.name,
            followersRestored: followersMap.size
          });
          
          // Show notification about restored ride
          ui.notifications.info(`Ride restored: ${token.name} with ${followersMap.size} follower(s)`);
        } catch (error) {
          console.error("Size Matters DEBUG: Failed to restore enhanced ride for token", token.id, error);
          
          // Clean up flags if restoration fails
          try {
            await token.document.unsetFlag('size-matters', 'activeRideId');
            await token.document.unsetFlag('size-matters', 'rideFollowers');
          } catch (flagError) {
            console.error("Size Matters DEBUG: Failed to clean up flags after restoration failure", flagError);
          }
        }
      } else {
        console.log("Size Matters DEBUG: No valid followers found, cleaning up flags for token", token.id);
        
        // Clean up flags if no valid followers
        try {
          await token.document.unsetFlag('size-matters', 'activeRideId');
          await token.document.unsetFlag('size-matters', 'rideFollowers');
        } catch (flagError) {
          console.error("Size Matters DEBUG: Failed to clean up flags", flagError);
        }
      }
    }
  }
  
  console.log("Size Matters DEBUG: Ride restoration completed", {
    activeRidesCount: window.sizeMattersActiveRides.size,
    activeRideIds: Array.from(window.sizeMattersActiveRides.keys())
  });
}

// Export functions for use in main.js
export {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags
};