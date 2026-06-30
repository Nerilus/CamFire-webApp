import httpx
import logging

logger = logging.getLogger(__name__)

# Coordinates of our mock cameras in Carte.tsx
ZONES = [
    {"id": "cam-1", "lat": 48.8283, "lng": 2.4330}, # Bois de Vincennes
    {"id": "cam-2", "lat": 48.8624, "lng": 2.2492}, # Bois de Boulogne
    {"id": "cam-3", "lat": 48.4066, "lng": 2.6685}, # Fontainebleau
    {"id": "cam-4", "lat": 48.6644, "lng": 1.8156}, # Rambouillet
]

def calculate_risk_and_status(temp: float, wind: float, humidity: float):
    # Basic algorithm to simulate fire risk dynamically from weather
    risk = 0.0
    
    # Temperature impact: from 0 if <= 10C, up to 50 if >= 40C
    risk += max(0, min(50, (temp - 10) * 1.66))
    
    # Humidity impact: from 0 if >= 80%, up to 30 if <= 20%
    risk += max(0, min(30, (80 - humidity) * 0.5))
    
    # Wind impact: from 0 if <= 10km/h, up to 20 if >= 80km/h
    risk += max(0, min(20, (wind - 10) * 0.28))
    
    risk_percentage = int(min(100, max(1, risk)))
    
    # Status determination based on risk percentage
    if risk_percentage >= 80:
        status = 'fire'
    elif risk_percentage >= 50:
        status = 'warn'
    else:
        status = 'safe'
        
    return risk_percentage, status

async def get_zones_weather():
    # Pass all coordinates in a single request to the API
    lats = ",".join(str(z["lat"]) for z in ZONES)
    lngs = ",".join(str(z["lng"]) for z in ZONES)
    
    url = f"https://api.open-meteo.com/v1/meteofrance?latitude={lats}&longitude={lngs}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = []
            
            # The API returns a list if multiple coordinates are requested
            if isinstance(data, list):
                for idx, item in enumerate(data):
                    current = item.get("current", {})
                    temp = current.get("temperature_2m", 20.0)
                    humidity = current.get("relative_humidity_2m", 50.0)
                    wind = current.get("wind_speed_10m", 10.0)
                    wind_dir = current.get("wind_direction_10m", 0.0)
                    
                    risk, status = calculate_risk_and_status(temp, wind, humidity)
                    
                    results.append({
                        "id": ZONES[idx]["id"],
                        "temperature": temp,
                        "humidity": humidity,
                        "wind_speed": wind,
                        "wind_direction": wind_dir,
                        "risk_percentage": risk,
                        "status": status
                    })
            else:
                # Fallback if only 1 coordinate requested or unexpected format
                current = data.get("current", {})
                temp = current.get("temperature_2m", 20.0)
                humidity = current.get("relative_humidity_2m", 50.0)
                wind = current.get("wind_speed_10m", 10.0)
                wind_dir = current.get("wind_direction_10m", 0.0)
                risk, status = calculate_risk_and_status(temp, wind, humidity)
                
                results.append({
                    "id": ZONES[0]["id"],
                    "temperature": temp,
                    "humidity": humidity,
                    "wind_speed": wind,
                    "wind_direction": wind_dir,
                    "risk_percentage": risk,
                    "status": status
                })
                
            return results
    except Exception as e:
        logger.error(f"Error fetching weather data: {e}")
        # Fallback simulated data if API fails
        return [
            {"id": "cam-1", "temperature": 84.0, "humidity": 12.0, "wind_speed": 45.0, "wind_direction": 90.0, "risk_percentage": 94, "status": "fire"},
            {"id": "cam-2", "temperature": 41.0, "humidity": 25.0, "wind_speed": 30.0, "wind_direction": 180.0, "risk_percentage": 61, "status": "warn"},
            {"id": "cam-3", "temperature": 24.0, "humidity": 60.0, "wind_speed": 15.0, "wind_direction": 270.0, "risk_percentage": 4, "status": "safe"},
            {"id": "cam-4", "temperature": 18.0, "humidity": 70.0, "wind_speed": 10.0, "wind_direction": 0.0, "risk_percentage": 1, "status": "safe"},
        ]

async def get_forecast_weather():
    # Fetch 48h forecast for all coordinates
    lats = ",".join(str(z["lat"]) for z in ZONES)
    lngs = ",".join(str(z["lng"]) for z in ZONES)
    
    url = f"https://api.open-meteo.com/v1/meteofrance?latitude={lats}&longitude={lngs}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&forecast_days=2"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            zones_forecast = []
            
            # The API returns a list if multiple coordinates are requested
            # Make data iterable uniformly
            data_list = data if isinstance(data, list) else [data]
            
            for idx, item in enumerate(data_list):
                hourly = item.get("hourly", {})
                times = hourly.get("time", [])
                temps = hourly.get("temperature_2m", [])
                humidities = hourly.get("relative_humidity_2m", [])
                winds = hourly.get("wind_speed_10m", [])
                
                forecast_points = []
                for i in range(len(times)):
                    temp = temps[i] if i < len(temps) else 20.0
                    humidity = humidities[i] if i < len(humidities) else 50.0
                    wind = winds[i] if i < len(winds) else 10.0
                    
                    risk, status = calculate_risk_and_status(temp, wind, humidity)
                    
                    forecast_points.append({
                        "time": times[i],
                        "temperature": temp,
                        "humidity": humidity,
                        "wind_speed": wind,
                        "risk_percentage": risk,
                        "status": status
                    })
                
                zones_forecast.append({
                    "id": ZONES[idx]["id"] if idx < len(ZONES) else "cam-unknown",
                    "forecast": forecast_points
                })
                
            return zones_forecast
    except Exception as e:
        logger.error(f"Error fetching forecast data: {e}")
        return []
