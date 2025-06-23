# Size Matters

A FoundryVTT module that allows you to create customizable highlights around tokens on both **hexagonal and square grids**, with optional image overlays.

## Features

- **Universal Grid Support**: Works seamlessly with both **hexagonal grids** (Hex Odd-R, Hex Even-R, Hex Odd-Q, Hex Even-Q) and **square grids**
- **Interactive Grid Selection**: Visual grid selector to choose which cells to highlight around your token
- **Customizable Appearance**: 
  - Outline and fill colors with color picker
  - Adjustable thickness (1-10) and opacity (0.1-1.0)
  - Enable/disable fill and outline independently
- **Image Overlay System**: 
  - Add custom images that follow the token
  - Real-time scale adjustment (0.1x to 3.0x)
  - Precise positioning with X/Y offset sliders
- **Token Synchronization**: Highlights automatically follow token movement and rotation
- **Real-time Updates**: All changes are applied immediately to the canvas
- **Persistent Settings**: Your configuration is saved and restored between sessions
- **Visibility Controls**: Toggle image and grid highlights independently

## Installation

### Manual Installation
1. Download the module files
2. Extract to your FoundryVTT `Data/modules/size-matters/` directory
3. Enable the module in your world's module settings

### Manifest URL
```
https://github.com/Boifuba/size-matters/releases/download/0.0.2/module.json
```

## Usage

### Basic Usage
1. **Select a Token**: Click on any token in your scene (works with hex or square grids)
2. **Open the Module**: Run the macro `openSizeMatters()` or create a macro button
3. **Select Grid Cells**: Click on the cells in the visual grid to select/deselect them
4. **Customize Appearance**: Adjust colors, thickness, and opacity as desired
5. **Draw**: The highlight will automatically appear on the canvas

### Controls

#### Grid Selection
- **Interactive Grid**: Click cells to select/deselect them (works for both hex and square grids)
- **Center Cell**: The green center cell represents the token's position (cannot be deselected)
- **Auto-Draw**: Changes are applied immediately when you select cells

#### Image Settings
- **Browse Image**: Select an image file to overlay on the highlight
- **Scale**: Adjust image size from 0.1x to 3.0x with real-time preview
- **X/Y Position**: Fine-tune image positioning with sliders (-200 to +200 pixels)

#### Appearance
- **Outline Color**: Color of the cell borders
- **Fill Color**: Color of the cell interiors  
- **Thickness**: Border line thickness (1-10 pixels)
- **Opacity**: Transparency level (0.1-1.0)
- **Enable Fill/Outline**: Toggle fill and outline independently

#### Action Buttons
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

## Requirements

- **FoundryVTT**: Version 11 or higher (verified up to v13)
- **Grid Type**: Works with hexagonal grids and square grids
- **Scene Setup**: Your scene must have a grid configured

## Technical Details

### Performance
- Uses PIXI.Graphics for efficient rendering
- Highlights are positioned using canvas tickers for smooth movement
- Automatic cleanup when dialogs are closed
- Optimized for both hex and square grid calculations

### File Structure
```
size-matters/
├── scripts/
│   └── main.js              # Main module logic
├── styles/
│   └── size-matters.css     # FoundryVTT native styling
├── templates/
│   └── size-matters-dialog.html  # UI template
└── module.json              # Module manifest
```

## Macro Setup

Create a macro with this code to easily access the module:

```javascript
openSizeMatters();
```

Set the macro type to "Script" and optionally add it to your hotbar.

## Troubleshooting

### Common Issues

**"Select a token first"**
- Make sure you have a token selected before running the macro

**"This module works with hexagonal and square grids only!"**
- Your scene must use a supported grid type
- Check your scene configuration under Grid settings
- Supported: Hex grids (all variants) and Square grids

**Image not loading**
- Verify the image path is correct
- Ensure the image file is accessible to FoundryVTT
- Supported formats: PNG, JPG, WEBP, SVG

**Highlights not following token**
- Try clearing and redrawing the highlight
- Make sure the token hasn't been deleted or replaced

### Performance Tips
- Use appropriately sized images for better performance
- Clear highlights when not needed to free up resources
- The module automatically optimizes rendering for your grid type

## Contributing

Feel free to submit issues, feature requests, or pull requests on the project repository.

## License

MIT
