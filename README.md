# Size Matters

A comprehensive FoundryVTT module that allows you to create customizable highlights around tokens on both **hexagonal and square grids**, with optional image overlays and preset management.

## Features

### Core Functionality
- **Universal Grid Support**: Works seamlessly with both **hexagonal grids** (Hex Odd-R, Hex Even-R, Hex Odd-Q, Hex Even-Q) and **square grids**
- **Interactive Grid Selection**: Visual grid selector to choose which cells to highlight around your token
- **Real-time Updates**: All changes are applied immediately to the canvas with live preview
- **Token Synchronization**: Highlights automatically follow token movement and rotation
- **Multi-user Synchronization**: Changes are instantly visible to all connected users

### Customization Options
- **Appearance Controls**: 
  - Outline and fill colors with color picker
  - Adjustable thickness (1-10) and opacity (0.1-1.0)
  - Enable/disable fill and outline independently
- **Image Overlay System**: 
  - Add custom images that follow the token
  - Real-time scale adjustment (0.1x to 3.0x)
  - Precise positioning with X/Y offset sliders (-200 to +200 pixels)
- **Visibility Controls**: Toggle image and grid highlights independently

### Preset Management
- **Save Configurations**: Save your current settings as named presets
- **Quick Loading**: Instantly apply saved presets to any token
- **Preset Library**: Manage multiple presets for different scenarios
- **Easy Deletion**: Remove unwanted presets with confirmation dialog

### Accessibility
- **Chat Command**: Use `/size-matters` in chat to open the module
- **Macro Support**: Create macro buttons for quick access
- **Persistent Settings**: Your configuration is saved and restored between sessions

## Installation

### Automatic Installation (Recommended)
1. In Foundry VTT, go to the **Add-on Modules** tab
2. Click **Install Module**
3. Paste this manifest URL:
   ```
   https://github.com/Boifuba/size-matters/releases/download/0.0.6/module.json
   ```
4. Click **Install**
5. Enable the module in your world's module settings

### Manual Installation
1. Download the module files from the [releases page](https://github.com/Boifuba/size-matters/releases)
2. Extract to your FoundryVTT `Data/modules/size-matters/` directory
3. Enable the module in your world's module settings

## Usage

### Quick Start
1. **Select a Token**: Click on any token in your scene (works with hex or square grids)
2. **Open the Module**: 
   - Type `/size-matters` in chat, OR
   - Run the macro `openSizeMatters()`, OR
   - Create a macro button (see [Macro Setup](#macro-setup))
3. **Select Grid Cells**: Click on the cells in the visual grid to select/deselect them
4. **Customize**: Adjust colors, thickness, opacity, and add images as desired
5. **Auto-Draw**: Changes are applied immediately and visible to all users

### Chat Command
Simply type `/size-matters` in the chat to open the Size Matters dialog. This command:
- Works from any chat message
- Doesn't appear in the chat log
- Requires a token to be selected first

### Grid Selection
- **Interactive Grid**: Click cells to select/deselect them (works for both hex and square grids)
- **Center Cell**: The green center cell represents the token's position (cannot be deselected)
- **Real-time Preview**: Changes are applied immediately when you select cells
- **Visual Feedback**: Selected cells appear in blue, unselected in white

### Preset Management

#### Saving Presets
1. Configure your desired settings (colors, thickness, opacity, image, etc.)
2. Enter a name in the "Enter preset name..." field
3. Click **Save Current** to save the current configuration
4. The preset will be available in the dropdown for future use

#### Loading Presets
1. Select a preset from the dropdown menu
2. Click **Load** to apply the preset settings
3. The current grid selection is preserved when loading presets
4. All appearance settings will be updated immediately

#### Deleting Presets
1. Select the preset you want to delete from the dropdown
2. Click **Delete** 
3. Confirm the deletion in the dialog that appears
4. The preset will be permanently removed

### Image Settings
- **Browse Image**: Select an image file to overlay on the highlight
- **Scale**: Adjust image size from 0.1x to 3.0x with real-time preview
- **X/Y Position**: Fine-tune image positioning with sliders (-200 to +200 pixels)
- **Rotation**: Images automatically rotate with the token

### Appearance Controls
- **Outline Color**: Color of the cell borders
- **Fill Color**: Color of the cell interiors  
- **Thickness**: Border line thickness (1-10 pixels)
- **Opacity**: Transparency level (0.1-1.0)
- **Enable Fill/Outline**: Toggle fill and outline independently

### Action Buttons
- **Draw**: Manually redraw the highlight (usually not needed due to auto-draw)
- **Clear**: Remove all highlights and reset all settings to default
- **Toggle Image**: Show/hide the image overlay
- **Toggle Grid**: Show/hide the grid highlights

## Grid Support

### Supported Grid Types
- **Hexagonal Grids**: 
  - Hex Odd-R (Pointy-Top)
  - Hex Even-R (Pointy-Top)
  - Hex Odd-Q (Flat-Top)
  - Hex Even-Q (Flat-Top)
- **Square Grids**: Standard square grid layout

### Automatic Detection
The module automatically detects your scene's grid type and adjusts the highlight system accordingly. No manual configuration needed!

## Macro Setup

Create a macro with this code to easily access the module:

```javascript
openSizeMatters();
```

**Setup Instructions:**
1. Create a new macro in Foundry VTT
2. Set the macro type to **"Script"**
3. Paste the code above
4. Give it a name like "Size Matters"
5. Optionally add it to your hotbar for quick access

## Requirements

- **FoundryVTT**: Version 11 or higher (verified up to v13)
- **Grid Type**: Works with hexagonal grids and square grids
- **Scene Setup**: Your scene must have a grid configured
- **Permissions**: Players need token control permissions to use the module

## Technical Details

### Performance Optimizations
- Uses PIXI.Graphics for efficient rendering
- Optimized position tracking with change detection
- Automatic cleanup when dialogs are closed
- Efficient ticker management to prevent memory leaks

### Data Storage
- **Token Settings**: Stored as flags on individual tokens
- **Presets**: Stored as world-level game settings
- **Synchronization**: Automatic updates across all connected users

### File Structure
```
size-matters/
├── src/
│   ├── main.js              # Main entry point and initialization
│   ├── app.js               # SizeMattersApp class and UI logic
│   ├── graphics.js          # PIXI graphics rendering functions
│   ├── utils.js             # Utility functions and validation
│   ├── hooks.js             # Foundry VTT hooks and event handlers
│   └── constants.js         # Configuration constants
├── styles/
│   └── size-matters.css     # FoundryVTT native styling
├── templates/
│   └── size-matters-dialog.html  # UI template
└── module.json              # Module manifest
```

## Troubleshooting

### Common Issues

**"Select a token first"**
- Make sure you have a token selected before running the macro or chat command
- Ensure you have permission to control the selected token

**"This module works with hexagonal and square grids only!"**
- Your scene must use a supported grid type
- Check your scene configuration under Grid settings
- Supported: Hex grids (all variants) and Square grids

**Image not loading**
- Verify the image path is correct and accessible to FoundryVTT
- Ensure the image file exists and hasn't been moved
- Supported formats: PNG, JPG, WEBP, SVG
- Check browser console for specific error messages

**Highlights not following token**
- Try clearing and redrawing the highlight
- Make sure the token hasn't been deleted or replaced
- Check that the scene grid is properly configured

**Chat command not working**
- Ensure the module is enabled and loaded
- Try refreshing the page if the module was recently enabled
- Check browser console for error messages

**Presets not saving**
- Ensure you have GM permissions (presets are world-level settings)
- Check that the preset name doesn't contain special characters
- Try refreshing and attempting again

### Performance Tips
- Use appropriately sized images for better performance
- Clear highlights when not needed to free up resources
- The module automatically optimizes rendering for your grid type
- Limit the number of tokens with active highlights in complex scenes

### Debug Information
If you encounter issues:
1. Open browser console (F12)
2. Look for "Size Matters:" prefixed messages
3. Include relevant console output when reporting issues

## Contributing

We welcome contributions! Please feel free to:
- Submit bug reports on the [GitHub issues page](https://github.com/Boifuba/size-matters/issues)
- Suggest new features or improvements
- Submit pull requests with fixes or enhancements
- Help improve documentation

### Development Setup
1. Clone the repository
2. The module uses ES6 modules with a modular architecture
3. Test changes in a development Foundry instance
4. Follow the existing code style and patterns

## Changelog

### Version 0.0.6
- Complete code refactoring with modular architecture
- Added preset management system (save/load/delete configurations)
- Implemented `/size-matters` chat command
- Enhanced multi-user synchronization
- Improved error handling and validation
- Better performance optimizations
- Updated UI with preset management controls

### Previous Versions
- See [releases page](https://github.com/Boifuba/size-matters/releases) for full changelog

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Boifuba/size-matters/issues)
- **Discord**: Contact Boifubá for direct support
- **Documentation**: This README contains comprehensive usage instructions

---

**Size Matters** - Because sometimes, size really does matter! 🎯