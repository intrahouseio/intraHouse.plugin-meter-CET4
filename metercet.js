/**
 * meterset.js
 * TCP клиент для счетчика СЭТ
 * Протокол - Modbus RTU, подсеть RS-485 через MOXA Nport -> TCP
 *
 */
// const util = require("util");

const channels = require("./lib/channels");

// Standard IH plugin
const plugin = require("./lib/plugin").Plugin( {
    host: "192.168.0.221",
    port: 4001,
    password:"000000",
    ntariffs:3,
    metering:[
      { "mid": "P", "period": 1 },
      { "mid": "Q", "period": 1 },
      { "mid": "I", "period": 1 },
      { "mid": "E", "period": 11 },
      { "mid": "f", "period": 10 },
      { "mid": "T", "period": 60 }
    ]
  });

// Wraps a client connection to TCP
const agent = require("./lib/agent");

agent.start(plugin);

plugin.log("Plugin has started.");

// Запрос параметров с сервера
plugin.getFromServer("params"); 

plugin.on("params", () => {
  // Получили параметры - генерируем каналы и отдаем их на сервер
  plugin.sendToServer("channels", channels.formChannels(plugin.params));

  // Cоединяемся со счетчиком
  agent.connect(plugin.params);
});


