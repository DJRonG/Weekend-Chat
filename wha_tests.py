"""
Unit tests for WHA Core functionality
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from wha_core import (
    BiometricData, Task, TaskPriority, UserState,
    SecureConfig, AuditLogger, ContextManager,
    EnhancedRTLSEngine, IntelligentTaskPlanner
)


@pytest.fixture
def sample_biometrics():
    return BiometricData(
        heart_rate=70,
        hrv=45.0,
        sleep_score=80,
        readiness_score=75,
        temperature=98.6,
        timestamp=datetime.now()
    )


@pytest.fixture
def sample_task():
    return Task(
        id="test_task_1",
        name="Test Task",
        description="A test task",
        priority=TaskPriority.HIGH,
        estimated_minutes=60,
        energy_required=7,
        category="work",
        dependencies=[],
        deadline=datetime.now() + timedelta(days=2),
        subtasks=[],
        context_requirements={}
    )


@pytest.fixture
def mock_config():
    with patch.dict(os.environ, {
        'WHA_ENCRYPTION_KEY': 'test_key_1234567890123456789012345678',
        'GEMINI_API_KEY': 'test_gemini_key',
        'WEATHER_API_KEY': 'test_weather_key'
    }):
        yield SecureConfig()


class TestBiometricData:
    def test_biometric_creation(self, sample_biometrics):
        assert sample_biometrics.heart_rate == 70
        assert sample_biometrics.readiness_score == 75
        assert isinstance(sample_biometrics.timestamp, datetime)
    
    def test_biometric_encryption(self, sample_biometrics, mock_config):
        encrypted = sample_biometrics.encrypt(mock_config.cipher)
        assert isinstance(encrypted, str)
        assert encrypted != str(sample_biometrics)
        
        decrypted = BiometricData.decrypt(encrypted, mock_config.cipher)
        assert decrypted.heart_rate == sample_biometrics.heart_rate
        assert decrypted.readiness_score == sample_biometrics.readiness_score


class TestTask:
    def test_task_creation(self, sample_task):
        assert sample_task.name == "Test Task"
        assert sample_task.priority == TaskPriority.HIGH
        assert sample_task.estimated_minutes == 60
    
    def test_task_to_dict(self, sample_task):
        task_dict = sample_task.to_dict()
        assert task_dict['name'] == "Test Task"
        assert task_dict['priority'] == 2
        assert task_dict['category'] == "work"
        assert isinstance(task_dict['deadline'], str)


class TestSecureConfig:
    def test_config_initialization(self, mock_config):
        assert mock_config.api_keys['gemini'] == 'test_gemini_key'
        assert mock_config.api_keys['weather'] == 'test_weather_key'
    
    def test_should_rotate_keys(self, mock_config):
        # New config should not need rotation
        assert not mock_config.should_rotate_keys()
        
        # Simulate 31 days old
        mock_config.last_rotation = datetime.now() - timedelta(days=31)
        assert mock_config.should_rotate_keys()
    
    def test_get_api_key(self, mock_config):
        key = mock_config.get_api_key('gemini')
        assert key == 'test_gemini_key'


class TestAuditLogger:
    def test_log_data_access(self, tmp_path):
        log_file = tmp_path / "test_audit.log"
        logger = AuditLogger(str(log_file))
        
        logger.log_data_access('biometrics', 'read', 'task_generation')
        
        assert log_file.exists()
        content = log_file.read_text()
        assert 'biometrics' in content
        assert 'read' in content
    
    def test_log_automation(self, tmp_path):
        log_file = tmp_path / "test_audit.log"
        logger = AuditLogger(str(log_file))
        
        logger.log_automation('kitchen_lights', 'turn_on', 'rtls_detection')
        
        content = log_file.read_text()
        assert 'kitchen_lights' in content
        assert 'turn_on' in content


class TestContextManager:
    @patch('requests.get')
    def test_get_weather(self, mock_get, mock_config):
        mock_response = Mock()
        mock_response.json.return_value = {
            'main': {'temp': 72},
            'weather': [{'main': 'Clear'}]
        }
        mock_get.return_value = mock_response
        
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        weather = context_mgr.get_weather()
        
        assert weather['temperature'] == 72
        assert weather['condition'] == 'Clear'
    
    @patch('requests.get')
    def test_weather_caching(self, mock_get, mock_config):
        mock_response = Mock()
        mock_response.json.return_value = {
            'main': {'temp': 72},
            'weather': [{'main': 'Clear'}]
        }
        mock_get.return_value = mock_response
        
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        
        # First call
        weather1 = context_mgr.get_weather()
        # Second call should use cache
        weather2 = context_mgr.get_weather()
        
        # API should only be called once
        assert mock_get.call_count == 1
        assert weather1 == weather2


class TestEnhancedRTLSEngine:
    def test_user_state_sleeping(self, sample_biometrics, mock_config):
        mqtt_client = Mock()
        rtls = EnhancedRTLSEngine(mqtt_client, mock_config)
        
        # Low heart rate should trigger sleeping state
        sample_biometrics.heart_rate = 45
        rtls.update_user_state(sample_biometrics, True)
        
        assert rtls.user_state == UserState.SLEEPING
        assert rtls.polling_interval == 60.0
    
    def test_user_state_focused(self, sample_biometrics, mock_config):
        mqtt_client = Mock()
        rtls = EnhancedRTLSEngine(mqtt_client, mock_config)
        
        # High heart rate should trigger focused state
        sample_biometrics.heart_rate = 110
        rtls.update_user_state(sample_biometrics, False)
        
        assert rtls.user_state == UserState.FOCUSED
        assert rtls.polling_interval == 5.0
    
    def test_process_rssi(self, mock_config):
        mqtt_client = Mock()
        rtls = EnhancedRTLSEngine(mqtt_client, mock_config)
        
        rssi_data = {
            'kitchen_beacon_1': -45,
            'living_room_beacon_1': -72,
            'office_beacon_1': -85
        }
        
        room = rtls.process_rssi(rssi_data)
        assert room == 'kitchen'  # Strongest signal
    
    def test_location_confidence(self, mock_config):
        mqtt_client = Mock()
        rtls = EnhancedRTLSEngine(mqtt_client, mock_config)
        
        # Add consistent location history
        for _ in range(3):
            rtls.process_rssi({'kitchen_beacon_1': -45})
        
        confidence = rtls.get_location_confidence()
        assert confidence == 0.9  # High confidence


class TestIntelligentTaskPlanner:
    def test_task_decomposition_short(self, sample_task, mock_config):
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        planner = IntelligentTaskPlanner(mock_config, context_mgr)
        
        # Short task should not be decomposed
        sample_task.estimated_minutes = 60
        result = planner.decompose_task(sample_task)
        
        assert len(result) == 1
        assert result[0].id == sample_task.id
    
    @patch('google.generativeai.GenerativeModel')
    def test_task_decomposition_long(self, mock_model, sample_task, mock_config):
        # Mock LLM response
        mock_response = Mock()
        mock_response.text = json.dumps([
            {
                'name': 'Subtask 1',
                'description': 'First part',
                'estimated_minutes': 45,
                'energy_required': 7
            },
            {
                'name': 'Subtask 2',
                'description': 'Second part',
                'estimated_minutes': 60,
                'energy_required': 8
            }
        ])
        mock_model.return_value.generate_content.return_value = mock_response
        
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        planner = IntelligentTaskPlanner(mock_config, context_mgr)
        
        # Long task should be decomposed
        sample_task.estimated_minutes = 120
        result = planner.decompose_task(sample_task)
        
        assert len(result) == 2
        assert result[0].name == 'Subtask 1'
        assert result[1].estimated_minutes == 60
    
    def test_calculate_energy_budget(self, sample_biometrics, mock_config):
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        planner = IntelligentTaskPlanner(mock_config, context_mgr)
        
        # Readiness 75 should give 75% of base budget (50)
        budget = planner._calculate_energy_budget(sample_biometrics)
        assert budget == 37  # int(50 * 0.75)
    
    def test_check_context_requirements(self, sample_task, mock_config):
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        planner = IntelligentTaskPlanner(mock_config, context_mgr)
        
        occupancy = {'user_alone': True}
        weather = {'suitable_for_outdoor': True}
        
        # Task with no requirements should pass
        assert planner._check_context_requirements(sample_task, occupancy, weather)
        
        # Task requiring alone time should pass
        sample_task.context_requirements = {'occupancy': 'alone'}
        assert planner._check_context_requirements(sample_task, occupancy, weather)
        
        # Task requiring alone time should fail with others present
        occupancy['user_alone'] = False
        assert not planner._check_context_requirements(sample_task, occupancy, weather)


class TestIntegration:
    @patch('paho.mqtt.client.Client')
    def test_full_workflow(self, mock_mqtt, sample_biometrics, mock_config, tmp_path):
        """Test complete workflow from biometric input to task generation"""
        # Setup
        log_file = tmp_path / "test_audit.log"
        audit_logger = AuditLogger(str(log_file))
        context_mgr = ContextManager(mock_config.get_api_key('weather'))
        planner = IntelligentTaskPlanner(mock_config, context_mgr)
        
        # Generate agenda
        work_metrics = {}
        financial_status = {}
        occupancy = {'user_alone': True}
        weather = {'suitable_for_outdoor': True, 'temperature': 70}
        
        agenda = planner.generate_agenda(
            sample_biometrics,
            work_metrics,
            financial_status,
            datetime.now(),
            occupancy,
            weather
        )
        
        # Verify agenda was generated
        assert isinstance(agenda, list)
        assert len(agenda) > 0
        
        # Verify audit log was created
        assert log_file.exists()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
