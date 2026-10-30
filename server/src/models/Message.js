const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    // sent -> delivered -> read
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    deliveredAt: Date,
    readAt: Date,
  },
  { timestamps: true }
);

// Fast conversation lookups, newest first
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, status: 1 });

module.exports = mongoose.model('Message', messageSchema);
