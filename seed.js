require('dotenv').config();
const mongoose = require('mongoose');
const { User, Request, Quotation, Project, Notification } = require('./models');
const day = n => new Date(Date.now() + n * 864e5);
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User, Request, Quotation, Project, Notification].map(m => m.deleteMany({})));
  await User.create({ name: 'Alice Admin', email: 'admin@demo.com', password: '123456', role: 'Admin' });
  await User.create({ name: 'Sam Staff', email: 'staff@demo.com', password: '123456', role: 'Staff' });
  const c = [];
  for (const [name, email, company, phone] of [['Ravi Kumar', 'client@demo.com', 'Kumar Traders', '9876543210'], ['Priya Nair', 'priya@demo.com', 'Nair Designs', '9123456780'], ['John Smith', 'john@demo.com', 'Smith & Co', '9988776655']])
    c.push(await User.create({ name, email, company, phone, password: '123456', role: 'Client', address: 'Chennai, India' }));
  const R = (cl, title, category, priority, status) => ({ client: cl._id, title, category, priority, status, description: title + ' - client requirement details' });
  const reqs = await Request.insertMany([
    R(c[0], 'Company website development', 'Web', 'High', 'approved'), R(c[0], 'Inventory software', 'Software', 'Medium', 'quoted'),
    R(c[1], 'Brand logo redesign', 'Design', 'Medium', 'approved'), R(c[1], 'Social media campaign', 'Marketing', 'Low', 'new'),
    R(c[2], 'Mobile app MVP', 'Software', 'High', 'in_review'), R(c[2], 'IT support contract', 'Support', 'Medium', 'rejected')]);
  const Q = (i, items, status) => ({ request: reqs[i]._id, client: reqs[i].client, items, status, total: items.reduce((s, x) => s + x.qty * x.price, 0), validUntil: day(15) });
  const qs = await Quotation.insertMany([
    Q(0, [{ description: 'Design', qty: 1, price: 25000 }, { description: 'Development', qty: 1, price: 60000 }], 'accepted'),
    Q(1, [{ description: 'Software build', qty: 1, price: 90000 }], 'sent'),
    Q(2, [{ description: 'Logo concepts', qty: 3, price: 5000 }], 'accepted'),
    Q(5, [{ description: 'Annual support', qty: 12, price: 4000 }], 'rejected')]);
  await Project.insertMany([
    { client: c[0]._id, request: reqs[0]._id, quotation: qs[0]._id, name: 'Company website development', status: 'in_progress', progress: 60, dueDate: day(20) },
    { client: c[1]._id, request: reqs[2]._id, quotation: qs[2]._id, name: 'Brand logo redesign', status: 'completed', progress: 100, dueDate: day(-3) },
    { client: c[2]._id, name: 'Office network setup', status: 'planned', progress: 0, dueDate: day(30) },
    { client: c[0]._id, name: 'Annual maintenance', status: 'on_hold', progress: 25, dueDate: day(45) }]);
  console.log('Seeded! Password 123456 for: admin@demo.com, staff@demo.com, client@demo.com');
  process.exit();
})();
