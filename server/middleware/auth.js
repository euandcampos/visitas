module.exports = (token) => {
  return (req, res, next) => {
    if (!token) {
      return next();
    }

    const header = req.headers['authorization'] || '';
    const byHeader = header.startsWith('Bearer ') ? header.substring(7) : null;
    const byCustom = req.headers['x-api-token'];

    if (byHeader === token || byCustom === token) {
      return next();
    }

    return res.status(401).json({ error: 'Token inválido ou ausente' });
  };
};

