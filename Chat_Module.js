const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const database = require('./database.js');

var name = "Chat Module";
var commands = [];

var loggingData = {};

function init() {
  return new Promise(function(resolve, reject) {
    data = {
      name: name
    }

    loggingData = {};

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

function recordChatMessage(userDetails, message) {
  let username = userDetails.username;
  let date = new Date();
  let timeStamp = date.toLocaleDateString() + '-' + date.toLocaleTimeString();
  if (loggingData[username]) {
    loggingData[username].queue.push({
      userDetails: userDetails,
      message: message,
      timeStamp: timeStamp
    });
    handleLogging(username);
  } else {
    loggingData[username] = {
      queue: [{
        userDetails: userDetails,
        message: message,
        timeStamp: timeStamp
      }],
      logging: 0
    }
    handleLogging(username);
  }
}

function handleLogging(username) {
  try {
    let loggingDataForUser = loggingData[username];
    if (loggingData[username].queue.length === 0) {
      if (loggingData[username].logging === 0) {
        //delete(loggingData[username]);
        clearTimeout(loggingData[username].timer);
        loggingData[username].timer = setTimeout(() => {
          saveChatHistoryForUser(loggingData[username].history);
          delete(loggingData[username]);
        }, 1000);
      }
      return;
    }

    loggingData[username].logging++;
    let messageData = loggingData[username].queue.shift();
    //console.log("logging...", loggingData[username].logging);
    (() => {
      return new Promise((resolve, reject) => {
        let history;
        if (loggingData[username].history) {
          history = loggingData[username].history;
        } else {
          history = database.getNewUserChatLogTemplate();
          history.twitchID = username;
          loggingData[username].history = history;
        }

        let messageLog = database.getNewChatLogEntryTemplate();
        messageLog.timeStamp = messageData.timeStamp;
        messageLog.message = messageData.message

        if (messageData.message[0] === '!') {
          history.commands.push(messageLog);
        } else {
          history.messages.push(messageLog);
        }

        loggingData[username].history = history;
        resolve();
      })
    })().then(() => {
      loggingData[username].logging--;
      handleLogging(username);
    });
  } catch (error) {
    botiun.error(error);
  }
}

function getChatHistoryForUser(username) {
  return new Promise(function(resolve, reject) {
    database.get(constants.collectionChatHistory, {
      twitchID: username
    }).then((result) => {
      resolve(result);
    }).catch(() => {
      reject();
    });
  });
}

function saveChatHistoryForUser(chatHistory) {
  let username = chatHistory.twitchID;
  getChatHistoryForUser(username).then((result) => {
    if (result.length === 0) {
      database.insert(constants.collectionChatHistory, chatHistory);
    } else {
      database.update(constants.collectionChatHistory, {
        twitchID: username
      }, {
        $push: {
          messages: {
            $each: chatHistory.messages
          },
          commands: {
            $each: chatHistory.commands
          }
        }
      });
    }
  });
}

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
  recordChatMessage: recordChatMessage
}