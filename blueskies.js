var sibsonAirfieldLocation = new google.maps.LatLng(52.55976, -0.394505);

var map;

var currentCanopyLocation = sibsonAirfieldLocation;
var currentCanopyBearing = 0;
var currentCanopySpeed = 10;

var windSpeed = 5;
var windBearing = Math.PI / 2;

var canopyCircle;
var canopyBearingLine;

// Options
var updateFrequency = 20.0;
var bearingLineLength = 25;
var bearingUpdateSpeed = Math.PI * 0.003;

function moveCoords(coords, dx, dy) {
	var earthRadius = 6378137;
	var newLat = coords.lat() + (180 / Math.PI) * (dy / earthRadius);
	var newLng = coords.lng() + (180 / Math.PI) * (dx / earthRadius) / Math.cos(Math.PI / 180 * coords.lat());
	return new google.maps.LatLng(newLat, newLng);
}

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

function runCanopyPositionUpdate() {
	window.setInterval(function() {
	  var speedCoeff = updateFrequency / 1000.0;
	  var dx = currentCanopySpeed * Math.cos(currentCanopyBearing) + windSpeed * Math.cos(windBearing);
	  var dy = currentCanopySpeed * Math.sin(currentCanopyBearing) + windSpeed * Math.sin(windBearing);
	  currentCanopyLocation = moveCoords(currentCanopyLocation, dx * speedCoeff, dy * speedCoeff);	  
	  var bearingLineEnd = moveCoords(currentCanopyLocation, bearingLineLength * Math.cos(currentCanopyBearing), bearingLineLength * Math.sin(currentCanopyBearing));
	  
	  canopyCircle.setCenter(currentCanopyLocation);
	  canopyBearingLine.setPath([currentCanopyLocation, bearingLineEnd]);
  }, updateFrequency);
}

function onKeyDown(e) {
    e = e || window.event;
    if (e.keyCode == '37') { // left arrow
        currentCanopyBearing += bearingUpdateSpeed;
    }
    else if (e.keyCode == '39') { // right arrow
        currentCanopyBearing -= bearingUpdateSpeed;
    }
}

function initialize() {
  initializeMap(sibsonAirfieldLocation);
  initializeCanopyDrawing(sibsonAirfieldLocation);
  runCanopyPositionUpdate();
}

google.maps.event.addDomListener(window, 'load', initialize);
document.onkeydown = onKeyDown;