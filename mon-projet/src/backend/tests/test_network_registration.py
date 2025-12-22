"""Tests for network registration parsing and fallbacks."""
import pytest

from src.backend.modules.telco_modules import TelcoModules
from src.backend.modules.adb_executor import ExecutionResult


def _make_result(output: str, success: bool = True) -> ExecutionResult:
    return ExecutionResult(success=success, output=output, error="" if success else "error", duration=0.1)


def _reset_network_cache() -> None:
    TelcoModules._network_registration_cache.clear()
    TelcoModules._network_registration_cache_ts.clear()


def test_check_network_registration_parses_multi_sim_from_registry(monkeypatch):
    _reset_network_cache()
    telco = TelcoModules(device_id="device-registry")
    registry_output = (
        "mServiceState=0 mOperatorAlphaShort=Orange mOperatorNumeric=20801 mDataNetworkType=LTE\n"
        "Phone Id=0 mOperatorAlphaShort=Orange mOperatorNumeric=20801 mDataNetworkType=LTE mServiceState=0\n"
        "Phone Id=1 mOperatorAlphaShort=SFR mOperatorNumeric=20810 mDataNetworkType=NR mServiceState=0\n"
    )

    def fake_execute(cmd, timeout=30):
        cmd_str = " ".join(cmd)
        if "dumpsys telephony.registry" in cmd_str:
            return _make_result(registry_output, success=True)
        if "dumpsys telephony" in cmd_str:
            return _make_result("", success=False)
        if "getprop" in cmd_str:
            return _make_result("", success=True)
        return _make_result("", success=False)

    monkeypatch.setattr(telco, "execute_command", fake_execute)
    result = telco.check_network_registration()

    assert result["success"] is True
    info = result["registration_info"]
    assert info["operator"] == "Orange"
    assert info["operator_numeric"] == "20801"
    assert info["network_technology"] == "4G (LTE)"
    assert info["source"] == "dumpsys-registry"
    assert info["confidence"] == pytest.approx(0.9)
    assert len(info["sim_slots"]) == 2
    assert info["sim_slots"][0]["slot_index"] == 0
    assert info["sim_slots"][0]["operator"] == "Orange"
    assert info["sim_slots"][0]["network_technology"] == "4G (LTE)"
    assert info["sim_slots"][1]["slot_index"] == 1
    assert info["sim_slots"][1]["operator"] == "SFR"
    assert info["sim_slots"][1]["network_technology"] == "5G (NR)"


def test_check_network_registration_falls_back_to_telephony(monkeypatch):
    _reset_network_cache()
    telco = TelcoModules(device_id="device-telephony")
    telephony_output = "mOperatorAlphaLong=Orange mOperatorNumeric=20801 mDataNetworkType=HSPA"

    def fake_execute(cmd, timeout=30):
        cmd_str = " ".join(cmd)
        if "dumpsys telephony.registry" in cmd_str:
            return _make_result("", success=True)
        if "dumpsys telephony" in cmd_str:
            return _make_result(telephony_output, success=True)
        if "getprop" in cmd_str:
            return _make_result("", success=True)
        return _make_result("", success=False)

    monkeypatch.setattr(telco, "execute_command", fake_execute)
    result = telco.check_network_registration()

    assert result["success"] is True
    info = result["registration_info"]
    assert info["operator"] == "Orange"
    assert info["operator_numeric"] == "20801"
    assert info["network_technology"] == "3G (HSPA)"
    assert info["source"] == "dumpsys-telephony"
    assert info["confidence"] == pytest.approx(0.8)


def test_check_network_registration_getprop_multi_sim_numeric_mapping(monkeypatch):
    _reset_network_cache()
    telco = TelcoModules(device_id="device-getprop")
    prop_values = {
        "gsm.operator.alpha": "Orange,SFR",
        "gsm.operator.numeric": "20801,20810",
        "gsm.data.network.type": "13,20",
        "gsm.network.type": "",
        "gsm.voice.network.type": "",
    }

    def fake_execute(cmd, timeout=30):
        cmd_str = " ".join(cmd)
        if "dumpsys telephony.registry" in cmd_str:
            return _make_result("", success=False)
        if "dumpsys telephony" in cmd_str:
            return _make_result("", success=False)
        if "getprop" in cmd_str:
            key = cmd[-1]
            return _make_result(prop_values.get(key, ""), success=True)
        return _make_result("", success=False)

    monkeypatch.setattr(telco, "execute_command", fake_execute)
    result = telco.check_network_registration()

    assert result["success"] is True
    info = result["registration_info"]
    assert info["operator"] == "Orange"
    assert info["operator_numeric"] == "20801"
    assert info["network_technology"] == "4G (LTE)"
    assert info["source"] == "getprop"
    assert info["confidence"] == pytest.approx(0.6)
    assert len(info["sim_slots"]) == 2
    assert info["sim_slots"][0]["network_technology"] == "4G (LTE)"
    assert info["sim_slots"][1]["network_technology"] == "5G (NR)"


def test_check_network_registration_low_permission_uses_getprop(monkeypatch):
    _reset_network_cache()
    telco = TelcoModules(device_id="device-low-perm")
    prop_values = {
        "gsm.operator.alpha": "Orange",
        "gsm.operator.numeric": "20801",
        "gsm.data.network.type": "LTE",
    }

    def fake_execute(cmd, timeout=30):
        cmd_str = " ".join(cmd)
        if "dumpsys telephony.registry" in cmd_str:
            return _make_result("Permission Denial: not allowed to dump", success=False)
        if "dumpsys telephony" in cmd_str:
            return _make_result("", success=False)
        if "getprop" in cmd_str:
            key = cmd[-1]
            return _make_result(prop_values.get(key, ""), success=True)
        return _make_result("", success=False)

    monkeypatch.setattr(telco, "execute_command", fake_execute)
    result = telco.check_network_registration()

    assert result["success"] is True
    assert result["low_permission"] is True
    info = result["registration_info"]
    assert info["operator"] == "Orange"
    assert info["network_technology"] == "4G (LTE)"
    assert info["source"] == "getprop"


def test_parse_registration_info_varied_dumpsys_samples():
    telco = TelcoModules(device_id="device-parse")
    samsung_dump = (
        "mServiceState=0 mOperatorAlphaLong=Orange mOperatorNumeric=20801 "
        "mDataNetworkType=LTE_CA mVoiceNetworkType=LTE\n"
        "Phone Id=0 mOperatorAlphaShort=Orange mOperatorNumeric=20801 mDataNetworkType=LTE_CA mVoiceNetworkType=LTE\n"
    )
    pixel_dump = (
        "mServiceState=0 mOperatorAlphaShort=Bouygues mOperatorNumeric=20820 "
        "mDataNetworkType=13 mVoiceNetworkType=3\n"
        "Phone Id=0 mOperatorAlphaShort=Bouygues mOperatorNumeric=20820 mDataNetworkType=13 mVoiceNetworkType=3\n"
    )
    xiaomi_dump = (
        "mServiceState=0 mOperatorAlphaLong=SFR mOperatorNumeric=20810 "
        "mDataNetworkType=NR mVoiceNetworkType=LTE\n"
        "Phone Id=0 mOperatorAlphaShort=SFR mOperatorNumeric=20810 mDataNetworkType=NR mVoiceNetworkType=LTE\n"
        "Phone Id=1 mOperatorAlphaShort=Free mOperatorNumeric=20815 mDataNetworkType=LTE mVoiceNetworkType=LTE\n"
    )

    samsung_info = telco._parse_registration_info(samsung_dump)
    assert samsung_info["network_technology"] == "4G+ (LTE_CA)"
    assert samsung_info["data_network_technology"] == "4G+ (LTE_CA)"
    assert samsung_info["voice_network_technology"] == "4G (LTE)"

    pixel_info = telco._parse_registration_info(pixel_dump)
    assert pixel_info["network_technology"] == "4G (LTE)"
    assert pixel_info["data_network_technology"] == "4G (LTE)"
    assert pixel_info["voice_network_technology"] == "3G (UMTS)"

    xiaomi_info = telco._parse_registration_info(xiaomi_dump)
    assert xiaomi_info["network_technology"] == "5G (NR)"
    assert len(xiaomi_info["sim_slots"]) == 2
