/**
 * Textbox element
 */
var textboxIdentifier = ':textbox:';

var extend = require('extend');

/**
 * @param {Object} options Textbox to draw
 * @param {string} options.content Contents of the textbox
 * @param {string|Paper.Color} options.color Text color
 * @param {string|Paper.Color} options.fillColor Text background color
 * @param {number|Paper.Point} options.padding Textbox padding in canvas pixels
 * @param {number} options.fontSize Font size of textbox in canvas pixels
 * @param {Paper.Point} options.point Point to place (top-left of) textbox
 * @param {} options.
 *
 * @returns {Paper.Group} The Group containing the textbox
 */
exports.paint = function(paper, options) {
  options = extend({
    padding: 5,
    fontSize: 12,
    fillColor: new paper.Color(1, 0.8),
    color: new paper.Color(0),
    point: new paper.Point(0, 0)
  }, options);
  
  var background = new paper.Path.Rectangle({
    topLeft: options.point,
    bottomRight: options.point.add(100)
  });
  
  background.fillColor = options.fillColor;
  
  var textPoint = new paper.PointText({
    point: options.point.add(options.padding).add([0, options.fontSize]),
    fontSize: options.fontSize,
    fillColor: options.color
  });
  textPoint.content = options.content;
  
  // Make the rectangle the right size for the text
  var size = new paper.Point(textPoint.bounds.width, textPoint.bounds.height)
      .add(options.padding * 2); // TODO DANGER options.padding as a Point
  
  background.bounds.size = size;

  // Create a paper.Group to store everything in
  var group = new paper.Group([background, textPoint]);
  if (options.name) {
    group.name = options.name;
  }

  return group;
};


exports.moveBelowTextboxes = function(paper, path) {
  // Move path to below any textboxes
  var children = paper.project.activeLayer.children;

  for (c = children.length - 1; c >= 0; c--) {
    if (children[c] == path) {
      continue;
    }

    if (children[c].name.search(textboxIdentifier) === -1) {
      path.insertAbove(children[c]);
      break;
    }
  }
};
