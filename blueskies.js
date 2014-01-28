// State
var showSteadyPoint = false;
var useMetricSystem = true;
var showLandingPattern = false;
var isSimulationRunning = false;
var canopyLocation;
var canopyAltitude;
var canopyHeading;
var canopyMode;
var steadyPointLocation;
var windSpeed = 5;
var windDirection = 0;
var openingAltitude = 1000;

// UI objects
var map;
var canopyCircle;
var steadyPointCircle;
var canopyHeadingLine;
var landingPatternLine;

// Localization for javascript
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
var langRes = {
	"lang-en": enResources,
	"lang-ru": ruResources
};

function localize(id) {
	return langRes[langClass][id];
}

// Options
var dropzones = {
	"dz-uk-sibson" : new google.maps.LatLng(52.560706, -0.395692),
	"dz-uk-chatteris" :  new google.maps.LatLng(52.48866, 0.086044),
	"dz-ru-puschino" : new google.maps.LatLng(54.790046, 37.642547),
	"dz-ru-kolomna" : new google.maps.LatLng(55.091914, 38.917231),
	"dz-ru-vatulino" : new google.maps.LatLng(55.663505, 36.142181)
}
var currentDropzoneId = "dz-uk-sibson";
var updateFrequency = 20.0;
var headingLineLength = 25;
var headingUpdateSpeed = Math.PI * 0.008;
var canopyModeUpdateSpeed = 0.05;

// Helpers

function degToRad(deg) {
	return deg * Math.PI / 180;
}

function radToDeg(rad) {
	return rad * 180 / Math.PI;
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
	horizontalSpeeds = [0, 2.5, 5, 7.5, 10];
	return interpolate(horizontalSpeeds, mode);
}

function getCanopyVerticalSpeed(mode) {
	verticalSpeeds = [10, 7, 5, 3, 5];
	return interpolate(verticalSpeeds, mode);
}

function computeLandingPattern(location) {
	var controlPointAltitudes = [ 100, 200, 300 ];
	var patternMode = 0.85;
	var speedH = getCanopyHorizontalSpeed(patternMode);
	var speedV = getCanopyVerticalSpeed(patternMode);
	
	var timeToPoint1 = controlPointAltitudes[0] / speedV;
	var point1 = moveInWind(location, windSpeed, windDirection + Math.PI, speedH, windDirection, timeToPoint1);
	
	var timeToPoint2 = (controlPointAltitudes[1] - controlPointAltitudes[0]) / speedV;
	var headingCorrection = windSpeed >= speedH ? 0 : Math.PI * 0.5 - Math.acos(-windSpeed / speedH);
	var point2 = moveInWind(point1, windSpeed, windDirection + Math.PI, speedH, windDirection - Math.PI * 0.5 - headingCorrection, timeToPoint2);
	
	var timeToPoint3 = (controlPointAltitudes[2] - controlPointAltitudes[1]) / speedV;
	var point3 = moveInWind(point2, windSpeed, windDirection + Math.PI, speedH, windDirection + Math.PI, timeToPoint3);
	
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
	return $.number(radToDeg(angle), significantDigits) + "°";
}

// UI update logic

function updateCanopyControls() {
	var headingLineEnd = moveCoords(canopyLocation, headingLineLength * Math.sin(canopyHeading), headingLineLength * Math.cos(canopyHeading));
	canopyCircle.setCenter(canopyLocation);
	canopyHeadingLine.setPath([canopyLocation, headingLineEnd]);
	steadyPointCircle.setCenter(steadyPointLocation);
}

function updateCanopyStatus() {
	$("#altitude-value").html(formatAltitude(canopyAltitude, 0));
	$("#horizontal-speed-value").html(formatSpeed(getCanopyHorizontalSpeed(canopyMode), 1));
	$("#vertical-speed-value").html(formatSpeed(getCanopyVerticalSpeed(canopyMode), 1));
	$("#canopy-heading-value").html(formatHeading(canopyHeading, 0));
}

function updateLandingPattern() {
	landingPatternLine.setPath(computeLandingPattern(dropzones[currentDropzoneId]));
}

// Event handlers

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
	if (canopyHeading < 0) {
		canopyHeading += Math.PI * 2;
	} else if (canopyHeading > Math.PI * 2) {
		canopyHeading -= Math.PI * 2
	}
}

function onMapRightClick(event) {
    canopyLocation = event.latLng;
	canopyAltitude = openingAltitude;
	canopyHeading = windDirection + Math.PI; // Into the wind
	canopyMode = 0.75;
	
    if (!isSimulationRunning) {
		initializeCanopyImage();
		$("#status").show();
		isSimulationRunning = true;
	}
}

function onTimeTick() {
	if (isSimulationRunning && canopyAltitude > 0) {
		var speedH = getCanopyHorizontalSpeed(canopyMode);
		var speedV = getCanopyVerticalSpeed(canopyMode);
		var dt = updateFrequency / 1000.0;
		
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
	$("#wind-direction-value").html(formatHeading(windDirection));
	
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
}

function onSelectLanguage() {
	langClass = $(this).attr("for").replace("select-","");
	var otherClass = langClass == "lang-ru" ? "lang-en" : "lang-ru";
	$("." + langClass).show();
	$("." + otherClass).hide();
	updateSliderLabels();
}

function onDzMenuItemSelected(event, ui) {
	currentDropzoneId = ui.item.attr("id");
	map.setCenter(dropzones[currentDropzoneId]);
	updateLandingPattern();
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

function onShowLandingPatternCheckboxToggle() {
	showLandingPattern = !showLandingPattern;
	landingPatternLine.setVisible(showLandingPattern);
}

// Initialization

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

function initialize() {
	var mapOptions = {
		zoom: 16,
		minZoom: 15,
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
			icon: "http://maps.google.com/mapfiles/arrow.png",
			position: dropzones[dz],
			map: map
		}
		
		new google.maps.Marker(markerOptions);
	}
	
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
	
	$("#language-menu").buttonset();

	$("#language-menu > label").click(onSelectLanguage);

	$("#dz-selection-menu").menu({ select: onDzMenuItemSelected });
	
	$("#steady-point-checkbox").prop("checked", showSteadyPoint);
	$("#steady-point-checkbox").click(onShowSteadyPointCheckboxToggle);
	
	$("#use-metric-system-checkbox").prop("checked", useMetricSystem);
	$("#use-metric-system-checkbox").click(onUseMetricSystemCheckboxToggle);
	
	$("#show-landing-pattern-checkbox").prop("checked", showLandingPattern);
	$("#show-landing-pattern-checkbox").click(onShowLandingPatternCheckboxToggle);
	
	$("#settings").accordion({ collapsible: true });
	$("#legend").accordion({ collapsible: true, heightStyle: "content" });
	$("#status").accordion({ collapsible: true });
	$("#status").hide();
	
	google.maps.event.addListener(map, "rightclick", onMapRightClick);
	document.onkeydown = onKeyDown;
	window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);