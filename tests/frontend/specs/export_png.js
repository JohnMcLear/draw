describe("Export PNG", function(){

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
  
  it("exports png", function(done) {
    this.timeout(60000);
    var chrome$ = helper.padChrome$;
    chrome$("#exportPNG").click();

    var png = window.frames[0].document.getElementById('myCanvas').toDataURL('image/png');

    if (!window.frames[0].winpng) {
      throw new Error("New window was not created. Are popups blocked?");
    }
    if (!window.frames[0].winpng.document) {
      throw new Error("New window's html document was not created.");
    }
    if (window.frames[0].winpng.document.getElementsByTagName('img').length < 1) {
      throw new Error("New window doesn't have an img element.");
    }
    var src = window.frames[0].winpng.document.getElementsByTagName('img')[0].src;
    if (src != png) {
      window.frames[0].winpng.close();
      throw new Error("PNG data URI incorrect.\nIs: " + src + "\nShould be: " + png);
    }
    window.frames[0].winpng.close();
    done();
  });
});
