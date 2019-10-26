const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const database = require('./database.js');
const fs = require('fs');

var name = "Chat Module";
var commands = ['markov', 'impersonate', 'chatbetween', 'conversate', 'chatcount', 'randomsong', 'stopinate'];

var loggingData = {};
const MIN_TIME_BETWEEN_POST = 5 * 1000;
const MAX_TIME_BETWEEN_POST = 10 * 1000;
var isImpersonating = false;

function init() {
  return new Promise(function(resolve, reject) {
    data = {
      name: name
    }

    loggingData = {};
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
    case 'stopinate':
      clearTimeout(postTimer);
      if (isImpersonating) {
        botiun.sendMessage('/me has stopped all impersonations.');
      }
      isImpersonating = false;
      break;
    case 'impersonate':
    case 'markov':
      if (isImpersonating) {
        return;
      }
      if (userDetails.username === 'patiun' || userDetails.username === 'leonv3x') {
        let user = msgTokens[1] || userDetails.username;
        user = user.toLowerCase();
        let postCount = msgTokens[2] || 5;
        postCount = parseInt(postCount);

        if (user === 'everyone') {
          impersonateEveryone(postCount);
        } else {
          chatHistoryToText(user).then((text) => {
            const chain = markovChainGen(text);
            impersonate(user, chain, postCount);
          }).catch((user) => {
            console.log('error Markoving ' + user);
          });
        }
      } else {
        return;
      }
      break;
    case 'chatbetween':
    case 'conversate':
      if (isImpersonating) {
        return;
      }
      if (userDetails.username === 'patiun' || userDetails.username === 'leonv3x') {
        let user1 = msgTokens[1] || 'patiun';
        let user2 = msgTokens[2] || 'leonv3x';
        let postMax = msgTokens[3] || 6;
        postMax = parseInt(postMax);
        chatBetween(user1, user2, postMax);
      }
      break;
    case 'chatcount':
      let user = msgTokens[1] || userDetails.username;
      tellChatCountFor(user.toLowerCase());
      break;
    case 'randomsong':
      if (userDetails.mod || userDetails.username === 'patiun') {
        let target = msgTokens[1] || userDetails.username;
        requestRandomSongFor(target.toLowerCase());
      }
      break;
    default:
      break;
  }
}

//------------------------------Random Song-----------------------------------

function requestRandomSongFor(user) {
  console.log("USER", user);
  if (user === 'everyone') {
    getAllChatHistory().then((result) => {
      let songs = [];
      for (j in result) {
        let history = result[j];

        for (i in history.commands) {
          let command = history.commands[i].message;
          if (command.toLowerCase().slice(0, 3) === '!sr') {
            songs.push(command);
          }
        }
      }

      if (songs.length > 0) {
        botiun.sendMessage(songs[Math.floor(Math.random() * songs.length)]);
      } else {
        botiun.sendMessage('No songs to request for ' + user);
      }

    });
  } else {
    getChatHistoryForUser(user).then((result) => {
      let history = result[0];
      if (!history) {
        botiun.error('No history for ' + user);
        return;
      }

      let songs = [];

      for (i in history.commands) {
        let command = history.commands[i].message;
        if (command.toLowerCase().slice(0, 3) === '!sr') {
          songs.push(command);
        }
      }

      //console.log(songs);

      if (songs.length > 0) {
        botiun.sendMessage(songs[Math.floor(Math.random() * songs.length)]);
      } else {
        botiun.sendMessage('No songs to request for ' + user);
      }

    });
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
    let word = textArr[i].toLowerCase().replace(/[\W_]/, "");
    if (!markovChain[word]) {
      markovChain[word] = []
    }
    if (textArr[i + 1]) {
      markovChain[word].push(textArr[i + 1]); //.toLowerCase()); //.replace(/[\W_]/, ""));
    }
  }
  return markovChain
}

var postCount = 0;
var postTimer;

function impersonate(user, chain, maxPosts) {
  botiun.sendMessage('/me is now impersonating ' + user);
  postCount = 0;
  clearTimeout(postTimer);
  impersonatePost(user, chain, maxPosts);
}

async function chatBetween(user1, user2, maxPosts) {
  let chain1;
  let chain2;

  await chatHistoryToText(user1).then((text) => {
    chain1 = markovChainGen(text);
  }).catch((e) => {
    return;
  });
  await chatHistoryToText(user2).then((text) => {
    chain2 = markovChainGen(text);
  }).catch((e) => {
    return;
  });

  if (!chain1) {
    botiun.error("Error producing markov chain for " + user1);
    return;
  }

  if (!chain2) {
    botiun.error("Error producing markov chain for " + user2);
    return;
  }

  botiun.sendMessage('/me is impersonating a conversation between ' + user1 + ' and ' + user2);
  postCount = 0;
  impersonatePost(user1, chain1, maxPosts, true, user2, chain2);
}

//TODO
//Imperonate all

function impersonatePost(user, chain, maxPosts, sayName, otherUser, otherChain) {
  try {
    isImpersonating = true;
    postCount++;
    let startingPoint = chain['newlinehere'][Math.floor(Math.random() * chain['newlinehere'].length)];

    let outputTxt;
    if (sayName) {
      outputTxt = user + ": " + startingPoint;
    } else {
      outputTxt = startingPoint;
    }

    let nextKey = startingPoint;
    while (nextKey != 'newlinehere') {
      //console.log(nextKey);
      let reducedKey = nextKey.toLowerCase().replace(/[\W_]/, "");
      if (chain[reducedKey]) {
        nextKey = chain[reducedKey][Math.floor(Math.random() * chain[reducedKey].length)];
        if (nextKey != 'newlinehere') {
          outputTxt += ' ' + nextKey;
        }
      } else {
        console.log('ERROR - ' + nextKey + '/' + reducedKey + ' didnt have a markov chain entry.');
        nextKey = chain['newlinehere'][Math.floor(Math.random() * chain['newlinehere'].length)];
      }
    }
    console.log("POSTED " + outputTxt);
    botiun.sendMessage(outputTxt);

    if (postCount < maxPosts) {
      postTimer = setTimeout(() => {
        if (otherChain) {
          if (Math.random() < 0.69) {
            impersonatePost(otherUser, otherChain, maxPosts, sayName, user, chain);
          } else {
            impersonatePost(user, chain, maxPosts, sayName, otherUser, otherChain);
          }
        } else {
          impersonatePost(user, chain, maxPosts, sayName, otherUser, otherChain);
        }
      }, Math.random() * (MAX_TIME_BETWEEN_POST - MIN_TIME_BETWEEN_POST) + MIN_TIME_BETWEEN_POST);
    } else {
      if (otherChain) {
        botiun.sendMessage('/me is done impersonating ' + user + ' and ' + otherUser);
      } else {
        botiun.sendMessage('/me is done impersonating ' + user);
      }
      isImpersonating = false;
    }
  } catch (e) {
    console.log("SOMETHING WENT WRONG");
    botiun.error(e);
  }
}

async function impersonateEveryone(postMax) {
  try {
    getAllChatHistory().then((result) => {
      let outputTxt = '';
      for (i in result) {
        let chatHistory = result[i];
        if (chatHistory) {
          for (j in chatHistory.messages) {
            outputTxt += ' newlinehere ' + chatHistory.messages[j].message;
          }
        }
      }
      let chain = markovChainGen(outputTxt);
      botiun.sendMessage('/me is now impersonating all of chat!');
      postCount = 0;
      impersonatePost('everyone', chain, postMax);
    });
  } catch (e) {
    botiun.error(e);
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

function tellChatCountFor(user) {
  getChatHistoryForUser(user).then((result) => {
    let history = result[0];
    if (history) {
      botiun.sendMessage(user + ' has sent ' + history.messages.length + ' messages and used ' + history.commands.length + ' commands.');
    } else {
      botiun.sendMessage('No chat history for ' + user);
    }
  })
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

function getAllChatHistory() {
  return new Promise(function(resolve, reject) {
    database.get(constants.collectionChatHistory, {}).then((result) => {
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