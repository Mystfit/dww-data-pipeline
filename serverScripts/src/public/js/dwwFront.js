var mapFileData;
var reverseMapData;
var mapQueryData;
var bUsemapFileData = true;
var minSearchFilter = 1;
var openDialog;
var firstRun = true;
var showOnlyFiltered = false;

var blacklistTotals = {};
$.each(blacklist, function() {
    blacklistTotals[this] = 0;
});

var capitalize = function(str) {
    return str.replace(/(?:^|\s)\S/g, function(a) {
        return a.toUpperCase();
    });
};

var dwwFront = {
    GetMappingListTable: function() {
        $.ajax({
            url: mapListUrl,
            type: "GET",
            dataType: "json",
            contentType: "application/json",
            success: dwwFront.BuildMappingTable,
            error: function(xhr, status) {
                console.log("HTTP problem!");
            }
        });
    },

    GetMapFile: function() {
        $.ajax({
            url: mapFileUrl,
            type: "GET",
            dataType: "json",
            contentType: "application/json",
            success: function(json) {
                mapFileData = json;
                dwwFront.GetMappingListTable();
            },
            error: function(xhr, status) {
                console.log("HTTP problem!");
            }
        });
    },


    BuildReverseMap: function(mapFile) {
        //Get entries that match the map first to build up ui controls
        reverseMapFile = {}
        $.each(mapFile, function(d) {
            //Build reverse list
            if (this.name in reverseMapFile) {
                reverseMapFile[this.name].searches.push(d);
            } else {
                reverseMapFile[this.name] = {
                    "id": this.id,
                    "searches": [d],
                    "total": 0
                }
            }
        });
        $("#maintable tbody .verified").each(function(d) {
            //console.log($(this).find(".nameHeader"), reverseMapFile);
            reverseMapFile[$(this).find(".nameHeader").text()].total += parseInt($(this).find(".searchCountHeader").text());
        });

        return reverseMapFile;
    },

    BuildMappingTable: function(json) {
        mapQueryData = json;
        var table = $('#datatable tbody').html("");

        //Build table
        var table = $('#datatable tbody');
        var uniqueRows = {};
        $.each(json, function() {
            if (this.searchcount < minSearchFilter) {
                return;
            }
            var builtRow = dwwFront.BuildRow(this);
            var oldTotal = parseInt($(builtRow.row).find(".searchCountHeader").text());
            var targetSearch = builtRow.search;
            if (showOnlyFiltered) {
                targetSearch = builtRow.filter;
            }
            if (uniqueRows[targetSearch]) {
                var currentTotalHeader = $(uniqueRows[targetSearch]).find(".searchCountHeader");
                var currentTotal = parseInt($(currentTotalHeader).text());
                var newTotal = currentTotal += oldTotal;
                currentTotalHeader.text(newTotal);
            } else {
                uniqueRows[targetSearch] = builtRow.row;
            }
        });

        $.each(uniqueRows, function() {
            $(this).appendTo(table);
        });

        //Build totals table
        reverseMapData = dwwFront.BuildReverseMap(mapFileData);
        dwwFront.BuildTotalsTable();
        dwwFront.BuildBlacklistTable();
        $(document.body).trigger("sticky_kit:recalc")

        //console.log(reverseMapData);
        //console.log(blacklistTotals);
        if (firstRun) {
            //$("#maintable .searchFilteredHeader").hide();
            //$("#showFiltered").click();
            firstRun = false;
        }
    },

    BuildRow: function(data) {
        var row = $("<tr>").attr("id", "s_" + data.orderid);
        var searchHeaderTd = $("<td>").addClass('searchHeader').text(data.search).appendTo(row);
        var searchFilterDiv = $("<td>").addClass("searchFilteredHeader").appendTo(row);
        var nameHeaderTd = $("<td>").addClass('nameHeader').text(data.name).appendTo(row);
        var searchCountTd = $("<td>").addClass('searchCountHeader').text(data.searchcount).appendTo(row);
        var verifyControls = $("<td>").addClass('verifyControls').appendTo(row);
        var verifySection = $("<div>").addClass('verifySection').appendTo(verifyControls);
        var verifyButton = $("<button>").addClass('verifyButton').html("Edit").click(dwwFront.MapControls).appendTo(verifyControls);

        var filteredRow = dwwFront.UpdateRow(row, data.search, data);
        return {
            'search': filteredRow.search,
            'filter': filteredRow.cleanRow,
            'row': row
        };
    },

    UpdateRow: function(row, key, data) {
        var nameHeaderTd = row.find("td.nameHeader");
        //var searchHeaderTd = row.find("td .searchHeader");
        var searchFilterTd = row.find("td.searchFilteredHeader");

        if (bUsemapFileData) {

            var searchTerm = key;

            //Blacklist
            var clean = searchTerm.toLowerCase();
            var modified = false;
            for (var i = 0; i < blacklist.length; i++) {
                var term = blacklist[i].toLowerCase();
                if (clean.search(term) > -1) {
                    blacklistTotals[blacklist[i]] += 1;
                    clean = clean.replace(term, '').trim();
                    modified = true;
                }
            }

            if (modified) {
                searchFilterTd.html(clean);
                //console.log(data);
                //mapQueryData[clean] = data.search;
            } else {
                searchFilterTd.html(searchTerm);
            }

            //console.log("Post: ", key, ", ", mapFileData);

            if (searchTerm in mapFileData) {

                row.addClass('verified').removeClass('unverified');
                nameHeaderTd.html(mapFileData[searchTerm].name);

                //Tag rows if they require special formatting based on identifiers (role/bad data etc)
                if (mapFileData[searchTerm].name.search("zzz_role:") > -1) {
                    row.addClass('role');
                }
                if (mapFileData[searchTerm].name.search("zzz_baddata:") > -1) {
                    row.addClass('baddata');
                }
            } else {
                row.addClass("unverified").removeClass('verified');
            }
        } else {
            row.addClass("unverified").removeClass('verified');
        }

        return {
            'search': key,
            'cleanRow': clean
        };
    },

    BuildTotalsTable: function() {
        $("#totalstable tbody").html("");
        $.each(reverseMapData, function(key, value) {
            if (value.total < minSearchFilter || key.search("zzz_") > -1) {
                return;
            }
            var row = $("<tr>").addClass("verified").appendTo($("#totalstable tbody"));
            var mappedNameTd = $("<td>").addClass("mappedNameHeader").html(key).appendTo(row);
            var countTotalTd = $("<td>").addClass("countTotalHeader").html(value.total).appendTo(row);
        });
    },

    BuildBlacklistTable: function() {
        $("#blacklisttable tbody").html("");
        $.each(blacklistTotals, function(key, value) {
            // if (value.total < minSearchFilter || key.search("zzz_") > -1) {
            //     return;
            // }
            var row = $("<tr>").addClass("verified").appendTo($("#blacklisttable tbody"));
            var mappedNameTd = $("<td>").addClass("mappedNameHeader").html(key).appendTo(row);
            var countTotalTd = $("<td>").addClass("countTotalHeader").html(value).appendTo(row);
        });
    },

    MapControls: function() {
        var target = $(this);
        var verifySection = target.parent().find("div.verifySection");

        //Close editor dialog and update table
        if (target.hasClass("open")) {

            var newMapName = $("#newMapName").val();
            var newMapId = $("#newMapId").val();
            var searchHeader = target.parent().parent().find("td.searchHeader").text();
            var searchFilteredHeader = target.parent().parent().find("td.searchFilteredHeader").text();
            var dropdownOption = target.parent().find("div.verifySection select :selected");

            //Link search to existing company
            if (newMapName || newMapId) {
                if (newMapName) {
                    var id = -1;
                    if (newMapId) {
                        id = newMapId;
                    }
                    var searchMap = searchHeader;
                    if (showOnlyFiltered) {
                        searchMap = searchFilteredHeader;
                    }

                    mapFileData[searchMap] = {
                        "name": newMapName,
                        "id": id
                    }

                    //console.log("Pre: ", searchHeader, ", ", newMapName, ", ", mapFileData);

                    //Update table values
                    dwwFront.UpdateRow(target.parent().parent(), searchMap, mapFileData);
                    reverseMapData = dwwFront.BuildReverseMap(mapFileData);
                    dwwFront.BuildTotalsTable();
                    dwwFront.BuildBlacklistTable();
                }
            }

            //Cleanup
            target.removeClass("open").show();
            verifySection.html("");
            openDialog = null;

        } else {
            //Clear existing open dialogs
            target.addClass("open").hide();
            if (openDialog) {
                $(openDialog).find("button").removeClass("open").show();
                $(openDialog).find("div.verifySection").html("");
            }

            openDialog = target.parent();

            dwwFront.BuildMapDropdown(verifySection);
            $("<input id='newMapName' type='text' placeholder='" + capitalize(mapType) + " name'>").appendTo(verifySection);
            if (mapType != "role") {
                $("<input id='newMapId' type='text' placeholder='" + capitalize(mapType) + " ID'>").appendTo(verifySection);
            }
            $("<button id='saveFieldButton'>Save</button>").click(function() {
                target.click();
            }).appendTo(verifySection);
        }
    },

    BuildMapDropdown: function(parent) {
        var dropdown = $("<select>").addClass("dropdown").appendTo($(parent)).change(function() {
            var name = $("select :selected").html();
            var id = $("select :selected").val()
            if ($("select :selected").html() == "-Role-") {
                name = "zzz_role:" + $(this).parent().parent().parent().find(".searchHeader").text();
                id = "-1";
            } else if ($("select :selected").html() == "-Bad Data-") {
                name = "zzz_baddata:" + $(this).parent().parent().parent().find(".searchHeader").text();
                id = "-1";
            } else if ($("select :selected").html() == "--New " + capitalize(mapType) + "--") {
                name = ""
                id = ""
            }

            $(parent).find("#newMapName").val(name);
            $(parent).find("#newMapId").val(id);
        });

        $("<option>").attr("value", this.id).html("--New " + capitalize(mapType) + "--").appendTo(dropdown);
        $("<option>").attr("value", this.id).html("-Bad Data-").appendTo(dropdown);
        if (mapType == "company") {
            $("<option>").attr("value", this.id).html("-Role-").appendTo(dropdown);
        }

        $.each(reverseMapData, function(key, val) {
            if (key.search("zzz_role:") < 0 && (key.search("zzz_baddata:") < 0)) {
                $("<option>").attr("value", this.id).html(key).appendTo(dropdown);
            }
        });

        //Sort alphabetically
        var listitems = dropdown.children('option').get();
        listitems.sort(function(a, b) {
            return $(a).text().toUpperCase().localeCompare($(b).text().toUpperCase());
        })
        $.each(listitems, function(idx, itm) {
            dropdown.append(itm);
        });
    }
};

$(document).ready(function() {
    dwwFront.GetMapFile();

    //$("#sidebar").stick_in_parent();
    $("#maintable").stupidtable().bind('aftertablesort', function(event, data) {
        $("#maintable button").click(dwwFront.MapControls);
    });
    $("#totalstable").stupidtable();
    $("#blacklisttable").stupidtable();


    $("#useMapButton").click(function() {
        bUsemapFileData = !bUsemapFileData;
        dwwFront.BuildMappingTable(mapQueryData);
    });

    $("#uploadMap").click(function() {
        $.ajax({
            url: document.URL,
            type: "POST",
            data: JSON.stringify(mapFileData),
            contentType: "application/json",
            success: function(data) {
                alert("Upload complete");
                //dwwFront.BuildMappingTable(mapQueryData);
            },
            error: function(xhr, status) {
                console.log("HTTP problem!");
            }
        });
    });

    $("#searchCutoff").change(function() {
        minSearchFilter = $(this).val();
        $("#maintable tbody .searchCountHeader").each(function() {
            if (parseInt($(this).text()) < minSearchFilter) {
                $(this).parent().hide();
            } else {
                $(this).parent().show();
            }
        });
    });

    $("#showFiltered").click(function() {
        showOnlyFiltered = !showOnlyFiltered;
        dwwFront.BuildMappingTable(mapQueryData);
        if (showOnlyFiltered) {
            $(this).html("Filtered searches (ON)");
            $("#maintable .searchFilteredHeader").each(function() {
                var filtered = $(this);

                if (filtered.text()) {
                    filtered.parent().show();
                } else {
                    filtered.parent().hide();
                }
            });
            $("#maintable .searchFilteredHeader").show();
            $("#maintable .searchHeader").hide();
        } else {
            $(this).html("Filtered searches (OFF)");
            $("#maintable .searchFilteredHeader").hide();
            $("#maintable .searchHeader").show();
        };
    });
});