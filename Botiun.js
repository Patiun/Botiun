//Core Botiun Module
//Will handle all input logic and pass it to where it belongs
const tmi = require( 'tmi.js' );
const fs = require( 'fs' );
const process = require( 'process' );
const constants = require( './Constants.js' );
const database = require( './Database.js' );

const VERBOSE = true;
const modules = [];
const channel = "Patiun";
const superUsers = [ 'patiun' ];
var ignoredUsers = [];
var live = false;
const opts = {
  options: constants.options,
  identity: constants.identity,
  channels: constants.channels
}
const client = new tmi.client( opts );
var stdin = process.openStdin();

client.on( 'connected', onConnectedHandler );
client.on( 'message', onMessageHandler );
client.on( 'join', onJoinHandler );
client.on( 'part', onPartHandler );

client.connect();

/////////////
///Events///
///////////

function onConnectedHandler( addr, port ) {
  ignoredUsers = constants.ignoredUsers;
  initializeAllModules();
  log( `Connected to Twitch on ${addr}:${port}` );
}

function onJoinHandler( target, username, self ) {
  /*
  if ( ignoredUsers.includes( username ) || username === 'patiun' ) {
    return;
  }
  */
  log( `${username} has joined the channel` );
  database.get( constants.collectionUsers, {
    twitchID: username
  } );
}

function onPartHandler( target, username, self ) {
  log( `${username} has left the channel` );
}

function onMessageHandler( target, context, msg, self ) {
  if ( self ) {
    return;
  }
  var username = context[ 'username' ];
  log( `Incoming message from ${username}: "${msg}"` );

  var msgStripped = msg.trim();
  var msgTokens = msgStripped.split( ' ' );

  if ( msgTokens[ 0 ].substring( 0, 1 ) === '!' ) {
    //Is a command!
    //Strip the ! from the commands
    msgTokens[ 0 ] = msgTokens[ 0 ].substr( 1, msgTokens[ 0 ].length );
    handleCommands( target, context, self, msgTokens );
  }

  if ( username === 'streamelements' ) {
    //log( "StreamElements sent a message" );
  }
}

////////////////
///Functions///
//////////////

function startStream() {
  log( "Starting Stream..." );
  live = true;
}

function endStream() {
  log( "Ending Stream..." );
  live = false;
  //process.exit();
}

function initializeAllModules() {
  log( 'Initializing modules' );
  for ( i in modules ) {
    modules[ i ].init();
    log( `${modules[i].name} initialized` );
  }
  log( 'All modules intitialized' );
}

function handleCommands( target, context, self, msgTokens ) {
  var username = context[ 'username' ];
  for ( i in modules ) {
    if ( modules[ i ].commands.includes( msgTokens[ 0 ].toLowerCase() ) ) {
      //log( `Command "${msgTokens[0]}" registered from ${username}` );
      modules[ i ].handleCommand( username, superUsers.includes( context[ 'username' ].toLowerCase() ), context[ 'mod' ] === "true", msgTokens );
      return;
    }
  }
  log( `Command "${msgTokens[0]}" from ${username} is not a valid command` );
}

function log( msg ) {
  if ( VERBOSE ) {
    console.log( "[BOTIUN - LOG]: " + msg );
  }
}

function sendMessage( msg ) {
  client.say( channel, msg );
}

function sendMessageToUser( user, msg ) {
  client.say( channel, `@${user} ${msg}` );
}

function sendAction( msg ) {
  client.action( msg );
}

//Console Input Handler
stdin.addListener( "data", function ( d ) {
  var msg = d.toString().trim();
  var msgStripped = msg.trim();
  var msgTokens = msgStripped.split( ' ' );

  if ( [ 'end' ].includes( msgTokens[ 0 ].toLowerCase() ) ) {
    endStream();
  }

  if ( [ 'start' ].includes( msgTokens[ 0 ].toLowerCase() ) ) {
    startStream();
  }

  if ( [ 'say' ].includes( msgTokens[ 0 ].toLowerCase() ) ) {
    sendMessage( msg.substr( 4 ) );
  }

  //Handle commandline input like it was a chat message
  if ( msgTokens[ 0 ].substring( 0, 1 ) === '!' ) {
    msgTokens[ 0 ] = msgTokens[ 0 ].substr( 1, msgTokens[ 0 ].length );
    var context = {
      username: 'patiun',
      mod: 'true'
    };
    handleCommands( channel, context, null, msgTokens );
  }
} );

module.exports = {
  log: log,
  sendMessage: sendMessage,
  sendMessageToUser: sendMessageToUser,
  sendAction: sendAction
}