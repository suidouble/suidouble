export default class SuiCliCommands {
    static isPortThere(port: any): Promise<any>;
    static spawn(command: any, params?: any[], envVars?: {}): Promise<any>;
    static exec(command: any): Promise<any>;
    static getModulesNamesFromPackagePath(path: any): Promise<any>;
}
