const database = require( './Database.js' );
const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );
const currency = require( './Currency_Module.js' );

var name = "Race Module";
var commands = [ "load", "save", "new", "list" ];
var racesAllowed = false;
var horses = [];
var horseLookup = {};

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

    data = {
      name: name
    }
    resolve( data );
  } );
}

function end() {
  return new Promise( function ( resolve, reject ) {

    racesAllowed = false;

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
  default:
    botiun.log( `${command} was not handled properly in Race_Module.js` );
    break;
  }
}

//-----------------------------------------------------------------------------

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
    gender = ( Math.random() < 50 ) ? "M" : "F";
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