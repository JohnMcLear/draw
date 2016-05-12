describe("Textbox", function() {
  var x = 100;
  var y = 100;
  var editTextbox;
  var pointText = false;
  var zoom = 2;
  var firstPadName;

  it("creates a drawing", function(done) {
    firstPadName = helper.newPad(done);
    setTimeout(function() { // Give it a sec for xhr polling
      var paper = window.frames[0].paper;
      paper.view.zoom = zoom;
      paper.view.draw();
    }, 500);
    this.timeout(60000);
  });
  
  it("creates the edit textbox", function(done) {
    this.timeout(1000);

    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;


    // Mouse clicks and drags to create path
    var canvas = chrome$("#myCanvas");
    // Change to the text tool
    chrome$('#textTool').click();
    canvas.simulate('mousedown', {clientX: x, clientY: y});
    canvas.simulate('mouseup', {clientX: x, clientY: y});
    canvas.simulate('click', {clientX: x, clientY: y});

    setTimeout(function() { // Give it a sec for xhr polling
      editTextbox = chrome$('.textEditor');
      expect(editTextbox.length).to.be(1); // Expect 8 segments to this path
      done();
    }, 500);
  });

  it("focuses on the textbox", function(done) {
    this.timeout(2000);

    expect(editTextbox.is(":focus")).to.be(true);
    done();
  });

  it('draws the textbox to the canvas', function(done) {
    this.timeout(3000);
    
    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;
    var canvas = chrome$("#myCanvas");

    editTextbox.html('Test line 1<br>Test line 2<div>Test line 3</div>');


    canvas.simulate('mousedown', {clientX: x - 10, clientY: y - 10});
    canvas.simulate('mouseup', {clientX: x - 10, clientY: y - 10});
    canvas.simulate('click', {clientX: x - 10, clientY: y - 10});

    setTimeout(function() { // Give it a sec for xhr polling
      var layer = paper.project.activeLayer;
      var numChildren = layer.children.length;
      expect(numChildren).to.be(1); // Expect only one child node to be on canvas
      
      path = window.frames[0].paper.project.activeLayer.children[0]; // Save path for later test
      done();
    }, 500);
  });

  it('puts the textbox in the correct position', function(done) {
    this.timeout(4000);

    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;
    var canvas = chrome$("#myCanvas");
    var position = canvas.offset();
    var offset = paper.view.bounds.point;

    expect(Math.round(path.bounds.point.x)).to.be(Math.round(((x - position.left) / zoom) + offset.x));
    expect(Math.round(path.bounds.point.y)).to.be(Math.round(((y - position.top)/ zoom) + offset.y));

    done();
  });

  it('set the correct content in the textbox', function(done) {
    this.timeout(4000);
    
    var c;
    var paper = window.frames[0].paper;

    expect(path.children.length).to.be(2);

    for (c in path.children) {
      if (path.children[c] instanceof paper.PointText) {
        pointText = path.children[c];
        break;
      }
    }

    expect(pointText).not.to.be(false);

    expect(pointText.content).to.be("Test line 1\nTest line 2\nTest line 3");

    done();
  });

  it("textbox was saved", function(done) {
    this.timeout(10000);
    padName = helper.newPad(function() {
      var padsEqual = padName == firstPadName;
      if (padsEqual) {
        var paper = window.frames[0].paper;
        paper.view.zoom = zoom;
        paper.view.draw();
        reloaded = true;
      }
      expect(padsEqual).to.be(true); // Expect old pad name to be new pad name (reloaded same pad)
      done();
    }, firstPadName);
  });

  it("path is present on reload", function(done) {
    this.timeout(60000);
    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;
    var pointText;

    if (!reloaded) {
      throw new Error("Reloads same pad test failed.");
    }

    if (!path) {
      throw new Error("Path missing.");
    }
  
    expect(paper.project.activeLayer.children.length).to.be(1);

    var path2 = paper.project.activeLayer.children[0];
    if (path._name != path2._name) {
      throw new Error("Path names do not match.");
    }

    expect(path2.children.length).to.be(2);

    for (c in path2.children) {
      if (path2.children[c] instanceof paper.PointText) {
        pointText = path2.children[c];
        break;
      }
    }

    expect(pointText).not.to.be(false);

    expect(pointText.content).to.be("Test line 1\nTest line 2\nTest line 3");
   
    done();
  });

  it('can edit the textbox', function(done) {
    this.timeout(79000);

    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;

    // Mouse clicks and drags to create path
    var canvas = chrome$("#myCanvas");
    // Change to the text tool
    chrome$('#textTool').click();
    canvas.simulate('mousedown', {clientX: x + 10, clientY: y + 10});
    canvas.simulate('mouseup', {clientX: x + 10, clientY: y + 10});
    canvas.simulate('click', {clientX: x + 10, clientY: y + 10});

    setTimeout(function() { // Give it a sec for xhr polling
      editTextbox = chrome$('.textEditor');
      expect(editTextbox.length).to.be(1); // Expect 8 segments to this path
      expect(editTextbox.text()).to.be('Test line 1Test line 2Test line 3');
      
      done();
    }, 500);
  });
});
