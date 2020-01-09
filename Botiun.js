//Core Botiun Module
//Will handle all input logic and pass it to where it belongs
const tmi = require('tmi.js');
const fs = require('fs');
const process = require('process');
const axios = require('axios');
const connect = require('connect');
const serveStatic = require('serve-static');
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
//Core Units
const constants = require('./Constants.js');
const database = require('./Database.js');
//Modules
const gambling = require('./Gambling_Module.js');
const currency = require('./Currency_Module.js');
const notice = require('./Notice_Module.js');
const race = require('./Race_Module.js');
const greet = require('./Greet_Module.js');
const accept = require('./Accept_Module.js');
const chat = require('./Chat_Module.js');
const activity = require('./Activity_Module.js');
const userDetails = require('./UserDetails_Module.js');
const se = require('./StreamElements.js');

const VERBOSE = true;
const VIEWER_UPDATE_INTERVAL = 30; //Seconds
const STREAM_UPDATE_INTERVAL = 60; //Seconds
const S_TO_MS = 1000;
const CURRENCY_PER_INTERVAL = 1;
const modules = [currency, notice, race, greet, accept, chat, activity, userDetails]; //gambling
const channel = "Patiun";
const rooms = {
  main: "Patiun",
  casino: 'chatrooms:45825826:932337ca-4e78-4df3-bc09-219963d54885',
  mods: 'chatrooms:45825826:ece89468-11b0-4e9c-ab65-90a64f91de92',
  subs: 'chatrooms:45825826:42681782-80b8-4a9a-90c8-229bf3809f1b'
}
const superUsers = ['patiun'];
var lastUsers = {
  broadcaster: [],
  vips: [],
  moderators: [],
  staff: [],
  admins: [],
  global_mods: [],
  viewers: []
};
var logFilename = "Botiun_";
var currentUsers = [];
var ignoredUsers = [];
var alertedUsers = [];
var live = false;
var allowedToPost = true;
var canTTS = true;
if (process.argv.length > 2 && ['debug', 'silent'].includes(process.argv[2].toLowerCase())) {
  console.log("Silent mode activated.");
  allowedToPost = false;
}
var streamObject = {};
const opts = {
  options: constants.options,
  identity: constants.identity,
  channels: constants.channels
}
const client = new tmi.client(opts);
var stdin = process.openStdin();



let today = new Date();
let dateStamp = today.getFullYear() + '_' + (today.getMonth() + 1) + '_' + today.getDate();
logFilename = constants.logDir + logFilename + dateStamp + ".log";

client.on('connected', onConnectedHandler);
client.on('message', onMessageHandler);
client.on('raided', onRaidHandler);

function onRaidHandler(channel, raider, viewers) {
  console.log("raid", channel, raider, viewers);
}

client.on("hosted", onHostHandler);

function onHostHandler(channel, username, viewers, autohost) {
  console.log("hosts", channel, username, viewers, autohost)
}
client.on('resub', onResubHandler);

function onResubHandler(channel, username, months, message, userstate, methods) {
  console.log("Resub", channel, username, months, message, userstate, methods);
}

/*client.on("subgift", (channel, username, streakMonths, recipient, methods, userstate) => {
    // Do your stuff.
    let senderCount = ~~userstate["msg-param-sender-count"];
});*/
/*client.on("submysterygift", (channel, username, numbOfSubs, methods, userstate) => {
    // Do your stuff.
    let senderCount = ~~userstate["msg-param-sender-count"];
});*/
/*client.on("giftpaidupgrade", (channel, username, sender, userstate) => {
    // Do your stuff.
});*/
/*client.on("anongiftpaidupgrade", (channel, username, userstate) => {
    // Do your stuff.
});*/
client.on("subscription", onSubHandler);

function onSubHandler(channel, username, method, message, userstate) {
  console.log("Sub", channel, username, method, message, userstate);
}

client.on("vips", onVipHandler);

function onVipHandler(channel, vips) {
  console.log("vips", channel, vips);
}
/*client.on("whisper", (from, userstate, message, self) => {
    // Don't listen to my own messages..
    if (self) return;

    // Do your stuff.
});*/
client.on("cheer", onCheerHandler);

function onCheerHandler(channel, userstate, message) {
  console.log("Cheer", channel, userstate, message);
}
//client.on( 'join', onJoinHandler );
//client.on( 'part', onPartHandler );
//client.on('',handler);
//TODO add sub and follow events

client.connect();

///////////////----------------------------------------------------------------
//Web Server//-----------------------------------------------------------------
/////////////------------------------------------------------------------------

const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

server.listen(port, () => {
  log(`Web Server listening at port ${port}`);
});
app.get('/', function(req, res) {
  res.sendFile('D:/projects/github/botiun/Public_Html/index.html');
});
app.get('/overlay', function(req, res) {
  res.sendFile('D:/projects/github/botiun/Public_Html/overlay.html');
});
app.use(express.static('Sounds'));
app.use(express.static('Public_Html'));

io.on('connection', (socket) => {
  // when the client emits 'donate', this listens and executes
  socket.on('donate', (msg) => {
    socket.broadcast.emit('donate', 'Receive donate');
  });
  socket.on('disconnect', () => {
    log('user disconnected');
  });
});

/////////////------------------------------------------------------------------
///Events///--------------------------------------------------------------------
///////////--------------------------------------------------------------------

function onConnectedHandler(addr, port) {
  ignoredUsers = constants.ignoredUsers;
  currentUsers = [];
  initializeAllModules();
  log(`Connected to Twitch on ${addr}:${port}`);
  //DEBUG-------------------------!!!!!!!!!!!!!!!!!!
  checkForViewerChanges();
  checkForStreamChanges();
  setInterval(checkForViewerChanges, VIEWER_UPDATE_INTERVAL * S_TO_MS);
  setInterval(checkForStreamChanges, STREAM_UPDATE_INTERVAL * S_TO_MS);
}

function checkForStreamChanges() {
  axios.get(constants.streamEndpoint, {
    headers: {
      'Client-ID': constants.options.clientId
    }
  }).then(response => {
    //console.log(response.data);
    if (response.data.data.length > 0) {
      streamObject = response.data[0] || response.data;
      //console.log("DATA:", streamObject);
      //  console.log(streamObj);
      if (!live) {
        log("Detected Stream Going Live");
        startStream(streamObject);
      } else {
        //AlreadyLive
      }
    } else {
      if (live) {
        log("Detected Stream Ending");
        endStream(streamObject);
      }
    }
  }).catch(err => {
    error("Checking stream for change failed. Failure in axios get.");
    error(err);
  });
}

function checkForViewerChanges() {
  axios.get(constants.chatterEndpoint).then(response => {
    //console.log( "-------------------------------------------" );
    let tmpUsers = response.data.chatters;
    gatherDifferences(lastUsers, tmpUsers).then((differences) => {
      let keys = Object.keys(differences.stay);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        for (let j = 0; j < differences.join[key].length; j++) {
          joinUser(differences.join[key][j], key);
        }
        for (let j = 0; j < differences.stay[key].length; j++) {
          stayUser(differences.stay[key][j], key);
        }
        for (let j = 0; j < differences.part[key].length; j++) {
          partUser(differences.part[key][j], key);
        }
      }
    });
    lastUsers = tmpUsers;

  }).catch(err => {
    error("Checking stream for viewer change. Failure in axios get.", err);
  });
}

function stayUser(username, userType) {
  if (ignoredUsers.includes(username)) {
    return;
  }
  //DATABASE CALL: UPDATE USER STAY
  database.get(constants.collectionUsers, {
    twitchID: username
  }).then((result) => {

    if (result.length > 0) {
      if (live) {
        database.update(constants.collectionUsers, {
          twitchID: username
        }, {
          $inc: {
            timeInStream: VIEWER_UPDATE_INTERVAL
          }
        });
        addPassiveCurrencyTo(username);
      }
    }
  }).catch((error) => {
    console.log("[ERROR]: (Botiun.js onStayHandler GET) Something went wrong! ");
    console.log(error);
  });
}

function addPassiveCurrencyTo(username) {
  /*database.update( constants.collectionUsers, {
    twitchID: username
  }, {
    $inc: {
      currency: CURRENCY_PER_INTERVAL,
      timeInStream: UPDATE_INTERVAL
    }
  } );*/
  //currency.addCurrencyToUserFrom(username, CURRENCY_PER_INTERVAL, 'passive');
}

function gatherDifferences(oldUsers, newUsers) {
  return new Promise(function(resolve, reject) {
    let stay = {};
    let join = {};
    let part = {};
    //Old and new must have the same keys
    let keys = Object.keys(newUsers);
    for (let i = 0; i < keys.length; i++) {
      stay[keys[i]] = [];
      join[keys[i]] = [];
      part[keys[i]] = [];
      let oldArr = oldUsers[keys[i]];
      let newArr = newUsers[keys[i]];
      if (oldArr != undefined) {
        for (let j = 0; j < oldArr.length; j++) {
          let oldUser = oldArr[j];
          if (newArr.includes(oldUser)) {
            stay[keys[i]].push(oldUser);
          } else {
            part[keys[i]].push(oldUser);
          }
        }
        for (let j = 0; j < newArr.length; j++) {
          let newUser = newArr[j];
          if (!oldArr.includes(newUser)) {
            join[keys[i]].push(newUser);
          }
        }
      }
    }
    var diff = {
      stay: stay,
      join: join,
      part: part
    };
    resolve(JSON.parse(JSON.stringify(diff)));
  });
}

//////////////////
///// JOIN //////
////////////////
function onJoinHandler(target, username, self) {
  JoinUser(username);
}

function joinUser(username, userType, userDetails) {
  if (ignoredUsers.includes(username)) {
    return;
  }
  if (!currentUsers.includes(username)) {
    currentUsers.push(username);
    if (live) {

      //DATABASE CALL: UPDATE VIEWER IN STREAM
      database.get(constants.collectionStreams, {
        current: true
      }).then((result) => {
        if (result.length > 0) {
          let tmpViewers = result[0].viewers;
          if (!tmpViewers.includes(username)) {
            tmpViewers.push(username);
          }

          database.update(constants.collectionStreams, {
            current: true
          }, {
            $set: {
              viewers: tmpViewers
            }
          });
        }
      });
    }


    let d = new Date();
    let dateString = d.getUTCDate().toString();

    log(`${username} has joined the channel`);

    //DATABASE CALL: UPDATE USER ON JOIN
    database.get(constants.collectionUsers, {
      twitchID: username
    }).then((result) => {
      if (result.length > 0) {
        updateLoad = {
          $set: {
            lastJoin: d
          }
        }
        console.log("Join Data:", username, userType);

        if (userType && userDetails) {
          if (userType.toLowerCase() === 'vips') {
            updateLoad['$set']['isVIP'] = true;
          }
          if (userType.toLowerCase() === 'sub' || userDetails.subscriber) {
            updateLoad['$set']['isSub'] = true;
          }
          if (userType.toLowerCase() === 'mod' || userType.toLowerCase() === 'moderator' || userDetails.mod) {
            updateLoad['$set']['isMod'] = true;
          }
        }

        database.update(constants.collectionUsers, {
          twitchID: username
        }, updateLoad);
      } else {
        let newUser = database.getNewUserTemplate();
        newUser.twitchID = username;
        newUser.lastJoin = d;

        //DATABASE CALL: CREATE USER
        database.insert(constants.collectionUsers, newUser);

        let newCurrency = database.getNewCurrencyProfile();
        newCurrency.twitchID = username;

        database.insert(constants.collectionCurrency, newCurrency);
      }
    }).catch((error) => {
      console.log(error);
      log("[ERROR]: (Botiun.js onJoinHandler GET) Something went wrong! ");
    });

    if (live) {
      greet.greetUser(username);
    }
  }
}

//////////////////
///// PART //////
////////////////
function onPartHandler(target, username, self) {
  partUser(username);
}

function partUser(username, userType) {
  if (ignoredUsers.includes(username)) {
    return;
  }

  if (currentUsers.includes(username)) {
    var updated = currentUsers.filter(function(value, index, arr) {
      return value != username;
    });
    currentUsers = updated;
  }

  let d = new Date();
  let dateString = d.getUTCDate().toString();
  log(`${username} has left the channel`);

  //DATABASE CALL: UPDATE USER ON PART
  database.update(constants.collectionUsers, {
    twitchID: username
  }, {
    $set: {
      lastPart: d
    }
  });
}

//////////////////
//// Message ////
////////////////

function onMessageHandler(target, context, msg, self) {
  if (self) {
    return;
  }

  if (context.username === 'streamelements') {
    let msgTokens = msg.split(' ');
    //log( "StreamElements sent a message" );
    if (msgTokens.includes("Orcs") && msgTokens.includes("Beefy") && msgTokens.includes("Negotiable")) {
      io.sockets.emit('orc', "/OrcDanceThankYouNext.mp3");
    }
  }

  var username = context['username'];
  //log( `Incoming message from ${username}: "${msg}"` );
  chat.recordChatMessage(context, msg);

  //console.log(context);
  if (live) {
    if (!currentUsers.includes[username]) {
      if (context.subscriber) {
        joinUser(username, "sub", context)
      }
      joinUser(username, 'viewers', context);
    }

    //DATABASE CALL: UPDATE MESSAGES FOR STREAM
    database.get(constants.collectionStreams, {
      current: true
    }).then((result) => {
      if (result.length > 0) {
        database.update(constants.collectionStreams, {
          current: true
        }, {
          $set: {
            messages: result[0].messages + 1,
            isSub: context.subscriber,
            isMod: context.mod
          }
        })
      }
    }).catch(() => {
      log("[ERROR]: (Botiun.js onMessageHandler GET) Something went wrong! ");
    });
  }

  var msgStripped = msg.trim();
  var msgTokens = msgStripped.split(' ');

  if (msgTokens[0].substring(0, 1) === '!') {
    //Is a command!
    //Strip the ! from the commands
    msgTokens[0] = msgTokens[0].substr(1, msgTokens[0].length);
    handleCommands(target, context, self, msgTokens);
  }
}

////////////////
///Functions///
//////////////

function startStream(streamData) {

  today = new Date();
  dateStamp = today.getFullYear() + '_' + (today.getMonth() + 1) + '_' + today.getDate();
  logFilename = constants.logDir + "Botiun_" + dateStamp + ".log";

  log("Starting Stream...");
  live = true;
  alertedUsers = [];
  let d = new Date();
  var newStreamEntry = database.getNewStreamTemplate();
  newStreamEntry.startTime = d;
  newStreamEntry.viewers = currentUsers;
  newStreamEntry.current = true;

  alertAllModulesToStreamStart();

  //DATABASE CALL: CREATE STREAM
  database.insert(constants.collectionStreams, newStreamEntry);
}

function endStream(streamData) {
  log("Ending Stream...");
  live = false;

  alertAllModulesToStreamEnd();

  //DATABASE CALL: UPDATE STREAM FOR END
  database.get(constants.collectionStreams, {
    current: true
  }).then((result) => {
    if (result.length > 0) {
      let d = new Date();
      let duration = Math.floor((d.getTime() - result[0].startTime) / 1000);

      database.update(constants.collectionStreams, {
        current: true
      }, {
        $set: {
          endTime: d,
          current: false,
          duration: duration
        }
      })
    }
  });
}

function initializeAllModules() {
  log('Initializing modules');
  for (i in modules) {
    modules[i].init().then((data) => {
      log(`${data.name} initialized`);
    });
  }
}

function alertAllModulesToStreamStart() {
  log('Stream starting modules');
  for (i in modules) {
    modules[i].start().then((data) => {
      log(`${data.name} started`);
    });
  }
}

function alertAllModulesToStreamEnd() {
  log('Stream endingg modules');
  for (i in modules) {
    modules[i].end().then((data) => {
      log(`${data.name} ended`);
    });
  }
}

function handleCommands(target, context, self, msgTokens) {
  var username = context['username'];
  for (i in modules) {
    if (modules[i].commands.includes(msgTokens[0].toLowerCase())) {
      //log( `Command "${msgTokens[0]}" registered from ${username}` );
      let userDetails = {
        username: username,
        isSuperUser: superUsers.includes(context['username'].toLowerCase()),
        isMod: context['mod'] === "true"
      };
      modules[i].handleCommand(userDetails, msgTokens);
      return;
    }
  }
  //log( `Command "${msgTokens[0]}" from ${username} is not a valid command` );
}

let ttsStart = 'tts';
let ttsEnd = '.wav';
let ttsCount = 0;
let ttsFile = ttsStart + ttsCount + ttsEnd;

module.exports.sendTTS = sendTTS = function(text, voice) {

  fs.unlink('./Sounds/' + ttsFile, (e) => {
    if (e) {
      error(e);
    }
    var say = require('say');
    let ttsVoice = voice || null;
    ttsFile = ttsStart + ttsCount + ttsEnd;

    say.export(text, ttsVoice, 1.0, './Sounds/' + ttsFile, (err) => {
      if (err) {
        error(err);
        return;
      }

      playSound('/' + ttsFile);
      ttsCount++;
    })
  })
}

module.exports.playSound = playSound = function(soundFileName) {
  //Check if sound exists
  emit('playSound', soundFileName);
}

module.exports.emit = emit = function(emitionCall, data) {
  io.sockets.emit(emitionCall, data);
}

module.exports.log = log = function(msg) {
  let d = new Date();
  let timeStamp = d.toTimeString().split(' ')[0];
  fs.appendFileSync(logFilename, timeStamp + ": " + msg + "\n");
  if (VERBOSE) {
    console.log(`[BOTIUN - LOG - ${timeStamp}]: ` + msg);
  }
}

module.exports.error = error = function(msg) {
  let d = new Date();
  let timeStamp = d.toTimeString().split(' ')[0];
  fs.appendFileSync(logFilename, timeStamp + ": " + msg + "\n");
  if (VERBOSE) {
    console.log(`[BOTIUN - ERROR - ${timeStamp}]: ` + msg);
  }
}

module.exports.sendMessage = sendMessage = function(msg, room) {
  if (allowedToPost) {
    if (!room) {
      room = rooms.main;
    }
    client.say(room, msg);
  } else {
    log(`Logged Message: ${msg}`);
  }
}

module.exports.sendMessageToUser = sendMessageToUser = function(user, msg, room) {
  if (allowedToPost) {
    if (!room) {
      room = rooms.main;
    }
    client.say(channel, `@${user}, ${msg}`);
  } else {
    log(`Logged Message: ${msg}`);
  }
}

module.exports.sendAction = sendAction = function(msg, room) {
  if (allowedToPost) {
    if (!room) {
      room = rooms.main;
    }
    client.action(msg);
  } else {
    log(`Logged Action: Botiun ${msg}`);
  }
}

module.exports.hasUser = hasUser = function(username) {
  return currentUsers.includes(username) || currentUsers.includes(username.toLowerCase());
}

module.exports.getCurrentUsers = getCurrentUsers = function() {
  return currentUsers;
}

//Console Input Handler
stdin.addListener("data", async function(d) {
  var msg = d.toString().trim();
  var msgStripped = msg.trim();
  var msgTokens = msgStripped.split(' ');
  if (msg === "play") {
    console.log("SENDING PLAY");
    io.sockets.emit('playSound', "/Welcome-Shrek.mp3");
  }
  if (msg === "playmod") {
    console.log("SENDING PLAY");
    io.sockets.emit('playSound', "/Welcome_imperial_march.mp3");
  }
  if (msg === "cantts") {
    canTTS = !canTTS;
    log("TTS is now " + canTTS);
  }

  if (['end'].includes(msgTokens[0].toLowerCase())) {
    endStream();
  }

  if (['start'].includes(msgTokens[0].toLowerCase())) {
    startStream();
  }

  if (['who'].includes(msgTokens[0].toLowerCase())) {
    log("Current Users:");
    log(currentUsers);
  }

  if (['tts'].includes(msgTokens[0].toLowerCase())) {
    sendTTS(msg.substr(4));
  }

  if (['say'].includes(msgTokens[0].toLowerCase())) {
    sendMessage(msg.substr(4));
  }

  if (['orc'].includes(msgTokens[0].toLowerCase())) {
    io.sockets.emit('orc', "/OrcDanceThankYouNext.mp3");
  }

  if (['top'].includes(msgTokens[0].toLowerCase())) {
    console.log(await se.getLeaderboard());
  }

  if (['vip'].includes(msgTokens[0].toLowerCase())) {
    //GET ELIGIBLE VIPS
    let leaderboard = await se.getLeaderboard();
    let users = [];
    await database.get(constants.collectionUsers, {
      $or: [{
        isVIP: true
      }, {
        isMod: true
      }]
    }).then((result) => {
      if (result.length > 0) {
        for (let i in result) {
          let user = result[i];
          users.push(user.twitchID);
        }
      }
    });

    for (let i in leaderboard) {
      let entry = leaderboard[i];
      if (users.includes(entry.username)) {
        leaderboard.splice(i, 1);
      }
    }

    //console.log(leaderboard)
    for (let i = 0; i < 5; i++) {
      console.log((i + 1) + ") " + leaderboard[i].username + ": " + leaderboard[i].points);
    }
  }

  if (['post'].includes(msgTokens[0].toLowerCase())) {
    allowedToPost = !allowedToPost;
    log(`Posting set to ${allowedToPost}`);
  }

  if (['todo'].includes(msgTokens[0].toLowerCase())) {
    console.log("Horse Racing\nSounds: 69, Lewd, Wilhelm, snakes, oof\nEntry animations\nF integration");

  }

  //Handle commandline input like it was a chat message
  if (msgTokens[0].substring(0, 1) === '!') {
    msgTokens[0] = msgTokens[0].substr(1, msgTokens[0].length);
    var context = {
      username: 'patiun',
      mod: 'true'
    };
    handleCommands(channel, context, null, msgTokens);
  }
});