/**
 * ui-manager.js
 * Gerenciador de interface do usuário para o Size Matters.
 */

import { SettingsManager } from './settings-manager.js';

export class UIManager {
  constructor() {
    this.directionalHighlightCheckbox = null;
  }

  /**
   * Inicializa a interface do usuário
   */
  initialize() {
    // Registrar no objeto global para acesso via socket
    window.sizeMattersUI = this;
    
    // Configurar listeners de eventos da UI
    this.setupUIListeners();
  }

  /**
   * Configura os listeners de eventos da interface
   */
  setupUIListeners() {
    // Aguardar o DOM estar pronto
    $(document).ready(() => {
      this.findAndSetupDirectionalHighlightCheckbox();
    });

    // Também tentar configurar quando a aplicação estiver pronta
    Hooks.once('ready', () => {
      setTimeout(() => {
        this.findAndSetupDirectionalHighlightCheckbox();
      }, 1000);
    });
  }

  /**
   * Encontra e configura o checkbox de destaque direcional
   */
  findAndSetupDirectionalHighlightCheckbox() {
    // Procurar por checkbox com nome relacionado ao destaque direcional
    const possibleSelectors = [
      'input[name="enableDirectionalHighlight"]',
      'input[id*="directional"]',
      'input[id*="highlight"]',
      '.size-matters-directional-highlight input[type="checkbox"]'
    ];

    for (const selector of possibleSelectors) {
      const checkbox = document.querySelector(selector);
      if (checkbox) {
        this.setupDirectionalHighlightCheckbox(checkbox);
        break;
      }
    }
  }

  /**
   * Configura o checkbox de destaque direcional
   * @param {HTMLElement} checkbox - Elemento checkbox
   */
  setupDirectionalHighlightCheckbox(checkbox) {
    if (!checkbox) return;

    this.directionalHighlightCheckbox = checkbox;

    // Definir o estado inicial baseado na configuração atual
    const currentValue = SettingsManager.getDirectionalHighlight();
    checkbox.checked = currentValue;

    // Remover listeners existentes para evitar duplicação
    checkbox.removeEventListener('change', this.handleDirectionalHighlightChange);
    
    // Adicionar listener para mudanças
    checkbox.addEventListener('change', this.handleDirectionalHighlightChange.bind(this));

    console.log('Size Matters: Directional highlight checkbox configured');
  }

  /**
   * Manipula mudanças no checkbox de destaque direcional
   * @param {Event} event - Evento de mudança
   */
  async handleDirectionalHighlightChange(event) {
    const enabled = event.target.checked;
    console.log(`Size Matters: Directional highlight checkbox changed to ${enabled}`);

    try {
      // Atualizar a configuração via SettingsManager
      await SettingsManager.setDirectionalHighlight(enabled);
      
      // Mostrar notificação de sucesso
      ui.notifications.info(`Directional colors ${enabled ? 'enabled' : 'disabled'} for all clients`);
      
    } catch (error) {
      console.error('Size Matters: Error updating directional highlight setting:', error);
      
      // Reverter o checkbox em caso de erro
      event.target.checked = !enabled;
      
      // Mostrar notificação de erro
      ui.notifications.error('Failed to update directional colors setting');
    }
  }

  /**
   * Atualiza o estado do checkbox (chamado via socket)
   * @param {boolean} enabled - Novo estado
   */
  updateDirectionalHighlightCheckbox(enabled) {
    if (this.directionalHighlightCheckbox) {
      this.directionalHighlightCheckbox.checked = enabled;
      console.log(`Size Matters: Checkbox updated to ${enabled} via socket`);
    }
  }

  /**
   * Força a reconfiguração da UI (útil para quando novos elementos são adicionados)
   */
  reconfigure() {
    setTimeout(() => {
      this.findAndSetupDirectionalHighlightCheckbox();
    }, 100);
  }
}