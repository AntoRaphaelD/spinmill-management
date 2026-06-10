const { writeAuditLog, methodToAction, routeToEntity } = require('../services/auditService');

const auditedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const auditMiddleware = (req, res, next) => {
  if (!auditedMethods.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    const failed = res.statusCode >= 400;
    writeAuditLog(req, {
      action: methodToAction(req.method),
      entity: routeToEntity(req.originalUrl),
      status: failed ? 'FAILED' : 'SUCCESS',
      status_code: res.statusCode,
      error_message: failed ? `HTTP ${res.statusCode}` : null
    });
  });

  next();
};

module.exports = auditMiddleware;
