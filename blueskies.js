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
    "dz-ru-vatulino" : new google.maps.LatLng(55.663505, 36.142181)
}
var dzMarkers = {}; // We populate this array with markers to allow user to modify the landing spot.

// Time
var updateFrequency = 20.0;
var timeScaleCoeff = 1.0;
var headingUpdateSpeed = Math.PI * 0.008; // Radians per update
var canopyModeUpdateSpeed = 0.05; // Mode units per update

////// State

var showSteadyPoint = false;
var useMetricSystem = true;
var showReachabilitySet = false;
var showControllabilitySet = false;
var showLandingPattern = false;
var lhsLandingPattern = false;
var isSimulationRunning = false;
var canopyLocation;
var canopyAltitude;
var canopyHeading;
var canopyMode;
var steadyPointLocation;
var windSpeed = 5;
var windDirection = 0; // We use the azimuth of the wind speed vector here, not the navigational wind direction (i.e. where wind is blowing, not where _from_)
var openingAltitude = 1000;
var currentDropzoneId = "dz-uk-sibson";
var prevUpdateTime;

////// UI objects

var map;
var canopyCircle;
var steadyPointCircle;
var canopyHeadingLine;
var landingPatternLine;

var reachabilitySetObjects = [];
var controllabilitySetObjects = [];

////// Localization for javascript

var langClass="lang-en";
var enResources = {
    "ms": "m/s",
    "mph": "mph",
    "m": "m",
    "ft": "ft"
};
var ruResources = {
    "ms": "м/с",
    "mph": "миль/ч",
    "m": "м",
    "ft": "футов"
};
var langResources = {
    "lang-en": enResources,
    "lang-ru": ruResources
};

function localize(id) {
    return langResources[langClass][id];
}

function setLanguage(lang) {
    if (lang != "ru" && lang != "en") {
        return;
    }
    langClass = "lang-" + lang;
    var otherClass = langClass == "lang-ru" ? "lang-en" : "lang-ru";
    $("." + langClass).show();
    $("." + otherClass).hide();
    updateSliderLabels();
    updateLanguageRadio();
}

function updateLanguageRadio() {
    $("#select-" + langClass).prop('checked', true);
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
    return dzMarkers[currentDropzoneId].getPosition();
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

    if (showReachabilitySet) {
        computeReachSet(reachabilitySetObjects, canopyLocation, canopyAltitude, true);
    }
}

function updateControllabilitySet() {
    updateReachSetVisibility(controllabilitySetObjects, showControllabilitySet);

    if (showControllabilitySet) {
        var altitude = canopyAltitude > 0 ? canopyAltitude : openingAltitude;
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
    updateLandingPattern();
    landingPatternLine.setVisible(showLandingPattern);
}

function setDz(dz) {
    if (!dropzones[dz]) {
        return;
    }
    currentDropzoneId = dz;
    map.setCenter(dropzones[currentDropzoneId]);
    updateLandingPattern();
}

////// UI update logic

function updateCanopyControls() {
	var headingLineLength = 25;
    var headingLineEnd = moveCoords(canopyLocation, headingLineLength * Math.sin(canopyHeading), headingLineLength * Math.cos(canopyHeading));
    canopyCircle.setCenter(canopyLocation);
    canopyHeadingLine.setPath([canopyLocation, headingLineEnd]);
    steadyPointCircle.setCenter(steadyPointLocation);

    updateReachabilitySet();
    updateControllabilitySet();
}

function updateCanopyStatus() {
    $("#altitude-value").html(formatAltitude(canopyAltitude, 0));
    $("#horizontal-speed-value").html(formatSpeed(getCanopyHorizontalSpeed(canopyMode), 1));
    $("#vertical-speed-value").html(formatSpeed(getCanopyVerticalSpeed(canopyMode), 1));
    $("#canopy-heading-value").html(formatHeading(canopyHeading, 0));
}

function updateLandingPattern() {
    landingPatternLine.setPath(computeLandingPattern(getCurrentLandingPoint()));

    updateControllabilitySet();
}

////// Event handlers

function onKeyDown(e) {
    e = e || window.event;
    if (e.keyCode == '37') { // left arrow
        canopyHeading -= headingUpdateSpeed;
    }
    else if (e.keyCode == '38') { // up arrow
        canopyMode += canopyModeUpdateSpeed;
    }
    else if (e.keyCode == '39') { // right arrow
        canopyHeading += headingUpdateSpeed;
    }
    else if (e.keyCode == '40') { // down arrow
        canopyMode -= canopyModeUpdateSpeed;
    }
    
    if (e.keyCode == '37' || e.keyCode == '38' || e.keyCode == '39' || e.keyCode == '40') {
        e.preventDefault(); // Disable page scrolling with arrows
    }
    
    // Truncate canopy mode
    if (canopyMode < 0) {
        canopyMode = 0;
    } else if (canopyMode > 1) {
        canopyMode = 1;
    }
    
    // Normalize canopy heading
    canopyHeading = normalizeAngle(canopyHeading);
}

function onMapRightClick(event) {
    canopyLocation = event.latLng;
    canopyAltitude = openingAltitude;
    canopyHeading = windDirection + Math.PI; // Into the wind
    canopyMode = 0.75;
    prevUpdateTime = new Date().getTime();
    
    if (!isSimulationRunning) {
        initializeCanopyImage();
        $("#status").show();
        isSimulationRunning = true;
    }
}

function onMarkerDrag(event) {
    updateLandingPattern();
}

function onTimeTick() {
    if (isSimulationRunning && canopyAltitude > 0) {
        var speedH = getCanopyHorizontalSpeed(canopyMode);
        var speedV = getCanopyVerticalSpeed(canopyMode);
        
        var currentUpdateTime = new Date().getTime();
        var dt = timeScaleCoeff * (currentUpdateTime - prevUpdateTime) / 1000.0;
        prevUpdateTime = currentUpdateTime;
        
        dt = Math.min(dt, canopyAltitude / speedV); // We don't want to go below ground
        
        canopyLocation = moveInWind(canopyLocation, windSpeed, windDirection, speedH, canopyHeading, dt);
        canopyAltitude -= dt * speedV;
        
        if (showSteadyPoint) {
            var timeToLanding = canopyAltitude / speedV;
            steadyPointLocation = moveInWind(canopyLocation, windSpeed, windDirection, speedH, canopyHeading, timeToLanding);
        }
        
        updateCanopyControls();
    }
    
    updateCanopyStatus();
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

    updateLandingPattern();
}

function onSelectLanguage() {
    setLanguage($(this).attr("for").replace("select-lang-",""));
}

function onDzMenuItemSelected(event, ui) {
    setDz(ui.item.attr("id"));
}

function onShowSteadyPointCheckboxToggle() {
    showSteadyPoint = !showSteadyPoint;
    steadyPointCircle.setVisible(showSteadyPoint);
}

function updateSliderLabels() {
    $("#wind-direction-slider").slider("value", radToDeg(windDirection));
    $("#wind-speed-slider").slider("value", windSpeed);
    $("#opening-altitude-slider").slider("value", openingAltitude);
}

function onUseMetricSystemCheckboxToggle() {
    useMetricSystem = !useMetricSystem;
    
    updateSliderLabels();
}

function onShowControllabilitySetCheckboxToggle() {
    showControllabilitySet = !showControllabilitySet;
    
    updateControllabilitySet();
}

function onShowReachabilitySetCheckboxToggle() {
    showReachabilitySet = !showReachabilitySet;
    
    updateReachabilitySet();
}

function onPatternSelect() {
    setPatternType($(this).attr('for'));
}

////// Initialization

function initializeCanopyImage() {  
    var canopyCircleOptions = {
        strokeWeight: 0,
        fillColor: '#FF0000',
        fillOpacity: 1.0,
        map: map,
        radius: 6,
        zIndex: 1
    };
    canopyCircle = new google.maps.Circle(canopyCircleOptions);
    
    canopyHeadingLine = new google.maps.Polyline({
        geodesic: false,
        strokeColor: '#000000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        zIndex: 2
    });
    canopyHeadingLine.setMap(map);
    
    var steadyPointCircleOptions = {
        strokeWeight: 0,
        fillColor: '#FF00FF',
        fillOpacity: 1.0,
        visible: showSteadyPoint,
        map: map,
        radius: 6,
        zIndex: 0
    };
    steadyPointCircle = new google.maps.Circle(steadyPointCircleOptions);
}

function initializeReachSet(objects, color) {
    for (var i = 0; i < reachSetSteps; i++) {
        var circleOptions = {
            strokeColor: color,
            strokeOpacity: 0.0,
            fillColor: color,
            fillOpacity: 0.1,
            map: map,
            zindex: 0
        };
        var circle = new google.maps.Circle(circleOptions)
        objects.push(circle);
        google.maps.event.addListener(circle, "rightclick", onMapRightClick);
    }
}

function initialize() {
    var mapOptions = {
        zoom: 16,
        minZoom: 12,
        maxZoom: 18,
        center: dropzones[currentDropzoneId],
        keyboardShortcuts: false,
        mapTypeId: google.maps.MapTypeId.SATELLITE
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    
    landingPatternLine = new google.maps.Polyline({
        geodesic: false,
        strokeColor: '#00FFFF',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        zIndex: -1,
        visible: showLandingPattern
    });
    landingPatternLine.setMap(map);
    
    for (var dz in dropzones) {
        var markerOptions = {
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                strokeColor: 'yellow',
                scale: 8
            },
            position: dropzones[dz],
            draggable: true,
            map: map
        }
        
        dzMarkers[dz] = new google.maps.Marker(markerOptions);
        google.maps.event.addListener(dzMarkers[dz], "drag", onMarkerDrag);
    }
    
    // We initialize this early so ui events have somithing to update
    initializeReachSet(controllabilitySetObjects, '#0000FF');
    initializeReachSet(reachabilitySetObjects, '#FF0000');
    
    var windDirectionSliderOptions = {
        min: 0,
        max: 360,
        step: 5,
        change: onWindDirectionSliderValueChange,
        slide: onWindDirectionSliderValueChange
    }
    $("#wind-direction-slider").slider(windDirectionSliderOptions);
    $("#wind-direction-slider .ui-slider-handle").unbind('keydown');
    $("#wind-direction-slider").slider("value", radToDeg(windDirection));
    
    var windSpeedSliderOptions = {
        min: 0,
        max: 13,
        step: 0.1,
        change: onWindSpeedSliderValueChange,
        slide: onWindSpeedSliderValueChange
    }
    $("#wind-speed-slider").slider(windSpeedSliderOptions);
    $("#wind-speed-slider .ui-slider-handle").unbind('keydown');
    $("#wind-speed-slider").slider("value", windSpeed);
    
    var openingAltitudeSliderOptions = {
        min: 100,
        max: 3000,
        step: 50,
        change: onOpeningAltitudeSliderValueChange,
        slide: onOpeningAltitudeSliderValueChange
    }
    $("#opening-altitude-slider").slider(openingAltitudeSliderOptions);
    $("#opening-altitude-slider .ui-slider-handle").unbind('keydown');
    $("#opening-altitude-slider").slider("value", openingAltitude);
    
    $("#select-lang-en").prop('checked', true); // We set this before buttonset creation so the buttonset is updated properly
    $("#language-menu").buttonset();
    $("#language-menu > label").click(onSelectLanguage);

    $("#dz-selection-menu").menu({ select: onDzMenuItemSelected });
    
    $("#steady-point-checkbox").prop('checked', showSteadyPoint);
    $("#steady-point-checkbox").click(onShowSteadyPointCheckboxToggle);
    
    $("#use-metric-system-checkbox").prop('checked', useMetricSystem);
    $("#use-metric-system-checkbox").click(onUseMetricSystemCheckboxToggle);

    $("#show-controllability-set-checkbox").prop('checked', showControllabilitySet);
    $("#show-controllability-set-checkbox").click(onShowControllabilitySetCheckboxToggle);

    $("#show-reachability-set-checkbox").prop('checked', showReachabilitySet);
    $("#show-reachability-set-checkbox").click(onShowReachabilitySetCheckboxToggle);

    $("#pattern-hide").prop('checked', true); // We set this before buttonset creation so the buttonset is updated properly
    $("#pattern-menu").buttonset();
    $("#pattern-menu > label").click(onPatternSelect);
    
    $("#settings").accordion({ collapsible: true });
    $("#legend").accordion({ collapsible: true, heightStyle: "content" });
    $("#status").accordion({ collapsible: true });
    $("#status").hide();

    var queryString = getQueryString();
    var lang = queryString.lang;
    var dz = queryString.dz;
    if (lang) {
        setLanguage(lang);
    }

    if (dz) {
        setDz("dz-" + dz);
    }

    google.maps.event.addListener(map, "rightclick", onMapRightClick);
    document.onkeydown = onKeyDown;
    window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);
