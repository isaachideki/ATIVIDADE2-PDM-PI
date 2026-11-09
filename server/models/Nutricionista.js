import mongoose from 'mongoose';

const nutricionistaSchema = new mongoose.Schema(
  {
    nome: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    senha: { type: String, select: false },
    crn: { type: String, trim: true, required: true },
    tratamento: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    strict: true,
    collection: 'nutricionistas',
  }
);

const Nutricionista =
  mongoose.models.Nutricionista ||
  mongoose.model('Nutricionista', nutricionistaSchema);
export default Nutricionista;
