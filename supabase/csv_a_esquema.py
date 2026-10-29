"""Convierte el CSV de exportar_esquema.sql en supabase/esquema.sql.

Uso:  python supabase/csv_a_esquema.py "ruta/al/Supabase Snippet ....csv"
"""
import csv
import sys
from datetime import date
from pathlib import Path

SECCIONES = {
    '0': 'Extensiones', '1': 'Tipos y secuencias', '2': 'Tablas', '3': 'Restricciones',
    '4': 'Claves foráneas', '5': 'Índices', '6': 'Funciones', '7': 'Vistas', '8': 'Disparadores (triggers)',
    '9': 'Seguridad por filas (RLS)', '10': 'Políticas', '11': 'Permisos de las funciones',
    '12': 'Permisos de las tablas', '13': 'Permisos por columnas', '14': 'Almacén de fotos (buckets)',
    '15': 'Tareas programadas (pg_cron)',
}

CABECERA = f"""-- Estructura actual de la base de datos de Nails by Lynn (sin datos).
-- Generado el {date.today():%d/%m/%Y} con supabase/exportar_esquema.sql + supabase/csv_a_esquema.py.
--
-- Es la referencia de cómo está la base de datos AHORA. Las migraciones que la fueron construyendo
-- están en supabase/historial/ (ya aplicadas; no se vuelven a ejecutar).
-- NO ejecutar sobre la base de datos en uso. Sirve para consultar o para montar una copia nueva.
-- No incluye: datos, usuarios (Authentication), secretos de Vault ni las Edge Functions.
"""


def main(ruta_csv: str) -> None:
    with open(ruta_csv, encoding='utf-8-sig', newline='') as f:
        filas = list(csv.DictReader(f))

    partes = [CABECERA]
    seccion = None
    for fila in filas:
        if fila['orden'] != seccion:
            seccion = fila['orden']
            titulo = SECCIONES.get(seccion, f'Sección {seccion}')
            partes.append(f"\n-- {'=' * 69}\n-- {titulo}\n-- {'=' * 69}\n")
        partes.append(fila['sql'].strip() + '\n')

    destino = Path(__file__).with_name('esquema.sql')
    destino.write_text('\n'.join(partes), encoding='utf-8', newline='\n')
    print(f'{destino}: {len(filas)} sentencias')
    faltan = [SECCIONES[k] for k in ('11', '12', '14', '15') if k not in {f['orden'] for f in filas}]
    if faltan:
        print('Aviso: el CSV no trae ' + ', '.join(faltan) + ' (exportado con una versión anterior de la consulta)')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
