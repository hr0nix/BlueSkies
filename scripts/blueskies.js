////// Parameters

// Canopy modes
var horizontalSpeeds = [0, 2.5, 5, 7.5, 10],
    verticalSpeeds = [10, 7, 5, 3, 5],
    reachSetSteps = (horizontalSpeeds.length - 1) * 2 + 1, // we need this kind of step to make sure that during interpolations into the above arrays we get the exact hits
    lastReachSetSteps = 3; // Experiments show that only the faster modes are efficient enough to be on the edge of reachability sets, so we only compute and draw those

// Dropzones
var dropzones = {
        "dz-uk-sibson" : new google.maps.LatLng(52.560706, -0.395692),
        "dz-uk-chatteris" :  new google.maps.LatLng(52.48866, 0.086044),
        "dz-ru-puschino" : new google.maps.LatLng(54.790046, 37.642547),
        "dz-ru-kolomna" : new google.maps.LatLng(55.091914, 38.917231),
        "dz-ru-vatulino" : new google.maps.LatLng(55.663505, 36.142181),
        "dz-other-dubai" : new google.maps.LatLng(25.090282, 55.135681),
        "dz-other-red-square": new google.maps.LatLng(55.754216, 37.620083),
        "dz-other-statue-of-liberty": new google.maps.LatLng(40.690531, -74.04575),
        "dz-custom" : readSetting("custom-dz-location", null, unpackLatLng)
    },
    lastCustomDzName = readSetting("custom-dz-name", "");

// Time
var updateFrequency = 20.0,
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
    headingSliderOptions = { min: 0, max: Math.PI * 2, step: Math.PI / 180 * 5 };

////// UI objects
var map,
    canopyMarker,
    steadyPointMarker,
    landingPatternLine,

    reachabilitySetObjects = [],
    controllabilitySetObjects = [],

    dzFinderAutocomplete;

////// Persistence code
function readSetting(key, def, converter) {
    var converters = {
        'string': String,
        'number': Number,
        'boolean': parseBoolean
    };
    return defaultIfUndefined($.cookie(key, converter || converters[typeof def]), def);
}

function saveSetting(key, value) {
    var cookieOptions = {
        expires: 10
    };
    $.cookie(key, value, cookieOptions);
}

function wipeCookies() {
    var cookies = document.cookie.split(";");
    for (var i = 0; i < cookies.length; i++) {
        var equals = cookies[i].indexOf("="),
            name = equals > -1 ? cookies[i].substr(0, equals) : cookies[i];
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}

function packLatLng(latlng) {
    return JSON.stringify([latlng.lat(), latlng.lng()]);
}

function unpackLatLng(string) {
    var latlng = JSON.parse(string);
    return new google.maps.LatLng(latlng[0], latlng[1]);
}

////// Localization for javascript

var enResources = {
        "ms": "m/s",
        "paused": "(paused)",
        "accuracy trick": "Accuracy trick: you'll land there",
        "controlset": "Points you can reach the landing target from (at the current altitude)",
        "reachset": "The area on the ground still reachable from the current position",
        "share-link": "Get link to current location"
    },
    ruResources = {
        "ms": "м/с",
        "mph": "миль/ч",
        "m": "м",
        "ft": "футов",
        "paused": "", // too long anyway :)
        "Choose another landing area": "Выберите другую площадку приземления",
        "Legend": "Легенда",
        "Got it!": "Дальше",
        "Skip tutor": "Пропустить введение",
        "Share a link": "Ссылка сюда",
        "accuracy trick": "Точка приземления",
        "controlset": "КВК: из каких точек все еще можно попасть в цель (с текущей высоты)",
        "reachset": "Точки на земле, в которые еще можно попасть из текущего положения",
        "share-link": "Получить ссылку на текущую точку"
    },
    langResources = {
        "en": enResources,
        "ru": ruResources
    };

function localize(id) {
    return defaultIfUndefined(langResources[viewModel.display.language()][id], id);
}

function setLanguage(element, language) {
    if (!langResources[language]) {
        return;
    }

    for (var lang in langResources) {
        $(element).find(":lang(" + lang + ")").toggle(lang == language);
    }

    if (isDialogOpen("#legend-dialog")) {
        showLegendDialog("#legend-dialog");
    }

    var $rightclick = $("#tutor-rightclick");
    if (isDialogOpen("#tutor-rightclick")) {
        $rightclick.dialog("option", "position", $rightclick.dialog("option", "position"));
    }
}

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

function degToRad(deg) {
    return deg * Math.PI / 180;
}

function radToDeg(rad) {
    return rad * 180 / Math.PI;
}

function normalizeAngle(angle) {
    while (angle > 2 * Math.PI) {
        angle -= 2 * Math.PI;
    }
    while (angle < 0) {
        angle += 2 * Math.PI;
    }
    return angle;
}

function reportedWindDirection(direction) {
    return normalizeAngle(direction + Math.PI);
}

function moveCoords(coords, dx, dy) {
    var earthRadius = 6378137,
        newLat = coords.lat() + radToDeg(dy / earthRadius),
        newLng = coords.lng() + radToDeg((dx / earthRadius) / Math.cos(degToRad(coords.lat())));
    return new google.maps.LatLng(newLat, newLng);
}

function moveInWind(coords, windSpeed, windDirection, speed, direction, time) {
    var dx = speed * Math.sin(direction) + windSpeed * Math.sin(windDirection),
        dy = speed * Math.cos(direction) + windSpeed * Math.cos(windDirection);
    return moveCoords(coords, dx * time, dy * time);
}

function rotateDiv(div, angle) {
    var style = "rotate(" + angle + "deg)";

    div.style.webkitTransform = style;
    div.style.mozTransform = style;
    div.style.msTransform = style;
    div.style.oTransform = style;
    div.style.transform = style;
}

function interpolate(arr, coeff) {
    if (coeff <= 0) {
        return arr[0];
    }

    if (coeff >= 1) {
        return arr[arr.length - 1];
    }

    scaledCoeff = coeff * (arr.length - 1);
    index1 = Math.floor(scaledCoeff);
    index2 = Math.ceil(scaledCoeff);
    mixCoeff = scaledCoeff - index1;
    return arr[index1] * (1 - mixCoeff) + arr[index2] * mixCoeff;
}

function getCanopyHorizontalSpeed(mode) {
    return interpolate(horizontalSpeeds, mode);
}

function getCanopyVerticalSpeed(mode) {
    return interpolate(verticalSpeeds, mode);
}

function getCurrentLandingPoint() {
    return viewModel.location.coords();
}

// returns: canopy heading necessary to maintain desiredTrack ground track in given winds (not always possible, of course)
// Simple vector addition: wind + canopySpeed = groundTrack
//
//                              .>desiredTrack
//                            .
//                          .*
//                    beta. /
//                      .  /
//                    .   /H      Sine theorem:
//                  .    /d
//                .     /e        windSpeed       speedH
//              .      /e         ---------  =  -----------
//            .       /p          sin beta       sin alpha
//          .        /s
//        .         /               gamma = alpha + beta -- gamma is the external angle.
//      . alpha    /gamma
// ----*----------*--------------------->windDirection
//     |windSpeed |
function createGroundTrack(windSpeed, windDirection, speedH, desiredTrack) {
    var alpha = windDirection - desiredTrack,
        beta = Math.asin(windSpeed * Math.sin(alpha) / speedH),
        gamma = alpha + beta;
    return windDirection - gamma; // == desiredTrack + beta, but the code appears more straightforward that way.
}

function reachSet(windSpeed, windDirection, altitude, u) {
    var speedH = getCanopyHorizontalSpeed(u),
        speedV = getCanopyVerticalSpeed(u),
        time = altitude / speedV;
    return {
        c: [time * windSpeed * Math.sin(windDirection), time * windSpeed * Math.cos(windDirection)],
        radius: time * speedH
    };
}

function computeReachSet(objects, sourceLocation, altitude, reachability) {
    // Note that in the interface we forbid the stall mode. But still, in most cases it doesn't lead to the edge of the reach set
    for (var i = reachSetSteps - lastReachSetSteps; i < reachSetSteps; i++) {
        var u = 1 / (reachSetSteps - 1) * i,
            set = reachSet(viewModel.wind.speed(), viewModel.wind.direction(), viewModel.canopy.altitude(), u),
            shiftFactor = reachability ? 1 : -1; // for reachability we shift downwind, for controllability -- upwind

        objects[i].setCenter(moveCoords(sourceLocation, shiftFactor * set.c[0], shiftFactor * set.c[1]));
        objects[i].setRadius(set.radius);
    }
}

function updateReachSetVisibility(objects, visible) {
    for (var i = 0; i < objects.length; i++) {
        objects[i].setVisible(visible);
    }
}

function updateReachabilitySet() {
    updateReachSetVisibility(reachabilitySetObjects, showReachabilitySet);

    if (showReachabilitySet && viewModel.simulation.started()) {
        computeReachSet(reachabilitySetObjects, viewModel.canopy.location(), viewModel.canopy.altidude(), true);
    }
}

function updateControllabilitySet() {
    updateReachSetVisibility(controllabilitySetObjects, viewModel.display.controlset());

    if (viewModel.display.controlset()) {
        computeReachSet(controllabilitySetObjects, getCurrentLandingPoint(), viewModel.reachSetAltitude, false);
    }
}

function computeLandingPattern(location, wind, pattern) {
    var controlPointAltitudes = [100, 200, 300],
        patternMode = 0.85,
        speedH = getCanopyHorizontalSpeed(patternMode),
        speedV = getCanopyVerticalSpeed(patternMode),
        rotationFactor = pattern.lhs() ? 1 : -1,

        timeToPoint1 = controlPointAltitudes[0] / speedV,
        timeToPoint2 = (controlPointAltitudes[1] - controlPointAltitudes[0]) / speedV,
        timeToPoint3 = (controlPointAltitudes[2] - controlPointAltitudes[1]) / speedV,

        heading,

        windSpeed = wind.speed(),
        windDirection = wind.direction(),
        landingDirection = pattern.landingDirection();

    // For now, strong winds imply into-the wind landing no matter what landing direction is given. This needs further thought.
    heading = windSpeed() < speedH ?
        createGroundTrack(windSpeed, windDirection, speedH, landingDirection):
        Math.PI + windDirection; // Into the wind

    var point1 = moveInWind(location, windSpeed, windDirection, speedH, heading, -timeToPoint1); // Note that we specify the wind speed and canopy heading as though we're flying the pattern. But we give negative time, so we get the point where we need to start to arrive where we need.

    heading = windSpeed < speedH ?
        createGroundTrack(windSpeed, windDirection, speedH, landingDirection + rotationFactor * Math.PI / 2): // In ordinary winds we hold perpendicular ground track
        Math.PI + windDirection + rotationFactor * Math.PI / 8; // in strong winds we move backwards with some arbitrary low angle to the wind

    var point2 = moveInWind(point1, windSpeed, windDirection, speedH, heading, -timeToPoint2);

    heading = windSpeed < speedH ?
        createGroundTrack(windSpeed, windDirection, speedH, landingDirection + Math.PI):
        Math.PI + windDirection; // Into the wind
    var point3 = moveInWind(point2, windSpeed, windDirection, speedH, heading, -timeToPoint3);

    return [point3, point2, point1, location];
}

function createCanopyMarkerIcon(canopyHeading) {
    return {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#FF0000',
        fillOpacity: 1,
        strokeWeight: 2,
        rotation: radToDeg(canopyHeading) - defaultIfUndefined(map.getHeading(), 0)
    };
}

function metersToFeet(meters) {
    return meters * 3.2808399;
}

function metersPerSecToMilesPerHour(metersPerSec) {
    return metersPerSec * 2.23693629;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getLandingDirection() {
    return viewModel.pattern.landingDirection();
}

function useMetricSystem() {
    return viewModel.display.unitSystem() === "metric";
}

function formatSpeed(metersPerSec, significantDigits) {
    significantDigits = significantDigits || 0;
    return useMetricSystem()
        ? $.number(metersPerSec, significantDigits) + " " + localize("ms")
        : $.number(metersPerSecToMilesPerHour(metersPerSec), significantDigits) + " " + localize("mph");
}

function formatAltitude(meters, significantDigits) {
    significantDigits = significantDigits || 0;
    return useMetricSystem()
        ? $.number(meters, significantDigits) + " " + localize("m")
        : $.number(metersToFeet(meters), significantDigits) + " " + localize("ft");
}

function formatHeading(angle, significantDigits) {
    significantDigits = significantDigits || 0;
    return $.number(radToDeg(angle), significantDigits) + "&deg;";
}

function formatSimulationSpeed(speed, significantDigits) {
    significantDigits = significantDigits || 1;
    return $.number(speed, significantDigits) + "x" + (speed == 0 ? " " + localize("paused") : "");
}

function setDz(dz) {
    if (!dropzones[dz]) {
        return;
    }

    $("#dz-finder").val(dz == "dz-custom" ? lastCustomDzName : "");

    viewModel.location.id(dz);
    $('#selected-dz').html($('#' + viewModel.location.id() + "> a").html());
    map.setCenter(dropzones[viewModel.location.id()]);
    map.setZoom(defaultMapZoom);
}

function setCustomDz(name, latlng) {
    dropzones["dz-custom"] = latlng;
    lastCustomDzName = name;
    setDz("dz-custom");

    saveSetting("custom-dz-name", lastCustomDzName);
    saveSetting("custom-dz-location", packLatLng(latlng));

    $("#dz-custom").show();
}

function defaultIfUndefined(x, def) {
    return (typeof x === 'undefined') ? def : x;
}

function parseBoolean(str) {
    return str == "true";
}

function isDialogOpen(id) {
    var $id = $(id);
    return $id.data("ui-dialog") && $id.dialog("isOpen");
}

function getFullPath(location) {
    return location.protocol + '//' + location.host + location.pathname;
}

function generateGETForLocation() {
    var result = "?";
    if (viewModel.location.id() != "dz-custom") {
        result += "dz=" + viewModel.location.id().replace("dz-","");
    } else {
        var latlng = dropzones["dz-custom"];
        result += "lat=" + latlng.lat() + "&lng=" + latlng.lng();
    }

    return result;
}

////// UI update logic

function updateCanopyControls() {
    canopyMarker.setPosition(viewModel.canopy.location());
    canopyMarker.setIcon(createCanopyMarkerIcon(viewModel.canopy.heading()));
    steadyPointMarker.setPosition(viewModel.steadyPoint());

    updateReachabilitySet();
    updateControllabilitySet();
}

function updateLandingPattern() {
//    landingPatternLine.setPath(computeLandingPattern(getCurrentLandingPoint(), getLandingDirection()));

    updateControllabilitySet();
}

////// Event handlers

function onKeyDown(e) {
    if (37 <= e.which && e.which <= 40) {
        e.preventDefault(); // Disable page scrolling with arrows
        pressedKeys[e.which] = true;
    }

    if (viewModel.simulation.flying()) {
        if (e.which == $.ui.keyCode.UP) {
            viewModel.canopy.modeChange(+canopyModeUpdateSpeed);
        } else if (e.which == $.ui.keyCode.DOWN) {
            viewModel.canopy.modeChange(-canopyModeUpdateSpeed);
        }
    }

}

function onKeyUp(e) {
    if (37 <= e.which && e.which <= 40) {
        e.preventDefault(); // Disable page scrolling with arrows
        pressedKeys[e.which] = false;
    }

    if (String.fromCharCode(e.which) == "P") {
        viewModel.simulation.togglePause();
    }
}

function onShareLinkClick() {
    var shareDialogOptions = {
        title: localize("Share a link"),
        autoOpen: true,
        resizable: true,
        draggable: true,
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
        .children("input")
            .val(getFullPath(window.location) + generateGETForLocation())
            .focus()
            .get(0)
                .select();
}

function onMapRightClick(event) {
    viewModel.startSimulation(event.latLng);
    prevUpdateTime = new Date().getTime();

    $("#tutor-rightclick").dialog("close");

    if (!viewModel.simulation.started()) {
        initializeCanopyImage();
    }
}

function onLandingSpotPositionChanged() {
    if (viewModel.location.id() == "dz-custom") {
        dropzones["dz-custom"] = getCurrentLandingPoint();
        saveSetting("custom-dz-location", packLatLng(dropzones["dz-custom"]));
    }
}

function onTimeTick() {
    if (viewModel.simulation.flying()) {
        var currentUpdateTime = new Date().getTime(),
            dt = (currentUpdateTime - prevUpdateTime) / 1000.0;
        prevUpdateTime = currentUpdateTime;

        if (pressedKeys[$.ui.keyCode.LEFT]) {
            viewModel.canopy.steeringInput(-headingUpdateSpeed * dt);
        } else if (pressedKeys[$.ui.keyCode.RIGHT]) {
            viewModel.canopy.steeringInput(+headingUpdateSpeed * dt);
        }

        dt *= viewModel.simulation.speed(); // Only do it here because we don't want the responsiveness to be affected by the simulationSpeed, only the descent. Or do we?
        dt = Math.min(dt, viewModel.canopy.altitude() / viewModel.canopy.speedV()); // We don't want to go below ground

        viewModel.canopy.descend(dt);

        if (!viewModel.simulation.flying()) {
            var distance = google.maps.geometry.spherical.computeDistanceBetween(viewModel.canopy.location(), getCurrentLandingPoint());
            ga('send', 'event', 'simulation', 'finished');
            ga('send', 'event', 'simulation', 'finished', 'distance', Math.floor(distance));
            ga('send', 'event', 'simulation', 'finished', 'angle-into-wind', Math.floor(radToDeg(normalizeAngle(Math.abs(viewModel.canopy.heading() - normalizeAngle(viewModel.wind.direction() - Math.PI))))));
        }
    }
}

function onDzMenuItemSelected(event, ui) {
    ga('send', 'event', 'dz', 'selected', ui.item.attr('id'));
    setDz(ui.item.attr('id'));
}

function onFindNewDz() {
    var place = dzFinderAutocomplete.getPlace();
    if (!place.geometry) {
        ga('send', 'event', 'dz', 'autocomplete', 'failed');
        return;
    }

    ga('send', 'event', 'dz', 'autocomplete', 'success');
    setCustomDz($("#dz-finder").val(), place.geometry.location);
}

////// Initialization

function parseParameters() {
    var queryString = getQueryString(),

        lang = defaultIfUndefined(queryString.lang, readSetting("language", "en")),
        dz = defaultIfUndefined(queryString.dz, viewModel.location.id().replace("dz-", "")),
        lat = queryString.lat,
        lng = queryString.lng;

    if (lang) {
        viewModel.display.language(lang);
    }

    if (dz) {
        setDz("dz-" + dz);
    }

    if (lat && lng) {
        var latlng = new google.maps.LatLng(lat, lng);
        setCustomDz("", latlng);
    }
}

function initializeCanopyImage() {
    var canopyMarkerOptions = {
        map: map,
        icon: createCanopyMarkerIcon(viewModel.canopy.heading()),
        zIndex: 4
    };
    canopyMarker = new google.maps.Marker(canopyMarkerOptions);
}

function initializeReachSet(objects, color) {
    for (var i = 0; i < reachSetSteps; i++) {
        var circleOptions = {
            strokeColor: color,
            strokeOpacity: 0.0,
            fillColor: color,
            fillOpacity: 0.15,
            map: map,
            zIndex: 0
        };
        var circle = new google.maps.Circle(circleOptions)
        objects.push(circle);
        google.maps.event.addListener(circle, "rightclick", onMapRightClick);
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
            of: "#map-canvas-container",
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
            of: "#map-canvas-container"
        }
    };
    $id.dialog(options);
}

function bindMarkerPosition(marker, observable) {
    google.maps.event.addListener(marker, 'position_changed', function() {
        observable(marker.getPosition());
    });

    observable.subscribe(function(newValue) {
        if (newValue !== marker.getPosition()) {
            marker.setPosition(newValue);
        }
    });
}

function bindVisibility(object, observable) {
    observable.subscribe(function(newValue) {
        object.setVisible(newValue);
    });
}

function initDzMarker() {
    var markerOptions = {
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            strokeColor: 'yellow',
            scale: 8
        },
        position: dropzones[viewModel.location.id()],
        draggable: true,
        map: map,
        zIndex: 2
    }

    var dzMarker = new google.maps.Marker(markerOptions);
    bindMarkerPosition(dzMarker, viewModel.location.coords);
}

function initializeAnalyticsEvents() {
    $(".legend-button").click(function() {
        ga('send', 'event', 'button', 'click', 'legend');
    });

    google.maps.event.addListener(map, "rightclick", function() {
        ga('send', 'event', 'simulation', 'started');
        ga('send', 'event', 'simulation', 'started', 'altitude', viewModel.pattern.openingAltitude);
    });

    $("input").change(function() {
        ga('send', 'event', 'button', 'click', $(this).attr("id"));
    });
}

function initialize() {
    var mapOptions = {
        zoom: defaultMapZoom,
        minZoom: minMapZoom,
        maxZoom: maxMapZoom,
        streetViewControl: false,
        center: dropzones[viewModel.location.id()],
        keyboardShortcuts: false,
        mapTypeId: google.maps.MapTypeId.SATELLITE
    };
    map = new google.maps.Map($("#map-canvas").get(0), mapOptions);

    var $dzMenu = $("#dz-selection-menu"),
        firstLevelPosition = { my: "left top", at: "left bottom" };
    $dzMenu.menu({
        select: onDzMenuItemSelected,
        position: firstLevelPosition,
        blur: function() {
            $(this).menu("option", "position", firstLevelPosition);
        },
        focus: function(e, ui) {
            if (!ui.item.parent().is($dzMenu)) {
                $(this).menu("option", "position", { my: "left top", at: "right top" });
            }
        }
    });

    var $shareButton = $("#share-location");
    $shareButton.button().click(onShareLinkClick);

    var dzFinder = $("#dz-finder").get(0);
    map.controls[google.maps.ControlPosition.TOP_CENTER].push($dzMenu.get(0));
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(dzFinder);
    map.controls[google.maps.ControlPosition.TOP_CENTER].push($shareButton.get(0));
    map.controls[google.maps.ControlPosition.RIGHT_TOP].push($("#wind-arrow").get(0));
    map.controls[google.maps.ControlPosition.RIGHT_TOP].push($("#landing-direction-arrow").get(0));
    dzFinderAutocomplete = new google.maps.places.Autocomplete(dzFinder);
    google.maps.event.addListener(dzFinderAutocomplete, 'place_changed', onFindNewDz);

    landingPatternLine = new google.maps.Polyline({
        map: map,
        geodesic: false,
        strokeColor: '#00FFFF',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        zIndex: 1,
        visible: viewModel.pattern.show()
    });

    var steadyPointMarkerOptions = {
        visible: viewModel.display.steadyPoint(),
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
    steadyPointMarker = new google.maps.Marker(steadyPointMarkerOptions);

    initDzMarker();
    // We initialize this early so UI events have something to update
    initializeReachSet(controllabilitySetObjects, '#0000FF');
    initializeReachSet(reachabilitySetObjects, '#FF0000');

    $("#dz-custom").toggle(dropzones["dz-custom"] != null);

    var accordionOptions = { collapsible: true, heightStyle: "content" };
    $("#right-panel > div").accordion(accordionOptions);

    $(".legend-button").click(function() {
        showLegendDialog("#legend-dialog");
    });
    $(".about-button").click(function() {
        showAboutDialog("#about-dialog");
    });

    parseParameters();

    google.maps.event.addListener(map, "rightclick", onMapRightClick);
    $(document)
        .keydown(onKeyDown)
        .keyup(onKeyUp);
    window.setInterval(onTimeTick, updateFrequency);

    startTutor("#tutor-dialogs");

    initializeAnalyticsEvents();
}

google.maps.event.addDomListener(window, 'load', initialize);
