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
  ntariffs:8,
  metering:[
    { "mid": "P", "period": 0 },
    { "mid": "Q", "period": 0 },
    { "mid": "S", "period": 0 },
    { "mid": "I", "period": 0 },
    { "mid": "U", "period": 0 },
    { "mid": "E", "period": 1 },
    { "mid": "f", "period": 10 },
    { "mid": "T", "period": 60 },
    { "mid": "cos", "period": 10 },
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

  // Запрос каналов с сервера
  plugin.getFromServer("config"); 
});

// Каналы для получения данных
// plugin.on("config", data => {
plugin.on("config", () => {
  // converter.createSubMap(data);
});

plugin.on("connect", () => {
  
  
});

