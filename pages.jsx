import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from './api';

const COLOR = { new: '#2563eb', in_review: '#f59e0b', quoted: '#7c3aed', approved: '#10b981', rejected: '#dc2626', draft: '#6b7280', sent: '#2563eb', accepted: '#10b981', planned: '#6b7280', in_progress: '#2563eb', on_hold: '#f59e0b', completed: '#10b981' };
const L = s => (s || '').replace('_', ' ');
const Badge = ({ s }) => <span className="tag" style={{ background: COLOR[s] || '#6b7280' }}>{L(s)}</span>;
const money = n => '₹' + (n || 0).toLocaleString('en-IN');
const dt = d => d ? String(d).slice(0, 10) : '';
const isStaff = u => u.role !== 'Client';
const Err = ({ e }) => e ? <div className="err">{e}</div> : null;
const REQ_ST = ['new', 'in_review', 'quoted', 'approved', 'rejected'], QUO_ST = ['draft', 'sent', 'accepted', 'rejected'], PRO_ST = ['planned', 'in_progress', 'on_hold', 'completed'];

function useList(path, f) {
  const [d, setD] = useState([]), [err, setErr] = useState('');
  const key = JSON.stringify(f);
  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
    api(path + '?' + qs).then(setD).catch(e => setErr(e.message));
  }, [path, key]);
  useEffect(() => { load(); }, [load]);
  return [d, load, err];
}
const Modal = ({ title, onClose, children }) => (
  <div className="overlay" onClick={onClose}><div className="modal card" onClick={e => e.stopPropagation()}>
    <div className="between"><h3>{title}</h3><a className="link" onClick={onClose}>✕ Close</a></div>{children}</div></div>);
const download = async type => { const b = await api('/reports/' + type, { raw: true }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = type + '-report.csv'; a.click(); };
const Sel = ({ value, onChange, opts, all, disabled }) => (
  <select value={value} onChange={onChange} disabled={disabled}>{all && <option value="">{all}</option>}{opts.map(o => <option key={o} value={o}>{L(o)}</option>)}</select>);

// ---------------- Dashboard ----------------
export function Dashboard({ user }) {
  const [d, setD] = useState(null);
  useEffect(() => { api('/dashboard').then(setD); }, []);
  if (!d) return null;
  const data = o => Object.entries(o).map(([name, value]) => ({ name: L(name), value }));
  const stats = [...(d.clients != null ? [['Clients', d.clients]] : []), ['Requests', d.requests.total], ['Quotations', d.quotations.total], ['Projects', d.projects.total],
    ['Revenue (accepted)', money(d.quotations.revenue)], ['Pipeline (sent)', money(d.quotations.pipeline)]];
  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      <div className="stats">{stats.map(([k, v]) => <div className="card stat" key={k}><small>{k}</small><b>{v}</b></div>)}</div>
      <div className="card"><b>Average project progress: {d.projects.avg}%</b><div className="bar"><div style={{ width: d.projects.avg + '%' }} /></div></div>
      <div className="grid3">{[['Requests by status', d.requests.by], ['Quotations by status', d.quotations.by], ['Projects by status', d.projects.by]].map(([t, o]) => (
        <div className="card" key={t}><h4>{t}</h4><ResponsiveContainer width="100%" height={200}><BarChart data={data(o)}><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>))}</div>
      <div className="card"><h4>Recent requests</h4><table><thead><tr><th>Title</th><th>Client</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>{d.recent.map(x => <tr key={x._id}><td>{x.title}</td><td>{x.client?.name}</td><td>{x.priority}</td><td><Badge s={x.status} /></td></tr>)}</tbody></table></div>
      {isStaff(user) && <div className="card"><h4>Download reports (CSV)</h4><div className="row wrap">{['clients', 'requests', 'quotations', 'projects'].map(t => <button key={t} className="btn ghost" onClick={() => download(t)}>⬇ {t}</button>)}</div></div>}
    </div>
  );
}

// ---------------- Clients (staff) ----------------
export function Clients() {
  const [q, setQ] = useState(''), [list, load, err] = useList('/clients', { q }), [m, setM] = useState(null), [e, setE] = useState('');
  const f = k => ev => setM({ ...m, [k]: ev.target.value });
  const save = async () => { try { setE(''); m._id ? await api('/clients/' + m._id, { method: 'PATCH', body: m }) : await api('/clients', { method: 'POST', body: m }); setM(null); load(); } catch (x) { setE(x.message); } };
  return (
    <div>
      <div className="between"><h2>Clients</h2><button className="btn" onClick={() => setM({ name: '', email: '', password: '', phone: '', company: '', address: '', notes: '' })}>+ Add client</button></div>
      <Err e={err} />
      <div className="card"><input placeholder="🔍 Search by name, email or company" value={q} onChange={e => setQ(e.target.value)} />
        <table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th></tr></thead>
          <tbody>{list.map(c => <tr key={c._id} className="click" onClick={() => setM(c)}><td>{c.name}</td><td>{c.company}</td><td>{c.email}</td><td>{c.phone}</td></tr>)}</tbody></table></div>
      {m && <Modal title={m._id ? 'Client profile' : 'New client'} onClose={() => setM(null)}>
        <input placeholder="Name" value={m.name || ''} onChange={f('name')} />
        {!m._id && <><input placeholder="Email" value={m.email} onChange={f('email')} /><input placeholder="Temporary password" value={m.password} onChange={f('password')} /></>}
        {m._id && <small className="muted">{m.email}</small>}
        <input placeholder="Company" value={m.company || ''} onChange={f('company')} /><input placeholder="Phone" value={m.phone || ''} onChange={f('phone')} />
        <input placeholder="Address" value={m.address || ''} onChange={f('address')} /><textarea placeholder="Internal notes" value={m.notes || ''} onChange={f('notes')} />
        <Err e={e} /><button className="btn" onClick={save}>Save</button></Modal>}
    </div>
  );
}

// ---------------- Quotation form (staff) ----------------
function QuoteForm({ q, onClose, onSaved }) {
  const isNew = !q._id;
  const [items, setItems] = useState(q.items?.length ? q.items : [{ description: '', qty: 1, price: 0 }]), [notes, setNotes] = useState(q.notes || ''), [valid, setValid] = useState(dt(q.validUntil)), [e, setE] = useState('');
  const total = items.reduce((s, i) => s + (+i.qty || 0) * (+i.price || 0), 0);
  const setI = (n, k, v) => setItems(items.map((it, i) => i === n ? { ...it, [k]: v } : it));
  const save = async status => {
    try { const body = { items, notes, validUntil: valid, status };
      isNew ? await api('/quotations', { method: 'POST', body: { ...body, request: q.request._id } }) : await api('/quotations/' + q._id, { method: 'PATCH', body });
      onSaved(); onClose(); } catch (x) { setE(x.message); }
  };
  return (
    <Modal title={'Quotation: ' + q.request.title} onClose={onClose}>
      {items.map((it, i) => <div className="row" key={i}>
        <input placeholder="Item description" value={it.description} onChange={e => setI(i, 'description', e.target.value)} style={{ flex: 3 }} />
        <input type="number" placeholder="Qty" value={it.qty} onChange={e => setI(i, 'qty', e.target.value)} style={{ flex: 1 }} />
        <input type="number" placeholder="Price" value={it.price} onChange={e => setI(i, 'price', e.target.value)} style={{ flex: 1 }} />
        <a className="link" onClick={() => setItems(items.filter((_, n) => n !== i))}>✕</a></div>)}
      <button className="btn ghost" onClick={() => setItems([...items, { description: '', qty: 1, price: 0 }])}>+ Add item</button>
      <h3>Total: {money(total)}</h3>
      <label>Valid until<input type="date" value={valid} onChange={e => setValid(e.target.value)} /></label>
      <textarea placeholder="Notes / terms" value={notes} onChange={e => setNotes(e.target.value)} />
      <Err e={e} /><div className="row"><button className="btn ghost" onClick={() => save('draft')}>Save draft</button><button className="btn" onClick={() => save('sent')}>Send to client</button></div>
    </Modal>
  );
}

// ---------------- Requests ----------------
export function Requests({ user }) {
  const staff = isStaff(user), [f, setF] = useState({ q: '', status: '', priority: '' });
  const [list, load, err] = useList('/requests', f), [m, setM] = useState(null), [quote, setQuote] = useState(null), [clients, setClients] = useState([]), [e, setE] = useState('');
  useEffect(() => { staff && api('/clients').then(setClients); }, []);
  const set = k => ev => setF({ ...f, [k]: ev.target.value }), mf = k => ev => setM({ ...m, [k]: ev.target.value });
  const save = async () => { try { setE(''); m._id ? await api('/requests/' + m._id, { method: 'PATCH', body: m }) : await api('/requests', { method: 'POST', body: m }); setM(null); load(); } catch (x) { setE(x.message); } };
  return (
    <div>
      <div className="between"><h2>Service requests</h2><button className="btn" onClick={() => setM({ title: '', description: '', category: 'Web', priority: 'Medium', client: '' })}>+ New request</button></div>
      <Err e={err} />
      <div className="card"><div className="row wrap"><input placeholder="🔍 Search requests" value={f.q} onChange={set('q')} />
        <Sel value={f.status} onChange={set('status')} opts={REQ_ST} all="All statuses" /><Sel value={f.priority} onChange={set('priority')} opts={['Low', 'Medium', 'High']} all="All priorities" /></div>
        <table><thead><tr><th>Title</th>{staff && <th>Client</th>}<th>Category</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>{list.map(x => <tr key={x._id} className="click" onClick={() => setM(x)}><td>{x.title}</td>{staff && <td>{x.client?.name}</td>}<td>{x.category}</td><td>{x.priority}</td><td><Badge s={x.status} /></td><td>{dt(x.createdAt)}</td></tr>)}</tbody></table>
        {!list.length && <p className="muted">No requests found.</p>}</div>
      {m && <Modal title={m._id ? 'Request details' : 'New service request'} onClose={() => setM(null)}>
        <input placeholder="Title" value={m.title} onChange={mf('title')} disabled={!!m._id} />
        <textarea placeholder="Describe what you need" value={m.description || ''} onChange={mf('description')} disabled={!!m._id} />
        {!m._id && <div className="row wrap"><Sel value={m.category} onChange={mf('category')} opts={['Web', 'Software', 'Design', 'Marketing', 'Support', 'Other']} /><Sel value={m.priority} onChange={mf('priority')} opts={['Low', 'Medium', 'High']} />
          {staff && <select value={m.client} onChange={mf('client')}><option value="">Select client</option>{clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}</div>}
        {m._id && <p>Client: <b>{m.client?.name}</b> · Category: {m.category} · Status: <Badge s={m.status} /></p>}
        {m._id && staff && <div className="row wrap"><Sel value={m.status} onChange={mf('status')} opts={REQ_ST} /><Sel value={m.priority} onChange={mf('priority')} opts={['Low', 'Medium', 'High']} /></div>}
        <Err e={e} />
        <div className="row">{(!m._id || staff) && <button className="btn" onClick={save}>{m._id ? 'Update' : 'Submit request'}</button>}
          {m._id && staff && ['new', 'in_review'].includes(m.status) && <button className="btn ghost" onClick={() => { setQuote({ request: m }); setM(null); }}>Create quotation</button>}</div>
      </Modal>}
      {quote && <QuoteForm q={quote} onClose={() => setQuote(null)} onSaved={load} />}
    </div>
  );
}

// ---------------- Quotations ----------------
export function Quotations({ user }) {
  const staff = isStaff(user), [status, setStatus] = useState(''), [list, load, err] = useList('/quotations', { status }), [m, setM] = useState(null), [edit, setEdit] = useState(null), [e, setE] = useState('');
  const respond = async s => { try { await api('/quotations/' + m._id, { method: 'PATCH', body: { status: s } }); setM(null); load(); } catch (x) { setE(x.message); } };
  return (
    <div>
      <h2>Quotations</h2><Err e={err} />
      <div className="card"><div className="row"><Sel value={status} onChange={e => setStatus(e.target.value)} opts={QUO_ST} all="All statuses" /></div>
        <table><thead><tr><th>Request</th>{staff && <th>Client</th>}<th>Total</th><th>Valid until</th><th>Status</th></tr></thead>
          <tbody>{list.map(x => <tr key={x._id} className="click" onClick={() => { setE(''); setM(x); }}><td>{x.request?.title}</td>{staff && <td>{x.client?.name}</td>}<td>{money(x.total)}</td><td>{dt(x.validUntil)}</td><td><Badge s={x.status} /></td></tr>)}</tbody></table>
        {!list.length && <p className="muted">{staff ? 'Create quotations from the Requests page.' : 'No quotations yet.'}</p>}</div>
      {m && <Modal title={'Quotation: ' + m.request?.title} onClose={() => setM(null)}>
        <p>Status: <Badge s={m.status} /></p>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>{m.items.map((i, n) => <tr key={n}><td>{i.description}</td><td>{i.qty}</td><td>{money(i.price)}</td></tr>)}</tbody></table>
        <h3>Total: {money(m.total)}</h3>{m.notes && <p className="muted">{m.notes}</p>}<Err e={e} />
        <div className="row">{!staff && m.status === 'sent' && <><button className="btn" onClick={() => respond('accepted')}>Accept</button><button className="btn ghost" onClick={() => respond('rejected')}>Reject</button></>}
          {staff && ['draft', 'sent'].includes(m.status) && <button className="btn" onClick={() => { setEdit(m); setM(null); }}>Edit quotation</button>}</div>
      </Modal>}
      {edit && <QuoteForm q={edit} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}

// ---------------- Projects ----------------
export function Projects({ user }) {
  const staff = isStaff(user), [f, setF] = useState({ q: '', status: '' }), [list, load, err] = useList('/projects', f), [m, setM] = useState(null), [clients, setClients] = useState([]), [e, setE] = useState('');
  useEffect(() => { staff && api('/clients').then(setClients); }, []);
  const mf = k => ev => setM({ ...m, [k]: ev.target.value });
  const save = async () => { try { setE(''); m._id ? await api('/projects/' + m._id, { method: 'PATCH', body: { ...m, client: undefined } }) : await api('/projects', { method: 'POST', body: m }); setM(null); load(); } catch (x) { setE(x.message); } };
  return (
    <div>
      <div className="between"><h2>Projects</h2>{staff && <button className="btn" onClick={() => setM({ name: '', client: '', status: 'planned', dueDate: '', notes: '', progress: 0 })}>+ New project</button>}</div>
      <Err e={err} />
      <div className="card"><div className="row wrap"><input placeholder="🔍 Search projects" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /><Sel value={f.status} onChange={e => setF({ ...f, status: e.target.value })} opts={PRO_ST} all="All statuses" /></div>
        <table><thead><tr><th>Project</th>{staff && <th>Client</th>}<th>Status</th><th>Progress</th><th>Due</th></tr></thead>
          <tbody>{list.map(p => <tr key={p._id} className="click" onClick={() => staff ? setM({ ...p, dueDate: dt(p.dueDate) }) : null}><td>{p.name}</td>{staff && <td>{p.client?.name}</td>}<td><Badge s={p.status} /></td>
            <td><div className="bar small"><div style={{ width: p.progress + '%' }} /></div> {p.progress}%</td><td>{dt(p.dueDate)}</td></tr>)}</tbody></table>
        {!list.length && <p className="muted">No projects yet.</p>}</div>
      {m && <Modal title={m._id ? 'Update project' : 'New project'} onClose={() => setM(null)}>
        <input placeholder="Project name" value={m.name} onChange={mf('name')} />
        {!m._id && <select value={m.client} onChange={mf('client')}><option value="">Select client</option>{clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}
        <div className="row wrap"><Sel value={m.status} onChange={mf('status')} opts={PRO_ST} /><label>Due date<input type="date" value={m.dueDate} onChange={mf('dueDate')} /></label></div>
        {m._id && <label>Progress: {m.progress}%<input type="range" min="0" max="100" value={m.progress} onChange={e => setM({ ...m, progress: +e.target.value })} /></label>}
        <textarea placeholder="Notes" value={m.notes || ''} onChange={mf('notes')} /><Err e={e} /><button className="btn" onClick={save}>Save</button></Modal>}
    </div>
  );
}

// ---------------- Profile ----------------
export function Profile({ user, onUpdate }) {
  const [p, setP] = useState(user), [msg, setMsg] = useState('');
  const f = k => e => setP({ ...p, [k]: e.target.value });
  const save = async () => { try { onUpdate(await api('/auth/me', { method: 'PATCH', body: p })); setMsg('Saved ✔'); } catch (x) { setMsg(x.message); } };
  return (
    <div className="card" style={{ maxWidth: 480 }}><h2>My profile</h2><p className="muted">{user.email} · {user.role}</p>
      <input placeholder="Name" value={p.name || ''} onChange={f('name')} /><input placeholder="Company" value={p.company || ''} onChange={f('company')} />
      <input placeholder="Phone" value={p.phone || ''} onChange={f('phone')} /><input placeholder="Address" value={p.address || ''} onChange={f('address')} />
      <button className="btn" onClick={save}>Save profile</button> {msg && <small>{msg}</small>}</div>
  );
}
