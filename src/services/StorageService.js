/**
 * StorageService.js — Singleton de acceso a localStorage
 *
 * Principio S: Única responsabilidad — abstraer el acceso a localStorage.
 * Patrón Singleton: Una única instancia en toda la aplicación.
 */
export class StorageService {
  static #instance = null;

  constructor() {
    if (StorageService.#instance) {
      return StorageService.#instance;
    }
    StorageService.#instance = this;
  }

  static getInstance() {
    if (!StorageService.#instance) {
      StorageService.#instance = new StorageService();
    }
    return StorageService.#instance;
  }

  /**
   * Recupera un valor del storage.
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error(`[StorageService] Error reading "${key}":`, err);
      return null;
    }
  }

  /**
   * Persiste un valor en el storage.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`[StorageService] Error writing "${key}":`, err);
    }
  }

  /**
   * Elimina una clave del storage.
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(key);
  }
}
