import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from "@/lib/jwtSecret";


export function verifyToken(req: NextApiRequest) {
  const token = req.cookies.token;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
