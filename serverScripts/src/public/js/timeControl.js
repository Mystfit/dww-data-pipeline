/**
 * This script sets up the time slider by initialising the buttons and their events with the JQuery UI Library.
 **/

/**
 * Main method to handle the loading of the time control widget to the screen.
 */
function loadTimeControl() {
    //set up the buttons
    initialiseButton("#rwButton", "ui-icon-seek-prev", true, function() {
        setSliderToValue("min");
        requestDensityUpdate(selectedStudio, getTime("year"));
    });
    initialiseButton("#playButton", "ui-icon-play", true, function() {
        if (player) clearTimeout(player);
        showPlayButton(false);
        player = setInterval(play, 10);
    });
    initialiseButton("#pauseButton", "ui-icon-pause", false, function() {
        if (player) clearTimeout(player);
        showPlayButton(true);
    });
    initialiseButton("#ffButton", "ui-icon-seek-next", true, function() {
        setSliderToValue("max");
        requestDensityUpdate(selectedStudio, getTime("year"));
    });
    initialiseButton("#viewRange", "ui-icon-bullet", true, function() {
        if (viewRange) {
            viewRange = false;
            $("#slider").slider("destroy");
            initialiseSlider("#slider");
            //setSliderToValue("min");
        } else {
            $("#slider").slider("option", "range", true);
            viewRange = true;
            //setSliderToValue("min");
        }
    });
    //set up the time slider 
    initialiseSlider("#slider");
}

/**
 * Initialises a button via the JQuery UI.
 *
 * @param id - the DOM id tag for this widget
 * @param iconVar - the string variable identifying the JQuery Icon to display
 * @param visible - whether or not this button is initially visible
 * @param eventFire - the function to perform upon button click
 **/
function initialiseButton(id, iconVar, visible, eventFire) {
    $(id).button({
        text: false,
        icons: {
            primary: iconVar
        }
    });
    if (!visible) $(id).hide();
    document.getElementById(id.substring(1, id.length)).onclick = eventFire; //remove the # for document accessor
}

/**
 * Iinitialises a slider element to the DOM div specified by the id given.
 *
 * @param id - the id of the DOM element to be augmented with a slider.
 **/
function initialiseSlider(id) {
    $(id).slider({
        min: 0,
        max: calculateDaysBetween(vizTimeStart, vizTimeEnd),
        change: function(event, ui) {
            var dates = getSliderDate();
            setGETime(dates[0], dates[1]); //dates[1] is undefined if viewRange = false
        },
        slide: function(event, ui) {
            var dates = getSliderDate();
            setGETime(dates[0], dates[1]); //dates[1] is undefined if viewRange = false
        },
        stop: function(event, ui) {
            setTimeout(function() { //delay so time slider has properly set itself to the new time 
                requestDensityUpdate(selectedStudio, getTime("year"));
            }, 100);
        }
    });
}

/**
 * Recursive function that repeatedly calls increments to the time slider, until the max extent
 * of the time slider has been reached.
 **/
function play() {
    var startDate = getSliderDate();
    var currentSliderVal = viewRange ? $("#slider").slider('values', 1) : $("#slider").slider('value');
    var nextSliderVal = currentSliderVal + playbackSpeed;
    if (nextSliderVal > $("#slider").slider('option', 'max')) {
        if (player) clearTimeout(player);
        showPlayButton(true);
    }
    if (!viewRange) $("#slider").slider('value', nextSliderVal);
    else {
        var lowerSliderVal = $("#slider").slider('values', 0);
        $("#slider").slider('values', [lowerSliderVal, nextSliderVal]);
    }
    var endDate = getSliderDate();
    startDate = startDate[1] ? startDate[1] : startDate[0];
    endDate = endDate[1] ? endDate[1] : endDate[0];
    if (assessYearChange(startDate, endDate)) requestDensityUpdate(selectedStudio, getTime("year"));
}

/**
 * Sets the play button to either play or pause depending on whether the
 * animation is currently scrubbing through the timeline. This method changes
 * the display between play and pause buttons, and is therefore purely cosmetic.
 *
 * @param show - will show the play button if true.
 **/
function showPlayButton(show) {
    if (show) {
        $("#pauseButton").hide();
        $("#playButton").show();
    } else {
        $("#playButton").hide();
        $("#pauseButton").show();
    }
}

/**
 * Sets the GE Plugin time to correspond with the date specified.
 * If date2 is optionally specified (i.e. with viewRange), this method will set a time span from the
 * first (earlier) date to the second (later) date. Otherwise, will set a timeStamp to the specific date.
 *
 * @param date - the date to timeStamp within the plugin, or the earlier of two timespan dates.
 * @param date2 - [OPT] the later of a pair of timeSpan dates.
 **/
function setGETime(date, date2) {
    if (!date2) {
        setTime(parseGETime(date), 'STAMP', parseGETime(addToTime(date, 1000 * 60 * 60 * 24 * 1))); //1 day span (essentially a 'stamp')
    } else {
        setTime(parseGETime(date), 'SPAN', parseGETime(date2));
    }
}

/**
 * Function that returns a date object corresponding to the current slider value.
 * If a slider range is set, this method will return a date object array with the
 * 0th index being the date of the lower handle and the 1st index being the date
 * of the upper value.
 *
 * @returns a javascript date object(s array), as specified by the current slider value.
 **/
function getSliderDate() {
    if (!viewRange) {
        var numDays = $("#slider").slider("value");
        var numMillis = numDays * 24 * 60 * 60 * 1000;
        var startDate = parseDate(vizTimeStart);
        var date = [];
        date[0] = addToTime(startDate, numMillis);
        return date;
    } else {
        var startDate = parseDate(vizTimeStart);
        var millisPerDay = 24 * 60 * 60 * 1000;
        var dates = [];
        var lowerNumDays = $("#slider").slider('option', 'values')[0];
        var upperNumDays = $("#slider").slider('option', 'values')[1];
        var lowerNumMillis = lowerNumDays * millisPerDay;
        var upperNumMillis = upperNumDays * millisPerDay;
        dates[0] = addToTime(startDate, lowerNumMillis);
        dates[1] = addToTime(startDate, upperNumMillis);
        return dates;
    }
}

/**
 * Function that manually sets the slider value to correspond with the specified date object.
 * Note that the day cannot be less than the minimum slider value, or greater than the maximum.
 *
 * @param date - the date with which to set the slider value.
 * @returns true iff the slider was successfully set.
 *          False if date is outside range or a parsing error occured.
 **/
function setSliderDate(date) {
    var startDate = parseDate(vizTimeStart);
    var dayAsMillis = 24 * 60 * 60 * 1000;
    var daysSinceStart = (date.getTime() - startDate.getTime()) / dayAsMillis;
    var min = $("#slider").slider('option', 'min');
    var max = $("#slider").slider('option', 'max');
    if (daysSinceStart < min || daysSinceStart > max) return false; //outside range!!
    if (!viewRange) $("#slider").slider('option', 'value', daysSinceStart);
    else {
        var vals = $("#slider").slider('values');
        if (daysSinceStart <= vals[0]) {
            $("#slider").slider('option', 'values', [0, daysSinceStart]);
        } else {
            $("#slider").slider('option', 'values', [1, daysSinceStart]);
        }
    }
    return true;
}

/**
 * Alternate setter function for the slider. Sends handles to either the start or the end
 * of the animation.
 *
 * @param val - either "min" or "max" - setting the slider to the corresponding end of the slider bar.
 *              Returns with no change if this value is anything other than "min" or "max".
 **/
function setSliderToValue(val) {
    if (val != "min" && val != "max") return;
    if (!viewRange) {
        var extent = $("#slider").slider('option', val);
        $("#slider").slider('option', 'value', extent);
    } else {
        var extent = $("#slider").slider('option', val);
        var values = $("#slider").slider('option', 'values');
        if (val == "min") $("#slider").slider('option', 'values', [extent, values[1]]);
        else $("#slider").slider('option', 'values', [values[0], extent]);
    }
}

/**
 * Adds a specified millisecond amount to the specified time, and returns the resultant date object.
 *
 * @param currentTime - the time to add/subtract from as a javascript date object
 * @param addMillis - the millisecond amount to add ( or subtract in the case of a negative number)
 * @returns a javascript date object = currentTime + add.
 **/
function addToTime(currentTime, addMillis) {
    return new Date(currentTime.getTime() + addMillis);
}

/**
 * Calculates the (exlusive) number of days between two specified dates.
 *
 * @param startDate - the start date in YYYY-MM-DD format
 * @param endDate - the end date in YYYY-MM-DD format
 * @returns an integer specifying the number of days present between the two dates
 **/
function calculateDaysBetween(startDate, endDate) {
    var millisDif = parseDate(endDate).getTime() - parseDate(startDate).getTime();
    var millisPerDay = 1000 * 60 * 60 * 24;
    return Math.floor(millisDif / millisPerDay);
}
/**
 * Utility method to return true if two dates are in different years.
 *
 * @param prevDate - the first date object
 * @param date - the second date object
 * @returns true if the specified date objects are in different years
 **/
function assessYearChange(prevDate, date) {
    if (date.getFullYear() != prevDate.getFullYear()) return true;
    return false;
}

/**
 * Parses a date in YYYY-MM-DD format into a Date object.
 *
 * @param date - a date in YYYY-MM-DD format
 * @returns a Javascript date object of the date specified.
 **/
function parseDate(date) {
    var elements = date.split('-');
    return new Date(elements[0], elements[1] - 1, elements[2]);
}

/**
 * Parses a Javascript date object into the YYYY-MM-DD format readable by Google Earth.
 *
 * @param date - a date object to be parsed
 * @returns the corresponding date in YYYY-MM-DD format.
 **/
function parseGETime(date) {
    var year = date.getFullYear().toString();
    var month = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1).toString() : (date.getMonth() + 1).toString();
    var day = date.getDate() < 10 ? "0" + (date.getDate()).toString() : date.getDate().toString();
    return year + "-" + month + "-" + day;
}