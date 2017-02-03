/**
 * Author @nadir93
 * Date 2017.2.1
 */
const Moment = require('moment');
const loglevel = 'info';
const Logger = require('bunyan');
const log = new Logger.createLogger({
  name: 'Receiver',
  level: loglevel
});
const MQTTClient = require('./MQTTClient');

class Receiver extends MQTTClient {
  registerEvent() {
    super.registerEvent();
    let that = this;
    this.client.on('message', function(topic, message) {
      Receiver.receivedMsgCount++;
      log.debug(that.clientPrefix + that.clientId +
        ' message arrived msg: ' + message.toString());
      let sendDate = message.toString().substring(0, 13);
      let endDate = new Moment();
      let elapsedTime = (endDate - sendDate);
      if (Receiver.receivedMsgCount % 1000 === 0) {
        log.debug('elapsedTime: ' + elapsedTime + ' ms');
      }
      Receiver.totalMsgProcessingTime += elapsedTime;
    });
  }
}

Receiver.receivedMsgCount = 0;
Receiver.totalMsgProcessingTime = 0;
module.exports = Receiver;
