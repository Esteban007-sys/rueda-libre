/* ==========================================================================
   CONTROL DE TEMA COMPARTIDO (TEMA CLARO / TEMA OSCURO)
   Este script controla el interruptor de sol y luna en TODAS las páginas
   (Rueda Libre y Rueda Nocturna), guarda la elección en localStorage y
   respeta automáticamente la configuración del sistema operativo.
   ========================================================================== */
(function () {
    'use strict';

    /* Claves usadas en localStorage para recordar la elección del usuario */
    var STORAGE_KEY = 'rueda-tema';
    var LEGACY_KEY = 'rueda-nocturna-tema';

    /* Referencia a la etiqueta raíz <html> y a la preferencia del sistema */
    var root = document.documentElement;
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    /* Devuelve el tema guardado ("dark" o "light"), o null si no existe */
    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    }

    /* Indica si el tema oscuro está activo actualmente */
    function isDarkActive() {
        return (
            root.classList.contains('dark') ||
            (!root.classList.contains('light') && mediaQuery.matches)
        );
    }

    /* Actualiza data-bs-theme (Bootstrap) y aria-checked (accesibilidad) */
    function syncUI() {
        var dark = isDarkActive();
        root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');

        document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach(function (btn) {
            btn.setAttribute('aria-checked', String(dark));
        });
    }

    /* Aplica las clases .dark o .light en <html> según el tema elegido */
    function applyTheme(theme) {
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('light', theme === 'light');
        syncUI();
    }

    /* Inicializa el estado y registra los eventos del interruptor */
    function init() {
        var saved = getSavedTheme();
        if (saved === 'dark' || saved === 'light') {
            applyTheme(saved);
        } else {
            syncUI();
        }

        /* Al hacer clic en el interruptor se alterna y guarda el nuevo tema */
        document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var nextTheme = isDarkActive() ? 'light' : 'dark';
                localStorage.setItem(STORAGE_KEY, nextTheme);
                localStorage.setItem(LEGACY_KEY, nextTheme);
                applyTheme(nextTheme);
            });
        });

        /* Si cambia el tema del sistema operativo y no hay tema manual, se actualiza */
        if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', function () {
                if (!getSavedTheme()) {
                    syncUI();
                }
            });
        }

        /* Sincroniza el cambio de tema entre pestañas abiertas del mismo sitio */
        window.addEventListener('storage', function (event) {
            if (event.key === STORAGE_KEY || event.key === LEGACY_KEY) {
                applyTheme(getSavedTheme());
            }
        });
    }

    /* Ejecuta la inicialización en cuanto el documento HTML esté listo */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
