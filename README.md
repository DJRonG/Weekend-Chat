Weekend Home Agent (WHA)

A next-generation, context-aware smart home microservice designed to proactively manage your home environment, media handoffs, and weekend agenda based on physical presence, biometric data, emotional context, and work stress.


---

🚀 Features

1. Real-Time Location System (RTLS) & Handoff

Proximity Tracking: BLE RSSI data from watch and phone to determine room location.

Seamless Handoff: Transfers media streams to current room devices via MQTT.

Contextual Lighting: Adjusts brightness and color temperature based on time and ambient light.

Location-Based Suggestions: Recommends nearby food and shopping using Gemini API and Google Search grounding.


2. Contextual Task Generation (Intelligence Core)

Conversation Harvest: Extracts commitments, needs, and emotional state from weekly messages.

Stress & Capacity Filtering: Prioritizes tasks based on sleep, readiness, and work load.

Proactive Planning: Integrates sensor data and social commitments into a consolidated to-do list.


3. International Awareness

Workday Closure Alerts: Monitors European workdays to manage final communications.

Targeted Alerts: Notifies the dashboard when workdays end in monitored zones.



---

🏗️ Architecture & Deployment Stack

Component	Technology	Role	Deployment

Agent Intelligence Core	Python (Gemini API)	Task, Mood, Biometric, and Work Stress logic	Google Cloud Run
RTLS Decision Engine	Python (Paho-MQTT)	Processes RSSI and publishes handoff commands	Always-on service
Data Backbone	Mosquitto MQTT Broker	Central hub for all real-time data	Docker Container
Frontend/Dashboard	React (Tailwind CSS)	Displays location, tasks, alerts	Vercel / GitHub Pages
Home Automation	Home Assistant	Subscribes to MQTT commands for device control	Existing HA Instance



---

📂 Project Structure & Key Files

Filepath	Component	Description

deployment_guide.md	Documentation	Step-by-step installation, testing, deployment
docker-compose.yml	MQTT Broker Setup	Spins up Mosquitto broker
mqtt_rtls_publisher.py	Decision Engine	Determines location, publishes handoff command, fetches suggestions
agent_service_tasks.py	Intelligence Core	Contextual, mood-based task list logic
AgentDashboard.jsx	Frontend	Real-time dashboard display
home_assistant_scripts.yaml	HA Lighting Logic	Dynamic light adjustments
home_assistant_automation.yaml	HA Master Automation	Subscribes to MQTT command topic and executes actions



---

⚙️ Getting Started

1. Clone the repo:



git clone https://github.com/yourusername/wha.git
cd wha

2. Start MQTT Broker:



docker-compose up -d

3. Run RTLS Engine:



python mqtt_rtls_publisher.py

4. Start Intelligence Core:



python agent_service_tasks.py

5. Launch Dashboard:



npm install && npm start

6. Home Assistant Setup:



Load home_assistant_scripts.yaml and home_assistant_automation.yaml

Verify MQTT topic subscription and device triggers



---

📈 Roadmap

Stage 1 (MVP): Core automation, RTLS handoff, basic dashboard

Stage 2 (Smart Context): Predictive routines, emotional awareness, capacity index

Stage 3 (Adaptive Intelligence): Local LLM cache, context narration, privacy compliance, voice UX



---

📖 References

Rey-Jouanchicot et al., 2024: LLMs for personalized smart homes

Cheng et al., 2024: AutoIoT automated IoT platform

Heierman & Cook, 2003: Pattern discovery in smart homes

MDPI, 2014: Multi-agent sensor-actuator networks

FakhrHosseini et al., 2024: Taxonomy of smart home systems