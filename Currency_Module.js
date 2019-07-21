const database = require( './Database.js' );
const constants = require( './Constants.js' );
const botiun = require( './Botiun.js' );

var name = "Currency Module";
var commands = [ 'points', 'plat', 'platinum', 'top', 'give', 'addpoints', 'reward' ];

function init() {
  return new Promise( function ( resolve, reject ) {
    data = {
      name: name
    }
    resolve( data );
  } );
}

function start() {
  return new Promise( function ( resolve, reject ) {
    data = {
      name: name
    }
    resolve( data );
  } );
}

function end() {
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
  case 'points':
  case 'plat':
  case 'platinum':
    if ( msgTokens.length < 2 ) {
      tellUserCurrencyFor( userDetails.username, userDetails.username );
      return;
    }
    tellUserCurrencyFor( userDetails.username, msgTokens[ 1 ] );
    break;
  case 'top':
    if ( msgTokens.length < 2 ) {
      listTop( userDetails.username, 'total' );
      return;
    }
    listTop( userDetails.username, msgTokens[ 1 ] );
    break;
  case 'addpoints':
  case 'reward':
    if ( !userDetails.isMod ) {
      return;
    }
    if ( msgTokens.length < 3 ) {
      botiun.sendMessageToUser( userDetails.username, `Proper usage of addPoints is "!addPoints [USERNAME] [AMOUNT]"` );
      return;
    }
    addCurrencyToUserFrom( msgTokens[ 1 ], msgTokens[ 2 ], 'rewarded', true );
  case 'give':
    if ( msgTokens.length < 3 ) {
      botiun.sendMessageToUser( userDetails.username, `Proper usage of Give is "!give [USERNAME] [AMOUNT]"` );
      return;
    }
    giveCurrencyTo( userDetails.username, msgTokens[ 1 ], msgTokens[ 2 ] );
    break;
  default:
    botiun.log( `${command} was not handled properly in Currency.js` );
    break;
  }
}

function addCurrencyToUserFrom( username, amount, source, messageFlag ) {
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

  if ( messageFlag ) {
    botiun.sendMessage( `${username} has been given ${amount} ${constants.currencyName}!` );
  }
}

function tellUserCurrencyFor( username, target ) {
  if ( target === undefined ) {
    target = username;
  }
  database.get( constants.collectionCurrency, {
    twitchID: target
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      botiun.sendMessageToUser( username, `${target} has ${result[0].total} ${constants.currencyName}` );
    } else {
      botiun.sendMessageToUser( username, `Hmmm it seems like ${target} is not a valid user.` );
      return;
    }
  } )
}

function getcurrencyThen( username, amount, callback ) {
  if ( amount.toLowerCase !== 'all' && isNaN( parseInt( amount ) ) ) {
    botiun.sendMessageToUser( username, `How about you enter a value that is a real positive number?` );
  }
  database.get( constants.collectionCurrency, {
    twitchID: username
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      let userPoints = result[ 0 ].total;
      let requiredAmount = parseInt( amount );
      if ( amount.toLowerCase() === 'all' ) {
        requiredAmount = userPoints;
      } else
      if ( amount.substr( amount.length - 1 ) === '%' ) {
        requiredAmount = Math.ceil( ( parseFloat( amount ) / 100 ) * userPoints );
      } else
      if ( amount.substr( amount.length - 1 ).toLowerCase() === 'k' ) {
        requiredAmount = parseInt( amount ) * 1000;
      }
      if ( requiredAmount <= userPoints ) {
        callback( requiredAmount );
      } else {
        botiun.sendMessageToUser( username, `Oh no! You only have ${userPoints} but need ${requiredAmount} to do that.` );
      }
    } else {
      botiun.log( `ERROR: No user found when checking currecy for ${username}` );
    }
  } );
}

function giveCurrencyTo( username, target, amount ) {
  database.get( constants.collectionCurrency, {
    twitchID: target.toLowerCase()
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      getcurrencyThen( username, amount, ( requiredAmount ) => {
        addCurrencyToUserFrom( username, -requiredAmount, 'given' );
        addCurrencyToUserFrom( target.toLowerCase(), requiredAmount, 'given' );
        botiun.sendMessage( `${username} gave ${target} ${requiredAmount} ${constants.currencyName}!` );
      } );
    } else {
      botiun.sendMessageToUser( username, `Hmmm it seems like ${target} is not a valid user.` );
    }
  } );
}

function listTop( username, topType ) {
  switch ( topType.toLowerCase() ) {
  case 'plat':
  case 'platinum':
  case 'points':
  case 'currency':
    listCurrency();
  default:
    listCurrency();
  }
}

function listCurrency() {
  database.getSorted( constants.collectionCurrency, {}, {
    total: -1
  } ).then( ( result ) => {
    let countMax = constants.topNumber;
    if ( result.length < countMax ) countMax = result.length;
    let msg = `The top ${countMax} in ${constants.currencyName}: `;
    for ( let i = 0; i < countMax; i++ ) {
      msg += `${(i+1)}. ${result[i].twitchID} (${result[i].total}), `;
    }
    botiun.sendMessage( msg );
  } )
}

module.exports = {
  getCurrencyThen: getcurrencyThen,
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
  addCurrencyToUserFrom: addCurrencyToUserFrom
}