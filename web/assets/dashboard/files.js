export function selectFiles(files, now, query, order) {
  const active = files.filter(
    (file) => new Date(file.expires_at).getTime() > now,
  );
  const visible = active.filter((file) =>
    file.filename.toLocaleLowerCase().includes(query),
  );
  const sorting = {
    newest: (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at),
    expiry: (a, b) => new Date(a.expires_at) - new Date(b.expires_at),
    size: (a, b) => b.size - a.size,
    name: (a, b) => a.filename.localeCompare(b.filename),
  };
  return visible.sort(sorting[order]);
}
