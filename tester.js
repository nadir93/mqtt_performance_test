/**
 * Author @nadir93
 * Date 2017.2.1
 */
const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'tester',
  level: loglevel
});
const os = require('os-utils');
const si = require('systeminformation');
const receiverController = require('./lib/receiverController');
const senderController = require('./lib/senderController');

const RECEIVER_PREFIX = 'mqtt_recv_client_';
const RECEIVER_COUNT = [10000, 20000, 50000, 60000, 60000];
const RECEIVER_CREATE_INTERVAL = 2; //ms

const SENDER_PREFIX = 'mqtt_send_client_';
const SENDER_COUNT = [6, 10, 100, 500, 1000];
// 송신자 수 array index
let senderCountIndex = 0;
const SENDER_CREATE_INTERVAL = 2; //ms
// 메시지 전송 간격 (ms) 초당 1000건에서 100건 까지 송신함
const SEND_MSG_INTERVAL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// 메시지 전송 간격 array index
let sendMsgIntervalIndex = 0;

const SERVER_URL = '192.168.0.101';
const SERVER_PORT = 2883;
const CLIENT_LOCAL_ADDRESS = '192.168.0.107';
const KEEPALIVE = 600; //second
// 메시지 전송 시간
const SEND_MESSAGE_DURATION = 30000; //ms
// mqtt qos
const QOS = 0;
// 메시지 사이즈 byte
const MSG_SIZE = 256;
// 메시지 처리시간의 최대 허용량 - 초과하면 메시지 전송 간격을 늘려 메시지 송신량을 줄인다
const MAX_AVG_TIME = 500; //ms
let cpu = [];
let memory = [];
let rx = [];
let tx = [];

(function main(receiverCountIndex) {
  if (receiverCountIndex < RECEIVER_COUNT.length) {
    log.debug('receiverCountIndex: ' + receiverCountIndex);
    log.debug('RECEIVER_COUNT: ' + RECEIVER_COUNT[receiverCountIndex]);
    let monitor;
    //초기화
    init(RECEIVER_COUNT[receiverCountIndex], SENDER_COUNT[senderCountIndex])
      .then(function() {
        //통계초기화
        receiverController.resetStat();
        cpu = [];
        memory = [];
        rx = [];
        tx = [];
        monitor = setInterval(systemMonitoring, 1000);
        //메시지 보내기
        return senderController.sendMessage(RECEIVER_COUNT[receiverCountIndex],
          QOS, SEND_MSG_INTERVAL[sendMsgIntervalIndex],
          SEND_MESSAGE_DURATION, MSG_SIZE);
      })
      .then(function() {
        clearInterval(monitor);
        let avg = getAverage(sendMsgIntervalIndex, receiverCountIndex,
          SEND_MESSAGE_DURATION);
        //응답시간이 느릴경우 초당메시지 수를 줄여 다시 호출하여 적정수준의 값을 찾는다
        let tempIndex = sendMsgIntervalIndex;
        return new Promise(function(resolve, reject) {
          if (avg > MAX_AVG_TIME) {
            (function changeSendMsgInterval(index) {
              log.debug('index: ' + index);
              if (index < SEND_MSG_INTERVAL.length) {
                log.debug('자원해제');
                release()
                  .then(function() {
                    //초기화
                    return init(
                      RECEIVER_COUNT[receiverCountIndex],
                      SENDER_COUNT[senderCountIndex]);
                  })
                  .then(function() {
                    //통계초기화
                    receiverController.resetStat();
                    cpu = [];
                    memory = [];
                    rx = [];
                    tx = [];
                    monitor = setInterval(systemMonitoring, 1000);
                    //메시지 보내기
                    return senderController.sendMessage(
                      RECEIVER_COUNT[receiverCountIndex],
                      QOS, SEND_MSG_INTERVAL[index],
                      SEND_MESSAGE_DURATION, MSG_SIZE);
                  })
                  .then(function() {
                    clearInterval(monitor);
                    avg = getAverage(index, receiverCountIndex,
                      SEND_MESSAGE_DURATION);
                    if (avg > MAX_AVG_TIME) {
                      // 재귀호출
                      changeSendMsgInterval(++index);
                    } else {
                      resolve();
                    }
                  });
              } else {
                reject(new Error('메시지 전송 간격을 초과하였습니다'));
              }
            })(++tempIndex);
          } else {
            resolve();
          }
        });
      })
      .then(function() {
        log.debug('자원해제');
        return release();
      })
      .then(function() {
        // 재귀호출
        main(++receiverCountIndex);
      })
      .catch(function(e) {
        clearInterval(monitor);
        log.error(e);
      });
  } else {
    log.info('프로그램 종료');
  }
})(0); // 메시지 수신자 수 index 0 으로 시작

function init(receiverCount, senderCount) {
  log.debug('receiverCount: ' + receiverCount);
  log.debug('senderCount: ' + senderCount);
  return new Promise(function(resolve, reject) {
    receiverController
      .init(receiverCount, RECEIVER_CREATE_INTERVAL, SERVER_URL,
        SERVER_PORT, CLIENT_LOCAL_ADDRESS, KEEPALIVE, RECEIVER_PREFIX)
      .then(function() {
        log.debug('수신자 초기화됨');
        return senderController.init(senderCount,
          SENDER_CREATE_INTERVAL, SERVER_URL, SERVER_PORT,
          CLIENT_LOCAL_ADDRESS, KEEPALIVE, SENDER_PREFIX);
      })
      .then(function() {
        log.debug('송신자 초기화됨');
        resolve();
      })
      .catch(function(e) {
        log.error(e);
        reject(e);
      });
  });
}

function release() {
  return new Promise(function(resolve, reject) {
    senderController
      .release()
      .then(function() {
        return receiverController.release();
      })
      .then(function() {
        resolve();
      })
      .catch(function(e) {
        log.error(e);
        reject(e);
      });
  });
}

function systemMonitoring() {
  os.cpuUsage(function(v) {
    //log.debug('number test = ' + typeof v);
    //log.debug('CPU Usage (%): ' + (v * 100).toFixed(2));
    cpu.push(v);
  });
  memory.push(os.freememPercentage());

  si.networkStats('eth0', function(data) {
    //log.debug('Network Interface Stats (eth0):');
    //log.debug('- is up: ' + data.operstate);
    //log.debug('- RX bytes/sec: ' + data.rx_sec);
    if (data.rx_sec > 0) {
      rx.push(data.rx_sec);
    }
    //log.debug('- TX bytes/sec: ' + data.tx_sec);
    if (data.tx_sec > 0) {
      tx.push(data.tx_sec);
    }
  });
}

function getAverage(sendMsgIntervalIndex,
  receiverCountIndex) {
  //통계 계산
  let stat = receiverController.getStat();
  log.info('=======================================================');
  log.info('MQTT_SERVER_URL: ' + SERVER_URL + ':' + SERVER_PORT);

  log.info('');
  log.info('[ 수 신 ]');
  log.info('메시지 수신자수: ' + RECEIVER_COUNT[receiverCountIndex]);
  log.info('총 메시지 수신: ' + stat.msgCount);
  log.info('총 메시지 처리 시간(ms): ' + stat.totalElapsedTime);
  log.info('초당 메시지 처리건수(tps): ' +
    (stat.msgCount / (SEND_MESSAGE_DURATION / 1000)).toFixed(2));
  let avg = (stat.totalElapsedTime / stat.msgCount).toFixed(2);
  log.info('평균 처리 시간(ms): ' + avg);
  log.info('초당 생성 수신자수: ' + (1000 / RECEIVER_CREATE_INTERVAL));
  log.info('최대응답보장시간(ms): ' + MAX_AVG_TIME);

  log.info('');
  log.info('[ 송 신 ]');
  log.info('메시지 송신자수: ' + SENDER_COUNT[senderCountIndex]);
  log.info('메시지전송간격(ms): ' +
    SEND_MSG_INTERVAL[sendMsgIntervalIndex]);
  log.info('초당 메시지 발송건수: ' +
    (1000 / SEND_MSG_INTERVAL[sendMsgIntervalIndex]) *
    SENDER_COUNT[senderCountIndex]);
  log.info('메시지 전송 시간(sec): ' + (SEND_MESSAGE_DURATION / 1000));

  log.info('');
  log.info('[ 메시지 ]');
  log.info('메시지 크기(byte): ' + MSG_SIZE);
  log.info('qos: ' + QOS);
  log.info('keepalive(sec): ' + KEEPALIVE);
  log.info('');
  log.info('[ 시스템 ]');
  let cpuSum = 0;
  //log.info('cpuSum = ' + cpuSum);
  for (let i = 0; i < cpu.length; i++) {
    //log.info('cpu[' + i + '] = ' + cpu[i]);
    cpuSum += cpu[i];
    //log.info('cpuSum = ' + cpuSum);
  }
  let cpuAvg = cpuSum / cpu.length;
  log.info('cpu 사용(%): ' + (cpuAvg * 100).toFixed(2));
  let memorySum = 0;
  //log.info('cpuSum = ' + cpuSum);
  for (let i = 0; i < memory.length; i++) {
    //log.info('cpu[' + i + '] = ' + cpu[i]);
    memorySum += memory[i];
    //log.info('cpuSum = ' + cpuSum);
  }
  let memoryAvg = memorySum / memory.length;
  log.info('메모리 사용(%): ' + (100 - (memoryAvg * 100)).toFixed(2));

  let txSum = 0;
  for (let i = 0; i < tx.length; i++) {
    //log.info('cpu[' + i + '] = ' + cpu[i]);
    txSum += tx[i];
    //log.info('cpuSum = ' + cpuSum);
  }
  let txAvg = txSum / tx.length;
  log.info('네트웍평균송신(bytes/sec): ' + txAvg.toFixed(0));

  let rxSum = 0;
  for (let i = 0; i < rx.length; i++) {
    //log.info('cpu[' + i + '] = ' + cpu[i]);
    rxSum += rx[i];
    //log.info('cpuSum = ' + cpuSum);
  }
  let rxAvg = rxSum / rx.length;
  log.info('네트웍평균수신(bytes/sec): ' + rxAvg.toFixed(0));
  log.info('=======================================================');
  return avg;
}

function bytesToSize(bytes) {
  let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes == 0) {
    return '0 Byte';
  }
  let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};
