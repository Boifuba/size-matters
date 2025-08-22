# Sugestões de Melhorias - Size Matters Module

Este documento contém sugestões de melhorias para o módulo Size Matters, organizadas por prioridade e categoria.

## 🔥 Prioridade Alta - Problemas de Performance e Estabilidade

### Comportamento não desejado.

Quando usuário seleciona outro `TokenDocument` o app principal mostra dialog reduzido. 

###  Otimização do Sistema de Renderização PIXI.js

**Problema Atual:**
- `drawSizeMattersGraphicsForToken` recria completamente os objetos PIXI a cada atualização
- Uso excessivo de `setTimeout` em hooks pode causar condições de corrida
- Múltiplas chamadas de `clearTokenSizeMattersGraphics` seguidas de recriação

**Sugestões:**
```javascript
// Implementar sistema de dirty flags
class TokenGraphicsManager {
  constructor(token) {
    this.token = token;
    this.isDirty = {
      position: false,
      rotation: false,
      settings: false,
      grid: false
    };
  }
  
  markDirty(type) {
    this.isDirty[type] = true;
  }
  
  updateIfDirty() {
    // Atualizar apenas o que mudou
  }
}
```

### Gerenciamento de Memória e Cache de Texturas

**Problema Atual:**
- Cache de texturas pode crescer indefinidamente
- Não há limpeza de texturas não utilizadas
- Possível vazamento de memória com sprites PIXI

**Sugestões:**
- Implementar LRU (Least Recently Used) cache para texturas
- Adicionar limpeza automática de texturas não utilizadas há X tempo
- Implementar pooling de objetos PIXI para reutilização

### Debouncing e Throttling de Eventos

**Problema Atual:**
- Eventos de mouse podem disparar muitas vezes durante drag operations
- Atualizações de sliders podem ser excessivas

**Implementação Atual Boa:**
```javascript
// Já implementado corretamente
debouncedSave = foundry.utils.debounce(async () => {
  await this.saveSettings();
  await this.saveGlobalDefaults();
}, 300);
```

**Sugestão:** Expandir para mais operações custosas.

## 🚀 Prioridade Média - Melhorias de Código e Arquitetura

### 4. Refatoração de Funções Grandes

**`main.js` - `togglePresetOnToken` (120+ linhas):**
```javascript
// Dividir em funções menores
async function applyPresetToToken(token, presetName, presetData) {
  // Lógica de aplicação
}

async function deactivatePresetOnToken(token, presetName) {
  // Lógica de desativação
}

async function updateTokenHUD(token) {
  // Lógica de atualização do HUD
}
```

**`token-graphics.js` - `createGridGraphics` (200+ linhas):**
```javascript
// Extrair lógica de cores direcionais
class DirectionalColorCalculator {
  constructor(settings, selectedCells) {
    this.settings = settings;
    this.selectedCells = selectedCells;
  }
  
  calculateEdgeColors(edges) {
    // Lógica complexa de cores direcionais
  }
}
```

### 5. Sistema de Configuração Mais Robusto

**Problema Atual:**
- Configurações espalhadas entre diferentes objetos
- Validação de entrada limitada

**Sugestão:**
```javascript
class SettingsValidator {
  static validateAlpha(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0.8 : Math.max(0, Math.min(1, num));
  }
  
  static validateScale(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 1.0 : Math.max(0.1, Math.min(5.0, num));
  }
  
  static validateSettings(settings) {
    return {
      ...settings,
      alpha: this.validateAlpha(settings.alpha),
      imageScale: this.validateScale(settings.imageScale),
      // ... outras validações
    };
  }
}
```

### 6. Sistema de Eventos Customizados

**Sugestão:**
```javascript
// Implementar sistema de eventos para comunicação entre componentes
class SizeMattersEvents {
  static PRESET_APPLIED = 'size-matters.preset-applied';
  static GRID_UPDATED = 'size-matters.grid-updated';
  static SETTINGS_CHANGED = 'size-matters.settings-changed';
  
  static emit(eventName, data) {
    Hooks.callAll(eventName, data);
  }
  
  static on(eventName, callback) {
    Hooks.on(eventName, callback);
  }
}
```

## 💡 Prioridade Baixa - Funcionalidades e UX

### 7. Melhorias na Interface do Usuário

**Sugestões:**
- Adicionar tooltips explicativos para controles complexos
- Implementar undo/redo para operações de grid
- Adicionar preview em tempo real para ajustes de imagem
- Keyboard shortcuts para operações comuns

### 8. Funcionalidades Avançadas

**Grid Templates:**
```javascript
// Sistema de templates de grid pré-definidos
const GRID_TEMPLATES = {
  'cone-15ft': {
    name: 'Cone 15ft',
    description: 'Cone de 15 pés para D&D 5e',
    grid: { /* configuração específica */ }
  },
  'fireball-20ft': {
    name: 'Fireball 20ft',
    description: 'Área de Fireball de 20 pés',
    grid: { /* configuração específica */ }
  }
};
```

**Animações:**
```javascript
// Sistema de animações para efeitos
class EffectAnimator {
  static fadeIn(sprite, duration = 500) {
    // Implementar fade in suave
  }
  
  static pulse(sprite, intensity = 0.2) {
    // Implementar efeito de pulsação
  }
}
```

### 9. Sistema de Plugins/Extensões

**Sugestão:**
```javascript
// API para outros módulos estenderem funcionalidade
class SizeMattersAPI {
  static registerGridRenderer(name, renderer) {
    // Permitir renderizadores customizados
  }
  
  static registerPresetType(name, handler) {
    // Permitir tipos de preset customizados
  }
}

// Expor API globalmente
game.modules.get('size-matters').api = SizeMattersAPI;
```

## 🔧 Melhorias Técnicas Específicas

### 10. Constantes e Configurações

**Problema:** Números mágicos espalhados pelo código
```javascript
// Em constants.js, adicionar:
export const PERFORMANCE_SETTINGS = {
  TEXTURE_CACHE_SIZE: 50,
  DEBOUNCE_DELAY: 300,
  TICKER_UPDATE_FREQUENCY: 60, // FPS
  MAX_GRID_SIZE: 20,
  DEFAULT_OFFSET_SCALE_DIVISOR: 50
};

export const UI_SETTINGS = {
  ACCORDION_ANIMATION_DURATION: 200,
  TOOLTIP_DELAY: 500,
  PREVIEW_UPDATE_DELAY: 100
};
```

### 11. Sistema de Logging

**Sugestão:**
```javascript
class SizeMattersLogger {
  static debug(message, ...args) {
    if (game.settings.get('size-matters', 'debugMode')) {
      console.log(`[Size Matters DEBUG] ${message}`, ...args);
    }
  }
  
  static warn(message, ...args) {
    console.warn(`[Size Matters] ${message}`, ...args);
  }
  
  static error(message, error) {
    console.error(`[Size Matters ERROR] ${message}`, error);
    ui.notifications.error(`Size Matters: ${message}`);
  }
}
```

### 12. Testes e Validação

**Sugestões:**
- Implementar testes unitários para funções de cálculo de grid
- Adicionar validação de compatibilidade com diferentes versões do Foundry
- Criar sistema de benchmark para operações custosas

