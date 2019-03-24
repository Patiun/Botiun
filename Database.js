//Database handler that lets whatever application needed connect to the current database
const constants = require( './Constants.js' );

var MongoClient = require( 'mongodb' ).MongoClient;
var url = constants.databaseAddress;

async function getAsync( collection, query, projection ) {
  var data = [];
  let promise = new Promise( ( resolve, reject ) => {
    MongoClient.connect( url, function ( err, db ) {
      if ( err ) reject();
      var dbo = db.db( constants.databaseName );
      dbo.collection( collection ).find( query, projection ).toArray( function ( err, result ) {
        if ( err ) reject();
        console.log( result );
        data = result;
        db.close();
        resolve( result );
      } );
    } );
  } );
  await promise();
  return data;
}

function get( collection, query, projection ) {
  MongoClient.connect( url, function ( err, db ) {
    if ( err ) throw err;
    var dbo = db.db( constants.databaseName );
    dbo.collection( collection ).find( query, projection ).toArray( function ( err, result ) {
      if ( err ) throw err;
      console.log( result );
      db.close();
    } );
  } );
}

function insert( collection, newData ) {
  MongoClient.connect( url, function ( err, db ) {
    if ( err ) throw err;
    var dbo = db.db( constants.databaseName );
    dbo.collection( collection ).insertOne( newData, function ( err, res ) {
      if ( err ) throw err;
      console.log( "1 document inserted" );
      db.close();
    } );
  } );
}

function update( collection, query, newData ) {
  MongoClient.connect( url, function ( err, db ) {
    if ( err ) throw err;
    var dbo = db.db( constants.databaseName );
    dbo.collection( collection ).updateOne( query, newData, function ( err, res ) {
      if ( err ) throw err;
      console.log( "1 document updated" );
      db.close();
    } );
  } );
}

module.exports = {
  getAsync: getAsync,
  get: get,
  insert: insert,
  update: update
}