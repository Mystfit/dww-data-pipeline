/**
 * Worker instance to handle the calculations required to perform studio density population. This worker is unique
 * in that it initially populates the density data, but then continues existing to aid the Processing sketch in
 * filtering and supplying the correct data, as per the current timeslider value and the user's mouse position.
 * It is important to note that after the worker's creation, all following processes are to be treated as asynchronous.
 **/

var studios; // the collection of all studios 

self.addEventListener('message', function(e) {
    var cmd = e.data.cmd;
    switch (cmd) {
        case 'initialise':
            studios = e.data.studios;
            init(e.data.dataSet);
            self.postMessage({
                cmd: 'complete',
                contents: studios
            });
            break;
        case 'update':
            self.postMessage({
                cmd: 'updated',
                contents: getStudioDensity(e.data.studioName, e.data.year)
            });
            break;
        default:
            console.log("Worker issued an unrecognised command!");
            console.log(cmd);
    }
}, false);

/**
 * The inital startup function for this worker: to populate the studio data with density information.
 * Returns the studios collection to the main thread upon completion.
 *
 * @param dataSet - the JSON data for this GE population
 **/
function init(dataSet) {
    for (var i = 0; i < dataSet.people.length; i++) {
        populateStudioDensity(dataSet.people[i]);
    }
}

/**
 * Populates a studio's density from the records of individual VFX workers. A studio's density
 * object illustrates how populated a studio was throughout a given year, further categorised
 * in terms of role.
 *
 * This method assumes the following:
 *
 * > The year before the first recorded entry of the company in the database, the company was
 * at 0 density.
 *
 * > As we don't know the years specific companies dissolved, we have to assume that if a person's
 * last credit is at a company, that person is removed from the company's density the following year.
 *
 * @param person - the person we are populating the studio densities with
 */
function populateStudioDensity(person) {
    //adds one to the given studio density, at the given year, associated with the given role  
    function addToDensity(studio, year, role) {
        if (studios[studio].density[year] == undefined) {
            studios[studio].density[year] = {};
        }
        if (studios[studio].density[year][role] == undefined) {
            studios[studio].density[year][role] = 1;
        } else {
            studios[studio].density[year][role] += 1;
        }
    }
    //go through a person's credits 
    for (var i = 0; i < person.rels.length; i++) {
        var credit = person.rels[i];
        var year = new Date(credit.movieReleaseYear).getFullYear();
        if (i + 1 < person.rels.length) { //implies not the final credit 
            var nextCredit = person.rels[i + 1]; //skip the dummy 
            var nextYear = new Date(nextCredit.movieReleaseYear).getFullYear();
            if (year == nextYear && credit.matchedCompanyName == nextCredit.matchedCompanyName) continue; //same year, same company, ignore 
            var count = year;
            // do/while allows for multiple credits to different studios in one year 
            do {
                addToDensity(credit.matchedCompanyName, count.toString(), credit.personMappedRole);
                count++;
            } while (count < nextYear);
        } else { //we are at the last credit for this person
            addToDensity(credit.matchedCompanyName, year.toString(), credit.personMappedRole);
        }
    }
}

/**
 * Returns an object containing the density information for the specified studio, during the current
 * year (as specified by the GE internal clock time).
 *
 * @param studioName - the studio whose density information to retrieve
 * @param year - the [] of start and end dates for the current timeslider value
 * @returns an object containing the total density figure for this studio during this year, as well
 *          as an array of roles, representing the breakdown of this figure into each role.
 **/
function getStudioDensity(studioName, year) {
    if (studioName == undefined || year == undefined) return;
    var studio = studios[studioName];
    if (studio == undefined) return;
    var currentYear = year.length == 2 && year[1] != undefined ? year[1] : year[0];
    var densityReport = {};
    //iterate over all properties 
    for (var property in studio.density[currentYear]) {
        if (studio.density[currentYear].hasOwnProperty(property)) {
            densityReport[property] = studio.density[currentYear][property];
        }
    }
    var total = 0;
    for (var role in densityReport) {
        if (densityReport.hasOwnProperty(role)) {
            total += densityReport[role];
        }
    }
    densityReport.total = densityReport[""] ? total - densityReport[""] : total; //remove unmapped instances 
    return densityReport;
}