const database = require('./Database.js');
const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const currency = require('./Currency_Module.js');
const accept = require('./Accept_Module.js');
const uuid = require('uuid/v1');
const fs = require('fs');

var name = "Race Module";
var commands = ["testrace", "load", "save", "new", "list", "make", "draw", "run", "finish", "claim", "racebet", "placebet", "auto", "gen", "odds", "time", "buystock", "inspect", "checkstock", "sellstock"];
var racesAllowed = false;
var racersLoaded = false;
var canBet = false;
var canPostMessages = false;
var auto = false;
var oddsLookup = {};
var bets = [];
var probabilityOffset = 0.1;
var horses = [];
var horseLookup = {};
var raceCount = 4;
var raceTickPerSec = 60; //24;
var raceTickDuration = 1000 / raceTickPerSec; //100; //MS
var staminaDrain = 100;
var maxWildGain = 12.5;
var races = [];
var derby;
var countTopRacesForDerby = 2;
var activeRace;
var unclaimedPayouts = {};
var raceBets = {};
var payoutTimeoutDuration = 1000 * 1 //60 * 60; //60 Minutes
var timeBetweenRaces = 1000 * 60 * 1 //30; //30 Minutes
var timeBeforeNextDrawing = 10 * 1000; //20s
var timeBeforeRunning = 5 * 1000; //20s
var timers = {};
var timing = {
  nextRaceStart: 0,
  raceStart: 0,
  raceEnd: 0,
  raceElapsed: 0
}

function init() {
  return new Promise(function(resolve, reject) {

    botiun.emit('raceClear');
    loadAllHorsesFromDB();

    try {
      if (fs.existsSync("Public_Html/odds.json")) {
        oddsLookup = JSON.parse(fs.readFileSync("Public_Html/odds.json"));
        //console.log(oddsLookup);
      } else {
        console.log(`Error: Public_Html/odds.json does not exist.`);
      }
    } catch (error) {
      botiun.error(error);
    }

    data = {
      name: name
    }
    resolve(data);
  });
}

function start() {
  return new Promise(function(resolve, reject) {

    racesAllowed = true;
    console.log("Races are now allowed to run");

    auto = true;
    prepareRaces();

    data = {
      name: name
    }
    resolve(data);
  });
}

function end() {
  return new Promise(function(resolve, reject) {

    racesAllowed = false;
    console.log("Races are now NOT allowed to run");
    forceEndRace();

    data = {
      name: name
    }
    resolve(data);
  });
}

function handleCommand(userDetails, msgTokens) {
  let command = msgTokens[0].toLowerCase();
  switch (command) {
    case "load":
      loadAllHorsesFromDB();
      break;
    case "save":
      saveAllHorsesToDB();
      break;
    case "new":
      makeNewHorse(msgTokens[1]);
      break;
    case "list":
      listAllHorses();
      break;
    case "make":
      prepareRaces();
      break;
    case "draw":
      setNextRace();
      break;
    case "run":
      startRace();
      break;
    case "finish":
      endRace();
      break;
    case "claim":
      claimWinnings(userDetails.username);
      break;
    case "placebet":
    case "racebet":
      let amount = msgTokens[1];
      placeBetOn(userDetails.username, amount, msgTokens);
      break;
    case "auto":
      auto = true;
      prepareRaces();
      break;
    case "gen":
      generateHorses();
      break;
    case "odds":
      sendRaceOdds();
      break;
    case "time":
      getTimeToNextRace();
      break;
    case "buystock":
      if (msgTokens.length >= 3) {
        buyStockIn(userDetails.username, msgTokens[1], msgTokens[2]);
      }
      break;
    case "sellstock":
      if (msgTokens.length === 3) {
        sellStockIn(userDetails.username, msgTokens[1], msgTokens[2], 'botiun');
      }
      if (msgTokens.length === 5) {
        sellStockIn(userDetails.username, msgTokens[1], msgTokens[2], msgTokens[3], msgTokens[4]);
      }
      break;
    case "inspect":
      if (msgTokens.length >= 2) {
        let horseName = msgTokens[1];
        inspectHorse(userDetails.username, horseName);
      }
      break;
    case "checkstock":
      checkRaceStockFor(userDetails.username);
      break;
    case "testrace":
      if (userDetails.username === 'patiun') {
        let horse1 = msgTokens[1];
        let horse2 = msgTokens[2];
        let horse3 = msgTokens[3] || null;
        let horse4 = msgTokens[4] || null;

        let fakePlaces = [null, null, null, null];
        for (i in activeRace.horses) {
          if (getHorseNameReduced(horse1) === getHorseNameReduced(activeRace.horses[i].name)) {
            fakePlaces[0] = activeRace.horses[i]
          }
          if (getHorseNameReduced(horse2) === getHorseNameReduced(activeRace.horses[i].name)) {
            fakePlaces[1] = activeRace.horses[i]
          }
          if (horse3) {
            if (getHorseNameReduced(horse3) === getHorseNameReduced(activeRace.horses[i].name)) {
              fakePlaces[2] = activeRace.horses[i]
            }
          }
          if (horse4) {
            if (getHorseNameReduced(horse4) === getHorseNameReduced(activeRace.horses[i].name)) {
              fakePlaces[3] = activeRace.horses[i]
            }
          }
        }

        handleBetPayouts(fakePlaces);
      }
      break;
    default:
      botiun.log(`${command} was not handled properly in Race_Module.js`);
      break;
  }
}

//-----------------------------------------------------------------------------

function forceEndRace() {
  console.log("[ALERT] Races have been forced to end.");
  if (activeRace) {
    startRace();
    auto = false;
  }
}

function prepareRaces() {
  if (!racersLoaded) {
    console.log("Racers are not loaded from the DB!");
    return;
  }
  let horseCount = horses.length;
  //let horsesPerRace = horseCount / raceCount;
  let horsesPerRace = splitIntoParts(horseCount, raceCount);
  //console.log(`Horse Count: ${horseCount} | Horses Per Race: ${horsesPerRace} | Race Count: ${raceCount}`);

  //TODO Shuffle unusedHorses
  let unusedHorses = JSON.parse(JSON.stringify(horses));
  shuffle(unusedHorses);

  races = [];
  for (let i = 0; i < raceCount; i++) {
    let newRace = {
      horses: [],
      places: [],
      started: false,
      finished: false,
      isDerby: false
    };
    for (let j = 0; j < horsesPerRace[i]; j++) {
      let tempHorse = unusedHorses.pop();
      tempHorse.progress = 0;
      tempHorse.place = -1;
      tempHorse.stamina = 100;
      tempHorse.dayMod = ((Math.random() + Math.random()) / 2) * 0.3 + 0.8;
      newRace.horses.push(tempHorse);
    }
    races.push(newRace);
  }

  derby = {
    horses: [],
    places: [],
    started: false,
    finished: false,
    isDerby: true
  };

  //console.log(races);
  if (auto) {
    setNextRace();
  }
}

function setNextRace() {
  if (races.length > 0) {
    activeRace = races.pop();
  } else {
    if (activeRace && !activeRace.isDerby) {
      //console.log("---------------------DERBY-PREP-----------------");
      for (let i = 0; i < derby.horses.length; i++) {
        //console.log(derby.horses[i].name + ": " + derby.horses[i].stamina + " = " + derby.horses[i].dayMod);
      }
      activeRace = derby;
    } else {
      console.log("[ALERT] No Races Left");
      if (auto) {
        prepareRaces();
      }
      return;
    }
  }
  //raceDrawOdds();
  //console.log(activeRace);
  //botiun.emit('racePrepare', populateRaceOverlay());
  if (auto) {
    raceDrawOdds();
  }
}

let derbyMod = 5;

function raceDrawOdds() {
  //// TEMP:
  let totalWins = activeRace.horses.length;
  for (let i = 0; i < activeRace.horses.length; i++) {
    totalWins += 1 + activeRace.horses[i].record.raceWins + derbyMod * activeRace.horses[i].record.derbyWins;
  }

  let roughOdds = {};
  let chanceTotal = 0;
  for (let i = 0; i < activeRace.horses.length; i++) {
    let chance = 0;
    chance = 1 + activeRace.horses[i].record.derbyWins + derbyMod * activeRace.horses[i].record.raceWins;
    roughOdds[getHorseNameReduced(activeRace.horses[i].name)] = [chance, totalWins, chance / totalWins];
    chanceTotal += chance / totalWins;

    let probability = chance / totalWins;
    let bestChance = "1";

    for (strChance in oddsLookup) {
      let oddsChance = parseFloat(strChance);
      if (oddsChance >= probability + probabilityOffset) {
        bestChance = strChance;
      } else {
        break;
      }
    }

    activeRace.horses[i].odds = oddsLookup[bestChance];
    activeRace.horses[i].odds.raw = probability;
  }

  /*
    for (i in activeRace.horses) {
      let horse = activeRace.horses[i];
      console.log(horse.name, horse.odds);
    }*/
  canBet = true;

  if (activeRace.isDerby) {
    botiun.sendMessage('Derby odds have been drawn!');
  } else {
    botiun.sendMessage('Race odds have been drawn!');
  }
  sendRaceOdds();

  waitForRaceToStart();
}

function showRace() {
  botiun.emit('racePrepare', populateRaceOverlay());

  timers.nextRace = setTimeout(() => {
    startRace();
  }, timeBeforeRunning);
}

function waitForRaceToStart() {
  timing.nextRaceStart = (new Date()).getTime() + timeBetweenRaces;
  timers.nextRace = setTimeout(() => {
    showRace();
  }, timeBetweenRaces);
}

var tickCount = 0;

function startRace() {
  if (!activeRace) {
    console.log("[ALERT] There is no active race!");
    return;
  }
  if (activeRace.finished) {
    console.log("[ALERT] Race already finished!");
    return;
  }
  if (activeRace.started) {
    console.log("[ALERT] Race has already started!");
    return;
  }

  activeRace.started = true;
  clearTimeout(timers.nextRace);
  tickCount = 0;
  if (activeRace.isDerby) {
    console.log('---------------------DERBY---------------------');
  } else {
    console.log('---------------------RACE----------------------');
  }
  timing.raceStart = new Date();
  activeRace.interval = setInterval(raceTick, raceTickDuration);
  canBet = false;
}

function advanceHorse(horse) {
  if (horse.progress >= 0 && horse.progress < 100) {
    //let amount = (horse.speed / ((Math.random() * 15) + 45)) * ((Math.random() * 0.4) + 0.35);
    let wildness = (horse.wildness / 100);
    let avgGainUnModed = (((horse.speed) / 10 + wildness) / raceTickPerSec) * horse.dayMod;
    //Adjust avgGain for stamina drain
    let avgGain = avgGainUnModed * (horse.stamina / 100 * 0.5 + 0.5);
    let gain = avgGain + (maxWildGain / raceTickPerSec) * ((Math.random() + Math.random()) / 2 * (wildness) - (wildness) / 2);
    if (gain > avgGainUnModed) {
      horse.stamina -= (staminaDrain / raceTickPerSec) * ((gain - avgGainUnModed) / avgGainUnModed);
      if (horse.stamina < 0) {
        horse.stamina = 0;
      }
    } else {
      horse.stamina += (staminaDrain * 0.6) / raceTickPerSec * ((avgGainUnModed - gain) / avgGainUnModed);
      if (horse.stamina > 100) {
        horse.stamina = 100;
      }
    }
    horse.progress += (gain);
  }
  if (!activeRace.places.includes(horse) && horse.progress >= 100) {
    //console.log(`${horse.name} has finished!`);
    activeRace.places.push(horse);
    if (activeRace.places.length >= 1) {
      horse.place = activeRace.places.length;
    }
  }
}

function raceTick() {
  tickCount++;

  shuffle(activeRace.horses);
  for (let i = 0; i < activeRace.horses.length; i++) {
    advanceHorse(activeRace.horses[i]);
  }

  outputRaceState();

  if (activeRace.places.length >= activeRace.horses.length) {
    endRace();
    console.log("Ticks: " + tickCount);
  }
}

function outputRaceState() {
  activeRace.horses.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    } else {
      return 0;
    }
  });

  let outputList = [];
  for (let i = 0; i < activeRace.horses.length; i++) {
    outputList.push([activeRace.horses[i].name, activeRace.horses[i].progress]);
  }

  //console.log(outputList);
  botiun.emit('raceUpdate', populateRaceOverlay());
}

function endRace() {
  if (!activeRace) {
    console.log("[ALERT] No active race!");
    return;
  }
  activeRace.finished = true;
  clearInterval(activeRace.interval);
  let winner = activeRace.places[0].name;
  //console.log("Race is over! Winner: " + winner);
  //console.log("In second: " + activeRace.places[1].name);
  //console.log("In third: " + activeRace.places[2].name);

  //Update Horse Winner
  if (activeRace.isDerby) {
    for (let i = 0; i < activeRace.places.length; i++) {
      let tmpHorse = horseLookup[getHorseNameReduced(activeRace.places[i].name)];
      if (i == 0) {
        tmpHorse.record.derbyWins++;
      }
      tmpHorse.record.derbies++;
      saveHorseToDB(tmpHorse);
    }
  } else {
    for (let i = 0; i < activeRace.places.length; i++) {
      let tmpHorse = horseLookup[getHorseNameReduced(activeRace.places[i].name)];
      if (i == 0) {
        activeRace.places[i].record.raceWins++;
        tmpHorse.record.raceWins++;
      }
      activeRace.places[i].record.races++;
      tmpHorse.record.races++;
      saveHorseToDB(tmpHorse);
    }

    //Add top horses to derby
    for (let i = 0; i < countTopRacesForDerby; i++) {
      activeRace.places[i].progress = 0;
      activeRace.places[i].place = -1;
      derby.horses.push(activeRace.places[i]);
      console.log(activeRace.places[i].name + " qualified for the Derby!");
    }
  }
  stockPayOut(activeRace.places[0]);
  setTimeout(() => {
    botiun.emit('raceClear');
    if (auto) {
      setNextRace();
    }
  }, timeBeforeNextDrawing); //Seconds until clear

  //Payout Bets
  canBet = false;
  handleBetPayouts(activeRace.places).then(() => {
    bets = [];
  });

  timing.raceEnd = new Date();
  timing.raceElapsed = timing.raceEnd - timing.raceStart;
  console.log("Race took " + timing.raceElapsed / 1000 + "s");
}

function handleBetPayouts(places) {
  return new Promise((resolve, reject) => {
    for (i in bets) {
      let bet = bets[i];
      switch (bet.type) {
        case 'win':
          if (bet.targets.includes(places[0].name) || bet.targets.includes(getHorseNameReduced(places[0].name))) {
            betPayout(bet);
          }
          break;
        case 'place':
          let placedHorses = [];
          for (let i = 0; i < 2; i++) {
            placedHorses.push(places[i].name);
            placedHorses.push(getHorseNameReduced(places[i].name));
          }
          for (i in bet.targets) {
            let horseName = bet.targets[i];
            if (placedHorses.includes(horseName)) {
              betPayout(bet);
            }
          }
          break;
        case 'show':
          let shownHorses = [];
          for (let i = 0; i < 3; i++) {
            shownHorses.push(places[i].name);
            shownHorses.push(getHorseNameReduced(places[i].name));
          }
          for (i in bet.targets) {
            let horseName = bet.targets[i];
            if (shownHorses.includes(horseName)) {
              betPayout(bet);
            }
          }
          break;
        case 'exacta':
          if ((bet.targets[0] === places[0].name || bet.targets[0] === getHorseNameReduced(places[0].name)) && (bet.targets[1] === places[1].name || bet.targets[1] === getHorseNameReduced(places[1].name))) {
            betPayout(bet);
          }
          break;
        case 'trifecta':
          if ((bet.targets[0] === places[0].name || bet.targets[0] === getHorseNameReduced(places[0].name)) && (bet.targets[1] === places[1].name || bet.targets[1] === getHorseNameReduced(places[1].name)) && (bet.targets[2] === places[2].name || bet.targets[2] === getHorseNameReduced(places[2].name))) {
            betPayout(bet);
          }
          break;
        case 'superfecta':
          if ((bet.targets[0] === places[0].name || bet.targets[0] === getHorseNameReduced(places[0].name)) && (bet.targets[1] === places[1].name || bet.targets[1] === getHorseNameReduced(places[1].name)) && (bet.targets[2] === places[2].name || bet.targets[2] === getHorseNameReduced(places[2].name)) && (bet.targets[3] === places[3].name || bet.targets[3] === getHorseNameReduced(places[3].name))) {
            betPayout(bet);
          }
          break;
        case 'quinella':
          if ((bet.targets[0] === places[0].name || bet.targets[0] === getHorseNameReduced(places[0].name) || bet.targets[0] === places[1].name || bet.targets[0] === getHorseNameReduced(places[1].name)) && (bet.targets[1] === places[0].name || bet.targets[1] === getHorseNameReduced(places[0].name) || bet.targets[1] === places[1].name || bet.targets[1] === getHorseNameReduced(places[1].name))) {
            betPayout(bet);
          }
          break;
      }
    }
    resolve();
  })
}

function betPayout(bet) {
  let user = bet.user;
  let winnings = Math.floor(bet.amount * bet.payout + bet.amount);

  if (botiun.hasUser(user)) {
    botiun.sendMessage(`${user} has won ${winnings} ${constants.currencyName} for betting on ${bet.targets}!`);
    currency.addCurrencyToUserFrom(bet.user, bet.amount * bet.payout + bet.amount, "race");
  } else {
    botiun.log(`${user} is not here so their ${winnings} ${constants.currencyName} is waiting for them.`);
    addUnclaimedWinnings(user, winnings, "race", bet.targets);
  }
}

function stockPayOut(horse) {
  let stockWin = (activeRace.isDerby) ? 10000 : 1000;
  for (let i = 0; i < Object.keys(horse.stock).length; i++) {
    let user = Object.keys(horse.stock)[i];
    let winnings = Math.floor(horse.stock[user] / 100 * stockWin);
    if (botiun.hasUser(user)) {
      botiun.sendMessage(`${user} has won ${winnings} ${constants.currencyName} for stock in ${horse.name}!`);
      currency.addCurrencyToUserFrom(user, winnings, "stock");
    } else {
      botiun.sendMessage(`${user} is not here so their ${winnings} ${constants.currencyName} is waiting for them.`);
      addUnclaimedWinnings(user, winnings, "stock", horse.name);
    }
  }
}

function addUnclaimedWinnings(user, amount, source, horseName) {
  let usersWithUnclaimedPayouts = Object.keys(unclaimedPayouts);

  let unclaimedWinning = {
    id: uuid(),
    amount: amount,
    source: source,
    horseName: horseName,
    timer: setTimeout(function() {
      for (let i = 0; i < unclaimedPayouts[user].length; i++) {
        let payout = unclaimedPayouts[user][i];
        if (payout.id === this.id) {
          unclaimedPayouts[user] = unclaimedPayouts[user].splice(i, 1);
          console.log("Payout for " + user + " timed out.");
          return;
        }
      }
    }, payoutTimeoutDuration)
  }

  if (usersWithUnclaimedPayouts.includes(user)) {
    unclaimedPayouts[user].push(unclaimedWinning);
  } else {
    unclaimedPayouts[user] = [unclaimedWinning];
  }
}

function claimWinnings(user) {
  let winnings = unclaimedPayouts[user];
  if (winnings && winnings.length > 0) {
    let amount = 0;
    let message = " from";
    clearTimeout(winnings.timer);
    for (let i = 0; i < winnings.length; i++) {
      let unclaimed = winnings[i];
      amount += unclaimed.amount;
      if (i == winnings.length - 1 && i > 0) {
        message += " and";
      }
      if (unclaimed.source === "race") {
        message += ` a bet on ${unclaimed.horseName}`;
      } else {
        message += ` ${unclaimed.source} in ${unclaimed.horseName}`;
      }
      if (i != winnings.length - 1) {
        message += ",";
      }
      currency.addCurrencyToUserFrom(user, unclaimed.amount, unclaimed.source);
    }
    console.log(user + " has claimed " + amount + message);
    unclaimedPayouts[user] = [];
  } else {
    console.log(`${user} does not have any unclaimed winnings`);
    return;
  }
}

function placeBetOn(user, amount, horseParams) {
  if (!activeRace) {
    botiun.sendMessageToUser(user, "There is no race running right now, please try again later.");
    return;
  }
  if (!canBet) {
    botiun.sendMessageToUser(user, "Betting is currently closed.");
    return;
  }

  console.log("[DEBUG] Trying to place bet for " + amount + " on [" + horseParams + "]");

  if (!horseParams && horseParams.length > 0) {
    console.log("Invalid horseParams");
    return;
  }

  if (amount.toLowerCase() != 'all' && isNaN(amount)) {
    botiun.sendMessage('Proper usage of PlaceBet is "!placebet [AMOUNT] [BETTING TARGET]"');
    return;
  }

  currency.getCurrencyThen(user, amount, (result) => {
    //console.log("[!!!] " + result);
    //Win - Comes in first
    if (horseParams.length === 3) {
      //DEFAULT CASE
      let horseNameWin = horseParams[2];
      placeBetWin(user, result, horseNameWin)
      /*
      console.log(horseNameWin);
      if (horseInRace(horseNameWin)) {
        bets.push(makeBet(user, result, 'win', [horseParams[2]]));
      } else if (horseNameWin.toLowerCase() === 'all') {
        let amountPer = Math.floor(result / activeRace.horses.length);
        for (i in activeRace.horses) {
          horseNameWin = activeRace.horses[i].name;
          currency.addCurrencyToUserFrom(user, -result, "race");
          bets.push(makeBet(user, amountPer, 'win', [horseNameWin]));
        }
        console.log("Bets placed on all horses for: " + amountPer);
      } else {
        console.log("[ERROR] Horse not in race: " + horseNameWin);
        botiun.sendMessageToUser(user, `${horseNameWin} is not in this race.`);
      }
      */
    } else if (horseParams.length > 3) {
      const betType = horseParams[2].toLowerCase();
      switch (betType) {
        case 'win':
          //Win - Comes in first
          placeBetWin(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'place':
          //place - Comes in first or second
          placeBetPlace(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'show':
          //Show - Comes in first, second, or third
          placeBetShow(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'across':
        case 'board':
        case 'acrosstheboard':
          //Across the board - Win, Place, and Show bet
          placeBetAcross(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'exacta':
          //Exacta - wager on two horses to finish first and second in the same race in an exact order.
          placeBetExacta(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'trifecta':
        case 'tri':
          //Trifecta - wager on three horses to finish in first, second and third in the same race in an exact order.
          placeBetTrifecta(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'superfecta':
        case 'super':
          //Superfecta - wager on four horses to finish first, second, third and fourth in an exact order.
          placeBetSuperfecta(user, result, horseParams.slice(3, horseParams.length));
          break;
        case 'quinella':
          //Quinella - wager on two horses to finish first and second in the same race, in any order.
          //botiun.sendMessageToUser(user, `We are sorry to report that ${betType} betting is not online yet.`);
          placeBetQuinella(user, result, horseParams.slice(3, horseParams.length));
          break;
        default:
          botiun.sendMessageToUser(user, "Apologies, but more complicated betting is not suported yet.");
          break;
      }
    } else {
      console.log("HorseParams not 3: " + horseParams.length);
      botiun.sendMessageToUser(user, "Proper usage of PlaceBet is !placebet [AMOUNT] [BETTING PARAMETERS]");
    }
    //place - Comes in first or second
    //Show - Comes in first, second, or third
    //Across the board - Win, Place, and Show bet
    //Exacta - wager on two horses to finish first and second in the same race in an exact order.
    //Trifecta - wager on three horses to finish in first, second and third in the same race in an exact order.
    //Superfecta - wager on four horses to finish first, second, third and fourth in an exact order.
    //Quinella - wager on two horses to finish first and second in the same race, in any order.

    //WAY LATER: Key, Box, Wheel
  });
}

function placeBetWin(user, amount, horseNames) {
  let horseName;
  let amountPer;

  if (horseNames[0].toLowerCase() === 'all') {
    amountPer = Math.floor(amount / activeRace.horses.length);
    for (i in activeRace.horses) {
      horseName = activeRace.horses[i].name;
      bets.push(makeBet(user, amountPer, 'win', [horseName]));
    }
    console.log("Bets placed on all horses for: " + amountPer);
    return;
  }
  let numHorses = horseNames.length;
  amountPer = Math.floor(amount / numHorses);
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      bets.push(makeBet(user, amountPer, 'win', [horseName]));
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
    }
  }
}

function placeBetPlace(user, amount, horseNames) {
  let horseName;
  let amountPer;
  let numHorses = horseNames.length;
  amountPer = Math.floor(amount / numHorses);
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      bets.push(makeBet(user, amountPer, 'place', [horseName]));
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
    }
  }
}

function placeBetShow(user, amount, horseNames) {
  let horseName;
  let amountPer;
  let numHorses = horseNames.length;
  amountPer = Math.floor(amount / numHorses);
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      bets.push(makeBet(user, amountPer, 'show', [horseName]));
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
    }
  }
}

function placeBetAcross(user, amount, horseNames) {
  let horseName;
  let amountPer;
  let numHorses = horseNames.length;
  amountPer = Math.floor(amount / numHorses / 3);
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      bets.push(makeBet(user, amountPer, 'win', [horseName], true));
      bets.push(makeBet(user, amountPer, 'place', [horseName], true));
      bets.push(makeBet(user, amountPer, 'show', [horseName], true));
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
    }
  }
}

function placeBetExacta(user, amount, horseNames) {
  if (horseNames.length < 2) {
    botiun.sendMessageToUser(user, "You must pick the first and second places horses in order to place an exacta bet.");
    return;
  }
  let horseName;
  let horses = [];
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      horses.push(horseName);
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
      return;
    }
  }
  bets.push(makeBet(user, amount, 'exacta', horses));
}

function placeBetTrifecta(user, amount, horseNames) {
  if (horseNames.length < 3) {
    botiun.sendMessageToUser(user, "You must pick the first, second, and third place horses in order to place a trifecta bet.");
    return;
  }
  let horseName;
  let horses = [];
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      horses.push(horseName);
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
      return;
    }
  }
  bets.push(makeBet(user, amount, 'trifecta', horses));
}

function placeBetSuperfecta(user, amount, horseNames) {
  if (horseNames.length < 4) {
    botiun.sendMessageToUser(user, "You must pick the first, second, third, and fourth place horses in order to place a superfecta bet.");
    return;
  }
  let horseName;
  let horses = [];
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      horses.push(horseName);
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
      return;
    }
  }
  bets.push(makeBet(user, amount, 'superfecta', horses));
}

function placeBetQuinella(user, amount, horseNames) {
  if (horseNames.length < 2) {
    botiun.sendMessageToUser(user, "You must pick two horses to place first or second in order to place a quinella bet.");
    return;
  }
  let horseName;
  let horses = [];
  for (i in horseNames) {
    horseName = horseNames[i];
    if (horseInRace(horseName)) {
      horses.push(horseName);
    } else {
      console.log("[ERROR] Horse not in race: " + horseName);
      botiun.sendMessageToUser(user, `${horseName} is not in this race.`);
      return;
    }
  }
  bets.push(makeBet(user, amount, 'quinella', horses));
}

function makeBet(user, amount, type, details, acrossTheBoard) {
  type = type.toLowerCase();
  let betObj = {
    user: user,
    amount: amount,
    type: type,
    targets: [],
    payout: 1
  };

  let horseName;
  let horse;
  switch (type) {
    case "win":
      horseName = details[0];
      horse = horseInRace(horseName);
      if (horse) {
        betObj.targets.push(getHorseNameReduced(horseName));
        betObj.payout = horse.odds.against / horse.odds.for;
      } else {
        return null;
      }
      break;
    case "place":
      horseName = details[0];
      horse = horseInRace(horseName);
      if (horse) {
        betObj.targets.push(getHorseNameReduced(horseName));
        betObj.payout = horse.odds.against / horse.odds.for / 2;
      } else {
        return null;
      }
      break;
    case "show":
      horseName = details[0];
      horse = horseInRace(horseName);
      if (horse) {
        betObj.targets.push(getHorseNameReduced(horseName));
        betObj.payout = horse.odds.against / horse.odds.for / 4;
      } else {
        return null;
      }
      break;
    case "exacta":
      let firstHorseName = details[0];
      let secondHorseName = details[1];
      let firstHorse = horseInRace(firstHorseName);
      let secondHorse = horseInRace(secondHorseName);
      if (firstHorse && secondHorse) {
        betObj.targets.push(getHorseNameReduced(firstHorseName));
        betObj.targets.push(getHorseNameReduced(secondHorseName));
        betObj.payout = firstHorse.odds.against / firstHorse.odds.for * (secondHorse.odds.against / secondHorse.odds.for+1);
      } else {
        return null;
      }
      break;
    case "trifecta":
      let triHorseNames = [null, null, null];
      triHorseNames = details;
      let triHorses = [null, null, null];
      triHorses[0] = horseInRace(triHorseNames[0]);
      triHorses[1] = horseInRace(triHorseNames[1]);
      triHorses[2] = horseInRace(triHorseNames[2]);
      if (triHorses[0] && triHorses[1] && triHorses[2]) {
        betObj.targets.push(getHorseNameReduced(triHorseNames[0]));
        betObj.targets.push(getHorseNameReduced(triHorseNames[1]));
        betObj.targets.push(getHorseNameReduced(triHorseNames[2]));
        betObj.payout = triHorses[0].odds.against / triHorses[0].odds.for * (triHorses[1].odds.against / triHorses[1].odds.for+1) * (triHorses[2].odds.against / triHorses[2].odds.for+2);
        console.log("TRI PAYOUT: " + betObj.payout);
      } else {
        return null;
      }
      break;
    case "superfecta":
      let superHorseNames = [null, null, null, null];
      superHorseNames = details;
      let superHorses = [null, null, null, null];
      superHorses[0] = horseInRace(superHorseNames[0]);
      superHorses[1] = horseInRace(superHorseNames[1]);
      superHorses[2] = horseInRace(superHorseNames[2]);
      superHorses[3] = horseInRace(superHorseNames[3]);
      if (superHorses[0] && superHorses[1] && superHorses[2] && superHorses[3]) {
        betObj.targets.push(getHorseNameReduced(superHorseNames[0]));
        betObj.targets.push(getHorseNameReduced(superHorseNames[1]));
        betObj.targets.push(getHorseNameReduced(superHorseNames[2]));
        betObj.targets.push(getHorseNameReduced(superHorseNames[3]));
        betObj.payout = superHorses[0].odds.against / superHorses[0].odds.for * (superHorses[1].odds.against / superHorses[1].odds.for+1) * (superHorses[2].odds.against / superHorses[2].odds.for+2) * (superHorses[3].odds.against / superHorses[3].odds.for+3);
        console.log("SUPER PAYOUT: " + betObj.payout);
      } else {
        return null;
      }
      break;
    case "quinella":
      let q1HorseName = details[0];
      let q2HorseName = details[1];
      let q1Horse = horseInRace(q1HorseName);
      let q2Horse = horseInRace(q2HorseName);
      if (q1Horse && q2Horse) {
        betObj.targets.push(getHorseNameReduced(q1HorseName));
        betObj.targets.push(getHorseNameReduced(q2HorseName));
        betObj.payout = (q1Horse.odds.against / q1Horse.odds.for) + (q2Horse.odds.against / q2Horse.odds.for);
      } else {
        return null;
      }
      break;
  }

  //console.log(betObj);
  currency.addCurrencyToUserFrom(user, -amount, "race");

  let horsesOrderedOutput = '';
  for (i in betObj.targets) {
    if (betObj.targets.length === 2) {
      if (i > 0) {
        horsesOrderedOutput += ' and ';
      }
    }
    if (betObj.targets.length > 2) {
      if (i > 0 && !i <= betObj.targets.length - 1) {
        horsesOrderedOutput += ', ';
      }

      if (i === betObj.targets.length - 2) {
        horsesOrderedOutput += 'and ';
      }
    }
    horsesOrderedOutput += betObj.targets[i];
  }
  if (acrossTheBoard) {
    if (betObj.type === 'win') {
      botiun.sendMessageToUser(user, "You have placed an across the board bet for " + betObj.amount + " on " + horsesOrderedOutput);
    }
  } else {
    botiun.sendMessageToUser(user, "You have placed a " + betObj.type + " bet for " + betObj.amount + " on " + horsesOrderedOutput);
  }
  return betObj;
}

//Min Bets
//Breed
//Train
//Age

//------------------------------Stock-------------------------------------------
let minimumStockPurchaseAmount = 1;

function buyStockIn(user, horse, amount) {
  let horseName = getHorseNameReduced(horse);
  //Check the horse exists
  if (!horseExists(horseName)) {
    botiun.sendMessageToUser(user, `${horse} is not a valid horse.`);
    return;
  }
  //Figure out open amount and convert requested amount to a float
  let openStock = getRemainingStockIn(horseName);
  let requestedStockAmount = parseFloat(amount);
  if (isNaN(requestedStockAmount)) {
    if (amount.toLowerCase() === 'all') {
      requestedStockAmount = openStock;
    } else {
      botiun.sendMessageToUser(user, `${amount} is not a valid stock amount.`);
      return;
    }
  }
  //Check requested amount is open
  if (requestedStockAmount > openStock) {
    botiun.sendMessageToUser(user, `You wanted to buy ${requestedStockAmount}% of ${horse} but it only has ${openStock}% available.`);
    return;
  }
  //Check requested amount is greater than min
  if (requestedStockAmount < minimumStockPurchaseAmount) {
    botiun.sendMessageToUser(user, `I am sorry but the minimum stock purchase amount is ${minimumStockPurchaseAmount}% of a horse.`);
    return;
  }

  //Figure out how much it would cost to purchase requested amount
  let horseValue = getValueOfHorse(horseName);
  let cost = Math.ceil(requestedStockAmount / 100 * horseValue);
  console.log('cost', cost);
  //Attempt to purchase
  currency.getCurrencyThen(user, cost + '', (result) => {
    console.log('!!!', result);
    let horseObj = horseLookup[horseName];
    let found = false;
    //TODO FIX?
    for (username in horseObj.stock) {
      if (username === user) {
        horseObj.stock[username] += requestedStockAmount;
        found = true;
        break;
      }
    }
    if (!found) {
      horseObj.stock[user] = requestedStockAmount;
    }
    saveHorseToDB(horseObj);
    currency.addCurrencyToUserFrom(user, -cost, 'stock');
    botiun.sendMessageToUser(user, `You have purchased ${requestedStockAmount}% of ${horseObj.name} for ${result} ${constants.currencyName}!`);
  });
}

let housePriceMod = 0.66;

function sellStockIn(user, horse, amount, target, sellAmount) {
  //Check if horse exists
  let horseName = getHorseNameReduced(horse);
  if (!horseExists(horseName)) {
    botiun.sendMessageToUser(`${horse} is not a valid horse.`);
    return;
  }
  //Check is user has at least amount of stock in horse
  let horseObj = horseLookup[horseName];
  let userStock = horseObj.stock[user];
  let requestedAmount = parseFloat(amount);
  if (isNaN(requestedAmount)) {
    if (amount.toLowerCase() === 'all') {
      requestedAmount = userStock;
    } else {
      botiun.sendMessageToUser(`${amount} is not a valid stock amount,`);
      return;
    }
  }
  if (requestedAmount > userStock) {
    botiun.sendMessageToUser(`You have requested ${requestedAmount}% of ${horse} but you only own ${userStock}%.`);
    return;
  }
  //Check if target is Botiun or user
  if (['house', 'botiun'].includes(target.toLowerCase())) {
    //If Botiun offer price and wait for accept
    let offerPrice = Math.ceil(housePriceMod * requestedAmount / 100 * getValueOfHorse(horseName));
    console.log(offerPrice);
    sendMessageToUser(user, `Botiun will buy ${requestedAmount}% of ${horseObj.name} from you for ${offerPrice} ${constants.currencyName}. Type !accept to confirm this sale or !reject to deny it.`);
    accept.addQuery(user, 30 * 1000, {
      user: user,
      price: offerPrice,
      stock: requestedAmount,
      horseName: horseName
    }, acceptStockSaleToHouse, rejectStockSaleToHouse);
  } else {
    //Check if user exists
    //If Other user offer oruce to other user and wait for accept
    //TODO
  }
}

//LIST!

function acceptStockSaleToHouse(parameters) {
  currency.addCurrencyToUserFrom(parameters.user, parameters.offerPrice, 'stock');
  let horse = horseLookup[parameters.horseName];
  if (!horse) {
    botiun.error("Tried to sell stock to Botiun for a horse that doesn't exist");
  }
  horse.stock[parameters.user] -= parameters.stock;
  if (horse.stock[parameters.user] <= 0) {
    delete(horse.stock[parameters.user]);
  }
  saveHorseToDB(horse);
  botiun.sendMessageToUser(parameters.user, 'Sale to Botiun has been completed.');
  currency.addCurrencyToUserFrom(parameters.user, parameters.offerPrice, 'stock');
}

function rejectStockSaleToHouse(parameters) {
  botiun.sendMessageToUser(parameters.user, 'Sale has been canceled.');
}

function acceptStockSale() {

}

function rejectStockSale() {

}

//------------------------------Chat---------------------------------------------

function sendRaceOdds() {
  if (!activeRace) {
    botiun.sendMessage('No race is currently prepared.');
    return;
  }

  let horsesSortedByOdds = activeRace.horses.slice(0);
  horsesSortedByOdds.sort((a, b) => {
    return b.odds.raw - a.odds.raw;
  })

  let oddsOutput = '';
  if (activeRace.isDerby) {
    oddsOutput += 'Next derby odds: ';
  } else {
    oddsOutput += 'Next race odds: ';
  }

  for (i in horsesSortedByOdds) {
    let horse = horsesSortedByOdds[i];
    let line = '';
    if (i > 0) {
      line += ', ';
      if (i === horsesSortedByOdds.length - 1) {
        line += 'and ';
      }
    }
    line += 'Odds for ' + horse.name + ' are ' + horse.odds.against + ':' + horse.odds.for;
    oddsOutput += line;
  }

  botiun.sendMessage(oddsOutput);
}

function inspectHorse(user, horse) {
  let horseName = getHorseNameReduced(horse);
  if (horseExists(horseName)) {
    //console.log(horseLookup[horseName]);
    let horseData = horseLookup[horseName]
    let gender = (horseData.gender === 'M') ? 'male' : 'female';
    let remainingStock = getRemainingStockIn(horseName);
    let value = getValueOfHorse(horseName);
    let outputTxt = `${horseData.name} is a ${horseData.age} year old ${gender} horse owned by ${horseData.owner}. It has a speed of ${horseData.speed} and a wildness of ${horseData.wildness}. With ${horseData.record.raceWins} races won and ${horseData.record.derbyWins} derbies won. It is currently valued at ${value} ${constants.currencyName}. There is ${remainingStock}% open stock.`;
    botiun.sendMessageToUser(user, outputTxt);
  } else {
    botiun.sendMessageToUser(user, `${horse} is not a valid horse name.`);
  }
}

function checkRaceStockFor(user) {
  let horseCount = 0;
  let outputTxt = 'Stock:';
  for (horse in horseLookup) {
    for (username in horseLookup[horse].stock) {
      if (username === user) {
        outputTxt += ` ${horseLookup[horse].stock[user]}% in ${horse},`;
        horseCount++;
      }
    }
  }
  if (horseCount > 0) {
    outputTxt = outputTxt.substring(0, outputTxt.length - 1);
  } else {
    outputTxt = 'You have no stock in horses.';
  }
  botiun.sendMessageToUser(user, outputTxt);
}

function listAllHorses() {
  let outputTxt = 'All horses: '
  for (i in horses) {
    let horse = horses[i];
    if (i > 0) {
      outputTxt += ', ';
    }
    if (i === horses.length - 1) {
      outputTxt += 'and ';
    }
    outputTxt += horse.name;
  }
  botiun.sendMessage(outputTxt);
}

//-------------------------------Overlay------------------------------------------

function populateRaceOverlay() {
  let divOpen = '<div id="racers" style="float:left;width:100%">';
  let divClose = '</div>';

  let overlayOutput = divOpen;
  for (let i = 0; i < activeRace.horses.length; i++) {
    let horse = activeRace.horses[i];
    overlayOutput += '\n' + getHorseOverlayElement(horse.name, horse.progress, horse.place);
  }
  overlayOutput += divClose;

  return overlayOutput;
}

function getHorseOverlayElement(horseName, progress, place) {
  let backgroundFill = 'rgba(25,25,25,0.4)';
  let foregroundFill = 'rgba(0,155,155,0.75)';
  let derbyFill = 'rgba(0,75,155,0.75)';

  let horseImage = `<img id='img-${horseName} 'src='Horse_gallop.gif' style='height:25px;position:absolute;right:0px;top:0px' />`
  if (progress <= 0) {
    horseImage = '';
  }

  if (activeRace.isDerby) {
    foregroundFill = derbyFill;
  }

  let displayName = horseName;
  if (place === 1) {
    foregroundFill = 'rgba(214,175,54,0.75)';
    displayName = horseName + " - 1st";
    horseImage = '';
  } else if (place === 2) {
    foregroundFill = 'rgba(167,167,173,0.75)';
    displayName = horseName + " - 2nd";
    horseImage = '';
  } else if (place === 3) {
    foregroundFill = 'rgba(167,112,68,0.75)';
    displayName = horseName + " - 3rd";
    horseImage = '';
  } else if (place > 3) {
    foregroundFill = 'rgba(0,50,50,0.4)';
    displayName = horseName + " - " + place + "th";
    horseImage = '';
  }

  if (progress > 100) {
    progress = 100;
  }
  let width = progress + "%";
  //style="height:100%;background-color:${foregroundFill};width:${width};"
  return `<div id="racer-${horseName}" style="height:25px;display:flex;margin:0.5%">
    <div id="progress-${horseName}" style="width:100%;outline:1px inset black;background-color:${backgroundFill}">
      <div id="bar-${horseName}" style="height:100%;background-color:${foregroundFill};width:${width};position:relative">
        <font color="white" style="position:absolute;z:0;white-space:nowrap;padding:3px;font-size:19px">${displayName}</font>
        ${horseImage};
      </div>
    </div>
  </div>`
}


//-----------------------Utility-----------------------------------------------

function loadAllHorsesFromDB() {
  racersLoaded = false;
  database.get(constants.collectionHorses, {}).then((results) => {
    horses = results;
    botiun.log("Horses loaded from Database");
    racersLoaded = true;
    for (let i = 0; i < horses.length; i++) {
      let horseNameReduced = getHorseNameReduced(horses[i].name);
      horseLookup[horseNameReduced] = horses[i];
    }
  });
}

function saveAllHorsesToDB() {
  for (let i = 0; i < horses; i++) {
    saveHorseToDB(horses[i]);
  }
  console.log("All Horses saved to Database");
}

function saveHorseToDB(horse) {
  if (horse.odds) {
    delete horse["odds"];
  }
  database.update(constants.collectionHorses, {
    _id: horse._id
  }, {
    $set: horse
  });
  //Update internal system
  horseLookup[getHorseNameReduced(name)] = horse;
  for (let i = 0; i < horses.length; i++) {
    if (horses[i].name === horse.name) {
      horses[i] = horse;
      break;
    }
  }
}

function makeNewHorse(name, speed, wildness, gender) {
  if (horseExists(name)) {
    console.log(`Horse ${name} already exists!`);
    return;
  }
  if (!name) {
    console.log("Horse creation requires a name");
    return;
  }
  if (!speed) {
    speed = Math.floor(50 + (Math.random() + Math.random() + Math.random()) / 3 * 20);
  }
  if (!gender) {
    gender = (Math.random() < 0.5) ? "M" : "F";
  }
  if (!wildness) {
    wildness = (Math.floor((Math.random() + Math.random() + Math.random()) / 3 * 75 + 25));
  }
  let newHorse = database.getNewHorseTemplate();
  newHorse.name = name;
  newHorse.speed = speed;
  newHorse.stamina = 100;
  newHorse.wildness = wildness;
  newHorse.gender = gender;
  horses.push(newHorse);
  horseLookup[getHorseNameReduced(name)] = newHorse;
  database.insert(constants.collectionHorses, newHorse);
  console.log(`${name} created`);
  return newHorse;
}

function generateHorses() {
  let listOfHorses = ["Lil-Sebastian", "Night-Mare", "Butt-Stallion", "Roach", "Silver", "Ponyboy", "Mane-Attraction", "Harry-Trotter", "Mr-Ed", "Pony-Soprano", "Talk-Derby-to-Me", "Joseph-Stalling", "Unicorn", "Black-Beauty", "Maple-Stirrup", "Rein-Man", "Neigh-Sayer", "Tater-Trot", "Shadowfax", "Elmers-Revenge", "Al-Capony", "Kevin", "Dolly-Llama", "Shadowcorn", "Forrest-Jump", "Usain-Colt", "Gene"];

  for (let i = 0; i < listOfHorses.length; i++) {
    makeNewHorse(listOfHorses[i]);
  }
}

function horseExists(name) {
  return (Object.keys(horseLookup).includes(getHorseNameReduced(name)));
}

function horseInRace(name) {
  if (!activeRace) {
    console.log("No active race");
    return false;
  }
  for (let i = 0; i < activeRace.horses.length; i++) {
    if (activeRace.horses[i].name === name || getHorseNameReduced(activeRace.horses[i].name) === getHorseNameReduced(name)) {
      return activeRace.horses[i];
    }
  }
  return false;
}

function getRemainingStockIn(horseName) {
  if (!horseExists(horseName)) {
    return 0;
  }
  let openStock = 100;
  let horse = horseLookup[horseName];
  for (owner in horse.stock) {
    openStock -= horse.stock[owner];
  }
  return openStock;
}

function getValueOfHorse(horseName) {
  if (!horseExists(horseName)) {
    return;
  }
  let horse = horseLookup[horseName];
  let valueSpeed = 1000;
  let valueWildness = -500;
  let valueWinRate = 1000000;
  let valueDerbyRate = 5000000;

  let value = Math.ceil(horse.speed * valueSpeed + horse.wildness * valueWildness + valueWinRate * (horse.record.raceWins / horse.record.races | 0) + valueDerbyRate * (horse.record.derbyWins / horse.record.derbies | 0));
  return value;
}

function getHorseNameReduced(name) {
  let reducedName = name.trim().toLowerCase().replace(/\s/g, '_');
  return reducedName;
}

function shuffle(array) {
  array.sort(() => Math.random() - 0.5);
}

function splitIntoParts(whole, parts) {
  var partsArr = new Array(parts);
  var remain = whole;
  var partsLeft = parts;
  for (let i = 0; partsLeft > 0; i++) {
    let size = Math.floor((remain + partsLeft - 1) / partsLeft);
    partsArr[i] = size
    remain -= size;
    partsLeft--;
  }
  return partsArr;
}

function str_pad_left(string, pad, length) {
  return (new Array(length + 1).join(pad) + string).slice(-length);
}

function getTimeToNextRace() {
  if (!activeRace) {
    botiun.sendMessage("There is no race scheduled.");
    return;
  }
  //console.log(timing.nextRaceStart);
  let timeRemaining = timing.nextRaceStart - (new Date()).getTime();
  //console.log(timeRemaining);
  let timeRemainingInSec = Math.floor(timeRemaining / 1000);
  let timeRemainingMinutes = Math.floor(timeRemainingInSec / 60 << 0);
  let timeRemainingSeconds = Math.floor(timeRemainingInSec % 60);
  let output = str_pad_left(timeRemainingMinutes, '0', 2) + ':' + str_pad_left(timeRemainingSeconds, '0', 2);
  botiun.sendMessage(`The next race will begin in ${output}!`);
}

//-----------------------------------------------------------------------------

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
}