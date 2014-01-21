var sibsonAirfieldLocation = new google.maps.LatLng(52.55976, -0.394505);

// State
var isSimulationRunning = false;
var canopyLocation;
var canopyAltitude;
var canopyBearing;
var canopyHorizontalSpeed = 10;
var canopyVerticalSpeed = 5;
var windSpeed = 5;
var windBearing = 0;
var openingAltitude = 1000;

// UI objects
var map;
var canopyCircle;
var canopyBearingLine;

// Options
var updateFrequency = 20.0;
var bearingLineLength = 25;
var bearingUpdateSpeed = Math.PI * 0.01;

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

// Logic

function updateWindBearing(newValue) {
	windBearing = newValue;
	$("#wind-bearing-value").html("Wind bearing: " + Math.round(radToDeg(newValue)) + "°");
}

function updateWindSpeed(newValue) {
	windSpeed = newValue;
	$("#wind-speed-value").html("Wind speed: " + newValue + " m/s");
}

function updateOpeningAltitude(newValue) {
	openingAltitude = newValue;
	$("#opening-altitude-value").html("Opening altitude: " + newValue + " m");
}

function updateCanopyControls() {
	var bearingLineEnd = moveCoords(canopyLocation, bearingLineLength * Math.sin(canopyBearing), bearingLineLength * Math.cos(canopyBearing));
	canopyCircle.setCenter(canopyLocation);
	canopyBearingLine.setPath([canopyLocation, bearingLineEnd]);
	
	$("#altitude-value").html("Altitude: " + Math.round(canopyAltitude) + " m");
	$("#horizontal-speed-value").html("Horizontal speed: " + Math.round(canopyHorizontalSpeed) + " m/s");
	$("#vertical-speed-value").html("Vertical speed: " + Math.round(canopyVerticalSpeed) + " m/s");
	$("#canopy-bearing-value").html("Canopy bearing: " + Math.round(radToDeg(canopyBearing)) + "°");
}

// Event handlers

function onKeyDown(e) {
    e = e || window.event;
    if (e.keyCode == '37') { // left arrow
        canopyBearing -= bearingUpdateSpeed;
    }
    else if (e.keyCode == '39') { // right arrow
        canopyBearing += bearingUpdateSpeed;
    }
	
	if (canopyBearing < 0) {
		canopyBearing += Math.PI * 2;
	} else if (canopyBearing > Math.PI * 2) {
		canopyBearing -= Math.PI * 2
	}
}

function onMapRightClick(event) {
    canopyLocation = event.latLng;
	canopyAltitude = openingAltitude;
	canopyBearing = windBearing + Math.PI; // Into the wind
    if (!isSimulationRunning) {
		initializeCanopyImage();
		$("#status").show();
		isSimulationRunning = true;
	}
	
	updateCanopyControls();
}

function onTimeTick() {
	if (!isSimulationRunning || canopyAltitude < 0) {
		return;
	}
	
	var speedCoeff = updateFrequency / 1000.0;
	var dx = canopyHorizontalSpeed * Math.sin(canopyBearing) + windSpeed * Math.sin(windBearing);
	var dy = canopyHorizontalSpeed * Math.cos(canopyBearing) + windSpeed * Math.cos(windBearing);
	canopyLocation = moveCoords(canopyLocation, dx * speedCoeff, dy * speedCoeff);	  
	canopyAltitude -= speedCoeff * canopyVerticalSpeed;
	
	updateCanopyControls();
}

function onWindBearingSliderValueChange(event, ui) {
	updateWindBearing(degToRad(ui.value));
}

function onWindSpeedSliderValueChange(event, ui) {
	updateWindSpeed(ui.value);
}

function onOpeningAltitudeSliderValueChange(event, ui) {
	updateOpeningAltitude(ui.value);
}

// Initialization

function initializeCanopyImage() {
	var circleOptions = {
      strokeColor: '#000000',
      strokeOpacity: 1,
      strokeWeight: 1,
      fillColor: '#FF0000',
      fillOpacity: 1.0,
      map: map,
      radius: 5
    };
	
    canopyCircle = new google.maps.Circle(circleOptions);
	
	canopyBearingLine = new google.maps.Polyline({
		geodesic: false,
		strokeColor: '#000000',
		strokeOpacity: 1.0,
		strokeWeight: 2
	});
	canopyBearingLine.setMap(map);
}

function initializeMap(location) {
	var mapOptions = {
		zoom: 16,
		minZoom: 15,
		maxZoom: 18,
		center: location,
		keyboardShortcuts: false,
		mapTypeId: google.maps.MapTypeId.SATELLITE
	};
	
	map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
	google.maps.event.addListener(map, "rightclick", onMapRightClick);
}

function initializeControls() {
	var windBearingSliderOptions = {
		min: 0,
		max: 360,
		step: 5,
		value: radToDeg(windBearing),
		change: onWindBearingSliderValueChange,
		slide: onWindBearingSliderValueChange
	}
	$("#wind-bearing-slider").slider(windBearingSliderOptions);
	updateWindBearing(windBearing); // To update UI
	
	var windSpeedSliderOptions = {
		min: 0,
		max: 8,
		step: 0.1,
		value: windSpeed,
		change: onWindSpeedSliderValueChange,
		slide: onWindSpeedSliderValueChange
	}
	$("#wind-speed-slider").slider(windSpeedSliderOptions);
	updateWindSpeed(windSpeed); // To update UI
	
	var openingAltitudeSliderOptions = {
		min: 100,
		max: 3000,
		step: 50,
		value: openingAltitude,
		change: onOpeningAltitudeSliderValueChange,
		slide: onOpeningAltitudeSliderValueChange
	}
	$("#opening-altitude-slider").slider(openingAltitudeSliderOptions);
	updateOpeningAltitude(openingAltitude); // To update UI
}

function initialize() {
	initializeControls();
	initializeMap(sibsonAirfieldLocation);

	document.onkeydown = onKeyDown;
	window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);