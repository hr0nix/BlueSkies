function ViewModel() {
    var self = this;

    self.display = {
        language: ko.observable("en"),
        unitSystem: ko.observable("metric"),

        steadyPoint: ko.observable(false),
        reachset: ko.observable(false),
        controlset: ko.observable(false)
    };

    self.wind = {
        direction: ko.observable(Math.random() * Math.PI * 2),
        speed: ko.observable(5 + Math.random() * 2 - 1)
    };

    self.pattern = {
        selectedLandingDirection: ko.observable(0),
        intoWind: ko.observable(true),
        openingAltitude: ko.observable(700),

        display: ko.observable("hide"),
        show: ko.computed(function() {
            return self.pattern.display() !== "hide";
        }, this, { deferEvaluation: true }),
        lhs: ko.computed(function() {
            return
                !self.pattern.show() ? undefined :
                self.pattern.display() === "lhs";
        }, this, { deferEvaluation: true }),

        landingDirection: ko.computed(function() {
            return self.pattern.intoWind() ? normalizeAngle(self.wind.direction() + Math.PI) : self.pattern.selectedLandingDirection();
        }, this, { deferEvaluation: true }),

        points: ko.computed(function() {
            if (!self.pattern.show()) {
                return undefined;
            }
            return computeLandingPattern(self.location.coords(), self.wind, self.pattern);
        }, this, { deferEvaluation: true })
    };

    self.simulation = {
        started: ko.observable(false),
        speed: ko.observable(1.0),
        oldSpeed: 1.0,

        tooglePause: function() {
            if (self.simulation.speed() != 0) {
                self.simulation.oldSpeed = self.simulation.speed();
                self.simulation.speed(self.simulation.oldSpeed);
            } else {
                self.simulation.speed(self.simulation.oldSpeed);
            }
        }
    };

    self.canopy = {
        location: ko.observable(),
        altitude: ko.observable(),
        heading: ko.observable(),
        mode: ko.observable(),

        speedH: ko.computed(function() {
            return getCanopyHorizontalSpeed(self.canopy.mode());
        }, this, { deferEvaluation: true }),

        speedV: ko.computed(function() {
            return getCanopyVerticalSpeed(self.canopy.mode());
        }, this, { deferEvaluation: true })
    };

    self.location = {
        currentDropzoneId: ko.observable("dz-uk-sibson"),

        coords: ko.observable()
    };

    self.steadyPoint = ko.computed(function() {
        if (!self.simulation.started()) {
            return undefined;
        }
        var timeToLanding = this.altitude() / this.speedV();
        return moveInWind(this.location(), self.windSpeed(), self.wind.direction(), this.speedH(), this.heading(), timeToLanding);
    }, self.canopy, { deferEvaluation: true });

    self.startSimulation = function(location) {
        self.canopy.location(location);
        self.canopy.altitude(self.pattern.openingAltitude());
        self.canopy.heading(self.wind.direction() + Math.PI); // Into the wind
        self.canopy.mode(0.6);

        self.simulation.started(true);
    };
}

var viewModel = new ViewModel();
ko.applyBindings(viewModel);
