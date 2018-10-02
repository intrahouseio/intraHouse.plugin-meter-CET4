
const util = require("util");

exports.formChannels = formChannels;

function formChannels({ metering, ntariffs }) {
  if (!metering || !util.isArray(metering)) return [];

  let res = [];
  metering.forEach(item => {
    let vals =
      item.mid == "E" ? energyChannels(ntariffs) : meteringChannels(item.mid);
    if (vals) res.push(...vals);
  });
  return res;
}

function energyChannels(ntariffs) {
    let result = [];
    if (ntariffs == 1) ntariffs = 0;
    
    ['EAP','EAM','ERP','ERM'].forEach(item => {
        for (let t=0; t<=ntariffs; t++) {
            result.push({id:item+(t ? 'T'+t : ''), note: nameOfEnergy(item, t), desc: "SensorA" });
        }
    });
    return result;
}

function nameOfEnergy(eid, t) {
    let tstr = (t ? ' тариф '+t : '');
    switch (eid) {
        case 'EAP': return 'Энергия активная A+ '+tstr;
        case 'EAM': return 'Энергия активная A- '+tstr;
        case 'ERP': return 'Энергия реактивная R+ '+tstr;
        case 'ERM': return 'Энергия реактивная R- '+tstr;
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
    case "Кuf":
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
      case "Кuf":
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
        return "Энергия ";
      default:
    }
  }
  
  function phase(i) {
    return i ? " по фазе " + i : " по всем фазам ";
  }