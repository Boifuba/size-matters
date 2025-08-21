/**
 * RideManagerApp.js
 * Aplicação para gerenciar rides de tokens no Size Matters.
 */

import {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
} from "./ride-core.js";

export class RideManagerApp extends Application {
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
      this.selectedLeader = controlledTokens[0].id;

      for (let i = 1; i < controlledTokens.length; i++) {
        this.selectedFollowers.add(controlledTokens[i].id);
      }
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
      closeOnSubmit: false,
    });
  }

  getData() {
    const tokensInActiveRides = new Set();

    this.activeGroups.forEach((group, leaderId) => {
      tokensInActiveRides.add(leaderId);
      group.followers.forEach((follower, followerId) => {
        tokensInActiveRides.add(followerId);
      });
    });

    const availableTokens = canvas.tokens.placeables
      .filter((token) => !tokensInActiveRides.has(token.id))
      .map((token) => ({
        id: token.id,
        name: token.name || "Unnamed Token",
        controlled: token.controlled,
        isSelectedLeader: this.selectedLeader === token.id,
        isSelectedFollower: this.selectedFollowers.has(token.id),
      }));

    const activeGroupsArray = Array.from(this.activeGroups.entries()).map(
      ([leaderId, group]) => ({
        leaderId: leaderId,
        leaderName: group.leaderName,
        followers: Array.from(group.followers.entries()).map(
          ([followerId, follower]) => ({
            id: followerId,
            name: follower.name,
          })
        ),
      })
    );

    return {
      availableTokens: availableTokens,
      activeGroups: activeGroupsArray,
      selectedLeader: this.selectedLeader,
      selectedFollowers: Array.from(this.selectedFollowers),
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

    const leaderToken = canvas.tokens.get(this.selectedLeader);
    if (leaderToken && !leaderToken.controlled) {
      leaderToken.control({ releaseOthers: true });
    }

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

    const followersMap = new Map();
    for (const followerId of this.selectedFollowers) {
      const followerToken = canvas.tokens.get(followerId);
      if (followerToken) {
        followersMap.set(followerId, {
          name: followerToken.name || "Unnamed Token",
          hookId: null,
        });
      }
    }

    try {
      await startTokenRide(leaderToken, followersMap);

      this.activeGroups.set(this.selectedLeader, {
        leaderName: leaderToken.name || "Unnamed Token",
        followers: followersMap,
      });

      this.selectedLeader = null;
      this.selectedFollowers.clear();
      this.render();
    } catch (error) {
      console.error("Size Matters: Error starting ride:", error);
      ui.notifications.error("Error starting ride!");
    }
  }

  async stopRideForLeader(leaderId) {
    const leaderDocument = canvas.scene.tokens.get(leaderId);
    if (!leaderDocument) return;

    await stopTokenRide(leaderDocument);
    this.activeGroups.delete(leaderId);

    if (this.selectedLeader === leaderId) {
      this.selectedLeader = null;
    }

    const group = this.activeGroups.get(leaderId);
    if (group) {
      group.followers.forEach((follower, followerId) => {
        this.selectedFollowers.delete(followerId);
      });
    }
  }

  async removeFollowerFromGroup(leaderId, followerId) {
    const leaderDocument = canvas.scene.tokens.get(leaderId);
    if (!leaderDocument) return;

    const rideStillActive = await removeFollowerFromTokenRide(
      leaderDocument,
      followerId
    );

    if (!rideStillActive) {
      this.activeGroups.delete(leaderId);
    } else {
      const group = this.activeGroups.get(leaderId);
      if (group) {
        group.followers.delete(followerId);
      }
    }

    this.selectedFollowers.delete(followerId);

    if (!rideStillActive && this.selectedLeader === leaderId) {
      this.selectedLeader = null;
    }

    this.render();
  }

  async stopAllRides() {
    await stopAllTokenRides();

    this.selectedLeader = null;
    this.selectedFollowers.clear();

    this.activeGroups.clear();
    this.render();
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("#leader-select").change((event) => {
      this.selectedLeader = event.target.value || null;

      if (this.selectedLeader) {
        const leaderToken = canvas.tokens.get(this.selectedLeader);
        if (leaderToken) {
          leaderToken.control({ releaseOthers: true });
        }
      }
    });

    html.find(".sm-follower-checkbox").change((event) => {
      const followerId = event.target.value;
      const isChecked = event.target.checked;
      const followerToken = canvas.tokens.get(followerId);

      if (isChecked) {
        this.selectedFollowers.add(followerId);
        if (followerToken) {
          followerToken.control({ releaseOthers: false });
        }
      } else {
        this.selectedFollowers.delete(followerId);
        if (followerToken) {
          followerToken.release();
        }
      }
    });

    html.find(".sm-start-ride-btn").click(() => {
      this.startRide();
    });

    html.find(".sm-stop-all-btn").click(() => {
      this.stopAllRides();
    });

    html.find(".sm-remove-group-btn").click(async (event) => {
      const leaderId = event.currentTarget.getAttribute("data-leader");
      await this.stopRideForLeader(leaderId);
      this.render(true);
    });

    html.find(".sm-remove-follower-btn").click(async (event) => {
      const leaderId = event.currentTarget.getAttribute("data-leader");
      const followerId = event.currentTarget.getAttribute("data-follower");
      await this.removeFollowerFromGroup(leaderId, followerId);
    });
  }
}