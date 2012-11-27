var KtsProxyModule = angular.module("ktsProxy", [], function ($routeProvider) {
    $routeProvider.when('/session', {templateUrl: '/static/html/session.html'});
    $routeProvider.when('/session/:sessionId', {templateUrl: '/static/html/session.html'});
    $routeProvider.when('/settings', {templateUrl: '/static/html/settings.html'});
    $routeProvider.otherwise({redirectTo: '/session'});
});

KtsProxyModule.controller("mainCtrl", function ($scope, $route, heartBeatService, $location, errorReportingService) {

    var pathRegex = new RegExp("^/([^/]+)")

    $scope.startHeartBeat = function () {
        heartBeatService.next()
    }

    $scope.showView = function (name) {
        $location.path("/" + name);
    }

    $scope.classForViewLink = function (name) {
        return name == $scope.viewName ? "active" : ""
    }

    $scope.$on("$routeChangeSuccess", function () {
        setupViewName()
    })

    $scope.$on("$destroy", function () {
        console.log("destroy main.js")
        heartBeatService.onLoadChanged(null)
        heartBeatService.onHeartBeatElapsedChanged(null)
    })

    heartBeatService.onLoadChanged(function (loadPercent) {
        $scope.loadPercent = loadPercent
    });

    heartBeatService.onHeartBeatElapsedChanged(function (hearBeatElapsed) {
        $scope.heartBeatRunning = !hearBeatElapsed
    });

    errorReportingService.handler(function (err) {
        $scope.errorMessage = "Service error occured: " + err.toString()
        $('#myModal').modal()
    })

    function setupViewName() {
        var matches = pathRegex.exec($location.path())
        if (matches) {
            $scope.viewName = matches[1]
            console.log("viewName:" + $scope.viewName)
        }

    }

    setupViewName()
    console.log("creating main.js")

})
