"""Regression tests for Claude models with adaptive thinking."""

from types import SimpleNamespace

import pytest

from services.motor_ia import _extract_response_text, _message_options_for_model
from routers.operations import _anthropic_http_exception


def test_sonnet_5_omits_deprecated_sampling_parameters():
    options = _message_options_for_model("claude-sonnet-5")

    assert options == {"thinking": {"type": "disabled"}}
    assert "temperature" not in options
    assert "top_p" not in options
    assert "top_k" not in options


def test_other_adaptive_thinking_models_omit_sampling_parameters():
    for model in ("claude-opus-4-7", "claude-opus-4-8", "claude-fable-5", "claude-mythos-5"):
        assert _message_options_for_model(model) == {}


def test_legacy_models_keep_deterministic_temperature():
    assert _message_options_for_model("claude-sonnet-4-6") == {"temperature": 0}


def test_sonnet_5_response_ignores_thinking_block_and_reads_text():
    response = SimpleNamespace(content=[
        SimpleNamespace(type="thinking", thinking="internal reasoning"),
        SimpleNamespace(type="text", text='{"tablilla_id":"T1","cells":[]}'),
    ])

    assert _extract_response_text(response) == '{"tablilla_id":"T1","cells":[]}'


def test_response_text_supports_multiple_sdk_or_dict_blocks():
    response = SimpleNamespace(content=[
        {"type": "thinking", "thinking": "internal"},
        {"type": "text", "text": "first"},
        SimpleNamespace(type="text", text="second"),
    ])

    assert _extract_response_text(response) == "first\nsecond"


def test_response_without_text_fails_with_actionable_error():
    response = SimpleNamespace(content=[SimpleNamespace(type="thinking", thinking="internal")])

    with pytest.raises(ValueError, match="bloque de texto"):
        _extract_response_text(response)


def test_low_credit_error_is_safe_and_actionable():
    error = RuntimeError("Your credit balance is too low to access the Anthropic API")
    translated = _anthropic_http_exception(error)

    assert translated.status_code == 503
    assert "créditos" in translated.detail
    assert "API key" in translated.detail


def test_temperature_error_does_not_leak_provider_payload():
    error = RuntimeError("temperature is deprecated for this model; request_id=secret")
    translated = _anthropic_http_exception(error)

    assert translated.status_code == 502
    assert "Sonnet 5" in translated.detail
    assert "request_id" not in translated.detail
