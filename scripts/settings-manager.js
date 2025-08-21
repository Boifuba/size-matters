/**
 * settings-manager.js
 * Gerenciador de configurações do Size Matters com sincronização adequada.
 */

export class SettingsManager {
  static initialize() {
    // Registrar configuração global para cores direcionais
    game.settings.register("size-matters", "enableDirectionalHighlight", {
      name: "Enable Directional Highlight",
      hint: "Enable directional color highlighting for hex grids",
      scope: "world",
      config: true, // Mostrar nas configurações do Foundry para que GMs possam alterar
      type: Boolean,
      default: false,
      onChange: this.onDirectionalHighlightChange.bind(this)
    });

    // Registrar outras configurações necessárias
    game.settings.register("size-matters", "gridSizeConfig", {
      name: "Grid Size Configuration",
      scope: "world",
      config: false,
      type: Object,
      default: {
        small: {
          hex: { gridSize: 10, svgRadius: 12 },
          square: { gridSize: 4, squareSize: 20 }
        },
        medium: {
          hex: { gridSize: 10, svgRadius: 16 },
          square: { gridSize: 4, squareSize: 40 }
        },
        large: {
          hex: { gridSize: 8, svgRadius: 24 },
          square: { gridSize: 4, squareSize: 60 }
        }
      }
    });
  }

  /**
   * Callback executado quando a configuração de destaque direcional muda
   * @param {boolean} newValue - Novo valor da configuração
   */
  static async onDirectionalHighlightChange(newValue) {
    // Aguardar um tick para garantir que a configuração foi salva
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Redesenhar todos os tokens que têm configurações do Size Matters
    if (canvas && canvas.tokens) {
      for (const token of canvas.tokens.placeables) {
        // Importar dinamicamente para evitar dependência circular
        const { drawSizeMattersGraphicsForToken } = await import('./token-graphics.js');
        await drawSizeMattersGraphicsForToken(token);
      }
    }
    
    // Notificar outros clientes sobre a mudança
    if (game.user.isGM) {
      game.socket.emit("module.size-matters", {
        type: "directionalHighlightChanged",
        value: newValue
      });
    }
  }

  /**
   * Atualiza a configuração de destaque direcional
   * @param {boolean} enabled - Se deve habilitar o destaque direcional
   */
  static async setDirectionalHighlight(enabled) {
    if (game.user.isGM) {
      await game.settings.set("size-matters", "enableDirectionalHighlight", enabled);
    } else {
      // Se não for GM, enviar solicitação via socket
      game.socket.emit("module.size-matters", {
        type: "requestDirectionalHighlightChange",
        value: enabled,
        userId: game.user.id
      });
    }
  }

  /**
   * Obtém o valor atual da configuração de destaque direcional
   * @returns {boolean} Estado atual do destaque direcional
   */
  static getDirectionalHighlight() {
    return game.settings.get("size-matters", "enableDirectionalHighlight");
  }

  /**
   * Configura os listeners de socket para sincronização
   */
  static setupSocketListeners() {
    game.socket.on("module.size-matters", async (data) => {
      switch (data.type) {
        case "directionalHighlightChanged":
          // Atualizar interface se necessário
          if (window.sizeMattersUI) {
            window.sizeMattersUI.updateDirectionalHighlightCheckbox(data.value);
          }
          
          // Redesenhar todos os tokens que têm configurações do Size Matters
          if (canvas && canvas.tokens) {
            for (const token of canvas.tokens.placeables) {
              // Importar dinamicamente para evitar dependência circular
              import('./token-graphics.js').then(module => {
                module.drawSizeMattersGraphicsForToken(token);
              });
            }
          }
          break;
          
        case "requestDirectionalHighlightChange":
          // Apenas GM pode processar solicitações de mudança
          if (game.user.isGM) {
            await game.settings.set("size-matters", "enableDirectionalHighlight", data.value);
          }
          break;
      }
    });
  }
}