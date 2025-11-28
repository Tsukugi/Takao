/**
 * Gets a random element from an array
 * @param arr The array to pick from
 * @returns A random element from the array
 */
const getRandomFromArray = <T>(arr: T[]): T => {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex] as T;
};

/**
 * Generates a random integer between min and max (inclusive)
 * @param min The minimum integer
 * @param max The maximum integer
 * @returns A random integer between min and max
 */
const getRandomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const MathUtils = {
  getRandomFromArray,
  getRandomNumber,
};
