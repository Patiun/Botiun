const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );
const database = require( './Database.js' );
const currency = require( './Currency.js' );

var commands = [ 'gamble', 'g', 'roulette' ];

function init() {
  console.log( "Gambling initiated!" );
}

function handleCommand( userDetails, msgTokens ) {
  let command = msgTokens[ 0 ];
  switch ( command ) {
  case 'gamble':
  case 'g':
  case 'roulette':
    if ( msgTokens.length < 2 ) {
      console.log( "Invalid Command" );
      return;
    }
    gamble( userDetails, msgTokens[ 1 ] );
    break;
  case 'points':
    break;
  }
}

function gamble( userDetails, amount ) {
  getPointsThen( userDetails.username, amount, ( requiredPoints ) => {
    currency.addCurrencyToUserFrom( userDetails.username, -amount, 'gambling' );
    console.log( requiredPoints );
    let spinNumber = Math.random() * 100;
    if ( spinNumber < constants.gambleChance ) {
      let reward = 2 * requiredPoints
      console.log( `Congrats! ${userDetails.username} has won ${reward} in gambling!` );
      currency.addCurrencyToUserFrom( userDetails.username, reward, 'gambling' );
    } else {
      console.log( `Oof! ${userDetails.username} has lost ${requiredPoints} in gambling!` );
    }
  } );
}

function getPointsThen( username, amount, callback ) {
  if ( isNaN( parseInt( amount ) ) ) {
    console.log( `${amount} is not a number` );
  }
  database.get( constants.collectionCurrency, {
    twitchID: username
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      let userPoints = result[ 0 ].total;
      let requiredAmount = parseInt( amount );
      if ( amount.substr( amount.length - 1 ) === '%' ) {
        requiredAmount = Math.ceil( ( parseFloat( amount ) / 100 ) * userPoints );
      } else
      if ( amount.substr( amount.length - 1 ).toLowerCase() === 'k' ) {
        requiredAmount = parseInt( amount ) * 1000;
      }
      if ( requiredAmount <= userPoints ) {
        callback( requiredAmount );
      } else {
        console.log( `${username} only has ${userPoints} but needs ${requiredAmount}` );
      }
    } else {
      console.log( "No user found" );
    }
  } );
}

function gamblePercentage( userDetails, percentage ) {

}

module.exports = {
  commands: commands,
  init: init,
  handleCommand: handleCommand
}