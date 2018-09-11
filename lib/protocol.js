/**
 * Функции разбора и формирования данных по протоколу счетчика СЭТ-4ТМ
 *  на основе документации производителя:
 *
 *  Протокол обмена счетчиков серии СЭТ-4ТМ Редакция 6.6.27 от 18.09.2017
 */

// const util = require("util");

exports.setCRC = setCRC;
exports.checkCRC = checkCRC;

exports.getFirstReq = getFirstReq;
exports.getOpenReq = getOpenReq;
exports.getServiceReq = getServiceReq;
exports.getMeteringReq = getMeteringReq;

exports.readServiceMessage = readServiceMessage;
exports.readMeteringData = readMeteringData;
exports.read4Energy = read4Energy;

exports.nameOfServiceProp = nameOfServiceProp;

/**
 * Функции, формирующие запросы (get)
 *
 * Возвращают Buffer, в который подставлены два последних байта для контрольной суммы
 * Если элемент представлен как 0x0 - это константа, как 0 - элемент будет заменен (1 байт - адрес, 2 последних - CRC)
 *
 * Функции разбора входящих сообщений (read)
 *  Возвращают объект или массив объектов
 */

// Первый запрос - тестирование связи - передается 0 по 0 адресу
// В ответе (первый байт) получим адрес
function getFirstReq() {
  return Buffer.from([0x0, 0x0, 0, 0]);
}

// Запрос на открытие канала - передается пароль - 6 символов
// Пример для счетчика в адресом 53 и паролем по умолчанию
// <= 53 01 30 30 30 30 30 30 4B 0D
// => 53 00 3D 40 - OK
function getOpenReq(password) {
  if (!password) password = "000000"; // 0x30,0x30,..
  return Buffer.concat([
    Buffer.from([0, 0x1]),
    Buffer.from(password),
    Buffer.from([0, 0])
  ]);
}

// Запросы на чтение параметров (сервисные запросы)
function getServiceReq(nReq) {
  switch (nReq) {
    // Чтение серийного номера
    case 1:
      return Buffer.from([0, 0x8, 0x0, 0, 0]);

    // Чтение коэффициентов трансформации для счетчика
    case 2:
      return Buffer.from([0, 0x8, 0x2, 0, 0]);

    // Чтение варианта исполнения (постоянная счетчика)
    case 3:
      return Buffer.from([0, 0x8, 0x12, 0, 0]);

    default:
  }
}

// Чтение ответов на сервисные запросы
// Все примеры для счетчика с адресом 53 и включая CRC
function readServiceMessage(serviceReq, buf) {
  if (!buf || !Buffer.isBuffer(buf)) return;

  let robj;
  switch (serviceReq) {
    // 1. Чтение серийного номера, код параметра 00
    //  <= 53 08 00 86 11
    // Возвращает 7 байт в поле данных (+1 байт адрес +2 CRC) = 10
    //  => 53 2F FE 19 57 17 05 18 70 D6
    // 1-4 байт - серийный номер счетчика в двоичном виде
    // 5-7 байт - дата выпуска в двоично/десятичном виде: число, месяц, год
    case 1:
      if (buf.length == 10) {
        robj = {
          snumber: buf.readUInt32BE(1)
        };
        /* Двоично - дестичный вид - это по тетрадам!!
        robj = {
            snumber: buf.readUInt32BE(1),
            product_date:
              pad(buf[5], 2) + "-" + pad(buf[6], 2) + "-" + String(2000 + buf[7])
          };
        */
      }
      break;

    // 2. Чтение коэффициентов трансформации, код параметра 02h
    //  <= 53 08 02 07 D0
    // Возвращает 10 байт в поле данных (+1 байт адрес +2 CRC) = 13
    //  => 53 00 01 00 01 00 00 00 00 00 00 15 F1
    // 1-2 байт - коэф трансформ по напряжению
    // 3-4 байт - коэф трансформ по току
    // 5 байт: 0- кВт, 1 - мВт
    // 6-10 - Текущий коэф-т трансформации, для счетчиков СЭТ-4ТМ.03 возвращают нули
    case 2:
      if (buf.length == 13) {
        robj = { ktu: buf.readUInt16BE(1), kti: buf.readUInt16BE(3) };
      }
      break;

    // 3. Чтение варианта исполнения, код параметра 12h (п2.4.3.26)
    //  <= 53 08 12 06 1C
    // Возвращает 3 байт в поле данных (+1 байт адрес +2 CRC) = 6
    //  => 53 64 42 80 61 BF
    // 1 байт
    //  0-1 бит Номинальный ток: 0 - 5A, 1 - 1A, 2 - 10A
    //  2-3 бит Номинальное напряжение: 0 - 57.7, 1 - 120-230 В
    //  4-5 бит Класс точности по реактивной энергии: 0 - 3
    //  6-7 бит Класс точности по активной энергии: 0 - 3
    // 2 байт
    //  0-3 бит Постоянная счетчика, имп/квт*ч: 0 - 5000, 1 - 2500, 2 - 1250, 3 - 6250, 4 - 500, 5 - 250, 6 - 6400
    //  4-5 бит Число фаз счетчика: 0 - 3 фазы, 1 - 1 фаза
    //  6   бит Температурный диапазон 0 - 20 гр, 1 - 40 гр
    //  7   бит Число направлений: 0 - 2 направления, 1 - одно
    // 3 байт - РАЗЛИЧНЫЕ ДАННЫЕ для разных счетчиков
    //      Здесь для СЭТ-4ТМ.03 СЭТ-4ТМ.03М
    //  0 бит Кол-во интерфейсов RS-485: 0 - два, 1 - один
    //  1 бит Резервный источник: 0 - есть, 1 - нет
    //  2-3 бит нули
    //  4-7 бит тип счетчика: 01h - СЭТ-4ТМ.03, 08h - СЭТ-4ТМ.03M

    // Пока беру только постоянную счетчика!
    case 3:
      robj = { constant: meterConstant(buf[2] & 0x0f) };
      break;

    default:
  }
  return robj;
}

function meterConstant(val) {
  switch (val) {
    case 0:
      return 5000;
    case 1:
      return 2500;
    case 2:
      return 1250;
    case 3:
      return 6250;
    case 4:
      return 500;
    case 5:
      return 250;
    case 6:
      return 6400;
    default:
      return 0;
  }
}

function nameOfServiceProp(prop) {
  switch (prop) {
    case "ktu":
      return "Коэффициент трансформации по напряжению";
    case "kti":
      return "Коэффициент трансформации по току";
    case "snumber":
      return "Серийный номер счетчика";
    case "product_date":
      return "Дата выпуска";
    default:
      return "";
  }
}


// mid - measured id
function getMeteringReq(mid, param) {
  param = param || 0;

  switch (mid) {
    // Чтение массивов учтенной энергии по тарифам
    case "E":
      return Buffer.from([0, 0x5, 0x9, param, 0, 0]);

    // Чтение данных вспомогательных режимов
    case "I":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x20, 0, 0]);
    case "U":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x10, 0, 0]);
    case "P":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x00, 0, 0]);
    case "Q":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x04, 0, 0]);
    case "S":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x08, 0, 0]);
    case "f":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x41, 0, 0]);
    case "T":
      return Buffer.from([0, 0x8, 0x01, 0, 0]);

    case "cos":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x30, 0, 0]);
    case "Kuf":
      return Buffer.from([0, 0x8, 0x1b, 0x02, 0x80, 0, 0]);

    default:
  }
}

function readMeteringData(mid, buf) {
  switch (mid) {
    // Чтение данных вспомогательных режимов
    case "I":
    case "U":
    case "P":
    case "Q":
    case "cos":
    case "Kuf":
    case "S":
      return read4Float(mid, buf);

    case "f":
      return [{ id: "f", value: buf.readFloatLE(1) }];
    case "T":
      return [{ id: "T", value: buf[2] }];

    default:
  }
}

// Чтение массивов учтенной энергии по тарифам: A+ A- R+ R-
function read4Energy(buf, kt, tarif) {
  let res = [];
  if (!kt) kt = 1;
  let tstr = tarif ? "T" + tarif : "";
  console.log("read4Energy kt=" + kt);
  console.log("var1=" + buf.readUInt32BE(1));

  res.push(buf.readUInt32BE(1) * kt);
  res.push(buf.readUInt32BE(5) * kt);
  res.push(buf.readUInt32BE(9) * kt);
  res.push(buf.readUInt32BE(13) * kt);
  return [
    { id: "EAP" + tstr, value: round(res[0]) },
    { id: "EAM" + tstr, value: round(res[1]) },
    { id: "ERP" + tstr, value: round(res[2]) },
    { id: "ERM" + tstr, value: round(res[3]) }
  ];
}

function read4Float(mid, buf) {
  let res = [];
  res.push(buf.readFloatLE(1));
  res.push(buf.readFloatLE(5));
  res.push(buf.readFloatLE(9));
  res.push(buf.readFloatLE(13));
  return res.map((val, idx) => ({ id: mid + String(idx), value: round(val) }));
}

function round(val) {
  return Math.round(val * 1000) / 1000;
}
/*
function hexVal(val, width) {
  return pad(val.toString(16).toUpperCase(), width);
}


function pad(val, width) {
  let numAsString = val + "";
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = "0" + numAsString;
  }
  return numAsString;
}
*/

function setCRC(buf) {
  return buf && Buffer.isBuffer(buf)
    ? buf.writeUInt16LE(crc16(buf, buf.length - 2), buf.length - 2)
    : "";
}

function checkCRC(buf) {
  if (buf && Buffer.isBuffer(buf)) {
    return buf.readUInt16LE(buf.length - 2) == crc16((buf, buf.length - 2));
  }
}
/**
 * Calculates the buffers CRC16.
 *
 * @param {Buffer} buffer the data buffer.
 * @return {number} the calculated CRC16.
 */
function crc16(buffer, len) {
  let crc = 0xffff;
  let odd;
  if (!len) len = buffer.length;

  for (let i = 0; i < len; i++) {
    crc = crc ^ buffer[i];

    for (let j = 0; j < 8; j++) {
      odd = crc & 0x0001;
      crc = crc >> 1;
      if (odd) {
        crc = crc ^ 0xa001;
      }
    }
  }

  return crc;
}
