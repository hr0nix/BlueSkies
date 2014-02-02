////// Parameters

// Canopy modes
var horizontalSpeeds = [0, 2.5, 5, 7.5, 10];
var verticalSpeeds = [10, 7, 5, 3, 5];
var reachSetSteps = (horizontalSpeeds.length - 1) * 2 + 1; // we need this kind of step to make sure that during interpolations into the above arrays we get the exact hits
var lastReachSetSteps = 3; // Experiments show that only the faster modes are efficient enough to be on the edge of reachability sets, so we only compute and draw those

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
}
var dzMarker;
var lastCustomDzName = readSetting("custom-dz-name", "");

// Time
var updateFrequency = 20.0;
var simulationSpeed = 1.0;
var oldSimulationSpeed = 1.0; // for instant pausing on "p" support
var headingUpdateSpeed = Math.PI / 4; // Radians __per second__
var canopyModeUpdateSpeed = 0.05; // Mode units __per keydown event__
var pressedKeys = {}; // Monitor which keys are pressed. To provide good control response.

////// Settings
var showSteadyPoint = readSetting("show-steady-point", true);
var useMetricSystem = readSetting("use-metric-system", true);
var showReachabilitySet = readSetting("show-reachability-set", false);
var showControllabilitySet = readSetting("show-controllability-set", false);
var showLandingPattern = readSetting("show-landing-pattern", false);
var lhsLandingPattern = readSetting("lhs-landing-pattern", false);
var windDirection = 0; // We use the azimuth of the wind speed vector here, not the navigational wind direction (i.e. where wind is blowing, not where _from_)
var windSpeed = 5;
var openingAltitude = readSetting("opening-altitude", 700);
var currentDropzoneId = readSetting("current-dropzone-id", "dz-uk-sibson");
var defaultMapZoom = 15;
var minMapZoom = 12;
var maxMapZoom = 18;

////// State
var isSimulationRunning = false;
var canopyLocation;
var canopyAltitude;
var canopyHeading;
var canopyMode;
var steadyPointLocation;
var prevUpdateTime;

////// UI objects

var map;
var canopyMarker;
var steadyPointMarker;
var landingPatternLine;

var reachabilitySetObjects = [];
var controllabilitySetObjects = [];

var dzFinderAutocomplete;

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
    for(var i = 0; i < cookies.length; i++) {
        var equals = cookies[i].indexOf("=");
        var name = equals > -1 ? cookies[i].substr(0, equals) : cookies[i];
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

var currentLanguage = "en";
var enResources = {
    "ms": "m/s",
    "paused": "(paused)"
};
var ruResources = {
    "ms": "м/с",
    "mph": "миль/ч",
    "m": "м",
    "ft": "футов",
    "paused": "", // too long anyway :)
    "Choose another landing area": "Выберите другую площадку приземления"
};
var langResources = {
    "en": enResources,
    "ru": ruResources
};

function localize(id) {
    return defaultIfUndefined(langResources[currentLanguage][id], id);
}

function setLanguage(language) {
    if (!langResources[language]) {
        return;
    }

    saveSetting("language", language);
    currentLanguage = language;
    $("[lang]").each(function () {
        if ($(this).attr("lang") == language) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
    updateSliderLabels();
    updateLanguageRadio();

    $("#dz-finder").attr("placeholder", localize("Choose another landing area"));
}

function updateLanguageRadio() {
    $("#select-lang-" + currentLanguage).prop('checked', true);
    $("#language-menu").buttonset('refresh');
}

////// Helpers

// Get query string, from http://stackoverflow.com/a/979995/193903
function getQueryString() {
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
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
    var earthRadius = 6378137;
    var newLat = coords.lat() + radToDeg(dy / earthRadius);
    var newLng = coords.lng() + radToDeg((dx / earthRadius) / Math.cos(degToRad(coords.lat())));
    return new google.maps.LatLng(newLat, newLng);
}

function moveInWind(coords, windSpeed, windDirection, speed, direction, time) {
    var dx = speed * Math.sin(direction) + windSpeed * Math.sin(windDirection);
    var dy = speed * Math.cos(direction) + windSpeed * Math.cos(windDirection);
    return moveCoords(coords, dx * time, dy * time);
}

function rotateDiv(div, angle) {
    style = "rotate(" + radToDeg(angle) + "deg)";

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
    return dzMarker.getPosition();
}

// TODO: implement
// returns: canopy heading necessary to maintain desiredTrack ground track in given winds (not always possible, of course)
function createGroundTrack(windSpeed, windDirection, speedH, desiredTrack) {

}

function reachSet(windSpeed, windDirection, altitude, u) {
    var speedH = getCanopyHorizontalSpeed(u);
    var speedV = getCanopyVerticalSpeed(u);
    var time = altitude / speedV;
    return {
        c: [time * windSpeed * Math.sin(windDirection), time * windSpeed * Math.cos(windDirection)],
        radius: time * speedH
    };
}

function computeReachSet(objects, sourceLocation, altitude, reachability) {
    // Note that in the interface we forbid the stall mode. But still, in most cases it doesn't lead to the edge of the reach set
    for (var i = reachSetSteps - lastReachSetSteps; i < reachSetSteps; i++) {
        var u = 1 / (reachSetSteps - 1) * i;
        var set = reachSet(windSpeed, windDirection, altitude, u);
        var shiftFactor = reachability ? 1 : -1; // for reachability we shift downwind, for controllability -- upwind

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

    if (showReachabilitySet && isSimulationRunning) {
        computeReachSet(reachabilitySetObjects, canopyLocation, canopyAltitude, true);
    }
}

function updateControllabilitySet() {
    updateReachSetVisibility(controllabilitySetObjects, showControllabilitySet);

    if (showControllabilitySet) {
        var altitude = canopyAltitude > 1e-8 ? canopyAltitude : openingAltitude;
        computeReachSet(controllabilitySetObjects, getCurrentLandingPoint(), altitude, false);
    }
}

function computeLandingPattern(location) {
    var controlPointAltitudes = [ 100, 200, 300 ];
    var patternMode = 0.85;
    var speedH = getCanopyHorizontalSpeed(patternMode);
    var speedV = getCanopyVerticalSpeed(patternMode);
    var rotationFactor = lhsLandingPattern ? 1 : -1;

    var timeToPoint1 = controlPointAltitudes[0] / speedV;
    var point1 = moveInWind(location, windSpeed, windDirection + Math.PI, speedH, windDirection, timeToPoint1);

    var timeToPoint2 = (controlPointAltitudes[1] - controlPointAltitudes[0]) / speedV;
    // In ordinary winds we hold crosswind ground track, in strong winds we move backwards with some arbitrary low angle to the wind
    var angleIntoWind = windSpeed < speedH ? Math.acos(windSpeed / speedH) : Math.PI / 8;
    var point2 = moveInWind(point1, windSpeed, windDirection + Math.PI, speedH, windDirection + rotationFactor * angleIntoWind, timeToPoint2);

    var timeToPoint3 = (controlPointAltitudes[2] - controlPointAltitudes[1]) / speedV;
    // In strong winds we always try to look into the wind, back to the wind otherwise
    angleIntoWind = windSpeed < speedH ? Math.PI : 0;
    var point3 = moveInWind(point2, windSpeed, windDirection + Math.PI, speedH, windDirection + angleIntoWind, timeToPoint3);

    return [point3, point2, point1, location];
}

function createCanopyMarkerIcon(canopyHeading) {
    return {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#FF0000',
        fillOpacity: 1,
        strokeWeight: 2,
        rotation: radToDeg(canopyHeading)
    };
}

function metersToFeet(meters) {
    return meters * 3.2808399;
}

function metersPerSecToMilesPerHour(metersPerSec) {
    return metersPerSec * 2.23693629;
}

function formatSpeed(metersPerSec, significantDigits) {
    significantDigits = significantDigits || 0;
    return useMetricSystem
        ? $.number(metersPerSec, significantDigits) + " " + localize("ms")
        : $.number(metersPerSecToMilesPerHour(metersPerSec), significantDigits) + " " + localize("mph");
}

function formatAltitude(meters, significantDigits) {
    significantDigits = significantDigits || 0;
    return useMetricSystem
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

function setPatternType(type) {
    switch (type) {
        case "pattern-hide":
            showLandingPattern = false;
            break;

        case "pattern-rhs":
            showLandingPattern = true;
            lhsLandingPattern = false;
            break;

        case "pattern-lhs":
            showLandingPattern = true;
            lhsLandingPattern = true;
            break;
    }
    saveSetting("show-landing-pattern", showLandingPattern);
    saveSetting("lhs-landing-pattern", lhsLandingPattern);
    updateLandingPattern();
    landingPatternLine.setVisible(showLandingPattern);
}

function setDz(dz) {
    if (!dropzones[dz]) {
        return;
    }

    if (dz == "dz-custom") {
        $("#dz-finder").val(lastCustomDzName);
    } else {
        $("#dz-finder").val("");
    }

    currentDropzoneId = dz;
    $('#selected-dz').html($('#' + currentDropzoneId).children("a").html());
    saveSetting("current-dropzone-id", currentDropzoneId);
    map.setCenter(dropzones[currentDropzoneId]);
    dzMarker.setPosition(dropzones[currentDropzoneId]);
    updateLandingPattern();
}

function defaultIfUndefined(x, def) {
    return (typeof x === 'undefined') ? def : x;
}

function parseBoolean(str) {
    return str == "true";
}

////// UI update logic

function updateCanopyControls() {
    canopyMarker.setPosition(canopyLocation);
    canopyMarker.setIcon(createCanopyMarkerIcon(canopyHeading));
    steadyPointMarker.setPosition(steadyPointLocation);

    updateReachabilitySet();
    updateControllabilitySet();
}

function updateCanopyStatus() {
    $("#altitude-value").html(formatAltitude(canopyAltitude, 0));
    $("#horizontal-speed-value").html(formatSpeed(getCanopyHorizontalSpeed(canopyMode), 1));
    $("#vertical-speed-value").html(formatSpeed(getCanopyVerticalSpeed(canopyMode), 1));
    $("#canopy-heading-value").html(formatHeading(canopyHeading, 0));

    $("#mode-progressbar").progressbar("option", "value", canopyMode);
    $("#altitude-progressbar").progressbar("option", "value", canopyAltitude);
}

function updateSliderLabels() {
    $("#wind-direction-slider").slider("value", radToDeg(windDirection));
    $("#wind-speed-slider").slider("value", windSpeed);
    $("#opening-altitude-slider").slider("value", openingAltitude);
}

function updateSimulationSpeedSlider() {
    $("#simulation-speed-slider").slider("value", simulationSpeed);
}

function updateLandingPattern() {
    landingPatternLine.setPath(computeLandingPattern(getCurrentLandingPoint()));

    updateControllabilitySet();
}

////// Event handlers

function onKeyDown(e) {
    if (37 <= e.which && e.which <= 40) {
        e.preventDefault(); // Disable page scrolling with arrows
        pressedKeys[e.which] = true;
    }

    if (isSimulationRunning && canopyAltitude > 0) {
        if (e.which == $.ui.keyCode.UP) {
            canopyMode += canopyModeUpdateSpeed;
        }
        else if (e.which == $.ui.keyCode.DOWN) {
            canopyMode -= canopyModeUpdateSpeed;
        }
    }

    // Clip canopy mode
    var minMode = 0.1; // We don't allow flying in the stall
    if (canopyMode < minMode) {
        canopyMode = minMode;
    } else if (canopyMode > 1) {
        canopyMode = 1;
    }
}

function onKeyUp(e) {
    if (37 <= e.which && e.which <= 40) {
        e.preventDefault(); // Disable page scrolling with arrows
        pressedKeys[e.which] = false;
    }

    if (String.fromCharCode(e.which) == "P") {
        if (simulationSpeed == 0) {
            simulationSpeed = oldSimulationSpeed;
        } else {
            oldSimulationSpeed = simulationSpeed;
            simulationSpeed = 0;
        }
        updateSimulationSpeedSlider();
    }
}

function onMapRightClick(event) {
    canopyLocation = event.latLng;
    canopyAltitude = openingAltitude;
    canopyHeading = windDirection + Math.PI; // Into the wind
    canopyMode = 0.6;
    prevUpdateTime = new Date().getTime();

    $("#mode-progressbar").progressbar({value: canopyMode, max: 1});
    $("#altitude-progressbar").progressbar({value: canopyAltitude, max: openingAltitude});

    if (!isSimulationRunning) {
        initializeCanopyImage();
        $("#status").show();
        isSimulationRunning = true;
    }
}

function onLandingSpotPositionChanged() {
    if (currentDropzoneId == "dz-custom") {
        dropzones["dz-custom"] = getCurrentLandingPoint();
        saveSetting("custom-dz-location", packLatLng(dropzones["dz-custom"]));
    }

    updateLandingPattern();
}

function onTimeTick() {
    if (isSimulationRunning && canopyAltitude > 0) {
        var currentUpdateTime = new Date().getTime();
        var dt = (currentUpdateTime - prevUpdateTime) / 1000.0;
        prevUpdateTime = currentUpdateTime;

        if (pressedKeys[37]) { // left arrow
            canopyHeading -= headingUpdateSpeed * dt;
        }
        else if (pressedKeys[39]) { // right arrow
            canopyHeading += headingUpdateSpeed * dt;
        }

        // Normalize canopy heading
        canopyHeading = normalizeAngle(canopyHeading);

        var speedH = getCanopyHorizontalSpeed(canopyMode);
        var speedV = getCanopyVerticalSpeed(canopyMode);

        dt *= simulationSpeed; // Only do it here because we don't want the responsiveness to be affected by the simulationSpeed, only the descent. Or do we?
        dt = Math.min(dt, canopyAltitude / speedV); // We don't want to go below ground

        canopyLocation = moveInWind(canopyLocation, windSpeed, windDirection, speedH, canopyHeading, dt);
        canopyAltitude -= dt * speedV;

        if (showSteadyPoint) {
            var timeToLanding = canopyAltitude / speedV;
            steadyPointLocation = moveInWind(canopyLocation, windSpeed, windDirection, speedH, canopyHeading, timeToLanding);
        }

        updateCanopyControls();
        updateCanopyStatus();
    }
}

function onWindDirectionSliderValueChange(event, ui) {
    windDirection = degToRad(ui.value);
    rotateDiv($("#wind-arrow").get(0), windDirection);
    $("#wind-direction-value").html(formatHeading(reportedWindDirection(windDirection)));

    updateLandingPattern();
}

function onWindSpeedSliderValueChange(event, ui) {
    windSpeed = ui.value;
    $("#wind-speed-value").html(formatSpeed(windSpeed, 1));

    updateLandingPattern();
}

function onOpeningAltitudeSliderValueChange(event, ui) {
    openingAltitude = ui.value;
    $("#opening-altitude-value").html(formatAltitude(openingAltitude));
    saveSetting("opening-altitude", openingAltitude);

    updateLandingPattern();
}

function onSimulationSpeedSliderValueChange(event, ui) {
    simulationSpeed = ui.value;
    $("#simulation-speed-value").html(formatSimulationSpeed(simulationSpeed));
}

function onSelectLanguage() {
    setLanguage($(this).attr('id').replace("select-lang-",""));
}

function onSelectSystem() {
    useMetricSystem = $(this).attr('id') == "select-metric";
    saveSetting("use-metric-system", useMetricSystem);

    updateSliderLabels();
    updateCanopyStatus();
}

function onDzMenuItemSelected(event, ui) {
    setDz(ui.item.attr('id'));
}

function onShowSteadyPointCheckboxToggle() {
    showSteadyPoint = !showSteadyPoint;
    saveSetting("show-steady-point", showSteadyPoint);

    steadyPointMarker.setVisible(showSteadyPoint);
}

function onShowControllabilitySetCheckboxToggle() {
    showControllabilitySet = !showControllabilitySet;

    saveSetting("show-controllability-set", showControllabilitySet);

    updateControllabilitySet();
}

function onShowReachabilitySetCheckboxToggle() {
    showReachabilitySet = !showReachabilitySet;
    saveSetting("show-reachability-set", showReachabilitySet);

    updateReachabilitySet();
}

function onPatternSelect() {
    setPatternType($(this).attr('id'));
}

function onFindNewDz() {
    var place = dzFinderAutocomplete.getPlace();
    if (!place.geometry) {
        return;
    }

    lastCustomDzName = $("#dz-finder").val();

    map.setCenter(place.geometry.location);
    map.setZoom(defaultMapZoom);

    $("#dz-custom").show();
    dropzones["dz-custom"] = place.geometry.location;
    setDz("dz-custom");

    saveSetting("custom-dz-location", packLatLng(place.geometry.location));
    saveSetting("custom-dz-name", lastCustomDzName);
}

////// Initialization

function initializeCanopyImage() {
    var canopyMarkerOptions = {
        map: map,
        icon: createCanopyMarkerIcon(canopyHeading),
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

function initialize() {
    var mapOptions = {
        zoom: defaultMapZoom,
        minZoom: minMapZoom,
        maxZoom: maxMapZoom,
        streetViewControl: false,
        center: dropzones[currentDropzoneId],
        keyboardShortcuts: false,
        mapTypeId: google.maps.MapTypeId.SATELLITE
    };
    map = new google.maps.Map($("#map-canvas").get(0), mapOptions);

    var dzFinder = $("#dz-finder").get(0);
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(dzFinder);
    dzFinderAutocomplete = new google.maps.places.Autocomplete(dzFinder);
    google.maps.event.addListener(dzFinderAutocomplete, 'place_changed', onFindNewDz);

    landingPatternLine = new google.maps.Polyline({
        map: map,
        geodesic: false,
        strokeColor: '#00FFFF',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        zIndex: 1,
        visible: showLandingPattern
    });

    var steadyPointMarkerOptions = {
        visible: showSteadyPoint,
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

    var markerOptions = {
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            strokeColor: 'yellow',
            scale: 8
        },
        position: dropzones[currentDropzoneId],
        draggable: true,
        map: map,
        zIndex: 2
    }

    dzMarker = new google.maps.Marker(markerOptions);
    google.maps.event.addListener(dzMarker, 'position_changed', onLandingSpotPositionChanged);

    // We initialize this early so UI events have something to update
    initializeReachSet(controllabilitySetObjects, '#0000FF');
    initializeReachSet(reachabilitySetObjects, '#FF0000');

    $("#mode-progressbar").progressbar().height(10);
    $("#altitude-progressbar").progressbar().height(10);

    var windDirectionSliderOptions = {
        min: 0,
        max: 360,
        step: 5,
        change: onWindDirectionSliderValueChange,
        slide: onWindDirectionSliderValueChange
    }
    $("#wind-direction-slider").
        slider(windDirectionSliderOptions).
        slider("value", radToDeg(windDirection));

    var windSpeedSliderOptions = {
        min: 0,
        max: 13,
        step: 0.1,
        change: onWindSpeedSliderValueChange,
        slide: onWindSpeedSliderValueChange
    }
    $("#wind-speed-slider").
        slider(windSpeedSliderOptions).
        slider("value", windSpeed);

    var openingAltitudeSliderOptions = {
        min: 100,
        max: 3000,
        step: 50,
        change: onOpeningAltitudeSliderValueChange,
        slide: onOpeningAltitudeSliderValueChange
    }
    $("#opening-altitude-slider").
        slider(openingAltitudeSliderOptions).
        slider("value", openingAltitude);

    var simulationSpeedSliderOptions = {
        min: 0,
        max: 5,
        step: 0.1,
        change: onSimulationSpeedSliderValueChange,
        slide: onSimulationSpeedSliderValueChange
    }
    $("#simulation-speed-slider").
        slider(simulationSpeedSliderOptions).
        slider("value", simulationSpeed);

    $(".ui-slider-handle").unbind('keydown');

    $("#select-lang-en").prop('checked', true); // We set this before buttonset creation so the buttonset is updated properly
    $("#language-menu").buttonset();
    $("#language-menu > input").change(onSelectLanguage);
    $("#language-menu").find('span.ui-button-text').addClass('no-padding');

    $("#select-metric").prop('checked', useMetricSystem); // We set this before buttonset creation so the buttonset is updated properly
    $("#select-imperial").prop('checked', !useMetricSystem);
    $("#system-menu").buttonset();
    $("#system-menu > input").change(onSelectSystem);

    $("#dz-selection-menu").menu({ select: onDzMenuItemSelected });
    $("#dz-custom").toggle(dropzones["dz-custom"] != null);

    $("#steady-point-checkbox").
        prop('checked', showSteadyPoint).
        change(onShowSteadyPointCheckboxToggle);

    $("#show-controllability-set-checkbox").
        prop('checked', showControllabilitySet).
        change(onShowControllabilitySetCheckboxToggle);

    $("#show-reachability-set-checkbox").
        prop('checked', showReachabilitySet).
        change(onShowReachabilitySetCheckboxToggle);

    $("#display-ui-element-buttons").buttonset();

    $("#pattern-hide").prop('checked', !showLandingPattern); // We set this before buttonset creation so the buttonset is updated properly
    $("#pattern-lhs").prop('checked', showLandingPattern && lhsLandingPattern); // We set this before buttonset creation so the buttonset is updated properly
    $("#pattern-rhs").prop('checked', showLandingPattern && !lhsLandingPattern); // We set this before buttonset creation so the buttonset is updated properly
    $("#pattern-menu").buttonset();
    $("#pattern-menu > input").change(onPatternSelect);

    var accordionOptions = { collapsible: true, heightStyle: "content" };
    $("#settings").accordion(accordionOptions);
    $("#legend").accordion(accordionOptions);
    $("#status").accordion(accordionOptions).hide();

    var queryString = getQueryString();
    var lang = queryString.lang || readSetting("language", "en");
    var dz = queryString.dz || currentDropzoneId.replace("dz-", "");
    if (lang) {
        setLanguage(lang);
    }

    if (dz) {
        setDz("dz-" + dz);
    }

    google.maps.event.addListener(map, "rightclick", onMapRightClick);
    $(document).keydown(onKeyDown);
    $(document).keyup(onKeyUp);
    window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);
