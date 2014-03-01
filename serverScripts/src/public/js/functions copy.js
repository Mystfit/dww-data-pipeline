/**
A collection of all functions necessary to initalise and import the IMDB data into the Google Earth plugin.
**/

var ge; // the google earth instance
var hud; // the hud processing instance 
var studios; // the collection of all studios in this visualisation
var worker = new Worker('pathCreator.js'); // the worker instance to asynchronously perform path creation calculations 
var startLat = -41.306424; //the camera will set focus to this as the starting latitude ordinate 
var startLong = 174.824357; // the camera will set focus to this as the starting longitude ordinate
var minHeight = 600000; // the camera can never dive below this minimum altitude
var placemarkAltitude = 100; //placemarks are given this much altitude above the earth's surface 
var arcRise = 3.0; // how much of a bulge there is in the parabolic arc segments
var lineStyle; // the colour and width to render the arc segments  
var studioStyle; // the styleMap with which to render the studio placemarks. Default placemark will be used if this instance is null.
var vizTimeStart = "1970-01-01"; // the date that the animation begins from
var vizTimeEnd = "2015-12-31"; // the date that the animation ends at
var player; // the playback time interval object 
var playbackSpeed = 10; // how fast the animation plays back 
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
    //initialise the worker instance
    if (worker) {
        worker.addEventListener('message', function(e) {
            incrementLoadBar();
        }, false);
        worker.postMessage(dataSet);
    }
    //generate a solid white line to plot paths 
    lineStyle = createKMLLineStyle("whiteLine", 'bbffffff', 3);
    //generate custom VFX logos to represent studios
    studioStyle = defineStudioStyling('https://sites.google.com/site/robbieskml/kmltester/VFXLogo.png', 'https://sites.google.com/site/robbieskml/kmltester/VFXLogoHilite.png');
    //place all the studios at specified lat/lon coordinates throughout the globe
    importStudioData(dataSet);
    //set all path placemarks and corresponding time data into the GE Plugin  
    importPathData(dataSet);
    //load the time control widget
    loadTimeControl();
    //finished loading - complete
    closeLoadBar();
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
            //create studio if studio by this name does not exist
            if (!studios.hasOwnProperty(studio)) createStudio(studio);
            //plot studio on globe if unplotted
            if (!ge.getElementById(studio)) setStudio(studio, studios[studio].lat, studios[studio].lon, placemarkAltitude);
        }
    }
}

/**
Interprets migratory paths between studios and plots these paths into the GE Plugin with the timespan 
specified in the dataset.

@param dataSet - the JSON object that contains all IMDB data. 
**/
function importPathData(dataSet) {
    for (var i = 0; i < dataSet.people.length; i++) {
        var person = dataSet.people[i];
        for (var u = 0; u < person.rels.length - 1; u++) {
            var fromStudio = person.rels[u].matchedCompanyName;
            var toStudio = person.rels[u + 1].matchedCompanyName;
            //CASE: No Movement
            if (fromStudio == toStudio) continue;
            //CASE: Movement between studios
            var fromYear = person.rels[u].movieReleaseYear;
            var toYear = person.rels[u + 1].movieReleaseYear;
            createPath(fromStudio, toStudio, interpolateTimeOverYear(person, fromYear, u), interpolateTimeOverYear(person, toYear, u + 1), arcRise, placemarkAltitude, lineStyle);
        }
    }
    KML += "\n</Document>\n</kml>"; //close tag the KML
    //add KML paths to the earth 
    ge.getFeatures().appendChild(ge.parseKml(KML));
}

/**
Consults the collection of studios, attempting to match the provided studio name. If a match exists, this
method returns, as the studio entry (lat, lon, density) has already been created. Otherwise, adds a new property to
the collection of studios, which is the name of this studio, and sets a new object under this property that 
holds the default lat/lon coordinates of 90, 0 (the North Pole). Also initialises the studio density to an empty object. 

@param studio - the name of the studio to be generated
**/
function createStudio(studio) {
    studios[studio] = {}; //create a new studio object and assign default values 
    studios[studio].lat = 90;
    studios[studio].lon = 0;
    studios[studio].density = {};
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
 * @param studio - the studio object to add the mouse hover listeners to.
 **/
function setStudioOnOffListener(studio) {
    google.earth.addEventListener(studio, 'mouseover', function() {
        if (hud) {
            hud.setStudioName(studio.getId());
        }
    });
    google.earth.addEventListener(studio, 'mouseout', function() {
        if (hud) {
            hud.setStudioName("");
        }
    });
}

/**
 * Initialisation function that sets two images as icon placemarks that respresent studios on the globe.
 * Two images are required: one, to represent an inactive state, and the other to represent the 'mouseover'
 * state.
 *
 * @param imgUrl - the image url to represent the inactive studio state
 * @param hiliteUrl - the image url to represent the active/'mouseover' studio state
 *
 * @return the styleMap instance, which can be applied to placemarks.
 */
function defineStudioStyling(imgUrl, hiliteUrl) {
    //define the style map - for switching between highlighted and unhighlighted icons 
    var styleMap = ge.createStyleMap('studioStyleMap');
    //define the studio icon (an icon must sit inside a style, which in turn is inside the placemark)
    var style = ge.createStyle('');
    var icon = ge.createIcon('');
    icon.setHref(imgUrl);
    style.getIconStyle().setIcon(icon);
    style.getIconStyle().setScale(4.0);
    //define the highlight studio icon 
    var hiStyle = ge.createStyle('');
    var hiIcon = ge.createIcon('');
    hiIcon.setHref(hiliteUrl);
    hiStyle.getIconStyle().setIcon(hiIcon);
    hiStyle.getIconStyle().setScale(4.2);
    //add the two styles to the style map
    styleMap.setNormalStyle(style);
    styleMap.setHighlightStyle(hiStyle);
    return styleMap;
}

/**
 * Creates a path between two specified studios over a given time. The line used to draw this path will
 * disappear when the endTime is reached. Note: the efficient use of gx:Track must be coded in KML as
 * currently the Google Earth Plugin API does not support the corresponding JavaScript function.
 *
 * @param studioName1 - the name of the studio that is the origin for the path
 * @param studioName2 - the name of the studio that is the destination for the path
 * @param timeStart - the starting timeStamp for this animation
 * @param timeEnd - the ending timeStamp for this animation
 * @param rise - how much of a parabolic bulge should occur in this path
 * @param verticalOffset - how high the origin and destination points should be off the ground
 * @param style - the style object used to draw this path. If none are specified, default styling will be used.
 */
function createPath(studioName1, studioName2, timeStart, timeEnd, rise, verticalOffset, style) {
    //first need to access the placemarks in the application 
    var studio1 = ge.getElementById(studioName1);
    var studio2 = ge.getElementById(studioName2);
    var s1lat = studio1.getGeometry().getLatitude();
    var s1lon = studio1.getGeometry().getLongitude();
    var s2lat = studio2.getGeometry().getLatitude();
    var s2lon = studio2.getGeometry().getLongitude();
    //now to create a line string between the two studios 
    //if (style != null && style != undefined) KML += style.kml;
    KML += "<Placemark>";
    if (style != null && style != undefined) KML += "<styleUrl>#" + style.name + "</styleUrl>";
    var diflat = findLatitudeDifference(s1lat, s2lat);
    var diflon = findLongitudeDifference(s1lon, s2lon);
    var maxCount = 50.0; //higher number => smoother curve => more work 
    var height = Math.random() * 50 + 50; //=> a random number between 50 and 100
    var KMLTimes;
    var KMLCoords;
    for (var count = 0; count <= maxCount; count++) {
        var lat = s1lat + diflat * count / maxCount;
        var lon = s1lon + diflon * count / maxCount;
        var countShift = count - maxCount / 2.0; //center relative to 0 for parabolic calculation 
        var alt = (-1 * Math.pow(countShift * rise, 2) + Math.pow(maxCount / 2.0 * rise, 2)) * height + verticalOffset; //adjust multiplier for height
        KMLTimes += "<when>" + interpolateTimeBetween(timeStart, timeEnd, count, maxCount) + "</when>\n";
        KMLCoords += "<gx:coord>" + lon + " " + lat + " " + alt + "</gx:coord>\n";
    }
    //populate the gx:Track KML string
    KML += "<gx:Track>" + "<altitudeMode>absolute</altitudeMode>" + KMLTimes + KMLCoords + "</gx:Track>";
    KML += "</Placemark> \n";
}

/**
 * Creates a style KML that can be used to decorate lines in the GE Plugin.
 *
 * @param name - the string id with which to reference this style element in the plugin
 * @param col - the colour of the line (NB: to be specified in Google Color Notation as #AABBGGRR)
 * @param width - the width of this line in scalable pixels
 *
 * @returns a style object, comprised of a string name property and a string KML property. This KML
 * is in a format parsable by the GE KML parser.
 */
function createKMLLineStyle(name, col, width) {
    var style = new Object();
    style.name = name;
    style.kml = "<Style id=\"" + name + "\"> \n<LineStyle>\n";
    style.kml += "<color>" + col + "</color> \n";
    style.kml += "<width>" + width + "</width> \n";
    style.kml += "</LineStyle>\n";
    style.kml += "<IconStyle> \n<Icon> \n</Icon> \n</IconStyle> \n";
    style.kml += "</Style> \n";
    //add this line style to the KML for later access
    KML += style.kml;
    return style;
}

/**
 * Interpolates time over a sequence of credits that are timestamped with the same year for a person.
 * For example, if a person had three credits for 2005, this method would break those dates up into four
 * month periods, so that within the year of 2005, this person can jump between three different studios.
 * Assumes that the array data for credits is structured in chronological order, per person.
 *
 * @param person - the person object
 * @param year - the year that we are interpolating over
 * @param index - the index of the credit that was marked with that year
 *
 * @returns a year-month-date string representation of the interpolated time across the sequence of years.
 * Note that if the length of the sequence is one, no interpolation is needed, and the returned year will
 * be identical in time to that of the year passed into this function. (The format for the returned year
 * is acceptable to the GE time parser).
 */
function interpolateTimeOverYear(person, year, index) {
    //START INDEX: the first occurance of the specified year in this person's credit list
    var startIndex;
    for (var i = 0; i < person.rels.length; i++) {
        var creditedYear = person.rels[i].movieReleaseYear;
        if (creditedYear == year) {
            startIndex = i;
            break;
        }
    }
    //END INDEX: the last occurance of the specified year in this person's credit list 
    var endIndex = startIndex;
    while (endIndex + 1 < person.rels.length && year == person.rels[endIndex + 1].movieReleaseYear) {
        endIndex++;
    }
    //add 1 to these variables to make the range inclusive at both ends 
    var maxCount = endIndex - startIndex + 1;
    var count = index - startIndex;
    var date = interpolateTimeBetween(year.toString(), (parseInt(year) + 1).toString(), count, maxCount);
    return date;
}

/**
 * Returns an interpolated time between a starting date and a ending date. Dates must be in string
 * format in order to be interpreted correctly.
 *
 * @param timeStart - the date to start as a string
 * @param timeEnd - the date to end as a string
 * @param count - the integer specifying how many steps we are through in the interpolation
 * @param maxCount - the total number of steps in the interpolation
 *
 * @returns a year-month-date string representation of the interpolated time (this format is acceptable to the
 * GE time parser).
 **/

function interpolateTimeBetween(timeStart, timeEnd, count, maxCount) {
    var start = new Date(timeStart);
    var end = new Date(timeEnd);
    var startMillis = start.getTime();
    var endMillis = end.getTime();
    var difMillis = endMillis - startMillis;
    var dateAsMillis = startMillis + (difMillis * count / maxCount);
    var returnDate = new Date(dateAsMillis);
    var year = returnDate.getFullYear().toString();
    var month = returnDate.getMonth() + 1 < 10 ? "0" + (returnDate.getMonth() + 1).toString() : (returnDate.getMonth() + 1).toString();
    var date = returnDate.getDate() < 10 ? "0" + (returnDate.getDate()).toString() : returnDate.getDate().toString();
    return year + "-" + month + "-" + date;
}

/**
 * Returns the least difference in latitude between two specified latitude ordinates (i.e. no wrap around).
 *
 * @param lat1 - the first latitude ordinate
 * @param lat2 - the second latitude ordinate
 */
function findLatitudeDifference(lat1, lat2) {
    return (lat2 - lat1);
}

/**
 * Returns the least difference in longitude between two specified longitude ordinates (i.e. no wrap around).
 *
 * @param lon1 - the first longitude ordinate
 * @param lon2 - the second longitude ordinate
 */
function findLongitudeDifference(lon1, lon2) {
    //is lon1 greater than or less than 0?
    var firstWrap = lon1 > 0 ? lon1 - 180 : lon1 + 180;
    if (lon2 >= Math.min(lon1, firstWrap) && lon2 <= Math.max(lon1, firstWrap)) {
        // => shortest path is to return the difference between lon1 and lon2
        return lon2 - lon1;
    }
    //otherwise, in the case that we have two coordinates that are not within
    // the first wrap, but do also not cross the +-180 longitude line...
    else if (lon1 >= 0 && lon2 >= 0 && lon1 <= 180 && lon2 <= 180) {
        return lon2 - lon1;
    } else if (lon1 <= 0 && lon2 <= 0 && lon1 >= -180 && lon2 >= -180) {
        return lon2 - lon1;
    } else {
        // => the shortest path from A to B is to return the inverse wrap around
        //(i.e. cross the -180/180 longitude line)
        //if lon1 is less than 0 return a negative, if greater than 0 return a positive
        var orientation = lon1 >= 0 ? 1 : -1;
        var secondWrap = Math.abs(180 - Math.max(lon1, lon2)) + Math.abs(-180 - Math.min(lon1, lon2));
        return orientation * secondWrap;
    }
}

/**
 * Sets the GE internal clock to the specified date in YYYY-MM-DD format.
 * Also updates the Processing HUD with the current time.
 *
 * @param date - the date with which to set the clock (in YYYY-MM-DD format).
 * @param pHint - [OPT] a hint for the Processing sketch, either 'STAMP' or 'SPAN'. The former
 *                will display the date as one value, whereas the later will display the date
 *                as two values.
 * @param endDate - [OPT] if an endDate is specified, the clock will be set to a timeSpan,
 *                  rather than a timeStamp, presenting a view over a range of time. Must
 *                  be specified in YYYY-MM-DD format.
 **/
function setTime(date, pHint, endDate) {
    if (!endDate) {
        var timeStamp = ge.createTimeStamp('');
        timeStamp.getWhen().set(date);
        if (pHint == 'STAMP') hud.updateTime(date);
        else hud.updateTime();
        ge.getTime().setTimePrimitive(timeStamp);
    } else {
        var timeSpan = ge.createTimeSpan('');
        timeSpan.getBegin().set(date);
        timeSpan.getEnd().set(endDate);
        if (pHint == 'SPAN') hud.updateTime(date, endDate);
        else if (pHint == 'STAMP') hud.updateTime(date);
        else hud.updateTime();
        ge.getTime().setTimePrimitive(timeSpan);
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
 * Spins the globe about its axis.
 *
 * @param speed - how fast to spin the globe. Orientation of numbers specify clockwise/anticlockwise rotation.
 */
function spinGlobe(speed) {
    var camera = ge.getView().copyAsCamera(ge.ALTITUDE_ABSOLUTE);
    camera.setLongitude(camera.getLongitude() + speed);
    ge.getView().setAbstractView(camera);
}