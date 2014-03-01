/**
 * The Path Creator worker class is initially responsible for creating the KML to display paths in the GE
 * plugin window. It is important to note that after the worker's creation, all following processes are to
 * be treated as asynchronous.
 **/

var studios; // the collection of all studios in the dataSet
var paths = {}; //the collection of all paths made indexed by roles 
var idCount = 0; // for indexing each path 

self.addEventListener('message', function(e) {
    var dataSet = e.data.dataSet;
    studios = e.data.studios;
    var arcRise = e.data.arcRise;
    var placemarkAltitude = e.data.placemarkAltitude;
    var roles = e.data.roles;
    var KmlRoleCategories = {};
    var KML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?> " +
        "<kml xmlns=\"http://www.opengis.net/kml/2.2\" " +
        "xmlns:gx=\"http://www.google.com/kml/ext/2.2\" " +
        "xmlns:kml=\"http://www.opengis.net/kml/2.2\" " +
        "xmlns:atom=\"http://www.w3.org/2005/Atom\"> \n<Document>\n<Folder id=\"allPaths\">";
    var lineStyle = createKMLLineStyle("whiteLine", 'bbffffff', 3.0);
    KML += lineStyle.kml; //add KML style 
    for (var i = 0; i < roles.length; i++) {
        if (i == 0) {
            paths[""] = [];
            KmlRoleCategories[""] = [];
        }
        paths[roles[i]] = [];
        KmlRoleCategories[roles[i]] = [];
    }
    for (var i = 0; i < dataSet.people.length; i++) {
        var person = dataSet.people[i];
        for (var u = 0; u < person.rels.length - 1; u++) {
            var fromStudio = person.rels[u].matchedCompanyName;
            var toStudio = person.rels[u + 1].matchedCompanyName;
            //CASE: No Movement
            if (fromStudio == toStudio) continue;
            //CASE: Movement between studios
            var fromTime = person.rels[u].movieReleaseYear;
            var toTime = person.rels[u + 1].movieReleaseYear;
            var role = person.rels[u].personMappedRole;
            // if (fromStudio != 'Weta Digital') continue; //tools for tailoring the data to Weta
            // if (toStudio != 'Weta Digital') continue;
            var pathReport = createPath(fromStudio, toStudio, fromTime, toTime, arcRise, placemarkAltitude, lineStyle);
            KML += pathReport.KML;
            paths[role][paths[role].length] = pathReport.id;
        }
        self.postMessage({ //update the progress bar in the main thread 
            cmd: 'update',
            contents: ''
        });
    }
    KML += "\n</Folder>\n</Document>\n</kml>";
    self.postMessage({ //processing complete - send back the complete KML file 
        cmd: 'complete',
        contents: {
            KML: KML,
            paths: paths
        }
    });
}, false);

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
    style.kml += "<width>" + width + " </width>\n";
    style.kml += "</LineStyle>\n";
    style.kml += "<IconStyle> \n<Icon> \n</Icon> \n</IconStyle> \n";
    style.kml += "</Style> \n";
    //add this line style to the KML for later access
    return style;
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
    var s1lat = studios[studioName1].lat;
    var s1lon = studios[studioName1].lon;
    var s2lat = studios[studioName2].lat;
    var s2lon = studios[studioName2].lon;
    //now to create a line string between the two studios 
    var KML = "<Placemark id='path" + idCount + "'>";
    idCount++;
    if (style != null && style != undefined) KML += "<styleUrl>#" + style.name + "</styleUrl>";
    var diflat = findLatitudeDifference(s1lat, s2lat);
    var diflon = findLongitudeDifference(s1lon, s2lon);
    var maxCount = 50; //higher number => smoother curve => more work 
    // var maxCount = getMaxCount(getDistanceFromLatLonInKm(s1lat, s1lon, s2lat, s2lon));
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
    var pathReport = {};
    pathReport.KML = KML;
    pathReport.id = "path" + (idCount - 1);
    return pathReport;
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