import {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags,
  createRideFromSelection,
  showRideManagementDialog,
} from "./ride-core.js";
import { GridManager } from "./grid-manager.js";
import { getTexture, clearTextureCache } from "./texture-utils.js";
import {
  drawSizeMattersGraphicsForToken,
  clearTokenSizeMattersGraphics,
  clearAllSizeMattersGraphics,
} from "./token-graphics.js";
import { SettingsManager } from './settings-manager.js';
import { UIManager } from './ui-manager.js';

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

class SizeMattersApp extends Application {
  constructor(token = null, options = {}) {
    super(options);
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.gridManager = new GridManager();
    this.gridManager = new GridManager();
    this.initializeGrid();
    this.loadSettings();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "size-matters",
      title: "Yes, Size Matters!",
      template: "modules/size-matters/templates/size-matters-dialog.html",
      width: 420,
      height: "auto",
      resizable: false,
      closeOnSubmit: false,
    });
  }

  async render(force = false, options = {}) {
    const result = await super.render(force, options);

    return result;
  }

  initializeGrid() {
    const zoomLevel = this.settings?.zoomLevel || "medium";
    this.grid = this.gridManager.initializeGrid(zoomLevel, this.grid);
    this.currentSvgRadius = this.gridManager.getSvgRadius();
    this.currentSquareSize = this.gridManager.getSquareSize();
  }

  loadSettings() {
    const tokenSettings = this.token
      ? this.token.document.getFlag("size-matters", "settings") || {}
      : {};

    // Load global defaults first
    const globalDefaults =
      game.settings.get("size-matters", "globalDefaults") || {};

    // Start with hardcoded defaults, then merge global defaults, then token-specific settings
    const hardcodedDefaults = {
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 3, // Fixed at 3px
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      imageVisible: true,
      zoomLevel: "medium",
      redLineAdjustment: 0,
      greenLineAdjustment: 0,
    };

    // Merge in order: hardcoded -> global -> token-specific
    this.settings = foundry.utils.mergeObject(
      hardcodedDefaults,
      globalDefaults
    );
    this.settings = foundry.utils.mergeObject(this.settings, tokenSettings);

    // Force thickness to always be 3
    this.settings.thickness = 3;

    if (tokenSettings.grid) {
      this.grid = tokenSettings.grid;
    } else {
      this.initializeGrid();
    }

    // Após carregar as configurações, reinicializar o grid com o zoom level correto
    this.initializeGrid();
  }

  async saveSettings() {
    if (this.token) {
      await this.token.document.setFlag(
        "size-matters",
        "settings",
        foundry.utils.duplicate(this.settings)
      );
    }

    // Also save general settings (excluding grid) as global defaults
    const globalSettings = {
      color: this.settings.color,
      fillColor: this.settings.fillColor,
      thickness: 3, // Always save as 3
      alpha: this.settings.alpha,
      enableFill: this.settings.enableFill,
      enableContour: this.settings.enableContour,
      imageUrl: this.settings.imageUrl,
      imageScale: this.settings.imageScale,
      imageOffsetX: this.settings.imageOffsetX,
      imageOffsetY: this.settings.imageOffsetY,
      imageRotation: this.settings.imageRotation,
      imageVisible: this.settings.imageVisible,
      zoomLevel: this.settings.zoomLevel,
    };

    await game.settings.set("size-matters", "globalDefaults", globalSettings);
  }

  async setControlledToken(token) {
    this.token = token;
    this.tokenId = token ? token.id : null;
    this.loadSettings();
    this.render(false);
  }

  async getPresets() {
    return game.settings.get("size-matters", "presets") || {};
  }

  async savePreset(name, settings) {
    const presets = await this.getPresets();
    const presetData = {
      color: settings.color,
      fillColor: settings.fillColor,
      thickness: 3, // Always save presets with 3px thickness
      alpha: settings.alpha,
      enableFill: settings.enableFill,
      enableContour: settings.enableContour,
      imageUrl: settings.imageUrl,
      imageScale: settings.imageScale,
      imageOffsetX: settings.imageOffsetX,
      imageOffsetY: settings.imageOffsetY,
      imageRotation: settings.imageRotation,
      imageVisible: settings.imageVisible,
      grid: foundry.utils.duplicate(settings.grid),
    };
    presets[name] = presetData;
    await game.settings.set("size-matters", "presets", presets);
  }

  async deletePreset(name) {
    const presets = await this.getPresets();
    delete presets[name];
    await game.settings.set("size-matters", "presets", presets);
  }

  async loadPreset(name) {
    const presets = await this.getPresets();
    const preset = presets[name];
    if (preset) {
      this.settings = foundry.utils.mergeObject(this.settings, preset);
      // Force thickness to 3
      this.settings.thickness = 3;

      if (preset.grid) {
        this.grid = foundry.utils.duplicate(preset.grid);
        this.settings.grid = this.grid;
      }
      await this.saveSettings();

      this.render(true);
      await this.drawGrid();

      return true;
    }
    return false;
  }

  getData() {
    if (!this.token) {
      return {
        noToken: true,
        gridType: "No Token Selected",
        gridSize: 0,
        gridSVG:
          '<div style="text-align: center; padding: 40px; color: #666;">Select a token to configure</div>',
        isPointyTop: false,
        isHexGrid: false,
        enableDirectionalHighlight: game.settings.get(
          "size-matters",
          "enableDirectionalHighlight"
        ),
        ...this.settings,
      };
    }
    const gridType = canvas.grid.type;
    const isHexGrid = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
      CONST.GRID_TYPES.HEXODDQ,
      CONST.GRID_TYPES.HEXEVENQ,
    ].includes(gridType);
    const isPointyTop = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
    ].includes(gridType);
    return {
      gridType: isHexGrid
        ? isPointyTop
          ? "Pointy-Top Hex"
          : "Flat-Top Hex"
        : "Square Grid",
      gridSize: canvas.grid.size,
      gridSVG: this.createGridSVG(isHexGrid, isPointyTop),
      isPointyTop: isPointyTop,
      isHexGrid: isHexGrid,
      enableDirectionalHighlight: game.settings.get(
        "size-matters",
        "enableDirectionalHighlight"
      ),
      ...this.settings,
    };
  }

  createGridSVG(isHexGrid, isPointyTop) {
    const svgSize = 300;
    // Atualizar o grid no manager antes de criar o SVG
    this.gridManager.setGrid(this.grid);
    return this.gridManager.createGridSVG(isHexGrid, isPointyTop, svgSize);
  }

  updateGridSVG(html) {
    const gridType = canvas.grid.type;
    const isHexGrid = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
      CONST.GRID_TYPES.HEXODDQ,
      CONST.GRID_TYPES.HEXEVENQ,
    ].includes(gridType);
    const isPointyTop = [
      CONST.GRID_TYPES.HEXODDR,
      CONST.GRID_TYPES.HEXEVENR,
    ].includes(gridType);

    const newSVG = this.createGridSVG(isHexGrid, isPointyTop);
    html.find(".sm-grid-container").html(newSVG);
    html.find("polygon[data-grid], rect[data-grid]").click((event) => {
      const key = event.currentTarget.getAttribute("data-grid");
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.drawGrid(html);
    this.setupGridInteraction(html);
    this.setupAccordions(html);

    // Opacity input with real-time validation and update
    html.find('input[name="alpha"]').on("input", (event) => {
      let value = parseFloat(event.target.value);

      // Clamp value between 0 and 1
      if (isNaN(value) || value < 0) value = 0;
      if (value > 1) value = 1;

      // Update the input field with clamped value
      event.target.value = value;

      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    // Real-time updates for other controls
    html.find('input[name="imageScale"]').on("input", (event) => {
      html.find("#sval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageOffsetX"]').on("input", (event) => {
      html.find("#xval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageOffsetY"]').on("input", (event) => {
      html.find("#yval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageRotation"]').on("input", (event) => {
      html.find("#rval").text(event.target.value);
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="color"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="fillColor"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="enableFill"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="enableContour"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    html.find('input[name="imageVisible"]').on("change", (event) => {
      this.updateSettingsFromForm(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    // Zoom level changes with immediate update
    html.find('select[name="zoomLevel"]').on("change", (event) => {
      this.settings.zoomLevel = event.target.value;
      this.initializeGrid();
      this.updateGridSVG(html);
      this.drawGrid(html);
      this.saveSettings();
    });

    // Radio button changes for zoom level
    html.find('input[name="zoomLevel"]').on("change", (event) => {
      if (event.target.checked) {
        this.settings.zoomLevel = event.target.value;
        this.initializeGrid();
        this.updateGridSVG(html);
        this.drawGrid(html);
        this.saveSettings();
      }
    });

    // Directional highlight toggle
    html
      .find('input[name="enableDirectionalHighlight"]')
      .on("change", (event) => {
        const isEnabled = event.target.checked;
        // Usar o SettingsManager para atualizar a configuração
        SettingsManager.setDirectionalHighlight(isEnabled);
        this.drawGrid(html);
      });

    // Button handlers
    html.find(".file-picker-button").click(() => this.openFilePicker(html));
    html.find(".sm-file-picker-button").click(() => this.openFilePicker(html));
    html.find(".sm-ride-button").click(() => this.handleRideButton(html));
    html.find(".sm-clear-button").click(() => this.clearAll(html));
    html
      .find(".sm-preset-manager-button")
      .click(() => this.handlePresetManager(html));

    // Line adjustment button handlers
    html.find(".sm-add-red-btn").click(() => {
      this.settings.redLineAdjustment = Math.min(
        1,
        this.settings.redLineAdjustment + 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    html.find(".sm-remove-red-btn").click(() => {
      this.settings.redLineAdjustment = Math.max(
        -1,
        this.settings.redLineAdjustment - 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    html.find(".sm-add-green-btn").click(() => {
      this.settings.greenLineAdjustment = Math.min(
        1,
        this.settings.greenLineAdjustment + 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    html.find(".sm-remove-green-btn").click(() => {
      this.settings.greenLineAdjustment = Math.max(
        -1,
        this.settings.greenLineAdjustment - 1
      );
      this.saveSettings();
      this.drawGrid(html);
    });

    // Zoom button handlers
    html.find(".sm-zoom-in-btn").click(() => {
      const currentZoom = this.settings.zoomLevel;
      let newZoom = currentZoom;

      if (currentZoom === "small") {
        newZoom = "medium";
      } else if (currentZoom === "medium") {
        newZoom = "large";
      }
      // If already 'large', stay at 'large'

      if (newZoom !== currentZoom) {
        this.settings.zoomLevel = newZoom;
        this.initializeGrid();
        this.updateGridSVG(html);
        this.drawGrid(html);
        this.saveSettings();
      }
    });

    html.find(".sm-zoom-out-btn").click(() => {
      const currentZoom = this.settings.zoomLevel;
      let newZoom = currentZoom;

      if (currentZoom === "large") {
        newZoom = "medium";
      } else if (currentZoom === "medium") {
        newZoom = "small";
      }
      // If already 'small', stay at 'small'

      if (newZoom !== currentZoom) {
        this.settings.zoomLevel = newZoom;
        this.initializeGrid();
        this.updateGridSVG(html);
        this.drawGrid(html);
        this.saveSettings();
      }
    });

    // Save button handler
    html.find(".sm-save-button").click(async () => {
      this.updateSettingsFromForm(html);
      this.settings.grid = this.grid;
      await this.saveSettings();
      await this.drawGrid(html);
      ui.notifications.info("Settings saved successfully!");
    });
  }

  setupAccordions(html) {
    html.find(".sm-accordion-header").click((event) => {
      const header = $(event.currentTarget);
      const targetId = header.data("target");
      const content = html.find(`#${targetId}`);
      const icon = header.find(".sm-accordion-icon");

      // Toggle active state
      header.toggleClass("active");
      content.toggleClass("active");

      // Animate icon rotation is handled by CSS
    });
  }

  setupGridInteraction(html) {
    let isDragging = false;
    let dragMode = null;
    const gridElements = html.find("polygon[data-grid], rect[data-grid]");

    $(document).off("mouseup.size-matters");

    gridElements.on("mousedown", (event) => {
      event.preventDefault();
      const key = event.currentTarget.getAttribute("data-grid");
      const cell = this.grid[key];
      if (cell.isCenter) return;
      isDragging = true;
      dragMode = cell.selected ? "deselect" : "select";
      this.toggleGridCell(key, event.currentTarget);
      this.drawGrid(html);
    });

    gridElements.on("mouseenter", (event) => {
      if (!isDragging) return;
      const key = event.currentTarget.getAttribute("data-grid");
      const cell = this.grid[key];
      if (cell.isCenter) return;
      if (
        (dragMode === "select" && !cell.selected) ||
        (dragMode === "deselect" && cell.selected)
      ) {
        this.toggleGridCell(key, event.currentTarget);
        this.drawGrid(html);
      }
    });

    $(document).on("mouseup.size-matters", () => {
      isDragging = false;
      dragMode = null;
    });

    html.find(".sm-grid-container").on("mouseleave", () => {
      isDragging = false;
      dragMode = null;
    });

    html.find(".sm-grid-container").on("selectstart", (event) => {
      if (isDragging) {
        event.preventDefault();
      }
    });
  }

  updateFormFromSettings(html) {
    html.find('[name="color"]').val(this.settings.color);
    html.find('[name="fillColor"]').val(this.settings.fillColor);
    html.find('[name="alpha"]').val(this.settings.alpha);
    html.find('[name="enableFill"]').prop("checked", this.settings.enableFill);
    html
      .find('[name="enableContour"]')
      .prop("checked", this.settings.enableContour);
    html.find('[name="imageScale"]').val(this.settings.imageScale);
    html.find("#sval").text(this.settings.imageScale);
    html.find('[name="imageOffsetX"]').val(this.settings.imageOffsetX);
    html.find("#xval").text(this.settings.imageOffsetX);
    html.find('[name="imageOffsetY"]').val(this.settings.imageOffsetY);
    html.find("#yval").text(this.settings.imageOffsetY);
    html.find('[name="imageRotation"]').val(this.settings.imageRotation);
    html.find("#rval").text(this.settings.imageRotation);
  }

  async openFilePicker(html) {
    const fp = new FilePicker({
      type: "media",
      current: this.settings.imageUrl,
      callback: (path) => {
        this.settings.imageUrl = path;
        this.settings.imageVisible = true;
        this.saveSettings();
        this.updateGridSVG(html);
        this.drawGrid(html);
      },
    });
    fp.render(true);
  }

  toggleGridCell(key, element) {
    const cell = this.grid[key];
    if (!cell) return;

    cell.selected = !cell.selected;
    this.gridManager.setGrid(this.grid);
    const fill = cell.selected ? "#2196F3" : "#ffffff";
    element.setAttribute("fill", fill);
    element.classList.toggle("sm-grid-selected", cell.selected);
    element.classList.toggle("sm-grid-unselected", !cell.selected);
    this.settings.grid = this.grid;

    // Auto-save grid changes with immediate feedback
    this.saveSettings().then(() => {
      this.drawGrid();
    });
  }

  updateSettingsFromForm(html) {
    if (!html) return;
    this.settings.color = html.find('[name="color"]').val();
    this.settings.fillColor = html.find('[name="fillColor"]').val();
    this.settings.thickness = 3; // Always 3px

    // Parse opacity input with validation
    let alpha = parseFloat(html.find('[name="alpha"]').val());
    if (isNaN(alpha) || alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;
    this.settings.alpha = alpha;

    this.settings.enableFill = html.find('[name="enableFill"]').is(":checked");
    this.settings.enableContour = html
      .find('[name="enableContour"]')
      .is(":checked");
    this.settings.imageScale =
      parseFloat(html.find('[name="imageScale"]').val()) || 1.0;
    this.settings.imageOffsetX =
      parseInt(html.find('[name="imageOffsetX"]').val()) || 0;
    this.settings.imageOffsetY =
      parseInt(html.find('[name="imageOffsetY"]').val()) || 0;
    this.settings.imageRotation =
      parseInt(html.find('[name="imageRotation"]').val()) || 0;
    this.settings.imageVisible = html
      .find('[name="imageVisible"]')
      .is(":checked");
    this.settings.grid = this.grid;
  }

  async drawGrid(html) {
    if (!this.token) {
      return;
    }
    this.updateSettingsFromForm(html);
    this.settings.grid = this.grid;
    await drawSizeMattersGraphicsForToken(this.token);

    if (html) {
      this.updateGridSVG(html);
    }
  }

  async handleRideButton(html) {
    openRideManager();
  }

  async handlePresetManager(html) {
    const presetManager = new PresetManagerApp(this);
    presetManager.render(true);
  }

  clearTokenGraphics() {
    const currentToken = canvas.tokens.get(this.tokenId);
    clearTokenSizeMattersGraphics(currentToken);
  }

  async clearAll(html) {
    if (!this.token) {
      ui.notifications.warn("Select a token first!");
      return;
    }
    this.clearTokenGraphics();

    // Reset to hardcoded defaults
    this.settings = {
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 3, // Fixed at 3px
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      imageVisible: true,
      zoomLevel: "medium",
      redLineAdjustment: 0,
      greenLineAdjustment: 0,
    };

    // Reset grid manager and reinitialize
    this.grid = this.gridManager.initializeGrid("medium");
    this.settings.grid = this.grid;

    // Reset global defaults to hardcoded values
    await game.settings.set("size-matters", "globalDefaults", {
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 3,
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      imageVisible: true,
      zoomLevel: "medium",
      redLineAdjustment: 0,
      greenLineAdjustment: 0,
    });

    if (this.token) {
      await this.token.document.unsetFlag("size-matters", "settings");
    }
    if (html) {
      this.updateFormFromSettings(html);
      this.updateGridSVG(html);
    }
    ui.notifications.info("All settings cleared and reset to default!");
  }

  async close(options = {}) {
    $(document).off("mouseup.size-matters");

    // Force save settings when closing
    if (this.token) {
      const html = this.element;
      if (html && html.length > 0) {
        this.updateSettingsFromForm(html);
        this.settings.grid = this.grid;
      }
      await this.saveSettings();
      await this.drawGrid();
    }
    window.sizeMattersApp = null;
    return super.close(options);
  }
}

class PresetManagerApp extends Application {
  constructor(sizeMattersApp = null, options = {}) {
    super(options);
    this.sizeMattersApp = sizeMattersApp;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "preset-manager",
      title: "Preset Manager",
      template: "modules/size-matters/templates/preset-manager-dialog.html",
      width: 600,
      height: 500,
      resizable: true,
      closeOnSubmit: false,
    });
  }

  async getData() {
    const presets = await this.getPresets();
    const presetsArray = Object.entries(presets).map(([name, preset]) => {
      return {
        name: name,
        imageUrl: preset.imageUrl || null,
        isVideo: preset.imageUrl
          ? /\.(webm|mp4|ogg|mov)$/i.test(preset.imageUrl)
          : false,
        ...preset,
      };
    });

    return {
      presets: presetsArray,
    };
  }

  async getPresets() {
    return game.settings.get("size-matters", "presets") || {};
  }

  async savePreset(name, settings) {
    const presets = await this.getPresets();
    const presetData = {
      color: settings.color,
      fillColor: settings.fillColor,
      thickness: 3,
      alpha: settings.alpha,
      enableFill: settings.enableFill,
      enableContour: settings.enableContour,
      imageUrl: settings.imageUrl,
      imageScale: settings.imageScale,
      imageOffsetX: settings.imageOffsetX,
      imageOffsetY: settings.imageOffsetY,
      imageRotation: settings.imageRotation,
      imageVisible: settings.imageVisible,
      grid: foundry.utils.duplicate(settings.grid),
    };
    presets[name] = presetData;
    await game.settings.set("size-matters", "presets", presets);
  }

  async deletePreset(name) {
    const presets = await this.getPresets();
    delete presets[name];
    await game.settings.set("size-matters", "presets", presets);
  }

  async handleSaveCurrentPreset() {
    if (!this.sizeMattersApp) {
      ui.notifications.warn(
        "Size Matters window must be open to save current settings!"
      );
      return;
    }

    const name = document.getElementById("new-preset-name")?.value?.trim();
    if (!name) {
      ui.notifications.warn("Enter a preset name!");
      return;
    }
    //pra que isso se eu já salvei lá em cima ?
    const currentSettings = {
      ...this.sizeMattersApp.settings,
      thickness: 3, // Ensure 3px thickness
      grid: foundry.utils.duplicate(this.sizeMattersApp.grid),
    };

    await this.savePreset(name, currentSettings);
    document.getElementById("new-preset-name").value = "";
    this.render(true);
    ui.notifications.info(`Preset "${name}" saved!`);
  }

  async applyPreset(name) {
    if (!this.sizeMattersApp) {
      ui.notifications.warn(
        "Size Matters window must be open to apply presets!"
      );
      return;
    }

    // const loaded = await this.sizeMattersApp.loadPreset(name);
    // if (loaded) {
    //   ui.notifications.info(`Preset "${name}" applied!`);
    // } else {
    //   ui.notifications.error("Failed to apply preset!");
    // }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".sm-save-current-btn").click(async () => {
      await this.handleSaveCurrentPreset();
    });

    html.find(".sm-preset-item").click(async (event) => {
      if ($(event.target).closest(".sm-preset-actions").length > 0) {
        return;
      }

      const presetName = event.currentTarget.getAttribute("data-preset-name");
      await this.applyPreset(presetName);
    });

    // Adicionar listener para botão direito (associar preset ao ator)
    html.find(".sm-preset-item").on("contextmenu", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const presetName = event.currentTarget.getAttribute("data-preset-name");
      await this.associatePresetToActor(presetName);
    });
    html.find(".sm-apply-preset-btn").click(async (event) => {
      event.stopPropagation();
      const presetName = event.currentTarget.getAttribute("data-preset-name");
      await this.applyPreset(presetName);
    });

    html.find(".sm-delete-preset-btn").click(async (event) => {
      event.stopPropagation();
      const presetName = event.currentTarget.getAttribute("data-preset-name");

      const confirmed = await Dialog.confirm({
        title: "Delete Preset",
        content: `<p>Are you sure you want to delete the preset "<strong>${presetName}</strong>"?</p>`,
        yes: () => true,
        no: () => false,
      });

      if (confirmed) {
        await this.deletePreset(presetName);
        this.render(true);
        ui.notifications.info(`Preset "${presetName}" deleted!`);
      }
    });

    html.find(".sm-export-presets-btn").click(async (event) => {
      event.stopPropagation();

      try {
        const presets = await this.getPresets();

        if (Object.keys(presets).length === 0) {
          ui.notifications.warn("No presets to export!");
          return;
        }

        function downloadJSON(data, filename = "export.json") {
          const jsonString = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(url);
        }

        downloadJSON(presets, "size-matters-presets.json");

        ui.notifications.info(
          `Exported ${Object.keys(presets).length} preset(s) successfully!`
        );
      } catch (error) {
        console.error("Size Matters: Error exporting presets:", error);
        ui.notifications.error("Failed to export presets!");
      }
    });

    html.find(".sm-import-presets-btn").click(async (event) => {
      event.stopPropagation();

      try {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";

        fileInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const importedPresets = JSON.parse(text);

            if (
              typeof importedPresets !== "object" ||
              importedPresets === null
            ) {
              throw new Error("Invalid preset file format");
            }

            const currentPresets = await this.getPresets();

            const conflicts = Object.keys(importedPresets).filter((name) =>
              currentPresets.hasOwnProperty(name)
            );

            let shouldProceed = true;
            if (conflicts.length > 0) {
              shouldProceed = await Dialog.confirm({
                title: "Import Conflicts",
                content: `<p>The following presets already exist and will be overwritten:</p>
                         <ul>${conflicts
                           .map((name) => `<li><strong>${name}</strong></li>`)
                           .join("")}</ul>
                         <p>Do you want to continue?</p>`,
                yes: () => true,
                no: () => false,
              });
            }

            if (shouldProceed) {
              const mergedPresets = { ...currentPresets, ...importedPresets };
              await game.settings.set("size-matters", "presets", mergedPresets);

              this.render(true);
              ui.notifications.info(
                `Imported ${
                  Object.keys(importedPresets).length
                } preset(s) successfully!`
              );
            }
          } catch (error) {
            console.error("Size Matters: Error importing presets:", error);
            ui.notifications.error(
              "Failed to import presets! Please check the file format."
            );
          }

          document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
      } catch (error) {
        console.error("Size Matters: Error setting up import:", error);
        ui.notifications.error("Failed to set up import!");
      }
    });
  }

  async associatePresetToActor(presetName) {
    const selectedTokens = canvas.tokens.controlled;
    if (selectedTokens.length === 0) {
      ui.notifications.warn(
        "Selecione um token primeiro para associar o preset ao ator!"
      );
      return;
    }

    const token = selectedTokens[0];
    if (!token.actor) {
      ui.notifications.warn(
        "O token selecionado não possui um ator associado!"
      );
      return;
    }

    try {
      await token.actor.setFlag("size-matters", "associatedPreset", presetName);
      ui.notifications.info(
        `Preset "${presetName}" associado ao ator "${token.actor.name}"!`
      );
    } catch (error) {
      console.error("Size Matters: Erro ao associar preset ao ator:", error);
      ui.notifications.error("Erro ao associar preset ao ator!");
    }
  }
}

class GridSizeConfigApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "grid-size-config",
      title: "Grid Size Configuration",
      template: "modules/size-matters/templates/grid-size-config.html",
      width: 500,
      height: 400,
      resizable: true,
      closeOnSubmit: true,
    });
  }

  getData() {
    const config = game.settings.get("size-matters", "gridSizeConfig");
    return {
      config: config,
    };
  }

  async _updateObject(event, formData) {
    const config = {
      small: {
        hex: {
          gridSize: parseInt(formData["small.hex.gridSize"]) || 4,
          svgRadius: parseInt(formData["small.hex.svgRadius"]) || 12,
        },
        square: {
          gridSize: parseInt(formData["small.square.gridSize"]) || 4,
          squareSize: parseInt(formData["small.square.squareSize"]) || 20,
        },
      },
      medium: {
        hex: {
          gridSize: parseInt(formData["medium.hex.gridSize"]) || 4,
          svgRadius: parseInt(formData["medium.hex.svgRadius"]) || 24,
        },
        square: {
          gridSize: parseInt(formData["medium.square.gridSize"]) || 4,
          squareSize: parseInt(formData["medium.square.squareSize"]) || 40,
        },
      },
      large: {
        hex: {
          gridSize: parseInt(formData["large.hex.gridSize"]) || 4,
          svgRadius: parseInt(formData["large.hex.svgRadius"]) || 36,
        },
        square: {
          gridSize: parseInt(formData["large.square.gridSize"]) || 4,
          squareSize: parseInt(formData["large.square.squareSize"]) || 60,
        },
      },
    };

    await game.settings.set("size-matters", "gridSizeConfig", config);
    ui.notifications.info("Grid size configuration updated!");

    // Update any open Size Matters windows
    if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
      window.sizeMattersApp.initializeGrid();
      window.sizeMattersApp.render(true);
    }
  }
}

window.openSizeMatters = function () {
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn(
      "Size Matters: Foundry VTT not ready yet. Please try again in a moment."
    );
    return;
  }
  if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
    window.sizeMattersApp.bringToTop();
    return;
  }
  const token =
    canvas.tokens.controlled.length > 0 ? canvas.tokens.controlled[0] : null;
  const gridType = canvas.grid.type;
  const isHexGrid = [
    CONST.GRID_TYPES.HEXODDR,
    CONST.GRID_TYPES.HEXEVENR,
    CONST.GRID_TYPES.HEXODDQ,
    CONST.GRID_TYPES.HEXEVENQ,
  ].includes(gridType);
  const isSquareGrid = gridType === CONST.GRID_TYPES.SQUARE;
  if (!isHexGrid && !isSquareGrid) {
    return ui.notifications.warn(
      "This module works with hexagonal and square grids only!"
    );
  }
  window.sizeMattersApp = new SizeMattersApp(token);
  window.sizeMattersApp.render(true);
};

window.openRideManager = function () {
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn(
      "Size Matters: Foundry VTT not ready yet. Please try again in a moment."
    );
    return;
  }

  const rideManager = new RideManagerApp();
  rideManager.render(true);
};

window.openPresetManager = function () {
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn(
      "Size Matters: Foundry VTT not ready yet. Please try again in a moment."
    );
    return;
  }

  const presetManager = new PresetManagerApp(window.sizeMattersApp);
  presetManager.render(true);
};

window.togglePresetOnToken = async function (presetName) {
  if (!canvas || !canvas.tokens || !ui || !ui.notifications) {
    console.warn(
      "Size Matters: Foundry VTT not ready yet. Please try again in a moment."
    );
    return;
  }

  const selectedTokens = canvas.tokens.controlled;
  if (selectedTokens.length === 0) {
    ui.notifications.warn("Select a token first!");
    return;
  }

  const token = selectedTokens[0];
  if (!token || !token.document) {
    ui.notifications.error("Invalid token selected!");
    return;
  }

  try {
    const presets = game.settings.get("size-matters", "presets") || {};
    if (!presets[presetName]) {
      ui.notifications.error(`Preset "${presetName}" not found!`);
      return;
    }

    const currentActivePreset = token.document.getFlag(
      "size-matters",
      "activePreset"
    );

    if (currentActivePreset === presetName) {
      await token.document.unsetFlag("size-matters", "settings");
      await token.document.unsetFlag("size-matters", "activePreset");

      clearTokenSizeMattersGraphics(token);

      ui.notifications.info(
        `Preset "${presetName}" deactivated from ${token.name}!`
      );
    } else {
      const preset = presets[presetName];

      clearTokenSizeMattersGraphics(token);
      //denovo?
      const presetSettings = {
        color: preset.color,
        fillColor: preset.fillColor,
        thickness: 3, // Always 3px
        alpha: preset.alpha,
        enableFill: preset.enableFill,
        enableContour: preset.enableContour,
        imageUrl: preset.imageUrl,
        imageScale: preset.imageScale,
        imageOffsetX: preset.imageOffsetX,
        imageOffsetY: preset.imageOffsetY,
        imageRotation: preset.imageRotation,
        imageVisible: preset.imageVisible,
        grid: foundry.utils.duplicate(preset.grid),
      };

      await token.document.setFlag("size-matters", "settings", presetSettings);
      await token.document.setFlag("size-matters", "activePreset", presetName);

      await drawSizeMattersGraphicsForToken(token);

      // ui.notifications.info(`Preset "${presetName}" applied to ${token.name}!`);
    }

    if (
      window.sizeMattersApp &&
      window.sizeMattersApp.rendered &&
      window.sizeMattersApp.tokenId === token.id
    ) {
      window.sizeMattersApp.loadSettings();
      window.sizeMattersApp.render(true);
    }
  } catch (error) {
    console.error("Size Matters: Error toggling preset on token:", error);
    ui.notifications.error("Error applying preset to token!");
  }
};

window.sizeMatters = {
  startTokenRide,
  stopTokenRide,
  removeFollowerFromTokenRide,
  getActiveRideGroups,
  stopAllTokenRides,
  restoreRidesFromFlags,
  createRideFromSelection,
  showRideManagementDialog,
};

Hooks.once("init", () => {
  // Inicializar o SettingsManager primeiro
  SettingsManager.initialize();

  // Grid size configuration settings
  game.settings.register("size-matters", "gridSizeConfig", {
    name: "Grid Size Configuration",
    hint: "Configuration for grid sizes at different zoom levels",
    scope: "world",
    config: false,
    type: Object,
    default: {
      small: {
        hex: { gridSize: 4, svgRadius: 12 },
        square: { gridSize: 4, squareSize: 20 },
      },
      medium: {
        hex: { gridSize: 4, svgRadius: 24 },
        square: { gridSize: 4, squareSize: 40 },
      },
      large: {
        hex: { gridSize: 4, svgRadius: 36 },
        square: { gridSize: 4, squareSize: 60 },
      },
    },
  });

  // Grid size settings menu
  game.settings.registerMenu("size-matters", "gridSizeMenu", {
    name: "Grid Size Settings",
    label: "Configure Grid Sizes",
    hint: "Configure the visual size of grid cells for each zoom level",
    icon: "fas fa-th",
    type: GridSizeConfigApp,
    restricted: true,
  });

  game.settings.register("size-matters", "presets", {
    name: "Size Matters Presets",
    hint: "Stored presets for Size Matters configurations",
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register("size-matters", "globalDefaults", {
    name: "Size Matters Global Defaults",
    hint: "Global default settings for Size Matters module",
    scope: "client",
    config: false,
    type: Object,
    default: {
      color: "#ff0000",
      fillColor: "#ff0000",
      thickness: 3, // Fixed at 3px
      alpha: 0.7,
      enableFill: true,
      enableContour: true,
      imageUrl: "",
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      imageVisible: true,
      zoomLevel: "medium",
      redLineAdjustment: 0,
      greenLineAdjustment: 0,
    },
  });

});

Hooks.once("ready", () => {
  // Configurar listeners de socket do SettingsManager
  SettingsManager.setupSocketListeners();
  
  // Inicializar o UIManager
  const uiManager = new UIManager();
  uiManager.initialize();

  window.sizeMattersApp = null;
});
// Adicione este bloco de código em scripts/main.js,
// preferencialmente junto aos outros Hooks.on('ready', ...) ou Hooks.on('getSceneControlButtons', ...)

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.tokens;

  if (tokenControls && tokenControls.tools) {
    tokenControls.tools["size-matters-config-button"] = {
      name: "size-matters-config-button",
      title: "Size Matters Config",
      icon: "fas fa-hexagon",
      button: true,
      onClick: () => {
        openSizeMatters();
      },
      visible: true,
    };
  }
});

Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (message.trim() === "/size-matters") {
    openSizeMatters();
    return false;
  }
  if (message.trim() === "/ride") {
    openRideManager();
    return false;
  }
});

Hooks.on("controlToken", (token, controlled) => {
  if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
    if (controlled) {
      window.sizeMattersApp.setControlledToken(token);
    }
  }
});

Hooks.on("releaseToken", (token, controlled) => {
  if (
    window.sizeMattersApp &&
    window.sizeMattersApp.rendered &&
    canvas.tokens.controlled.length === 0
  ) {
    window.sizeMattersApp.setControlledToken(null);
  }
});

Hooks.on("canvasInit", () => {
  clearAllSizeMattersGraphics();

  clearTextureCache();
});

Hooks.on("canvasReady", async () => {
  setTimeout(async () => {
    await restoreRidesFromFlags();

    for (const token of canvas.tokens.placeables) {
      const settings = token.document.getFlag("size-matters", "settings");
      //      const activePreset = token.document.getFlag('size-matters', 'activePreset');

      if (settings && settings.grid) {
        await drawSizeMattersGraphicsForToken(token);
      } else if (!settings) {
        clearTokenSizeMattersGraphics(token);
      }
    }
  }, 500);
});

Hooks.on("renderToken", async (token) => {
  setTimeout(async () => {
    const settings = token.document.getFlag("size-matters", "settings");
    //    const activePreset = token.document.getFlag('size-matters', 'activePreset');

    if (settings && settings.grid && !token.sizeMattersGrid) {
      await drawSizeMattersGraphicsForToken(token);
    } else if (!settings && token.sizeMattersGrid) {
      clearTokenSizeMattersGraphics(token);
    }
  }, 100);
});

Hooks.on("preDeleteToken", (tokenDocument, options, userId) => {
  const token = canvas.tokens.get(tokenDocument.id);
  if (token) {
    clearTokenSizeMattersGraphics(token);
  }
});

Hooks.on("deleteToken", (tokenDocument, options, userId) => {
  stopTokenRide(tokenDocument, true);
});

Hooks.on("updateScene", (scene, changes) => {
  if (changes.active === true) {
    clearAllSizeMattersGraphics();
  }
});

Hooks.on("updateToken", async (tokenDocument, changes, options, userId) => {
  try {
    if (changes.flags && changes.flags["size-matters"]) {
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

Hooks.on("renderTokenHUD", (app, html, data) => {
  const $html = $(html);
  if ($html.find("button[data-action='toggle-montaria-preset']").length) return;

  const token = canvas.tokens.get(data._id);
  if (!token) return;

  const actorAssociatedPreset = token.actor
    ? token.actor.getFlag("size-matters", "associatedPreset")
    : null;

  if (!actorAssociatedPreset) return;

  const currentActivePreset = token.document.getFlag(
    "size-matters",
    "activePreset"
  );
  const isMontariaActive = currentActivePreset === actorAssociatedPreset;

  const button = $(`
    <button type="button" class="control-icon ${
      isMontariaActive ? "active" : ""
    }"
            data-action="toggle-montaria-preset"
            title="${
              isMontariaActive
                ? `Remover ${actorAssociatedPreset}`
                : `Adicionar ${actorAssociatedPreset}`
            }">
      <i class="${
        isMontariaActive ? "fa-solid fa-person-walking" : "fa-solid fa-horse"
      }"></i>
    </button>
  `);

  $html.find(".col.left").append(button);
  button.on("click", async () => {
    if (window.togglePresetOnToken) {
      await window.togglePresetOnToken(actorAssociatedPreset);
      app.render(true);
    } else {
      ui.notifications.error(
        "Função togglePresetOnToken não encontrada! Verifique se o seu módulo está carregado corretamente."
      );
    }
  });
});

export { SizeMattersApp };

// Hook para sincronizar configurações globais entre clientes
Hooks.on("updateSetting", (settingName, value, options) => {
  // Verifica se a configuração atualizada é a de destaque direcional
  if (settingName === "size-matters.enableDirectionalHighlight") {
    console.log(`Size Matters: Configuração de destaque direcional atualizada para ${value}. Re-renderizando gráficos dos tokens.`);

    // Adiciona um pequeno atraso para garantir que a configuração seja totalmente propagada
    setTimeout(() => {
      // Re-desenha os gráficos para TODOS os tokens no canvas,
      // pois a configuração global afeta todos eles.
      if (canvas && canvas.tokens && canvas.tokens.placeables) {
        for (const token of canvas.tokens.placeables) {
          // Chame drawSizeMattersGraphicsForToken para cada token.
          // A lógica dentro de drawSizeMattersGraphicsForToken agora lidará com
          // a aplicação da configuração global, mesmo para tokens sem flags personalizadas.
          drawSizeMattersGraphicsForToken(token);
        }
      }

      // Se a aplicação SizeMattersApp estiver aberta, atualiza o grid de pré-visualização
      if (window.sizeMattersApp && window.sizeMattersApp.rendered) {
        window.sizeMattersApp.drawGrid(window.sizeMattersApp.element);
      }
    }, 50); // Atraso de 50 milissegundos
  }
});
