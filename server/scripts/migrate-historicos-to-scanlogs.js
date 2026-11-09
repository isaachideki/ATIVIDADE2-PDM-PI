import 'dotenv/config';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const TARGET_DB = 'RotuScanDB';
const SOURCE_DB =
  process.argv.find((arg) => arg.startsWith('--source-db='))?.split('=')[1] ||
  TARGET_DB;
const SOURCE_COLLECTION =
  process.argv
    .find((arg) => arg.startsWith('--source-collection='))
    ?.split('=')[1] || 'historicos';
const CONFIRMADO = process.argv.includes('--confirm');

function objectIdDaOrigem(id) {
  const texto = String(id ?? '');
  if (/^[a-f\d]{24}$/i.test(texto)) {
    return new mongoose.Types.ObjectId(texto);
  }

  const bytes = createHash('sha256')
    .update(`${SOURCE_DB}.${SOURCE_COLLECTION}:${texto}`)
    .digest()
    .subarray(0, 12);
  return new mongoose.Types.ObjectId(bytes);
}

function textoOpcional(valor, limite) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim().slice(0, limite);
  return texto || null;
}

function prepararScan(doc) {
  const userIdOrigem = doc.userId ?? doc.usuarioId ?? doc.user_id;
  const userIdTexto = String(userIdOrigem ?? '');
  if (!/^[a-f\d]{24}$/i.test(userIdTexto)) {
    return { erro: 'userId ausente ou não é ObjectId' };
  }

  const veredito = String(doc.veredito || doc.status || '').toUpperCase();
  if (!['SEGURO', 'PERIGOSO'].includes(veredito)) {
    return { erro: 'veredito incompatível com ScanLog' };
  }

  const createdAt = new Date(doc.createdAt || doc.data || doc.created_at);
  const updatedAt = new Date(doc.updatedAt || doc.updated_at || createdAt);
  const nomeProduto =
    textoOpcional(doc.nomeProduto || doc.nome || doc.produto, 80) ||
    'Produto analisado';

  return {
    scan: {
      _id: objectIdDaOrigem(doc._id),
      userId: new mongoose.Types.ObjectId(userIdTexto),
      escaneadoPorNome:
        textoOpcional(
          doc.escaneadoPorNome || doc.usuarioNome || doc.nomeUsuario,
          100
        ) || 'Usuário',
      nomeProduto,
      nomeAutomatico: Boolean(doc.nomeAutomatico ?? true),
      nomeBusca: nomeProduto
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase(),
      marca: textoOpcional(doc.marca, 60),
      peso: textoOpcional(doc.peso, 30),
      marcaPeso: textoOpcional(doc.marcaPeso, 100) || '',
      imagemThumb:
        typeof doc.imagemThumb === 'string' &&
        doc.imagemThumb.startsWith('data:image/jpeg;base64,')
          ? doc.imagemThumb
          : null,
      imagemUri:
        typeof doc.imagemUri === 'string' ? doc.imagemUri : null,
      imagemArquivo:
        typeof doc.imagemArquivo === 'string' ? doc.imagemArquivo : null,
      imagemDemo:
        typeof doc.imagemDemo === 'string' ? doc.imagemDemo : null,
      intoleranciaDetectada: Array.isArray(doc.intoleranciaDetectada)
        ? doc.intoleranciaDetectada
        : [],
      nivelSensibilidade: ['Leve', 'Moderado', 'Grave'].includes(
        doc.nivelSensibilidade
      )
        ? doc.nivelSensibilidade
        : 'Moderado',
      confiancaOcr:
        typeof doc.confiancaOcr === 'number' ? doc.confiancaOcr : null,
      motorOcr: textoOpcional(doc.motorOcr, 40) || 'tesseract',
      textoBruto: typeof doc.textoBruto === 'string' ? doc.textoBruto : '',
      veredito,
      alergicosDetectados: Array.isArray(doc.alergicosDetectados)
        ? doc.alergicosDetectados
        : [],
      ingredientesDetalhados: Array.isArray(doc.ingredientesDetalhados)
        ? doc.ingredientesDetalhados
        : [],
      curtido: Boolean(doc.curtido),
      seed: Boolean(doc.seed),
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
    },
  };
}

async function migrar() {
  if (!MONGO_URI) {
    throw new Error('Variável MONGO_URI / MONGODB_URI não configurada.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(SOURCE_DB) ||
      !/^[A-Za-z0-9_-]+$/.test(SOURCE_COLLECTION)) {
    throw new Error('Banco ou coleção de origem inválidos.');
  }
  if (SOURCE_DB === TARGET_DB && SOURCE_COLLECTION === 'scanlogs') {
    throw new Error('A coleção scanlogs não pode ser origem da migração.');
  }

  await mongoose.connect(MONGO_URI, { dbName: TARGET_DB });
  const source = mongoose.connection.useDb(SOURCE_DB).db.collection(
    SOURCE_COLLECTION
  );
  const target = mongoose.connection.db.collection('scanlogs');
  let lidos = 0;
  let elegiveis = 0;
  let existentes = 0;
  let ignorados = 0;
  let inseridos = 0;

  for await (const doc of source.find({})) {
    lidos++;
    const preparado = prepararScan(doc);
    if (preparado.erro) {
      ignorados++;
      console.warn(`Registro ignorado (${preparado.erro}).`);
      continue;
    }

    elegiveis++;
    const scan = preparado.scan;
    if (await target.findOne({ _id: scan._id }, { projection: { _id: 1 } })) {
      existentes++;
      continue;
    }

    if (CONFIRMADO) {
      const resultado = await target.updateOne(
        { _id: scan._id },
        { $setOnInsert: scan },
        { upsert: true }
      );
      if (resultado.upsertedCount > 0) inseridos++;
      else existentes++;
    }
  }

  console.log(
    `${CONFIRMADO ? 'Migração' : 'Dry-run'}: origem=${SOURCE_DB}.${SOURCE_COLLECTION}, destino=${TARGET_DB}.scanlogs, lidos=${lidos}, elegíveis=${elegiveis}, já existentes=${existentes}, ignorados=${ignorados}, inseridos=${inseridos}.`
  );
  if (!CONFIRMADO) {
    console.log('Nenhum documento foi alterado. Use --confirm para copiar.');
  }
}

migrar()
  .catch((err) => {
    const mensagem = String(err.message || err)
      .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[URI omitida]')
      .replace(/(password|token|secret)=([^&\s]+)/gi, '$1=[redigido]');
    console.error(`Erro na migração (${err.name || 'Error'}): ${mensagem}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
