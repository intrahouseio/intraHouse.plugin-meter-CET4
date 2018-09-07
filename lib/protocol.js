/**
 * Функции разбора и формирования данных
 */
// const util = require("util");

exports.crc16 = crc16;
exports.hexVal = hexVal;
exports.getServiceReq = getServiceReq;
exports.getMeteringReq = getMeteringReq;
exports.meteringData = meteringData;

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

function meteringData(mid, buf) {
  switch (mid) {
    // Чтение массивов учтенной энергии по тарифам
    case "E":
      return read4Energy(mid, buf);

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
      return { id: "f", value: buf.readFloatLE(1) };
    case "T":
      return { id: "T", value: buf[2] };

    default:
  }
}

function read4Energy(mid, buf) {
  let res = [];
  res.push(buf.readUInt32BE(1) / 2500);
  res.push(buf.readUInt32BE(5) / 2500);
  res.push(buf.readUInt32BE(9) / 2500);
  res.push(buf.readUInt32BE(13) / 2500);
  return [
    { id: "EAP", value: res[0] },
    { id: "EAM", value: res[1] },
    { id: "ERP", value: res[2] },
    { id: "ERM", value: res[3] }
  ];
}

function read4Float(mid, buf) {
  let res = [];
  res.push(buf.readFloatLE(1));
  res.push(buf.readFloatLE(5));
  res.push(buf.readFloatLE(9));
  res.push(buf.readFloatLE(13));
  return res.map((value, idx) => ({ id: mid + String(idx), value }));
}

function getServiceReq(nReq) {
  switch (nReq) {
    // Чтение коэффициентов трансформации
    case 1:
      return Buffer.from([0, 0x8, 0x2, 0, 0]);

    // Чтение серийного номера
    case 2:
      return Buffer.from([0, 0x8, 0x0, 0, 0]);

    // Чтение варианта исполнения (постоянная счетчика)
    case 3:
      return Buffer.from([0, 0x8, 0x12, 0, 0]);

    default:
  }
}

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

/**
 * Calculates the buffers CRC16.
 *
 * @param {Buffer} buffer the data buffer.
 * @return {number} the calculated CRC16.
 */
function crc16(buffer, len) {
  var crc = 0xffff;
  var odd;
  if (!len) len = buffer.length;

  for (var i = 0; i < len; i++) {
    crc = crc ^ buffer[i];

    for (var j = 0; j < 8; j++) {
      odd = crc & 0x0001;
      crc = crc >> 1;
      if (odd) {
        crc = crc ^ 0xa001;
      }
    }
  }

  return crc;
}
