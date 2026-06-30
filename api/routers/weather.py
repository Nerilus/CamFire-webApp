from fastapi import APIRouter
from schemas.weather_schema import WeatherZonesResponse, WeatherForecastResponse
from services.weather_service import get_zones_weather, get_forecast_weather

router = APIRouter(
    prefix="/weather",
    tags=["Weather"]
)

@router.get("/zones", response_model=WeatherZonesResponse)
async def fetch_weather_zones():
    """
    Fetch real-time weather data for all defined camera zones.
    Returns temperature, humidity, wind speed, and dynamically calculated fire risk.
    """
    zones_data = await get_zones_weather()
    return {"zones": zones_data}

@router.get("/forecast", response_model=WeatherForecastResponse)
async def fetch_weather_forecast():
    """
    Fetch 48h hourly forecast for all defined camera zones.
    Returns hourly data for temperature, humidity, wind, and calculated risk.
    """
    forecast_data = await get_forecast_weather()
    return {"zones_forecast": forecast_data}
