/**
 * SearchService.js — Estrategias de búsqueda intercambiables
 *
 * Patrón Strategy: Cada método de búsqueda es una estrategia independiente.
 * Principio O: Se pueden añadir nuevas estrategias sin modificar las existentes.
 */
export class SearchService {
  /**
   * Busca paquetes que coincidan con el query en múltiples campos.
   * @param {import('../models/Package.js').Package[]} packages
   * @param {string} query
   * @returns {import('../models/Package.js').Package[]}
   */
  searchPackages(packages, query) {
    if (!query?.trim()) return packages;
    const q = query.trim().toLowerCase();

    return packages.filter(pkg =>
      this.#matchesQuery(pkg, q)
    );
  }

  /**
   * Filtra paquetes por estado.
   * @param {import('../models/Package.js').Package[]} packages
   * @param {string} status  — 'all' | 'pending' | 'transit' | 'delivered'
   * @returns {import('../models/Package.js').Package[]}
   */
  filterByStatus(packages, status) {
    if (!status || status === 'all') return packages;
    return packages.filter(pkg => pkg.status === status);
  }

  /**
   * Busca clientes por nombre o teléfono (para autocomplete).
   * @param {import('../models/Package.js').Package[]} packages
   * @param {string} query
   * @returns {Array<{name:string, phone:string, address:string}>}
   */
  searchClients(packages, query) {
    if (!query?.trim() || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();

    // Deduplicar por teléfono
    const seen = new Set();
    const results = [];

    for (const pkg of packages) {
      const key = pkg.clientPhone;
      if (seen.has(key)) continue;

      const nameMatch  = pkg.clientName?.toLowerCase().includes(q);
      const phoneMatch = pkg.clientPhone?.includes(q);

      if (nameMatch || phoneMatch) {
        seen.add(key);
        results.push({
          name:    pkg.clientName,
          phone:   pkg.clientPhone,
          address: pkg.clientAddress,
        });
      }

      if (results.length >= 6) break; // máximo 6 sugerencias
    }

    return results;
  }

  // ── Privado ────────────────────────────────────────────────────────
  #matchesQuery(pkg, q) {
    return (
      pkg.id?.toLowerCase().includes(q)           ||
      pkg.clientName?.toLowerCase().includes(q)   ||
      pkg.clientPhone?.includes(q)                ||
      pkg.clientAddress?.toLowerCase().includes(q)||
      pkg.description?.toLowerCase().includes(q)
    );
  }
}
