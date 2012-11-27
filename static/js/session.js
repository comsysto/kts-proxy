KtsProxyModule.controller("sessionCtrl", function ($scope, $route, $location, heartBeatService, sessionService) {
    var destroied = false

    function onState(result) {
        $scope.state = result.state
        $scope.sessions = result.sessions
        $scope.ip = result.ip
        if ($scope.currentSession == null) {
            $scope.currentSession = result.ip
        }
    }

    function onReset(result) {
        $scope.resetMsg = "reset successful"
    }

    $scope.reset = function () {
        sessionService.reset(onReset)
    }
    $scope.load = function () {
        sessionService.load(onState)
    }


    $scope.$watch("currentSession", function (s) {
        sessionService.setSession(s)
        $location.path(s ? "/session/" + s : "/session")
    })

    $scope.sessionOptions = function () {
        if (!$scope.sessions)
            return [];

        return $scope.sessions.map(function (session) {
            return {
                text: session == $scope.ip ? session + " [you]" : session,
                value: session
            }
        })
    }

    heartBeatService.onHeartBeanElapsed(function () {
        sessionService.load(function (result) {
            if (destroied) return;
            onState(result);
            heartBeatService.next();
        })
    })

    var sessionId = $route.current.params.sessionId
    console.log("as location params sessionId: " + sessionId)

    $scope.currentSession = sessionId

    $scope.$on("$destroy", function () {
        destroied = true
        console.log("destroy session.js")
        heartBeatService.onHeartBeanElapsed(null)
    })

    console.log("creating session.js")
    sessionService.load(onState)
    heartBeatService.next()
})
