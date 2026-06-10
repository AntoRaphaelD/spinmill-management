const { AuditLog } = require('../models');

const routeToEntity = (path = '') => {
  const clean = String(path).split('?')[0].replace(/^\/api\//, '').replace(/^\/auth\//, '');
  return clean.split('/').filter(Boolean)[0] || 'system';
};

const methodToAction = (method = '') => {
  switch (String(method).toUpperCase()) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return 'READ';
  }
};

const safeBody = (body = {}) => {
  const copy = { ...body };
  delete copy.password;
  delete copy.password_hash;
  delete copy.password_salt;
  delete copy.session_token;
  return copy;
};

const writeAuditLog = async (req, overrides = {}) => {
  try {
    const user = overrides.user || req.user || {};
    await AuditLog.create({
      user_id: user.id || null,
      username: user.username || req.body?.username || null,
      action: overrides.action || methodToAction(req.method),
      method: req.method,
      path: req.originalUrl || req.url,
      entity: overrides.entity || routeToEntity(req.originalUrl || req.url),
      entity_id: overrides.entity_id || req.params?.id || null,
      status: overrides.status || 'SUCCESS',
      status_code: overrides.status_code || null,
      ip_address: req.ip || req.socket?.remoteAddress || null,
      user_agent: req.get ? req.get('user-agent') : null,
      details: overrides.details || safeBody(req.body),
      error_message: overrides.error_message || null
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = { writeAuditLog, routeToEntity, methodToAction };
