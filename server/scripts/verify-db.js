import 'dotenv/config';
import mongoose from 'mongoose';
import User, { CATEGORIAS, NIVEIS } from '../models/User.js';
import Nutricionista from '../models/Nutricionista.js';
import ScanLog from '../models/ScanLog.js';
import Feedback from '../models/Feedback.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não definida.');
  process.exit(1);
}

async function verificarBanco() {
  await mongoose.connect(MONGO_URI, { dbName: 'RotuScanDB' });

  const [users, nutricionistas, scanlogs, feedbacks, scanImageTypes] =
    await Promise.all([
      User.find()
        .select('_id nome email role nutricionistaId restricoes niveisSensibilidade')
        .lean(),
      Nutricionista.find().select('nome crn tratamento').lean(),
      ScanLog.find()
        .select(
          '_id userId nomeProduto veredito intoleranciaDetectada alergicosDetectados createdAt'
        )
        .lean(),
      Feedback.find().select('_id userId mensagem').lean(),
      ScanLog.collection
        .aggregate([
          {
            $project: {
              imagemUriTipo: { $type: '$imagemUri' },
              imagemArquivoTipo: { $type: '$imagemArquivo' },
              imagemThumbTipo: { $type: '$imagemThumb' },
            },
          },
        ])
        .toArray(),
    ]);

  const usersById = new Set(users.map((user) => String(user._id)));
  const nutricionistasById = new Set(
    nutricionistas.map((nutri) => String(nutri._id))
  );
  const scanlogsOrfaos = scanlogs.filter(
    (scan) => !scan.userId || !usersById.has(String(scan.userId))
  );
  const vinculosInvalidos = users.filter(
    (user) =>
      user.nutricionistaId &&
      !nutricionistasById.has(String(user.nutricionistaId))
  );
  const enumsInvalidosUsers = users.filter((user) => {
    if (user.role && !['PACIENTE', 'NUTRICIONISTA'].includes(user.role)) {
      return true;
    }
    if (
      Array.isArray(user.restricoes) &&
      user.restricoes.some((restriction) => !CATEGORIAS.includes(restriction))
    ) {
      return true;
    }
    const niveis = user.niveisSensibilidade || {};
    return CATEGORIAS.some(
      (categoria) =>
        niveis[categoria] !== undefined && !NIVEIS.includes(niveis[categoria])
    );
  }).length;
  const alergicosInvalidos = scanlogs.filter(
    (scan) =>
      !['SEGURO', 'PERIGOSO'].includes(scan.veredito) ||
      !Array.isArray(scan.alergicosDetectados) ||
      scan.alergicosDetectados.some(
        (alergeno) =>
          !alergeno ||
          typeof alergeno !== 'object' ||
          !CATEGORIAS.includes(alergeno.categoria) ||
          !['CONTEM', 'TRACOS'].includes(alergeno.tipo)
      )
  ).length;
  const camposObrigatoriosAusentes =
    users.filter((user) => !user.nome || !user.email).length +
    scanlogs.filter((scan) => !scan.userId || !scan.veredito || !scan.nomeProduto)
      .length +
    feedbacks.filter((feedback) => !feedback.userId || !feedback.mensagem)
      .length;
  const tiposImagem = scanImageTypes.reduce(
    (totals, scan) => {
      for (const field of [
        'imagemUriTipo',
        'imagemArquivoTipo',
        'imagemThumbTipo',
      ]) {
        const type = scan[field];
        totals[field][type] = (totals[field][type] || 0) + 1;
      }
      return totals;
    },
    {
      imagemUriTipo: {},
      imagemArquivoTipo: {},
      imagemThumbTipo: {},
    }
  );

  console.log('VERIFICAÇÃO SOMENTE-LEITURA — RotuScanDB');
  console.table([
    {
      Verificacao: 'Coleção users',
      Total: users.length,
      Inconsistencias: camposObrigatoriosAusentes,
      Status: camposObrigatoriosAusentes === 0 ? 'OK' : 'ATENÇÃO',
    },
    {
      Verificacao: 'Vínculos users → nutricionistas',
      Total: users.length,
      Inconsistencias: vinculosInvalidos.length,
      Status: vinculosInvalidos.length === 0 ? 'OK' : 'ATENÇÃO',
    },
    {
      Verificacao: 'Referências de scanlogs → users',
      Total: scanlogs.length,
      Inconsistencias: scanlogsOrfaos.length,
      Status: scanlogsOrfaos.length === 0 ? 'OK' : 'ATENÇÃO',
    },
    {
      Verificacao: 'Enums de users',
      Total: users.length,
      Inconsistencias: enumsInvalidosUsers,
      Status: enumsInvalidosUsers === 0 ? 'OK' : 'ATENÇÃO',
    },
    {
      Verificacao: 'Estrutura scanlogs',
      Total: scanlogs.length,
      Inconsistencias: alergicosInvalidos,
      Status: alergicosInvalidos === 0 ? 'OK' : 'ATENÇÃO',
    },
  ]);
  console.log(
    JSON.stringify({
      colecoesEsperadas: {
        users: users.length,
        nutricionistas: nutricionistas.length,
        scanlogs: scanlogs.length,
        feedbacks: feedbacks.length,
      },
      camposScan: {
        intoleranciaDetectada:
          scanlogs.length > 0 && Array.isArray(scanlogs[0].intoleranciaDetectada)
            ? 'array'
            : 'ausente ou vazio',
        alergicosDetectados:
          scanlogs.length > 0 && Array.isArray(scanlogs[0].alergicosDetectados)
            ? 'array de objetos'
            : 'ausente ou vazio',
        tiposImagem,
      },
    })
  );

  await mongoose.disconnect();
}

verificarBanco().catch(async (err) => {
  console.error('Erro ao verificar o banco de dados.');
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
