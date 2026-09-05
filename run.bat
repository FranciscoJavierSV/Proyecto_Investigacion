@echo off
REM Windows helper for BaseDR_Docker (approximate parity with run.sh)
SETLOCAL ENABLEDELAYEDEXPANSION
if "%1"=="" goto HELP
set CMD=%1
shift
if "%CMD%"=="setup" (
  if exist .env (
    echo .env already exists
  ) else (
    copy .env.example .env
    echo .env created from .env.example. Edit it before use.
  )
  goto :EOF
)
if "%CMD%"=="check" (
  docker --version
  docker compose version
  goto :EOF
)
if "%CMD%"=="clean" (
  docker compose down -v
  goto :EOF
)
if "%CMD%"=="all" (
  set PROFILES=core,monitoring,comparison,research,tools
  echo Running: docker compose --profile %PROFILES% up --build -d
  docker compose --profile core --profile monitoring --profile comparison --profile research up --build -d
  goto :EOF
)
if "%CMD%"=="test" (
  curl -fsS http://localhost:9464/ >nul 2>nul || echo consumer not responding
  curl -fsS http://localhost:9464/metrics >nul 2>nul || echo consumer metrics not responding
  curl -fsS http://localhost:4000/health >nul 2>nul || echo api-comparison not responding
  curl -fsS http://localhost:4000/metrics >nul 2>nul || echo api-comparison metrics not responding
  curl -fsS http://localhost:4001/metrics >nul 2>nul || echo research-api metrics not responding
  goto :EOF
)
if "%CMD%"=="aggregate" (
  docker compose --profile tools run --rm tools node scripts/aggregate_metrics.js
  goto :EOF
)
if "%CMD%"=="benchmark" (
  call scripts\benchmark.sh %*
  goto :EOF
)
:HELP
echo Usage: run.bat ^<action^>
echo Actions: setup check clean all test aggregate benchmark
:EOF
