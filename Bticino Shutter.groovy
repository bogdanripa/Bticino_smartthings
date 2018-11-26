/**
 *  Bticino Shutter
 *
 *  Copyright 2018 Bogdan Ripa
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

metadata {
	definition (name: "Bticino Shutter", namespace: "bogdanripa", author: "Bogdan Ripa") {
		capability "Switch"
		capability "Switch Level"
		capability "Refresh"
		attribute "status", "string"
		command "refresh"
	}
    
	simulator {
		// TODO: define status and reply messages here
	}

	tiles (scale: 2) {
		multiAttributeTile(name:"switch", type: "lighting", width: 6, height: 4, canChangeIcon: true) {
			tileAttribute ("device.switch", key: "PRIMARY_CONTROL") {
				attributeState "on", label:'down', action:"switch.off", icon:"st.Home.home9", backgroundColor:"#888888"
				attributeState "off", label:'up', action:"switch.on", icon:"st.Home.home9", backgroundColor:"#CCCC55"
				attributeState "error", label:'${name}', action:"switch.off", icon:"st.Home.home9", backgroundColor:"#FFA0DC"
			}
			tileAttribute ("device.level", key: "SLIDER_CONTROL") {
				attributeState "level", action:"switch level.setLevel"
			}
		}
        main(["switch"])
        details(["switch"])
    }
    
	preferences {
        input "sw_id", "text", title: "Identifier", required: false
	}
}

def initialSetup(gw, device_id, level) {
    state.sw_id = device_id
    state.gw = gw
    sendEvent(name: "shutter", value: level==2?"on":"off")
    sendEvent(name: "level", value: level)

    log.debug "Initial level: " + level + " for " + state.sw_id + " calling " + state.gw
}

def updateLevel(level) {
    sendEvent(name: "shutter", value: level==2?"on":"off") 
    sendEvent(name: "level", value: level);//==2?100:0)

    log.debug "Update level: " + level + " for " + state.sw_id + " calling " + state.gw
}

def setLevel(userLevel) {
	return;
	log.debug "Executing 'userSetLevel' to " + userLevel
    sendEvent(name: "status", value: "Executing 'userSetLevel' to " + userLevel)
    sendEvent(name: "switch", value: userLevel>50?"on":"off") 
    sendEvent(name: "level", value: userLevel)
    return sendCommand(userLevel>50?"on":"off")
}

def setGW(gw) {
    state.gw = gw
}

def installed() {
    return initialize()
}

def updated() {
    //unsubscribe()
    return initialize()
}

def initialize() {
	log.debug "Initialize Device Handler"
    //state.level = '0'
    //state.gw = ''
    //sendEvent(name: "switch", value: "loading") 
}

def sendCommand(sw) {
    def id = state.sw_id

    def level    
    if (sw == 'on') {
        level = 2
    }
    if (sw == 'off') {
        level = 1
    }

    log.debug "Set level " + level + " on " + state.gw + " for " + id

    if (id && state.gw != '') {
        def result = new physicalgraph.device.HubAction([
            method: "POST",
            path: "/shutters/" + id.replaceAll(/#/, '%23'),
            headers: [
                "HOST": state.gw,
                "Content-Type": "application/x-www-form-urlencoded"
            ],
            body: [level: '' + level]], null, [callback: processShutterResponse]
        )

        return result
    }
}

def processSwitchResponse(response) {
    if (response.status != 200) {
        sendEvent(name: "switch", value: "error")
        sendEvent(name: "status", value: "Response has error: ${response.body} with status: ${response.status}")
    }
}

// handle commands
def on() {
	log.debug "Executing 'on'"
    sendEvent(name: "status", value: "Executing 'on'")
    sendEvent(name: "switch", value: "on") 
    return sendCommand("on")
}

def off() {
	log.debug "Executing 'off'"
    sendEvent(name: "status", value: "Executing 'off'")
    sendEvent(name: "switch", value: "off") 
    return sendCommand("off")
}

def loading() {
	log.debug "Loading..."
}
