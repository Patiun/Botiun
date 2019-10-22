const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const database = require('./database.js');

var name = "Activity Module";
var commands = [];


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
    default:
      break;
  }
}
//------------------------------Logging----------------------------------------

function recordActivity(user, activity) {

}

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand
}