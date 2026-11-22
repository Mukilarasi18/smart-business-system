export const api = async (url, opt = {}) => {
  const t = localStorage.getItem('token');
  const res = await fetch('/api' + url, {
    ...opt, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) },
    body: opt.body ? JSON.stringify(opt.body) : undefined
  });
  if (opt.raw && res.ok) return res.blob();
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Something went wrong');
  return d;
};
