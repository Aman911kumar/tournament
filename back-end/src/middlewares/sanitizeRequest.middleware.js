import ApiError from "../utils/ApiError.js";

const dangerousKeyPattern = /^\$|[.]/;

const assertSafeKeys = (value, path = "body") => {
    if (!value || typeof value !== "object") return;
    if (value instanceof Date || Buffer.isBuffer(value)) return;

    if (Array.isArray(value)) {
        value.forEach((item, index) => assertSafeKeys(item, `${path}[${index}]`));
        return;
    }

    for (const key of Object.keys(value)) {
        if (dangerousKeyPattern.test(key)) {
            throw new ApiError(400, `Invalid request field: ${path}.${key}`);
        }
        assertSafeKeys(value[key], `${path}.${key}`);
    }
};

const sanitizeRequest = (req, res, next) => {
    assertSafeKeys(req.body, "body");
    assertSafeKeys(req.query, "query");
    assertSafeKeys(req.params, "params");
    next();
};

export default sanitizeRequest;
