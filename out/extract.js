"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Extractor = void 0;
const vscode = require("vscode");
class Extractor {
    constructor() {
        this.errorMessage = '';
        this.constantBlock = null;
        this.defaultTabSize = 4;
        this.constVisibility = 'public'; // TODO get this through configuration
        this.traitUsageBlock = null;
    }
    extractConstant() {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            // TODO see if we can have constant visibility as a parameter
            this.reset();
            const document = (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document;
            if ((document === null || document === void 0 ? void 0 : document.uri) === undefined) {
                return;
            }
            this.parseDocument(document);
            if (this.errorMessage !== '') {
                vscode.window.showWarningMessage(`Document cannot be parsed: ${this.errorMessage}`);
                return;
            }
            const selection = this.getSelectedText();
            if (!(selection === null || selection === void 0 ? void 0 : selection.start)) {
                vscode.window.showWarningMessage('No text selected to extract into a constant');
                return;
            }
            const selectionRange = new vscode.Range(selection.start, selection.end);
            const text = (_b = this.getActiveTextEditor()) === null || _b === void 0 ? void 0 : _b.document.getText(selection);
            const constantName = yield this.promptForName('constant');
            let lineBeforeInsert = null;
            if ((_c = this.constantBlock) === null || _c === void 0 ? void 0 : _c.end) {
                lineBeforeInsert = this.constantBlock.end;
            }
            else if (this.traitUsageBlock) {
                // TODO use traits
                lineBeforeInsert = this.traitUsageBlock.end;
            }
            else if (this.classLine) {
                lineBeforeInsert = this.getClassOpenBraceLineNumber(this.classLine);
            }
            if (!lineBeforeInsert) {
                vscode.window.showWarningMessage('Could not find where to insert the constant');
                return;
            }
            yield ((_d = this.getActiveTextEditor()) === null || _d === void 0 ? void 0 : _d.edit((editBuilder) => {
                editBuilder.replace(selectionRange, `self::${constantName}`);
            }));
            yield ((_e = this.getActiveTextEditor()) === null || _e === void 0 ? void 0 : _e.insertSnippet(new vscode.SnippetString(this.indentText(`${this.constVisibility} const ${constantName} = ${text};\n`)), new vscode.Position(lineBeforeInsert + 1, 0), {
                undoStopBefore: false,
                undoStopAfter: false
            }));
            vscode.window.showInformationMessage(`You want to extract the text '${text}' in a constant named '${constantName}'? THEN DO IT YOURSELF FFS`);
        });
    }
    extractVariable() {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.reset();
            const document = (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document;
            if ((document === null || document === void 0 ? void 0 : document.uri) === undefined) {
                return;
            }
            this.parseDocument(document);
            if (this.errorMessage !== '') {
                vscode.window.showWarningMessage(`Document cannot be parsed: ${this.errorMessage}`);
                return;
            }
            const selection = this.getSelectedText();
            if (!(selection === null || selection === void 0 ? void 0 : selection.start)) {
                vscode.window.showWarningMessage('No text selected to extract into a variable');
                return;
            }
            const selectionRange = new vscode.Range(selection.start, selection.end);
            const text = (_b = this.getActiveTextEditor()) === null || _b === void 0 ? void 0 : _b.document.getText(selection);
            const variableName = this.escapeForSnippet((yield this.promptForName('variable')) || '');
            yield ((_c = this.getActiveTextEditor()) === null || _c === void 0 ? void 0 : _c.edit((editBuilder) => {
                editBuilder.replace(selectionRange, `$${variableName}`);
            }));
            yield ((_d = this.getActiveTextEditor()) === null || _d === void 0 ? void 0 : _d.insertSnippet(new vscode.SnippetString(this.escapeForSnippet(this.indentText(`$${variableName} = ${text};\n`, this.detectIndentation(selection)))), new vscode.Position(selection.start.line, 0), {
                undoStopBefore: false,
                undoStopAfter: false
            }));
        });
    }
    extractMethod() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    promptForName(kind) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield vscode.window.showInputBox({ placeHolder: this.capitalize(kind) + ' name', prompt: `Enter the ${kind} name you want` });
        });
    }
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
    }
    parseDocument(document) {
        var _a, _b;
        let startingLine = 0;
        let endingLine = 0;
        if (document) {
            endingLine = document.lineCount - 1;
        }
        const selection = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.selection.active;
        // Store the start of the class
        let cursorPosition = (_b = this.getActiveTextEditor()) === null || _b === void 0 ? void 0 : _b.selection.start.line;
        if (!cursorPosition) {
            cursorPosition = 0;
        }
        this.classLine = this.getClassLineFromCursor(startingLine, endingLine, cursorPosition);
        this.checkDocumentValidity();
        if (!this.classLine) {
            return;
        }
        // Store const block position
        this.parseConstantPositions(this.classLine.lineNumber, endingLine);
        this.parseTraitUsagePositions(this.classLine.lineNumber, endingLine);
        // TODO: Store properties block position for later
        // TODO: Store end of method for later (when doing extract method)
        this.checkDocumentValidity();
    }
    checkDocumentValidity() {
        if (!this.classLine) {
            this.errorMessage = 'No class line found in the document';
        }
    }
    getSelectedText() {
        var _a;
        const editor = this.getActiveTextEditor();
        if (!editor) {
            return;
        }
        return (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.selection;
    }
    getActiveTextEditor() {
        return vscode.window.activeTextEditor;
    }
    getClassLineFromCursor(startingLine, endingLine, cursorPosition) {
        // Go up from the cursor to the starting of the line, then go down again if none found
        for (let lineNumber = cursorPosition; lineNumber >= startingLine; lineNumber--) {
            const textLine = this.getClassFromLine(lineNumber);
            if (textLine) {
                return textLine;
            }
        }
        if (cursorPosition === endingLine) {
            return;
        }
        for (let lineNumber = cursorPosition; lineNumber < endingLine; lineNumber++) {
            const textLine = this.getClassFromLine(lineNumber);
            if (textLine) {
                return textLine;
            }
        }
        return;
    }
    getClassFromLine(lineNumber) {
        var _a;
        const textLine = (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document.lineAt(lineNumber);
        if (!textLine) {
            return;
        }
        if (this.isClassLine(textLine.text)) {
            return textLine;
        }
        return;
    }
    isClassLine(text) {
        return /(?:^(?:(?:final|abstract)\s+)?class\s+\w+)|(new\s+class)/.test(text);
    }
    getClassOpenBraceLineNumber(classLine) {
        const isSingleLine = /(?:.*(?:{)$)/.test(classLine.text);
        return isSingleLine ? classLine.lineNumber : (classLine.lineNumber + 1);
    }
    parseConstantPositions(startingLine, endingLine) {
        this.constantBlock = this.parseBlock(startingLine, endingLine, /(?:^(?:(?:private|protected|public)\s+)?const\s+\w+)/);
    }
    parseTraitUsagePositions(startingLine, endingLine) {
        this.traitUsageBlock = this.parseBlock(startingLine, endingLine, /(?:^\s*use\s+\w+)/);
    }
    parseBlock(startingLine, endingLine, pattern) {
        var _a, _b;
        let startBlock = null;
        let endBlock = null;
        let indentSize = 0;
        for (let lineNumber = startingLine; lineNumber <= endingLine; lineNumber++) {
            const textLine = (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document.lineAt(lineNumber);
            if (!textLine) {
                continue;
            }
            if (pattern.test(textLine.text.trim())) {
                if (!startBlock) {
                    startBlock = lineNumber;
                }
                else {
                    endBlock = lineNumber;
                }
            }
        }
        if (startBlock) {
            const text = ((_b = this.getActiveTextEditor()) === null || _b === void 0 ? void 0 : _b.document.lineAt(startingLine).text) || '';
            indentSize = text.indexOf(text.trim());
        }
        return { start: startBlock, end: endBlock || startBlock, indentSize: indentSize };
    }
    indentText(text, level = 1) {
        if (level < 1) {
            level = 1;
        }
        /**
         * Good to have
         * Listen for view options changes and use these values
         * https://github.com/jedmao/tabsanity-vs/blob/faa41a99ccb47c8e7717edfcbdfba4c093e670fe/TabSanity/TabOptionsListener.cs
         */
        let tab = "\t";
        if (this.getConfiguration('editor.insertSpaces')) {
            const tabSize = this.getConfiguration('editor.tabSize');
            tab = ' '.repeat(tabSize || this.defaultTabSize);
        }
        return tab.repeat(level) + text;
    }
    detectIndentation(selection) {
        var _a;
        const text = (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document.lineAt(selection.start.line);
        if (text) {
            return Math.ceil(text.text.search(/\S|$/) / 4);
        }
        return 1;
    }
    escapeForSnippet(text) {
        return text.replace(/(?<!\\)\$/g, '\\$');
    }
    getConfiguration(key) {
        var _a;
        const parts = key.split(/\.(.+)/, 2);
        const configuration = vscode.workspace.getConfiguration(parts[0], (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document.uri);
        return configuration.get(parts[1]);
    }
    reset() {
        this.errorMessage = '';
        this.classLine = undefined;
        this.constantBlock = null;
    }
}
exports.Extractor = Extractor;
//# sourceMappingURL=extract.js.map