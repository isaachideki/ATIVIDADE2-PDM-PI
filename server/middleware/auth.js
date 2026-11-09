import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'rotuscan_segredo_super_seguro';

export function autenticarJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    const msg = 'Sessão expirada ou token não fornecido. Faça login novamente.';
    return res.status(401).json({ mensagem: msg });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    const msg = 'Token inválido.';
    return res.status(401).json({ mensagem: msg });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    return next();
  } catch {
    const msg = 'Sessão expirada ou inválida. Faça login novamente.';
    return res.status(401).json({ mensagem: msg });
  }
}

export function exigirPaciente(req, res, next) {
  if (req.userRole !== 'PACIENTE') {
    const msg = 'Acesso restrito a pacientes.';
    return res.status(403).json({ mensagem: msg });
  }
  return next();
}

export async function exigirNutricionista(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const msg = 'Usuário não encontrado.';
      return res.status(404).json({ mensagem: msg });
    }
    if (user.role !== 'NUTRICIONISTA') {
      const msg = 'Acesso restrito a nutricionistas.';
      return res.status(403).json({ mensagem: msg });
    }
    req.nutricionista = user;
    return next();
  } catch {
    const msg = 'Erro ao validar permissões de nutricionista.';
    return res.status(500).json({ mensagem: msg });
  }
}
