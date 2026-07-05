export const STATE_UF_MAP: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF'
};

/**
 * Returns the UF acronym for a given state code (IBGE).
 * If it's already a string like 'SP', it returns it directly.
 * If not found, returns the original value.
 */
export function getStateUF(stateCode?: string | null): string {
  if (!stateCode) return '';
  const code = String(stateCode).trim();
  // If it's already a 2-letter UF, return it
  if (code.length === 2 && isNaN(Number(code))) {
    return code.toUpperCase();
  }
  return STATE_UF_MAP[code] || code;
}
