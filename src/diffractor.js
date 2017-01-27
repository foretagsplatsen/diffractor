define([
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
