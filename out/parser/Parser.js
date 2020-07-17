"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassStructure = exports.parseCode = void 0;
const php_parser_1 = require("php-parser");
const engineObject = new php_parser_1.default({
    parser: {
        extractDoc: false
    },
    lexer: {
        short_tags: true
    },
    ast: {
        withPositions: true
    }
});
class StructureObject {
    constructor(loc, parent) {
        this.loc = loc;
        this.parent = parent;
    }
    getStartPosition() {
        return this.loc.start;
    }
    getEndPosition() {
        return this.loc.end;
    }
    getParent() {
        return this.parent;
    }
}
class ClassStructure extends StructureObject {
    constructor(loc, firstBodyElementPosition) {
        super(loc, null);
        this.traits = [];
        this.constants = [];
        this.properties = [];
        this.methods = [];
        this.isSorted = {
            traits: false,
            constants: false,
            properties: false,
            methods: false
        };
        const comparingLocation = firstBodyElementPosition !== null && firstBodyElementPosition !== void 0 ? firstBodyElementPosition : this.loc.end;
        this.firstBodyLine = comparingLocation.line.valueOf();
    }
    addTrait(trait) {
        this.isSorted.traits = false;
        this.traits.push(trait);
    }
    addConstant(constant) {
        this.isSorted.constants = false;
        this.constants.push(constant);
    }
    addProperty(property) {
        this.isSorted.properties = false;
        this.properties.push(property);
    }
    addMethod(method) {
        this.isSorted.methods = false;
        this.methods.push(method);
    }
    hasConstant() {
        return this.constants.length > 0;
    }
    getFirstConstant() {
        this.sortConstantBlock();
        return this.constants[0];
    }
    getLastConstant() {
        this.sortConstantBlock();
        return this.constants[this.constants.length - 1];
    }
    hasTraitUsage() {
        return this.traits.length > 0;
    }
    getFirstTrait() {
        this.sortTraitBlock();
        return this.traits[0];
    }
    getLastTrait() {
        this.sortTraitBlock();
        return this.traits[this.traits.length - 1];
    }
    getFirstBodyLine() {
        return this.firstBodyLine;
    }
    getMethods() {
        return this.methods;
    }
    sortConstantBlock() {
        if (this.isSorted.constants === true) {
            return;
        }
        this.constants.sort((constant1, constant2) => constant1.getStartPosition().line < constant2.getStartPosition().line ? -1 : 1);
        this.isSorted.constants = true;
    }
    sortTraitBlock() {
        if (this.isSorted.traits === true) {
            return;
        }
        this.traits.sort((trait1, trait2) => trait1.getStartPosition().line < trait2.getStartPosition().line ? -1 : 1);
    }
}
exports.ClassStructure = ClassStructure;
class TraitStructure extends StructureObject {
    constructor(loc, parent, name) {
        super(loc, parent);
        this.name = name;
    }
}
class MethodStructure extends StructureObject {
    constructor(loc, parent, name) {
        super(loc, parent);
        this.children = [];
        this.name = name;
    }
    addChild(child) {
        this.children.push(child);
    }
    getChildren() {
        return this.children;
    }
    getName() {
        return this.name.valueOf();
    }
}
class ConstantStructure extends StructureObject {
}
class PropertyStructure extends StructureObject {
    constructor(loc, parent, name) {
        super(loc, parent);
        this.name = name;
    }
}
class BlockStructure extends StructureObject {
    constructor(loc, parent, kind, bodyLocation) {
        super(loc, parent);
        this.kind = kind;
        this.bodyLocation = bodyLocation;
    }
}
class ExpressionStatementStructure extends StructureObject {
    constructor(loc, parent, kind) {
        super(loc, parent);
        this.kind = kind;
    }
}
function parseCode(code) {
    var _a;
    const classObject = getClassObject(code);
    console.log(classObject);
    if (!classObject) {
        throw new Error('The parser needs a class to work');
    }
    const classStruct = new ClassStructure(classObject.loc, (_a = classObject.body[0]) === null || _a === void 0 ? void 0 : _a.loc.start);
    classObject.body.forEach(child => {
        if (child.kind === 'classconstant') {
            classStruct.addConstant(new ConstantStructure(child.loc, classStruct));
        }
        else if (child.kind === 'propertystatement') {
            classStruct.addProperty(new PropertyStructure(child.loc, classStruct, child.properties[0].name.name));
        }
        else if (child.kind === 'method') {
            classStruct.addMethod(parseMethod(child, classStruct));
        }
        else if (child.kind === 'traituse') {
            // TODO handle multiple traits in a single use statement
            classStruct.addTrait(new TraitStructure(child.loc, classStruct, child.traits[0].name));
        }
    });
    return classStruct;
}
exports.parseCode = parseCode;
function getClassObject(code) {
    const program = engineObject.parseCode(code);
    const classOrNamespace = program.children.filter(value => {
        return ['namespace', 'class'].includes(value.kind.toString());
    })[0];
    if (classOrNamespace.kind === "namespace") {
        const classArray = classOrNamespace.children.filter(child => {
            return child.kind === 'class';
        });
        if (classArray.length > 0) {
            return classArray[0];
        }
    }
    else if (classOrNamespace.kind === 'class') {
        return classOrNamespace;
    }
    return undefined;
}
function parseMethod(astNode, parent) {
    const method = new MethodStructure(astNode.loc, parent, astNode.name.name);
    astNode.body.children.forEach(child => {
        method.addChild(parseBlockChild(child, method));
    });
    return method;
}
function parseBlockChild(child, parent) {
    /*if (hasBlockBody(child)) {
        const blockChild = child as ASTBlockObject;
        const blockStructure = new BlockStructure(blockChild.loc, parent, blockChild.kind, blockChild.body.loc);
        // TODO add block structure that might contain other block structure
        for (todo as I dont know yet) {

        }
        blockStructure.addChild(parseBlockChild(child));

        //TODO: IF it's not a block I just store the object as is. Variables will be inserted the line before the object.

        //TODO: If it's a block, I need to determine where in the block I am. Too sleepy to check now
    }*/
    if (child.kind === 'for' || child.kind === 'foreach') {
        const blockChild = child;
        return new BlockStructure(blockChild.loc, parent, blockChild.kind, blockChild.body.loc);
    }
    else if (child.kind === 'expressionstatement') {
        return new ExpressionStatementStructure(child.loc, parent, child.kind.valueOf());
    }
    else if (child.kind === 'if') {
    }
    throw new Error("Undefined child kind");
}
//# sourceMappingURL=Parser.js.map