import mongoose from 'mongoose';

export const CATEGORIAS = ['gluten', 'lactose', 'amendoim'];
export const CATEGORIAS_VALIDAS = CATEGORIAS;
export const NIVEIS = [0, 1, 2]; export const NIVEL_PADRAO = 1;

const nivelField = {
  type: Number,
  enum: NIVEIS,
  default: NIVEL_PADRAO,
};

const userSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    // select:false -> a senha nunca sai em consultas, a não ser com .select('+senha')
    senha: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['PACIENTE', 'NUTRICIONISTA'],
      default: 'PACIENTE',
      required: true,
    },
    // Campos de vínculo do PACIENTE com um NUTRICIONISTA
    nutricionistaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Nutricionista',
      default: null,
      index: true,
    },
    vinculadoEm: {
      type: Date,
      default: null,
    },
    consentimentoVinculoEm: {
      type: Date,
      default: null,
    },
    restricoes: {
      type: [{ type: String, enum: CATEGORIAS }],
      default: [],
    },
    // 0 = Leve (ignora avisos "pode conter" DAQUELE alérgeno), 1 = Moderado, 2 = Grave
    niveisSensibilidade: {
      gluten: nivelField,
      lactose: nivelField,
      amendoim: nivelField,
    },
    restricoesAtualizadasEm: {
      type: Date,
      default: null,
    },
    restricoesAtualizadasPor: {
      type: String,
      enum: ['PACIENTE', 'NUTRICIONISTA', null],
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: 'users',
  }
);

/** Formato público do usuário (nunca inclui senha). */
userSchema.methods.toPublic = function toPublic() {
  const niveis = this.niveisSensibilidade || {};
  const pub = {
    id: String(this._id),
    nome: this.nome,
    email: this.email,
    avatar: this.avatar || null,
    role: this.role || 'PACIENTE',
    restricoes: this.restricoes || [],
    niveisSensibilidade: {
      gluten: niveis.gluten ?? NIVEL_PADRAO,
      lactose: niveis.lactose ?? NIVEL_PADRAO,
      amendoim: niveis.amendoim ?? NIVEL_PADRAO,
    },
    nutricionistaId: this.nutricionistaId ? String(this.nutricionistaId) : null,
    vinculadoEm: this.vinculadoEm || null,
    consentimentoVinculoEm: this.consentimentoVinculoEm || null,
    restricoesAtualizadasEm: this.restricoesAtualizadasEm || null,
    restricoesAtualizadasPor: this.restricoesAtualizadasPor || null,
  };

  return pub;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
