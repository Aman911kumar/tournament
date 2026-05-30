const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";
  const safeMessage =
    isProduction && statusCode >= 500
      ? "Something went wrong. Please try again later."
      : err.message || "Internal Server Error";

  console.error("Backend error:", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    stack: isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    statusCode,
    success: false,
    source: "backend",
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: safeMessage,
    errors: isProduction && statusCode >= 500 ? [] : err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default errorHandler;
