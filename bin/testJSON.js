// Test the integrity of the JSON stored in the database by trying to load each project

var paper = require('paper');
paper.setup(new paper.Canvas(1920, 1080));
var ueberDB = require("ueberDB");
var db = new ueberDB.database("dirty", {"filename" : "var/dirty.db"});

var projects = {};

db.init(function (err) {
  if(err) {
    console.error(err);
  }
  db.findKeys("*", "", function(err, rooms){
    var length = rooms.length;
    // begin for each
    for (var i = 0; i < length; i++){
      var room = rooms[i];
      projects[room] = {};
      projects[room].project = new paper.Project(paper.projects[0].view);
      projects[room].external_paths = {};
      loadFromDB(room);
    }
  });
});

// Try to load room from database
function loadFromDB(room) {
  if (projects[room] && projects[room].project) {
    var project = projects[room].project;
    db.init(function (err) {
      if(err) {
        console.error(err);
      }
      db.get(room, function(err, value) {
        if (value && project && project instanceof paper.Project && project.activeLayer) {
          // Clear default layer as importing JSON adds a new layer.
          // We want the project to always only have one layer.
          project.activeLayer.remove();
          project.importJSON(value.project);
          console.log("Loaded room", room);
          projects[room].destroy; // remove it
          console.log("Destroyed room", room);
        }
        db.close(function(){});
      });
    });
  } else {
    // loadError(socket);
  }
}
