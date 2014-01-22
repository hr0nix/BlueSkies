// State
var showSteadyPoint = false;
var isSimulationRunning = false;
var canopyLocation;
var canopyAltitude;
var canopyHeading;
var steadyPointLocation;
var canopyHorizontalSpeed = 10;
var canopyVerticalSpeed = 5;
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
	"dz-uk-sibson" : new google.maps.LatLng(52.55976, -0.394505),
	"dz-ru-puschino" : new google.maps.LatLng(54.790145, 37.642408)
}
var initialDropzone = "dz-uk-sibson";
var updateFrequency = 20.0;
var headingLineLength = 25;
var headingUpdateSpeed = Math.PI * 0.008;

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

// UI update logic

function updateCanopyControls() {
	var headingLineEnd = moveCoords(canopyLocation, headingLineLength * Math.sin(canopyHeading), headingLineLength * Math.cos(canopyHeading));
	canopyCircle.setCenter(canopyLocation);
	canopyHeadingLine.setPath([canopyLocation, headingLineEnd]);
	steadyPointCircle.setCenter(steadyPointLocation);
	
	$("#altitude-value").html("Altitude: " + Math.round(canopyAltitude) + " m");
	$("#horizontal-speed-value").html("Horizontal speed: " + Math.round(canopyHorizontalSpeed) + " m/s");
	$("#vertical-speed-value").html("Vertical speed: " + Math.round(canopyVerticalSpeed) + " m/s");
	$("#canopy-heading-value").html("Canopy heading: " + Math.round(radToDeg(canopyHeading)) + "°");
}

// Event handlers

function onKeyDown(e) {
    e = e || window.event;
    if (e.keyCode == '37') { // left arrow
        canopyHeading -= headingUpdateSpeed;
    }
    else if (e.keyCode == '39') { // right arrow
        canopyHeading += headingUpdateSpeed;
    }
	
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
	var dx = canopyHorizontalSpeed * Math.sin(canopyHeading) + windSpeed * Math.sin(windDirection);
	var dy = canopyHorizontalSpeed * Math.cos(canopyHeading) + windSpeed * Math.cos(windDirection);
	canopyLocation = moveCoords(canopyLocation, dx * speedCoeff, dy * speedCoeff);
	canopyAltitude -= speedCoeff * canopyVerticalSpeed;
	
	if (showSteadyPoint) {
		var timeToLanding = canopyAltitude / canopyVerticalSpeed;
		steadyPointLocation = moveCoords(canopyLocation, dx * timeToLanding, dy * timeToLanding);
	}
	
	updateCanopyControls();
}

function onWindDirectionSliderValueChange(event, ui) {
	windDirection = degToRad(ui.value);
	$("#wind-direction-value").html("Wind direction: " + Math.round(ui.value) + "°");
}

function onWindSpeedSliderValueChange(event, ui) {
	windSpeed = ui.value;
	$("#wind-speed-value").html("Wind speed: " + ui.value + " m/s");
}

function onOpeningAltitudeSliderValueChange(event, ui) {
	openingAltitude = ui.value;
	$("#opening-altitude-value").html("Opening altitude: " + ui.value + " m");
}

function onDzMenuItemSelected(event, ui) {
	dzId = ui.item.attr("id");
	map.setCenter(dropzones[dzId]);
}

function onShowSteadyPointCheckboxToggle() {
	showSteadyPoint = !showSteadyPoint;
	steadyPointCircle.setVisible(showSteadyPoint);
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
		max: 10,
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
	
	document.onkeydown = onKeyDown;
	window.setInterval(onTimeTick, updateFrequency);
}

google.maps.event.addDomListener(window, 'load', initialize);