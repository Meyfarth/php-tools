import { Parser } from 'php-parser';
import * as vscode from 'vscode';
import { parseCode, ClassStructure } from './parser/Parser';
import { range } from './util/util';


export class Extractor {
    private classLineNumber: number | undefined;
    private errorMessage: string = '';
    private constantBlock: { start: number | null; end: number | null; indentSize: number } | null = null;
    private traitUsageBlock: { start: number | null; end: number | null; indentSize: number; } | null = null;
    private defaultTabSize = 4;
    private constVisibility: string = 'public'; // TODO get this through configuration
    // TODO idea : having each line referencing the start of the block if in block
    private blockMapping: {
        [index: number]: number
    } = [];

    async extractConstant() {
        // TODO see if we can have constant visibility as a parameter
        this.reset();

        const document = this.getActiveTextEditor()?.document;

        if (document?.uri === undefined) {
            return;
        }

        this.parseDocument(document);

        if (this.errorMessage !== '') {
            vscode.window.showWarningMessage(`Document cannot be parsed: ${this.errorMessage}`);
            return;
        }

        const selection = this.getSelectedText();

        if (!selection?.start) {
            vscode.window.showWarningMessage('No text selected to extract into a constant');
            return;
        }

        const selectionRange = new vscode.Range(selection.start, selection.end);

        const text = this.getActiveTextEditor()?.document.getText(selection);

        const constantName = await this.promptForName('constant');

        if (constantName === undefined || constantName.trim() === '') {
            return;
        }

        let lineStart = null;

        if (this.constantBlock?.end) {
            lineStart = this.constantBlock.end;
        } else if (this.traitUsageBlock?.end) {
            lineStart = this.traitUsageBlock.end;
        } else if (this.classLineNumber) {
            lineStart = this.classLineNumber - 1;
        }

        if (!lineStart) {
            vscode.window.showWarningMessage('Could not find where to insert the constant');
            return;
        }

        await this.getActiveTextEditor()?.edit((editBuilder) => {
            editBuilder.replace(selectionRange, `self::${constantName}`);
        });

        await this.getActiveTextEditor()?.insertSnippet(
            new vscode.SnippetString(this.indentText(`${this.constVisibility} const ${constantName} = ${text};\n`)),
            new vscode.Position(lineStart, 0),
            {
                undoStopBefore: false,
                undoStopAfter: false
            }
        );
        // TODO move cursor to previously selected range
    }

    async extractVariable() {
        this.reset();

        const document = this.getActiveTextEditor()?.document;

        if (document?.uri === undefined) {
            return;
        }

        this.parseDocument(document);

        if (this.errorMessage !== '') {
            vscode.window.showWarningMessage(`Document cannot be parsed: ${this.errorMessage}`);
            return;
        }

        const selection = this.getSelectedText();

        if (!selection?.start) {
            vscode.window.showWarningMessage('No text selected to extract into a variable');
            return;
        }

        const selectionRange = new vscode.Range(selection.start, selection.end);

        const text = this.getActiveTextEditor()?.document.getText(selection);

        const variableName = this.escapeForSnippet(await this.promptForName('variable') || '');

        await this.getActiveTextEditor()?.edit((editBuilder) => {
            editBuilder.replace(selectionRange, `$${variableName}`);
        });

        await this.getActiveTextEditor()?.insertSnippet(
            new vscode.SnippetString(this.escapeForSnippet(this.indentText(`$${variableName} = ${text};\n`, this.detectIndentation(selection)))),
            new vscode.Position(this.getVariableInsertionLine(selection.start.line.valueOf()), 0),
            {
                undoStopBefore: false,
                undoStopAfter: false
            }
        );
    }

    getVariableInsertionLine(line: number): number
    {
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

    async extractMethod() {

    }

    async promptForName(kind: string) {
        return await vscode.window.showInputBox({placeHolder: this.capitalize(kind) + ' name', prompt: `Enter the ${kind} name you want`});
    }

    capitalize(str: string) {
        return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
    }

    parseDocument(document: vscode.TextDocument) {

        const code = document.getText();

        const classStructure = parseCode(code);

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

    private mapBlocks(classStructure: ClassStructure): void
    {
        classStructure.getMethods().map(method => {
            method.getChildren().map(structure => {
                const startLine = structure.getStartPosition().line.valueOf();
                const endLine = structure.getEndPosition().line.valueOf();
                for (const i of range(startLine, endLine)) {
                    this.blockMapping[i] = startLine;
                }
            });
        });
    }

    getSelectedText() {
        const editor = this.getActiveTextEditor();

        if (!editor) {
            return;
        }

        return vscode.window.activeTextEditor?.selection;
    }

    getActiveTextEditor() {
        return vscode.window.activeTextEditor;
    }

    getClassLineFromCursor(startingLine: number, endingLine: number, cursorPosition: number) {
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

    getClassFromLine(linenumber: number) {
        const textLine = this.getActiveTextEditor()?.document.lineAt(linenumber);
        if (!textLine) {
            return;
        }
        if (this.isClassLine(textLine.text)) {
            return textLine;
        }

        return;
    }

    isClassLine(text: string) {
        return /(?:^(?:(?:final|abstract)\s+)?class\s+\w+)|(new\s+class)/.test(text);
    }

    parseConstantPositions(startingLine: number, endingLine: number) {
    }

    parseTraitUsagePositions(startingLine: number, endingLine: number) {
    }


    indentText(text: string, level = 1) {
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

    detectIndentation(selection: vscode.Selection) {

        const text = this.getActiveTextEditor()?.document.lineAt(selection.start.line);

        if (text) {
            return Math.min(Math.ceil(text.text.search(/\S|$/) / 4), 2);
        }

        return 1;
    }

    escapeForSnippet(text: string) {
        return text.replace(/(?<!\\)\$/g, '\\$');
    }

    getConfiguration(key: string): number | undefined {
        const parts = key.split(/\.(.+)/, 2);
        const configuration = vscode.workspace.getConfiguration(parts[0], this.getActiveTextEditor()?.document.uri);

        return configuration.get(parts[1]);
    }

    reset() {
        this.errorMessage = '';
        this.classLineNumber = undefined;
        this.constantBlock = null;
    }

}
