let doExecSync = null;
let doSpawn = null;
let doFs = null;
let doPath = null;
try {
    let { execSync, spawn } = require('child_process');
    doExecSync = execSync;
    doSpawn = spawn;

    const fs = require('fs');
    const path = require('path');

    doFs = fs;
    doPath = path;
} catch (e) {}

class SuiCliCommands {
    static async spawn(command, params = [], envVars = {}) {
        if (!doSpawn) {
            throw new Error('can not spawn a proccess in this env');
        }

        return await new Promise((res,rej)=>{
            let success = true;
            let e = null;
            const proc = doSpawn(command, params, {
                env: {
                    ...process.env,
                    ...envVars,
                }
            });
            proc.on('error', function(err) {
                success = false;
                e = err;
            });

            setTimeout(()=>{
                if (success) {
                    res(proc);
                } else {
                    rej(e);
                }
            }, 100);
        });

        // const proc = doSpawn(command, [], {
        //     env: {
        //         ...process.env,
        //         ...envVars,
        //     }
        // });
        // proc.on('error', function(err) {
        //     console.log('Oh noez, teh errurz: ' + err);
        // });

        // return proc;
    }

    static async exec(command) {
        if (!doExecSync) {
            throw new Error('can not exec a proccess in this env');
        }

        return doExecSync(
                command,
                { encoding: 'utf-8' },
            );
    }

    static async getModulesNamesFromPackagePath(path) {
        if (!doPath || !doFs) {
            throw new Error('can not access path in this env');
        }

        try {
            const buildPathContent = await doFs.promises.readdir(path.join(this._path, 'build'));
    
            // @todo: there may be some junk folders and we'd have to get project name from Move.toml ?
            const buildPath = buildPathContent[0];
    
            const dirents = await doFs.promises.readdir(doPath.join(this._path, 'build', buildPath, 'bytecode_modules'), { withFileTypes: true });
            const names = dirents
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name.split('.mv').join(''));
    
            return names;
        } catch (e) {
            throw new Error('can not get modules names from local package path');
        }
    }
}

module.exports = SuiCliCommands;