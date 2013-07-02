describe("Draw a path with a pencil", function(){

  var oldPadName,
      padName,
      path,
      reloaded = false;

  it("creates a pad", function(done) {
    padName = helper.newPad(done);
    this.timeout(60000);
  });
  
  it("drawn pencil path is added to paperjs project", function(done) {
    this.timeout(1000);

    var chrome$ = helper.padChrome$;
    var pencilButton$ = chrome$("#pencilTool");
    pencilButton$.click();
    var paper = window.frames[0].paper;

    // Mouse clicks and drags to create path
    var canvas = chrome$("#myCanvas");
    canvas.simulate('drag', {dx: 100, dy: 50});
    var layer = paper.project.activeLayer;

    var numChildren = layer.children.length;
    expect(numChildren).to.be(1); // Expect only one child node to be on canvas

    var numSegments = layer.children[0]._segments.length;
    expect(numSegments).to.be(8); // Expect 8 segments for this path
    oldPadName = padName;
    path = window.frames[0].paper.project.activeLayer.children[0]; // Save path for later test
    done();
  });
  
  it("reloads same pad", function(done) {
    this.timeout(60000);
    padName = helper.newPad(function() {
      var padsEqual = padName == oldPadName;
      if (padsEqual) {
        reloaded = true;
      }
      expect(padsEqual).to.be(true); // Expect old pad name to be new pad name (reloaded same pad)
      done();
    }, oldPadName);
  });

  it("pencil path is present on reload", function(done) {
    this.timeout(60000);
    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;

    if (!reloaded) {
      throw new Error("Reloads same pad test failed.");
    }

    if (!path) {
      throw new Error("Path missing.");
    }

    var path2 = window.frames[0].paper.project.activeLayer.children[0];
    if (path._name != path2._name) {
      throw new Error("Path names do not match.");
    }
    if (path._segments.length != path2._segments.length) {
      throw new Error("Paths have differing number of segments.");
    }

    var pathsEqual = true;
    for (var i=0; i<path._segments.length; i++) {
      var p1 = path._segments[i]._point;
      var p2 = path2._segments[i]._point;
      if (p1._x != p2._x || p1._y != p2._y) {
        pathsEqual = false;
        throw new Error("Path segments differ.");
        break;
      }
    }
    expect(pathsEqual).to.be(true); // Expect paths' names and segments to be equal
    done();
  });

});
