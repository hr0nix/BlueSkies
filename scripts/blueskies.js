(function() {
"use strict";
////// Parameters
// Canopy modes
var horizontalSpeeds = [0, 2.5, 5, 7.5, 10],
    verticalSpeeds = [10, 7, 5, 3, 5],
    reachSetSteps = (horizontalSpeeds.length - 1) * 2 + 1, // we need this kind of step to make sure that during interpolations into the above arrays we get the exact hits
    lastReachSetSteps = 3; // Experiments show that only the faster modes are efficient enough to be on the edge of reachability sets, so we only compute and draw those

////// Helpers

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

function interpolate(arr, coeff) {
    if (coeff <= 0) {
        return arr[0];
    }

    if (coeff >= 1) {
        return arr[arr.length - 1];
    }

    var scaledCoeff = coeff * (arr.length - 1),
        index1 = Math.floor(scaledCoeff),
        index2 = Math.ceil(scaledCoeff),
        mixCoeff = scaledCoeff - index1;
    return arr[index1] * (1 - mixCoeff) + arr[index2] * mixCoeff;
}

function getCanopyHorizontalSpeed(mode) {
    return interpolate(horizontalSpeeds, mode);
}

function getCanopyVerticalSpeed(mode) {
    return interpolate(verticalSpeeds, mode);
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

function reachSetFromOrigin(wind, altitude, u) {
    var speedH = getCanopyHorizontalSpeed(u),
        speedV = getCanopyVerticalSpeed(u),
        time = altitude / speedV,

        windSpeed = wind.speed(),
        windDirection = wind.direction();
    return {
        center: [
            time * windSpeed * Math.sin(windDirection),
            time * windSpeed * Math.cos(windDirection)
        ],
        radius: time * speedH
    };
}

function computeReachSet(sourceLocation, altitude, wind, reachability) {
    var result = Array(lastReachSetSteps);
    // Note that in the interface we forbid the stall mode. But still, in most cases it doesn't lead to the edge of the reach set
    for (var i = 0; i < lastReachSetSteps; i++) {
        var u = 1 / (reachSetSteps - 1) * (i + reachSetSteps - lastReachSetSteps),
            set = reachSetFromOrigin(wind, altitude, u),
            shiftFactor = reachability ? 1 : -1; // for reachability we shift downwind, for controllability -- upwind

        result[i] = {
            center: moveCoords(sourceLocation,
                shiftFactor * set.center[0],
                shiftFactor * set.center[1]),
            radius: set.radius
        };
    }

    return result;
}

function computeHeadings(wind, pattern, speedH) {
    var rotationFactor = pattern.lhs() ? 1 : -1,

        windSpeed = wind.speed(),
        windDirection = wind.direction(),
        landingDirection = pattern.landingDirection();
    // We need to set up heading array to give the headings we hold on each leg, from ground up,
    // i.e. heading[0] is the heading we hold on the final, heading[1] on the crosswind leg etc
    if (windSpeed < speedH) {
        return [
            landingDirection,
            landingDirection + rotationFactor * Math.PI / 2, // In ordinary winds we hold perpendicular ground track
            landingDirection + Math.PI
        ].map(function(track) { return createGroundTrack(windSpeed, windDirection, speedH, track); });
    } else {
        // For now, strong winds imply into-the wind landing no matter what landing direction is given. This needs further thought.
        return [
            Math.PI + windDirection,
            Math.PI + windDirection + rotationFactor * Math.PI / 8, // in strong winds we move backwards with some arbitrary low angle to the wind
            Math.PI + windDirection // Into the wind
        ];
    }
}

function computeLandingPattern(location, wind, pattern) {
    var controlPointAltitudes = [100, 200, 300],
        patternMode = 0.8,
        speedH = getCanopyHorizontalSpeed(patternMode),
        speedV = getCanopyVerticalSpeed(patternMode),

        windSpeed = wind.speed(),
        windDirection = wind.direction(),

        heading = computeHeadings(wind, pattern, speedH),

        prevPoint = location,
        prevAltitude = 0,

        result = [location];
    for (var i = 0; i < controlPointAltitudes.length; i++) {
        var time = (controlPointAltitudes[i] - prevAltitude) / speedV,
            point = moveInWind(prevPoint, windSpeed, windDirection, speedH, heading[i], -time); // Note that we specify the wind speed and canopy heading as though we're flying the pattern. But we give negative time, so we get the point where we need to start to arrive where we need.

        prevPoint = point;
        prevAltitude = controlPointAltitudes[i];
        result.push(point);
    }

    return result;
}

// Export
window.moveInWind = moveInWind;
window.getCanopyHorizontalSpeed = getCanopyHorizontalSpeed;
window.getCanopyVerticalSpeed = getCanopyVerticalSpeed;
window.computeLandingPattern = computeLandingPattern;
window.computeReachSet = computeReachSet;
window.lastReachSetSteps = lastReachSetSteps;
})();
