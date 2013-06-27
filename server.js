/**
 * Module dependencies.
 */

var express = require("express");
var app = express();
var paper = require('paper');
paper.setup(new paper.Canvas(1920, 1080));
var socket = require('socket.io');
var ueberDB = require("ueberDB");
var db = new ueberDB.database("dirty", {"filename" : "var/dirty.db"});
var async = require('async');
var fs = require('fs');

app.configure(function(){
  app.use(express.static(__dirname + '/'));
});

/**
 * A setting, just one
 */

var port = 3000;





/** Below be dragons 
 *
 */

// SESSIONS
app.use(express.cookieParser());
app.use(express.session({secret: 'secret', key: 'express.sid'}));

// DEV MODE
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// PRODUCTON MODE
app.configure('production', function(){
  app.use(express.errorHandler());
});

// ROUTES
// Index page
app.get('/', function(req, res){
  res.sendfile(__dirname + '/src/static/html/index.html');
});

// Drawings
app.get('/d/*', function(req, res){
  res.sendfile(__dirname + '/src/static/html/draw.html');
});

// Front-end tests
app.get('/tests/frontend/specs_list.js', function(req, res){

  async.parallel({
    coreSpecs: function(callback){
      exports.getCoreTests(callback);
    },
    pluginSpecs: function(callback){
      exports.getPluginTests(callback);
    }
  },
  function(err, results){
    var files = results.coreSpecs; // push the core specs to a file object
    files = files.concat(results.pluginSpecs); // add the plugin Specs to the core specs
    //console.debug("Sent browser the following test specs:", files.sort());
    // console.log("Sent browser the following test specs:", files.sort());
    res.send("var specs_list = " + JSON.stringify(files.sort()) + ";\n");
  });

});

// Used for front-end tests
var url2FilePath = function(url){
  var subPath = url.substr("/tests/frontend".length);
  if (subPath == ""){
    subPath = "index.html"
  }
  subPath = subPath.split("?")[0];

  var filePath = path.normalize(npm.root + "/../tests/frontend/")
  filePath += subPath.replace("..", "");
  return filePath;
}

// Used for front-end tests
app.get('/tests/frontend/specs/*', function (req, res) {
  var specFilePath = url2FilePath(req.url);
  var specFileName = path.basename(specFilePath);

  fs.readFile(specFilePath, function(err, content){
    if(err){ return res.send(500); }
 
    content = "describe(" + JSON.stringify(specFileName) + ", function(){   " + content + "   });";

    res.send(content);
  }); 
});

// Used for front-end tests
app.get('/tests/frontend/*', function (req, res) {
  var filePath = url2FilePath(req.url);
  res.sendfile(filePath);
});

// Used for front-end tests
app.get('/tests/frontend', function (req, res) {
  res.redirect('/tests/frontend/');
});

// Used for front-end tests
exports.getPluginTests = function(callback){
  var pluginSpecs = [];
  var plugins = fs.readdirSync('node_modules');
  plugins.forEach(function(plugin){
    if(fs.existsSync("node_modules/"+plugin+"/static/tests/frontend/specs")){ // if plugins exists
      var specFiles = fs.readdirSync("node_modules/"+plugin+"/static/tests/frontend/specs/");
      async.forEach(specFiles, function(spec){ // for each specFile push it to pluginSpecs
         pluginSpecs.push("/static/plugins/"+plugin+"/static/tests/frontend/specs/" + spec);
      },
      function(err){
         // blow up if something bad happens!
      });
    }
  });
  callback(null, pluginSpecs);
}

// Used for front-end tests
exports.getCoreTests = function(callback){
  fs.readdir('tests/frontend/specs', function(err, coreSpecs){ // get the core test specs
    if(err){ return res.send(500); }
    callback(null, coreSpecs);
  });
}

// Static files IE Javascript and CSS
app.use("/static", express.static(__dirname + '/src/static'));

// LISTEN FOR REQUESTS
var server = app.listen(port);
var io = socket.listen(server);

// SOCKET IO
io.sockets.on('connection', function (socket) {

  socket.on('disconnect', function () {
    disconnect(socket);
  });

  // EVENT: User stops drawing something
  // Having room as a parameter is not good for secure rooms
  socket.on('draw:progress', function (room, uid, co_ordinates) {
    if (!projects[room] || !projects[room].project) {
      loadError(socket);
      return;
    }
    io.sockets.in(room).emit('draw:progress', uid, co_ordinates);
    progress_external_path(room, JSON.parse(co_ordinates), uid);
  });

  // EVENT: User stops drawing something
  // Having room as a parameter is not good for secure rooms
  socket.on('draw:end', function (room, uid, co_ordinates) {
    if (!projects[room] || !projects[room].project) {
      loadError(socket);
      return;
    }
    io.sockets.in(room).emit('draw:end', uid, co_ordinates);
    end_external_path(room, JSON.parse(co_ordinates), uid);
  });
  
  // User joins a room
  socket.on('subscribe', function(data) {
    subscribe(socket, data);
  });
  
  // User clears canvas
  socket.on('canvas:clear', function(room) {
    if (!projects[room] || !projects[room].project) {
      loadError(socket);
      return;
    }
    clearCanvas(room);
    io.sockets.in(room).emit('canvas:clear');
  });
  
  // User removes an item
  socket.on('item:remove', function(room, uid, itemName) {
    removeItem(room, uid, itemName);
  });
  
  // User moves one or more items on their canvas - progress
  socket.on('item:move:progress', function(room, uid, itemNames, delta) {
    moveItemsProgress(room, uid, itemNames, delta);
  });
  
  // User moves one or more items on their canvas - end
  socket.on('item:move:end', function(room, uid, itemNames, delta) {
    moveItemsEnd(room, uid, itemNames, delta);
  });
  
  // User adds a raster image
  socket.on('image:add', function(room, uid, data, position, name) {
    addImage(room, uid, data, position, name);
  });
  
});

var projects = {};
var closeTimer = {}; // setTimeout function for closing a project when
// there are no active connections
// Subscribe a client to a room
function subscribe(socket, data) {
  var room = data.room;

  // Subscribe the client to the room
  socket.join(room);
  
  // If the close timer is set, cancel it
  if (closeTimer[room]) {
    clearTimeout(closeTimer[room]);
  }

  // Create Paperjs instance for this room if it doesn't exist
  var project = projects[room];
  if (!project) {
    projects[room] = {};
    // Use the view from the default project. This project is the default
    // one created when paper is instantiated. Nothing is ever written to
    // this project as each room has its own project. We share the View
    // object but that just helps it "draw" stuff to the invisible server
    // canvas.
    projects[room].project = new paper.Project(paper.projects[0].view);
    projects[room].external_paths = {};
    loadFromDB(room, socket);
  } else { // Project exists in memory, no need to load from database
    loadFromMemory(room, socket);
  }

  // Broadcast to room the new user count
  var active_connections = io.sockets.manager.rooms['/' + room].length;  
  io.sockets.in(room).emit('user:connect', active_connections);
 
}

// Try to load room from database
function loadFromDB(room, socket) {
  if (projects[room] && projects[room].project) {
    var project = projects[room].project;
    db.init(function (err) {
      if(err) {
        console.error(err);
      }
      db.get(room, function(err, value) {
        if (value && project && project instanceof paper.Project && project.activeLayer) {
          socket.emit('loading:start');
          // Clear default layer as importing JSON adds a new layer.
          // We want the project to always only have one layer.
          project.activeLayer.remove();
          project.importJSON(value.project);
          socket.emit('project:load', value);
        }
        socket.emit('loading:end');
        db.close(function(){});
      });
    });
  } else {
    loadError(socket);
  }
}

// Send current project to new client
function loadFromMemory(room, socket) {
  var project = projects[room].project;
  if (!project) { // Additional backup check, just in case
    loadFromDB(room, socket);
    return;
  }
  socket.emit('loading:start');
  var value = project.exportJSON();
  socket.emit('project:load', {project: value});
  socket.emit('loading:end');
}

// When a client disconnects, unsubscribe him from
// the rooms he subscribed to
function disconnect(socket) {
  // Get a list of rooms for the client
  var rooms = io.sockets.manager.roomClients[socket.id];

  // Unsubscribe from the rooms
  for(var room in rooms) {
    if(room && rooms[room]) {
      unsubscribe(socket, { room: room.replace('/','') });
    }
  }
  
}

// Unsubscribe a client from a room
function unsubscribe(socket, data) {
  var room = data.room;

  // Remove the client from socket.io room
  // This is optional for the disconnect event, we do it anyway
  // because we want to broadcast the new room population
  socket.leave(room);

  // Broadcast to room the new user count
  if (io.sockets.manager.rooms['/' + room]) {
    var active_connections = io.sockets.manager.rooms['/' + room].length;  
    io.sockets.in(room).emit('user:disconnect', active_connections);
  } else {
  
    // Wait a few seconds before closing the project to finish pending writes to pad
    closeTimer[room] = setTimeout(function() {
      // Iff no one left in room, remove Paperjs instance
      // from the array to free up memory
      var project = projects[room].project;
      // All projects share one View, calling remove() on one project destroys the View
      // for all projects. Set to false first.
      project.view = false;
      project.remove();
      projects[room] = undefined;
    }, 5000);
  }
  
}

function loadError(socket) {
  socket.emit('project:load:error');
}

// Ends a path
var end_external_path = function (room, points, artist) {

  var project = projects[room].project;
  project.activate();
  var path = projects[room].external_paths[artist];
  
  if (path) {

    // Close the path
    path.add(new paper.Point(points.end[1], points.end[2]));
    path.closed = true;
    path.smooth();
    project.view.draw();

    // Remove the old data
    projects[room].external_paths[artist] = false;

  }

  writeProjectToDB(room);
};

// Continues to draw a path in real time
progress_external_path = function (room, points, artist) {

  var project = projects[room].project;
  project.activate();
  var path = projects[room].external_paths[artist];

  // The path hasn't already been started
  // So start it
  if (!path) {

    projects[room].external_paths[artist] = new paper.Path();
    path = projects[room].external_paths[artist];

    // Starts the path
    var start_point = new paper.Point(points.start[1], points.start[2]);
    var color = new paper.Color(points.rgba.red, points.rgba.green, points.rgba.blue, points.rgba.opacity);
    if(points.tool == "draw"){
      path.fillColor = color;
    } 
    else if (points.tool == "pencil"){
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

    path.add(new paper.Point(paths[i].top[1], paths[i].top[2]));
    path.insert(0, new paper.Point(paths[i].bottom[1], paths[i].bottom[2]));

  }

  path.smooth();
  project.view.draw();

};

function writeProjectToDB(room) {
  var project = projects[room].project;
  var json = project.exportJSON();
  db.init(function (err) {
    if(err) {
      console.error(err);
    }
    db.set(room, {project: json});
  });
}

function clearCanvas(room) {
  var project = projects[room].project;
  
  if (project && project.activeLayer && project.activeLayer.hasChildren()) {
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
    if (project && project.activeLayer && project.activeLayer.hasChildren()) {
      project.activeLayer.removeChildren();
    }
    writeProjectToDB(room);
  }
}

// Remove an item from the canvas
function removeItem(room, artist, itemName) {
  var project = projects[room].project;
  if (project && project.activeLayer && project.activeLayer._namedChildren[itemName] && project.activeLayer._namedChildren[itemName][0]) {
    project.activeLayer._namedChildren[itemName][0].remove();
    io.sockets.in(room).emit('item:remove', artist, itemName);
    writeProjectToDB(room);
  }
}

// Move one or more existing items on the canvas
function moveItemsProgress(room, artist, itemNames, delta) {
  var project = projects[room].project;
  if (project && project.activeLayer) {
    for (x in itemNames) {
      var itemName = itemNames[x];
      var namedChildren = project.activeLayer._namedChildren;
      if (namedChildren && namedChildren[itemName] && namedChildren[itemName][0]) {
        project.activeLayer._namedChildren[itemName][0].position.x += delta[1];
        project.activeLayer._namedChildren[itemName][0].position.y += delta[2];
      }
    }
    if (itemNames) {
      io.sockets.in(room).emit('item:move', artist, itemNames, delta);
    }
  }
}

// Move one or more existing items on the canvas
// and write to DB
function moveItemsEnd(room, artist, itemNames, delta) {
  var project = projects[room].project;
  if (project && project.activeLayer) {
    for (x in itemNames) {
      var itemName = itemNames[x];
      var namedChildren = project.activeLayer._namedChildren;
      if (namedChildren && namedChildren[itemName] && namedChildren[itemName][0]) {
        project.activeLayer._namedChildren[itemName][0].position.x += delta[1];
        project.activeLayer._namedChildren[itemName][0].position.y += delta[2];
      }
    }
    if (itemNames) {
      io.sockets.in(room).emit('item:move', artist, itemNames, delta);
    }
    writeProjectToDB(room);
  }
}

// Add image to canvas
function addImage(room, artist, data, position, name) {
  var project = projects[room].project;
  if (project && project.activeLayer) {
    var image = JSON.parse(data);
    var raster = new paper.Raster(image);
    raster.position = new paper.Point(position[1], position[2]);
    raster.name = name;
    io.sockets.in(room).emit('image:add', artist, data, position, name);
    writeProjectToDB(room);
  }
}
