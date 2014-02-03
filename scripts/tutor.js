function startTutor() {
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
        modal: false,
        width: "auto",
        show: "fade",
        hide: "fade",
        dialogClass: "no-close",
        buttons: [ {
            text: "Skip tutor",
            click: function() {
                nextDialogIndex = allDialogs.size();
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
            title: "Welcome"
        },
        "reachset": {
            title: "dd",
            position: {
                of: "#display-ui-element-buttons",
                my: "right center",
                at: "left center"
            }
        },
        "rightclick": {
            modal: false,
            buttons: [],
            dialogClass: "",
            position: {
                of: "#map-canvas-container",
                my: "top center",
                at: "center top+100"
            }
        }
    };
    
    var allDialogs = $("#dialogs > div");

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
