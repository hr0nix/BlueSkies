(function () {
"use strict";
    sim.persistence.init();
    parseParameters(sim);
    ko.applyBindings(sim);

    sim.display.fullscreen.subscribe(function() {
        google.maps.event.trigger(map, "resize");
    });

    var $dzMenu = $("#dz-selection-menu"),
        firstLevelPosition = { my: "left top", at: "left bottom" },
        otherLevelsPosition = { my: "left top", at: "right top" };
    $dzMenu.menu({
        select: onDzMenuItemSelected,
        position: firstLevelPosition,
        blur: function() {
            $(this).menu("option", "position", firstLevelPosition);
        },
        focus: function(e, ui) {
            if (!ui.item.parent().is($dzMenu)) {
                $(this).menu("option", "position", otherLevelsPosition);
            }
        }
    });

    var accordionOptions = { collapsible: true, heightStyle: "content" };
    $("#right-panel > div").accordion(accordionOptions);

    $(".legend-button").click(function() {
        showLegendDialog("#legend-dialog");
    });
    $(".about-button").click(function() {
        showAboutDialog("#about-dialog");
    });
    startTutor("#tutor-dialogs");
})();
