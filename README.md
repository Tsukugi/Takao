# Takao Game Engine

A basic turn-based game engine for console games with AI integration that connects to the Atago library.

## Overview

The Takao Game Engine is designed to facilitate turn-based console games where AI agents make decisions each turn. The engine provides:
- A flexible turn-based system
- Integration with AI libraries (specifically designed to work with Atago)
- A modular architecture that supports various game types
- Typesafe interfaces for game state management

## Project Structure

```
src/
├── core/          # Core engine components
│   ├── GameEngine.ts
│   ├── GameLoop.ts
│   └── TurnManager.ts
├── ai/            # AI controller interface
│   └── AIController.ts
├── types/         # Type definitions
│   └── index.ts
└── index.ts       # Entry point with example game
```

## Installation

1. Make sure you have Node.js installed
2. Clone this repository
3. Install dependencies:

```bash
npm install
```

## Usage

### Running the Example Game

```bash
npm start
```

Or for development:

```bash
npm run dev
```

### Building the Project

```bash
npm run build
```

## Integration with Atago

The engine is designed to work with the Atago library for AI decision making. The `AIController` class handles communication with the Atago library and translates its outputs into game actions.

To integrate with your specific Atago implementation:
1. Update the import in `src/ai/AIController.ts` to point to your actual Atago library
2. Modify the `getAction` method to properly interface with your Atago API
3. Adjust the action processing in the `GameEngine` if needed

## Creating Your Own Game

To create your own game with this engine:

1. Define your game state by extending the `GameState` interface
2. Implement game-specific action processing in your game class
3. Customize the AI controller to work with your specific game rules
4. Implement win/lose conditions in the `shouldContinue` method

## Core Components

### GameEngine
The main orchestrator that connects all components and manages the game flow.

### GameLoop
Handles the timing and scheduling of turns.

### TurnManager
Manages the turn-based mechanics and game state transitions.

### AIController
Interfaces with the Atago library to get actions for each turn.

## License

MIT