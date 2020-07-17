"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Foreach = exports.Switch = exports.Do = exports.While = exports.If = exports.Method = void 0;
class StructureObject {
    constructor() {
        this.children = [];
        this.signature = null;
        this.body = null;
        this.parent = null;
    }
}
class Method extends StructureObject {
}
exports.Method = Method;
class If extends StructureObject {
}
exports.If = If;
class While extends StructureObject {
}
exports.While = While;
class Do extends StructureObject {
}
exports.Do = Do;
class Switch extends StructureObject {
}
exports.Switch = Switch;
class Foreach extends StructureObject {
}
exports.Foreach = Foreach;
//# sourceMappingURL=StructureObject.js.map