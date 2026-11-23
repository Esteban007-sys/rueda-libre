/* ==========================================================================
   CLIENTE API Y TIEMPO REAL (SSE) - RUEDA LIBRE
   Conecta las vistas estáticas (catálogo, flota, tarifas y reservas) con el
   backend en http://localhost:3000/api respetando los estilos de Bootstrap.
   ========================================================================== */
(function (window) {
    'use strict';

    /* URL base de la API REST de Rueda Libre */
    var API_BASE = 'http://localhost:3000/api';

    /* Metadatos visuales locales por slug para conservar las imágenes y descripciones de marca */
    var BICI_META = {
        'urbana-clasica': {
            img: 'img/urbanaclasica.jpg',
            desc: 'Cómoda y liviana para las ciclorrutas.',
            nuevo: false,
        },
        'urbana-plegable': {
            img: 'img/urbanaplegable.png',
            desc: 'Se dobla en segundos; ideal para combinar con el metro.',
            nuevo: false,
        },
        'montana-trail': {
            img: 'img/carreras.jpg',
            desc: 'Suspensión delantera y 21 cambios para las subidas.',
            nuevo: false,
        },
        'gravel-aventura': {
            img: 'img/gravel.png',
            desc: 'Para rutas mixtas de asfalto y destapado.',
            nuevo: false,
        },
        'electrica-urbana': {
            img: 'img/electricau.jpg',
            desc: 'Asistencia eléctrica con 45 km de autonomía.',
            nuevo: true,
        },
        'infantil': {
            img: 'img/bici4.jpg',
            desc: 'Para niños de 6 a 10 años.',
            nuevo: false,
        },
        'tandem': {
            img: 'img/ten.jpg',
            desc: 'Para dos personas; perfecta para pasear en pareja.',
            nuevo: false,
        },
    };

    var RECORRIDO_META = {
        'rio-y-parques': {
            img: 'img/rios.jpg',
            desc: 'Recorrido plano y relajante por los senderos verdes.',
        },
        'sabores-de-barrio': {
            img: 'img/barrio.jpg',
            desc: 'Recorrido cultural y gastronómico por barrios tradicionales.',
        },
        'reto-las-palmas': {
            img: 'img/palmas.jpeg',
            desc: 'Ascenso exigente de montaña con vistas panorámicas únicas.',
        },
        'rueda-nocturna': {
            img: 'nocturna/img/rodada-nocturna.jpg',
            desc: 'Pedalea en las noches con Rueda Libre y descubre Medellín iluminado en recorridos guiados con luces y chaleco reflectivo.',
            esCampana: true,
        },
    };

    /* Formatea valores numéricos en pesos colombianos (ej: $10.000) */
    function formatCOP(valor) {
        var numero = Number(valor || 0);
        return '$' + numero.toLocaleString('es-CO');
    }

    /* Escapa texto antes de inyectarlo en plantillas HTML para evitar XSS */
    function escapeHtml(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* Devuelve el nombre legible del plan */
    function formatPlan(plan) {
        var mapa = {
            '1hora': '1 hora',
            'mediodia': 'Medio día (4 h)',
            'diacompleto': 'Día completo',
        };
        return mapa[plan] || plan || 'Sin plan';
    }

    /* Devuelve la clase Bootstrap de badge según el nivel del recorrido */
    function getNivelBadgeClass(nivel) {
        var limpio = String(nivel || '').toLowerCase();
        if (limpio.includes('fácil') || limpio.includes('facil')) return 'text-bg-success';
        if (limpio.includes('medio')) return 'text-bg-warning';
        if (limpio.includes('difícil') || limpio.includes('dificil')) return 'text-bg-danger';
        return 'text-bg-secondary';
    }

    /* Devuelve clase e ícono del badge de stock disponible */
    function renderStockBadge(disponible, total) {
        var disp = Number(disponible ?? 0);
        var tot = Number(total ?? disp);
        if (disp <= 0) {
            return '<span class="badge text-bg-danger fw-semibold">Sin stock</span>';
        }
        var badgeClass = disp <= 2 ? 'text-bg-warning' : 'text-bg-success';
        return '<span class="badge ' + badgeClass + ' fw-semibold">' + disp + ' / ' + tot + ' disponibles</span>';
    }

    /* Petición genérica JSON con manejo consistente de errores HTTP */
    async function requestJson(endpoint, options) {
        var response = await fetch(API_BASE + endpoint, options);
        var payload = null;
        try {
            payload = await response.json();
        } catch (_e) {
            payload = null;
        }

        if (!response.ok || (payload && payload.ok === false)) {
            var message = (payload && payload.error) || ('Error HTTP ' + response.status);
            var err = new Error(message);
            err.status = response.status;
            throw err;
        }

        return payload;
    }

    /* GET /api/catalogo */
    async function fetchCatalogo() {
        var res = await requestJson('/catalogo');
        return res.data;
    }

    /* POST /api/reservas */
    async function crearReserva(body) {
        var res = await requestJson('/reservas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.data;
    }

    /* GET /api/reservas/:codigo */
    async function consultarReserva(codigo) {
        var limpio = encodeURIComponent(String(codigo || '').trim());
        var res = await requestJson('/reservas/' + limpio);
        return res.data;
    }

    /* GET /api/stream/ventas (Server-Sent Events) */
    function conectarStreamVentas(handlers) {
        if (typeof window.EventSource === 'undefined') {
            return null;
        }

        var source = new EventSource(API_BASE + '/stream/ventas');

        source.addEventListener('connected', function (event) {
            if (handlers && typeof handlers.onConnected === 'function') {
                try {
                    handlers.onConnected(JSON.parse(event.data));
                } catch (_e) {
                    handlers.onConnected({ message: event.data });
                }
            }
        });

        source.addEventListener('nueva_reserva', function (event) {
            if (handlers && typeof handlers.onNuevaReserva === 'function') {
                try {
                    handlers.onNuevaReserva(JSON.parse(event.data));
                } catch (_e) {
                    /* Ignora mensajes malformados */
                }
            }
        });

        source.onerror = function (err) {
            if (handlers && typeof handlers.onError === 'function') {
                handlers.onError(err);
            }
        };

        return source;
    }

    /* ----------------------------------------------------------------------
       RENDERIZADO DE VISTAS CON DATOS EN VIVO DE /api/catalogo
       ---------------------------------------------------------------------- */

    /* Renderiza tarjetas de flota (usado en index.html y paginas/flota.html) */
    function renderFlota(container, bicicletas, isSubpage) {
        if (!container || !Array.isArray(bicicletas) || bicicletas.length === 0) return;

        var prefix = isSubpage ? '../' : '';
        var reservaUrl = isSubpage ? 'reservas.html' : 'paginas/reservas.html';

        container.innerHTML = bicicletas.map(function (bici) {
            var meta = BICI_META[bici.slug] || {
                img: 'img/urbanaclasica.jpg',
                desc: 'Bicicleta tipo ' + bici.tipo + ' lista para rodar.',
                nuevo: false,
            };
            var sinStock = Number(bici.stock_disponible) <= 0;
            var badgeNuevo = meta.nuevo
                ? '<span class="badge text-bg-success position-absolute top-0 end-0 m-2 text-uppercase">Nuevo</span>'
                : '';

            return (
                '<div class="col" data-bici-slug="' + escapeHtml(bici.slug) + '">' +
                    '<article class="card h-100 border-2 rounded-4 overflow-hidden bg-body-tertiary tarjeta-hover text-center p-3 position-relative">' +
                        badgeNuevo +
                        '<img src="' + prefix + meta.img + '" alt="Bicicleta ' + escapeHtml(bici.modelo) + '" class="img-tarjeta object-fit-contain w-100 p-3 bg-body rounded">' +
                        '<div class="card-body d-flex flex-column p-2">' +
                            '<h3 class="h5 fw-bold mb-1">' + escapeHtml(bici.modelo) + '</h3>' +
                            '<p class="small text-secondary mb-2">' + escapeHtml(meta.desc) + '</p>' +
                            '<p class="mb-2" data-stock-badge>' + renderStockBadge(bici.stock_disponible, bici.stock_total) + '</p>' +
                            '<p class="text-primary fw-bold fs-5 my-2">' + formatCOP(bici.precio_1hora) + ' / hora</p>' +
                            '<a href="' + reservaUrl + '?bicicleta=' + encodeURIComponent(bici.slug) + '" class="btn btn-primary rounded-pill fw-bold mt-auto' + (sinStock ? ' disabled' : '') + '"' + (sinStock ? ' aria-disabled="true"' : '') + '>' +
                                (sinStock ? 'Agotada' : 'Reservar') +
                            '</a>' +
                        '</div>' +
                    '</article>' +
                '</div>'
            );
        }).join('');
    }

    /* Actualiza el badge de stock de una bici específica al llegar un evento SSE */
    function actualizarStockEnDom(bicicletaEvento) {
        if (!bicicletaEvento || !bicicletaEvento.slug) return;
        var nodos = document.querySelectorAll('[data-bici-slug="' + bicicletaEvento.slug + '"]');
        nodos.forEach(function (cardCol) {
            var stockEl = cardCol.querySelector('[data-stock-badge]');
            if (stockEl && bicicletaEvento.stock_disponible_actual !== undefined) {
                var actual = Number(bicicletaEvento.stock_disponible_actual);
                var badgeClass = actual <= 0 ? 'text-bg-danger' : (actual <= 2 ? 'text-bg-warning' : 'text-bg-success');
                var label = actual <= 0 ? 'Sin stock' : (actual + ' disponibles');
                stockEl.innerHTML = '<span class="badge ' + badgeClass + ' fw-semibold">' + label + '</span>';
            }
        });
    }

    /* Renderiza las tarjetas de rutas guiadas en index.html */
    function renderRutasIndex(container, recorridos) {
        if (!container || !Array.isArray(recorridos) || recorridos.length === 0) return;

        container.innerHTML = recorridos.map(function (rec) {
            var meta = RECORRIDO_META[rec.slug] || {
                img: 'img/rios.jpg',
                desc: 'Recorrido guiado por Medellín con acompañamiento profesional.',
                esCampana: rec.modalidad === 'nocturno',
            };
            var km = Number(rec.distancia_km);
            var hrs = Number(rec.duracion_horas);

            if (meta.esCampana) {
                return (
                    '<div class="col-12 col-md-6 col-lg-3">' +
                        '<article class="card h-100 rounded-4 overflow-hidden bg-body-tertiary tarjeta-hover tarjeta-campana">' +
                            '<img src="' + meta.img + '" alt="Ciclistas en ' + escapeHtml(rec.nombre) + '" class="card-img-top img-tarjeta object-fit-cover">' +
                            '<div class="card-body d-flex flex-column text-center p-4">' +
                                '<h3 class="card-title h4 fw-bold">' + escapeHtml(rec.nombre) + '</h3>' +
                                '<p class="mb-2"><span class="badge badge-campana fw-bold px-3 py-1">Campaña</span></p>' +
                                '<p class="card-text text-secondary mb-2">' + escapeHtml(meta.desc) + '</p>' +
                                '<p class="small fw-semibold text-primary mb-4">Desde ' + formatCOP(rec.precio_persona) + ' · ' + rec.cupos_diarios + ' cupos/día</p>' +
                                '<a href="nocturna/index.html" class="btn btn-campana rounded-pill fw-bold mt-auto">' +
                                    '<i class="bi bi-moon-stars-fill" aria-hidden="true"></i> Ir a Rueda Nocturna' +
                                '</a>' +
                            '</div>' +
                        '</article>' +
                    '</div>'
                );
            }

            return (
                '<div class="col-12 col-md-6 col-lg-3">' +
                    '<article class="card h-100 border-2 rounded-4 overflow-hidden bg-body-tertiary tarjeta-hover shadow-sm">' +
                        '<img src="' + meta.img + '" alt="Ruta ' + escapeHtml(rec.nombre) + '" class="card-img-top img-tarjeta object-fit-cover">' +
                        '<div class="card-body d-flex flex-column text-center p-4">' +
                            '<h3 class="card-title h4 fw-bold">' + escapeHtml(rec.nombre) + '</h3>' +
                            '<p class="mb-2"><span class="badge ' + getNivelBadgeClass(rec.nivel) + ' fw-bold px-2 py-1">Nivel: ' + escapeHtml(rec.nivel) + '</span></p>' +
                            '<p class="card-text text-secondary mb-2">' + km + ' km · ' + hrs + ' h. ' + escapeHtml(meta.desc) + '</p>' +
                            '<p class="small fw-semibold text-primary mb-4">' + formatCOP(rec.precio_persona) + ' / persona</p>' +
                            '<a href="paginas/reservas.html?recorrido=' + encodeURIComponent(rec.slug) + '" class="btn btn-primary rounded-pill fw-bold mt-auto">Reservar ruta</a>' +
                        '</div>' +
                    '</article>' +
                '</div>'
            );
        }).join('');
    }

    /* Renderiza las tablas de tarifas y recorridos en paginas/tarifas.html */
    function renderTablasTarifas(tbodyTarifas, tbodyRecorridos, catalogo) {
        if (tbodyTarifas && Array.isArray(catalogo.bicicletas)) {
            tbodyTarifas.innerHTML = catalogo.bicicletas.map(function (bici) {
                return (
                    '<tr>' +
                        '<th scope="row">' +
                            escapeHtml(bici.modelo) +
                            ' <span class="badge text-bg-secondary ms-1 text-capitalize">' + escapeHtml(bici.tipo) + '</span>' +
                        '</th>' +
                        '<td><span class="fw-bold text-primary">' + formatCOP(bici.precio_1hora) + '</span></td>' +
                        '<td><span class="fw-bold text-primary">' + formatCOP(bici.precio_mediodia) + '</span></td>' +
                        '<td><span class="fw-bold text-primary">' + formatCOP(bici.precio_diacompleto) + '</span></td>' +
                    '</tr>'
                );
            }).join('');
        }

        if (tbodyRecorridos && Array.isArray(catalogo.recorridos)) {
            tbodyRecorridos.innerHTML = catalogo.recorridos.map(function (rec) {
                var badgeNivel = rec.modalidad === 'nocturno'
                    ? '<span class="badge badge-campana fw-bold">Nocturno · ' + escapeHtml(rec.nivel) + '</span>'
                    : '<span class="badge ' + getNivelBadgeClass(rec.nivel) + ' fw-bold">' + escapeHtml(rec.nivel) + '</span>';

                return (
                    '<tr>' +
                        '<th scope="row">' + escapeHtml(rec.nombre) + '</th>' +
                        '<td>' + Number(rec.distancia_km) + ' km</td>' +
                        '<td>' + Number(rec.duracion_horas) + ' h</td>' +
                        '<td>' + badgeNivel + '</td>' +
                        '<td><span class="fw-bold text-primary fs-6">' + formatCOP(rec.precio_persona) + '</span></td>' +
                    '</tr>'
                );
            }).join('');
        }

        var promoBox = document.getElementById('promo-api-info');
        if (promoBox && Array.isArray(catalogo.promociones) && catalogo.promociones.length > 0) {
            promoBox.innerHTML =
                '<i class="bi bi-lightning-charge-fill fs-4 text-warning" aria-hidden="true"></i>' +
                '<p class="mb-0"><strong>Promoción activa:</strong> ' + escapeHtml(catalogo.promociones[0].descripcion) + '.</p>';
            promoBox.classList.remove('d-none');
        }
    }

    /* Muestra una notificación flotante discreta cuando entra una venta por SSE */
    function mostrarNotificacionVenta(evento) {
        var toastContainer = document.getElementById('sse-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'sse-toast-container';
            toastContainer.className = 'position-fixed bottom-0 start-0 p-3';
            toastContainer.style.zIndex = '1080';
            document.body.appendChild(toastContainer);
        }

        var codigo = (evento.reserva && evento.reserva.codigo_reserva) || 'Nueva reserva';
        var item = (evento.bicicleta && evento.bicicleta.modelo) ||
            (evento.recorrido && evento.recorrido.nombre) ||
            'Alquiler Rueda Libre';
        var total = evento.resumen_pago ? formatCOP(evento.resumen_pago.total_cop) : '';

        var alerta = document.createElement('div');
        alerta.className = 'alert alert-success border shadow d-flex align-items-center gap-2 mb-2 py-2 px-3 small';
        alerta.setAttribute('role', 'status');
        alerta.innerHTML =
            '<i class="bi bi-broadcast text-success fs-5" aria-hidden="true"></i>' +
            '<div>' +
                '<strong class="d-block">Reserva en vivo · ' + escapeHtml(codigo) + '</strong>' +
                '<span>' + escapeHtml(item) + (total ? ' · ' + total : '') + '</span>' +
            '</div>';

        toastContainer.appendChild(alerta);
        window.setTimeout(function () {
            alerta.remove();
        }, 6500);
    }

    /* ----------------------------------------------------------------------
       INICIALIZACIÓN DE LA PÁGINA DE RESERVAS (POST, CONSULTA Y SSE)
       ---------------------------------------------------------------------- */
    function initPaginaReservas(catalogo) {
        var form = document.getElementById('form-reserva');
        if (!form) return;

        var selectSedeRetiro = document.getElementById('sede-retiro');
        var selectSedeDevolucion = document.getElementById('sede-devolucion');
        var selectBicicleta = document.getElementById('bicicleta');
        var selectRecorrido = document.getElementById('recorrido');
        var inputFecha = document.getElementById('fecha');
        var inputCantidad = document.getElementById('cantidad');
        var resumenPrecio = document.getElementById('resumen-estimado');
        var resultadoBox = document.getElementById('reserva-resultado');
        var errorBox = document.getElementById('reserva-error');
        var btnEnviar = document.getElementById('btn-enviar-reserva');

        /* Pobla los selectores dinámicos con datos reales de /api/catalogo */
        function poblarSelectores(data) {
            if (selectSedeRetiro && Array.isArray(data.sedes)) {
                var prevRetiro = selectSedeRetiro.value;
                selectSedeRetiro.innerHTML = data.sedes.map(function (sede) {
                    var tag = sede.es_principal ? ' (Principal)' : '';
                    return '<option value="' + sede.id + '">' + escapeHtml(sede.nombre + tag) + '</option>';
                }).join('');
                if (prevRetiro) selectSedeRetiro.value = prevRetiro;
            }

            if (selectSedeDevolucion && Array.isArray(data.sedes)) {
                var prevDev = selectSedeDevolucion.value;
                selectSedeDevolucion.innerHTML =
                    '<option value="">Misma sede de retiro</option>' +
                    data.sedes.map(function (sede) {
                        return '<option value="' + sede.id + '">' + escapeHtml(sede.nombre) + '</option>';
                    }).join('');
                if (prevDev) selectSedeDevolucion.value = prevDev;
            }

            if (selectBicicleta && Array.isArray(data.bicicletas)) {
                var prevBici = selectBicicleta.value;
                selectBicicleta.innerHTML =
                    '<option value="">Sin preferencia (según tipo elegido)</option>' +
                    data.bicicletas.map(function (bici) {
                        var disp = Number(bici.stock_disponible);
                        return (
                            '<option value="' + escapeHtml(bici.slug) + '" data-tipo="' + escapeHtml(bici.tipo) + '"' + (disp <= 0 ? ' disabled' : '') + '>' +
                                escapeHtml(bici.modelo) + ' (' + formatCOP(bici.precio_1hora) + '/h · ' + disp + ' disp.)' +
                            '</option>'
                        );
                    }).join('');
                if (prevBici) selectBicicleta.value = prevBici;
            }

            if (selectRecorrido && Array.isArray(data.recorridos)) {
                var prevRec = selectRecorrido.value;
                selectRecorrido.innerHTML =
                    '<option value="ninguno">Ninguno (solo alquiler de bicicleta)</option>' +
                    data.recorridos.map(function (rec) {
                        return (
                            '<option value="' + escapeHtml(rec.slug) + '">' +
                                escapeHtml(rec.nombre) + ' · ' + formatCOP(rec.precio_persona) + '/persona' +
                            '</option>'
                        );
                    }).join('');
                if (prevRec) selectRecorrido.value = prevRec;
            }
        }

        if (catalogo) {
            poblarSelectores(catalogo);
        }

        /* Establece la fecha mínima sugerida a hoy si el campo está vacío */
        if (inputFecha && !inputFecha.value) {
            var hoy = new Date();
            var yyyy = hoy.getFullYear();
            var mm = String(hoy.getMonth() + 1).padStart(2, '0');
            var dd = String(hoy.getDate()).padStart(2, '0');
            inputFecha.value = yyyy + '-' + mm + '-' + dd;
        }

        /* Preselecciona bicicleta o recorrido si vienen en los parámetros de la URL */
        var params = new URLSearchParams(window.location.search);
        var biciParam = params.get('bicicleta');
        var recParam = params.get('recorrido');

        if (biciParam && selectBicicleta) {
            selectBicicleta.value = biciParam;
            var opt = selectBicicleta.options[selectBicicleta.selectedIndex];
            var tipo = opt && opt.getAttribute('data-tipo');
            if (tipo) {
                var radioTipo = form.querySelector('input[name="tipo_bicicleta"][value="' + tipo + '"]');
                if (radioTipo) radioTipo.checked = true;
            }
        }

        if (recParam && selectRecorrido) {
            selectRecorrido.value = recParam;
        }

        /* Calcula un estimado visual del costo total usando los precios del catálogo */
        function actualizarEstimado() {
            if (!resumenPrecio || !catalogo) return;

            var cantidad = Math.max(1, parseInt(inputCantidad && inputCantidad.value, 10) || 1);
            var planEl = form.querySelector('input[name="plan_alquiler"]:checked');
            var tipoEl = form.querySelector('input[name="tipo_bicicleta"]:checked');
            var plan = planEl ? planEl.value : '1hora';
            var biciSlug = selectBicicleta ? selectBicicleta.value : '';
            var recSlug = selectRecorrido ? selectRecorrido.value : 'ninguno';

            var bici = null;
            if (biciSlug) {
                bici = catalogo.bicicletas.find(function (b) { return b.slug === biciSlug; });
            } else if (tipoEl) {
                bici = catalogo.bicicletas.find(function (b) { return b.tipo === tipoEl.value; });
            }

            var rec = recSlug && recSlug !== 'ninguno'
                ? catalogo.recorridos.find(function (r) { return r.slug === recSlug; })
                : null;

            if (!bici && !rec) {
                resumenPrecio.classList.add('d-none');
                return;
            }

            var colMap = { '1hora': 'precio_1hora', 'mediodia': 'precio_mediodia', 'diacompleto': 'precio_diacompleto' };
            var subBici = bici ? Number(bici[colMap[plan]] || 0) * cantidad : 0;
            var subRec = rec ? Number(rec.precio_persona || 0) * cantidad : 0;

            /* Verifica descuento del 20% para bicis eléctricas de lunes a jueves */
            var descuento = 0;
            if (bici && bici.tipo === 'electrica' && inputFecha && /^\d{4}-\d{2}-\d{2}$/.test(inputFecha.value)) {
                var parts = inputFecha.value.split('-').map(Number);
                var dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
                if (dow >= 1 && dow <= 4) {
                    descuento = Math.round(subBici * 0.2);
                }
            }

            var total = Math.max(0, subBici + subRec - descuento);
            resumenPrecio.innerHTML =
                '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">' +
                    '<span><strong>Total estimado (' + cantidad + ' ' + (cantidad === 1 ? 'unidad' : 'unidades') + '):</strong>' +
                    (descuento > 0 ? ' <span class="badge text-bg-success ms-1">-20% Eléctrica Lun-Jue</span>' : '') + '</span>' +
                    '<span class="fs-5 fw-bold text-primary">' + formatCOP(total) + '</span>' +
                '</div>';
            resumenPrecio.classList.remove('d-none');
        }

        /* Al elegir un modelo específico, sincroniza el radio de tipo si coincide */
        if (selectBicicleta) {
            selectBicicleta.addEventListener('change', function () {
                var opt = selectBicicleta.options[selectBicicleta.selectedIndex];
                var tipo = opt && opt.getAttribute('data-tipo');
                if (tipo) {
                    var radio = form.querySelector('input[name="tipo_bicicleta"][value="' + tipo + '"]');
                    if (radio) radio.checked = true;
                }
                actualizarEstimado();
            });
        }

        form.addEventListener('change', actualizarEstimado);
        form.addEventListener('input', actualizarEstimado);
        actualizarEstimado();

        /* Envío real del formulario a POST /api/reservas */
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (errorBox) errorBox.classList.add('d-none');
            if (resultadoBox) resultadoBox.classList.add('d-none');

            /* Si el usuario eligió un modelo específico (como infantil o tándem), no forzamos radio si no hay coincidencia */
            var tipoChecked = form.querySelector('input[name="tipo_bicicleta"]:checked');
            var planChecked = form.querySelector('input[name="plan_alquiler"]:checked');

            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }
            form.classList.add('was-validated');

            var payload = {
                nombre_completo: document.getElementById('nombre').value.trim(),
                documento: document.getElementById('documento').value.trim(),
                celular: document.getElementById('celular').value.trim(),
                email: document.getElementById('email').value.trim(),
                fecha_alquiler: inputFecha.value,
                cantidad: parseInt(inputCantidad.value, 10),
                sede_retiro_id: Number(selectSedeRetiro.value),
                sede_devolucion_id: selectSedeDevolucion.value ? Number(selectSedeDevolucion.value) : Number(selectSedeRetiro.value),
                plan: planChecked ? planChecked.value : '1hora',
                comentarios: document.getElementById('comentarios').value.trim() || null,
                acepto_politicas: document.getElementById('politicas').checked,
                canal: 'web',
            };

            if (selectBicicleta && selectBicicleta.value) {
                payload.bicicleta_slug = selectBicicleta.value;
            } else if (tipoChecked) {
                payload.tipo_bicicleta = tipoChecked.value;
            }

            if (selectRecorrido && selectRecorrido.value && selectRecorrido.value !== 'ninguno') {
                payload.recorrido_slug = selectRecorrido.value;
            }

            var textoOriginal = btnEnviar ? btnEnviar.innerHTML : '';
            if (btnEnviar) {
                btnEnviar.disabled = true;
                btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Procesando reserva...';
            }

            try {
                var data = await crearReserva(payload);
                var codigo = data.reserva.codigo_reserva;
                var pago = data.resumen_pago;

                if (resultadoBox) {
                    resultadoBox.innerHTML =
                        '<div class="d-flex align-items-start gap-3">' +
                            '<i class="bi bi-check-circle-fill fs-3 text-success" aria-hidden="true"></i>' +
                            '<div class="flex-grow-1">' +
                                '<h3 class="h5 fw-bold mb-1">¡Reserva confirmada!</h3>' +
                                '<p class="mb-2">Guarda tu código de reserva para consultarla en cualquier momento:</p>' +
                                '<p class="fs-4 fw-bold text-primary mb-2">' + escapeHtml(codigo) + '</p>' +
                                '<ul class="list-unstyled small mb-2">' +
                                    '<li><strong>Cliente:</strong> ' + escapeHtml(data.cliente.nombre_completo) + '</li>' +
                                    (data.bicicleta ? '<li><strong>Bicicleta:</strong> ' + escapeHtml(data.bicicleta.modelo) + ' (' + formatPlan(data.reserva.plan) + ')</li>' : '') +
                                    (data.recorrido ? '<li><strong>Recorrido:</strong> ' + escapeHtml(data.recorrido.nombre) + '</li>' : '') +
                                    '<li><strong>Fecha:</strong> ' + escapeHtml(String(data.reserva.fecha_alquiler).slice(0, 10)) + ' · <strong>Cantidad:</strong> ' + data.reserva.cantidad + '</li>' +
                                    (pago.descuento_cop > 0 ? '<li class="text-success"><strong>Descuento aplicado:</strong> -' + formatCOP(pago.descuento_cop) + '</li>' : '') +
                                    '<li><strong>Total a pagar:</strong> <span class="fw-bold">' + formatCOP(pago.total_cop) + '</span></li>' +
                                '</ul>' +
                            '</div>' +
                        '</div>';
                    resultadoBox.classList.remove('d-none');
                    resultadoBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                /* Prellena el buscador de consulta con el código recién creado */
                var inputConsulta = document.getElementById('codigo-consulta');
                if (inputConsulta) inputConsulta.value = codigo;

                form.reset();
                form.classList.remove('was-validated');
                if (resumenPrecio) resumenPrecio.classList.add('d-none');

                /* Recarga catálogo para reflejar el nuevo stock disponible */
                try {
                    catalogo = await fetchCatalogo();
                    poblarSelectores(catalogo);
                } catch (_err) {
                    /* Mantiene los valores actuales si falla el refresco */
                }
            } catch (err) {
                if (errorBox) {
                    errorBox.innerHTML =
                        '<i class="bi bi-exclamation-triangle-fill me-2" aria-hidden="true"></i>' +
                        '<strong>No se pudo completar la reserva:</strong> ' + escapeHtml(err.message);
                    errorBox.classList.remove('d-none');
                    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } finally {
                if (btnEnviar) {
                    btnEnviar.disabled = false;
                    btnEnviar.innerHTML = textoOriginal;
                }
            }
        });

        /* Formulario de consulta de reserva por código (GET /api/reservas/:codigo) */
        var formConsulta = document.getElementById('form-consulta-reserva');
        var resultadoConsulta = document.getElementById('resultado-consulta');
        if (formConsulta && resultadoConsulta) {
            formConsulta.addEventListener('submit', async function (event) {
                event.preventDefault();
                var inputCodigo = document.getElementById('codigo-consulta');
                var codigo = inputCodigo ? inputCodigo.value.trim() : '';

                if (!codigo) {
                    resultadoConsulta.innerHTML = '<div class="alert alert-warning small mb-0">Ingresa un código de reserva válido (ej. RL-20261122-XXXXXX).</div>';
                    resultadoConsulta.classList.remove('d-none');
                    return;
                }

                resultadoConsulta.innerHTML = '<div class="small text-secondary"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Consultando reserva...</div>';
                resultadoConsulta.classList.remove('d-none');

                try {
                    var r = await consultarReserva(codigo);
                    var estadoBadge = r.estado === 'confirmada'
                        ? 'text-bg-success'
                        : (r.estado === 'cancelada' ? 'text-bg-danger' : 'text-bg-warning');

                    resultadoConsulta.innerHTML =
                        '<div class="border rounded-3 p-3 bg-body small">' +
                            '<div class="d-flex justify-content-between align-items-center mb-2">' +
                                '<strong class="text-primary">' + escapeHtml(r.codigo_reserva) + '</strong>' +
                                '<span class="badge ' + estadoBadge + ' text-uppercase">' + escapeHtml(r.estado) + '</span>' +
                            '</div>' +
                            '<p class="mb-1"><strong>Cliente:</strong> ' + escapeHtml(r.cliente && r.cliente.nombre_completo) + '</p>' +
                            '<p class="mb-1"><strong>Fecha:</strong> ' + escapeHtml(String(r.fecha_alquiler).slice(0, 10)) + ' · <strong>Cant.:</strong> ' + r.cantidad + '</p>' +
                            (r.bicicleta ? '<p class="mb-1"><strong>Bicicleta:</strong> ' + escapeHtml(r.bicicleta.modelo) + ' (' + formatPlan(r.plan) + ')</p>' : '') +
                            (r.recorrido ? '<p class="mb-1"><strong>Recorrido:</strong> ' + escapeHtml(r.recorrido.nombre) + '</p>' : '') +
                            (r.sede_retiro ? '<p class="mb-1"><strong>Retiro:</strong> ' + escapeHtml(r.sede_retiro.nombre) + '</p>' : '') +
                            (r.sede_devolucion ? '<p class="mb-1"><strong>Devolución:</strong> ' + escapeHtml(r.sede_devolucion.nombre) + '</p>' : '') +
                            '<p class="mb-0 pt-1 border-top"><strong>Total:</strong> <span class="fw-bold text-primary">' + formatCOP(r.total_cop) + '</span></p>' +
                        '</div>';
                } catch (err) {
                    resultadoConsulta.innerHTML =
                        '<div class="alert alert-danger small mb-0">' +
                            '<i class="bi bi-x-circle me-1" aria-hidden="true"></i>' + escapeHtml(err.message) +
                        '</div>';
                }
            });
        }

        /* Devuelve helper para refrescar stock al recibir eventos SSE */
        return {
            refrescarCatalogo: async function () {
                try {
                    catalogo = await fetchCatalogo();
                    poblarSelectores(catalogo);
                    actualizarEstimado();
                } catch (_e) {
                    /* Ignora error transitorio */
                }
            },
        };
    }

    /* ----------------------------------------------------------------------
       ARRANQUE AUTOMÁTICO SEGÚN LOS CONTENEDORES PRESENTES EN CADA PÁGINA
       ---------------------------------------------------------------------- */
    async function bootstrapApp() {
        var gridRutas = document.getElementById('grid-rutas');
        var gridFlota = document.getElementById('grid-flota');
        var gridFlotaCompleta = document.getElementById('grid-flota-completa');
        var tbodyTarifas = document.getElementById('tbody-tarifas');
        var tbodyRecorridos = document.getElementById('tbody-recorridos');
        var formReserva = document.getElementById('form-reserva');
        var sseEstado = document.getElementById('sse-estado');
        var sseFeed = document.getElementById('sse-feed-lista');

        /* Carga el catálogo desde la API; si no responde, conserva el HTML estático */
        var catalogo = null;
        try {
            catalogo = await fetchCatalogo();

            if (gridRutas) renderRutasIndex(gridRutas, catalogo.recorridos);
            if (gridFlota) renderFlota(gridFlota, catalogo.bicicletas, false);
            if (gridFlotaCompleta) renderFlota(gridFlotaCompleta, catalogo.bicicletas, true);
            if (tbodyTarifas || tbodyRecorridos) {
                renderTablasTarifas(tbodyTarifas, tbodyRecorridos, catalogo);
            }
        } catch (err) {
            console.warn('[Rueda Libre API] No se pudo cargar /api/catalogo:', err.message);
        }

        var reservasCtrl = formReserva ? initPaginaReservas(catalogo) : null;

        /* Conecta el stream SSE de ventas en tiempo real (/api/stream/ventas) */
        if (gridFlota || gridFlotaCompleta || formReserva || sseFeed) {
            conectarStreamVentas({
                onConnected: function () {
                    if (sseEstado) {
                        sseEstado.className = 'badge text-bg-success';
                        sseEstado.innerHTML = '<i class="bi bi-broadcast" aria-hidden="true"></i> En vivo';
                    }
                },
                onNuevaReserva: function (evento) {
                    if (evento.bicicleta) {
                        actualizarStockEnDom(evento.bicicleta);
                    }
                    if (reservasCtrl) {
                        reservasCtrl.refrescarCatalogo();
                    }
                    if (sseFeed) {
                        var codigo = (evento.reserva && evento.reserva.codigo_reserva) || 'Reserva';
                        var detalle = (evento.bicicleta && evento.bicicleta.modelo) ||
                            (evento.recorrido && evento.recorrido.nombre) ||
                            'Servicio';
                        var total = evento.resumen_pago ? formatCOP(evento.resumen_pago.total_cop) : '';
                        var vacio = sseFeed.querySelector('[data-sse-empty]');
                        if (vacio) vacio.remove();

                        var li = document.createElement('li');
                        li.className = 'list-group-item px-0 py-2 bg-transparent d-flex justify-content-between align-items-center gap-2 small';
                        li.innerHTML =
                            '<span><strong>' + escapeHtml(codigo) + '</strong> · ' + escapeHtml(detalle) + '</span>' +
                            '<span class="badge text-bg-primary">' + escapeHtml(total) + '</span>';
                        sseFeed.prepend(li);

                        while (sseFeed.children.length > 5) {
                            sseFeed.lastElementChild.remove();
                        }
                    }
                    mostrarNotificacionVenta(evento);
                },
                onError: function () {
                    if (sseEstado) {
                        sseEstado.className = 'badge text-bg-secondary';
                        sseEstado.innerHTML = '<i class="bi bi-wifi-off" aria-hidden="true"></i> Reconectando…';
                    }
                },
            });
        }
    }

    /* Expone helpers por si se desean usar desde la consola o scripts futuros */
    window.RuedaLibreAPI = {
        API_BASE: API_BASE,
        fetchCatalogo: fetchCatalogo,
        crearReserva: crearReserva,
        consultarReserva: consultarReserva,
        conectarStreamVentas: conectarStreamVentas,
        formatCOP: formatCOP,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapApp);
    } else {
        bootstrapApp();
    }
})(window);
