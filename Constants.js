var identity = {
  username: 'Botiun',
  password: 'oauth:2fsg30d1plxe20drjrb8s3lzwp91l6'
};

var options = {
  clientId: '95kreu7tyixtgfqd9oe575hjttox0j'
};

var channels = [
  'Patiun'
];

var ignoredUsers = [
  'streamelements', 'p0sitivitybot', 'nightbot', 'patiun_test', 'subcentraldotnet', 'electricallongboard', 'lanfusion', 'bananennanen', 'skinnyseahorse', 'jade_elephant_association', 'commanderroot', 'slocool', 'otohostbot', 'energyzbot', 'teyd__', 'zanekyber', 'anotherttvviewer', 'host_giveaway', 'electricalskateboard', 'pollmapebot', 'p0lizei_', 'virgoproz', 'v_and_k', 'botiun', 'apricotdrupefruit', 'activeenergy'
];

var databaseAddress = 'mongodb://localhost:27017/';
var databaseName = 'patiun';
var collectionUsers = 'users';
var collectionGames = 'games';
var collectionStreams = 'streams';

var muxyDir = 'C:\\Users\\Mike\\Muxy';

var streamElementsAccountId = "5bb71efb9322b51e03a45db2";

var jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiNWJiNzFlZmI5MzIyYjU1MTg4YTQ1ZGIxIiwiY2hhbm5lbCI6IjViYjcxZWZiOTMyMmI1MWUwM2E0NWRiMiIsInByb3ZpZGVyIjoidHdpdGNoIiwicm9sZSI6Im93bmVyIiwiYXV0aFRva2VuIjoibGJCOXhBSko0cVFpMU1yeG9rNlRURS1iWlVmR0lJSzlaa19OaGxhQUY5V29kZnJwIiwiaWF0IjoxNTQ2OTM1OTQ5LCJpc3MiOiJTdHJlYW1FbGVtZW50cyJ9.FY4DOi2IM3f-gXnQHn4qgvd_YQaqUgHwTYRfLOFRrsM";

module.exports = {
  options: options,
  identity: identity,
  channels: channels,
  muxyDir: muxyDir,
  streamElementsAccountId: streamElementsAccountId,
  jwt: jwt,
  ignoredUsers: ignoredUsers,
  databaseAddress: databaseAddress,
  databaseName: databaseName,
  collectionUsers: collectionUsers,
  collectionGames: collectionGames,
  collectionStreams: collectionStreams
};