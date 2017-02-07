/**
 * Author @nadir93
 * Date 2017.2.1
 */
const mqtt = require('mqtt');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const loglevel = 'info';
const Logger = require('bunyan');
const log = new Logger.createLogger({
  name: 'MQTTClient',
  level: loglevel
});

class MQTTClient {
  constructor(serverIp, serverPort, localAddress,
    keepalive, clientId, clientPrefix, protocol) {
    log.debug('serverIp: ' + serverIp);
    this.serverIp = serverIp;
    log.debug('serverPort: ' + serverPort);
    this.serverPort = serverPort;
    log.debug('localAddress: ' + localAddress);
    this.localAddress = localAddress;
    log.debug('keepalive: ' + keepalive);
    this.keepAlive = keepalive;
    log.debug('clientId: ' + clientId);
    this.clientId = clientId;
    log.debug('clientPrefix: ' + clientPrefix);
    this.clientPrefix = clientPrefix;
    log.debug('protocol: ' + protocol);
    this.protocol = protocol;
    this.start();
  }

  stop() {
    let that = this;
    return new Promise(function(resolve, reject) {
      log.debug('stop called');
      that.client.end(false, function() {
        resolve();
      });
    });
  }

  start() {
    let that = this;

    if (this.protocol === 'tls') {
      this.client = mqtt.Client(
        function() {
          return tls.connect({
            host: that.serverIp,
            port: that.serverPort,
            localAddress: that.localAddress,
            // Necessary only if using the client certificate authentication
            key: fs.readFileSync(path.join(__dirname, '..', 'secure', 'tls-key.pem')),
            cert: fs.readFileSync(
              path.join(__dirname, '..', 'secure', 'tls-cert.pem')),
            rejectUnauthorized: false
          });
        }, {
          reconnectPeriod: 100 * 1000,
          keepalive: that.keepAlive,
          clientId: that.clientPrefix + that.clientId
        });
    } else {
      this.client = mqtt.Client(
        function() {
          return net.connect({
            host: that.serverIp,
            port: that.serverPort,
            localAddress: that.localAddress
          });
        }, {
          reconnectPeriod: 100 * 1000,
          keepalive: that.keepAlive,
          clientId: that.clientPrefix + that.clientId
        });
    }
    this.registerEvent();
  }

  registerEvent() {
    let that = this;
    this.client.on('connect', function() {
      log.debug(that.clientPrefix + that.clientId + ' connected');
      that.client.subscribe(that.clientPrefix + that.clientId);
      //client.publish('presence', 'Hello mqtt')
    });

    this.client.on('reconnect', function() {
      log.debug(that.clientPrefix + that.clientId + ' reconnected');
    });

    this.client.on('close', function() {
      log.debug(that.clientPrefix + that.clientId + ' closed');
    });

    this.client.on('offline', function() {
      log.debug(that.clientPrefix + that.clientId + ' offline');
    });

    this.client.on('error', function(error) {
      log.debug(that.clientPrefix + that.clientId + ' error: ' + error);
    });
  }
}
module.exports = MQTTClient;
