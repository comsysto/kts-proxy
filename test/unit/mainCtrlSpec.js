'use strict';

//describe("KtsProxyModule basics", function() {
//    it("KtsProxyModule should not be undefined", function() {
//        expect(KtsProxyModule).equals(1);
//    });
//});

describe("mainCtrl", function(){
    var heartBeatService;
    var ctrl;
    var scope;
    var location;
    var route;
    var errorReportingService;

    beforeEach(module("ktsProxy"))
    beforeEach(inject(function($controller, $rootScope, $location, $route) {
        errorReportingService = new ErrorReportingServiceMock()
        heartBeatService = new HeartBeatServiceMock()
        location = $location;
        route = $route;
        scope = $rootScope;
        ctrl = $controller("mainCtrl", {$scope: $rootScope, $route: $rootScope, $location: $location, heartBeatService: heartBeatService, errorReportingService: errorReportingService})
    }));

    it("show view should change locations path", function(){
       scope.showView("testView")
       expect(location.path()).toBe("/testView");
    })

    console.log("blubb")
    it("on route change the view name should be updated", function(){

        scope.$emit("$routeChangeSuccess")
        location.path("/myTestPath/adfadsf")
        expect(scope.viewName).toBe("myTestPath")
    })

});