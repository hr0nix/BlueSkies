/// Different custom bindings

(function() {
var rotateDiv = function(div, angle) {
    var style = "rotate(" + angle + "deg)";

    div.style.webkitTransform = style;
    div.style.mozTransform = style;
    div.style.msTransform = style;
    div.style.oTransform = style;
    div.style.transform = style;
};

ko.bindingHandlers.rotate = {
    update: function(element, valueAccessor) {
        rotateDiv($(element).get(0), ko.unwrap(valueAccessor()));
    }
};
})();

ko.bindingHandlers.ruler = {
    update: function(element, valueAccessor) {
        var $element = $(element),
            max = ko.unwrap(valueAccessor()),

            prevOffset = 0;

        $element.children("li").each(function() {
            var $this = $(this),
                value = Number($this.text()),
                offset = Math.round(value / max * 100);
            $this.css("padding-left", (offset - prevOffset) + "%");
            prevOffset = offset;
        });
    }
};

/// Visibility bindings
ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        var shouldDisplay = ko.unwrap(valueAccessor());
        $(element).toggle(shouldDisplay);
    },
    update: function(element, valueAccessor) {
        var shouldDisplay = ko.unwrap(valueAccessor());
        shouldDisplay ? $(element).fadeIn() : $(element).fadeOut();
    }
};

ko.bindingHandlers.slideVisible = {
    init: function(element, valueAccessor) {
        var shouldDisplay = ko.unwrap(valueAccessor());
        $(element).toggle(shouldDisplay);
    },
    update: function(element, valueAccessor) {
        var shouldDisplay = ko.unwrap(valueAccessor());
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
    init: function(element, valueAccessor, allBindings) {
        $(element).buttonset();
        if (allBindings.get('no_padding')) {
            $(element)
                .find('span.ui-button-text')
                    .addClass('no-padding');
        }
    },
    update: function(element, valueAccessor) {
        $(element).buttonset('refresh');
    }
};

ko.bindingHandlers.jqProgressbar = {
    init: function(element, valueAccessor) {
        $(element).progressbar();
    },
    update: function(element, valueAccessor) {
        $(element).progressbar(ko.unwrap(valueAccessor()));
    }
};

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

/// Google maps binding helpers
function bindMarkerPosition(marker, observable) {
    google.maps.event.addListener(marker, 'drag', function() {
        observable(marker.getPosition());
    });

    observable.subscribe(function(newValue) {
        if (newValue !== marker.getPosition()) {
            marker.setPosition(newValue);
        }
    });
}

function bindIcon(marker, observable) {
    observable.subscribe(function(newValue) {
        marker.setIcon(newValue);
    });
}

function bindVisibility(object, observable) {
    observable.subscribe(function(newValue) {
        object.setVisible(newValue);
    });
}

function bindPolyline(poly, observable) {
    observable.subscribe(function(newValue) {
        poly.setPath(newValue);
    });
}

function bindCircles(circles, observable) {
    observable.subscribe(function(newValue) {
        for (var i = 0; i < circles.length; i++) {
            if (!newValue) {
                circles[i].setVisible(false);
            } else {
                circles[i].setVisible(true);
                circles[i].setCenter(newValue[i].center);
                circles[i].setRadius(newValue[i].radius);
            }
        }
    });

    observable(); // Evaluate it now to catch further updates
}
