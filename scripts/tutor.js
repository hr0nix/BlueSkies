function startTutor() {
    $("#dialog-rightclick").dialog({
        resizable: false,
        draggable: false,
        minHeight: 0,
        modal: true,
        width: "auto",
        show: "fade",
        hide: "fade",
        position: {
            of: "#map-canvas-container",
            my: "top center",
            at: "center top+100"
        }
    });
}
