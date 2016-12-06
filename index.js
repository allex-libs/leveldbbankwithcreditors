function createLib (execlib) {
  return execlib.loadDependencies('client', ['allex:leveldbbank:lib'], require('./creator').bind(null, execlib));
}

module.exports = createLib;
