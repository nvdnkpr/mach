var utils = require('./utils');
module.exports = makeRouter;

/**
 * A middleware that provides pattern-based routing for URL's, with optional
 * support for restricting matches to a specific request method. Populates the
 * `route` request variable with an object containing the results of the match
 * for all downstream apps.
 *
 *   var app = mach.router();
 *
 *   app.get('/', function (request) {
 *     return 'Welcome home!';
 *   });
 *
 *   app.get('/login', function (request) {
 *     return 'Please login.';
 *   });
 *
 *   app.post('/login', function (request) {
 *     // login logic goes here...
 *   });
 *
 *   app.get('/users/:user_id', function (request) {
 *     var userId = request.route.user_id;
 *     // find the user with the given id...
 *   });
 *
 *   mach.serve(app);
 *
 * Note: All routes are tried in the order they were defined.
 */
function makeRouter(defaultApp) {
  defaultApp = defaultApp || utils.defaultApp;

  var routes = {};

  function router(request) {
    var method = request.method;
    var routesToTry = (routes[method] || []).concat(routes.ANY || []);

    var route, match;
    for (var i = 0, len = routesToTry.length; i < len; ++i) {
      route = routesToTry[i];

      // Try to match the route.
      match = route.pattern.exec(request.pathInfo);
      if (!match) continue;

      // Define accessors for named route segments.
      var routeData = utils.slice(match, 0);
      Object.defineProperties(routeData, route.accessors);

      request.route = routeData;

      return request.call(route.app);
    }

    return request.call(defaultApp);
  }

  /**
   * Sets the given app as the default for this router.
   */
  router.run = function (app) {
    defaultApp = app;
  };

  /**
   * Adds a new route that runs the given app when a given pattern matches the
   * path used in the request. If the pattern is a string, it is automatically
   * compiled (see utils.compileRoute).
   */
  router.route = function (pattern, app, methods) {
    if (typeof methods === 'string') {
      methods = [ methods ];
    } else {
      methods = methods || [ 'ANY' ];
    }

    var keys = [];
    if (typeof pattern === 'string') {
      pattern = utils.compileRoute(pattern, keys);
    }

    if (!utils.isRegExp(pattern)) {
      throw new Error('Pattern must be a RegExp');
    }

    var route = { pattern: pattern, app: app };

    // Accessors are used for named route segments.
    route.accessors = keys.reduce(function (memo, key, index) {
      memo[key] = makeAccessorsForIndex(index);
      return memo;
    }, {});

    methods.forEach(function (method) {
      method = method.toUpperCase();
      if (routes[method]) {
        routes[method].push(route);
      } else {
        routes[method] = [ route ];
      }
    });
  };

  // Add sugar methods for common HTTP verbs. Note that GET defines
  // routes for both GET *and* HEAD requests.
  var methodVerbs = {
    get: [ 'GET', 'HEAD' ],
    post: 'POST',
    put: 'PUT',
    delete: 'DELETE',
    head: 'HEAD',
    options: 'OPTIONS'
  };

  for (var method in methodVerbs) {
    (function (verbs) {
      router[method] = function (pattern, app) {
        return router.route(pattern, app, verbs);
      };
    })(methodVerbs[method]);
  }

  return router;
}

function makeAccessorsForIndex(index) {
  return {
    get: function () {
      return this[index + 1];
    },
    set: function (value) {
      this[index + 1] = value;
    }
  };
}
