/**
 * Configuration centralisée de l'URL de l'API.
 * - En développement local : pointe vers http://localhost:8000 (ou la variable VITE_API_URL).
 * - En production : chaîne vide "" pour utiliser le reverse-proxy Nginx sur la même origine
 *   (résout 100% des erreurs CORS et blocages Loopback du navigateur).
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== ''
    ? import.meta.env.VITE_API_URL.trim()
    : import.meta.env.DEV
    ? 'http://localhost:8000'
    : '';
