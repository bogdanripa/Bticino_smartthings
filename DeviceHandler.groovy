/**
 *  Bticino Switch
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
	definition (name: "Bticino Switch", namespace: "bogdanripa", author: "Bogdan Ripa") {
		capability "Switch"
		attribute "status", "string"
	}
    
	simulator {
		// TODO: define status and reply messages here
	}

	tiles (scale: 2) {
        standardTile("switch", "device.switch", width: 2, height: 2, canChangeIcon: true) {
//            state "loading", label:'Loading', icon:"st.switches.switch.off", backgroundColor:"#ffffff", nextState: "off"
            state "off", label:'Off', action:"switch.on", icon:"st.switches.switch.off", backgroundColor:"#ffffff"//, nextState:"turningOn"
            state "on", label:'On', action:"switch.off", icon:"st.switches.switch.on", backgroundColor:"#00a0dc"//, nextState:"turningOff"
/*            state "turningOn", label:'Turning on', icon:"st.switches.switch.on", backgroundColor:"#00a0dc", nextState: "turningOff"
            state "turningOff", label:'Turning off', icon:"st.switches.switch.off", backgroundColor:"#ffffff", nextState: "turningOn"*/
            state "error", label:'Error', action:"switch.off", icon:"st.switches.switch.off", backgroundColor:"#ff0000", nextState: "off"
        }
        main ("switch")
        details ("switch")
    }
    
	preferences {
        input "sw_id", "text", title: "Identifier", required: false
	}
}

def initialSetup(gw, device_id, level) {
    log.debug "Initial level: " + level + " for " + device_id + " calling " + gw
	state.sw_id = device_id
    state.level = level
    state.gw = gw
    sendEvent(name: "switch", value: level=='0'?"off":"on") 
}

def setLevel(level) {
    state.level = level
    sendEvent(name: "switch", value: level=='0'?"off":"on") 
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

def sendCommand() {
	def id = sw_id ? sw_id : state.sw_id
	log.debug "Sending command on " + state.gw + " for " + id

	if (id && state.gw != '') {
        def result = new physicalgraph.device.HubAction([
            method: "POST",
            path: "/lights/" + id.replaceAll(/#/, '%23'),
            headers: [
                "HOST": state.gw,
                "Content-Type": "application/x-www-form-urlencoded"
            ],
            body: [level: state.level]], null, [callback: processSwitchResponse]
        )

        return result
    }
}

def processSwitchResponse(response) {
    if (response.status != 200) {
        sendEvent(name: "switch", value: "error")
        sendEvent(name: "status", value: "Response has error: ${response.body} with status: ${response.status}")
    } else {
    	log.debug "Command sent."
        sendEvent(name: "switch", value: state.level=='0'?"off":"on") 
    }
}

// handle commands
def on() {
	log.debug "Executing 'on'"
    sendEvent(name: "status", value: "Executing 'on'")
    state.level = '1'
    return sendCommand()
}

def off() {
	log.debug "Executing 'off'"
    sendEvent(name: "status", value: "Executing 'off'")
    state.level = '0'
    return sendCommand()
}

def loading() {
	log.debug "Loading..."
}
