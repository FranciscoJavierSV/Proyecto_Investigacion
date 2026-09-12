# Manual de comandos

Formato final:
Comando
  ./run.sh all
Qué hace
  Levanta el proyecto completo en Docker.

Nota: reemplaza <ruta_del_proyecto> por la ruta real donde tengas descargado el proyecto.

----

1) Preparar el entorno
Comando
  cd <ruta_del_proyecto>
Qué hace
  Entra a la carpeta del proyecto.

Comando
  ./run.sh setup
Qué hace
  Crea el archivo .env si no existe.

----

2) Arranque desde cero
Comando
  ./run.sh clean
Qué hace
  Elimina contenedores y volúmenes del proyecto.

Comando
  ./run.sh all
Qué hace
  Levanta todos los servicios del proyecto.

----

3) Verificación rápida
Comando
  ./run.sh test
Qué hace
  Comprueba que los servicios principales respondan correctamente.

Comando
  docker ps
Qué hace
  Muestra los contenedores activos y su estado.

Comando
  curl -sS 'http://localhost:4001/rest/?size=1'
Qué hace
  Hace una consulta simple a la API REST para verificar que devuelve datos.

----

4) Prueba de inserciones con pocos registros
Comando
  bash scripts/benchmark.sh 5
Qué hace
  Ejecuta 5 inserciones REST y 5 inserciones GraphQL para comparar tiempos con poco volumen.

----

4b) Consulta parametrizada (REST o GraphQL)
Comando
  ./run.sh query [rest|graphql] [opciones]
Que hace
  Ejecuta una sola consulta contra la arquitectura indicada e imprime latencia, payload y conteo de registros.

Opciones:
  rest | graphql          Arquitectura destino (default: rest)
  -s, --size              Cantidad de registros a devolver (default: 10)
  -o, --offset            Desplazamiento para paginacion (default: 0)
  -e, --endpoint          [REST] Coleccion a consultar: all, clientes, productos, facturas, datosfacturas, variaciones (default: all)
  -f, --fields            [GraphQL] Proyeccion de campos: full, minimal, clientes, productos, facturas, datosfacturas, variaciones (default: full)
  --raw                   Imprime el JSON completo en lugar del resumen
  -p, --port              Puerto de research-api (default: 4001)

----

4c) Benchmark de consultas REST vs GraphQL
Comando
  ./run.sh benchmark-queries [opciones]
Que hace
  Ejecuta N consultas por arquitectura y muestra estadisticas comparativas: promedio, mediana, p90, p95, p99 y throughput.

Opciones:
  -n, --requests          Consultas por arquitectura (default: 20)
  -s, --size              Registros por consulta (default: 50)
  -o, --offset            Offset de inicio (default: 0)
  -c, --concurrency       Peticiones concurrentes por ronda (default: 1, secuencial)
  -e, --endpoint          [REST] Coleccion a consultar (default: all)
  -f, --fields            [GraphQL] Proyeccion de campos (default: full)
  -m, --mode              Orden de ejecucion: alternate (intercalado REST/GQL) o batch (todos REST luego todos GQL) (default: alternate)
  -p, --port              Puerto de research-api (default: 4001)

----

4d) Curva de escalabilidad por tamano de lote
Comando
  ./run.sh scalability [opciones]
Que hace
  Prueba REST y GraphQL incrementando el tamano del lote en cada paso y genera un reporte JSON en data/ con las latencias obtenidas.

Opciones:
  --steps                 Lista de tamanos de lote separada por comas (default: 10,50,100,500,1000,2500,5000,10000)
  -n, --samples           Muestras por cada paso (default: 5)
  -e, --endpoint          Coleccion a usar en REST: clientes, productos, facturas, all (default: clientes)
  -p, --port              Puerto de research-api (default: 4001)
  -o, --output            Directorio de salida del reporte (default: ./data)

----

4e) Comparativa de over-fetching vs under-fetching
Comando
  ./run.sh overfetching [opciones]
Que hace
  Compara REST (devuelve todos los campos) contra GraphQL full y GraphQL minimal, midiendo latencia y payload para cuantificar el exceso de datos que envia REST.

Opciones:
  -s, --size              Registros por consulta (default: 100)
  -n, --samples           Muestras por variante para promediar (default: 10)
  -e, --endpoint          Entidad a comparar: clientes o productos (default: clientes)
  -p, --port              Puerto de research-api (default: 4001)
  -o, --output            Directorio de salida del reporte (default: ./data)

----

5) Generar evidencia
Comando
  ./run.sh aggregate
Qué hace
  Genera el resumen final del proyecto en services/research-api/logs/metrics_summary.json.

Comando
  less services/research-api/logs/metrics_summary.json
Qué hace
  Abre el archivo de evidencia generado.

----

6) Detener servicios
Comando
  ./run.sh down
Qué hace
  Detiene los contenedores sin borrar volúmenes.

Comando
  ./run.sh clean
Qué hace
  Detiene y borra los volúmenes del proyecto.

----

7) Secuencia recomendada para presentar
Comando
  ./run.sh clean
  ./run.sh all
  ./run.sh test
  bash scripts/benchmark.sh 5
  ./run.sh query rest -s 50
  ./run.sh benchmark-queries -n 200 -c 10 -m batch
  ./run.sh scalability
  ./run.sh overfetching
  ./run.sh aggregate
Qué hace
  Deja el proyecto limpio, lo levanta, valida que funcione, hace prueba de insercion, ejecuta los cuatro casos de prueba de consultas y genera la evidencia final.

----

8) Importante
Comando
  SEED_N=20 ./run.sh seed
Qué hace
  Carga datos de prueba, pero no se recomienda para la presentación porque la etapa de variaciones puede crecer mucho.

----

Fin del manual.