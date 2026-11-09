import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ScanLog from '../models/ScanLog.js';
import { normalizar } from '../utils/texto.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não encontrada no .env.');
  process.exit(1);
}

const args = process.argv.slice(2);
const modoLimpar = args.includes('--clear');
const emailArg = args.find((a) => !a.startsWith('--'));

if (!emailArg) {
  console.error('Uso:');
  console.error('  npm run seed:demo -- <email-do-usuario>');
  console.error('  npm run seed:demo:clear -- <email-do-usuario>');
  process.exit(1);
}

function construirItensDemo(userId) {
  const agora = new Date();
  const hoje1 = new Date(agora.getTime() - 15 * 60 * 1000);   const hoje2 = new Date(agora.getTime() - 2 * 60 * 60 * 1000);   const ontem1 = new Date(agora.getTime() - 24 * 60 * 60 * 1000 - 30 * 60 * 1000);
  const ontem2 = new Date(agora.getTime() - 26 * 60 * 60 * 1000);
  const cincoDias1 = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);
  const cincoDias2 = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000);
  const cincoDias3 = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000);

  return [
    {
      userId,
      nomeProduto: 'Leitinho',
      nomeAutomatico: false,
      nomeBusca: normalizar('Leitinho'),
      marcaPeso: 'Marca Silk • 1L',
      imagemArquivo: null,
      imagemDemo: 'leitinho.png',
      textoBruto:
        'INGREDIENTES: Água, pasta de amêndoas reconstituída, carbonato de cálcio, sal marinho, estabilizante goma gelana e aromatizante natural. ALÉRGICOS: CONTÉM AMÊNDOAS. NÃO CONTÉM GLÚTEN. ZERO LACTOSE.',
      veredito: 'SEGURO',
      alergicosDetectados: [],
      ingredientesDetalhados: [
        { nome: 'Água', risco: false, fonte: null },
        { nome: 'Pasta de amêndoas reconstituída', risco: false, fonte: null },
        { nome: 'Carbonato de cálcio', risco: false, fonte: null },
        { nome: 'Sal marinho', risco: false, fonte: null },
      ],
      curtido: true,
      seed: true,
      createdAt: hoje1,
      updatedAt: hoje1,
    },
    {
      userId,
      nomeProduto: 'Cebolitinhos',
      nomeAutomatico: false,
      nomeBusca: normalizar('Cebolitinhos'),
      marcaPeso: 'Marca ElmaChips • 100g',
      imagemArquivo: null,
      imagemDemo: 'cebolitinhos.png',
      textoBruto:
        'INGREDIENTES: Farinha de trigo enriquecida com ferro e ácido fólico, óleo vegetal de milho, cebola desidratada, sal e corante amarelo. ALÉRGICOS: CONTÉM DERIVADOS DE TRIGO. CONTÉM GLÚTEN.',
      veredito: 'PERIGOSO',
      alergicosDetectados: [
        {
          categoria: 'gluten',
          tipo: 'CONTEM',
          termos: ['farinha de trigo', 'trigo', 'gluten'],
        },
      ],
      ingredientesDetalhados: [
        {
          nome: 'Farinha de Trigo Enriquecida',
          risco: true,
          fonte: 'Fonte de Glúten',
        },
        { nome: 'Cebola', risco: false, fonte: null },
        { nome: 'Milho', risco: false, fonte: null },
        { nome: 'Corante amarelo', risco: false, fonte: null },
      ],
      curtido: true,
      seed: true,
      createdAt: hoje2,
      updatedAt: hoje2,
    },
    {
      userId,
      nomeProduto: 'Sorvetinho',
      nomeAutomatico: false,
      nomeBusca: normalizar('Sorvetinho'),
      marcaPeso: 'Marca: Perfetto • 1kg',
      imagemArquivo: null,
      imagemDemo: 'sorvetinho.png',
      textoBruto:
        'INGREDIENTES: Água, açúcar, cacau em pó, trufa zero lactose, chocolate meio amargo vegano e estabilizante goma guar. NÃO CONTÉM GLÚTEN. ZERO LACTOSE.',
      veredito: 'SEGURO',
      alergicosDetectados: [],
      ingredientesDetalhados: [
        { nome: 'Trufa', risco: false, fonte: null },
        { nome: 'Chocolate', risco: false, fonte: null },
        { nome: 'Sorvete', risco: false, fonte: null },
      ],
      curtido: true,
      seed: true,
      createdAt: ontem1,
      updatedAt: ontem1,
    },
    {
      userId,
      nomeProduto: 'Cervejinha',
      nomeAutomatico: false,
      nomeBusca: normalizar('Cervejinha'),
      marcaPeso: 'Marca Stella • 330ml',
      imagemArquivo: null,
      imagemDemo: 'cervejinha.png',
      textoBruto:
        'INGREDIENTES: Água, malte de cevada e lúpulo. Sem glúten (processo enzimático certificadamente isento de glúten). NÃO CONTÉM GLÚTEN.',
      veredito: 'SEGURO',
      alergicosDetectados: [],
      ingredientesDetalhados: [
        { nome: 'Água', risco: false, fonte: null },
        { nome: 'Lúpulo', risco: false, fonte: null },
      ],
      curtido: true,
      seed: true,
      createdAt: ontem2,
      updatedAt: ontem2,
    },
    {
      userId,
      nomeProduto: 'Chocolatinho',
      nomeAutomatico: false,
      nomeBusca: normalizar('Chocolatinho'),
      marcaPeso: 'Marca Cacau • 90g',
      imagemArquivo: null,
      imagemDemo: 'chocolatinho.png',
      textoBruto:
        'INGREDIENTES: Massa de cacau, açúcar demerara, manteiga de cacau e emulsificante lecitina de girassol. NÃO CONTÉM GLÚTEN. SEM LACTOSE.',
      veredito: 'SEGURO',
      alergicosDetectados: [],
      ingredientesDetalhados: [
        { nome: 'Massa de cacau', risco: false, fonte: null },
        { nome: 'Açúcar demerara', risco: false, fonte: null },
        { nome: 'Manteiga de cacau', risco: false, fonte: null },
      ],
      curtido: true,
      seed: true,
      createdAt: cincoDias1,
      updatedAt: cincoDias1,
    },
    {
      userId,
      nomeProduto: 'Suplementinho',
      nomeAutomatico: false,
      nomeBusca: normalizar('Suplementinho'),
      marcaPeso: 'Marca VeganPro • 900g',
      imagemArquivo: null,
      imagemDemo: 'suplementinho.png',
      textoBruto:
        'INGREDIENTES: Proteína isolada de ervilha, proteína de arroz, cacau alcalino e edulcorante natural. NÃO CONTÉM GLÚTEN. ZERO LACTOSE.',
      veredito: 'SEGURO',
      alergicosDetectados: [],
      ingredientesDetalhados: [
        { nome: 'Proteína isolada de ervilha', risco: false, fonte: null },
        { nome: 'Proteína de arroz', risco: false, fonte: null },
        { nome: 'Cacau alcalino', risco: false, fonte: null },
      ],
      curtido: false,
      seed: true,
      createdAt: cincoDias2,
      updatedAt: cincoDias2,
    },
    {
      userId,
      nomeProduto: 'Torradinha',
      nomeAutomatico: false,
      nomeBusca: normalizar('Torradinha'),
      marcaPeso: 'Marca Schär • 150g',
      imagemArquivo: null,
      imagemDemo: 'torradinha.png',
      textoBruto:
        'INGREDIENTES: Amido de milho, farinha de arroz, óleo de girassol, açúcar, fibra vegetal e sal. NÃO CONTÉM GLÚTEN. SEM LACTOSE.',
      veredito: 'SEGURO',
      alergicosDetectados: [],
      ingredientesDetalhados: [
        { nome: 'Amido de milho', risco: false, fonte: null },
        { nome: 'Farinha de arroz', risco: false, fonte: null },
        { nome: 'Óleo de girassol', risco: false, fonte: null },
      ],
      curtido: false,
      seed: true,
      createdAt: cincoDias3,
      updatedAt: cincoDias3,
    },
  ];
}

async function executarSeedDemo() {
  try {
    await mongoose.connect(MONGO_URI);
    const emailNorm = emailArg.trim().toLowerCase();
    const user = await User.findOne({ email: emailNorm });

    if (!user) {
      console.error(`Usuário com e-mail "${emailNorm}" não encontrado na coleção 'users'.`);
      process.exitCode = 1;
      return;
    }

    if (modoLimpar) {
      const res = await ScanLog.deleteMany({ userId: user._id, seed: true });
      console.log(
        `Removidos ${res.deletedCount} registro(s) de demonstração (seed: true) do usuário ${emailNorm}.`
      );
      return;
    }

    // Remove seeds anteriores desse mesmo usuário para evitar duplicatas
    await ScanLog.deleteMany({ userId: user._id, seed: true });

    const itens = construirItensDemo(user._id);
    await ScanLog.insertMany(itens);

    console.log(
      `Sucesso! ${itens.length} registros de demonstração criados para ${user.nome} (${emailNorm}).`
    );
  } catch (err) {
    console.error('Erro no seed-demo:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

executarSeedDemo();

