function ViewModel() {
    var self = this;

    self.windDirection = ko.observable(Math.random() * Math.PI * 2);
    self.windSpeed = ko.observable(5 + Math.random() * 2 - 1);

    self.selectedLandingDirection = ko.observable(0);
    self.landIntoWind = ko.observable(true);
    self.landingDirection = ko.computed(function() {
        return self.landIntoWind() ? normalizeAngle(self.windDirection() + Math.PI) : self.selectedLandingDirection();
    });

    self.simulation = {
        started: ko.observable(false)
    };

    self.canopy = {
        location: ko.observable(),
        altitude: ko.observable(),
        heading: ko.observable(),
        mode: ko.observable(),

        speedH: ko.computed(function() {
            return getCanopyHorizontalSpeed(this.mode());
        }, self.canopy, { deferEvaluation: true }),

        speedV: ko.computed(function() {
            return getCanopyVerticalSpeed(this.mode());
        }, self.canopy, { deferEvaluation: true }),

        steadyPoint: ko.computed(function() {
            if (!self.simulation.started()) {
                return undefined;
            }
            var timeToLanding = this.altitude() / this.speedV();
            return moveInWind(this.location(), self.windSpeed(), self.windDirection(), this.speedH(), this.heading(), timeToLanding);
        }, self.canopy, { deferEvaluation: true })
    };

    self.currentDropzoneId = ko.observable("dz-uk-sibson");

    self.startSimulation = function(location) {
        self.canopy.location(location);
        self.canopy.altitude(self.openingAltitude());
        self.canopy.heading(self.windDirection() + Math.PI); // Into the wind
        self.canopy.mode(0.6);
    };
}

var viewModel = new ViewModel();
ko.applyBindings(viewModel);
