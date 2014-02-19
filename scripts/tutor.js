function startTutor(id) {
    var allDialogs, // List of all dialog objects, populated from html automagically
        nextDialogIndex;

    function closeDialog() {
        $(this).dialog("close");
    }

    function nextDialog() {
        if (nextDialogIndex < allDialogs.size()) {
            if (nextDialogIndex == allDialogs.size() - 1) {
                saveSetting("tutor-finished", true);
                ga('send', 'event', 'tutor', 'finished', {'nonInteraction': true});
            }

            allDialogs.eq(nextDialogIndex).dialog("open");
            nextDialogIndex++;
        }
    }

    var highlightClass = "tutor-highlight";

    var commonOptions = {
        autoOpen: false,
        resizable: false,
        draggable: false,
        minHeight: 0,
        modal: false,
        width: "auto",
        show: "fade",
        hide: "fade",
        dialogClass: "tutor",
        performHighlighting: true,
        buttons: [ {
            text: localize("Got it!"),
            click: closeDialog
        }, {
            text: localize("Skip tutor"),
            click: function() {
                nextDialogIndex = allDialogs.size() - 1;
                ga('send', 'event', 'tutor', 'skiptutor');
                $(this).dialog("close");
            }
        }
        ],
        open: function() {
            var $this = $(this);
            if ($this.dialog('option', "performHighlighting")) {
                $($this.dialog('option', 'position').of).addClass(highlightClass);
            }
        },
        close: function() {
            var $this = $(this);
            if ($this.dialog('option', "performHighlighting")) {
                $($this.dialog('option', 'position').of).removeClass(highlightClass);
            }
            nextDialog();
        }
    };

    var specificOptions = {
        "welcome": {
            modal: true,
            performHighlighting: false,
            position: {
                of: "#map-canvas-container"
            }
        },
        "dz-selection": {
            position: {
                of: "#dz-finder",
                my: "center top",
                at: "center bottom+10"
            }
        },
        "target": {
            performHighlighting: false,
            position: {
                of: "#map-canvas-container",
                my: "left top",
                at: "center+10 center+10"
            }
        },
        "wind": {
            position: {
                of: "#wind-conditions",
                my: "right top",
                at: "left top"
            }
        },
        "reachset": {
            position: {
                of: "#display-ui-element-buttons",
                my: "right top",
                at: "left bottom"
            }
        },
        "pattern": {
            position: {
                of: "#pattern-settings",
                my: "right top",
                at: "left top"
            }
        },
        "restart": {
            position: {
                of: ".tutor-button:visible",
                my: "right top",
                at: "left bottom"
            }
        },
        "rightclick": {
            modal: false,
            performHighlighting: false,
            buttons: [],
            position: {
                of: "#map-canvas-container",
                my: "center bottom",
                at: "center bottom-50"
            }
        }
    };

    var allDialogs = $(id).children("div");

    allDialogs.each(function() {
        var specific = specificOptions[$(this).attr("id").replace("tutor-","")];
        $(this).dialog(commonOptions).dialog("option", specific);
    });

    var finished = readSetting("tutor-finished", false);
    nextDialogIndex = finished ? allDialogs.size() - 1 : 0;
    nextDialog();
    if (finished) {
        setTimeout(function() {
            $("#tutor-rightclick").dialog("close");
        }, 3000);
    }

    $(".tutor-button").click(function() {
        ga('send', 'event', 'tutor', 'restart');
        nextDialogIndex = 0;
        var visible = allDialogs.filter(function() { return $(this).dialog("isOpen") }).dialog("close");
        if (visible.size() == 0) {
            nextDialog();
        }
    });
}
