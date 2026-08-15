import mongoose from 'mongoose';

const { Schema } = mongoose;

const statsSchema = new Schema({
  weight: { type: Number, default: 1, min: 1, max: 20 },
  timesShown: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  timesWrong: { type: Number, default: 0 },
  consecutiveCorrect: { type: Number, default: 0 },
  consecutiveWrong: { type: Number, default: 0 },
  isLeech: { type: Boolean, default: false },
  knewItCount: { type: Number, default: 0 },
  guessedCount: { type: Number, default: 0 },
  lastShownAt: { type: Date, default: null },
}, { _id: false });

const questionSchema = new Schema({
  deckId: { type: Schema.Types.ObjectId, ref: 'Deck', required: true, index: true },
  contentHash: { type: String, required: true },
  question: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: v => Array.isArray(v) && v.length >= 2,
      message: 'options must have at least 2 entries'
    }
  },
  answer: { type: Number, required: true }, // index into options
  description: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  tags: { type: [String], default: [] },
  stats: { type: statsSchema, default: () => ({}) },
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
    }
  }
});

questionSchema.index({ deckId: 1, contentHash: 1 }, { unique: true });
questionSchema.index({ deckId: 1, 'stats.weight': -1 });
questionSchema.index({ deckId: 1, tags: 1 });
questionSchema.index({ 'stats.isLeech': 1 });

const Question = mongoose.model('Question', questionSchema);
export default Question;
