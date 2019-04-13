const database = require( './Database.js' );
const constants = require( './Constants.js' );

commands = [ 'points', 'plat', 'platinum', 'top', 'give' ];

function init() {
  console.log( "Currency initiated!" );
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
  case 'give':
    if ( msgTokens.length < 3 ) {
      return;
    }
    giveCurrencyTo( userDetails.username, msgTokens[ 1 ], msgTokens[ 2 ] );
    break;
  default:
    console.log( `${command} was not handled properly.` );
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
      console.log( username, `${target} has ${result[0].total} ${constants.currencyName}` );
    } else {
      console.log( `${target} is not a valid user` );
      return;
    }
  } )
}

function getcurrencyThen( username, amount, callback ) {
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

function giveCurrencyTo( username, target, amount ) {
  database.get( constants.collectionCurrency, {
    twitchID: target.toLowerCase()
  } ).then( ( result ) => {
    if ( result.length > 0 ) {
      getcurrencyThen( username, amount, ( requiredAmount ) => {
        addCurrencyToUserFrom( username, -requiredAmount, 'given' );
        addCurrencyToUserFrom( target.toLowerCase(), requiredAmount, 'given' );
        console.log( username, `gave ${target} ${requiredAmount} ${constants.currencyName}!` );
      } );
    } else {
      console.log( `${target} is not a valid user` );
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
    let msg = '';
    for ( let i = 0; i < countMax; i++ ) {
      msg += `${(i+1)}: ${result[i].twitchID} (${result[i].total}), `;
    }
    console.log( msg );
  } )
}

module.exports = {
  name: "Currency Module",
  getCurrencyThen: getcurrencyThen,
  commands: commands,
  init: init,
  handleCommand: handleCommand,
  addCurrencyToUserFrom: addCurrencyToUserFrom
}