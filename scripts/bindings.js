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

ko.bindingHandlers.currentDz = {
    update: function(element, valueAccessor) {
        var id = "#dz-" + ko.unwrap(valueAccessor());
        $(element)
            .find('li')
                .removeClass('current-dz')
                .end()
            .find(id)
                .addClass('current-dz');
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
    }
};

ko.bindingHandlers.jqButton = {
    init: function(element, valueAccessor) {
        $(element).button().click(ko.unwrap(valueAccessor()));
    }
};

ko.bindingHandlers.jqChecked = {
    after: ko.bindingHandlers.checked.after,
    init: ko.bindingHandlers.checked.init,
    update: function(element, valueAccessor) {
        ko.unwrap(valueAccessor()); // We call this to depend on value so the update function is called again
        if (ko.bindingHandlers.checked.update) {
            ko.bindingHandlers.checked.update(element, valueAccessor);
        }
        $(element).parent().buttonset('refresh');
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
    update: function(element, valueAccessor) {
        var language = ko.unwrap(valueAccessor());
        setLanguage(element, language);
    }
};

/// Google maps bindings
ko.bindingHandlers.Map = {
    init: function(element, valueAccessor) {
        var options = ko.unwrap(valueAccessor());
        // setting a global here
        map = new google.maps.Map(element, options.options);
        bindMapZoom(map, options.zoom);
        bindMapCenter(map, options.center);
        bindMapHeading(map, options.heading);
    }
};

ko.bindingHandlers.mapControl = {
    init: function(element, valueAccessor) {
        var position = ko.unwrap(valueAccessor());
        map.controls[google.maps.ControlPosition[position]].push(element);
    }
};

ko.bindingHandlers.mapFinder = {
    init: function(element, valueAccessor) {
        var dzFinderAutocomplete = new google.maps.places.Autocomplete(element);
        google.maps.event.addListener(dzFinderAutocomplete, 'place_changed', ko.unwrap(valueAccessor()));
    }
};

/// Google maps binding helpers
function bindMapCenter(map, observable) {
    map.setCenter(observable());
    observable.subscribe(function(newValue) {
        map.setCenter(newValue);
    });
}

function bindMapZoom(map, observable) {
    map.setZoom(observable());
    observable.subscribe(function(newValue) {
        map.setZoom(newValue);
    });

    google.maps.event.addListener(map, 'zoom_changed', function() {
        observable(map.getZoom());
    });
}

function bindMapHeading(map, observable) {
    google.maps.event.addListener(map, 'heading_changed', function() {
        observable(map.getHeading());
    });
}

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
