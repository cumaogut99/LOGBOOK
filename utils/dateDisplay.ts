import { format, parse, parseISO, isValid } from 'date-fns';

const PARSE_REF = new Date(2020, 0, 1);

/**
 * Veritabanından gelen esnek tarih string'lerini (ISO, dd.MM.yyyy, vb.) güvenli şekilde Date'e çevirir.
 * Ortam/tarayıcıdan bağımsız çalışır; geçersiz girdide null döner.
 */
export function parseFlexibleDate(input: string | number | Date | null | undefined): Date | null {
  if (input == null || input === '') return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'number' && Number.isFinite(input)) {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }

  const s = String(input).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = parseISO(s);
    if (isValid(d)) return d;
  }

  const turkishPatterns = [
    'dd.MM.yyyy HH:mm:ss',
    'dd.MM.yyyy HH:mm',
    'dd.MM.yyyy',
    'd.M.yyyy HH:mm:ss',
    'd.M.yyyy HH:mm',
    'd.M.yyyy',
  ];

  for (const pattern of turkishPatterns) {
    const d = parse(s, pattern, PARSE_REF);
    if (isValid(d)) return d;
  }

  const fallback = new Date(s);
  return isValid(fallback) ? fallback : null;
}

/**
 * Saklanan tarihi ekranda gösterir. Geçersiz veya parse edilemeyen değerde `fallback` döner (date-fns RangeError önlenir).
 */
export function formatStoredDate(
  input: string | number | Date | null | undefined,
  fmt: string,
  fallback = '—'
): string {
  const d = parseFlexibleDate(input);
  if (!d) return fallback;
  try {
    return format(d, fmt);
  } catch {
    return fallback;
  }
}
