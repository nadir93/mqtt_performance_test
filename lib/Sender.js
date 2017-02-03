/**
 * Author @nadir93
 * Date 2017.2.1
 */
const loglevel = 'info';
const Logger = require('bunyan');
const log = new Logger.createLogger({
  name: 'Sender',
  level: loglevel
});
const MQTTClient = require('./MQTTClient');
const Moment = require('moment');
const CLIENT_PREFIX = 'mqtt_recv_client_';

class Sender extends MQTTClient {
  sendMessage(clientId, msgSize, qos) {
    log.debug(CLIENT_PREFIX + ' clientId: ' + clientId);
    this.client.publish(CLIENT_PREFIX + clientId,
      new Moment() + '_' + Sender.makeid(msgSize), {
        qos: qos
      });
  }

  static makeid(msgSize) {
    let text = '';
    let possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < msgSize; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
module.exports = Sender;
