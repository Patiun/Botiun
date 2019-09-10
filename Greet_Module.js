const database = require('./Database.js');
const constants = require('./Constants.js');
const botiun = require('./Botiun.js');

var name = "Greet Module";
var commands = ['welcome', 'welcomeme'];

var allowedToGreet = false;
var alreadyGreeted = [];

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

    allowedToGreet = true;
    alreadyGreeted = [];

    data = {
      name: name
    }
    resolve(data);
  });
}

function end() {
  return new Promise(function(resolve, reject) {

    allowedToGreet = false;
    data = {
      name: name
    }
    resolve(data);
  });
}

function handleCommand(userDetails, msgTokens) {
  let command = msgTokens[0].toLowerCase();
  switch (command) {
    case 'welcome':
    case 'welcomeme':
      setWelcome(userDetails.username);
      break;
    default:
      botiun.log(`${command} was not handled properly in Greet_Module.js`);
      break;
  }
}

function greetUser(username) {
  if (!alreadyGreeted.includes(username)) {
    database.get(constants.collectionUsers, {
      twitchID: username
    }).then((result) => {
      if (result.length > 0) {
        let user = result[0];
        //console.log(user);
        if (user.isVIP && user.config.entranceAlert) {
          console.log("Welcoming " + username + "!");
          alreadyGreeted.push(username);
          botiun.playSound('/Welcome-Shrek.mp3');
        }
      }
    });
  } else {
    console.log("Already welcomed " + username);
  }
}

function setWelcome(username) {
  database.update(constants.collectionUsers, {
    twitchID: username
  }, {
    $set: {
      config: {
        entranceAlert: true
      }
    }
  });
  console.log(username + " you will now be welcomed");
  greetUser(username);
}

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
  greetUser: greetUser
}