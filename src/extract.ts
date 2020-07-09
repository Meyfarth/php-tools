import * as vscode from 'vscode';


export class Extractor {
    classLine: vscode.TextLine | undefined;
    errorMessage: string = '';
    constantBlock: { start: number | null; end: number | null; indentSize: number } | null = null;
    defaultTabSize = 4;
    constVisibility: string = 'public'; // TODO get this through configuration
    traitUsageBlock: { start: number | null; end: number | null; indentSize: number; } | null = null;

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

        let lineBeforeInsert = null;

        if (this.constantBlock?.end) {
            lineBeforeInsert = this.constantBlock.end;
        } else if (this.traitUsageBlock) {
            // TODO use traits
            lineBeforeInsert = this.traitUsageBlock.end;
        } else if (this.classLine) {
            lineBeforeInsert = this.getClassOpenBraceLineNumber(this.classLine);
        }

        if (!lineBeforeInsert) {
            vscode.window.showWarningMessage('Could not find where to insert the constant');
            return;
        }

        await this.getActiveTextEditor()?.edit((editBuilder) => {
            editBuilder.replace(selectionRange, `self::${constantName}`);
        });

        await this.getActiveTextEditor()?.insertSnippet(
            new vscode.SnippetString(this.indentText(`${this.constVisibility} const ${constantName} = ${text};\n`)),
            new vscode.Position(lineBeforeInsert + 1, 0),
            {
                undoStopBefore: false,
                undoStopAfter: false
            }
        );

        vscode.window.showInformationMessage(`You want to extract the text '${text}' in a constant named '${constantName}'? THEN DO IT YOURSELF FFS`);
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
            new vscode.Position(selection.start.line, 0),
            {
                undoStopBefore: false,
                undoStopAfter: false
            }
        );
    }

    async extractMethod() {

    }

    async promptForName(kind: string) {
        return await vscode.window.showInputBox({placeHolder: this.capitalize(kind) + ' name', prompt: `Enter the ${kind} name you want`});
    }

    capitalize(str: string) {
        return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
    }

    parseDocument(document: vscode.TextDocument | undefined) {
        let startingLine = 0;
        let endingLine = 0;
        if (document) {
            endingLine = document.lineCount - 1;
        }

        const selection = vscode.window.activeTextEditor?.selection.active;

        // Store the start of the class
        let cursorPosition = this.getActiveTextEditor()?.selection.start.line;

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

    getClassFromLine(lineNumber: number) {
        const textLine = this.getActiveTextEditor()?.document.lineAt(lineNumber);
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

    getClassOpenBraceLineNumber(classLine: vscode.TextLine) {
        const isSingleLine = /(?:.*(?:{)$)/.test(classLine.text);

        return isSingleLine ? classLine.lineNumber : (classLine.lineNumber + 1);
    }

    parseConstantPositions(startingLine: number, endingLine: number) {
        this.constantBlock = this.parseBlock(startingLine, endingLine, /(?:^(?:(?:private|protected|public)\s+)?const\s+\w+)/);
    }

    parseTraitUsagePositions(startingLine: number, endingLine: number) {
        this.traitUsageBlock = this.parseBlock(startingLine, endingLine, /(?:^\s*use\s+\w+)/);
    }

    parseBlock(startingLine: number, endingLine: number, pattern: RegExp) {
        let startBlock = null;
        let endBlock = null;
        let indentSize = 0;

        for (let lineNumber = startingLine; lineNumber <= endingLine; lineNumber++) {
            const textLine = this.getActiveTextEditor()?.document.lineAt(lineNumber);

            if (!textLine) {
                continue;
            }

            if (pattern.test(textLine.text.trim())) {
                if (!startBlock) {
                    startBlock = lineNumber;
                } else {
                    endBlock = lineNumber;
                }
            }
        }

        if (startBlock) {
            const text = this.getActiveTextEditor()?.document.lineAt(startingLine).text || '';
            indentSize = text.indexOf(text.trim());
        }

        return { start: startBlock, end: endBlock || startBlock, indentSize: indentSize };
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
            return Math.ceil(text.text.search(/\S|$/) / 4);
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
        this.classLine = undefined;
        this.constantBlock = null;
    }

}
