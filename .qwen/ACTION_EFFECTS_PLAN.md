# Action Effects Externalization Plan

## Goal
Move action effects from hardcoded methods in StoryTeller to JSON configuration files for easy extension without code changes.

## Current State
- Action effects are hardcoded in StoryTeller.executeActionEffect() switch statement
- Adding new actions requires modifying StoryTeller.ts
- Effects are tightly coupled to specific action types

## Proposed Solution
Create a JSON-based action effects system that allows defining action effects declaratively.

## Implementation Steps

### 1. Update actions.json structure
Modify actions.json to include effect specifications:

```json
{
  "actions": {
    "low_health": [
      {
        "type": "search",
        "description": "{{unitName}} the {{unitType}} searches for healing.",
        "effects": [
          {
            "target": "self",
            "property": "health",
            "operation": "add",
            "value": {
              "type": "static",
              "value": 10
            },
            "permanent": false
          }
        ]
      },
      {
        "type": "retreat", 
        "description": "{{unitName}} the {{unitType}} retreats to recover.",
        "effects": [
          {
            "target": "self", 
            "property": "health",
            "operation": "add",
            "value": {
              "type": "calculation",
              "expression": "base_health * 0.15" 
            },
            "permanent": false
          }
        ]
      }
    ],
    "healthy": [
      {
        "type": "explore",
        "description": "{{unitName}} the {{unitType}} explores confidently.",
        "effects": [
          {
            "target": "self",
            "property": "experience", 
            "operation": "add",
            "value": {
              "type": "static",
              "value": 5
            },
            "permanent": false
          }
        ]
      }
    ],
    "default": [
      {
        "type": "train",
        "description": "{{unitName}} the {{unitType}} practices skills.",
        "effects": [
          {
            "target": "self",
            "property": "attack",
            "operation": "add", 
            "value": {
              "type": "static",
              "value": 2
            },
            "permanent": true
          }
        ]
      },
      {
        "type": "attack", 
        "description": "{{unitName}} the {{unitType}} attacks {{targetUnitName}}.",
        "effects": [
          {
            "target": "target",
            "property": "health",
            "operation": "subtract",
            "value": {
              "type": "calculation", 
              "expression": "attacker.attack - target.defense"
            },
            "permanent": false
          },
          {
            "target": "self",
            "property": "mana",
            "operation": "subtract",
            "value": {
              "type": "static",
              "value": 5
            },
            "permanent": false
          }
        ]
      }
    ]
  }
}
```

### 2. Create EffectDefinition interface

```typescript
// types/Effects.ts
export interface EffectValue {
  type: 'static' | 'calculation' | 'variable';
  value?: number;
  expression?: string; // for calculations like "attacker.attack * 0.8"
  variable?: string;   // for referencing variables like "damage_from_payload"
}

export interface EffectDefinition {
  target: 'self' | 'target' | 'all' | 'ally' | 'enemy';
  property: string; // 'health', 'attack', 'defense', 'mana', etc.
  operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'set';
  value: EffectValue;
  permanent: boolean; // true for base values, false for current values
  condition?: string; // optional condition expression
}
```

### 3. Modify DataManager to load effect definitions

Update DataManager to include methods for loading action effects from JSON:

```typescript
// utils/DataManager.ts
export interface ActionsDataWithEffects {
  actions: {
    low_health: ActionWithEffects[];
    healthy: ActionWithEffects[];
    default: ActionWithEffects[];
  };
}

export interface ActionWithEffects {
  type: string;
  description: string;
  effects: EffectDefinition[];
}
```

### 4. Update StoryTeller to execute effects from JSON

Replace the switch statement in StoryTeller.executeActionEffect() with a generic effect processor:

```typescript
public async executeActionEffect(action: GameAction, units: any[]): Promise<void> {
  // Find the action definition with effects
  const actionDef = this.findActionDefinition(action.type);
  if (!actionDef || !actionDef.effects) {
    console.log(`No effects defined for action type: ${action.type}`);
    return;
  }

  // Execute each effect defined for this action
  for (const effect of actionDef.effects) {
    await this.executeEffect(effect, action, units);
  }
}

private async executeEffect(effect: EffectDefinition, action: GameAction, units: any[]): Promise<void> {
  // Resolve target unit based on effect.target
  let targetUnit: any;
  switch (effect.target) {
    case 'self':
      targetUnit = units.find((u: any) => u.name === action.player);
      break;
    case 'target':
      targetUnit = units.find((u: any) => u.id === action.payload?.targetUnit);
      break;
    case 'all':
      // Apply to all units
      for (const unit of units) {
        await this.applyEffectToUnit(effect, unit, action, units);
      }
      return;
    // ... other cases
    default:
      targetUnit = units.find((u: any) => u.name === action.player);
  }

  if (targetUnit) {
    await this.applyEffectToUnit(effect, targetUnit, action, units);
  }
}

private async applyEffectToUnit(effect: EffectDefinition, targetUnit: any, action: GameAction, allUnits: any[]): Promise<void> {
  // Calculate the actual value to apply
  const calculatedValue = this.calculateEffectValue(effect.value, action, targetUnit, allUnits);
  
  // Determine whether to use setProperty (temporary) or setBaseProperty (permanent)
  if (effect.permanent) {
    targetUnit.setBaseProperty(effect.property, calculatedValue);
  } else {
    const currentValue = targetUnit.getPropertyValue(effect.property) || 0;
    let newValue: number;
    
    switch (effect.operation) {
      case 'add':
        newValue = currentValue + calculatedValue;
        break;
      case 'subtract':
        newValue = Math.max(0, currentValue - calculatedValue); // Prevent negative values
        break;
      case 'set':
        newValue = calculatedValue;
        break;
      // ... other operations
    }
    
    targetUnit.setProperty(effect.property, newValue);
  }
}

private calculateEffectValue(valueDef: EffectValue, action: GameAction, targetUnit: any, allUnits: any[]): number {
  switch (valueDef.type) {
    case 'static':
      return valueDef.value || 0;
    case 'calculation':
      return this.evaluateCalculation(valueDef.expression || '', action, targetUnit, allUnits);
    case 'variable':
      return this.getVariableValue(valueDef.variable || '', action, targetUnit);
    default:
      return 0;
  }
}

private evaluateCalculation(expression: string, action: GameAction, targetUnit: any, allUnits: any): number {
  // Parse and evaluate mathematical expressions like "attacker.attack * 0.8"
  // This would involve safely evaluating expressions with access to unit properties
  // Implementation would need to be safe against injection
  // For now, simple placeholder
  return 0;
}
```

### 5. Benefits of this approach

- **Extensibility**: New actions can be added by just adding JSON entries
- **Flexibility**: Complex multi-effect actions possible without code changes  
- **Maintainability**: Effects logic centralized and declarative
- **Configuration**: Effects can be tuned without rebuilding code

### 6. Implementation priority

Phase 1: Update actions.json schema and data loading
Phase 2: Create effect execution engine in StoryTeller
Phase 3: Implement calculation evaluator for complex effects
Phase 4: Update tests to work with new system
Phase 5: Document the JSON effect specification

This approach transforms the action system from hardcoded switches to a data-driven, extensible system where new capabilities can be added through configuration alone.