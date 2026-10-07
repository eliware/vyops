import { EventEmitter } from "node:events";

const timeout = (name, fallback) =>
  Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0
    ? Number(process.env[name])
    : fallback;

export function adaptConnection(connection) {
  const client = new EventEmitter();
  client.__vyopsConnection = connection;
  client.exec = (command, callback) => {
    const stream = new EventEmitter();
    stream.stderr = new EventEmitter();
    stream.close = () => {};
    callback(null, stream);
    connection
      .exec([command], { timeout: timeout("VYOPS_OPERATION_TIMEOUT", 60000) })
      .then(([result]) => {
        if (result.stdout) stream.emit("data", Buffer.from(result.stdout));
        if (result.stderr) stream.stderr.emit("data", Buffer.from(result.stderr));
        stream.emit("close", result.code);
      })
      .catch((error) => stream.emit("error", error));
  };
  client.shell = (options, callback) => {
    connection.shell(options).then((stream) => callback(null, stream), callback);
  };
  client.end = () => {
    connection.close().then(
      () => client.emit("close"),
      (error) => {
        if (client.listenerCount("error")) client.emit("error", error);
        else client.emit("close");
      },
    );
  };
  return client;
}
