# Especificación del MVP

## CMP-01 · Se registra un aviso de alimento disponible

**Origen:** RF-001 · RNF-001 · RNF-002 · RNF-004

### CA-01.1 · Aviso con los datos mínimos

- **Dado** un comercio que tiene alimento disponible para donar
- **Cuando** registra el aviso con comercio, alimento, cantidad aproximada, lugar de recogida y hora límite
- **Entonces** el rescate queda en estado `disponible`
- **Y** se guardan la fecha y la hora del registro

### CA-01.2 · Aviso incompleto

- **Dado** un aviso al que le falta alguno de los datos mínimos
- **Cuando** se intenta registrar
- **Entonces** el sistema no lo guarda
- **Y** señala cuál dato falta

### CA-01.3 · Aviso registrado por la fundación

- **Dado** un comercio que avisa por llamada porque no puede acceder a la página
- **Cuando** una persona de la fundación registra el aviso en su nombre
- **Entonces** el rescate queda en estado `disponible`
- **Y** se conserva quién lo registró

## CMP-02 · La fundación asigna el rescate a una organización receptora y a un voluntario

**Origen:** RF-004 · RF-007 · RF-008 · RF-010

### CA-02.1 · Asignación de un rescate disponible

- **Dado** un rescate en estado `disponible`
- **Cuando** la fundación le asigna una organización receptora y un voluntario
- **Entonces** el rescate pasa a estado `asignado`
- **Y** quedan registrados la organización, el voluntario, la fecha y la hora

### CA-02.2 · Se impide una segunda asignación

- **Dado** un rescate que ya tiene un voluntario asignado
- **Cuando** se intenta asignar otro voluntario al mismo rescate
- **Entonces** el sistema lo impide
- **Y** el rescate conserva al voluntario original

### CA-02.3 · El voluntario ve los datos del traslado

- **Dado** un rescate en estado `asignado`
- **Cuando** el voluntario asignado lo consulta
- **Entonces** ve el lugar y la hora límite de recogida, la cantidad aproximada y el lugar de entrega

## CMP-03 · La fundación hace seguimiento de los rescates

**Origen:** RF-009 · RF-011 · RF-014 · RF-015 · RF-022 · RF-023

### CA-03.1 · Consulta de rescates activos

- **Dado** que existen rescates que aún no se han entregado
- **Cuando** la fundación consulta los rescates activos
- **Entonces** ve cada rescate con su estado actual

### CA-03.2 · Rescates sin voluntario

- **Dado** un rescate en estado `disponible`
- **Cuando** la fundación consulta los rescates activos
- **Entonces** ese rescate se distingue como pendiente de asignar

### CA-03.3 · Historial de un rescate

- **Dado** un rescate con uno o más cambios de estado
- **Cuando** la fundación consulta su historial
- **Entonces** ve cada cambio en orden, con fecha, hora y responsable

### CA-03.4 · Rescate que no pudo realizarse

- **Dado** un rescate en estado `disponible` o `asignado`
- **Cuando** la fundación lo marca como no completado e indica el motivo
- **Entonces** el rescate pasa a estado `no completado`
- **Y** conserva el motivo

## CMP-04 · Se registra la recogida y se confirma la entrega

**Origen:** RF-012 · RF-013 · RF-016 · RF-017 · RF-025

### CA-04.1 · Registro de la recogida

- **Dado** un rescate en estado `asignado`
- **Cuando** el voluntario asignado registra la recogida
- **Entonces** el rescate pasa a estado `recogido`
- **Y** quedan registrados el voluntario, la fecha y la hora

### CA-04.2 · Confirmación de la entrega

- **Dado** un rescate en estado `recogido`
- **Cuando** la organización receptora confirma la recepción e indica la cantidad recibida en kilogramos o como cantidad aproximada
- **Entonces** el rescate pasa a estado `entregado`
- **Y** quedan registrados la organización, quien recibe, la cantidad, si fue medida o estimada, la fecha y la hora

### CA-04.3 · Personas beneficiadas

- **Dado** un rescate en estado `entregado`
- **Cuando** la organización receptora registra cuántas personas atendió con esa donación
- **Entonces** el conteo queda asociado a ese rescate

### CA-04.4 · No se confirma una entrega sin recogida

- **Dado** un rescate que aún no está en estado `recogido`
- **Cuando** se intenta confirmar su entrega
- **Entonces** el sistema lo impide

## CMP-05 · La fundación consulta el impacto de un periodo

**Origen:** RF-018 · RF-019 · RF-020 · RF-021

### CA-05.1 · Indicadores de un periodo

- **Dado** un rango de fechas con rescates en estado `entregado`
- **Cuando** la fundación consulta el impacto de ese periodo
- **Entonces** obtiene los kilogramos rescatados, las personas beneficiadas y las organizaciones receptoras que participaron
- **Y** los totales solo incluyen rescates en estado `entregado`

### CA-05.2 · Cada cifra se puede respaldar

- **Dado** un total mostrado en la consulta de impacto
- **Cuando** la fundación pide su detalle
- **Entonces** ve los rescates que componen ese total

### CA-05.3 · Periodo sin entregas

- **Dado** un rango de fechas sin rescates en estado `entregado`
- **Cuando** la fundación consulta el impacto de ese periodo
- **Entonces** los totales se muestran en cero
