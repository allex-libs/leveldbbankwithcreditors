function createLib (execlib) {
  return execlib.loadDependencies('client', ['allex_leveldbbanklib'], require('./creator').bind(null, execlib));
}

module.exports = createLib;
