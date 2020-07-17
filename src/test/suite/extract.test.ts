import * as assert from 'assert';

const fs = require('fs');

import * as vscode from 'vscode';

import path = require('path');
import { monitorEventLoopDelay } from 'perf_hooks';
import { runTests } from 'vscode-test';
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

	test('Adds a constant at the start of the class', async () => {
        await runExtractTests(
            'Constant',
            'EmptyClass.php',
            {
                line: 4,
                start: 52,
                end: 63
            },
            'TEST_CONSTANT_EMPTY_CLASS'
        );
    });

    test('Adds a constant after existing constants', async () => {
        await runExtractTests(
            'Constant',
            'ClassWithConstants.php',
            {
                line: 5,
                start: 51,
                end: 59
            },
            'LAST_NAME'
        );
    });

    test('Adds a constant after trait import block', async () => {
        await runExtractTests(
            'Constant',
            'ClassWithTraits.php',
            {
                line: 6,
                start: 51,
                end: 59
            },
            'LAST_NAME'
        );
    });

    test('Adds a constant after constants when there is trait usages', async () => {
        await runExtractTests(
            'Constant',
            'ClassWithConstantsAndTraits.php',
            {
                line: 8,
                start: 51,
                end: 59
            },
            'LAST_NAME'
        );
    });

    test('Extracts variable above the control structure', async () => {
        await runExtractTests(
            'Variable',
            'VariableInControlStructure.php',
            {
                line: 6,
                start: 12,
                end: 47
            },
            'check'
        );
    });
});

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

function getInputFilePath(name: string) {
	return path.join(__dirname + testFolderRelativeLocation + `input/${name}`);
}

function getOutputFileContent(name: string) {
	return fs.readFileSync(path.join(__dirname + testFolderRelativeLocation + `output/${name}`)).toString();
}

async function runExtractTests(extractedType: string, testedFile: string, initialSelection: { line: number, start: number, end: number }, constantName: string) {

    const showInputBox = sinon.stub(vscode.window, 'showInputBox');

    showInputBox.resolves(constantName);

    const expectedOutput = getOutputFileContent(testedFile);

    const uri = vscode.Uri.file(
        getInputFilePath(testedFile)
    );

    const document = await vscode.workspace.openTextDocument(uri);

    await vscode.window.showTextDocument(document);

    const range = new vscode.Range(
        new vscode.Position(initialSelection.line, initialSelection.start),
        new vscode.Position(initialSelection.line, initialSelection.end)
    );

    const selection = new vscode.Selection(range.start, range.end);

    if (vscode.window.activeTextEditor) {
        vscode.window.activeTextEditor.selection = selection;
    }

    await vscode.commands.executeCommand('editor.action.addSelectionToNextFindMatch');

    try {
        await vscode.commands.executeCommand(`phpTools.extract${extractedType}`);
    } catch (reason) {
        assert.fail(`Could not extract constant: ${reason}`);
    }

    try {
        const input = await getInputBox();
        assert.equal(input, constantName);
        await showInputBox.restore();
    } catch (reason) {
        assert.fail(`Could not set input box value: ${reason}`);
    }
    await delay(500);

    const currentText = vscode.window.activeTextEditor?.document.getText();
    assert.equal(expectedOutput, currentText);
}