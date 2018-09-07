/*
 * Copyright (c) 2018 Intra LLC
 *
 * MIT LICENSE 
 * 
 * intraHouse local plugin  
 * 
 */
const util = require("util");

exports.Plugin = Plugin;

/**
 * Plugin constructor
 *
 * @param {Object} params - optional 
 * 
 */
function Plugin(params) {
  if (!(this instanceof Plugin)) return new Plugin(params);

  this.params = params && typeof params == "object" ? params : {};
  let that = this;

  process.on("message", message => {
    if (!message) return;

    if (typeof message == "string") {
      if (message == "SIGTERM") {
        process.exit();
      }
    }

    if (typeof message == "object") {
      that.parseMessageFromServer(message);
    }
  });

  process.on('uncaughtException', (err) => {
    this.log('ERR: uncaughtException ' + util.inspect(err));
    setTimeout(() => {
        process.exit();
      }, 1000); 
  });
}
util.inherits(Plugin, require("events").EventEmitter);

/**
 * Setting new params value if the param exists 
 * @api public
 * @param {Object} params
 */
Plugin.prototype.setParams = function(params) {
  if (typeof params == "object") {
    Object.keys(params).forEach(param => {
      if (this.params[param] != undefined) this.params[param] = params[param];
    });
  }
};


Plugin.prototype.setDebug = function(mode) {
  this.debug = mode == "on" ? 1 : 0;
};

Plugin.prototype.log = function(txt) {
  if (this.debug) {
    process.send({ type: "debug", txt });
  } else {
    process.send({ type: "log", txt });
  }
  console.log(txt);
};

Plugin.prototype.sendToServer = function(type, data) {
  if (util.isArray(data)) {
    process.send({ type, data });
  } else {
    process.send(Object.assign({ type }, data));
  }

};

Plugin.prototype.getFromServer = function(tablename) {
  process.send({ type: "get", tablename });
};


/**
 * @api private
 * @param {Object} message 
 * 
 * Plugin emits event if need
 */
Plugin.prototype.parseMessageFromServer = function(message) {
    let event = "";
    let data;
    switch (message.type) {
      case "get":
        if (message.params) {
          this.log("get params: "+JSON.stringify(message.params));  
          this.setParams(message.params);
          this.log("set params: "+JSON.stringify(this.params));  
          if (message.params.debug) this.setDebug(message.params.debug);
          event = "params";
          data = this.params;
        }
  
        if (message.config) {
          this.config = message.config;
          event = "config";
          data = this.config;
        }
  
        if (message.extra) {
          this.extra = message.extra;
          event = "extra";
          data = this.extra;
        }
        break;
  
      case "act":
        this.log("act: "+JSON.stringify(message));  
        event = "act";
        data = message.data;
        break;
  
      case "sub":
        // get on subscribe from server
        this.log("sub: "+JSON.stringify(message));  
        event = "sub";
        data = message.data;
  
        break;
      case "debug":
        if (message.mode) this.setDebug(message.mode);
        break;
  
      default:
    }
    if (event) this.emit(event, data);
  };
  