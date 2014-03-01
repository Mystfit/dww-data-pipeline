var dbUrl = "js/jumps_(2).json"

    function loadData() {
        initialiseLoadBar();
        //load the JSON data 
        $.ajax({
            //access the JSON file on the server
            type: "GET",
            contentType: "application/json",
            url: dbUrl,
            success: function(obj) {
                performDataImportPipeline(obj);
            }
        });
    }

    /**
     * Sets up the JQuery UI load bar, to track download progress. Hides all other DOM elements for the
     * period that the load bar is active.
     **/
    function initialiseLoadBar() {
        $("#progressBar").progressbar({
            value: 0,
            create: function(event, ui) {
                $("#map3d").hide();
                $("#sideBar").hide();
                $("#sideBarToggle").hide();
            }
        });
    }

    /**
     * Define a new maximum 100% value to the loadbar.
     *
     * @param max - an integer specifying the maximum value of this load bar
     **/
    function setLoadBarMax(max) {
        $("#progressBar").progressbar('option', 'max', max);
    }

    /**
     * Adds one to the value of this load bar (i.e. incrementally animating it).
     * Note, increment will fail if the load bar's maximum value is unspecified
     * or if the load bar's current value is greater than or equal to the currently
     * specified maximum.
     **/
    function incrementLoadBar() {
        var max = $("#progressBar").progressbar('option', 'max');
        if (max == undefined) return;
        var val = $("#progressBar").progressbar('value');
        if (val < max) {
            $("#progressBar").progressbar('option', 'value', val + 1);
        }
    }

    /**
     * Closes the JQuery UI load bar, and in doing so, reveals all other DOM elements.
     **/
    function closeLoadBar() {
        $("#map3d").show('fade', 'slow');
        $("#sideBar").show('fade', 'slow');
        $("#sideBarToggle").show('fade', 'slow');
        $("#progressBar").hide('fold', 'slow');

    }