/**
 * Size Matters Module - Token Ride System
 * 
 * This module provides functionality for tokens to follow a leader token in formation,
 * maintaining relative positions and rotations during movement.
 * 
 * Key Features:
 * - Leader/follower token relationships
 * - Automatic position and rotation synchronization
 * - Persistent rides across scene reloads
 * - Batch token updates for performance
 * - Quick toggle functionality for temporary formations
 */

// Global storage for active rides
window.sizeMattersActiveRides = window.sizeMattersActiveRides || new Map();

// Create a reference to the global variable for easier access
const activeRides = window.sizeMattersActiveRides;

/**
 * Creates a Foundry hook that monitors leader token updates and moves followers accordingly
 * 
 * @param {string} leaderId - The ID of the leader token
 * @param {Map} followersData - Map of follower IDs to their relative position data
 * @returns {number} Hook ID for later removal
 */
function createFollowHook(leaderId, followersData) {
  return Hooks.on("updateToken", (tokenDocument, updateData) => {
    // Only process updates for the leader token
    if (tokenDocument.id !== leaderId) return;
    
    const gridSize = canvas.grid.size;
    
    // Calculate leader's new center position
    const leaderCenterX = (updateData.x ?? tokenDocument.x) + (tokenDocument.width * gridSize) / 2;
    const leaderCenterY = (updateData.y ?? tokenDocument.y) + (tokenDocument.height * gridSize) / 2;
    
    // Get rotation in radians for trigonometric calculations
    const rotation = ((updateData.rotation ?? tokenDocument.rotation) * Math.PI) / 180;
    const sinRotation = Math.sin(rotation);
    const cosRotation = Math.cos(rotation);
    
    // Calculate new positions for all followers
    const followerUpdates = [];
    followersData.forEach((followerData, followerId) => {
      // Apply rotation transformation to relative position
      const rotatedX = followerData.relativeDx * cosRotation - followerData.relativeDy * sinRotation;
      const rotatedY = followerData.relativeDx * sinRotation + followerData.relativeDy * cosRotation;
      
      // Calculate follower's new position (top-left corner for Foundry positioning)
      const newFollowerX = leaderCenterX + rotatedX - followerData.followerWidth / 2;
      const newFollowerY = leaderCenterY + rotatedY - followerData.followerHeight / 2;
      
      followerUpdates.push({
        _id: followerId,
        x: newFollowerX,
        y: newFollowerY,
        rotation: updateData.rotation ?? tokenDocument.rotation
      });
    });
    
    // Perform batch update for better performance
    if (followerUpdates.length > 0) {
      canvas.scene.updateEmbeddedDocuments("Token", followerUpdates, {
        animate: false,
        broadcast: true
      }).catch(error => {
        console.warn("Size Matters | Failed to update followers:", error);
      });
    }
  });
}

/**
 * Starts a new token ride with the specified leader and followers
 * 
 * @param {Token} leaderToken - The leader token object
 * @param {Map} followersMap - Map of follower token IDs to their data
 * @returns {Promise<string>} The ride ID
 * @throws {Error} If leader token is invalid or no valid followers found
 */
async function startTokenRide(leaderToken, followersMap) {
  if (!leaderToken?.document) {
    throw new Error("Invalid leader token");
  }

  // Stop any existing ride for this leader
  await stopTokenRide(leaderToken, true);

  const rideId = `ride_${leaderToken.id}_${Date.now()}`;
  const gridSize = canvas.grid.size;
  
  // Calculate leader's current center position
  const leaderCenterX = leaderToken.document.x + (leaderToken.document.width * gridSize) / 2;
  const leaderCenterY = leaderToken.document.y + (leaderToken.document.height * gridSize) / 2;

  // Process followers and calculate their relative positions from leader
  const processedFollowers = new Map();
  
  for (const [followerId, followerData] of followersMap) {
    const followerToken = canvas.tokens.get(followerId);
    if (!followerToken?.document) {
      console.warn(`Size Matters | Follower token ${followerId} not found`);
      continue;
    }

    const followerWidth = followerToken.document.width * gridSize;
    const followerHeight = followerToken.document.height * gridSize;
    const followerCenterX = followerToken.document.x + followerWidth / 2;
    const followerCenterY = followerToken.document.y + followerHeight / 2;
    
    // Calculate relative position from leader to follower
    const relativeDx = followerCenterX - leaderCenterX;
    const relativeDy = followerCenterY - leaderCenterY;
    
    processedFollowers.set(followerId, {
      ...followerData,
      relativeDx,
      relativeDy,
      followerWidth,
      followerHeight,
      name: followerToken.name
    });
  }

  if (processedFollowers.size === 0) {
    throw new Error("No valid followers found");
  }

  // Create the follow hook
  const hookId = createFollowHook(leaderToken.id, processedFollowers);

  // Store ride data in global storage
  const rideData = {
    leaderId: leaderToken.id,
    leaderName: leaderToken.name,
    followers: processedFollowers,
    hookId: hookId,
    isPaused: false,
    startTime: Date.now()
  };

  activeRides.set(rideId, rideData);

  // Set flags for persistence across scene reloads
  try {
    const followersObj = {};
    processedFollowers.forEach((value, key) => {
      followersObj[key] = { ...value };
    });
    
    await leaderToken.document.setFlag('size-matters', 'activeRideId', rideId);
    await leaderToken.document.setFlag('size-matters', 'rideFollowers', followersObj);
    await leaderToken.document.setFlag('size-matters', 'isRidePaused', false);
  } catch (error) {
    // Cleanup on failure
    Hooks.off("updateToken", hookId);
    activeRides.delete(rideId);
    throw new Error("Failed to set leader token flags: " + error.message);
  }

  ui.notifications.info(`Ride started! ${processedFollowers.size} follower(s) now following ${leaderToken.name}.`);
  return rideId;
}

/**
 * Stops an active token ride and cleans up associated data
 * 
 * @param {TokenDocument|Token} leaderTokenOrDocument - The leader token document or object
 * @param {boolean} suppressNotification - Whether to suppress the stop notification
 */
async function stopTokenRide(leaderTokenOrDocument, suppressNotification = false) {
  if (!leaderTokenOrDocument) return;
  
  // Handle both Token objects and TokenDocument objects
  const leaderDocument = leaderTokenOrDocument.document || leaderTokenOrDocument;
  const leaderId = leaderDocument.id;

  const rideId = leaderDocument.getFlag('size-matters', 'activeRideId');
  if (!rideId) return;

  // Remove from active rides and unhook
  if (activeRides.has(rideId)) {
    const rideData = activeRides.get(rideId);
    if (rideData.hookId) {
      Hooks.off("updateToken", rideData.hookId);
    }
    activeRides.delete(rideId);
  }

  // Clean up persistence flags
  try {
    await leaderDocument.unsetFlag('size-matters', 'activeRideId');
    await leaderDocument.unsetFlag('size-matters', 'rideFollowers');
    await leaderDocument.unsetFlag('size-matters', 'isRidePaused');
  } catch (error) {
    console.warn(`Size Matters | Could not unset flags for token ${leaderId}`, error);
  }
  
  if (!suppressNotification) {
    ui.notifications.info("Ride stopped! Followers released.");
  }
}

/**
 * Pauses an active token ride by removing the update hook
 * 
 * @param {TokenDocument|Token} leaderTokenOrDocument - The leader token document or object
 * @returns {Promise<boolean>} True if ride was paused, false if no active ride found
 */
async function pauseTokenRide(leaderTokenOrDocument) {
  if (!leaderTokenOrDocument) return false;
  
  // Handle both Token objects and TokenDocument objects
  const leaderDocument = leaderTokenOrDocument.document || leaderTokenOrDocument;
  const leaderId = leaderDocument.id;

  const rideId = leaderDocument.getFlag('size-matters', 'activeRideId');
  if (!rideId || !activeRides.has(rideId)) return false;

  const rideData = activeRides.get(rideId);
  if (rideData.isPaused) return false; // Already paused

  // Remove the update hook to pause movement
  if (rideData.hookId) {
    Hooks.off("updateToken", rideData.hookId);
    rideData.hookId = null;
  }

  // Mark as paused
  rideData.isPaused = true;

  // Update persistence flag
  try {
    await leaderDocument.setFlag('size-matters', 'isRidePaused', true);
  } catch (error) {
    console.warn(`Size Matters | Could not set pause flag for token ${leaderId}`, error);
  }

  ui.notifications.info(`Ride paused for ${rideData.leaderName}!`);
  return true;
}

/**
 * Resumes a paused token ride by recreating the update hook
 * 
 * @param {TokenDocument|Token} leaderTokenOrDocument - The leader token document or object
 * @returns {Promise<boolean>} True if ride was resumed, false if no paused ride found
 */
async function resumeTokenRide(leaderTokenOrDocument) {
  if (!leaderTokenOrDocument) return false;
  
  // Handle both Token objects and TokenDocument objects
  const leaderDocument = leaderTokenOrDocument.document || leaderTokenOrDocument;
  const leaderId = leaderDocument.id;

  const rideId = leaderDocument.getFlag('size-matters', 'activeRideId');
  if (!rideId || !activeRides.has(rideId)) return false;

  const rideData = activeRides.get(rideId);
  if (!rideData.isPaused) return false; // Not paused

  // Recreate the update hook to resume movement
  rideData.hookId = createFollowHook(leaderId, rideData.followers);

  // Mark as active
  rideData.isPaused = false;

  // Update persistence flag
  try {
    await leaderDocument.setFlag('size-matters', 'isRidePaused', false);
  } catch (error) {
    console.warn(`Size Matters | Could not unset pause flag for token ${leaderId}`, error);
  }

  ui.notifications.info(`Ride resumed for ${rideData.leaderName}!`);
  return true;
}

/**
 * Removes a specific follower from an active ride
 * 
 * @param {TokenDocument|Token} leaderTokenOrDocument - The leader token document or object
 * @param {string} followerId - The ID of the follower to remove
 * @returns {Promise<boolean>} True if follower was removed, false if ride was stopped
 */
async function removeFollowerFromTokenRide(leaderTokenOrDocument, followerId) {
  if (!leaderTokenOrDocument) return false;
  
  // Handle both Token objects and TokenDocument objects
  const leaderDocument = leaderTokenOrDocument.document || leaderTokenOrDocument;
  const leaderId = leaderDocument.id;

  const rideId = leaderDocument.getFlag('size-matters', 'activeRideId');
  if (!rideId || !activeRides.has(rideId)) return false;

  const rideData = activeRides.get(rideId);
  if (!rideData.followers.has(followerId)) return false;

  const followerName = rideData.followers.get(followerId).name;
  rideData.followers.delete(followerId);

  // If no followers left, stop the entire ride
  if (rideData.followers.size === 0) {
    await stopTokenRide(leaderTokenOrDocument);
    return false;
  } else {
    // Recreate the hook with updated followers
    Hooks.off("updateToken", rideData.hookId);
    rideData.hookId = createFollowHook(leaderId, rideData.followers);
    
    // Update persistence flags
    const followersObj = {};
    rideData.followers.forEach((value, key) => {
      followersObj[key] = { ...value };
    });
    
    await leaderDocument.setFlag('size-matters', 'rideFollowers', followersObj);
    
    ui.notifications.info(`${followerName} no longer follows the leader.`);
    return true;
  }
}

/**
 * Stops all active token rides
 */
async function stopAllTokenRides() {
  const rideIds = Array.from(activeRides.keys());
  if (rideIds.length === 0) return;

  for (const rideId of rideIds) {
    const rideData = activeRides.get(rideId);
    if (rideData) {
      const leaderToken = canvas.tokens.get(rideData.leaderId);
      if (leaderToken) {
        await stopTokenRide(leaderToken, true);
      }
    }
  }
  
  ui.notifications.info("All active rides have been stopped!");
}

/**
 * Restores rides from token flags after scene reload
 * Called automatically on canvas ready
 */
async function restoreRidesFromFlags() {
  if (!canvas?.tokens) return;
  
  for (const token of canvas.tokens.placeables) {
    const rideId = token.document.getFlag('size-matters', 'activeRideId');
    const followersData = token.document.getFlag('size-matters', 'rideFollowers');
    const isPaused = token.document.getFlag('size-matters', 'isRidePaused') || false;
    
    if (rideId && followersData && !activeRides.has(rideId)) {
      const followersMap = new Map(Object.entries(followersData));
      
      if (followersMap.size > 0) {
        try {
          await startTokenRide(token, followersMap);
          
          // If the ride was paused, pause it again after restoration
          if (isPaused) {
            const rideData = activeRides.get(rideId);
            if (rideData) {
              // Remove the hook and mark as paused without notifications
              if (rideData.hookId) {
                Hooks.off("updateToken", rideData.hookId);
                rideData.hookId = null;
              }
              rideData.isPaused = true;
            }
          }
          
          ui.notifications.info(`Ride restored: ${token.name} with ${followersMap.size} follower(s).`);
        } catch (error) {
          console.warn(`Size Matters | Failed to restore ride for leader ${token.id}`, error);
          // Clean up invalid flags on restoration failure
          try {
            await token.document.unsetFlag('size-matters', 'activeRideId');
            await token.document.unsetFlag('size-matters', 'rideFollowers');
            await token.document.unsetFlag('size-matters', 'isRidePaused');
          } catch (flagError) {
            // Silent fail for flag cleanup
          }
        }
      } else {
        // Clean up empty rides
        try {
          await token.document.unsetFlag('size-matters', 'activeRideId');
          await token.document.unsetFlag('size-matters', 'rideFollowers');
          await token.document.unsetFlag('size-matters', 'isRidePaused');
        } catch (flagError) {
          // Silent fail for flag cleanup
        }
      }
    }
  }
}

/**
 * Gets information about all active ride groups
 * 
 * @returns {Map} Map of leader IDs to their ride information
 */
function getActiveRideGroups() {
  const activeGroups = new Map();
  activeRides.forEach((rideData) => {
    activeGroups.set(rideData.leaderId, {
      leaderName: rideData.leaderName,
      followers: rideData.followers,
      isPaused: rideData.isPaused
    });
  });
  return activeGroups;
}

/**
 * Quick toggle function for temporary formations
 * Select multiple tokens (followers first, leader last) and run this function
 * Run again to disable
 */
let quickFollowHook = null;

function toggleQuickFollow() {
  // If already active, turn off
  if (quickFollowHook) {
    Hooks.off("updateToken", quickFollowHook);
    quickFollowHook = null;
    ui.notifications.info("Quick Follow disabled");
    return;
  }
  
  const selectedTokens = canvas.tokens.controlled;
  const leader = selectedTokens.at(-1);
  
  if (selectedTokens.length < 2) {
    ui.notifications.warn("Select followers first, then leader last (Ctrl+click)");
    return;
  }
  
  const gridSize = canvas.grid.size;
  const followers = selectedTokens.slice(0, -1).map(token => ({
    id: token.id,
    width: token.document.width * gridSize,
    height: token.document.height * gridSize,
    dx: token.center.x - leader.center.x,
    dy: token.center.y - leader.center.y
  }));
  
  // Create temporary hook for quick follow
  quickFollowHook = Hooks.on("updateToken", (tokenDocument, updateData) => {
    if (tokenDocument.id !== leader.id) return;
    
    const rotation = ((updateData.rotation ?? tokenDocument.rotation) * Math.PI) / 180;
    const sinRotation = Math.sin(rotation);
    const cosRotation = Math.cos(rotation);
    const centerX = (updateData.x ?? tokenDocument.x) + tokenDocument.width * gridSize / 2;
    const centerY = (updateData.y ?? tokenDocument.y) + tokenDocument.height * gridSize / 2;
    
    const updates = followers.map(follower => ({
      _id: follower.id,
      x: centerX + follower.dx * cosRotation - follower.dy * sinRotation - follower.width / 2,
      y: centerY + follower.dx * sinRotation + follower.dy * cosRotation - follower.height / 2,
      rotation: updateData.rotation ?? tokenDocument.rotation
    }));
    
    canvas.scene.updateEmbeddedDocuments("Token", updates, { animate: false });
  });
  
  ui.notifications.info("Quick Follow enabled! Select followers, then leader (last).");
}

// ================================
// FOUNDRY HOOKS REGISTRATION (moved to main.js for centralization)
// ================================

// Note: Hooks are now registered in main.js to avoid duplication

// ================================
// EXPORTS
// ================================

export {
  startTokenRide,
  stopTokenRide,
  pauseTokenRide,
  resumeTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags,
  toggleQuickFollow,
  createRideFromSelection,
  showRideManagementDialog
};

/**
 * Creates a ride from currently selected tokens
 * The last selected token becomes the leader, others become followers
 * 
 * @returns {Promise<void>}
 */
async function createRideFromSelection() {
  const selectedTokens = canvas.tokens.controlled;
  
  if (selectedTokens.length < 2) {
    ui.notifications.warn("Select at least 2 tokens (followers first, leader last)");
    return;
  }
  
  const leaderToken = selectedTokens[selectedTokens.length - 1];
  const followerTokens = selectedTokens.slice(0, -1);
  
  // Create followers map
  const followersMap = new Map();
  followerTokens.forEach(token => {
    followersMap.set(token.id, {
      name: token.name
    });
  });
  
  try {
    await startTokenRide(leaderToken, followersMap);
  } catch (error) {
    ui.notifications.error(`Failed to create ride: ${error.message}`);
  }
}

/**
 * Shows a dialog to manage active rides
 */
function showRideManagementDialog() {
  const activeGroups = getActiveRideGroups();
  
  if (activeGroups.size === 0) {
    ui.notifications.info("No active rides to manage");
    return;
  }
  
  let content = "<div style='max-height: 400px; overflow-y: auto;'>";
  content += "<h3>Active Rides</h3>";
  
  activeGroups.forEach((rideInfo, leaderId) => {
    const leaderToken = canvas.tokens.get(leaderId);
    if (!leaderToken) return;
    
    content += `<div style='margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;'>`;
    content += `<h4>Leader: ${rideInfo.leaderName}</h4>`;
    content += `<p><strong>Followers (${rideInfo.followers.size}):</strong></p>`;
    content += `<ul style='margin: 5px 0; padding-left: 20px;'>`;
    
    rideInfo.followers.forEach((followerData) => {
      content += `<li>${followerData.name}</li>`;
    });
    
    content += `</ul>`;
    content += `<button type="button" class="stop-ride-btn" data-leader-id="${leaderId}" style='background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;'>Stop Ride</button>`;
    content += `</div>`;
  });
  
  content += "</div>";
  
  const dialog = new Dialog({
    title: "Manage Rides",
    content: content,
    buttons: {
      stopAll: {
        label: "Stop All Rides",
        callback: async () => {
          await stopAllTokenRides();
        }
      },
      close: {
        label: "Close"
      }
    },
    default: "close"
  });
  
  dialog.render(true);
  
  // Add event listeners after dialog is rendered
  setTimeout(() => {
    const dialogElement = dialog.element;
    if (dialogElement) {
      dialogElement.find('.stop-ride-btn').click(async (event) => {
        const leaderId = event.currentTarget.dataset.leaderId;
        const leaderDocument = canvas.scene.tokens.get(leaderId);
        if (leaderDocument) {
          await stopTokenRide(leaderDocument);
          dialog.close();
          setTimeout(() => showRideManagementDialog(), 100);
        }
      });
    }
  }, 100);
}