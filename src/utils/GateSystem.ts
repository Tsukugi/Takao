/**
 * Gate system for connecting maps
 * Defines connections between positions on different maps
 */

export interface GateConnection {
  mapFrom: string;
  positionFrom: { x: number; y: number };
  mapTo: string;
  positionTo: { x: number; y: number };
  name: string;
  bidirectional?: boolean;
}

export class GateSystem {
  private gates: GateConnection[] = [];

  /**
   * Adds a gate connection between two maps
   */
  public addGate(gate: GateConnection): boolean {
    // Check if a gate with the same name already exists
    if (this.gates.some(existingGate => existingGate.name === gate.name)) {
      return false; // Gate with this name already exists
    }

    this.gates.push(gate);

    // Add reverse gate if bidirectional
    if (gate.bidirectional) {
      this.gates.push({
        mapFrom: gate.mapTo,
        positionFrom: gate.positionTo,
        mapTo: gate.mapFrom,
        positionTo: gate.positionFrom,
        name: gate.name + '_reverse',
        bidirectional: false, // The reverse gate is not itself bidirectional to avoid duplication
      });
    }

    return true;
  }

  /**
   * Removes a gate connection by name
   */
  public removeGate(gateName: string): boolean {
    const initialLength = this.gates.length;
    this.gates = this.gates.filter(gate => !gate.name.startsWith(gateName)); // Also removes reverse gates
    return this.gates.length !== initialLength;
  }

  /**
   * Gets the destination for a unit at a specific position on a map
   */
  public getDestination(
    mapId: string,
    x: number,
    y: number
  ): GateConnection | undefined {
    return this.gates.find(
      gate =>
        gate.mapFrom === mapId &&
        gate.positionFrom.x === x &&
        gate.positionFrom.y === y
    );
  }

  /**
   * Lists all gates for a specific map
   */
  public getGatesForMap(mapId: string): GateConnection[] {
    return this.gates.filter(gate => gate.mapFrom === mapId);
  }

  /**
   * Checks if a position on a map has a gate
   */
  public hasGate(mapId: string, x: number, y: number): boolean {
    return !!this.getDestination(mapId, x, y);
  }

  /**
   * Gets all available gates
   */
  public getAllGates(): GateConnection[] {
    return [...this.gates];
  }

  /**
   * Clears all gates
   */
  public clear(): void {
    this.gates = [];
  }
}
