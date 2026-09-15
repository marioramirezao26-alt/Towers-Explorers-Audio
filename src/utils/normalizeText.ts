/** Minúsculas y sin acentos, para comparar texto hablado/escrito sin importar tildes. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
