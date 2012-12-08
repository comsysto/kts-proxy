'use strict';

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
        scope = $rootScope.$new();
        ctrl = $controller("mainCtrl", {$scope: $rootScope, $route: $rootScope, $location: $location, heartBeatService: heartBeatService, errorReportingService: errorReportingService})
    }));

    it("show view should change locations path", function(){
       scope.showView("testView")
       expect(location.path()).toBe("/testView");
    })

    it("on route change the view name should be updated", function(){

        location.path("/myTestPath/adfadsf")
        scope.$emit("$routeChangeSuccess")
        expect(scope.viewName).toBe("myTestPath")
    })

});