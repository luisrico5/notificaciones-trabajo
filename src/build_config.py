# -*- coding: utf-8 -*-
import re, json, os

# Rutas relativas a este script (carpeta src/). Requiere src/answers/proc_*.txt
SP = os.path.dirname(os.path.abspath(__file__))
ANS = os.path.join(SP, 'answers')

def clean(t):
    t = re.sub(r'\s*\[[0-9,\s\-–]+\]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t.strip(' .;|')

def parse(code):
    raw = open(os.path.join(ANS, 'proc_%s.txt' % code), encoding='utf-8', errors='replace').read()
    m = re.search(r'Answer:(.*?)(?:Resumed conversation:|$)', raw, re.S)
    body = (m.group(1) if m else raw).replace('\n', ' ')
    mm = re.search(r'OBJETO:\s*(.*?)\s*ACTIVIDADES:\s*(.*?)\s*EQUIPOS:\s*(.*)$', body, re.S)
    if not mm:
        raise SystemExit('No parse para %s' % code)
    return {'objeto': clean(mm.group(1)),
            'actividades': [clean(a) for a in mm.group(2).split('|') if clean(a)],
            'equipos': clean(mm.group(3))}

CODES = ['04533','04540','04541','04542','04544','04545','04551','04552','04553','04563','04564',
         '04565','04566','04571','04572','04573','04574','04576','04580','04585','04586','04618',
         '04619','04620','04632','04635']
D = {c: parse(c) for c in CODES}

# ---- Convertir actividad imperativa -> pasado afirmativo ("Se ...") ----
IRREG = {'hacer':'hizo','poner':'puso','reponer':'repuso','rehacer':'rehizo','medir':'midió'}
def to_past(w):
    low = w.lower()
    if low in IRREG: return 'Se ' + IRREG[low]
    if low.endswith('ar'): return 'Se ' + low[:-2] + 'ó'
    if low.endswith('er') or low.endswith('ir'): return 'Se ' + low[:-2] + 'ió'
    return 'Se ' + low
# reemplazos para neutralizar condicionales (el equipo respondió bien)
COND = [
    ('en caso de desviaciones superiores al 3%', 'sin superar la tolerancia del 3%'),
    ('en caso de desviaciones superiores al 0.5%', 'sin superar la tolerancia del 0.5%'),
    ('en caso de desviaciones de tolerancia', 'quedando dentro de tolerancia'),
    ('ante desviaciones de tolerancia', 'quedando dentro de tolerancia'),
    ('en caso de desviaciones', 'sin desviaciones fuera de tolerancia'),
    ('ante desviaciones', 'sin desviaciones fuera de tolerancia'),
    ('si existen desviaciones de tolerancia', 'sin desviaciones fuera de tolerancia'),
    ('si se detectan desviaciones fuera de tolerancia', 'sin detectarse desviaciones fuera de tolerancia'),
    ('si se detectan desviaciones', 'sin detectarse desviaciones'),
    ('si se requieren', ''), ('si es necesario', ''), ('si es requerido', ''),
    ('si aplica', ''), ('si aplicaba', ''), ('en caso de requerirse', ''),
]
# segundos verbos tras " y "
MID = {' y realizar ':' y se realizó ', ' y verificar ':' y se verificó ', ' y validar ':' y se validó ',
       ' y comprobar ':' y se comprobó ', ' y normalizar ':' y se normalizó ', ' y reportar ':' y se reportó ',
       ' y cerrar ':' y se cerró ', ' y lubricar ':' y se lubricó ', ' y entregar ':' y se entregó ',
       ' y ejecutar ':' y se ejecutó ', ' y reinstalar ':' y se reinstaló ',
       ' y consultar ':' y se consultó ', ' y revisar ':' y se revisó ', ' y aplicar ':' y se aplicó ',
       ' y formalizar ':' y se formalizó ', ' y medir ':' y se midió ', ' y retirar ':' y se retiró ',
       ' y registrar ':' y se registró ', ' y realizar ':' y se realizó '}
def past_bullet(act):
    parts = act.split()
    s = (to_past(parts[0]) + ' ' + ' '.join(parts[1:])).strip()
    for a, b in COND: s = s.replace(a, b)
    for a, b in MID.items():  s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()

CLOSE = 'El equipo respondió correctamente al procedimiento; las verificaciones coincidieron con los patrones de referencia dentro de tolerancia.'

# --- Limpieza aplicada a TODAS las descripciones (bullets) ---
# 1) "la señal ... en el DCS o PLC" -> solo "DCS".
# 2) Eliminar cualquier mención de SAP: se quita el/los segmento(s) (unidos por " y ") que la contienen;
#    si el bullet queda vacío, se descarta.
# 3) Eliminar el bullet COMPLETO que diga que se ejecutó un ajuste de cero/Zero.
def clean_bullet(b):
    low = b.lower()
    if re.search(r'ajust\w*', low) and re.search(r'\b(cero|zero)\b', low):
        return None                                   # (3) línea de ajuste de cero -> fuera
    if 'sap' in low:                                  # (2) quitar mención de SAP
        parts = [p for p in re.split(r'\s+y\s+', b) if 'sap' not in p.lower()]
        if not parts:
            return None
        b = ' y '.join(parts).rstrip(' ,;')
    b = re.sub(r'DCS\s*(?:o|/)\s*PLC', 'DCS', b, flags=re.I)   # (1) DCS o PLC -> DCS
    return b
def bullets(code):
    out = []
    for a in D[code]['actividades']:
        cb = clean_bullet(past_bullet(a))
        if cb:
            out.append('- ' + cb)
    return '\n'.join(out)
def pdesc(code):
    return 'Trabajo realizado:\n' + bullets(code) + '\n' + CLOSE

PROC_NAME = {
 '04533':'Transmisores de peso dXp-40 BLH',
 '04618':'Torque centrifuga CE-6H','04619':'Torque centrifugas CE-8H/9H, F-3424/F-3425',
 '04620':'Torque centrifugas CE-1H a 7H y F-3423',
 '04540':'RTD (Pt100)','04541':'Termocupla J/K','04542':'Termometros bimetalicos',
 '04544':'Transmisores de temperatura','04545':'Controles de temperatura','04551':'Transmisores de presion',
 '04552':'Manometros','04553':'Switch de presion','04563':'Flujo DP (presion diferencial)','04564':'Flujo masico (Coriolis)',
 '04565':'Flujo vortex','04566':'Flujo magnetico','04571':'Nivel DP (presion diferencial)',
 '04572':'Nivel radar de antena','04573':'Nivel MTS (tanques salchicha)','04574':'Nivel radar de onda guiada',
 '04576':'Nivel Drexelbrook','04580':'Valvulas de control','04585':'Valvula on-off (interiores)',
 '04586':'Micros de posicion valvula on-off','04632':'Analizadores de amoniaco','04635':'Detector de incendio y llama FS24X'}

def opt(code):
    return {'proc':'P-SG-'+code,'nombre':PROC_NAME[code],'descripcion':pdesc(code),'equipos':D[code]['equipos']}
def single(prefijo, nombre, code):
    return {'prefijo':prefijo,'nombre':nombre,'proc':'P-SG-'+code,'descripcion':pdesc(code),'equipos':D[code]['equipos']}
def valve(prefijo, nombre):
    e = single(prefijo, nombre, '04580'); e['tipo'] = 'valvula'; return e
def multi(prefijo, nombre, codes):
    return {'prefijo':prefijo,'nombre':nombre,'proc':'','opciones':[opt(c) for c in codes]}
def combined(prefijo, nombre):
    desc = ('Procedimientos combinados P-SG-04586 (micros de posicion) y P-SG-04585 (valvula on-off).\n'
            'Trabajo realizado (P-SG-04586):\n' + bullets('04586') +
            '\nTrabajo realizado (P-SG-04585):\n' + bullets('04585') + '\n' + CLOSE)
    return {'prefijo':prefijo,'nombre':nombre,'proc':'P-SG-04586 + P-SG-04585','descripcion':desc,
            'equipos':D['04586']['equipos'] + '; ' + D['04585']['equipos']}
def generic(prefijo, nombre):
    return {'prefijo':prefijo,'nombre':nombre,'proc':'','descripcion':'','equipos':''}

FLOW = ['04563','04564','04565','04566']
LEVEL = ['04571','04572','04573','04574','04576']
TEMPE = ['04540','04541']

arr = [
 single('PT','Transmisor de presion','04551'),
 single('PI','Indicador de presion (manometro)','04552'),
 generic('PC','Controlador de presion'),
 single('PIC','Controlador indicador de presion','04551'),
 single('PIT','Transmisor indicador de presion','04551'),
 single('PSH','Switch de presion (alta)','04553'),
 single('PSL','Switch de presion (baja)','04553'),
 valve('PV','Valvula de control de presion'),
 multi('FT','Transmisor de flujo',FLOW),
 multi('FE','Elemento de flujo',FLOW),
 multi('FI','Indicador de flujo',FLOW),
 multi('FIC','Controlador indicador de flujo',FLOW),
 generic('FC','Controlador de flujo'),
 valve('FV','Valvula de control de flujo'),
 multi('LT','Transmisor de nivel',LEVEL),
 multi('LI','Indicador de nivel',LEVEL),
 generic('LIC','Controlador indicador de nivel'),
 generic('LC','Controlador de nivel'),
 valve('LV','Valvula de control de nivel'),
 generic('LG','Visor de nivel (level gauge)'),
 multi('TE','Elemento de temperatura',TEMPE),
 single('TT','Transmisor de temperatura','04544'),
 single('TIT','Transmisor indicador de temperatura','04544'),
 single('TI','Indicador de temperatura (termometro)','04542'),
 single('TIC','Controlador indicador de temperatura','04545'),
 single('TC','Controlador de temperatura','04545'),
 single('AT','Analizador/transmisor de gas','04632'),
 single('AI','Indicador de analisis de gas','04632'),
 combined('SOV','Valvula solenoide on-off'),
 combined('VSP','Valvula solenoide/posicion on-off'),
 single('OFD','Detector de incendio y llama','04635'),
 single('WT','Transmisor de peso (celda de carga)','04533'),
 # WT de torque: el TAG comparte prefijo WT; la app enruta aquí por el nombre ("torque").
 # El técnico elige la centrifuga (3 procedimientos) en el desplegable.
 multi('WT-TORQUE','Transmisor de torque (centrifuga)',['04618','04619','04620']),
 generic('SV','Valvula solenoide'),
 generic('HV','Valvula manual (hand valve)'),
 generic('HAD','HAD'),
 generic('VTRC','VTRC'),
 generic('EX','EX (tag)'),
]

js = 'var DEFAULT_MAP_ARR = ' + json.dumps(arr, ensure_ascii=False, indent=1) + ';'
open(os.path.join(SP, 'default_map.js'), 'w', encoding='utf-8').write(js)

# Insertar el mapeo generado dentro de part_tail.html (reemplaza el bloque DEFAULT_MAP_ARR)
tail_path = os.path.join(SP, 'part_tail.html')
t = open(tail_path, encoding='utf-8').read()
a = t.index('var DEFAULT_MAP_ARR')
b = t.index('function defaultMapObj')
t = t[:a] + js + '\n' + t[b:]
open(tail_path, 'w', encoding='utf-8').write(t)

print('prefijos:', len(arr))
print('con opciones:', sum(1 for e in arr if 'opciones' in e))
print('valvulas:', sum(1 for e in arr if e.get('tipo') == 'valvula'))
print('part_tail.html actualizado. Ahora ejecuta build.ps1 (o build.sh) para regenerar index.html.')
