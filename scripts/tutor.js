function startTutor() {
    var allDialogs; // List of all dialog objects, populated from html automagically
    var nextDialogIndex = 0;

    function closeDialog() {
        $(this).dialog("close");
    }

    function nextDialog() {
        if (nextDialogIndex < allDialogs.size()) {
            allDialogs.eq(nextDialogIndex).dialog("open");
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
        buttons: [ {
            text: "Skip tutor",
            click: function() {
                nextDialogIndex = allDialogs.size();
                $(this).dialog("close");
            }
        }, {
            text: "Got it",
            click: closeDialog
        }
        ],
        close: function() {
            nextDialogIndex++;
            nextDialog();
        }
    };

    var specificOptions = {
        "language": {
            position: {
                of: "#right-panel"
            }
        },
        "rightclick": {
            position: {
                of: "#map-canvas-container",
                my: "top center",
                at: "center top+100"
            }
        },
        "reachset": {
            position: {
                of: "#display-ui-element-buttons",
                my: "right center",
                at: "left center"
            }
        }
    };
    
    var allDialogs = $("#dialogs > div");

    allDialogs.each(function(){
        var options = specificOptions[$(this).attr("id").replace("dialog-","")];
        $(this).dialog(options, commonOptions);
    });

    nextDialog();

    $("#tutor-button").click(function() {
        nextDialogIndex = 0;
        nextDialog();
    });
}
