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

    self.current = (function() {
        for (var i = 0; i < self.pages.length; i++) {
            var currentPage = window.location.pathname.split('/').pop()
            if (self.pages[i].url === currentPage) {
                return i;
            }
        }

        throw "Unknown page";
    })();

    self.isLastPage = self.current == self.pages.length - 1;
    self.currentPage = self.pages[self.current];
    self.nextPage = self.isLastPage ? null : self.pages[self.current + 1];
}

ko.applyBindings(new NavigationViewModel());
})();
