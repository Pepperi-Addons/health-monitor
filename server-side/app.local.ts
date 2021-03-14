import { DebugServer } from '@pepperi-addons/debug-server'
import config from '../addon.config.json';

const dir = __dirname;
const server = new DebugServer({
    addonUUID:"7e15d4cc-55a7-4128-a9fe-0e877ba90069", //process.env.AddonUUID,
    apiDirectory: dir,
    port: config.DebugPort
});

// serve the plugin file locally
server.addStaticFolder(`/assets/plugins/${config.AddonUUID}/${config.AddonVersion}`, process.cwd() +  '/../publish/editors');

// serve the plugin assets locally
server.addStaticFolder(`/Addon/Public/${config.AddonUUID}/${config.AddonVersion}`, process.cwd() +  '/../publish/assets');
server.addStaticFolder(`/assets/plugins/${config.AddonUUID}/${config.AddonVersion}`, process.cwd() +  '/../publish/assets');

server.start();

console.log("Open webapp at: ", `${config.WebappBaseUrl}/settings/${config.AddonUUID}/${config.DefaultEditor}?dev=true`);