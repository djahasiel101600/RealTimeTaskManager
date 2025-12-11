import asyncio

from apps.notifications.models import send_notification_ws

captured = {}

class DummyChannelLayer:
    async def group_send(self, group, message):
        # store call data in a module-level dict for assertions
        captured['group'] = group
        captured['message'] = message


def test_send_notification_ws_calls_group_send(monkeypatch):
    dummy = DummyChannelLayer()

    # Patch get_channel_layer to return our dummy
    monkeypatch.setattr('channels.layers.get_channel_layer', lambda: dummy)

    # Call the helper synchronously; it uses async_to_sync internally
    send_notification_ws(123, {'id': 1, 'title': 'Test'})

    assert captured.get('group') == 'notifications_123'
    assert isinstance(captured.get('message'), dict)
    assert captured['message'].get('type') == 'send_notification'
    assert 'data' in captured['message']
    assert captured['message']['data']['id'] == 1
