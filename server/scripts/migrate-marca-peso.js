import 'dotenv/config';
import mongoose from 'mongoose';
import ScanLog from '../models/ScanLog.js';

const args = process.argv.slice(2);
const confirmarExecucao = args.includes('--confirm');
const dryRun = !confirmarExecucao || args.includes('--dry-run');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não definida no .env.');
  process.exit(1);
}

async function executarMigracao() {
  console.log('======================================================================');
  console.log(
    `MIGRAÇÃO IDEMPOTENTE: marcaPeso -> marca / peso (${dryRun ? 'DRY-RUN' : 'CONFIRMED'})`
  );
  console.log('======================================================================');

  await mongoose.connect(MONGO_URI, { dbName: 'RotuScanDB' });

  const logs = await ScanLog.find({
    marcaPeso: { $exists: true, $nin: [null, ''] },
  }).lean();

  let candidatos = 0;
  let atualizados = 0;

  for (const doc of logs) {
    const marcaAtual = typeof doc.marca === 'string' ? doc.marca.trim() : '';
    const pesoAtual = typeof doc.peso === 'string' ? doc.peso.trim() : '';
    if (marcaAtual || pesoAtual) {
      continue;
    }

    const mp = String(doc.marcaPeso || '').trim();
    if (!mp) continue;

    candidatos++;
    let novaMarca = '';
    let novoPeso = '';

    if (mp.includes('•')) {
      const [mParte, ...pResto] = mp.split('•');
      novaMarca = mParte.trim().slice(0, 60);
      novoPeso = pResto.join('•').trim().slice(0, 30);
    } else {
      novaMarca = mp.slice(0, 60);
      novoPeso = '';
    }

    console.log(
      `[${dryRun ? 'DRY-RUN' : 'UPDATE'}] ScanLog ${doc._id}: marcaPeso="${mp}" -> marca="${novaMarca}", peso="${novoPeso}"`
    );

    if (!dryRun) {
      await ScanLog.updateOne(
        { _id: doc._id },
        {
          $set: {
            marca: novaMarca,
            peso: novoPeso,
          },
        }
      );
      atualizados++;
    }
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`Total de ScanLogs com marcaPeso preenchido : ${logs.length}`);
  console.log(`Candidatos que precisavam de migração      : ${candidatos}`);
  console.log(`Registros efetivamente atualizados         : ${atualizados}`);
  if (dryRun) {
    console.log('Modo --dry-run ativo (nenhum dado alterado). Use --confirm para gravar.');
  }
  console.log('----------------------------------------------------------------------');

  await mongoose.disconnect();
}

executarMigracao().catch(async (err) => {
  console.error('Erro na migração:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

