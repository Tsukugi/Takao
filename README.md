# Takao Game Engine

A sophisticated game engine for console games with AI integration that connects to the Atago library, supporting complex turn-based mechanics and action processing.

## Overview

The Takao Game Engine is designed to facilitate complex console games with AI-controlled units that make intelligent decisions each turn. The engine provides:
- Advanced turn-based system with history tracking
- Deep AI integration with the Atago library for intelligent unit behavior
- Comprehensive action processing with requirement validation and effect execution
- Flexible stat tracking and narrative generation
- Condition-based action filtering and story telling
- Data management and persistence capabilities
- Modular architecture supporting various game types

## Project Structure

```
src/
├── core/          # Core engine components
│   ├── GameEngine.ts
│   ├── GameLoop.ts
│   ├── StoryTeller.ts
│   └── TurnManager.ts
├── ai/            # AI controller interface
│   └── UnitController.ts
├── utils/         # Utility components
│   ├── ActionProcessor.ts
│   ├── ConditionParser.ts
│   ├── DataManager.ts
│   ├── Math.ts
│   └── StatTracker.ts
├── types/         # Type definitions
│   ├── index.ts
│   └── typeGuards.ts
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

### Manual turn control

- The engine now runs in manual mode: press `Enter` to advance a turn and `ESC` to stop when running in a TTY.
- If stdin is unavailable (e.g., headless runs), the engine stays paused; trigger turns programmatically via `gameEngine.playTurn()`.
- Automatic turn fallback has been removed to avoid unintended movement or processing.

### Action diary details

- Diary entries include per-unit stat change summaries and structured blocks for JSON consumers (grouped by unit name).
- Movement logged in the diary only applies after an action succeeds; idle turns no longer move units.

## Integration with Atago

The engine is designed to work with the Atago library for AI decision making. The `UnitController` class handles communication with the Atago library and manages AI-controlled units that make intelligent decisions each turn.

To integrate with your specific Atago implementation:
1. Update the import in `src/ai/UnitController.ts` to point to your actual Atago library
2. Modify the unit initialization and action methods to properly interface with your Atago API
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

### StoryTeller
Generates narrative elements and manages the story flow of the game, coordinating with AI units to create engaging scenarios.

### TurnManager
Manages the turn-based mechanics and game state transitions.

### UnitController
Interfaces with the Atago library to control AI units and manage their behavior.

### ActionProcessor
Processes and executes game actions with requirement validation and effect application.

### ConditionParser
Evaluates conditions in actions to determine their applicability in the current game state.

### DataManager
Handles data persistence and retrieval for game states and saved information.

### StatTracker
Monitors and tracks changes to unit statistics throughout the game.

## License

MIT
