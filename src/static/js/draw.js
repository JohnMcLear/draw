// Please refactor me, this is mostly a complete car crash with globals everywhere.

tool.minDistance = 10;
tool.maxDistance = 45;

var room = /.*\/([^?]+)/.exec(window.location.pathname)[1];

function pickColor(color) {
  $('#color').val(color);
  var rgb = hexToRgb(color);
  $('#activeColorSwatch').css('background-color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');
  update_active_color();
}

/**
 * Position picker next to cursor in the bounds of the canvas container
 *
 * @param cursor {Point} Cursor position relative to the page
 */
function positionPickerInCanvas(cursor) {
  var picker = $('#mycolorpicker');

  // Determine best place for color picker so it isn't off the screen
  var pickerSize = new Point(picker.width(), picker.height());
  var windowSize = new Point($(window).width(), $(window).height());
  var spacer = new Point(10, 0);

  var brSpace = windowSize - spacer - cursor;
  var tlSpace = cursor - spacer;

  var newPos = new Point();

  // Choose sides based on page size
  if (tlSpace.x > pickerSize.x) {
    // Plus a magic number...?
    newPos.x = cursor.x - (pickerSize.x + 20 + spacer.x);
  } else if (brSpace.x > pickerSize.x) {
    newPos.x = cursor.x + spacer.x;
  }

  // Get the canvasContainer's position so we can make sure the picker
  // doesn't go outside of the canvasContainer (to keep it pretty)
  var minY = 10;
  // Buffer so we don't get too close to the bottom cause scroll bars
  var bBuffer = Math.max(50, (windowSize.y - ($('#canvasContainer').position().top
      + $('#canvasContainer').height())) + 70);

  // Favour having the picker in the middle of the cursor
  if (tlSpace.y > ((pickerSize.y / 2) + minY) && brSpace.y > ((pickerSize.y / 2) + bBuffer)) {
    newPos.y = cursor.y - (pickerSize.y / 2);
  } else if (tlSpace.y < ((pickerSize.y / 2) + minY) && brSpace.y > (tlSpace.y - (pickerSize.y + minY))) {
    newPos.y = minY;
  } else if (brSpace.y < ((pickerSize.y / 2) + bBuffer) && tlSpace.y > (brSpace.y - (pickerSize.y + bBuffer))) {
    newPos.y = windowSize.y - (pickerSize.y + bBuffer);
  }

  $('#mycolorpicker').css({
    "left": newPos.x,
    "top": newPos.y
  }); // make it in the smae position
}

/**
 * Scale the canvas by the given new scale.
 *
 * @param scale {Float} Scale diff to apply to the canvas
 * @param pos {Point} Position where to center zoom around on the canvas
 *        in screen pixels (unscaled)
 */
function scaleCanvas(scale, scaleDiff, pos) {
  // Determine where the cursor currently is
  var focusPoint = new Point(view.bounds.x, view.bounds.y);
  if (pos) { // Point given
    focusPoint += (pos / view.zoom);
  } else { // Center of canvas
    focusPoint += new Point(view.bounds.width, view.bounds.height) / 2;
  }

  // Scale to a minimum 5%
  view.zoom = Math.max(0.05,
      (scale === false ? view.zoom + scaleDiff : scale));

  view.draw();

  // Scroll so same point is below pos again, limiting so we don't show -ve
  // of canvas
  var offset = new Point(view.bounds.x, view.bounds.y);
  if (pos) { // Point given
    offset += (pos / view.zoom);
  } else { // Center of canvas
    offset += new Point(view.bounds.width, view.bounds.height) / 2;
  }
  
  var delta = focusPoint - offset;

  // Scroll the where the mousey is
  // Limit delta so we can't scroll into the -ve
  var center = view.center;
  var minCenter = view.size / 2;
  var newCenter = center + delta;

  // Pretty scroll
  view.scrollBy(delta);

  updateCoordinates();
}

/**
 * Extracts the text from a contenteditable element and inserts newlines in
 * place of divs.
 *
 * @param dom {JQueryDomObject} DOM object to parse
 * @returns {String} Text of DOM with newline characters
 */
function parseEditable(dom) {
  var text = '';
  dom.contents().each(function() {
    if (this.nodeType === Node.TEXT_NODE) {
      text += this.nodeValue;
    } else if (this.nodeType === Node.ELEMENT_NODE) {
      // Check for br elements using node.tagName
      if (this.tagName === 'BR') {
        text += "\n";
      } else if ($(this).css('display') == 'block') { /** Chrome uses divs to
          * do newlines, so check for all block elements as a catch all */
        text += (text.endsWith("\n") ? '' : "\n") + parseEditable($(this)) + "\n";
      } else {
        text += parseEditable($(this));
      }
    }
  });

  return text.trim("\n");
}

/**
 * Update the stats in the coordinates box
 */
function updateCoordinates() {
  $('#coordinates').html(view.bounds.x.toFixed(0) + ',' + view.bounds.y.toFixed(0));
  $('#zoom').html(view.zoom.toFixed(2));
};

/**
 * Return a Rectangle that contains all of the Paths in a Group
 *
 * @param {Group|Layer} [group] The group (or layer) to scan. If not group is
 *        given, the active layer will be scanned.
 * @returns {Rectangle}
 * @retval {null} Invalid group parameter given
 */
function getCanvasCoverage(group) {
  if (!group) {
    group = paper.project.activeLayer;
  }

  if (!(group instanceof Group)) {
    return null;
  }

  if (group.children.length !== 0) {
    var i = 0, bounds = group.children[i].strokeBounds;

    var min = bounds.point;
    var max = bounds.point + bounds.size;

    while (i < group.children.length) {
      bounds = group.children[i].strokeBounds;
      min = Point.min(min, bounds.point);
      max = Point.max(max, bounds.point + bounds.size);

      i++;
    }

    return new Rectangle(min, max);
  }
}

function zoomToContents() {
  var bounds = getCanvasCoverage();
  // Calculate what zoom level we need to fit it all in
  var padding = 20;
  var xZoom = $('#myCanvas').width() / (bounds.width + (2 * padding));
  var yZoom = $('#myCanvas').height() / (bounds.height + (2 * padding));
  var zoom = Math.min(1, xZoom, yZoom);
  view.zoom = zoom;
  // Scroll to 0,0
  view.scrollBy(new Point((bounds.x - padding) - view.bounds.x,
      (bounds.y - padding)- view.bounds.y));
  view.draw();
  updateCoordinates();
}

/**
 * Returns a Point containing the position of the cursor or an averaged
 * position of fingers for the given value.
 *
 * Created as the one included with the Paper library seems to be buggy.
 *
 * @param event {Event} The event to extract the position from
 * @param type {'client'|'page'|'screen'} The position to extract
 * @retval {null} no value to return (eg zero touches)
 */
function getEventPoint(event, type) {
  //@TODO if (!(event instanceof Event)) throw new TypeError('event needs to be an actual Event object (not a ctor event)');
  if (typeof type !== 'string') throw new TypeError('type needs to be a string value of client, page or screen');
  if (['client', 'page', 'screen'].indexOf(type) === -1) throw new RangeError('type needs to be either client, page or screen');

  if (event.touches) {
    var touches;
    if (event.touches.length === 0) {
      if (event.changedTouches && event.changedTouches.length !== 0) {
        touches = event.changedTouches;
      } else {
        return null;
      }
    } else {
      touches = event.touches;
    }

    var point = new Point();
    var t;
    for (t in touches) {
      console.log(touches[t], touches[t][type + 'X'], touches[t][type + 'Y']);
      point += new Point(touches[t][type + 'X'], touches[t][type + 'Y']);
    }
    point = point / touches.length;
    return point;
  } else {
    return new Point(event[type + 'X'], event[type + 'Y']);
  }
}

/*http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb*/
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}


$(document).ready(function() {
  var drawurl = window.location.href.split("?")[0]; // get the drawing url
  $('#embedinput').val("<iframe name='embed_readwrite' src='" + drawurl + "?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false' width=600 height=400></iframe>"); // write it to the embed input
  $('#linkinput').val(drawurl); // and the share/link input
  $('#drawTool > a').css({
    background: "#eee"
  }); // set the drawtool css to show it as active

  $('#myCanvas').bind('mousewheel', function(ev) {
    scrolled(ev.pageX, ev.pageY, -ev.wheelDelta);
  });

  $('#myCanvas').bind('DOMMouseScroll', function(ev) {
    scrolled(ev.pageX, ev.pageY, ev.detail);
  });

  $('#myCanvas').bind('wheel', function(event) {
    // Close textbox if one is currently open
    if (textbox) {
      writeEditTextbox();
    }

    // Find the scroll delta
    var delta;

    if (event.originalEvent) {
      // Determine the new scale factor -ve for scaling up
      var mul;
      switch(event.originalEvent.deltaMode) {
        case 0: // Pixel
          mul = -0.002;
          break;
        case 1: // Line
          mul = -0.02;
          break;
        case 2: //Page
          mul = -0.1;
          break;
      }

      delta = new Point(event.originalEvent.deltaX * mul,
          event.originalEvent.deltaY * mul);

      // Find the biggest scale
      if (Math.abs(delta.x) > Math.abs(delta.y)) {
        delta = delta.x;
      } else {
        delta = delta.y;
      }

      // Calculate the mouse point relative to the canvas (for centering)
      var point = getEventPoint(event.originalEvent, 'client');
      var offset = $('#myCanvas').offset();
      offset = new Point(offset.left, offset.top);
      point -= offset;

      // Scale away
      scaleCanvas(false, delta, point);
    }
  });

  var drawingPNG = localStorage.getItem("drawingPNG"+room)

  // Temporarily set background as image from memory to improve UX
  $('#canvasContainer').css("background-image", 'url(' + drawingPNG + ')');

});

var scaleFactor = 1.1;

function scrolled(x, y, delta) {
  // Far too buggy for now
  /*
  console.log("Scrolling");
  var pt = new Point(x, y),
  scale = 1;
  if(delta < 0) {
    scale *= scaleFactor;
  } else if(delta > 0) {
    scale /= scaleFactor;
  }
  //view.scale(scale, pt);
  $('#myCanvas').
  view.draw();
  */
}


$('#activeColorSwatch').css('background-color', $('.colorSwatch.active').css('background-color'));

// Initialise Socket.io
var base_path = /(\/.+\/)d\/.*/.exec(window.location.pathname)[1];
var socket = io.connect({ path: base_path + "socket.io"});

// Random User ID
// Used when sending data
var uid = (function() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}());

function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if (results == null) {
    return "";
  } else {
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
}

/**
 * Convert Point coordinates from DOM coordinates (pixels) relative to the
 * canvas DOMObject to Point coordinates on the canvas. Takes into account
 * canvas panning and scrolling
 *
 * @param {paper.Point} Coordinates relative to the canvas DOMObject to
 *        convert
 * 
 * @returns {paper.Point} Coordinates on the canvas
 */
function toCanvasPoint(domPoint) {
  if (!(domPoint instanceof Point)) {
    throw new TypeError('domPoint must be a Point');
  }

  return (domPoint / view.zoom) + view.bounds.point;
}

/**
 * Convert Point coordinates from Point coordinates on the canvas to DOM
 * coordinates (pixels) relative to the canvas DOMObject to . Takes into
 * account canvas panning and scrolling.
 *
 * @param {paper.Point} domPoint DOM coordinates to convert
 * 
 * @returns {paper.Point} Coordinates relative to the canvas DOMObject
 */
function toDomPoint(canvasPoint) {
  if (!(canvasPoint instanceof Point)) {
    throw new TypeError('domPoint must be a Point');
  }

  return (canvasPoint - view.bounds.point) * view.zoom;
}

/**
 * Deletes the given items from the canvas
 *
 * @param {Item|Array.paper/Item} items Items to delete
 */
function deleteItems(items) {
  var i, item;

  if (!(items instanceof Array)) {
    items = [items];
  }

  for (x in items) {
    if ((item = items[x]) instanceof Item) {
      if (item.name && item.parent instanceof Layer) {
        socket.emit('item:remove', room, uid, item.name);
        item.remove();
      }
    }
  }
  view.draw();
}


/// Textbox-specific stuff {{
var fontSize = 14;
var padding = 5;
var textbox;
var textboxClosed;
var textboxIdentifier = ':textbox:';

/** 
 * Creates a contenteditable div that is used to allow editing of canvas
 * text.
 *
 * @param {paper.Point} point Position (in DOM coordinates relative to the canvas)
 *        to place the div
 * @param {string} content Existing contents of the textbox
 */
function drawEditTextbox(point, content) {
  // Open a textbox
  $('#canvasContainer')
      .append(textbox = $('<div class="textEditor" contenteditable></div>'));
  // Move the textbox
  textbox.css({
    left: point.x,
    top: point.y,
    fontSize: (fontSize * view.zoom) + 'px',
    padding: (padding * view.zoom) + 'px'
  });

  // Add existing content
  if (content && typeof content == "string") {
    content = content.replace(/\n/g, '<br>');
    textbox.html(content);
  }

  textbox.get(0).focus();
}

/**
 * Writes a editTextbox to the canvas
 */
function writeEditTextbox() {
  if (textbox) {
    // Get the textbox position
    var position = textbox.position();
    position = toCanvasPoint(new Point(position.left, position.top));

    // Convert to canvas coordinates

    var text;
    if (text = parseEditable(textbox)) {
      var options = {
        point: position,
        content: text,
        name: uid + textboxIdentifier + (++paper_object_count)
      };
      
      paintTextbox(options);
      // Convert point to array
      options.point = [options.point.x, options.point.y];
      socket.emit('draw:textbox', room, uid, JSON.stringify(options));

      view.draw();
    }
    
    textbox.remove();
    textbox = false;
  }
}

/**
 * Edits the given textbox
 *
 * @param {Item} item Textbox item
 *
 * @returns {boolean} True if change to editing of textbox was successful,
 *          false if the given item wasn't detected as a textbox or the
 *          textbox is not visible
 */
function editTextbox(item) {
  if (!(item instanceof Item) || !isaTextbox(item)) {
    return false;
  }

  // Check if textbox is currently visible
  /// @TODO Update version of paper.js
  //if (!item.isInside(view.bounds)) {
  if (item.bounds.point.x < view.bounds.point.x
    || item.bounds.point.y < view.bounds.point.y
    || (item.bounds.point.x + item.bounds.size.x) >
    (view.bounds.point.x + view.bounds.size.x)
    || (item.bounds.point.y + item.bounds.size.y) >
    (view.bounds.point.y + view.bounds.size.y)) {
    return false;
  }

  // Get current coordinates of textbox
  var point = item.bounds.point;

  // Convert to DOM pixels
  point = toDomPoint(point);

  // Find the paper.PointText
  var textPoint, c = 0;
  while (c < item.children.length) {
    if (item.children[c] instanceof PointText) {
      textPoint = item.children[c];
      break;
    }
    c++;
  }

  if (!textPoint) {
    return false;
  }

  // Get the current contents
  var contents = textPoint.content;
  
  // Delete current textbox
  deleteItems(item);

  // Draw new editTextbox
  drawEditTextbox(point, contents);
}

/**
 * Temporary copy of Textbox.paint
 */
function paintTextbox(options) {
  options = $.extend({
    padding: 5,
    fontSize: 12,
    fillColor: new Color(1, 0.8),
    color: new Color(0),
    point: new Point(0, 0)
  }, options);

  var background = new Path.Rectangle({
    topLeft: options.point,
    bottomRight: options.point + 1
  });
  //background.fillColor = 'white';
  background.fillColor = options.fillColor;

  var textPoint = new PointText({
    point: options.point + options.padding + new Point(0, options.fontSize),
    fontSize: options.fontSize,
    fillColor: options.color
  });
  textPoint.content = options.content;
  
  // Make the rectangle the right size for the text
  var size = new Point(textPoint.bounds.width, textPoint.bounds.height)
      + (options.padding * 2);
  background.bounds.size = size;

  // Create a paper.Group to store everything in
  var group = new Group([background, textPoint]);
  if (options.name) {
    group.name = options.name;
  }

  return group;
}

/**
 * Tests whether the given item is a textbox item
 *
 * @param {paper.Item} Item to test to see if it is a textbox item
 *
 * @returns {boolean} true if it is, false if it isn't
 */
function isaTextbox(item) {
  return (item.name.search(textboxIdentifier) !== -1 && item.children);
}

function moveBelowTextboxes(path) {
  console.log(paper.project.activeLayer.children);
  // Move path to below any textboxes
  var children = paper.project.activeLayer.children;

  console.log(children, children.length);

  for (c = children.length - 1; c >= 0; c--) {
    if (children[c] == path) {
      continue;
    }

    if (children[c].name.search(textboxIdentifier) === -1) {
      path.insertAbove(children[c]);
      break;
    }
  }

  view.draw();
}

///}} Textbox-specific stuff

// Join the room
socket.emit('subscribe', {
  room: room
});

// JSON data ofthe users current drawing
// Is sent to the user
var path_to_send = {};

// Calculates colors
var active_color_rgb;
var active_color_json = {};
var $opacity = $('#opacityRangeVal');
var update_active_color = function() {
  var rgb_array = $('#activeColorSwatch').css('background-color');

  if(rgb_array == undefined)rgb_array="rgba(0, 0, 0, 0)"; //default to white if there was an error

  $('#editbar').css("border-bottom", "solid 2px " + rgb_array);

  while (rgb_array.indexOf(" ") > -1) {
    rgb_array = rgb_array.replace(" ", "");
  }
  rgb_array = rgb_array.substr(4, rgb_array.length - 5);
  rgb_array = rgb_array.split(',');
  var red = rgb_array[0] / 255;
  var green = rgb_array[1] / 255;
  var blue = rgb_array[2] / 255;
  var opacity = $opacity.val() / 255;

  active_color_rgb = new RgbColor(red, green, blue, opacity);
  active_color_rgb._alpha = opacity;
  active_color_json = {
    "red": red || 0,
    "green": green,
    "blue": blue,
    "opacity": opacity
  };
};

// Get the active color from the UI eleements
var authorColor = getParameterByName('authorColor');
var authorColors = {};
if (authorColor != "" && authorColor.substr(0, 4) == "rgb(") {
  authorColor = authorColor.substr(4, authorColor.indexOf(")") - 4);
  authorColors = authorColor.split(",");
  $('#activeColorSwatch').css('background-color', 'rgb(' + authorColors[0] + ',' + authorColors[1] + ',' + authorColors[2] + ')');
}
update_active_color();



$('#colorToggle').on('click', function() {
  if ($('#mycolorpicker').toggle().is(':visible')) {
    positionPickerInCanvas(new Point(event.pageX, event.pageY));
  }
});

$('#clearImage').click(function() {
  var p = confirm("Are you sure you want to clear the drawing for everyone?");
  if (p) {
    clearCanvas();
    socket.emit('canvas:clear', room);
  }
});

$('#toggleBackground').click(function() {
  $('#myCanvas').toggleClass('whiteBG');
});

// ---------------------------------
// DRAWING EVENTS


var send_paths_timer;
var timer_is_active = false;
var paper_object_count = 0;
var activeTool = "draw";
var mouseTimer = 0; // used for getting if the mouse is being held down but not dragged IE when bringin up color picker
var mouseHeld; // global timer for if mouse is held.
var path; // Used to store the path currently being drawn

var fingers; // Used for tracking how many finger have been used in the last event
var previousPoint; // Used to track the previous event point for panning
var previousFingerSeparation; // Used to store how far apart the fingers were at the start
var overItem;

function onMouseDown(event) {
    event.preventDefault();
  if (event.which === 2) return; // If it's middle mouse button do nothing -- This will be reserved for panning in the future.
  $('.popup').fadeOut();

  // Ignore right mouse button clicks for now
  if (event.event.button == 2) {
    return;
  }

  // Hide color picker if it is visible already
  var picker = $('#mycolorpicker');
  if (picker.is(':visible')) {
    picker.toggle(); // show the color picker
  }

  // Close textbox if one is currently open
  if (textbox) {
    writeEditTextbox();
    if (event.event.button !== 1) {
      textboxClosed = true;
    }
  }

  // Store the number of fingers we have so we can use it on mouseUp
  if (event.event.touches) {
    fingers = event.event.touches.length;
  } else {
    fingers = 0;
  }

  // Pan - Middle click, click+shift or two finger touch for canvas moving
  // Will also handle scaling using pinch gestures
  if (event.event.button == 1 
      || (event.event.button == 0 && event.event.ctrlKey)
      || (event.event.touches && event.event.touches.length == 2)) {
    previousPoint = getEventPoint(event.event, 'client');
    var canvas = $('#myCanvas');
    canvas.css('cursor', 'move');
    // Store the finger separation if we have fingers
    if (event.event.touches) {
      // Clear the current path
      path.remove();
      path = false;
      previousFingerSeparation = (new Point(
          event.event.touches[0].clientX, event.event.touches[0].clientY) -
          new Point (event.event.touches[1].clientX, event.event.touches[1].clientY)
      ).length;
    }
    return;
  }

  // Set overItem
  if (event.item) {
    overItem = event.item;
  } else {
    overItem = false;
  }

  mouseTimer = 0;
  if (!mouseHeld) {
    mouseHeld = setInterval(function() { // is the mouse being held and not dragged?
    mouseTimer++;
    if (mouseTimer > 3) {
      mouseTimer = 0;
      clearInterval(mouseHeld);
      mouseHeld = undefined;
      var picker = $('#mycolorpicker');
      picker.toggle(); // show the color picker
      if (picker.is(':visible')) {
        // Get position of cursor
        var point = getEventPoint(event.event, 'client');
        var position = $('#myCanvas').position();
        // Takeaway offset of canvas
        point -= new Point(position.left, position.top);
        positionPickerInCanvas(point);
      }
    }
  }, 100);
  }

  if (activeTool == "draw" || activeTool == "pencil") {
    var point = event.point;
    path = new Path();
    if (activeTool == "draw") {
      path.fillColor = active_color_rgb;
    } else if (activeTool == "pencil") {
      path.strokeColor = active_color_rgb;
      path.strokeWidth = 2;
    }
    path.add(event.point);
    path.name = uid + ":" + (++paper_object_count);
    view.draw();

    // The data we will send every 100ms on mouse drag
    path_to_send = {
      name: path.name,
      rgba: active_color_json,
      start: event.point,
      path: [],
      tool: activeTool
    };
  } else if (activeTool == "select") {
    // Select item
    $("#myCanvas").css("cursor", "pointer");
    if (event.item) {
      // If holding shift key down, don't clear selection - allows multiple selections
      if (!event.event.shiftKey) {
        paper.project.activeLayer.selected = false;
      }
      event.item.selected = true;
      view.draw();
    } else {
      paper.project.activeLayer.selected = false;
    }
  }
}

var item_move_delta;
var send_item_move_timer;
var item_move_timer_is_active = false;

function onMouseDrag(event) {
  event.preventDefault();
  mouseTimer = 0;
  clearInterval(mouseHeld);
  mouseHeld = undefined;

  // Ignore middle or right mouse button clicks for now
  if (event.event.button == 2) {
    return;
  }

  // Hide the color picker if it is showing
  if ($('#mycolorpicker').is(':visible')) {
    $('#mycolorpicker').toggle();
  }

  /* Pan / Pinch zoom - Middle click, click+shift or two finger touch for
   * canvas moving and zooming if fingers are involved
   */
  if (event.event.button == 1 
      || (event.event.button == 0 && event.event.ctrlKey)
      || (event.event.touches && event.event.touches.length == 2)) {
    // Calculate our own delta as the event delta is relative to the canvas
    var point = getEventPoint(event.event, 'client');
    var delta = (previousPoint - point) / view.zoom;

    // Limit delta so we can't scroll into the -ve
    var center = view.center;
    var minCenter = view.size / 2;
    var newCenter = center + delta;

    var startBounds = view.bounds;
  
    // Pretty scroll
    view.scrollBy(delta);

    // Store the new point so we just calculate a delta for next event
    previousPoint = point;

    // Zoom if touching and breach the buffer
    if (event.event.touches) {
      var separation =(new Point(
          event.event.touches[0].clientX, event.event.touches[0].clientY) -
          new Point (event.event.touches[1].clientX, event.event.touches[1].clientY)
      ).length;

      // Scale with a scaling factor (2) to make it nicer
      scaleCanvas(false, (1 - (previousFingerSeparation / separation))/ 3, point);

      previousFingerSeparation = separation;
    }

    updateCoordinates();

    return;
  }

  // Set overItem
  if (event.item) {
    overItem = event.item;
  } else {
    overItem = false;
  }

  if ((activeTool == "draw" || activeTool == "pencil") && path) {
    var step = event.delta / 2;
    step.angle += 90;
    if (activeTool == "draw") {
      var top = event.middlePoint + step;
      var bottom = event.middlePoint - step;
    } else if (activeTool == "pencil") {
      var top = event.middlePoint;
      bottom = event.middlePoint;
    }
    path.add(top);
    path.insert(0, bottom);
    path.smooth();
    view.draw();

    // Only broadcast if have a length
    if (path.length !== 0) {
      // Add data to path
      path_to_send.path.push({
        top: top,
        bottom: bottom
      });

      // Send paths every 100ms
      if (!timer_is_active) {

        send_paths_timer = setInterval(function() {

          socket.emit('draw:progress', room, uid, JSON.stringify(path_to_send));
          path_to_send.path = new Array();

        }, 100);

      }

      timer_is_active = true;
    }
  } else if (activeTool == "select") {
    // Move item locally
    for (x in paper.project.selectedItems) {
      var item = paper.project.selectedItems[x];
      // Only move if parent is a Layer (not a group item)
      if (item.parent instanceof Layer) {
        item.position += event.delta;
      }
    }

    // Store delta
    if (paper.project.selectedItems) {
      if (!item_move_delta) {
        item_move_delta = event.delta;
      } else {
        item_move_delta += event.delta;
      }
    }

    // Send move updates every 50 ms
    if (!item_move_timer_is_active) {
      send_item_move_timer = setInterval(function() {
        if (item_move_delta) {
          var itemNames = new Array();
          for (x in paper.project.selectedItems) {
            var item = paper.project.selectedItems[x];
            if (item.parent instanceof Layer) {
              itemNames.push(item._name);
            }
          }
          socket.emit('item:move:progress', room, uid, itemNames, item_move_delta);
          item_move_delta = null;
        }
      }, 50);
    }
    item_move_timer_is_active = true;
  }
}


function onMouseUp(event) {
  // Ignore right mouse button clicks for now
  if (event.event.button == 2) {
    return;
  }

  // Pan - Middle click, click+shift or two finger touch for canvas moving
  if (event.event.button == 1 
      || (event.event.button == 0 && event.event.ctrlKey)
      || (event.event.touches && fingers == 2)) {
    $('#myCanvas').css('cursor', 'pointer');
    return;
  }

  clearInterval(mouseHeld);
  mouseHeld = undefined;

  if ((activeTool == "draw" || activeTool == "pencil") && path) {
    // Close the users path
    path.add(event.point);
    
    path.closed = true;
    path.smooth();
    moveBelowTextboxes(path);

    // Send the path to other users
    path_to_send.end = event.point;
    // This covers the case where paths are created in less than 100 seconds
    // it does add a duplicate segment, but that is okay for now.
    socket.emit('draw:progress', room, uid, JSON.stringify(path_to_send));
    socket.emit('draw:end', room, uid, JSON.stringify(path_to_send));

    // Stop new path data being added & sent
    clearInterval(send_paths_timer);
    path_to_send.path = new Array();
    timer_is_active = false;
  } else if (activeTool == "text") {
    // @TODO Check if a text box was clicked on, if so edit it
     if (!textboxClosed) {
      if (overItem && isaTextbox(overItem)) {
        editTextbox(overItem);
      } else if (!textbox) { // Create a new textbox if we're not editing one already
        // Get the cursor position
        var point = getEventPoint(event.event, 'client');
        // Make it relative to the #canvasContainer
        var containerPosition = $('#canvasContainer').position();
        point -= new Point(containerPosition.left,
        containerPosition.top);
        
        drawEditTextbox(point);
      }
    }
  } else if (activeTool == "select") {
    // End movement timer
    clearInterval(send_item_move_timer);
    if (item_move_delta) {
      // Send any remaining movement info
      var itemNames = new Array();
      for (x in paper.project.selectedItems) {
        var item = paper.project.selectedItems[x];
        itemNames.push(item._name);
      }
      socket.emit('item:move:end', room, uid, itemNames, item_move_delta);
    } else {
      // delta is null, so send 0 change
      socket.emit('item:move:end', room, uid, itemNames, new Point(0, 0));
    }
    item_move_delta = null;
    item_move_timer_is_active = false;
  }

  textboxClosed = false;
}

var key_move_delta;
var send_key_move_timer;
var key_move_timer_is_active = false;

function onKeyDown(event) {
  if (activeTool == "select") {
    var point = null;

    if (event.key == "up") {
      point = new paper.Point(0, -1);
    } else if (event.key == "down") {
      point = new paper.Point(0, 1);
    } else if (event.key == "left") {
      point = new paper.Point(-1, 0);
    } else if (event.key == "right") {
      point = new paper.Point(1, 0);
    }

    // Move objects 1 pixel with arrow keys
    if (point) {
      moveItemsBy1Pixel(point);
    }

    // Store delta
    if (paper.project.selectedItems && point) {
      if (!key_move_delta) {
        key_move_delta = point;
      } else {
        key_move_delta += point;
      }
    }

    // Send move updates every 100 ms as batch updates
    if (!key_move_timer_is_active && point) {
      send_key_move_timer = setInterval(function() {
        if (key_move_delta) {
          var itemNames = new Array();
          for (x in paper.project.selectedItems) {
            var item = paper.project.selectedItems[x];
            if (item.parent instanceof Layer) {
              itemNames.push(item._name);
            }
          }
          socket.emit('item:move:progress', room, uid, itemNames, key_move_delta);
          key_move_delta = null;
        }
      }, 100);
    }
    key_move_timer_is_active = true;
  }
}



function onKeyUp(event) {
  if (event.key == "delete") {
    // Delete selected items
    var items = paper.project.selectedItems;
    if (items) {
      deleteItems(items);
    }
  }

  if (activeTool == "select") {
    // End arrow key movement timer
    clearInterval(send_key_move_timer);
    if (key_move_delta) {
      // Send any remaining movement info
      var itemNames = new Array();
      for (x in paper.project.selectedItems) {
        var item = paper.project.selectedItems[x];
        itemNames.push(item._name);
      }
      socket.emit('item:move:end', room, uid, itemNames, key_move_delta);
    } else {
      // delta is null, so send 0 change
      socket.emit('item:move:end', room, uid, itemNames, new Point(0, 0));
    }
    key_move_delta = null;
    key_move_timer_is_active = false;
  }
}



function moveItemsBy1Pixel(point) {
  if (!point) {
    return;
  }

  if (paper.project.selectedItems.length < 1) {
    return;
  }

  // Move locally
  var itemNames = new Array();
  for (x in paper.project.selectedItems) {
    var item = paper.project.selectedItems[x];
    if (item.parent instanceof Layer) {
      item.position += point;
      itemNames.push(item._name);
    }
  }

  // Redraw screen for item position update
  view.draw();
}

// Drop image onto canvas to upload it
$('#myCanvas').bind('dragover dragenter', function(e) {
  e.preventDefault();
});

$('#myCanvas').bind('drop', function(e) {
  e = e || window.event; // get window.event if e argument missing (in IE)
  if (e.preventDefault) { // stops the browser from redirecting off to the image.
    e.preventDefault();
  }
  e = e.originalEvent;
  var dt = e.dataTransfer;
  var files = dt.files;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    uploadImage(file);
  }
});

$('#myCanvas').bind('dblclick', function(e) {
  // Zoom to extent of canvas
  if (event.button == 1) {
    zoomToContents();
  }
  
  //Edit textbox
  //@TODO if (event.button === 0
  var item;
  // Check if we have an item being clicked on
  if (e.item) {
    item = e.item;
  } else if (overItem) {
    item = overItem;
  }

  if (item && isaTextbox(item)) {
    editTextbox(item);
  }
});

//@todo Find why view has no on function view.on('resize', updateCoordinates);

// ---------------------------------
// CONTROLS EVENTS

var $color = $('.colorSwatch:not(#pickerSwatch)');
$color.on('click', function() {

  $color.removeClass('active');
  $(this).addClass('active');
  $('#activeColorSwatch').css('background-color', $(this).css('background-color'));
  update_active_color();

});

$('#pickerSwatch').on('click', function(event) {
  $('#mycolorpicker').toggle();
});
$('#settingslink').on('click', function() {
  $('#settings').fadeToggle();
});
$('#embedlink').on('click', function() {
  $('#embed').fadeToggle();
});
$('#importExport').on('click', function() {
  $('#importexport').fadeToggle();
});
$('#usericon').on('click', function() {
  $('#mycolorpicker').fadeToggle();
});
$('#clearCanvas').on('click', function() {
  clearCanvas();
  socket.emit('canvas:clear', room);
});
$('#exportSVG').on('click', function() {
  exportSVG();
});
$('#exportPNG').on('click', function() {
  exportPNG();
});

$('#pencilTool').on('click', function() {
  $('#editbar > ul > li > a').css({
    background: ""
  }); // remove the backgrounds from other buttons
  $('#pencilTool > a').css({
    background: "#eee"
  }); // set the selecttool css to show it as active
  activeTool = "pencil";
  $('#myCanvas').css('cursor', 'pointer');
  paper.project.activeLayer.selected = false;
});
$('#drawTool').on('click', function() {
  $('#editbar > ul > li > a').css({
    background: ""
  }); // remove the backgrounds from other buttons
  $('#drawTool > a').css({
    background: "#eee"
  }); // set the selecttool css to show it as active
  activeTool = "draw";
  $('#myCanvas').css('cursor', 'pointer');
  paper.project.activeLayer.selected = false;
});
$('#selectTool').on('click', function() {
  $('#editbar > ul > li > a').css({
    background: ""
  }); // remove the backgrounds from other buttons
  $('#selectTool > a').css({
    background: "#eee"
  }); // set the selecttool css to show it as active
  activeTool = "select";
  $('#myCanvas').css('cursor', 'default');
});
$('#textTool').on('click', function() {
  $('#editbar > ul > li > a').css({
    background: ""
  }); // remove the backgrounds from other buttons
  $('#textTool > a').css({
    background: "#eee"
  }); // set the texttool css to show it as active
  activeTool = "text";
  $('#myCanvas').css('cursor', 'crosshair');
});

$('#zeroTool').on('click', function() {
  // Scroll back to 0,0
  view.scrollBy(new Point(- view.bounds.x, - view.bounds.y));
  updateCoordinates();
});

$('#scaleTool').on('click', function() {
  scaleCanvas(1);
});

$('#fitTool').on('click', function() {
  zoomToContents();
});

$('#uploadImage').on('click', function() {
  $('#imageInput').click();
});

function clearCanvas() {
  // Remove all but the active layer
  if (project.layers.length > 1) {
    var activeLayerID = project.activeLayer._id;
    for (var i = 0; i < project.layers.length; i++) {
      if (project.layers[i]._id != activeLayerID) {
        project.layers[i].remove();
        i--;
      }
    }
  }

  // Remove all of the children from the active layer
  if (paper.project.activeLayer && paper.project.activeLayer.hasChildren()) {
    paper.project.activeLayer.removeChildren();
  }
  view.draw();
}

function exportSVG() {
  var svg = paper.project.exportSVG();
  encodeAsImgAndLink(svg);
}

// Encodes svg as a base64 text and opens a new browser window
// to the svg image that can be saved as a .svg on the users
// local filesystem. This skips making a round trip to the server
// for a POST.
function encodeAsImgAndLink(svg) {
  if ($.browser.msie) {
    // Add some critical information
    svg.setAttribute('version', '1.1');
    var dummy = document.createElement('div');
    dummy.appendChild(svg);
    window.winsvg = window.open('/static/html/export.html');
    window.winsvg.document.write(dummy.innerHTML);
    window.winsvg.document.body.style.margin = 0;
  } else {
    // Add some critical information
    svg.setAttribute('version', '1.1');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    var dummy = document.createElement('div');
    dummy.appendChild(svg);

    var b64 = Base64.encode(dummy.innerHTML);

    //window.winsvg = window.open("data:image/svg+xml;base64,\n"+b64);
    var html = "<img style='height:100%;width:100%;' src='data:image/svg+xml;base64," + b64 + "' />"
    window.winsvg = window.open();
    window.winsvg.document.write(html);
    window.winsvg.document.body.style.margin = 0;
  }
}

// Encodes png as a base64 text and opens a new browser window
// to the png image that can be saved as a .png on the users
// local filesystem. This skips making a round trip to the server
// for a POST.
function exportPNG() {
  var canvas = document.getElementById('myCanvas');
  var html = "<img src='" + canvas.toDataURL('image/png') + "' />"
  if ($.browser.msie) {
    window.winpng = window.open('/static/html/export.html');
    window.winpng.document.write(html);
    window.winpng.document.body.style.margin = 0;
  } else {
    window.winpng = window.open();
    window.winpng.document.write(html);
    window.winpng.document.body.style.margin = 0;
  }

}

// User selects an image from the file browser to upload
$('#imageInput').bind('change', function(e) {
  // Get selected files
  var files = document.getElementById('imageInput').files;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    uploadImage(file);
  }
});

function uploadImage(file) {
  var reader = new FileReader();

  //attach event handler
  reader.readAsDataURL(file);
  $(reader).bind('loadend', function(e) {
    var bin = this.result;

    //Add to paper project here
    var raster = new Raster(bin);
    raster.position = view.center;
    raster.name = uid + ":" + (++paper_object_count);
    socket.emit('image:add', room, uid, JSON.stringify(bin), raster.position, raster.name);
  });
}




// ---------------------------------
// SOCKET.IO EVENTS
socket.on('settings', function(settings) {
  processSettings(settings);
});


socket.on('draw:progress', function(artist, data) {

  // It wasnt this user who created the event
  if (artist !== uid && data) {
    progress_external_path(JSON.parse(data), artist);
  }

});

socket.on('draw:textbox', function(artist, data) {
  if (artist !== uid && data) {
    data = JSON.parse(data);
    data.point = new Point(data.point);
    paintTextbox(data);
    view.draw();
  }
});

socket.on('draw:end', function(artist, data) {

  // It wasnt this user who created the event
  if (artist !== uid && data) {
    end_external_path(JSON.parse(data), artist);
  }

});

socket.on('user:connect', function(user_count) {
  console.log("user:connect");
  update_user_count(user_count);
});

socket.on('user:disconnect', function(user_count) {
  update_user_count(user_count);
});

socket.on('project:load', function(json) {
  console.log("project:load");
  paper.project.activeLayer.remove();
  paper.project.importJSON(json.project);

  // Make color selector draggable
  $('#mycolorpicker').pep({});
  // Make sure the range event doesn't propogate to pep
  $('#opacityRangeVal').on('touchstart MSPointerDown mousedown', function(ev) {
    ev.stopPropagation();
  }).on('change', function(ev) {
    update_active_color();
  })

  view.draw();
  $.get("../static/img/wheel.png");
});

socket.on('project:load:error', function() {
  $('#lostConnection').show();
});

socket.on('canvas:clear', function() {
  clearCanvas();
});

socket.on('loading:start', function() {
  // console.log("loading:start");
  $('#loading').show();
});

socket.on('loading:end', function() {
  $('#loading').hide();
  $('#colorpicker').farbtastic(pickColor); // make a color picker
  // cake
  $('#canvasContainer').css("background-image", 'none');

});

socket.on('item:remove', function(artist, name) {
  if (artist != uid && paper.project.activeLayer._namedChildren[name][0]) {
    paper.project.activeLayer._namedChildren[name][0].remove();
    view.draw();
  }
});

socket.on('item:move', function(artist, itemNames, delta) {
  if (artist != uid) {
    for (x in itemNames) {
      var itemName = itemNames[x];
      if (paper.project.activeLayer._namedChildren[itemName][0]) {
        paper.project.activeLayer._namedChildren[itemName][0].position += new Point(delta[1], delta[2]);
      }
    }
    view.draw();
  }
});

socket.on('image:add', function(artist, data, position, name) {
  if (artist != uid) {
    var image = JSON.parse(data);
    var raster = new Raster(image);
    raster.position = new Point(position[1], position[2]);
    raster.name = name;
    view.draw();
  }
});


// --------------------------------- 

socket.on('chat:message', function(uid, message, name) {
  $('#chatMessages').append($('<li>').text(name + ": " + message));
  if(30 > Math.abs( ($("#chatMessages")[0].scrollTop+ $("#chatMessages").height()) - $("#chatMessages")[0].scrollHeight )) {
  //if the user is scrolled near the bottom, pull their scroll down with new text
    $("#chatMessages").scrollTop($("#chatMessages")[0].scrollHeight);
  }
});


console.log(view);

// ---------------------------------
// SOCKET.IO EVENT FUNCTIONS

// Updates the active connections
var $user_count = $('#online_count');

function update_user_count(count) {
  $user_count.text((count === 1) ? "1" : " " + count);
}

var external_paths = {};

// Ends a path
var end_external_path = function(points, artist) {

  var path = external_paths[artist];

  if (path) {

    // Close the path
    path.add(new Point(points.end[1], points.end[2]));
    path.closed = true;
    path.smooth();
    moveBelowTextboxes(path);

    // Remove the old data
    external_paths[artist] = false;

  }

};

// Continues to draw a path in real time
progress_external_path = function(points, artist) {

  var path = external_paths[artist];

  // The path hasnt already been started
  // So start it
  if (!path) {

    // Creates the path in an easy to access way
    external_paths[artist] = new Path();
    path = external_paths[artist];

    // Starts the path
    var start_point = new Point(points.start[1], points.start[2]);
    var color = new RgbColor(points.rgba.red, points.rgba.green, points.rgba.blue, points.rgba.opacity);
    if (points.tool == "draw") {
      path.fillColor = color;
    } else if (points.tool == "pencil") {
      path.strokeColor = color;
      path.strokeWidth = 2;
    }

    path.name = points.name;
    path.add(start_point);

  }

  // Draw all the points along the length of the path
  var paths = points.path;
  var length = paths.length;
  for (var i = 0; i < length; i++) {

    path.add(new Point(paths[i].top[1], paths[i].top[2]));
    path.insert(0, new Point(paths[i].bottom[1], paths[i].bottom[2]));

  }

  path.smooth();
  view.draw();

};

function processSettings(settings) {

  $.each(settings, function(k, v) {

    // Handle tool changes
    if (k === "tool") {
      $('.buttonicon-' + v).click();
    }

  })

}

function chatToggleShow() {
  //If it's currently big, make it small, vice versa
  //If the user does not have a name, ask for one
  
  if($("#chatBox").height() > 10){
    $("#chatBox").animate({height : 10},200);
    $("#chatMessages").hide();
    $("#chatInput").hide();
  } else {
    if(chatName == ""){
      chatName = prompt("What is your name?", "");
    }
    $("#chatBox").animate({height : 200},200);
    $("#chatMessages").show();
    $("#chatInput").show();
  }
  
}
    
function sendChatMessage() {
    //get the text, emit it, clear the text
    var message = $('#chatInput').val();
    socket.emit('chat:message', room, uid, message, chatName || "unnamed");
    $('#chatInput').val('');
    return(false);//prevents page reload on submit
}
  //does chatName belong here?
  var chatName = "";
  chatToggleShow();
  $("#chatLabel").click(function() {chatToggleShow();} );
  $('form').submit(sendChatMessage);

  
// Periodically save drawing
setInterval(function(){
  saveDrawing();
}, 1000);

function saveDrawing(){
  var canvas = document.getElementById('myCanvas');
  // Save image to localStorage
  localStorage.setItem("drawingPNG"+room, canvas.toDataURL('image/png'));
}
