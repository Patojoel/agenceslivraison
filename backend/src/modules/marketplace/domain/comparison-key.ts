/**
 * What makes two texts "the same" for the directory: case, accents and spacing are ignored. It is the rule `agencies` applies to
 * the names of its zones and sites (a module does not import another one's domain, so the rule is restated here and the
 * end-to-end test of the filters keeps both in step).
 */
export function singleLineOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function comparisonKeyOf(singleLineText: string): string {
  return singleLineText.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Never part of a text of an agency (control characters are refused), so a city and a district cannot run into each other. */
const AREA_SEPARATOR = '\u001f';

/** The key of a served area in `district_keys`: a district, or the empty district for a zone that covers the whole city. */
export function areaKeyOf(cityKey: string, districtKey: string): string {
  return `${cityKey}${AREA_SEPARATOR}${districtKey}`;
}
