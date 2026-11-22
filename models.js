const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const { Schema, model } = mongoose, ref = n => ({ type: Schema.Types.ObjectId, ref: n });
const userSchema = new Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }, role: { type: String, enum: ['Admin', 'Staff', 'Client'], default: 'Client' },
  phone: String, company: String, address: String, notes: String
}, { timestamps: true });
userSchema.pre('save', async function () { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10); });
userSchema.methods.check = function (p) { return bcrypt.compare(p, this.password); };
module.exports = {
  User: model('User', userSchema),
  Request: model('Request', new Schema({
    client: ref('User'), title: { type: String, required: true }, description: String, category: String,
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['new', 'in_review', 'quoted', 'approved', 'rejected'], default: 'new' }
  }, { timestamps: true })),
  Quotation: model('Quotation', new Schema({
    request: ref('Request'), client: ref('User'), items: [{ description: String, qty: Number, price: Number }],
    total: { type: Number, default: 0 }, notes: String, validUntil: Date,
    status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' }
  }, { timestamps: true })),
  Project: model('Project', new Schema({
    client: ref('User'), request: ref('Request'), quotation: ref('Quotation'), name: { type: String, required: true },
    status: { type: String, enum: ['planned', 'in_progress', 'on_hold', 'completed'], default: 'planned' },
    progress: { type: Number, default: 0 }, dueDate: Date, notes: String
  }, { timestamps: true })),
  Notification: model('Notification', new Schema({ user: ref('User'), message: String, read: { type: Boolean, default: false } }, { timestamps: true }))
};
