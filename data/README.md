# Data Templates

This directory contains template files to help developers understand the expected structure of runtime data files.

## Runtime Files (not tracked in Git)

The following files are generated during runtime and contain game session data:

- `diary.json` - Stores the narrative history of actions taken
- `units.json` - Stores the current state of game units
- `engine.config.ts` - Local engine configuration (TypeScript)
- `world.json` - Stores the current state of maps and world configuration

These files are automatically created and updated during gameplay, and are excluded from Git via `.gitignore`.

## Template Files (tracked in Git)

The following template files show the expected structure:

- `diary.template.json` - Shows the structure for diary entries
- `units.template.json` - Shows the structure for unit data
- `world.template.json` - Shows the structure for world and map data
- `actions.json` - Defines all possible actions (tracked in Git)
- `names.json` - Contains names catalog for units (tracked in Git)
- `beastiary.json` - Defines unit templates for spawning (tracked in Git)

## File Structures

### Diary Entry Structure
```json
{
  "turn": 1,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "action": {
    "type": "patrol",
    "player": "ExampleUnit",
    "description": "ExampleUnit the warrior patrols the area vigilantly."
  },
  "summary": "ExampleUnit the warrior patrols the area vigilantly."
}
```

### Unit Structure
```json
{
  "id": "example-unit-uuid-1234-5678-9012",
  "name": "ExampleWarrior",
  "type": "warrior",
  "properties": {
    "health": {
      "name": "health",
      "value": 100,
      "baseValue": 100
    },
    "mana": {
      "name": "mana",
      "value": 50,
      "baseValue": 50
    },
    "attack": {
      "name": "attack",
      "value": 20,
      "baseValue": 20
    },
    "defense": {
      "name": "defense",
      "value": 15,
      "baseValue": 15
    }
  }
}
```

### World Structure
```json
{
  "maps": [
    {
      "name": "ExampleMap",
      "width": 20,
      "height": 20,
      "cells": [
        [
          {
            "terrain": "grass",
            "properties": {
              "movementCost": 1
            }
          }
        ]
      ]
    }
  ],
  "unitPositions": [
    {
      "unitId": "example-unit-uuid-1234-5678-9012",
      "mapId": "ExampleMap",
      "position": {
        "x": 0,
        "y": 0
      }
    }
  ]
}
```

### Bestiary Entry Structure
```json
{
  "id": "wolf",
  "name": "Wolf",
  "type": "beast",
  "properties": {
    "health": {
      "name": "health",
      "value": 60,
      "baseValue": 60
    }
  }
}
```
