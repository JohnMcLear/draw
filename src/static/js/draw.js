tool.minDistance = 10;
tool.maxDistance = 45;

function pickColor(color) {
  $('#color').val(color);
  var rgb = hexToRgb(color);
  $('#activeColorSwatch').css('background-color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');
  update_active_color();
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
  $('#drawTool > a').css({background:"#eee"}); // set the drawtool css to show it as active
});

$('#activeColorSwatch').css('background-color', $('.colorSwatch.active').css('background-color'));

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
var $opacity = $('#opacityRangeVal');
var update_active_color = function () {
  var rgb_array = $('#activeColorSwatch').css('background-color');
  $('#editbar').css("border-bottom", "solid 2px " + rgb_array);

  while(rgb_array.indexOf(" ") > -1) {
    rgb_array = rgb_array.replace(" ", "");
  }
  rgb_array = rgb_array.substr(4, rgb_array.length-5);
  rgb_array = rgb_array.split(',');
  var red = rgb_array[0] / 255;
  var green = rgb_array[1] / 255;
  var blue = rgb_array[2] / 255;
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
  $('#activeColorSwatch').css('background-color', 'rgb(' + authorColors[0] + ',' + authorColors[1] + ',' + authorColors[2] + ')');
}
update_active_color();





// --------------------------------- 
// DRAWING EVENTS


var send_paths_timer;
var timer_is_active = false;
var paper_object_count = 0;
var activeTool = "draw";
var mouseTimer = 0; // used for getting if the mouse is being held down but not dragged IE when bringin up color picker
var mouseHeld; // global timer for if mouse is held.

function onMouseDown(event) {
  $('.popup').fadeOut();

  // Ignore middle or right mouse button clicks for now
  if (event.event.button == 1 || event.event.button == 2) {
    return;
  }

  mouseTimer = 0;
  mouseHeld = setInterval(function(){ // is the mouse being held and not dragged?
    mouseTimer++;
    if(mouseTimer > 5){
      mouseTimer = 0;
      $('#mycolorpicker').toggle(); // show the color picker
      $('#mycolorpicker').css({"left":event.event.pageX - 250, "top":event.event.pageY - 100}); // make it in the smae position
    }
  }, 100);
  
  if (activeTool == "draw" || activeTool == "pencil") {
    var point = event.point;
    path = new Path();
    if(activeTool == "draw"){
      path.fillColor = active_color_rgb;
    }
    else if(activeTool == "pencil"){
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
    $("#myCanvas").css("cursor","pointer");
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

  mouseTimer = 0;
  clearInterval(mouseHeld);

  // Ignore middle or right mouse button clicks for now
  if (event.event.button == 1 || event.event.button == 2) {
    return;
  }

  if (activeTool == "draw" || activeTool == "pencil") {
    var step = event.delta / 2;
    step.angle += 90;
    if(activeTool == "draw"){
      var top = event.middlePoint + step;
      var bottom = event.middlePoint - step;
    }else if (activeTool == "pencil"){
      var top = event.middlePoint;
      bottom = event.middlePoint;
    }
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
  } else if (activeTool == "select") {
    // Move item locally
    for (x in paper.project.selectedItems) {
      var item = paper.project.selectedItems[x];
      item.position += event.delta;
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
            itemNames.push(item._name);
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

  // Ignore middle or right mouse button clicks for now
  if (event.event.button == 1 || event.event.button == 2) {
    return;
  }
  clearInterval(mouseHeld);

  if (activeTool == "draw" || activeTool == "pencil") {
    // Close the users path
    path.add(event.point);
    path.closed = true;
    path.smooth();
    view.draw();

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

}

function onKeyUp(event) {
  if (event.key == "delete") {
    var items = paper.project.selectedItems;
    if (items) {
      for (x in items) {
        var item = items[x];
        socket.emit('item:remove', room, uid, item.name);
        item.remove();
        view.draw();
      }
    }
  }
}

// Drop image onto canvas to upload it
$('#myCanvas').bind('dragover dragenter', function(e) {
  e.preventDefault();
});

$('#myCanvas').bind('drop', function(e) {
  e = e || window.event; // get window.event if e argument missing (in IE)
  if (e.preventDefault) {  // stops the browser from redirecting off to the image.
    e.preventDefault();
  }
  e = e.originalEvent;
  var dt = e.dataTransfer;
  var files = dt.files;
  for (var i=0; i<files.length; i++) {
    var file = files[i];
    uploadImage(file);
  }
});






// --------------------------------- 
// CONTROLS EVENTS

var $color = $('.colorSwatch:not(#pickerSwatch)');
$color.on('click', function () {

  $color.removeClass('active');
  $(this).addClass('active');
  $('#activeColorSwatch').css('background-color', $(this).css('background-color'));
  update_active_color();

});

$('#pickerSwatch').on('click', function() {
  $('#myColorPicker').fadeToggle();
});

$("#opacityRange").on('click', function(e){
  var offsetX = e.offsetX || e.originalEvent.layerX;
  $("#opacityIdentifier").css({left:offsetX});
  var opacity = $("#opacityRange").width() - e.offsetX + 55; // get the opacity range value by removing the offset from the width
  $("#opacityRangeVal").val(opacity);
  update_active_color();
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
  $('#editbar > ul > li > a').css({background:""}); // remove the backgrounds from other buttons
  $('#pencilTool > a').css({background:"#eee"}); // set the selecttool css to show it as active
  activeTool = "pencil";
  $('#myCanvas').css('cursor', 'pointer');
  paper.project.activeLayer.selected = false;
});
$('#drawTool').on('click', function() {
  $('#editbar > ul > li > a').css({background:""}); // remove the backgrounds from other buttons
  $('#drawTool > a').css({background:"#eee"}); // set the selecttool css to show it as active
  activeTool = "draw";
  $('#myCanvas').css('cursor', 'pointer');
  paper.project.activeLayer.selected = false;
});
$('#selectTool').on('click', function() {
  $('#editbar > ul > li > a').css({background:""}); // remove the backgrounds from other buttons
  $('#selectTool > a').css({background:"#eee"}); // set the selecttool css to show it as active
  activeTool = "select";
  $('#myCanvas').css('cursor', 'default');
});

$('#uploadImage').on('click', function() {
  $('#imageInput').click();
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
  var svg = paper.project.exportSVG();
  encodeAsImgAndLink(svg);
}

// Encodes svg as a base64 text and opens a new browser window
// to the svg image that can be saved as a .svg on the users
// local filesystem. This skips making a round trip to the server
// for a POST.
function encodeAsImgAndLink(svg){
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
  for (var i=0; i<files.length; i++) {
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
  console.log(json.project);
  paper.project.activeLayer.remove();
  paper.project.importJSON(json.project);
  $('#colorpicker').farbtastic(pickColor); // make a color picker
  $('#mycolorpicker').pep({disableSelect:false, constrainToParent:"body"});
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
// SOCKET.IO EVENT FUNCTIONS


// Updates the active connections
var $user_count = $('#online_count');

function update_user_count(count) {
  $user_count.text((count === 1) ? "1" : " " + count);
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
    if(points.tool == "draw"){
      path.fillColor = color;
    }
    else if(points.tool == "pencil"){
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
