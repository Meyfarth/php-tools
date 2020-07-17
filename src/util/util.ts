function* range(start: number, end: number): Generator<number, void, undefined> {
    yield start;

    if (start === end) {
        return;
    }

    yield* range(start + 1, end);
}

export {
    range,
};