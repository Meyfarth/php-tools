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
const assert = require("assert");
const fs = require('fs');
const vscode = require("vscode");
const path = require("path");
const sinon = require('sinon');
const testFolderRelativeLocation = '/../../../src/test/fixtures/extract/';
const getInputBox = () => vscode.window.showInputBox({
    placeHolder: 'Example: fff',
    prompt: 'Type a hexadecimal color value',
    value: ''
});
suite('Test extractor', () => {
    vscode.window.showInformationMessage('Start tests on extracting constants');
    test('Nothing happens if not in a file with a php class', done => {
        vscode.commands.executeCommand('phpTools.extractConstant')
            .then(() => {
            done();
        }, () => {
            assert.fail("Failed");
        });
    });
    test('Adds a constant at the start of the class', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runExtractTests('Constant', 'EmptyClass.php', {
            line: 4,
            start: 52,
            end: 63
        }, 'TEST_CONSTANT_EMPTY_CLASS');
    }));
    test('Adds a constant after existing constants', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runExtractTests('Constant', 'ClassWithConstants.php', {
            line: 5,
            start: 51,
            end: 59
        }, 'LAST_NAME');
    }));
    test('Adds a constant after trait import block', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runExtractTests('Constant', 'ClassWithTraits.php', {
            line: 6,
            start: 51,
            end: 59
        }, 'LAST_NAME');
    }));
    test('Adds a constant after constants when there is trait usages', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runExtractTests('Constant', 'ClassWithConstantsAndTraits.php', {
            line: 8,
            start: 51,
            end: 59
        }, 'LAST_NAME');
    }));
    test('Extracts variable above the control structure', () => __awaiter(void 0, void 0, void 0, function* () {
        yield runExtractTests('Variable', 'VariableInControlStructure.php', {
            line: 6,
            start: 12,
            end: 47
        }, 'check');
    }));
});
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getInputFilePath(name) {
    return path.join(__dirname + testFolderRelativeLocation + `input/${name}`);
}
function getOutputFileContent(name) {
    return fs.readFileSync(path.join(__dirname + testFolderRelativeLocation + `output/${name}`)).toString();
}
function runExtractTests(extractedType, testedFile, initialSelection, constantName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const showInputBox = sinon.stub(vscode.window, 'showInputBox');
        showInputBox.resolves(constantName);
        const expectedOutput = getOutputFileContent(testedFile);
        const uri = vscode.Uri.file(getInputFilePath(testedFile));
        const document = yield vscode.workspace.openTextDocument(uri);
        yield vscode.window.showTextDocument(document);
        const range = new vscode.Range(new vscode.Position(initialSelection.line, initialSelection.start), new vscode.Position(initialSelection.line, initialSelection.end));
        const selection = new vscode.Selection(range.start, range.end);
        if (vscode.window.activeTextEditor) {
            vscode.window.activeTextEditor.selection = selection;
        }
        yield vscode.commands.executeCommand('editor.action.addSelectionToNextFindMatch');
        try {
            yield vscode.commands.executeCommand(`phpTools.extract${extractedType}`);
        }
        catch (reason) {
            assert.fail(`Could not extract constant: ${reason}`);
        }
        try {
            const input = yield getInputBox();
            assert.equal(input, constantName);
            yield showInputBox.restore();
        }
        catch (reason) {
            assert.fail(`Could not set input box value: ${reason}`);
        }
        yield delay(500);
        const currentText = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.getText();
        assert.equal(expectedOutput, currentText);
    });
}
//# sourceMappingURL=extract.test.js.map