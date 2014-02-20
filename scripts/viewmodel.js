function ViewModel() {
    var self = this;

    self.debug = {
        on: ko.observable(false)
    };

    self.display = {
        language: ko.observable("en"),
        unitSystem: ko.observable("metric"),

        steadyPoint: ko.observable(false),
        reachset: ko.observable(false),
        controlset: ko.observable(false),

        maxAltitude: ko.computed(function() {
            return Math.max(altitudeProgressbarMax, self.pattern.openingAltitude());
        }, this, { deferEvaluation: true })
    };

    self.wind = {
        // We use the azimuth of the wind speed vector here, not the navigational wind direction (i.e. where wind is blowing, not where _from_)
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

        oldSpeed: 1.0, // to support togglePause
        togglePause: function() {
            if (self.simulation.speed() != 0) {
                self.simulation.oldSpeed = self.simulation.speed();
                self.simulation.speed(0);
            } else {
                self.simulation.speed(self.simulation.oldSpeed);
            }
        },

        flying: ko.computed(function() {
            return self.simulation.started() && self.canopy.altitude() > eps;
        }, this, { deferEvaluation: true })
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
        }, this, { deferEvaluation: true }),

        modeChange: function(amount) {
            var minMode = 0.1; // We don't allow flying in the stall
            self.canopy.mode(clamp(self.canopy.mode() + amount, minMode, 1));
        },

        steeringInput: function(amount) {
            self.canopy.heading(normalizeAngle(self.canopy.heading() + amount));
        },

        descend: function(time) {
            self.canopy.altitude(self.canopy.altitude() - time * self.canopy.speedV());
            self.canopy.location(moveInWind(self.canopy.location(), self.wind.speed(), self.wind.direction(), self.canopy.speedH(), self.canopy.heading(), time));
        }
    };

    self.location = {
        id: ko.observable("dz-uk-sibson"),
        coords: ko.observable(),

        custom: {
            location: ko.observable(null),
            name: ko.observable()
        },
        set: function(id) {
            self.location.coords(
                id === "dz-custom" ?
                    self.location.custom.location() :
                    dropzones[id]);
        }
    };

    self.location.id.extend({ notify: 'always' });
    self.location.id.subscribe(function(newId) {
    });

    self.steadyPoint = ko.computed(function() {
        if (!self.simulation.started()) {
            return undefined;
        }
        var timeToLanding = this.altitude() / this.speedV();
        return moveInWind(this.location(), self.windSpeed(), self.wind.direction(), this.speedH(), this.heading(), timeToLanding);
    }, self.canopy, { deferEvaluation: true });

    self.reachSetAltitude = ko.computed(function() {
        return self.canopy.altitude() > eps ? self.canopy.altitude() : self.pattern.openingAltitude();
    });

    self.startSimulation = function(loc) {
        self.canopy.location(loc);
        self.canopy.altitude(self.pattern.openingAltitude());
        self.canopy.heading(self.wind.direction() + Math.PI); // Into the wind
        self.canopy.mode(0.6);

        self.simulation.started(true);
    };
}

var viewModel = new ViewModel();
ko.applyBindings(viewModel);
