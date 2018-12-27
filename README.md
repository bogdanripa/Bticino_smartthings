# Bticino to smartthings connector

Prerequisites:
* a raspberry pi that you have previously connected to your home internet
* the BTicino hub, also connected to the same network
* the Smartthings hub, connected to the same network.

You'll need to know:
* The IP address of your BTiciono hub. You might want to log-in to your router and find it's IP address that way
* The IP address of your raspberry PI

Installation steps:
* login to your raspoberry pi
* install node.js
* clone this repo
* copy settings.template.json to settings.json
* update settings.json with the BTicino hub's IP address under "gwIP"
* use something like "forever" to start the node.js app. Please make sure that it auto-starts if the pi reboots

Local set-up
* go to http://RASPBERRY-PI-URL:8080/
* follow the steps. These will discover and cache the gwPW in the settings file
* using the MyHomePla app, turn on and off all lights and shutters. The settings file will regenerate to cache each individual light's identifier

Smartthings set-up
* Log in to smartthings (https://graph-na04-useast2.api.smartthings.com/ide/app/editor/)
* Under "my smart apps", create a new app and paste the code from the "SmartApp.groovy" file. Save and publish.
* Under "my device handlers", create two new handlers and paste the code from the "Bticino Switch.groovy" / "Bticino Shutter.groovy" files. Save and publish.

In the Smartthings app on your phone
* Install the "Btcino Service Manager" app
* set-it up with the raspberry's IP and port (example: "192.168.1.100:8080")
* let it search your lights and shutters, and add them
* identify and rename each device

Have fun!
