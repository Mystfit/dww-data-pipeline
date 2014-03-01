/**
 * Initialisation call to load the GE plugin in the browser.
 **/
function init() {
    google.earth.createInstance('map3d', initCB, failureCB);
}

/**
 * The callback code to be run upon the successful initialisation of the Google Earth plugin.
 *
 * @param instance - the GE plugin variable
 **/
function initCB(instance) {
    ge = instance;
    initialisePluginOptions();
    restrictAltitudeAbove(minHeight);
    // animateFlyIn();
    loadData();
}

/**
 * The callback code to be run upon the unsuccessful initialisation of the Google Earth plugin.
 *
 * @param errorCode - the code detailing the error that caused the plugin to fail
 **/
function failureCB(errorCode) {
    alert("Script failed to load GE Plugin. Please refresh the page.");
    console.log("Script Error: Failed to load GE plugin. \n" + errorCode);
}

/**
 * Sets the various plugin visibilities to their preferred status for this application.
 */
function initialisePluginOptions() {
    ge.getWindow().setVisibility(true); // make the plugin visible 
    ge.getNavigationControl().setVisibility(ge.VISIBILITY_AUTO); // turn on the navigation widget
    ge.getTime().getControl().setVisibility(ge.VISIBILITY_AUTO); // turn on the time slider widget 
    ge.getOptions().setAtmosphereVisibility(true); // turn on the atmosphere graphic layer 
    ge.getOptions().setOverviewMapVisibility(false); // turn off the 2D navigation map 
    ge.getNavigationControl().setStreetViewEnabled(false); // disable street view
    ge.getOptions().setAutoGroundLevelViewEnabled(false); // disable the ability to switch to ground level automatically
    ge.getOptions().setFadeInOutEnabled(true); // allow fade transitions in the plugin
    ge.getOptions().setFlyToSpeed(1); //how fast the camera travels
    ge.getTime().getControl().setVisibility(ge.VISIBILITY_HIDE); // turn off the time slider (to be replaced with a custom Processing widget)
}

/**
 * Sets a zooming restriction to the specified height, so that the camera will reposition itself to the minimum height
 * everytime the user attempts to go below this threshold.
 *
 * @param lowerLimit - the lowest altitude that the camera is allowed to go.
 */
function restrictAltitudeAbove(lowerLimit) {
    google.earth.addEventListener(ge.getView(), 'viewchange', function() {
        var camera = ge.getView().copyAsCamera(ge.ALTITUDE_ABSOLUTE);
        if (camera.getAltitude() < lowerLimit) {
            camera.setAltitude(lowerLimit + 100); //+100 provides a 'cushion' to move around in, above the threshold, for ease of use 
            ge.getView().setAbstractView(camera);
        }
    });
}

/**
 * Creates a fly-in animation that is activated upon the first mouse click.
 */
function animateFlyIn() {
    var spin = function() {
        spinGlobe(25);
    }
    var zoomBegin = function() {
        setView(startLat, startLon, minHeight * 2);
        google.earth.removeEventListener(ge.getWindow(), 'mouseup', zoomBegin);
    }
    var transitionFromTitle = function() {
        google.earth.removeEventListener(ge, 'frameend', spin);
        google.earth.removeEventListener(ge.getWindow(), 'mousedown', transitionFromTitle);
    }
    google.earth.addEventListener(ge.getWindow(), 'mousedown', transitionFromTitle);
    google.earth.addEventListener(ge.getWindow(), 'mouseup', zoomBegin);
    google.earth.addEventListener(ge, 'frameend', spin);
}


//------------------------------------------------------------
//SCRIPT START
google.load("earth", "1", {
    "other_params": "sensor=false"
});
google.setOnLoadCallback(init);