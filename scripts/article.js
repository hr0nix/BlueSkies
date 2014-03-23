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
})();
