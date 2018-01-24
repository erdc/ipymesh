// Entry point for the notebook bundle containing custom model definitions.
//
// Setup notebook base URL

// Export widget models and views, and the npm package version number.
module.exports = require('./ipymesh-widgets.js');
module.exports['version'] = require('../package.json').version;
