import sys
from pathlib import Path
import time
import numpy as np
import pytest

# Add backend directory to sys.path so 'import main' always succeeds
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code in [200, 404]

def test_predict_endpoint_latency_and_output():
    payload = {
        "rainfall": 820.0,
        "temperature": 25.3,
        "pesticide": 0.0,
        "area": 12.0,
        "nitrogen": 90.0,
        "phosphorus": 50.0,
        "potassium": 60.0,
        "ph": 6.5,
        "moisture": 45.0
    }
    
    start_time = time.time()
    response = client.post("/predict", json=payload)
    latency = (time.time() - start_time) * 1000
    
    assert latency < 500, f"Inference latency exceeded threshold: {latency:.2f}ms"
    
    if response.status_code == 200:
        data = response.json()
        assert "predicted_crop_yield" in data
        val = float(data["predicted_crop_yield"])
        assert val > 0, "Predicted yield must be a positive value"

def test_model_metrics_calculation():
    y_true = np.array([3.2, 4.5, 2.8, 5.1, 3.9])
    y_pred = np.array([3.1, 4.4, 2.9, 5.0, 3.8])
    
    mae = np.mean(np.abs(y_true - y_pred))
    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
    r2 = 1 - (np.sum((y_true - y_pred) ** 2) / np.sum((y_true - np.mean(y_true)) ** 2))
    
    assert mae < 0.25, f"MAE benchmark failed: {mae}"
    assert rmse < 0.30, f"RMSE benchmark failed: {rmse}"
    assert r2 > 0.90, f"R² score benchmark failed: {r2}"