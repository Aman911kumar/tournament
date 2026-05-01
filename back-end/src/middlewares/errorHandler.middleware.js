const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  console.error("Backend error:", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    statusCode,
    success: false,
    source: "backend",
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default errorHandler;
