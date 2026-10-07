#!/bin/bash

# Script de automatización - Red de Rescate de Alimentos
# Crea 25 Issues usando GitHub CLI para el tablero Scrum Orbyte
# Autor: Scrum Master - Equipo Orbyte
# Fecha: 2026-10-07

REPO="Rbvtt/orbyte"

echo "🚀 Iniciando creación de backlog para el proyecto Red de Rescate de Alimentos..."
echo "📊 Repositorio: $REPO"
echo ""

# ⚙️ ÉPICA 0: Configuración de Entorno y Despliegue (Prioridad Alta)

echo "⚙️  ÉPICA 0: Configuración de Entorno y Despliegue"

gh issue create --repo $REPO \
  --title "Configurar el proyecto de Frontend en Vercel y conectarlo a main" \
  --body "## Descripción
Desplegar el frontend en Vercel con integración continua a la rama main de GitHub.

## Comportamiento esperado
- El proyecto debe estar configurado en Vercel
- Los cambios en main deben desplegar automáticamente
- Las variables de entorno deben estar configuradas

## Criterio de aceptación
- ✅ Proyecto Frontend creado en Vercel
- ✅ Rama main conectada y sincronizada
- ✅ Despliegues automáticos funcionales
- ✅ URL de producción accesible" \
  --assignee Sxm-dev4 \
  --label "épica/configuración,prioridad/alta,devops"

gh issue create --repo $REPO \
  --title "Crear y configurar servicio web FastAPI y base de datos PostgreSQL en Render" \
  --body "## Descripción
Configurar el backend (FastAPI) y la base de datos PostgreSQL en la plataforma Render para ambiente de producción.

## Comportamiento esperado
- FastAPI debe estar corriendo en Render
- PostgreSQL debe estar configurada y accesible
- La conexión entre ambos servicios debe ser exitosa

## Criterio de aceptación
- ✅ Servicio FastAPI deployado en Render
- ✅ Base de datos PostgreSQL creada y configurada
- ✅ Health check del backend retorna 200 OK
- ✅ Migraciones de BD ejecutadas exitosamente" \
  --assignee Sxm-dev4 \
  --label "épica/configuración,prioridad/alta,backend,devops"

gh issue create --repo $REPO \
  --title "Configurar de forma segura las variables de entorno en Render y Vercel" \
  --body "## Descripción
Implementar y securizar las variables de entorno (cadenas de conexión, claves API, secretos) en ambas plataformas de despliegue.

## Comportamiento esperado
- Las variables sensibles no deben estar en el repositorio
- Render y Vercel deben tener sus variables configuradas
- La aplicación debe acceder correctamente a todas las variables

## Criterio de aceptación
- ✅ Variables de entorno configuradas en Render (.env)
- ✅ Variables de entorno configuradas en Vercel
- ✅ No hay credenciales en el repositorio
- ✅ La aplicación funciona con variables desde plataformas
- ✅ Documentación de variables en .env.example" \
  --assignee Sxm-dev4 \
  --label "épica/configuración,prioridad/alta,seguridad,devops"

# 🔴 ÉPICA 1: Registro de la Oportunidad (Prioridad Alta - CMP-01 / RF-001)

echo "🔴 ÉPICA 1: Registro de la Oportunidad"

gh issue create --repo $REPO \
  --title "Crear tabla 'rescates' en PostgreSQL con campos mínimos" \
  --body "## Descripción
Diseñar e implementar la tabla principal de rescates en PostgreSQL con los campos necesarios para capturar la información base de una donación de alimentos.

## Campos requeridos
- id (UUID, PK)
- alimento (VARCHAR)
- cantidad (DECIMAL)
- lugar (VARCHAR)
- hora_limite (TIMESTAMP)
- estado (ENUM: disponible, asignado, recogido, entregado)
- origen (VARCHAR - usuario/organización que registró)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## Criterio de aceptación
- ✅ Tabla 'rescates' creada en PostgreSQL
- ✅ Índices creados para búsquedas comunes (estado, lugar)
- ✅ Constraints de integridad implementados
- ✅ Script de migración documentado" \
  --assignee Sxm-dev4 \
  --label "épica/registro-oportunidad,prioridad/alta,backend,bd,CMP-01,RF-001"

gh issue create --repo $REPO \
  --title "Desarrollar endpoint en FastAPI para recibir y validar nuevo rescate" \
  --body "## Descripción
Crear un endpoint POST en FastAPI que reciba los datos de un nuevo rescate, realice validaciones y lo guarde en la base de datos.

## Endpoint esperado
- POST /api/v1/rescates
- Body: { alimento, cantidad, lugar, hora_limite, origen }

## Comportamiento esperado
- Validar que todos los campos requeridos estén presentes
- Validar tipos de datos
- Registrar quién creó el rescate
- Retornar el rescate creado con su ID

## Criterio de aceptación
- ✅ Endpoint POST /api/v1/rescates implementado
- ✅ Validaciones de entrada implementadas
- ✅ Respuesta 201 Created con rescate creado
- ✅ Errores retornan 400 Bad Request con mensaje descriptivo
- ✅ Documentación Swagger disponible" \
  --assignee cajiao05 \
  --label "épica/registro-oportunidad,prioridad/alta,backend,api,CMP-01,RF-001"

gh issue create --repo $REPO \
  --title "Diseñar interfaz y flujo del formulario de aviso para móvil" \
  --body "## Descripción
Crear wireframes y mockups de alta fidelidad para el formulario de registro de donaciones optimizado para dispositivos móviles.

## Contenido esperado
- Diseño responsive para mobile first
- Flujo de captura de datos paso a paso
- Componentes reutilizables
- Estados de validación visual
- Mensajes de error contextualizados

## Criterio de aceptación
- ✅ Wireframes de baja fidelidad creados
- ✅ Mockups de alta fidelidad en Figma o similar
- ✅ Especificaciones de componentes documentadas
- ✅ Feedback del equipo incorporado
- ✅ Design system definido" \
  --assignee jhonzuluaga8080 \
  --label "épica/registro-oportunidad,prioridad/alta,diseño,ux,CMP-01,RF-001"

gh issue create --repo $REPO \
  --title "Construir formulario web en React para registrar donación con validaciones" \
  --body "## Descripción
Implementar en React el formulario de captura de rescates con validaciones en tiempo real y mensajes de error claros (CA-01.2).

## Campos del formulario
- Tipo de alimento (select)
- Cantidad (input numérico)
- Lugar de recogida (input texto)
- Hora límite (datetime picker)
- Observaciones (textarea)

## Comportamiento esperado
- Validaciones en tiempo real
- Mensajes de error en rojo debajo del campo
- Botón deshabilitado hasta que el formulario sea válido
- Loading state mientras se envía
- Confirmación al enviar

## Criterio de aceptación (CA-01.2)
- ✅ Formulario renderiza correctamente
- ✅ Validaciones en tiempo real funcionan
- ✅ Mensajes de error son claros y contextualizados
- ✅ Se integra con el endpoint POST /api/v1/rescates
- ✅ Respuesta de éxito muestra mensaje confirmatorio" \
  --assignee malcom021906-alt \
  --label "épica/registro-oportunidad,prioridad/alta,frontend,react,CA-01.2"

gh issue create --repo $REPO \
  --title "Escribir prueba unitaria para validar que rescate guarda rol/usuario de quien lo registró" \
  --body "## Descripción
Implementar pruebas unitarias en FastAPI para asegurar que cada rescate registre correctamente el usuario/rol que lo creó (CA-01.3).

## Caso de prueba
- Usuario A crea un rescate
- Base de datos debe guardar la identidad de Usuario A
- Consulta al rescate retorna el origen correcto

## Criterio de aceptación (CA-01.3)
- ✅ Test unitario creado en pytest
- ✅ Test valida que origen se guarda correctamente
- ✅ Test valida que no se puede crear sin usuario
- ✅ Cobertura de prueba > 80%
- ✅ Tests pasan en CI/CD" \
  --assignee mauriRodriguez20 \
  --label "épica/registro-oportunidad,prioridad/alta,qa,testing,CA-01.3"

# 🟠 ÉPICA 2: Asignación y Bloqueo (Prioridad Alta - CMP-02 / RF-004, RF-007, RF-008)

echo "🟠 ÉPICA 2: Asignación y Bloqueo"

gh issue create --repo $REPO \
  --title "Desarrollar endpoint en FastAPI para asignar voluntario y organización a rescate" \
  --body "## Descripción
Crear endpoint POST que permita asignar un voluntario y una organización a un rescate con estado 'disponible'.

## Endpoint esperado
- POST /api/v1/rescates/{rescate_id}/asignar
- Body: { voluntario_id, organizacion_id }

## Comportamiento esperado
- Solo rescates con estado 'disponible' pueden ser asignados
- Cambiar estado a 'asignado'
- Registrar timestamp de asignación
- Registrar datos del voluntario y organización

## Criterio de aceptación
- ✅ Endpoint POST implementado
- ✅ Validación de estado 'disponible'
- ✅ Validación de voluntario y organización existentes
- ✅ Respuesta 200 OK con rescate actualizado
- ✅ Respuesta 400 si rescate no está disponible" \
  --assignee cajiao05 \
  --label "épica/asignacion-bloqueo,prioridad/alta,backend,api,CMP-02,RF-004,RF-007,RF-008"

gh issue create --repo $REPO \
  --title "Modificar modelo BD para implementar bloqueo de asignación (evitar duplicados)" \
  --body "## Descripción
Implementar mecanismo de bloqueo en la base de datos para asegurar que un rescate solo pueda ser asignado a un voluntario (CA-02.2).

## Requisitos técnicos
- Agregar unique constraint en tabla rescates
- Implementar row-level locking en transacciones
- Usar BEGIN TRANSACTION ... COMMIT
- Validar en la aplicación antes de BD

## Comportamiento esperado
- Si dos voluntarios intentan asignar simultáneamente, solo uno logra
- El otro recibe error 409 Conflict
- Estado de rescate es atomico

## Criterio de aceptación (CA-02.2)
- ✅ Unique constraint en voluntario_id + rescate_id
- ✅ Transacciones con locking implementadas
- ✅ Test de concurrencia pasa (2 usuarios simultáneos)
- ✅ Respuesta 409 Conflict cuando ya está asignado" \
  --assignee Sxm-dev4 \
  --label "épica/asignacion-bloqueo,prioridad/alta,backend,bd,CA-02.2"

gh issue create --repo $REPO \
  --title "Construir vista Detalle de Rescate en React para voluntario" \
  --body "## Descripción
Crear la interfaz que muestra los detalles completos del rescate asignado y la información del traslado (CA-02.3).

## Información a mostrar
- Detalles del alimento (tipo, cantidad)
- Ubicación de recogida (mapa si es posible)
- Hora límite de recogida
- Información de contacto del donante
- Botones de acción (Recoger, Cancelar)

## Comportamiento esperado
- Vista solo accesible si el rescate está asignado al usuario
- Información en tiempo real
- Mapas para ubicación
- Llamada directa al donante

## Criterio de aceptación (CA-02.3)
- ✅ Vista renderiza información completa del rescate
- ✅ Solo voluntario asignado puede verla
- ✅ Botones de acción funcionan
- ✅ Responsive en móvil
- ✅ Datos se actualizan en tiempo real" \
  --assignee malcom021906-alt \
  --label "épica/asignacion-bloqueo,prioridad/alta,frontend,react,CA-02.3"

gh issue create --repo $REPO \
  --title "Escribir prueba de integración para validar bloqueo de asignación simultánea" \
  --body "## Descripción
Implementar test de integración que valide el comportamiento de bloqueo cuando dos usuarios intentan asignar el mismo rescate simultáneamente.

## Escenario de prueba
- Crear rescate con estado 'disponible'
- Simular 2 requests POST simultáneos a asignar
- Verificar que solo uno tiene éxito (200)
- Verificar que el otro obtiene 409 Conflict
- Verificar estado final es consistente

## Criterio de aceptación
- ✅ Test de integración implementado
- ✅ Usa threading o async para simular concurrencia
- ✅ Valida ambos escenarios (éxito y conflicto)
- ✅ Test pasa consistentemente
- ✅ Documentado en README de testing" \
  --assignee mauriRodriguez20 \
  --label "épica/asignacion-bloqueo,prioridad/alta,qa,testing,integración"

# 🟡 ÉPICA 3: Seguimiento y Cierre (Prioridad Media - CMP-03, CMP-04 / RF-009, RF-012)

echo "🟡 ÉPICA 3: Seguimiento y Cierre"

gh issue create --repo $REPO \
  --title "Diseñar panel administrativo para consultar rescates activos y sin voluntario" \
  --body "## Descripción
Crear el diseño de la vista administrativa donde la Fundación puede ver el listado de rescates activos y filtrar por estado (CA-03.1, CA-03.2).

## Funcionalidades esperadas
- Tabla de rescates con columnas: ID, Alimento, Cantidad, Lugar, Estado, Fecha Límite
- Filtros por: Estado, Fecha, Lugar
- Búsqueda por alimento
- Indicador de rescates sin voluntario
- Acciones rápidas (Asignar, Ver Detalle)

## Criterio de aceptación (CA-03.1, CA-03.2)
- ✅ Wireframes del panel creados
- ✅ Mockup de alta fidelidad disponible
- ✅ Especificaciones de filtros definidas
- ✅ Diseño responsive
- ✅ Componentes documentados en Design System" \
  --assignee jhonzuluaga8080 \
  --label "épica/seguimiento-cierre,prioridad/media,diseño,ux,CA-03.1,CA-03.2"

gh issue create --repo $REPO \
  --title "Construir tabla en React para que Fundación vea rescates e historial" \
  --body "## Descripción
Implementar la tabla interactiva en React que muestra rescates activos e histórico con opciones de filtrado y búsqueda.

## Funcionalidades
- Tabla paginada con 20 rescates por página
- Columnas: ID, Alimento, Cantidad, Lugar, Estado, Creado, Actualizado
- Filtros: Estado, Rango de fechas
- Búsqueda por alimento o lugar
- Ordenamiento por columnas
- Ver detalles de cada rescate

## Comportamiento esperado
- Datos se cargan desde GET /api/v1/rescates
- Filtros actualizan la tabla dinámicamente
- Resalta rescates sin voluntario en rojo
- Muestra loading state mientras carga

## Criterio de aceptación
- ✅ Tabla renderiza todos los rescates
- ✅ Filtros funcionan correctamente
- ✅ Búsqueda es case-insensitive
- ✅ Paginación funciona
- ✅ Performance aceptable con 1000+ rescates" \
  --assignee cajiao05 \
  --label "épica/seguimiento-cierre,prioridad/media,frontend,react"

gh issue create --repo $REPO \
  --title "Crear endpoint en FastAPI para cambiar estado a 'recogido' con fecha y hora" \
  --body "## Descripción
Implementar endpoint PATCH que cambie el estado del rescate a 'recogido' y registre la fecha/hora exacta de recogida (CA-04.1).

## Endpoint esperado
- PATCH /api/v1/rescates/{rescate_id}/recogido
- Body: {} (vacío, usa timestamp del servidor)

## Comportamiento esperado
- Solo rescates con estado 'asignado' pueden cambiar a 'recogido'
- Registra timestamp exacto de recogida
- Registra usuario que confirma recogida
- Retorna rescate actualizado

## Criterio de aceptación (CA-04.1)
- ✅ Endpoint PATCH implementado
- ✅ Validación de estado 'asignado'
- ✅ Timestamp de recogida grabado
- ✅ Respuesta 200 con rescate actualizado
- ✅ Respuesta 400 si estado no es válido" \
  --assignee malcom021906-alt \
  --label "épica/seguimiento-cierre,prioridad/media,backend,api,CA-04.1,RF-009,RF-012"

gh issue create --repo $REPO \
  --title "Crear endpoint en FastAPI para confirmar entrega con kilos y beneficiarios" \
  --body "## Descripción
Implementar endpoint PATCH que cambio estado a 'entregado' y capture los kilos entregados y cantidad de personas beneficiadas (CA-04.2, CA-04.3).

## Endpoint esperado
- PATCH /api/v1/rescates/{rescate_id}/entregado
- Body: { kilos_entregados, personas_beneficiadas, notas }

## Comportamiento esperado
- Solo rescates con estado 'recogido' pueden cambiar a 'entregado'
- Validar que kilos_entregados sea numérico > 0
- Validar que personas_beneficiadas sea entero > 0
- Registra datos de entrega
- Registra timestamp de entrega

## Criterio de aceptación (CA-04.2, CA-04.3)
- ✅ Endpoint PATCH implementado
- ✅ Validaciones de campos implementadas
- ✅ Respuesta 200 con rescate actualizado
- ✅ Respuesta 400 si datos son inválidos
- ✅ Respuesta 409 si estado no es 'recogido'" \
  --assignee cajiao05 \
  --label "épica/seguimiento-cierre,prioridad/media,backend,api,CA-04.2,CA-04.3"

gh issue create --repo $REPO \
  --title "Validar que no se entregue rescate si no está recogido (React y FastAPI)" \
  --body "## Descripción
Implementar validaciones en tiempo real en React y en el backend FastAPI para prevenir que un rescate sea entregado sin ser recogido primero (CA-04.4).

## Validaciones esperadas
- En React: Botón 'Entregar' deshabilitado si estado ≠ 'recogido'
- En FastAPI: Endpoint retorna 409 si estado ≠ 'recogido'
- Mostrar mensaje claro al usuario explicando el flujo

## Comportamiento esperado
- Usuario no puede entregar antes de recoger
- Mensaje: \"Debe recoger el alimento antes de entregarlo\"
- El flujo es: Disponible → Asignado → Recogido → Entregado

## Criterio de aceptación (CA-04.4)
- ✅ Validación en React (UI)
- ✅ Validación en FastAPI (Seguridad)
- ✅ Test unitario de validación
- ✅ Mensaje de error es claro
- ✅ No hay forma de saltarse el flujo" \
  --assignee mauriRodriguez20 \
  --label "épica/seguimiento-cierre,prioridad/media,qa,testing,validación,CA-04.4"

# 🟢 ÉPICA 4: Reporte de Impacto (Prioridad Baja - CMP-05 / RF-018)

echo "🟢 ÉPICA 4: Reporte de Impacto"

gh issue create --repo $REPO \
  --title "Diseñar vista de indicadores de impacto por rango de fechas" \
  --body "## Descripción
Crear el diseño de la dashboard de impacto que muestre métricas de rescates y entregas en un rango de fechas configurable (CA-05.1).

## Indicadores a mostrar
- Total de rescates (disponibles, asignados, recogidos, entregados)
- Kilos totales rescatados
- Personas beneficiadas
- Organizaciones participantes
- Tendencias por período

## Comportamiento esperado
- Selector de rango de fechas (día, semana, mes, año)
- Gráficos o tarjetas con métricas principales
- Tabla con detalle de rescates entregados
- Exportar a PDF o CSV

## Criterio de aceptación (CA-05.1)
- ✅ Wireframes de dashboard creados
- ✅ Mockup de alta fidelidad disponible
- ✅ Especificaciones de gráficos definidas
- ✅ Paleta de colores definida
- ✅ Feedback del stakeholder incorporado" \
  --assignee jhonzuluaga8080 \
  --label "épica/reporte-impacto,prioridad/baja,diseño,ux,CA-05.1,RF-018"

gh issue create --repo $REPO \
  --title "Crear consulta en PostgreSQL que sume datos de rescates entregados" \
  --body "## Descripción
Implementar una consulta SQL optimizada en PostgreSQL que sume kilos y beneficiarios solo de rescates con estado 'entregado', filtrable por rango de fechas.

## Consulta esperada
- Suma de kilos_entregados WHERE estado = 'entregado'
- Suma de personas_beneficiadas WHERE estado = 'entregado'
- Filtrado por rango de created_at
- Agrupación por: día, semana, mes (parámetro)
- Índices para performance

## Comportamiento esperado
- Query ejecuta en < 500ms con 100k rescates
- Retorna datos de forma estructurada
- Soporta agrupación temporal

## Criterio de aceptación
- ✅ Consulta SQL creada y testeada
- ✅ Índices creados para optimización
- ✅ Performance validado
- ✅ Documentación de parámetros
- ✅ Query reutilizable para diferentes períodos" \
  --assignee Sxm-dev4 \
  --label "épica/reporte-impacto,prioridad/baja,backend,bd"

gh issue create --repo $REPO \
  --title "Crear vista en React para mostrar indicadores de impacto en cero si no hay entregas" \
  --body "## Descripción
Implementar la interfaz en React que muestra las métricas de impacto, mostrando valores en cero cuando no hay rescates entregados en el período (CA-05.3).

## Componentes
- Tarjetas de métricas (Total rescates, Kilos, Beneficiarios)
- Gráfico de tendencias
- Selector de rango de fechas
- Estado vacío cuando no hay datos

## Comportamiento esperado
- Muestra 0 cuando no hay entregas en el período
- Mensaje amigable: \"No hay datos de entregas en este período\"
- Los datos se actualizan al cambiar el rango de fechas
- Animaciones smooth al cambiar valores

## Criterio de aceptación (CA-05.3)
- ✅ Vista renderiza correctamente
- ✅ Muestra 0 cuando no hay datos
- ✅ Selector de fechas funciona
- ✅ Responsive en móvil y desktop
- ✅ Loading state mientras carga datos" \
  --assignee malcom021906-alt \
  --label "épica/reporte-impacto,prioridad/baja,frontend,react,CA-05.3"

gh issue create --repo $REPO \
  --title "Crear vista en React para desplegar detalles de rescates en total de impacto" \
  --body "## Descripción
Implementar tabla expandible que muestra el detalle de los rescates individuales que componen el total de kilos y beneficiarios (CA-05.2).

## Funcionalidad
- Tabla de rescates entregados en el período seleccionado
- Columnas: ID, Alimento, Kilos, Personas beneficiadas, Fecha entrega, Organizaci
ón
- Búsqueda y filtros
- Exportar a CSV
- Ver detalle de cada rescate

## Comportamiento esperado
- Se carga dinámicamente al expandir sección
- Paginación para grandes volúmenes
- Resalta el total al pie de tabla
- Permite comparar rescates

## Criterio de aceptación (CA-05.2)
- ✅ Tabla renderiza rescates entregados
- ✅ Suma de kilos y beneficiarios es correcta
- ✅ Filtros funcionan
- ✅ Performance aceptable
- ✅ CSV exportable" \
  --assignee cajiao05 \
  --label "épica/reporte-impacto,prioridad/baja,frontend,react,CA-05.2"

# 🛡️ ÉPICA 5: Validación, Pruebas y Aceptación (Prioridad Alta - Transversal)

echo "🛡️  ÉPICA 5: Validación, Pruebas y Aceptación"

gh issue create --repo $REPO \
  --title "Ejecutar plan de pruebas manuales con conexión deficiente y cargar formularios" \
  --body "## Descripción
Ejecutar suite de pruebas manuales simulando condiciones de conexión a internet lenta/inestable para validar la experiencia del usuario al cargar formularios.

## Escenarios de prueba
- Conexión 3G (speeds: 1-3 Mbps)
- Conexión 2G (speeds: 0.1 Mbps)
- Pérdida de paquetes intermitente
- Desconexiones y reconexiones
- Formularios deben mantener datos mientras carga

## Comportamiento esperado
- Formulario carga parcialmente, permite interacción
- Datos se guardan en localStorage
- Retry automático en caso de error
- Mensajes de estado claros
- No hay crash de la aplicación

## Criterio de aceptación
- ✅ Pruebas ejecutadas en 3 conexiones diferentes
- ✅ Reporte de resultados documentado
- ✅ Bugs encontrados en Jira/Issues
- ✅ Formulario funciona en condiciones adversas
- ✅ Documentación de pasos de prueba" \
  --assignee mauriRodriguez20 \
  --label "épica/validacion-pruebas,prioridad/alta,qa,testing,manual"

gh issue create --repo $REPO \
  --title "Probar visualización en múltiples tamaños de pantalla de móviles básicos" \
  --body "## Descripción
Ejecutar pruebas de visualización en al menos dos tipos de dispositivos móviles básicos para validar responsiveness y usabilidad.

## Dispositivos a probar
1. Pantalla pequeña: ~4.5\" (ej: Samsung A01 Core - 360x800)
2. Pantalla media: ~5.5\" (ej: Samsung A11 - 720x1520)

## Elementos a validar
- Formularios se adaptan correctamente
- Botones son accesibles (mínimo 44px)
- Texto es legible (tamaño mínimo 14px)
- Imágenes cargan correctamente
- Scroll y navegación es smooth
- Teclado no tapa inputs importantes

## Criterio de aceptación
- ✅ Pruebas realizadas en 2+ dispositivos físicos
- ✅ Screenshots documentados
- ✅ Bugs de layout reportados
- ✅ Touch targets validados (> 44px)
- ✅ Reporte de compatibilidad" \
  --assignee mauriRodriguez20 \
  --label "épica/validacion-pruebas,prioridad/alta,qa,testing,mobile,ux"

# Finalización

echo ""
echo "✅ Script completado"
echo "📊 Se crearon 25 Issues en el repositorio $REPO"
echo "🎯 Próximo paso: Ir a Projects y vincular los Issues al tablero Scrum Orbyte"
echo ""
echo "Para ejecutar este script:"
echo "1. Instala GitHub CLI: https://cli.github.com"
echo "2. Autentica con: gh auth login"
echo "3. Ejecuta: bash crear-backlog-scrum.sh"
echo ""
