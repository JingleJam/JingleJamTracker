function sortByKey(array, key) {
    return array.sort(function (a, b) {
      var x = a[key];
      var y = b[key];
      return ((x < y) ? 1 : ((x > y) ? -1 : 0));
    });
  }

function roundAmount(val, decimals = 2) {
    return +(Math.round(val + "e+" + decimals) + ("e-" + decimals));
}

function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

module.exports = {
    roundAmount,
    sortByKey,
    getRandomFloat
}  