(function() {
var what = [
        viewModel.location.custom.coordsJS,
        viewModel.location.custom.name
    ],
    where = 'article';

window.saveArticleSettings = function () {
    viewModel.persistence.save(what, where);
};

window.loadArticleSettings = function () {
    viewModel.persistence.load(what, where);
    viewModel.location.id('custom');
};

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

ko.applyBindings(new NavigationViewModel(), $('nav').get(0));
})();
