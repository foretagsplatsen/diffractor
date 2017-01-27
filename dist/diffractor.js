(function(root, factory) {
    if (typeof define === "function" && define.amd) {
        define("diffractor", ["jquery", "klassified"], factory);
    } else {
        root.diffractor = factory(root.$, root.klassified);
    }
}(this, function($, klassified) {
/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

    define('jquery', function() { return $; })
    define('klassified', function() { return klassified; })
define('src/url',[
	"klassified"
], function(klassified) {

	/**
	 * Token/Char used to separate segments in URL paths.
	 * @type {string}
	 */
	var urlSeparator = "/";

	/**
	 * A `url` actually represents the fragment part of the actual url.
	 *
	 * @example
	 *    var url = url({rawUrl: "path/to?foo=a&bar=b"});
	 *    url.getPath(); // => "path/to"
	 *    url.getQuery(); // => {foo: "a", bar: "b"}
	 *    url.matchRoute(aRoute); // => true
	 *
	 * @param {string} rawUrl
	 * @returns {url}
	 */
	var url = klassified.object.subclass(function(that, my) {

		var rawUrl;
		var path;
		var query;
		var segments;

		my.initialize = function(spec) {
			my.super(spec);
			rawUrl = spec.rawUrl || "";
			path = parsePath(rawUrl);
			query = parseQuery(rawUrl);
			segments = parseSegments(path);
		};

		//
		// Public
		//

		/**
		 * URL path
		 * @returns {string}
		 */
		that.getPath = function() { return path; };

		/**
		 * Key/Value pairs parsed from query
		 *
		 * @returns {{}}
		 */
		that.getQuery = function() { return query; };

		/**
		 * Segments in path parsed by splitting `path` by `urlSeparator`
		 *
		 * @returns {string[]}
		 */
		that.getSegments = function() { return segments; };

		/**
		 * Answers true if the route is a match for the receiver
		 *
		 * @param route
		 * @returns {boolean}
		 */
		that.matchRoute = function(route) {
			return route.matchUrl(that);
		};

		/**
		 * Returns `rawUrl`
		 * @returns {string}
		 */
		that.toString = function() {
			return rawUrl;
		};
	});

	/**
	 * Create URL from path and query
	 *
	 * @example
	 *    var aUrl = url("/path/to", {foo: "bar" });
	 *    aUrl.toString(); // => "path/to?foo=bar"
	 *
	 * @param {string} path
	 * @param {{}} query
	 * @returns {url}
	 */
	url.build = function(path, query) {
		if (typeof(path) === "undefined" || path === null || typeof path !== "string") {
			throw "accepts only string paths";
		}

		if (query) {
			var queryPart = decodeURIComponent(jQuery.param(query));
			if (queryPart) {
				return url({rawUrl: path + "?" + queryPart});
			}
		}

		return url({rawUrl: path});
	};

	/**
	 * Splits URL path into segments. Removes leading, trailing, and
	 * duplicated `urlSeparator`.
	 *
	 * @example
	 *    parseSegments("/a/path/to"); // => ["a", "path", "to"]
	 *
	 * @param path
	 * @returns {string[]}
	 */
	function parseSegments(path) {
		// Split on separator and remove all leading, trailing, and
		// duplicated `urlSeparator` by filtering empty strings.
		return path.split(urlSeparator).filter(Boolean);
	}

	/**
	 * Returns path from a raw URL
	 *
	 * @example
	 *    parsePath("/a/path/to?foo=bar"); // => "/a/path/to"
	 *
	 * @param {string} rawUrl
	 * @returns {string}
	 */
	function parsePath(rawUrl) {
		return rawUrl.replace(/\?.*$/g, "");
	}

	/**
	 * Extract query key/value(s) from a rawUrl and return them as an
	 * object literal with key/values.
	 *
	 * @example
	 *    parsePath("/a/path/to?foo=bar&test=1"); // => {foo: "bar", test: "1"}
	 *
	 * @param {string} rawUrl
	 * @returns {{}}
	 */
	function parseQuery(rawUrl) {
		// Extract query key/value(s) from a rawUrl and add them to `query` object.
		var result = /[^?]*\?(.*)$/g.exec(rawUrl);
		var query = {};
		var pair;
		if (result && result.length >= 2) {
			(result[1].split("&")).forEach(function(each) {
				pair = each.split("=");
				query[pair[0]] = pair[1];
			});
		}

		return query;
	}

	return url;
});

define('src/abstractSegment',[
	"klassified"
], function(klassified) {
	/**
	 * A segment represents a single part of a route that can be matched
	 * against a URL segment using `match()`.
	 *
	 * @param {{}} spec
	 * @param {string} segmentString
	 * @param {{}} spec.options all route options
	 * @param my
	 * @returns {abstractSegment}
	 */
	var abstractSegment = klassified.object.subclass(function(that, my) {

		my.initialize = function(spec) {
			my.super(spec);
			my.segmentString = spec.segmentString;
			my.options = spec.options || {};
		};

		//
		// Public
		//

		/**
		 * Answers true if route segment match URL segment
		 *
		 * @param {string} urlSegment
		 * @returns {boolean}
		 */
		that.match = function(urlSegment) {
			return false;
		};

		/**
		 * Value captured for urlSegment
		 *
		 * @param {string} urlSegment
		 * @returns {*}
		 */
		that.getValue = function(urlSegment) {
			return my.segmentString;
		};

		/**
		 * Variable part of the route.
		 *
		 * @returns {boolean}
		 */
		that.isParameter = function() {
			return false;
		};

		/**
		 * Optional segments can be omitted in URLs and the
		 * URL will still match the route if all other non
		 * optional segments match.
		 *
		 * @returns {boolean}
		 */
		that.isOptional = function() {
			return false;
		};

		/**
		 * String representation for segment that can be used eg. when debugging.
		 * @returns {*}
		 */
		that.toString = function() {
			return my.segmentString;
		};
	});

	abstractSegment.class(function(that) {
		that.match = function(segmentString) {
			return false;
		};
	});

	return abstractSegment;
});

define('src/parameterSegment',[
	"./abstractSegment"
], function(abstractSegment) {

	/**
	 * Constructs validator functions from constraints parameters.
	 *
	 * @param {*} constraint
	 * @returns {function} function that take a urlSegment as argument
	 */
	function parameterValidator(constraint) {
		// Custom function that take a url segment as argument
		if (typeof constraint === "function") {
			return constraint;
		}

		// Match against RegExp
		if (constraint instanceof RegExp) {
			var exp = new RegExp(constraint);
			return function(urlSegment) {
				return exp.test(urlSegment);
			};
		}

		// Match valid options in an array
		if (Object.prototype.toString.call(constraint) === "[object Array]") {
			var options = constraint.map(function(option) {
				return option.toLowerCase();
			});
			return function(urlSegment) {
				var val = urlSegment.toLowerCase();
				return options.indexOf(val) !== -1;
			};
		}
		return null;
	}

	/**
	 * Parameter match URL segments if all constraints are met.
	 *
	 * @param {{}} spec abstractSegment spec
	 * @param [my]
	 * @returns {parameterSegment}
	 */
	var parameterSegment = abstractSegment.subclass(function(that, my) {

		my.initialize = function(spec) {
			my.super(spec);
			my.name = my.segmentString.substr(1); // strip of the leading #
			my.constraints = (my.options.constraints && my.options.constraints[my.name] &&
				[my.options.constraints[my.name]]) || [];
			my.validators = my.constraints.map(parameterValidator).filter(Boolean);
		};

		//
		// Public
		//

		/**
		 * Name is segmentString without leading property type char.
		 *
		 * @returns {string}
		 */
		that.getName = function() {
			return my.name;
		};

		/**
		 * Value captured for urlSegment
		 *
		 * @param {string} urlSegment
		 * @returns {*}
		 */
		that.getValue = function(urlSegment) {
			return urlSegment;
		};

		/**
		 * Always true
		 *
		 * @returns {boolean}
		 */
		that.isParameter = function() {
			return true;
		};

		/**
		 * Match urSegment if all constraints are met.
		 *
		 * @param {string} urlSegment
		 * @returns {boolean|*}
		 */
		that.match = function(urlSegment) {
			return urlSegment !== undefined && that.validate(urlSegment);
		};

		/**
		 * Answers true if url segment meet all constraints for parameter.
		 *
		 * @param {string} urlSegment
		 * @returns {boolean}
		 */
		that.validate = function(urlSegment) {
			return my.validators.every(function(validator) {
				return validator(urlSegment);
			});
		};

		/**
		 * String representation for segment that can be used eg. when debugging.
		 * @returns {*}
		 */
		that.toString = function() {
			return "param(" + that.getName() + ")";
		};
	});

	parameterSegment.class(function(that) {

		/**
		 * Match segment strings with a leading `#`.
		 * @param {string} segmentString
		 * @returns {boolean}
		 */
		that.match = function(segmentString) {
			return segmentString.substr(0, 1) === "#";
		};
	});

	return parameterSegment;
});

define('src/optionalParameterSegment',[
	"./parameterSegment"
], function(parameterSegment) {

	/**
	 * Optional parameters can have a default value.
	 *
	 * @param {{}} spec abstractSegment string
	 * @param my
	 * @returns {parameter}
	 */
	var optionalParameterSegment = parameterSegment.subclass(function(that, my) {

		my.initialize = function(spec) {
			my.super(spec);
			my.defaultValue = my.options.defaults && my.options.defaults[my.name];
		};

		//
		// Public
		//

		/**
		 * Parameter value or default value if not matched.
		 *
		 * @param {string} urlSegment
		 * @returns {*}
		 */
		that.getValue = function(urlSegment) {
			return urlSegment === undefined ?
				my.defaultValue :
				urlSegment;
		};

		/**
		 * Always true.
		 * @returns {boolean}
		 */
		that.isOptional = function() {
			return true;
		};

		/**
		 * String representation for segment that can be used eg. when debugging.
		 * @returns {*}
		 */
		that.toString = function() {
			return "optional(" + that.getName() + ")";
		};
	});

	optionalParameterSegment.class(function(that) {
		/**
		 * Match segment strings with a leading `?`.
		 * @param {string} segmentString
		 * @returns {boolean}
		 */
		that.match = function(segmentString) {
			return segmentString.substr(0, 1) === "?";
		};
	});

	return optionalParameterSegment;
});

define('src/staticSegment',[
	"./abstractSegment"
], function(abstractSegment) {

	/**
	 * A static segment match URL segments that are identical
	 * to the route segment string.
	 *
	 * @param spec abstractSegment spec
	 * @param [my]
	 * @returns {segment}
	 */
	var staticSegment = abstractSegment.subclass(function(that, my) {

		/**
		 * Static segment match if URL and route segment
		 * strings are identical.
		 *
		 * @param {string} urlSegment
		 * @returns {boolean}
		 */
		that.match = function(urlSegment) {
			return that.getValue() === urlSegment;
		};

		return that;
	});

	staticSegment.class(function(that) {

		/**
		 * Match all but parameter segment strings
		 * @param {string} segmentString
		 * @returns {boolean}
		 */
		that.match = function(segmentString) {
			return ["#", "?"].indexOf(segmentString[0]) === -1;
		};
	});

	return staticSegment;
});

define('src/routeFactory',[
	"./abstractSegment",
	"./parameterSegment",
	"./optionalParameterSegment",
	"./staticSegment"
], function(abstractSegment) {

	/**
	 * Token/Char used to separate segments in route patterns.
	 * @type {string}
	 */
	var routePatternSeparator = "/";

	/**
	 * Creates a route from pattern. A pattern is a string with route segments
	 * separated by `routePatternSeparator`.
	 *
	 * @example
	 *    routeFactory(`/foo/#bar/?baz`);
	 *
	 * @param {string} pattern
	 * @param {{}} options
	 * @returns {abstractSegment[]}
	 */
	function routeFactory(pattern, options) {
		if (!pattern) {
			return [];
		}

		options = options || {};
		var segmentStrings = pattern.split(routePatternSeparator);

		var nonEmptySegmentStrings = segmentStrings
			.map(Function.prototype.call, String.prototype.trim)
			.filter(Boolean);

		var segmentArray = nonEmptySegmentStrings.map(function(segmentString) {
			return segmentFactory(segmentString, options);
		});

		return segmentArray;
	}

	/**
	 * Create segment from string
	 *
	 * @param {string} segmentString
	 * @param {{}} options
	 * @returns {abstractSegment}
	 */
	function segmentFactory(segmentString, options) {
		options = options || {};

		var segments = abstractSegment.allSubclasses();

		// Find segment type from string
		for (var i = 0; i < segments.length; i++) {
			var segment = segments[i];
			if (segment.match(segmentString)) {
				return segment({
					segmentString: segmentString,
					options: options
				});
			}
		}

		return null;
	}

	return routeFactory;
});

define('src/events',[], function() {

	/**
	 * Keeps a list of bindings/callbacks that can be added using **push()** and
	 * removed using **remove()**. *trigger()* executes all callbacks one by one in registration order.
	 *
	 * @param [spec] {Object}
	 * @param [my] {Object}
	 * @returns {event}
	 */
	function event(spec, my) {
		my = my || {};

		// DEPRECATED: use that.register() instead.
		function that(callback) {
			// eslint-disable-next-line no-console
			console.warn("Using an event as a function is deprecated. Send register() to the event instead.");
			return that.register(callback);
		}

		var bindings = [];

		// #### Public API

		/**
		 * Binds callback to event. The callback will be invoked whenever the event is fired.
		 *
		 * @deprecated use that.register() instead.
		 * @param callback {function}
		 * @returns {eventBinding}
		 */
		that.on = function(callback) {
			// eslint-disable-next-line no-console
			console.warn("Sending on() to an event is deprecated. Send register() instead.");
			return that.register(callback);
		};

		/**
		 * Binds callback to event. The callback will be invoked whenever the event is fired.
		 *
		 * @param callback {function}
		 * @returns {eventBinding}
		 */
		that.register = function(callback) {
			return bindCallback(callback);
		};

		/**
		 * Binds a callback to an event
		 *
		 * @param spec.callback {function} Callback to execute on event
		 * @param spec.event {event} Event to bind callback to

		 * @returns {eventBinding}
		 */
		function eventBinding(spec) {
			spec = spec || {};
			var that = {};

			var callback = spec.callback;
			var event = spec.event;

			/**
			 * Is bound to an event
			 * @returns {boolean}
			 */
			that.isBound = function() {
				return event !== undefined;
			};

			/**
			 * Remove itself from event, if bound.
			 */
			that.unbind = function() {
				if (that.isBound()) {
					event.unregister(that);
					event = undefined;
				}
			};

			/**
			 * @param anEvent
			 */
			that.bind = function(anEvent) {
				that.unbind();
				if (anEvent) {
					event = anEvent;
				}
			};

			/**
			 * Executes connected callback
			 * @param params
			 */
			that.execute = function(params) {
				if (callback) {
					callback.apply(that, params);
				}
			};

			return that;
		}

		/**
		 * Like on() except callback will only be fired once
		 *
		 * @deprecated use registerOnce() instead
		 * @param callback {function}
		 * @returns {eventBinding}
		 */
		that.onceOn = function(callback) {
			// eslint-disable-next-line no-console
			console.warn("Sending onceOn() to an event is deprecated. Send registerOnce() instead.");
			return that.registerOnce(callback);
		};

		/**
		 * Like on() except callback will only be fired once
		 *
		 * @param callback {function}
		 * @returns {eventBinding}
		 */
		that.registerOnce = function(callback) {
			var onceBinding = eventBinding({
				callback: function() {
					my.remove(onceBinding);
					callback.apply(that, arguments);
				}
			});

			bindings.push(onceBinding);
			return onceBinding;
		};

		/**
		 * Removed "binding" attached to event.
		 * @deprecated use unregister() instead
		 * @param name {String} Name of event
		 * @param binding {eventBinding} Binding
		 */
		that.off = function(binding) {
			// eslint-disable-next-line no-console
			console.warn("Sending off() to an event is deprecated. Send unregister() instead.");
			that.unregister(binding);
		};

		/**
		 * Removed "binding" attached to event.
		 * @param name {String} Name of event
		 * @param binding {eventBinding} Binding
		 */
		that.unregister = function(binding) {
			my.remove(binding);
		};

		/**
		 * Trigger event by executing all callbacks one by one in registration order.
		 *
		 * @param arguments {Object|Object[]} Arguments passed to callback of each binding
		 */
		that.trigger = function() {
			var params = Array.prototype.slice.call(arguments);
			bindings.forEach(function(binding) {
				binding.execute(params);
			});
		};

		/**
		 * Unbind all callbacks bound to this event.
		 */
		that.dispose = function() {
			bindings.slice().forEach(function(binding) {
				binding.unbind();
			});
		};

		/**
		 * @param binding {eventBinding}
		 */
		my.push = function(binding) {
			bindings.push(binding);
			binding.bind(that);
		};

		/**
		 * @param binding {eventBinding}
		 */
		my.remove = function(binding) {
			bindings.splice(bindings.indexOf(binding), 1);
		};

		/**
		 * Create and add callback binding to event
		 *
		 * @param callback
		 * @returns {eventBinding}
		 */
		function bindCallback(callback) {
			var binding = eventBinding({callback: callback, event: that});
			bindings.push(binding);
			return binding;
		}

		return that;
	}

	/**
	 * Keeps a list of events.
	 *
	 * @returns {{}}
	 */
	function eventCategory() {
		var that = {};

		// Map of events with name as key
		var namedEvents = {};
		var events = [];

		/**
		 * Lazily makes sure that an event exists for "name".
		 *
		 * @param name {String}
		 * @returns {event} Also return the event
		 */
		function ensureEventHolderFor(name) {
			if (!hasEventNamed(name)) {
				addEvent(event(), name);
			}
			return namedEvents[name];
		}

		/**
		 * Create a new event and if name i supplied adds it to event manager
		 *
		 * @param [name] {string} Name of event in eventHandler
		 * @returns {event}
		 */
		that.createEvent = function(name) {
			return addEvent(event(), name);
		};

		/**
		 * Binds callback to a named event. The callback will be invoked whenever the event is fired.
		 *
		 * @deprecated use register() instead
		 * @param name {String}
		 * @param callback {function}
		 */
		that.on = function(name, callback) {
			// eslint-disable-next-line no-console
			console.warn("Sending on() to a category is deprecated. Send register() instead.");
			return that.register(name, callback);
		};

		/**
		 * Binds callback to a named event. The callback will be invoked whenever the event is fired.
		 *
		 * @param name {String}
		 * @param callback {function}
		 */
		that.register = function(name, callback) {
			return ensureEventHolderFor(name).register(callback);
		};

		/**
		 * Removed "binding" attached to event.
		 * @deprecated use unregister() instead
		 * @param name {String} Name of event
		 * @param binding {eventBinding} Binding
		 */
		that.off = function(name, binding) {
			// eslint-disable-next-line no-console
			console.warn("Sending off() to a category is deprecated. Send unregister() instead.");
			return that.unregister(name, binding);
		};

		/**
		 * Removed "binding" attached to event.
		 * @param name {String} Name of event
		 * @param binding {eventBinding} Binding
		 */
		that.unregister = function(name, binding) {
			return ensureEventHolderFor(name).unregister(binding);
		};

		/**
		 * Like on() except callback will only be fired once
		 *
		 * @deprecated use registerOnce() instead
		 * @param name
		 * @param callback
		 * @returns {*}
		 */
		that.onceOn = function(name, callback) {
			// eslint-disable-next-line no-console
			console.warn("Sending onceOn() to a category is deprecated. Send registerOnce() instead.");
			return that.registerOnce(name, callback);
		};

		/**
		 * Like on() except callback will only be fired once
		 *
		 * @param name
		 * @param callback
		 * @returns {*}
		 */
		that.registerOnce = function(name, callback) {
			return ensureEventHolderFor(name).registerOnce(callback);
		};

		/**
		 * Trigger all callbacks attached to event
		 * @param name
		 * @param arguments Any arguments to trigger is sent as arguments to callback.
		 */
		that.trigger = function(name) {
			var params = Array.prototype.slice.call(arguments, 1);
			var event = ensureEventHolderFor(name);
			event.trigger.apply(that, params);
		};

		/**
		 * Dispose all events.
		 */
		that.dispose = function() {
			events.forEach(function(event) {
				event.dispose();
			});

			namedEvents = {};
			events = [];
		};

		/**
		 * Answers true if an event with name exists
		 *
		 * @param name {String}
		 * @returns {boolean}
		 */
		function hasEventNamed(name) {
			return namedEvents[name] !== undefined;
		}

		/**
		 * @param event {event}
		 * @param [name] {string}
		 * @returns {event}
		 */
		function addEvent(event, name) {
			events.push(event);
			if (name) {
				namedEvents[name] = event;
			}
			return event;
		}

		return that;
	}

	/**
	 * Singleton object that keeps a list of named event categories.
	 */
	var eventManager = (function() {
		var that = {};

		// Map of event categories with (category) name as key
		var categories = {};

		/**
		 * Register a new event category with "name".
		 * @param name
		 * @returns {eventCategory}
		 */
		that.register = function(name) {
			if (categories[name]) {
				throw ("A event category is already registered for " + name);
			}
			categories[name] = eventCategory();

			return categories[name];
		};

		/**
		 * Returns event category by name. Creates a new category if not already
		 * registered.
		 * @param name
		 * @returns {*}
		 */
		that.at = function(name) {
			if (!categories[name]) {
				that.register(name);
			}

			return categories[name];
		};

		return that;
	})();

	// Exports Singleton event manager
	// but also expose event and event category

	eventManager.eventCategory = eventCategory;
	//@deprecated Spelling mistake
	eventManager.eventhandler = eventCategory;
	eventManager.event = event;

	return eventManager;
});

define('src/routeMatchResult',[
	"klassified"
], function(klassified) {

	/**
	 * Route match result are used as the answer of matching a url against a route.
	 *
	 * @param {{}} [spec]
	 * @param {{}} spec.url Matched URL
	 * @param {{}} spec.route Matched Route
	 * @param {{}} spec.values Hash with matched parameter names as keys and matching url segment values.
	 *
	 * @returns {routeMatchResult}
	 */
	var routeMatchResult = klassified.object.subclass(function(that, my) {

		var url;
		var route;
		var urlParameters;
		var routeParameters;
		var parameters;

		my.initialize = function(spec) {
			my.super(spec);
			url = spec.url;
			route = spec.route;

			urlParameters = (url && url.getQuery && url.getQuery()) || {};
			routeParameters = spec.values || {};
			parameters = mergeParameters(routeParameters, urlParameters);
		};

		//
		// Public
		//

		/**
		 * Matched route
		 *
		 * @returns {route}
		 */
		that.getRoute = function() {
			return route;
		};

		/**
		 * Matched URL
		 *
		 * @returns {url}
		 */
		that.getUrl = function() {
			return url;
		};

		/**
		 * Answers true if route match URL
		 *
		 * @returns {boolean}
		 */
		that.isMatch = function() {
			return true;
		};

		/**
		 * Values for parameters in route
		 *
		 * @returns {{}}
		 */
		that.getRouteParameters = function() {
			return routeParameters;
		};

		/**
		 * Values for parameters in query
		 *
		 * @returns {{}}
		 */
		that.getQueryParameters = function() {
			return url.getQuery();
		};

		/**
		 * All matched parameters
		 *
		 * @returns {{}}
		 */
		that.getParameters = function() {
			return parameters;
		};

		/**
		 * Constructs an array with all parameters in same order as in route pattern with
		 * query parameter as the last value.
		 *
		 * @returns {Array}
		 */
		that.getActionArguments = function() {
			var actionArguments = Object.keys(routeParameters).map(function(parameterName) {
				return routeParameters[parameterName];
			});
			actionArguments.push(url.getQuery());
			return actionArguments;
		};

		//
		// Private
		//

		function mergeParameters(routeParameters, queryParameters) {
			var allValues = {};

			// Fill with route parameters
			for (var parameterName in routeParameters) {
				if (routeParameters.hasOwnProperty(parameterName)) {
					allValues[parameterName] = routeParameters[parameterName];
				}
			}

			// Fill with query parameters
			for (var queryParameterName in queryParameters) {
				if (queryParameters.hasOwnProperty(queryParameterName)) {
					allValues[queryParameterName] = queryParameters[queryParameterName];
				}
			}

			return allValues;

		}
	});

	routeMatchResult.class(function(that) {

		/**
		 * Result to use when match does not match url
		 */
		that.routeNoMatchResult = (function() {

			/** @typedef {routeMatchResult} routeNoMatchResult */
			var instance = that();

			instance.isMatch = function() {
				return false;
			};

			return instance;
		})();
	});

	return routeMatchResult;
});

define('src/route',[
	"./routeFactory",
	"./events",
	"./routeMatchResult",
	"./url",
	"klassified",
	"jquery"
], function(routeFactory, events, routeMatchResult, url, klassified) {

	/**
	 * Routes represent the path for which an action should be taken (see `matched` event).
	 *
	 * Route is implemented as an array of segments. A route can be constructed from a segment array
	 * or a route pattern string.
	 *
	 * @example
	 *        var aRouteFromSegments = route({segments: arrayOfRouteSegments});
	 *        var aRouteFromPattern = route("/segmentA/#aParameter/?andAnOptionalParameter");
	 *
	 * Route pattern strings are parsed into segment arrays by `routeFactory`.
	 *
	 * Route match URL:s by comparing the URL segments against an array
	 * of route segments. A route match a URL if the segments matches the route segments.
	 *
	 * @example
	 *    route("/User/#id").matchUrl("/User/john").matched(); // => true
	 *
	 * Route would match URL since first segment in URL match Route (both "User") and second
	 * segment is matched since a route parameter will match all values (if no constraints).
	 *
	 * Some segments can be optional and other mandatory. The strategy to match route with optional
	 * segments is to match it against the segments and then all combinations of optional parameters.
	 *
	 * An array with all optional sequences is calculated when route is created.
	 *
	 * Note: Avoid large number of optionals since it will consume memory and slow down matching.
	 * You can use query parameters instead.
	 *
	 * When a URL is matched the router will bind matches parameters to corresponding segments in URL
	 * and return them in `matchResult`
	 *
	 * @example
	 *
	 *        var result = route("/user/#id").matchUrl("/user/john");
	 *        console.dir(result.getValues()); // => { user: "john"}
	 *
	 * Routes can also be used as patterns for creating URLs
	 *
	 *        var url = route("/user/#id").expand({id: "john"});
	 *        console.log(url); // => "/user/john"
	 *
	 *
	 * @param {string|{}} spec Route pattern or route spec
	 * @param {boolean} spec.ignoreTrailingSegments Route will match if all route segment match
	 * even if url have trailing unmatched segments
	 * @param {segment[]} [spec.segments] Array of route segments
	 *
	 * @param {{}} my
	 * @returns {route}
	 */
	var route = klassified.object.subclass(function(that, my) {

		var segments;
		var ignoreTrailingSegments;
		var optionalSequences;

		my.initialize = function(spec) {
			my.super();
			// Build segments from pattern
			segments = routeFactory(spec.pattern, spec.options);

			// Route match URL if all route segments match
			// but URL still contain trailing segments (default false)
			ignoreTrailingSegments = (spec.options && spec.options.ignoreTrailingSegments) || false;

			// Array with all optional sequences, ie. all combinations
			// of optional parameters. Array must be ordered to match URL:s
			// left to right.
			optionalSequences = [];

			// Pre-calculate optional sequences.
			ensureOptionalSequences();
		};

		my.events = events.eventCategory();

		//
		// Public
		//

		that.matched = my.events.createEvent("matched");
		that.onMatched = that.matched; // deprecated

		// @deprecated Use event property instead
		that.on = my.events.register;

		/**
		 * Match route against URL by comparing segments. Triggers
		 * `matched` event on match.
		 *
		 * @param {url} url
		 * @returns {routeMatchResult}
		 */
		that.matchUrl = function(url) {
			var match = findMatch(url);
			if (!match) {
				return routeMatchResult.routeNoMatchResult;
			}

			var result = createMatchResult(match, url);
			my.events.trigger("matched", result);

			return result;
		};

		/**
		 * Expands route into a url. All non optional route parameters must exist
		 * in `params`.
		 *
		 * @param {{}} params Key/Values where keys are route parameter names and values the values to use
		 *
		 * @returns {string} URL string
		 */
		that.expand = function(params) {
			params = params || {};

			// Try to expand route into URL
			var urlSegments = [];
			segments.forEach(function(routeSegment) {
				var urlSegment;
				if (routeSegment.isParameter()) {
					// Use supplied value for parameters
					urlSegment = params[routeSegment.getName()];
				} else {
					// name/value for segments
					urlSegment = routeSegment.getValue();
				}

				// Skip if no match and optional
				if (urlSegment === undefined &&
					routeSegment.isOptional()) {
					return;
				}

				// Validate segment
				if (!routeSegment.match(urlSegment)) {
					throw new Error("Could not generate a valid URL");
				}

				urlSegments.push(urlSegment);
			});

			var query = {};

			Object.keys(params).forEach(function(param) {
				if (!that.hasParameter(param)) {
					query[param] = params[param];
					// Handle array param values
					if (query[param] instanceof Array) {
						query[param] = query[param].join(",");
					}
				}
			});

			return url.build(urlSegments.join("/"), query).toString();
		};

		/**
		 * Answers true if parameter with `name` exists in route.
		 *
		 * @param {string} name
		 * @returns {boolean}
		 */
		that.hasParameter = function(name) {
			return segments.some(function(segment) {
				return segment.isParameter() && segment.getName() === name;
			});
		};

		/**
		 * Returns a string representation of route useful for debugging.
		 *
		 * @returns {string}
		 */
		that.toString = function() {
			return "route(" + segments.join("/") + ")";
		};

		//
		// Private
		//

		/**
		 * Checks if an array of url segments match a sequence of route segments.
		 *
		 * @param {string[]} urlSegments
		 * @param {segments[]} [sequence] Route segments will be used as default
		 * @returns {boolean}
		 */
		function isMatch(urlSegments, sequence) {
			sequence = sequence || segments;

			// Can not match if different sizes
			if (urlSegments.length !== sequence.length && !ignoreTrailingSegments) {
				return false;
			}

			// All routeSegments much match corresponding URL segment
			return sequence.every(function(routeSegment, index) {
				var urlSegment = urlSegments[index];
				return urlSegment !== undefined && routeSegment.match(urlSegment);
			});
		}

		/**
		 * Returns first sequence of segments that match url or null if no sequence match.
		 *
		 * @param {url} url
		 * @returns {segment[]}
		 */
		function findMatch(url) {
			var urlSegments = url.getSegments();

			// Try match url segments
			if (isMatch(urlSegments)) {
				return segments;
			}

			// then optional sequences
			var sequenceIndex;
			for (sequenceIndex = 0; sequenceIndex < optionalSequences.length; sequenceIndex++) {
				if (isMatch(urlSegments, optionalSequences[sequenceIndex])) {
					return optionalSequences[sequenceIndex];
				}
			}

			return null;
		}

		/**
		 * Pre-calculate all optional sequences of segments.
		 */
		function ensureOptionalSequences() {
			// Find positions for optionals
			var optionalPositions = [];
			segments.forEach(function(segment, index) {
				if (segment.isOptional()) {
					optionalPositions.push(index);
				}
			});

			if (optionalPositions.length > 15) {
				throw new Error("Too many optional arguments. \"" + optionalPositions.length +
					"\" optionals would generate  " + Math.pow(2, optionalPositions.length) +
					" optional sequences.");
			}

			// Generate possible sequences
			var possibleOptionalSequences = orderedSubsets(optionalPositions);

			possibleOptionalSequences.forEach(function(sequence) {
				// Clone segments array and remove optionals matching
				// indexes in index sequence
				var optionalSequence = segments.slice();
				sequence.forEach(function(optionalIndex, numRemoved) {
					// Remove optional but take in to account that we have already
					// removed {numRemoved} from permutation.
					optionalSequence.splice(optionalIndex - numRemoved, 1);
				});

				optionalSequences.push(optionalSequence);
			});
		}

		/**
		 * Create a "routeMatchResult" from a matched sequence.
		 *
		 * @param {segment[]} match Matched segment sequence
		 * @param {url} url Matched URL
		 *
		 * @returns {routeMatchResult}
		 */
		function createMatchResult(match, url) {
			var urlSegments = url.getSegments();

			var parameterValues = {};
			segments.forEach(function(routeSegment) {
				if (!routeSegment.isParameter()) {
					return;
				}

				var matchedIndex = match.indexOf(routeSegment);
				if (matchedIndex >= 0) {
					parameterValues[routeSegment.getName()] = routeSegment.getValue(urlSegments[matchedIndex]);
				} else {
					parameterValues[routeSegment.getName()] = routeSegment.getValue();
				}
			});

			return routeMatchResult({
				route: that,
				url: url,
				values: parameterValues
			});
		}
	});

	/**
	 * Generates all subsets of an array with same internal order. Returned subsets are
	 * ordered in right to left order.
	 *
	 * @example
	 *    orderedSubsets([1,2,3]); // => [[1,2,3],[2,3],[1,3],[3],[1,2],[2],[1]]
	 *
	 * @param {[]} input
	 * @returns {[[]]} Array with all subset arrays
	 */
	function orderedSubsets(input) {
		var results = [];
		var result;
		var mask;
		var total = Math.pow(2, input.length);

		for (mask = 1; mask < total; mask++) {
			result = [];
			var i = input.length - 1;
			do {
				if ((mask & (1 << i)) !== 0) {
					result.unshift(input[i]);
				}
			} while (i--);
			results.unshift(result);
		}

		return results;
	}

	return route;
});

define('src/hashLocation',[
	"jquery",
	"./events",
	"./url",
	"klassified"
], function(jQuery, events, url, klassified) {

	/**
	 * In modern browsers we use the "hashchange" event to listen for location changes. If not supported
	 * we poll for changes using a timer.
	 */
	var noHashChangeSupport = !("onhashchange" in window);

	/**
	 * Num ms between each location change poll on browsers without "hashchange"
	 */
	var pollInterval = 25;

	/**
	 * Manages and listens for changes in the hash fragment of the URL.
	 *
	 * @example
	 *        var location = hash();
	 *        hash.on("changed", function(newUrl) { window.alert(newUrl); });
	 *        location.start();
	 *        location.setUrl("newUrl");
	 *        location.setUrl("anotherUrl");
	 *        location.back();
	 *
	 * @param {{}} [spec]
	 *
	 * @param [my]
	 * @returns {hashLocation}
	 */
	var hashLocation = klassified.object.subclass(function(that, my) {

		var pollTimerId = null;

		my.currentHash = undefined; // last hash fragment
		my.history = []; // history of visited hash fragments
		my.events = events.eventCategory();

		//
		// Public
		//

		/**
		 * Triggered when location change with new URL as
		 * argument.
		 *
		 * @type {event}
		 */
		that.changed = my.events.createEvent("changed");
		that.onChanged = that.changed; // deprecated

		/**
		 * Set hash fragment to URL
		 *
		 * @param {url|string} aUrl
		 */
		that.setUrl = function(aUrl) {
			var aHash = urlToHash(aUrl);
			setWindowHash(aHash);
			setCurrentHash(aHash);
		};

		/**
		 * Creates a URL from current hash fragment
		 *
		 * @returns {url}
		 */
		that.getUrl = function() {
			return urlFromHash(getWindowHash());
		};

		/**
		 * Creates a raw URL string from a URL that can be used eg. in a href.
		 *
		 * @param {string|url} aUrl
		 * @returns {string}
		 */
		that.linkToUrl = function(aUrl) {
			return urlToHash(aUrl);
		};

		/**
		 * Navigate back to previous location in history. If history is empty
		 * the location will be changed to fallback URL.
		 *
		 * @param {string|url} fallbackUrl
		 * @returns {string} URL
		 */
		that.back = function(fallbackUrl) {
			if (!that.isHistoryEmpty()) {
				my.history.pop();
				setWindowHash(my.history.pop());
			} else if (fallbackUrl) {
				setWindowHash(urlToHash(fallbackUrl));
			}

			setCurrentHash();
		};

		/**
		 * Return `true` if the history is empty.
		 */
		that.isHistoryEmpty = function() {
			return my.history.length <= 1;
		};

		/**
		 * Start listening for URL changes. If `hashchange` is supported by the browser
		 * it will be used, otherwise a timer will poll for changes.
		 */
		that.start = function() {
			that.stop();

			my.currentHash = getWindowHash();
			my.history = [my.currentHash];

			if (noHashChangeSupport) {
				pollTimerId = setInterval(check, pollInterval);
			} else {
				jQuery(window).bind("hashchange", check);
			}
		};

		/**
		 * Stop listening for location changes and unregister all bindings.
		 */
		that.stop = function() {
			if (pollTimerId) {
				clearInterval(pollTimerId);
				pollTimerId = null;
			}
			jQuery(window).unbind("hashchange", check);
		};

		//
		// Private
		//

		function getWindowHash() {
			return window.location.hash;
		}

		function setWindowHash(aHash) {
			window.location.hash = aHash;
		}

		function urlToHash(aUrl) {
			if (typeof aUrl === "string") {
				aUrl = url({rawUrl: aUrl});
			}
			return "#!/" + aUrl.toString();
		}

		function urlFromHash(aHash) {
			// Remove hash/hash-bang and any leading /
			return url({rawUrl: aHash.replace(/^#!?[\/]?/, "")});
		}

		function setCurrentHash(newHash) {
			newHash = newHash || getWindowHash();

			if (my.currentHash !== newHash) {
				my.currentHash = newHash;
				my.history.push(my.currentHash);
			}

			that.changed.trigger(urlFromHash(my.currentHash));
		}

		function check() {
			var windowHash = getWindowHash();

			var urlChanged = my.currentHash !== windowHash;
			if (urlChanged) {
				setCurrentHash(windowHash);
			}
		}
	});

	return hashLocation;
});

define('src/router',[
	"src/events",
	"./route",
	"./url",
	"./hashLocation",
	"klassified",
	"jquery"
], function(events, route, url, hashLocation, klassified) {

	/**
	 * Lazily creates a singleton instance of
	 * hash-fragment listener `hashLocation()`.
	 *
	 * @returns {hashLocation}
	 */
	function hashSingleton() {
		if (!hashSingleton.instance) {
			hashSingleton.instance = hashLocation();
		}

		return hashSingleton.instance;
	}

	/**
	 * Router allow you to keep state in the URL. When a user visits a specific URL the application
	 * can be transformed accordingly.
	 *
	 * Router have a routing table consisting of an array of routes. When the router resolves a URL
	 * each route is matched against the URL one-by-one. The order is defined by the route priority
	 * property (lower first). If two routes have the same priority or if priority is omitted, routes
	 * are matched in registration order.
	 *
	 * @param [spec]
	 * @param [spec.locationHandler] hashSingleton by default
	 *
	 * @returns {{}}
	 */
	var router = klassified.object.subclass(function(that, my) {

		my.initialize = function(spec) {
			my.super(spec);
			my.location = spec.locationHandler || hashSingleton();
			my.routeTable = [];
			my.lastMatch = undefined;
			my.defaultParameters = {};

			// Listen for URL changes and resolve URL when changed
			my.location.changed.register(function() { my.resolveUrl(); });
		};

		// Events
		my.events = events.eventCategory();

		//
		// Public
		//

		/**
		 * Triggered when a route is matched with `routeMatchResult` as argument.
		 * @type {event}
		 */
		that.routeMatched = my.events.createEvent("routeMatched");
		that.onRouteMatched = that.routeMatched; // deprecated

		/**
		 * Triggered when a route is not matched with "url" as argument.
		 * @type {event}
		 */
		that.routeNotFound = my.events.createEvent("routeNotFound");
		that.onRouteNotFound = that.routeNotFound; // deprecated

		/**
		 * Triggered each time a URL is resolved with `url` as argument
		 * @type {event}
		 */
		that.urlResolved = my.events.createEvent("resolveUrl");
		that.onResolveUrl = that.urlResolved;

		// @deprecated Use event property instead
		that.on = my.events.register;

		//
		// Public
		//

		/**
		 * Tries to resolve URL by matching the URL against all routes in
		 * route table. Unless `fallThrough` is set on the matched route, router
		 * will stop on first match.
		 *
		 * Last match is also stored as `my.lastMatch`
		 *
		 * @param {url} [aUrl] A URL or current url as default
		 */
		that.resolveUrl = function(aUrl) {
			if (typeof aUrl === "string") {
				aUrl = url({rawUrl: aUrl});
			}

			my.resolveUrl(aUrl);
		};

		/**
		 * Creates and adds a new route to the routing table.
		 *
		 * @example
		 *
		 *        // Simplest possible route
		 *        aRouter.addRoute({
			 *			pattern: "/user/#id",
			 *			action: function(id, query) { console.log(id, query);},
			 *		});
		 *
		 *        // Route with name and priority,
		 *        aRouter.addRoute({
			 *			name: "user",
			 *			pattern: "/user/#id",
			 *			priority: 4000,
			 *			action: function(id) { console.log(id);},
			 *		});
		 *
		 *        // Route with only pattern and custom matched event handler,
		 *        var route = aRouter.addRoute({ pattern: ""/user/#id""});
		 *        route.matched.register(function(result) {
			 *			console.dir(result.getValues());
			 *		});
		 *
		 *        // Route with route options,
		 *        aRouter.addRoute({
			 *			pattern: "/user/#id",
			 *			priority: 4000,
			 *			defaults: {
			 *				id: "john_doe"
			 *			},
			 *			constraints: {
			 *				id: ["john_doe", "jane_doe"]
			 *			}
			 *		});
		 *
		 *
		 * @param {routeSpec} routeSpec Options passed to route plus options below
		 * @param {string} routeSpec.pattern Route pattern as string
		 * @param {function} routeSpec.action Executed when route is matched with parameters as arguments +
		 * query object as the last argument.
		 * @param {string} routeSpec.pattern Route pattern as string
		 *
		 * @returns {route}
		 */
		that.addRoute = function(routeSpec) {
			routeSpec = routeSpec || {};

			var newRoute = route({
				pattern: routeSpec.pattern,
				options: routeSpec
			});

			if (routeSpec.action) {
				newRoute.matched.register(function(result) {
					routeSpec.action.apply(this, result.getActionArguments());
				});
			}

			newRoute.name = routeSpec.name;
			newRoute.fallThrough = routeSpec.fallThrough;

			newRoute.priority = routeSpec.priority;
			my.addRoute(newRoute);

			return newRoute;
		};

		/**
		 * Find a route using a predicate function. The function is applied on routes
		 * on-by-one until match.
		 *
		 * @param {function} predicate
		 * @returns {route} Matched route or null if not matched
		 */
		that.findRoute = function(predicate) {
			var numRoutes = my.routeTable.length;
			for (var routeIndex = 0; routeIndex < numRoutes; routeIndex++) {
				var route = my.routeTable[routeIndex];
				if (predicate(route)) {
					return route;
				}
			}

			return null;
		};

		/**
		 * Finds route by name
		 *
		 * @param {string} routeName
		 * @returns {route}
		 */
		that.getRouteByName = function(routeName) {
			return that.findRoute(function(route) {
				return route.name && route.name === routeName;
			});
		};

		/**
		 * Removes a route from routing table
		 *
		 * @param route
		 */
		that.removeRoute = function(route) {
			var index = my.routeTable.indexOf(route);
			if (index === -1) {
				throw new Error("Route not in route table");
			}

			my.routeTable.splice(index, 1);
		};

		/**
		 * Removes all routes from routing table.
		 */
		that.clear = function() {
			my.routeTable = [];
			my.lastMatch = undefined;
		};

		/**
		 * Pipes URL matching "routeSpec" to another router.
		 *
		 * @param {{}} routeSpec Same options as `addRoute`
		 * @param {router} router
		 *
		 * @returns {route}
		 */
		that.pipeRoute = function(routeSpec, router) {
			if (!routeSpec || !routeSpec.pattern) {
				throw new Error("Route pattern required");
			}

			var aRoute = that.addRoute(routeSpec);
			aRoute.matched.register(function(result) {
				router.resolveUrl(result.getUrl());
			});

			return aRoute;
		};

		/**
		 * Pipe not found to a different router
		 *
		 * @param {router} router
		 * @returns {route}
		 */
		that.pipeNotFound = function(router) {
			return that.routeNotFound.register(function(aRawUrl) {
				router.resolveUrl(aRawUrl);
			});
		};

		/**
		 * Returns the current URL
		 * @returns {url}
		 */
		that.getUrl = function() {
			return my.location.getUrl();
		};

		/**
		 * Constructs a link that can be used eg. in href.
		 *
		 * @example
		 *    // Link to a route by name (recommended)
		 *    aRouter.linkTo("users-list", {user: "jane"});
		 *
		 *    // Link to a path
		 *    aRouter.linkTo("/user/mikael");
		 *    aRouter.linkTo("/user/", {sortBy: "name"});
		 *
		 * @param {string} routeName Name of route or path
		 * @param {{}} [parameters]
		 * @param {boolean} [includeCurrentParameters=false] Merge parameters with parameters in current match.
		 *
		 * @returns {string}
		 */
		that.linkTo = function(routeName, parameters, includeCurrentParameters) {
			var route = that.getRouteByName(routeName);
			if (route) {
				return my.location.linkToUrl(that.expand({
					routeName: route.name,
					parameters: parameters,
					excludeCurrentParameters: !includeCurrentParameters
				}));
			}

			// fallback to path (eg. /user/john) if route is not defined
			return that.linkToPath(routeName, parameters);
		};

		/**
		 * Link to a path
		 *
		 * @example
		 *    aRouter.linkToPath("/user/mikael");
		 *    aRouter.linkToPath("/user/", {sortBy: "name"});
		 *
		 * @param {string} path
		 * @param {{}} query
		 * @returns {string}
		 */
		that.linkToPath = function(path, query) {
			return that.linkToUrl(url.build(path, query));
		};

		/**
		 * Link from url
		 *
		 * @param {url} aUrl
		 * @returns {string}
		 */
		that.linkToUrl = function(aUrl) {
			return my.location.linkToUrl(aUrl);
		};

		/**
		 * Redirects browser to route or path.
		 *
		 * @example
		 *    // Redirect to a route by name
		 *    aRouter.redirectTo("users-list", {user: "jane"});
		 *
		 *    // Redirect to a path
		 *    aRouter.redirectTo("/user/mikael");
		 *    aRouter.redirectTo("/user/", {sortBy: "name"});
		 *
		 * @param {string} routeName
		 * @param {{}} [parameters]
		 * @param {boolean} [includeCurrentParameters=false] Merge parameters with parameters in current match.
		 *
		 * @returns {string}
		 */
		that.redirectTo = function(routeName, parameters, includeCurrentParameters) {
			var route = that.getRouteByName(routeName);
			if (route) {
				return my.location.setUrl(that.expand({
					routeName: route.name,
					parameters: parameters,
					excludeCurrentParameters: !includeCurrentParameters
				}));
			}

			return that.redirectToPath(routeName, parameters);
		};

		/**
		 * Redirect to a path
		 *
		 * @example
		 *    aRouter.redirectToPath("/user/mikael");
		 *    aRouter.redirectToPath("/user/", {sortBy: "name"});
		 *
		 * @param {string} path
		 * @param {{}} query
		 * @returns {string}
		 */
		that.redirectToPath = function(path, query) {
			return that.redirectToUrl(url.build(path, query));
		};

		/**
		 * Redirect to url
		 *
		 * @param {url} aUrl
		 * @returns {string}
		 */
		that.redirectToUrl = function(aUrl) {
			return my.location.setUrl(aUrl);
		};

		/**
		 * Constructs a new URL from parameters with a route as template. If no route is
		 * supplied the last matched route is used.
		 *
		 * Parameters are merged with parameters from last match unless `excludeCurrentParameters`
		 * is set to true.
		 *
		 * @param {{}} [options]
		 * @param {string} [options.routeName] Name of route to link to. Default route from last match.
		 * @param {{}} [options.parameters={}]
		 * @param {boolean} [options.excludeCurrentParameters=false]
		 *
		 * @returns {url}
		 */
		that.expand = function(options) {
			var routeName = options.routeName;
			var suppliedParameters = options.parameters || {};
			var excludeCurrentParameters = options.excludeCurrentParameters || false;

			// Pick a template route
			var templateRoute;
			if (routeName) {
				templateRoute = that.getRouteByName(routeName) || route();
			} else if (my.lastMatch) {
				templateRoute = my.lastMatch.getRoute();
			} else {
				templateRoute = route();
			}

			// Merge current parameters with supplied parameters
			var currentParameters = !excludeCurrentParameters ? that.getParameters() : {};
			var allParameters = merge(currentParameters, suppliedParameters);

			// Fill with defaults if needed
			Object.keys(my.defaultParameters).forEach(function(parameterName) {
				if (!(parameterName in allParameters)) {
					allParameters[parameterName] = typeof my.defaultParameters[parameterName] === "function" ?
						my.defaultParameters[parameterName]() :
						my.defaultParameters[parameterName];
				}
			});

			// Expand template route and construct URL
			var aRawUrl = templateRoute.expand(allParameters);
			return url({rawUrl: aRawUrl});
		};

		/**
		 * Constructs a link from supplied parameters.
		 *
		 * @param {{}} [parameters={}]
		 * @param {boolean} [excludeCurrentParameters=false]
		 *
		 * @returns {string}
		 */
		that.linkToParameters = function(parameters, excludeCurrentParameters) {
			return my.location.linkToUrl(that.expand({
				parameters: parameters,
				excludeCurrentParameters: excludeCurrentParameters
			}));
		};

		/**
		 * Constructs a link from supplied parameters.
		 *
		 * @param {{}} [parameters={}]
		 * @param {boolean} [excludeCurrentParameters=false]
		 *
		 * @returns {string}
		 */
		that.setParameters = function(parameters, excludeCurrentParameters) {
			that.redirectToUrl(that.expand({
				parameters: parameters,
				excludeCurrentParameters: excludeCurrentParameters
			}));
		};

		/**
		 * Return current parameters, ether from last match or if no match
		 * from query in current URL.
		 *
		 * @returns {{}} Parameter values with parameter names as keys
		 */
		that.getParameters = function() {
			if (!my.lastMatch) {
				return my.location.getUrl().getQuery();
			}

			return my.lastMatch.getParameters();
		};

		/**
		 * Returns parameter value by name
		 *
		 * @param {string} parameterName
		 * @returns {*}
		 */
		that.getParameter = function(parameterName) {
			var parameters = that.getParameters();
			return parameters[parameterName];
		};

		that.setDefaultParameter = function(parameterName, value) {
			my.defaultParameters[parameterName] = value;
		};

		/**
		 * Navigate back to previous location in history. If history is empty
		 * the location will be changed to fallback URL.
		 *
		 * @param {string|url} aFallbackUrl
		 * @returns {string} URL
		 */
		that.back = function(aFallbackUrl) {
			return my.location.back(aFallbackUrl);
		};

		/**
		 * Return `true` if the history is empty
		 */
		that.isHistoryEmpty = function() {
			return my.location.isHistoryEmpty();
		};

		/**
		 * Start listening for location changes and automatically
		 * resolve new URLs (including the current)
		 */
		that.start = function() {
			my.location.start();
			my.resolveUrl(); // resolve current url
		};

		/**
		 * Stop listening for location changes.
		 */
		that.stop = function() {
			my.location.stop();
		};

		//
		// Protected
		//

		/**
		 * Tries to resolve URL by matching the URL against all routes in
		 * route table. Unless `fallThrough`is set on the matched route router
		 * will stop on first match.
		 *
		 * Last match is also stored as `my.lastMatch`
		 *
		 * @param {url} [aUrl] A URL or current url as default
		 */
		my.resolveUrl = function(aUrl) {
			var currentUrl = aUrl === undefined ? my.location.getUrl() : aUrl;

			that.urlResolved.trigger(currentUrl);

			var numMatched = 0;
			my.routeTable.some(function(candidateRoute) {
				var result = currentUrl.matchRoute(candidateRoute);
				if (result.isMatch()) {
					my.lastMatch = result;
					numMatched++;
					that.routeMatched.trigger(result);

					if (candidateRoute.fallThrough === undefined ||
						candidateRoute.fallThrough === false) {
						return true;
					}
				}
				return null;
			});

			if (numMatched === 0) {
				that.routeNotFound.trigger(currentUrl.toString());
			}
		};

		/**
		 * Injects route in route table. Routes are ordered by priority (lower first) with
		 * routes without priority last. Routes with same priority are order in
		 * registration order.
		 *
		 * @param {route} route
		 */
		my.addRoute = function(route) {
			var routeIndex = my.routeTable.length;
			if (route.priority !== undefined) {
				do {
					--routeIndex;
				} while (my.routeTable[routeIndex] &&
				(my.routeTable[routeIndex].priority === undefined ||
				route.priority < my.routeTable[routeIndex].priority));
				routeIndex += 1;
			}
			my.routeTable.splice(routeIndex, 0, route);
		};

		//
		// Private
		//

		/**
		 * Shallow merge all objects in arguments. Properties in later objects overwrites
		 * properties.
		 *
		 * @returns {{}}
		 */
		function merge() {
			var objects = Array.prototype.slice.call(arguments);

			var target = {};
			objects.forEach(function(obj) {
				Object.keys(obj).forEach(function(key) {
					target[key] = obj[key];
				});
			});

			return target;
		}
	});

	return router;
});

define('src/diffractor',[
	"./url",
	"./route",
	"./router"
], function(url, route, router) {

	var routerSingleton = router();

	return {
		url: url,
		route: route,
		router: router,
		getRouter: function() {
			return routerSingleton;
		},
		setRouter: function(newRouter) {
			routerSingleton = newRouter;
		}
	};
});


require(["src/diffractor"]);
    return require("diffractor");
}));
