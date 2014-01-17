/*
 * DB setup
 */
var neo4j = require('neo4j');

var getAllQuery = [
    'MATCH (p:person)-[r:WORKED_FOR]-(c:company)',
    'RETURN p,r,c',
    'ORDER BY p.id, r.release'
].join('\n');

var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || 'http://localhost:7474');


/*
 * Data parsers
 */
exports.getAllPeopleAsCSV = function(callbackComplete) {
    var outCsv = ""
    var csvCols = ["personId", "personName", "personRole", "imdbMovieId", "searchedCompany", "searchedMatchRatio",
        "movieReleaseYear", "matchedCompanyId", "matchedCompanyName"
    ].join(",");

    db.query(getAllQuery, params = {}, function(err, results) {
        if (err) throw err;

        for (var i = 0; i < results.length; i++) {
            var line = results[i];
            var csvLine = [
                line.p._data.data.id,
                line.p._data.data.name,
                line.r._data.data.role.replace(',', ''),
                line.r._data.data.movieID,
                line.r._data.data.company.replace(',', ''),
                line.r._data.data.matchRatio,
                line.r._data.data.release,
                line.c._data.data.id,
                line.c._data.data.name
            ].join(",") + "\n";

            outCsv += csvLine;
        }
        callbackComplete(csvCols + "\n" + outCsv);
    });
};

exports.getAllPeopleAsJson = function(callbackComplete) {
    var outJson = [];

    db.query(getAllQuery, params = {}, function(err, results) {
        if (err) throw err;
        var lastpersonId = ""
        var lastPersonObject = {};

        for (var i = 0; i < results.length; i++) {
            var line = results[i];
            var currentPersonObject;

            if (lastPersonObject.id == line.p._data.data.id) {
                currentPersonObject = lastPersonObject;
            } else {
                if (currentPersonObject)
                    outJson.push(currentPersonObject);

                currentPersonObject = {
                    id: line.p._data.data.id,
                    name: line.p._data.data.name,
                    rels: []
                };
            }

            currentPersonObject.rels.push({
                imdbMovieId: line.r._data.data.movieID,
                companySearch: line.r._data.data.company,
                companyMatchRatio: line.r._data.data.matchRatio,
                personRole: line.r._data.data.role,
                movieReleaseYear: line.r._data.data.release,
                matchedCompanyId: line.c._data.data.id,
                matchedCompanyName: line.c._data.data.name
            });

            lastPersonObject = currentPersonObject;
        }

        //Push last person after loop finishes
        outJson.push(lastPersonObject);
        callbackComplete(outJson);
    });
};


exports.getCompanySearchList = function(callbackComplete) {
    var outJson = [];
    var query = [
        "MATCH (p:person)-[r:WORKED_FOR]-(c:company)",
        "RETURN DISTINCT r.company AS search, COUNT(r.company) AS count",
        "ORDER BY count DESC, r.company"
    ].join("\n");

    db.query(query, params = {}, function(err, results) {
        if (err) throw err;

        var outJson = [];
        for (var i = 0; i < results.length; i++) {
            outJson.push({
                'search': results[i]['search'],
                'count': results[i]['count']
            });
        }

        callbackComplete(outJson);
    });
}


exports.getCompanyList = function(callbackComplete) {
    var outJson = [];
    var query = [
        "MATCH (c:company)",
        "RETURN c.name as name, c.id as id"
    ].join("\n");

    db.query(query, params = {}, function(err, results) {
        if (err) throw err;

        var outJson = [];
        for (var i = 0; i < results.length; i++) {
            outJson.push({
                'company': results[i]['name'],
                'id': results[i]['id']
            });
        }

        callbackComplete(outJson);
    });
}


exports.getRoleList = function(callbackComplete) {
    var outJson = [];
    var query = [
        "MATCH (p:person)-[r:WORKED_FOR]-(c:company)",
        "RETURN DISTINCT r.role AS role, COUNT(r.role) AS count",
        "ORDER BY count DESC, r.role"
    ].join("\n");

    db.query(query, params = {}, function(err, results) {
        if (err) throw err;

        var outJson = [];
        for (var i = 0; i < results.length; i++) {
            console.log(results[i]);
            outJson.push({
                'role': results[i]['role'],
                'count': results[i]['count']
            });
        }
        callbackComplete(outJson);
    });
}



exports.getAllBadRelationships = function(callbackComplete) {
    var outJson = [];
    var query = [
        "MATCH (p:person)-[r:WORKED_FOR]-(c:company)",
        "WHERE r.matchRatio < 100",
        "RETURN r,c",
        "ORDER BY r.matchRatio"
    ].join("\n");

    db.query(query, params = {}, function(err, results) {
        if (err) throw err;

        var outJson = [];
        for (var i = 0; i < results.length; i++) {
            outJson.push({
                "searchResult": results[i].c._data.data,
                "searchedFor": results[i].r._data.data.company,
                "role": results[i].r._data.data.role
            });
        }

        callbackComplete(outJson);
    });
};