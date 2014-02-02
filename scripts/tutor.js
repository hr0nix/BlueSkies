function startTutor() {
    var lastShownDialog;
    var skipTutor = false;

    function closeDialog() {
        $(this).dialog("close");
    }

    var commonOptions = {
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
                skipTutor = true;
                $(this).dialog("close");
            }
        }, {
            text: "Next",
            click: closeDialog
        }
        ]
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

    lastShownDialog = allDialogs.first();

    allDialogs.each(function(){
        //var next = $(this).next();
        var options = specificOptions[$(this).attr("id").replace("dialog-","")];
        //$.extend(options, commonOptions);
        $(this).dialog(options, commonOptions);
    });
}
