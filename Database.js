//Database handler that lets whatever application needed connect to the current database
const constants = require( './Constants.js' );

var MongoClient = require( 'mongodb' ).MongoClient;
var url = constants.databaseAddress;

//////////////
//Base Functions
/////////////

function get( collection, query, projection ) {
  return new Promise( function ( resolve, reject ) {
    MongoClient.connect( url, {
      useNewUrlParser: true
    }, function ( err, db ) {
      var dbo = db.db( constants.databaseName );
      dbo.collection( collection ).find( query, projection ).toArray( function ( err, result ) {
        resolve( result );
        db.close();
      } );
    } );
  } );
}

function getSorted( collection, query, sorting, projection ) {
  return new Promise( function ( resolve, reject ) {
    MongoClient.connect( url, {
      useNewUrlParser: true
    }, function ( err, db ) {
      var dbo = db.db( constants.databaseName );
      dbo.collection( collection ).find( query, projection ).sort( sorting ).toArray( function ( err, result ) {
        resolve( result );
        db.close();
      } );
    } );
  } );
}

function insert( collection, newData ) {
  MongoClient.connect( url, {
      useNewUrlParser: true
    },
    function ( err, db ) {
      if ( err ) throw err;
      var dbo = db.db( constants.databaseName );
      dbo.collection( collection ).insertOne( newData, function ( err, res ) {
        if ( err ) throw err;
        //console.log( "1 document inserted" );
        db.close();
      } );
    } );
}

function update( collection, query, newData ) {
  MongoClient.connect( url, {
      useNewUrlParser: true
    },
    function ( err, db ) {
      if ( err ) throw err;
      var dbo = db.db( constants.databaseName );
      dbo.collection( collection ).updateOne( query, newData, function ( err, res ) {
        if ( err ) throw err;
        //console.log( "1 document updated" );
        db.close();
      } );
    } );
}

//////////////
//Special Functions
/////////////

//////////////
//Template Functions
//////////////

function getNewUserTemplate() {
  var userTemplate = {
    twitchID: "NONE",
    messages: 0,
    lastJoin: null,
    lastPart: null,
    timeInStream: 0,
    isSub: false,
    isVIP: false,
    isMod: false,
    isHappyPerson: false
  };

  return JSON.parse( JSON.stringify( userTemplate ) );
}

function getNewStreamTemplate() {
  var streamTemplate = {
    startTime: null,
    endTime: null,
    viewers: [],
    duration: 0,
    messages: 0,
    current: false
  }
  return JSON.parse( JSON.stringify( streamTemplate ) );
}

function getNewCurrencyProfile() {
  var currencyTemplate = {
    twitchID: "NONE",
    total: 0,
    breakdown: {
      net: {
        passive: 0,
        gamble: 0,
        race: 0,
        stock: 0,
        given: 0,
        rewarded: 0,
        spent: 0
      },
      gain: {
        passive: 0,
        gamble: 0,
        race: 0,
        stock: 0,
        given: 0,
        rewarded: 0,
        spent: 0
      },
      lose: {
        passive: 0,
        gamble: 0,
        race: 0,
        stock: 0,
        given: 0,
        rewarded: 0,
        spent: 0
      }
    },
    record: {
      gamble: {
        state: "NONE",
        streak: 0,
        lastUpdaed: null
      },
      race: {
        state: "NONE",
        streak: 0,
        lastUpdaed: null
      }
    }
  }

  return JSON.parse( JSON.stringify( currencyTemplate ) );
}

function getNewHorseTemplate() {
  var horseTemplate = {
    name: "NAME",
    speed: 0,
    age: 0
  }

  return JSON.parse( JSON.stringify( horseTemplate ) );
}

module.exports = {
  get: get,
  getSorted: getSorted,
  insert: insert,
  update: update,
  getNewUserTemplate: getNewUserTemplate,
  getNewStreamTemplate: getNewStreamTemplate,
  getNewCurrencyProfile: getNewCurrencyProfile,
  getNewHorseTemplate: getNewHorseTempalte
}