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
  ./run.sh aggregate
Qué hace
  Deja el proyecto limpio, lo levanta, valida que funcione, hace una prueba pequeña y genera la evidencia final.

----

8) Importante
Comando
  SEED_N=20 ./run.sh seed
Qué hace
  Carga datos de prueba, pero no se recomienda para la presentación porque la etapa de variaciones puede crecer mucho.

----

Fin del manual.
