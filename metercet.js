/**
 * meterset.js
 * TCP клиент для счетчика СЭТ
 * Протокол - Modbus RTU, подсеть RS-485 через MOXA Nport -> TCP
 *
 */
// const util = require("util");

const defaultPluginParams = {
  host: "192.168.0.221",
  port: 4001,
  ntariffs:3,
  metering:[
  //  { "mid": "P", "period": 10 },
  //  { "mid": "Q", "period": 1 },
  //  { "mid": "S", "period": 1 },
  //  { "mid": "I", "period": 1 },
  //  { "mid": "U", "period": 1 },
    { "mid": "E", "period": 10 },
  //  { "mid": "f", "period": 10 },
  //  { "mid": "T", "period": 60 },
  //  { "mid": "cos", "period": 10 },
    { "mid": "Kuf", "period": 10 }
  ]
};

// Standard IH plugin
const plugin = require("./lib/plugin").Plugin(defaultPluginParams);

// Wraps a client connection to TCP
const agent = require("./lib/agent");

agent.start(plugin);

plugin.log("Plugin has started.");

// Запрос параметров с сервера
plugin.getFromServer("params"); 

plugin.on("params", () => {
  // Можно соединиться со счетчиком
  agent.connect(plugin.params);
});


