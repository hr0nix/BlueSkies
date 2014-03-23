(function() {
var what = [
        sim.location.custom.coordsJS,
        sim.location.custom.name,
        sim.location.id
    ],
    where = 'article';

window.saveArticleSettings = function () {
    sim.persistence.save(what, where);
};

window.loadArticleSettings = function () {
    sim.persistence.load(what, where);
};

loadArticleSettings();

function NavigationViewModel() {
    var self = this;
    self.pages = [
        ['dz-select.html', 'Find your DZ'],
        ['control.html', 'Control set']
    ].map(function (element) {
        return { url: element[0], title: element[1] };
    });

    self.skipCurrent = function(url) {
        var url = ko.unwrap(url);
        if (url !== window.location.pathname.split('/').pop()) {
            return url;
        } else {
            return null;
        }
    }
}

ko.applyBindings(new NavigationViewModel());
})();
