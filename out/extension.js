"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const extract_1 = require("./extract");
function activate(context) {
    let helloWorld = vscode.commands.registerCommand('phpTools.helloWorld', () => {
        vscode.window.showInformationMessage("Hello from extension");
    });
    context.subscriptions.push(helloWorld);
    let addProperty = vscode.commands.registerCommand('phpTools.addProperty', () => {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    });
    context.subscriptions.push(addProperty);
    // TODO extract methods inside a separate file
    let extractConstant = vscode.commands.registerCommand('phpTools.extractConstant', () => {
        const extractor = new extract_1.Extractor();
        extractor.extractConstant();
    });
    context.subscriptions.push(extractConstant);
    let extractVariable = vscode.commands.registerCommand('phpTools.extractVariable', () => {
        const extractor = new extract_1.Extractor();
        extractor.extractVariable();
    });
    context.subscriptions.push(extractVariable);
    let extractMethod = vscode.commands.registerCommand('phpTools.extractMethod', () => {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    });
    context.subscriptions.push(extractMethod);
    let generateGetter = vscode.commands.registerCommand('phpTools.generateGetters', () => {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    });
    context.subscriptions.push(generateGetter);
    let generateSetter = vscode.commands.registerCommand('phpTools.generateSetter', () => {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    });
    context.subscriptions.push(generateSetter);
    let generateGetterAndSetter = vscode.commands.registerCommand('phpTools.generateGetterAndSetter', () => {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    });
    context.subscriptions.push(generateGetterAndSetter);
    let organizeCode = vscode.commands.registerCommand('phpTools.organizeCode', () => {
        vscode.window.showInformationMessage("This feature is not implemented yet");
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map