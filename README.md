# Size Matters - Foundry VTT Module

[English](#english) | [Português](#português)

---

## English

A Foundry VTT module that allows you to create custom shapes and visual effects on tokens, plus "ride" functionality where tokens can automatically follow other tokens with proper rotation and relative positioning.

### Table of Contents

- [Installation](#installation)
- [How to Open the Module](#how-to-open-the-module)
- [Features](#features)
- [Usage Guide](#usage-guide)
- [Chat Commands](#chat-commands)
- [Grid Support](#grid-support)
- [Troubleshooting](#troubleshooting)

### Installation

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste the manifest URL or search for "Size Matters"
4. Click **Install**
5. Enable the module in your desired world

### How to Open the Module

#### Method 1: Toolbar Button (Recommended)

1. **Select a token** on the canvas
2. In the left toolbar, look for the **hexagon icon**
3. Click the **"Size Matters Config"** button
4. The configuration dialog will open

#### Method 2: Chat Commands

Type one of these commands in the chat:

```
/size
```

This will open the Size Matters configuration dialog.

For the Ride Manager:
```
/ride
```

This will open the Ride Manager dialog.

#### Method 3: JavaScript Console (Advanced Users)

Open the browser console (F12) and type:

```javascript
// Open Size Matters config
openSizeMatters();

// Open Ride Manager
openRideManager();
```

### Features

#### Visual Customization
- **Grid Selection**: Click and drag to select grid cells around your token
- **Custom Shapes**: Works with both hexagonal and square grids
- **Color Customization**: Choose outline and fill colors
- **Transparency Control**: Adjust alpha values for fills
- **Image Overlay**: Add custom images with scaling, positioning, and rotation
- **Preset System**: Save and load your favorite configurations

#### Ride System
- **Token Following**: Make tokens follow a leader with relative positioning
- **Rotation Support**: Followers maintain relative rotation to the leader
- **Multi-Follower**: One leader can have multiple followers
- **Persistent**: Rides are saved and restored when the scene reloads

### Usage Guide

#### Basic Shape Creation

1. **Open the module** using any method above
2. **Select grid cells** by clicking and dragging on the grid preview
3. **Customize appearance**:
   - Choose outline color and thickness
   - Set fill color and transparency
   - Toggle outline/fill on/off
4. **Apply changes** - shapes appear automatically as you configure

#### Adding Images

1. Click **"Browse Image"** button
2. Select an image file from your Foundry files
3. Adjust image properties:
   - **Scale**: Resize the image (0.1x to 3.0x)
   - **X/Y Offset**: Position the image relative to token center
   - **Rotation**: Rotate the image (-180° to 180°)
4. Use **"Image"** button to toggle visibility

#### Using Presets

1. **Save a Preset**:
   - Configure your desired settings
   - Enter a name in the preset field
   - Click the **save icon**

2. **Load a Preset**:
   - Select a preset from the dropdown
   - Click the **play icon**

3. **Delete a Preset**:
   - Select a preset from the dropdown
   - Click the **trash icon**

#### Ride System

1. **Open Ride Manager** with `/ride` command or `openRideManager()`
2. **Select Leader**: Choose which token will be the leader
3. **Select Followers**: Check the tokens that should follow
4. **Start Ride**: Click "Start Ride" button
5. **Manage Active Rides**: View and stop active rides in the manager

### Chat Commands

| Command | Description |
|---------|-------------|
| `/size` | Opens the Size Matters configuration dialog |
| `/ride` | Opens the Ride Manager dialog |

### Grid Support

#### Supported Grid Types
- **Square Grids**: Full support
- **Hexagonal Grids**: All variants supported
  - Odd-R (Pointy-top, odd rows offset)
  - Even-R (Pointy-top, even rows offset)  
  - Odd-Q (Flat-top, odd columns offset)
  - Even-Q (Flat-top, even columns offset)
- **Gridless**: Not supported

#### Grid Interaction
- **Click**: Select/deselect individual cells
- **Click + Drag**: Select multiple cells at once
- **Green Cell**: Token center (cannot be deselected)
- **Blue Cells**: Selected cells
- **White Cells**: Available cells

### Controls Reference

#### Main Dialog Controls
- **Grid Preview**: Interactive grid for cell selection
- **Color Pickers**: Set outline and fill colors
- **Sliders**: Adjust thickness, transparency, image properties
- **Checkboxes**: Toggle outline/fill visibility
- **Buttons**:
  - **Ride**: Open Ride Manager
  - **Clear**: Reset all settings
  - **Image**: Toggle image visibility
  - **Grid**: Toggle grid visibility

#### Ride Manager Controls
- **Leader Dropdown**: Select the leading token
- **Follower Checkboxes**: Choose following tokens
- **Active Groups**: View and manage current rides
- **Buttons**:
  - **Start Ride**: Begin following
  - **Stop All**: End all rides
  - **Remove**: Remove specific followers or groups

### Advanced Features

#### Token Selection Integration
- Automatically updates when you select different tokens
- Controlled tokens are highlighted in the Ride Manager
- Settings are saved per-token

#### Performance Optimizations
- Efficient PIXI graphics rendering
- Texture caching for images
- Safe memory cleanup
- Optimized ticker functions

### Troubleshooting

#### Common Issues

**"This module works with hexagonal and square grids only!"**
- Solution: Change your scene's grid type to square or hexagonal

**Graphics not appearing**
- Ensure you have selected grid cells
- Check that outline or fill is enabled
- Try clearing and reconfiguring

**Ride not working**
- Make sure both leader and followers are selected
- Verify tokens exist on the current scene
- Check console for error messages

**Performance issues**
- Reduce number of active graphics
- Clear unused presets
- Restart Foundry if memory usage is high

#### Debug Commands

Open browser console (F12) and use:

```javascript
// Check active rides
console.log(window.sizeMattersActiveRides);

// Clear all graphics
clearAllSizeMattersGraphics();

// Check texture cache
console.log(textureCache);
```

#### Getting Help

1. Check the browser console (F12) for error messages
2. Disable other modules to test for conflicts
3. Report issues with:
   - Foundry VTT version
   - Module version
   - Browser type
   - Error messages from console

---

## Português

Um módulo para Foundry VTT que permite criar formas personalizadas e efeitos visuais em tokens, além de funcionalidade de "cavalgar" onde tokens podem seguir outros tokens automaticamente com rotação e posicionamento relativo adequados.

### Índice

- [Instalação](#instalação-1)
- [Como Abrir o Módulo](#como-abrir-o-módulo-1)
- [Funcionalidades](#funcionalidades-1)
- [Guia de Uso](#guia-de-uso-1)
- [Comandos de Chat](#comandos-de-chat-1)
- [Suporte a Grades](#suporte-a-grades)
- [Solução de Problemas](#solução-de-problemas-1)

### Instalação

1. No Foundry VTT, vá para **Add-on Modules**
2. Clique em **Install Module**
3. Cole a URL do manifesto ou procure por "Size Matters"
4. Clique em **Install**
5. Ative o módulo no mundo desejado

### Como Abrir o Módulo

#### Método 1: Botão na Barra de Ferramentas (Recomendado)

1. **Selecione um token** no canvas
2. Na barra de ferramentas à esquerda, procure pelo **ícone de hexágono**
3. Clique no botão **"Size Matters Config"**
4. O diálogo de configuração será aberto

#### Método 2: Comandos de Chat

Digite um destes comandos no chat:

```
/size
```

Isso abrirá o diálogo de configuração do Size Matters.

Para o Gerenciador de Cavalgar:
```
/ride
```

Isso abrirá o diálogo do Gerenciador de Cavalgar.

#### Método 3: Console JavaScript (Usuários Avançados)

Abra o console do navegador (F12) e digite:

```javascript
// Abrir configuração do Size Matters
openSizeMatters();

// Abrir Gerenciador de Cavalgar
openRideManager();
```

### Funcionalidades

#### Personalização Visual
- **Seleção de Grade**: Clique e arraste para selecionar células da grade ao redor do token
- **Formas Personalizadas**: Funciona com grades hexagonais e quadradas
- **Personalização de Cores**: Escolha cores de contorno e preenchimento
- **Controle de Transparência**: Ajuste valores alfa para preenchimentos
- **Sobreposição de Imagem**: Adicione imagens personalizadas com escala, posicionamento e rotação
- **Sistema de Presets**: Salve e carregue suas configurações favoritas

#### Sistema de Cavalgar
- **Seguir Tokens**: Faça tokens seguirem um líder com posicionamento relativo
- **Suporte a Rotação**: Seguidores mantêm rotação relativa ao líder
- **Múltiplos Seguidores**: Um líder pode ter vários seguidores
- **Persistente**: Cavalgadas são salvas e restauradas quando a cena recarrega

### Guia de Uso

#### Criação Básica de Formas

1. **Abra o módulo** usando qualquer método acima
2. **Selecione células da grade** clicando e arrastando na prévia da grade
3. **Personalize a aparência**:
   - Escolha cor e espessura do contorno
   - Defina cor e transparência do preenchimento
   - Ative/desative contorno/preenchimento
4. **Aplique mudanças** - formas aparecem automaticamente conforme você configura

#### Adicionando Imagens

1. Clique no botão **"Browse Image"**
2. Selecione um arquivo de imagem dos seus arquivos do Foundry
3. Ajuste propriedades da imagem:
   - **Scale**: Redimensione a imagem (0.1x a 3.0x)
   - **X/Y Offset**: Posicione a imagem relativa ao centro do token
   - **Rotation**: Gire a imagem (-180° a 180°)
4. Use o botão **"Image"** para alternar visibilidade

#### Usando Presets

1. **Salvar um Preset**:
   - Configure suas configurações desejadas
   - Digite um nome no campo de preset
   - Clique no **ícone salvar**

2. **Carregar um Preset**:
   - Selecione um preset do dropdown
   - Clique no **ícone play**

3. **Deletar um Preset**:
   - Selecione um preset do dropdown
   - Clique no **ícone lixeira**

#### Sistema de Cavalgar

1. **Abra o Gerenciador de Cavalgar** com comando `/ride` ou `openRideManager()`
2. **Selecione Líder**: Escolha qual token será o líder
3. **Selecione Seguidores**: Marque os tokens que devem seguir
4. **Iniciar Cavalgada**: Clique no botão "Start Ride"
5. **Gerenciar Cavalgadas Ativas**: Visualize e pare cavalgadas ativas no gerenciador

### Comandos de Chat

| Comando | Descrição |
|---------|-----------|
| `/size` | Abre o diálogo de configuração do Size Matters |
| `/ride` | Abre o diálogo do Gerenciador de Cavalgar |

### Suporte a Grades

#### Tipos de Grade Suportados
- **Grades Quadradas**: Suporte completo
- **Grades Hexagonais**: Todas as variantes suportadas
  - Odd-R (Ponta para cima, linhas ímpares deslocadas)
  - Even-R (Ponta para cima, linhas pares deslocadas)
  - Odd-Q (Lado plano para cima, colunas ímpares deslocadas)
  - Even-Q (Lado plano para cima, colunas pares deslocadas)
- **Sem Grade**: Não suportado

#### Interação com Grade
- **Clique**: Selecionar/desselecionar células individuais
- **Clique + Arrastar**: Selecionar múltiplas células de uma vez
- **Célula Verde**: Centro do token (não pode ser desmarcada)
- **Células Azuis**: Células selecionadas
- **Células Brancas**: Células disponíveis

### Referência de Controles

#### Controles do Diálogo Principal
- **Prévia da Grade**: Grade interativa para seleção de células
- **Seletores de Cor**: Definir cores de contorno e preenchimento
- **Sliders**: Ajustar espessura, transparência, propriedades da imagem
- **Checkboxes**: Alternar visibilidade de contorno/preenchimento
- **Botões**:
  - **Ride**: Abrir Gerenciador de Cavalgar
  - **Clear**: Resetar todas as configurações
  - **Image**: Alternar visibilidade da imagem
  - **Grid**: Alternar visibilidade da grade

#### Controles do Gerenciador de Cavalgar
- **Dropdown de Líder**: Selecionar o token líder
- **Checkboxes de Seguidores**: Escolher tokens seguidores
- **Grupos Ativos**: Visualizar e gerenciar cavalgadas atuais
- **Botões**:
  - **Start Ride**: Começar a seguir
  - **Stop All**: Terminar todas as cavalgadas
  - **Remove**: Remover seguidores ou grupos específicos

### Recursos Avançados

#### Integração com Seleção de Tokens
- Atualiza automaticamente quando você seleciona tokens diferentes
- Tokens controlados são destacados no Gerenciador de Cavalgar
- Configurações são salvas por token

#### Otimizações de Performance
- Renderização eficiente de gráficos PIXI
- Cache de texturas para imagens
- Limpeza segura de memória
- Funções ticker otimizadas

### Solução de Problemas

#### Problemas Comuns

**"This module works with hexagonal and square grids only!"**
- Solução: Mude o tipo de grade da sua cena para quadrada ou hexagonal

**Gráficos não aparecem**
- Certifique-se de ter selecionado células da grade
- Verifique se contorno ou preenchimento está habilitado
- Tente limpar e reconfigurar

**Cavalgada não funciona**
- Certifique-se de que líder e seguidores estão selecionados
- Verifique se os tokens existem na cena atual
- Verifique o console para mensagens de erro

**Problemas de performance**
- Reduza o número de gráficos ativos
- Limpe presets não utilizados
- Reinicie o Foundry se o uso de memória estiver alto

#### Comandos de Debug

Abra o console do navegador (F12) e use:

```javascript
// Verificar cavalgadas ativas
console.log(window.sizeMattersActiveRides);

// Limpar todos os gráficos
clearAllSizeMattersGraphics();

// Verificar cache de texturas
console.log(textureCache);
```

#### Obtendo Ajuda

1. Verifique o console do navegador (F12) para mensagens de erro
2. Desabilite outros módulos para testar conflitos
3. Reporte problemas com:
   - Versão do Foundry VTT
   - Versão do módulo
   - Tipo de navegador
   - Mensagens de erro do console

---

## License

This module is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

**Size Matters** - Making tokens matter, one shape at a time!