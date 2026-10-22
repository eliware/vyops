import { log } from "@eliware/common";
import { close, connect } from "../ssh.mjs";
import { exec } from "../ssh/exec.mjs";
import { interactive } from "../ssh/interactive.mjs";
import { download } from "../ssh/download.mjs";
import { upload } from "../ssh/upload.mjs";
import { installScripts } from "./script/sync.mjs";
import { remotePreflight } from "./preflight.mjs";
import { startDeployment } from "./start.mjs";

function deploymentDependencies() {
  return {
    close,
    connect,
    exec,
    log,
    interactive,
    download,
    upload,
    remotePreflight,
    installScripts,
  };
}

export async function createDeploymentRuntime(
  { target, password, operationId },
  start = startDeployment,
  dependencies = deploymentDependencies(),
) {
  let client;
  const getClient = () => client;
  const setClient = (value) => {
    client = value;
  };
  const runtime = await start({
    target,
    password,
    operationId,
    ...dependencies,
    getClient,
    setClient,
  });
  return { client, getClient, setClient, dependencies, ...runtime };
}
