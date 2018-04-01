var net = require('net');
var fs = require('fs');
const express = require('express');
var bodyParser = require('body-parser');
var pConnect;

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var settings = {
	gwIP: '192.168.86.95',
	gwPort: 20000,
	gwPwd: '12345',
	elements: {}
};

var settingsFile = process.argv[1].replace(/\/[^\/]+$/, "/settings.json");

var connected = false;

function loadSettings() {
	fs.exists(settingsFile, function(exists){
		if (exists) {
			fs.readFile(settingsFile, function readFileCallback(err, data) {
				if (err){
					console.log("Error reading 'settings.json': " + err);
				} else {
					settings = JSON.parse(data);
					pConnect = bticinoConnect(true);
				}
			});
 		} else {
			cacheSettings();
			pConnect = bticinoConnect(true);
		}
	});
}

function cacheSettings() {
	var json = JSON.stringify(settings, null, '\t');
	fs.writeFile(settingsFile, json);
}

loadSettings();

function bticinoConnect(monitor, light, level) {
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

	function statusUpdate(id, level) {
		if (!settings.elements[id]) {
			settings.elements[id] = {
				name: 'Light ' + (Object.keys(settings.elements).length + 1)
			};
		}
		settings.elements[id].level = level;

		cacheSettings();
	}

	function send(message) {
		console.log('S: ' + message);
		client.write('*' + message + '##');
	}

	function received(message) {
		console.log("R: " + message);
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
				statusUpdate(matches[2], matches[1]);
			} else if (message == '#*1' && status == 2){
				if (!monitor) {
					// execure command
					status = 3;
					send('1*' + level + '*' + light);
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
			console.log('R: ' + message);
			messages.push(message);
			rawData = rawData.substring(idx+2);
		}
		processMessages();
	}

	var client = new net.Socket();

	client.connect(settings.gwPort, settings.gwIP, function() {
		console.log('Connected');
	});

	client.on('error', function(err) {
		console.error(err);
	});

	client.on('data', function(data) {
		rawData += data;
		processRawData();
	});

	client.on('close', function() {
		console.log('Connection closed');
		if (monitor) {
			connected = false;
		}
	});

	return client;
}

app.get('/', function(req, res) {
	res.send('Hello World!');
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
		cacheSettings();
		res.sendStatus(200);
	} else {
		res.sendStatus(404);
	}

});

app.get('/lights/', function(req, res) {
	console.log("GET /lights/");
	if (settings.elements) {
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(settings.elements, null, '\t'));
	} else {
		res.sendStatus(404);
	}
});

app.get('/lights/:light', function(req, res) {
	console.log("GET /lights/" + req.params.light);
	if (settings.elements[req.params.light]) {
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(settings.elements[req.params.light], null, '\t'));
	} else {
		res.sendStatus(404);
	}
});

app.post('/lights/:light', function(req, res) {
	console.log("POST /lights/" + req.params.light);
	if (settings.elements[req.params.light]) {
		var success = false;
		console.log(req.body)
		if (req.body && req.body.level && req.body.level.match(/^\d+$/)) {
			bticinoConnect(false, req.params.light, req.body.level);
			success = true;
		}

		if (req.body && req.body.name) {
			settings.elements[req.params.light].name = req.body.name;
			cacheSettings();
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

setInterval(refreshConnection, 1000*60*60);

app.listen(8080, "0.0.0.0", function() {console.log('Listening on port 8080!')});
