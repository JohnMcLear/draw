describe("Scale and Pan", function(){
  var oldPadName,
      padName,
      path,
      reloaded = false;

  var panMethods = {
    'middle click and drag': {
      button: 1
    },
    '<CTRL> click and drag': {
      button: 0,
      ctrlKey: true
    }
  };

  it("creates a pad", function(done) {
    padName = helper.newPad(done);
    this.timeout(60000);
  });
  
  it("draw a path", function(done) {
    var chrome$ = helper.padChrome$;
    var paper = window.frames[0].paper;

    // Mouse clicks and drags to create path
    var canvas = chrome$("#myCanvas");
    canvas.simulate('drag', {dx: 100, dy: 50});

    done();
  });
 
   describe('Panning', function() {
    var m;

    for (m in panMethods) {
      it(m + " pans linearly", (function(m) { return function(done) {
        this.timeout(5000);

        var chrome$ = helper.padChrome$;
        var paper = window.frames[0].paper;
        var view = paper.project.view;
        var startBounds = view.bounds;

        // Mouse clicks and drags to create path
        var canvas = chrome$("#myCanvas");
        canvas.simulate('drag', {
          dx: -100, dy: -50,
          eventOptions: panMethods[m]
        });

        var view = paper.project.view;
        var bounds = view.bounds;
        expect(bounds.x).to.be(startBounds.x + 100);
        expect(bounds.y).to.be(startBounds.y + 50);
        done();
      }; })(m));

      it(m + " pans backwards too", (function(m) { return function(done) {
        this.timeout(5000);

        var chrome$ = helper.padChrome$;
        var paper = window.frames[0].paper;
        var view = paper.project.view;
        var startBounds = view.bounds;

        // Mouse clicks and drags to create path
        var canvas = chrome$("#myCanvas");
        canvas.simulate('drag', {
          dx: 70, dy: 50,
          eventOptions: panMethods[m]
        });
        var view = paper.project.view;
        var bounds = view.bounds;
        expect(bounds.x).to.be(startBounds.x - 70);
        expect(bounds.y).to.be(startBounds.y - 50);
        done();
      }; })(m));
    }
  });

  var scrollTypes = {
    'pixel scroll': {
      eventOptions : {
        deltaX: -50,
        deltaY: 0,
        deltaMode: 0
      },
      scaleDiff: 50 * 0.002
    },
    'line scroll': {
      eventOptions : {
        deltaX: 5,
        deltaY: 0,
        deltaMode: 1
      },
      scaleDiff: -5 * 0.02
    },
    'page scroll': {
      eventOptions : {
        deltaX: -1,
        deltaY: 0,
        deltaMode: 2
      },
      scaleDiff: 1 * 0.1
    }
  };

  describe('Scaling', function() {
    var s;

    for (s in scrollTypes) {
      it(s + ' should scale', (function(s) { return function(done) {
        this.timeout(5000);

        var chrome$ = helper.padChrome$;
        var paper = window.frames[0].paper;
        var view = paper.project.view;
        var oldScale = view.zoom;

        // Mouse clicks and drags to create path
        var canvas = chrome$("#myCanvas");
        canvas.simulate('wheel', scrollTypes[s].eventOptions);

        var newScale = view.zoom;

        expect(newScale).to.be(oldScale + scrollTypes[s].scaleDiff);
        done();
      }; })(s));
    }
  });

  describe('Scaled panning', function() {
    it('should pan evenly when zoomed in', function(done) {
        var chrome$ = helper.padChrome$;
        var paper = window.frames[0].paper;
        var view = paper.project.view;
        view.zoom = 2;
        view.draw();
        
        var startBounds = view.bounds;

        // Mouse clicks and drags to create path
        var canvas = chrome$("#myCanvas");

        canvas.simulate('drag', {
          dx: -200, dy: -100,
          eventOptions: {
            button: 1
          }
        });
        
        var bounds = view.bounds;
        
        expect(bounds.x).to.be(startBounds.x + (200/2));
        expect(bounds.y).to.be(startBounds.y + (100/2));
        done();
    
    });
  });
});
