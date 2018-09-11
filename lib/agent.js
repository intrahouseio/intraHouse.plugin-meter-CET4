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

    // Состояние: 0- Нет связи, 1 - связь есть, получен адрес, 2 - соединение уст-но, 3 - циклический опрос
    this.state = 0;

    // Номер сервисного запроса
    this.serviceReq = 0;
    this.tarif = 0; // 1-8 номер тарифа, 0 - по всем тарифам
    this.meterIdx = 0;
    this.assets = {
      kti: 1, // Коэф по току
      ktu: 1, // Коэф по напряжению
      constant: 1250
    };

    this.kt = 1;
    this.address = 0; // Адрес счетчика
    this.waiting = 0;
    this.sendTime = 0; // Время последней посылки
  },

  connect({ host, port, ntariffs, metering }) {
    this.host = host;
    this.port = port;
    this.ntariffs = ntariffs;

    // Построить массив для опроса на базе metering
    this.metering = metering.map(item => Object.assign({ count: 0 }, item));

    this.client = net.createConnection({ host, port }, () => {
      this.plugin.log(host + ":" + port + " connected");
      this.state = 0;
      this.sendNext();
      setInterval(this.checkResponseAndCount.bind(this), 1000);
    });

    this.client.on("data", data => {
      this.processIncomingMessage(data);
      this.sendNext();
    });

    this.client.on("end", () => {
      this.plugin.log("disconnected", "connect");
      process.exit(1);
    });

    this.client.on("error", e => {
      this.exit(1, this.host + ":" + this.port + " connection error:" + e.code);
    });
  },

  // Выполняет 3 задачи!!
  // 1. Проверяет, что счетчик на связи - ожидание не более 1 сек
  //    Если нет - закрыть соединение и выйти, т к связываемся только с одним счетчиком
  // 2. Отнять 1 сек в поле count
  // 3. Если опрос не идет - запустить опрос для первого ненулевого счетчика
  checkResponseAndCount() {
    if (this.waiting && Date.now() - this.sendTime > 1000) {
      this.exit(1, this.host + ":" + this.port + " Timeout error!");
    }

    let readyIdx = -1;
    this.metering.forEach((item, idx) => {
      if (item.count) item.count -= 1;
      if (!item.count) readyIdx = idx;
    });

    if (!this.waiting && readyIdx >= 0) {
      this.meterIdx = readyIdx;
      this.sendToUnit(
        protocol.getMeteringReq(this.metering[readyIdx].mid, this.tarif)
      );
    }
  },

  processIncomingMessage(buf) {
    let res;

    this.plugin.log("=> " + buf.toString("hex"));
    this.waiting = 0;

    switch (this.state) {
      case 0: // Тестирование канала с нулевым адресом - получен адрес
        this.address = buf[0];
        this.state = 1;
        break;

      case 1: // Получен ответ на запрос соединения
        this.state = 2;
        this.serviceReq = 1;
        break;

      case 2: // Получен ответ на сервисный запрос
        res = protocol.readServiceMessage(this.serviceReq, buf);
        if (res) {
          // Включить параметры в assets
          Object.assign(this.assets, res);
          this.plugin.log(res);
        } else {
          this.plugin.log(
            "Service request " +
              this.serviceReq +
              ". Invalid service message " +
              buf.toString("hex") +
              "\nSkipped"
          );
        }
        this.serviceReq += 1;

        // Если больше запросов нет - переход на информационные запросы
        if (!protocol.getServiceReq(this.serviceReq)) {
          this.serviceReq = 0;

          // Посчитать коэффициент для энергии = kti*ktu/2*const
          this.kt =
            (this.assets.kti * this.assets.ktu) / (2 * this.assets.constant);
          console.log("this.kt=" + this.kt);
          this.state = 3;
          this.tarif = 0;
          this.meterIdx = 0;
        }
        break;

      case 3: // Получен ответ на информационный запрос
        if (this.metering[this.meterIdx].mid == "E") {
          res = protocol.read4Energy(buf, this.kt, this.tarif);
        } else {
          res = protocol.readMeteringData(this.metering[this.meterIdx].mid,buf);
        }

        console.log(res);
        this.plugin.sendToServer("data", res);
        break;

      default:
        this.exit(
          3,
          "ERROR: processIncomingMessage SOFT ERROR. Unknown state = " +
            this.state
        );
    }
  },

  sendNext() {
    let buf;
    switch (this.state) {
      // Проверка соединения
      case 0:
        buf = protocol.getFirstReq();
        break;

      // Открыть соединение
      case 1:
        buf = protocol.getOpenReq();
        break;

      // сервисные запросы
      case 2:
        buf = protocol.getServiceReq(this.serviceReq);
        break;

      // информационные запросы
      case 3:
        if (this.selectInfoReqToSend()) {
          buf = protocol.getMeteringReq(
            this.metering[this.meterIdx].mid,
            this.tarif
          );
        }
        break;

      default:
        this.exit(
          3,
          "ERROR: sendNext SOFT ERROR. Unknown state = " + this.state
        );
    }
    // Возможно, что ничего не посылаем, т к чтение происходит через интервал
    // Тогда следующее чтение будет запущено по таймеру
    if (buf) this.sendToUnit(buf);
  },

  // Сдвигает указатель индекса массива на запрос, который нужно выполнить (count=0)
  // Если нет элементов с count=0 - указатель останется на той же позиции?
  // Возвращает true, если нужно выполнить запрос
  selectInfoReqToSend() {
    let lastIdx = this.meterIdx; // Это указатель на текущий запрос, который был выполнен
    let idx = lastIdx;

    // Если по тарифам - то это будет тот же запрос, но с другим тарифом!!
    if (this.metering[idx].mid == "E") {
      this.tarif += 1;
      if (this.tarif <= this.ntariffs) return true;

      this.tarif = 0;
    }

    idx = this.nextMeterIdx(this.meterIdx);
    while (this.metering[idx].count) {
      if (idx == lastIdx) return false; // Прошли по кругу - пока ничего не запрашиваем
      idx = this.nextMeterIdx(idx);
    }

    // Нашли нулевой count
    this.meterIdx = idx;
    // восстановить count из period для следующего раза
    if (this.metering[idx].period)
      this.metering[idx].count = this.metering[idx].period;

    return true;
  },

  nextMeterIdx(idx) {
    return idx + 1 < this.metering.length ? idx + 1 : 0;
  },

  sendToUnit(buf) {
    try {
      if (!buf) throw { message: "Empty buffer!" };
      if (!Buffer.isBuffer(buf)) throw { message: "Buffer is not a Buffer!" };

      // Добавить адрес если он уже известен
      if (this.state > 0) buf[0] = this.address;

      protocol.setCRC(buf);
      console.log("SEND");
      console.log(buf);

      this.client.write(buf);
      this.plugin.log("<= " + buf.toString("hex"));
      this.sendTime = Date.now();
      this.waiting = 1;
    } catch (e) {
      this.exit(
        2,
        "ERROR sendToUnit: " +
          e.message +
          (buf ? " Buffer:" + buf.toString("hex") : "")
      );
    }
  },

  exit(code, mess) {
    if (this.client) this.client.end();
    if (mess) this.plugin.log(mess);
    process.exit(code || 0);
  }
};
