# Weekend Home Agent (WHA) v2.0 - Enhanced Edition

An intelligent home automation system that uses biometric data, location tracking, and AI-powered task planning to create personalized daily agendas and automate your living space.

## 🚀 Features

### Core Intelligence
- **Biometric Integration**: Real-time monitoring of heart rate, HRV, sleep quality, and readiness scores
- **Adaptive Task Planning**: LLM-powered agenda generation that considers your energy levels, context, and priorities
- **Smart Location Tracking (RTLS)**: Room-level presence detection with adaptive polling based on user state
- **Contextual Awareness**: Weather, calendar, occupancy, and environmental factors influence task recommendations

### Enhanced Security & Privacy
- ✅ **Encrypted Biometric Storage**: All sensitive health data encrypted at rest with Fernet
- ✅ **API Key Rotation**: Automatic tracking and alerts for API key expiration
- ✅ **Comprehensive Audit Logging**: Every data access and automation tracked
- ✅ **User Consent Management**: Granular privacy controls and data retention policies
- ✅ **TLS/SSL Support**: Secure MQTT communication

### Reliability Features
- ✅ **Graceful Degradation**: Falls back to rule-based systems when LLM fails
- ✅ **Offline Mode**: Local processing capabilities with Redis caching
- ✅ **Task Persistence**: PostgreSQL database ensures no data loss
- ✅ **Health Checks**: Automated monitoring and recovery

### Intelligence Improvements
- ✅ **Recursive Task Decomposition**: Automatically breaks down 90+ minute tasks
- ✅ **Energy Budget Management**: Tracks and allocates daily energy based on readiness
- ✅ **Context-Aware Filtering**: Only suggests tasks that match current conditions
- ✅ **Multi-Factor Task Scoring**: Considers priority, deadline, energy, and category

### User Experience
- ✅ **Explainability**: Dashboard shows why tasks were prioritized
- ✅ **Real-time Updates**: Live biometric and location data via WebSocket
- ✅ **Visual Metrics**: Beautiful Grafana dashboards for system monitoring
- ✅ **Manual Override**: Easy task regeneration and completion controls

## 📋 Prerequisites

- Docker & Docker Compose
- Python 3.11+
- OpenSSL
- 4GB RAM minimum
- Linux/macOS (Windows with WSL2)

## 🔧 Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/wha-enhanced.git
cd wha-enhanced
chmod +x setup.sh
./setup.sh
```

### 2. Configure API Keys

Edit `.env` and add your API keys:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
WEATHER_API_KEY=your_openweather_api_key
CALENDAR_API_KEY=your_google_calendar_api_key
```

**Get API Keys:**
- Gemini: https://makersuite.google.com/app/apikey
- OpenWeather: https://openweathermap.org/api
- Google Calendar: https://console.cloud.google.com/

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# View logs
docker-compose logs -f wha-core

# Test MQTT connection
docker-compose exec mosquitto mosquitto_pub -t test -m "Hello WHA"
```

## 🎯 Usage

### Dashboard Access
- **Main Dashboard**: http://localhost:3000
- **Grafana Monitoring**: http://localhost:3001 (admin / see .env for password)
- **Home Assistant**: http://localhost:8123

### Publishing Biometric Data

```python
import paho.mqtt.client as mqtt
import json

client = mqtt.Client()
client.username_pw_set("wha", "your_mqtt_password")
client.connect("localhost", 1883)

biometric_data = {
    "heart_rate": 72,
    "hrv": 45.2,
    "sleep_score": 85,
    "readiness_score": 78,
    "temperature": 98.2,
    "dnd_enabled": False
}

client.publish("wha/biometrics", json.dumps(biometric_data))
```

### Publishing RTLS Data

```python
rssi_data = {
    "beacons": {
        "kitchen_beacon_1": -45,
        "living_room_beacon_1": -72,
        "office_beacon_1": -85
    }
}

client.publish("wha/sensors/rssi", json.dumps(rssi_data))
```

### Natural Language Commands

```python
command = {
    "command": "turn on the kitchen lights and set them to 80% brightness"
}

client.publish("wha/commands", json.dumps(command))
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  WHA Dashboard                   │
│              (React + WebSocket)                 │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│              MQTT Broker (Mosquitto)             │
│                  (Port 1883/8883)                │
└─────────────────────┬───────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
┌────────▼───┐  ┌─────▼────┐  ┌───▼──────┐
│  WHA Core  │  │  Redis   │  │PostgreSQL│
│  (Python)  │  │  Cache   │  │   DB     │
└────────────┘  └──────────┘  └──────────┘
     │
     ├── RTLS Engine (Adaptive Polling)
     ├── Context Manager (Weather, Calendar, Occupancy)
     ├── Task Planner (LLM + Rules)
     ├── Security Layer (Encryption, Audit)
     └── Home Assistant Bridge
```

## 📊 Database Schema

### Key Tables
- **users**: User profiles and preferences
- **biometric_records**: Encrypted health data
- **tasks**: Task definitions with context requirements
- **task_dependencies**: Task relationship graph
- **location_history**: RTLS tracking data
- **automation_events**: Audit trail of all actions
- **agenda_history**: Historical task recommendations

## 🔐 Security Best Practices

1. **Change Default Passwords**: Immediately update all passwords in `.env`
2. **Enable TLS**: Uncomment TLS section in `config/mosquitto/mosquitto.conf`
3. **Secure .env File**: `chmod 600 .env` and add to `.gitignore`
4. **API Key Rotation**: Review API key rotation alerts every 30 days
5. **Audit Logs**: Regularly review `audit.log` for suspicious activity
6. **Network Isolation**: Run in isolated Docker network, expose only necessary ports
7. **Backup Encryption Keys**: Store `WHA_ENCRYPTION_KEY` in secure vault
8. **Database Backups**: Automated backups with encryption

## 🎛️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WHA_ENCRYPTION_KEY` | Fernet encryption key | Yes | Generated |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `WEATHER_API_KEY` | OpenWeatherMap API key | Yes | - |
| `CALENDAR_API_KEY` | Google Calendar API key | Optional | - |
| `MQTT_USER` | MQTT broker username | Yes | wha |
| `MQTT_PASSWORD` | MQTT broker password | Yes | Generated |
| `ENABLE_VOICE_FEEDBACK` | Enable voice responses | No | true |
| `MAX_TASKS_PER_DAY` | Maximum tasks in agenda | No | 10 |
| `POLLING_INTERVAL_ACTIVE` | RTLS poll rate (active) | No | 1.0s |
| `POLLING_INTERVAL_SLEEPING` | RTLS poll rate (sleeping) | No | 60.0s |

### Task Categories

The system recognizes the following task categories:
- **health**: Exercise, meditation, meal planning
- **finance**: Bill payments, budget reviews, tax preparation
- **work**: Project tasks, emails, meetings prep
- **maintenance**: Cleaning, repairs, organization
- **social**: Calls, events, relationship maintenance

### Context Requirements

Tasks can specify context requirements:

```python
context_requirements = {
    "occupancy": "alone",      # Require privacy
    "weather": "good",          # Outdoor suitability
    "time_of_day": "morning",   # Time preference
    "energy_level": "high"      # Energy requirement
}
```

## 📈 Monitoring

### Grafana Dashboards

Pre-configured dashboards available at http://localhost:3001:

1. **System Health**: CPU, memory, MQTT messages/sec
2. **Task Analytics**: Completion rates, category distribution
3. **Biometric Trends**: Readiness scores over time
4. **Location Heatmap**: Time spent in each room
5. **Energy Budget**: Daily energy allocation vs. usage

### Prometheus Metrics

Exposed metrics at `http://wha-core:8080/metrics`:

- `wha_tasks_generated_total`: Total tasks generated
- `wha_tasks_completed_total`: Total tasks completed
- `wha_agenda_generation_duration_seconds`: Time to generate agenda
- `wha_rtls_location_changes_total`: Location updates
- `wha_biometric_readiness_score`: Current readiness score
- `wha_llm_api_calls_total`: LLM API usage
- `wha_mqtt_messages_received_total`: MQTT message count

### Log Files

- `wha.log`: Application logs
- `audit.log`: Security audit trail
- `logs/mosquitto/mosquitto.log`: MQTT broker logs

## 🧪 Testing

### Run Unit Tests

```bash
source venv/bin/activate
pytest tests/ -v --cov=wha_core
```

### Integration Tests

```bash
pytest tests/integration/ -v
```

### Manual Testing

```bash
# Test MQTT connection
mosquitto_sub -h localhost -p 1883 -u wha -P your_password -t "wha/#" -v

# Publish test biometric data
mosquitto_pub -h localhost -p 1883 -u wha -P your_password \
  -t "wha/biometrics" \
  -m '{"heart_rate": 70, "readiness_score": 85, "sleep_score": 80, "hrv": 50, "temperature": 98.6}'

# Check logs
docker-compose logs -f wha-core
```

## 🔄 Backup & Restore

### Automated Backups

Backups run daily at 2 AM (configured in cron):

```bash
# Add to crontab
0 2 * * * /path/to/wha-enhanced/backup.sh
```

### Manual Backup

```bash
./backup.sh

# Backup creates:
# - backups/wha-backup-YYYYMMDD.tar.gz (PostgreSQL dump)
# - backups/redis-backup-YYYYMMDD.rdb (Redis snapshot)
```

### Restore from Backup

```bash
./restore.sh backups/wha-backup-20241022.tar.gz
```

## 🐛 Troubleshooting

### Common Issues

**Issue**: MQTT connection refused
```bash
# Check MQTT broker is running
docker-compose ps mosquitto

# Verify credentials
docker-compose exec mosquitto cat /mosquitto/config/passwd

# Test connection
mosquitto_pub -h localhost -p 1883 -u wha -P your_password -t test -m "test"
```

**Issue**: Tasks not being generated
```bash
# Check biometric data is being received
docker-compose logs wha-core | grep "biometrics"

# Verify Gemini API key
docker-compose exec wha-core env | grep GEMINI

# Check LLM API quotas
```

**Issue**: Location tracking not working
```bash
# Verify RSSI data format
mosquitto_sub -h localhost -t "wha/sensors/rssi" -v

# Check RTLS engine logs
docker-compose logs wha-core | grep "RTLS"
```

**Issue**: High CPU usage
```bash
# Check polling interval
docker-compose exec wha-core env | grep POLLING_INTERVAL

# Verify user state detection
docker-compose logs wha-core | grep "User state"
```

### Debug Mode

Enable debug logging:

```bash
# Edit .env
LOG_LEVEL=DEBUG

# Restart services
docker-compose restart wha-core
```

## 🚀 Deployment

### Production Deployment

1. **Use External PostgreSQL**: Replace container with managed database (AWS RDS, etc.)
2. **Enable TLS/SSL**: Configure proper certificates in `certs/`
3. **Setup Reverse Proxy**: Use Nginx/Traefik for HTTPS
4. **Enable Authentication**: Add OAuth2 to dashboard
5. **Configure Firewall**: Restrict access to internal network
6. **Setup Monitoring Alerts**: Configure Prometheus Alertmanager

### Cloud Deployment (Google Cloud Run)

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/wha-core

# Deploy
gcloud run deploy wha-core \
  --image gcr.io/PROJECT_ID/wha-core \
  --platform managed \
  --region us-east1 \
  --set-env-vars GEMINI_API_KEY=${GEMINI_API_KEY}
```

### Docker Swarm

```bash
docker stack deploy -c docker-compose.yml wha
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md)

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/wha-enhanced.git
cd wha-enhanced

# Create development environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Install pre-commit hooks
pre-commit install

# Run tests
pytest

# Code formatting
black .
flake8 .
```

## 📝 Roadmap

### Version 2.1 (Q1 2025)
- [ ] Voice assistant integration (wake word detection)
- [ ] Mobile app (React Native)
- [ ] Multi-user support with user switching
- [ ] Advanced circadian rhythm optimization
- [ ] Machine learning for task duration prediction

### Version 2.2 (Q2 2025)
- [ ] Integration with fitness trackers (Whoop, Oura, Apple Watch)
- [ ] Advanced air quality monitoring and recommendations
- [ ] Smart appliance control (coffee maker, thermostat)
- [ ] Meal planning with nutrition tracking
- [ ] Financial account aggregation

### Version 3.0 (Q3 2025)
- [ ] Federated learning for privacy-preserving personalization
- [ ] Predictive maintenance for home appliances
- [ ] Energy optimization and cost reduction
- [ ] Social coordination (family calendar sync)
- [ ] Advanced anomaly detection (health alerts)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- **Google Gemini**: AI-powered task planning
- **Home Assistant**: Home automation integration
- **Eclipse Mosquitto**: MQTT broker
- **PostgreSQL**: Reliable data persistence
- **Redis**: High-performance caching
- **Grafana**: Beautiful monitoring dashboards

## 📞 Support

- **Documentation**: https://docs.wha-project.com
- **Issues**: https://github.com/yourusername/wha-enhanced/issues
- **Discussions**: https://github.com/yourusername/wha-enhanced/discussions
- **Email**: support@wha-project.com

## ⚠️ Disclaimer

This system handles sensitive health data. Always:
- Comply with HIPAA/GDPR regulations in your jurisdiction
- Obtain proper consent before collecting biometric data
- Implement appropriate security measures
- Consult healthcare professionals for medical decisions
- Never rely solely on automated health recommendations

---

**Made with ❤️ by the WHA Community**