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

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function isDialogOpen(id) {
    var $id = $(id);
    return $id.data("ui-dialog") && $id.dialog("isOpen");
}

function createLatLng(coords) {
    return new google.maps.LatLng(coords[0], coords[1]);
}

function metersToFeet(meters) {
    return meters * 3.2808399;
}

function metersPerSecToMilesPerHour(metersPerSec) {
    return metersPerSec * 2.23693629;
}

function formatSpeed(metersPerSec, significantDigits) {
    significantDigits = significantDigits || 0;
    return sim.display.useMetric()
        ? $.number(metersPerSec, significantDigits) + " " + localize("ms")
        : $.number(metersPerSecToMilesPerHour(metersPerSec), significantDigits) + " " + localize("mph");
}

function formatAltitude(meters, significantDigits) {
    significantDigits = significantDigits || 0;
    return sim.display.useMetric()
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

function formatCoords(latlng, significantDigits) {
    significantDigits = significantDigits || 6;
    if (!latlng) {
        return '';
    }
    return '('
        + $.number(latlng.lat(), significantDigits) + ', '
        + $.number(latlng.lng(), significantDigits)
        + ')';
}
