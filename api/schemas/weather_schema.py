from pydantic import BaseModel
from typing import List

class WeatherZoneData(BaseModel):
    id: str
    temperature: float
    wind_speed: float
    wind_direction: float
    humidity: float
    risk_percentage: int
    status: str

class WeatherZonesResponse(BaseModel):
    zones: List[WeatherZoneData]

class ForecastDataPoint(BaseModel):
    time: str
    temperature: float
    wind_speed: float
    humidity: float
    risk_percentage: int
    status: str

class ZoneForecast(BaseModel):
    id: str
    forecast: List[ForecastDataPoint]

class WeatherForecastResponse(BaseModel):
    zones_forecast: List[ZoneForecast]
