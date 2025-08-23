# Changelog

## 1.2.1
- **Fix:** Dialog size definition causing undesired behavior

### 1. Benefits of These Changes
- **Better Performance:** Debounced operations prevent excessive saves and redraws  
- **Cleaner Architecture:** Clear separation of responsibilities between modules  
- **Reduced Redundancy:** Eliminated duplicate code and conflicting configurations  
- **Improved Maintainability:** Centralized hook management and consistent patterns  
- **Better User Experience:** More responsive UI with optimized update cycles  

### 2. Additional Improvements
1. The preview system displays a centered token, helping the user understand which token they are applying effects to.  
2. In the preview grid, the colors of the hexes can be changed as well as the opacity using the fill configuration.  
3. The image/effect/mount is displayed in the preview grid.  
4. A zoom feature facilitates the visualization of effect application and can have its levels adjusted in the settings.  
5. Directional colors include a fine-tuning system to show front and back.  


## 1.2.2

### TokenGraphicsManager Class
- **Centralized Management:** Each token now has a dedicated manager that handles all PIXI.js objects  
- **Dirty Flag System:** Only updates what actually changed (position, rotation, settings, grid, imageSource)  
- **Efficient Caching:** Compares cached values to detect changes and avoid unnecessary updates  
- **Single Ticker:** One ticker per token instead of multiple scattered tickers  

### 2. Performance Improvements
- **No More Complete Recreations:** PIXI.js objects are created once and updated incrementally  
- **Removed setTimeout Delays:** Eliminated race conditions from delayed updates  
- **Smart Updates:** Only the changed aspects are updated, not the entire graphics system  
- **Memory Management:** Proper cleanup and destruction of PIXI.js objects  

### 3. Code Structure Improvements
- **Removed Debounced Functions:** The ticker system handles updates efficiently  
- **Cleaner Hook Management:** Simplified main.js hooks without setTimeout delays  
- **Better Error Handling:** Graceful degradation when objects are destroyed  
- **Consistent API:** Legacy functions still work but use the new optimized system  



### 4 
Key Improvements:

    Single Debounced Handler: Replaced debouncedSave and debouncedDraw with one consolidated debouncedSaveAndDraw function.

    Coordinated Operations: The new handler ensures that save and draw operations are always executed together in the correct sequence:
        Save settings first
        Save global defaults
        Redraw grid (if HTML element is provided)

    Optimized Timing: Uses a single 300ms debounce period (the higher of the two previous values) to ensure all rapid changes are batched together.

    Error Handling: Added try-catch block to handle potential errors gracefully and provide user feedback.

    Simplified API: The saveAndDraw(html) method now has a cleaner implementation with just one function call.

Benefits:

    Eliminates Race Conditions: No more overlapping save/draw operations
    Reduces Redundant Operations: saveGlobalDefaults() is called only once per batch of changes
    Improves Performance: Fewer database writes and canvas redraws
    Better UX: Smoother interactions with less stuttering during rapid changes
    Easier Maintenance: Single point of control for debounced operations
