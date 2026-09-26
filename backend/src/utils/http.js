class AppError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const notFound = (req, res) => res.status(404).json({ error: { message: 'Route not found.' } });
const errorHandler = (error, req, res, next) => { console.error(error); res.status(error.status || 500).json({ error: { message: error.message || 'Unexpected server error.', details: error.details } }); };
module.exports = { AppError, notFound, errorHandler };
