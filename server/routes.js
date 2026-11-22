const r = require('express').Router();
const jwt = require('jsonwebtoken');
const { User, Request, Quotation, Project, Notification } = require('./models');

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));
const sign = u => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const isStaff = u => u.role !== 'Client';
const pub = u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone, company: u.company, address: u.address });
const auth = async (req, res, next) => {
  try {
    const { id } = jwt.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(id); if (!req.user) throw 0; next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden: your role cannot do this' });
const scope = u => isStaff(u) ? {} : { client: u._id };   // clients only ever see their own data
const notify = (to, message, from) => to && String(to) !== String(from) && Notification.create({ user: to, message });
const notifyStaff = async (message, from) => { for (const s of await User.find({ role: { $in: ['Admin', 'Staff'] } })) await notify(s._id, message, from); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const total = items => (items || []).reduce((s, i) => s + (+i.qty || 0) * (+i.price || 0), 0);
const L = s => s.replace('_', ' ');

// ---------- auth & profile ----------
r.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6) throw new Error('Name, email and password (min 6 chars) required');
  // NOTE: role selectable for demo only. In real life Admin would assign Staff/Admin roles.
  const u = await User.create({ name, email, password, role: ['Admin', 'Staff', 'Client'].includes(role) ? role : 'Client', company: req.body.company, phone: req.body.phone });
  res.json({ token: sign(u), user: pub(u) });
}));
r.post('/auth/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u || !(await u.check(req.body.password || ''))) throw new Error('Invalid email or password');
  res.json({ token: sign(u), user: pub(u) });
}));
r.get('/auth/me', auth, (req, res) => res.json(pub(req.user)));
r.patch('/auth/me', auth, wrap(async (req, res) => {
  ['name', 'phone', 'company', 'address'].forEach(k => { if (k in req.body) req.user[k] = req.body[k]; });
  await req.user.save(); res.json(pub(req.user));
}));

// ---------- client management (staff) ----------
r.get('/clients', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const f = { role: 'Client' };
  if (req.query.q) { const re = new RegExp(esc(req.query.q), 'i'); f.$or = [{ name: re }, { email: re }, { company: re }]; }
  res.json(await User.find(f).select('-password').sort('name'));
}));
r.post('/clients', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const { name, email, password, phone, company, address, notes } = req.body;
  if (!name || !email || !password) throw new Error('Name, email and password required');
  res.json(pub(await User.create({ name, email, password, phone, company, address, notes, role: 'Client' })));
}));
r.patch('/clients/:id', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'Client' }); if (!u) throw new Error('Client not found');
  ['name', 'phone', 'company', 'address', 'notes'].forEach(k => { if (k in req.body) u[k] = req.body[k]; });
  await u.save(); res.json(pub(u));
}));

// ---------- service requests ----------
r.get('/requests', auth, wrap(async (req, res) => {
  const f = scope(req.user), { q, status, priority } = req.query;
  if (q) f.$or = [{ title: new RegExp(esc(q), 'i') }, { description: new RegExp(esc(q), 'i') }];
  if (status) f.status = status; if (priority) f.priority = priority;
  res.json(await Request.find(f).populate('client', 'name company').sort('-createdAt'));
}));
r.post('/requests', auth, wrap(async (req, res) => {
  const client = isStaff(req.user) ? req.body.client : req.user._id;
  if (!client) throw new Error('Select a client');
  const x = await Request.create({ client, title: req.body.title, description: req.body.description, category: req.body.category, priority: req.body.priority });
  await notifyStaff(`New service request: "${x.title}" from ${isStaff(req.user) ? 'a client' : req.user.name}`, req.user._id);
  res.json(x);
}));
r.patch('/requests/:id', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const x = await Request.findById(req.params.id); if (!x) throw new Error('Not found');
  const old = x.status; ['status', 'priority'].forEach(k => { if (req.body[k]) x[k] = req.body[k]; }); await x.save();
  if (x.status !== old) await notify(x.client, `Your request "${x.title}" is now ${L(x.status)}`, req.user._id);
  res.json(x);
}));

// ---------- quotations ----------
r.get('/quotations', auth, wrap(async (req, res) => {
  const f = scope(req.user); if (req.query.status) f.status = req.query.status;
  res.json(await Quotation.find(f).populate('client', 'name company').populate('request', 'title').sort('-createdAt'));
}));
r.post('/quotations', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const rq = await Request.findById(req.body.request); if (!rq) throw new Error('Request not found');
  const b = req.body, status = b.status === 'sent' ? 'sent' : 'draft';
  const q = await Quotation.create({ request: rq._id, client: rq.client, items: b.items, notes: b.notes, validUntil: b.validUntil || undefined, total: total(b.items), status });
  if (status === 'sent') { rq.status = 'quoted'; await rq.save(); await notify(rq.client, `New quotation received for "${rq.title}"`, req.user._id); }
  res.json(q);
}));
r.patch('/quotations/:id', auth, wrap(async (req, res) => {
  const q = await Quotation.findById(req.params.id).populate('request', 'title'); if (!q) throw new Error('Not found');
  const b = req.body;
  if (isStaff(req.user)) {
    if (['accepted', 'rejected'].includes(q.status)) throw new Error('Quotation is already closed');
    const prev = q.status;
    if ('items' in b) q.items = b.items; if ('notes' in b) q.notes = b.notes; if ('validUntil' in b) q.validUntil = b.validUntil || null;
    if (['draft', 'sent'].includes(b.status)) q.status = b.status;
    q.total = total(q.items); await q.save();
    if (q.status === 'sent' && prev !== 'sent') { await Request.findByIdAndUpdate(q.request._id, { status: 'quoted' }); await notify(q.client, `New quotation received for "${q.request.title}"`, req.user._id); }
    return res.json(q);
  }
  if (!q.client.equals(req.user._id)) throw new Error('Not your quotation');
  if (q.status !== 'sent' || !['accepted', 'rejected'].includes(b.status)) throw new Error('This quotation cannot be changed');
  q.status = b.status; await q.save();
  if (b.status === 'accepted') {   // accepted quotation automatically becomes a project record
    await Project.create({ client: q.client, request: q.request._id, quotation: q._id, name: q.request.title });
    await Request.findByIdAndUpdate(q.request._id, { status: 'approved' });
  } else await Request.findByIdAndUpdate(q.request._id, { status: 'rejected' });
  await notifyStaff(`${req.user.name} ${b.status} the quotation for "${q.request.title}"`, req.user._id);
  res.json(q);
}));

// ---------- projects ----------
r.get('/projects', auth, wrap(async (req, res) => {
  const f = scope(req.user); if (req.query.status) f.status = req.query.status;
  if (req.query.q) f.name = new RegExp(esc(req.query.q), 'i');
  res.json(await Project.find(f).populate('client', 'name company').sort('-createdAt'));
}));
r.post('/projects', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const b = req.body; if (!b.client) throw new Error('Select a client');
  res.json(await Project.create({ client: b.client, name: b.name, status: b.status, dueDate: b.dueDate || undefined, notes: b.notes }));
}));
r.patch('/projects/:id', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const p = await Project.findById(req.params.id); if (!p) throw new Error('Not found'); const old = p.status;
  ['name', 'status', 'progress', 'notes'].forEach(k => { if (k in req.body) p[k] = req.body[k]; });
  if ('dueDate' in req.body) p.dueDate = req.body.dueDate || null;
  if (p.status === 'completed') p.progress = 100;
  await p.save();
  if (p.status !== old) await notify(p.client, `Project "${p.name}" status: ${L(p.status)}`, req.user._id);
  res.json(p);
}));

// ---------- notifications ----------
r.get('/notifications', auth, wrap(async (req, res) => res.json(await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30))));
r.post('/notifications/read', auth, wrap(async (req, res) => { await Notification.updateMany({ user: req.user._id }, { read: true }); res.json({ ok: true }); }));

// ---------- dashboard & reports ----------
r.get('/dashboard', auth, wrap(async (req, res) => {
  const f = scope(req.user);
  const [rq, qs, ps] = await Promise.all([Request.find(f), Quotation.find(f), Project.find(f)]);
  const by = (a, vals) => Object.fromEntries(vals.map(v => [v, a.filter(x => x.status === v).length]));
  const sum = s => qs.filter(x => x.status === s).reduce((t, x) => t + x.total, 0);
  res.json({
    clients: isStaff(req.user) ? await User.countDocuments({ role: 'Client' }) : null,
    requests: { total: rq.length, by: by(rq, ['new', 'in_review', 'quoted', 'approved', 'rejected']) },
    quotations: { total: qs.length, by: by(qs, ['draft', 'sent', 'accepted', 'rejected']), revenue: sum('accepted'), pipeline: sum('sent') },
    projects: { total: ps.length, by: by(ps, ['planned', 'in_progress', 'on_hold', 'completed']), avg: ps.length ? Math.round(ps.reduce((t, p) => t + p.progress, 0) / ps.length) : 0 },
    recent: await Request.find(f).populate('client', 'name').sort('-createdAt').limit(5)
  });
}));
r.get('/reports/:type', auth, allow('Admin', 'Staff'), wrap(async (req, res) => {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, d = x => x ? new Date(x).toISOString().slice(0, 10) : '', T = req.params.type;
  let head, rows;
  if (T === 'clients') { head = ['Name', 'Email', 'Company', 'Phone']; rows = (await User.find({ role: 'Client' })).map(c => [c.name, c.email, c.company, c.phone]); }
  else if (T === 'requests') { head = ['Title', 'Client', 'Category', 'Priority', 'Status', 'Created']; rows = (await Request.find().populate('client', 'name')).map(x => [x.title, x.client?.name, x.category, x.priority, x.status, d(x.createdAt)]); }
  else if (T === 'quotations') { head = ['Request', 'Client', 'Total', 'Status', 'Valid Until']; rows = (await Quotation.find().populate('client', 'name').populate('request', 'title')).map(x => [x.request?.title, x.client?.name, x.total, x.status, d(x.validUntil)]); }
  else if (T === 'projects') { head = ['Project', 'Client', 'Status', 'Progress %', 'Due']; rows = (await Project.find().populate('client', 'name')).map(p => [p.name, p.client?.name, p.status, p.progress, d(p.dueDate)]); }
  else throw new Error('Unknown report');
  res.type('text/csv').send([head, ...rows].map(row => row.map(q).join(',')).join('\n'));
}));

module.exports = r;
