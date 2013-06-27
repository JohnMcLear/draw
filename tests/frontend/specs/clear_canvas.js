describe("Clear canvas", function(){

  var oldPadName,
      padName,
      path,
      reloaded = false;

  it("creates a pad", function(done) {
    padName = helper.newPad(done);
    this.timeout(60000);
  });
  
  it("drawn path is added to paperjs project", function(done) {
    this.timeout(1000);

    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;

    // Mouse clicks and drags to create path
    var canvas = chrome$("#myCanvas");
    canvas.simulate('drag', {dx: 100, dy: 50});
    var layer = paper.project.activeLayer;

    var numChildren = layer.children.length;
    expect(numChildren).to.be(1); // Expect only one child node to be on canvas

    var numSegments = layer.children[0]._segments.length;
    expect(numSegments).to.be(8); // Expect 8 segments to this path
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

  it("path is present on reload", function(done) {
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

  it("clears local canvas", function(done) {
    this.timeout(10000);
    var chrome$ = helper.padChrome$;
    chrome$("#clearCanvas").click();

    if (window.frames[0].paper.project.activeLayer.children.length != 0) {
      throw new Error("Project is not empty. Number of children = " + window.frames[0].paper.project.activeLayer.children.length + " instead of 0.");
    }
    done();
  });
  
  reloaded = false;
  
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
  
  it("clears server canvas (empty on reload)", function(done) {
    this.timeout(10000);

    if (!reloaded) {
      throw new Error("Reloads same pad test failed.");
    }

    var projectChildren = window.frames[0].paper.project.activeLayer.children.length;
    // Expect the number of children to be zero (project is empty)
    if (projectChildren != 0) {
      throw new Error("Project is not empty. Number of children = " + projectChildren + " instead of 0.");
    }
    done();
  });
});
