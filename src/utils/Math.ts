const getRandomFromArray = <T>(arr: T[]): T => {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex] as T;
};

export const MathUtils = {
  getRandomFromArray,
};
