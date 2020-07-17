"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.range = void 0;
function* range(start, end) {
    yield start;
    if (start === end) {
        return;
    }
    yield* range(start + 1, end);
}
exports.range = range;
//# sourceMappingURL=util.js.map