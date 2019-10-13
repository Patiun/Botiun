const constants = require('./Constants.js');
const botiun = require('./Botiun.js');

var name = "Accept Module";
var commands = ['accept', 'reject', 'deny'];

var waitingForAccept = {};

function init() {
  return new Promise(function(resolve, reject) {
    data = {
      name: name
    }
    resolve(data);
  });
}

function start() {
  return new Promise(function(resolve, reject) {
    data = {
      name: name
    }
    resolve(data);
  });
}

function end() {
  return new Promise(function(resolve, reject) {
    data = {
      name: name
    }
    resolve(data);
  });
}

function handleCommand(userDetails, msgTokens) {
  let command = msgTokens[0].toLowerCase();
  switch (command) {
    case 'accept':
      accept(userDetails.username);
      break;
    case 'reject':
    case 'deny':
      reject(userDetails.username);
      break;
    default:
      break;
  }
}

function addQuery(user, duration, parameters, callbackAccept, callbackReject) {
  waitingForAccept[user] = {
    timer: setTimeout(() => {
      delete(waitingForAccept[user]);
    }, duration),
    parameters: parameters,
    accept: callbackAccept,
    reject: callbackReject
  }
}

function accept(user) {
  let query = waitingForAccept[user];
  if (!query) {
    return;
  }

  query.accept(query.parameters);
  clearTimeout(query.timer);
  delete(waitingForAccept[user]);
}

function reject(user) {
  let query = waitingForAccept[user];
  if (!query) {
    return;
  }

  query.reject(query.parameters);
  clearTimeout(query.timer);
  delete(waitingForAccept[user]);
}

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
  addQuery: addQuery
}