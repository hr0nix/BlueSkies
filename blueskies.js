// State
var showSteadyPoint = false;
var useMetricSystem = true;
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

// Options
var dropzones = {
	"dz-uk-sibson" : new google.maps.LatLng(52.560706, -0.395692),
	"dz-ru-puschino" : new google.maps.LatLng(54.790046, 37.642547)
}
var initialDropzone = "dz-uk-sibson";
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

function metersToFeet(meters) {
	return meters * 3.2808399;
}

function metersPerSecToMilesPerHour(metersPerSec) {
	return metersPerSec * 2.23693629;
}

function formatSpeed(metersPerSec, significantDigits) {
	significantDigits = significantDigits || 0;
	return useMetricSystem
		? $.number(metersPerSec, significantDigits) + " m/s"
		: $.number(metersPerSecToMilesPerHour(metersPerSec), significantDigits) + " mph";
}

function formatAltitude(meters, significantDigits) {
	significantDigits = significantDigits || 0;
	return useMetricSystem
		? $.number(meters, significantDigits) + " m"
		: $.number(metersToFeet(meters), significantDigits) + " ft";
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
	
	$("#altitude-value").html("Altitude: " + formatAltitude(canopyAltitude, 0));
	$("#horizontal-speed-value").html("Horizontal speed: " + formatSpeed(getCanopyHorizontalSpeed(canopyMode), 1));
	$("#vertical-speed-value").html("Vertical speed: " + formatSpeed(getCanopyVerticalSpeed(canopyMode), 1));
	$("#canopy-heading-value").html("Canopy heading: " + formatHeading(canopyHeading, 0));
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
	
	updateCanopyControls();
}

function onTimeTick() {
	if (isSimulationRunning && canopyAltitude > 0) {
		var speedH = getCanopyHorizontalSpeed(canopyMode);
		var speedV = getCanopyVerticalSpeed(canopyMode);
		
		var speedCoeff = updateFrequency / 1000.0;
		var dx = speedH * Math.sin(canopyHeading) + windSpeed * Math.sin(windDirection);
		var dy = speedH * Math.cos(canopyHeading) + windSpeed * Math.cos(windDirection);
		canopyLocation = moveCoords(canopyLocation, dx * speedCoeff, dy * speedCoeff);
		canopyAltitude -= speedCoeff * speedV;
		
		if (showSteadyPoint) {
			var timeToLanding = canopyAltitude / speedV;
			steadyPointLocation = moveCoords(canopyLocation, dx * timeToLanding, dy * timeToLanding);
		}
	}
	
	updateCanopyControls();
}

function onWindDirectionSliderValueChange(event, ui) {
	windDirection = degToRad(ui.value);
	rotateDiv($("#wind-arrow").get(0), windDirection);
	$("#wind-direction-value").html("Wind direction: " + formatHeading(windDirection));
}

function onWindSpeedSliderValueChange(event, ui) {
	windSpeed = ui.value;
	$("#wind-speed-value").html("Wind speed: " + formatSpeed(windSpeed, 1));
}

function onOpeningAltitudeSliderValueChange(event, ui) {
	openingAltitude = ui.value;
	$("#opening-altitude-value").html("Opening altitude: " + formatAltitude(openingAltitude));
}

function onDzMenuItemSelected(event, ui) {
	dzId = ui.item.attr("id");
	map.setCenter(dropzones[dzId]);
}

function onShowSteadyPointCheckboxToggle() {
	showSteadyPoint = !showSteadyPoint;
	steadyPointCircle.setVisible(showSteadyPoint);
}

function onUseMetricSystemCheckboxToggle() {
	useMetricSystem = !useMetricSystem;
	
	// Update slider labels
	$("#wind-direction-slider").slider("value", radToDeg(windDirection));
	$("#wind-speed-slider").slider("value", windSpeed);
	$("#opening-altitude-slider").slider("value", openingAltitude);
}

// Initialization

function initializeCanopyImage() {	
	var canopyCircleOptions = {
      //strokeColor: '#000000',
      //strokeOpacity: 1,
      //strokeWeight: 1,
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
      //strokeColor: '#000000',
      //strokeOpacity: 1,
      //strokeWeight: 1,
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
		center: dropzones[initialDropzone],
		keyboardShortcuts: false,
		mapTypeId: google.maps.MapTypeId.SATELLITE
	};
	
	map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
	google.maps.event.addListener(map, "rightclick", onMapRightClick);
	
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
	
	var dzMenuOptions = {
		select: onDzMenuItemSelected
	}
	$("#dz-selection-menu").menu(dzMenuOptions);
	
	$("#steady-point-checkbox").prop("checked", showSteadyPoint);
	$("#steady-point-checkbox").click(onShowSteadyPointCheckboxToggle);
	
	$("#use-metric-system-checkbox").prop("checked", useMetricSystem);
	$("#use-metric-system-checkbox").click(onUseMetricSystemCheckboxToggle);
	
	document.onkeydown = onKeyDown;
	window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);