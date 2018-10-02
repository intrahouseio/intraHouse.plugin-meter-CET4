const child = require("child_process");

let ps = child.fork("./metercet.js");



ps.on("message", mes => {
  console.log("Message: " + JSON.stringify(mes));
  if (mes.type == "get") {

    switch (mes.tablename) {
      case "params":
        ps.send({ type: "get", params: { host: "localhost", port: 4001, meterType:"02"} });
        break;

      case "config":
        ps.send({
          type: "get",
          config: [
           
          ]
        });
        break;
        
      default:
    }
  }
});

ps.on("close", code => {
  console.log("PLUGIN CLOSED. code=" + code);
});
