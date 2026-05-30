const securityHeaders = (req, res, next) => {
    const scriptSrc = [
        "'self'",
        "https://checkout.razorpay.com",
        "https://accounts.google.com",
        "https://connect.facebook.net",
    ].join(" ");
    const connectSrc = [
        "'self'",
        "https:",
        "wss:",
    ].join(" ");

    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            `script-src ${scriptSrc}`,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https:",
            "media-src 'self' blob: https:",
            `connect-src ${connectSrc}`,
            "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://accounts.google.com https://www.facebook.com",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
            "form-action 'self'",
        ].join("; ")
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=(self)");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }

    next();
};

export default securityHeaders;
