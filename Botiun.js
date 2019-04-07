//Core Botiun Module
//Will handle all input logic and pass it to where it belongs
const tmi = require( 'tmi.js' );
const fs = require( 'fs' );
const process = require( 'process' );
const axios = require( 'axios' );
const constants = require( './Constants.js' );
const database = require( './Database.js' );

const VERBOSE = true;
const UPDATE_INTERVAL = 30; //Seconds
const S_TO_MS = 1000;
const CURRENCY_PER_INTERVAL = 1;
const modules = [];
const channel = "Patiun";
const superUsers = [ 'patiun' ];
var lastUsers = {
  broadcaster: [],
  vips: [],
  moderators: [],
  staff: [],
  admins: [],
  global_mods: [],
  viewers: []
};
var currentUsers = [];
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
//client.on( 'join', onJoinHandler );
//client.on( 'part', onPartHandler );

client.connect();

/////////////
///Events///
///////////

function onConnectedHandler( addr, port ) {
  ignoredUsers = constants.ignoredUsers;
  currentUsers = [];
  initializeAllModules();
  log( `Connected to Twitch on ${addr}:${port}` );
  //DEBUG-------------------------!!!!!!!!!!!!!!!!!!
  checkForViewerChanges();
  setInterval( checkForViewerChanges, UPDATE_INTERVAL * S_TO_MS );
}


function checkForViewerChanges() {
  axios.get( constants.chatterEndpoint ).then( response => {
    //console.log( "-------------------------------------------" );
    let tmpUsers = response.data.chatters;
    gatherDifferences( lastUsers, tmpUsers ).then( ( differences ) => {
      let keys = Object.keys( differences.stay );
      for ( let i = 0; i < keys.length; i++ ) {
        let key = keys[ i ];
        for ( let j = 0; j < differences.join[ key ].length; j++ ) {
          joinUser( differences.join[ key ][ j ] );
        }
        for ( let j = 0; j < differences.stay[ key ].length; j++ ) {
          stayUser( differences.stay[ key ][ j ] );
        }
        for ( let j = 0; j < differences.part[ key ].length; j++ ) {
          partUser( differences.part[ key ][ j ] );
        }
      }
    } );
    lastUsers = tmpUsers;

  } ).catch( error => {
    console.log( error );
  } );
}

function stayUser( username ) {
  if ( ignoredUsers.includes( username ) ) {
    return;
  }

  //log( `${username} is still in the channel` );

  database.get( constants.collectionUsers, {
    twitchID: username
  } ).then( ( result ) => {

    if ( result.length > 0 ) {
      let tmpUser = result[ 0 ];
      if ( tmpUser.currency === undefined ) {
        tmpUser.currency = 0;
      }
      if ( tmpUser.timeInStream === undefined ) {
        tmpUser.timeInStream = 0;
      }
      let updatedUser = {
        $set: {
          currency: tmpUser.currency + CURRENCY_PER_INTERVAL,
          timeInStream: tmpUser.timeInStream + UPDATE_INTERVAL
        }
      }
      database.update( constants.collectionUsers, {
        twitchID: username
      }, updatedUser );
    }
  } ).catch( () => {
    console.log( "[ERROR]: (Botiun.js onJoinHandler GET) Something went wrong! " );
  } );
}

function gatherDifferences( oldUsers, newUsers ) {
  return new Promise( function ( resolve, reject ) {
    let stay = {};
    let join = {};
    let part = {};
    //Old and new must have the same keys
    let keys = Object.keys( newUsers );
    for ( let i = 0; i < keys.length; i++ ) {
      stay[ keys[ i ] ] = [];
      join[ keys[ i ] ] = [];
      part[ keys[ i ] ] = [];
      let oldArr = oldUsers[ keys[ i ] ];
      let newArr = newUsers[ keys[ i ] ];
      if ( oldArr != undefined ) {
        for ( let j = 0; j < oldArr.length; j++ ) {
          let oldUser = oldArr[ j ];
          if ( newArr.includes( oldUser ) ) {
            stay[ keys[ i ] ].push( oldUser );
          } else {
            part[ keys[ i ] ].push( oldUser );
          }
        }
        for ( let j = 0; j < newArr.length; j++ ) {
          let newUser = newArr[ j ];
          if ( !oldArr.includes( newUser ) ) {
            join[ keys[ i ] ].push( newUser );
          }
        }
      }
    }
    var diff = {
      stay: stay,
      join: join,
      part: part
    };
    resolve( JSON.parse( JSON.stringify( diff ) ) );
  } );
}

//////////////////
///// JOIN //////
////////////////
function onJoinHandler( target, username, self ) {
  JoinUser( username );
}

function joinUser( username ) {
  if ( ignoredUsers.includes( username ) ) {
    return;
  }
  if ( !currentUsers.includes( username ) ) {
    currentUsers.push( username );
    if ( live ) {
      database.get( constants.collectionStreams, {
        current: true
      } ).then( ( result ) => {
        let tmpViewers = result[ 0 ].viewers;
        tmpViewers.push( username );
        database.update( constants.collectionStreams, {
          current: true
        }, {
          $set: {
            viewers: tmpViewers
          }
        } );
      } );
    }
  }


  let d = new Date();
  let dateString = d.getUTCDate().toString();

  log( `${username} has joined the channel` );
  database.get( constants.collectionUsers, {
    twitchID: username
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      database.update( constants.collectionUsers, {
        twitchID: username
      }, {
        $set: {
          lastJoin: d
        }
      } );
    } else {
      let newUser = database.getNewUserTemplate();
      newUser.twitchID = username;
      newUser.lastJoin = d;
      database.insert( constants.collectionUsers, newUser );
    }
  } ).catch( () => {
    console.log( "[ERROR]: (Botiun.js onJoinHandler GET) Something went wrong! " );
  } );
}

//////////////////
///// PART //////
////////////////
function onPartHandler( target, username, self ) {
  partUser( username );
}

function partUser( username ) {
  if ( ignoredUsers.includes( username ) ) {
    return;
  }

  if ( currentUsers.includes( username ) ) {
    var updated = currentUsers.filter( function ( value, index, arr ) {
      return value != username;
    } );
    currentUsers = updated;
  }

  let d = new Date();
  let dateString = d.getUTCDate().toString();
  log( `${username} has left the channel` );

  database.update( constants.collectionUsers, {
    twitchID: username
  }, {
    $set: {
      lastPart: d
    }
  } );
}

//////////////////
//// Message ////
////////////////

function onMessageHandler( target, context, msg, self ) {
  if ( self ) {
    return;
  }
  var username = context[ 'username' ];
  //log( `Incoming message from ${username}: "${msg}"` );

  //Add one to the message count
  database.get( constants.collectionUsers, {
    twitchID: username
  } ).then( ( result ) => {
    for ( let i = 0; i < result.length; i++ ) {
      let count = result[ i ].messages + 1;
      if ( count === undefined || isNaN( count ) ) {
        count = 1;
      }
      database.update( constants.collectionUsers, {
        twitchID: username
      }, {
        $set: {
          messages: count
        }
      } );
    }
  } ).catch( () => {
    console.log( "[ERROR]: (Botiun.js onMessageHandler GET) Something went wrong! " );
  } );

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

  let d = new Date();
  var newStreamEntry = database.getNewStreamTemplate();
  newStreamEntry.startTime = d;
  newStreamEntry.viewers = currentUsers;
  newStreamEntry.current = true;

  database.insert( constants.collectionStreams, newStreamEntry );
}

function endStream() {
  log( "Ending Stream..." );
  live = false;

  database.get( constants.collectionStreams, {
    current: true
  } ).then( ( result ) => {
    let d = new Date();
    let duration = Math.floor( ( d.getTime() - result[ 0 ].startTime ) / 1000 );

    database.update( constants.collectionStreams, {
      current: true
    }, {
      $set: {
        endTime: d,
        current: false,
        duration: duration
      }
    } )
  } );
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
    let d = new Date();
    console.log( `[BOTIUN - LOG - ${d.toTimeString().split(' ')[0]}]: ` + msg );
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

  if ( [ 'who' ].includes( msgTokens[ 0 ].toLowerCase() ) ) {
    log( "Current Users:" );
    log( currentUsers );
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