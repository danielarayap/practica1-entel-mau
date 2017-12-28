// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
var rp = require('request-promise');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

exports.QnAMakerWebhook = function QnAMakerWebhook(req, res) {
  console.log("Logging request body");
  let body = req.body;
  console.log(body);
  // An action is a string used to identify what needs to be done in fulfillment
  let action = (body.result.action) ? body.result.action : 'default';
  // Parameters are any entites that Dialogflow has extracted from the request.
  let parameters = body.result.parameters || {}; // https://dialogflow.com/docs/actions-and-parameters
  // Contexts are objects used to track and store conversation state
  let inputContexts = body.result.contexts; // https://dialogflow.com/docs/contexts
  // Get the request source (Google Assistant, Slack, API, etc)
  let requestSource = (body.originalDetectIntentRequest) ? body.originalDetectIntentRequest.source : undefined;
  // Get the session ID to differentiate calls from different users
  let session = (body.session) ? body.session : undefined;
  // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
  // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
  'QnA-Maker': () => {
        console.log("Executing QnA-Maker action");
        let query = '';
        if (body.result.parameters['query']) {
          query = body.result.parameters['query'];
          console.log('Query: ' + query);
        } else {
          console.log('No Query in parameters. Using user text');
          query = body.result['resolvedQuery'];
          console.log('raw Query from user: ' + query);
        }
        
        callQnAMakerApi(query)
        .then((output) => {
          // Return the results of the weather API to Dialogflow
          sendResponse(output);
        })
        .catch((error) => {
          // If there is an error let the user know
          sendResponse(error);
        });
  },
  // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
  'faq': () => {
    // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
    sendResponse('faq'); // Send simple response to user
  },
  // Default handler for unknown or undefined actions
  'default': () => {
    let responseToUser = {
      //fulfillmentMessages: richResponsesV2, // Optional, uncomment to enable
      //outputContexts: [{ 'name': `${session}/contexts/weather`, 'lifespanCount': 2, 'parameters': {'city': 'Rome'} }], // Optional, uncomment to enable
      fulfillmentText: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
    };
    sendResponse(responseToUser);
  }
};
// If undefined or unknown action use the default handler
if (!actionHandlers[action]) {
  action = 'default';
}
console.log("About to execute action")
// Run the proper handler function to handle the request from Dialogflow
actionHandlers[action]();


function sendResponse (responseToUser) {
  // if the response is a string send it as a response to the user
  if (typeof responseToUser === 'string') {
    let responseJson = {}
    responseJson.speech = responseToUser,
    responseJson.displayText = responseToUser,
    //responseJson.data = {},
    //responseJson.contextOut = [],
    responseJson.source = "QnA Maker"

    res.json(responseJson); // Send response to Dialogflow
  } else {
    // If the response to the user includes rich responses or contexts send them to Dialogflow
    let responseJson = {};
    // Define the text response
    responseJson.fulfillmentText = responseToUser.fulfillmentText;
    // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
    if (responseToUser.fulfillmentMessages) {
      responseJson.fulfillmentMessages = responseToUser.fulfillmentMessages;
    }
    // Optional: add contexts (https://dialogflow.com/docs/contexts)
    if (responseToUser.outputContexts) {
      responseJson.outputContexts = responseToUser.outputContexts;
    }
    // Send the response to Dialogflow
    console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
    res.json(responseJson);
  }
}

};

function callQnAMakerApi (query) {
  return new Promise((resolve, reject) => {    
    const host = 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0';
    const path = '/knowledgebases/884f5c41-afc5-41ef-ad18-a33d137665da/generateAnswer'    
    console.log('API Request: ' + host + path);

    var options = {
        method: 'POST',
        uri: host + path,
        body: {
          question: query
        },
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': 'ff049dd57ffd4b06b0123c8fc3d854f7'
        },
        json: true // Automatically stringifies the body to JSON
    };
  
    rp(options)
    .then(function (parsedBody) {
      console.log("Response from QnA Maker")
      console.log(parsedBody)
      //let response = JSON.parse(body);
      let answer = entities.decode(parsedBody.answers[0].answer);
      let score = parsedBody.answers[0].score;
      // Create response
      let output = `Creo que la respuesta es "${answer}".`;
      // Resolve the promise with the output text
      console.log(output);
      resolve(output);
    })
    .catch(function (err) {
      console.log("Error calling QnA Maker")
      resolve("Hubo un error al obtener la respuesta. Intente más tarde");
    });
  });
}