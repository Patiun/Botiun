const database = require('./Database.js');
const constants = require('./Constants.js');
const botiun = require('./Botiun.js');
const currency = require('./Currency_Module.js');
const uuid = require('uuid/v1');

var name = "Race Module";
var commands = ["load", "save", "new", "list", "make", "draw", "run", "finish", "claim", "racebet", "placebet", "auto", "gen"];
var racesAllowed = false;
var racersLoaded = false;
var canBet = false;
var canPostMessages = false;
var auto = false;
var horses = [];
var horseLookup = {};
var raceCount = 4;
var raceTickPerSec = 60; //24;
var raceTickDuration = 1000 / raceTickPerSec; //100; //MS
var staminaDrain = 75; //33;
var maxWildGain = 12.5;
var races = [];
var derby;
var countTopRacesForDerby = 2;
var activeRace;
var unclaimedPayouts = {};
var raceBets = {};
var payoutTimeoutDuration = 1000 * 60 * 30; //30 Minutes
var timeBetweenRaces = 1000 * 60 * 30; //30 Minutes
var timing = {
  raceStart: 0,
  raceEnd: 0,
  raceElapsed: 0
}

function init() {
  return new Promise(function(resolve, reject) {

    botiun.emit('raceClear');
    loadAllHorsesFromDB();

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
      console.log(horseLookup);
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
    default:
      botiun.log(`${command} was not handled properly in Race_Module.js`);
      break;
  }
}

//-----------------------------------------------------------------------------

function forceEndRace() {
  console.log("[ALERT] Races have been forced to end.");
  endRace();
}

function prepareRaces() {
  if (!racersLoaded) {
    console.log("Racers are not loaded from the DB!");
    return;
  }
  let horseCount = horses.length;
  //let horsesPerRace = horseCount / raceCount;
  let horsesPerRace = splitIntoParts(horseCount, raceCount);
  console.log(`Horse Count: ${horseCount} | Horses Per Race: ${horsesPerRace} | Race Count: ${raceCount}`);

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
      console.log("---------------------DERBY-PREP-----------------");
      for (let i = 0; i < derby.horses.length; i++) {
        console.log(derby.horses[i].name + ": " + derby.horses[i].stamina + " = " + derby.horses[i].dayMod);
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
  raceDrawOdds();
  //console.log(activeRace);
  botiun.emit('racePrepare', populateRaceOverlay());
  if (auto) {
    raceDrawOdds();
  }
}

function raceDrawOdds() {
  //// TEMP:
  let totalWins = activeRace.horses.length;
  for (let i = 0; i < activeRace.horses.length; i++) {
    if (activeRace.isDerby) {
      totalWins += activeRace.horses[i].record.derbyWins;
    } else {
      totalWins += activeRace.horses[i].record.raceWins;
    }
  }

  let roughOdds = {};
  let chanceTotal = 0;
  for (let i = 0; i < activeRace.horses.length; i++) {
    let chance = 0;
    if (activeRace.isDerby) {
      chance = (activeRace.horses[i].record.derbyWins + 1);
    } else {
      chance = (activeRace.horses[i].record.raceWins + 1);
    }
    roughOdds[getHorseNameReduced(activeRace.horses[i].name)] = [chance, totalWins, chance / totalWins];
    chanceTotal += chance / totalWins;
  }

  console.log(chanceTotal);
  console.log(roughOdds);

  /*
    setTimeOut(() => {
      startRace();
    }, timeBetweenRaces); */
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
  tickCount = 0;
  if (activeRace.isDerby) {
    console.log('---------------------DERBY---------------------');
  } else {
    console.log('---------------------RACE----------------------');
  }
  timing.raceStart = new Date();
  activeRace.interval = setInterval(raceTick, raceTickDuration);
}

function advanceHorse(horse) {
  if (horse.progress >= 0 && horse.progress < 100) {
    //let amount = (horse.speed / ((Math.random() * 15) + 45)) * ((Math.random() * 0.4) + 0.35);
    let wildness = (horse.wildness / 100);
    let avgGainUnModed = (((horse.speed) / 10) / raceTickPerSec) * horse.dayMod;
    //Adjust avgGain for stamina drain
    let avgGain = avgGainUnModed * (horse.stamina / 100 * 0.4 + 0.6);
    let gain = avgGain + (maxWildGain / raceTickPerSec) * ((Math.random() + Math.random() + Math.random()) / 3 * (wildness) - (wildness) / 2);
    if (gain > avgGain) {
      horse.stamina -= (staminaDrain / raceTickPerSec) * ((gain - avgGain) / avgGain);
      if (horse.stamina < 0) {
        horse.stamina = 0;
      }
    } else {
      horse.stamina += (staminaDrain * 0.75) / raceTickPerSec * ((avgGain - gain) / avgGain);
      if (horse.stamina > 100) {
        horse.stamina = 100;
      }
    }
    horse.progress += (gain);
  }
  if (!activeRace.places.includes(horse) && horse.progress >= 100) {
    console.log(`${horse.name} has finished!`);
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
  console.log("Race is over! Winner: " + winner);
  console.log("In second: " + activeRace.places[1].name);
  console.log("In third: " + activeRace.places[2].name);

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
  }, 30 * 1000); //Seconds until clear

  timing.raceEnd = new Date();
  timing.raceElapsed = timing.raceEnd - timing.raceStart;
  console.log("Race took " + timing.raceElapsed / 1000 + "s");
}

function stockPayOut(horse) {
  let stockWin = 10000;
  for (let i = 0; i < Object.keys(horse.stock).length; i++) {
    let user = Object.keys(horse.stock)[i];
    let winnings = Math.floor(horse.stock[user] / 100 * stockWin);
    if (botiun.hasUser(user)) {
      botiun.log(`Giving ${user} ${winnings}`)
      currency.addCurrencyToUserFrom(user, winnings, "stock");
    } else {
      botiun.log(`${user} is not here so their ${winnings} ${constants.currencyName} is waiting for them.`);
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
        if (payout.id === id) {
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
  console.log("Trying to place bet for " + amount + " on " + horseParams);
  if (!horseParams && horseParams.length > 0) {
    console.log("Invalid horseParams");
    return;
  }
  currency.getCurrencyThen(user, amount, (result) => {
    console.log("[!!!] " + result);
    //currency.addCurrencyToUserFrom(user, -result, "race");
    //Win - Comes in first
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


//Stock buy / sell
//Breed
//Train
//Age

//Announcements
//VIP and Happy entrances
//Roulette

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
  let foregroundFill = 'rgba(0,155,155,0.75)'

  let horseImage = `<img id='img-${horseName} 'src='Horse_gallop.gif' style='height:25px;position:absolute;right:0px;top:0px' />`

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
  for (let i = 0; i < activeRace.horses.length; i++) {
    if (activeRace.horses[i].name === name || getHorseNameReduced(activeRace.horses[i].name) === getHorseNameReduced(name)) {
      return true;
    }
  }
  return false;
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

//-----------------------------------------------------------------------------

module.exports = {
  commands: commands,
  init: init,
  start: start,
  end: end,
  handleCommand: handleCommand,
}