KtsProxyModule.service("sessionService", function ($http, errorReportingService) {
    var currentSession = null

    function sessionQueryString() {
        if (currentSession == null) return "";

        return "?session=" + encodeURIComponent(currentSession)
    }

    return {
        setSession: function (session) {
            currentSession = session
        },

        load: function (onResult) {
            errorReportingService.withErrorHandler(
                $http.get("/state" + sessionQueryString()).success(onResult)
            )
        },

        reset: function (onResult) {
            errorReportingService.withErrorHandler(
                $http.delete("/state" + sessionQueryString()).success(onResult)
            )
        }
    }
})

KtsProxyModule.service("settingsService", function ($http, errorReportingService) {
    return {
        load: function (onResult) {
            errorReportingService.withErrorHandler(
                $http.get("/settings").success(onResult)
            )
        },

        store: function (settings, onSuccess) {
            errorReportingService.withErrorHandler(
                $http.post("/settings", angular.toJson(settings)).success(onSuccess)
            )
        }
    }
})

KtsProxyModule.service("errorReportingService", function () {
    var defaultHandler = function (err) {
        console.log(err)
    }
    var handler = defaultHandler
    return {
        handler: function (f) {
            if (f) {
                handler = f
            } else {
                handler = defaultHandler
            }
        },

        withErrorHandler: function (call) {
            return call.error(function (data, status, headers, config) {
                handler("REST call " + config.method + " " + config.url + " " + status)
            })
        }
    }
})


KtsProxyModule.service("heartBeatService", function ($timeout) {
    var loadPercent = -40;
    var handler = function () {
    };
    var loadWatcher = function (p) {
    };
    var heartBeatElapsedWatcher = function (p) {
    };
    var heartBeatElapsed = true;

    function notifyHeartBeatElapsed() {
        $timeout(function () {
            heartBeatElapsedWatcher(heartBeatElapsed)
        }, 1000)
    }

    var lastFire = 0
    var id = 0

    function scheduleLoad(invokeId) {
        if (heartBeatElapsed) {
            console.log("invokeId differ")
            return;
        }
        if (invokeId != id) return;
        if (loadPercent == 120) {
            loadWatcher(loadPercent)
            heartBeatElapsed = true;
            notifyHeartBeatElapsed();
            handler()
            var now = new Date().getTime();
            console.log("heartBeatTime: " + (now - lastFire));
            lastFire = now;
        } else {
            loadPercent += 20
            loadWatcher(loadPercent)
            $timeout(function () {
                scheduleLoad(invokeId)
            }, 200)
        }

    }

    console.log("create heartbeat")
    return {
        onHeartBeanElapsed: function (onHeartBeatElapsed) {
            if (onHeartBeatElapsed != null) {
                handler = onHeartBeatElapsed
                heartBeatElapsed = true;
                loadWatcher(null)
                heartBeatElapsedWatcher(heartBeatElapsed)

            } else {
                handler = function () {
                };
                heartBeatElapsed = true;
                loadWatcher(null)
                heartBeatElapsedWatcher(heartBeatElapsed)
            }
        },

        onHeartBeatElapsedChanged: function (f) {
            if (f) {
                heartBeatElapsedWatcher = f
                heartBeatElapsedWatcher(heartBeatElapsed)
            } else {
                heartBeatElapsedWatcher = function (f) {
                };
            }
        },

        onLoadChanged: function (onLoadChanged) {
            if (onLoadChanged != null) {
                loadWatcher = onLoadChanged
                onLoadChanged(loadPercent)
            } else {
                loadWatcher = function (p) {
                }
            }
        },

        next: function () {
            if (!heartBeatElapsed) return;
            console.log("next")
            loadPercent = -40;
            heartBeatElapsed = false;
            heartBeatElapsedWatcher(heartBeatElapsed)
            scheduleLoad(++id)
        }
    }
})