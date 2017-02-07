/**
 * Author @nadir93
 * Date 2017.2.1
 */
const Sender = require('./Sender');
const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'senderController',
  level: loglevel
});

let senders = [];

module.exports = {
  init: (senderCount, senderCreateInterval, serverIP,
    serverPort, clientLocatAddress, keepalive, senderPrefix, protocol) => {
    log.debug('senderController init called');
    log.debug('senderCount: ' + senderCount);
    log.debug('senderCreateInterval: ' + senderCreateInterval);
    log.debug('serverIP: ' + serverIP);
    log.debug('serverPort: ' + serverPort);
    log.debug('keepalive: ' + keepalive);
    log.debug('senderPrefix: ' + senderPrefix);
    log.debug('protocol: ' + protocol);
    return new Promise(function(resolve, reject) {
      let clientId = 0;
      let createSenderLoop = setInterval(function() {
        if (clientId > senderCount - 1) {
          clearInterval(createSenderLoop);
          log.info('송신자가 초기화 되었습니다');
          resolve();
        } else {
          senders.push(new Sender(serverIP, serverPort,
            clientLocatAddress, keepalive, clientId, senderPrefix, protocol));
        }
        clientId++;
      }, senderCreateInterval);
    });
  },
  sendMessage: (receiverCount, qos, sendInterval, timeout, msgSize) => {
    return new Promise(function(resolve, reject) {
      log.debug('sendMessage called');
      log.debug('receiverCount:' + receiverCount);
      log.debug('qos:' + qos);
      log.debug('sendInterval:' + sendInterval);
      let sendMessageInterval = setInterval(function() {
        let id = Math.floor(Math.random() * receiverCount);
        //log.debug('mqtt_recv_client_' + id);
        for (let i = 0; i < senders.length; i++) {
          //log.debug('clients[' + i + '] = ' + clients[i]);
          senders[i].sendMessage(id, msgSize, qos);
        }
      }, sendInterval);

      setTimeout(function() {
        clearInterval(sendMessageInterval);
        resolve();
      }, timeout);
    });
  },
  release: () => {
    return new Promise(function(resolve, reject) {
      log.debug('senders.length: ' + senders.length);
      let releaseCount = 0;
      for (let i = 0; i < senders.length; i++) {
        senders[i].stop()
          .then(function() {
            releaseCount++;
            if (releaseCount === senders.length) {
              senders = [];
              log.info('송신자가 모두 제거되었습니다');
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
