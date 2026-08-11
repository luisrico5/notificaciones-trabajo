var DEFAULT_MAP_ARR = [
 {
  "prefijo": "PT",
  "nombre": "Transmisor de presion",
  "proc": "P-SG-04551",
  "descripcion": "Trabajo realizado:\n- Se desmontó el equipo y se realizó limpieza técnica a tapas, tarjetas y cápsula en el laboratorio\n- Se verificó la linealidad comparando tres puntos del rango con un patrón certificado\n- Se reinstaló el transmisor y se validó la correcta señal en el DCS\n- Se realizó pruebas de fugas\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Calibradores Fluke, multímetro digital, interfaces Trex o 475, estación generadora de presión, manómetros, comunicadores Hart/Fieldbus, llaves y destornilladores"
 },
 {
  "prefijo": "PI",
  "nombre": "Indicador de presion (manometro)",
  "proc": "P-SG-04552",
  "descripcion": "Trabajo realizado:\n- Se desinstaló el manómetro bloqueando la válvula de proceso y despresionando el sistema\n- Se limpió y se lubricó mecanismos con aeropak para eliminar la pereza antes de la prueba\n- Se realizó calibración tomando lecturas en puntos ascendentes y descendentes del rango\n- Se reinstaló el equipo con teflón, verificar ausencia de fugas\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Tester Fluke, bombas de presión, cilindros de aire comprimido, módulos de presión, llaves mixtas, llave para tubo, destornilladores, kit de reparación, aeropak"
 },
 {
  "prefijo": "PC",
  "nombre": "Controlador de presion",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "PIC",
  "nombre": "Controlador indicador de presion",
  "proc": "P-SG-04551",
  "descripcion": "Trabajo realizado:\n- Se desmontó el equipo y se realizó limpieza técnica a tapas, tarjetas y cápsula en el laboratorio\n- Se verificó la linealidad comparando tres puntos del rango con un patrón certificado\n- Se reinstaló el transmisor y se validó la correcta señal en el DCS\n- Se realizó pruebas de fugas\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Calibradores Fluke, multímetro digital, interfaces Trex o 475, estación generadora de presión, manómetros, comunicadores Hart/Fieldbus, llaves y destornilladores"
 },
 {
  "prefijo": "PIT",
  "nombre": "Transmisor indicador de presion",
  "proc": "P-SG-04551",
  "descripcion": "Trabajo realizado:\n- Se desmontó el equipo y se realizó limpieza técnica a tapas, tarjetas y cápsula en el laboratorio\n- Se verificó la linealidad comparando tres puntos del rango con un patrón certificado\n- Se reinstaló el transmisor y se validó la correcta señal en el DCS\n- Se realizó pruebas de fugas\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Calibradores Fluke, multímetro digital, interfaces Trex o 475, estación generadora de presión, manómetros, comunicadores Hart/Fieldbus, llaves y destornilladores"
 },
 {
  "prefijo": "PSH",
  "nombre": "Switch de presion (alta)",
  "proc": "P-SG-04553",
  "descripcion": "Trabajo realizado:\n- Se desconectó eléctricamente el equipo y retirarlo de la toma a proceso asegurando la despresurización\n- Se trasladó el instrumento al laboratorio para realizar limpieza técnica a tapas y sensores\n- Se acopló el switch a un sistema de aire con manómetro de referencia y multímetro digital\n- Se verificó el punto de operación actual comparándolo contra el set de disparo definido\n- Se ajustó el tornillo de calibración hasta alcanzar el valor deseado\n- Se ejecutó pruebas repetitivas para confirmar la estabilidad del disparo y se registró los valores finales\n- Se reinstaló el equipo en sitio validando la ausencia de fugas y la señal en el sistema de control\n- Se formalizó la entrega a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Cilindro de aire comprimido, regulador de presión, mangueras, conectores, manómetro de referencia, multímetro digital, llaves (7/16, tubo, expansión), destornillador, cinta aislante"
 },
 {
  "prefijo": "PSL",
  "nombre": "Switch de presion (baja)",
  "proc": "P-SG-04553",
  "descripcion": "Trabajo realizado:\n- Se desconectó eléctricamente el equipo y retirarlo de la toma a proceso asegurando la despresurización\n- Se trasladó el instrumento al laboratorio para realizar limpieza técnica a tapas y sensores\n- Se acopló el switch a un sistema de aire con manómetro de referencia y multímetro digital\n- Se verificó el punto de operación actual comparándolo contra el set de disparo definido\n- Se ajustó el tornillo de calibración hasta alcanzar el valor deseado\n- Se ejecutó pruebas repetitivas para confirmar la estabilidad del disparo y se registró los valores finales\n- Se reinstaló el equipo en sitio validando la ausencia de fugas y la señal en el sistema de control\n- Se formalizó la entrega a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Cilindro de aire comprimido, regulador de presión, mangueras, conectores, manómetro de referencia, multímetro digital, llaves (7/16, tubo, expansión), destornillador, cinta aislante"
 },
 {
  "prefijo": "SHUTDOWN",
  "nombre": "Prueba de shutdown en quemadores",
  "proc": "P-SG-04554",
  "descripcion": "Trabajo realizado:\n- Se verificó la calibración de los switches de presión de gas y aire de combustión\n- Se ajustó el setpoint del control de temperatura local por encima del sistema principal\n- Se simuló condiciones de baja y alta presión de gas para validar el apagado automático\n- Se provocó fallas por presión diferencial de aire para confirmar el cierre de seguridad\n- Se ejecutó pruebas de estanqueidad en las válvulas de shutoff mediante el método de burbujeo\n- Se normalizó los parámetros de operación y se retiró todos los dispositivos de prueba\n- Se registró los resultados de la actividad\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Multímetro digital, llaves mixtas, destornilladores, perilleros, bomba manual de vacío, mangueras, recipiente con agua jabonosa"
 },
 {
  "prefijo": "PV",
  "nombre": "Valvula de control de presion",
  "proc": "P-SG-04580",
  "descripcion": "Trabajo realizado:\n- Se limpió el actuador e inspeccionar conexiones eléctricas y neumáticas\n- Se verificó posiciones físicas generando señales al 0, 25, 50, 75 y 100%\n- Se lubricó tornillería, eje de la válvula, tapas y uniones universales\n- Se validó funcionamiento con el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Generador Fluke, interfaz 475/Trex, destornilladores, llave expansiva, llaves de tubo, grasa, limpiador Aeropax, trapos",
  "tipo": "valvula"
 },
 {
  "prefijo": "FT",
  "nombre": "Transmisor de flujo",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04563",
    "nombre": "Flujo DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el transmisor del proceso\n- Se realizó limpieza técnica de componentes en laboratorio\n- Se verificó el equipo en puntos de 0, 50 y 100% del rango\n- Se reinstaló el equipo y se normalizó válvulas en campo\n- Se validó indicación en sistema de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves mixtas y de tubo, calibrador Fluke, multímetro, interfaz Trex/475, comunicador Hart/Fieldbus, bomba de presión, manómetros"
   },
   {
    "proc": "P-SG-04564",
    "nombre": "Flujo masico (Coriolis)",
    "descripcion": "Trabajo realizado:\n- Se revisó soportería del sensor y reapretar conexiones de potencia y señal\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se verificó estado de alarmas en el display y color del LED\n- Se almacenó respaldo de la configuración con comunicador de campo\n- Se validó indicación en el DCS\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475 o Trex), llaves 9/16\" y 15/16\", llave para tubo, destornillador aislado, grasa, desplazador de humedad, resistor"
   },
   {
    "proc": "P-SG-04565",
    "nombre": "Flujo vortex",
    "descripcion": "Trabajo realizado:\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se reapretó conexiones de potencia y señal con herramientas aisladas\n- Se limpió y se lubricó uniones universales y tornillos de acople\n- Se respaldó configuración del equipo mediante comunicador HART 475 o Trex\n- Se validó indicación en el DCS y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475/Trex), resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04566",
    "nombre": "Flujo magnetico",
    "descripcion": "Trabajo realizado:\n- Se retiró el fusible de potencia y abrir las tapas de conexión\n- Se reapretó conexiones de potencia, bobina, electrodos y terminales de tierra\n- Se limpió y se lubricó roscas, tornillería y uniones universales\n- Se verificó indicación de cero con tubo lleno y sin flujo\n- Se validó señal con el cuarto de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   }
  ]
 },
 {
  "prefijo": "FE",
  "nombre": "Elemento de flujo",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04563",
    "nombre": "Flujo DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el transmisor del proceso\n- Se realizó limpieza técnica de componentes en laboratorio\n- Se verificó el equipo en puntos de 0, 50 y 100% del rango\n- Se reinstaló el equipo y se normalizó válvulas en campo\n- Se validó indicación en sistema de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves mixtas y de tubo, calibrador Fluke, multímetro, interfaz Trex/475, comunicador Hart/Fieldbus, bomba de presión, manómetros"
   },
   {
    "proc": "P-SG-04564",
    "nombre": "Flujo masico (Coriolis)",
    "descripcion": "Trabajo realizado:\n- Se revisó soportería del sensor y reapretar conexiones de potencia y señal\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se verificó estado de alarmas en el display y color del LED\n- Se almacenó respaldo de la configuración con comunicador de campo\n- Se validó indicación en el DCS\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475 o Trex), llaves 9/16\" y 15/16\", llave para tubo, destornillador aislado, grasa, desplazador de humedad, resistor"
   },
   {
    "proc": "P-SG-04565",
    "nombre": "Flujo vortex",
    "descripcion": "Trabajo realizado:\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se reapretó conexiones de potencia y señal con herramientas aisladas\n- Se limpió y se lubricó uniones universales y tornillos de acople\n- Se respaldó configuración del equipo mediante comunicador HART 475 o Trex\n- Se validó indicación en el DCS y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475/Trex), resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04566",
    "nombre": "Flujo magnetico",
    "descripcion": "Trabajo realizado:\n- Se retiró el fusible de potencia y abrir las tapas de conexión\n- Se reapretó conexiones de potencia, bobina, electrodos y terminales de tierra\n- Se limpió y se lubricó roscas, tornillería y uniones universales\n- Se verificó indicación de cero con tubo lleno y sin flujo\n- Se validó señal con el cuarto de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   }
  ]
 },
 {
  "prefijo": "FI",
  "nombre": "Indicador de flujo",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04563",
    "nombre": "Flujo DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el transmisor del proceso\n- Se realizó limpieza técnica de componentes en laboratorio\n- Se verificó el equipo en puntos de 0, 50 y 100% del rango\n- Se reinstaló el equipo y se normalizó válvulas en campo\n- Se validó indicación en sistema de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves mixtas y de tubo, calibrador Fluke, multímetro, interfaz Trex/475, comunicador Hart/Fieldbus, bomba de presión, manómetros"
   },
   {
    "proc": "P-SG-04564",
    "nombre": "Flujo masico (Coriolis)",
    "descripcion": "Trabajo realizado:\n- Se revisó soportería del sensor y reapretar conexiones de potencia y señal\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se verificó estado de alarmas en el display y color del LED\n- Se almacenó respaldo de la configuración con comunicador de campo\n- Se validó indicación en el DCS\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475 o Trex), llaves 9/16\" y 15/16\", llave para tubo, destornillador aislado, grasa, desplazador de humedad, resistor"
   },
   {
    "proc": "P-SG-04565",
    "nombre": "Flujo vortex",
    "descripcion": "Trabajo realizado:\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se reapretó conexiones de potencia y señal con herramientas aisladas\n- Se limpió y se lubricó uniones universales y tornillos de acople\n- Se respaldó configuración del equipo mediante comunicador HART 475 o Trex\n- Se validó indicación en el DCS y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475/Trex), resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04566",
    "nombre": "Flujo magnetico",
    "descripcion": "Trabajo realizado:\n- Se retiró el fusible de potencia y abrir las tapas de conexión\n- Se reapretó conexiones de potencia, bobina, electrodos y terminales de tierra\n- Se limpió y se lubricó roscas, tornillería y uniones universales\n- Se verificó indicación de cero con tubo lleno y sin flujo\n- Se validó señal con el cuarto de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   }
  ]
 },
 {
  "prefijo": "FIC",
  "nombre": "Controlador indicador de flujo",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04563",
    "nombre": "Flujo DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el transmisor del proceso\n- Se realizó limpieza técnica de componentes en laboratorio\n- Se verificó el equipo en puntos de 0, 50 y 100% del rango\n- Se reinstaló el equipo y se normalizó válvulas en campo\n- Se validó indicación en sistema de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves mixtas y de tubo, calibrador Fluke, multímetro, interfaz Trex/475, comunicador Hart/Fieldbus, bomba de presión, manómetros"
   },
   {
    "proc": "P-SG-04564",
    "nombre": "Flujo masico (Coriolis)",
    "descripcion": "Trabajo realizado:\n- Se revisó soportería del sensor y reapretar conexiones de potencia y señal\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se verificó estado de alarmas en el display y color del LED\n- Se almacenó respaldo de la configuración con comunicador de campo\n- Se validó indicación en el DCS\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475 o Trex), llaves 9/16\" y 15/16\", llave para tubo, destornillador aislado, grasa, desplazador de humedad, resistor"
   },
   {
    "proc": "P-SG-04565",
    "nombre": "Flujo vortex",
    "descripcion": "Trabajo realizado:\n- Se limpió componentes con desplazador de humedad y se lubricó roscas de tapas\n- Se reapretó conexiones de potencia y señal con herramientas aisladas\n- Se limpió y se lubricó uniones universales y tornillos de acople\n- Se respaldó configuración del equipo mediante comunicador HART 475 o Trex\n- Se validó indicación en el DCS y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, comunicador HART (475/Trex), resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04566",
    "nombre": "Flujo magnetico",
    "descripcion": "Trabajo realizado:\n- Se retiró el fusible de potencia y abrir las tapas de conexión\n- Se reapretó conexiones de potencia, bobina, electrodos y terminales de tierra\n- Se limpió y se lubricó roscas, tornillería y uniones universales\n- Se verificó indicación de cero con tubo lleno y sin flujo\n- Se validó señal con el cuarto de control\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves 9/16\" y 15/16\", llave para tubo, destornillador de pala, grasa, desplazador de humedad"
   }
  ]
 },
 {
  "prefijo": "FC",
  "nombre": "Controlador de flujo",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "FV",
  "nombre": "Valvula de control de flujo",
  "proc": "P-SG-04580",
  "descripcion": "Trabajo realizado:\n- Se limpió el actuador e inspeccionar conexiones eléctricas y neumáticas\n- Se verificó posiciones físicas generando señales al 0, 25, 50, 75 y 100%\n- Se lubricó tornillería, eje de la válvula, tapas y uniones universales\n- Se validó funcionamiento con el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Generador Fluke, interfaz 475/Trex, destornilladores, llave expansiva, llaves de tubo, grasa, limpiador Aeropax, trapos",
  "tipo": "valvula"
 },
 {
  "prefijo": "LT",
  "nombre": "Transmisor de nivel",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04571",
    "nombre": "Nivel DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el equipo del proceso para traslado al laboratorio\n- Se realizó limpieza técnica de componentes externos e internos\n- Se verificó el instrumento en 0, 50 y 100% del rango de medida\n- Se reinstaló el equipo, normalizar válvulas y se validó funcionamiento en DCS\n- Se registró resultados de calibración\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Bombas de presión, multímetro Fluke, comunicador HART (Trex/475), fuente 24VDC, resistencia 250Ω, llaves mixtas, llave para tubo, destornilladores, grasa"
   },
   {
    "proc": "P-SG-04572",
    "nombre": "Nivel radar de antena",
    "descripcion": "Trabajo realizado:\n- Se anotó valor de PV en el DCS y abrir cámara de conexiones\n- Se limpió sulfato, reapretar terminales y se verificó conexión a tierra\n- Se lubricó hilos de rosca de tapas y uniones universales\n- Se validó indicación local contra DCS y se realizó prueba de loop\n- Se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves (9/16”, 15/16”, de tubo), destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04573",
    "nombre": "Nivel MTS (tanques salchicha)",
    "descripcion": "Trabajo realizado:\n- Se marcó puntos de prueba en la varilla y asegurar el collarín de sujeción\n- Se instaló el equipo y flotador en el tanque bajo protocolos de seguridad y rescate\n- Se validó la indicación en el display local, el multímetro y el sistema de control\n- Se inspeccionó la integridad física del flotador mediante pruebas de tintas penetrantes\n- Se normalizó conexiones, retirar herramientas del tanque\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Fuente 24VDC, multímetro, comunicador Trex/475, llaves Allen y fijas, trípode, arnés, grúa, tintas penetrantes"
   },
   {
    "proc": "P-SG-04574",
    "nombre": "Nivel radar de onda guiada",
    "descripcion": "Trabajo realizado:\n- Se registró valor de PV y desconectar cableado de alimentación\n- Se limpió sulfato, reapretar terminales y se verificó conexión a tierra\n- Se lubricó hilos de rosca de tapas y uniones universales\n- Se validó que la indicación local coincida con el cuarto de control\n- Se realizó prueba de loop y se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves (9/16”, 15/16”, de tubo), destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04576",
    "nombre": "Nivel Drexelbrook",
    "descripcion": "Trabajo realizado:\n- Se verificó el estado de la guaya y la resistencia de las conexiones a tierra\n- Se comprobó que la impedancia del protector de transientes sea cercana a 50 ohmios\n- Se ejecutó ajuste de span con el equipo a nivel máximo\n- Se validó la indicación en el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves (allen, mixtas, expansión, de tubo), multímetro digital, destornilladores, interfaz 475 o Trex, andamio, arnés"
   }
  ]
 },
 {
  "prefijo": "LIT",
  "nombre": "Transmisor indicador de nivel",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04571",
    "nombre": "Nivel DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el equipo del proceso para traslado al laboratorio\n- Se realizó limpieza técnica de componentes externos e internos\n- Se verificó el instrumento en 0, 50 y 100% del rango de medida\n- Se reinstaló el equipo, normalizar válvulas y se validó funcionamiento en DCS\n- Se registró resultados de calibración\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Bombas de presión, multímetro Fluke, comunicador HART (Trex/475), fuente 24VDC, resistencia 250Ω, llaves mixtas, llave para tubo, destornilladores, grasa"
   },
   {
    "proc": "P-SG-04572",
    "nombre": "Nivel radar de antena",
    "descripcion": "Trabajo realizado:\n- Se anotó valor de PV en el DCS y abrir cámara de conexiones\n- Se limpió sulfato, reapretar terminales y se verificó conexión a tierra\n- Se lubricó hilos de rosca de tapas y uniones universales\n- Se validó indicación local contra DCS y se realizó prueba de loop\n- Se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves (9/16”, 15/16”, de tubo), destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04573",
    "nombre": "Nivel MTS (tanques salchicha)",
    "descripcion": "Trabajo realizado:\n- Se marcó puntos de prueba en la varilla y asegurar el collarín de sujeción\n- Se instaló el equipo y flotador en el tanque bajo protocolos de seguridad y rescate\n- Se validó la indicación en el display local, el multímetro y el sistema de control\n- Se inspeccionó la integridad física del flotador mediante pruebas de tintas penetrantes\n- Se normalizó conexiones, retirar herramientas del tanque\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Fuente 24VDC, multímetro, comunicador Trex/475, llaves Allen y fijas, trípode, arnés, grúa, tintas penetrantes"
   },
   {
    "proc": "P-SG-04574",
    "nombre": "Nivel radar de onda guiada",
    "descripcion": "Trabajo realizado:\n- Se registró valor de PV y desconectar cableado de alimentación\n- Se limpió sulfato, reapretar terminales y se verificó conexión a tierra\n- Se lubricó hilos de rosca de tapas y uniones universales\n- Se validó que la indicación local coincida con el cuarto de control\n- Se realizó prueba de loop y se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves (9/16”, 15/16”, de tubo), destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04576",
    "nombre": "Nivel Drexelbrook",
    "descripcion": "Trabajo realizado:\n- Se verificó el estado de la guaya y la resistencia de las conexiones a tierra\n- Se comprobó que la impedancia del protector de transientes sea cercana a 50 ohmios\n- Se ejecutó ajuste de span con el equipo a nivel máximo\n- Se validó la indicación en el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves (allen, mixtas, expansión, de tubo), multímetro digital, destornilladores, interfaz 475 o Trex, andamio, arnés"
   }
  ]
 },
 {
  "prefijo": "LI",
  "nombre": "Indicador de nivel",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04571",
    "nombre": "Nivel DP (presion diferencial)",
    "descripcion": "Trabajo realizado:\n- Se aisló y desmontar el equipo del proceso para traslado al laboratorio\n- Se realizó limpieza técnica de componentes externos e internos\n- Se verificó el instrumento en 0, 50 y 100% del rango de medida\n- Se reinstaló el equipo, normalizar válvulas y se validó funcionamiento en DCS\n- Se registró resultados de calibración\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Bombas de presión, multímetro Fluke, comunicador HART (Trex/475), fuente 24VDC, resistencia 250Ω, llaves mixtas, llave para tubo, destornilladores, grasa"
   },
   {
    "proc": "P-SG-04572",
    "nombre": "Nivel radar de antena",
    "descripcion": "Trabajo realizado:\n- Se anotó valor de PV en el DCS y abrir cámara de conexiones\n- Se limpió sulfato, reapretar terminales y se verificó conexión a tierra\n- Se lubricó hilos de rosca de tapas y uniones universales\n- Se validó indicación local contra DCS y se realizó prueba de loop\n- Se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves (9/16”, 15/16”, de tubo), destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04573",
    "nombre": "Nivel MTS (tanques salchicha)",
    "descripcion": "Trabajo realizado:\n- Se marcó puntos de prueba en la varilla y asegurar el collarín de sujeción\n- Se instaló el equipo y flotador en el tanque bajo protocolos de seguridad y rescate\n- Se validó la indicación en el display local, el multímetro y el sistema de control\n- Se inspeccionó la integridad física del flotador mediante pruebas de tintas penetrantes\n- Se normalizó conexiones, retirar herramientas del tanque\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Fuente 24VDC, multímetro, comunicador Trex/475, llaves Allen y fijas, trípode, arnés, grúa, tintas penetrantes"
   },
   {
    "proc": "P-SG-04574",
    "nombre": "Nivel radar de onda guiada",
    "descripcion": "Trabajo realizado:\n- Se registró valor de PV y desconectar cableado de alimentación\n- Se limpió sulfato, reapretar terminales y se verificó conexión a tierra\n- Se lubricó hilos de rosca de tapas y uniones universales\n- Se validó que la indicación local coincida con el cuarto de control\n- Se realizó prueba de loop y se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, interfaz HART, resistor, llaves (9/16”, 15/16”, de tubo), destornillador de pala, grasa, desplazador de humedad"
   },
   {
    "proc": "P-SG-04576",
    "nombre": "Nivel Drexelbrook",
    "descripcion": "Trabajo realizado:\n- Se verificó el estado de la guaya y la resistencia de las conexiones a tierra\n- Se comprobó que la impedancia del protector de transientes sea cercana a 50 ohmios\n- Se ejecutó ajuste de span con el equipo a nivel máximo\n- Se validó la indicación en el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Llaves (allen, mixtas, expansión, de tubo), multímetro digital, destornilladores, interfaz 475 o Trex, andamio, arnés"
   }
  ]
 },
 {
  "prefijo": "LIC",
  "nombre": "Controlador indicador de nivel",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "LC",
  "nombre": "Controlador de nivel",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "LV",
  "nombre": "Valvula de control de nivel",
  "proc": "P-SG-04580",
  "descripcion": "Trabajo realizado:\n- Se limpió el actuador e inspeccionar conexiones eléctricas y neumáticas\n- Se verificó posiciones físicas generando señales al 0, 25, 50, 75 y 100%\n- Se lubricó tornillería, eje de la válvula, tapas y uniones universales\n- Se validó funcionamiento con el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Generador Fluke, interfaz 475/Trex, destornilladores, llave expansiva, llaves de tubo, grasa, limpiador Aeropax, trapos",
  "tipo": "valvula"
 },
 {
  "prefijo": "LG",
  "nombre": "Visor de nivel (level gauge)",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "TE",
  "nombre": "Elemento de temperatura",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04540",
    "nombre": "RTD (Pt100)",
    "descripcion": "Trabajo realizado:\n- Se desmontó la RTD previa desconexión eléctrica y verificación de la existencia de termopozo\n- Se realizó pruebas de impedancia y verificación de linealidad en cinco puntos del rango usando bloque seco\n- Se evaluó errores de medición y sustituir el sensor si excede la tolerancia permitida de 0.5°C o 1°C\n- Se reinstaló el equipo garantizando el contacto con el fondo del termopozo y reconectar señales\n- Se validó la correcta indicación en el cuarto de control comparando con los valores medidos en campo\n- Se entregó el equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Multímetro Fluke, calibradores de proceso (724, 725, 726, 744), horno de bloque seco, llaves de tubo, destornilladores, cinta aislante, waipes, aeropax, grasa"
   },
   {
    "proc": "P-SG-04541",
    "nombre": "Termocupla J/K",
    "descripcion": "Trabajo realizado:\n- Se desmontó la termocupla previa verificación de termopozo y registro de lectura actual en el cuarto de control\n- Se identificó el tipo de sensor (J o K) mediante pruebas de magnetismo utilizando un imán\n- Se realizó la verificación en taller comparando tres puntos del rango con un horno de bloque seco y calibrador certificado\n- Se reinstaló el sensor garantizando inmersión total y se validó la correcta señal en el sistema de control\n- Se entregó el equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Multímetro, calibradores Fluke (724, 725, 726, 744), horno de bloque seco, imán, llaves de tubo, destornilladores, cinta aislante, waipe, aeropak, grasa"
   }
  ]
 },
 {
  "prefijo": "TT",
  "nombre": "Transmisor de temperatura",
  "proc": "P-SG-04544",
  "descripcion": "Trabajo realizado:\n- Se desmontó el transmisor del proceso previa desconexión eléctrica y se realizó limpieza técnica a las piezas\n- Se verificó la respuesta del equipo generando valores al 0, 25, 50, 75 y 100% de su rango de medida\n- Se reinstaló el transmisor lubricando roscas y validando la correcta indicación de temperatura en el cuarto de control\n- Se formalizó la entrega del equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Tester Fluke 179, interfaz HART, calibradores de proceso 744/724/725/726, calentador de bloque seco, llaves de 9/16” y 15/16”, llave para tubo, destornillador de pala, cinta aislante"
 },
 {
  "prefijo": "TIT",
  "nombre": "Transmisor indicador de temperatura",
  "proc": "P-SG-04544",
  "descripcion": "Trabajo realizado:\n- Se desmontó el transmisor del proceso previa desconexión eléctrica y se realizó limpieza técnica a las piezas\n- Se verificó la respuesta del equipo generando valores al 0, 25, 50, 75 y 100% de su rango de medida\n- Se reinstaló el transmisor lubricando roscas y validando la correcta indicación de temperatura en el cuarto de control\n- Se formalizó la entrega del equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Tester Fluke 179, interfaz HART, calibradores de proceso 744/724/725/726, calentador de bloque seco, llaves de 9/16” y 15/16”, llave para tubo, destornillador de pala, cinta aislante"
 },
 {
  "prefijo": "TI",
  "nombre": "Indicador de temperatura (termometro)",
  "proc": "P-SG-04542",
  "descripcion": "Trabajo realizado:\n- Se desmontó el equipo del sitio verificando la presencia de termopozo y trasladarlo al taller\n- Se realizó limpieza técnica de la carátula y el bulbo para eliminar residuos\n- Se verificó la precisión comparando lecturas contra un bloque seco al 0%, 50% y 100% del rango\n- Se ejecutó ajustes mediante el tornillo posterior en caso de detectar desviaciones\n- Se reinstaló el instrumento asegurando la visibilidad de la carátula y su correcta operación\n- Se formalizó la entrega a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Llave para tubo, llave de expansión, destornillador de pala, cinta aislante, calibradores Fluke (744, 726, 725, 705), multímetro digital, bloque seco"
 },
 {
  "prefijo": "TIC",
  "nombre": "Controlador indicador de temperatura",
  "proc": "P-SG-04545",
  "descripcion": "Trabajo realizado:\n- Se determinó el tipo de entrada y configuración de termocupla en el controlador\n- Se verificó la precisión en tres puntos del rango usando bloque seco o termocupla patrón con calibrador\n- Se ejecutó ajustes de corrección de entrada (off-set) sin desviaciones fuera de tolerancia detectadas\n- Se validó la estabilidad del controlador en su punto de operación normal\n- Se etiquetó el instrumento, entregarlo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Termocupla patrón, calibradores Fluke (724, 725, 726, 744), horno de bloque seco, destornilladores, llaves mixtas, llave de expansión, llaves Allen"
 },
 {
  "prefijo": "TC",
  "nombre": "Controlador de temperatura",
  "proc": "P-SG-04545",
  "descripcion": "Trabajo realizado:\n- Se determinó el tipo de entrada y configuración de termocupla en el controlador\n- Se verificó la precisión en tres puntos del rango usando bloque seco o termocupla patrón con calibrador\n- Se ejecutó ajustes de corrección de entrada (off-set) sin desviaciones fuera de tolerancia detectadas\n- Se validó la estabilidad del controlador en su punto de operación normal\n- Se etiquetó el instrumento, entregarlo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Termocupla patrón, calibradores Fluke (724, 725, 726, 744), horno de bloque seco, destornilladores, llaves mixtas, llave de expansión, llaves Allen"
 },
 {
  "prefijo": "TV",
  "nombre": "Valvula de control de temperatura",
  "proc": "P-SG-04580",
  "descripcion": "Trabajo realizado:\n- Se limpió el actuador e inspeccionar conexiones eléctricas y neumáticas\n- Se verificó posiciones físicas generando señales al 0, 25, 50, 75 y 100%\n- Se lubricó tornillería, eje de la válvula, tapas y uniones universales\n- Se validó funcionamiento con el cuarto de control y se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Generador Fluke, interfaz 475/Trex, destornilladores, llave expansiva, llaves de tubo, grasa, limpiador Aeropax, trapos",
  "tipo": "valvula"
 },
 {
  "prefijo": "AT",
  "nombre": "Analizador/transmisor de gas",
  "proc": "P-SG-04632",
  "descripcion": "Trabajo realizado:\n- Se tramitó permisos de trabajo y solicitar el equipo a producción mediante la orden de trabajo\n- Se realizó la verificación de cero en modo calibración empleando gas de referencia o aire atmosférico\n- Se ejecutó la verificación de span aplicando gas patrón y esperando la estabilización de la medida\n- Se normalizó el detector, lubricar roscas y se validó la señal en el sistema de control\n- Se entregó el equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Multímetro Fluke, llaves de tubo, destornilladores, imán, copa de calibración, gases patrón, grasa, aeropak"
 },
 {
  "prefijo": "AI",
  "nombre": "Indicador de analisis de gas",
  "proc": "P-SG-04632",
  "descripcion": "Trabajo realizado:\n- Se tramitó permisos de trabajo y solicitar el equipo a producción mediante la orden de trabajo\n- Se realizó la verificación de cero en modo calibración empleando gas de referencia o aire atmosférico\n- Se ejecutó la verificación de span aplicando gas patrón y esperando la estabilización de la medida\n- Se normalizó el detector, lubricar roscas y se validó la señal en el sistema de control\n- Se entregó el equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Multímetro Fluke, llaves de tubo, destornilladores, imán, copa de calibración, gases patrón, grasa, aeropak"
 },
 {
  "prefijo": "SOV",
  "nombre": "Valvula solenoide on-off",
  "proc": "P-SG-04586 + P-SG-04585",
  "descripcion": "Procedimientos combinados P-SG-04586 (micros de posicion) y P-SG-04585 (valvula on-off).\nTrabajo realizado (P-SG-04586):\n- Se verificó indicación en DCS y abrir la caja de micros con precaución\n- Se midió voltajes de operación y reemplazar switches o imanes defectuosos\n- Se normalizó actuadores mecánicos y solicitar pruebas de movimiento al cuarto de control\n- Se aplicó grasa en tornillería y se cerró la caja de conexiones\n- Se confirmó indicación correcta en campo, entregar a producción\nTrabajo realizado (P-SG-04585):\n- Se desacopló y bajar la válvula para traslado al taller\n- Se desarmó el equipo retirando vástago, bola y sellos previos\n- Se realizó limpieza técnica de componentes internos y externos\n- Se armó la válvula instalando sellos nuevos y ajustando con torquímetro\n- Se ejecutó pruebas de presión en banco y se validó operación en campo\n- Se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Llave para tubo, llave de expansión, destornillador de pala, dado 7/16”, llave allen 7/32, multímetro digital, grasa; Llaves mixtas, llaves Allen, llave de expansión, llave de tubo, torquímetro, multímetro digital, banco de pruebas de presión"
 },
 {
  "prefijo": "VSP",
  "nombre": "Valvula solenoide/posicion on-off",
  "proc": "P-SG-04586 + P-SG-04585",
  "descripcion": "Procedimientos combinados P-SG-04586 (micros de posicion) y P-SG-04585 (valvula on-off).\nTrabajo realizado (P-SG-04586):\n- Se verificó indicación en DCS y abrir la caja de micros con precaución\n- Se midió voltajes de operación y reemplazar switches o imanes defectuosos\n- Se normalizó actuadores mecánicos y solicitar pruebas de movimiento al cuarto de control\n- Se aplicó grasa en tornillería y se cerró la caja de conexiones\n- Se confirmó indicación correcta en campo, entregar a producción\nTrabajo realizado (P-SG-04585):\n- Se desacopló y bajar la válvula para traslado al taller\n- Se desarmó el equipo retirando vástago, bola y sellos previos\n- Se realizó limpieza técnica de componentes internos y externos\n- Se armó la válvula instalando sellos nuevos y ajustando con torquímetro\n- Se ejecutó pruebas de presión en banco y se validó operación en campo\n- Se entregó a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Llave para tubo, llave de expansión, destornillador de pala, dado 7/16”, llave allen 7/32, multímetro digital, grasa; Llaves mixtas, llaves Allen, llave de expansión, llave de tubo, torquímetro, multímetro digital, banco de pruebas de presión"
 },
 {
  "prefijo": "OFD",
  "nombre": "Detector de incendio y llama",
  "proc": "P-SG-04635",
  "descripcion": "Trabajo realizado:\n- Se aisló suministro desde DCS y abrir cámara de conexiones\n- Se extraió módulo para revisar conexiones de potencia y alarma\n- Se limpió superficies ópticas y se lubricó roscas y uniones universales\n- Se ejecutó prueba de verificación con lámpara portátil inhibiendo alarmas\n- Se validó funcionamiento mediante LEDs y salidas de relés\n- Se entregó equipo\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Tester Fluke, llaves mixtas, llave para tubo, destornillador bornero, cinta aislante, grasa, desplazador de humedad, lámpara de prueba portátil TL-2055"
 },
 {
  "prefijo": "WT",
  "nombre": "Transmisor de peso (celda de carga)",
  "proc": "P-SG-04533",
  "descripcion": "Trabajo realizado:\n- Se verificó que el tanque esté vacío y se consultó el rango del instrumento en el sistema de control\n- Se limpió el transmisor y se revisó el estado de las conexiones eléctricas y del cableado\n- Se midió la salida en milivoltios de cada celda y la corriente de señal en miliamperios\n- Se instaló la plataforma y se aplicó pesas patrones hasta alcanzar cerca del 100% del rango\n- Se validó las lecturas locales y en el DCS comparándolas contra el valor del patrón certificado\n- Se retiró los patrones\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
  "equipos": "Pesas patrones, plataforma de pesaje, multímetro Fluke, llaves mixtas, destornilladores, raches, copas, waipe, aeropak, grasa"
 },
 {
  "prefijo": "WT-TORQUE",
  "nombre": "Transmisor de torque (centrifuga)",
  "proc": "",
  "opciones": [
   {
    "proc": "P-SG-04618",
    "nombre": "Torque centrifuga CE-6H",
    "descripcion": "Trabajo realizado:\n- Se desenergizó el motor y se retiró el pin de unión del sensor al eje\n- Se instaló la varilla de referencia y se aplicó las pesas patrones correspondientes\n- Se configuró el span mediante los switches de la tarjeta electrónica\n- Se validó la indicación en el cuarto de control en diversos puntos de la escala\n- Se retiró pesas, reinstalar el pin de acople y se verificó la alineación\n- Se entregó el equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, pesas patrones, varilla de referencia, fuente de mV, llaves mixtas, llave para tubo, llave de expansión, destornillador, cinta aislante"
   },
   {
    "proc": "P-SG-04619",
    "nombre": "Torque centrifugas CE-8H/9H, F-3424/F-3425",
    "descripcion": "Trabajo realizado:\n- Se desenergizó el motor y se retiró el brazo de apoyo de la celda de carga\n- Se conectó un multímetro en serie para monitorear la señal de 4-20 mA\n- Se aplicó tensión con el dinamómetro hasta alcanzar el valor de span especificado\n- Se ejecutó el ajuste de span a 20 mA a través del menú del transmisor\n- Se validó la indicación en el cuarto de control y se retiró el dinamómetro\n- Se normalizó la posición de la celda de carga y se reinstaló el brazo de apoyo\n- Se entregó equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, dinamómetro con soportería, varillas tensoras, llaves mixtas (9/16, 7/16, 1/2, 3/4), llave para tubo, llave de expansión, destornillador de pala, cinta aislante"
   },
   {
    "proc": "P-SG-04620",
    "nombre": "Torque centrifugas CE-1H a 7H y F-3423",
    "descripcion": "Trabajo realizado:\n- Se desenergizó el equipo y se retiró el pin de unión entre el sensor y el eje\n- Se instaló la varilla de referencia y se aplicó las pesas patrones correspondientes\n- Se configuró el punto de span al torque máximo en el menú de calibración\n- Se validó la indicación en el cuarto de control contra los valores de la tabla\n- Se retiró la instrumentación de prueba y se reinstaló el pin de acople asegurando su alineación\n- Se entregó el equipo a producción\nEl equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.",
    "equipos": "Tester Fluke, pesas patrones secundarias, varilla de referencia (24 in), fuente de mV, llaves mixtas, llave para tubo, llave de expansión, destornillador, cinta aislante"
   }
  ]
 },
 {
  "prefijo": "SV",
  "nombre": "Valvula solenoide",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "HV",
  "nombre": "Valvula manual (hand valve)",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "HAD",
  "nombre": "HAD",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "VTRC",
  "nombre": "VTRC",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 },
 {
  "prefijo": "EX",
  "nombre": "EX (tag)",
  "proc": "",
  "descripcion": "",
  "equipos": ""
 }
];