class ImportError extends Error {}

const loadModule = async (modulePath) => {
    try {
        return await import(modulePath)
    } catch (e) {
        throw new ImportError(`Unable to import module ${modulePath}`)
    }
}

/**
 * Wrapper to get system function available on node.js side only, returning null on the browser side
 * @param {string} name - execSync, spawn, fs, path, net
 * @returns {(function | null)}
 */
const getSystemFunction = async (name) => {
    try {
        if (name == 'execSync' || name == 'spawn') {
            const { default: myDefault } = await loadModule('child_process');
            return myDefault[name];
        }
        if (name == 'fs') {
            const { default: myDefault } = await loadModule('fs');
            return myDefault;
        }
        if (name == 'path') {
            const { default: myDefault } = await loadModule('path');
            return myDefault;
        }
        if (name == 'net') {
            const { default: myDefault } = await loadModule('net');
            return myDefault;
        }
    } catch (e) {
        return null;
    }
}

export default class SuiCliCommands {
    static async isPortThere(port) {
        const net = await getSystemFunction('net');
        if (!net) {
            return false;
        }

        const Socket = net.Socket;
        const socket = new Socket();

        let __waitPortPromiseResolver = null;
        const __waitPortPromise = new Promise((res)=>{ __waitPortPromiseResolver = res; });

        setTimeout(()=>{
            socket.destroy();
            __waitPortPromiseResolver(false);
        }, 3000);
        socket.on("connect", () => {
            __waitPortPromiseResolver(true);
        });
        socket.on("error", () =>
        {
            __waitPortPromiseResolver(false);
        });
        socket.on("timeout", () => {
            __waitPortPromiseResolver(false);
        });

        socket.connect(port, "0.0.0.0");

        const portIsThere = await __waitPortPromise;
        socket.destroy();

        return portIsThere;
    }

    static async spawn(command, params = [], envVars = {}) {
        const doSpawn = await getSystemFunction('spawn');

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
        const doExecSync = await getSystemFunction('execSync');

        if (!doExecSync) {
            throw new Error('can not exec a proccess in this env');
        }

        return doExecSync(
                command,
                { encoding: 'utf-8' },
            );
    }

    static async getModulesNamesFromPackagePath(path) {
        const doPath = await getSystemFunction('path');
        const doFs = await getSystemFunction('fs');

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
};
