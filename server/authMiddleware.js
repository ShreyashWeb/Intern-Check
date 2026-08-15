import jwt from 'jsonwebtoken';

/**
 * Authentication middleware to verify JWT in HTTP headers.
 * Expects: Authorization: Bearer <token>
 * 
 * SECURITY NOTE:
 * JWT is stored in localStorage on the client-side for this version, which makes it simple for local dev 
 * but vulnerable to Cross-Site Scripting (XSS) attacks. In a production-grade system, it is recommended 
 * to store JWTs in secure, httpOnly, SameSite cookies to mitigate XSS token exfiltration risks.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Token is missing or malformed.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'default_jwt_secret_key';
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // Sets req.user = { userId, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Access denied. Token is invalid or expired.' });
  }
}
