/**
 * ValidationService.js — Validación de datos de paquetes
 *
 * Principio S: Única responsabilidad — validar datos de entrada.
 * Principio I: Solo expone lo que los forms necesitan.
 */
export class ValidationService {
  /**
   * Valida un objeto con los datos del formulario.
   * @param {Object} data
   * @returns {{ valid: boolean, errors: Object.<string, string> }}
   */
  validatePackage(data) {
    const errors = {};

    if (!data.clientName?.trim()) {
      errors.clientName = 'El nombre del cliente es obligatorio.';
    } else if (data.clientName.trim().length < 2) {
      errors.clientName = 'El nombre debe tener al menos 2 caracteres.';
    }

    if (!data.clientPhone?.trim()) {
      errors.clientPhone = 'El teléfono es obligatorio.';
    } else if (!/^[\d\s\+\-\(\)]{7,15}$/.test(data.clientPhone.trim())) {
      errors.clientPhone = 'Introduce un número de teléfono válido.';
    }

    if (!data.clientAddress?.trim()) {
      errors.clientAddress = 'La dirección es obligatoria.';
    } else if (data.clientAddress.trim().length < 5) {
      errors.clientAddress = 'La dirección debe ser más descriptiva.';
    }

    if (!data.description?.trim()) {
      errors.description = 'La descripción del paquete es obligatoria.';
    }

    if (data.weight && isNaN(parseFloat(data.weight))) {
      errors.weight = 'El peso debe ser un número.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
