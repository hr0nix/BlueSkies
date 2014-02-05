function startTutor(id) {
    var allDialogs; // List of all dialog objects, populated from html automagically
    var nextDialogIndex;

    function closeDialog() {
        $(this).dialog("close");
    }

    function nextDialog() {
        if (nextDialogIndex < allDialogs.size()) {
            allDialogs.eq(nextDialogIndex).dialog("open");
            nextDialogIndex++;
        } else {
            saveSetting("tutor-finished", true);
        }
    }

    var commonOptions = {
        autoOpen: false,
        resizable: false,
        draggable: false,
        minHeight: 0,
        modal: true,
        width: "auto",
        show: "fade",
        hide: "fade",
        dialogClass: "no-close,highlight-title",
        buttons: [ {
            text: "Skip tutor",
            click: function() {
                nextDialogIndex = allDialogs.size() - 1;
                $(this).dialog("close");
            }
        }, {
            text: "Got it!",
            click: closeDialog
        }
        ],
        close: nextDialog
    };

    var specificOptions = {
        "welcome": {
            title: "Welcome",
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
            position: {
                of: "#map-canvas-container",
                my: "left top",
                at: "center+10 center+10"
            }
        },
        "wind": {
            position: {
                of: "#wind-direction-slider",
                my: "right center",
                at: "left center"
            }
        },
        "reachset": {
            position: {
                of: "#display-ui-element-buttons",
                my: "right center",
                at: "left center"
            }
        },
        "restart": {
            position: {
                of: "#tutor-button",
                my: "right center",
                at: "left center"
            }
        },
        "rightclick": {
            modal: false,
            buttons: [],
            dialogClass: "highlight-title",
            position: {
                of: "#map-canvas-container",
                my: "top center",
                at: "center top+150"
            }
        }
    };
    
    var allDialogs = $(id).children("div");

    allDialogs.each(function(){
        var specific = specificOptions[$(this).attr("id").replace("dialog-","")];
        $(this).dialog(commonOptions).dialog("option", specific);
    });

    nextDialogIndex = readSetting("tutor-finished", false) ? allDialogs.size() - 1 : 0;
    nextDialog();

    $("#tutor-button").click(function() {
        nextDialogIndex = 0;
        var visible = allDialogs.filter(":visible").dialog("close");
        if (visible.size() == 0) {
            nextDialog();
        }
    });
}
