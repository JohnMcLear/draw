/**
 * Module dependencies.
 */

var express = require("express");
var app = express();

var socket = require('socket.io');
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
    io.sockets.in(room).emit('draw:progress', uid, co_ordinates);
  });

  // EVENT: User stops drawing something
  // Having room as a parameter is not good for secure rooms
  socket.on('draw:end', function (room, uid, co_ordinates) {
	io.sockets.in(room).emit('draw:end', uid, co_ordinates)
  });
  
  // User joins a room
  socket.on('subscribe', function(data) {
    subscribe(socket, data);
  });
  
});

// Subscribe a client to a room
function subscribe(socket, data) {
  var room = data.room;

  // Subscribe the client to the room
  socket.join(room);
  
  // Broadcast to room the new user count
  var active_connections = io.sockets.manager.rooms['/' + room].length;  
  io.sockets.in(room).emit('user:connect', active_connections);
 
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
  }
  
}


