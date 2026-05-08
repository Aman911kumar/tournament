const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");

    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }

    next();
};

export default securityHeaders;
