const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );
const database = require( './Database.js' );
const currency = require( './Currency.js' );

var commands = [ 'gamble', 'g', 'roulette' ];

function init() {
  console.log( "Gambling initiated!" );
  botiun.sendMessage( "Test Message" );
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
  currency.getCurrencyThen( userDetails.username, amount, ( requiredPoints ) => {
    console.log( requiredPoints );
    let spinNumber = Math.random() * 100;
    if ( spinNumber < constants.gambleChance ) {
      let reward = 2 * requiredPoints
      console.log( `Congrats! ${userDetails.username} has won ${reward} ${constants.currencyName} in gambling!` );
      currency.addCurrencyToUserFrom( userDetails.username, reward, 'gamble' );
    } else {
      console.log( `Oof! ${userDetails.username} has lost ${requiredPoints} ${constants.currencyName} in gambling!` );
      currency.addCurrencyToUserFrom( userDetails.username, -amount, 'gamble' );
    }
  } );
}

module.exports = {
  name: "Gambling Module",
  commands: commands,
  init: init,
  handleCommand: handleCommand
}