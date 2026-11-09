import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { normalizar } from '../utils/texto.js';
import { CATEGORIAS_VALIDAS } from '../models/User.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const confirmar = process.argv.includes('--confirm');
const dryRun = !confirmar || process.argv.includes('--dry-run');

if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não encontrada no .env.');
  process.exit(1);
}

function normalizarRestricoes(listaBruta) {
  if (!Array.isArray(listaBruta)) return [];
  const saida = [];
  for (const item of listaBruta) {
    const norm = normalizar(String(item));
    if (CATEGORIAS_VALIDAS.includes(norm) && !saida.includes(norm)) {
      saida.push(norm);
    }
  }
  return saida;
}

function normalizarRole(roleBruto) {
  const norm = normalizar(String(roleBruto || ''));
  if (norm.includes('nutri')) return 'NUTRICIONISTA';
  return 'PACIENTE';
}

async function executarMigracao() {
  console.log('==============================================================');
  console.log(
    dryRun
      ? 'MODO SIMULAÇÃO (--dry-run): Nenhuma alteração será gravada no banco.'
      : 'MODO EXECUÇÃO (--confirm): Migrando e normalizando registros em users.'
  );
  console.log('==============================================================\n');

  try {
    const conn = await mongoose.connect(MONGO_URI);
    const db = conn.connection.db;

    const colUsuarios = db.collection('usuarios');
    const colUsers = db.collection('users');

    const docsUsuarios = await colUsuarios.find({}).toArray();
    const docsUsers = await colUsers.find({}).toArray();

    console.log(`Encontrados ${docsUsuarios.length} documento(s) em 'usuarios' (legado).`);
    console.log(`Encontrados ${docsUsers.length} documento(s) em 'users' (oficial).\n`);

    // 1. Normalizar documentos já existentes em `users` (ex: chaves em inglês name/restrictions)
    let normalizadosEmUsers = 0;
    for (const u of docsUsers) {
      const emailNorm = String(u.email || '').trim().toLowerCase();
      if (!emailNorm) continue;

      const nomeFinal = u.nome || u.name || 'Usuário';
      const roleFinal = normalizarRole(u.role);
      const restricoesFinais = normalizarRestricoes(u.restricoes || u.restrictions);
      const niveisFinais = {
        gluten: u.niveisSensibilidade?.gluten ?? 1,
        lactose: u.niveisSensibilidade?.lactose ?? 1,
        amendoim: u.niveisSensibilidade?.amendoim ?? 1,
      };

      const precisaNormalizar =
        u.nome !== nomeFinal ||
        u.email !== emailNorm ||
        u.role !== roleFinal ||
        !Array.isArray(u.restricoes) ||
        !u.niveisSensibilidade ||
        u.name !== undefined ||
        u.restrictions !== undefined;

      if (precisaNormalizar) {
        normalizadosEmUsers++;
        console.log(
          `[NORMALIZAR users] ${emailNorm} -> nome="${nomeFinal}", role=${roleFinal}, restricoes=[${restricoesFinais.join(', ')}]`
        );
        if (!dryRun) {
          await colUsers.updateOne(
            { _id: u._id },
            {
              $set: {
                nome: nomeFinal,
                email: emailNorm,
                role: roleFinal,
                restricoes: restricoesFinais,
                niveisSensibilidade: niveisFinais,
                restricoesAtualizadasEm: u.restricoesAtualizadasEm || new Date(),
                restricoesAtualizadasPor: u.restricoesAtualizadasPor || roleFinal,
                updatedAt: new Date(),
              },
              $unset: {
                name: '',
                restrictions: '',
              },
            }
          );
        }
      }
    }

    // 2. Migrar documentos de `usuarios` para `users` (idempotente por e-mail, sem re-hashear bcrypt)
    let inseridosDeUsuarios = 0;
    let atualizadosDeUsuarios = 0;

    for (const leg of docsUsuarios) {
      const emailNorm = String(leg.email || '').trim().toLowerCase();
      if (!emailNorm) {
        console.log(`[IGNORADO] Documento _id=${leg._id} sem e-mail válido.`);
        continue;
      }

      const nomeFinal = String(leg.nome || leg.name || 'Usuário').trim();
      const roleFinal = normalizarRole(leg.role);
      const restricoesFinais = normalizarRestricoes(leg.restricoes || leg.restrictions);
      const senhaBruta = String(leg.senha || leg.password || '');
      const jaEhBcrypt = /^\$2[aby]\$/.test(senhaBruta);
      const senhaFinal = jaEhBcrypt
        ? senhaBruta
        : senhaBruta
        ? await bcrypt.hash(senhaBruta, 10)
        : await bcrypt.hash('Mudar@123', 10);

      const existenteEmUsers = await colUsers.findOne({ email: emailNorm });

      if (!existenteEmUsers) {
        inseridosDeUsuarios++;
        console.log(
          `[MIGRAR NOVO] ${emailNorm} (nome="${nomeFinal}", senha=${jaEhBcrypt ? 'bcrypt preservado' : 'texto puro -> bcrypt'}, restricoes=[${restricoesFinais.join(', ')}])`
        );
        if (!dryRun) {
          await colUsers.insertOne({
            nome: nomeFinal,
            email: emailNorm,
            senha: senhaFinal,
            avatar: leg.avatar || null,
            role: roleFinal,
            nutricionistaId: leg.nutricionistaId || null,
            restricoes: restricoesFinais,
            niveisSensibilidade: {
              gluten: leg.niveisSensibilidade?.gluten ?? 1,
              lactose: leg.niveisSensibilidade?.lactose ?? 1,
              amendoim: leg.niveisSensibilidade?.amendoim ?? 1,
            },
            restricoesAtualizadasEm: leg.updatedAt || new Date(),
            restricoesAtualizadasPor: 'PACIENTE',
            createdAt: leg.createdAt || new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        atualizadosDeUsuarios++;
        console.log(
          `[JÁ EXISTE EM users] ${emailNorm} — preservando registro existente (mesclando senha/restrições se ausentes).`
        );
        if (!dryRun) {
          const camposParaMesclar = {};
          if (!existenteEmUsers.senha && senhaFinal) {
            camposParaMesclar.senha = senhaFinal;
          }
          if (
            (!Array.isArray(existenteEmUsers.restricoes) ||
              existenteEmUsers.restricoes.length === 0) &&
            restricoesFinais.length > 0
          ) {
            camposParaMesclar.restricoes = restricoesFinais;
          }
          if (Object.keys(camposParaMesclar).length > 0) {
            await colUsers.updateOne({ _id: existenteEmUsers._id }, { $set: camposParaMesclar });
          }
        }
      }
    }

    console.log('\n--------------------------------------------------------------');
    console.log('Resumo da migração:');
    console.log(`  - Documentos normalizados em 'users': ${normalizadosEmUsers}`);
    console.log(`  - Novos usuários migrados de 'usuarios' -> 'users': ${inseridosDeUsuarios}`);
    console.log(`  - Usuários já existentes em 'users': ${atualizadosDeUsuarios}`);
    console.log(`  - Coleção de origem 'usuarios' NÃO foi apagada (preservada por segurança).`);
    if (dryRun) {
      console.log('\nPara aplicar de fato no banco, execute:');
      console.log('  npm run migrate -- --confirm');
    }
    console.log('--------------------------------------------------------------');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

executarMigracao();

