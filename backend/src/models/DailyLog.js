import mongoose from 'mongoose';

const { Schema } = mongoose;

const dailyLogSchema = new Schema({
  date: { type: String, required: true, unique: true }, // 'YYYY-MM-DD'
  questionsShown: { type: Number, default: 0 },
  questionsCorrect: { type: Number, default: 0 },
  deckBreakdown: { type: Schema.Types.Mixed, default: {} }, // { [deckSlug]: { shown, correct } }
}, {
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
    }
  }
});

const DailyLog = mongoose.model('DailyLog', dailyLogSchema);
export default DailyLog;
