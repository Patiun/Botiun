const fs = require( 'fs' );
const request = require( 'request' );
const rp = require( 'request-promise' );
const constants = require( './constants.js' );

// Define configuration options
const opts = {
  options: constants.options,
  identity: constants.identity,
  channels: constants.channels
};

const URL_BASE = "https://api.streamelements.com/kappa/v2/";

function getPointsForUser( user, callback ) {
  var url = URL_BASE + "points/" + constants.streamElementsAccountId + "/" + user;

  const options = {
    method: 'GET',
    url: url,
    json: true
  };

  var points = -1;

  rp( options ).then( function ( body ) {
    callback( body.points );
  } );
}

function updatePointsForUser( user, amount ) {
  var url = URL_BASE + "points/" + constants.streamElementsAccountId + "/" + user + "/" + amount;

  const options = {
    method: 'PUT',
    url: url,
    headers: {
      'content-type': 'Content-Type',
      accept: 'application/json',
      Authorization: "JWT " + constants.jwt
    }
  };

  request.put( options, function ( error, response, body ) {
    if ( error ) throw new Error( error );
  } );
}

module.exports = {
  getPointsForUser: getPointsForUser,
  updatePointsForUser: updatePointsForUser
}
