/**
 * meterset.js
 * TCP клиент для счетчика СЭТ
 * Протокол - Modbus RTU, подсеть RS-485 через MOXA Nport -> TCP
 *
 */
// const util = require("util");

const channels = require("./lib/channels");

// Standard IH plugin
const plugin = require("./lib/plugin").Plugin({
  host: "192.168.0.221",
  port: 4001,
  password: "000000",
  ntariffs: 3,
  meterType:"02",
  metering: [
    { mid: "P", period: 1 },
    { mid: "Q", period: 1 },
    { mid: "S", period: 1 },
    { mid: "I", period: 1 },
    { mid: "U", period: 1 },
    { mid: "E", period: 1 },
    { mid: "ES", period: 1 },
    { mid: "f", period: 10 },
    { mid: "cos", period: 1 },
    { mid: "Kuf", period: 1 },
    { mid: "T", period: 10 }
  ]
});

// Wraps a client connection to TCP
const agent = require("./lib/agent").Agent();

plugin.log("Plugin has started.");

// Запрос параметров с сервера
plugin.getFromServer("params");

plugin.on("params", () => {
  // Получили параметры - генерируем каналы и отдаем их на сервер
  plugin.sendToServer("channels", channels.formChannels(plugin.params));

  // Cоединяемся со счетчиком
  agent.connect(plugin.params);
});

/* Agent event listeners */
agent.on("connect", () => {
  plugin.log("Connected!!", 1);
});

agent.on("log", (text, level) => {
  plugin.log(text, level);
});

agent.on("data", (data) => { 
  if (data) plugin.sendToServer("data", data);
});

// Фатальная ошибка - выход плагина
agent.on("error", txt => {
    
  processExit(1, txt);
});

/* Private functions */
/*
function logError(err, txt = "") {
  plugin.log(txt + " ERROR! " + JSON.stringify(err));
}
*/

function processExit(errcode = 0, txt = "") {
  //  Close connection
  agent.end();

  if (txt) plugin.log(txt);
  setTimeout(() => {
    process.exit(errcode);
  }, 300);
}
