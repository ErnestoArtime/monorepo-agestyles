const { Server } = require("node:net");

const listen = Server.prototype.listen;
const labPort = 18082;

// Expo's --localhost controls the advertised URL. Metro 54 still binds all
// interfaces when it calls listen(port, undefined, callback).
Server.prototype.listen = function (...args) {
  const first = args[0];
  if (first === labPort) {
    if (typeof args[1] === "string" || args[1] == null) {
      args[1] = "127.0.0.1";
    } else {
      args.splice(1, 0, "127.0.0.1");
    }
  } else if (first && typeof first === "object" && Number(first.port) === labPort) {
    args[0] = { ...first, host: "127.0.0.1" };
  }
  return listen.apply(this, args);
};
