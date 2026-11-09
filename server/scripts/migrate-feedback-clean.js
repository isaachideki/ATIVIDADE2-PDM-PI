import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const confirmar = process.argv.includes('--confirm');
const dryRun = !confirmar || process.argv.includes('--dry-run');

if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não encontrada no .env.');
  process.exit(1);
}

async function migrarFeedbacks() {
  console.log('==============================================================');
  console.log(
    dryRun
      ? 'MODO SIMULAÇÃO (--dry-run): Nenhuma alteração será gravada no banco.'
      : 'MODO EXECUÇÃO (--confirm): Removendo campos legados de feedbacks.'
  );
  console.log('==============================================================\n');

  try {
    const conn = await mongoose.connect(MONGO_URI);
    const db = conn.connection.db;
    const colFeedbacks = db.collection('feedbacks');

    const filtroLegado = {
      $or: [
        { tipo: { $exists: true } },
        { plataforma: { $exists: true } },
        { appVersao: { $exists: true } },
      ],
    };

    const totalLegados = await colFeedbacks.countDocuments(filtroLegado);
    const totalGeral = await colFeedbacks.countDocuments({});

    console.log(`Total de documentos em 'feedbacks': ${totalGeral}`);
    console.log(
      `Documentos com campos legados (tipo, plataforma, appVersao): ${totalLegados}\n`
    );

    if (totalLegados === 0) {
      console.log('Nenhum documento com campos legados encontrado. A coleção já está limpa.');
      await mongoose.disconnect();
      return;
    }

    if (dryRun) {
      const amostra = await colFeedbacks
        .find(filtroLegado)
        .limit(5)
        .project({ _id: 1, tipo: 1, plataforma: 1, appVersao: 1, mensagem: 1 })
        .toArray();

      console.log('Amostra de documentos que seriam atualizados com $unset:');
      amostra.forEach((doc, idx) => {
        const camposPresentes = ['tipo', 'plataforma', 'appVersao'].filter(
          (c) => doc[c] !== undefined
        );
        console.log(
          `  [${idx + 1}] ID: ${doc._id} | Campos a remover: ${camposPresentes.join(', ')} | Msg: "${(doc.mensagem || '').slice(0, 30)}..."`
        );
      });

      console.log(
        '\nPara aplicar a limpeza permanentemente, execute com a flag --confirm:\n  node server/scripts/migrate-feedback-clean.js --confirm\n'
      );
    } else {
      const resultado = await colFeedbacks.updateMany(filtroLegado, {
        $unset: {
          tipo: '',
          plataforma: '',
          appVersao: '',
        },
      });

      console.log('Migração concluída com sucesso:');
      console.log(`- Documentos correspondentes: ${resultado.matchedCount}`);
      console.log(`- Documentos modificados: ${resultado.modifiedCount}`);
      console.log('- Campos legados (tipo, plataforma, appVersao) removidos com $unset.\n');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Erro durante a execução da migração de feedbacks:', err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

migrarFeedbacks();

