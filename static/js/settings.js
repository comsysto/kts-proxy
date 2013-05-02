KtsProxyModule.controller("settingsCtrl", function ($scope, $timeout, settingsService) {

    $('body').tooltip({
        selector: '[data-toggle="tooltip"]'
    });

    var proxyInfos = {};
    function onSettings(result) {
        $scope.settings = result.settings;
        proxyInfos = result.proxyInfos.reduce(function(proxyInfos, p){
            proxyInfos[p.name] = p.host + ":" + p.port;
            return proxyInfos;
        }, {})
    }

    function message(msg) {
        $scope.message = msg;
        $timeout(function () {
            $scope.message = null;
        }, 3000)
    }

    $scope.proxyInfo = function(name){
        return proxyInfos[name];
    };

    $scope.addWhiteListHost = function () {
        if(!$scope.whiteListHost) return;
        $scope.settings.hostWhiteListPatterns.push($scope.whiteListHost);
        $scope.whiteListHost = null
    };

    $scope.removeWhiteListHost = function (host) {
        $scope.settings.hostWhiteListPatterns = $scope.settings.hostWhiteListPatterns.filter(function (e) {
            return e != host;
        })
    };

    $scope.addLocalhostAlias = function () {
        if(!$scope.localhostAlias) return;
        $scope.settings.localhostAlias.push($scope.localhostAlias);
        $scope.localhostAlias = null
    };

    $scope.removeLocalhostAlias = function (alias) {
        $scope.settings.localhostAlias = $scope.settings.localhostAlias.filter(function (e) {
            return e != alias;
        })
    };

    $scope.addBlackListUrlPattern = function () {
        if(!$scope.blackListUrlPattern) return;
        $scope.settings.blackListUrlPatterns.push($scope.blackListUrlPattern);
        $scope.blackListUrlPattern = null
    };

    $scope.removeBlackListUrlPattern = function (pattern) {
        $scope.settings.blackListUrlPatterns = $scope.settings.blackListUrlPatterns.filter(function (e) {
            return e != pattern;
        })
    };

    function newHtmlFilterRule(){
        return {
            urlPattern: "",
            elementToRemoveSelector : ""
        }
    }

    $scope.addHtmlFilterRule = function(){
        $scope.settings.htmlFilterRules.push($scope.htmlFilterRule);
        $scope.htmlFilterRule = newHtmlFilterRule();
    };

    $scope.removeHtmlFilterRule = function(ruleToRemove){
        $scope.settings.htmlFilterRules = $scope.settings.htmlFilterRules.filter(function(rule){
            return ruleToRemove.urlPattern !== rule.urlPattern || ruleToRemove.elementToRemoveSelector !== rule.elementToRemoveSelector;
        });
    };

    $scope.storeSettings = function () {
        var timeoutSet = $scope.settings.proxies.every(function(proxy){
            return proxy.killTimeout;
        });
        if(!timeoutSet) return;
        settingsService.store($scope.settings, function () {
            settingsService.load(onSettings);
            message("settings stored");
        })
    };

    $scope.restoreSettings = function () {
        settingsService.load(function (settings) {
            onSettings(settings);
            message("settings restored");
        })
    };

    $scope.htmlFilterRule = newHtmlFilterRule();

    $timeout(function(){
        settingsService.load(onSettings);
    }, 0)
});