import engine, { AST, Location, Position as PhpParserPosition, Node } from 'php-parser';

const engineObject = new engine({
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

// Extending php-parser as node definition is not precise enough for typescript
interface Property extends Node {
    name: { name: string };
}

interface ASTObject extends Node {
    kind: String;
    parent: ASTObject|null|undefined;
    children: Array<ASTObject>;
    properties: Array<Property>;
    traits: Array<ASTTraitObject>;
}

interface ASTTraitObject extends ASTObject {
    name: string;
}

interface ASTClassObject extends ASTObject {
    body: Array<ASTObject>;
}

interface ASTBlockObject extends ASTObject {
    body: { loc: Location };
}

interface ASTMethodObject extends ASTObject {
    body: ASTObject;
    name: { name: string };
}

// Custom objects

interface Structure {
    getStartPosition(): PhpParserPosition;
    getEndPosition(): PhpParserPosition;
}

abstract class StructureObject implements Structure {
    protected loc: Location;
    protected parent: StructureObject|null;

    constructor(loc: Location, parent: StructureObject|null) {
        this.loc = loc;
        this.parent = parent;
    }

    getStartPosition(): PhpParserPosition
    {
        return this.loc.start;
    }

    getEndPosition(): PhpParserPosition
    {
        return this.loc.end;
    }

    getParent(): StructureObject|null {
        return this.parent;
    }
}

class ClassStructure extends StructureObject {
    private firstBodyLine: number;
    private traits: Array<TraitStructure> = [];
    private constants: Array<ConstantStructure> = [];
    private properties: Array<PropertyStructure> = [];
    private methods: Array<MethodStructure> = [];

    private isSorted: {
        traits: boolean,
        constants: boolean,
        properties: boolean,
        methods: boolean
    };

    constructor(loc: Location, firstBodyElementPosition: PhpParserPosition|null) {
        super(loc, null);
        this.isSorted = {
            traits: false,
            constants: false,
            properties: false,
            methods: false
        };

        const comparingLocation = firstBodyElementPosition ?? this.loc.end;
        this.firstBodyLine = comparingLocation.line.valueOf();
    }

    addTrait(trait: TraitStructure): void
    {
        this.isSorted.traits = false;
        this.traits.push(trait);
    }

    addConstant(constant: ConstantStructure): void
    {
        this.isSorted.constants = false;
        this.constants.push(constant);
    }

    addProperty(property: PropertyStructure): void
    {
        this.isSorted.properties = false;
        this.properties.push(property);
    }

    addMethod(method: MethodStructure): void
    {
        this.isSorted.methods = false;
        this.methods.push(method);
    }

    hasConstant(): boolean
    {
        return this.constants.length > 0;
    }

    getFirstConstant(): ConstantStructure
    {
        this.sortConstantBlock();

        return this.constants[0];
    }

    getLastConstant(): ConstantStructure
    {
        this.sortConstantBlock();

        return this.constants[this.constants.length - 1];
    }

    hasTraitUsage(): boolean
    {
        return this.traits.length > 0;
    }

    getFirstTrait() {
        this.sortTraitBlock();

        return this.traits[0];
    }

    getLastTrait(): TraitStructure
    {
        this.sortTraitBlock();

        return this.traits[this.traits.length - 1];
    }

    getFirstBodyLine(): number
    {
        return this.firstBodyLine;
    }

    getMethods(): Array<MethodStructure>
    {
        return this.methods;
    }

    private sortConstantBlock(): void
    {
        if (this.isSorted.constants === true) {
            return;
        }

        this.constants.sort((constant1, constant2) => constant1.getStartPosition().line < constant2.getStartPosition().line ? -1 : 1);
        this.isSorted.constants = true;
    }

    private sortTraitBlock(): void
    {
        if (this.isSorted.traits === true) {
            return;
        }

        this.traits.sort((trait1, trait2) => trait1.getStartPosition().line < trait2.getStartPosition().line ? -1 : 1);
    }
}

class TraitStructure extends StructureObject {
    name: string;

    constructor(loc: Location, parent: StructureObject, name: string) {
        super(loc, parent);
        this.name = name;
    }
}

class MethodStructure extends StructureObject {
    private name: String;
    private children: Array<Structure> = [];

    constructor(loc: Location, parent: StructureObject, name: String) {
        super(loc, parent);
        this.name = name;
    }

    addChild(child: Structure) {
        this.children.push(child);
    }

    getChildren(): Array<Structure>
    {
        return this.children;
    }

    getName(): string
    {
        return this.name.valueOf();
    }
}

class ConstantStructure extends StructureObject {
}

class PropertyStructure extends StructureObject {
    name: String;

    constructor(loc: Location, parent: StructureObject, name: String) {
        super(loc, parent);
        this.name = name;
    }
}

class BlockStructure extends StructureObject {
    kind: String;
    bodyLocation: Location;

    constructor(loc: Location, parent: StructureObject, kind: String, bodyLocation: Location) {
        super(loc, parent);
        this.kind = kind;
        this.bodyLocation = bodyLocation;
    }
}

class ExpressionStatementStructure extends StructureObject {
    private kind: string;

    constructor(loc: Location, parent: StructureObject, kind: string) {
        super(loc, parent);
        this.kind = kind;
    }
}

function parseCode(code: string): ClassStructure {
    const classObject = getClassObject(code);
    console.log(classObject);
    if (!classObject) {
        throw new Error('The parser needs a class to work');
    }
    const classStruct = new ClassStructure(classObject.loc, classObject.body[0]?.loc.start);

    classObject.body.forEach(child => {
        if (child.kind === 'classconstant') {
            classStruct.addConstant(new ConstantStructure(child.loc, classStruct));
        } else if (child.kind === 'propertystatement') {
            classStruct.addProperty(new PropertyStructure(child.loc, classStruct, child.properties[0].name.name));
        } else if (child.kind === 'method') {
            classStruct.addMethod(parseMethod(child as ASTMethodObject, classStruct));
        } else if (child.kind === 'traituse') {
            // TODO handle multiple traits in a single use statement
            classStruct.addTrait(new TraitStructure(child.loc, classStruct, child.traits[0].name));
        }
    });

    return classStruct;
}

function getClassObject(code: string) {
    const program = engineObject.parseCode(code);
    const classOrNamespace = program.children.filter(value => {
        return ['namespace', 'class'].includes(value.kind.toString());
    })[0] as ASTObject;

    if (classOrNamespace.kind === "namespace") {
        const classArray = classOrNamespace.children.filter(child => {
            return child.kind === 'class';
        });
        if (classArray.length > 0) {
            return classArray[0] as ASTClassObject;
        }
    } else if (classOrNamespace.kind === 'class') {
        return classOrNamespace as ASTClassObject;
    }

    return undefined;
}

function parseMethod(astNode: ASTMethodObject, parent: StructureObject) {
    const method = new MethodStructure(astNode.loc, parent, astNode.name.name);

    astNode.body.children.forEach(child => {
        method.addChild(parseBlockChild(child, method));
    });

    return method;
}

function parseBlockChild(child: ASTBlockObject, parent: StructureObject): Structure {
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
        const blockChild = child as ASTBlockObject;
        return new BlockStructure(blockChild.loc, parent, blockChild.kind, blockChild.body.loc);
    } else if (child.kind === 'expressionstatement') {
        return new ExpressionStatementStructure(child.loc, parent, child.kind.valueOf());
    } else if (child.kind === 'if') {

    }

    throw new Error("Undefined child kind");
}

export {
    parseCode,
    ClassStructure
};