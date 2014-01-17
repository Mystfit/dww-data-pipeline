/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    dww = require('./routes/dwwRoutes.js'),
    http = require('http'),
    path = require('path'),
    app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

// Enables CORS
var enableCORS = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.send(200);
    } else {
        next();
    }
};
app.use(enableCORS);



/*
 * Routes
 */

//Cross domain scripting allowance
app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

app.get('/', routes.index);
app.get('/all/json', dww.dumpJSON);
app.get('/all/csv', dww.dumpCSV);
app.get('/list/companies', dww.companyList);
app.get('/list/searches', dww.companySearchList);
app.get('/list/roles', dww.roleList);
app.get('/non-matching', dww.allBadRelationships);

/*
 * Start server
 */
http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});