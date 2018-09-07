const net = require("net");

let bb = new Buffer(4);
bb[0] = 0xa;
bb[1] = 0xf6;
bb[2] = 0xd8;
bb[3] = 0xc2;



// let res = bb.readUInt32BE(0)/1000;
let res = bb.readFloatLE(0);
console.log( 'LE res '+res);
// res = bb.readFloatBE(0)/1000;
// console.log( 'BE res '+res);
// console.log( 'res '+res);
// console.log( 'res '+bb.readFloatLE(0));


let start = 1;
let client = net.createConnection(
    { host: '192.168.0.221', port: 4001 },
    () => {
      console.log(" connected");
      let buf = new Buffer(10);
      /* тест связи
      buf[0] = 0;
      buf[1] = 0;
      buf[2] = 1;
      buf[3] = 176;
      */

      // Запрос соединения
     buf[0] = 83;
     buf[1] = 1;
     buf[2] = 48;
     buf[3] = 48;
     buf[4] = 48;
     buf[5] = 48;
     buf[6] = 48;
     buf[7] = 48;
     buf[8] = 75;
     buf[9] = 13;

      client.write(buf);

      console.log('WRITE');
      console.log(buf);
    });  


    client.on("end", () => {
        console.log("disconnected");
      });
  
   client.on("error", e => {
    console.log("connection error "+e);
    
    });
  
     client.on("data", data => {
        console.log('GET BUFFER');
        console.log(data);
        if (start) {
        let buf = new Buffer(6);
        buf[0] = 83;
        buf[1] = 5;
        buf[2] = 0;
        buf[3] = 0;
        buf[4] = 1;
        buf[5] = 97;
        client.write(buf);
        console.log('WRITE');
        console.log(buf);
        start = 0;
        }

      }); 

      // 53   00 00 ad b8   00 00 01 f8   00 00 07 c7  00 00 03 d4   37 4d>