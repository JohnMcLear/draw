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
  
});

var projects = {};
// Subscribe a client to a room
function subscribe(socket, data) {
  var room = data.room;

  // Subscribe the client to the room
  socket.join(room);

  // Create Paperjs instance for this room if it doesn't exist
  var project = projects[room];
  if (!project) {
    projects[room] = {};
    projects[room].project = new paper.Project(paper.view);
    projects[room].external_paths = {};
  }
  loadFromDB(room, socket);

  // Broadcast to room the new user count
  var active_connections = io.sockets.manager.rooms['/' + room].length;  
  io.sockets.in(room).emit('user:connect', active_connections);
 
}

// Try to load room from database
function loadFromDB(room, socket) {

  if (projects[room] && projects[room].project) {
    db.init(function (err) {
      if(err) {
        console.error(err);
      }
      db.get(room, function(err, value) {
	    if (value && projects[room].project && projects[room].project instanceof paper.Project) {
          socket.emit('loading:start');
          // Clear default layer as importing JSON adds a new layer.
          // We want the project to always only have one layer.
          projects[room].project.activeLayer.remove();
          projects[room].project.importJSON(value.project);
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
    // Iff no one left in room, remove Paperjs instance
    // from the array to free up memory
    projects[room] = false;
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
    paper.view.draw();

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
    path.fillColor = color;
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
  paper.view.draw();

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
    if (paper.project.activeLayer && paper.project.activeLayer.hasChildren()) {
      paper.project.activeLayer.removeChildren();
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
      if (project.activeLayer._namedChildren[itemName][0]) {
        project.activeLayer._namedChildren[itemName][0].position.x += delta[1];
        project.activeLayer._namedChildren[itemName][0].position.y += delta[2];
      }
    }
    io.sockets.in(room).emit('item:move', artist, itemNames, delta);
  }
}

// Move one or more existing items on the canvas
// and write to DB
function moveItemsEnd(room, artist, itemNames, delta) {
  var project = projects[room].project;
  if (project && project.activeLayer) {
    for (x in itemNames) {
      var itemName = itemNames[x];
      if (project.activeLayer._namedChildren[itemName][0]) {
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