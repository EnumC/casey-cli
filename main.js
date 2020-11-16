/**
 * Submission module for Grading Python projects via Casey
 * Author: Eric Qian
 */
'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const ora = require('ora');
const colors = require('colors');
const { NodeSSH } = require('node-ssh')
const { exit } = require('process');
const ssh = new NodeSSH();

const dotenvPath = path.join(__dirname, '.env');
require('dotenv').config({ path: dotenvPath });
const projectRootPath = path.join(__dirname, 'projects');
const enableSFTP = false;
const config = {
    host: process.env.SFTP_SERVER,
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASSWORD,
    port: process.env.SFTP_PORT || 22,
    tryKeyboard: true
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'casey> '
});
const spinner = ora('Establishing connections to remote server.\n').start();

ssh.connect(config).then(function () {
    console.log("Connection Successful.".green.bold);
    spinner.stop();
    initCommands();
}).catch(error => {
    console.log("Unable to connect to remote server:".red.bold);
    console.log(error.message.red.bold);
    exit()
});

// async function putFiles(client, src, dst) {

//     try {
//         console.log(`Uploading ${src} to ${dst}`);
//         if (enableSFTP) {
//             await client.fastPut(src, dst);
//             console.log('Files uploaded');
//         }
//     } catch (err) {
//         console.error(err.message);
//     }

// }

function putDir(src, dst) {
    ssh.putDirectory(src, dst, {
        recursive: true,
        concurrency: 1,
        // ^ WARNING: Not all servers support high concurrency
        // try a bunch of values and see what works on your server
        validate: function (itemPath) {
            const baseName = path.basename(itemPath)
            return baseName.substr(0, 1) !== '.' && // do not allow dot files
                baseName !== 'node_modules' // do not allow node_modules
        },
        tick: function (localPath, remotePath, error) {
            if (error) {
                failed.push(localPath)
            } else {
                successful.push(localPath)
            }
        }
    }).then(function (status) {
        console.log('the directory transfer was', status ? 'successful' : 'unsuccessful')
        console.log('failed transfers', failed.join(', '))
        console.log('successful transfers', successful.join(', '))
    })
}

function runCasey(projectDir, projectName) {
    ssh.execCommand(process.env.CASEY_RUNTIME_PATH + ' ' + process.env.CLASS_ID + " " + projectName, { cwd: projectDir }).then(function (result) {
        console.log('STDOUT: ' + result.stdout)
        console.log('STDERR: ' + result.stderr)
    })
}
function initCommands() {

    rl.prompt();
    rl.on('line', (line) => {
        let lineStr = '' + line.trim();
        if (lineStr.startsWith('help')) {
            console.log('List of commands: ');
            console.log('exit - Exit Casey Submission.');
        }
        else if (lineStr.startsWith('exit'))
            exit(0);
        else if (lineStr.startsWith('submit')) {
            let param = lineStr.split(' ')[1];
            if (param == undefined) {
                console.log("Enter Project Name: ");
                console.log("pset1, pset2, pset3, pset4, pset5, pset6, pset7, pset8");
            }

            else {
                // find folder for project and upload all files.
                let projectPath = path.join(projectRootPath, param);
                let remotePath = "/" + process.env.SFTP_USER + "/CPE202/" + param;
                putDir(projectPath, remotePath);
                runCasey(remotePath, param)
                // fs.readdir(projectPath, function (err, files) {
                //     //handling error
                //     if (err) {
                //         return console.log('Unable to scan directory: ' + err);
                //     }
                //     //listing all files using forEach
                //     files.forEach(function (file) {
                //         let filePath = path.join(projectPath, file);
                //         let remotePath = "/" + process.env.SFTP_USER + "/CPE202/" + param + "/" + file;
                //         // console.log(filePath);
                //         // console.log(remotePath);
                //         putFiles(sftp, filePath, remotePath);
                //         // sftp.put(file);
                //     });
                //     rl.prompt();
                // });
            }

        }
        else {
            console.log('Command not found: ' + lineStr);
        }

        rl.prompt();
    }).on('close', () => {
        console.log('Casey CLI terminated!');
    });
}