describe("Export SVG", function(){

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
  
  it("exports svg", function(done) {
    this.timeout(60000);
    var chrome$ = helper.padChrome$;
    chrome$("#exportSVG").click();

    var svg = window.frames[0].paper.project.exportSVG();
    svg.setAttribute('version', '1.1');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    var dummy = document.createElement('div');
    dummy.appendChild(svg);
    var b64 = Base64.encode(dummy.innerHTML);

    if (!window.frames[0].winsvg) {
      throw new Error("New window was not created. Are popups blocked?");
    }
    if (!window.frames[0].winsvg.document) {
      throw new Error("New window's html document was not created.");
    }
    if (chrome$.browser.msie) { // IE uses an svg element instead of an img element
      if (window.frames[0].winsvg.document.getElementsByTagName('svg').length < 1) {
        window.frames[0].winsvg.close();
        throw new Error("New window doesn't have an svg element.");
      }
      var svg2 = window.frames[0].winsvg.document.getElementsByTagName('svg')[0];
      if (svg.isEqualNode(svg2)) {
        throw new Error("SVG element doesn't match.");
      }
    } else {
      if (window.frames[0].winsvg.document.getElementsByTagName('img').length < 1) {
        window.frames[0].winsvg.close();
        throw new Error("New window doesn't have an img element.");
      }
      var src = window.frames[0].winsvg.document.getElementsByTagName('img')[0].src;
      var src64 = src.split(',');
      src64 = src64[src64.length-1];
      if (src64 != b64) { // Compare base64 conversions of the SVG
        window.frames[0].winsvg.close();
        throw new Error("SVG data URI incorrect.\nIs: " + src64 + "\nShould be: " + b64);
      }
    }
    window.frames[0].winsvg.close();
    done();
  });
});