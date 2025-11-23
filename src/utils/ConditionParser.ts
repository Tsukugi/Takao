/**
 * Utility class for parsing and evaluating condition strings
 */
export class ConditionParser {
  /**
   * Evaluates a condition string against a value
   * @param condition The condition string (e.g., "health <= 30", "mana > 50")
   * @param value The value to check against the condition
   * @returns True if the condition is satisfied, false otherwise
   */
  public static evaluateCondition(condition: string, value: number): boolean {
    // Define the operators and their checking functions
    const operators = [
      {
        symbol: '<=',
        checkFunc: (val: number, threshold: number) => val <= threshold,
      },
      {
        symbol: '>=',
        checkFunc: (val: number, threshold: number) => val >= threshold,
      },
      {
        symbol: '<',
        checkFunc: (val: number, threshold: number) => val < threshold,
      },
      {
        symbol: '>',
        checkFunc: (val: number, threshold: number) => val > threshold,
      },
    ];

    // Find the appropriate operator in the condition
    for (const { symbol, checkFunc } of operators) {
      if (condition.includes(symbol)) {
        // Extract the value after the operator
        const parts = condition.split(symbol)[1];
        if (parts) {
          const threshold = parseFloat(parts.trim());
          if (!isNaN(threshold)) {
            return checkFunc(value, threshold);
          }
        }
      }
    }

    // If condition format is not recognized, return false
    return false;
  }
}
