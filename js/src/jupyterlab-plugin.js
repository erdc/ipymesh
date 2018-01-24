var ipymesh = require('./index');

var base = require('@jupyter-widgets/base');

/**
 * The widget manager provider.
 */
module.exports = {
  id: 'ipymesh',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'ipymesh',
          version: ipymesh.version,
          exports: ipymesh
      });
    },
  autoStart: true
};
