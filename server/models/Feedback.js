import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mensagem: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: 'feedbacks',
  }
);

const Feedback =
  mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);

export default Feedback;
