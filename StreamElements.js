const fs = require('fs');
const request = require('request');
const rp = require('request-promise');
const constants = require('./Constants.js');
const botiun = require('./Botiun.js');

// Define configuration options
const opts = {
  options: constants.options,
  identity: constants.identity,
  channels: constants.channels
};

const URL_BASE = "https://api.streamelements.com/kappa/v2/";

function getLeaderboard() {
  var url = URL_BASE + "points/" + constants.streamElementsAccountId + "/top";
  const options = {
    method: 'GET',
    url: url,
    json: true
  };

  return rp(options).then((body) => {
    //console.log(body);
    return body.users;
  }).catch((error) => {
    console.log(error);
    return [];
  });
}

function getPointsForUser(user, amount, callback) {
  var url = URL_BASE + "points/" + constants.streamElementsAccountId + "/" + user;

  const options = {
    method: 'GET',
    url: url,
    json: true
  };

  var points = -1;

  rp(options).then(function(body) {
    let userPoints = body.points;
    let requiredAmount = parseInt(amount);
    if (amount.toLowerCase() === 'all') {
      requiredAmount = userPoints;
    } else
    if (amount.substr(amount.length - 1) === '%') {
      requiredAmount = Math.ceil((parseFloat(amount) / 100) * userPoints);
    } else
    if (amount.substr(amount.length - 1).toLowerCase() === 'k') {
      requiredAmount = parseInt(amount) * 1000;
    }
    if (requiredAmount <= userPoints) {
      callback(requiredAmount);
    } else {
      botiun.sendMessageToUser(user, `Oh no! You only have ${userPoints} but need ${requiredAmount} to do that.`);
    }
  });
}

function updatePointsForUser(user, amount) {
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

  request.put(options, function(error, response, body) {
    if (error) throw new Error(error);
  });
}

module.exports = {
  getLeaderboard: getLeaderboard,
  getPointsForUser: getPointsForUser,
  updatePointsForUser: updatePointsForUser
}