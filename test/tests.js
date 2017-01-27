define([], function() {
	var files = [
		"test/router/eventsTest",
		"test/router/hashLocationTest",
		"test/router/routerTest",
		"test/router/routeTest"
	];
	return {
		files: files,
		config: {
			paths: {
				"klassified": "node_modules/klassified/dist/klassified",
				"jquery": "node_modules/jquery/dist/jquery",
				"chai": "node_modules/chai/chai",
				"chai-jquery": "node_modules/chai-jquery/chai-jquery"
			},
			shim: {
				"jquery": {
					exports: "$"
				},
				"chai-jquery": ["jquery", "chai"]
			}
		}
	};
});
