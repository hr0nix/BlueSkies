"use strict";
// Time
var updateInterval = 20.0,
    headingUpdateSpeed = Math.PI / 4, // Radians __per second__
    canopyModeUpdateSpeed = 0.05, // Mode units __per keydown event__
    pressedKeys = {}; // Monitor which keys are pressed. To provide good control response.

////// Settings
var defaultMapZoom = 15,
    minMapZoom = 12,
    maxMapZoom = 18;

////// State
var prevUpdateTime;

////// Constants
var eps = 1e-03, // Mostly used to compare altitude to zero
    altitudeProgressbarMax = 500,
    headingSliderOptions = { min: 0, max: Math.PI * 2, step: Math.PI / 180 * 5 },
    mapOptions = {
        zoom: defaultMapZoom,
        minZoom: minMapZoom,
        maxZoom: maxMapZoom,
        streetViewControl: false,
        keyboardShortcuts: false,
        mapTypeId: google.maps.MapTypeId.SATELLITE
    };

////// UI objects
var map;

////// Helpers

// Get query string, from http://stackoverflow.com/a/979995/193903
function getQueryString() {
    var query_string = {},
        query = window.location.search.substring(1),
        vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = pair[1];
        // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [ query_string[pair[0]], pair[1] ];
            query_string[pair[0]] = arr;
        // If third or later entry with this name
        } else {
            query_string[pair[0]].push(pair[1]);
        }
    }

    return query_string;
}

function setCustomDz(name, latlng) {
    sim.location.custom.name(name);
    sim.location.custom.coords(latlng);
    sim.location.id("custom");
}

function defaultIfUndefined(x, def) {
    return (typeof x === 'undefined') ? def : x;
}

function getFullPath(location) {
    return location.protocol + '//' + location.host + location.pathname;
}

function generateGETForLocation() {
    var result = "?";
    if (sim.location.id() != "custom") {
        result += "dz=" + sim.location.id();
    } else {
        var latlng = sim.location.custom.coords();
        result += "lat=" + latlng.lat() + "&lng=" + latlng.lng();
    }

    if (sim.shareLocation.wind()) {
        result += "&wind.direction=" + radToDeg(reportedWindDirection(sim.wind.direction())) +
            "&wind.speed=" + sim.wind.speed();
    }

    if (sim.shareLocation.pattern()) {
        result += "&pattern=" + sim.display.pattern();
        if (!sim.pattern.intoWind()) {
            result += "&landingDirection=" + radToDeg(sim.pattern.landingDirection());
        }
    }

    if (sim.shareLocation.language()) {
        result += '&lang=' + sim.display.language();
    }

    return result;
}

////// Event handlers

function onKeyDown(e) {
    if (37 <= e.which && e.which <= 40) {
        e.preventDefault(); // Disable page scrolling with arrows
        pressedKeys[e.which] = true;
    }

    if (sim.simulation.flying()) {
        if (e.which == $.ui.keyCode.UP) {
            sim.canopy.modeChange(+canopyModeUpdateSpeed);
        } else if (e.which == $.ui.keyCode.DOWN) {
            sim.canopy.modeChange(-canopyModeUpdateSpeed);
        }
    }
}

function onKeyUp(e) {
    if (37 <= e.which && e.which <= 40) {
        e.preventDefault(); // Disable page scrolling with arrows
        pressedKeys[e.which] = false;
    }

    if (String.fromCharCode(e.which) == "P") {
        sim.simulation.togglePause();
    }
}

function onTimeTick() {
    if (sim.simulation.flying()) {
        var currentUpdateTime = new Date().getTime(),
            dt = (currentUpdateTime - prevUpdateTime) / 1000.0;
        prevUpdateTime = currentUpdateTime;

        if (pressedKeys[$.ui.keyCode.LEFT]) {
            sim.canopy.steeringInput(-headingUpdateSpeed * dt);
        } else if (pressedKeys[$.ui.keyCode.RIGHT]) {
            sim.canopy.steeringInput(+headingUpdateSpeed * dt);
        }

        dt *= sim.simulation.speed(); // Only do it here because we don't want the responsiveness to be affected by the simulationSpeed, only the descent. Or do we?
        dt = Math.min(dt, sim.canopy.altitude() / sim.canopy.speedV()); // We don't want to go below ground

        sim.canopy.descend(dt);

        if (!sim.simulation.flying()) {
            var distance = google.maps.geometry.spherical.computeDistanceBetween(sim.canopy.location(), sim.location.coords());
            ga('send', 'event', 'simulation', 'finished');
            ga('send', 'event', 'simulation', 'finished', 'distance', Math.floor(distance));
            ga('send', 'event', 'simulation', 'finished', 'angle-into-wind', Math.floor(radToDeg(normalizeAngle(Math.abs(sim.canopy.heading() - normalizeAngle(sim.wind.direction() - Math.PI))))));
        }
    }
}

function onShareLinkClick() {
    var shareDialogOptions = {
        title: localize("Share a link"),
        autoOpen: true,
        minHeight: 0,
        modal: true,
        width: "auto",
        show: "fade",
        hide: "fade",
        position: {
            of: "#dz-finder",
            my: "center top",
            at: "center bottom+10"
        },
        buttons: {
            "Ok": function() { $(this).dialog("close") }
        }
    };
    $("#share-dialog")
        .dialog(shareDialogOptions)
        .children("input:last-of-type")
        .on('focus', function() { this.select(); });
}

function onMapRightClick(event) {
    if (!sim.parameters.startable()) {
        return;
    }
    sim.simulation.start(event.latLng);
    prevUpdateTime = new Date().getTime();

    if (isDialogOpen("#tutor-rightclick")) {
        $("#tutor-rightclick").dialog("close");
    }
}

function onDzMenuItemSelected(event, ui) {
    event.preventDefault();
    var dzid = ui.item.data('dz-id');
    if (dzid) {
        ga('send', 'event', 'dz', 'selected', dzid);
        sim.location.id(dzid);
    }
}

function onFindNewDz() {
    var place = this.getPlace();
    if (!place.geometry) {
        ga('send', 'event', 'dz', 'autocomplete', 'failed');
        return;
    }

    ga('send', 'event', 'dz', 'autocomplete', 'success');
    setCustomDz(place.formatted_address, place.geometry.location);
}

////// Initialization
function parseParameters(sim) {
    var queryString = getQueryString(),

        lat = queryString.lat,
        lng = queryString.lng,
        windDirection = queryString['wind.direction'],
        landingDirection = queryString['landingDirection'],

        viewModelMap = {
            dz: sim.location.id,
            lang: sim.display.language,
            'wind.speed': sim.wind.speed,

            'debug':                sim.debug.on,
            'cheat':                sim.debug.cheats,
            'pattern':              sim.display.pattern,
            'startable':            sim.parameters.startable,
            'display.steadyPoint':  sim.display.steadyPoint,
            'display.reachset':     sim.display.reachset,
            'display.controlset':   sim.display.controlset,
            'display.fullscreen':   sim.display.fullscreen,

            'simulation.speed':     sim.simulation.speed,
            'canopy.location':      sim.canopy.location,
            'canopy.altitude':      sim.canopy.altitude,
            'canopy.heading':       sim.canopy.heading,
            'canopy.mode':          sim.canopy.mode,

            'map.center':           sim.map.center,
            'map.zoom':             sim.map.zoom,

            'pattern.openingAltitude': sim.pattern.openingAltitude
        };

    if (lat && lng) {
        var latlng = new google.maps.LatLng(lat, lng);
        setCustomDz("", latlng);
    }

    if (windDirection) {
        sim.wind.direction(reportedWindDirection(degToRad(windDirection)));
    }

    if (landingDirection) {
        sim.pattern.selectedLandingDirection(degToRad(landingDirection));
        sim.pattern.intoWind(false);
    }

    for (var i in viewModelMap) {
        var value = queryString[i];

        if (!value) {
            continue;
        }
        var tryparse = parseInt(value);
        if (!isNaN(tryparse)) {
            value = tryparse;
        }

        viewModelMap[i](value);
    }
}

function showLegendDialog(id) {
    var options = {
        title: localize("Legend"),
        autoOpen: true,
        resizable: true,
        draggable: true,
        minHeight: 0,
        modal: false,
        width: "35em",
        show: "fade",
        hide: "fade",
        position: {
            of: "#map-canvas",
            my: "left bottom",
            at: "left+50 bottom-50"
        }
    };
    $(id).dialog(options);
}

function showAboutDialog(id) {
    var $id = $(id);
    if ($id.children().size() == 0) {
        $('<iframe>', {src: "about.html"}).appendTo($id);
    }
    var options = {
        title: localize("About"), // Only localized on startup, oops. The same happens to tutor anyway.
        resizable: true,
        draggable: true,
        modal: false,
        width: "50%",
        height: $(window).height() * 0.7,
        show: "fade",
        hide: "fade",
        position: {
            of: "#map-canvas"
        }
    };
    $id.dialog(options);
}

function initLandingPattern() {
    var landingPatternLine = new google.maps.Polyline({
        map: map,
        geodesic: false,
        strokeColor: '#00FFFF',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        zIndex: 1,
        path: sim.pattern.points()
    });

    bindVisibility(landingPatternLine, sim.pattern.show);
    bindPolyline(landingPatternLine, sim.pattern.points);
}

function initDzMarker() {
    var options = {
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            strokeColor: 'yellow',
            scale: 8
        },
        position: sim.location.coords(),
        draggable: true,
        map: map,
        zIndex: 2
    };

    var dzMarker = new google.maps.Marker(options);
    bindMarkerPosition(dzMarker, sim.location.coords);

    google.maps.event.addListener(dzMarker, 'drag', function() {
        if (sim.location.id() == 'custom') {
            sim.location.custom.coords(dzMarker.getPosition());
        }
    });
}

function initSteadyPointMarker() {
    var options = {
        visible: sim.display.steadyPoint(),
        position: sim.analytics.steadyPoint(),
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: '#FF00FF',
            fillOpacity: 1,
            strokeWeight: 0
        },
        zIndex: 3
    };
    var steadyPointMarker = new google.maps.Marker(options);

    bindVisibility(steadyPointMarker, sim.display.steadyPoint);
    bindMarkerPosition(steadyPointMarker, sim.analytics.steadyPoint);
}

function createCanopyMarkerIcon(canopyHeading, mapHeading) {
    return {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#FF0000',
        fillOpacity: 1,
        strokeWeight: 2,
        rotation: radToDeg(canopyHeading) - defaultIfUndefined(mapHeading, 0)
    };
}

function initCanopyMarker() {
    var options = {
        map: map,
        icon: sim.canopy.icon(),
        draggable: !!sim.debug.cheats(),
        zIndex: 4
    };
    var canopyMarker = new google.maps.Marker(options);
    bindMarkerPosition(canopyMarker, sim.canopy.location);
    bindIcon(canopyMarker, sim.canopy.icon);
}

function initReachSets() {
    function createReachSetCircles(color) {
        var circles = [];
        for (var i = 0; i < lastReachSetSteps; i++) {
            var circleOptions = {
                strokeColor: color,
                strokeOpacity: 0.0,
                fillColor: color,
                fillOpacity: 0.15,
                map: map,
                zIndex: 0
            };
            var circle = new google.maps.Circle(circleOptions);
            circles.push(circle);
            google.maps.event.addListener(circle, "rightclick", onMapRightClick);
        }

        return circles;
    }

    bindCircles(createReachSetCircles('#FF0000'), sim.analytics.reachSet);
    bindCircles(createReachSetCircles('#0000FF'), sim.analytics.controlSet);
}

function initializeAnalyticsEvents() {
    $(".legend-button").click(function() {
        ga('send', 'event', 'button', 'click', 'legend');
    });

    google.maps.event.addListener(map, "rightclick", function() {
        ga('send', 'event', 'simulation', 'started');
        ga('send', 'event', 'simulation', 'started', 'altitude', sim.pattern.openingAltitude());
    });

    $("input").change(function() {
        ga('send', 'event', 'button', 'click', $(this).attr("id"));
    });
}

function initialize() {
    initLandingPattern();
    initDzMarker();
    initSteadyPointMarker();
    initCanopyMarker();
    initReachSets();

    google.maps.event.addListener(map, "rightclick", onMapRightClick);
    $(document)
        .keydown(onKeyDown)
        .keyup(onKeyUp);
    window.setInterval(onTimeTick, updateInterval);

    initializeAnalyticsEvents();
}

$(document).ready(initialize);
