export const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };

  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };

  const normalized = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];

    if (character === '"') {
      if (quoted && normalized[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === ',') {
      pushField();
      continue;
    }

    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && normalized[index + 1] === '\n') index += 1;
      pushRow();
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
};
