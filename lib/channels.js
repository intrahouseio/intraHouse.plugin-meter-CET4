
const util = require("util");

exports.formChannels = formChannels;

function formChannels({ metering, ntariffs }) {
  if (!metering || !util.isArray(metering)) return [];

  let res = [];
  metering.forEach(item => {

    let vals;
    switch (item.mid) {
        case "E": vals = energyChannels(ntariffs, ''); break;
        case "ES": vals = energyChannels(ntariffs, 'S'); break;
        case "EX": vals = energyChannels(ntariffs, 'X'); break;
        default: vals = meteringChannels(item.mid);
    }
    if (vals) res.push(...vals);
  });
  return res;
}

function energyChannels(ntariffs, sut) {
    let result = [];
    if (ntariffs == 1) ntariffs = 0;
  
    
    ['EAP'+sut,'EAM'+sut,'ERP'+sut,'ERM'+sut].forEach(item => {
        for (let t=0; t<=ntariffs; t++) {
            result.push({id:item+(t ? 'T'+t : ''), note: nameOfEnergy(item, t), desc: "Meter" });
        }
    });
    return result;
}

function nameOfEnergy(eid, t) {
    let tstr = (t ? ' тариф '+t : '');
    let itstr = ' всего ';
    let sutstr = ' за сутки ';
    let uptomonstr = ' на начало м-ца';
    switch (eid) {
        case 'EAP': return 'Энергия A+ '+itstr+tstr;
        case 'EAM': return 'Энергия A- '+itstr+tstr;
        case 'ERP': return 'Энергия R+ '+itstr+tstr;
        case 'ERM': return 'Энергия R- '+itstr+tstr;
        case 'EAPS': return 'Энергия A+ '+sutstr+tstr;
        case 'EAMS': return 'Энергия A- '+sutstr+tstr;
        case 'ERPS': return 'Энергия R+ '+sutstr+tstr;
        case 'ERMS': return 'Энергия R- '+sutstr+tstr;
        case 'EAPX': return 'Энергия A+ '+uptomonstr+tstr;
        case 'EAMX': return 'Энергия A- '+uptomonstr+tstr;
        case 'ERPX': return 'Энергия R+ '+uptomonstr+tstr;
        case 'ERMX': return 'Энергия R- '+uptomonstr+tstr;
        default:
    }
}

function meteringChannels(mid) {
  switch (mid) {

    case "I":
    case "U":
      return [1, 2, 3].map(item => ({
        id: mid + item,
        note: nameOfMetering(mid) + " " + phase(item),
        desc: "SensorA"
      }));

    case "P":
    case "Q":
    case "S":
    case "cos":
    case "Kuf":
      return [0, 1, 2, 3].map(item => ({
        id: mid + item,
        note: nameOfMetering(mid) + " " + phase(item),
        desc: "SensorA"
      }));

    case "f":
    case "T":
      return [{ id: mid, note: nameOfMetering(mid), desc: "SensorA" }];

    default:
  }
}

function nameOfMetering(mid) {
    switch (mid) {
      case "P":
        return "Активная мощность";
      case "Q":
        return "Реактивная мощность";
      case "S":
        return "Полная мощность";
      case "cos":
        return "Коэффициент активной мощности";
      case "Kuf":
        return "Коэффициент искажения фазного напряжения";
  
      case "I":
        return "Ток";
      case "U":
        return "Напряжение фазное";
      case "f":
        return "Частота сети ";
      case "T":
        return "Температура ";
      case "Е":
        return "Энергия всего от сброса";

      case "ЕS":
        return "Энергия за текущие сутки";  
      default:
    }
  }
  
  function phase(i) {
    return i ? " по фазе " + i : " по всем фазам ";
  }