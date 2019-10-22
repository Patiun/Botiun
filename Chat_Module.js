const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const database = require('./database.js');

var name = "Chat Module";
var commands = ['markov', 'impersonate'];

var loggingData = {};
const MIN_TIME_BETWEEN_POST = 5 * 1000;
const MAX_TIME_BETWEEN_POST = 10 * 1000;

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
    case 'impersonate':
    case 'markov':
      if (userDetails.username != 'patiun') {
        return;
      }
      let user = msgTokens[1] || 'patiun';
      user = user.toLowerCase();
      let postCount = msgTokens[2] || 5;
      postCount = parseInt(postCount);
      chatHistoryToText(user).then((text) => {
        const chain = markovChainGen(text);
        impersonate(user, chain, postCount);
      }).catch((user) => {
        console.log('error Markoving ' + user);
      });
      break;
    default:
      break;
  }
}

//------------------------------Markov Chain----------------------------------

function chatHistoryToText(user) {
  return new Promise((resolve, reject) => {
    getChatHistoryForUser(user).then((chatHistory) => {
      if (!chatHistory[0]) {
        reject(user);
        return;
      }
      let outputTxt = '';
      for (i in chatHistory[0].messages) {
        outputTxt += ' newlinehere ' + chatHistory[0].messages[i].message;
      }
      resolve(outputTxt);
    })
  });
}

function markovChainGen(text) {
  const textArr = text.split(' ');
  const markovChain = {};
  for (let i = 0; i < textArr.length; i++) {
    let word = textArr[i].toLowerCase().replace(/[\W_]/, "")
    if (!markovChain[word]) {
      markovChain[word] = []
    }
    if (textArr[i + 1]) {
      markovChain[word].push(textArr[i + 1].toLowerCase().replace(/[\W_]/, ""));
    }
  }
  return markovChain
}

var postCount = 0;
var postTimer;

function impersonate(user, chain, maxPosts) {
  botiun.sendMessage('/me is now impersonate ' + user);
  postCount = 0;
  clearTimeout(postTimer);
  impersonatePost(user, chain, maxPosts);
}

function impersonatePost(user, chain, maxPosts) {
  postCount++;
  let startingPoint = chain['newlinehere'][Math.floor(Math.random() * chain['newlinehere'].length)];

  let outputTxt = startingPoint;
  let nextKey = startingPoint;
  while (nextKey != 'newlinehere') {
    nextKey = chain[nextKey][Math.floor(Math.random() * chain[nextKey].length)];
    if (nextKey != 'newlinehere') {
      outputTxt += ' ' + nextKey;
    }
  }
  botiun.sendMessage(outputTxt);

  if (postCount <= maxPosts) {
    setTimeout(() => {
      impersonatePost(user, chain, maxPosts);
    }, Math.random() * (MAX_TIME_BETWEEN_POST - MIN_TIME_BETWEEN_POST) + MIN_TIME_BETWEEN_POST);
  } else {
    botiun.sendMessage('/me is done impersonating ' + user);
  }
}

//------------------------------Interaction------------------------------------

function checkMessageForInteraction(userDetails, message) {
  let username = userDetails.username;
  let messageToks = message.toLowerCase().split(' ');
  //console.log(username, messageToks);
  //let test = ['he', 'is', 'a', 'genius'];
  //let out = getArrayIntersection(test, messageToks);
  //console.log(messageToks, test, out);
}

function getArrayIntersection(array1, array2) {
  return array1.filter(value => array2.includes(value))
}

//------------------------------Logging----------------------------------------

function recordChatMessage(userDetails, message) {
  checkMessageForInteraction(userDetails, message);
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