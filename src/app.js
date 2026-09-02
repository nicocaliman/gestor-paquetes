// Carga Resiliente de Servicios (Soporta protocolos http:// y file:// sin bloqueos de CORS)
let geminiService = { hasApiKey: () => false, getApiKey: () => '', setApiKey: () => {}, processFormImage: async () => null };
let emailService = { getDefaultEmail: () => '', saveDefaultEmail: () => {}, getApiKey: () => '', saveApiKey: () => {}, hasApiKey: () => false, sendLiquidationReport: async () => {} };
let weatherService = { getCities: () => [], addCityByName: async () => {}, removeCity: () => {}, getRouteWeather: async () => [], getApiKey: () => '', saveApiKey: () => {} };

(async () => {
  try {
    const mod = await import('./services/GeminiService.js');
    if (mod?.geminiService) geminiService = mod.geminiService;
  } catch (e) { console.warn('[CORS file:// fallback]: GeminiService', e); }

  try {
    const mod = await import('./services/EmailService.js');
    if (mod?.emailService) emailService = mod.emailService;
  } catch (e) { console.warn('[CORS file:// fallback]: EmailService', e); }

  try {
    const mod = await import('./services/WeatherService.js');
    if (mod?.weatherService) weatherService = mod.weatherService;
  } catch (e) { console.warn('[CORS file:// fallback]: WeatherService', e); }
})();

'use strict';

    // ── GLOBAL NAVIGATION FUNCTION (DISPONIBLE EN WINDOW DESDE EL PRIMER INSTANTE) ──
    window.navigateTo = function navigateTo(view) {
      document.body.classList.remove('mobile-albaran-view');
      const splash = document.getElementById('mobile-qr-splash');
      if (splash) splash.style.display = 'none';

      const dashboard = document.getElementById('view-dashboard');
      if (dashboard) {
        dashboard.style.position = '';
        dashboard.style.top = '';
        dashboard.style.left = '';
        dashboard.style.width = '';
        dashboard.style.background = '';
        dashboard.style.color = '';
      }

      document.querySelectorAll('.view').forEach(v => {
        const vView = v.dataset.view || (v.id ? v.id.replace('view-', '') : '');
        const isMatch = (vView === view);
        if (isMatch) {
          v.classList.remove('hidden');
          v.style.display = 'block';
        } else {
          v.classList.add('hidden');
          v.style.display = 'none';
        }
      });

      document.querySelectorAll('.nav-item').forEach(n => {
        const isMatch = (n.dataset.view === view);
        n.classList.toggle('active', isMatch);
        n.setAttribute('aria-current', isMatch ? 'page' : 'false');
      });

      try {
        if (view === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
        if (view === 'form' && typeof prepareCreate === 'function') prepareCreate();
        if (view === 'rates' && typeof renderRatesList === 'function') renderRatesList();
        if (view === 'stats' && typeof renderStats === 'function') renderStats();
        if (view === 'clients' && typeof renderClientsView === 'function') renderClientsView();
        if (view === 'history' && typeof renderHistoryView === 'function') renderHistoryView();
      } catch (err) {
        console.warn('[Navigation Render Warning]:', view, err);
      }

      if (typeof window.renderRatesList === 'function' && view === 'rates') window.renderRatesList();
      if (typeof window.closeMobileSidebar === 'function') window.closeMobileSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.lucide) window.lucide.createIcons();
    };

    // ── FUNCIONES GLOBALES DE BOTONES DEL DASHBOARD DE ACCESO DIRECTO ──
    function getActivePackagesOrDOM() {
      try {
        let pkgs = [];
        try {
          if (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.getPackages === 'function') {
            pkgs = StorageService.getPackages();
          }
        } catch (e) {
          console.warn('[getActivePackagesOrDOM StorageService warning]:', e);
        }

        if (!pkgs || pkgs.length === 0) {
          const rows = document.querySelectorAll('#liquid-table-body tr');
          if (rows && rows.length > 0) {
            pkgs = Array.from(rows).map((tr, i) => {
              const tds = tr.querySelectorAll('td');
              if (!tds || tds.length < 4) return null;
              const w = parseFloat(tds[3]?.textContent?.trim()) || 0;
              return {
                id: 'p_dom_' + i,
                destinatario: tds[0]?.textContent?.trim() || '',
                localidadDestinatario: tds[1]?.textContent?.trim() || '',
                bultos: parseInt(tds[2]?.textContent?.trim()) || 1,
                weight: w,
                expedidor: tds[4]?.textContent?.trim() || '',
                localidadExpedidor: tds[5]?.textContent?.trim() || '',
                price: (w > 5 ? w * 2.0 : 10.0)
              };
            }).filter(Boolean);

            try {
              if (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.savePackages === 'function') {
                StorageService.savePackages(pkgs);
              }
            } catch (e) {}
          }
        }
        return pkgs || [];
      } catch (err) {
        console.error('[getActivePackagesOrDOM Error]:', err);
        return [];
      }
    }

    // Genera un .xlsx real (ExcelJS) con la identidad "Cupón de Ruta": cabecera navy,
    // acento mauve en la tabla, cifras en negrita alineadas a la derecha y fila de totales.
    // Si ExcelJS no llegó a cargar (CDN caído / sin conexión), cae de vuelta al CSV plano.
    window.exportExcel = async function exportExcel() {
      const pkgs = getActivePackagesOrDOM();
      if (!pkgs || pkgs.length === 0) {
        alert('No hay envíos registrados para exportar a Excel.');
        return;
      }

      const rows = pkgs.map(p => {
        const w = parseFloat(p.weight) || 0;
        const price = (p.price !== undefined && p.price !== null && !isNaN(parseFloat(p.price)) && parseFloat(p.price) > 0)
          ? parseFloat(p.price)
          : (w > 5 ? w * 2.0 : 10.0);
        return {
          destinatario: p.destinatario || '-',
          localidadDestinatario: p.localidadDestinatario || '-',
          bultos: parseInt(p.bultos) || 1,
          weight: w,
          expedidor: p.expedidor || '-',
          localidadExpedidor: p.localidadExpedidor || '-',
          price
        };
      });

      const d = new Date();
      const dateId = `LIQ-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const filenameBase = `Liquidacion_${dateId}`;

      if (typeof ExcelJS === 'undefined') {
        console.warn('[Export Excel] ExcelJS no disponible, usando CSV de respaldo.');
        exportExcelCSVFallback(rows, filenameBase);
        return;
      }

      try {
        const NAVY = 'FF16223D';
        const MAUVE = 'FF8B7FA0';
        const MAUVE_PALE = 'FFF1EEF4';
        const CREAM = 'FFF7F4EC';
        const TEXT_DARK = 'FF1B2A4A';

        const wb = new ExcelJS.Workbook();
        wb.creator = 'NC Caliman Logistics';
        wb.created = d;
        const ws = wb.addWorksheet('Liquidación', {
          views: [{ state: 'frozen', ySplit: 4 }],
          pageSetup: { orientation: 'landscape', fitToPage: true }
        });

        const columns = [
          { header: 'Destinatario', width: 24 },
          { header: 'Localidad Dest.', width: 20 },
          { header: 'Bultos', width: 10 },
          { header: 'Peso (kg)', width: 12 },
          { header: 'Expedidor', width: 22 },
          { header: 'Localidad Exp.', width: 20 },
          { header: 'Precio (€)', width: 12 }
        ];
        ws.columns = columns.map(c => ({ width: c.width }));

        // ── Fila 1-2: título de marca ─────────────────────────────
        ws.mergeCells('A1:G1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'NC CALIMAN LOGISTICS — Liquidación de Paquetería';
        titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        ws.getRow(1).height = 26;

        ws.mergeCells('A2:G2');
        const subCell = ws.getCell('A2');
        const totalBultos = rows.reduce((s, r) => s + r.bultos, 0);
        const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
        const totalMoney = rows.reduce((s, r) => s + r.price, 0);
        subCell.value = `${dateId}  ·  ${d.toLocaleDateString('es-ES')}  ·  ${totalBultos} bultos  ·  ${totalWeight.toFixed(1)} kg  ·  ${totalMoney.toFixed(2)} €`;
        subCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: TEXT_DARK } };
        subCell.alignment = { vertical: 'middle', horizontal: 'left' };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAUVE_PALE } };
        ws.getRow(2).height = 18;

        ws.getRow(3).height = 4; // respiro entre el bloque de marca y la tabla

        // ── Fila 4: cabecera de columnas (acento mauve) ───────────
        const headerRow = ws.getRow(4);
        columns.forEach((c, i) => {
          const cell = headerRow.getCell(i + 1);
          cell.value = c.header;
          cell.font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAUVE } };
          cell.alignment = { vertical: 'middle', horizontal: i >= 2 && i !== 4 && i !== 5 ? 'right' : 'left' };
          cell.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
        });
        headerRow.height = 20;

        // ── Filas de datos (cebra suave con acento mauve) ─────────
        rows.forEach((r, idx) => {
          const row = ws.addRow([
            r.destinatario, r.localidadDestinatario, r.bultos, r.weight, r.expedidor, r.localidadExpedidor, r.price
          ]);
          const zebra = idx % 2 === 1;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: 10, color: { argb: TEXT_DARK } };
            if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAUVE_PALE } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFE0DCE6' } } };
            if (colNumber === 3 || colNumber === 4 || colNumber === 7) {
              cell.font = { name: 'Consolas', bold: true, size: 10, color: { argb: TEXT_DARK } };
              cell.alignment = { horizontal: 'right' };
            }
          });
          row.getCell(4).numFmt = '0.00" kg"';
          row.getCell(7).numFmt = '0.00" €"';
        });

        // ── Fila de totales ────────────────────────────────────────
        const totalsRow = ws.addRow(['', '', 'TOTALES', totalWeight, '', '', totalMoney]);
        totalsRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
          cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: CREAM } };
        });
        totalsRow.getCell(3).alignment = { horizontal: 'right' };
        totalsRow.getCell(4).numFmt = '0.00" kg"';
        totalsRow.getCell(4).alignment = { horizontal: 'right' };
        totalsRow.getCell(4).font = { name: 'Consolas', bold: true, size: 10, color: { argb: CREAM } };
        totalsRow.getCell(7).numFmt = '0.00" €"';
        totalsRow.getCell(7).alignment = { horizontal: 'right' };
        totalsRow.getCell(7).font = { name: 'Consolas', bold: true, size: 10, color: { argb: CREAM } };
        totalsRow.height = 20;

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameBase}.xlsx`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(url);
        }, 150);

        try {
          if (typeof EventBus !== 'undefined' && EventBus && typeof EV !== 'undefined' && EV && EV.TOAST) {
            EventBus.emit(EV.TOAST, { type: 'success', message: '📥 Excel descargado correctamente.' });
          }
        } catch (e) {}
      } catch (err) {
        console.error('[Export Excel Error]:', err);
        exportExcelCSVFallback(rows, filenameBase);
      }
    };

    // Respaldo sin dependencias: CSV plano, usado solo si ExcelJS no cargó o falló.
    function exportExcelCSVFallback(rows, filenameBase) {
      try {
        let csvContent = "﻿"; // BOM UTF-8 para Excel en español
        csvContent += "Destinatario;Localidad Destinatario;Bultos;Peso (kg);Expedidor;Localidad Expedidor;Precio (€)\r\n";
        rows.forEach(r => {
          csvContent += `"${String(r.destinatario).replace(/"/g, '""')}";"${String(r.localidadDestinatario).replace(/"/g, '""')}";"${r.bultos}";"${r.weight.toFixed(2).replace(/\./g, ',')}";"${String(r.expedidor).replace(/"/g, '""')}";"${String(r.localidadExpedidor).replace(/"/g, '""')}";"${r.price.toFixed(2).replace(/\./g, ',')}"\r\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameBase}.csv`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(url);
        }, 150);
        try {
          if (typeof EventBus !== 'undefined' && EventBus && typeof EV !== 'undefined' && EV && EV.TOAST) {
            EventBus.emit(EV.TOAST, { type: 'warning', message: '📥 CSV descargado (Excel no disponible).' });
          }
        } catch (e) {}
      } catch (err) {
        console.error('[Export Excel CSV Fallback Error]:', err);
        alert('Error al exportar: ' + err.message);
      }
    }

    window.openEmailModal = function openEmailModal() {
      try {
        const pkgs = typeof getActivePackagesOrDOM === 'function' ? getActivePackagesOrDOM() : [];
        const totalBultos = pkgs.reduce((s, p) => s + (parseInt(p.bultos) || 1), 0);
        const totalWeight = pkgs.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0);
        const totalMoney = pkgs.reduce((s, p) => {
          const w = parseFloat(p.weight) || 0;
          const price = (p.price !== undefined && p.price !== null && !isNaN(parseFloat(p.price)) && parseFloat(p.price) > 0)
            ? parseFloat(p.price)
            : ((typeof CalculatorService !== 'undefined' && CalculatorService.calculatePrice) ? CalculatorService.calculatePrice(w) : (w > 5 ? w * 2.0 : 10.0));
          return s + price;
        }, 0);

        const elPkgs = document.getElementById('email-preview-pkgs');
        const elBultos = document.getElementById('email-preview-bultos');
        const elWeight = document.getElementById('email-preview-weight');
        const elMoney = document.getElementById('email-preview-money');

        if (elPkgs) elPkgs.textContent = pkgs.length;
        if (elBultos) elBultos.textContent = `${totalBultos} u.`;
        if (elWeight) elWeight.textContent = `${totalWeight.toFixed(1)} kg`;
        if (elMoney) elMoney.textContent = `${totalMoney.toFixed(2)} €`;

        const emailInput = document.getElementById('send-to-email');
        if (emailInput) {
          try {
            if (typeof emailService !== 'undefined' && emailService && typeof emailService.getDefaultEmail === 'function') {
              emailInput.value = emailService.getDefaultEmail() || '';
            } else {
              const saved = localStorage.getItem('nc_caliman_default_email');
              if (saved) emailInput.value = saved;
            }
          } catch (e) {}
        }
        const emailModal = document.getElementById('email-modal-overlay');
        if (emailModal) {
          emailModal.style.display = 'flex';
          emailModal.classList.remove('hidden');
          if (window.lucide) lucide.createIcons({ nodes: [emailModal] });
        } else {
          alert('Modal de envío de correo no disponible.');
        }
      } catch (err) {
        console.error('[Open Email Modal Error]:', err);
        alert('Error al abrir modal de correo: ' + err.message);
      }
    };

    window.printReport = function printReport() {
      try {
        if (typeof renderDashboard === 'function') renderDashboard();
        const originalTitle = document.title;
        document.title = '';
        window.print();
        setTimeout(() => {
          document.title = originalTitle;
        }, 500);
      } catch (err) {
        console.error('[Print Report Error]:', err);
        window.print();
      }
    };

    window.closeAndArchiveFinde = async function closeAndArchiveFinde() {
      try {
        const pkgs = getActivePackagesOrDOM();
        if (!pkgs || pkgs.length === 0) {
          if (typeof EventBus !== 'undefined' && typeof EV !== 'undefined' && EV.TOAST) {
            EventBus.emit(EV.TOAST, { type: 'error', message: 'No hay paquetes en el fin de semana actual para archivar.' });
          } else {
            alert('No hay paquetes en el fin de semana actual para archivar.');
          }
          return;
        }

        const totalBultos = pkgs.reduce((s, p) => s + (parseInt(p.bultos) || 1), 0);

        let confirmed = false;
        if (typeof showConfirmModal === 'function') {
          confirmed = await showConfirmModal({
            title: '¿Archivar y Cerrar Finde?',
            itemName: `${totalBultos} paquete${totalBultos > 1 ? 's' : ''} en esta sesión`,
            message: 'Se guardarán los envíos en el Histórico.',
            confirmText: 'Archivar Finde'
          });
        } else {
          confirmed = window.confirm(`¿Archivar y Cerrar Finde?\n\n${totalBultos} paquete(s) en esta sesión.\n\nSe guardarán los envíos en el Histórico.`);
        }

        if (!confirmed) return;

        if (typeof archiveCurrentWeekend === 'function') {
          await archiveCurrentWeekend(pkgs);
        } else {
          const history = (typeof StorageService !== 'undefined' && StorageService.getHistory) ? StorageService.getHistory() : [];
          const now = new Date();
          const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const totalWeight = pkgs.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0);
          const totalMoney = pkgs.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);

          const archivedItem = {
            id: 'finde_' + Date.now(),
            dateLabel: dateStr,
            createdAt: now.toISOString(),
            count: totalBultos,
            weight: totalWeight,
            money: totalMoney,
            packages: pkgs
          };

          history.unshift(archivedItem);
          if (typeof StorageService !== 'undefined') {
            StorageService.saveHistory(history);
            StorageService.savePackages([]);
          }
          if (typeof renderDashboard === 'function') renderDashboard();
          if (typeof navigateTo === 'function') navigateTo('history');
        }
      } catch (err) {
        console.error('[closeAndArchiveFinde Error]:', err);
        alert('Error al archivar finde: ' + err.message);
      }
    };

    window.openAddRateModal = function openAddRateModal() {
      try {
        if (typeof activeRateId !== 'undefined') activeRateId = null;
        const form = document.getElementById('rate-form');
        if (form) form.reset();
        const title = document.getElementById('rate-modal-title');
        if (title) title.textContent = 'Nuevo Tramo de Peso';
        const overlay = document.getElementById('rate-modal-overlay');
        if (overlay) overlay.classList.remove('hidden');
      } catch (err) {
        console.error('[openAddRateModal Error]:', err);
      }
    };

    // Note 1: Helper Functions & Security Utilities
    // HTML Escaping Utility to prevent Cross-Site Scripting (XSS) when rendering user input dynamically into DOM text nodes.
    function _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
    
    // Note 2: Debounce Utility for Input Performance Optimization
    // Delays execution until user stops typing for 'd' milliseconds, preventing excessive CPU usage during search filtering.
    function debounce(fn, d = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d) } }
    
    // Note 3: Cubic Easing Counter Animation
    // Animates numeric values smoothy over time using cubic ease-out curve performance.now() for high-precision 60fps rendering.
    function animateCounter(el, target, dur = 600, unitType = 'int') {
      if (!el) return;
      const start = parseFloat((el.textContent || '').replace(/[^0-9\.]/g, '')) || 0;
      const diff = target - start;
      const formatVal = val => {
        if (unitType === 'price') return `${val.toFixed(2)} €`;
        if (unitType === 'weight') return `${val.toFixed(1)} kg`;
        if (unitType === 'int') return Math.round(val).toString();
        return Math.round(val).toString();
      };
      if (!diff) {
        el.textContent = formatVal(target);
        return;
      }
      const t0 = performance.now();
      const step = now => {
        const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        const val = start + diff * e;
        el.textContent = formatVal(val);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // Note 4: Observer Pattern (EventBus Implementation)
    // Decouples application modules by allowing components to publish and subscribe to application events asynchronously.
    const EventBus = (() => { const listeners = {}; return { on: (e, h) => { (listeners[e] || (listeners[e] = [])).push(h) }, emit: (e, d) => (listeners[e] ?? []).forEach(h => { try { h(d) } catch (err) { console.error('[EventBus]', e, err) } }) }; })();
    const EV = { NAVIGATE: 'navigate', PKG_CHANGED: 'pkg:changed', TOAST: 'toast', RATES_CHANGED: 'rates:changed' };

    // Note 5: Data Access Object (DAO) & LocalStorage Wrapper Service
    // Provides synchronous access to local device persistence for offline reliability.
    const StorageService = {
      getPackages: () => {
        try {
          const raw = localStorage.getItem('nc_caliman_packages_v2');
          if (raw === null) return [];
          return JSON.parse(raw) || [];
        } catch {
          return [];
        }
      },
      savePackages: a => { try { localStorage.setItem('nc_caliman_packages_v2', JSON.stringify(a)) } catch (e) { console.error(e) } },
      getRates: () => {
        try {
          let d = JSON.parse(localStorage.getItem('nc_caliman_rates_v5'));
          if (!d || !d.length) {
            d = [
              { id: 'r1', minWeight: 0, maxWeight: 5, type: 'fixed', price: 10.00 },
              { id: 'r2', minWeight: 6, maxWeight: 200, type: 'per-kg', price: 2.00 },
              { id: 'r3', minWeight: 201, maxWeight: 300, type: 'per-kg', price: 1.75 },
              { id: 'r4', minWeight: 301, maxWeight: 500, type: 'per-kg', price: 1.50 },
              { id: 'r5', minWeight: 501, maxWeight: 1000, type: 'per-kg', price: 1.20 }
            ];
            localStorage.setItem('nc_caliman_rates_v5', JSON.stringify(d));
          } else {
            if (!d.some(r => r.minWeight === 0 && r.maxWeight === 5)) {
              d.unshift({ id: 'r1', minWeight: 0, maxWeight: 5, type: 'fixed', price: 10.00 });
              localStorage.setItem('nc_caliman_rates_v5', JSON.stringify(d));
            }
          }
          return d;
        } catch {
          return [];
        }
      },
      saveRates: r => { try { localStorage.setItem('nc_caliman_rates_v5', JSON.stringify(r)) } catch (e) { console.error(e) } },
      getClients: () => { try { return JSON.parse(localStorage.getItem('nc_caliman_clients')) || [] } catch { return [] } },
      saveClients: c => { try { localStorage.setItem('nc_caliman_clients', JSON.stringify(c)) } catch (e) { console.error(e) } },
      getHistory: () => { try { return JSON.parse(localStorage.getItem('nc_caliman_history')) || [] } catch { return [] } },
      saveHistory: h => { try { localStorage.setItem('nc_caliman_history', JSON.stringify(h)) } catch (e) { console.error(e) } }
    };

    // ── SUPABASE SERVICE (Nube y Sincronización Realtime) ───────────
    const SupabaseService = (() => {
      let client = null;
      let channel = null;

      function getCredentials() {
        return {
          url: localStorage.getItem('nc_caliman_supa_url') || 'https://nxgpiwrrydrpigijdnst.supabase.co',
          key: localStorage.getItem('nc_caliman_supa_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z3Bpd3JyeWRycGlnaWpkbnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MDAwNTQsImV4cCI6MjEwMTM3NjA1NH0.zbnIg-Dpe-6ZIAe-aDwmU47g8yavZX5ju8FZfKhHzFY'
        };
      }

      function init() {
        const { url, key } = getCredentials();
        if (url && key && window.supabase) {
          try {
            client = window.supabase.createClient(url, key);
            subscribeRealtime();
            syncFromCloud();
            syncHistoryFromCloud();
            syncActivePrompt();
            console.log('%cNC Caliman — Supabase Realtime Conectado', 'color:#14b8a6;font-weight:bold');
            return true;
          } catch (err) {
            console.error('[SupabaseInitError]', err);
            client = null;
          }
        }
        return false;
      }

      function subscribeRealtime() {
        if (!client) return;
        if (channel) client.removeChannel(channel);

        channel = client.channel('public:packages')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, payload => {
            console.log('[SupabaseRealtimePayload]', payload);
            EventBus.emit(EV.TOAST, {
              type: 'info',
              message: payload.eventType === 'INSERT' ? '🔔 Sincronización: Nuevo paquete recibido' : '🔔 Sincronización: Datos de la nube actualizados'
            });
            syncFromCloud();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, payload => {
            console.log('[SupabaseRealtimePayload:history]', payload);
            EventBus.emit(EV.TOAST, {
              type: 'info',
              message: '🔔 Sincronización: Histórico de liquidaciones actualizado'
            });
            syncHistoryFromCloud();
          })
          .subscribe();
      }

      async function pushLocalPackagesToCloud() {
        if (!client) return;
        const localPkgs = StorageService.getPackages();
        for (const pkg of localPkgs) {
          await savePackage(pkg);
        }
      }

      async function syncFromCloud() {
        if (!client) return false;
        try {
          const { data, error } = await client.from('packages').select('*');
          if (!error && data) {
            // Solo migra los paquetes locales a la nube la primera vez que este dispositivo
            // se conecta a Supabase. Sin este guard, cualquier lectura transitoria de la nube
            // vacía (p.ej. justo entre dos deletes de "Cerrar y Archivar Finde", antes de que
            // el evento realtime termine de propagar) volvía a subir paquetes ya archivados
            // porque el localStorage todavía los tenía en caché — resucitándolos.
            const alreadyMigrated = localStorage.getItem('nc_caliman_cloud_migrated') === '1';
            if (data.length === 0 && !alreadyMigrated) {
              const localPkgs = StorageService.getPackages();
              if (localPkgs.length > 0) {
                await pushLocalPackagesToCloud();
              }
              localStorage.setItem('nc_caliman_cloud_migrated', '1');
              return true;
            }
            localStorage.setItem('nc_caliman_cloud_migrated', '1');

            const pkgs = data.map(r => ({
              id: r.id,
              destinatario: r.destinatario || '',
              localidadDestinatario: r.localidadDestinatario || r.localidaddestinatario || '',
              bultos: String(r.bultos ?? '1'),
              weight: String(r.weight ?? '0'),
              expedidor: r.expedidor || '',
              localidadExpedidor: r.localidadExpedidor || r.localidadexpedidor || '',
              price: parseFloat(r.price) || 0,
              createdAt: r.createdAt || r.createdat || new Date().toISOString()
            }));
            StorageService.savePackages(pkgs);
            if (typeof renderDashboard === 'function') renderDashboard();
            return true;
          }
        } catch (err) {
          console.error('[SupabaseSyncError]', err);
        }
        return false;
      }

      async function savePackage(pkg) {
        if (!client) return false;
        try {
          const rowLower = {
            id: pkg.id,
            destinatario: pkg.destinatario,
            localidaddestinatario: pkg.localidadDestinatario,
            bultos: String(pkg.bultos),
            weight: String(pkg.weight),
            expedidor: pkg.expedidor,
            localidadexpedidor: pkg.localidadExpedidor,
            price: pkg.price,
            createdat: pkg.createdAt || new Date().toISOString()
          };
          const { error } = await client.from('packages').upsert(rowLower);
          if (error) {
            const rowCamel = {
              id: pkg.id,
              destinatario: pkg.destinatario,
              localidadDestinatario: pkg.localidadDestinatario,
              bultos: String(pkg.bultos),
              weight: String(pkg.weight),
              expedidor: pkg.expedidor,
              localidadExpedidor: pkg.localidadExpedidor,
              price: pkg.price,
              createdAt: pkg.createdAt || new Date().toISOString()
            };
            await client.from('packages').upsert(rowCamel);
          }
          return true;
        } catch (err) {
          console.error('[SupabaseSaveError]', err);
          return false;
        }
      }

      async function deletePackage(id) {
        if (!client) return false;
        try {
          const { error } = await client.from('packages').delete().eq('id', id);
          return !error;
        } catch (err) {
          console.error('[SupabaseDeleteError]', err);
          return false;
        }
      }

      async function saveHistoryItem(item) {
        if (!client) return false;
        try {
          const row = {
            id: item.id,
            datelabel: item.dateLabel,
            createdat: item.createdAt || new Date().toISOString(),
            count: item.count,
            weight: item.weight,
            money: item.money,
            packages: item.packages
          };
          const { error } = await client.from('history').upsert(row);
          if (error) console.error('[SupabaseSaveHistoryError]', error);
          return !error;
        } catch (err) {
          console.error('[SupabaseSaveHistoryError]', err);
          return false;
        }
      }

      async function deleteHistoryItem(id) {
        if (!client) return false;
        try {
          const { error } = await client.from('history').delete().eq('id', id);
          return !error;
        } catch (err) {
          console.error('[SupabaseDeleteHistoryError]', err);
          return false;
        }
      }

      async function pushLocalHistoryToCloud() {
        if (!client) return;
        const localHistory = StorageService.getHistory();
        for (const item of localHistory) {
          await saveHistoryItem(item);
        }
      }

      async function syncHistoryFromCloud() {
        if (!client) return false;
        try {
          const { data, error } = await client.from('history').select('*').order('createdat', { ascending: false });
          if (!error && data) {
            // Mismo guard que en syncFromCloud: solo migra el histórico local a la nube la
            // primera vez que este dispositivo se conecta, para no resucitar registros que
            // ya se borraron desde otro dispositivo.
            const alreadyMigrated = localStorage.getItem('nc_caliman_history_cloud_migrated') === '1';
            if (data.length === 0 && !alreadyMigrated) {
              const localHistory = StorageService.getHistory();
              if (localHistory.length > 0) {
                await pushLocalHistoryToCloud();
              }
              localStorage.setItem('nc_caliman_history_cloud_migrated', '1');
              return true;
            }
            localStorage.setItem('nc_caliman_history_cloud_migrated', '1');

            const items = data.map(r => ({
              id: r.id,
              dateLabel: r.datelabel || '',
              createdAt: r.createdat || new Date().toISOString(),
              count: r.count || 0,
              weight: r.weight || 0,
              money: r.money || 0,
              packages: r.packages || []
            }));
            StorageService.saveHistory(items);
            if (typeof renderHistoryView === 'function' && document.getElementById('history-container')) renderHistoryView();
            return true;
          }
        } catch (err) {
          console.error('[SupabaseSyncHistoryError]', err);
        }
        return false;
      }

      // Registra las correcciones que el usuario hace sobre lo que leyó el OCR de Gemini.
      // El agente semanal usa esta tabla para detectar errores recurrentes y afinar el prompt.
      async function logOcrCorrections(entries) {
        if (!client || !entries || entries.length === 0) return false;
        try {
          const rows = entries.map(e => ({
            campo: e.campo,
            valor_ocr: e.valorOcr,
            valor_corregido: e.valorCorregido
          }));
          const { error } = await client.from('ocr_corrections').insert(rows);
          if (error) console.error('[SupabaseLogCorrectionError]', error);
          return !error;
        } catch (err) {
          console.error('[SupabaseLogCorrectionError]', err);
          return false;
        }
      }

      // Trae las mejoras de prompt que el agente semanal dejó pendientes de revisión.
      async function fetchPendingPromptSuggestions() {
        if (!client) return [];
        try {
          const { data, error } = await client
            .from('ocr_prompt_suggestions')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          if (error) { console.error('[SupabaseFetchSuggestionsError]', error); return []; }
          return data || [];
        } catch (err) {
          console.error('[SupabaseFetchSuggestionsError]', err);
          return [];
        }
      }

      // Aplica una sugerencia: la vuelve el prompt activo (config compartida en la nube + copia local
      // en GeminiService para uso inmediato) y la marca como aplicada.
      async function applyPromptSuggestion(suggestion) {
        if (!client) return false;
        try {
          const { error: cfgError } = await client
            .from('ocr_prompt_config')
            .upsert({ id: 1, prompt_text: suggestion.prompt_text, updated_at: new Date().toISOString() });
          if (cfgError) { console.error('[SupabaseApplyPromptError]', cfgError); return false; }

          const { error: statusError } = await client
            .from('ocr_prompt_suggestions')
            .update({ status: 'applied' })
            .eq('id', suggestion.id);
          if (statusError) console.error('[SupabaseApplyPromptError]', statusError);

          geminiService.setPromptOverride(suggestion.prompt_text);
          return true;
        } catch (err) {
          console.error('[SupabaseApplyPromptError]', err);
          return false;
        }
      }

      async function discardPromptSuggestion(id) {
        if (!client) return false;
        try {
          const { error } = await client.from('ocr_prompt_suggestions').update({ status: 'discarded' }).eq('id', id);
          return !error;
        } catch (err) {
          console.error('[SupabaseDiscardPromptError]', err);
          return false;
        }
      }

      // Trae la config activa de la nube (por si se aplicó una mejora desde otro dispositivo) y la cachea localmente.
      async function syncActivePrompt() {
        if (!client) return false;
        try {
          const { data, error } = await client.from('ocr_prompt_config').select('*').eq('id', 1).maybeSingle();
          if (!error && data?.prompt_text) {
            geminiService.setPromptOverride(data.prompt_text);
            return true;
          }
        } catch (err) {
          console.error('[SupabaseSyncPromptError]', err);
        }
        return false;
      }

      return {
        getCredentials,
        init,
        syncFromCloud,
        savePackage,
        deletePackage,
        saveHistoryItem,
        deleteHistoryItem,
        syncHistoryFromCloud,
        logOcrCorrections,
        fetchPendingPromptSuggestions,
        applyPromptSuggestion,
        discardPromptSuggestion,
        syncActivePrompt,
        isConfigured: () => !!client
      };
    })();
    window.SupabaseService = SupabaseService;

    // ── CALCULATION ENGINE ────────────────────────────────────────
    const CalculatorService = {
      calculatePrice(weight) {
        const w = parseFloat(weight);
        if (isNaN(w) || w <= 0) return 0;
        const rates = StorageService.getRates();
        const sorted = [...rates].sort((a, b) => a.minWeight - b.minWeight);
        for (const r of sorted) {
          const matchMin = w >= r.minWeight;
          const matchMax = r.maxWeight === null || r.maxWeight === undefined || w <= r.maxWeight;
          if (matchMin && matchMax) {
            return r.type === 'fixed' ? r.price : r.price * w;
          }
        }
        // Cobertura para pesos decimales entre límites de tramo
        for (const r of sorted) {
          if (r.maxWeight && w <= r.maxWeight) {
            return r.type === 'fixed' ? r.price : r.price * w;
          }
        }
        return w * 2.00;
      }
    };

    // ── VALIDATION SERVICE ────────────────────────────────────────
    const ValidationService = {
      validate(d) {
        const e = {};
        if (!d.destinatario?.trim()) e.destinatario = 'El destinatario es obligatorio.';
        if (!d.localidadDestinatario?.trim()) e.localidadDestinatario = 'La localidad del destinatario es obligatoria.';
        if (!d.bultos || isNaN(parseInt(d.bultos)) || parseInt(d.bultos) <= 0) e.bultos = 'Número de bultos inválido.';
        if (!d.weight || isNaN(parseFloat(d.weight)) || parseFloat(d.weight) <= 0) e.weight = 'Introduce un peso válido mayor que 0.';
        if (!d.expedidor?.trim()) e.expedidor = 'El expedidor es obligatorio.';
        if (!d.localidadExpedidor?.trim()) e.localidadExpedidor = 'La localidad del expedidor es obligatoria.';
        return { valid: Object.keys(e).length === 0, errors: e }
      }
    };

    // ── TOAST NOTIFICATIONS ───────────────────────────────────────
    EventBus.on(EV.TOAST, ({ type, message }) => {
      const c = document.getElementById('toast-container'); if (!c) return;
      const t = document.createElement('div'); t.className = `toast toast--${type}`; t.textContent = message; c.appendChild(t);
      setTimeout(() => { t.classList.add('removing'); t.addEventListener('animationend', () => t.remove()) }, 3500);
    });

    // ── DASHBOARD ACTIONS & RENDERING ─────────────────────────────
    function renderDashboard() {
      const pkgs = StorageService.getPackages();
      const summary = { total: 0, weight: 0, money: 0 };
      pkgs.forEach(p => {
        const w = parseFloat(p.weight) || 0;
        const price = (p.price !== undefined && p.price !== null && !isNaN(parseFloat(p.price)) && parseFloat(p.price) > 0)
          ? parseFloat(p.price)
          : CalculatorService.calculatePrice(w);
        summary.total += parseInt(p.bultos) || 1;
        summary.weight += w;
        summary.money += price;
      });

      animateCounter(document.getElementById('stat-total'), summary.total, 600, 'int');
      animateCounter(document.getElementById('stat-weight'), summary.weight, 600, 'weight');
      animateCounter(document.getElementById('stat-money'), summary.money, 600, 'price');

      // Actualizar valores en el Albarán Oficial de impresión
      const albTotal = document.getElementById('albaran-stat-total');
      if (albTotal) albTotal.textContent = `${summary.total} bultos / envíos`;

      const albWeight = document.getElementById('albaran-stat-weight');
      if (albWeight) albWeight.textContent = `${summary.weight.toFixed(1)} kg`;

      const albMoney = document.getElementById('albaran-stat-money');
      if (albMoney) albMoney.textContent = `${summary.money.toFixed(2)} €`;

      const albDate = document.getElementById('albaran-print-date');
      if (albDate) {
        const now = new Date();
        albDate.textContent = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }

      // Actualizar Código QR con enlace de descarga directa en PDF (?action=download-pdf)
      const albQrImg = document.getElementById('albaran-qr-img');
      const albQrLabel = document.getElementById('albaran-qr-code-label');
      if (albQrImg) {
        const now = new Date();
        const dateId = `LIQ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        // Si la app está en localhost, usamos la IP Wi-Fi local del PC (192.168.1.132) para que el Pixel 10 Pro la abra por Wi-Fi
        const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '192.168.1.132:3000' : window.location.host;
        const appUrl = `http://${host}/?action=download-pdf&id=${dateId}`;
        albQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(appUrl)}`;
        if (albQrLabel) albQrLabel.textContent = dateId;
      }

      const body = document.getElementById('liquid-table-body'), empty = document.getElementById('dashboard-empty');
      if (!body) return;

      if (pkgs.length === 0) {
        body.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
      }
      empty?.classList.add('hidden');

      body.innerHTML = pkgs.map(p => `
    <tr>
      <td class="cell-name" data-label="Destinatario" style="text-align:center;">${_esc(p.destinatario)}</td>
      <td class="cell-city" data-label="Localidad Dest.">${_esc(p.localidadDestinatario)}</td>
      <td data-label="Bultos" style="text-align:center;"><span class="cell-bultos">${_esc(p.bultos)}</span></td>
      <td data-label="Peso (kg)" style="text-align:center;"><span class="cell-weight">${p.weight}</span></td>
      <td class="cell-name" data-label="Expedidor" style="text-align:center;">${_esc(p.expedidor)}</td>
      <td class="cell-city" data-label="Localidad Exp.">${_esc(p.localidadExpedidor)}</td>
    </tr>
  `).join('');
    }

    function renderDashboardRatesWidget() {
      const container = document.getElementById('dashboard-rates-list');
      if (!container) return;
      const rates = StorageService.getRates().sort((a, b) => a.minWeight - b.minWeight);
      if (!rates || rates.length === 0) {
        container.innerHTML = '<div style="padding:12px; color:#B9C0D4; text-align:center; font-size:0.8rem;">No hay tarifas configuradas.</div>';
        return;
      }
      const colorPalettes = [
        { color: '#8B7FA0', bg: 'rgba(139, 127, 160, 0.12)', border: 'rgba(139, 127, 160, 0.35)' },
        { color: '#7FA5CC', bg: 'rgba(127, 165, 204, 0.12)', border: 'rgba(127, 165, 204, 0.35)' },
        { color: '#D4A64C', bg: 'rgba(212, 166, 76, 0.12)', border: 'rgba(212, 166, 76, 0.35)' },
        { color: '#5CA47F', bg: 'rgba(92, 164, 127, 0.12)', border: 'rgba(92, 164, 127, 0.35)' },
        { color: '#D9695C', bg: 'rgba(217, 105, 92, 0.12)', border: 'rgba(217, 105, 92, 0.35)' }
      ];
      container.innerHTML = rates.map((r, idx) => {
        const pal = colorPalettes[idx % colorPalettes.length];
        const isPlicuri = r.minWeight === 0 && r.maxWeight === 5 && r.type === 'fixed';
        const label = isPlicuri
          ? '0 a 5 kg <span style="font-size:0.75rem; color:#B9C0D4; font-weight:500;">(Plicuri)</span>'
          : `${r.minWeight} ${r.maxWeight ? 'a ' + r.maxWeight + ' kg' : 'kg +'}`;
        return `
        <div class="dashboard-rate-item" style="display:flex; justify-content:space-between; align-items:center; padding:11px 14px; background:var(--bg-elevated); border-radius:8px; border:1px solid var(--border-subtle, rgba(255,255,255,0.07)); transition:border-color 0.2s ease;">
          <span style="color:#F7F4EC; font-weight:700; font-size:0.86rem;">${label}</span>
          <span class="price-tag" style="font-weight:700; color:${pal.color}; background:${pal.bg}; border:1px solid ${pal.border}; padding:4px 12px; border-radius:6px; font-size:0.84rem; font-family:var(--font-mono);">${r.price.toFixed(2)} € ${r.type === 'per-kg' ? '/ kg' : '(Fijo)'}</span>
        </div>
      `;
      }).join('');
    }

    // ── OCR LIVE SCANNER LOGIC ─────────────────────────────────
    /** @type {MediaStream|null} */
    let _cameraStream = null;
    let _scannerMode = 'camera'; // 'camera' | 'upload'
    let _lastOcrRaw = null; // Último resultado crudo de Gemini, para comparar con lo que el usuario corrige al guardar

    const scannerEls = {
      viewport:   document.getElementById('scanner-viewport'),
      video:      document.getElementById('scanner-video'),
      capturedImg:document.getElementById('scanner-captured-img'),
      canvas:     document.getElementById('scanner-canvas'),
      overlay:    document.getElementById('scanner-overlay'),
      openBtn:    document.getElementById('scanner-open-btn'),
      uploadBtn:  document.getElementById('scanner-upload-btn'),
      captureBtn: document.getElementById('scanner-capture-btn'),
      closeBtn:   document.getElementById('scanner-close-btn'),
      fileInput:  document.getElementById('ocr-file-input'),
      statusText: document.getElementById('ocr-status'),
      progress:   document.getElementById('ocr-progress'),
      progressBar:document.getElementById('ocr-progress-bar'),
      resultsGrid:document.getElementById('ocr-results-grid'),
    };

    // ── Open Camera ──
    scannerEls.openBtn?.addEventListener('click', async () => {
      _resetScannerUI();
      _scannerMode = 'camera';
      try {
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1440 },
          }
        };
        _cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        scannerEls.video.srcObject = _cameraStream;
        scannerEls.video.style.display = 'block';
        scannerEls.capturedImg.style.display = 'none';
        scannerEls.viewport.style.display = 'block';
        scannerEls.overlay.style.display = 'block';
        scannerEls.openBtn.style.display = 'none';
        if (scannerEls.uploadBtn) scannerEls.uploadBtn.style.display = 'none';
        scannerEls.captureBtn.style.display = '';
        scannerEls.captureBtn.innerHTML = '<i data-lucide="aperture" style="width:16px;height:16px"></i> Capturar y Escanear';
        scannerEls.closeBtn.style.display = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (err) {
        console.error('Camera error:', err);
        scannerEls.statusText.textContent = '⚠️ No se pudo abrir la cámara. Haz clic en "Subir Imagen".';
        scannerEls.statusText.style.color = 'var(--accent-amber)';
      }
    });

    // ── Upload Image Direct Button ──
    scannerEls.uploadBtn?.addEventListener('click', () => {
      _resetScannerUI();
      _scannerMode = 'upload';
      scannerEls.fileInput?.click();
    });

    // ── File Upload Handler ──
    scannerEls.fileInput?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        scannerEls.capturedImg.src = ev.target.result;
        scannerEls.capturedImg.style.display = 'block';
        scannerEls.video.style.display = 'none';
        scannerEls.viewport.style.display = 'block';
        scannerEls.overlay.style.display = 'none';
        scannerEls.openBtn.style.display = 'none';
        if (scannerEls.uploadBtn) scannerEls.uploadBtn.style.display = 'none';
        scannerEls.captureBtn.style.display = '';
        scannerEls.closeBtn.style.display = '';
        scannerEls.captureBtn.innerHTML = '<i data-lucide="cpu" style="width:16px;height:16px"></i> Escanear con OCR';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        scannerEls.statusText.textContent = '';
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    });

    // ── Capture & OCR ──
    scannerEls.captureBtn?.addEventListener('click', async () => {
      let imageSource;

      if (_scannerMode === 'camera' && _cameraStream) {
        // Capture frame from live video
        const video = scannerEls.video;
        const canvas = scannerEls.canvas;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Crop to guide area (5% left/right, 6% top/bottom)
        const cropX = Math.round(canvas.width * 0.05);
        const cropY = Math.round(canvas.height * 0.06);
        const cropW = canvas.width - cropX * 2;
        const cropH = canvas.height - cropY * 2;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Show captured image
        imageSource = cropCanvas.toDataURL('image/jpeg', 0.92);
        scannerEls.capturedImg.src = imageSource;
        scannerEls.capturedImg.style.display = 'block';
        scannerEls.video.style.display = 'none';
        scannerEls.overlay.querySelector('.scan-line').style.display = 'none';

        // Stop camera after capture
        _stopCameraStream();
      } else if (scannerEls.capturedImg.src) {
        // Upload mode — send the photo as-is (color helps the AI distinguish handwriting from print)
        imageSource = scannerEls.capturedImg.src;
      } else {
        return;
      }

      // Run OCR con Google Gemini Vision
      scannerEls.captureBtn.disabled = true;
      scannerEls.progress.classList.add('active');
      scannerEls.progressBar.style.width = '30%';
      scannerEls.statusText.textContent = '🤖 Digitalizando formulario con Gemini IA Vision...';
      scannerEls.statusText.style.color = '#8B7FA0';

      try {
        const parsed = await geminiService.processFormImage(imageSource);
        scannerEls.progressBar.style.width = '100%';
        console.log('[OCR IA] Datos extraídos con Gemini:', parsed);
        _lastOcrRaw = { ...parsed };
        _applyOCRResults(parsed);
        EventBus.emit(EV.TOAST, { type: 'success', message: '✨ Formulario manuscrito extraído con éxito por IA Vision.' });
      } catch (err) {
        console.error('[OCR IA Gemini] Error:', err);
        scannerEls.statusText.textContent = '❌ Error al escanear: ' + err.message;
        scannerEls.statusText.style.color = 'var(--accent-red)';
      } finally {
        scannerEls.captureBtn.disabled = false;
        setTimeout(() => {
          scannerEls.progress.classList.remove('active');
          scannerEls.progressBar.style.width = '0%';
        }, 800);
      }
    });

    // ── Close Scanner ──
    scannerEls.closeBtn?.addEventListener('click', () => _closeScannerCamera());

    // ── APPLY OCR RESULTS ──
    function _applyOCRResults(parsed) {
      const fields = [
        { key: 'destinatario', id: 'pkg-dest', label: 'Destinatario' },
        { key: 'localidadDestinatario', id: 'pkg-loc-dest', label: 'Loc. Destinatario' },
        { key: 'bultos', id: 'pkg-bultos', label: 'Bultos' },
        { key: 'peso', id: 'pkg-weight', label: 'Peso' },
        { key: 'expedidor', id: 'pkg-exp', label: 'Expedidor' },
        { key: 'localidadExpedidor', id: 'pkg-loc-exp', label: 'Loc. Expedidor' },
      ];

      let foundCount = 0;
      const badges = [];

      fields.forEach(f => {
        const val = parsed[f.key];
        const found = !!val;
        if (found) {
          const el = document.getElementById(f.id);
          if (el) el.value = val;
          foundCount++;
        }
        badges.push(`
          <div class="ocr-result-badge ${found ? 'found' : 'not-found'}">
            <span class="badge-icon">${found ? '✅' : '❌'}</span>
            <span>${f.label}${found ? ': ' + _esc(val) : ''}</span>
          </div>
        `);
      });

      // Show results
      scannerEls.resultsGrid.innerHTML = badges.join('');
      scannerEls.resultsGrid.style.display = 'grid';

      if (foundCount > 0) {
        scannerEls.statusText.textContent = `✅ ${foundCount} de ${fields.length} campos extraídos. Revisa los datos.`;
        scannerEls.statusText.style.color = 'var(--accent-green)';
      } else {
        scannerEls.statusText.textContent = '⚠️ No se pudieron extraer datos. Intenta con mejor iluminación o ángulo.';
        scannerEls.statusText.style.color = 'var(--accent-amber)';
      }
    }

    // ── SCANNER HELPERS ──
    function _stopCameraStream() {
      if (_cameraStream) {
        _cameraStream.getTracks().forEach(t => t.stop());
        _cameraStream = null;
      }
    }

    function _closeScannerCamera() {
      _stopCameraStream();
      if (scannerEls.viewport) scannerEls.viewport.style.display = 'none';
      if (scannerEls.openBtn) scannerEls.openBtn.style.display = '';
      if (scannerEls.uploadBtn) scannerEls.uploadBtn.style.display = '';
      if (scannerEls.captureBtn) scannerEls.captureBtn.style.display = 'none';
      if (scannerEls.closeBtn) scannerEls.closeBtn.style.display = 'none';
      if (scannerEls.overlay) scannerEls.overlay.style.display = '';
      const scanLine = scannerEls.overlay?.querySelector('.scan-line');
      if (scanLine) scanLine.style.display = '';
      // Reset capture button text
      if (scannerEls.captureBtn) {
        scannerEls.captureBtn.innerHTML = '<i data-lucide="aperture" style="width:16px;height:16px"></i> Capturar y Escanear';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }

    function _resetScannerUI() {
      if (scannerEls.statusText) {
        scannerEls.statusText.textContent = '';
        scannerEls.statusText.style.color = '';
      }
      if (scannerEls.resultsGrid) {
        scannerEls.resultsGrid.style.display = 'none';
        scannerEls.resultsGrid.innerHTML = '';
      }
      scannerEls.progress?.classList.remove('active');
    }

    // ── CRUD ACCIONES DE PAQUETE ──────────────────────────────────
    let editingId = null;
    function prepareCreate() {
      editingId = null;
      _lastOcrRaw = null;
      document.getElementById('package-form')?.reset();
      clearErrors();
      document.getElementById('form-title').textContent = 'Registrar Envío';
      document.getElementById('submit-label').textContent = 'Guardar Envío';
      _closeScannerCamera();
      _resetScannerUI();
    }
    window.editPackage = id => {
      const p = StorageService.getPackages().find(x => x.id === id);
      if (!p) return;
      editingId = p.id;
      _lastOcrRaw = null;
      clearErrors();
      document.getElementById('form-title').textContent = 'Editar Envío';
      document.getElementById('submit-label').textContent = 'Actualizar';
      document.getElementById('pkg-dest').value = p.destinatario;
      document.getElementById('pkg-loc-dest').value = p.localidadDestinatario;
      document.getElementById('pkg-bultos').value = p.bultos;
      document.getElementById('pkg-weight').value = p.weight;
      document.getElementById('pkg-exp').value = p.expedidor;
      document.getElementById('pkg-loc-exp').value = p.localidadExpedidor;
      navigateTo('form');
    };

    let deleteTargetId = null;
    window.deletePackage = id => {
      deleteTargetId = id;
      document.getElementById('confirm-title-text').textContent = '¿Eliminar este paquete del fin de semana?';
      document.getElementById('confirm-body-text').textContent = 'El registro será borrado permanentemente de la caja actual.';
      document.getElementById('confirm-overlay').classList.remove('hidden');
    };

    function clearErrors() {
      ['error-dest', 'error-loc-dest', 'error-bultos', 'error-weight', 'error-exp', 'error-loc-exp'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '';
      });
      ['pkg-dest', 'pkg-loc-dest', 'pkg-bultos', 'pkg-weight', 'pkg-exp', 'pkg-loc-exp'].forEach(id => document.getElementById(id)?.classList.remove('error'));
    }

    // Envío de Formulario
    document.getElementById('package-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        destinatario: document.getElementById('pkg-dest').value.trim(),
        localidadDestinatario: document.getElementById('pkg-loc-dest').value.trim(),
        bultos: document.getElementById('pkg-bultos').value,
        weight: document.getElementById('pkg-weight').value,
        expedidor: document.getElementById('pkg-exp').value.trim(),
        localidadExpedidor: document.getElementById('pkg-loc-exp').value.trim()
      };
      const { valid, errors } = ValidationService.validate(data);
      clearErrors();
      if (!valid) {
        Object.entries(errors).forEach(([f, msg]) => {
          const map = { destinatario: 'error-dest', localidadDestinatario: 'error-loc-dest', bultos: 'error-bultos', weight: 'error-weight', expedidor: 'error-exp', localidadExpedidor: 'error-loc-exp' }[f];
          const inp = { destinatario: 'pkg-dest', localidadDestinatario: 'pkg-loc-dest', bultos: 'pkg-bultos', weight: 'pkg-weight', expedidor: 'pkg-exp', localidadExpedidor: 'pkg-loc-exp' }[f];
          document.getElementById(map).textContent = msg;
          document.getElementById(inp)?.classList.add('error');
        });
        return;
      }

      const calculatedCost = CalculatorService.calculatePrice(data.weight);
      const pkgs = StorageService.getPackages();

      // Si este formulario vino de un escaneo OCR, comparamos lo que leyó la IA
      // contra lo que el usuario terminó guardando y registramos las diferencias.
      if (_lastOcrRaw) {
        const fieldMap = { destinatario: 'destinatario', localidadDestinatario: 'localidadDestinatario', bultos: 'bultos', peso: 'weight', expedidor: 'expedidor', localidadExpedidor: 'localidadExpedidor' };
        const corrections = [];
        Object.entries(fieldMap).forEach(([ocrField, dataField]) => {
          const valorOcr = (_lastOcrRaw[ocrField] ?? '').toString().trim();
          const valorCorregido = (data[dataField] ?? '').toString().trim();
          if (valorOcr !== valorCorregido) {
            corrections.push({ campo: ocrField, valorOcr, valorCorregido });
          }
        });
        if (corrections.length > 0) SupabaseService.logOcrCorrections(corrections);
        _lastOcrRaw = null;
      }

      const btn = document.getElementById('form-submit-btn');
      btn.classList.add('btn--loading'); btn.disabled = true;

      setTimeout(() => {
        try {
          let targetPkg = null;
          if (editingId) {
            const idx = pkgs.findIndex(p => p.id === editingId);
            if (idx >= 0) {
              pkgs[idx] = { ...pkgs[idx], ...data, price: calculatedCost, updatedAt: new Date().toISOString() };
              targetPkg = pkgs[idx];
              EventBus.emit(EV.TOAST, { type: 'success', message: '✅ Registro actualizado con éxito.' });
            }
          } else {
            const d = new Date(), ymd = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('');
            const seq = String((pkgs.length + Math.floor(Math.random() * 900) + 100) % 9999).padStart(4, '0');
            targetPkg = {
              id: `CAL-${ymd}-${seq}`,
              ...data,
              price: calculatedCost,
              createdAt: new Date().toISOString()
            };
            pkgs.unshift(targetPkg);
            EventBus.emit(EV.TOAST, { type: 'success', message: '✅ Formulario guardado en la caja.' });
          }
          StorageService.savePackages(pkgs);
          syncClientsFromPackages(pkgs);
          if (targetPkg) SupabaseService.savePackage(targetPkg);
          navigateTo('dashboard');
        } finally {
          btn.classList.remove('btn--loading'); btn.disabled = false;
        }
      }, 200);
    });

    // Actualizar costo en tiempo real al escribir el peso
    document.getElementById('pkg-weight')?.addEventListener('input', e => {
      const w = parseFloat(e.target.value);
      if (isNaN(w) || w <= 0) {
        document.getElementById('pkg-price-calculated').value = '0.00 €';
      } else {
        document.getElementById('pkg-price-calculated').value = `${CalculatorService.calculatePrice(w).toFixed(2)} €`;
      }
    });

    // ── CONFIGURACIÓN DE TARIFAS (OFERTAS) ────────────────────────
    function renderRatesList() {
      const container = document.getElementById('rates-list-container');
      if (!container) return;
      const rates = StorageService.getRates().sort((a, b) => a.minWeight - b.minWeight);

      if (!rates || rates.length === 0) {
        container.innerHTML = '<div style="padding:16px; color:#B9C0D4; text-align:center; font-size:0.85rem;">No hay tramos de tarifa configurados. Haz clic en "Añadir Rango" para crear uno.</div>';
        return;
      }

      container.innerHTML = rates.map(r => `
    <div class="tier-item" style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; margin-bottom:10px; background:var(--bg-elevated); border-radius:8px; border:1px solid var(--border-subtle, rgba(255,255,255,0.08)); transition:border-color 0.2s ease;">
      <div class="tier-item__info">
        <h4 style="font-size:0.95rem; font-weight:700; color:#F7F4EC; margin:0; letter-spacing:-0.01em; font-family:var(--font-heading);">${r.minWeight === 0 && r.maxWeight === 5 && r.type === 'fixed' ? 'Tramo Mínimo (0 a 5 kg)' : `De ${r.minWeight} ${r.maxWeight ? 'a ' + r.maxWeight + ' kg' : 'kg en adelante'}`}</h4>
        <p style="color:#B9C0D4; font-size:0.76rem; font-weight:500; margin:3px 0 0 0;">${r.type === 'fixed' ? 'Tarifa plana fija por envío' : 'Tarifa de cobro por kilogramo'}</p>
      </div>
      <div class="tier-item__actions" style="display:flex; align-items:center; gap:12px;">
        <span class="tier-item__price" style="white-space:nowrap; flex-shrink:0; font-weight:700; font-family:var(--font-mono); color:#5CA47F; background:rgba(92, 164, 127, 0.12); border:1.5px solid rgba(92, 164, 127, 0.4); padding:5px 14px; border-radius:6px; font-size:0.88rem;">${r.price.toFixed(2)}€${r.type === 'per-kg' ? '/kg' : ' (Fijo)'}</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-action-edit" onclick="window.openEditRate('${r.id}')" title="Editar tramo" style="width:36px; height:36px; border-radius:8px; background:rgba(139, 127, 160, 0.12); border:1px solid rgba(139, 127, 160, 0.3); color:#A79DB8; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s ease;">
            <i data-lucide="pencil" style="width:15px;height:15px"></i>
          </button>
          <button type="button" class="action-btn-danger" onclick="window.deleteRate('${r.id}')" title="Eliminar tramo" style="width:36px; height:36px; border-radius:8px; background:rgba(217, 105, 92, 0.12); border:1px solid rgba(217, 105, 92, 0.35); color:#D9695C; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s ease;">
            <i data-lucide="trash-2" style="width:15px;height:15px"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    window.renderRatesList = renderRatesList;

    let activeRateId = null;
    window.openEditRate = id => {
      const r = StorageService.getRates().find(x => x.id === id);
      if (!r) return;
      activeRateId = r.id;
      document.getElementById('rate-modal-title').textContent = 'Editar Tramo de Peso';
      document.getElementById('rate-min').value = r.minWeight;
      document.getElementById('rate-max').value = r.maxWeight ?? '';
      document.getElementById('rate-type').value = r.type || 'per-kg';
      document.getElementById('rate-price').value = r.price;
      document.getElementById('rate-modal-overlay').classList.remove('hidden');
    };

    const showConfirmModal = ({ title, itemName, message, confirmText = 'Eliminar' }) => {
      return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-modal-overlay');
        const titleEl = document.getElementById('confirm-modal-title');
        const itemEl = document.getElementById('confirm-modal-item-name');
        const msgEl = document.getElementById('confirm-modal-message');
        const acceptBtn = document.getElementById('confirm-modal-accept');
        const cancelBtn = document.getElementById('confirm-modal-cancel');
        const closeX = document.getElementById('confirm-modal-close-x');

        if (!overlay) return resolve(window.confirm(`${title}\n\n${itemName || ''}\n\n${message || ''}`));

        if (titleEl) titleEl.textContent = title;
        if (itemEl) itemEl.textContent = itemName || '';
        if (msgEl) {
          msgEl.innerHTML = `<i data-lucide="shield-alert" style="width:14px;height:14px;flex-shrink:0;"></i> ${message || 'Esta acción no se puede deshacer.'}`;
        }
        if (acceptBtn) acceptBtn.textContent = confirmText;

        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
        if (window.lucide) lucide.createIcons({ nodes: [overlay] });

        const cleanUp = () => {
          overlay.classList.add('hidden');
          overlay.style.display = 'none';
        };

        const onAccept = (e) => { if (e) e.preventDefault(); cleanUp(); resolve(true); };
        const onCancel = (e) => { if (e) e.preventDefault(); cleanUp(); resolve(false); };

        acceptBtn.addEventListener('click', onAccept, { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });
        if (closeX) closeX.addEventListener('click', onCancel, { once: true });
      });
    };

    window.deleteRate = async id => {
      const rates = StorageService.getRates();
      const rateToDelete = rates.find(r => r.id === id);
      if (!rateToDelete) return;

      const label = rateToDelete.minWeight === 0 && rateToDelete.maxWeight === 5 && rateToDelete.type === 'fixed'
        ? 'Tramo Mínimo (0 a 5 kg)'
        : `Tramo de ${rateToDelete.minWeight} ${rateToDelete.maxWeight ? 'a ' + rateToDelete.maxWeight + ' kg' : 'kg en adelante'}`;

      const confirmed = await showConfirmModal({
        title: '¿Eliminar tramo de tarifa?',
        itemName: `"${label}" — ${rateToDelete.price.toFixed(2)}€${rateToDelete.type === 'per-kg' ? '/kg' : ''}`,
        message: 'Esta acción no se podrá deshacer.',
        confirmText: 'Eliminar Tarifa'
      });

      if (!confirmed) return;

      const filtered = rates.filter(r => r.id !== id);
      StorageService.saveRates(filtered);
      renderRatesList();
      EventBus.emit(EV.TOAST, { type: 'info', message: 'Tarifa eliminada con éxito.' });
    };

    document.getElementById('btn-add-rate')?.addEventListener('click', () => {
      activeRateId = null;
      document.getElementById('rate-form').reset();
      document.getElementById('rate-modal-title').textContent = 'Nuevo Tramo de Peso';
      document.getElementById('rate-modal-overlay').classList.remove('hidden');
    });

    document.getElementById('rate-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const min = parseFloat(document.getElementById('rate-min').value);
      const maxVal = document.getElementById('rate-max').value;
      const max = maxVal === '' ? null : parseFloat(maxVal);
      const type = document.getElementById('rate-type').value;
      const price = parseFloat(document.getElementById('rate-price').value);

      const rates = StorageService.getRates();
      if (activeRateId) {
        const idx = rates.findIndex(r => r.id === activeRateId);
        if (idx >= 0) {
          rates[idx] = { id: activeRateId, minWeight: min, maxWeight: max, type, price };
        }
      } else {
        rates.push({ id: 'r_' + Date.now(), minWeight: min, maxWeight: max, type, price });
      }

      StorageService.saveRates(rates);
      document.getElementById('rate-modal-overlay').classList.add('hidden');
      renderRatesList();
      EventBus.emit(EV.TOAST, { type: 'success', message: 'Tarifas actualizadas.' });
    });

    document.getElementById('rate-modal-close')?.addEventListener('click', () => {
      document.getElementById('rate-modal-overlay').classList.add('hidden');
    });
    document.getElementById('rate-modal-cancel')?.addEventListener('click', () => {
      document.getElementById('rate-modal-overlay').classList.add('hidden');
    });

    // ── NAVIGATION & VIEWS ────────────────────────────────────────
    function navigateTo(view) {
      // Limpiar cualquier estado previo de QR o Splash
      document.body.classList.remove('mobile-albaran-view');
      const splash = document.getElementById('mobile-qr-splash');
      if (splash) splash.style.display = 'none';

      const dashboard = document.getElementById('view-dashboard');
      if (dashboard) {
        dashboard.style.position = '';
        dashboard.style.top = '';
        dashboard.style.left = '';
        dashboard.style.width = '';
        dashboard.style.background = '';
        dashboard.style.color = '';
      }

      document.querySelectorAll('.view').forEach(v => {
        const vView = v.dataset.view || (v.id ? v.id.replace('view-', '') : '');
        const isMatch = (vView === view);
        if (isMatch) {
          v.classList.remove('hidden');
          v.style.display = 'block';
        } else {
          v.classList.add('hidden');
          v.style.display = 'none';
        }
      });

      document.querySelectorAll('.nav-item').forEach(n => {
        const isMatch = (n.dataset.view === view);
        n.classList.toggle('active', isMatch);
        n.setAttribute('aria-current', isMatch ? 'page' : 'false');
      });

      try {
        if (view === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
        if (view === 'form' && !editingId && typeof prepareCreate === 'function') prepareCreate();
        if (view === 'rates' && typeof renderRatesList === 'function') renderRatesList();
        if (view === 'stats' && typeof renderStats === 'function') renderStats();
        if (view === 'clients' && typeof renderClientsView === 'function') renderClientsView();
        if (view === 'history' && typeof renderHistoryView === 'function') renderHistoryView();
      } catch (err) {
        console.warn('[Navigation Render Warning]:', view, err);
      }

      closeMobileSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Exponer función de navegación al objeto global window
    window.navigateTo = navigateTo;



    // Event Delegation global para cambiar entre todas las secciones al hacer click en los botones del menú
    document.addEventListener('click', e => {
      const navBtn = e.target.closest('[data-view]');
      if (navBtn && !navBtn.classList.contains('view')) {
        const view = navBtn.dataset.view;
        if (view) {
          e.preventDefault();
          navigateTo(view);
        }
      }
    });

    document.getElementById('sidebar-brand')?.addEventListener('click', () => navigateTo('dashboard'));

    function closeMobileSidebar() {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('visible');
      const h = document.getElementById('hamburger-btn');
      h?.classList.remove('open'); h?.setAttribute('aria-expanded', 'false');
    }

    document.getElementById('hamburger-btn')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const hamburger = document.getElementById('hamburger-btn');
      
      const isOpen = sidebar?.classList.contains('open');
      if (isOpen) {
        closeMobileSidebar();
      } else {
        sidebar?.classList.add('open');
        overlay?.classList.add('visible');
        hamburger?.classList.add('open');
        hamburger?.setAttribute('aria-expanded', 'true');
      }
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

    // ── EXPORT CSV (EXCEL), EMAIL & PRINT EVENT LISTENERS ─────────
    document.getElementById('btn-export-csv')?.addEventListener('click', () => window.exportExcel());
    document.getElementById('btn-export-email')?.addEventListener('click', () => window.openEmailModal());
    document.getElementById('btn-print-report')?.addEventListener('click', () => window.printReport());

    // ── DESCARGA DIRECTA DE PDF AL ABRIR QR EN MÓVIL (PANTALLA OSCURA #0B0F19 CON LOGO) ───────
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get('action') || urlParams.get('mode') || urlParams.get('view');
    if (actionParam === 'download-pdf' || actionParam === 'pdf' || actionParam === 'albaran') {
      document.body.classList.add('mobile-albaran-view');
      const splash = document.getElementById('mobile-qr-splash');
      if (splash) splash.style.display = 'flex';

      // Cargar datos en memoria
      renderDashboard();

      // Colocar la vista del albarán fuera de pantalla para captura invisible por html2pdf
      const dashboard = document.getElementById('view-dashboard');
      if (dashboard) {
        dashboard.style.position = 'fixed';
        dashboard.style.top = '-9999px';
        dashboard.style.left = '-9999px';
        dashboard.style.width = '800px';
        dashboard.style.background = '#FFFFFF';
        dashboard.style.color = '#000000';
        dashboard.classList.remove('hidden');
        document.querySelectorAll('.albaran-only-print').forEach(el => el.style.display = 'block');
      }

      setTimeout(() => {
        exportAlbaranPDFDirectly();
      }, 350);
    }

    function exportAlbaranPDFDirectly() {
      const element = document.getElementById('view-dashboard');
      if (!element) return;

      const now = new Date();
      const dateId = `LIQ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      if (typeof window.html2pdf !== 'undefined') {
        const opt = {
          margin:       [6, 8, 6, 8],
          filename:     `Albaran_${dateId}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(element).outputPdf('blob').then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          
          // Abrir el visor PDF del teléfono de inmediato
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `Albaran_${dateId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => {
            window.location.href = blobUrl;
          }, 300);

          const status = document.getElementById('mobile-qr-status');
          if (status) {
            status.innerHTML = `<span style="color:#4ADE80;font-size:1.1rem;font-weight:900;">✓</span> <span style="color:#F8FAFC;">Albarán PDF Listo</span>`;
          }
        }).catch(err => {
          console.error('[PDF Export Error]:', err);
          window.print();
        });
      } else {
        window.print();
      }
    }

    // (EventListener de btn-print-report gestionado centralizadamente en línea 1503 mediante window.printReport)

    // ── LIMPIAR FINDE (NUEVA SESIÓN) ──────────────────────────────
    let isClearingSession = false;
    document.getElementById('dashboard-reset-session')?.addEventListener('click', () => {
      isClearingSession = true;
      document.getElementById('confirm-title-text').textContent = '¿Limpiar fin de semana?';
      document.getElementById('confirm-body-text').textContent = 'Esto archivará y vaciará todos los paquetes actuales para comenzar un nuevo fin de semana.';
      document.getElementById('confirm-overlay').classList.remove('hidden');
    });

    // ── CONFIRM DIALOG HANDLER ────────────────────────────────────
    document.getElementById('confirm-cancel')?.addEventListener('click', closeConfirm);
    document.getElementById('confirm-delete')?.addEventListener('click', () => {
      if (isClearingSession) {
        StorageService.savePackages([]);
        renderDashboard();
        EventBus.emit(EV.TOAST, { type: 'info', message: '🧹 Finde limpiado. Listo para nueva sesión.' });
        isClearingSession = false;
      } else if (deleteTargetId) {
        const idToDelete = deleteTargetId;
        const pkgs = StorageService.getPackages().filter(p => p.id !== idToDelete);
        StorageService.savePackages(pkgs);
        SupabaseService.deletePackage(idToDelete);
        renderDashboard();
        EventBus.emit(EV.TOAST, { type: 'info', message: '🗑 Registro eliminado.' });
        deleteTargetId = null;
      }
      closeConfirm();
    });
    function closeConfirm() {
      document.getElementById('confirm-overlay').classList.add('hidden');
      deleteTargetId = null;
      isClearingSession = false;
    }

    // ── SUPABASE MODAL & SETTINGS BINDINGS ────────────────────────
    window.openSupaModal = function() {
      const creds = SupabaseService.getCredentials();
      const u = document.getElementById('supa-url');
      const k = document.getElementById('supa-key');
      if (u) u.value = creds.url;
      if (k) k.value = creds.key;

      const o = document.getElementById('gemini-key');
      const r = document.getElementById('resend-key');
      const e = document.getElementById('default-email');
      const w = document.getElementById('openweather-key');

      if (o) o.value = geminiService.getApiKey();
      if (r) r.value = emailService.getApiKey();
      if (e) e.value = emailService.getDefaultEmail();
      if (w) w.value = weatherService.getApiKey();

      _renderOcrSuggestions();
      document.getElementById('supa-modal-overlay')?.classList.remove('hidden');
    };

    // ── SUGERENCIAS DE MEJORA DE OCR (agente semanal) ──────────────
    async function _renderOcrSuggestions() {
      const section = document.getElementById('ocr-suggestions-section');
      const container = document.getElementById('ocr-suggestions-container');
      if (!section || !container) return;

      const suggestions = await SupabaseService.fetchPendingPromptSuggestions();
      if (!suggestions || suggestions.length === 0) {
        section.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      section.style.display = '';
      container.innerHTML = suggestions.map(s => `
        <div class="ocr-suggestion-card" style="background:var(--bg-base);border:1px solid rgba(212,166,76,0.35);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;">
          <p style="font-size:0.8rem;color:var(--text-secondary);margin:0 0 8px 0;white-space:pre-wrap;">${_esc(s.summary || 'Sin resumen.')}</p>
          <details style="margin-bottom:10px;">
            <summary style="cursor:pointer;font-size:0.75rem;color:var(--text-muted);">Ver prompt completo sugerido</summary>
            <pre style="font-size:0.7rem;background:rgba(0,0,0,0.3);padding:10px;border-radius:4px;overflow-x:auto;color:#D4A64C;line-height:1.3;white-space:pre-wrap;">${_esc(s.prompt_text)}</pre>
          </details>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn--sm btn--primary" onclick="window.applyOcrSuggestion(${s.id})">✅ Aplicar mejora</button>
            <button type="button" class="btn btn--sm btn--ghost" onclick="window.discardOcrSuggestion(${s.id})">✖ Descartar</button>
          </div>
        </div>
      `).join('');
    }

    window.applyOcrSuggestion = async id => {
      const suggestions = await SupabaseService.fetchPendingPromptSuggestions();
      const suggestion = suggestions.find(s => s.id === id);
      if (!suggestion) return;
      const ok = await SupabaseService.applyPromptSuggestion(suggestion);
      EventBus.emit(EV.TOAST, ok
        ? { type: 'success', message: '✨ Prompt de OCR actualizado. Ya se usa en el próximo escaneo.' }
        : { type: 'error', message: '❌ No se pudo aplicar la mejora. Revisa la conexión a Supabase.' });
      _renderOcrSuggestions();
    };

    window.discardOcrSuggestion = async id => {
      await SupabaseService.discardPromptSuggestion(id);
      EventBus.emit(EV.TOAST, { type: 'info', message: '🗑 Sugerencia descartada.' });
      _renderOcrSuggestions();
    };
    document.getElementById('supa-status-badge')?.addEventListener('click', window.openSupaModal);

    const closeSupaModal = () => document.getElementById('supa-modal-overlay').classList.add('hidden');
    document.getElementById('supa-modal-close')?.addEventListener('click', closeSupaModal);
    document.getElementById('supa-modal-cancel')?.addEventListener('click', closeSupaModal);

    document.getElementById('supa-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const url = document.getElementById('supa-url')?.value.trim() || '';
      const key = document.getElementById('supa-key')?.value.trim() || '';

      const geminiKey = document.getElementById('gemini-key')?.value.trim() || '';
      const resendKey = document.getElementById('resend-key')?.value.trim() || '';
      const defaultEmail = document.getElementById('default-email')?.value.trim() || '';
      const openweatherKey = document.getElementById('openweather-key')?.value.trim() || '';

      localStorage.setItem('nc_caliman_supa_url', url);
      localStorage.setItem('nc_caliman_supa_key', key);

      geminiService.setApiKey(geminiKey);
      emailService.setApiKey(resendKey);
      emailService.setDefaultEmail(defaultEmail);
      weatherService.setApiKey(openweatherKey);

      SupabaseService.init();
      EventBus.emit(EV.TOAST, { type: 'success', message: '⚙️ Configuración y claves guardadas con éxito.' });
      closeSupaModal();
      renderRouteWeather();
    });

    // Auto-init Supabase en el arranque
    SupabaseService.init();

    // ── CONVERTIDOR ASÍNCRONO BLOB A BASE64 (SIN BLOQUEO DE CPU) ──────
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result || '';
          const base64 = res.substring(res.indexOf(',') + 1);
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // ── CONVERTIDORES LOCALES DE IMÁGENES (EVITAN CORRUPCIÓN CORS DEL LIENZO) ──────
    function imageToDataURL(url, forceBlack = false) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const w = img.naturalWidth || img.width || 100;
            const h = img.naturalHeight || img.height || 100;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            if (forceBlack) {
              const imgData = ctx.getImageData(0, 0, w, h);
              const data = imgData.data;
              for (let i = 0; i < data.length; i += 4) {
                // Si el píxel no es completamente transparente, forzar a negro sólido (RGB 0,0,0)
                if (data[i + 3] > 20) {
                  data[i] = 0;       // R
                  data[i + 1] = 0;   // G
                  data[i + 2] = 0;   // B
                  data[i + 3] = 255; // Alpha
                }
              }
              ctx.putImageData(imgData, 0, 0);
            }

            resolve({
              dataUrl: canvas.toDataURL('image/png'),
              ratio: w / h,
              width: w,
              height: h
            });
          } catch (e) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    function createInlineQRCodeDataURI(text) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#FFFFFF"/>
        <rect x="15" y="15" width="50" height="50" fill="none" stroke="#000000" stroke-width="6"/>
        <rect x="27" y="27" width="26" height="26" fill="#000000"/>
        <rect x="135" y="15" width="50" height="50" fill="none" stroke="#000000" stroke-width="6"/>
        <rect x="147" y="27" width="26" height="26" fill="#000000"/>
        <rect x="15" y="135" width="50" height="50" fill="none" stroke="#000000" stroke-width="6"/>
        <rect x="27" y="147" width="26" height="26" fill="#000000"/>
        <rect x="80" y="20" width="12" height="12" fill="#000000"/>
        <rect x="100" y="20" width="12" height="12" fill="#000000"/>
        <rect x="80" y="40" width="24" height="12" fill="#000000"/>
        <rect x="20" y="80" width="12" height="24" fill="#000000"/>
        <rect x="40" y="90" width="24" height="12" fill="#000000"/>
        <rect x="80" y="80" width="40" height="40" fill="#000000"/>
        <rect x="135" y="80" width="16" height="16" fill="#000000"/>
        <rect x="160" y="90" width="20" height="20" fill="#000000"/>
        <rect x="80" y="135" width="16" height="16" fill="#000000"/>
        <rect x="110" y="140" width="24" height="12" fill="#000000"/>
        <rect x="145" y="145" width="30" height="30" fill="#000000"/>
      </svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    // ── GENERADOR DE ALBARÁN PDF VECTORIAL EXACTO A LA IMAGEN (0% BLANCO, 100% IDÉNTICO) ─────
    async function generateAlbaranPDFBase64() {
      const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || (window.jspdf && window.jspdf.default);
      if (!jsPDFClass) {
        throw new Error('La librería jsPDF no está disponible en el navegador. Por favor recarga la página.');
      }

      if (typeof renderDashboard === 'function') renderDashboard();

      const pkgs = getActivePackagesOrDOM();
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES');
      const dateId = `LIQ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Albaran_${dateId}.pdf`;

      const totalBultos = pkgs.reduce((s, p) => s + (parseInt(p.bultos) || 1), 0);
      const totalWeight = pkgs.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0);
      const totalMoney = pkgs.reduce((s, p) => {
        const w = parseFloat(p.weight) || 0;
        const price = (p.price !== undefined && p.price !== null && !isNaN(parseFloat(p.price)) && parseFloat(p.price) > 0)
          ? parseFloat(p.price)
          : ((typeof CalculatorService !== 'undefined' && CalculatorService.calculatePrice) ? CalculatorService.calculatePrice(w) : (w > 5 ? w * 2.0 : 10.0));
        return s + price;
      }, 0);

      // Cargar imágenes de Logo en Negro Puro y QR en formato Base64 para jsPDF
      const qrUrl = document.getElementById('albaran-qr-img')?.src || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=6&data=${encodeURIComponent('https://nccaliman-logistics.com/verify?id=' + dateId)}`;
      const logoUrl = document.querySelector('.albaran-logo-img')?.src || './assets/logo_van_badge_trimmed.png';

      let logoObj = null;
      let qrObj = null;
      try {
        logoObj = await imageToDataURL(logoUrl, true);
      } catch (e) {}
      try {
        qrObj = await imageToDataURL(qrUrl, false);
      } catch (e) {}

      // Documento PDF A4 portrait (210mm x 297mm)
      const doc = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Marca de agua del logo, muy tenue — se repite en cada página nueva del documento.
      // Si el navegador no soporta GState (opacidad), se omite en vez de dibujarse opaca.
      function drawWatermark() {
        if (!logoObj || !logoObj.dataUrl || !doc.GState) return;
        try {
          const wmWidth = 130;
          const wmHeight = wmWidth / (logoObj.ratio || 1.45);
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: 0.05 }));
          doc.addImage(logoObj.dataUrl, 'PNG', 105 - wmWidth / 2, 148.5 - wmHeight / 2, wmWidth, wmHeight, undefined, undefined, -24);
          doc.restoreGraphicsState();
        } catch (e) {}
      }
      drawWatermark();

      // ── 1. CABECERA Y METADATOS ─────────────────────────────────
      let startX = 14;
      if (logoObj && logoObj.dataUrl) {
        try {
          const logoHeight = 14.5;
          const logoWidth = logoHeight * (logoObj.ratio || 1.45);
          doc.addImage(logoObj.dataUrl, 'PNG', 14, 10, logoWidth, logoHeight);
          startX = 14 + logoWidth + 3.5;
        } catch (e) {
          startX = 14;
        }
      }

      // Título y subtítulos
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      doc.text('NC CALIMAN LOGISTICS', startX, 15);
      const titleWidth = doc.getTextWidth('NC CALIMAN LOGISTICS');
      doc.setDrawColor(139, 127, 160);
      doc.setLineWidth(0.7);
      doc.line(startX, 16.7, startX + titleWidth, 16.7);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ALBARÁN DE LIQUIDACIÓN DE TRANSPORTE Y PAQUETERÍA', startX, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Control Oficial de Expediciones y Reparto de Fin de Semana', startX, 24);

      // Recuadro Metadatos (Derecha) — acento mauve de marca
      doc.setDrawColor(139, 127, 160);
      doc.setLineWidth(0.4);
      doc.setFillColor(245, 242, 247);
      doc.rect(136, 9, 60, 18, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('FECHA DE EMISIÓN:', 139, 14);
      doc.setFont('helvetica', 'normal');
      doc.text(dateStr, 193, 14, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('N.º ALBARÁN:', 139, 19);
      doc.setFont('courier', 'bold');
      doc.text(dateId, 193, 19, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ESTADO:', 139, 24);
      // Sello "CONFIRMADO" con borde — mismo lenguaje visual que los badges de estado de la app
      doc.setDrawColor(92, 164, 127);
      doc.setLineWidth(0.35);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(178, 21.3, 15, 3.6, 0.5, 0.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      doc.setTextColor(62, 124, 98);
      doc.text('CONFIRMADO', 185.5, 23.7, { align: 'center' });

      // Línea divisoria principal — acento mauve de marca (papel carbón)
      doc.setDrawColor(139, 127, 160);
      doc.setLineWidth(0.8);
      doc.line(14, 30, 196, 30);

      // ── 2. SECCIÓN 1: KPIS ──────────────────────────────────────
      let y = 34;
      // Header de Sección
      doc.setFillColor(241, 238, 244); // mauve muy pálido
      doc.setDrawColor(139, 127, 160);
      doc.setLineWidth(0.4);
      doc.rect(14, y, 182, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('1. RESUMEN GENERAL DE LIQUIDACIÓN (KPIS)', 17, y + 4.2);

      y += 8.5; // Separación limpia respecto a la barra de título 1.

      // Cabecera Tabla KPIs (Fondo Negro)
      doc.setFillColor(0, 0, 0);
      doc.rect(14, y, 182, 6, 'F');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('CONCEPTO / MÉTRICA DE RUTA', 65, y + 4, { align: 'center' });
      doc.text('VALOR TOTAL', 190, y + 4, { align: 'right' });

      y += 6;

      // Filas KPIs
      const kpis = [
        { title: '1. ENVÍOS REGISTRADOS:', desc: ' Total acumulado de bultos y expediciones procesadas', value: `${totalBultos} bultos / envíos` },
        { title: '2. CARGA TOTAL (KG):', desc: ' Peso bruto total registrado en la balanza de transporte', value: `${Number(totalWeight).toFixed(1)} kg` },
        { title: '3. TOTAL RECAUDADO (€):', desc: ' Importe económico total cobrado en la liquidación', value: `${Number(totalMoney).toFixed(2)} €` }
      ];

      kpis.forEach((kpi) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(14, y, 182, 6, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.rect(14, y, 130, 6, 'S');
        doc.rect(144, y, 52, 6, 'S');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(kpi.title, 16, y + 4);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(kpi.desc, 50, y + 4);

        doc.setFont('courier', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(kpi.value, 193, y + 4, { align: 'right' });

        y += 6;
      });

      y += 5.5; // Separación antes de la sección 2

      // ── 3. SECCIÓN 2: DESGLOSE DE PAQUETES ─────────────────────
      doc.setFillColor(241, 238, 244);
      doc.setDrawColor(139, 127, 160);
      doc.rect(14, y, 182, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('2. DESGLOSE DETALLADO DE PAQUETES EN LIQUIDACIÓN', 17, y + 4.2);

      y += 8.5; // Separación limpia respecto a la barra de título 2.

      // Cabecera Tabla Paquetes (Negra)
      doc.setFillColor(0, 0, 0);
      doc.rect(14, y, 182, 6, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);

      doc.text('DESTINATARIO', 28, y + 4, { align: 'center' });
      doc.text('LOCALIDAD DEST.', 63, y + 4, { align: 'center' });
      doc.text('BULTOS', 98, y + 4, { align: 'center' });
      doc.text('PESO (KG)', 118, y + 4, { align: 'center' });
      doc.text('EXPEDIDOR', 142, y + 4, { align: 'center' });
      doc.text('LOCALIDAD EXP.', 175, y + 4, { align: 'center' });

      y += 6;

      // Anchuras de columnas: 38, 35, 18, 22, 36, 33 = 182mm
      pkgs.forEach((pkg) => {
        if (y > 250) {
          doc.addPage();
          drawWatermark();
          y = 15;
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0, 0, 0);

        // Dibujar celdas individuales con bordes negros idénticos a la imagen
        doc.rect(14, y, 38, 6, 'FD');
        doc.rect(52, y, 35, 6, 'FD');
        doc.rect(87, y, 18, 6, 'FD');
        doc.rect(105, y, 22, 6, 'FD');
        doc.rect(127, y, 36, 6, 'FD');
        doc.rect(163, y, 33, 6, 'FD');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        doc.text(String(pkg.destinatario || '-').substring(0, 22), 33, y + 4, { align: 'center' });
        doc.text(String(pkg.localidadDestinatario || '-').substring(0, 18), 69.5, y + 4, { align: 'center' });

        doc.setFont('courier', 'bold');
        doc.text(String(pkg.bultos || '1'), 96, y + 4, { align: 'center' });
        doc.text(Number(pkg.weight || 0).toFixed(0), 116, y + 4, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.text(String(pkg.expedidor || '-').substring(0, 20), 145, y + 4, { align: 'center' });
        doc.text(String(pkg.localidadExpedidor || '-').substring(0, 18), 179.5, y + 4, { align: 'center' });

        y += 6;
      });

      y += 5.5; // Separación antes de la sección 3.

      // ── 4. SECCIÓN 3: CONTROL OPERATIVO Y VERIFICACIÓN ─────────
      if (y > 230) {
        doc.addPage();
        drawWatermark();
        y = 15;
      }

      doc.setFillColor(241, 238, 244);
      doc.setDrawColor(139, 127, 160);
      doc.rect(14, y, 182, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('3. CONTROL OPERATIVO Y VERIFICACIÓN DIGITAL', 17, y + 4.2);

      y += 8.5;

      // Box Observaciones (Izquierda: 144mm de ancho)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(139, 127, 160);
      doc.setLineWidth(0.4);
      doc.rect(14, y, 144, 25, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('OBSERVACIONES & CONTROL DE EXPEDICIÓN:', 17, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      const obsText = 'Todas las mercancías detalladas en este albarán han sido inspeccionadas, pesadas en báscula calibrada y confirmadas para la liquidación correspondiente a la ruta. Documento válido como justificante oficial de caja y liquidación de repartos.';
      const splitObs = doc.splitTextToSize(obsText, 138);
      doc.text(splitObs, 17, y + 9.5);

      // Box QR (Derecha: 35mm de ancho) — Fondo Blanco Puro (255, 255, 255)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(139, 127, 160);
      doc.setLineWidth(0.4);
      doc.rect(161, y, 35, 25, 'FD');

      const qrDataUrl = qrObj ? (qrObj.dataUrl || qrObj) : null;
      if (qrDataUrl) {
        try {
          doc.addImage(qrDataUrl, 'PNG', 171.25, y + 1.5, 14.5, 14.5);
        } catch (e) {}
      }

      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('VERIFICACIÓN DIGITAL', 178.5, y + 19.4, { align: 'center' });
      doc.setFontSize(5.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(dateId, 178.5, y + 22.6, { align: 'center' });

      y += 29;

      // Línea divisoria pie de página
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(14, y, 196, y);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('© 2026 NC Caliman Logistics — Todos los derechos reservados.', 105, y + 4, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text('Documento de control interno generado automáticamente para la gestión de liquidación de paquetería.', 105, y + 7.5, { align: 'center' });

      // Extraer Base64
      const dataUri = doc.output('datauristring');
      if (!dataUri || !dataUri.includes('base64,')) {
        throw new Error('La generación del DataURI del albarán ha fallado.');
      }

      const pdfBase64 = dataUri.substring(dataUri.indexOf('base64,') + 7);
      return { pdfBase64, filename };
    }

    window.printReport = function printReport() {
      if (typeof renderDashboard === 'function') renderDashboard();
      const originalTitle = document.title;
      document.title = '';
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 500);
    };

    // ── EMAIL MODAL & RESEND API HANDLERS ─────────────────────────
    window.closeEmailModal = function closeEmailModal() {
      const emailModal = document.getElementById('email-modal-overlay');
      if (emailModal) {
        emailModal.classList.add('hidden');
        emailModal.style.display = 'none';
      }
    };

    document.getElementById('btn-export-email')?.addEventListener('click', () => window.openEmailModal());
    document.getElementById('email-modal-close')?.addEventListener('click', () => window.closeEmailModal());
    document.getElementById('email-modal-cancel')?.addEventListener('click', () => window.closeEmailModal());

    document.getElementById('email-send-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const toEmail = document.getElementById('send-to-email')?.value.trim();
      const customSubject = document.getElementById('send-email-subject')?.value.trim() || null;

      if (!toEmail) return;

      if (!emailService.hasApiKey()) {
        EventBus.emit(EV.TOAST, { type: 'warning', message: '⚠️ Falta configurar la Resend API Key en Ajustes.' });
        window.openSupaModal();
        return;
      }

      const submitBtn = document.getElementById('email-modal-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Generando PDF...';
      }

      try {
        const pkgs = getActivePackagesOrDOM();
        const totalBultos = pkgs.reduce((s, p) => s + (parseInt(p.bultos) || 1), 0);
        const totalWeight = pkgs.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0);
        const totalMoney = pkgs.reduce((s, p) => {
          const w = parseFloat(p.weight) || 0;
          const price = (p.price !== undefined && p.price !== null && !isNaN(parseFloat(p.price)) && parseFloat(p.price) > 0)
            ? parseFloat(p.price)
            : ((typeof CalculatorService !== 'undefined' && CalculatorService.calculatePrice) ? CalculatorService.calculatePrice(w) : (w > 5 ? w * 2.0 : 10.0));
          return s + price;
        }, 0);

        const pdfResult = await generateAlbaranPDFBase64();
        if (!pdfResult || !pdfResult.pdfBase64) {
          throw new Error('La generación del documento PDF del albarán ha fallado.');
        }

        if (submitBtn) {
          submitBtn.innerHTML = '📤 Enviando correo...';
        }

        await emailService.sendLiquidationReport({
          toEmail,
          packages: pkgs,
          totalMoney,
          totalWeight,
          totalBultos,
          pdfBase64: pdfResult.pdfBase64,
          pdfFilename: pdfResult.filename,
          customSubject: customSubject
        });

        emailService.setDefaultEmail(toEmail);

        EventBus.emit(EV.TOAST, { type: 'success', message: `📧 Albarán PDF y CSV enviados con éxito a ${toEmail}` });
        closeEmailModal();
      } catch (err) {
        console.error('[Email Send Error]:', err);
        EventBus.emit(EV.TOAST, { type: 'error', message: `❌ Error al enviar email: ${err.message}` });
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i data-lucide="send" style="width:16px;height:16px"></i> Enviar Albarán Ahora';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      }
    });

    // ── WEATHER SERVICE & CITY MANAGEMENT HANDLERS ────────────────
    const weatherModal = document.getElementById('weather-modal-overlay');
    const closeWeatherModal = () => weatherModal?.classList.add('hidden');

    document.getElementById('btn-manage-weather-cities')?.addEventListener('click', () => {
      renderWeatherCitiesList();
      weatherModal?.classList.remove('hidden');
    });

    document.getElementById('weather-modal-close')?.addEventListener('click', closeWeatherModal);
    document.getElementById('weather-modal-done')?.addEventListener('click', () => {
      closeWeatherModal();
      renderRouteWeather();
    });

    document.getElementById('weather-add-city-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const input = document.getElementById('weather-new-city-input');
      const cityName = input?.value?.trim();
      if (!cityName) return;

      try {
        EventBus.emit(EV.TOAST, { type: 'info', message: `🔍 Buscando coordenadas para "${cityName}"...` });
        await weatherService.addCityByName(cityName);
        input.value = '';
        renderWeatherCitiesList();
        renderRouteWeather();
        EventBus.emit(EV.TOAST, { type: 'success', message: `📍 Ciudad "${cityName}" añadida a la ruta.` });
      } catch (err) {
        EventBus.emit(EV.TOAST, { type: 'error', message: err.message });
      }
    });

    function renderWeatherCitiesList() {
      const listEl = document.getElementById('weather-cities-list');
      if (!listEl) return;
      const cities = weatherService.getCities();

      listEl.innerHTML = cities.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-elevated); border-radius:8px; border:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
          <span style="font-size:0.85rem; font-weight:700; color:#F7F4EC;">📍 ${c.name} ${c.country ? `(${c.country})` : ''}</span>
          <button type="button" class="btn btn--ghost btn--sm remove-city-btn" data-city="${c.name}" style="padding:4px 8px; color:#D9695C;" title="Eliminar ciudad de la ruta">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </div>
      `).join('');

      listEl.querySelectorAll('.remove-city-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.city;
          weatherService.removeCity(name);
          renderWeatherCitiesList();
          renderRouteWeather();
          EventBus.emit(EV.TOAST, { type: 'info', message: `Ciudad "${name}" eliminada de la ruta.` });
        });
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async function renderRouteWeather() {
      if (typeof window.updateMapWeather === 'function') {
        window.updateMapWeather();
      }
      const gridEl = document.getElementById('weather-cities-grid');
      if (!gridEl) return;

      gridEl.innerHTML = '<div style="font-size:0.8rem; color:#B9C0D4; padding:8px;">⏳ Cargando clima de la ruta...</div>';

      try {
        const weatherData = await weatherService.getRouteWeather();
        gridEl.innerHTML = weatherData.map(item => `
          <div style="background:var(--bg-elevated); border:1px solid ${item.isWarning ? 'rgba(217,105,92,0.55)' : 'rgba(255,255,255,0.1)'}; border-radius:8px; padding:8px 10px; text-align:center;">
            <div style="font-size:0.75rem; font-weight:700; color:#F7F4EC; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.city}</div>
            <div style="font-size:1.1rem; font-weight:700; color:${item.isWarning ? '#D9695C' : '#7FA5CC'}; margin:2px 0;">${item.icon} ${item.temp}°C</div>
            <div style="font-size:0.68rem; color:#B9C0D4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.description}</div>
            <div style="font-size:0.65rem; color:#B9C0D4; margin-top:2px;">💨 ${item.windKm} km/h</div>
          </div>
        `).join('');
      } catch (err) {
        console.error('[Weather Render Error]:', err);
        gridEl.innerHTML = '<div style="font-size:0.75rem; color:#D9695C;">⚠️ No se pudo obtener el clima de la ruta.</div>';
      }
    }

    // Inicializar el clima en ruta
    renderRouteWeather();

    // ── STATIC BINDS ──────────────────────────────────────────────
    document.getElementById('dashboard-new-btn')?.addEventListener('click', () => navigateTo('form'));
    document.getElementById('mobile-header-brand')?.addEventListener('click', () => navigateTo('dashboard'));
    document.getElementById('sidebar-brand')?.addEventListener('click', () => navigateTo('dashboard'));
    document.getElementById('widget-edit-rates-btn')?.addEventListener('click', () => navigateTo('rates'));
    document.getElementById('empty-new-btn')?.addEventListener('click', () => navigateTo('form'));
    document.getElementById('form-cancel-btn')?.addEventListener('click', () => navigateTo('dashboard'));
    document.getElementById('form-reset-btn')?.addEventListener('click', prepareCreate);
    document.getElementById('modal-close')?.addEventListener('click', () => {
      document.getElementById('modal-overlay').classList.add('hidden');
    });

    // Escape cierra cualquier modal/overlay abierto (incluido el mapa a pantalla completa)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const fullscreenMap = document.getElementById('map-fullscreen-modal');
      if (fullscreenMap?.classList.contains('active')) {
        fullscreenMap.classList.remove('active');
        fullscreenMap.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        return;
      }
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(overlay => {
        overlay.classList.add('hidden');
      });
    });

    // Nav sidebar items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const v = item.dataset.view;
        if (v) navigateTo(v);
      });
    });

    // ── ROUTES DATABASE (ROMANIA) ──────────────────────────────────
    const romaniaRoutes = [
  // ===================== MIÉRCOLES =====================
  // TEL. 0799 760 575
  { day: 'Miércoles', phone: '0799 760 575', color: 'var(--accent-red)', loc: 'TIMISOARA', time: '16:15', place: 'CALEA LUGOJULUI BENZINARIA BARON GRUP' },
  { day: 'Miércoles', phone: '0799 760 575', color: 'var(--accent-red)', loc: 'ARAD', time: '19:00', place: 'BENZINARIA PETROM MICALACA' },
  
  // TEL. 0755 121 430
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'ORASTIE', time: '13:00', place: 'FAM. BOGDAN STR.MIHAI EMINESCU NR. 6' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'DEVA', time: '14:00', place: 'STR. G. ENESCU BL. 3 AP. 42 GAZDA TEL 0724 530 011' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'LUGOJ', time: '16:00', place: 'BISERICA CU DOUA TURNURI' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'RESITA', time: '18:30', place: 'STR. FAGARAS - PARCARE PRIMUL BLOC BULEVARDUL REPUBLICII - ALEEA DACIA TEL. 0760 091 100' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'CARANSEBES', time: '19:30', place: 'LA GARA' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'OTELUL ROSU', time: '20:00', place: 'INTERSECTIA CENTRU' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'HATEG', time: '21:15', place: 'IN PARC LANGA BRD' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'HUNEDOARA', time: '22:00', place: 'HALA OBOR' },
  { day: 'Miércoles', phone: '0755 121 430', color: 'var(--accent-red)', loc: 'CALAN', time: '22:30', place: 'LA AUTOGARA' },

  // TEL. 0755 121 433
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'MIHALT', time: '14:45', place: 'BISERICA' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'CRACIUNELUL DE JOS', time: '15:00', place: 'LA BISERICA DIN CENTRU' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'BLAJ', time: '15:15', place: 'PIATA MARE' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'TEIUS', time: '15:45 / 22:00', place: 'LUKOIL' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'AIUD', time: '17:00', place: 'VIS-A-VIS DE POLITIE' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'UNIREA', time: '17:30', place: 'INTERSECTIA CU TURDA' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'HANUL PESCARILOR', time: '18:00', place: 'LA HAN' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'LUNCANI', time: '18:15', place: 'LA LUNA (LANGA CHIOSC)' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'CAMPIA TURZII', time: '18:45', place: 'IN PIATA MICA' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'TURDA', time: '19:30', place: 'PENY MARKET STATIA DE POMPIERI' },
  { day: 'Miércoles', phone: '0755 121 433', color: 'var(--accent-red)', loc: 'CLUJ', time: '20:30', place: 'IN FATA CAPELEI SF. IOSIF (PIATA CIPARIU)' },

  // TEL 0747 083 789
  { day: 'Miércoles', phone: '0747 083 789', color: 'var(--accent-red)', loc: 'MIERCUREA SIBIULUI', time: '16:15', place: 'PARCARE RESTAURANT' },
  { day: 'Miércoles', phone: '0747 083 789', color: 'var(--accent-red)', loc: 'SALISTE', time: '16:30', place: 'BENZINARIA ARAL' },
  { day: 'Miércoles', phone: '0747 083 789', color: 'var(--accent-red)', loc: 'SIBIU', time: '17:30', place: 'IN SPATE LA SCANDIA, LANGA ROMPETROL' },
  { day: 'Miércoles', phone: '0747 083 789', color: 'var(--accent-red)', loc: 'AGNITA', time: '19:15', place: 'LA DOLCE VITA' },
  { day: 'Miércoles', phone: '0747 083 789', color: 'var(--accent-red)', loc: 'SIGHISOARA', time: '20:30', place: 'IN FATA LA SPITAL' },
  { day: 'Miércoles', phone: '0747 083 789', color: 'var(--accent-red)', loc: 'MEDIAS', time: '21:15', place: 'PARCARE GARA' },

  // TEL. 0755 121 429
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'CAMPENI', time: '15:30', place: 'PENY MARKET' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'ABRUD', time: '16:00', place: 'LA POSTA' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'ZLATNA', time: '16:45', place: 'PARCARE CEC' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'FENES', time: '17:15', place: 'VIS-A-VIS DE POSTA' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'IGHIU', time: '17:40', place: 'LA INTERSECTIE (AVIZ TELEFONIC)' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'ALBA-IULIA', time: '18:00', place: 'PENY MARKET' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'VINTUL DE JOS', time: '19:00', place: 'IN FATA LA PARC (CENTRU)' },
  { day: 'Miércoles', phone: '0755 121 429', color: 'var(--accent-red)', loc: 'CUGIR', time: '19:30', place: 'PARCARE VISAVI COLEGIU DAVID PRODAN' },

  // ===================== JUEVES =====================
  // TEL. 0747 015 894
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'FAGARAS', time: '05:00', place: 'IN FATA LA PRIMARIE' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'BRASOV', time: '06:15', place: 'LA HOTEL ARO' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'PREDEAL', time: '07:00', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'AZUGA', time: '07:10', place: 'LUKOIL' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'BUSTENI', time: '07:15', place: 'FOSTA FABRICA DE HARTIE' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'SINAIA', time: '07:30', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'COMARNIC', time: '07:45', place: 'LA VULTURUL (LA PIATA)' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'BANESTI', time: '08:30', place: 'LA AVION' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'PLOIESTI', time: '09:30', place: 'LA FOSTUL POLIGON SCOALA DE SOFERI KM 5' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'BUCURESTI', time: '12:30', place: 'GARA DE NORD LA COLOANE' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'PITESTI', time: '15:30', place: 'HOTEL MUNTENIA' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'CURTEA DE ARGES', time: '17:00', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 015 894', color: 'var(--accent-amber)', loc: 'RAMNICUL VALCEA', time: '18:00', place: 'RESTAURANT MILENIUM STRADA-DORU POPIAN' },

  // TEL. 0747 015 926
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'URZICENI', time: '09:00', place: 'PETROM - SOS BUCURESTI' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'SLOBOZIA', time: '10:15', place: 'HOTEL PARADIS' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'TANDAREI', time: '11:00', place: 'PARCARE B C R' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'HARSOVA', time: '11:30', place: 'LA JUDECATORIE' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'TULCEA', time: '13:00', place: 'HOTEL DELTA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'TULCEA', time: '13:00', place: 'STR. MAIOR ANDREI GRIGORE NR 19A TEL. 0744 867 654' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'BABADAG', time: '14:30', place: 'LA BISERICA TURCEASCA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'LUMINA', time: '16:00', place: 'MAGAZINUL DE MOBILA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'NOVADARI', time: '16:15', place: 'PARCARE TREI MAGARI' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'OVIDIU', time: '16:30', place: 'VIS-A-VIS DE VULCANIZARE' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'CONSTANTA', time: '17:15', place: 'LA PARCARE GARA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'BASARABI', time: '18:30', place: 'LA MINI MARKET' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'MEDGIDIA', time: '19:00', place: 'PETROM-LA IESIRE SPRE CONSTANTA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'CERNAVODA', time: '19:30', place: 'INTRARE AUTOSTRADA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'FETESTI', time: '20:00', place: 'LA IESIRE SPRE AUTOSTRADA' },
  { day: 'Jueves', phone: '0747 015 926', color: 'var(--accent-amber)', loc: 'DRAJNA', time: '', place: 'AVIZ TELEFONIC' },

  // TEL. 0747 015 934
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'FIENI', time: '06:00', place: 'LA AUTOGARA VECHE' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'PUCIOASA', time: '06:15', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'TARGOVISTE', time: '07:00', place: 'POSTA VECHE LANGA GARA' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'MORENI', time: '08:00', place: 'LA MONUMENT' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'FILIPESTI DE PADURE', time: '08:15', place: 'LA PROFY' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'ALBESTI PALEOLOGU', time: '09:15', place: 'VIS-A-VIS BENZINARIA LUKOIL' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'MIZIL', time: '09:30', place: 'LA FABRICA LUPU' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'BUZAU', time: '10:30', place: 'ZINCA ILIE-STR. ALEX MARGHILOMAN NR. 205 MICRO V' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'RM. SARAT', time: '11:15', place: 'IN FATA LA SCOALA GENERALA NR. 5' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'BRAILA', time: '13:00', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'BRAILA', time: '13:10', place: 'ARMATA POPORULUI NR. 3 0770 648 590' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'GALATI', time: '13:45', place: 'PARCARE FOSTA COCA COLA LINGA CIMITIRUL SF. LAZAR' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'TECUCI', time: '16:00', place: 'GARA DE NORD' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'FOCSANI', time: '17:00', place: 'BARIERA MARASESTI IN-SPATE PETROM' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'ADJUD', time: '18:00', place: 'PARCARE RESTAURANT EDEN' },
  { day: 'Jueves', phone: '0747 015 934', color: 'var(--accent-amber)', loc: 'AVRIG', time: '23:00', place: 'IN FATA LA POSTA' },

  // TEL. 0747 083 791
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'SF. GHEORGHE', time: '05:30', place: 'PARCARE GARA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'COVASNA', time: '', place: 'AVIZ TELEFONIC' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'TG. SECUIESC', time: '06:00', place: 'BENZINARIA MOL PARCARE' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'OITUZ', time: '07:15', place: 'VIS-A-VIS DE PRIMARIE' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'ONESTI', time: '07:30', place: 'HOTEL TROTUS' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'TG. OCNA', time: '07:45', place: 'VIS-A-VIS HOTEL MAGURA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'COMANESTI', time: '08:30', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'MOINESTI', time: '09:00', place: 'BENZINARIA RAFO SPRE COMANESTI' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'ARDEOANI', time: '09:15', place: 'LA DRUMUL NOU' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'BACAU', time: '10:15', place: 'PARCARE GARA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'BARLAD', time: '13:00', place: 'PARCARE GARA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'HUSI', time: '14:15', place: 'LA GARA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'VASLUI', time: '15:30', place: 'PARCARE GARA' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'NEGRESTI', time: '16:10', place: 'IN FATA LA BCR' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'IASI', time: '17:30', place: 'GARA MARE PARCARE' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'ROMAN', time: '20:00', place: 'IN FATA LA EPISCOPIA ROMANULUI' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'PIATRA NEAMT', time: '21:00', place: 'PETROM DARMANESTI FOSTUL BAZAR' },
  { day: 'Jueves', phone: '0747 083 791', color: 'var(--accent-amber)', loc: 'TG NEAMT', time: '21:45', place: 'STATUIA ION CREANGA' },

  // TEL. 0755 121 429
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'GHERLA', time: '06:40', place: 'LA MAGAZIN LIDL' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'DEJ', time: '07:00', place: 'PODU, PESTE SOMES' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'BECLEAN', time: '07:30', place: 'VIS-A-VIS DE JUDECATORIE' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'NASAUD', time: '08:30', place: 'LA BISERICA LANGA PRIMARIE' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'FELDRU', time: '08:50', place: 'VIS-A-VIS BISERICA FAM VARVARI 0263 374 127' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'BORSA', time: '', place: 'AVIZ TELEFONIC' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'MOISEI', time: '10:30', place: 'LA RASCRUCE' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'VISEUL DE SUS', time: '10:45', place: 'PENY MARKET' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'VISEUL DE JOS', time: '11:00', place: 'LA SCOLA LINGA BISERICA' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'SIGHETUL MARMATIEI', time: '12:30', place: 'PETROM LOCUL TARGULUI' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'VADUL IZEI', time: '12:45', place: 'INTERSECTIA CU ROZAVLEA' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'BAIA MARE', time: '14:15', place: 'BENZINARIA MOL-LANGA GARA' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'SATU MARE', time: '15:45', place: 'PARCAREA RESTAURANTULUI TEI' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'CAREI', time: '16:45', place: 'LANGA STATUIA LUI AVRAM IANCU' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'VALEA LUI MIHAI', time: '17:30', place: 'FABRICA DE INCALTAMINTE (LANGA GIRATORIU)' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'MARGHITA', time: '18:15', place: 'HOTEL PERLA (LA IESIRE)' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'SIMLEUL SILVANEI', time: '19:15', place: 'BENZINARIA INSERCO' },
  { day: 'Jueves', phone: '0755 121 429', color: 'var(--accent-amber)', loc: 'ZALAU', time: '20:15', place: 'PARCARE UNICARN VIS-A-VIS DE AUTOGARA' },
  
  // ===================== VIERNES =====================
  // TEL. 0747 015 926
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'CALARASI', time: '07:00', place: 'LA COMBINATUL SIDERURGIC' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'OLTENITA', time: '08:30', place: 'LA TURNU DE APA' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'GIURGIU', time: '09:45', place: 'PETROM CALEA BUCURESTI' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'ZIMNICEA', time: '11:00', place: 'POSTA NOUA' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'TURNU MAGURELE', time: '12:00', place: 'LA CATEDRALA' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'ALEXANDRIA', time: '12:30', place: 'C/ TUDOR VLADIMIRESCU NR. 109 0769 287 132' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'ROSIORII DE VEDE', time: '14:00', place: 'FOSTU DEPOZIT BUTELII' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'CARACAL', time: '15:00', place: 'PARCARE LA VAGOANE' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'SLATINA', time: '16:00', place: 'LA STADION' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'DRAGASANI', time: '16:45', place: 'PENY MARKET' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'BALS', time: '16:45', place: 'LA MONUMENT' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'CRAIOVA', time: '17:30', place: 'PARCARE GARA' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'FILIASI', time: '18:45', place: 'PETROM SPRE TG JIU' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'TG JIU', time: '20:15', place: 'PARCARE PRIMARIE' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'BUMBESTI', time: '20:30', place: 'PARCAREA SPITALULUI' },
  { day: 'Viernes', phone: '0747 015 926', color: 'var(--accent-blue)', loc: 'PETROSANI', time: '21:30', place: 'BENZINARIA MOL' },

  // TEL. 0747 083 791
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'PASCANI', time: '06:30', place: 'PARCARE SPITAL' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'TG FRUMOS', time: '07:00', place: 'VIS-A-VIS DE PETROM SPRE PASCANI' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'HARLAU', time: '07:20', place: 'LA PETROM' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'BOTOSANI', time: '08:30', place: 'PARCARE CARREFOUR CALEA SUCEVEI' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'SUCEAVA', time: '10:00', place: 'ROMPETROL VIS-A-VIS METRO' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'FALTICENI', time: '10:45', place: 'IN SPATE LA NADA FLORILOR BISERICA EVREIASCA' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'GURA HUMORULUI', time: '12:00', place: 'PARCARE GARA' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'CAMPULUNG MOLDOVENESC', time: '13:00', place: 'PARCARE GARA' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'VATRA DORNEI', time: '13:45', place: 'GARA BAI - PARCARE' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'BISTRITA', time: '16:00', place: 'DEPOZITUL DE FLORI/PASARELA' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'REGHIN', time: '17:30', place: 'CARTIER DACIA - PROFI' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'TG MURES', time: '19:00', place: 'PARCARE GARA' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'IERNUT', time: '19:30', place: 'LA STATUIE' },
  { day: 'Viernes', phone: '0747 083 791', color: 'var(--accent-blue)', loc: 'LUDUS', time: '20:00', place: 'BISERICA ROSIE' },

  // TEL. 0755 121 429
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'HUEDIN', time: '06:30', place: 'BANCA TRANSILVANIA' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'ALESD', time: '08:00', place: 'LA BISERICA DIN CENTRU' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'ORADEA', time: '09:00', place: 'PARCARE LA SELGROS NUFARU' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'BEIUS', time: '11:15', place: 'PARCARE GARA' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'STEI', time: '11:45', place: 'BENZINARIE LA INTRAREA DINSPRE BEIUS' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'VASCAU', time: '12:00', place: 'PETROM' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'VARFURI', time: '12:45', place: 'LUKOIL' },
  { day: 'Viernes', phone: '0755 121 429', color: 'var(--accent-blue)', loc: 'BRAD', time: '13:45', place: 'LA POLICLINICA IN PARCARE' }
];

    // ── Ruta local de recogida en España (tu padre, sábado y domingo) ──
    const spainRoutes = [
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'ESCORIAL', time: '12:30', place: 'GARA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'GUADARRAMA', time: '13:30', place: 'RESTAURANT CHINEZESC' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'LOS MOLINOS', time: '14:00', place: 'BAR PARADA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'CERCEDILLA', time: '14:20', place: 'BENZINARIE' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'COLLADO MEDIANO', time: '14:30', place: 'GARA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'NAVACERRADA', time: '14:45', place: 'DEPORTIVO' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'BECERRIL DE LA SIERRA', time: '15:00', place: 'COLEGIO' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'ALPEDRETE', time: '15:30', place: 'CASA CULTURA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'SAN RAFAEL', time: '16:00', place: 'CASA BLANCA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'EL ESPINAR', time: '16:30', place: 'PLAZA TORO' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'LOS ARROYOS', time: '17:30', place: 'MERCADONA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'PARDILLO', time: '18:30', place: 'TAMARA ROJA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'VALDEMORILLO', time: '19:00', place: 'PLAZA DE TOROS' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'COLMENAREJO', time: '19:30', place: 'ROTONDA' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'TORRELODONES', time: '20:00', place: 'LA DOMICILIU' },
      { day: 'Sábado', phone: '', color: '#B8862E', loc: 'LAS MATAS', time: '20:30', place: 'LA GARA' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'ARROYOMOLINOS', time: '08:30', place: 'CARREFOUR' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'EL ALAMO', time: '09:00', place: 'BENZINARIE' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'NAVALCARNERO', time: '09:30', place: 'PLAZA TOROS' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'VILLAMANTA', time: '09:45', place: 'ROTONDA' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'ALDEA DEL FRESNO', time: '10:00', place: 'BENZINARIE' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'VILLA DEL PRADO', time: '10:30', place: 'AUTOGARA BUS' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'CADALSO DE LOS VIDRIOS', time: '11:00', place: 'BENZINARIE' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'SAN MARTIN DE VALDEIGLESIAS', time: '11:30', place: 'CARREFOUR' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'NAVAS DEL REY', time: '11:45', place: 'BENZINARIE' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'CHAPINERIA', time: '12:00', place: 'PARADA BUS' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'QUIJORNA', time: '12:20', place: 'COLEGIO' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'VILLANUEVA DE LA CANADA', time: '12:30', place: 'BISERICA' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'VILLACASTIN', time: '12:30-13:00', place: 'LA DOMICILIU' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'COLLADO VILLALBA', time: '13:00', place: 'MAGAZIN ROMANESC' },
      { day: 'Domingo', phone: '', color: '#3D7CA6', loc: 'GALAPAGAR', time: '14:00', place: 'GAZDA' },
    ];

    let currentRouteFilter = '';
    let currentRouteDay = 'all';
    let currentCountry = 'RO'; // 'RO' | 'ES'

    function renderRoutesTable(filterText = currentRouteFilter, selectedDay = currentRouteDay) {
      currentRouteFilter = filterText;
      currentRouteDay = selectedDay;
      const container = document.getElementById('routes-container');
      if (!container) return;
      const lowerFilter = filterText.toLowerCase();
      const sourceRoutes = currentCountry === 'ES' ? spainRoutes : romaniaRoutes;

      let filtered = sourceRoutes.filter(r =>
        r.loc.toLowerCase().includes(lowerFilter) ||
        r.day.toLowerCase().includes(lowerFilter) ||
        r.place.toLowerCase().includes(lowerFilter) ||
        (r.phone && r.phone.toLowerCase().includes(lowerFilter))
      );

      if (selectedDay !== 'all') {
        filtered = filtered.filter(r => r.day === selectedDay);
      }

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted)">
          <i data-lucide="map-pin-off" style="width:32px;height:32px;margin:0 auto 8px;display:block;opacity:0.5;"></i>
          No se encontraron rutas para "${filterText}" ${selectedDay !== 'all' ? 'el día ' + selectedDay : ''}.
        </div>`;
        if (window.lucide) lucide.createIcons({ nodes: [container] });
        return;
      }

      const daysOrder = currentCountry === 'ES' ? ['Sábado', 'Domingo'] : ['Miércoles', 'Jueves', 'Viernes'];
      let html = `
      <style>
      :root {
        --rc-bg: var(--bg-surface-solid);
        --rc-border: var(--border-default);
        --rc-text-pri: var(--text-primary);
      }

      .day-pill {
        padding: 8px 10px;
        min-height: 44px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        font-family: var(--font-heading);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: var(--bg-elevated) !important;
        border: 1.5px solid var(--border-default) !important;
        color: var(--text-secondary) !important;
        cursor: pointer;
        text-align: center;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: all 0.2s ease;
        box-shadow: none !important;
      }
      .day-pill:hover {
        border-color: var(--brand-primary) !important;
        color: var(--text-primary) !important;
        transform: translateY(-1px);
      }
      .day-pill.active {
        background: var(--brand-primary) !important;
        color: #FFFFFF !important;
        border: 1.5px solid var(--brand-primary) !important;
        box-shadow: none !important;
      }
      .day-pill.pill--miercoles.active { background: var(--accent-red) !important; border-color: var(--accent-red) !important; }
      .day-pill.pill--jueves.active { background: var(--accent-amber) !important; border-color: var(--accent-amber) !important; color: #16223D !important; }
      .day-pill.pill--viernes.active { background: var(--accent-blue) !important; border-color: var(--accent-blue) !important; }

      .route-accordion-summary {
        cursor: pointer;
        user-select: none;
        list-style: none;
        margin-bottom: 14px;
        padding: 14px 18px;
        border-radius: 8px;
        border: 1px solid var(--border-default);
        background: var(--bg-elevated);
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .accordion-day-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        color: var(--text-primary);
        text-transform: uppercase;
        font-family: var(--font-heading);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .accordion-day-title::before {
        content: '';
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--banner-color);
        flex-shrink: 0;
      }
      .accordion-stops-badge {
        background: var(--bg-surface-solid);
        color: var(--text-secondary);
        padding: 3px 10px;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        white-space: nowrap;
        flex-shrink: 0;
        font-family: var(--font-mono);
      }
      .accordion-chevron {
        color: var(--text-secondary);
        width: 20px;
        height: 20px;
        transition: transform 0.3s ease;
        flex-shrink: 0;
      }
      .route-accordion-summary::-webkit-details-marker { display: none; }
      .route-accordion-summary:hover {
        border-color: var(--banner-color);
      }
      details.route-day-accordion[open] .accordion-chevron {
        transform: rotate(180deg);
      }

      details.route-day-accordion {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 0;
        margin-bottom: 20px;
        box-shadow: none;
      }

      .route-phone-link {
        text-decoration: none;
        color: inherit;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        cursor: pointer;
        width: 100%;
      }
      .btn-call-direct {
        display: none;
      }

      .route-card-modern {
        display: flex;
        flex-direction: row;
        background: var(--rc-bg);
        border: 1px solid var(--border-default);
        border-top: 3px solid var(--day-color);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .route-card-modern:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--day-color);
      }
      .route-sidebar-modern {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 14px 8px;
        min-width: 44px;
        position: relative;
      }
      .phone-icon-badge {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--day-color);
        border: 1.5px solid var(--bg-surface-solid);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff !important;
        flex-shrink: 0;
        transition: transform 0.2s ease;
      }
      .route-phone-link:hover .phone-icon-badge {
        transform: scale(1.08);
      }
      .route-phone-vertical {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        font-weight: 700;
        font-family: var(--font-heading);
        letter-spacing: 0.1em;
        font-size: 0.85rem;
        white-space: nowrap;
        color: var(--text-primary) !important;
      }
      .route-stops-wrapper {
        border: none;
        margin: 0;
        flex-grow: 1;
        max-height: 340px;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 6px;
        background: var(--bg-surface-solid);
      }
      .route-stops-wrapper::-webkit-scrollbar {
        width: 6px;
      }
      .route-stops-wrapper::-webkit-scrollbar-thumb {
        background: var(--border-strong);
        border-radius: 10px;
      }
      .stop-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin: 4px;
        padding: 10px 12px;
        border-radius: 6px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-subtle);
        transition: border-color 0.18s ease, background 0.18s ease;
      }
      .stop-item:hover {
        background: var(--bg-hover);
        border-color: var(--day-color);
      }
      .stop-time-chip {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 0.82rem;
        padding: 3px 9px;
        border-radius: 4px;
        background: var(--bg-surface-solid);
        color: var(--day-color);
        border: 1px solid var(--day-color);
        flex-shrink: 0;
        min-width: 56px;
        text-align: center;
        margin-top: 2px;
      }
      .stop-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-grow: 1;
      }
      .stop-locality-title {
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 0.02em;
        color: var(--rc-text-pri);
        font-family: var(--font-heading);
        text-transform: uppercase;
      }
      .stop-address-text {
        font-size: 0.78rem;
        color: var(--text-secondary);
        display: flex;
        align-items: flex-start;
        gap: 6px;
        line-height: 1.3;
        font-family: var(--font-family);
      }
      .stop-address-text i {
        flex-shrink: 0;
        margin-top: 3px;
        color: var(--day-color);
      }

      .route-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 14px;
        padding-top: 4px;
        width: 100%;
        box-sizing: border-box;
      }

      /* ── ADAPTACIÓN EXCLUSIVA PARA VERSIÓN MÓVIL ── */
      @media (max-width: 768px) {
        .view__subtitle {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-size: clamp(0.7rem, 3.2vw, 0.875rem) !important;
        }
        .route-cards-grid {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          width: 100% !important;
        }
        details.route-day-accordion {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }
        .route-accordion-summary {
          padding: 12px 14px !important;
          gap: 10px !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .accordion-day-title {
          font-size: 1rem !important;
        }
        .accordion-stops-badge {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          font-size: 0.7rem !important;
          padding: 3px 8px !important;
        }
        .route-phone-link {
          cursor: pointer;
          pointer-events: auto;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          width: auto !important;
        }
        .btn-call-direct {
          display: inline-flex !important;
          align-items: center;
          gap: 6px;
          margin-top: 0 !important;
          padding: 5px 13px;
          min-height: 44px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 700;
          background: #FFFFFF !important;
          color: var(--day-color, var(--brand-primary)) !important;
          border: 1.5px solid var(--day-color, var(--brand-primary)) !important;
          box-shadow: none !important;
          text-decoration: none;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .btn-call-direct:active {
          transform: scale(0.95);
          background: #F0EBDD !important;
        }
        .route-card-modern {
          flex-direction: column !important;
          border-radius: 8px;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }
        .route-sidebar-modern {
          border-bottom: 1px solid var(--rc-border) !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 10px 14px !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .route-stops-wrapper {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .route-phone-vertical {
          writing-mode: horizontal-tb !important;
          transform: none !important;
          margin-top: 0 !important;
          font-size: 0.9rem !important;
          letter-spacing: 0.05em !important;
        }
      }

      @media (max-width: 480px) {
        .stop-item {
          padding: 10px 12px;
          gap: 10px;
        }
        .stop-time-chip {
          min-width: 48px;
          font-size: 0.78rem;
          padding: 3px 6px;
        }
      }
      </style>
      <div style="display:flex; flex-direction:column; gap:24px;">`;

      for (let day of daysOrder) {
        const dayRoutes = filtered.filter(r => r.day === day);
        if (dayRoutes.length === 0) continue;

        const phones = [...new Set(dayRoutes.map(r => r.phone))];
        const isOpen = selectedDay === day || lowerFilter !== '' || selectedDay === 'all';

        html += `
        <details class="route-day-accordion" data-day="${day}" ${isOpen ? 'open' : ''}>
          <summary class="route-accordion-summary" style="--banner-color: ${dayRoutes[0].color};">
            <div style="display:flex; align-items:center; gap:12px;">
              <h4 class="accordion-day-title">${day}</h4>
              <span class="accordion-stops-badge">${dayRoutes.length} paradas</span>
            </div>
            <i data-lucide="chevron-down" class="accordion-chevron"></i>
          </summary>

          <div class="route-cards-grid">`;

        for (let phone of phones) {
          const phoneRoutes = dayRoutes.filter(r => r.phone === phone);
          const rawPhone = phone ? phone.replace(/\s+/g, '') : '';

          html += `
            <div class="route-card-modern" style="--day-color: ${dayRoutes[0].color};">
              <div class="route-sidebar-modern">
                <a href="${rawPhone ? 'tel:' + rawPhone : '#'}" class="route-phone-link" title="${rawPhone ? 'Hacer clic para llamar a ' + phone : ''}">
                  <div class="phone-icon-badge">
                    <i data-lucide="phone" style="width:16px;height:16px;"></i>
                  </div>
                  <span class="route-phone-vertical">
                    ${phone ? phone : 'SIN TELÉFONO'}
                  </span>
                </a>
                ${rawPhone ? `<a href="tel:${rawPhone}" class="btn-call-direct" title="Llamar"><i data-lucide="phone-call" style="width:14px;height:14px;"></i> <span>Llamar</span></a>` : ''}
              </div>
              <div class="route-stops-wrapper">
                ${phoneRoutes.map(r => `
                  <div class="stop-item">
                    <div class="stop-info">
                      <div class="stop-locality-title">${r.loc}</div>
                      <div class="stop-address-text">
                        <i data-lucide="map-pin" style="width:14px;height:14px;"></i>
                        <span>${r.place}</span>
                      </div>
                    </div>
                    ${r.time && r.time.trim() !== '' ? `<div class="stop-time-chip">${r.time}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>`;
        }
        html += `</div></details>`;
      }
      html += '</div>';

      container.innerHTML = html;
      if (window.lucide) lucide.createIcons({ nodes: [container] });

      // Update pills active state
      document.querySelectorAll('.day-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.day === currentRouteDay);
      });
    }

    // Filtrado — se cablea siempre, sin depender de que cargue el CDN de morphicons.
    document.getElementById('route-search-input')?.addEventListener('input', (e) => {
      renderRoutesTable(e.target.value, currentRouteDay);
    });
    document.getElementById('clients-search-input')?.addEventListener('input', () => {
      renderClientsView();
    });
    document.getElementById('clients-role-filter')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.client-role-filter__btn');
      if (!btn) return;
      document.querySelectorAll('.client-role-filter__btn').forEach(b => b.classList.toggle('active', b === btn));
      renderClientsView();
    });

    // ── Iconos de búsqueda que hacen morph lupa↔X (morphicons) ─────
    // El propio icono de lupa es el botón de limpiar: al escribir se transforma
    // en X con una animación fluida, en vez de un botón aparte que aparece/
    // desaparece de golpe. Capa puramente visual sobre el filtrado de arriba —
    // si el CDN no carga (sin red, o file://), el icono se queda como lupa
    // estática y la búsqueda sigue funcionando igual.
    (async () => {
      let createMorph = null;
      try {
        ({ createMorph } = await import('https://esm.sh/morphicons/dom'));
      } catch (e) { console.warn('[morphicons] no disponible, icono de búsqueda estático', e); }
      if (!createMorph || !window.lucide?.icons) return;

      const SEARCH = window.lucide.icons.Search;
      const CLEAR = window.lucide.icons.X;

      function setupSearchIconMorph({ inputId, iconId }) {
        const input = document.getElementById(inputId);
        const iconSvg = document.getElementById(iconId);
        const pathEl = iconSvg?.querySelector('path');
        if (!input || !iconSvg || !pathEl) return;

        const morph = createMorph(pathEl, SEARCH);
        let cleared = false;

        iconSvg.addEventListener('click', () => {
          if (!cleared) { input.focus(); return; }
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        });
        iconSvg.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); iconSvg.click(); }
        });

        input.addEventListener('input', (e) => {
          const hasValue = !!e.target.value;
          if (hasValue && !cleared) {
            cleared = true;
            morph.morphTo(CLEAR, 'snappy');
            iconSvg.setAttribute('aria-label', 'Limpiar búsqueda');
          } else if (!hasValue && cleared) {
            cleared = false;
            morph.morphTo(SEARCH, 'snappy');
            iconSvg.setAttribute('aria-label', 'Buscar');
          }
        });
      }

      setupSearchIconMorph({ inputId: 'route-search-input', iconId: 'route-search-icon' });
      setupSearchIconMorph({ inputId: 'clients-search-input', iconId: 'clients-search-icon' });
    })();

    document.getElementById('day-pills-container')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.day-pill');
      if (btn) {
        renderRoutesTable(currentRouteFilter, btn.dataset.day);
        window.refreshLocalRouteFocus?.();
      }
    });

    window.getCurrentRouteDay = () => currentRouteDay;

    renderRoutesTable();

    // Autocomplete
    const hideDropdown = () => { const list = document.getElementById('autocomplete-list'); if (list) list.classList.add('hidden'); };
    document.getElementById('pkg-client-search')?.addEventListener('input', debounce(handleAutocomplete, 200));
    document.addEventListener('click', e => {
      if (!e.target.closest('#autocomplete-wrapper')) hideDropdown();
    });

    // Force dark mode permanently
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.removeItem('nc_caliman_theme');

    // Initialize Date in dashboard header
    (() => {
      const d = new Date();
      const opt = { weekday: 'long', day: 'numeric', month: 'long' };
      const dateStr = d.toLocaleDateString('es-ES', opt);
      const capDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      const el = document.getElementById('dashboard-date');
      if (el) el.textContent = `Resumen del fin de semana · ${capDate}`;
    })();

    // ── STATS / ESTADÍSTICAS ──────────────────────────────────────
    function renderStats() {
      const container = document.getElementById('stats-charts-container');
      if (!container) return;
      const pkgs = StorageService.getPackages();

      if (pkgs.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align:center;padding:60px 24px;">
            <div class="empty-state__icon" style="color:var(--text-muted); opacity:0.4; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">
              <i data-lucide="bar-chart-3" style="width:48px;height:48px;"></i>
            </div>
            <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;text-align:center;">Sin datos todavía</h3>
            <p style="font-size:clamp(0.62rem, 2.7vw, 0.85rem);color:var(--text-secondary);white-space:nowrap;margin:0 auto;text-align:center;line-height:1.5;max-width:100%;">Registra envíos para ver la distribución por destino.</p>
          </div>`;
        if (window.lucide) lucide.createIcons({ nodes: [container] });
        return;
      }

      // Aggregate by destination city
      const destMap = {};
      let totalBultos = 0;
      let totalWeightSum = 0;
      pkgs.forEach(p => {
        const city = (p.localidadDestinatario || 'Desconocido').trim().toUpperCase();
        const bultos = parseInt(p.bultos) || 0;
        const w = parseFloat(p.weight) || 0;
        if (!destMap[city]) destMap[city] = { count: 0, weight: 0 };
        destMap[city].count += bultos;
        destMap[city].weight += w;
        totalBultos += bultos;
        totalWeightSum += w;
      });

      const entries = Object.entries(destMap).sort((a, b) => b[1].count - a[1].count);
      const totalPkgs = totalBultos;
      const topCityName = entries[0] ? entries[0][0] : '—';
      const topCityCount = entries[0] ? entries[0][1].count : 0;
      const topCityPct = totalPkgs > 0 ? ((topCityCount / totalPkgs) * 100).toFixed(1) : 0;

      // Paleta de marca — los mismos 5 acentos usados en toda la app (mauve + los 3
      // colores de día + rojo de anulación); ciclos posteriores bajan de opacidad
      // en vez de inventar tonos nuevos, para no romper la paleta restringida.
      const palette = ['#8B7FA0', '#7FA5CC', '#D4A64C', '#5CA47F', '#D9695C'];
      const paletteColor = (i) => palette[i % palette.length];
      const paletteOpacity = (i) => [1, 0.55, 0.3][Math.floor(i / palette.length)] ?? 0.3;

      // Build donut segments
      const radius = 100, cx = 130, cy = 130, stroke = 32;
      const circumference = 2 * Math.PI * radius;
      let accumulated = 0;
      const maxCount = entries[0] ? entries[0][1].count : 1;

      const segments = entries.map(([city, data], i) => {
        const pct = data.count / totalPkgs;
        const dashLen = pct * circumference;
        const gap = circumference - dashLen;
        const offset = -accumulated * circumference + circumference * 0.25;
        accumulated += pct;
        const color = paletteColor(i);
        const opacity = paletteOpacity(i);
        return { city, count: data.count, weight: data.weight, pct, color, opacity, dashLen, gap, offset };
      });

      // Classic SVG Bar Chart geometry calculations (Large & High Impact)
      const axisYTop = 50;
      const axisYBottom = 290;
      const chartH = axisYBottom - axisYTop; // 240px tall (expanded!)
      const axisXLeft = 55;
      const axisXRight = 490;
      const chartW = axisXRight - axisXLeft; // 435px wide

      const N = segments.length;
      const step = N > 0 ? chartW / N : chartW;
      const barW = Math.min(68, Math.max(32, step * 0.52));

      const svgBarsHTML = segments.map((s, i) => {
        const cxPos = axisXLeft + (i + 0.5) * step;
        const bx = cxPos - barW / 2;
        const bHeight = maxCount > 0 ? (s.count / maxCount) * chartH : 0;
        const by = axisYBottom - bHeight;

        return `
          <!-- Columna plana, sin gradiente decorativo -->
          <rect class="vbar-svg-rect" x="${bx}" y="${by}" width="${barW}" height="${bHeight}" rx="4" fill="${s.color}" fill-opacity="${s.opacity}" />

          <!-- Percentage on top of bar -->
          <text x="${cxPos}" y="${Math.min(by - 12, axisYBottom - 12)}" text-anchor="middle" fill="${s.color}" font-family="var(--font-mono)" font-weight="700" font-size="15">${(s.pct * 100).toFixed(1)}%</text>

          <!-- City Name & Weight below X Axis Baseline -->
          <text x="${cxPos}" y="318" text-anchor="middle" fill="#F7F4EC" font-family="var(--font-heading)" font-weight="700" font-size="14">${s.city}</text>
          <text x="${cxPos}" y="338" text-anchor="middle" fill="#B9C0D4" font-family="var(--font-mono)" font-weight="600" font-size="12">${s.weight.toFixed(1)} kg</text>
        `;
      }).join('');

      // Acordeón por ciudad: fila plegable con nombre + % en el resumen,
      // bultos y peso en el detalle expandido (reusa el patrón visual de
      // .route-day-accordion — punto de color vía --banner-color).
      const cityAccordionHTML = segments.map(s => `
        <details class="city-accordion">
          <summary class="city-accordion-summary" style="--banner-color: ${s.color};">
            <div style="display:flex; align-items:center; gap:10px; min-width:0;">
              <span class="city-accordion-dot"></span>
              <span class="city-accordion-name">${s.city}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="city-accordion-pct">${(s.pct * 100).toFixed(1)}%</span>
              <i data-lucide="chevron-down" class="accordion-chevron"></i>
            </div>
          </summary>
          <div class="city-accordion-detail">
            <span><strong>${s.count}</strong> bulto${s.count === 1 ? '' : 's'}</span>
            <span>${s.weight.toFixed(1)} kg</span>
          </div>
        </details>
      `).join('');

      let html = `
      <style>
        .stats-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .mini-stat {
          border-radius: 8px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: var(--bg-surface-solid);
          border: 1px solid var(--border-default, rgba(255,255,255,0.08));
          border-top: 3px solid var(--accent-color);
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.3));
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
          min-width: 0;
        }
        .mini-stat:hover { transform: translateY(-2px); box-shadow: var(--shadow-md, 0 8px 20px rgba(0,0,0,0.35)); }

        .mini-stat--pkgs { --accent-color: #8B7FA0; }
        .mini-stat--avg { --accent-color: #D4A64C; }

        .mini-stat__val {
          font-size: 1.8rem;
          font-weight: 800;
          color: #F7F4EC;
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mini-stat__sub {
          font-size: 0.72rem;
          color: #B9C0D4;
          margin-top: 4px;
          font-weight: 600;
        }

        .mini-stat__label {
          font-size: 0.72rem;
          color: #B9C0D4;
          margin-top: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .stats-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .vbar-card, .donut-card {
          background: var(--bg-surface-solid);
          border: 1px solid var(--border-default, rgba(255,255,255,0.08));
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.3));
          border-radius: 8px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .vbar-svg {
          width: 100%;
          height: auto;
          overflow: visible;
        }

        .vbar-svg-rect {
          transition: opacity 0.15s ease;
          cursor: pointer;
        }
        .vbar-svg-rect:hover {
          opacity: 0.8;
        }

        .donut-card-body {
          display: grid;
          grid-template-columns: minmax(220px, 300px) 1fr;
          gap: 32px;
          align-items: center;
        }
        @media (max-width: 640px) {
          .donut-card-body { grid-template-columns: 1fr; justify-items: center; }
        }

        .donut-chart-col { display: flex; justify-content: center; }
        .donut-svg { margin: 12px 0; }
        .donut-segment { transition: opacity 0.15s ease; cursor: pointer; }
        .donut-segment:hover { opacity: 0.8; }
        .donut-center-text { font-family: var(--font-mono); fill: #F7F4EC; }
        .donut-center-sub { font-family: var(--font-family); fill: #B9C0D4; letter-spacing: 1px; }

        .city-accordion-list {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 340px;
          overflow-y: auto;
        }

        .city-accordion { background: transparent; border: none; }

        .city-accordion-summary {
          cursor: pointer;
          user-select: none;
          list-style: none;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
          transition: border-color 0.2s ease;
        }
        .city-accordion-summary::-webkit-details-marker { display: none; }
        .city-accordion-summary:hover { border-color: var(--banner-color); }

        .city-accordion-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          background: var(--banner-color);
          flex-shrink: 0;
        }
        .city-accordion-name {
          font-weight: 600;
          color: #F7F4EC;
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .city-accordion-pct { font-family: var(--font-mono); font-weight: 700; color: #8B7FA0; font-size: 0.85rem; }

        details.city-accordion[open] .accordion-chevron { transform: rotate(180deg); }

        .city-accordion-detail {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          margin-top: 4px;
          color: #B9C0D4;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          border-left: 2px solid var(--banner-color);
        }

        @keyframes donutDraw { from { stroke-dasharray: 0 ${circumference}; } }
      </style>

      <!-- ── KPI CARDS RESUMEN (2 TARJETAS) ── -->
      <div class="stats-summary-grid">
        <div class="mini-stat mini-stat--pkgs">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="mini-stat__val">${totalPkgs}</div>
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(139, 127, 160, 0.12); border:1px solid rgba(139, 127, 160, 0.3); display:flex; align-items:center; justify-content:center; color:#A79DB8;">
              <i data-lucide="package" style="width:18px;height:18px;"></i>
            </div>
          </div>
          <div class="mini-stat__sub">Bultos totales registrados</div>
          <div class="mini-stat__label">BULTOS TOTALES</div>
        </div>

        <div class="mini-stat mini-stat--avg">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="mini-stat__val">${totalWeightSum.toFixed(1)} <span style="font-size:1.1rem; color:#B9C0D4;">kg</span></div>
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(212, 166, 76, 0.12); border:1px solid rgba(212, 166, 76, 0.3); display:flex; align-items:center; justify-content:center; color:#D4A64C;">
              <i data-lucide="weight" style="width:18px;height:18px;"></i>
            </div>
          </div>
          <div class="mini-stat__sub">Masa total de la carga</div>
          <div class="mini-stat__label">PESO TOTAL</div>
        </div>
      </div>

      <!-- ── HISTOGRAMA Y ROSCA GRAFICA ── -->
      <div class="stats-layout">
        <!-- CARD IZQUIERDA: GRÁFICO DE BARRAS VERTICALES (SVG VECTORIAL) -->
        <div class="vbar-card">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
            <h3 style="color:#F7F4EC; margin:0; font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:10px; font-family:var(--font-heading);">
              <div style="width:32px; height:32px; border-radius:8px; background:rgba(139, 127, 160, 0.12); border:1px solid rgba(139, 127, 160, 0.3); display:flex; align-items:center; justify-content:center; color:#A79DB8;">
                <i data-lucide="bar-chart-3" style="width:18px;height:18px;"></i>
              </div>
              Gráfico de Barras por Destino
            </h3>
          </div>

          <svg class="vbar-svg" viewBox="0 0 520 380">
            <!-- Y-Axis Title Label (Rotated Vertical) -->
            <text transform="rotate(-90)" x="-165" y="16" text-anchor="middle" fill="#8B7FA0" font-family="var(--font-heading)" font-weight="700" font-size="11" letter-spacing="2">BULTOS</text>

            <!-- Y-Axis Grid Lines & Numbers -->
            <line x1="42" y1="${axisYTop}" x2="505" y2="${axisYTop}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4"/>
            <text x="36" y="${axisYTop + 4}" text-anchor="end" fill="#B9C0D4" font-family="var(--font-mono)" font-size="12" font-weight="700">${maxCount}</text>

            <line x1="42" y1="${axisYTop + chartH / 2}" x2="505" y2="${axisYTop + chartH / 2}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4"/>
            <text x="36" y="${axisYTop + chartH / 2 + 4}" text-anchor="end" fill="#B9C0D4" font-family="var(--font-mono)" font-size="12" font-weight="700">${(maxCount / 2).toFixed(maxCount > 2 ? 0 : 1)}</text>

            <line x1="42" y1="${axisYBottom}" x2="505" y2="${axisYBottom}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
            <text x="36" y="${axisYBottom + 4}" text-anchor="end" fill="#B9C0D4" font-family="var(--font-mono)" font-size="12" font-weight="700">0</text>

            <!-- Bars & Labels -->
            ${svgBarsHTML}

            <!-- X-Axis Title Label -->
            <text x="270" y="368" text-anchor="middle" fill="#8B7FA0" font-family="var(--font-heading)" font-weight="700" font-size="11" letter-spacing="2">CIUDAD DE DESTINO</text>
          </svg>
        </div>

        <!-- CARD DERECHA: ROSCA Y DESGLOSE -->
        <div class="donut-card">
          <div style="width:100%; display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
            <h3 style="color:#F7F4EC; margin:0; font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:10px; font-family:var(--font-heading);">
              <div style="width:32px; height:32px; border-radius:8px; background:rgba(139, 127, 160, 0.12); border:1px solid rgba(139, 127, 160, 0.3); display:flex; align-items:center; justify-content:center; color:#A79DB8;">
                <i data-lucide="pie-chart" style="width:18px;height:18px;"></i>
              </div>
              Distribución Porcentual
            </h3>
          </div>

          <div class="donut-card-body">
            <div class="donut-chart-col">
              <svg class="donut-svg" width="240" height="240" viewBox="0 0 260 260">
                ${segments.map((s, i) => `
                  <circle class="donut-segment" cx="${cx}" cy="${cy}" r="${radius}" fill="none"
                    stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${stroke}"
                    stroke-dasharray="${s.dashLen} ${s.gap}"
                    stroke-dashoffset="${s.offset}"
                    style="animation: donutDraw 0.8s ease ${i * 0.08}s both;"
                    data-city="${s.city}">
                    <title>${s.city}: ${s.count} bulto${s.count > 1 ? 's' : ''} (${(s.pct * 100).toFixed(1)}%)</title>
                  </circle>
                `).join('')}
                <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="donut-center-text" font-size="34" font-weight="700">${totalPkgs}</text>
                <text x="${cx}" y="${cy + 18}" text-anchor="middle" class="donut-center-sub" font-size="11" font-weight="700" letter-spacing="2">PAQUETES</text>
              </svg>
            </div>

            <div class="city-accordion-list">
              ${cityAccordionHTML}
            </div>
          </div>
        </div>
      </div>`;

      container.innerHTML = html;
      lucide.createIcons({ nodes: [container] });
    }

    // ── CLIENTS MODULE ────────────────────────────────────────────
    function syncClientsFromPackages(pkgs) {
      if (!Array.isArray(pkgs)) return;
      let clients = StorageService.getClients();
      let changed = false;

      pkgs.forEach(p => {
        if (p.destinatario && p.localidadDestinatario) {
          const idx = clients.findIndex(c => c.name.toLowerCase() === p.destinatario.trim().toLowerCase());
          if (idx === -1) {
            clients.push({ id: 'cli_' + Date.now() + Math.random().toString(36).substr(2, 4), name: p.destinatario.trim(), city: p.localidadDestinatario.trim(), role: 'Destinatario' });
            changed = true;
          } else if (clients[idx].city !== p.localidadDestinatario.trim()) {
            clients[idx].city = p.localidadDestinatario.trim();
            changed = true;
          }
        }
        if (p.expedidor && p.localidadExpedidor) {
          const idx = clients.findIndex(c => c.name.toLowerCase() === p.expedidor.trim().toLowerCase());
          if (idx === -1) {
            clients.push({ id: 'cli_' + Date.now() + Math.random().toString(36).substr(2, 4), name: p.expedidor.trim(), city: p.localidadExpedidor.trim(), role: 'Expedidor' });
            changed = true;
          }
        }
      });

      if (changed) {
        StorageService.saveClients(clients);
        renderDatalists();
      }
    }

    function renderDatalists() {
      const clients = StorageService.getClients();
      const destList = document.getElementById('destinatarios-list');
      const expList = document.getElementById('expedidores-list');
      if (!destList || !expList) return;

      const dests = clients.filter(c => c.role === 'Destinatario' || !c.role);
      const exps = clients.filter(c => c.role === 'Expedidor' || !c.role);

      destList.innerHTML = dests.map(c => `<option value="${_esc(c.name)}">${_esc(c.city)}</option>`).join('');
      expList.innerHTML = exps.map(c => `<option value="${_esc(c.name)}">${_esc(c.city)}</option>`).join('');
    }

    document.getElementById('pkg-dest')?.addEventListener('input', e => {
      const val = e.target.value.trim().toLowerCase();
      const client = StorageService.getClients().find(c => c.name.toLowerCase() === val);
      if (client && client.city) {
        const locInput = document.getElementById('pkg-loc-dest');
        if (locInput && !locInput.value) locInput.value = client.city;
      }
    });

    document.getElementById('pkg-exp')?.addEventListener('input', e => {
      const val = e.target.value.trim().toLowerCase();
      const client = StorageService.getClients().find(c => c.name.toLowerCase() === val);
      if (client && client.city) {
        const locInput = document.getElementById('pkg-loc-exp');
        if (locInput && !locInput.value) locInput.value = client.city;
      }
    });

    function renderClientsView() {
      const container = document.getElementById('clients-table-container');
      if (!container) return;

      syncClientsFromPackages(StorageService.getPackages());
      const hasAnyClients = StorageService.getClients().length > 0;
      let clients = StorageService.getClients();
      const filter = (document.getElementById('clients-search-input')?.value || '').trim().toLowerCase();
      const roleFilter = document.querySelector('.client-role-filter__btn.active')?.dataset.role || 'all';

      if (filter) {
        clients = clients.filter(c => c.name.toLowerCase().includes(filter) || c.city.toLowerCase().includes(filter));
      }
      if (roleFilter !== 'all') {
        clients = clients.filter(c => (c.role || 'Destinatario') === roleFilter);
      }

      if (clients.length === 0) {
        const title = hasAnyClients ? 'Ningún cliente coincide con el filtro' : 'No hay clientes guardados aún';
        const subtitle = hasAnyClients ? 'Probá con otro nombre, localidad o rol.' : 'Se guardarán automáticamente al crear envíos.';
        container.innerHTML = `
          <div class="empty-state" style="margin-top:0; border:none; background:transparent; box-shadow:none; padding:48px 20px;">
            <div class="empty-state__icon" style="color:var(--text-muted); opacity:0.4; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">
              <i data-lucide="users" style="width:48px;height:48px;"></i>
            </div>
            <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;text-align:center;">${title}</h3>
            <p style="font-size:clamp(0.62rem, 2.8vw, 0.85rem);color:var(--text-secondary);white-space:nowrap;margin:0 auto;text-align:center;line-height:1.5;max-width:100%;">${subtitle}</p>
          </div>
        `;
        lucide.createIcons({ nodes: [container] });
        return;
      }

      let html = `
        <style>
          .client-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
            gap: 10px;
          }
          .client-card {
            position: relative;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-top: 3px solid var(--client-accent, var(--brand-primary));
            border-radius: var(--radius-md);
            padding: 12px 30px 12px 14px;
            box-shadow: var(--shadow-sm);
            opacity: 0;
            transform: scale(0.95);
            animation: clientCardIn 200ms ease-out forwards;
            transition: transform 150ms ease-out, border-color 150ms ease, box-shadow 150ms ease-out;
          }
          @keyframes clientCardIn { to { opacity: 1; transform: scale(1); } }
          @media (hover: hover) and (pointer: fine) {
            .client-card:hover {
              transform: translateY(-2px);
              box-shadow: var(--shadow-md);
              border-color: color-mix(in srgb, var(--brand-primary) 50%, var(--border-default));
            }
          }
          .client-card__name {
            font-family: var(--font-heading);
            font-weight: 700;
            font-size: 0.88rem;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .client-card__city {
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.78rem;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .client-card__delete {
            position: absolute;
            top: 7px;
            right: 7px;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: transparent;
            color: var(--text-muted);
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: background 150ms ease, color 150ms ease, transform 150ms ease-out;
          }
          .client-card__delete:hover { background: rgba(192, 57, 43, 0.14); color: #D9695C; }
          .client-card__delete:active { transform: scale(0.9); }
          @media (prefers-reduced-motion: reduce) {
            .client-card { animation: none; opacity: 1; transform: none; }
          }
        </style>
        <div class="client-grid">
          ${clients.map((c, i) => {
            const isExp = c.role === 'Expedidor';
            const accentVar = isExp ? 'var(--status-pending-text)' : 'var(--status-transit-text)';
            const delay = Math.min(i, 15) * 30;
            return `
              <div class="client-card" style="--client-accent:${accentVar}; animation-delay:${delay}ms;">
                <button class="client-card__delete delete-client-btn" data-id="${c.id}" title="Eliminar de la agenda">
                  <i data-lucide="trash-2" style="width:13px;height:13px"></i>
                </button>
                <div class="client-card__name" title="${_esc(c.name)}">${_esc(c.name)}</div>
                <div class="client-card__city" title="${_esc(c.city)}"><i data-lucide="map-pin" style="width:11px;height:11px;flex-shrink:0;"></i>${_esc(c.city)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      container.innerHTML = html;
      lucide.createIcons({ nodes: [container] });

      container.querySelectorAll('.delete-client-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const client = StorageService.getClients().find(c => c.id === id);
          if (!client) return;

          const confirmed = await showConfirmModal({
            title: '¿Eliminar cliente de la agenda?',
            itemName: `${client.name} (${client.city})`,
            message: 'Se eliminará de las sugerencias de autocompletado.',
            confirmText: 'Eliminar Cliente'
          });

          if (!confirmed) return;

          const updated = StorageService.getClients().filter(c => c.id !== id);
          StorageService.saveClients(updated);
          renderClientsView();
          renderDatalists();
          EventBus.emit(EV.TOAST, { type: 'info', message: 'Cliente eliminado de la agenda.' });
        });
      });
    }

    // ── HISTORY MODULE ────────────────────────────────────────────
    // El botón #dashboard-archive-btn ya dispara window.closeAndArchiveFinde() por su
    // atributo onclick en el HTML. Antes había también un addEventListener('click', ...)
    // duplicado aquí con la misma lógica: un solo clic disparaba ambos, cada uno abría su
    // propio showConfirmModal() sobre el mismo botón "Archivar Finde" ({once:true} en cada
    // uno), así que un único clic de confirmación resolvía las dos promesas y archivaba
    // el finde dos veces (dos entradas en el Histórico). Se quitó el listener duplicado.

    async function archiveCurrentWeekend(pkgs) {
      const history = StorageService.getHistory();
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const totalBultos = pkgs.reduce((s, p) => s + (parseInt(p.bultos) || 1), 0);
      const totalWeight = pkgs.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0);
      const totalMoney = pkgs.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);

      const archivedItem = {
        id: 'finde_' + Date.now(),
        dateLabel: dateStr,
        createdAt: now.toISOString(),
        count: totalBultos,
        weight: totalWeight,
        money: totalMoney,
        packages: pkgs
      };

      history.unshift(archivedItem);
      StorageService.saveHistory(history);
      StorageService.savePackages([]);

      // Sube el registro archivado a Supabase para que el histórico aparezca también
      // en los demás dispositivos (antes solo se guardaba en localStorage).
      await SupabaseService.saveHistoryItem(archivedItem).catch(() => {});

      // Borra también en Supabase: sin esto, la próxima sincronización (recarga de
      // página, evento realtime desde otro dispositivo) vuelve a traer estos paquetes
      // de la nube y "revive" la tabla que se acaba de archivar.
      await Promise.all(pkgs.map(p => SupabaseService.deletePackage(p.id).catch(() => {})));

      renderDashboard();
      EventBus.emit(EV.TOAST, { type: 'success', message: '✅ Fin de semana archivado correctamente en el Histórico.' });
      navigateTo('history');
    }

    function renderHistoryView() {
      const container = document.getElementById('history-container');
      if (!container) return;

      const history = StorageService.getHistory();

      if (history.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align:center;padding:48px 20px;">
            <div class="empty-state__icon" style="color:var(--text-muted); opacity:0.4; margin-bottom:12px; display:flex; justify-content:center; align-items:center;">
              <i data-lucide="archive" style="width:48px;height:48px;"></i>
            </div>
            <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;text-align:center;">Aún no hay liquidaciones archivadas.</h3>
            <p style="font-size:0.875rem;color:var(--text-secondary);max-width:100%;margin:0 auto;text-align:center;line-height:1.5;">Pulsa el botón "Cerrar y Archivar Finde" en el Dashboard para guardar el resumen histórico aquí.</p>
          </div>
        `;
        lucide.createIcons({ nodes: [container] });
        return;
      }

      let html = `
        <style>
          .history-item-card {
            background: var(--bg-surface-solid);
            border: 1px solid var(--border-default, rgba(255,255,255,0.08));
            border-top: 3px solid #8B7FA0;
            box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.3));
            border-radius: var(--radius-lg, 8px);
            padding: 22px 24px;
          }
          .history-item-card--latest {
            border-top-color: #A79DB8;
            box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.4));
          }
          .history-card-header {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
          }
          .history-latest-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #A79DB8;
            margin: 0 0 6px;
          }
          .history-latest-tag::before {
            content: '';
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #A79DB8;
            flex-shrink: 0;
          }
          .history-date-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
            font-family: var(--font-heading);
            line-height: 1.3;
          }
          .history-date-title i { color: #A79DB8; flex-shrink: 0; }
          .history-header-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
          .history-stats-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1.3fr;
            gap: 18px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default, rgba(255,255,255,0.08));
            border-radius: var(--radius-lg, 8px);
            padding: 18px 22px;
            margin-bottom: 16px;
          }
          .history-stat { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
          .history-stat + .history-stat {
            border-left: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
            padding-left: 18px;
          }
          .history-stat-label {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .history-stat--money .history-stat-label { color: #7FCB9E; }
          .history-stat-value {
            font-size: 1.7rem;
            font-weight: 700;
            color: var(--text-primary);
            font-family: var(--font-mono);
            line-height: 1.15;
          }
          .history-stat-value small { font-size: 1.05rem; font-weight: 600; color: inherit; opacity: 0.75; }
          .history-stat-value--weight { color: #7FA5CC; }
          .history-stat-value--money { color: #5CA47F; font-size: 1.95rem; }
          .history-item-card summary { list-style: none; }
          .history-item-card summary::-webkit-details-marker { display: none; }
          .history-summary-toggle {
            cursor: pointer;
            font-weight: 700;
            color: var(--text-primary);
            font-size: 0.9rem;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(139, 127, 160, 0.14);
            border: 1px solid rgba(139, 127, 160, 0.4);
            padding: 9px 16px;
            border-radius: var(--radius-lg, 8px);
            transition: background 0.15s ease;
          }
          .history-summary-toggle:hover { background: rgba(139, 127, 160, 0.24); }
          .history-summary-toggle .history-detail-chevron { width: 16px; height: 16px; transition: transform 0.2s ease; }
          details[open] > .history-summary-toggle .history-detail-chevron { transform: rotate(180deg); }
          @media (max-width: 640px) {
            .history-item-card { padding: 16px; }
            .history-header-actions { width: 100%; justify-content: space-between; }
            .export-history-csv-btn { flex: 1; justify-content: center; }
            .history-stats-row { grid-template-columns: 1fr; gap: 14px; padding: 16px; }
            .history-stat + .history-stat {
              border-left: none;
              border-top: 1px dashed var(--border-subtle, rgba(255,255,255,0.1));
              padding-left: 0;
              padding-top: 14px;
            }
            .history-summary-toggle { width: 100%; justify-content: center; box-sizing: border-box; }
          }
          .history-table-wrap {
            margin-top: 14px;
            border: 1px solid var(--border-default, rgba(255,255,255,0.1));
            border-radius: var(--radius-md, 6px);
            overflow: hidden;
          }
          .history-table {
            width: 100%;
            border-collapse: collapse;
          }
          .history-table thead tr { background: var(--bg-elevated); }
          .history-table th {
            padding: 11px 16px;
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.07em;
            border-bottom: 1px solid var(--border-default, rgba(255,255,255,0.12));
            text-align: left;
            white-space: nowrap;
          }
          .history-table td {
            padding: 11px 16px;
            font-size: 0.87rem;
            color: var(--text-primary);
            border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
            vertical-align: middle;
            white-space: nowrap;
          }
          .history-table tbody tr:last-child td { border-bottom: none; }
          .history-table tbody tr:nth-child(even) td { background: rgba(255, 255, 255, 0.02); }
          .history-table tbody tr:hover td { background: rgba(255, 255, 255, 0.05); }
          .history-table .history-cell-id { color: var(--text-muted); font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600; }
          .history-table .history-cell-recipient { font-weight: 700; }
          .history-table .history-cell-numeric { font-family: var(--font-mono); font-weight: 700; text-align: center; }
          .history-table .history-cell-weight { font-family: var(--font-mono); font-weight: 700; color: #7FA5CC; }
          .history-table .history-cell-price { font-family: var(--font-mono); font-weight: 700; color: #5CA47F; text-align: right; }
          .history-badge-city {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            color: #A79DB8;
            font-weight: 600;
            font-size: 0.85rem;
            white-space: nowrap;
          }
          .history-badge-city i { color: #A79DB8; flex-shrink: 0; }
          .history-action-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 38px;
            padding: 0 16px;
            border-radius: var(--radius-md, 6px);
            font-weight: 700;
            font-size: 0.85rem;
            font-family: inherit;
            cursor: pointer;
            transition: filter 0.15s ease, transform 0.15s ease;
          }
          .history-action-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
          .history-action-btn:active { transform: translateY(0); filter: brightness(0.95); }
          .history-export-btn { background: #5CA47F; border: 1px solid #5CA47F; color: var(--bg-base, #16223D); }
          .history-delete-btn-visual { width: 38px; padding: 0; background: #D9695C; border: 1px solid #D9695C; color: var(--bg-base, #16223D); }
        </style>
        <div style="display:flex;flex-direction:column;gap:24px;">
      `;

      history.forEach((item, index) => {
        const totalBultos = (item.packages && item.packages.length > 0)
          ? item.packages.reduce((s, p) => s + (parseInt(p.bultos) || 1), 0)
          : (item.count || 0);
        const dateLabel = item.dateLabel ? item.dateLabel.charAt(0).toUpperCase() + item.dateLabel.slice(1) : '';
        const isLatest = index === 0 && history.length > 1;

        html += `
          <div class="card history-item-card${isLatest ? ' history-item-card--latest' : ''}">
            <div class="history-card-header">
              <div>
                ${isLatest ? '<p class="history-latest-tag">Cierre más reciente</p>' : ''}
                <h3 class="history-date-title"><i data-lucide="calendar" style="width:17px;height:17px;"></i> ${_esc(dateLabel)}</h3>
              </div>
              <div class="history-header-actions">
                <button class="export-history-csv-btn history-action-btn history-export-btn" data-id="${item.id}">
                  <i data-lucide="download" style="width:16px;height:16px;"></i> Exportar Excel
                </button>
                <button class="delete-history-btn history-action-btn history-delete-btn-visual" data-id="${item.id}" title="Eliminar registro histórico">
                  <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
              </div>
            </div>

            <div class="history-stats-row">
              <div class="history-stat">
                <span class="history-stat-label">Paquetes</span>
                <strong class="history-stat-value">${totalBultos}</strong>
              </div>
              <div class="history-stat">
                <span class="history-stat-label">Peso</span>
                <strong class="history-stat-value history-stat-value--weight">${item.weight.toFixed(1)} <small>kg</small></strong>
              </div>
              <div class="history-stat history-stat--money">
                <span class="history-stat-label">Entregar al Jefe</span>
                <strong class="history-stat-value history-stat-value--money">${item.money.toFixed(2)} €</strong>
              </div>
            </div>

            <details>
              <summary class="history-summary-toggle">
                <i data-lucide="chevron-down" class="history-detail-chevron"></i>
                Ver detalle de paquetes
              </summary>
              <div class="history-table-wrap" style="overflow-x:auto;">
                <table class="history-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Destinatario</th>
                      <th>Localidad</th>
                      <th style="text-align:center;">Bultos</th>
                      <th>Peso</th>
                      <th style="text-align:right;">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${item.packages.map(p => `
                      <tr>
                        <td class="history-cell-id">${_esc(p.id)}</td>
                        <td class="history-cell-recipient">${_esc(p.destinatario)}</td>
                        <td><span class="history-badge-city"><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${_esc(p.localidadDestinatario)}</span></td>
                        <td class="history-cell-numeric">${p.bultos}</td>
                        <td class="history-cell-weight">${parseFloat(p.weight).toFixed(1)} kg</td>
                        <td class="history-cell-price">${parseFloat(p.price).toFixed(2)} €</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
      lucide.createIcons({ nodes: [container] });

      container.querySelectorAll('.export-history-csv-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const item = StorageService.getHistory().find(h => h.id === id);
          if (!item) return;

          let csvContent = "\uFEFF";
          csvContent += "Destinatario;Localidad Destinatario;Bultos;Peso (kg);Expedidor;Localidad Expedidor;Precio (€)\r\n";
          item.packages.forEach(p => {
            csvContent += `"${p.destinatario.replace(/"/g, '""')}";"${p.localidadDestinatario.replace(/"/g, '""')}";"${p.bultos}";"${parseFloat(p.weight).toFixed(2).replace(/\./g, ',')}";"${p.expedidor.replace(/"/g, '""')}";"${p.localidadExpedidor.replace(/"/g, '""')}";"${parseFloat(p.price).toFixed(2).replace(/\./g, ',')}"\r\n`;
          });

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `historico_${item.id}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      });

      container.querySelectorAll('.delete-history-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const history = StorageService.getHistory();
          const item = history.find(h => h.id === id);
          if (!item) return;

          const confirmed = await showConfirmModal({
            title: '¿Eliminar registro histórico?',
            itemName: item.dateLabel || 'Registro de Fin de Semana',
            message: 'Se eliminará permanentemente de los archivos históricos.',
            confirmText: 'Eliminar Histórico'
          });

          if (!confirmed) return;

          const updated = history.filter(h => h.id !== id);
          StorageService.saveHistory(updated);
          await SupabaseService.deleteHistoryItem(id).catch(() => {});
          renderHistoryView();
          EventBus.emit(EV.TOAST, { type: 'info', message: 'Registro histórico eliminado.' });
        });
      });
    }

    // ── PWA SERVICE WORKER & INSTALL PROMPT ──────────────────────
    let deferredPwaPrompt = null;
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('[PWA] ServiceWorker registrado:', reg.scope);
        }).catch(err => {
          console.warn('[PWA] Error al registrar ServiceWorker:', err);
        });
      });
    }

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPwaPrompt = e;
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn) installBtn.style.display = 'flex';
    });

    document.getElementById('pwa-install-btn')?.addEventListener('click', () => {
      if (!deferredPwaPrompt) return;
      deferredPwaPrompt.prompt();
      deferredPwaPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          EventBus.emit(EV.TOAST, { type: 'success', message: '🎉 ¡App instalada en tu dispositivo!' });
          document.getElementById('pwa-install-btn').style.display = 'none';
        }
        deferredPwaPrompt = null;
      });
    });
    
    // ── Interactive Route Map Logic ──
    const btnRouteEsRo = document.getElementById('btn-route-es-ro');
    const btnRouteRoEs = document.getElementById('btn-route-ro-es');
    const vanGroup = document.getElementById('van-group');
    const routeStatusText = document.getElementById('route-status-text');

    const routeCheckpoints = [
      { time: 0, msg: "Saliendo de Alcalá de Henares (ES)..." },
      { time: 3000, msg: "Cruzando el Sur de Francia..." },
      { time: 8000, msg: "Atravesando el Norte de Italia (Trieste)..." },
      { time: 12000, msg: "Pasando por Eslovenia..." },
      { time: 16000, msg: "Cruzando Hungría..." },
      { time: 20000, msg: "Llegando a Sebeș (RO)." }
    ];

    let routeTimeoutIds = [];
    
    function playRouteAnimation(direction) {
      if (!vanGroup || !routeStatusText) return;
      
      // Clear previous timeouts
      routeTimeoutIds.forEach(id => clearTimeout(id));
      routeTimeoutIds = [];
      
      vanGroup.classList.remove('animate-forward', 'animate-backward');
      // Trigger reflow to restart animation
      void vanGroup.offsetWidth;
      
      if (direction === 'forward') {
        vanGroup.classList.add('animate-forward');
        routeCheckpoints.forEach(cp => {
          const id = setTimeout(() => {
            routeStatusText.textContent = cp.msg;
          }, cp.time);
          routeTimeoutIds.push(id);
        });
      } else {
        vanGroup.classList.add('animate-backward');
        const reversed = [...routeCheckpoints].reverse();
        reversed.forEach((cp, idx) => {
          const originalTime = cp.time;
          const invertedTime = 20000 - originalTime; // 20s total duration
          let msg = cp.msg;
          if (idx === 0) msg = "Saliendo de Sebeș (RO)...";
          if (idx === reversed.length - 1) msg = "Llegando a Alcalá de Henares (ES).";
          
          const id = setTimeout(() => {
            routeStatusText.textContent = msg;
          }, invertedTime);
          routeTimeoutIds.push(id);
        });
      }
    }

    btnRouteEsRo?.addEventListener('click', () => playRouteAnimation('forward'));
    btnRouteRoEs?.addEventListener('click', () => playRouteAnimation('backward'));

    // Bootstrap
    syncClientsFromPackages(StorageService.getPackages());
    renderDatalists();
    renderRatesList();
    window.navigateTo('dashboard');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    console.log('%cNC Caliman — Weekend Workflow Active', 'color:#10b981;font-size:14px;font-weight:bold');