describe("Move items", function() {

  var oldPadName,
      padName,
      path1,
      path2,
      path3,
      center1,
      center2,
      center3,
      oldPosition1,
      oldPosition2,
      oldPosition3,
      newPosition1,
      newPosition2,
      newPosition3,
      reloaded = false;

  it("creates a pad", function(done) {
    padName = helper.newPad(done);
    this.timeout(60000);
  });
  
  it("drawn paths are added to paperjs project", function(done) {
    this.timeout(1000);

    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;

    // Mouse clicks and drags to create path
    var canvas = chrome$("#myCanvas");
    canvas.simulate('drag', {dx: 100, dy: 100}); // Path 1
    canvas.simulate('drag', {dx: 0, dy: 200}); // Path 2
    canvas.simulate('drag', {dx: 200, dy: 0}); // Path 3

    helper.waitFor(function(){
      return window.frames[0].paper.project.activeLayer.children.length === 3; // wait until the three paths are drawn
    }, 2000).done(function(){
      var layer = paper.project.activeLayer;

      var numChildren = layer.children.length;
      if (numChildren !== 3) { // Expect three child nodes to be on canvas
        throw new Error("Wrong number of children in paper project. Found " + numChildren + " but expected 3");
      }

      var numSegments = layer.children[0]._segments.length;
      expect(numSegments).to.be(8); // Expect 8 segments for path 1
      numSegments = layer.children[1]._segments.length;
      expect(numSegments).to.be(12); // Expect 12 segments for path 2
      numSegments = layer.children[2]._segments.length;
      expect(numSegments).to.be(12); // Expect 12 segments for path 3
      oldPadName = padName;
      path1 = window.frames[0].paper.project.activeLayer.children[0];
      path2 = window.frames[0].paper.project.activeLayer.children[1];
      path3 = window.frames[0].paper.project.activeLayer.children[2];
      center1 = {x: path1.position.x, y: path1.position.y};
      center2 = {x: path2.position.x, y: path2.position.y};
      center3 = {x: path3.position.x, y: path3.position.y};
      done();
    });
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
  
  it("selection tool selected (can't draw)", function(done) {
    this.timeout(60000);
    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    var chrome$ = helper.padChrome$;
    chrome$("#selectTool").click();

    var canvas = chrome$("#myCanvas");
    // Path 4, draw in corner instead of center to not drag an existing path
    canvas.simulate('drag', {dx: 50, dy: 50, handle: 'corner'});
    numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren === 4) { // Expect the number of children to still be 3
      throw new Error("Select tool failed - drew new path after activating select tool.");
    }
    done();
  });
  
  it("doesn't move anything when nothing is selected", function(done) {
    this.timeout(60000);
    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    var oldPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    var oldPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    var oldPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;
    // Simulate dragging on an blank area of the canvas
    canvas.simulate('drag', {clientX: 10, clientY: 10, dx: 100, dy: 100});
    var newPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    var newPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    var newPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;

    if (newPosition1._x !== oldPosition1._x || newPosition1._y !== oldPosition1._y || 
        newPosition2._x !== oldPosition2._x || newPosition2._y !== oldPosition2._y ||
        newPosition3._x !== oldPosition3._x || newPosition3._y !== oldPosition3._y) {
      throw new Error("Positions before and after mouse drag are not equal.");
    }
    done();
  });

  it("selects single path", function(done) {
    this.timeout(60000);

    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    // Make sure nothing is selected
    window.frames[0].paper.project.activeLayer.selected = false;

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    // Simulate clicking path3
    canvas.simulate('mousedown', {clientX: center3.x, clientY: center3.y});
    canvas.simulate('mouseup', {clientX: center3.x, clientY: center3.y});

    var itemsSelected = window.frames[0].paper.project.selectedItems.length;
    if (itemsSelected !== 1) { // Expect only one path to be selected
      throw new Error("Items selected = " + itemsSelected + " instead of just 1.");
    }
    done();
  });
  
  it("moves single path", function(done) {
    this.timeout(60000);

    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    var itemsSelected = window.frames[0].paper.project.selectedItems.length;
    if (itemsSelected !== 1) { // Expect only one path to be selected
      throw new Error("Items selected = " + itemsSelected + " instead of just 1.");
    }

    // Make sure path 3 is selected
    if (window.frames[0].paper.project.length !== 1 || window.frames[0].paper.project.activeLayer.children[2].selected === false) {
      window.frames[0].paper.project.activeLayer.selected = false; // Clear any selections
      window.frames[0].paper.project.activeLayer.children[2].selected = true;
    }

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    oldPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    oldPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    oldPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;
    // Simulate dragging on path 3
    canvas.simulate('drag', {clientX: oldPosition3._x, clientY: oldPosition3._y, dx: 100, dy: 100});
    newPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    newPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    newPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;

    if (newPosition1._x !== oldPosition1._x || newPosition1._y !== oldPosition1._y) {
      throw new Error("Path 1 moved when only 3 should have moved..");
    }
    if (newPosition2._x !== oldPosition2._x || newPosition2._y !== oldPosition2._y) {
      throw new Error("Path 2 moved when only 3 should have moved.");
    }
    if (newPosition3._x === oldPosition3._x || newPosition3._y === oldPosition3._y) {
      throw new Error("Path 3 did not move.");
    }
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

  it("path moved on server", function(done) {
    this.timeout(60000);
    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    newPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    newPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    newPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;
    if (Math.abs(newPosition1._x - oldPosition1._x) > 1 || Math.abs(newPosition1._y - oldPosition1._y) > 1) {
      throw new Error("Path 1 moved when only 3 should have moved.");
    }
    if (Math.abs(newPosition2._x - oldPosition2._x) > 1 || Math.abs(newPosition2._y - oldPosition2._y) > 1) {
      throw new Error("Path 2 moved when only 3 should have moved.");
    }
    if (Math.abs(newPosition3._x - oldPosition3._x) < 1 || Math.abs(newPosition3._y - oldPosition3._y) < 1) {
      throw new Error("Path 3 didn't move on the server.");
    }
    done();
  });

  it("selection tool selected (can't draw)", function(done) {
    this.timeout(60000);
    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    var chrome$ = helper.padChrome$;
    chrome$("#selectTool").click();

    var canvas = chrome$("#myCanvas");
    // Path 4, draw in corner instead of center to not drag an existing path
    canvas.simulate('drag', {dx: 50, dy: 50, handle: 'corner'});
    numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren === 4) { // Expect the number of children to still be 3
      throw new Error("Select tool failed - drew new path after activating select tool.");
    }
    done();
  });
  
  it("selects multiple paths", function(done) {
    this.timeout(60000);

    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    // Make sure nothing is selected
    window.frames[0].paper.project.activeLayer.selected = false;

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    // Simulate clicking path1
    center1 = window.frames[0].paper.project.activeLayer.children[0].position;
    center2 = window.frames[0].paper.project.activeLayer.children[1].position;
    canvas.simulate('mousedown', {clientX: center1.x, clientY: center1.y});
    canvas.simulate('mouseup', {clientX: center1.x, clientY: center1.y});
    // Simulate clicking path2 while holding shift
    canvas.simulate('mousedown', {clientX: center2.x, clientY: center2.y, shiftKey: true});
    canvas.simulate('mouseup', {clientX: center2.x, clientY: center2.y, shiftKey: true});

    var itemsSelected = window.frames[0].paper.project.selectedItems.length;
    if (itemsSelected !== 2) { // Expect 2 paths to be selected
      throw new Error("Items selected = " + itemsSelected + " instead of 2.");
    }
    done();
  });

  it("moves multiple paths", function(done) {
    this.timeout(60000);

    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }
	
    // Make sure path 1 and 2 are selected
    if (window.frames[0].paper.project.length !== 2 || window.frames[0].paper.project.activeLayer.children[0].selected === false ||
        window.frames[0].paper.project.activeLayer.children[1].selected === false) {
      window.frames[0].paper.project.activeLayer.selected = false; // Clear any selections
      window.frames[0].paper.project.activeLayer.children[0].selected = true;
      window.frames[0].paper.project.activeLayer.children[1].selected = true;
    }

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    oldPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    oldPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    oldPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;
    // Simulate dragging on path 1 & 2
    canvas.simulate('drag', {clientX: oldPosition2._x, clientY: oldPosition2._y, dx: -100, dy: -100, shiftKey: true});
    newPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    newPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    newPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;

    if (newPosition1._x === oldPosition1._x || newPosition1._y === oldPosition1._y) {
      throw new Error("Path 1 did not move");
    }
    if (newPosition2._x === oldPosition2._x || newPosition2._y === oldPosition2._y) {
      throw new Error("Path 2 did not move.");
    }
    if (newPosition3._x !== oldPosition3._x || newPosition3._y !== oldPosition3._y) {
      throw new Error("Path 3 moved when only 1 and 2 should have moved.");
    }
    /*oldPosition1 = newPosition1;
    oldPosition2 = newPosition2;
    oldPosition3 = newPosition3;*/
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
  
  it("paths moved on server", function(done) {
    this.timeout(60000);
    var numChildren = window.frames[0].paper.project.activeLayer.children.length;
    if (numChildren !== 3) { // Expect 3 children
      throw new Error("Incorrect number of children in project. Found " + numChildren + " but expected 3.");
    }

    var chrome$ = helper.padChrome$;
    var canvas = chrome$("#myCanvas");
    newPosition1 = window.frames[0].paper.project.activeLayer.children[0].position;
    newPosition2 = window.frames[0].paper.project.activeLayer.children[1].position;
    newPosition3 = window.frames[0].paper.project.activeLayer.children[2].position;

    if (Math.abs(newPosition1._x - oldPosition1._x) < 1 || Math.abs(newPosition1._y - oldPosition1._y) < 1) {
      throw new Error("Path 1 did not move on the server.");
    }
    if (Math.abs(newPosition2._x - oldPosition2._x) < 1 || Math.abs(newPosition2._y - oldPosition2._y) < 1) {
      throw new Error("Path 2 did not move on the server.");
    }
    if (Math.abs(newPosition3._x - oldPosition3._x) > 1 || Math.abs(newPosition3._y - oldPosition3._y) > 1) {
      throw new Error("Path 3 moved on the server when only Paths 1 and 2 should have moved.");
    }
    done();
  });

});