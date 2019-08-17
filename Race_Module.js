const database = require( './Database.js' );
const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );
const currency = require( './Currency_Module.js' );

var name = "Race Module";
var commands = [ "load", "save", "new", "list", "make", "draw", "run", "finish" ];
var racesAllowed = false;
var horses = [];
var horseLookup = {};
var raceCount = 3;
var raceTickDuration = 1000; //MS
var races = [];
var activeRace;

function init() {
  return new Promise( function ( resolve, reject ) {

    loadAllHorsesFromDB();

    data = {
      name: name
    }
    resolve( data );
  } );
}

function start() {
  return new Promise( function ( resolve, reject ) {

    racesAllowed = true;
    console.log( "Races are now allowed to run" );

    data = {
      name: name
    }
    resolve( data );
  } );
}

function end() {
  return new Promise( function ( resolve, reject ) {

    racesAllowed = false;
    console.log( "Races are now NOT allowed to run" );
    forceEndRace();

    data = {
      name: name
    }
    resolve( data );
  } );
}

function handleCommand( userDetails, msgTokens ) {
  let command = msgTokens[ 0 ];
  switch ( command ) {
  case "load":
    loadAllHorsesFromDB();
    break;
  case "save":
    saveAllHorsesToDB();
    break;
  case "new":
    makeNewHorse( msgTokens[ 1 ] );
    break;
  case "list":
    console.log( horseLookup );
    break;
  case "make":
    prepareRaces();
    break;
  case "draw":
    raceDrawOdds();
    break;
  case "run":
    startRace();
    break;
  case "finish":
    endRace();
    break;
  default:
    botiun.log( `${command} was not handled properly in Race_Module.js` );
    break;
  }
}

//-----------------------------------------------------------------------------

function forceEndRace() {
  console.log( "[ALERT] Races have been forced to end." );
  endRace();
}

function prepareRaces() {
  let horseCount = horses.length;
  let horsesPerRace = horseCount / raceCount;
  console.log( `Horse Count: ${horseCount} | Horses Per Race: ${horsesPerRace} | Race Count: ${raceCount}` );

  //TODO Shuffle unusedHorses
  let unusedHorses = JSON.parse( JSON.stringify( horses ) );

  for ( let i = 0; i < raceCount; i++ ) {
    let newRace = {
      horses: [],
      places: [],
      started: false,
      finished: false
    };

    for ( let j = 0; j < horsesPerRace; j++ ) {
      newRace.horses.push( unusedHorses.pop() );
    }
    races.push( newRace );
  }

  console.log( races );
}

function setNextRace() {
  if ( races.length > 0 ) {
    activeRace = races.pop();
  } else {
    console.log( "[ALERT] No Races Left" );
    return;
  }
  console.log( activeRace );
}

function raceDrawOdds() {
  //// TEMP:
  setNextRace();
}

var tickCount = 0;
var maxTicks = 10;

function startRace() {
  if ( !activeRace ) {
    console.log( "[ALERT] There is no active race!" );
    return;
  }
  if ( activeRace.finished ) {
    console.log( "[ALERT] Race already finished!" );
    return;
  }
  if ( activeRace.started ) {
    console.log( "[ALERT] Race has already started!" );
    return;
  }

  activeRace.started = true;
  tickCount = 0;
  activeRace.interval = setInterval( raceTick, raceTickDuration );
}

function raceTick() {
  console.log( "TICK" );
  tickCount++;
  if ( tickCount >= maxTicks ) {
    endRace();
  }
}

function endRace() {
  if ( !activeRace ) {
    console.log( "[ALERT] No active race!" );
  }
  activeRace.finished = true;
  clearInterval( activeRace.interval );
  console.log( "Race is over! Winner: " + activeRace.horses[ 0 ].name );
}

//-----------------------Utility-----------------------------------------------

function loadAllHorsesFromDB() {
  database.get( constants.collectionHorses, {} ).then( ( results ) => {
    horses = results;
    botiun.log( "Horses loaded from Database" );
    for ( let i = 0; i < horses.length; i++ ) {
      let horseNameReduced = getHorseNameReduced( horses[ i ].name );
      horseLookup[ horseNameReduced ] = horses[ i ];
    }
  } );
}

function saveAllHorsesToDB() {
  for ( let i = 0; i < horses; i++ ) {
    saveHorseToDB( horses[ i ] );
  }
  console.log( "All Horses saved to Database" );
}

function saveHorseToDB( horse ) {
  database.update( constants.collectionHorses, {
    _id: horse._id
  }, horse );
}

function makeNewHorse( name, speed, gender ) {
  if ( horseExists( name ) ) {
    console.log( `Horse ${name} already exists!` );
    return;
  }
  if ( !name ) {
    console.log( "Horse creation requires a name" );
    return;
  }
  if ( !speed ) {
    speed = Math.floor( 50 + Math.random() * 50 );
  }
  if ( !gender ) {
    gender = ( Math.random() < 0.5 ) ? "M" : "F";
  }
  let newHorse = database.getNewHorseTemplate();
  newHorse.name = name;
  newHorse.speed = speed;
  newHorse.gender = gender;
  horses.push( newHorse );
  horseLookup[ getHorseNameReduced( name ) ] = newHorse;
  database.insert( constants.collectionHorses, newHorse );
  console.log( `${name} created` );
  return newHorse;
}

function horseExists( name ) {
  return ( Object.keys( horseLookup ).includes( getHorseNameReduced( name ) ) );
}

function getHorseNameReduced( name ) {
  let reducedName = name.trim().toLowerCase().replace( /\s/g, '_' );
  return reducedName;
}

//-----------------------------------------------------------------------------

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
}