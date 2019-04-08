const database = require( './Database.js' );
const constants = require( './Constants.js' );

commands = [ 'points', 'plat' ];

function init() {

}

function handleCommand( userDetails, msgTokens ) {
  let command = msgTokens[ 0 ];
  switch ( command ) {
  case 'points':
  case 'plat':
    if ( msgTokens.lengt < 2 ) {
      return;
    }
    tellUserCurrencyFor( userDetails.username, msgTokens[ 1 ] );
    break;
  }
}

function addCurrencyToUserFrom( username, amount, source ) {
  let changeCategory = 'breakdown.gain.' + source;
  if ( amount < 0 ) {
    changeCategory = 'breakdown.lose.' + source;
  }

  let updateData = {
    $inc: {
      total: amount
    }
  };

  updateData.$inc[ `breakdown.net.${source}` ] = amount;
  updateData.$inc[ changeCategory ] = amount;

  database.update( constants.collectionCurrency, {
    twitchID: username
  }, updateData );
}

function tellUserCurrencyFor( username, target ) {
  if ( target === undefined ) {
    target = username;
  }
  database.get( constants.collectionCurrency, {
    twitchID: target
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      console.log( username, `${target} has ${result[0].total}` );
    } else {
      console.log( `${target} is not a valid user` );
      return;
    }
  } )
}

module.exports = {
  commands: commands,
  init: init,
  handleCommand: handleCommand,
  addCurrencyToUserFrom: addCurrencyToUserFrom
}