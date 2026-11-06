# Diseño de la vista de impacto

## Descripción

Prototipo de la vista **Impacto** del panel de la Fundación Mesa Común. Permite consultar y presentar a los cooperantes los resultados de los rescates entregados durante un periodo seleccionado.

## Trazabilidad

- Issue: #19 · Diseño de la vista de impacto: rango de fechas, 3 totales y detalle por total
- Historia: CMP-05 · La fundación consulta el impacto de un periodo
- Criterios de aceptación: CA-05.1, CA-05.2 y CA-05.3
- Requerimientos: RF-018, RF-019, RF-020 y RF-021

## Contenido del diseño

El prototipo contempla:

- Selector de rango de fechas.
- Resumen de los tres indicadores:
  - Kilogramos rescatados.
  - Personas beneficiadas.
  - Organizaciones receptoras participantes.
- Acceso visible al detalle de los rescates que componen cada indicador.
- Aviso sobre la cantidad de rescates con cantidades estimadas.
- Estado vacío cuando el periodo no tiene entregas: los indicadores muestran cero y se informa que no hubo rescates entregados.
- Adaptaciones para escritorio y móvil.

Los indicadores consideran únicamente rescates en estado `entregado` dentro del periodo seleccionado.

## Enlace al prototipo

- Figma: [Agregar enlace al prototipo]

## Archivos

```text
docs/design/impacto/
├── README.md
├── impacto-desktop.png
├── impacto-mobile.png
```

## Criterios de revisión

- [ ] El rango de fechas se entiende y se puede identificar fácilmente.
- [ ] Se muestran los tres totales del periodo seleccionado.
- [ ] Cada total tiene una acción visible para consultar su detalle.
- [ ] Los detalles muestran los rescates que componen el total correspondiente.
- [ ] Se informa cuántas cantidades son estimadas.
- [ ] Si no hay entregas en el periodo, los tres totales muestran cero y se presenta un mensaje de estado vacío.
- [ ] El diseño funciona en escritorio y móvil.
- [ ] La información no depende únicamente del color para comunicar su significado.

## Observaciones

Este prototipo es una propuesta de diseño para revisión del equipo. Los datos incluidos en las capturas son ilustrativos; deben reemplazarse por información real cuando la vista se conecte con la API.