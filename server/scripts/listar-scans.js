import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERRO: Variável MONGODB_URI / MONGO_URI não encontrada no .env.');
  process.exit(1);
}

const argLimit = process.argv.find((a) => a.startsWith('--limit='));
const argPosicional = process.argv.slice(2).find((a) => !a.startsWith('--') && !isNaN(Number(a)));
const limite = argLimit
  ? Math.max(1, parseInt(argLimit.split('=')[1], 10) || 20)
  : argPosicional
  ? Math.max(1, parseInt(argPosicional, 10) || 20)
  : 20;

function formatarDataHoraSP(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(d);
}

function formatarAlergenos(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return 'Nenhum';
  return lista
    .map((a) => {
      const cat = (a.categoria || '').toUpperCase();
      const tipo = a.tipo || 'CONTEM';
      const termos = Array.isArray(a.termos) && a.termos.length ? ` (${a.termos.join(', ')})` : '';
      return `${cat} [${tipo}]${termos}`;
    })
    .join('; ');
}

async function listarScans() {
  console.log('======================================================================');
  console.log(`LISTAGEM DE ESCANEAMENTOS COM $LOOKUP EM USERS (ÚLTIMOS ${limite})`);
  console.log('======================================================================\n');

  try {
    const conn = await mongoose.connect(MONGO_URI, { dbName: 'RotuScanDB' });
    const db = conn.connection.db;

    const pipeline = [
      { $sort: { createdAt: -1 } },
      { $limit: limite },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$uid'] },
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$uid' }] },
                  ],
                },
              },
            },
          ],
          as: 'usuario',
        },
      },
      {
        $unwind: {
          path: '$usuario',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const scans = await db.collection('scanlogs').aggregate(pipeline).toArray();

    if (scans.length === 0) {
      console.log('Nenhum escaneamento encontrado na coleção scanlogs.\n');
      await mongoose.disconnect();
      return;
    }

    console.log(`Encontrados ${scans.length} escaneamento(s):\n`);

    const tabela = scans.map((s, idx) => {
      const usuarioNome = s.usuario?.nome || '(Órfão / Usuário excluído)';
      const usuarioEmail = s.usuario?.email || '-';
      const usuarioRole = s.usuario?.role || '-';
      const veredito = s.veredito === 'SEGURO' ? 'SEGURO' : 'PERIGOSO';

      return {
        '#': idx + 1,
        DataHoraSP: formatarDataHoraSP(s.createdAt),
        Veredito: veredito,
        Produto: (s.nomeProduto || 'Produto').slice(0, 28),
        PacienteNome: usuarioNome.slice(0, 20),
        PacienteEmail: usuarioEmail.slice(0, 24),
        Role: usuarioRole,
        Curtido: s.curtido ? 'Sim' : 'Não',
        Alergenos: formatarAlergenos(s.alergicosDetectados).slice(0, 40),
        ScanId: String(s._id),
      };
    });

    console.table(tabela);

    console.log('\nLigação de integridade:');
    console.log('• userId (ObjectId, ref: User) é a referência canônica do paciente.');
    console.log('• escaneadoPorNome é apenas uma cópia informativa do nome no instante do scan.');
    console.log('• Clientes e o painel Web obtêm o perfil do paciente via $lookup ou Mongoose populate(\'userId\', \'nome email role\').\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Erro ao listar escaneamentos:', err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

listarScans();
