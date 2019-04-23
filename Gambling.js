const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );
const database = require( './Database.js' );
const currency = require( './Currency.js' );

var name = "Gambling Module";
var commands = [ 'gamble', 'g', 'roulette' ];

function init() {
  return new Promise( function ( resolve, reject ) {
    data = {
      name: name
    }
    resolve( data );
  } );
}

function handleCommand( userDetails, msgTokens ) {
  let command = msgTokens[ 0 ];
  switch ( command ) {
  case 'gamble':
  case 'g':
  case 'roulette':
    if ( msgTokens.length < 2 ) {
      botiun.sendMessageToUser( userDetails.username, `Proper use of the Gambling function is "!gamble [AMOUNT]"` );
      return;
    }
    gamble( userDetails, msgTokens[ 1 ] );
    break;
  }
}

function gamble( userDetails, amount ) {
  currency.getCurrencyThen( userDetails.username, amount, ( requiredPoints ) => {
    let spinNumber = Math.random() * 100;
    if ( spinNumber < constants.gambleChance ) {
      let reward = 2 * requiredPoints
      botiun.sendMessage( `Congrats! ${userDetails.username} has won ${reward} ${constants.currencyName} gambling!` );
      currency.addCurrencyToUserFrom( userDetails.username, reward, 'gamble' );
    } else {
      botiun.sendMessage( `Oof! ${userDetails.username} has lost ${requiredPoints} ${constants.currencyName} gambling!` );
      currency.addCurrencyToUserFrom( userDetails.username, -amount, 'gamble' );
    }
  } );
}

module.exports = {
  commands: commands,
  init: init,
  handleCommand: handleCommand
}