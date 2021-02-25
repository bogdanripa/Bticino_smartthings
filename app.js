var net = require('net');
var fs = require('fs');
const express = require('express');
const request = require('request');
var bodyParser = require('body-parser');
var pConnect;

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var settingsFile = process.argv[1].replace(/\/[^\/]+$/, "/settings.json");

function cacheSettings() {
	var json = JSON.stringify(settings, null, '\t');
	fs.writeFile(settingsFile, json);
}

var settings = require('./settings.json');

var connected = false;

function log(msg) {
	console.log((new Date()).toLocaleTimeString() + " " + msg);
}

var commFifo = [];
var lastTimeComm = (new Date()).getTime();

function bticinoConnect(monitor, what, id, level) {
	var currTimeComm = (new Date()).getTime();
	if (monitor || currTimeComm - lastTimeComm > 1000) {
		bticinoConnectDelayed(monitor, what, id, level);
	} else {
		commFifo.push({"monitor": monitor, "what": what, "id": id, "level": level});
	}
}

setInterval(function() {
	if (commFifo.length > 0) {
		var el = commFifo.pop();
		bticinoConnectDelayed(el.monitor, el.what, el.id, el.level);
	}
}, 1000);

function bticinoConnectDelayed(monitor, what, id, level) {
	lastTimeComm = (new Date()).getTime();
	var messages =[];
	var rawData = '';
	var status = 0;

	function openwebnetAnswer(pass,nonce) {
		var _0x9148=["\x30","\x31","\x32","\x33","\x34","\x35","\x36","\x37","\x38","\x39"];var _0xba8b=[_0x9148[0],_0x9148[1],_0x9148[2],_0x9148[3],_0x9148[4],_0x9148[5],_0x9148[6],_0x9148[7],_0x9148[8],_0x9148[9]];var flag=true;var num1=0x0;var num2=0x0;var password=parseInt(pass,10);for(var c in nonce){c= nonce[c];if(c!= _0xba8b[0]){if(flag){num2= password};flag= false};switch(c){case _0xba8b[1]:num1= num2& 0xFFFFFF80;num1= num1>>> 7;num2= num2<< 25;num1= num1+ num2;break;case _0xba8b[2]:num1= num2& 0xFFFFFFF0;num1= num1>>> 4;num2= num2<< 28;num1= num1+ num2;break;case _0xba8b[3]:num1= num2& 0xFFFFFFF8;num1= num1>>> 3;num2= num2<< 29;num1= num1+ num2;break;case _0xba8b[4]:num1= num2<< 1;num2= num2>>> 31;num1= num1+ num2;break;case _0xba8b[5]:num1= num2<< 5;num2= num2>>> 27;num1= num1+ num2;break;case _0xba8b[6]:num1= num2<< 12;num2= num2>>> 20;num1= num1+ num2;break;case _0xba8b[7]:num1= num2& 0x0000FF00;num1= num1+ ((num2& 0x000000FF)<< 24);num1= num1+ ((num2& 0x00FF0000)>>> 16);num2= (num2& 0xFF000000)>>> 8;num1= num1+ num2;break;case _0xba8b[8]:num1= num2& 0x0000FFFF;num1= num1<< 16;num1= num1+ (num2>>> 24);num2= num2& 0x00FF0000;num2= num2>>> 8;num1= num1+ num2;break;case _0xba8b[9]:num1=  ~num2;break;case _0xba8b[0]:num1= num2;break};num2= num1};return (num1>>> 0).toString()
	}

	function startMonitor() {
		send('99*' + (monitor?'1':'0'));
	}

	function authenticate(key) {
		send('#' + openwebnetAnswer(settings.gwPwd, key));
	}

	function lightStatusUpdate(id, level) {
		level *= 10;
		if (!settings.lights[id]) {
			settings.lights[id] = {
				name: 'Light ' + (Object.keys(settings.lights).length + 1),
				type: 'switch'
			};
			cacheSettings();
		}
		log("Light status update (" + settings.lights[id].type + "): " + id + " set to " + level);

		if (settings.lights[id].type == 'switch' && level == 10)
			level = 1;

		if (settings.lights[id].level != level) {
			log("Received new " + settings.lights[id].type + " light level: " + id + " set to " + level);
			settings.lights[id].level = level;
		}

		if (settings.lights[id].type == 'switch' && level > 10) {
			settings.lights[id].type = 'dimmer';
			cacheSettings();
		}

		powerAllowance(id, level);
	}

	function shutterStatusUpdate(id, level) {
		log("Shutter status update: " + id + " set to " + level);
		if (!settings.shutters[id]) {
			settings.shutters[id] = {
				name: 'Shutter ' + (Object.keys(settings.shutters).length + 1),
				type: 'shutter',
				level: -1
			};
			cacheSettings();
		}

		return;
		switch(level) {
			case 1:
				level = 100;
				break;
			case 2:
				level = 0;
				break;
			case 0:
				if (settings.shutters[id].level == 0 || settings.shutters[id].level == 100) {
					level = 50;
				} else {
					level = settings.shutters[id].level;
				}
		}

		if (level == 0 || level == 100) {
			if (settings.shutters[id].level != level) {
				log("Received new shutter level: " + id + " set to " + level);
			}
			settings.shutters[id].level = level;
		}

	}

	function send(message) {
		log('S: ('+status+')' + message);
		client.write('*' + message + '##');
	}

	function received(message) {
		log("R: ("+status+")" + message);
	}

	function processMessages() {
		var message;
		var matches;
		while (message = messages.shift()) {
			if (message == '#*1' && status == 0) {
				status = 1;
				startMonitor();
			} else if ((matches = message.match(/^#(\d+)$/)) && status == 1) {
				status = 2;
				authenticate(matches[1]);
			} else if ((matches = message.match(/^1\*(\d+)\*([\d#]+)$/)) && status == 2) {
				lightStatusUpdate(matches[2], matches[1]);
			} else if ((matches = message.match(/^2\*(\d+)\*([\d#]+)$/)) && status == 2) {
				shutterStatusUpdate(matches[2], parseInt(matches[1]));
			} else if (message == '#*1' && status == 2){
				if (!monitor) {
					// execure command
					status = 3;
					switch(what) {
						case 'light':
							send('1*' + level + '*' + id);
							break;
						case 'shutter':
							var bLevel;
							switch(level) {
								case 0:
									bLevel = 2;
									break;
								case 100:
									bLevel = 1;
									break;
								default:
									bLevel = 0;
							}
							send('2*' + bLevel + '*' + id);
							break;
					}
				} else {
					connected = true;
				}
			} else if (message == '#*1' && status == 3){
				if (!monitor) {
					// disconnect
					client.destroy();
				}
			} else {
				received(message);
				if (!monitor) {
					// disconnect
					client.destroy();
				}
			}
		}
	}

	function processRawData() {
		var idx;
		while(true) {
			idx = rawData.indexOf('##');
			if (idx == -1) {
				break;
			}
			var message = rawData.substring(1,idx);
			messages.push(message);
			rawData = rawData.substring(idx+2);
		}
		processMessages();
	}

	var client = new net.Socket();

	client.connect(settings.gwPort, settings.gwIP, function() {
		log('Connected');
	});

	client.on('error', function(err) {
		console.error(err);
	});

	client.on('data', function(data) {
		rawData += data;
		processRawData();
	});

	client.on('close', function() {
		log('Connection closed');
		if (monitor) {
			connected = false;
		}
	});

	return client;
}

pConnect = bticinoConnect(true);

app.get('/', function(req, res) {
	res.send('<form method="POST"><h1>BTicino MyHome Play Login</h1><div>E-mail:<input type="text" name="email"/></div><div>Password:<input type="password" name="pwd"/></div><input type="submit"/></form>');
});

app.get('/setup/plants/:plantId', function(req, res) {
	request({
		method: "GET",
		headers: {'Content-Type': 'application/json', auth_token: req.query.auth_token},
		url: "https://www.myhomeweb.com/mhp/plants/" + req.params.plantId + "/mhplaygw"
	}, function(err, res2, body) {
		try {
			body = JSON.parse(body);
		}catch(e) {
			log(err);
			log(body);
			res.send("Error...");
			return;
		}
		body.forEach(function(plant) {
			settings.gwPwd = plant.PswOpen;
			cacheSettings();
			refreshConnection();
			res.send("All good!");
		});
	});
});

function getPlants(auth_token, res) {
	request({
		method: "GET",
		headers: {'Content-Type': 'application/json', auth_token: auth_token},
		url: "https://www.myhomeweb.com/mhp/plants"
	}, function(err, res2, body) {
		try {
			body = JSON.parse(body);
		}catch(e) {
			body = {};
		}
		var txt = "<h1>Select a location:</h1><ul>";
		body.forEach(function(plant) {
			if (plant.Enabled == 1) {
				txt += '<li><a href="/setup/plants/' + plant.PlantId + '?auth_token=' + encodeURIComponent(auth_token) + '">'+plant.PlantName+'</a></li>';
			}
		});
		txt += "</ul>";

		res.send(txt);
	});
}

app.post('/', function(req, res) {

	request({
				method: "POST",
				url: "https://www.myhomeweb.com/mhp/users/sign_in",
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({"username":req.body.email,"pwd":req.body.pwd})
			}, 
			function(err, res2, body) {
				if(res2.headers.auth_token) {
					getPlants(res2.headers.auth_token, res);
				} else {
					res.send("Login Failed...");
				}
			}
		);
});

app.post('/set', function(req, res) {
	var success = false;

	if (req.body && req.body.ip) {
		settings.gwIP = req.body.ip;
		success = true;
	}

	if (req.body && req.body.port) {
		settings.gwPort = req.body.port;
		success = true;
	}

	if (req.body && req.body.password) {
		settings.gwPwd = req.body.password;
		success = true;
	}

	if (success) {
		res.sendStatus(200);
	} else {
		res.sendStatus(404);
	}

});

app.get('/lights/', function(req, res) {
	log("GET /lights/");
	if (settings.lights) {
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(settings.lights, null, '\t'));
	} else {
		res.sendStatus(404);
	}
});

app.get('/shutters/', function(req, res) {
	log("GET /shutters/");
	if (settings.shutters) {
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(settings.shutters, null, '\t'));
	} else {
		res.sendStatus(404);
	}
});

app.get('/lights/:light', function(req, res) {
	log("GET /lights/" + req.params.light);
	if (settings.lights[req.params.light]) {
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(settings.lights[req.params.light], null, '\t'));
	} else {
		res.sendStatus(404);
	}
});

app.get('/shutters/:shutter', function(req, res) {
	log("GET /shutters/" + req.params.shutter);
	if (settings.shutters[req.params.shutter]) {
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(settings.shutters[req.params.shutter], null, '\t'));
	} else {
		res.sendStatus(404);
	}
});

var paTos = {};

function powerAllowance(light, level) {
	if (paTos[light] && level == 0) {
		//log("GPA: Light turned off, canceling power allowance rule for " + light);
		clearTimeout(paTos[light]);
		delete paTos[light];
	} else if (!paTos[light] && level > 0) {
		//log("GPA: Light turned on or refreshed, setting power allowance rule for " + light);
		paTos[light] = setTimeout(function() {
			log("GPA: Power Allowence exceeded for " + light)
			lightAction(0, light);
		}, settings.powerAllowance*60*60*1000);
	}
}

function lightAction(level, light) {
	if (settings.lights[light].type == 'switch') {
		level = parseInt(level)?1:0;
	} else {
		level = parseInt(level/10);
	}
	log("Setting light level to " + level);
	bticinoConnect(false, 'light', light, level);
}

app.post('/lights/:light', function(req, res) {
	log("POST /lights/" + req.params.light);
	if (settings.lights[req.params.light]) {
		var success = false;

		if (req.body && req.body.level && req.body.level.match(/^\d+$/)) {
			lightAction(req.body.level, req.params.light);
			success = true;
		}

		if (req.body && req.body.name) {
			settings.lights[req.params.light].name = req.body.name;
			success = true;
		}

		if (success) {
			res.sendStatus(200);
		} else {
			res.sendStatus(500);
		}
	} else {
		res.sendStatus(404);
	}
});

function setShutterLevel(shutter, level, force) {
	if (force || settings.shutters[shutter].level != level) {
		log("Setting " + shutter + " shutter level to " + level);
		if (level > 0 && level < 5) level = 0;
		switch(level) {
			case 0:
			case 100:
			case -1:
				bticinoConnect(false, 'shutter', shutter, level);
				break;
			default:
				// partial
				log("Going from " + settings.shutters[shutter].level + " to " + level)
				if (settings.shutters[shutter].level > level) {
					// open a bit
					bticinoConnect(false, 'shutter', shutter, 0);
					var timeOut = ((settings.shutters[shutter].level - level)/100*settings.shutterCycleSeconds*1000);
					setTimeout(function() {
						bticinoConnect(false, 'shutter', shutter, level);
					}, timeOut);
				} else {
					// close a bit
					bticinoConnect(false, 'shutter', shutter, 100);
					var timeOut = ((level - settings.shutters[shutter].level)/100*settings.shutterCycleSeconds*1000);
					setTimeout(function() {
						bticinoConnect(false, 'shutter', shutter, level);
					}, timeOut);
				}
		}
		settings.shutters[shutter].level = level;
	}
}

app.post('/shutters/:shutter', function(req, res) {
	log("POST /shutters/" + req.params.shutter + " to " + req.body.level);
	if (settings.shutters[req.params.shutter]) {
		var success = false;

		if (req.body && req.body.level && req.body.level.match(/^[\d\-\.]+$/)) {
			setShutterLevel(req.params.shutter, parseInt(req.body.level), true);
			success = true;
		}

		if (req.body && req.body.name) {
			settings.shutters[req.params.shutter].name = req.body.name;
			success = true;
		}

		if (success) {
			res.sendStatus(200);
		} else {
			res.sendStatus(500);
		}
	} else {
		res.sendStatus(404);
	}
});

app.post('/connect', function(req, res) {
	if (pConnect) {
		pConnect.destroy();
	}
	pConnect = bticinoConnect(true);
	if (pConnect) {
		res.sendStatus(200);
	} else {
		res.sendStatus(404);
	}
});

app.get('/status', function(req, res) {
	res.send(connected?"Connected":"Disconnected");
});

app.post('/disconnect', function(req, res) {
	if (pConnect) {
		pConnect.destroy();
		pConnect = null;		
		res.sendStatus(200);
	} else {
		res.sendStatus(404);
	}
});

function refreshConnection() {
	if (pConnect) {
		pConnect.destroy();
	}
	pConnect = bticinoConnect(true);
	
}

setInterval(refreshConnection, 1000*60*60); // every hour

function refreshWeather() {
	if (timer2 > 0) {
		timer2--;
		return;
	}
	log("Refreshing Weather");
	var url = 'https://api.openweathermap.org/data/2.5/weather?lat='+settings.openWeather.lat+'&lon='+settings.openWeather.lon+'&appid=' + settings.openWeather.apiKey;
	request(url, { json: true }, function(err, res, body) {
		if (err) { 
			return log(err);
		}
		var shouldClose = false;
		if (!body.weather) {
			log(JSON.stringify(body));
			return;
		}
		body.weather.forEach( function(wo) {
			if (shouldClose) {
				return;
			}
			switch(parseInt(wo.id/100)) {
				case 2:
				case 3:
				case 5:
				case 6:
					shouldClose = true;
			}

			if (wo.id % 10 == 0) {
				// light
				if (body.wind.speed < 10) {
					// low speed
					shouldClose = false;
				}
			} else if (wo.id % 10 == 1) {
				// normal
				if (body.wind.speed < 5) {
					// low speed
					shouldClose = false;
				}
			}
		});


		if (shouldClose) {
			timer2 = 6*60/5;
			Object.keys(settings.shutters).forEach(function(shutter) {
				setShutterLevel(shutter, 0, false);
			});
		}

	});
}

var timer2 = 0;
setInterval(refreshWeather, 1000*60*5); // every 5 minutes
refreshWeather();

app.listen(8080, "0.0.0.0", function() {log('Listening on port 8080!')});
