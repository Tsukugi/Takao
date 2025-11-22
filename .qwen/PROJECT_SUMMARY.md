# Takao Game Engine - Project Summary

## Overview
Takao is a turn-based game engine for console games with AI integration that connects to the Atago library. The engine generates narrative-driven stories based on unit states and actions, with persistent game state across sessions. The system is fully data-driven using JSON configuration files.

## Core Features

### 1. Turn-Based Game Engine
- Manages game state, turn scheduling, and action processing
- Supports configurable turn intervals
- Handles game loop and turn management system

### 2. Unit Controller (Atago Integration)
- Manages game units using the Atago library
- Creates and manages units with properties (health, mana, attack, defense)
- Assigns unique UUIDs to prevent duplicate units
- Loads/saves unit states to/from JSON files

### 3. StoryTeller System
- Generates narrative actions based on unit states
- Uses action templates from JSON configuration with dynamic parameters
- Creates rich story content with meaningful unit interactions
- Saves narrative history to diary entries

### 4. Extensive Data Persistence
- **actions.json**: Defines all possible actions with descriptions, effects, and configurable min/max value ranges
- **names.json**: Comprehensive catalog of categorized names (warriors, archers, mages, general)
- **diary.json**: Narrative history of all turns (runtime, git-ignored)
- **units.json**: Current state of all game units (runtime, git-ignored)
- **Templates**: Template files provided as reference for developers

### 5. Dynamic Action System
- **JSON-Defined Actions**: Action parameters configurable via JSON (min/max ranges for random values)
- **14+ Action Types**:
  - Combat: `attack`, `defend`
  - Support: `support`, `rest`, `meditate`
  - Exploration: `explore`, `scout`, `hunt`
  - Interactions: `interact`, `trade`, `inspire`
  - Development: `train`, `study`, `practice`
  - Resources: `gather`, `hunt`, `collect`
- **Range-Based Parameters**: Action values (damage, healing, etc.) defined with adjustable min/max ranges in JSON
- **Action Effects**: Real-time property modifications on units
- **Entity Interactions**: Actions can affect multiple units simultaneously

### 6. Automated Name System
- **Categorized Names**: Names organized by unit type (warriors, archers, mages, etc.)
- **Automatic Naming**: Units automatically receive names from the catalog
- **Immersive Narratives**: Dynamic unit names create more engaging story content
- **Configurable Catalogs**: Easy to add new names to specific categories

### 7. Continuity Features
- **Turn Continuation**: Game sessions continue from where the previous session ended (e.g., turns 1-10, then 11-20, then 21-30, etc.)
- **State Persistence**: Unit properties and names preserved between sessions
- **Narrative History**: Complete diary of all actions across sessions
- **Property Preservation**: All unit stats maintained across sessions

### 8. Developer Experience
- Template files for reference structures
- Comprehensive README documentation
- Clean separation of tracked templates vs runtime data
- Full TypeScript type safety with all errors resolved
- Modern tooling (tsup, ESLint, Prettier, Vitest)
- JSON-driven configuration for easy customization

## Architecture
- **GameEngine**: Main orchestrator connecting all components
- **UnitController**: Manages Atago-based game units with names from catalog
- **StoryTeller**: Generates narrative actions using JSON-defined parameters
- **DataManager**: Handles JSON file operations
- **TurnManager**: Manages turn-based mechanics
- **GameLoop**: Handles timing of turns

## Technology Stack
- TypeScript with strict typing and verbatimModuleSyntax
- Node.js runtime
- Atago library integration for unit system
- Modern build tools (tsup) with proper node platform configuration
- Git for version control with proper file separation

## Key Improvements
- **All TypeScript errors resolved**: Complete type safety with proper import handling
- **JSON-configured actions**: Parameters now use min/max ranges from JSON files
- **Automatic unit naming**: Units receive names from categorized catalog
- **Configurable value ranges**: Action effects use configurable min/max values
- **Enhanced narrative**: More immersive stories with varied unit names
- **Robust data persistence**: Proper JSON loading/saving with error handling

## Usage
The engine can be started with `npm start` and will continue from the last turn number, preserving all unit states and narrative history between sessions. Action parameters and unit names are fully configurable through JSON files.