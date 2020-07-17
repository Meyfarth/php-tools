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
const Parser_1 = require("./parser/Parser");
const util_1 = require("./util/util");
class Extractor {
    constructor() {
        this.errorMessage = '';
        this.constantBlock = null;
        this.traitUsageBlock = null;
        this.defaultTabSize = 4;
        this.constVisibility = 'public'; // TODO get this through configuration
        // TODO idea : having each line referencing the start of the block if in block
        this.blockMapping = [];
    }
    extractConstant() {
        var _a, _b, _c, _d, _e, _f;
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
            if (constantName === undefined || constantName.trim() === '') {
                return;
            }
            let lineStart = null;
            if ((_c = this.constantBlock) === null || _c === void 0 ? void 0 : _c.end) {
                lineStart = this.constantBlock.end;
            }
            else if ((_d = this.traitUsageBlock) === null || _d === void 0 ? void 0 : _d.end) {
                lineStart = this.traitUsageBlock.end;
            }
            else if (this.classLineNumber) {
                lineStart = this.classLineNumber - 1;
            }
            if (!lineStart) {
                vscode.window.showWarningMessage('Could not find where to insert the constant');
                return;
            }
            yield ((_e = this.getActiveTextEditor()) === null || _e === void 0 ? void 0 : _e.edit((editBuilder) => {
                editBuilder.replace(selectionRange, `self::${constantName}`);
            }));
            yield ((_f = this.getActiveTextEditor()) === null || _f === void 0 ? void 0 : _f.insertSnippet(new vscode.SnippetString(this.indentText(`${this.constVisibility} const ${constantName} = ${text};\n`)), new vscode.Position(lineStart, 0), {
                undoStopBefore: false,
                undoStopAfter: false
            }));
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
            yield ((_d = this.getActiveTextEditor()) === null || _d === void 0 ? void 0 : _d.insertSnippet(new vscode.SnippetString(this.escapeForSnippet(this.indentText(`$${variableName} = ${text};\n`, this.detectIndentation(selection)))), new vscode.Position(this.getVariableInsertionLine(selection.start.line.valueOf()), 0), {
                undoStopBefore: false,
                undoStopAfter: false
            }));
        });
    }
    getVariableInsertionLine(line) {
        console.log(this.blockMapping);
        /**
         * Use case that won't insert the variable before the statement
         return $this->emailGenerator->generate(
            'serviceRequestPostedConfirmation',
            $this->getTranslatedSubject($serviceRequest),
            $data,
            self::CAMPAIGN_NAME,
            $this->getGeneralEmailAddress($externalServiceRequest),
            $this->getEmailAddressForConsumer($consumer)
        );
        */
        if (!isNaN(this.blockMapping[line])) {
            return this.blockMapping[line] - 1;
        }
        return line;
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
        const code = document.getText();
        const classStructure = Parser_1.parseCode(code);
        this.classLineNumber = classStructure.getFirstBodyLine();
        if (classStructure.hasConstant()) {
            this.constantBlock = {
                start: classStructure.getFirstConstant().getStartPosition().line.valueOf(),
                end: classStructure.getLastConstant().getEndPosition().line.valueOf(),
                indentSize: classStructure.getFirstConstant().getStartPosition().column.valueOf() || this.defaultTabSize
            };
        }
        if (classStructure.hasTraitUsage()) {
            this.traitUsageBlock = {
                start: classStructure.getFirstTrait().getStartPosition().line.valueOf(),
                end: classStructure.getLastTrait().getEndPosition().line.valueOf(),
                indentSize: classStructure.getFirstTrait().getStartPosition().column.valueOf() || this.defaultTabSize
            };
        }
        this.mapBlocks(classStructure);
    }
    mapBlocks(classStructure) {
        classStructure.getMethods().map(method => {
            method.getChildren().map(structure => {
                const startLine = structure.getStartPosition().line.valueOf();
                const endLine = structure.getEndPosition().line.valueOf();
                for (const i of util_1.range(startLine, endLine)) {
                    this.blockMapping[i] = startLine;
                }
            });
        });
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
        for (let linenumber = cursorPosition; linenumber >= startingLine; linenumber--) {
            const textLine = this.getClassFromLine(linenumber);
            if (textLine) {
                return textLine;
            }
        }
        if (cursorPosition === endingLine) {
            return;
        }
        for (let linenumber = cursorPosition; linenumber < endingLine; linenumber++) {
            const textLine = this.getClassFromLine(linenumber);
            if (textLine) {
                return textLine;
            }
        }
        return;
    }
    getClassFromLine(linenumber) {
        var _a;
        const textLine = (_a = this.getActiveTextEditor()) === null || _a === void 0 ? void 0 : _a.document.lineAt(linenumber);
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
    parseConstantPositions(startingLine, endingLine) {
    }
    parseTraitUsagePositions(startingLine, endingLine) {
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
            return Math.min(Math.ceil(text.text.search(/\S|$/) / 4), 2);
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
        this.classLineNumber = undefined;
        this.constantBlock = null;
    }
}
exports.Extractor = Extractor;
//# sourceMappingURL=extract.js.map