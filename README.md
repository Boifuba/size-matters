# Size Matters: Token Effect and Formation Management

Welcome to the **Size Matters** module for Foundry VTT! This module is designed to enhance your gaming experience by allowing you to customize visual area effects for your tokens and dynamically manage token formations.

## 📖 Table of Contents

1.  [Overview](#-overview)
2.  [Key Features](#-key-features)
3.  [How to Use](#-how-to-use)
    *   [Accessing the Main Interface](#accessing-the-main-interface)
    *   [Configuring Area Effects](#configuring-area-effects)
    *   [Managing Presets](#managing-presets)
    *   [Managing Rides (Formations)](#managing-rides-formations)
    *   [Preset Button on Token HUD](#preset-button-on-token-hud)
    *   [Clear All Module Data](#clear-all-module-data)
4.  [Useful Functions for Macros](#-useful-functions-for-macros)

---

## 💡 Overview

**Size Matters** offers powerful tools for GMs and players who want to add an extra layer of immersion and functionality to their Foundry VTT games. With it, you can:

*   **Visualize Area Effects:** Easily define and visualize custom area effects for your tokens, such as auras, spells, or zones of influence.
*   **Manage Token Formations:** Create and control groups of tokens that move in formation, simplifying the movement of large groups.
*   **Save and Apply Presets:** Save your favorite effect configurations as presets to quickly apply them to any token.

---

## ✨ Key Features

*   **Interactive Grid Editor:** Select grid cells to define the exact shape of your area effect.
*   **Visual Customization:** Adjust colors, fill, contour, thickness, and even add images or videos as effects.
*   **Directional Adjustments:** For hexagonal grids, customize edge colors to indicate specific directions (red, green, yellow).
*   **Preset Management:** Create, save, load, import, and export effect configurations for reuse.
*   **Rides System (Formations):** Designate one token as a leader and others as followers, who will maintain their relative positions to the leader.
*   **Ride Controls:** Start, pause, resume, remove followers, or stop rides completely.
*   **Data Persistence:** Your configurations and rides are automatically saved and restored between sessions.
*   **Token HUD Integration:** Quickly activate presets associated with an actor directly from the token's HUD.

---

## 🚀 How to Use

### Accessing the Main Interface

You can open the main **Size Matters** interface in two ways:

1.  **Scene Control Button:** Click the hexagon icon (Size Matters Configuration) in the Scene Controls sidebar (usually next to the token controls).
2.  **Chat Command:** Type `/size-matters` in the chat and press Enter.

When opening the interface, select a token on the canvas to start configuring its effects.

### Configuring Area Effects

In the main **Size Matters** interface, you'll find several options to customize your token's area effect:

*   **Grid Visualization:** Use the preview panel to select the grid cells that make up your effect. Click and drag to select or deselect multiple cells.
*   **Color and Fill:** Choose the contour color (`Color`) and fill color (`Fill Color`) for your effect.
*   **Transparency (Alpha):** Adjust the opacity of the effect.
*   **Thickness:** Define the thickness of the contour line.
*   **Enable Fill/Contour:** Toggle the fill and contour of the effect on or off.
*   **Effect Image/Video:**
    *   **Image URL:** Enter a URL for an image or video that will be displayed as part of the effect.
    *   **Image Scale:** Adjust the size of the image/video.
    *   **Offset X/Y:** Move the image/video horizontally and vertically.
    *   **Rotation:** Rotate the image/video.
    *   **Image Visibility:** Toggle the display of the image/video on or off.
*   **Directional Highlight (Hex Grids):** Enable `Enable Directional Highlight` to color the edges of your effect based on direction (red, green, yellow). Use the `+` and `-` buttons to adjust the expansion of these colors.
*   **Zoom Level:** Change the preview grid's zoom level (`Small`, `Medium`, `Large`) to adjust the effect's scale.

Remember that changes are automatically saved to the selected token.

### Managing Presets

Presets allow you to save and reuse your effect configurations.

*   **Open Preset Manager:** Click the `Preset Manager` button in the main Size Matters interface.
*   **Save a Preset:**
    1.  Configure the desired effect in the main interface.
    2.  In the Preset Manager, type a name for the preset in the `New Preset Name` field.
    3.  Click `Save Current Configuration as Preset`.
*   **Apply a Preset:**
    1.  Select the token to which you want to apply the preset.
    2.  In the Preset Manager, click the name of the preset you want to apply.
*   **Delete a Preset:** Click the `Delete` button next to the preset name.
*   **Import/Export Presets:** Use the `Import Presets` and `Export All Presets` buttons to share or back up your configurations.

### Managing Rides (Formations)

The Rides system allows tokens to follow a leader in formation.

*   **Open Ride Manager:** Click the `Ride Manager` button in the main Size Matters interface, or type `/ride` in chat.
*   **Create a New Ride:**
    1.  In the Ride Manager, select a token as `Leader` from the list of available tokens.
    2.  Select one or more tokens as `Followers`.
    3.  Click `Start Ride`.
*   **Stop a Ride:** In the `Active Rides` panel, click `Stop Ride` next to the ride you want to end.
*   **Pause/Resume a Ride:** Click the `Pause/Resume` button next to the active ride.
*   **Remove a Follower:** In the `Active Rides` panel, click the `X` next to the name of the follower you want to remove.
*   **Stop All Rides:** Click the `Stop All Rides` button.
*   **Quick Follow (Macro):** For a temporary formation, select the follower tokens and, lastly, the leader token. Run the `toggleQuickFollow` macro (see macro section below). Run it again to disable.

### Preset Button on Token HUD

If a preset is associated with an actor (via the Preset Manager), a button will appear on the token's HUD when you select it. Clicking this button will toggle the preset's activation/deactivation on the token.

### Clear All Module Data

If you need to completely reset the module, you can clear all saved data:

1.  Go to `Game Settings` > `Manage Modules`.
2.  Find the "Size Matters" module.
3.  Next to the `Configure` button, you will see a `Clear All Data` button. Click it.
4.  Confirm the action. **WARNING: This action is irreversible and will remove all module configurations, presets, and rides!**

---

## ⚙️ Useful Functions for Macros

The module exposes some functions that can be called directly from JavaScript macros in Foundry VTT.

To access the functions, use `game.modules.get("size-matters").api.<functionName>`.

*   **`openSizeMatters()`**
    *   Opens the main Size Matters module interface.
    *   Macro Example:
        ```javascript
        game.modules.get("size-matters").api.openSizeMatters();
        ```

*   **`openRideManager()`**
    *   Opens the Ride Manager interface.
    *   Macro Example:
        ```javascript
        game.modules.get("size-matters").api.openRideManager();
        ```

*   **`openPresetManager()`**
    *   Opens the Preset Manager interface.
    *   Macro Example:
        ```javascript
        game.modules.get("size-matters").api.openPresetManager();
        ```

*   **`togglePresetOnToken(presetName)`**
    *   Activates or deactivates a specific preset on the currently controlled token.
    *   `presetName`: (String) The exact name of the preset to be applied/removed.
    *   Macro Example:
        ```javascript
        const presetName = "My Fire Aura"; // Replace with your preset name
        game.modules.get("size-matters").api.togglePresetOnToken(presetName);
        ```

*   **`createRideFromSelection()`**
    *   Creates a new ride (formation) using the selected tokens. The last selected token will be the leader, and the others will be followers.
    *   Macro Example:
        ```javascript
        game.modules.get("size-matters").api.createRideFromSelection();
        ```

*   **`showRideManagementDialog()`**
    *   Displays a simplified dialog to manage active rides.
    *   Macro Example:
        ```javascript
        game.modules.get("size-matters").api.showRideManagementDialog();
        ```

*   **`toggleQuickFollow()`**
    *   Activates or deactivates "Quick Follow" mode. Select follower tokens and, lastly, the leader token. Run this macro to start the temporary formation. Run it again to disable.
    *   Macro Example:
        ```javascript
        game.modules.get("size-matters").api.toggleQuickFollow();
        ```

---

### Support the Project

Consider supporting the project to help ongoing development.

<a href="https://www.buymeacoffee.com/boifuba" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40">
</a>
