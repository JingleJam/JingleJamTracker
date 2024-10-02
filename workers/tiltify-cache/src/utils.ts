function sortByKey<T>(array: T[], key: keyof T): T[] {
  return array.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      return (x < y) ? 1 : (x > y) ? -1 : 0;
  });
}

function roundAmount(val: number, decimals: number = 2): number {
  return +(Math.round(Number(val + "e+" + decimals)) + ("e-" + decimals));
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export {
  roundAmount,
  sortByKey,
  getRandomFloat
};
