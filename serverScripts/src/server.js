/**
 * Module dependencies.
 */

var express = require('express'),
    dww = require('./routes/dwwRoutes.js'),
    http = require('http'),
    path = require('path'),
    app = express(),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    flash = require('connect-flash'),
    winston = require('winston'),
    freegeoip = require('node-freegeoip');


//Setup logging
winston.add(winston.transports.File, {
    filename: 'access.log'
});
winston.remove(winston.transports.Console);

//Setup authentication
passport.use(new LocalStrategy(
    function(username, password, done) {
        User.findOne({
            username: username
        }, function(err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, {
                    message: 'Incorrect username.'
                });
            }
            if (!user.validPassword(password)) {
                return done(null, false, {
                    message: 'Incorrect password.'
                });
            }
            return done(null, user);
        });
    }
));

var users = [{
    id: 1,
    username: 'dww',
    password: 'helix'
}];

function findById(id, fn) {
    var idx = id - 1;
    if (users[idx]) {
        fn(null, users[idx]);
    } else {
        fn(new Error('User ' + id + ' does not exist'));
    }
}

function findByUsername(username, fn) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.username === username) {
            return fn(null, user);
        }
    }
    return fn(null, null);
}


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    findById(id, function(err, user) {
        done(err, user);
    });
});


// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(
    function(username, password, done) {
        // asynchronous verification, for effect...
        process.nextTick(function() {

            // Find the user by username.  If there is no user with the given
            // username, or the password is not correct, set the user to `false` to
            // indicate failure and set a flash message.  Otherwise, return the
            // authenticated `user`.
            findByUsername(username, function(err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false, {
                        message: 'Unknown user ' + username
                    });
                }
                if (user.password != password) {
                    return done(null, false, {
                        message: 'Invalid password'
                    });
                }
                return done(null, user);
            })
        });
    }
));

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    console.log("Not logged in");
    res.redirect('/login')
}

// all environments
app.set('port', process.env.PORT || 8007);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
    secret: 'keyboard cat'
}));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.enable('trust proxy');

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

//Gets
app.get('/', ensureAuthenticated, dww.vizMain);

app.get('/login', function(req, res) {
    res.render('login', {
        user: req.user,
        message: req.flash('error')
    });
});

// POST /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//
//   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
app.post('/login',
    passport.authenticate('local', {
        failureRedirect: '/login',
        failureFlash: true
    }),
    function(req, res) {
        console.log('Authentication successful');

        freegeoip.getLocation(req.ip, function(err, location) {
            winston.log('info', location);
        });

        res.redirect('/');
    }
);
// app.post('/login', function(req, res, next) {
//     passport.authenticate('local', function(err, user, info) {
//         console.log("here");
//         if (user === false) {
//             console.log("Auth fail");
//         } else {
//             console.log("Auth success");
//             winston.log(req.ip);
//             //res.redirect('/');
//         }
//     })(req, res, next);
// });

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

//app.get('/all/json', dww.dumpJSON);
//app.get('/all/csv', dww.dumpCSV);
app.get('/list/jumps', ensureAuthenticated, dww.jumpList);
app.get('/list/companies', ensureAuthenticated, dww.companyList);
app.get('/list/searches', ensureAuthenticated, dww.companySearchList);
app.get('/list/companymap', ensureAuthenticated, dww.companyMappings);
app.get('/list/roles', ensureAuthenticated, dww.roleList);
app.get('/companymap', ensureAuthenticated, dww.companyMapper);
app.get('/rolemap', ensureAuthenticated, dww.roleMapper);

//Posts
app.post('/companymap', dww.editCompanyMap);
app.post('/rolemap', dww.editRoleMap);


/*
 * Start server
 */
http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});