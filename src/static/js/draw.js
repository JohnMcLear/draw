tool.minDistance = 10;
tool.maxDistance = 45;


// Initialise Socket.io
var socket = io.connect('/');

// Random User ID
// Used when sending data
var uid = (function () {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}());

function getParameterByName(name)
{ 
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if(results == null) {
    return "";
  }
  else {
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
}

// Join the room
var room = window.location.pathname.split("/")[2];
socket.emit('subscribe', { room: room });

// JSON data ofthe users current drawing
// Is sent to the user
var path_to_send = {};

// Calculates colors
var active_color_rgb;
var active_color_json = {};
var $opacity = $('#opacity');
var update_active_color = function (r, g, b) {
  var rgb_array = $('.active').attr('data-color').split(',');
  var red = rgb_array[0] / 255;
  if (r) {
    red = r / 255;
  }
  var green = rgb_array[1] / 255;
  if (g) {
    green = g / 255;
  }
  var blue = rgb_array[2] / 255;
  if (b) {
    blue = b / 255;
  }
  var opacity = $opacity.val() / 255;

  active_color_rgb = new RgbColor(red, green, blue, opacity);
  active_color_rgb._alpha = opacity;

  active_color_json = {
    "red": red,
    "green": green,
    "blue": blue,
    "opacity": opacity
  };

};

// Get the active color from the UI eleements
var authorColor = getParameterByName('authorColor');
var authorColors = {};
if (authorColor != "" && authorColor.substr(0,4) == "rgb(") {
  authorColor = authorColor.substr(4, authorColor.indexOf(")")-4);
  authorColors = authorColor.split(",");
  if (authorColors.length == 3) {
    update_active_color(authorColors[0], authorColors[1], authorColors[2]);
  } else {
    update_active_color();
  }
} else {
  update_active_color();
}






// --------------------------------- 
// DRAWING EVENTS


var send_paths_timer;
var timer_is_active = false;

function onMouseDown(event) {

  var point = event.point;

  path = new Path();
  path.fillColor = active_color_rgb;
  path.add(event.point);
  view.draw();

  // The data we will send every 100ms on mouse drag
  path_to_send = {
    rgba: active_color_json,
    start: event.point,
    path: []
  };

}

function onMouseDrag(event) {

  var step = event.delta / 2;
  step.angle += 90;

  var top = event.middlePoint + step;
  var bottom = event.middlePoint - step;

  path.add(top);
  path.insert(0, bottom);
  path.smooth();
  view.draw();

  // Add data to path
  path_to_send.path.push({
    top: top,
    bottom: bottom
  });

  // Send paths every 100ms
  if (!timer_is_active) {

    send_paths_timer = setInterval(function () {

      socket.emit('draw:progress', room, uid, JSON.stringify(path_to_send));
      path_to_send.path = new Array();

    }, 100);

  }

  timer_is_active = true;

}


function onMouseUp(event) {

  // Close the users path
  path.add(event.point);
  path.closed = true;
  path.smooth();
  view.draw();

  // Send the path to other users
  path_to_send.end = event.point;
  socket.emit('draw:end', room, uid, JSON.stringify(path_to_send));

  // Stop new path data being added & sent
  clearInterval(send_paths_timer);
  path_to_send.path = new Array();
  timer_is_active = false;

}










// --------------------------------- 
// CONTROLS EVENTS

var $color = $('.color');
$color.on('click', function () {

  $color.removeClass('active');
  $(this).addClass('active');

  update_active_color();

});

$opacity.on('change', function () {

  update_active_color();

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

function clearCanvas() {
  // Remove all but the active layer
  if (project.layers.length > 1) {
    var activeLayerID = project.activeLayer._id;
    for (var i=0; i<project.layers.length; i++) {
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
  //console.log(paper.project.exportSVG());
  var svg = paper.project.exportSVG();
  encodeAsImgAndLink(svg);
}

// Encodes svg as a base64 text and opens a new browser window
// to the svg image that can be saved as a .svg on the users
// local filesystem. This skips making a round trip to the server
// for a POST.
function encodeAsImgAndLink(svg){
  // Add some critical information
  svg.setAttribute('version', '1.1');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  var dummy = document.createElement('div');
  dummy.appendChild(svg);

  var b64 = Base64.encode(dummy.innerHTML);

  window.open("data:image/svg+xml;base64,\n"+b64);
}

function exportPNG() {
  var canvas = document.getElementById('myCanvas');
  window.open(canvas.toDataURL('image/png'));
}






// --------------------------------- 
// SOCKET.IO EVENTS


socket.on('draw:progress', function (artist, data) {

  // It wasnt this user who created the event
  if (artist !== uid && data) {
    progress_external_path(JSON.parse(data), artist);
  }

});

socket.on('draw:end', function (artist, data) {

  // It wasnt this user who created the event
  if (artist !== uid && data) {
    end_external_path(JSON.parse(data), artist);
  }

});

socket.on('user:connect', function (user_count) {
  update_user_count(user_count);
});

socket.on('user:disconnect', function (user_count) {
  update_user_count(user_count);
});

socket.on('project:load', function (json) {
  paper.project.importJSON(json.project);
  view.draw();
});

socket.on('project:load:error', function() {
  $('#lostConnection').show();
});

socket.on('canvas:clear', function() {
  clearCanvas();
});

socket.on('loading:start', function() {
  $('#loading').show();
});

socket.on('loading:end', function() {
  $('#loading').hide();
});


// --------------------------------- 
// SOCKET.IO EVENT FUNCTIONS


// Updates the active connections
var $user_count = $('#userCount');
var $user_count_wrapper = $('#userCountWrapper');

function update_user_count(count) {

  $user_count_wrapper.css('opacity', 1);
  $user_count.text((count === 1) ? " just you, why not invite some friends?" : " " + count);

}


var external_paths = {};

// Ends a path
var end_external_path = function (points, artist) {

  var path = external_paths[artist];

  if (path) {

    // Close the path
    path.add(new Point(points.end[1], points.end[2]));
    path.closed = true;
    path.smooth();
    view.draw();
	
    // Remove the old data
    external_paths[artist] = false;

  }

};

// Continues to draw a path in real time
progress_external_path = function (points, artist) {

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
    path.fillColor = color;
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