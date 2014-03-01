/**
A collection of all functions necessary to initalise and import the IMDB data into the Google Earth plugin.
**/

var interactiveMode = true; // special variable that changes this application from a display visualisation into an interactive tool

var ge; // the google earth instance
var studios = {}; // the collection of all studios in this visualisation
var hubs = {}; // the collection of all hubs in this visualisation
var paths; // the collection of all generated paths (indexed by GE id) 
var roles = []; // the array of all roles in the JSON data
var selectedRoles = []; // the array of all roles that are currently displayed in the visualisation
var selectedRoleColours = ["#FF9C98", "#A97EE8", "#8BE6FF", "#E2FFB1", "#E8C47E"]; // corresponding to the above, this array effectively maps roles to colours for UI purposes 
var graphEmptyFill = "#E2EAE9"; // the colour to fill in empty space on the graph 
var pathBuilder = new Worker('js/pathCreator.js'); // the worker instance to asynchronously perform path creation calculations
var densityCalculator = new Worker('js/densityCalc.js'); // the worker instance to asynchronously perform studio density calculations
var selectedStudio = "Weta Digital"; // the string name of the currently selected studio 
var startLat = -41.306424; //the camera will set focus to this as the starting latitude ordinate 
var startLong = 174.824357; // the camera will set focus to this as the starting longitude ordinate
var minHeight = 600000; // the camera can never dive below this minimum altitude
var placemarkAltitude = 100; //placemarks are given this much altitude above the earth's surface 
var arcRise = 3.0; // how much of a bulge there is in the parabolic arc segments 
var studioStyle; // the styleMap with which to render the studio placemarks. Default placemark will be used if this instance is null.
var vizTimeStart = "2000-01-01"; // the date that the animation begins from
var vizTimeEnd = "2015-12-31"; // the date that the animation ends at
var currentTime = [vizTimeStart, undefined]; // the current time of the GE Internal clock 
var player; // the playback time interval object 
var playbackSpeed = 1; // how fast the animation plays back 
var viewRange = false; //whether or not we are viewing the animation with a timespan or a timestamp 
var KML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?> " +
    "<kml xmlns=\"http://www.opengis.net/kml/2.2\" " +
    "xmlns:gx=\"http://www.google.com/kml/ext/2.2\"> \n<Document>\n"; // the KML instance that hold path data, to be parsed by the plugin

/**
Manages the data import pipeline into the GE Plugin.

@param dataSet - the JSON object that contains all IMDB data.
**/
function performDataImportPipeline(dataSet) {
    //perform dataSet sanity check 
    if (dataSet == null || dataSet == undefined) {
        alert("DataSet failed to load via AJAX request!");
        return;
    }
    //set the load bar maximum value
    setLoadBarMax(dataSet.people.length);
    //generate custom VFX logos to represent studios
    studioStyle = defineStudioStyling('studioStyleMap', 'https://sites.google.com/site/robbieskml/kmltester/VFXLogoNoRing.png', 'https://sites.google.com/site/robbieskml/kmltester/VFXLogoNoRingHilite.png');
    //place all the studios at specified lat/lon coordinates throughout the globe
    importStudioData(dataSet);
    //populate the array of roles
    importRoleData(dataSet);
    //load the UI
    loadUI();
    //import studio density data
    if (densityCalculator) {
        densityCalculator.addEventListener('message', function(e) {
            cmd = e.data.cmd;
            switch (cmd) {
                case 'complete':
                    studios = e.data.contents;
                    break;
                case 'updated':
                    var cnt = e.data.contents;
                    if (cnt != null) {
                        onDensityReportReturned(cnt);
                    }
                    break;
                default:
                    console.log("Worker issued an unrecognised command!");
                    console.log(cmd);
            }
        }, false);
        densityCalculator.postMessage({
            cmd: 'initialise',
            dataSet: dataSet,
            studios: studios
        });
    }
    //initialise the path builder instance
    if (pathBuilder) {
        pathBuilder.addEventListener('message', function(e) {
            var cmd = e.data.cmd;
            var cnt = e.data.contents;
            switch (cmd) {
                case 'update':
                    incrementLoadBar();
                    break;
                case 'complete':
                    ge.getFeatures().appendChild(ge.parseKml(cnt.KML));
                    paths = cnt.paths;
                    closeLoadBar();
                    pathBuilder.terminate();
                    requestDensityUpdate(selectedStudio, getTime("year"));
                    break;
                default:
                    console.log("Worker issued an unrecognised command!");
                    console.log(cmd);
            }
        }, false);
        pathBuilder.postMessage({
            dataSet: dataSet,
            studios: studios,
            arcRise: arcRise,
            placemarkAltitude: placemarkAltitude,
            roles: roles
        });
    }
}

/**
Populates the studio collection object and plots each studio at the specified lat/lon on the GE globe.

@param dataSet - the JSON object that contains all IMDB data.
**/
function importStudioData(dataSet) {
    for (var i = 0; i < dataSet.people.length; i++) {
        var person = dataSet.people[i];
        for (var u = 0; u < person.rels.length; u++) {
            var studio = person.rels[u].matchedCompanyName;
            if (!studios[studio]) {
                //called upon studio initialisation
                studios[studio] = {};
                var hubName = studios[studio].hub = person.rels[u].region;
                var coords = dataSet.hubs[hubName].split(',');
                studios[studio].lat = parseFloat(coords[0]);
                studios[studio].lon = parseFloat(coords[1]);
                studios[studio].density = {};
                setStudio(studio, studios[studio].lat, studios[studio].lon, placemarkAltitude);
                //now add to the hub object
                if (!hubs[studios[studio].hub]) {
                    hubs[studios[studio].hub] = {};
                    hubs[studios[studio].hub].single = true;
                } else {
                    hubs[studios[studio].hub].single = false;
                }
            }
        }
    }
}

/**
 * Sets a VFX Studio placemark on the Earth.
 *
 * @param name - the string name of this studio
 * @param latitude - the latitude of the placemark
 * @param longitude - the longitude of the placemark
 * @param verticalOffset - the altitude of this placemark above the ground
 */
function setStudio(name, latitude, longitude, verticalOffset) {
    //create the placemark
    var studio = ge.createPlacemark(name);
    //set the placemark's location
    var point = ge.createPoint('');
    point.setLatitude(latitude);
    point.setLongitude(longitude);
    point.setAltitude(verticalOffset);
    point.setAltitudeMode(ge.ALTITUDE_ABSOLUTE);
    studio.setGeometry(point);
    //set the studio placemark's style as the styleMap 
    studio.setStyleSelector(studioStyle);
    //add studio to the earth
    ge.getFeatures().appendChild(studio);
    //make the studio interactive if the mouse hovers over it 
    setStudioOnOffListener(studio);
}

/**
 * Gives a VFX Studio placemark interactive functionality if the mouse hovers over it.
 * Specifically, updates the string parameter in the Processing HUD sketch on event fire,
 * altering the display of the currently selected studio.
 *
 * Edit: Inclusion of 'click' event fire for a studio - this means that for all studios,
 * a click needs to be made before you can see its information (this patch accounts for
 * single studios) (GE provides default 'explosion' functionality for placemarks atop
 * one another, and so this behaviour is used for multilple hub instances).
 *
 * @param studio - the studio object to add the mouse hover listeners to.
 **/
function setStudioOnOffListener(studio) {
    google.earth.addEventListener(studio, 'click', function() {
        if (hubs[studios[studio.getId()].hub].single == true) {
            var outcome = selectStudio(studio.getId());
            if (outcome) {
                requestDensityUpdate(studio.getId(), getTime("year"));
            }
        }
    });
    google.earth.addEventListener(studio, 'mouseover', function() {
        if (hubs[studios[studio.getId()].hub].single == false) {
            var outcome = selectStudio(studio.getId());
            if (outcome) {
                requestDensityUpdate(studio.getId(), getTime("year"));
            }
        }
    });
    // google.earth.addEventListener(studio, 'mouseout', function() {
    //     selectStudio("");
    //     densityCalculator.postMessage({
    //         cmd: 'update',
    //         studioName: '',
    //         year: [null, null]
    //     });
    // });
}

/**
 * Initialisation function that sets two images as icon placemarks that respresent studios on the globe.
 * Two images are required: one, to represent an inactive state, and the other to represent the 'mouseover'
 * state.
 *
 * @param name - the unique identifier for this studio style map
 * @param imgUrl - the image url to represent the inactive studio state
 * @param hiliteUrl - the image url to represent the active/'mouseover' studio state
 *
 * @return the styleMap instance, which can be applied to placemarks.
 */
function defineStudioStyling(name, imgUrl, hiliteUrl) {
    //define the style map - for switching between highlighted and unhighlighted icons 
    var styleMap = ge.createStyleMap(name);
    //define the studio icon (an icon must sit inside a style, which in turn is inside the placemark)
    var style = ge.createStyle('');
    var icon = ge.createIcon('');
    icon.setHref(imgUrl);
    style.getIconStyle().setIcon(icon);
    style.getIconStyle().setScale(8.0);
    //define the highlight studio icon 
    var hiStyle = ge.createStyle('');
    var hiIcon = ge.createIcon('');
    hiIcon.setHref(hiliteUrl);
    hiStyle.getIconStyle().setIcon(hiIcon);
    hiStyle.getIconStyle().setScale(8.4);
    //add the two styles to the style map
    styleMap.setNormalStyle(style);
    styleMap.setHighlightStyle(hiStyle);
    return styleMap;
}

/**
 * Populates the role array with the different roles present in the JSON data.
 *
 * @param dataSet - the JSON data
 **/
function importRoleData(dataSet) {
    for (var i = 0; i < dataSet.people.length; i++) {
        var person = dataSet.people[i];
        for (var u = 0; u < person.rels.length; u++) {
            var role = person.rels[u].personMappedRole;
            if (role == "" || role == undefined) continue;
            if ($.inArray(role, roles) == -1) { //not currently in array
                roles[roles.length] = role;
            }
        }
    }
    for (var i = 0; i < 5; i++) {
        selectedRoles[i] = roles[i];
    }
}

/**
 * Calls update on the density worker to recalulate the current density report.
 *
 * @param studioName - the name of the studio to select
 * @param year - the year we need the report to describe (must be within timeslider range min-max)
 **/
function requestDensityUpdate(studioName, year) {
    if (!densityCalculator) return;
    densityCalculator.postMessage({
        cmd: 'update',
        studioName: studioName,
        year: year
    });
}

/**
 * Callback function to handle UI updates upon the successful update of a density report.
 *
 * @param densityReport - the returned report instance
 **/
function onDensityReportReturned(densityReport) {
    var totalDensity = densityReport.total;
    updateDensityTally(totalDensity);
    var data = [];
    var options = {
        animationEasing: "easeOutCirc",
        animationSteps: 20
    };
    var viewedTotal = 0;
    var dataIndex = 0;
    for (var i = 0; i < selectedRoles.length; i++) {
        if (selectedRoles[i] == null) continue;
        var dataEntry = {};
        dataEntry.value = getDensity(densityReport, selectedRoles[i]);
        dataEntry.color = getAssociatedRoleColor(selectedRoles[i]);
        data[dataIndex] = dataEntry;
        viewedTotal += dataEntry.value;
        dataIndex++;
    }
    var dataEntry = {};
    dataEntry.value = totalDensity == 0 ? 1 : totalDensity - viewedTotal; // i.e. that which is not viewed in this graph
    dataEntry.color = graphEmptyFill;
    data[data.length] = dataEntry;
    updateRoleDensityGraph(data, options);
}

/**
 * Extracts a density from the current density report. No parameters will return the total
 * density. Optionally providing a parameter (a valid role name), will return the density
 * associated with that particular role in the density report.
 *
 * @param densityReport - the density report to work from
 * @param role - [OPT] if specified, requests the number of people for this role only
 * @returns the number of people in total for this density report (=> role unspecified)
 *          or the number of people for a specific role (=> valid role specified)
 **/
function getDensity(densityReport, role) {
    if (!densityReport) return 0;
    if (!role) return densityReport.total;
    return densityReport[role] ? densityReport[role] : 0;
}

/**
 * Gets the current time of the GE internal clock and returns a string[] representing this value
 * in YYYY-MM-DD format. If viewRange is false (i.e. timeStamp) one string value will be returned;
 * otherwise, (timeSpan) a beginning and an end time value will be returned.
 *
 * @param specification - [OPT] returns only the part of the time specified by the enum: "year", "month", "day"
 *
 * @returns a string[] of the current time in YYYY-MM-DD format.
 **/
function getTime(specification) {
    if (!specification) return currentTime;
    var elementsA = currentTime[0].split('-');
    var elementsB = currentTime[1] ? currentTime[1].split('-') : [undefined, undefined, undefined];
    if (specification == "year") return [elementsA[0], elementsB[0]];
    else if (specification == "month") return [elementsA[1], elementsB[1]];
    else if (specification == "day") return [elementsA[2], elementsB[2]];
    else return currentTime; //illegal argument returns default 
}


/**
 * Sets the GE internal clock to the specified date in YYYY-MM-DD format.
 * Also updates the Processing HUD, and the currentTime variable with the current time.
 *
 * @param date - the date with which to set the clock (in YYYY-MM-DD format).
 * @param hint - [OPT] a hint for the UI elements, either 'STAMP' or 'SPAN'. The former
 *                will display the date as one value, whereas the later will display the date
 *                as two values.
 * @param endDate - [OPT] if an endDate is specified, the clock will be set to a timeSpan,
 *                  rather than a timeStamp, presenting a view over a range of time. Must
 *                  be specified in YYYY-MM-DD format.
 **/
function setTime(date, hint, endDate) {
    if (!endDate) {
        var timeStamp = ge.createTimeStamp('');
        timeStamp.getWhen().set(date);
        if (hint == 'STAMP') updateUITime(date);
        else updateUITime();
        ge.getTime().setTimePrimitive(timeStamp);
        currentTime[0] = date;
        currentTime[1] = "";
    } else {
        var timeSpan = ge.createTimeSpan('');
        timeSpan.getBegin().set(date);
        timeSpan.getEnd().set(endDate);
        if (hint == 'SPAN') updateUITime(date, endDate);
        else if (hint == 'STAMP') updateUITime(date);
        else updateUITime();
        ge.getTime().setTimePrimitive(timeSpan);
        currentTime[0] = date;
        currentTime[1] = endDate;
    }
}

/**
 * Repositions the camera's focus to the specified lat/lon coordinates and pulls the camera backward
 * to the specified range.
 *
 * @param lat - the latitude to focus upon
 * @param lon - the longitude to focus upon
 * @param range - the altitude from which to observe
 */
function setView(lat, lon, range) {
    var lookAt = ge.createLookAt('');
    lookAt.setLatitude(lat);
    lookAt.setLongitude(lon);
    lookAt.setRange(range);
    ge.getView().setAbstractView(lookAt);
}

/**
 * Turns the visibility of paths on/off in the GE Globe viewer.
 * Paths are categorised by role, and the user has control over
 * these groups.
 *
 * @param on - boolean conditional as to whether paths should be on or off
 * @param role - [OPT] specifying a role will only effect paths categorised
 *                under that role. Leaving the role parameter blank will
 *                cause all paths to be effected.
 **/
function viewPaths(on, role) {
    if (ge) {
        if (ge.getElementById("allPaths")) {
            ge.getElementById("allPaths").setVisibility(on);
        }
    }
}

/**
 * Spins the globe about its axis.
 *
 * @param speed - how fast to spin the globe. Orientation of numbers specify clockwise/anticlockwise rotation.
 */
function spinGlobe(speed) {
    var camera = ge.getView().copyAsCamera(ge.ALTITUDE_ABSOLUTE);
    camera.setLongitude(camera.getLongitude() + speed);
    ge.getView().setAbstractView(camera);
}