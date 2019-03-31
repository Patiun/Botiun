//Database handler that lets whatever application needed connect to the current database
const constants = require( './Constants.js' );

var MongoClient = require( 'mongodb' ).MongoClient;
var url = constants.databaseAddress;

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

function insert( collection, newData ) {
  MongoClient.connect( url, {
      useNewUrlParser: true
    },
    function ( err, db ) {
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
  MongoClient.connect( url, {
      useNewUrlParser: true
    },
    function ( err, db ) {
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
  get: get,
  insert: insert,
  update: update
}