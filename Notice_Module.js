const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const database = require('./Database.js');

var name = "NoticeMe Module";
var commands = ['noticeme', 'bag', 'arrot', 'narbe', 'help'];

const noticeLines = [
  'Hello, I am Botiun. How can I help?',
  'Okay. I notice you.',
  'We just did this...',
  'Seriously, I should help other people too...',
  'FINE! I notice you, okay?',
  'Wait! That wasn\'t enough for you? Really?',
  'Ugh! I am done with you. You are cut off!'
];

var noticeTracker = {};

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
    noticeTracker = [];
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
    case 'noticeme':
      notice(userDetails.username);
      break;
    case 'bag':
    case 'arroti':
    case 'narbe':
      didArrotiFindHisBag(userDetails.username);
      break;
  }
}

function notice(username) {
  let noticeCount = noticeTracker[username];
  if (noticeCount === undefined || noticeCount === null) {
    noticeCount = 0;
    noticeTracker[username] = 0;
  }
  if (noticeCount < noticeLines.length) {
    botiun.sendMessageToUser(username, noticeLines[noticeCount]);
    noticeTracker[username] = noticeCount + 1;
  }
}

//BAG JOKE
var canPingArroti = true;

function didArrotiFindHisBag(user) {
  if (canPingArroti) {

    if (hasArroti()) {
      botiun.sendMessageToUser("Arroti", ` ${user} really wants to know if you have found your bag!`);
    } else {
      botiun.sendMessage("I too wonder if Arroti has found his bag or not.");
    }

    canPingArroti = false;

    setTimeout(() => {
      canPingArroti = true;
    }, 30 * 1000);
  }
}

function hasArroti() {
  return botiun.hasUser("arroti");
}

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand
}