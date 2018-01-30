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

include 'asynchttp_v1'

metadata {
	definition (name: "Bticino Switch", namespace: "bogdanripa", author: "Bogdan Ripa") {
		capability "Switch"
	}
    
	simulator {
		// TODO: define status and reply messages here
	}

	tiles (scale: 2) {
        standardTile("switch", "device.switch", width: 2, height: 2, canChangeIcon: true) {
            state "off", label: '${currentValue}', action: "switch.on",
                  icon: "st.switches.switch.off", backgroundColor: "#ffffff"
            state "on", label: '${currentValue}', action: "switch.off",
                  icon: "st.switches.switch.on", backgroundColor: "#00a0dc"
        }
        main ("switch")
        details ("switch")
    }
    
	preferences {
		input "user", "text", title: "Username", required: true
        input "pass", "password", title: "Password", required: true
        input "gw_id", "number", title: "Gateway", required: true
        input "sw_id", "text", title: "Identifier", required: true
	}
}

def installed() {
    initialize()
}

def updated() {
    //unsubscribe()
    initialize()
}

def initialize() {
	log.debug "Initialize"
    // initialize counter
    state.auth_token = ""
}

def parse(description) {
	log.debug "Parsing..." + description
}

def checkAuth() {
	if (state.auth_token) {
    	sendCommand()
    } else {
        def params = [
            uri: 'https://www.myhomeweb.com',
            path: '/mhp/users/sign_in',
            body: ["username": user,"pwd": pass,"registrationId":"1"]
        ]
        asynchttp_v1.post(processAuthResponse, params)
    }
}

def processAuthResponse(response, data) {
    if (response.hasError()) {
        log.error "Response has error: ${response.getErrorMessage()}"
        log.error data
    } else {
        state.auth_token = response.getHeaders().auth_token
        if (state.auth_token) {
        	log.debug "Loged in!"
        	sendCommand();
        } else {
        	log.error "Auth error: ${response.getErrorMessage()}"
        }
    }
}
def sendCommand() {
	log.debug "Sending command..."

    def params = [
        uri: 'https://www.myhomeweb.com',
        path: '/mhp/mhplaygw/' + gw_id,
        headers: [
            "auth_token": state.auth_token
        ],
        requestContentType: 'application/json',
        body: '{"cmd":"*1*' + state.command + '*' + sw_id + '##"}'
    ]    
    asynchttp_v1.put(processSwitchResponse, params)
}

def processSwitchResponse(response, data) {
    if (response.hasError()) {
        if (response.getStatus() == 401) {
            // if auth error, re-sign-in and re-do the request
            if (state.auth_tries > 0) {
                state.auth_tries--
                state.auth_token = ''
				checkAuth()
            } else {
            	log.error "Too many login fails. Giving up."
            }
        } else {
	        log.error "Response has error: ${response.getErrorMessage()} with status: ${response.getStatus()}"
        }
    } else {
    	log.debug "Command sent."
    }
}

// handle commands
def on() {
	log.debug "Executing 'on'"
    state.auth_tries = 2;
    state.command = 1
    checkAuth()
}

def off() {
	log.debug "Executing 'off'"
    state.auth_tries = 2;
    state.command = 0
    checkAuth()
}
