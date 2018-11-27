/**
 * agent.js
 * Работа через tcp клиент
 */

const util = require("util");
const net = require("net");

const protocol = require("./protocol");

exports.Agent = Agent;

/**
 * Agent constructor
 * Methods:
 *   connect
 *   checkResponseAndCount
 *   processIncomingMessage
 *   sendNext
 *   selectInfoReqToSend
 *   nextPollIdx
 *   sendToUnit
 *   end
 */
function Agent(params) {
  if (!(this instanceof Agent)) return new Agent(params);

  // Состояние: 0- Нет связи, 1 - связь есть, получен адрес, 2 - соединение уст-но, 3 - циклический опрос
  this.state = 0;

  // Номер сервисного запроса
  this.serviceReq = 0;

  this.assets = {
    kti: 1, // Коэф по току
    ktu: 1, // Коэф по напряжению
    ks: 1, // Коэф Кс для мгновенных мощностей, зависит от Inom, Unom
    constant: 1250, // Постоянная счетчика
    kt: (1 * 1) / (2 * 1250) // Общий коэф-т для расчета энергии
  };

  this.started = 0;

  this.address = 0; // Адрес счетчика
  this.waiting = 0; // Флаг ожидания
  this.sendTime = 0; // Время последней посылки
}
util.inherits(Agent, require("events").EventEmitter);

Agent.prototype.connect = function({
  host,
  port,
  metering,
  ntariffs,
  meterType,
  usehandkt,
  handkti,
  handktu,
  ks
}) {
  this.errors = 0;
  this.host = host;
  this.port = port;
  this.ntariffs = ntariffs;
  this.stopped = true;
  this.usehandkt = usehandkt;

  if (usehandkt) {
    this.assets.kti = handkti;
    this.assets.ktu = handktu;
  }
  this.assets.ks = ks;
  // Построить объект для хранения времени midObj key=mid, value=period
  this.midObj = createPeriodKeyValue(metering);

  // Построить массив для опроса на базе metering
  this.pollArray = protocol.createPollArray(this.midObj, ntariffs, meterType);
  this.pollIdx = 0;
  this.emit("log", "POLL ARRAY:" + util.inspect(this.pollArray), 2);

  this.client = net.createConnection({ host, port }, () => {
    this.stopped = false;
    this.emit("log", host + ":" + port + " connected", 1);
    this.state = 0;

    this.sendToUnit(protocol.getFirstReq());
    // let buf = Buffer.from([0x0, 0x0, 0xff]);
    // this.client.write(buf);
    // this.emit("log", "<= " + buf.toString("hex"), 1);

    setInterval(this.checkResponseAndCount.bind(this), 1000);
  });

  this.client.on("data", data => {
    this.processIncomingMessage(data);
    this.sendNext();
  });

  this.client.on("end", () => {
    this.emit("error", "Disconnected");
  });

  this.client.on("error", e => {
    this.emit("error", "Error " + (e ? util.inspect(e) : ""));
  });
};

// Выполняет 3 задачи!!
// 1. Проверяет, что счетчик на связи - ожидание не более 2 сек
//    Если нет - закрыть соединение и выйти, т к связываемся только с одним счетчиком
// 2. Отнять 1 сек в поле count
// 3. Если опрос не идет - запустить опрос для первого ненулевого счетчика
Agent.prototype.checkResponseAndCount = function() {
  if (this.waiting && Date.now() - this.sendTime > 10000) {
    // this.emit("error", this.host + ":" + this.port + " Timeout error!");
    // return;

    this.errors += 1;
    const errstr =
      this.host +
      ":" +
      this.port +
      " Timeout error! Number of ERRORS = " +
      this.errors;
    if (this.errors < 10) {
      this.emit("log", errstr);
      this.waiting = false;
      this.sendNext();
    } else {
      this.emit("error", errstr + "! STOP!");
      return;
    }
  }

  let readyIdx = -1;
  this.pollArray.forEach((item, idx) => {
    if (item.count) item.count -= 1;
    if (item.count == 0) readyIdx = idx;
  });

  if (!this.waiting && readyIdx >= 0) {
    this.pollIdx = readyIdx;
    this.sendToUnit(this.pollArray[readyIdx].buf);
  }
};

Agent.prototype.processIncomingMessage = function(buf) {
  let res;
  if (!buf) return;

  this.waiting = 0;
  this.emit("log", "=> " + buf.toString("hex"), 1);

  if (buf.length < 4) {
    this.emit("error", "Invalid  message length!" + buf.toString("hex"));
    return;
  }

  // Проверяем КС
  if (!protocol.checkCRC(buf)) {
    this.emit("log", "CRC ERROR!" + buf.toString("hex"));
    protocol.setCRC(buf);
    this.emit("log", "Expected " + buf.toString("hex"));
    return;
  }

  // Можем получить 4 байта или больше Если 4 байта - м б ошибка!!
  if (buf.length == 4) {
    // Считать байт состояния обмена - д б 0
    if (buf[1] > 0) {
      this.emit("error", protocol.getErrorTxt(buf[1]));
      return;
    }
  }

  this.errors = 0;
  switch (this.state) {
    case 0: // Тестирование канала с нулевым адресом - получен адрес
      /*
      if (!this.started) {
        // Ответ на первый запрос
        if (buf[0]) {
          // Получен ненулевой адрес
          this.address = buf[0];
          this.state = 1;
        }
        // else при первой попытке Адрес нулевой - будем пытаться получить адрес с помощью специальной команды для чтения адреса
        this.started = 1; // получен хоть один ответ
      } else {
        // Ответ на запрос адреса - возвращает во 2 байте - берем любой
        this.address = buf[2];
        this.state = 1;
      }
      */

      this.address = buf[0];
      this.state = 1;

      if (this.address)
        this.emit("log", "Meter address: " + this.address.toString(16));
      break;

    case 1: // Получен ответ на запрос соединения
      this.state = 2;
      this.serviceReq = 1;
      break;

    case 2: // Получен ответ на сервисный запрос
      res = protocol.readServiceMessage(this.serviceReq, buf);
      if (res) {
        // Включить параметры в assets
        if (this.usehandkt) {
          // Берем только константу!!
          this.assets.constant = res.constant;
        } else Object.assign(this.assets, res);

        this.emit("log", res);
      } else {
        this.emit(
          "log",
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
        this.assets.kt =
          (this.assets.kti * this.assets.ktu) / (2 * this.assets.constant);
        this.emit("log", "Коэффициенты: " + JSON.stringify(this.assets), 1);
        this.state = 3;
        this.pollIdx = 0;
      }
      break;

    case 3: // Получен ответ на информационный запрос
      res = protocol.readData(buf, this.pollArray[this.pollIdx], this.assets);

      this.emit("data", res);
      break;

    default:
      this.emit(
        "error",
        "ERROR: processIncomingMessage SOFT ERROR. Unknown state = " +
          this.state
      );
  }
};

Agent.prototype.sendNext = function() {
  let buf;

  switch (this.state) {
    // Попытка получить адрес счетчика
    case 0:
      // buf = protocol.getFirstReq();
      buf = protocol.getAddressReq();
      break;

    // Открыть соединение
    case 1:
      buf = protocol.getOpenReq();
      break;

    // сервисные запросы
    case 2:
      buf = protocol.getServiceReq(this.serviceReq);
      break;

    // циклическое считывание значений
    case 3:
      if (this.selectInfoReqToSend()) {
        buf = this.pollArray[this.pollIdx].buf;
      }
      break;

    default:
      this.emit(
        "error",
        "ERROR: sendNext SOFT ERROR. Unknown state = " + this.state
      );
  }
  // Возможно, что ничего не посылаем, т к чтение происходит через интервал
  // Тогда следующее чтение будет запущено по таймеру
  if (buf) this.sendToUnit(buf);
};

// Сдвигает указатель индекса массива на запрос, который нужно выполнить (count=0)
// Если нет элементов с count=0 - указатель останется на той же позиции?
// Возвращает true, если нужно выполнить запрос
Agent.prototype.selectInfoReqToSend = function() {
  let lastIdx = this.pollIdx; // Это указатель на текущий запрос, который был выполнен
  let idx = lastIdx;

  idx = this.nextPollIdx(this.pollIdx);
  while (this.pollArray[idx].count > 0) {
    if (idx == lastIdx) {
      return false; // Прошли по кругу - пока ничего не запрашиваем
    }
    idx = this.nextPollIdx(idx);
  }

  // Нашли нулевой count
  this.pollIdx = idx;
  // восстановить count из period для следующего раза
  if (this.midObj[this.pollArray[idx].mid])
    this.pollArray[idx].count = this.midObj[this.pollArray[idx].mid];
  return true;
};

Agent.prototype.nextPollIdx = function(idx) {
  return idx + 1 < this.pollArray.length ? idx + 1 : 0;
};

Agent.prototype.sendToUnit = function(buf) {
  try {
    if (this.stopped) return;

    if (!buf) throw { message: "Empty buffer!" };
    if (!Buffer.isBuffer(buf)) throw { message: "Buffer is not a Buffer!" };

    // Добавить адрес если он уже известен
    if (this.state > 0) buf[0] = this.address;

    protocol.setCRC(buf);

    this.client.write(buf);
    this.emit("log", "<= " + buf.toString("hex"), 1);
    this.sendTime = Date.now();
    this.waiting = 1;
  } catch (e) {
    this.emit(
      "error",
      "ERROR sendToUnit: " +
        e.message +
        (buf ? " Buffer:" + buf.toString("hex") : "")
    );
  }
};

Agent.prototype.end = function() {
  this.stopped = true;
  if (this.client) this.client.end();
};

function createPeriodKeyValue(metering) {
  let robj = {};
  metering.forEach(item => {
    if (item.mid) {
      robj[item.mid] = item.period || 0;
    }
  });
  return robj;
}
