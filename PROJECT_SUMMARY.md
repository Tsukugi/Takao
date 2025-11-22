# Takao Game Engine - Project Summary

## Overview
Takao is a turn-based game engine for console games with AI integration that connects to the Atago library. The engine generates narrative-driven stories based on unit states and actions, with persistent game state across sessions.

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
- Uses action templates from JSON configuration
- Creates rich story content with meaningful unit interactions
- Saves narrative history to diary entries

### 4. Data Persistence
- **actions.json**: Defines all possible actions with descriptions and effects
- **names.json**: Catalog of names for unit generation  
- **diary.json**: Narrative history of all turns (runtime, git-ignored)
- **units.json**: Current state of all game units (runtime, git-ignored)
- **Templates**: Template files provided as reference for developers

### 5. Action System
- **14+ Action Types**:
  - Combat: `attack`, `defend`
  - Support: `support`, `rest`, `meditate`
  - Exploration: `explore`, `scout`, `hunt`
  - Interactions: `interact`, `trade`
  - Development: `train`, `study`
  - Resources: `gather`, `call_help`
- **Action Effects**: Real-time property modifications on units
- **Entity Interactions**: Actions can affect multiple units simultaneously

### 6. Continuity Features
- **Turn Continuation**: Game sessions continue from where the previous session ended (e.g., turns 1-10, then 11-20, then 21-30, etc.)
- **State Persistence**: Unit properties and names preserved between sessions
- **Narrative History**: Complete diary of all actions across sessions

### 7. Developer Experience
- Template files for reference structures
- Comprehensive README documentation
- Clean separation of tracked templates vs runtime data
- Type-safe TypeScript implementation
- Modern tooling (tsup, ESLint, Prettier, Vitest)

## Architecture
- **GameEngine**: Main orchestrator connecting all components
- **UnitController**: Manages Atago-based game units
- **StoryTeller**: Generates narrative actions and manages story flow
- **DataManager**: Handles JSON file operations
- **TurnManager**: Manages turn-based mechanics

## Technology Stack
- TypeScript with strict typing
- Node.js runtime
- Atago library integration for unit system
- Modern build tools (tsup)
- Git for version control with proper file separation

## Usage
The engine can be started with `npm start` and will continue from the last turn number, preserving all unit states and narrative history between sessions.