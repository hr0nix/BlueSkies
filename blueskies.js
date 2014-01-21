var sibsonAirfieldLocation = new google.maps.LatLng(52.55976, -0.394505);

// State
var canopyLocation = sibsonAirfieldLocation;
var canopyBearing = 0;
var canopySpeed = 10;
var windSpeed = 5;
var windBearing = canopyBearing + Math.PI; // Into the wind

// UI objects
var map;
var canopyCircle;
var canopyBearingLine;

// Options
var updateFrequency = 20.0;
var bearingLineLength = 25;
var bearingUpdateSpeed = Math.PI * 0.003;

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

// Event handlers

function onKeyDown(e) {
    e = e || window.event;
    if (e.keyCode == '37') { // left arrow
        canopyBearing += bearingUpdateSpeed;
    }
    else if (e.keyCode == '39') { // right arrow
        canopyBearing -= bearingUpdateSpeed;
    }
}

function onTimeTick() {
	  var speedCoeff = updateFrequency / 1000.0;
	  var dx = canopySpeed * Math.cos(canopyBearing) + windSpeed * Math.cos(windBearing);
	  var dy = canopySpeed * Math.sin(canopyBearing) + windSpeed * Math.sin(windBearing);
	  canopyLocation = moveCoords(canopyLocation, dx * speedCoeff, dy * speedCoeff);	  
	  var bearingLineEnd = moveCoords(canopyLocation, bearingLineLength * Math.cos(canopyBearing), bearingLineLength * Math.sin(canopyBearing));
	  
	  canopyCircle.setCenter(canopyLocation);
	  canopyBearingLine.setPath([canopyLocation, bearingLineEnd]);
}

function updateWindBearing(newValue) {
	windBearing = newValue;
	$("#wind-bearing-value").html("Wind bearing: " + Math.round(radToDeg(newValue)) + "°");
}

function updateWindSpeed(newValue) {
	windSpeed = newValue;
	$("#wind-speed-value").html("Wind speed: " + newValue + " m/s");
}

function onWindBearingSliderValueChange(event, ui) {
	updateWindBearing(degToRad(ui.value));
}

function onWindSpeedSliderValueChange(event, ui) {
	updateWindSpeed(ui.value);
}

// Initialization

function initializeCanopyDrawing() {
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
}

function initializeControls() {
	var windBearingSliderOptions = {
		min: 0,
		max: 360,
		value: radToDeg(windBearing),
		change: onWindBearingSliderValueChange,
		slide: onWindBearingSliderValueChange
	}
	$("#wind-bearing-slider").slider(windBearingSliderOptions);
	updateWindBearing(windBearing); // To update UI
	
	var windSpeedSliderOptions = {
		min: 0,
		max: 8,
		value: windSpeed,
		change: onWindSpeedSliderValueChange,
		slide: onWindSpeedSliderValueChange
	}
	$("#wind-speed-slider").slider(windSpeedSliderOptions);
	updateWindSpeed(windSpeed); // To update UI
}

function initialize() {
	initializeControls();
	initializeMap(sibsonAirfieldLocation);
	initializeCanopyDrawing(sibsonAirfieldLocation);

	document.onkeydown = onKeyDown;
	window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);