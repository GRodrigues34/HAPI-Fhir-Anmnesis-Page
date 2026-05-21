import subprocess
import re
import sys
import json
import os
import threading
import argparse
from contextlib import asynccontextmanager
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel

# ── Modelos Pydantic ──────────────────────────────────────────────────────────

class MetricReading(BaseModel):
    value: int
    timestamp: str

class DeviceInfo(BaseModel):
    manufacturer: str = "Xiaomi"
    model: str = "Redmi Watch 5 Active"

class FitnessDataResponse(BaseModel):
    latest: dict  # chaves 'hr' e 'spo2', valores Optional[MetricReading]
    device_info: DeviceInfo

# ── Armazenamento thread-safe ─────────────────────────────────────────────────

latest_data: dict = {"hr": None, "spo2": None}
data_lock = threading.Lock()

# ── Variável global para modo mock ────────────────────────────────────────────

mock_mode: bool = False

# ── Função de persistência (preservada do original) ───────────────────────────

def save_to_json(data, filename="fitness_data.json"):
    """Salva dados em JSON com histórico"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {"records": []}
    
    existing["records"].append(data)
    existing["last_update"] = datetime.now().isoformat()
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

# ── Leitura de dados do relógio via ADB ───────────────────────────────────────

def stream_watch_data():
    """Captura dados do smartwatch via ADB logcat e atualiza latest_data."""
    subprocess.run(["adb", "logcat", "-c"])
    cmd = ["adb", "logcat", "-v", "brief"]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, bufsize=1)
        print("Iniciando Monitoramento\n")
        
        for line in iter(process.stdout.readline, ''):
            data_point = {"timestamp": datetime.now().isoformat()}
            
            #SpO2
            if "spo2=" in line:
                match_spo2 = re.search(r'spo2=(\d{2,3})', line)
                if match_spo2:
                    data_point["value"] = int(match_spo2.group(1))
                    data_point["type"] = "spo2"
                    print(f"Oxigenio Sangue: {match_spo2.group(1)}%")
                    # Atualiza dados mais recentes (thread-safe)
                    with data_lock:
                        latest_data["spo2"] = {
                            "value": data_point["value"],
                            "timestamp": data_point["timestamp"],
                        }
            
            # Batimentos Cardiacos
            if "hr=" in line and "HrItem" in line:
                match_hr = re.search(r'hr=(\d+)', line)
                if match_hr:
                    data_point["value"] = int(match_hr.group(1))
                    data_point["type"] = "hr"
                    print(f"Batimentos: {match_hr.group(1)}")
                    # Atualiza dados mais recentes (thread-safe)
                    with data_lock:
                        latest_data["hr"] = {
                            "value": data_point["value"],
                            "timestamp": data_point["timestamp"],
                        }
            
            # JSON
            if len(data_point) > 1: 
                save_to_json(data_point)
                print(f"Dados salvos em fitness_data.json\n")
            
            sys.stdout.flush()
            
    except KeyboardInterrupt:
        print("\nApi terminated")
        process.terminate()

# ── Carregamento de dados mock ────────────────────────────────────────────────

def load_mock_data():
    """Carrega dados do arquivo fitness_data_mock.json e atualiza latest_data."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    mock_file = os.path.join(script_dir, "fitness_data_mock.json")

    with open(mock_file, "r", encoding="utf-8") as f:
        mock = json.load(f)

    records = mock.get("records", [])

    # Encontra o registro mais recente de cada tipo
    latest_hr = None
    latest_spo2 = None

    for record in records:
        rec_type = record.get("type")
        if rec_type == "hr":
            if latest_hr is None or record["timestamp"] > latest_hr["timestamp"]:
                latest_hr = record
        elif rec_type == "spo2":
            if latest_spo2 is None or record["timestamp"] > latest_spo2["timestamp"]:
                latest_spo2 = record

    with data_lock:
        if latest_hr:
            latest_data["hr"] = {
                "value": latest_hr["value"],
                "timestamp": latest_hr["timestamp"],
            }
        if latest_spo2:
            latest_data["spo2"] = {
                "value": latest_spo2["value"],
                "timestamp": latest_spo2["timestamp"],
            }

    print(f"Dados mock carregados: HR={latest_hr}, SpO2={latest_spo2}")

# ── Lifespan do FastAPI ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação."""
    if mock_mode:
        load_mock_data()
        print("Modo mock ativo — usando dados de fitness_data_mock.json")
    else:
        # Inicia captura ADB em thread daemon
        thread = threading.Thread(target=stream_watch_data, daemon=True)
        thread.start()
        print("Thread de monitoramento ADB iniciada")
    yield

# ── Aplicação FastAPI ─────────────────────────────────────────────────────────

app = FastAPI(
    title="Smartwatch Fitness Data API",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware CORS (libera tudo para desenvolvimento)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/fitness-data", response_model=FitnessDataResponse)
async def get_fitness_data():
    """Retorna os dados mais recentes de frequência cardíaca e SpO2."""
    with data_lock:
        hr_raw = latest_data["hr"]
        spo2_raw = latest_data["spo2"]

    hr_reading = MetricReading(**hr_raw) if hr_raw else None
    spo2_reading = MetricReading(**spo2_raw) if spo2_raw else None

    return FitnessDataResponse(
        latest={"hr": hr_reading, "spo2": spo2_reading},
        device_info=DeviceInfo(),
    )

@app.get("/health")
async def health_check():
    """Verificação simples de saúde da API."""
    return {"status": "ok", "mock_mode": mock_mode}

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Smartwatch Fitness Data API")
    parser.add_argument("--mock", action="store_true", help="Usar dados mock em vez de ADB")
    parser.add_argument("--port", type=int, default=8000, help="Porta do servidor (padrão: 8000)")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    mock_mode = args.mock
    uvicorn.run(app, host="0.0.0.0", port=args.port)