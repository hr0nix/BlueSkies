ko.bindingHandlers.rotate = {
    update: function(element, valueAccessor) {
        rotateDiv($(element).get(0), ko.unwrap(valueAccessor()));
    }
};

/// Visibility bindings
ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        var shouldDisplay = valueAccessor();
        $(element).toggle(shouldDisplay);
    },
    update: function(element, valueAccessor) {
        var shouldDisplay = valueAccessor();
        shouldDisplay ? $(element).fadeIn() : $(element).fadeOut();
    } 
};

ko.bindingHandlers.slideVisible = {
    init: function(element, valueAccessor) {
        var shouldDisplay = valueAccessor();
        $(element).toggle(shouldDisplay);
    },
    update: function(element, valueAccessor) {
        var shouldDisplay = valueAccessor();
        shouldDisplay ? $(element).slideDown() : $(element).slideUp();
    } 
};

/// jQueury UI bindings
ko.bindingHandlers.jqSlider = {
    init: function(element, valueAccessor, allBindings) {
        $(element)
            .slider(allBindings.get('sliderOptions'))
            .on('slide', function(event, ui) {
                valueAccessor()(ui.value);
            })
            .find(".ui-slider-handle").unbind('keydown');
    },
    update: function(element, valueAccessor) {
        $(element).slider("value", ko.unwrap(valueAccessor()));
    }
};

ko.bindingHandlers.jqButtonset = {
    init: function(element, valueAccessor) {
        $(element).buttonset()
            .find('span.ui-button-text')
                .addClass('no-padding');
    },
    update: function(element, valueAccessor) {
        $(element).buttonset('refresh');
    }
}

/// Google maps api bindings

/// Presentation bindings
ko.bindingHandlers.setLanguage = {
    init: function(element, valueAccessor) {
        var language = ko.unwrap(valueAccessor());
        setLanguage(element, language);
    },
    update: function(element, valueAccessor) {
        var language = ko.unwrap(valueAccessor());
        setLanguage(element, language);
    }
};
