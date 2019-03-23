//Core Botiun Module
//Will handle all input logic and pass it to where it belongs
//const tmi = require( 'tmi.js' );
const fs = require( 'fs' );
const constants = require( './Constants.js' );
const database = require( './Database.js' );

console.log( "Botiun starting..." );
database.get( constants.collectionUsers );