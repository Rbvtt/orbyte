import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  crearRescate,
  listarComercios,
  mapearErrores422,
  obtenerUsuarioActual,
} from "./rescatesApi";
import {
  IconAlerta,
  IconAutoria,
  IconBuscar,
  IconCalendario,
  IconCheck,
  IconChevron,
  IconCircleCheck,
  IconComercio,
  IconInfo,
  IconPin,
  IconReloj,
  IconBalanza,
  IconTrigo,
  IconLogo,
} from "./iconos";
import "./avisoAsistido.css";

/* ------------------------------------------------------------------ */
/* Constantes de formulario (textos exactos del Figma)                  */
/* ------------------------------------------------------------------ */
const CAMPOS = ["comercio_id", "alimento", "cantidad_aprox", "lugar_recogida", "hora_limite"];

const IDS = {
  comercio_id: "aviso-comercio",
  alimento: "aviso-alimento",
  cantidad_aprox: "aviso-cantidad",
  lugar_recogida: "aviso-lugar",
  hora_limite: "aviso-hora",
};

const MENSAJES = {
  comercio_id: "Selecciona el comercio del aviso.",
  alimento: "Indica qué alimento se va a donar.",
  cantidad_aprox: "Indica una cantidad aproximada.",
  lugar_recogida: "Indica el lugar de recogida.",
  hora_limite: "Indica la hora límite de hoy.",
};

const VALORES_INICIALES = {
  comercio_id: "",
  alimento: "",
  cantidad_aprox: "",
  lugar_recogida: "",
  hora_limite: "",
};

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validar(valores) {
  const errores = {};
  if (!valores.comercio_id) errores.comercio_id = MENSAJES.comercio_id;
  for (const campo of ["alimento", "cantidad_aprox", "lugar_recogida"]) {
    if (!valores[campo].trim()) errores[campo] = MENSAJES[campo];
  }
  if (!HORA_RE.test(valores.hora_limite)) errores.hora_limite = MENSAJES.hora_limite;
  return errores;
}

/* ------------------------------------------------------------------ */
/* Fechas (siempre "hoy", hora local, formato 24 h)                     */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, "0");
const fechaCorta = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const horaCorta = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function fechaLarga(d) {
  const partes = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(d);
  const valor = (tipo) => (partes.find((p) => p.type === tipo)?.value ?? "").replace(".", "");
  return `Hoy · ${valor("weekday")}, ${valor("day")} ${valor("month")} ${valor("year")}`;
}

/** "HH:MM" de hoy en hora local -> ISO 8601 con zona horaria (el backend exige tz). */
function horaLimiteISO(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const normalizar = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** crypto.randomUUID requiere Secure Context (HTTPS o localhost). */
function generarUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
  );
}

/* ------------------------------------------------------------------ */
/* Piezas pequeñas                                                      */
/* ------------------------------------------------------------------ */
function Encabezado({ fundacionNombre }) {
  return (
    <header className="cab">
      <div className="cab__marca">
        <span className="cab__logo" aria-hidden="true">
          <IconLogo />
        </span>
        <span className="cab__nombre">Mesa común</span>
      </div>
      <div className="cab__nav">
        <span className="cab__link cab__link--escritorio">Red de donación</span>
        <span className="cab__rol cab__rol--escritorio">{fundacionNombre}</span>
        <span className="cab__rol cab__rol--movil">Fundación</span>
      </div>
    </header>
  );
}

function CajaAutoria({ fundacionNombre, className = "" }) {
  return (
    <aside className={`autoria ${className}`} aria-label="Autoría del aviso">
      <p className="autoria__etiqueta">
        <IconAutoria />
        <span>Autoría al registrar · sin guardar</span>
      </p>
      <p className="autoria__titulo">Registrado por la fundación</p>
      <p className="autoria__nombre">{fundacionNombre}</p>
      <p className="autoria__texto">
        Para comercios sin smartphone o sin conexión. El aviso quedará a nombre del comercio
        elegido.
      </p>
    </aside>
  );
}

function Aviso({ tipo, titulo, texto }) {
  const esError = tipo === "error";
  return (
    <div
      className={`aviso-banner aviso-banner--${tipo}`}
      role={esError ? "alert" : "status"}
    >
      <span className="aviso-banner__icono" aria-hidden="true">
        {esError ? <IconAlerta /> : <IconInfo />}
      </span>
      <div>
        <p className="aviso-banner__titulo">{titulo}</p>
        <p className="aviso-banner__texto">{texto}</p>
      </div>
    </div>
  );
}

function CampoTexto({ campo, label, placeholder, icono, ayuda, valor, error, onChange, tipo = "text" }) {
  const id = IDS[campo];
  const ayudaId = `${id}-ayuda`;
  return (
    <div className="campo">
      <label className="campo__label" htmlFor={id}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <div className={`control${error ? " control--error" : ""}${tipo === "time" ? " control--hora" : ""}`}>
        <input
          id={id}
          name={campo}
          type={tipo}
          className="control__input"
          placeholder={placeholder}
          value={valor}
          onChange={(e) => onChange(campo, e.target.value)}
          aria-required="true"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={ayudaId}
          autoComplete="off"
          {...(tipo === "time" ? { step: 60 } : {})}
        />
        <span className="control__icono" aria-hidden="true">
          {error ? <IconAlerta /> : icono}
        </span>
      </div>
      <p id={ayudaId} className={error ? "campo__error" : "campo__ayuda"}>
        {error || ayuda}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Selector de comercio (combobox con búsqueda, panel en flujo)         */
/* ------------------------------------------------------------------ */
function SelectorComercio({ comercios, estado, valor, error, onChange, onReintentar }) {
  const id = IDS.comercio_id;
  const ayudaId = `${id}-ayuda`;
  const listaId = `${id}-lista`;
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState(0);
  const contenedorRef = useRef(null);
  const disparadorRef = useRef(null);

  const seleccionado = comercios.find((c) => c.id === valor) ?? null;

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return comercios;
    return comercios.filter((c) => normalizar(`${c.nombre} ${c.direccion}`).includes(q));
  }, [comercios, busqueda]);

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    setBusqueda("");
    if (devolverFoco) disparadorRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) cerrar();
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto, cerrar]);

  useEffect(() => setActivo(0), [busqueda]);

  const elegir = (comercio) => {
    onChange("comercio_id", comercio.id);
    cerrar(true);
  };

  const onTecladoBusqueda = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtrados[activo]) elegir(filtrados[activo]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar(true);
    } else if (e.key === "Tab") {
      cerrar();
    }
  };

  const cargando = estado === "cargando";
  const fallo = estado === "error";
  const textoDisparador = cargando
    ? "Cargando comercios…"
    : seleccionado
    ? seleccionado.nombre
    : "Selecciona un comercio";

  let ayuda = "Elige un comercio ya registrado.";
  if (seleccionado) ayuda = seleccionado.direccion;

  return (
    <div className="campo" ref={contenedorRef}>
      <label className="campo__label" htmlFor={id}>
        Comercio del aviso <span aria-hidden="true">*</span>
      </label>

      <button
        id={id}
        ref={disparadorRef}
        type="button"
        className={`control control--boton${abierto ? " control--abierto" : ""}${error ? " control--error" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? listaId : undefined}
        aria-required="true"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={ayudaId}
        disabled={cargando || fallo}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        <span className={seleccionado ? "control__valor" : "control__valor control__valor--vacio"}>
          {textoDisparador}
        </span>
        <span className="control__icono" aria-hidden="true">
          {error ? <IconAlerta /> : <IconChevron className={abierto ? "giro" : ""} />}
        </span>
      </button>

      {abierto && (
        <div className="selector__panel">
          <div className="selector__busqueda">
            <IconBuscar />
            <input
              type="text"
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listaId}
              aria-activedescendant={filtrados[activo] ? `${id}-op-${filtrados[activo].id}` : undefined}
              aria-label="Buscar comercio por nombre o dirección"
              placeholder="Buscar nombre o dirección"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={onTecladoBusqueda}
            />
          </div>
          <p className="selector__conteo" aria-live="polite">
            {filtrados.length === 1 ? "1 comercio existente" : `${filtrados.length} comercios existentes`}
          </p>
          <ul id={listaId} role="listbox" aria-label="Comercios existentes" className="selector__lista">
            {filtrados.map((c, i) => (
              <li
                key={c.id}
                id={`${id}-op-${c.id}`}
                role="option"
                aria-selected={c.id === valor}
                className={`selector__opcion${i === activo ? " selector__opcion--activa" : ""}${
                  c.id === valor ? " selector__opcion--elegida" : ""
                }`}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(c)}
              >
                <span className="selector__icono" aria-hidden="true">
                  <IconComercio />
                </span>
                <span className="selector__textos">
                  <span className="selector__nombre">{c.nombre}</span>
                  <span className="selector__direccion">{c.direccion}</span>
                </span>
                {c.id === valor && (
                  <span className="selector__check" aria-hidden="true">
                    <IconCheck />
                  </span>
                )}
              </li>
            ))}
            {filtrados.length === 0 && (
              <li className="selector__vacio" role="presentation">
                {comercios.length === 0
                  ? "No hay comercios registrados."
                  : "Ningún comercio coincide con la búsqueda."}
              </li>
            )}
          </ul>
        </div>
      )}

      <p id={ayudaId} className={error ? "campo__error" : "campo__ayuda"}>
        {fallo ? (
          <>
            No se pudo cargar la lista de comercios.{" "}
            <button type="button" className="enlace" onClick={onReintentar}>
              Reintentar
            </button>
          </>
        ) : (
          error || ayuda
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmación (frame final del Figma)                                 */
/* ------------------------------------------------------------------ */
function Confirmacion({ rescate, comercio, fundacionNombre, onNuevo }) {
  const horaLimite = new Date(rescate.hora_limite);
  const creado = new Date(rescate.creado_en);
  const tituloRef = useRef(null);
  const disponible = rescate.estado === "disponible";

  const filas = [
    { icono: <IconComercio />, etiqueta: "Comercio del aviso", valor: comercio.nombre },
    { icono: <IconTrigo />, etiqueta: "Alimento", valor: rescate.alimento },
    { icono: <IconBalanza />, etiqueta: "Cantidad aproximada", valor: rescate.cantidad_aprox },
    { icono: <IconPin />, etiqueta: "Lugar de recogida", valor: rescate.lugar_recogida },
    {
      icono: <IconReloj />,
      etiqueta: "Hora límite de recogida",
      valor: `Hoy, ${fechaCorta(horaLimite)} · ${horaCorta(horaLimite)} h`,
    },
  ];

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  return (
    <main className="exito">
      <div className="exito__cabecera">
        <span className="exito__check" aria-hidden="true">
          <IconCheck />
        </span>
        <h1 className="exito__titulo" tabIndex={-1} ref={tituloRef}>
          ¡Aviso registrado!
        </h1>
        <p className="exito__texto">
          El aviso de {comercio.nombre} se ha guardado y ya está disponible para el rescate.
        </p>
        {disponible && (
          <span className="exito__estado">
            <IconCircleCheck />
            Disponible
          </span>
        )}
      </div>

      <div className="exito__grid">
        <section className="resumen" aria-labelledby="resumen-titulo">
          <h2 id="resumen-titulo" className="resumen__titulo">
            Resumen de la donación
          </h2>
          <dl className="resumen__lista">
            {filas.map((f) => (
              <div className="resumen__fila" key={f.etiqueta}>
                <span className="resumen__icono" aria-hidden="true">
                  {f.icono}
                </span>
                <div>
                  <dt className="resumen__etiqueta">{f.etiqueta}</dt>
                  <dd className="resumen__valor">{f.valor}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <div className="exito__lateral">
          <aside className="autoria" aria-label="Autoría del aviso">
            <p className="autoria__etiqueta">
              <IconAutoria />
              <span>Autoría del aviso</span>
            </p>
            <p className="autoria__titulo">Registrado por la fundación</p>
            <p className="autoria__nombre">{fundacionNombre}</p>
            <p className="autoria__nombre">En nombre de {comercio.nombre}.</p>
          </aside>

          <div className="autoria">
            <p className="autoria__etiqueta">
              <IconCalendario />
              <span>Fecha y hora de registro</span>
            </p>
            <p className="autoria__titulo">
              {fechaCorta(creado)} · {horaCorta(creado)} h (hora local)
            </p>
          </div>

          <div className="nota">
            <p className="nota__titulo">Listo para el rescate</p>
            <p className="nota__texto">
              La recogida está disponible hasta hoy a las {horaCorta(horaLimite)} h.
            </p>
          </div>
        </div>
      </div>

      <div className="exito__pie">
        <p>Gracias por alimentar a tu comunidad.</p>
        <button type="button" className="boton" onClick={onNuevo}>
          Crear otro aviso <span aria-hidden="true">+</span>
        </button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Vista principal                                                      */
/* ------------------------------------------------------------------ */
/**
 * Props:
 *  - getToken(): () => string        JWT del usuario autenticado (rol fundacion).
 *  - fundacionNombre?: string        Opcional. Si no se pasa, se lee de GET /api/v1/auth/me
 *                                    (el JWT solo trae sub/rol/exp). Es solo para mostrar:
 *                                    la autoría real la fija el backend desde el JWT.
 *  - apiBaseUrl: string              Prefijo del API ("" = mismo origen).
 */
export default function AvisoAsistidoPage({
  getToken,
  fundacionNombre,
  apiBaseUrl = "",
}) {
  const hoy = useMemo(() => new Date(), []);
  const [vista, setVista] = useState("formulario");
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const [comercios, setComercios] = useState([]);
  const [estadoComercios, setEstadoComercios] = useState("cargando");
  const [recarga, setRecarga] = useState(0);
  const [nombreSesion, setNombreSesion] = useState(null);
  const nombreFundacion = fundacionNombre ?? nombreSesion ?? "Fundación";

  // Misma Idempotency-Key mientras el payload no cambie (reintentos seguros).
  const claveRef = useRef(null);
  // getToken puede ser una función inline: se guarda en ref para no re-disparar efectos.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    const controlador = new AbortController();
    setEstadoComercios("cargando");
    listarComercios({ baseUrl: apiBaseUrl, token: getTokenRef.current(), signal: controlador.signal })
      .then((lista) => {
        setComercios(lista);
        setEstadoComercios("ok");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setEstadoComercios("error");
      });
    return () => controlador.abort();
  }, [apiBaseUrl, recarga]);

  useEffect(() => {
    if (fundacionNombre) return undefined;
    const controlador = new AbortController();
    obtenerUsuarioActual({
      baseUrl: apiBaseUrl,
      token: getTokenRef.current(),
      signal: controlador.signal,
    })
      .then((me) => setNombreSesion(me.nombre))
      .catch(() => {}); // si falla, se muestra el texto genérico "Fundación"
    return () => controlador.abort();
  }, [apiBaseUrl, fundacionNombre]);

  const cambiarCampo = (campo, valor) => {
    const siguientes = { ...valores, [campo]: valor };
    setValores(siguientes);
    claveRef.current = null;
    setErrorGeneral(null);
    if (errores[campo]) {
      // Revalida solo el campo editado (validación por campo).
      const nuevo = validar(siguientes)[campo];
      setErrores((prev) => {
        const { [campo]: _quitado, ...resto } = prev;
        return nuevo ? { ...resto, [campo]: nuevo } : resto;
      });
    }
  };

  const comercioElegido = comercios.find((c) => c.id === valores.comercio_id) ?? null;
  const erroresActuales = Object.keys(errores).length;
  const hayErrores = erroresActuales > 0 || errorGeneral !== null;
  const todoListo = Object.keys(validar(valores)).length === 0;

  let banner;
  if (errorGeneral) {
    banner = { tipo: "error", titulo: "El aviso no se ha guardado.", texto: errorGeneral };
  } else if (erroresActuales > 0) {
    banner = {
      tipo: "error",
      titulo: "El aviso no se ha guardado.",
      texto:
        erroresActuales === 1
          ? "Completa el campo señalado."
          : `Completa los ${erroresActuales} campos señalados.`,
    };
  } else if (todoListo) {
    banner = { tipo: "ok", titulo: "Todo listo para registrar.", texto: "Aún no se ha guardado el aviso." };
  } else {
    banner = {
      tipo: "info",
      titulo: "Todos los campos son obligatorios.",
      texto: "Solo necesitamos estos 5 datos.",
    };
  }

  const enfocarPrimerError = (mapa) => {
    const primero = CAMPOS.find((c) => mapa[c]);
    if (primero) document.getElementById(IDS[primero])?.focus();
  };

  const onSubmit = async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    const locales = validar(valores);
    setErrores(locales);
    setErrorGeneral(null);
    if (Object.keys(locales).length > 0) {
      enfocarPrimerError(locales);
      return;
    }

    setEnviando(true);
    try {
      claveRef.current ??= generarUUID();
      const rescate = await crearRescate({
        baseUrl: apiBaseUrl,
        token: getTokenRef.current(),
        idempotencyKey: claveRef.current,
        payload: {
          comercio_id: valores.comercio_id,
          alimento: valores.alimento.trim(),
          cantidad_aprox: valores.cantidad_aprox.trim(),
          lugar_recogida: valores.lugar_recogida.trim(),
          hora_limite: horaLimiteISO(valores.hora_limite),
        },
      });
      setResultado({ rescate, comercio: comercioElegido });
      setVista("confirmacion");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const { porCampo, generales } = mapearErrores422(error.cuerpo, MENSAJES, CAMPOS);
        setErrores(porCampo);
        if (generales.length > 0 && Object.keys(porCampo).length === 0) {
          setErrorGeneral(generales[0]);
        }
        enfocarPrimerError(porCampo);
      } else if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setErrorGeneral("Tu sesión no tiene permiso para registrar avisos. Vuelve a iniciar sesión.");
      } else {
        setErrorGeneral(error.message || "No se pudo registrar el aviso. Inténtalo de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  };

  const nuevoAviso = () => {
    claveRef.current = null;
    setValores(VALORES_INICIALES);
    setErrores({});
    setErrorGeneral(null);
    setResultado(null);
    setVista("formulario");
  };

  if (vista === "confirmacion" && resultado) {
    return (
      <div className="orbyte-aviso">
        <Encabezado fundacionNombre={nombreFundacion} />
        <Confirmacion
          rescate={resultado.rescate}
          comercio={resultado.comercio}
          fundacionNombre={nombreFundacion}
          onNuevo={nuevoAviso}
        />
      </div>
    );
  }

  return (
    <div className="orbyte-aviso">
      <Encabezado fundacionNombre={nombreFundacion} />

      <main className="pagina">
        <nav className="migas" aria-label="Ruta de navegación">
          <span>Avisos de donación</span>
          <span aria-hidden="true">/</span>
          <span className="migas__actual" aria-current="page">
            Registro asistido
          </span>
        </nav>

        <p className="eyebrow">Registro asistido</p>
        <h1 className="titulo">Aviso de donación</h1>
        <p className="subtitulo">Registra en nombre de un comercio.</p>
        <p className="fecha">
          <IconCalendario />
          <span>{fechaLarga(hoy)}</span>
        </p>

        <CajaAutoria fundacionNombre={nombreFundacion} className="autoria--movil" />
        <Aviso {...banner} />

        <form onSubmit={onSubmit} noValidate aria-busy={enviando}>
          <div className="tarjeta">
            <div className="tarjeta__cuerpo">
              <section className="seccion seccion--izq" aria-labelledby="sec-comercio">
                <div className="seccion__cab">
                  <h2 id="sec-comercio">Comercio del aviso</h2>
                  <p>Selecciona a quién corresponde la donación.</p>
                </div>
                <SelectorComercio
                  comercios={comercios}
                  estado={estadoComercios}
                  valor={valores.comercio_id}
                  error={errores.comercio_id}
                  onChange={cambiarCampo}
                  onReintentar={() => setRecarga((n) => n + 1)}
                />
                <CajaAutoria fundacionNombre={nombreFundacion} className="autoria--escritorio" />
              </section>

              <section className="seccion seccion--der" aria-labelledby="sec-datos">
                <div className="seccion__cab">
                  <h2 id="sec-datos">Datos de la donación</h2>
                  <p>Completa el alimento y las condiciones de recogida.</p>
                </div>
                <CampoTexto
                  campo="alimento"
                  label="Alimento"
                  placeholder="¿Qué alimento se va a donar?"
                  icono={<IconTrigo />}
                  ayuda="Describe brevemente lo que dona."
                  valor={valores.alimento}
                  error={errores.alimento}
                  onChange={cambiarCampo}
                />
                <CampoTexto
                  campo="cantidad_aprox"
                  label="Cantidad aproximada"
                  placeholder="Ej. 8 kg o 12 raciones"
                  icono={<IconBalanza />}
                  ayuda="Una estimación es suficiente."
                  valor={valores.cantidad_aprox}
                  error={errores.cantidad_aprox}
                  onChange={cambiarCampo}
                />
                <CampoTexto
                  campo="lugar_recogida"
                  label="Lugar de recogida"
                  placeholder="Dirección de recogida"
                  icono={<IconPin />}
                  ayuda="Incluye calle, número y localidad."
                  valor={valores.lugar_recogida}
                  error={errores.lugar_recogida}
                  onChange={cambiarCampo}
                />
                <CampoTexto
                  campo="hora_limite"
                  label="Hora límite de hoy"
                  tipo="time"
                  icono={<IconReloj />}
                  ayuda={`${fechaCorta(hoy)} · hora local, formato 24 h.`}
                  valor={valores.hora_limite}
                  error={errores.hora_limite}
                  onChange={cambiarCampo}
                />
              </section>
            </div>

            <div className="tarjeta__pie">
              <div className="pie__texto">
                <p className="pie__titulo">
                  {hayErrores ? "El aviso sigue sin guardar." : "El aviso aún no se ha guardado."}
                </p>
                <p>Al registrar, el rescate quedará disponible a nombre del comercio elegido.</p>
              </div>
              <button type="submit" className="boton" disabled={enviando}>
                {enviando ? "Registrando…" : <>Registrar aviso <span aria-hidden="true">→</span></>}
              </button>
              <p className="pie__nota-movil">Al registrar, el rescate quedará disponible.</p>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
