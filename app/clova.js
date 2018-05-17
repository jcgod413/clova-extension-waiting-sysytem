const uuid = require('uuid').v4;
const _ = require('lodash');
const waiting = require('./waiting');
const {
    RT_NOSTORE,
    RT_GETWAITING_1,
    RT_GETWAITING_2,
    RT_POSTWAITING_1,
    RT_POSTWAITING_2,
    RT_GETSTORES_1,
    RT_GETSTORES_2,
    RT_NO_STORE,
    RT_GUIDE,
    RT_END,
    STORES,
} = require('../config');

class Directive {
    constructor({
        namespace,
        name,
        payload,
    }) {
        this.header = {
            messageId: uuid(),
            namespace,
            name,
        }
        this.payload = payload;
    }
}

const getWaiting = (slots) => {
    let responseText = "";
    if (!slots) {
        responseText = RT_GUIDE;
    } else if (!slots.Store) {
        responseText = RT_NO_STORE;
    } else {
        let store = slots.Store.value;
        let waitingCount = waiting.getWaitingCount(store);
        if (waitingCount == -1) {
            responseText += RESPONSE_NO_STORE;
        } else {
            responseText = RT_GETWAITING_1 + waitingCount + RT_GETWAITING_2;
        }
    }

    return responseText;
}

const postWaiting = (slots) => {
    let responseText = "";
    if (!slots) {
        responseText = RT_GUIDE;
    } else if (!slots.Store) {
        responseText = RT_NO_STORE;
    } else {
        let store = slots.Store.value;
        waiting.postWaiting(store);

        let waitingCount = waiting.getWaitingCount(store);
        responseText = RT_GETWAITING_1 + waitingCount + RT_GETWAITING_2;
    }

    return responseText;
}

const getStores = () => {
    let responseText = RT_GETSTORES_1;
    STORES.forEach((item, index, array) => {
        responseText += item + ", ";
    });
    responseText += RT_GETSTORES_2;
    return responseText;
}

class CEKRequest {
    constructor(httpReq) {
        this.request = httpReq.body.request;
        this.context = httpReq.body.context;
        this.session = httpReq.body.session;
        console.log(`CEK Request: ${JSON.stringify(this.context)}, ${JSON.stringify(this.session)}`)
    }

    do(cekResponse) {
        switch (this.request.type) {
            case 'LaunchRequest':
                return this.launchRequest(cekResponse);
            case 'IntentRequest':
                return this.intentRequest(cekResponse);
            case 'SessionEndedRequest':
                return this.sessionEndedRequest(cekResponse);
        }
    }

    launchRequest(cekResponse) {
        console.log('launchRequest')
        cekResponse.setSimpleSpeechText(RT_GUIDE);
        cekResponse.setMultiturn();
    }

    intentRequest(cekResponse) {
        console.log('intentRequest');
        const intent = this.request.intent.name;
        const slots = this.request.intent.slots;

        let responseText;
        switch (intent) {
            case 'GetWaitingIntent':
                responseText = getWaiting(slots);
                break;
            case 'PostWaitingIntent':
                responseText = postWaiting(slots);
                break;
            case 'GetStoresIntent':
                responseText = getStores();
                break;
            case 'Clova.GuideIntent':
            default:
                responseText = RT_GUIDE;
        }
        cekResponse.setSimpleSpeechText(responseText);

        if (this.session.new == false) {
            cekResponse.setMultiturn();
        }
    }

    sessionEndedRequest(cekResponse) {
        console.log('sessionEndedRequest');
        cekResponse.setSimpleSpeechText(RT_END);
        cekResponse.clearMultiturn();
    }
}

class CEKResponse {
    constructor() {
        this.response = {
            directives: [],
            shouldEndSession: true,
            outputSpeech: {},
            card: {},
        }
        this.version = '0.1.0';
        this.sessionAttributes = {};
    }

    setMultiturn(sessionAttributes) {
        this.response.shouldEndSession = false;
        this.sessionAttributes = _.assign(this.sessionAttributes, sessionAttributes);
    }

    clearMultiturn() {
        this.response.shouldEndSession = true;
        this.sessionAttributes = {};
    }

    setSimpleSpeechText(outputText) {
        this.response.outputSpeech = {
            type: 'SimpleSpeech',
            values: {
                type: 'PlainText',
                lang: 'ko',
                value: outputText,
            },
        }
    }

    appendSpeechText(outputText) {
        const outputSpeech = this.response.outputSpeech;
        if (outputSpeech.type != 'SpeechList') {
            outputSpeech.type = 'SpeechList';
            outputSpeech.values = []
        }
        if (typeof (outputText) == 'string') {
            outputSpeech.values.push({
                type: 'PlainText',
                lang: 'ko',
                value: outputText,
            });
        } else {
            outputSpeech.values.push(outputText);
        }
    }
}

const clovaReq = (httpReq, httpRes, next) => {
    cekResponse = new CEKResponse();
    cekRequest = new CEKRequest(httpReq);
    cekRequest.do(cekResponse);
    console.log(`CEKResponse: ${JSON.stringify(cekResponse)}`)
    return httpRes.send(cekResponse)
}

module.exports = clovaReq;