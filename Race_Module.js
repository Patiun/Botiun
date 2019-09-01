const database = require( './Database.js' );
const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );
const currency = require( './Currency_Module.js' );

var name = "Race Module";
var commands = [ "load", "save", "new", "list", "make", "draw", "run", "finish" ];
var racesAllowed = false;
var horses = [];
var horseLookup = {};
var raceCount = 2;
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
  //let horsesPerRace = horseCount / raceCount;
  let horsesPerRace = splitIntoParts( horseCount, raceCount );
  console.log( `Horse Count: ${horseCount} | Horses Per Race: ${horsesPerRace} | Race Count: ${raceCount}` );

  //TODO Shuffle unusedHorses
  let unusedHorses = JSON.parse( JSON.stringify( horses ) );
  shuffle( unusedHorses );

  for ( let i = 0; i < raceCount; i++ ) {
    let newRace = {
      horses: [],
      places: [],
      started: false,
      finished: false
    };
    for ( let j = 0; j < horsesPerRace[ i ]; j++ ) {
      let tempHorse = unusedHorses.pop();
      tempHorse.progress = 0;
      newRace.horses.push( tempHorse );
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

function advanceHorse( horse ) {
  if ( horse.progress >= 0 && horse.progress < 100 ) {
    let amount = ( horse.speed / ( ( Math.random() * 10 ) + 5 ) ) * ( Math.random() * 1.75 );
    horse.progress += ( amount );
  }
  if ( !activeRace.places.includes( horse ) && horse.progress >= 100 ) {
    console.log( `${horse.name} has finished!` );
    activeRace.places.push( horse );
  }
}

function raceTick() {
  tickCount++;

  shuffle( activeRace.horses );
  for ( let i = 0; i < activeRace.horses.length; i++ ) {
    advanceHorse( activeRace.horses[ i ] );
  }

  outputRaceState();

  if ( activeRace.places.length >= activeRace.horses.length ) {
    endRace();
    console.log( "Ticks: " + tickCount );
  }
}

function outputRaceState() {
  //SORT BASED ON PROGRESS
  activeRace.horses.sort( ( a, b ) => {
    return b.progress - a.progress;
  } );

  let outputList = [];
  for ( let i = 0; i < activeRace.horses.length; i++ ) {
    outputList.push( [ activeRace.horses[ i ].name, activeRace.horses[ i ].progress ] );
  }

  console.log( outputList );
}

function endRace() {
  if ( !activeRace ) {
    console.log( "[ALERT] No active race!" );
    return;
  }
  activeRace.finished = true;
  clearInterval( activeRace.interval );
  let winner = activeRace.places[ 0 ].name;
  console.log( "Race is over! Winner: " + winner );
  console.log( "In second: " + activeRace.places[ 1 ].name );
  console.log( "In third: " + activeRace.places[ 2 ].name );

  //Update Horse Winner
  let horse = horseLookup[ getHorseNameReduced( winner ) ];
  horse.record.raceWins++;
  saveHorseToDB( horse );

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
  }, {
    $set: horse
  } );
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
    speed = Math.floor( 50 + Math.random() * 20 );
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

function shuffle( array ) {
  array.sort( () => Math.random() - 0.5 );
}

function splitIntoParts( whole, parts ) {
  var partsArr = new Array( parts );
  var remain = whole;
  var partsLeft = parts;
  for ( let i = 0; partsLeft > 0; i++ ) {
    let size = Math.floor( ( remain + partsLeft - 1 ) / partsLeft );
    partsArr[ i ] = size
    remain -= size;
    partsLeft--;
  }
  return partsArr;
}

//-----------------------------------------------------------------------------

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
}