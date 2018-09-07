/**
 * agent.js
 * Работа через tcp клиент
 */

// const util = require("util");
const net = require("net");

const protocol = require("./protocol");

module.exports = {
  start(plugin) {
    this.plugin = plugin;
    this.state = 0; // 0- Нет связи, 1 - связь есть, получен адрес, 2 - соединение уст-но, 3 - циклический опрос
    this.serviceReq = 0;
    this.infoReq = 0;
    this.infoPar = 0;
    this.tarif = 0; // 1-8 номер тарифа, 1 - по всем тарифам
    this.meterIdx = 0;

    this.kti = 1; // Коэф по току
    this.ktu = 1; // Коэф по напряжению
    this.constant = 1250; //
    this.snumber = ""; //
    this.kt = 1;

    this.tosend = [];
    this.waiting = "";
    this.sendTime = 0; // Время последней посылки
    this.host = "";
    this.port = 0;
    this.address = 0;
  },

  connect({ host, port, ntariffs, metering }) {
    this.host = host;
    this.port = port;
    this.ntariffs = ntariffs;

    // Построить массив для опроса на базе metering
    this.metering = metering.map(item => Object.assign({count:0}, item));



    this.client = net.createConnection({ host, port }, () => {
      this.plugin.log(host + ":" + port + " connected");

      this.state = 0;
      this.sendNext();
      // let buf = protocol.readReq(0);
      // this.client.write(buf);

      // this.tosend = protocol.getPollArray(this.plugin.points);
      // this.logger.log(
      //  "points: " + util.inspect(this.plugin.points),
      //  "connect"
      // );

      // this.sendNext();
    });

    // 3 сек. Этот таймаут контролирует только прием данных, keepalive не учитывает
    /*
    this.client.setTimeout(30000, () => {
      if (this.waiting) {
        // TODO Возможно, здесь нужно формировать ошибку устройства, которое не отзывается
        logger.log("Timeout error! No response for " + this.waiting);
        this.waiting = "";
      }
      this.sendNext();
    });

    
    setInterval( this.checkResponse.bind(this),1000);
    */

    this.client.on("end", () => {
      this.plugin.log("disconnected", "connect");
      process.exit(1);
    });

    this.client.on("error", e => {
      this.client.end();
      this.plugin.log(
        this.host + ":" + this.port + " connection error:" + e.code
      );
      process.exit(1);
    });

    this.client.on("data", data => {
      console.log("GET BUFFER");
      console.log(data);

      // Обработка полученного сообщения
      this.processIncomingMessage(data);

      // Отправка следующего сообщения
      this.sendNext();

      /*  
      // Перед следующей посылкой делаем задержку 100 мсек
      setTimeout(
        this.sendNext.bind(this)
      , 100); // 100
      */
    });
  },

  stop() {
    if (this.client) this.client.end();
  },

  checkResponse() {
    if (Date.now() - this.sendTime > 500) {
      // 500 mc
      if (this.waiting) {
        let adr = Number(this.waiting.substr(0, 2));
        this.plugin.sendDataToServer(
          protocol.deviceError(adr, "Timeout error! No response")
        );
        this.waiting = "";
      }
      this.sendNext();
    }
  },


  sendToUnit(payload) {
    if (!payload) return;
    try {
      let msg = protocol.formSendMessage(payload);
      this.client.write(msg);
      this.logger.log("<= " + msg, "out");
      this.sendTime = Date.now();
    } catch (e) {
      this.logger.log("ERROR write: " + payload, "out");
    }
  },

  processIncomingMessage(buf) {
    let res;  

    switch (this.state) {
      case 0: // Тестирование канала с нулевым адресом - получен адрес
        this.address = buf[0];
        this.state = 1;
        break;

      case 1: // Ответ на запрос соединения
        this.state = 2;
        this.serviceReq = 1;
        break;

      case 2: // Ответ сервисный запрос
        this.processServiceMessage(buf);

        this.serviceReq += 1;
        if (this.serviceReq >= 4) {
          this.serviceReq = 0;

          this.state = 3;
          this.infoReq = 1;
          this.tarif = 0;
          this.infoPar = 0;
        }
        break;

      case 3: // Ответ на информационный запрос
     
        res = protocol.meteringData(this.metering[this.meterIdx].mid, buf);
        console.log(res);
        this.plugin.sendToServer('data', res);
        this.meterIdx += 1;
        if (this.meterIdx >= this.metering.length) this.meterIdx=0;
      

      /*
       
        if (this.infoReq == 1) {
          this.tarif += 1;

          if (this.tarif > 8) {
            this.infoReq = 2;
            this.infoPar = 1;
          }
        } else if (this.infoReq == 2) {
          console.log("this.infoReq = " + this.infoReq);
          this.infoPar += 1;
          if (this.infoPar > 4) {
            this.infoReq = 3;
            process.exit();
          }
        } else {
          process.exit();
        }
        */
       

        break;

      default:
    }
  },

  processServiceMessage(buf) {
    switch (this.serviceReq) {
      case 1:
        this.kti = buf.readUInt16BE(1);
        this.ktu = buf.readUInt16BE(3);
        console.log("REQ 1: kti=" + this.kti + " ktu=" + this.ktu);
        break;

      case 2:
        this.snumber = buf.readUInt32BE(1);
        console.log("REQ 2: snumber=" + this.snumber);
        break;

      case 3:
        this.constant = buf[3];
        console.log("REQ 3: constant=" + this.constant);
        break;

      default:
    }
  },

  processInfoMessage(buf) {
    
    let res = protocol.meteringData(this.metering[this.meterIdx].mid, buf)
    console.log(JSON.stringify(res));
    /*
    if (this.infoReq == 1) {
      let v1 = buf.readUInt32BE(1) / 2500;
      let v2 = buf.readUInt32BE(5) / 2500;
      let v3 = buf.readUInt32BE(9) / 2500;
      let v4 = buf.readUInt32BE(13) / 2500;
      console.log(
          " v1 " +
          v1 +
          " v2 " +
          v2 +
          " v3 " +
          v3 +
          " v4 " +
          v4
      );
    } else {
      let v1 = buf.readFloatLE(1);
      let v2 = buf.readFloatLE(5);
      let v3 = buf.readFloatLE(9);
      let v4 = buf.readFloatLE(13);
      console.log(" all " + v1 + " f1 " + v2 + " f2 " + v3 + " f3 " + v4);
    }
    */
  },

  sendNext() {
    let buf;

    switch (this.state) {
      // Адрес получен - открыть соединение
      case 1: // адрес
        // buf = Buffer.from([0,0,0,0]);
        buf = Buffer.alloc(10, 0);
        buf[0] = this.address;
        buf[1] = 0x1; // Запрос на открытие канала
        buf[2] = 0x30; // Пароль
        buf[3] = 0x30; // Пароль
        buf[4] = 0x30; // Пароль
        buf[5] = 0x30; // Пароль
        buf[6] = 0x30; // Пароль
        buf[7] = 0x30; // Пароль
        break;

      case 2: // сервисные запросы
        buf = protocol.getServiceReq(this.serviceReq);
        break;

      case 3: // информационные запросы
        console.log(this.meterIdx+' mid='+this.metering[this.meterIdx].mid);
        buf = protocol.getMeteringReq(this.metering[this.meterIdx].mid);
        // console.log('INFO REQ CYCLE');
        // process.exit();
        break;
      // Проверка соединения
      default:
        buf = Buffer.alloc(4, 0);
        this.state = 0;
    }

    // Добавить контрольную сумму
    if (buf) {
      // Добавить адрес если он уже известен
      if (this.state > 0) buf[0] = this.address;
      buf.writeUInt16LE(protocol.crc16(buf, buf.length - 2), buf.length - 2);

      console.log("SEND");
      console.log(buf);
      this.client.write(buf);
    }
  }
};
