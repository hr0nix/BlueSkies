function ViewModel() {
    var self = this;

    self.windDirection = ko.observable(Math.random() * Math.PI * 2);
    self.windSpeed = ko.observable(5 + Math.random() * 2 - 1);

    self.selectedLandingDirection = ko.observable(0);
    self.landIntoWind = ko.observable(true);
    self.landingDirection = ko.computed(function() {
        return self.landIntoWind() ? normalizeAngle(self.windDirection() + Math.PI) : self.selectedLandingDirection();
    });
}

var viewModel = new ViewModel();
ko.applyBindings(viewModel);
