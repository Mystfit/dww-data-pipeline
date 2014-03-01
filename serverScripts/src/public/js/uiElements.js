/**
 * This script contains all of the user interface elements used to interact with the plugin.
 * All incorporated widgets are provided by the JQueryUI API.
 **/

var hud; // div for displaying studio data
var timeDisplay; //div for displaying the currently selected time
var studioSelector; //input for selecting a studio from the list of studios 
var roleDensity = {}; //object holding roleDensity graph data and optional display parameters (interpreted by chart.js)
var animation; //timeout for animating the progress bar 
var UIVisible = true; //whether or not the UI is visible 

/**
 * Main function call for generating the UI and all its sub-elements.
 **/
function loadUI() {
    $('#sideBarToggle').button({
        text: false,
        icons: {
            primary: 'ui-icon-triangle-1-nw'
        }
    }).click(function(event) {
        if (UIVisible) {
            UIVisible = false;
            animateSideBar(false);
            $(this).button('option', {
                icons: {
                    primary: 'ui-icon-triangle-1-se'
                }
            });
        } else {
            UIVisible = true;
            animateSideBar(true);
            $(this).button('option', {
                icons: {
                    primary: 'ui-icon-triangle-1-nw'
                }
            });
        }
    });
    loadTimeWidget();
    loadDisplayWidget();
    loadSearchWidget();
    selectStudio("Weta Digital");
}

//-----------------------------------------------
//			INITIALISATION FUNCTIONS
//-----------------------------------------------

//MASTER FUNCTIONS

/**
 * Loads the time display widget and all its subelements.
 **/
function loadTimeWidget() {
    loadTimeControl();
    loadTimeDisplay();
}

/**
 * Loads the studio density display widget and all its subelements.
 **/
function loadDisplayWidget() {
    loadStudioDisplay();
    var data = [];
    var options = {
        animationEasing: "easeOutCirc",
        animationSteps: 20
    };
    loadStudioDensityBar();
    updateRoleDensityGraph(data, options);
    generateRoleSelectors();
    requestDensityUpdate();
}

/**
 * Loads the search bar widget and all its subelements.
 **/
function loadSearchWidget() {
    $("#searchDisplay").button({
        text: false,
        icons: {
            primary: 'ui-icon-search'
        }
    });
    loadStudioSelector();
}


//SUPPORT FUNCTIONS

/**
 * Creates a button for displaying the current timestamp/span upon.
 * Also adds a custom date calendar for manually selecting dates,
 * that can be selected upon a button press.
 *
 * This method also initialises the display time.
 **/
function loadTimeDisplay() {
    // $("#datePicker").datepicker({
    //     changeMonth: true,
    //     changeYear: true,
    //     minDate: new Date(vizTimeStart),
    //     maxDate: new Date(vizTimeEnd),
    //     onSelect: function(dateText, inst) {
    //         var date = new Date(dateText);
    //         setSliderDate(date);
    //     }
    // });
    // $("#datePicker").mouseleave(function() {
    //     $("#datePicker").hide('blind', 'fast');
    // });
    timeDisplay = $("#timeDisplay").button();
    // timeDisplay.click(function() {
    //     if (!($("#datePicker").is(":visible"))) {
    //         $("#datePicker").show('blind', 'fast');
    //     } else {
    //         $("#datePicker").hide('blind', 'fast');
    //     }
    // });
    updateUITime(vizTimeStart);
}

/**
 * Generates a search bar with an autocomplete function that can
 * be used to select studios from text input. Handles the generation
 * of event listeners for responding to user input.
 **/
function loadStudioSelector() {
    var tags = [];
    var count = 0;
    for (var studio in studios) {
        if (studios.hasOwnProperty(studio)) {
            tags[count] = studio.toString();
            count++;
        }
    }
    var goToStudio = function(studio) {
        if (!studios[studio]) return false;
        var lat = studios[studio].lat;
        var lon = studios[studio].lon;
        setView(lat, lon, minHeight * 8);
        selectStudio(studio);
        requestDensityUpdate(studio, getTime("year"));
        return true;
    }
    studioSelector = $("#studioSelector").autocomplete({
        position: {
            my: "left bottom",
            at: "left top",
            collision: "flip"
        },
        source: tags,
        select: function(event, ui) {
            goToStudio(ui.item.label);
        }
    });
    //add listener for enter button 
    window.onkeyup = function(e) {
        var key = e.keyCode ? e.keyCode : e.which;
        if (key == 13) {
            if (document.activeElement.id = "studioSelector") {
                goToStudio(toCamelCase(studioSelector.val()));
            }
        }
    }
}

/**
 * Generates a display table that illustrates company density data at
 * a specific time.
 **/
function loadStudioDisplay() {
    $("#displayTabs").tabs({
        collapsible: true,
        beforeActivate: function(event, ui) {
            loadRoleDensityGraph();
        },
        hide: {
            effect: "blind",
            duration: "fast"
        },
        show: {
            effect: "blind",
            duration: "fast"
        }
    });
}

/**
 * Utilises the JQuery UI progress bar to graphically represent the total density
 * at a particular studio.
 **/
function loadStudioDensityBar() {
    $('#personIcon').button({
        text: false,
        icons: {
            primary: 'ui-icon-person'
        }
    });
    var densityBar = $('#densityBar');
    $('#densityBar').progressbar({
        max: 6
    });
}

/**
 * Utilises chart.js' doughnut graph to represent role breakdown data
 * on screen. Every time this method is called, the graph is redrawn
 * and recalculated in order to achieve the load-in animation.
 **/
function loadRoleDensityGraph() {
    var ctx = $("#roleChart").get(0).getContext("2d");
    ctx.canvas.width = 150;
    ctx.canvas.height = 150;
    var myNewChart = new Chart(ctx).Doughnut(roleDensity.data, roleDensity.options);
}

/**
 * Utilises JQuery's createElement function in order to dynamically add
 * selectors to the DOM.
 **/
function generateRoleSelectors() {
    for (var i = 0; i < 5; i++) {
        //create the div element
        $('<div/>', {
            id: 'roleSelectorDiv' + i
        }).appendTo('#studioDisplay');

        $('<input/>', {
            type: 'checkbox',
            checked: true,
            name: i,
            change: function() {
                var selector = $('#roleSelectorSelect' + this.name);
                if (this.checked) {
                    selector.prop('disabled', false);
                    selectedRoles[this.name] = $('#roleSelectorSelect' + this.name + " option:selected").text();
                } else {
                    selector.prop('disabled', 'disabled');
                    selectedRoles[this.name] = null;
                }
                requestDensityUpdate(selectedStudio, getTime("year"));
            }
        }).appendTo('#roleSelectorDiv' + i);

        $('<select/>', {
            id: 'roleSelectorSelect' + i,
            name: i,
            change: function() {
                var role = $(this).find(':selected').text();
                disableRole(selectedRoles[this.name], false, this);
                selectedRoles[this.name] = role;
                disableRole(role, true, this);
                requestDensityUpdate(selectedStudio, getTime("year"));
            }
        }).appendTo('#roleSelectorDiv' + i);

        for (var u = 0; u < roles.length; u++) {
            $('<option/>', {
                value: roles[u],
                text: roles[u],
            }).appendTo('#roleSelectorSelect' + i);
        }

        $('<input/>', {
            type: 'checkbox',
            name: i,
            id: 'roleSelectorButton' + i,
            change: function() {
                var role = $('#roleSelectorSelect' + i + ' :selected').text();
                viewPaths(false);
                viewPaths(this.checked, role);
            }
        }).appendTo('#roleSelectorDiv' + i);

        $('#roleSelectorButton' + i).button().change(function() {
            $(this).button("option", {
                icons: {
                    primary: this.checked ? 'ui-icon-radio-on' : 'ui-icon-radio-off'
                }
            });
        });
    }
    //appropriate selectors 
    for (var i = 0; i < 5; i++) {
        $('#roleSelectorSelect' + i + ' option[value=\'' + roles[i] + '\']').attr('selected', 'selected');
        disableRole(roles[i], true, $('#roleSelectorSelect' + i));
        $('#roleSelectorSelect' + i).css('background-color', getAssociatedRoleColor(roles[i]));
    }
}


//UTILITY FUNCTIONS

/**
 * Converts a string input to Camel Case.
 *
 * @returns the string in camel case form
 **/
function toCamelCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

/**
 * Makes a role (un)selectable in the other role selectors.
 *
 * @param role - the role to change selectability
 * @param disable - boolean: enable or disable = true or false
 * @param selector - the selector that selected the role
 **/
function disableRole(role, disable, selector) {
    for (var i = 0; i < 5; i++) {
        var curSelector = $('#roleSelectorSelect' + i);
        if (selector == curSelector) continue;
        $('#roleSelectorSelect' + i + ' option[value=\'' + role + '\']').attr('disabled', disable);
    }
}

/**
 * Returns the pre-set colour associated with the specified role (hexidecimal notation).
 *
 * @param role - a valid role
 * @returns the colour associated with this role, or null if no colour is currently associated
 **/
function getAssociatedRoleColor(role) {
    var index = $.inArray(role, selectedRoles);
    if (index == -1) return null;
    return selectedRoleColours[index];
}

/**
 * Animates the side bar moving in and out of the window.
 *
 * @param incoming - whether or not the sidebar is coming into the screen (true) or leaving the screen (false)
 **/
function animateSideBar(incoming) {
    if (incoming) {
        $('#sideBar').show('drop', 'slow');
        setTimeout(function() {
            $('#timeWidget').show('drop', 'slow');
        }, 100);
        setTimeout(function() {
            $('#displayWidget').show('drop', 'slow');
        }, 300);
        setTimeout(function() {
            $('#searchWidget').show('drop', 'slow');
        }, 500);
    } else {
        setTimeout(function() {
            $('#timeWidget').hide('drop', 'slow');
        }, 100);
        setTimeout(function() {
            $('#displayWidget').hide('drop', 'slow');
        }, 300);
        setTimeout(function() {
            $('#searchWidget').hide('drop', 'slow');
        }, 500);
        setTimeout(function() {
            $('#sideBar').hide('drop', 'slow');
        }, 700);
    }
}

function animateDensityBar() {
    if (animation) {
        var currentAmt = $("#densityBar").progressbar("value");
        if (currentAmt >= $('#densityBar').progressbar("option", "max")) {
            animation.clearTimeout();
        }
        $("#densityBar").progressbar('option', 'value', currentAmt + 0.1);
    }
}


//-----------------------------------------------
//				UPDATE FUNCTIONS
//-----------------------------------------------

/**
 * Sets the current timeLabel to a string that indicates a time, or a period of time.
 * Note: no parameters clears the display.
 *
 * @param timeBegin - [OPT] the time to display, or the first time in a span.
 * @param timeEnd - [OPT] the last time in a span to display.
 **/
function updateUITime(timeBegin, timeEnd) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var updateText = function(text) {
        timeDisplay.button('option', 'label', text)
    };
    if (!timeBegin) {
        updateText("");
    }
    var belements = timeBegin.split('-');
    var byear = belements[0];
    var bmonth = months[parseInt(belements[1]) - 1];
    var timeLabel = bmonth + ", " + byear;
    if (timeEnd) {
        timeLabel += "  --->  ";
        var eelements = timeEnd.split('-');
        var eyear = eelements[0];
        var emonth = months[parseInt(eelements[1]) - 1];
        timeLabel += emonth + ", " + eyear;
    }
    updateText(timeLabel);
}

/**
 * Draws businessman icons to the studio display in order to graphically represent
 * the total number of people at this studio at this given time (via the density
 * report).
 *
 * @param totalDensity - the number of people currently at the selected studio
 **/
function updateDensityTally(totalDensity) {
    var num = Math.log(totalDensity) / Math.log(3.0);
    $("#densityBar").progressbar('option', 'value', num);
}

/**
 * Updates the role density graph's internal data and then redraws the graph.
 *
 * @param data - the build up data of each role
 * @param options - [OPT] any optional parameters that hint at how to display the graph
 **/
function updateRoleDensityGraph(data, options) {
    roleDensity.data = data;
    roleDensity.options = options ? options : {};
    loadRoleDensityGraph();
}

/**
 * Updates all UI elements containing studio specific information to reflect that
 * of the specified studio name.
 *
 * @param studioName - the name of the studio to select
 * @param densityTotal - the total number of people in this studio at the current time
 * @returns true iff a valid studio was selected
 **/
function selectStudio(studioName) {
    if (!studios[studioName]) return false; // check validity 
    selectedStudio = studioName;
    $('#displayTabs ul:first li:eq(0) a').text(studioName);
    return true;
}