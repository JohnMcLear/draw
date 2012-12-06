/**
 * Module dependencies.
 */

/*
var express = require('express'),
  app = express(),
  http = require('http'),
  server = http.createServer(app),
  socket = require('socket.io'),
  io = socket.listen(server);
*/

var express = require('express');
var app = express.createServer();
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

var pub = __dirname + '/public';
app.use(app.router);
app.use(express.static(pub));
// app.use(express.errorHandler());
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', {layout: false});

app.configure(function(){
  app.use(express.static(__dirname + '/'));
});

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
app.get('/', function(req, res){
  res.render('index', {
    title: 'title'
  });
});

// LISTEN FOR REQUESTS
var server = app.listen(port);
var io = socket.listen(server);

// SOCKET IO
var active_connections = 0;
io.sockets.on('connection', function (socket) {

  active_connections++

  io.sockets.emit('user:connect', active_connections);

  socket.on('disconnect', function () {
    active_connections--
    io.sockets.emit('user:disconnect', active_connections);
  });

  // EVENT: User stops drawing something
  socket.on('draw:progress', function (uid, co_ordinates) {
    
    io.sockets.emit('draw:progress', uid, co_ordinates)

  });

  // EVENT: User stops drawing something
  socket.on('draw:end', function (uid, co_ordinates) {
    
    io.sockets.emit('draw:end', uid, co_ordinates)

  });
  
});


