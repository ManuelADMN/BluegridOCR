from services.audit import insert_audit_event


class FakeCursor:
    def __init__(self):
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))


def test_insert_audit_event_crea_evento_normalizado():
    cur = FakeCursor()
    insert_audit_event(
        cur,
        {"id": "7", "username": "admin@bluegrid.cl", "role": "admin"},
        action="test_action",
        entity="registros_ocr",
        entity_id=12,
        detail={"ok": True},
        ip_origin="127.0.0.1",
        user_agent="pytest",
    )

    assert len(cur.calls) == 2
    _, params = cur.calls[-1]
    assert params[0] == 7
    assert params[1] == "admin@bluegrid.cl"
    assert params[2] == "admin"
    assert params[3] == "test_action"
    assert params[4] == "registros_ocr"
    assert params[5] == "12"
    assert params[7] == "127.0.0.1"
    assert params[8] == "pytest"
