/**
 *  Generic UPnP Service Manager
 *
 *  Copyright 2016 SmartThings
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 */
definition(
		name: "Bticino Service Manager",
		namespace: "bogdanripa",
		author: "Bogdan Ripa",
		description: "Bticino device manager",
		category: "My Apps",
		iconUrl: "https://is3-ssl.mzstatic.com/image/thumb/Purple71/v4/9b/de/c7/9bdec7bf-c990-2ace-2ca4-06ee6cdd97b5/source/256x256bb.jpg",
		iconX2Url: "https://is3-ssl.mzstatic.com/image/thumb/Purple71/v4/9b/de/c7/9bdec7bf-c990-2ace-2ca4-06ee6cdd97b5/source/256x256bb.jpg",
		iconX3Url: "https://is3-ssl.mzstatic.com/image/thumb/Purple71/v4/9b/de/c7/9bdec7bf-c990-2ace-2ca4-06ee6cdd97b5/source/256x256bb.jpg")


preferences {
	page(name: "searchTargetSelection", title: "Bticino Lights Search Target", nextPage: "deviceDiscovery") {
		section("Search Target") {
			input "searchTarget", "string", title: "Search Target", defaultValue: "192.168.86.162:8080", required: true
		}
	}
	page(name: "deviceDiscovery", title: "Bticino Lights Device Setup", content: "deviceDiscovery")
}

def deviceDiscovery() {
	def options = [:]
	def devices = getDevices()
	devices.each {
		def value = it.value.name
		def key = it.key
		options["${key}"] = value
	}

	//ssdpSubscribe()
	ssdpDiscover()

	return dynamicPage(name: "deviceDiscovery", title: "Discovery Started!", nextPage: "", refreshInterval: 5, install: true, uninstall: true) {
		section("Please wait while we discover your devices.") {
			input "selectedDevices", "enum", required: false, title: "Select Devices (${options.size() ?: 0} found)", multiple: true, options: options
		}
	}
}

void ssdpDiscover() {
	log.debug "Discovering..."
	def command = new physicalgraph.device.HubAction([
		method: "GET",
		path: "/lights/",
		headers: [
			"HOST": searchTarget
		]], null, [callback: processGetListResponse]
	)
	sendHubCommand(command)
}

void processGetListResponse(response) {
	def devices = getDevices()
	response.json.each {
    	if (devices."${it.key}") {
        	def d = devices."${it.key}"
            d.name = it.value.name
            d.level = it.value.level
        } else {
	        devices << ["${it.key}": it.value]
        }
        def cd = getChildDevice(it.key)
        if (cd) {
        	cd.setLevel(it.value.level)
        }
	}
    
    
}

def getDevices() {
	if (!state.devices) {
		state.devices = [:]
	}
	state.devices
}

def installed() {
	log.debug "Installed with settings: ${settings}"

	initialize()
}

def updated() {
	log.debug "Updated with settings: ${settings}"

	unsubscribe()
	initialize()
}

def initialize() {
	unsubscribe()
	//unschedule()

	//ssdpSubscribe()

	if (selectedDevices) {
		addDevices()
	}

	runEvery1Minute("ssdpDiscover")
}

def addDevices() {
	def devices = getDevices()
    def cDevices = getChildDevices()

	selectedDevices.each { dni ->
		def selectedDevice = devices."${dni}"
        if (!selectedDevice) return;

		def d = cDevices?.find {
			it.deviceNetworkId == dni
		}

		if (!d) {
			log.debug "Creating Bticino Device with id: ${dni} on " + location.hubs[0].id + " calling " + searchTarget
			d = addChildDevice("bogdanripa", "Bticino Switch", dni, location.hubs[0].id, [
				"label": selectedDevice.name,
                "completedSetup": true
			])
            d.initialSetup(searchTarget, dni, selectedDevice.level)
		} else {
			log.debug "Updating Bticino Device with id: ${dni} on " + location.hubs[0].id + " calling " + searchTarget
            d.setGW(searchTarget)
        }
	}
    
	devices.each {
        if(!selectedDevices.contains(it.key)) {
        	try {
	            deleteChildDevice(it.key)
            } catch(Exception e) {
            }
        }
    }
}
