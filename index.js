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
          if (requestSource === googleAssistantRequest) {
            sendGoogleResponse(output);
          } else {
            sendResponse(output);
          }
        })
        .catch((error) => {
          // If there is an error let the user know
          if (requestSource === googleAssistantRequest) {
            sendGoogleResponse(error);
          } else {
            sendResponse(error);
          }
        });
  },
  // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
  'Password-Reset': () => {
    // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
    if (requestSource === googleAssistantRequest) {
      sendGoogleResponse('Listo! Te llegará un SMS con la nueva clave al celular');
    } else {
      sendResponse('Listo! Te llegará un SMS con la nueva clave al celular'); // Send simple response to user
    }
  },
  'Guest-Wifi': () => {
    // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
    let output = 'Se creó la cuenta. Ingresar con usuario "visita0' + Math.floor(Math.random() * 1000)
    +'" y clave "Entel.' + Math.floor(Math.random() * 1000) + '". Válida hasta el 30 de Enero ';
    if (requestSource === googleAssistantRequest) {
      sendGoogleResponse(output);
    } else {
      sendResponse(output);
    }
  },
  'Ticket-Status': () => {
    let ticket = '';
    if (body.result.parameters['ticket']) {
      ticket = body.result.parameters['ticket'];
      console.log('ticket: ' + ticket);
    } else {
      console.log('ERROR: No hay ticket');
    }
    let output = `El estado del ticket ${ticket} es completado con el siguiente comentario:\r\n"Trabajo realizado en terreno el 2 de diciembre."`;
    if (requestSource === googleAssistantRequest) {
      sendGoogleResponse(output);
    } else {
      sendResponse(output);
    }
    
  },
  // Default handler for unknown or undefined actions
  'default': () => {
    let responseToUser = 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
    
    if (requestSource === googleAssistantRequest) {
      sendGoogleResponse(responseToUser);
    } else {
      sendResponse(responseToUser);
    }
  }
};
// If undefined or unknown action use the default handler
if (!actionHandlers[action]) {
  action = 'default';
}
console.log("About to execute action: " + action)
// Run the proper handler function to handle the request from Dialogflow
actionHandlers[action]();

// Function to send correctly formatted Google Assistant responses to Dialogflow which are then sent to the user
function sendGoogleResponse (responseToUser) {
  if (typeof responseToUser === 'string') {
    app.ask(responseToUser); // Google Assistant response
  } else {
    // If speech or displayText is defined use it to respond
    let googleResponse = app.buildRichResponse().addSimpleResponse({
      speech: responseToUser.speech || responseToUser.displayText,
      displayText: responseToUser.displayText || responseToUser.speech
    });
    // Optional: Overwrite previous response with rich response
    if (responseToUser.googleRichResponse) {
      googleResponse = responseToUser.googleRichResponse;
    }
    // Optional: add contexts (https://dialogflow.com/docs/contexts)
    if (responseToUser.googleOutputContexts) {
      app.setContext(...responseToUser.googleOutputContexts);
    }

    console.log('Response to Dialogflow (AoG): ' + JSON.stringify(googleResponse));
    app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
  }
}

function sendResponse (responseToUser) {
  // if the response is a string send it as a response to the user
  if (typeof responseToUser === 'string') {
    let responseJson = {}
    responseJson.speech = responseToUser,
    responseJson.displayText = responseToUser,
    //responseJson.data = {},
    //responseJson.contextOut = [],
    //responseJson.source = "QnA Maker"

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
      let output = {};
      if(score > 0.6 || answer != "No good match found in the KB"){
        output = `Creo que esta es la respuesta que buscas:  \r\n "${answer}".`;
      }
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