// consts
var configFilePath = "./config.json",
    defaultKillTimeout = 500,
    defaultConfig = {
        "settingsFilePath": "./settings.json",
        "watchSettingsFile": false,
        "interface": {
            "host": "0.0.0.0",
            "port": "9001"
        },
        "proxies": [
            {
                "name": "default",
                "host": "0.0.0.0",
                "port": 9099
            }
        ],
        "mimeTypesForExtension": {
            "js": "text/javascript",
            "css": "text/css",
            "ttf": "application/x-font-ttf",
            "html": "text/html"
        },
        "proxyHeaderTattoo": "kts-proxy",
        "sessionLifeTime": 3600000
    };

// modules
var http = require('http'),
    util = require('util'),
    url = require('url'),
    fs = require('fs');

// runtime data
var sessions = {},
    settings = makeDefaultSettings();


function makeDefaultSettings() {
    return {
        localhostAlias: ["localhost"],
        hostWhiteListPatterns: [],
        proxies: []
    };
}

function decodeHost(hostString) {
    var hostObject = {};
    var hostParts = hostString.split(':');
    hostObject.host = hostParts[0];
    hostObject.port = hostParts[1] || 80;
    return hostObject;
}

function encodeHost(hostObject) {
    return hostObject.host + ((hostObject.port == 80) ? "" : ":" + hostObject.port);
}


function readSettingsFile(afterReadSettings) {
    readOrCreateFile(config.settingsFilePath, makeDefaultSettings(), function (newSettings) {
        updateSettings(newSettings);
        if (afterReadSettings) {
            afterReadSettings()
        }
    })
}

function readOrCreateFile(fileName, defaultObject, onReadObject) {
    fs.stat(fileName, function (err, stats) {
        if (!err) {
            util.log("Reading file: '" + fileName + "' ...");
            fs.readFile(fileName, function (err, data) {
                onReadObject(JSON.parse(data.toString()));
            });
        }
        else {
            util.error("File '" + fileName + "' was not found. Try to create one...");
            fs.writeFile(fileName, prettyJsonString(defaultObject), function (err) {
                if (err) {
                    util.log("Failed creating file '" + fileName + "': " + err.toString());
                } else {
                    util.log("Created file '" + fileName + "'.");
                    readOrCreateFile(fileName, defaultObject, onReadObject)
                }
            })

        }
    });
}

function prettyJsonString(obj) {
    return JSON.stringify(obj, undefined, 2)
}

function writeSettingsFile(settings) {
    var text = prettyJsonString(settings)
    util.log("writing settings file...")
    fs.writeFile(config.settingsFilePath, text, function (err) {
        if (err) {
            util.log("failed writing settings")
        } else {
            readSettingsFile()
        }
    })
}

function updateSettings(loadedSettings) {
    console.log("update settings")
    settings = loadedSettings
}


function checkLoop(request, response) {
    if (request.headers.proxy == config.proxyHeaderTattoo) {
        util.log("Loop detected");
        response.writeHead(500);
        response.write("Proxy loop!");
        response.end();
        return false;
    } else {
        request.headers.proxy = config.proxyHeaderTattoo;
        return request;
    }
}

function sendNotFound(response, msg) {
    response.writeHead(404);
    response.write(msg);
    response.end();
}

function updateBlockedHost(host, request) {
    var path = url.parse(request.url).pathname
    var referer = host.requests[path]
    if (!referer) {
        referer = {}
        host.requests[path] = referer
    }

    if (request.headers.referer) {
        if (referer[request.headers.referer]) {
            referer[request.headers.referer] = 1
        } else {
            referer[request.headers.referer] += 1
        }
    }
}

function doProxying(response, request, host, session, isLocalRedirect, name) {
    var beginTime = new Date();
    if (session.blockedHosts[host]) {
        util.log("blocking request [" + request.url + "]!")
        updateBlockedHost(session.blockedHosts[host], request)
        response.statusCode = 408
        response.end()
        return;
    }

    //detect HTTP version
    var legacyHttp = request.httpVersionMajor == 1 && request.httpVersionMinor < 1 || request.httpVersionMajor < 1;

    //add x forwarded header
    var headers = request.headers;
    if (headers['X-Forwarded-For'] !== undefined) {
        headers['X-Forwarded-For'] = request.connection.remoteAddress + ", " + headers['X-Forwarded-For'];
    } else {
        headers['X-Forwarded-For'] = request.connection.remoteAddress;
    }

    var urlToRequest = url.parse(request.url)
    urlToRequest.method = request.method;
    urlToRequest.headers = request.headers;
    urlToRequest.hostname = host;
    var proxyRequest = http.request(urlToRequest);

    //handle errors
    proxyRequest.on('error', function (err) {
        util.log(err.toString() + " on request to " + host);
        return sendNotFound(response, "Requested resource (" + request.url + ") is not accessible on host '" + host + "' got error '" + err.toString() + "'");
    });


    var isWhiteListHost = settings.hostWhiteListPatterns.some(function (pattern) {
        return new RegExp(pattern).test(host)
    });

    var timeoutId = null;
    var isKilled = false;
    if (!isWhiteListHost && !isLocalRedirect) {

        timeoutId = setTimeout(function () {
            isKilled = true;
            updateBlockedHosts(host, request, session);
            response.end();
//            proxyRequest.end();
        }, killTimeout(name));
    }

    // forward response data
    proxyRequest.addListener('response', function (proxyResponse) {
        if (isKilled) return;
        if (legacyHttp && proxyResponse.headers['transfer-encoding'] != undefined) {

            //filter headers
            var headers = proxyResponse.headers;
            delete proxyResponse.headers['transfer-encoding'];
            var buffer = "";

            //buffer answer
            proxyResponse.addListener('data', function (chunk) {
                if (isKilled) return;
                buffer += chunk;
            });
            proxyResponse.addListener('end', function () {
                if (!isKilled) {
                    headers['Content-length'] = buffer.length;//cancel transfer encoding "chunked"
                    response.writeHead(proxyResponse.statusCode, headers);
                    response.write(buffer, 'binary');
                    response.end();

                    if (timeoutId)
                        clearTimeout(timeoutId)
                }
                if (!isWhiteListHost && !isLocalRedirect)
                    updateRequestTimes(beginTime, request, session)
            });
        } else {
            //send headers as received
            response.writeHead(proxyResponse.statusCode, proxyResponse.headers);

            //easy data forward
            proxyResponse.addListener('data', function (chunk) {
                if (isKilled) return;
                response.write(chunk, 'binary');
            });
            proxyResponse.addListener('end', function () {
                if (!isKilled) {
                    response.end();
                    if (timeoutId)
                        clearTimeout(timeoutId)
                }

                if (!isWhiteListHost && !isLocalRedirect)
                    updateRequestTimes(beginTime, request, session)
            });
        }
    });

    //forward request data
    request.addListener('data', function (chunk) {
        proxyRequest.write(chunk, 'binary');
    });
    request.addListener('end', function () {
        proxyRequest.end();
    });
}

function killTimeout(name) {
    var proxies = settings.proxies.filter(function (proxy) {
        return proxy.name == name
    });
    if (proxies.length == 0) {
        var proxy = {
            name: name,
            killTimeout: defaultKillTimeout
        };
        settings.proxies.push(proxy)
        console.log("adding proxy for name: " + name)
        proxies = [proxy]
    }

    return proxies[0].killTimeout;
}

function updateRequestTimes(beginTime, request, session) {
    session.longestRequests.push({
        method: request.method,
        url: request.url,
        time: new Date().getTime() - beginTime.getTime()
    })

    session.longestRequests = session.longestRequests.sort(function (e1, e2) {
        return e2.time - e1.time
    })
    session.longestRequests = session.longestRequests.slice(0, 20)
    console.log("longestRequest size: " + session.longestRequests.length)
}

function updateBlockedHosts(host, request, session) {
    var blockedHost = session.blockedHosts[host]
    if (!blockedHost) {
        blockedHost = {
            host: host,
            requests: {}
        }
        session.blockedHosts[host] = blockedHost
    }
    updateBlockedHost(blockedHost, request)
}

function proxyServerHandler(request, response, name) {
    var ip = request.connection.remoteAddress
    var session = getSession(ip)

    //filter loops
    request = checkLoop(request, response);
    if (!request) {
        return;
    }

    var host = decodeHost(request.headers.host).host

    // replacing host names that are aliases for localhost with the sender ip
    // send request back to local dev server
    var localRedirect = false
    if (settings.localhostAlias.indexOf(host) != -1) {
        util.log("using remote address: " + ip + " for localHost alias: " + host)
        host = ip;
        localRedirect = true
    }
    doProxying(response, request, host, session, localRedirect, name);
}

function getSession(ip) {
    var session = sessions[ip]
    if (!session) {
        session = {
            ip: ip,
            blockedHosts: {},
            longestRequests: []
        }
        sessions[ip] = session;
    }

    session.timestamp = new Date().getTime()
    return session;
}

function sessionCleanUp() {
    var now = new Date().getTime()
    Object.keys(sessions).forEach(function (key) {
        var session = sessions[key]
        if (now > session.timestamp + config.sessionLifeTime) {
            util.log("removing session: " + key)
            delete sessions[session]
        }
    })
}

function serveFile(filePath, ctx) {
    var extension = /.*\.([^.]+)$/.exec(filePath)[1]
    var mimeType = config.mimeTypesForExtension[extension]
    ctx.response.setHeader('Content-Type', mimeType)
    fs.readFile("." + filePath, function (err, data) {
        ctx.response.statusCode = 200
        ctx.response.write(data)
        ctx.response.end()
    });
    return null;
}
var controlServerHandlers = {
    "^/state$": {
        "GET": function (ctx) {
            return {
                json: { state: ctx.session, sessions: Object.keys(sessions), ip: ctx.ip }
            }
        },
        "DELETE": function (ctx) {
            ctx.session.longestRequests = []
            ctx.session.blockedHosts = {}
            return {}
        }
    },

    "^/settings$": {
        "GET": function () {
            return {
                json: { settings: settings, proxyInfos: config.proxies }
            }
        },

        "POST": function (ctx) {
            readPostData(ctx.request, function (settings) {
                writeSettingsFile(settings)
            })
            return {}
        }
    },

    "^/static/.+$": {
        "GET": function (ctx) {
            var path = ctx.url.pathname
            if (path.indexOf("..") != -1) {
                ctx.response.statusCode = 404
                ctx.response.write("illegal path!")
                ctx.response.end()
                return;
            }
            return serveFile(path, ctx);
        }
    },

    "^/?$": {
        "GET": function (ctx) {
            return serveFile("/static/html/main.html", ctx)
        }
    }
}


function controlServerHandler(request, response) {

    var parsedUrl = url.parse(request.url, true)
    var ip = request.connection.remoteAddress
    var sessionName = ip
    var query = url.parse(request.url, true).query
    if (query && query.session) {
        sessionName = query.session
    }
    var session = getSession(sessionName)

    var ctx = {
        request: request,
        response: response,
        url: parsedUrl,
        session: session,
        ip: ip
    }

    var matchingPathes = Object.keys(controlServerHandlers).filter(function (pathPattern) {
        return new RegExp(pathPattern).test(ctx.url.pathname)
    })

    if (matchingPathes.length > 0) {
        var supportedMethods = controlServerHandlers[matchingPathes[0]]
        var handler = supportedMethods[request.method]
        if (handler) {
            var result = handler(ctx)
            var statusCode = 200

            // if handler has undefined or null as result
            // the handler is managing the response.
            if (result != null && result != undefined) {
                if (result.json) {
                    response.write(prettyJsonString(result.json))
                }
                if (result.statusCode) {
                    statusCode = result.statusCode
                }
                response.statusCode = statusCode
                response.end()
            }

            return; // normal control flow ...
        }

        response.statusCode = 404
        response.end()
    }

}

function readPostData(request, onPostedObject) {
    var body = '';
    request.on('data', function (data) {
        body += data;
        if (body.length > 1e6) {
            // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
            request.connection.destroy();
        }
    });
    request.on('end', function () {
        var obj = JSON.parse(body);
        onPostedObject(obj)
    });
}

function startServers() {
    // control server
    http.createServer(controlServerHandler).listen(config.interface.port, config.interface.host);

    //proxy servers
    config.proxies.forEach(function (proxy) {
        util.log("Starting proxy server'" + proxy.name + "' on interface '" + proxy.host + ':' + proxy.port);

        // initilaise kill timeout for proxy
        killTimeout(proxy.name)
        var server = http.createServer(function (req, res) {
            proxyServerHandler(req, res, proxy.name)
        })
        server.listen(proxy.port, proxy.host);
    });
}


function bootstrap() {

    // check for old sessions every minute
    setInterval(sessionCleanUp, 60 * 1000)

    // enable file watch for settings
    if (config.watchSettingsFile) {
        fs.watchFile(config.settingsFilePath, function () {
            readSettingsFile();
        });
    }

    readSettingsFile(function () {
        startServers();
    });

}

// global error handler
process.on('uncaughtException', function (err) {
    util.log('Exception: ' + err);
    util.log(err.stack);
});

readOrCreateFile(configFilePath, defaultConfig, function (loadedConfig) {
    config = loadedConfig;
    bootstrap()
});