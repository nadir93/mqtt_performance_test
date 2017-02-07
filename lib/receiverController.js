/**
 * Author @nadir93
 * Date 2017.2.1
 */
const Receiver = require('./Receiver');
const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'receiverController',
  level: loglevel
});
let receivers = [];

module.exports = {
  init: (receiverCount, receiverCreateInterval, serverIP,
    serverPort, clientLocatAddress, keepalive, receiverPrefix, protocol) => {
    log.debug('receiverController init called');
    log.debug('receiverCount: ' + receiverCount);
    log.debug('receiverCreateInterval: ' + receiverCreateInterval);
    log.debug('serverIP: ' + serverIP);
    log.debug('serverPort: ' + serverPort);
    log.debug('keepalive: ' + keepalive);
    log.debug('receiverPrefix: ' + receiverPrefix);
    log.debug('protocol: ' + protocol);
    return new Promise(function(resolve, reject) {
      let clientId = 0;
      let createReceiverLoop = setInterval(function() {
        if (clientId > receiverCount - 1) {
          clearInterval(createReceiverLoop);
          log.info('수신자가 초기화 되었습니다');
          resolve();
        } else {
          receivers.push(new Receiver(serverIP, serverPort,
            clientLocatAddress, keepalive, clientId, receiverPrefix, protocol));
        }
        clientId++;
      }, receiverCreateInterval);
    });
  },
  getStat: () => {
    log.debug('getStat called');
    return {
      totalElapsedTime: Receiver.totalMsgProcessingTime,
      msgCount: Receiver.receivedMsgCount
    };
  },
  resetStat: () => {
    log.debug('resetStat called');
    Receiver.totalMsgProcessingTime = 0;
    Receiver.receivedMsgCount = 0;
  },
  release: () => {
    return new Promise(function(resolve, reject) {
      log.debug('receivers.length: ' + receivers.length);
      let releaseCount = 0;
      for (let i = 0; i < receivers.length; i++) {
        receivers[i].stop()
          .then(function() {
            releaseCount++;
            if (releaseCount === receivers.length) {
              receivers = [];
              log.info('수신자가 모두 제거되었습니다');
              resolve();
            }
          })
          .catch(function(e) {
            log.error(e);
            reject(e);
          });
      }
    });
  }
};
